//! Blast Loading Analysis Module
//! 
//! Implements blast wave physics and structural response per:
//! - UFC 3-340-02 (Structures to Resist the Effects of Accidental Explosions)
//! - ASCE 59-11 (Blast Protection of Buildings)
//! - ConWep blast loading model
//! - Positive and negative phase loading

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// BLAST SOURCE DEFINITION
// ============================================================================

/// Explosive material types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ExplosiveType {
    /// TNT (reference)
    Tnt,
    /// C-4 plastic explosive
    C4,
    /// ANFO
    Anfo,
    /// Propane gas
    Propane,
    /// Natural gas
    NaturalGas,
    /// Dynamite
    Dynamite,
    /// PETN
    Petn,
    /// Custom with TNT equivalent factor
    Custom(f64),
}

impl ExplosiveType {
    /// TNT equivalence factor
    pub fn tnt_equivalence(&self) -> f64 {
        match self {
            Self::Tnt => 1.0,
            Self::C4 => 1.37,
            Self::Anfo => 0.82,
            Self::Propane => 1.0,
            Self::NaturalGas => 0.45,
            Self::Dynamite => 0.92,
            Self::Petn => 1.27,
            Self::Custom(f) => *f,
        }
    }
    
    /// Energy release per unit mass (MJ/kg)
    pub fn specific_energy(&self) -> f64 {
        match self {
            Self::Tnt => 4.184,
            Self::C4 => 5.75,
            Self::Anfo => 3.72,
            Self::Propane => 46.4,
            Self::NaturalGas => 53.6,
            Self::Dynamite => 4.52,
            Self::Petn => 5.81,
            Self::Custom(_) => 4.184, // Assume TNT
        }
    }
}

/// Blast source configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastSource {
    /// Explosive type
    pub explosive_type: ExplosiveType,
    /// Charge mass (kg)
    pub charge_mass: f64,
    /// Charge location [x, y, z] (m)
    pub location: [f64; 3],
    /// Ground reflection factor
    pub reflection_factor: f64,
    /// Spherical or hemispherical burst
    pub hemispherical: bool,
}

impl BlastSource {
    pub fn new(explosive_type: ExplosiveType, charge_mass: f64, location: [f64; 3]) -> Self {
        Self {
            explosive_type,
            charge_mass,
            location,
            reflection_factor: 1.0,
            hemispherical: false,
        }
    }
    
    /// Create hemispherical surface burst
    pub fn surface_burst(explosive_type: ExplosiveType, charge_mass: f64, location: [f64; 3]) -> Self {
        Self {
            explosive_type,
            charge_mass,
            location,
            reflection_factor: 1.8, // UFC factor
            hemispherical: true,
        }
    }
    
    /// TNT equivalent mass (kg)
    pub fn tnt_equivalent(&self) -> f64 {
        self.charge_mass * self.explosive_type.tnt_equivalence() * self.reflection_factor
    }
    
    /// Scaled distance Z (m/kg^1/3)
    pub fn scaled_distance(&self, standoff: f64) -> f64 {
        standoff / self.tnt_equivalent().powf(1.0 / 3.0)
    }
    
    /// Standoff distance from charge to point
    pub fn standoff(&self, target: &[f64; 3]) -> f64 {
        let dx = target[0] - self.location[0];
        let dy = target[1] - self.location[1];
        let dz = target[2] - self.location[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
}

// ============================================================================
// BLAST WAVE PARAMETERS (UFC 3-340-02)
// ============================================================================

/// Blast wave parameters at a point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastParameters {
    /// Standoff distance (m)
    pub standoff: f64,
    /// Scaled distance Z (m/kg^1/3)
    pub scaled_distance: f64,
    /// Peak incident overpressure (kPa)
    pub pso: f64,
    /// Peak reflected pressure (kPa)
    pub pr: f64,
    /// Time of arrival (ms)
    pub ta: f64,
    /// Positive phase duration (ms)
    pub td_pos: f64,
    /// Positive phase impulse (kPa·ms)
    pub is_pos: f64,
    /// Reflected impulse (kPa·ms)
    pub ir: f64,
    /// Negative phase duration (ms)
    pub td_neg: f64,
    /// Negative phase impulse (kPa·ms)
    pub is_neg: f64,
    /// Peak negative pressure (kPa)
    pub pso_neg: f64,
    /// Shock front velocity (m/s)
    pub us: f64,
    /// Dynamic pressure (kPa)
    pub q: f64,
}

impl BlastParameters {
    /// Calculate blast parameters using Kingery-Bulmash polynomials (UFC 3-340-02)
    pub fn calculate(source: &BlastSource, target: &[f64; 3]) -> Self {
        let standoff = source.standoff(target);
        let z = source.scaled_distance(standoff);
        
        // Incident overpressure (Kingery-Bulmash fit for spherical)
        let pso = Self::incident_pressure(z);
        
        // Reflected pressure
        let pr = Self::reflected_pressure(z, pso);
        
        // Time of arrival
        let ta = Self::arrival_time(z, source.tnt_equivalent());
        
        // Positive phase duration
        let td_pos = Self::positive_duration(z, source.tnt_equivalent());
        
        // Impulses
        let is_pos = Self::positive_impulse(z, source.tnt_equivalent());
        let ir = Self::reflected_impulse(z, source.tnt_equivalent());
        
        // Negative phase
        let td_neg = Self::negative_duration(z, source.tnt_equivalent());
        let is_neg = Self::negative_impulse(z, source.tnt_equivalent());
        let pso_neg = Self::negative_pressure(z);
        
        // Shock velocity
        let us = Self::shock_velocity(pso);
        
        // Dynamic pressure
        let q = Self::dynamic_pressure(pso);
        
        Self {
            standoff,
            scaled_distance: z,
            pso,
            pr,
            ta,
            td_pos,
            is_pos,
            ir,
            td_neg,
            is_neg,
            pso_neg,
            us,
            q,
        }
    }
    
    /// Incident overpressure (kPa) - simplified Kingery-Bulmash
    fn incident_pressure(z: f64) -> f64 {
        if z < 0.1 {
            return 100000.0; // Cap for very close range
        }
        
        // UFC 3-340-02 polynomial approximation
        let log_z = z.ln();
        
        if z < 0.5 {
            1000.0 * (1.0 / z.powi(3))
        } else if z < 5.0 {
            // 0.5 < Z < 5.0
            let a = 808.0 - 339.0 * log_z + 90.0 * log_z.powi(2) - 9.0 * log_z.powi(3);
            a.max(10.0)
        } else {
            // Z > 5.0
            84.0 / z - 12.0 / z.powi(2) + 1.0 / z.powi(3)
        }
    }
    
    /// Reflected pressure (kPa)
    fn reflected_pressure(_z: f64, pso: f64) -> f64 {
        // Reflection coefficient
        let cr = Self::reflection_coefficient(pso);
        cr * pso
    }
    
    /// Reflection coefficient
    fn reflection_coefficient(pso: f64) -> f64 {
        // UFC formula: Cr = 2 + 6*Pso/(Pso + 7*P0)
        let p0 = 101.325; // Atmospheric pressure (kPa)
        2.0 + 6.0 * pso / (pso + 7.0 * p0)
    }
    
    /// Time of arrival (ms)
    fn arrival_time(z: f64, w: f64) -> f64 {
        // ta = k * R/c where c is speed of sound
        let r = z * w.powf(1.0 / 3.0);
        let c = 340.0; // Speed of sound (m/s)
        
        // Simplified: ta ≈ R/c for far field
        r / c * 1000.0 // Convert to ms
    }
    
    /// Positive phase duration (ms)
    fn positive_duration(z: f64, w: f64) -> f64 {
        // UFC approximation
        let w_third = w.powf(1.0 / 3.0);
        
        if z < 0.5 {
            0.25 * w_third
        } else {
            (0.25 + 0.5 * (z - 0.5).min(5.0)) * w_third
        }
    }
    
    /// Positive phase impulse (kPa·ms)
    fn positive_impulse(z: f64, w: f64) -> f64 {
        let w_third = w.powf(1.0 / 3.0);
        
        if z < 0.5 {
            500.0 * w_third / z.powi(2)
        } else if z < 5.0 {
            150.0 * w_third / z
        } else {
            30.0 * w_third / z.sqrt()
        }
    }
    
    /// Reflected impulse (kPa·ms)
    fn reflected_impulse(z: f64, w: f64) -> f64 {
        let is = Self::positive_impulse(z, w);
        let pso = Self::incident_pressure(z);
        let cr = Self::reflection_coefficient(pso);
        
        is * cr * 0.9 // Slightly less than full reflection
    }
    
    /// Negative phase duration (ms)
    fn negative_duration(z: f64, w: f64) -> f64 {
        // Typically 3-10 times positive duration
        5.0 * Self::positive_duration(z, w)
    }
    
    /// Negative phase impulse (kPa·ms)
    fn negative_impulse(z: f64, w: f64) -> f64 {
        // About 1/3 of positive impulse
        Self::positive_impulse(z, w) * 0.33
    }
    
    /// Peak negative pressure (kPa)
    fn negative_pressure(z: f64) -> f64 {
        // Limited to about 100 kPa below atmospheric
        (101.325 * 0.3 / z.sqrt()).min(100.0)
    }
    
    /// Shock front velocity (m/s)
    fn shock_velocity(pso: f64) -> f64 {
        let p0 = 101.325;
        let gamma = 1.4; // Air
        
        // Rankine-Hugoniot relation
        340.0 * (1.0 + (gamma + 1.0) / (2.0 * gamma) * pso / p0).sqrt()
    }
    
    /// Dynamic pressure (kPa)
    fn dynamic_pressure(pso: f64) -> f64 {
        let p0 = 101.325;
        let _gamma = 1.4;
        
        // q = 2.5 * Pso^2 / (Pso + 7*P0)
        2.5 * pso.powi(2) / (pso + 7.0 * p0)
    }
}

// ============================================================================
// PRESSURE-TIME HISTORY
// ============================================================================

/// Pressure waveform type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WaveformType {
    /// Modified Friedlander equation
    Friedlander,
    /// Linear decay
    Linear,
    /// Bilinear
    Bilinear,
    /// Exponential decay
    Exponential,
}

/// Blast pressure-time history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlastTimeHistory {
    /// Blast parameters
    pub params: BlastParameters,
    /// Waveform type
    pub waveform: WaveformType,
    /// Decay coefficient for Friedlander
    pub alpha: f64,
    /// Time step (ms)
    pub dt: f64,
    /// Pressure values (kPa)
    pub pressure: Vec<f64>,
    /// Time values (ms)
    pub time: Vec<f64>,
}

impl BlastTimeHistory {
    /// Generate pressure-time history for reflected pressure
    pub fn reflected(params: BlastParameters, waveform: WaveformType, dt: f64) -> Self {
        let alpha = Self::calculate_alpha(&params);
        let duration = params.ta + params.td_pos + params.td_neg + 10.0;
        let n_steps = (duration / dt).ceil() as usize;
        
        let mut time = Vec::with_capacity(n_steps);
        let mut pressure = Vec::with_capacity(n_steps);
        
        for i in 0..n_steps {
            let t = i as f64 * dt;
            time.push(t);
            
            let p = Self::pressure_at_time(t, &params, waveform, alpha, true);
            pressure.push(p);
        }
        
        Self {
            params,
            waveform,
            alpha,
            dt,
            pressure,
            time,
        }
    }
    
    /// Generate pressure-time history for incident pressure
    pub fn incident(params: BlastParameters, waveform: WaveformType, dt: f64) -> Self {
        let alpha = Self::calculate_alpha(&params);
        let duration = params.ta + params.td_pos + params.td_neg + 10.0;
        let n_steps = (duration / dt).ceil() as usize;
        
        let mut time = Vec::with_capacity(n_steps);
        let mut pressure = Vec::with_capacity(n_steps);
        
        for i in 0..n_steps {
            let t = i as f64 * dt;
            time.push(t);
            
            let p = Self::pressure_at_time(t, &params, waveform, alpha, false);
            pressure.push(p);
        }
        
        Self {
            params,
            waveform,
            alpha,
            dt,
            pressure,
            time,
        }
    }
    
    /// Calculate decay coefficient alpha
    fn calculate_alpha(params: &BlastParameters) -> f64 {
        // Derived from impulse-duration relationship
        // For Friedlander: I = Pr * td * (1/alpha - 1/alpha^2 * (1 - exp(-alpha)))
        // Iterative solution
        
        let target_ratio = params.ir / (params.pr * params.td_pos);
        
        // Newton-Raphson iteration
        let mut alpha: f64 = 1.0;
        for _ in 0..20 {
            let f = 1.0 / alpha - 1.0 / (alpha * alpha) * (1.0 - (-alpha).exp()) - target_ratio;
            let df = -1.0 / (alpha * alpha) + 2.0 / (alpha * alpha * alpha) * (1.0 - (-alpha).exp())
                   - 1.0 / (alpha * alpha) * (-alpha).exp();
            
            if df.abs() < 1e-10 {
                break;
            }
            
            alpha = alpha - f / df;
            alpha = alpha.max(0.1).min(10.0);
        }
        
        alpha
    }
    
    /// Pressure at given time
    fn pressure_at_time(
        t: f64,
        params: &BlastParameters,
        waveform: WaveformType,
        alpha: f64,
        reflected: bool,
    ) -> f64 {
        let ta = params.ta;
        let td_pos = params.td_pos;
        let td_neg = params.td_neg;
        
        let peak = if reflected { params.pr } else { params.pso };
        let peak_neg = params.pso_neg;
        
        if t < ta {
            // Before arrival
            0.0
        } else if t < ta + td_pos {
            // Positive phase
            let tau = (t - ta) / td_pos;
            
            match waveform {
                WaveformType::Friedlander => {
                    peak * (1.0 - tau) * (-alpha * tau).exp()
                }
                WaveformType::Linear => {
                    peak * (1.0 - tau)
                }
                WaveformType::Bilinear => {
                    if tau < 0.5 {
                        peak * (1.0 - tau)
                    } else {
                        peak * 0.5 * (1.0 - tau) / 0.5
                    }
                }
                WaveformType::Exponential => {
                    peak * (-2.0 * tau).exp()
                }
            }
        } else if t < ta + td_pos + td_neg {
            // Negative phase (simplified sinusoidal)
            let tau = (t - ta - td_pos) / td_neg;
            -peak_neg * (PI * tau).sin()
        } else {
            0.0
        }
    }
    
    /// Peak pressure
    pub fn peak_pressure(&self) -> f64 {
        self.pressure.iter().cloned().fold(0.0, f64::max)
    }
    
    /// Total positive impulse (numerical integration)
    pub fn positive_impulse(&self) -> f64 {
        let mut impulse = 0.0;
        for i in 1..self.pressure.len() {
            if self.pressure[i] > 0.0 && self.pressure[i - 1] > 0.0 {
                impulse += 0.5 * (self.pressure[i] + self.pressure[i - 1]) * self.dt;
            }
        }
        impulse
    }
    
    /// Total negative impulse
    pub fn negative_impulse(&self) -> f64 {
        let mut impulse = 0.0;
        for i in 1..self.pressure.len() {
            if self.pressure[i] < 0.0 && self.pressure[i - 1] < 0.0 {
                impulse += 0.5 * (self.pressure[i].abs() + self.pressure[i - 1].abs()) * self.dt;
            }
        }
        impulse
    }
}

// ============================================================================
// CLEARING EFFECTS
// ============================================================================

/// Blast clearing effects for finite targets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClearingEffects {
    /// Target width (m)
    pub width: f64,
    /// Target height (m)
    pub height: f64,
    /// Distance to edge (m)
    pub edge_distance: f64,
    /// Clearing time (ms)
    pub clearing_time: f64,
    /// Stagnation pressure (kPa)
    pub stagnation_pressure: f64,
}

impl ClearingEffects {
    /// Calculate clearing effects per UFC 3-340-02
    pub fn calculate(
        target_width: f64,
        target_height: f64,
        params: &BlastParameters,
    ) -> Self {
        // Clearing distance: shortest path around structure
        let s = (target_width / 2.0).min(target_height);
        
        // Clearing time: tc = 3S/U where U is shock velocity
        let tc = 3.0 * s / params.us * 1000.0; // Convert to ms
        
        // Stagnation pressure: Pstag = Pso + q
        let p_stag = params.pso + params.q;
        
        Self {
            width: target_width,
            height: target_height,
            edge_distance: s,
            clearing_time: tc,
            stagnation_pressure: p_stag,
        }
    }
    
    /// Effective pressure considering clearing
    pub fn effective_pressure(&self, t: f64, params: &BlastParameters) -> f64 {
        let pr = params.pr;
        let pso = params.pso;
        let q = params.q;
        let ta = params.ta;
        
        if t < ta {
            return 0.0;
        }
        
        let t_rel = t - ta;
        
        if t_rel < self.clearing_time {
            // Before clearing: reflected pressure decaying to stagnation
            let ratio = t_rel / self.clearing_time;
            pr * (1.0 - ratio) + self.stagnation_pressure * ratio
        } else {
            // After clearing: incident + dynamic pressure
            pso + q
        }
    }
}

// ============================================================================
// STRUCTURAL RESPONSE
// ============================================================================

/// Response mode
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ResponseMode {
    /// Impulsive (td << T)
    Impulsive,
    /// Quasi-static (td >> T)
    QuasiStatic,
    /// Dynamic (td ≈ T)
    Dynamic,
}

/// SDOF blast response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdofBlastResponse {
    /// Mass (kg)
    pub mass: f64,
    /// Stiffness (kN/m)
    pub stiffness: f64,
    /// Resistance (kN)
    pub resistance: f64,
    /// Natural period (ms)
    pub period: f64,
    /// Damping ratio
    pub damping: f64,
    /// Response mode
    pub mode: ResponseMode,
    /// Maximum displacement (mm)
    pub max_displacement: f64,
    /// Maximum velocity (m/s)
    pub max_velocity: f64,
    /// Ductility ratio
    pub ductility: f64,
}

impl SdofBlastResponse {
    /// Calculate SDOF response to blast loading
    pub fn calculate(
        mass: f64,
        stiffness: f64,
        resistance: f64,
        damping: f64,
        pressure: f64,
        area: f64,
        duration: f64,
        impulse: f64,
    ) -> Self {
        let omega = (stiffness * 1000.0 / mass).sqrt();
        let period = 2.0 * PI / omega * 1000.0; // ms
        
        // Determine response mode
        let td_t = duration / period;
        let mode = if td_t < 0.1 {
            ResponseMode::Impulsive
        } else if td_t > 10.0 {
            ResponseMode::QuasiStatic
        } else {
            ResponseMode::Dynamic
        };
        
        // Force
        let force = pressure * area; // kN
        
        // Elastic displacement
        let x_el = force / stiffness; // mm
        
        // Maximum response
        let (max_disp, max_vel) = match mode {
            ResponseMode::Impulsive => {
                // x_max = I / (m * omega)
                let i_eff = impulse * area / 1000.0; // kN·s
                let x_max = i_eff / (mass / 1000.0 * omega) * 1000.0;
                let v_max = i_eff / (mass / 1000.0);
                (x_max, v_max)
            }
            ResponseMode::QuasiStatic => {
                // DLF ≈ 2 for step load
                let dlf = 2.0;
                let x_max = dlf * x_el;
                let v_max = omega * x_max / 1000.0;
                (x_max, v_max)
            }
            ResponseMode::Dynamic => {
                // Use pressure-impulse diagram factor
                let dlf = Self::dynamic_load_factor(td_t);
                let x_max = dlf * x_el;
                let v_max = omega * x_max / 1000.0;
                (x_max, v_max)
            }
        };
        
        // Yield displacement
        let x_yield = resistance / stiffness;
        
        // Ductility
        let ductility = if max_disp > x_yield {
            max_disp / x_yield
        } else {
            max_disp / x_yield
        };
        
        Self {
            mass,
            stiffness,
            resistance,
            period,
            damping,
            mode,
            max_displacement: max_disp,
            max_velocity: max_vel,
            ductility,
        }
    }
    
    /// Dynamic load factor for triangular load
    fn dynamic_load_factor(td_t: f64) -> f64 {
        // Simplified from response spectra
        if td_t < 0.4 {
            2.0 * PI * td_t
        } else if td_t < 2.0 {
            2.0 * (1.0 - 0.3 * (td_t - 0.4) / 1.6)
        } else {
            1.4
        }
    }
    
    /// Check if response is acceptable
    pub fn is_acceptable(&self, allowable_ductility: f64) -> bool {
        self.ductility <= allowable_ductility
    }
}

// ============================================================================
// PRESSURE-IMPULSE DIAGRAMS
// ============================================================================

/// P-I diagram for damage assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressureImpulseDiagram {
    /// Component type
    pub component: String,
    /// Damage level
    pub damage_level: DamageLevel,
    /// Asymptotic pressure (kPa)
    pub p_asymptote: f64,
    /// Asymptotic impulse (kPa·ms)
    pub i_asymptote: f64,
    /// Curve fit coefficient A
    pub coeff_a: f64,
    /// Curve fit coefficient B
    pub coeff_b: f64,
}

/// Blast damage level
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DamageLevel {
    /// No damage
    None,
    /// Superficial damage
    Superficial,
    /// Moderate damage
    Moderate,
    /// Heavy damage
    Heavy,
    /// Collapse
    Collapse,
}

impl PressureImpulseDiagram {
    /// Create P-I diagram for reinforced concrete wall
    pub fn rc_wall(thickness: f64, damage_level: DamageLevel) -> Self {
        // Simplified values based on thickness (mm)
        let (p_asym, i_asym) = match damage_level {
            DamageLevel::None => (50.0 + thickness * 0.2, 200.0 + thickness * 1.0),
            DamageLevel::Superficial => (30.0 + thickness * 0.15, 150.0 + thickness * 0.8),
            DamageLevel::Moderate => (20.0 + thickness * 0.1, 100.0 + thickness * 0.5),
            DamageLevel::Heavy => (10.0 + thickness * 0.05, 50.0 + thickness * 0.3),
            DamageLevel::Collapse => (5.0 + thickness * 0.02, 25.0 + thickness * 0.15),
        };
        
        Self {
            component: format!("RC Wall {}mm", thickness),
            damage_level,
            p_asymptote: p_asym,
            i_asymptote: i_asym,
            coeff_a: 0.5,
            coeff_b: 0.5,
        }
    }
    
    /// Create P-I diagram for glazing
    pub fn glazing(thickness: f64, tempered: bool) -> Self {
        let factor = if tempered { 3.0 } else { 1.0 };
        
        Self {
            component: format!("Glass {}mm", thickness),
            damage_level: DamageLevel::Collapse,
            p_asymptote: 3.0 * thickness * factor,
            i_asymptote: 15.0 * thickness * factor,
            coeff_a: 0.7,
            coeff_b: 0.3,
        }
    }
    
    /// Check if loading exceeds damage threshold
    pub fn exceeds_threshold(&self, pressure: f64, impulse: f64) -> bool {
        // Hyperbolic P-I curve: (P/Pa - 1)^a * (I/Ia - 1)^b = 1
        if pressure < self.p_asymptote || impulse < self.i_asymptote {
            return false;
        }
        
        let p_ratio = pressure / self.p_asymptote - 1.0;
        let i_ratio = impulse / self.i_asymptote - 1.0;
        
        if p_ratio <= 0.0 || i_ratio <= 0.0 {
            return false;
        }
        
        p_ratio.powf(self.coeff_a) * i_ratio.powf(self.coeff_b) >= 1.0
    }
    
    /// Determine damage level from P-I
    pub fn assess_damage(pressure: f64, impulse: f64, component: &str) -> DamageLevel {
        let levels = [
            DamageLevel::None,
            DamageLevel::Superficial,
            DamageLevel::Moderate,
            DamageLevel::Heavy,
            DamageLevel::Collapse,
        ];
        
        for &level in levels.iter().rev() {
            let pi = match component {
                "rc_wall_200" => Self::rc_wall(200.0, level),
                "rc_wall_300" => Self::rc_wall(300.0, level),
                "glass_6" => Self::glazing(6.0, false),
                "glass_10_tempered" => Self::glazing(10.0, true),
                _ => Self::rc_wall(200.0, level),
            };
            
            if pi.exceeds_threshold(pressure, impulse) {
                return level;
            }
        }
        
        DamageLevel::None
    }
}

// ============================================================================
// FRAGMENT ANALYSIS
// ============================================================================

/// Fragment hazard analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragmentAnalysis {
    /// Fragment mass (g)
    pub mass: f64,
    /// Initial velocity (m/s)
    pub velocity: f64,
    /// Drag coefficient
    pub cd: f64,
    /// Presented area (cm²)
    pub area: f64,
    /// Range (m)
    pub range: f64,
    /// Velocity at impact (m/s)
    pub impact_velocity: f64,
    /// Kinetic energy (J)
    pub kinetic_energy: f64,
}

impl FragmentAnalysis {
    /// Calculate fragment trajectory
    pub fn calculate(
        mass: f64,
        initial_velocity: f64,
        launch_angle: f64,
        drag_coefficient: f64,
        area: f64,
    ) -> Self {
        // Simplified ballistic calculation
        let g = 9.81;
        let rho = 1.225; // Air density (kg/m³)
        let cd = drag_coefficient;
        let a = area / 10000.0; // cm² to m²
        let m = mass / 1000.0; // g to kg
        
        // Terminal velocity
        let _v_term = (2.0 * m * g / (rho * cd * a)).sqrt();
        
        // Simplified range (no drag for estimate)
        let angle_rad = launch_angle * PI / 180.0;
        let v0 = initial_velocity;
        let range_no_drag = v0 * v0 * (2.0 * angle_rad).sin() / g;
        
        // Apply drag reduction factor
        let drag_factor = (-range_no_drag * rho * cd * a / (2.0 * m)).exp();
        let range = range_no_drag * (0.5 + 0.5 * drag_factor);
        
        // Impact velocity (simplified)
        let v_impact = v0 * drag_factor.sqrt();
        
        // Kinetic energy at impact
        let ke = 0.5 * m * v_impact * v_impact;
        
        Self {
            mass,
            velocity: initial_velocity,
            cd,
            area,
            range,
            impact_velocity: v_impact,
            kinetic_energy: ke,
        }
    }
    
    /// Gurney velocity for cased charges (m/s)
    pub fn gurney_velocity(explosive_mass: f64, case_mass: f64, gurney_constant: f64) -> f64 {
        // V = √(2E) * √(M/(M+C/2))
        let ratio = case_mass / (case_mass + 0.5 * explosive_mass);
        gurney_constant * ratio.sqrt()
    }
    
    /// Penetration depth into mild steel (mm) - Thor equation
    pub fn steel_penetration(&self) -> f64 {
        let m = self.mass; // g
        let v = self.impact_velocity; // m/s
        let a = self.area; // cm²
        
        // Simplified Thor equation
        0.0045 * m.powf(0.5) * v.powf(1.5) / a.powf(0.5)
    }
    
    /// Lethality (probability of incapacitation)
    pub fn lethality(&self) -> f64 {
        let ke = self.kinetic_energy;
        
        // Simplified logistic model
        1.0 / (1.0 + (-0.01 * (ke - 80.0)).exp())
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_explosive_equivalence() {
        assert!((ExplosiveType::Tnt.tnt_equivalence() - 1.0).abs() < 1e-10);
        assert!(ExplosiveType::C4.tnt_equivalence() > 1.0);
        assert!(ExplosiveType::Anfo.tnt_equivalence() < 1.0);
    }

    #[test]
    fn test_blast_source() {
        let source = BlastSource::new(ExplosiveType::Tnt, 100.0, [0.0, 0.0, 0.0]);
        
        let target = [10.0, 0.0, 0.0];
        let standoff = source.standoff(&target);
        
        assert!((standoff - 10.0).abs() < 1e-10);
        
        let z = source.scaled_distance(standoff);
        assert!(z > 0.0);
    }

    #[test]
    fn test_blast_parameters() {
        let source = BlastSource::new(ExplosiveType::Tnt, 100.0, [0.0, 0.0, 0.0]);
        let target = [20.0, 0.0, 0.0];
        
        let params = BlastParameters::calculate(&source, &target);
        
        assert!(params.pso > 0.0);
        assert!(params.pr > params.pso); // Reflected > incident
        assert!(params.td_pos > 0.0);
        assert!(params.is_pos > 0.0);
    }

    #[test]
    fn test_pressure_decay() {
        // Pressure should decrease with distance
        let source = BlastSource::new(ExplosiveType::Tnt, 100.0, [0.0, 0.0, 0.0]);
        
        let p_near = BlastParameters::calculate(&source, &[10.0, 0.0, 0.0]);
        let p_far = BlastParameters::calculate(&source, &[20.0, 0.0, 0.0]);
        
        assert!(p_near.pso > p_far.pso);
    }

    #[test]
    fn test_time_history() {
        let source = BlastSource::new(ExplosiveType::Tnt, 50.0, [0.0, 0.0, 0.0]);
        let params = BlastParameters::calculate(&source, &[15.0, 0.0, 0.0]);
        
        let history = BlastTimeHistory::reflected(params, WaveformType::Friedlander, 0.1);
        
        assert!(!history.pressure.is_empty());
        assert!(history.peak_pressure() > 0.0);
        assert!(history.positive_impulse() > 0.0);
    }

    #[test]
    fn test_clearing_effects() {
        let source = BlastSource::new(ExplosiveType::Tnt, 100.0, [0.0, 0.0, 0.0]);
        let params = BlastParameters::calculate(&source, &[15.0, 0.0, 0.0]);
        
        let clearing = ClearingEffects::calculate(5.0, 3.0, &params);
        
        assert!(clearing.clearing_time > 0.0);
        assert!(clearing.stagnation_pressure > 0.0);
    }

    #[test]
    fn test_sdof_response() {
        let response = SdofBlastResponse::calculate(
            1000.0,  // mass (kg)
            100.0,   // stiffness (kN/m)
            50.0,    // resistance (kN)
            0.05,    // damping
            100.0,   // pressure (kPa)
            10.0,    // area (m²)
            5.0,     // duration (ms)
            200.0,   // impulse (kPa·ms)
        );
        
        assert!(response.period > 0.0);
        assert!(response.max_displacement > 0.0);
    }

    #[test]
    fn test_pi_diagram() {
        let pi = PressureImpulseDiagram::rc_wall(200.0, DamageLevel::Moderate);
        
        // Below threshold
        assert!(!pi.exceeds_threshold(10.0, 50.0));
        
        // Above threshold
        assert!(pi.exceeds_threshold(200.0, 500.0));
    }

    #[test]
    fn test_damage_assessment() {
        let level = PressureImpulseDiagram::assess_damage(50.0, 300.0, "rc_wall_200");
        
        // Should return some damage level
        assert!(matches!(level, DamageLevel::None | DamageLevel::Superficial | 
                        DamageLevel::Moderate | DamageLevel::Heavy | DamageLevel::Collapse));
    }

    #[test]
    fn test_fragment_analysis() {
        let frag = FragmentAnalysis::calculate(
            10.0,    // mass (g)
            1000.0,  // velocity (m/s)
            45.0,    // angle (degrees)
            0.5,     // drag coefficient
            1.0,     // area (cm²)
        );
        
        assert!(frag.range > 0.0);
        assert!(frag.impact_velocity < frag.velocity);
        assert!(frag.kinetic_energy > 0.0);
    }

    #[test]
    fn test_gurney_velocity() {
        let v = FragmentAnalysis::gurney_velocity(1.0, 0.5, 2700.0);
        
        assert!(v > 0.0);
        assert!(v < 2700.0);
    }

    #[test]
    fn test_response_mode() {
        // Impulsive: short duration, long period
        let imp = SdofBlastResponse::calculate(1000.0, 10.0, 50.0, 0.05, 100.0, 10.0, 1.0, 50.0);
        
        // Quasi-static: long duration, short period
        let qs = SdofBlastResponse::calculate(100.0, 1000.0, 50.0, 0.05, 100.0, 10.0, 100.0, 5000.0);
        
        assert!(imp.period > qs.period);
    }
}
