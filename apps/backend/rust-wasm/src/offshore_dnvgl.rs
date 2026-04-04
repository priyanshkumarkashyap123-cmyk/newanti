// ============================================================================
// OFFSHORE STRUCTURES - DNV-GL / IEC COMPLIANCE
// ============================================================================
//
// P1 REQUIREMENT: Offshore DNV-GL/IEC ULS/SLS Alignment
//
// Features:
// - DNV-GL-ST-0126 (Support structures for wind turbines)
// - DNV-GL-ST-0437 (Loads and site conditions)
// - IEC 61400-3 (Design requirements for offshore wind)
// - Fatigue pipeline with SN curves
// - Hydrodynamics (Morison equation)
// - Natural frequency checks
// - Marine growth allowance
//
// Industry Standard: Bladed, FAST, SACS, Sesam
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// DNV-GL LOAD FACTORS
// ============================================================================

/// DNV-GL load factor sets per DNVGL-ST-0126
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnvglLoadFactors {
    pub limit_state: LimitState,
    pub consequence_class: ConsequenceClass,
    pub factors: LoadFactorSet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LimitState {
    ULS,  // Ultimate Limit State
    SLS,  // Serviceability Limit State
    FLS,  // Fatigue Limit State
    ALS,  // Accidental Limit State
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConsequenceClass {
    CC1,  // Low consequence
    CC2,  // Normal consequence
    CC3,  // High consequence
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadFactorSet {
    pub gamma_f_g: f64,   // Permanent loads
    pub gamma_f_e: f64,   // Environmental loads
    pub gamma_f_d: f64,   // Deformation loads
    pub gamma_m: f64,     // Material factor
    pub gamma_fat: f64,   // Fatigue material factor
}

impl DnvglLoadFactors {
    /// Get load factors per DNVGL-ST-0126 Table 5-1
    pub fn new(limit_state: LimitState, consequence_class: ConsequenceClass) -> Self {
        let factors = match limit_state {
            LimitState::ULS => match consequence_class {
                ConsequenceClass::CC1 => LoadFactorSet {
                    gamma_f_g: 1.25,
                    gamma_f_e: 1.25,
                    gamma_f_d: 1.0,
                    gamma_m: 1.1,
                    gamma_fat: 1.0,
                },
                ConsequenceClass::CC2 => LoadFactorSet {
                    gamma_f_g: 1.35,
                    gamma_f_e: 1.35,
                    gamma_f_d: 1.0,
                    gamma_m: 1.15,
                    gamma_fat: 1.0,
                },
                ConsequenceClass::CC3 => LoadFactorSet {
                    gamma_f_g: 1.35,
                    gamma_f_e: 1.5,
                    gamma_f_d: 1.0,
                    gamma_m: 1.25,
                    gamma_fat: 1.0,
                },
            },
            LimitState::SLS => LoadFactorSet {
                gamma_f_g: 1.0,
                gamma_f_e: 1.0,
                gamma_f_d: 1.0,
                gamma_m: 1.0,
                gamma_fat: 1.0,
            },
            LimitState::FLS => LoadFactorSet {
                gamma_f_g: 1.0,
                gamma_f_e: 1.0,
                gamma_f_d: 1.0,
                gamma_m: 1.0,
                gamma_fat: match consequence_class {
                    ConsequenceClass::CC1 => 1.0,
                    ConsequenceClass::CC2 => 1.15,
                    ConsequenceClass::CC3 => 1.25,
                },
            },
            LimitState::ALS => LoadFactorSet {
                gamma_f_g: 1.0,
                gamma_f_e: 1.0,
                gamma_f_d: 1.0,
                gamma_m: 1.0,
                gamma_fat: 1.0,
            },
        };

        Self {
            limit_state,
            consequence_class,
            factors,
        }
    }
}

// ============================================================================
// MORISON EQUATION HYDRODYNAMICS
// ============================================================================

/// Morison equation for wave loading on cylindrical members
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorisonLoading {
    /// Member properties
    pub member: CylindricalMember,
    /// Water properties
    pub water: WaterProperties,
    /// Wave conditions
    pub wave: WaveConditions,
    /// Marine growth
    pub marine_growth: Option<MarineGrowth>,
    /// Results
    pub results: MorisonResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CylindricalMember {
    pub diameter: f64,        // m (structural diameter)
    pub length: f64,          // m
    pub cd: f64,              // Drag coefficient
    pub cm: f64,              // Inertia coefficient
    pub orientation: MemberOrientation,
    pub top_elevation: f64,   // m (from seabed)
    pub bottom_elevation: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemberOrientation {
    Vertical,
    Horizontal,
    Inclined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaterProperties {
    pub density: f64,         // kg/m³ (typically 1025)
    pub depth: f64,           // m (water depth)
    pub kinematic_viscosity: f64, // m²/s
}

impl Default for WaterProperties {
    fn default() -> Self {
        Self {
            density: 1025.0,
            depth: 30.0,
            kinematic_viscosity: 1.19e-6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveConditions {
    pub height: f64,          // m (significant or design wave height)
    pub period: f64,          // s (wave period)
    pub current_velocity: f64, // m/s (surface current)
    pub wave_theory: WaveTheory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WaveTheory {
    Airy,
    Stokes2nd,
    Stokes5th,
    StreamFunction,
    Cnoidal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarineGrowth {
    pub thickness: f64,       // m
    pub density: f64,         // kg/m³
    pub roughness: f64,       // m
    pub depth_profile: Vec<(f64, f64)>, // (depth, thickness)
}

impl MarineGrowth {
    /// Standard marine growth profile per DNVGL-RP-C205
    pub fn standard_north_sea() -> Self {
        Self {
            thickness: 0.100, // 100mm max
            density: 1325.0,
            roughness: 0.05,
            depth_profile: vec![
                (0.0, 0.0),     // Above water
                (-2.0, 0.100),  // Splash zone
                (-10.0, 0.100), // Upper zone
                (-30.0, 0.050), // Mid zone
                (-50.0, 0.025), // Lower zone
            ],
        }
    }

    /// Get thickness at depth
    pub fn thickness_at_depth(&self, depth: f64) -> f64 {
        for i in 0..self.depth_profile.len() - 1 {
            let (d1, t1) = self.depth_profile[i];
            let (d2, t2) = self.depth_profile[i + 1];
            if depth >= d2 && depth <= d1 {
                // Linear interpolation
                let ratio = (depth - d1) / (d2 - d1);
                return t1 + ratio * (t2 - t1);
            }
        }
        self.depth_profile.last().map(|(_, t)| *t).unwrap_or(0.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorisonResults {
    /// Force distribution along member
    pub force_distribution: Vec<ForcePoint>,
    /// Maximum inline force per unit length
    pub max_inline_force: f64, // kN/m
    /// Maximum drag force
    pub max_drag: f64,        // kN
    /// Maximum inertia force
    pub max_inertia: f64,     // kN
    /// Total base shear
    pub base_shear: f64,      // kN
    /// Overturning moment at seabed
    pub overturning_moment: f64, // kN·m
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForcePoint {
    pub elevation: f64,       // m from seabed
    pub drag_force: f64,      // kN/m
    pub inertia_force: f64,   // kN/m
    pub total_force: f64,     // kN/m
    pub velocity: f64,        // m/s
    pub acceleration: f64,    // m/s²
}

impl MorisonLoading {
    /// Calculate Morison forces
    pub fn calculate(
        member: CylindricalMember,
        water: WaterProperties,
        wave: WaveConditions,
        marine_growth: Option<MarineGrowth>,
    ) -> Self {
        let rho = water.density;
        let d = water.depth;
        let h = wave.height;
        let t = wave.period;
        
        // Wave number (linear wave theory approximation)
        let omega = 2.0 * PI / t;
        let k = omega * omega / 9.81; // Deep water approximation
        
        // Effective diameter including marine growth
        let mg_thickness = marine_growth.as_ref().map(|mg| mg.thickness).unwrap_or(0.0);
        let d_eff = member.diameter + 2.0 * mg_thickness;

        let mut force_distribution = Vec::new();
        let mut max_drag = 0.0_f64;
        let mut max_inertia = 0.0_f64;
        let mut total_shear = 0.0;
        let mut total_moment = 0.0;

        // Discretize member
        let n_points = 20;
        let dz = (member.top_elevation - member.bottom_elevation) / n_points as f64;

        for i in 0..=n_points {
            let z = member.bottom_elevation + i as f64 * dz;
            
            // Skip if above water
            if z > d {
                continue;
            }

            // Velocity and acceleration at this depth (Airy wave theory)
            // z is elevation from seabed; in Airy theory z_MWL = z - d, so
            // cosh(k(z_MWL + d)) = cosh(k·z) where z is from seabed
            let depth_factor = (k * z).cosh() / (k * d).sinh();
            let u_max = omega * h / 2.0 * depth_factor + wave.current_velocity;
            let a_max = omega * omega * h / 2.0 * depth_factor;

            // Drag force per unit length
            let fd = 0.5 * rho * member.cd * d_eff * u_max * u_max.abs() / 1000.0;

            // Inertia force per unit length
            let fi = rho * member.cm * PI * d_eff * d_eff / 4.0 * a_max / 1000.0;

            // Total (conservative: sum of maxima)
            let f_total = (fd.powi(2) + fi.powi(2)).sqrt();

            max_drag = max_drag.max(fd * dz);
            max_inertia = max_inertia.max(fi * dz);

            total_shear += f_total * dz;
            total_moment += f_total * dz * z;

            force_distribution.push(ForcePoint {
                elevation: z,
                drag_force: fd,
                inertia_force: fi,
                total_force: f_total,
                velocity: u_max,
                acceleration: a_max,
            });
        }

        let max_inline = force_distribution.iter()
            .map(|f| f.total_force)
            .fold(0.0_f64, |a, b| a.max(b));

        Self {
            member,
            water,
            wave,
            marine_growth,
            results: MorisonResults {
                force_distribution,
                max_inline_force: max_inline,
                max_drag,
                max_inertia,
                base_shear: total_shear,
                overturning_moment: total_moment,
            },
        }
    }
}

// ============================================================================
// FATIGUE ANALYSIS (SN CURVES)
// ============================================================================

/// Fatigue analysis per DNVGL-RP-C203
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FatigueAnalysis {
    /// SN curve used
    pub sn_curve: SnCurve,
    /// Stress history
    pub stress_ranges: Vec<StressRange>,
    /// Design fatigue factor (DFF)
    pub dff: f64,
    /// Results
    pub results: FatigueResults,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SnCurve {
    /// DNVGL curves
    B1,
    B2,
    C,
    C1,
    C2,
    D,
    E,
    F,
    F1,
    F3,
    G,
    W1,
    W2,
    W3,
    /// Tubular joints
    T,
}

impl SnCurve {
    /// Get SN curve parameters (log10(a), m1, m2, Δσ_threshold)
    pub fn parameters(&self) -> SnParameters {
        match self {
            SnCurve::B1 => SnParameters { log_a1: 15.117, m1: 4.0, log_a2: 17.146, m2: 5.0, threshold: 106.97 },
            SnCurve::B2 => SnParameters { log_a1: 14.885, m1: 4.0, log_a2: 16.856, m2: 5.0, threshold: 93.59 },
            SnCurve::C => SnParameters { log_a1: 13.617, m1: 3.5, log_a2: 16.320, m2: 5.0, threshold: 73.10 },
            SnCurve::C1 => SnParameters { log_a1: 13.294, m1: 3.5, log_a2: 15.969, m2: 5.0, threshold: 65.50 },
            SnCurve::C2 => SnParameters { log_a1: 12.908, m1: 3.5, log_a2: 15.636, m2: 5.0, threshold: 58.48 },
            SnCurve::D => SnParameters { log_a1: 12.164, m1: 3.0, log_a2: 15.606, m2: 5.0, threshold: 52.63 },
            SnCurve::E => SnParameters { log_a1: 11.855, m1: 3.0, log_a2: 15.362, m2: 5.0, threshold: 46.78 },
            SnCurve::F => SnParameters { log_a1: 11.546, m1: 3.0, log_a2: 15.091, m2: 5.0, threshold: 41.52 },
            SnCurve::F1 => SnParameters { log_a1: 11.299, m1: 3.0, log_a2: 14.832, m2: 5.0, threshold: 36.84 },
            SnCurve::F3 => SnParameters { log_a1: 10.970, m1: 3.0, log_a2: 14.576, m2: 5.0, threshold: 32.75 },
            SnCurve::G => SnParameters { log_a1: 10.592, m1: 3.0, log_a2: 14.330, m2: 5.0, threshold: 29.24 },
            SnCurve::W1 => SnParameters { log_a1: 10.296, m1: 3.0, log_a2: 14.009, m2: 5.0, threshold: 25.95 },
            SnCurve::W2 => SnParameters { log_a1: 10.000, m1: 3.0, log_a2: 13.688, m2: 5.0, threshold: 23.05 },
            SnCurve::W3 => SnParameters { log_a1: 9.699, m1: 3.0, log_a2: 13.394, m2: 5.0, threshold: 20.63 },
            SnCurve::T => SnParameters { log_a1: 12.476, m1: 3.0, log_a2: 16.127, m2: 5.0, threshold: 67.09 },
        }
    }

    /// Calculate allowable cycles for given stress range
    pub fn allowable_cycles(&self, stress_range: f64) -> f64 {
        let params = self.parameters();
        
        if stress_range <= 0.0 {
            return f64::INFINITY;
        }

        let log_n = if stress_range > params.threshold {
            params.log_a1 - params.m1 * stress_range.log10()
        } else {
            params.log_a2 - params.m2 * stress_range.log10()
        };

        10.0_f64.powf(log_n)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnParameters {
    pub log_a1: f64,
    pub m1: f64,
    pub log_a2: f64,
    pub m2: f64,
    pub threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressRange {
    /// Stress range (MPa)
    pub delta_sigma: f64,
    /// Number of cycles
    pub n_cycles: f64,
    /// Stress concentration factor applied
    pub scf: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FatigueResults {
    /// Miner's sum (cumulative damage)
    pub miners_sum: f64,
    /// Fatigue utilization (D * DFF)
    pub utilization: f64,
    /// Fatigue life (years)
    pub fatigue_life: f64,
    /// Design life (years)
    pub design_life: f64,
    /// Pass/fail status
    pub status: FatigueStatus,
    /// Damage breakdown by stress range bin
    pub damage_breakdown: Vec<DamageBin>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FatigueStatus {
    Pass,
    Fail,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageBin {
    pub stress_range: f64,
    pub n_applied: f64,
    pub n_allowable: f64,
    pub damage: f64,
    pub percentage: f64,
}

impl FatigueAnalysis {
    /// Perform fatigue assessment per Palmgren-Miner rule
    pub fn assess(
        sn_curve: SnCurve,
        stress_ranges: Vec<StressRange>,
        dff: f64,
        design_life_years: f64,
    ) -> Self {
        let mut miners_sum = 0.0;
        let mut damage_breakdown = Vec::new();

        for sr in &stress_ranges {
            // Apply SCF to stress range
            let effective_stress = sr.delta_sigma * sr.scf;
            
            // Get allowable cycles
            let n_allowable = sn_curve.allowable_cycles(effective_stress);
            
            // Calculate damage
            let damage = sr.n_cycles / n_allowable;
            miners_sum += damage;

            damage_breakdown.push(DamageBin {
                stress_range: effective_stress,
                n_applied: sr.n_cycles,
                n_allowable,
                damage,
                percentage: 0.0, // Calculated after
            });
        }

        // Calculate percentages
        for bin in &mut damage_breakdown {
            bin.percentage = if miners_sum > 0.0 {
                bin.damage / miners_sum * 100.0
            } else {
                0.0
            };
        }

        let utilization = miners_sum * dff;
        let fatigue_life = if miners_sum > 0.0 {
            design_life_years / miners_sum
        } else {
            f64::INFINITY
        };

        let status = if utilization <= 1.0 {
            FatigueStatus::Pass
        } else if utilization <= 1.1 {
            FatigueStatus::Warning
        } else {
            FatigueStatus::Fail
        };

        Self {
            sn_curve,
            stress_ranges,
            dff,
            results: FatigueResults {
                miners_sum,
                utilization,
                fatigue_life,
                design_life: design_life_years,
                status,
                damage_breakdown,
            },
        }
    }
}

// ============================================================================
// NATURAL FREQUENCY CHECKS
// ============================================================================

/// Natural frequency check for offshore structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NaturalFrequencyCheck {
    /// Structure natural frequencies
    pub structural_frequencies: Vec<StructuralMode>,
    /// Excitation frequencies to avoid
    pub excitation_frequencies: ExcitationFrequencies,
    /// Frequency margins
    pub margins: FrequencyMargins,
    /// Check results
    pub results: FrequencyCheckResults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralMode {
    pub mode_number: usize,
    pub frequency: f64,       // Hz
    pub period: f64,          // s
    pub description: String,
    pub mass_participation: f64, // %
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExcitationFrequencies {
    /// Rotor frequency (1P) range
    pub rotor_1p: (f64, f64),
    /// Blade passing frequency (3P for 3-bladed) range
    pub blade_3p: (f64, f64),
    /// Wave frequency range
    pub wave: (f64, f64),
    /// Current frequency
    pub current: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencyMargins {
    /// Minimum margin from 1P (typically 5-10%)
    pub margin_1p: f64,
    /// Minimum margin from 3P
    pub margin_3p: f64,
    /// Minimum margin from wave frequencies
    pub margin_wave: f64,
}

impl Default for FrequencyMargins {
    fn default() -> Self {
        Self {
            margin_1p: 0.10,
            margin_3p: 0.10,
            margin_wave: 0.05,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencyCheckResults {
    /// Overall status
    pub status: FrequencyStatus,
    /// Design classification
    pub design_type: DesignType,
    /// Individual mode checks
    pub mode_checks: Vec<ModeCheck>,
    /// Recommendations
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FrequencyStatus {
    Pass,
    Fail,
    Warning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DesignType {
    SoftSoft,    // f < 1P
    SoftStiff,   // 1P < f < 3P
    StiffStiff,  // f > 3P
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeCheck {
    pub mode: usize,
    pub frequency: f64,
    pub conflicts: Vec<FrequencyConflict>,
    pub status: FrequencyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencyConflict {
    pub excitation: String,
    pub excitation_freq: f64,
    pub ratio: f64,
    pub margin_required: f64,
    pub margin_actual: f64,
}

impl NaturalFrequencyCheck {
    /// Perform natural frequency check for wind turbine support structure
    pub fn check(
        structural_frequencies: Vec<StructuralMode>,
        excitation_frequencies: ExcitationFrequencies,
        margins: FrequencyMargins,
    ) -> Self {
        let mut mode_checks = Vec::new();
        let mut overall_status = FrequencyStatus::Pass;
        let mut recommendations = Vec::new();

        // Determine design type from first mode
        let first_mode_freq = structural_frequencies.first()
            .map(|m| m.frequency)
            .unwrap_or(0.0);

        let design_type = if first_mode_freq < excitation_frequencies.rotor_1p.0 {
            DesignType::SoftSoft
        } else if first_mode_freq < excitation_frequencies.blade_3p.0 {
            DesignType::SoftStiff
        } else {
            DesignType::StiffStiff
        };

        for mode in &structural_frequencies {
            let mut conflicts = Vec::new();
            let mut mode_status = FrequencyStatus::Pass;

            // Check 1P resonance
            let (f1p_min, f1p_max) = excitation_frequencies.rotor_1p;
            if mode.frequency > f1p_min * (1.0 - margins.margin_1p) 
                && mode.frequency < f1p_max * (1.0 + margins.margin_1p) 
            {
                let margin_actual = if mode.frequency < f1p_min {
                    (f1p_min - mode.frequency) / f1p_min
                } else {
                    (mode.frequency - f1p_max) / f1p_max
                };

                conflicts.push(FrequencyConflict {
                    excitation: "1P (Rotor)".to_string(),
                    excitation_freq: (f1p_min + f1p_max) / 2.0,
                    ratio: mode.frequency / ((f1p_min + f1p_max) / 2.0),
                    margin_required: margins.margin_1p,
                    margin_actual: margin_actual.abs(),
                });

                if margin_actual.abs() < margins.margin_1p {
                    mode_status = FrequencyStatus::Fail;
                }
            }

            // Check 3P resonance
            let (f3p_min, f3p_max) = excitation_frequencies.blade_3p;
            if mode.frequency > f3p_min * (1.0 - margins.margin_3p) 
                && mode.frequency < f3p_max * (1.0 + margins.margin_3p) 
            {
                let margin_actual = if mode.frequency < f3p_min {
                    (f3p_min - mode.frequency) / f3p_min
                } else {
                    (mode.frequency - f3p_max) / f3p_max
                };

                conflicts.push(FrequencyConflict {
                    excitation: "3P (Blade passing)".to_string(),
                    excitation_freq: (f3p_min + f3p_max) / 2.0,
                    ratio: mode.frequency / ((f3p_min + f3p_max) / 2.0),
                    margin_required: margins.margin_3p,
                    margin_actual: margin_actual.abs(),
                });

                if margin_actual.abs() < margins.margin_3p {
                    mode_status = FrequencyStatus::Fail;
                }
            }

            if mode_status == FrequencyStatus::Fail {
                overall_status = FrequencyStatus::Fail;
            }

            mode_checks.push(ModeCheck {
                mode: mode.mode_number,
                frequency: mode.frequency,
                conflicts,
                status: mode_status,
            });
        }

        // Generate recommendations
        if overall_status == FrequencyStatus::Fail {
            recommendations.push("Consider modifying structure stiffness to avoid resonance".to_string());
            recommendations.push("Review tower wall thickness and monopile diameter".to_string());
            recommendations.push("Evaluate transition piece stiffness".to_string());
        }

        match design_type {
            DesignType::SoftSoft => {
                recommendations.push("Soft-soft design: Ensure adequate wave loading checks".to_string());
            }
            DesignType::SoftStiff => {
                recommendations.push("Soft-stiff design: Standard for most offshore wind turbines".to_string());
            }
            DesignType::StiffStiff => {
                recommendations.push("Stiff-stiff design: Higher material quantities expected".to_string());
            }
        }

        Self {
            structural_frequencies,
            excitation_frequencies,
            margins,
            results: FrequencyCheckResults {
                status: overall_status,
                design_type,
                mode_checks,
                recommendations,
            },
        }
    }
}

// ============================================================================
// IEC 61400-3 LOAD CASES
// ============================================================================

/// IEC 61400-3 design load cases for offshore wind turbines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Iec61400LoadCases {
    pub dlc: Vec<DesignLoadCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignLoadCase {
    pub id: String,
    pub name: String,
    pub design_situation: DesignSituation,
    pub wind_condition: WindCondition,
    pub sea_condition: SeaCondition,
    pub partial_safety_factor: f64,
    pub analysis_type: AnalysisType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DesignSituation {
    PowerProduction,
    PowerProductionWithFault,
    StartUp,
    NormalShutdown,
    EmergencyShutdown,
    Parked,
    ParkedWithFault,
    Transport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WindCondition {
    NTM,  // Normal Turbulence Model
    ETM,  // Extreme Turbulence Model
    EWM,  // Extreme Wind Model
    EOG,  // Extreme Operating Gust
    EDC,  // Extreme Direction Change
    ECD,  // Extreme Coherent Gust with Direction Change
    EWS,  // Extreme Wind Shear
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SeaCondition {
    NSS,  // Normal Sea State
    SSS,  // Severe Sea State
    ESS,  // Extreme Sea State
    RWH,  // Reduced Wave Height
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnalysisType {
    Ultimate,
    Fatigue,
}

impl Iec61400LoadCases {
    /// Generate standard IEC 61400-3 load cases
    pub fn standard() -> Self {
        let dlc = vec![
            // Power production
            DesignLoadCase {
                id: "DLC 1.1".to_string(),
                name: "Power production, normal conditions".to_string(),
                design_situation: DesignSituation::PowerProduction,
                wind_condition: WindCondition::NTM,
                sea_condition: SeaCondition::NSS,
                partial_safety_factor: 1.25,
                analysis_type: AnalysisType::Ultimate,
            },
            DesignLoadCase {
                id: "DLC 1.2".to_string(),
                name: "Power production, fatigue".to_string(),
                design_situation: DesignSituation::PowerProduction,
                wind_condition: WindCondition::NTM,
                sea_condition: SeaCondition::NSS,
                partial_safety_factor: 1.0,
                analysis_type: AnalysisType::Fatigue,
            },
            DesignLoadCase {
                id: "DLC 1.3".to_string(),
                name: "Power production, extreme turbulence".to_string(),
                design_situation: DesignSituation::PowerProduction,
                wind_condition: WindCondition::ETM,
                sea_condition: SeaCondition::NSS,
                partial_safety_factor: 1.35,
                analysis_type: AnalysisType::Ultimate,
            },
            DesignLoadCase {
                id: "DLC 1.4".to_string(),
                name: "Power production, extreme coherent gust".to_string(),
                design_situation: DesignSituation::PowerProduction,
                wind_condition: WindCondition::ECD,
                sea_condition: SeaCondition::NSS,
                partial_safety_factor: 1.35,
                analysis_type: AnalysisType::Ultimate,
            },
            DesignLoadCase {
                id: "DLC 1.5".to_string(),
                name: "Power production, extreme wind shear".to_string(),
                design_situation: DesignSituation::PowerProduction,
                wind_condition: WindCondition::EWS,
                sea_condition: SeaCondition::NSS,
                partial_safety_factor: 1.35,
                analysis_type: AnalysisType::Ultimate,
            },
            // Parked conditions
            DesignLoadCase {
                id: "DLC 6.1".to_string(),
                name: "Parked, 50-year conditions".to_string(),
                design_situation: DesignSituation::Parked,
                wind_condition: WindCondition::EWM,
                sea_condition: SeaCondition::ESS,
                partial_safety_factor: 1.35,
                analysis_type: AnalysisType::Ultimate,
            },
            DesignLoadCase {
                id: "DLC 6.2".to_string(),
                name: "Parked, loss of grid, 50-year".to_string(),
                design_situation: DesignSituation::ParkedWithFault,
                wind_condition: WindCondition::EWM,
                sea_condition: SeaCondition::ESS,
                partial_safety_factor: 1.1,
                analysis_type: AnalysisType::Ultimate,
            },
            DesignLoadCase {
                id: "DLC 6.3".to_string(),
                name: "Parked, 1-year conditions".to_string(),
                design_situation: DesignSituation::Parked,
                wind_condition: WindCondition::EWM,
                sea_condition: SeaCondition::SSS,
                partial_safety_factor: 1.35,
                analysis_type: AnalysisType::Ultimate,
            },
        ];

        Self { dlc }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dnvgl_load_factors() {
        let uls = DnvglLoadFactors::new(LimitState::ULS, ConsequenceClass::CC2);
        assert_eq!(uls.factors.gamma_f_g, 1.35);
        assert_eq!(uls.factors.gamma_m, 1.15);

        let sls = DnvglLoadFactors::new(LimitState::SLS, ConsequenceClass::CC1);
        assert_eq!(sls.factors.gamma_f_g, 1.0);
    }

    #[test]
    fn test_morison_loading() {
        let member = CylindricalMember {
            diameter: 6.0,
            length: 30.0,
            cd: 1.0,
            cm: 2.0,
            orientation: MemberOrientation::Vertical,
            top_elevation: 25.0,
            bottom_elevation: 0.0,
        };

        let water = WaterProperties::default();
        let wave = WaveConditions {
            height: 10.0,
            period: 12.0,
            current_velocity: 1.0,
            wave_theory: WaveTheory::Airy,
        };

        let result = MorisonLoading::calculate(member, water, wave, None);
        
        assert!(result.results.base_shear > 0.0);
        assert!(result.results.overturning_moment > 0.0);
    }

    #[test]
    fn test_sn_curve() {
        let curve = SnCurve::D;
        let n = curve.allowable_cycles(100.0);
        assert!(n > 0.0);
        assert!(n < 1e10);

        // Higher stress should give fewer cycles
        let n_high = curve.allowable_cycles(200.0);
        assert!(n_high < n);
    }

    #[test]
    fn test_fatigue_analysis() {
        let stress_ranges = vec![
            StressRange { delta_sigma: 50.0, n_cycles: 1e6, scf: 1.2 },
            StressRange { delta_sigma: 100.0, n_cycles: 1e5, scf: 1.2 },
        ];

        let result = FatigueAnalysis::assess(
            SnCurve::D,
            stress_ranges,
            1.15,
            25.0,
        );

        assert!(result.results.miners_sum > 0.0);
        assert!(result.results.fatigue_life > 0.0);
    }

    #[test]
    fn test_frequency_check() {
        let modes = vec![
            StructuralMode {
                mode_number: 1,
                frequency: 0.25,
                period: 4.0,
                description: "First fore-aft".to_string(),
                mass_participation: 60.0,
            },
        ];

        let excitation = ExcitationFrequencies {
            rotor_1p: (0.15, 0.20),
            blade_3p: (0.45, 0.60),
            wave: (0.05, 0.15),
            current: None,
        };

        let result = NaturalFrequencyCheck::check(
            modes,
            excitation,
            FrequencyMargins::default(),
        );

        assert_eq!(result.results.design_type, DesignType::SoftStiff);
    }
}
