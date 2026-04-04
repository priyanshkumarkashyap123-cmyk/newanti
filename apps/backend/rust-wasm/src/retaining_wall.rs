// ============================================================================
// RETAINING WALL DESIGN MODULE
// Design per IS 456, Eurocode 7/8, AASHTO LRFD
// ============================================================================

use serde::{Deserialize, Serialize};

use crate::rebar_utils::circle_area;

// ============================================================================
// SOIL AND BACKFILL PROPERTIES
// ============================================================================

/// Soil/backfill properties for retaining wall design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackfillProperties {
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Angle of internal friction (degrees)
    pub phi: f64,
    /// Cohesion (kPa)
    pub c: f64,
    /// Wall friction angle (degrees)
    pub delta: f64,
    /// Backfill slope angle (degrees)
    pub beta: f64,
    /// Saturated unit weight (kN/m³)
    pub gamma_sat: f64,
}

impl BackfillProperties {
    pub fn new(gamma: f64, phi: f64, c: f64) -> Self {
        Self {
            gamma,
            phi,
            c,
            delta: phi * 0.67,     // Typically 2/3 φ
            beta: 0.0,             // Level backfill
            gamma_sat: gamma + 4.0, // Approximate
        }
    }
    
    /// Angle in radians
    pub fn phi_rad(&self) -> f64 {
        self.phi.to_radians()
    }
    
    pub fn delta_rad(&self) -> f64 {
        self.delta.to_radians()
    }
    
    pub fn beta_rad(&self) -> f64 {
        self.beta.to_radians()
    }
    
    /// Submerged unit weight
    pub fn gamma_sub(&self) -> f64 {
        self.gamma_sat - 9.81
    }
}

/// Foundation soil properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationSoil {
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Angle of internal friction (degrees)
    pub phi: f64,
    /// Cohesion (kPa)
    pub c: f64,
    /// Allowable bearing pressure (kPa)
    pub qa: f64,
    /// Coefficient of friction (base)
    pub mu: f64,
}

impl FoundationSoil {
    pub fn new(gamma: f64, phi: f64, c: f64, qa: f64) -> Self {
        Self {
            gamma,
            phi,
            c,
            qa,
            mu: phi.to_radians().tan(),
        }
    }
}

// ============================================================================
// EARTH PRESSURE CALCULATIONS
// ============================================================================

/// Earth pressure calculation methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EarthPressureMethod {
    Rankine,
    Coulomb,
    MononobeOkabe, // Seismic
}

/// Earth pressure calculator
pub struct EarthPressureCalculator {
    pub backfill: BackfillProperties,
    pub method: EarthPressureMethod,
}

impl EarthPressureCalculator {
    pub fn new(backfill: BackfillProperties, method: EarthPressureMethod) -> Self {
        Self { backfill, method }
    }
    
    /// Active earth pressure coefficient Ka (Rankine)
    pub fn ka_rankine(&self) -> f64 {
        let phi = self.backfill.phi_rad();
        let beta = self.backfill.beta_rad();
        
        if beta.abs() < 0.001 {
            // Level backfill
            (1.0 - phi.sin()) / (1.0 + phi.sin())
        } else {
            // Sloping backfill
            let cos_beta = beta.cos();
            let term = (beta.cos().powi(2) - phi.cos().powi(2)).sqrt();
            cos_beta * (cos_beta - term) / (cos_beta + term)
        }
    }
    
    /// Passive earth pressure coefficient Kp (Rankine)
    pub fn kp_rankine(&self) -> f64 {
        let phi = self.backfill.phi_rad();
        (1.0 + phi.sin()) / (1.0 - phi.sin())
    }
    
    /// Active earth pressure coefficient Ka (Coulomb)
    pub fn ka_coulomb(&self, alpha: f64) -> f64 {
        let phi = self.backfill.phi_rad();
        let delta = self.backfill.delta_rad();
        let beta = self.backfill.beta_rad();
        let alpha_rad = alpha.to_radians();
        
        let sin_phi_alpha = (phi + alpha_rad).sin();
        let sin_alpha = alpha_rad.sin();
        let sin_alpha_delta = (alpha_rad - delta).sin();
        let sin_phi_delta = (phi + delta).sin();
        let sin_phi_beta = (phi - beta).sin();
        let sin_alpha_beta = (alpha_rad + beta).sin();
        
        let num = sin_phi_alpha.powi(2);
        let denom = sin_alpha.powi(2) * sin_alpha_delta * 
                    (1.0 + (sin_phi_delta * sin_phi_beta / (sin_alpha_delta * sin_alpha_beta)).sqrt()).powi(2);
        
        if denom > 0.0 {
            num / denom
        } else {
            self.ka_rankine()
        }
    }
    
    /// Passive earth pressure coefficient Kp (Coulomb)
    pub fn kp_coulomb(&self, alpha: f64) -> f64 {
        let phi = self.backfill.phi_rad();
        let delta = self.backfill.delta_rad();
        let beta = self.backfill.beta_rad();
        let alpha_rad = alpha.to_radians();
        
        let sin_phi_alpha = (phi - alpha_rad).sin();
        let sin_alpha = alpha_rad.sin();
        let sin_alpha_delta = (alpha_rad + delta).sin();
        let sin_phi_delta = (phi + delta).sin();
        let sin_phi_beta = (phi + beta).sin();
        let sin_alpha_beta = (alpha_rad - beta).sin();
        
        let num = sin_phi_alpha.powi(2);
        let denom = sin_alpha.powi(2) * sin_alpha_delta * 
                    (1.0 - (sin_phi_delta * sin_phi_beta / (sin_alpha_delta * sin_alpha_beta.abs())).sqrt()).powi(2);
        
        if denom > 0.0 {
            num / denom
        } else {
            self.kp_rankine()
        }
    }
    
    /// Seismic active earth pressure coefficient (Mononobe-Okabe)
    pub fn ka_seismic(&self, kh: f64, kv: f64, alpha: f64) -> f64 {
        let phi = self.backfill.phi_rad();
        let delta = self.backfill.delta_rad();
        let beta = self.backfill.beta_rad();
        let alpha_rad = alpha.to_radians();
        
        // Seismic inertia angle
        let theta = (kh / (1.0 - kv)).atan();
        
        // Mononobe-Okabe active coefficient
        // KAE = sin²(α+φ−θ) / [cosθ·sin²α·sin(α−δ−θ)·(1+√(sin(φ+δ)sin(φ−β−θ)/(sin(α−δ−θ)sin(α+β))))²]
        let sin_phi_theta_alpha = (alpha_rad + phi - theta).sin();
        let cos_theta = theta.cos();
        let sin_alpha = alpha_rad.sin();
        let sin_alpha_delta_theta = (alpha_rad - delta - theta).sin();
        let sin_phi_delta = (phi + delta).sin();
        let sin_phi_beta_theta = (phi - beta - theta).sin();
        let sin_alpha_beta = (alpha_rad + beta).sin();
        
        let num = sin_phi_theta_alpha.powi(2);
        let denom = cos_theta * sin_alpha.powi(2) * sin_alpha_delta_theta * 
                    (1.0 + (sin_phi_delta * sin_phi_beta_theta / (sin_alpha_delta_theta * sin_alpha_beta)).sqrt()).powi(2);
        
        if denom > 0.0 {
            num / denom
        } else {
            self.ka_rankine() * (1.0 + kh)
        }
    }
    
    /// At-rest earth pressure coefficient K0
    pub fn k0(&self) -> f64 {
        1.0 - self.backfill.phi_rad().sin()
    }
    
    /// Active earth pressure at depth z (kPa)
    pub fn active_pressure(&self, z: f64, alpha: f64) -> f64 {
        let ka = match self.method {
            EarthPressureMethod::Rankine => self.ka_rankine(),
            EarthPressureMethod::Coulomb => self.ka_coulomb(alpha),
            EarthPressureMethod::MononobeOkabe => self.ka_coulomb(alpha), // Use Coulomb for static
        };
        
        ka * self.backfill.gamma * z - 2.0 * self.backfill.c * ka.sqrt()
    }
    
    /// Total active thrust per unit width (kN/m)
    pub fn active_thrust(&self, h: f64, alpha: f64) -> f64 {
        let ka = match self.method {
            EarthPressureMethod::Rankine => self.ka_rankine(),
            EarthPressureMethod::Coulomb => self.ka_coulomb(alpha),
            EarthPressureMethod::MononobeOkabe => self.ka_coulomb(alpha),
        };
        
        0.5 * ka * self.backfill.gamma * h.powi(2)
    }
    
    /// Point of application of active thrust from base (m)
    pub fn active_thrust_location(&self, h: f64) -> f64 {
        h / 3.0
    }
}

// ============================================================================
// RETAINING WALL TYPES
// ============================================================================

/// Types of retaining walls
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RetainingWallType {
    Gravity,
    Cantilever,
    Counterfort,
    Buttressed,
    SheetPile,
    MechanicallyStabilized,
}

/// Cantilever retaining wall geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CantileverWallGeometry {
    /// Total height (m)
    pub h: f64,
    /// Stem thickness at base (m)
    pub stem_base: f64,
    /// Stem thickness at top (m)
    pub stem_top: f64,
    /// Base slab width (m)
    pub base_width: f64,
    /// Base slab thickness (m)
    pub base_thickness: f64,
    /// Toe length (m)
    pub toe: f64,
    /// Heel length (m)
    pub heel: f64,
    /// Shear key depth (m)
    pub key_depth: f64,
    /// Shear key width (m)
    pub key_width: f64,
}

impl CantileverWallGeometry {
    /// Create with standard proportions
    pub fn standard(h: f64) -> Self {
        let base_width = 0.5 * h + 0.3;
        let base_thickness = 0.1 * h;
        let toe = 0.15 * base_width;
        let heel = base_width - toe - 0.1 * h;
        
        Self {
            h,
            stem_base: 0.1 * h,
            stem_top: 0.25,
            base_width,
            base_thickness,
            toe,
            heel,
            key_depth: 0.0,
            key_width: 0.0,
        }
    }
    
    /// Stem height above base
    pub fn stem_height(&self) -> f64 {
        self.h - self.base_thickness
    }
    
    /// Average stem thickness
    pub fn stem_avg(&self) -> f64 {
        (self.stem_base + self.stem_top) / 2.0
    }
}

/// Gravity retaining wall geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GravityWallGeometry {
    /// Total height (m)
    pub h: f64,
    /// Base width (m)
    pub base_width: f64,
    /// Top width (m)
    pub top_width: f64,
    /// Front batter (horizontal:vertical)
    pub front_batter: f64,
    /// Back batter (horizontal:vertical)
    pub back_batter: f64,
}

impl GravityWallGeometry {
    pub fn standard(h: f64) -> Self {
        Self {
            h,
            base_width: 0.5 * h,
            top_width: 0.3,
            front_batter: 0.0,
            back_batter: 0.0,
        }
    }
    
    /// Cross-sectional area
    pub fn area(&self) -> f64 {
        0.5 * (self.base_width + self.top_width) * self.h
    }
    
    /// Distance to centroid from toe
    pub fn centroid_x(&self) -> f64 {
        let a1 = self.top_width * self.h;
        let x1 = self.base_width - self.top_width / 2.0 - self.front_batter * self.h;
        let a2 = 0.5 * (self.base_width - self.top_width) * self.h;
        let x2 = (self.base_width - self.top_width) / 3.0;
        
        (a1 * x1 + a2 * x2) / (a1 + a2)
    }
}

// ============================================================================
// STABILITY ANALYSIS
// ============================================================================

/// Retaining wall stability results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StabilityResults {
    pub overturning: OverturningCheck,
    pub sliding: SlidingCheck,
    pub bearing: BearingCheck,
    pub eccentricity: EccentricityCheck,
    pub all_pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverturningCheck {
    pub resisting_moment: f64,
    pub overturning_moment: f64,
    pub factor_of_safety: f64,
    pub required_fos: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlidingCheck {
    pub resisting_force: f64,
    pub sliding_force: f64,
    pub factor_of_safety: f64,
    pub required_fos: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCheck {
    pub max_pressure: f64,
    pub min_pressure: f64,
    pub allowable_pressure: f64,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EccentricityCheck {
    pub eccentricity: f64,
    pub limit: f64,
    pub pass: bool,
}

/// Cantilever wall designer
pub struct CantileverWallDesigner {
    pub geometry: CantileverWallGeometry,
    pub backfill: BackfillProperties,
    pub foundation: FoundationSoil,
    pub concrete_unit_weight: f64,
    pub surcharge: f64,
}

impl CantileverWallDesigner {
    pub fn new(
        geometry: CantileverWallGeometry,
        backfill: BackfillProperties,
        foundation: FoundationSoil,
    ) -> Self {
        Self {
            geometry,
            backfill,
            foundation,
            concrete_unit_weight: 25.0,
            surcharge: 0.0,
        }
    }
    
    /// Calculate self-weight per unit length (kN/m)
    pub fn self_weight(&self) -> f64 {
        let g = &self.geometry;
        
        // Stem weight
        let stem_area = 0.5 * (g.stem_base + g.stem_top) * g.stem_height();
        let w_stem = stem_area * self.concrete_unit_weight;
        
        // Base slab weight
        let w_base = g.base_width * g.base_thickness * self.concrete_unit_weight;
        
        // Shear key weight
        let w_key = g.key_depth * g.key_width * self.concrete_unit_weight;
        
        w_stem + w_base + w_key
    }
    
    /// Weight of backfill on heel (kN/m)
    pub fn backfill_weight(&self) -> f64 {
        let g = &self.geometry;
        let heel_height = g.h - g.base_thickness;
        g.heel * heel_height * self.backfill.gamma
    }
    
    /// Surcharge load on heel (kN/m)
    pub fn surcharge_load(&self) -> f64 {
        self.geometry.heel * self.surcharge
    }
    
    /// Total vertical load (kN/m)
    pub fn total_vertical_load(&self) -> f64 {
        self.self_weight() + self.backfill_weight() + self.surcharge_load()
    }
    
    /// Calculate active thrust
    pub fn active_thrust(&self) -> f64 {
        let calc = EarthPressureCalculator::new(
            self.backfill.clone(),
            EarthPressureMethod::Coulomb,
        );
        
        let h = self.geometry.h;
        calc.active_thrust(h, 90.0)
    }
    
    /// Horizontal component of active thrust
    pub fn horizontal_thrust(&self) -> f64 {
        let pa = self.active_thrust();
        let delta = self.backfill.delta_rad();
        pa * delta.cos()
    }
    
    /// Vertical component of active thrust
    pub fn vertical_thrust(&self) -> f64 {
        let pa = self.active_thrust();
        let delta = self.backfill.delta_rad();
        pa * delta.sin()
    }
    
    /// Resisting moment about toe (kN·m/m)
    pub fn resisting_moment(&self) -> f64 {
        let g = &self.geometry;
        
        // Stem moment arm from toe
        let stem_area = 0.5 * (g.stem_base + g.stem_top) * g.stem_height();
        // Correct centroid of tapered section: (a² + ab + b²) / (3(a+b))
        let a = g.stem_base;
        let b = g.stem_top;
        let stem_centroid = g.toe + if (a - b).abs() < 1e-9 {
            a / 2.0
        } else {
            (a * a + a * b + b * b) / (3.0 * (a + b))
        };
        let m_stem = stem_area * self.concrete_unit_weight * stem_centroid;
        
        // Base slab moment
        let m_base = g.base_width * g.base_thickness * self.concrete_unit_weight * g.base_width / 2.0;
        
        // Backfill moment
        let backfill_arm = g.toe + g.stem_base + g.heel / 2.0;
        let m_backfill = self.backfill_weight() * backfill_arm;
        
        // Vertical thrust moment
        let m_vthrust = self.vertical_thrust() * g.base_width;
        
        // Surcharge moment
        let m_surcharge = self.surcharge_load() * backfill_arm;
        
        m_stem + m_base + m_backfill + m_vthrust + m_surcharge
    }
    
    /// Overturning moment about toe (kN·m/m)
    pub fn overturning_moment(&self) -> f64 {
        let h = self.geometry.h;
        let ph = self.horizontal_thrust();
        
        // Thrust acts at H/3 from base
        ph * h / 3.0
    }
    
    /// Check overturning stability
    pub fn check_overturning(&self, required_fos: f64) -> OverturningCheck {
        let mr = self.resisting_moment();
        let mo = self.overturning_moment();
        let fos = mr / mo;
        
        OverturningCheck {
            resisting_moment: mr,
            overturning_moment: mo,
            factor_of_safety: fos,
            required_fos,
            pass: fos >= required_fos,
        }
    }
    
    /// Check sliding stability
    pub fn check_sliding(&self, required_fos: f64) -> SlidingCheck {
        let v = self.total_vertical_load();
        let ph = self.horizontal_thrust();
        
        // Friction resistance
        let fr = v * self.foundation.mu;
        
        // Passive resistance (if key provided) - use foundation soil, not backfill
        let foundation_as_backfill = BackfillProperties::new(
            self.foundation.gamma, self.foundation.phi, self.foundation.c,
        );
        let kp = EarthPressureCalculator::new(
            foundation_as_backfill,
            EarthPressureMethod::Rankine,
        ).kp_rankine();
        
        let pp = 0.5 * kp * self.foundation.gamma * self.geometry.key_depth.powi(2);
        
        let resisting = fr + pp;
        let fos = resisting / ph;
        
        SlidingCheck {
            resisting_force: resisting,
            sliding_force: ph,
            factor_of_safety: fos,
            required_fos,
            pass: fos >= required_fos,
        }
    }
    
    /// Check bearing pressure
    pub fn check_bearing(&self) -> BearingCheck {
        let v = self.total_vertical_load();
        let mr = self.resisting_moment();
        let mo = self.overturning_moment();
        let b = self.geometry.base_width;
        
        // Eccentricity
        let x = (mr - mo) / v;
        let e = b / 2.0 - x;
        
        // Base pressure (trapezoidal distribution)
        let (q_max, q_min) = if e <= b / 6.0 {
            let q_avg = v / b;
            let q_diff = 6.0 * v * e / b.powi(2);
            (q_avg + q_diff, q_avg - q_diff)
        } else {
            // Resultant outside middle third
            let b_eff = 3.0 * (b / 2.0 - e);
            (2.0 * v / b_eff, 0.0)
        };
        
        BearingCheck {
            max_pressure: q_max,
            min_pressure: q_min,
            allowable_pressure: self.foundation.qa,
            pass: q_max <= self.foundation.qa && q_min >= 0.0,
        }
    }
    
    /// Check eccentricity
    pub fn check_eccentricity(&self) -> EccentricityCheck {
        let v = self.total_vertical_load();
        let mr = self.resisting_moment();
        let mo = self.overturning_moment();
        let b = self.geometry.base_width;
        
        let x = (mr - mo) / v;
        let e = (b / 2.0 - x).abs();
        let limit = b / 6.0;
        
        EccentricityCheck {
            eccentricity: e,
            limit,
            pass: e <= limit,
        }
    }
    
    /// Complete stability check
    pub fn check_stability(&self) -> StabilityResults {
        let overturning = self.check_overturning(2.0);
        let sliding = self.check_sliding(1.5);
        let bearing = self.check_bearing();
        let eccentricity = self.check_eccentricity();
        
        let all_pass = overturning.pass && sliding.pass && bearing.pass && eccentricity.pass;
        
        StabilityResults {
            overturning,
            sliding,
            bearing,
            eccentricity,
            all_pass,
        }
    }
}

// ============================================================================
// STRUCTURAL DESIGN
// ============================================================================

/// Stem reinforcement design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemReinforcementDesign {
    /// Main vertical bars (back face)
    pub main_bar_dia: f64,
    pub main_bar_spacing: f64,
    pub main_as: f64,
    /// Distribution bars (horizontal)
    pub dist_bar_dia: f64,
    pub dist_bar_spacing: f64,
    /// Front face bars
    pub front_bar_dia: f64,
    pub front_bar_spacing: f64,
    /// Design moment (kN·m/m)
    pub design_moment: f64,
    /// Design shear (kN/m)
    pub design_shear: f64,
}

/// Design stem reinforcement (IS 456)
pub fn design_stem_reinforcement(
    wall: &CantileverWallDesigner,
    fck: f64,
    fy: f64,
    cover: f64,
) -> StemReinforcementDesign {
    let g = &wall.geometry;
    
    // Maximum moment at base of stem
    let calc = EarthPressureCalculator::new(
        wall.backfill.clone(),
        EarthPressureMethod::Coulomb,
    );
    let ka = calc.ka_coulomb(90.0);
    let h = g.stem_height();
    
    // Moment = Ka * γ * h³ / 6
    let m_u = 1.5 * ka * wall.backfill.gamma * h.powi(3) / 6.0;
    
    // Shear at base
    let v_u = 1.5 * ka * wall.backfill.gamma * h.powi(2) / 2.0;
    
    // Effective depth
    let d = g.stem_base * 1000.0 - cover - 8.0; // mm
    
    // Required steel area (IS 456)
    let mu_lim = 0.138 * fck * 1000.0 * d.powi(2) / 1e6; // kN·m/m
    
    let as_req = if m_u <= mu_lim {
        // Singly reinforced
        let ast = 0.5 * fck / fy * (1.0 - (1.0 - 4.6 * m_u * 1e6 / (fck * 1000.0 * d.powi(2))).sqrt()) * 1000.0 * d;
        ast
    } else {
        // Need compression steel - simplified
        m_u * 1e6 / (0.87 * fy * 0.9 * d)
    };
    
    // Minimum steel (0.12% for HYSD)
    let as_min = 0.0012 * g.stem_base * 1000.0 * 1000.0;
    
    let as_provided = as_req.max(as_min);
    
    // Select bar diameter and spacing
    let bar_dia: f64 = 16.0;
    let bar_area = circle_area(bar_dia);
    let spacing = (bar_area / as_provided * 1000.0).floor();
    
    StemReinforcementDesign {
        main_bar_dia: bar_dia,
        main_bar_spacing: spacing.max(100.0).min(300.0),
        main_as: as_provided,
        dist_bar_dia: 10.0,
        dist_bar_spacing: 200.0,
        front_bar_dia: 10.0,
        front_bar_spacing: 200.0,
        design_moment: m_u,
        design_shear: v_u,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backfill_properties() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        
        assert!((backfill.phi - 30.0).abs() < 0.01);
        // delta = 0.67 * phi = 0.67 * 30 = 20.1
        assert!((backfill.delta - 20.1).abs() < 0.5);
    }

    #[test]
    fn test_ka_rankine() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::Rankine);
        
        let ka = calc.ka_rankine();
        // Ka for φ=30° should be about 0.333
        assert!((ka - 0.333).abs() < 0.01);
    }

    #[test]
    fn test_kp_rankine() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::Rankine);
        
        let kp = calc.kp_rankine();
        // Kp for φ=30° should be about 3.0
        assert!((kp - 3.0).abs() < 0.1);
    }

    #[test]
    fn test_ka_coulomb() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::Coulomb);
        
        let ka = calc.ka_coulomb(90.0); // Vertical wall
        assert!(ka > 0.0 && ka < 1.0);
    }

    #[test]
    fn test_active_pressure() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::Rankine);
        
        let p5 = calc.active_pressure(5.0, 90.0);
        assert!(p5 > 0.0);
    }

    #[test]
    fn test_k0() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::Rankine);
        
        let k0 = calc.k0();
        // K0 = 1 - sin(30°) = 0.5
        assert!((k0 - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_cantilever_geometry() {
        let geom = CantileverWallGeometry::standard(6.0);
        
        assert!(geom.base_width > 0.0);
        assert!(geom.toe > 0.0);
        assert!(geom.heel > 0.0);
    }

    #[test]
    fn test_gravity_geometry() {
        let geom = GravityWallGeometry::standard(4.0);
        
        assert!(geom.area() > 0.0);
        assert!(geom.centroid_x() > 0.0);
    }

    #[test]
    fn test_cantilever_wall_designer() {
        let geom = CantileverWallGeometry::standard(5.0);
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 28.0, 0.0, 150.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        
        assert!(designer.self_weight() > 0.0);
        assert!(designer.active_thrust() > 0.0);
    }

    #[test]
    fn test_overturning_check() {
        let geom = CantileverWallGeometry::standard(5.0);
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 28.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        let check = designer.check_overturning(2.0);
        
        assert!(check.factor_of_safety > 0.0);
    }

    #[test]
    fn test_sliding_check() {
        let geom = CantileverWallGeometry::standard(4.0);
        let backfill = BackfillProperties::new(18.0, 32.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 30.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        let check = designer.check_sliding(1.5);
        
        assert!(check.factor_of_safety > 0.0);
    }

    #[test]
    fn test_bearing_check() {
        let geom = CantileverWallGeometry::standard(5.0);
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 28.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        let check = designer.check_bearing();
        
        assert!(check.max_pressure > 0.0);
        assert!(check.max_pressure >= check.min_pressure);
    }

    #[test]
    fn test_complete_stability() {
        let geom = CantileverWallGeometry::standard(4.0);
        let backfill = BackfillProperties::new(18.0, 32.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 30.0, 5.0, 250.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        let results = designer.check_stability();
        
        // Check that all analyses completed
        assert!(results.overturning.factor_of_safety > 0.0);
        assert!(results.sliding.factor_of_safety > 0.0);
        assert!(results.bearing.max_pressure > 0.0);
    }

    #[test]
    fn test_seismic_ka() {
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let calc = EarthPressureCalculator::new(backfill, EarthPressureMethod::MononobeOkabe);
        
        let ka_static = calc.ka_coulomb(90.0);
        let ka_seismic = calc.ka_seismic(0.1, 0.0, 90.0);
        
        // Both should be positive and reasonable
        assert!(ka_static > 0.0 && ka_static < 1.0);
        assert!(ka_seismic > 0.0 && ka_seismic < 2.0);
    }

    #[test]
    fn test_stem_reinforcement() {
        let geom = CantileverWallGeometry::standard(5.0);
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 28.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        let rebar = design_stem_reinforcement(&designer, 25.0, 415.0, 50.0);
        
        assert!(rebar.main_as > 0.0);
        assert!(rebar.design_moment > 0.0);
    }

    #[test]
    fn test_backfill_weight() {
        let geom = CantileverWallGeometry::standard(5.0);
        let backfill = BackfillProperties::new(18.0, 30.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 28.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        
        assert!(designer.backfill_weight() > 0.0);
    }

    #[test]
    fn test_thrust_components() {
        let geom = CantileverWallGeometry::standard(4.0);
        let backfill = BackfillProperties::new(18.0, 32.0, 0.0);
        let foundation = FoundationSoil::new(19.0, 30.0, 0.0, 200.0);
        
        let designer = CantileverWallDesigner::new(geom, backfill, foundation);
        
        let ph = designer.horizontal_thrust();
        let pv = designer.vertical_thrust();
        let pa = designer.active_thrust();
        
        // Check components sum correctly (Pythagorean)
        let pa_calc = (ph.powi(2) + pv.powi(2)).sqrt();
        assert!((pa - pa_calc).abs() < 0.1);
    }
}
