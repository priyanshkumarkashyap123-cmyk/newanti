// ============================================================================
// COASTAL & MARINE STRUCTURES MODULE
// Breakwaters, quay walls, wave loading per CIRIA, USACE, Eurocode
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// WAVE PARAMETERS
// ============================================================================

/// Wave theory type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WaveTheory {
    /// Linear (Airy) wave theory
    Linear,
    /// Stokes 2nd order
    Stokes2nd,
    /// Stokes 5th order
    Stokes5th,
    /// Cnoidal
    Cnoidal,
    /// Stream function
    StreamFunction,
}

/// Wave parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveParameters {
    /// Significant wave height Hs (m)
    pub hs: f64,
    /// Peak period Tp (s)
    pub tp: f64,
    /// Water depth d (m)
    pub depth: f64,
    /// Wave direction (degrees from North)
    pub direction: f64,
    /// Spectral peakedness parameter γ
    pub gamma: f64,
}

impl WaveParameters {
    pub fn new(hs: f64, tp: f64, depth: f64) -> Self {
        Self {
            hs,
            tp,
            depth,
            direction: 0.0,
            gamma: 3.3, // JONSWAP default
        }
    }
    
    /// Peak wavelength (m) - deep water
    pub fn wavelength_deep(&self) -> f64 {
        let g = 9.81;
        g * self.tp.powi(2) / (2.0 * PI)
    }
    
    /// Wavelength at depth (m) - iterative dispersion relation
    pub fn wavelength(&self) -> f64 {
        let l0 = self.wavelength_deep();
        let d = self.depth;
        
        // Iterative solution
        let mut l = l0;
        for _ in 0..20 {
            let kd = 2.0 * PI * d / l;
            l = l0 * kd.tanh();
        }
        
        l
    }
    
    /// Wave number k (rad/m)
    pub fn wave_number(&self) -> f64 {
        2.0 * PI / self.wavelength()
    }
    
    /// Relative depth d/L
    pub fn relative_depth(&self) -> f64 {
        self.depth / self.wavelength()
    }
    
    /// Is deep water? (d/L > 0.5)
    pub fn is_deep_water(&self) -> bool {
        self.relative_depth() > 0.5
    }
    
    /// Is shallow water? (d/L < 0.05)
    pub fn is_shallow_water(&self) -> bool {
        self.relative_depth() < 0.05
    }
    
    /// Wave celerity (m/s)
    pub fn celerity(&self) -> f64 {
        self.wavelength() / self.tp
    }
    
    /// Group velocity (m/s)
    pub fn group_velocity(&self) -> f64 {
        let kd = self.wave_number() * self.depth;
        let n = 0.5 * (1.0 + 2.0 * kd / (2.0 * kd).sinh());
        
        n * self.celerity()
    }
    
    /// Wave steepness Hs/Lp
    pub fn steepness(&self) -> f64 {
        self.hs / self.wavelength()
    }
    
    /// Maximum wave height Hmax (m)
    pub fn h_max(&self) -> f64 {
        // Rayleigh distribution estimate
        1.86 * self.hs
    }
    
    /// Design wave height H1/10 (m)
    pub fn h_1_10(&self) -> f64 {
        1.27 * self.hs
    }
    
    /// Wave energy density (J/m²)
    pub fn energy_density(&self) -> f64 {
        let rho = 1025.0; // Seawater density kg/m³
        let g = 9.81;
        
        rho * g * self.hs.powi(2) / 16.0
    }
    
    /// Wave power/energy flux (kW/m)
    pub fn wave_power(&self) -> f64 {
        self.energy_density() * self.group_velocity() / 1000.0
    }
}

/// Wave transformation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveTransformation {
    /// Offshore wave parameters
    pub offshore: WaveParameters,
    /// Nearshore depth (m)
    pub nearshore_depth: f64,
    /// Bottom slope
    pub slope: f64,
}

impl WaveTransformation {
    pub fn new(offshore: WaveParameters, nearshore_depth: f64, slope: f64) -> Self {
        Self {
            offshore,
            nearshore_depth,
            slope,
        }
    }
    
    /// Shoaling coefficient Ks
    pub fn shoaling_coefficient(&self) -> f64 {
        let cg0 = self.offshore.group_velocity();
        
        let mut nearshore = self.offshore.clone();
        nearshore.depth = self.nearshore_depth;
        let cg = nearshore.group_velocity();
        
        (cg0 / cg).sqrt()
    }
    
    /// Refraction coefficient Kr (simplified)
    pub fn refraction_coefficient(&self, angle_offshore: f64) -> f64 {
        let _d0 = self.offshore.depth;
        let _d = self.nearshore_depth;
        let c0 = self.offshore.celerity();
        
        let mut nearshore = self.offshore.clone();
        nearshore.depth = self.nearshore_depth;
        let c = nearshore.celerity();
        
        // Snell's law
        let sin_theta_0 = angle_offshore.to_radians().sin();
        let sin_theta = sin_theta_0 * c / c0;
        
        if sin_theta.abs() > 1.0 {
            return 0.0; // Total reflection
        }
        
        let theta = sin_theta.asin();
        let cos_theta_0 = angle_offshore.to_radians().cos();
        let cos_theta = theta.cos();
        
        (cos_theta_0 / cos_theta).sqrt()
    }
    
    /// Breaking wave height (m) - Goda
    pub fn breaking_height(&self) -> f64 {
        let l0 = self.offshore.wavelength_deep();
        let d = self.nearshore_depth;
        
        // Goda breaking criterion
        let a = 0.17;
        let b = 1.5 * PI * d / l0;
        
        a * l0 * (1.0 - (-b).exp()) * (1.0 + 15.0 * self.slope.powf(4.0 / 3.0))
    }
    
    /// Breaking depth (m)
    pub fn breaking_depth(&self) -> f64 {
        let hs = self.offshore.hs;
        
        // Simplified: d_b ≈ Hs / 0.78
        hs / 0.78
    }
    
    /// Transformed wave height (m)
    pub fn transformed_height(&self, angle: f64) -> f64 {
        let ks = self.shoaling_coefficient();
        let kr = self.refraction_coefficient(angle);
        let hs_trans = self.offshore.hs * ks * kr;
        
        // Check breaking limit
        hs_trans.min(self.breaking_height())
    }
}

// ============================================================================
// RUBBLE MOUND BREAKWATER
// ============================================================================

/// Armor unit type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ArmorUnit {
    /// Natural rock
    Rock,
    /// Cube
    Cube,
    /// Tetrapod
    Tetrapod,
    /// Dolos
    Dolos,
    /// Accropode
    Accropode,
    /// CoreLoc
    CoreLoc,
    /// Xbloc
    Xbloc,
}

impl ArmorUnit {
    /// Stability coefficient KD (Hudson formula)
    pub fn kd_trunk(&self) -> f64 {
        match self {
            ArmorUnit::Rock => 4.0,
            ArmorUnit::Cube => 7.0,
            ArmorUnit::Tetrapod => 8.0,
            ArmorUnit::Dolos => 15.0,
            ArmorUnit::Accropode => 16.0,
            ArmorUnit::CoreLoc => 16.0,
            ArmorUnit::Xbloc => 16.0,
        }
    }
    
    /// Stability coefficient for roundhead
    pub fn kd_head(&self) -> f64 {
        match self {
            ArmorUnit::Rock => 2.0,
            ArmorUnit::Cube => 5.0,
            ArmorUnit::Tetrapod => 4.5,
            ArmorUnit::Dolos => 8.0,
            ArmorUnit::Accropode => 12.0,
            ArmorUnit::CoreLoc => 13.0,
            ArmorUnit::Xbloc => 13.0,
        }
    }
    
    /// Layer coefficient kΔ
    pub fn layer_coefficient(&self) -> f64 {
        match self {
            ArmorUnit::Rock => 1.00,
            ArmorUnit::Cube => 1.10,
            ArmorUnit::Tetrapod => 1.04,
            ArmorUnit::Dolos => 0.94,
            ArmorUnit::Accropode => 1.29,
            ArmorUnit::CoreLoc => 1.51,
            ArmorUnit::Xbloc => 1.49,
        }
    }
    
    /// Packing density coefficient
    pub fn packing_density(&self) -> f64 {
        match self {
            ArmorUnit::Rock => 38.0,
            ArmorUnit::Cube => 47.0,
            ArmorUnit::Tetrapod => 50.0,
            ArmorUnit::Dolos => 83.0,
            ArmorUnit::Accropode => 62.0,
            ArmorUnit::CoreLoc => 56.0,
            ArmorUnit::Xbloc => 58.0,
        }
    }
}

/// Rubble mound breakwater design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RubbleMoundBreakwater {
    /// Design wave height (m)
    pub h_design: f64,
    /// Wave period (s)
    pub period: f64,
    /// Water depth at structure (m)
    pub depth: f64,
    /// Armor unit type
    pub armor_unit: ArmorUnit,
    /// Armor density (kg/m³)
    pub armor_density: f64,
    /// Slope (V:H ratio, e.g., 0.5 for 1:2)
    pub slope: f64,
    /// Crest level above SWL (m)
    pub crest_height: f64,
    /// Damage level Sd (0-5 typically)
    pub damage_level: f64,
}

impl RubbleMoundBreakwater {
    pub fn new(h_design: f64, period: f64, depth: f64) -> Self {
        Self {
            h_design,
            period,
            depth,
            armor_unit: ArmorUnit::Rock,
            armor_density: 2650.0,
            slope: 0.5, // 1:2 slope
            crest_height: 3.0,
            damage_level: 2.0,
        }
    }
    
    /// Relative density of armor
    pub fn relative_density(&self) -> f64 {
        let rho_w = 1025.0;
        (self.armor_density - rho_w) / rho_w
    }
    
    /// Armor weight using Hudson formula (tonnes)
    pub fn armor_weight_hudson(&self) -> f64 {
        let gamma_a = self.armor_density / 1000.0; // t/m³
        let delta = self.relative_density();
        let h = self.h_design;
        let kd = self.armor_unit.kd_trunk();
        let cot_alpha = 1.0 / self.slope;
        
        gamma_a * h.powi(3) / (kd * delta.powi(3) * cot_alpha)
    }
    
    /// Armor nominal diameter Dn50 (m)
    pub fn armor_dn50(&self) -> f64 {
        let w50 = self.armor_weight_hudson() * 1000.0; // kg
        
        (w50 / self.armor_density).powf(1.0 / 3.0)
    }
    
    /// Armor weight using Van der Meer formula (tonnes)
    pub fn armor_weight_vdm(&self, number_of_waves: f64) -> f64 {
        let delta = self.relative_density();
        let h = self.h_design;
        let p: f64 = 0.4; // Notional permeability
        let s = self.damage_level;
        let n = number_of_waves;
        let alpha = (1.0 / self.slope).atan();
        
        // Surf similarity parameter
        let l0 = 9.81 * self.period.powi(2) / (2.0 * PI);
        let xi = alpha.tan() / (h / l0).sqrt();
        
        // Stability number
        let ns = if xi < 3.0 {
            // Plunging waves
            6.2 * p.powf(0.18) * (s / n.sqrt()).powf(0.2) * xi.powf(-0.5)
        } else {
            // Surging waves
            1.0 * p.powf(-0.13) * (s / n.sqrt()).powf(0.2) * xi.sqrt() * alpha.cos().powf(0.5)
        };
        
        let dn50 = h / (ns * delta);
        let rho = self.armor_density / 1000.0;
        
        rho * dn50.powi(3)
    }
    
    /// Armor layer thickness (m)
    pub fn armor_thickness(&self) -> f64 {
        let n_layers = 2.0;
        let k_delta = self.armor_unit.layer_coefficient();
        let dn50 = self.armor_dn50();
        
        n_layers * k_delta * dn50
    }
    
    /// Number of armor units per m²
    pub fn armor_units_per_sqm(&self) -> f64 {
        let n_layers = 2.0;
        let k_delta = self.armor_unit.layer_coefficient();
        let dn50 = self.armor_dn50();
        
        n_layers * k_delta / dn50.powi(2)
    }
    
    /// Wave runup Ru2% (m)
    pub fn runup(&self) -> f64 {
        let h = self.h_design;
        let alpha = (self.slope).atan();
        let l0 = 9.81 * self.period.powi(2) / (2.0 * PI);
        let xi = alpha.tan() / (h / l0).sqrt();
        
        // EurOtop formula for rubble mound
        let gamma_f = 0.5; // Roughness factor for rock
        let ru2 = 1.65 * gamma_f * xi;
        
        ru2.min(3.0) * h // Limit to 3*Hs
    }
    
    /// Wave overtopping discharge (l/s/m)
    pub fn overtopping(&self) -> f64 {
        let rc = self.crest_height;
        let h = self.h_design;
        let ru2 = self.runup();
        let g = 9.81;
        
        // EurOtop mean overtopping formula
        let q_star = 0.2 * (-(2.6 * rc / ru2).max(0.0)).exp();
        
        q_star * (g * h.powi(3)).sqrt() * 1000.0 // l/s/m
    }
}

// ============================================================================
// VERTICAL BREAKWATER
// ============================================================================

/// Vertical breakwater/caisson
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerticalBreakwater {
    /// Design wave height (m)
    pub h_design: f64,
    /// Wave period (s)
    pub period: f64,
    /// Water depth (m)
    pub depth: f64,
    /// Caisson width (m)
    pub width: f64,
    /// Caisson height (m)
    pub height: f64,
    /// Crest level above SWL (m)
    pub crest_freeboard: f64,
    /// Rubble mound height (m)
    pub mound_height: f64,
}

impl VerticalBreakwater {
    pub fn new(h_design: f64, period: f64, depth: f64) -> Self {
        Self {
            h_design,
            period,
            depth,
            width: 20.0,
            height: depth + 5.0,
            crest_freeboard: 3.0,
            mound_height: depth * 0.3,
        }
    }
    
    /// Wave wavelength (m)
    pub fn wavelength(&self) -> f64 {
        let g = 9.81;
        let l0 = g * self.period.powi(2) / (2.0 * PI);
        
        // Iterative for intermediate depth
        let mut l = l0;
        for _ in 0..20 {
            let kd = 2.0 * PI * self.depth / l;
            l = l0 * kd.tanh();
        }
        
        l
    }
    
    /// Goda wave pressure p1 at SWL (kPa)
    pub fn goda_p1(&self) -> f64 {
        let rho = 1025.0;
        let g = 9.81;
        let h = self.h_design;
        let d = self.depth;
        let hc = self.crest_freeboard;
        let l = self.wavelength();
        
        let alpha1 = 0.6 + 0.5 * (4.0 * PI * d / l / (4.0 * PI * d / l).sinh()).powi(2);
        let _alpha2 = ((2.0 * d - hc) / (3.0 * d)).min(1.0).max(0.0);
        let _alpha3 = 1.0 - d / d * (1.0 - 1.0 / (2.0 * PI * d / l).cosh());
        
        let _eta = 0.75 * (1.0 + (1.0 + 4.0 * PI * d / l / (4.0 * PI * d / l).sinh()).powf(0.5) * h.cos());
        
        0.5 * (1.0 + (1.0 / (2.0 * PI * d / l).cosh())) * alpha1 * rho * g * h / 1000.0
    }
    
    /// Wave crest elevation above SWL (m)
    pub fn wave_crest(&self) -> f64 {
        let h = self.h_design;
        let d = self.depth;
        let l = self.wavelength();
        
        0.75 * (1.0 + (2.0 * PI * d / l).cos()) * h
    }
    
    /// Horizontal wave force per unit length (kN/m)
    pub fn horizontal_force(&self) -> f64 {
        let p1 = self.goda_p1();
        let p3 = 0.0; // Zero at bottom for simplicity
        let d = self.depth;
        let eta = self.wave_crest();
        let hc = self.crest_freeboard.min(eta);
        
        // Trapezoid approximation
        0.5 * p1 * (d + hc) + 0.5 * (p1 - p3) * d
    }
    
    /// Uplift force per unit length (kN/m)
    pub fn uplift_force(&self) -> f64 {
        let p1 = self.goda_p1();
        let b = self.width;
        
        // Triangular distribution
        0.5 * p1 * b
    }
    
    /// Sliding stability factor of safety
    pub fn sliding_fos(&self, friction: f64) -> f64 {
        let h_force = self.horizontal_force();
        let w = self.caisson_weight();
        let u = self.uplift_force();
        
        friction * (w - u) / h_force
    }
    
    /// Caisson weight per unit length (kN/m)
    pub fn caisson_weight(&self) -> f64 {
        let gamma_c = 23.0; // kN/m³
        
        gamma_c * self.width * self.height * 0.7 // 70% solid
    }
    
    /// Overturning moment about toe (kN·m/m)
    pub fn overturning_moment(&self) -> f64 {
        let h_force = self.horizontal_force();
        let u = self.uplift_force();
        let d = self.depth;
        let b = self.width;
        
        h_force * d / 2.0 + u * 2.0 * b / 3.0
    }
    
    /// Resisting moment about toe (kN·m/m)
    pub fn resisting_moment(&self) -> f64 {
        let w = self.caisson_weight();
        let b = self.width;
        
        w * b / 2.0
    }
    
    /// Overturning factor of safety
    pub fn overturning_fos(&self) -> f64 {
        self.resisting_moment() / self.overturning_moment()
    }
}

// ============================================================================
// QUAY WALL
// ============================================================================

/// Quay wall type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuayWallType {
    /// Gravity wall
    Gravity,
    /// Sheet pile wall
    SheetPile,
    /// Diaphragm wall
    Diaphragm,
    /// Open piled quay
    PiledQuay,
}

/// Berthing energy calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BerthingEnergy {
    /// Vessel displacement (tonnes)
    pub displacement: f64,
    /// Approach velocity (m/s)
    pub velocity: f64,
    /// Eccentricity coefficient Ce
    pub ce: f64,
    /// Mass coefficient Cm
    pub cm: f64,
    /// Softness coefficient Cs
    pub cs: f64,
    /// Configuration coefficient Cc
    pub cc: f64,
}

impl BerthingEnergy {
    pub fn new(displacement: f64, velocity: f64) -> Self {
        Self {
            displacement,
            velocity,
            ce: 0.5,   // Typical quarter point
            cm: 1.8,   // With added mass
            cs: 1.0,   // Hard berthing
            cc: 1.0,   // Open structure
        }
    }
    
    /// Kinetic energy (kJ)
    pub fn kinetic_energy(&self) -> f64 {
        0.5 * self.displacement * 1000.0 * self.velocity.powi(2) / 1000.0
    }
    
    /// Design berthing energy (kJ)
    pub fn design_energy(&self) -> f64 {
        self.kinetic_energy() * self.ce * self.cm * self.cs * self.cc
    }
    
    /// Required fender capacity (kJ)
    pub fn fender_capacity(&self) -> f64 {
        self.design_energy() * 1.25 // 25% margin
    }
}

/// Mooring force calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MooringForces {
    /// Vessel length (m)
    pub vessel_length: f64,
    /// Vessel beam (m)
    pub vessel_beam: f64,
    /// Freeboard (m)
    pub freeboard: f64,
    /// Wind speed (m/s)
    pub wind_speed: f64,
    /// Current speed (m/s)
    pub current_speed: f64,
    /// Wave height (m)
    pub wave_height: f64,
}

impl MooringForces {
    pub fn new(vessel_length: f64, vessel_beam: f64) -> Self {
        Self {
            vessel_length,
            vessel_beam,
            freeboard: 10.0,
            wind_speed: 25.0,
            current_speed: 1.0,
            wave_height: 1.5,
        }
    }
    
    /// Longitudinal wind area (m²)
    pub fn wind_area_longitudinal(&self) -> f64 {
        self.vessel_length * self.freeboard * 0.4
    }
    
    /// Transverse wind area (m²)
    pub fn wind_area_transverse(&self) -> f64 {
        self.vessel_beam * self.freeboard * 0.8
    }
    
    /// Wind force longitudinal (kN)
    pub fn wind_force_longitudinal(&self) -> f64 {
        let rho = 1.25;
        let cd = 1.0;
        let a = self.wind_area_longitudinal();
        let v = self.wind_speed;
        
        0.5 * rho * cd * a * v.powi(2) / 1000.0
    }
    
    /// Wind force transverse (kN)
    pub fn wind_force_transverse(&self) -> f64 {
        let rho = 1.25;
        let cd = 1.3;
        let a = self.wind_area_transverse();
        let v = self.wind_speed;
        
        0.5 * rho * cd * a * v.powi(2) / 1000.0
    }
    
    /// Current force longitudinal (kN)
    pub fn current_force_longitudinal(&self) -> f64 {
        let rho = 1025.0;
        let cd = 0.1;
        let a = self.vessel_length * 5.0; // Approximate wetted area
        let v = self.current_speed;
        
        0.5 * rho * cd * a * v.powi(2) / 1000.0
    }
    
    /// Current force transverse (kN)
    pub fn current_force_transverse(&self) -> f64 {
        let rho = 1025.0;
        let cd = 0.6;
        let a = self.vessel_beam * 8.0;
        let v = self.current_speed;
        
        0.5 * rho * cd * a * v.powi(2) / 1000.0
    }
    
    /// Total longitudinal force (kN)
    pub fn total_longitudinal(&self) -> f64 {
        self.wind_force_longitudinal() + self.current_force_longitudinal()
    }
    
    /// Total transverse force (kN)
    pub fn total_transverse(&self) -> f64 {
        self.wind_force_transverse() + self.current_force_transverse()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wave_parameters() {
        let wave = WaveParameters::new(3.0, 10.0, 20.0);
        
        assert!(wave.wavelength() > 100.0);
    }

    #[test]
    fn test_deep_water() {
        let wave = WaveParameters::new(2.0, 8.0, 100.0);
        
        assert!(wave.is_deep_water());
    }

    #[test]
    fn test_wave_power() {
        let wave = WaveParameters::new(3.0, 10.0, 25.0);
        let power = wave.wave_power();
        
        assert!(power > 20.0 && power < 100.0);
    }

    #[test]
    fn test_wave_transformation() {
        let offshore = WaveParameters::new(4.0, 12.0, 50.0);
        let trans = WaveTransformation::new(offshore, 10.0, 0.02);
        
        let ks = trans.shoaling_coefficient();
        assert!(ks > 0.8 && ks < 2.0);
    }

    #[test]
    fn test_breaking_height() {
        let offshore = WaveParameters::new(5.0, 12.0, 50.0);
        let trans = WaveTransformation::new(offshore, 5.0, 0.02);
        
        let hb = trans.breaking_height();
        assert!(hb > 3.0);
    }

    #[test]
    fn test_armor_hudson() {
        let bw = RubbleMoundBreakwater::new(5.0, 10.0, 15.0);
        let w = bw.armor_weight_hudson();
        
        assert!(w > 1.0 && w < 30.0);
    }

    #[test]
    fn test_armor_dn50() {
        let bw = RubbleMoundBreakwater::new(4.0, 10.0, 12.0);
        let dn50 = bw.armor_dn50();
        
        assert!(dn50 > 0.5 && dn50 < 3.0);
    }

    #[test]
    fn test_runup() {
        let bw = RubbleMoundBreakwater::new(3.0, 8.0, 10.0);
        let ru = bw.runup();
        
        assert!(ru > 1.0 && ru < 10.0);
    }

    #[test]
    fn test_vertical_breakwater() {
        let vb = VerticalBreakwater::new(4.0, 10.0, 15.0);
        
        assert!(vb.goda_p1() > 10.0);
    }

    #[test]
    fn test_caisson_stability() {
        let mut vb = VerticalBreakwater::new(3.0, 8.0, 12.0);
        vb.width = 15.0;
        
        let fos = vb.sliding_fos(0.6);
        assert!(fos > 0.5);
    }

    #[test]
    fn test_berthing_energy() {
        let be = BerthingEnergy::new(50000.0, 0.15);
        
        let energy = be.design_energy();
        assert!(energy > 100.0 && energy < 1000.0);
    }

    #[test]
    fn test_mooring_forces() {
        let mf = MooringForces::new(250.0, 40.0);
        
        let wind_t = mf.wind_force_transverse();
        assert!(wind_t > 100.0);
    }

    #[test]
    fn test_armor_units() {
        assert!(ArmorUnit::Accropode.kd_trunk() > ArmorUnit::Rock.kd_trunk());
    }
}
