// ============================================================================
// ADVANCED GEOTECHNICAL FEATURES
// ============================================================================
//
// P1 REQUIREMENT: Geotechnical engineering features
//
// Features:
// - Liquefaction assessment (SPT/CPT based)
// - Lateral spreading estimation
// - Mononobe-Okabe seismic earth pressures
// - Pile negative skin friction
// - Settlement calculations (immediate + consolidation)
// - Bearing capacity (Terzaghi, Meyerhof, Hansen)
//
// Industry Standard: PLAXIS, GeoStudio, RSPile
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// LIQUEFACTION ASSESSMENT
// ============================================================================

/// Liquefaction assessment per NCEER/Youd et al. (2001)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquefactionAssessment {
    /// Soil layers analyzed
    pub layers: Vec<LiquefactionLayer>,
    /// Peak ground acceleration (g)
    pub pga: f64,
    /// Earthquake magnitude
    pub magnitude: f64,
    /// Groundwater depth (m)
    pub gwt_depth: f64,
    /// Overall liquefaction potential index (LPI)
    pub lpi: f64,
    /// Severity classification
    pub severity: LiquefactionSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquefactionLayer {
    /// Layer depth (m)
    pub depth: f64,
    /// Layer thickness (m)
    pub thickness: f64,
    /// SPT N-value (raw)
    pub n_raw: f64,
    /// Corrected SPT N-value (N1)60
    pub n1_60: f64,
    /// Fines content (%)
    pub fines_content: f64,
    /// Total vertical stress (kPa)
    pub sigma_v: f64,
    /// Effective vertical stress (kPa)
    pub sigma_v_prime: f64,
    /// Cyclic stress ratio (CSR)
    pub csr: f64,
    /// Cyclic resistance ratio (CRR)
    pub crr: f64,
    /// Factor of safety against liquefaction
    pub fs: f64,
    /// Probability of liquefaction (%)
    pub probability: f64,
    /// Liquefaction potential
    pub will_liquefy: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LiquefactionSeverity {
    None,
    Low,
    Moderate,
    High,
    VeryHigh,
}

impl LiquefactionAssessment {
    /// Create liquefaction assessment from SPT data
    pub fn from_spt(
        spt_data: Vec<SptData>,
        pga: f64,
        magnitude: f64,
        gwt_depth: f64,
        unit_weight: f64,
        submerged_weight: f64,
    ) -> Self {
        let mut layers = Vec::new();
        let mut cumulative_depth = 0.0;

        for spt in &spt_data {
            let depth = spt.depth;
            let thickness = if cumulative_depth == 0.0 {
                depth
            } else {
                depth - cumulative_depth
            };
            cumulative_depth = depth;

            // Calculate stresses
            // Total vertical stress: γ_moist above GWT, γ_sat below GWT
            // γ_sat = γ' + γ_w = submerged_weight + 9.81
            let sigma_v = if depth <= gwt_depth {
                depth * unit_weight
            } else {
                gwt_depth * unit_weight + (depth - gwt_depth) * (submerged_weight + 9.81)
            };

            let sigma_v_prime = if depth <= gwt_depth {
                sigma_v
            } else {
                gwt_depth * unit_weight + (depth - gwt_depth) * submerged_weight
            };

            // SPT corrections
            let cn = (100.0 / sigma_v_prime).sqrt().min(1.7);
            let ce = spt.energy_ratio / 60.0;
            let cb = spt.borehole_correction;
            let cr = Self::rod_length_correction(depth);
            let cs = spt.sampler_correction;

            let n1_60 = spt.n_value * cn * ce * cb * cr * cs;

            // Fines content correction
            let delta_n = if spt.fines_content <= 5.0 {
                0.0
            } else if spt.fines_content < 35.0 {
                (spt.fines_content - 5.0) / 30.0 * 5.0
            } else {
                5.0
            };

            let n1_60_cs = n1_60 + delta_n;

            // CSR calculation (Seed & Idriss, 1971)
            let rd = Self::stress_reduction_factor(depth);
            let csr = 0.65 * (sigma_v / sigma_v_prime) * pga * rd;

            // CRR calculation
            let crr = Self::calculate_crr(n1_60_cs);

            // Magnitude scaling factor
            let msf = Self::magnitude_scaling_factor(magnitude);

            // Factor of safety
            let fs = (crr * msf) / csr;

            // Probability of liquefaction
            let probability = Self::liquefaction_probability(fs);

            layers.push(LiquefactionLayer {
                depth,
                thickness,
                n_raw: spt.n_value,
                n1_60: n1_60_cs,
                fines_content: spt.fines_content,
                sigma_v,
                sigma_v_prime,
                csr,
                crr,
                fs,
                probability,
                will_liquefy: fs < 1.0,
            });
        }

        // Calculate LPI
        let lpi = Self::calculate_lpi(&layers);
        let severity = Self::classify_lpi(lpi);

        Self {
            layers,
            pga,
            magnitude,
            gwt_depth,
            lpi,
            severity,
        }
    }

    fn rod_length_correction(depth: f64) -> f64 {
        if depth < 3.0 {
            0.75
        } else if depth < 4.0 {
            0.80
        } else if depth < 6.0 {
            0.85
        } else if depth < 10.0 {
            0.95
        } else {
            1.0
        }
    }

    fn stress_reduction_factor(depth: f64) -> f64 {
        if depth <= 9.15 {
            1.0 - 0.00765 * depth
        } else if depth <= 23.0 {
            1.174 - 0.0267 * depth
        } else {
            0.744 - 0.008 * depth
        }.max(0.0)
    }

    fn calculate_crr(n1_60_cs: f64) -> f64 {
        // Youd et al. (2001) Eq. 4 — CRR for M7.5 earthquake
        if n1_60_cs < 30.0 {
            1.0 / (34.0 - n1_60_cs)
                + n1_60_cs / 135.0
                + 50.0 / (10.0 * n1_60_cs + 45.0).powi(2)
                - 1.0 / 200.0
        } else {
            // N1,60 >= 30 is generally non-liquefiable
            2.0
        }.max(0.05)
    }

    fn magnitude_scaling_factor(mw: f64) -> f64 {
        // Idriss (1999)
        10.0_f64.powf(2.24) / mw.powf(2.56)
    }

    fn liquefaction_probability(fs: f64) -> f64 {
        // Simplified probability function
        if fs >= 1.5 {
            0.0
        } else if fs >= 1.0 {
            (1.5 - fs) / 0.5 * 15.0
        } else if fs >= 0.8 {
            15.0 + (1.0 - fs) / 0.2 * 35.0
        } else {
            50.0 + (0.8 - fs) / 0.8 * 50.0
        }.min(100.0).max(0.0)
    }

    fn calculate_lpi(layers: &[LiquefactionLayer]) -> f64 {
        // Iwasaki et al. (1982) Liquefaction Potential Index
        layers.iter()
            .filter(|l| l.depth <= 20.0)
            .map(|l| {
                let f = if l.fs >= 1.0 { 0.0 } else { 1.0 - l.fs };
                let w = 10.0 - 0.5 * l.depth;
                f * w * l.thickness
            })
            .sum()
    }

    fn classify_lpi(lpi: f64) -> LiquefactionSeverity {
        if lpi <= 0.0 {
            LiquefactionSeverity::None
        } else if lpi <= 5.0 {
            LiquefactionSeverity::Low
        } else if lpi <= 15.0 {
            LiquefactionSeverity::Moderate
        } else if lpi <= 30.0 {
            LiquefactionSeverity::High
        } else {
            LiquefactionSeverity::VeryHigh
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SptData {
    pub depth: f64,
    pub n_value: f64,
    pub fines_content: f64,
    pub energy_ratio: f64,
    pub borehole_correction: f64,
    pub sampler_correction: f64,
}

impl Default for SptData {
    fn default() -> Self {
        Self {
            depth: 0.0,
            n_value: 0.0,
            fines_content: 5.0,
            energy_ratio: 60.0,
            borehole_correction: 1.0,
            sampler_correction: 1.0,
        }
    }
}

// ============================================================================
// LATERAL SPREADING
// ============================================================================

/// Lateral spreading estimation per Youd et al. (2002)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LateralSpreading {
    /// Predicted horizontal displacement (m)
    pub displacement: f64,
    /// Ground slope case or free-face case
    pub case_type: LateralSpreadingCase,
    /// Input parameters
    pub magnitude: f64,
    pub distance_km: f64,
    pub t15: f64,  // Cumulative thickness of saturated sand with (N1)60 < 15
    pub f15: f64,  // Average fines content in T15
    pub d50_15: f64, // Average D50 in T15
    /// Slope gradient (%) for ground slope case
    pub slope: Option<f64>,
    /// Free-face ratio (%) for free-face case
    pub free_face_ratio: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LateralSpreadingCase {
    GroundSlope,
    FreeFace,
}

impl LateralSpreading {
    /// Calculate lateral spreading for ground slope case
    pub fn ground_slope(
        magnitude: f64,
        distance_km: f64,
        slope: f64,  // in percent
        t15: f64,
        f15: f64,
        d50_15: f64,
    ) -> Self {
        // Youd et al. (2002) empirical equation
        let log_r = distance_km.log10();
        let _r_star = distance_km.powf(0.89) * 10.0_f64.powf(-0.001 * distance_km);
        
        let log_dh = -16.713 + 1.532 * magnitude 
            - 1.406 * log_r 
            - 0.012 * distance_km
            + 0.338 * slope.log10().max(-2.0)
            + 0.540 * t15.log10()
            + 3.413 * (100.0 - f15).log10()
            - 0.795 * (d50_15 + 0.1).log10();

        let displacement = 10.0_f64.powf(log_dh);

        Self {
            displacement,
            case_type: LateralSpreadingCase::GroundSlope,
            magnitude,
            distance_km,
            t15,
            f15,
            d50_15,
            slope: Some(slope),
            free_face_ratio: None,
        }
    }

    /// Calculate lateral spreading for free-face case
    pub fn free_face(
        magnitude: f64,
        distance_km: f64,
        free_face_ratio: f64,  // W/L as percent
        t15: f64,
        f15: f64,
        d50_15: f64,
    ) -> Self {
        let log_r = distance_km.log10();
        
        let log_dh = -16.713 + 1.532 * magnitude 
            - 1.406 * log_r 
            - 0.012 * distance_km
            + 0.592 * free_face_ratio.log10().max(-2.0)
            + 0.540 * t15.log10()
            + 3.413 * (100.0 - f15).log10()
            - 0.795 * (d50_15 + 0.1).log10();

        let displacement = 10.0_f64.powf(log_dh);

        Self {
            displacement,
            case_type: LateralSpreadingCase::FreeFace,
            magnitude,
            distance_km,
            t15,
            f15,
            d50_15,
            slope: None,
            free_face_ratio: Some(free_face_ratio),
        }
    }
}

// ============================================================================
// MONONOBE-OKABE SEISMIC EARTH PRESSURE
// ============================================================================

/// Mononobe-Okabe seismic earth pressure analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MononobeOkabe {
    /// Active earth pressure coefficient (Kae)
    pub kae: f64,
    /// Passive earth pressure coefficient (Kpe)
    pub kpe: f64,
    /// Static active coefficient (Ka)
    pub ka: f64,
    /// Dynamic increment coefficient (ΔKae)
    pub delta_kae: f64,
    /// Seismic inertia angle (θ)
    pub theta: f64,
    /// Wall parameters
    pub wall: RetainingWallParams,
    /// Seismic coefficients
    pub kh: f64,
    pub kv: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetainingWallParams {
    /// Wall height (m)
    pub height: f64,
    /// Soil unit weight (kN/m³)
    pub gamma: f64,
    /// Soil friction angle (degrees)
    pub phi: f64,
    /// Wall friction angle (degrees)
    pub delta: f64,
    /// Wall inclination from vertical (degrees, positive = leaning into soil)
    pub alpha: f64,
    /// Backfill slope angle (degrees)
    pub beta: f64,
    /// Cohesion (kPa)
    pub cohesion: f64,
}

impl MononobeOkabe {
    /// Calculate Mononobe-Okabe coefficients
    pub fn new(wall: RetainingWallParams, kh: f64, kv: f64) -> Self {
        let phi_rad = wall.phi.to_radians();
        let delta_rad = wall.delta.to_radians();
        let alpha_rad = wall.alpha.to_radians();
        let beta_rad = wall.beta.to_radians();

        // Seismic inertia angle
        let theta = (kh / (1.0 - kv)).atan();
        let theta_deg = theta.to_degrees();

        // Static Coulomb Ka
        let ka = Self::coulomb_ka(phi_rad, delta_rad, alpha_rad, beta_rad);

        // M-O active coefficient
        let kae = Self::calculate_kae(phi_rad, delta_rad, alpha_rad, beta_rad, theta);

        // M-O passive coefficient
        let kpe = Self::calculate_kpe(phi_rad, delta_rad, alpha_rad, beta_rad, theta);

        // Dynamic increment
        let delta_kae = kae - ka;

        Self {
            kae,
            kpe,
            ka,
            delta_kae,
            theta: theta_deg,
            wall,
            kh,
            kv,
        }
    }

    fn coulomb_ka(phi: f64, delta: f64, alpha: f64, beta: f64) -> f64 {
        let num = (phi - alpha).cos().powi(2);
        let denom1 = alpha.cos().powi(2) * (alpha + delta).cos();
        let sqrt_term = ((phi + delta).sin() * (phi - beta).sin() 
            / ((alpha + delta).cos() * (alpha - beta).cos())).sqrt();
        let denom2 = (1.0 + sqrt_term).powi(2);

        num / (denom1 * denom2)
    }

    fn calculate_kae(phi: f64, delta: f64, alpha: f64, beta: f64, theta: f64) -> f64 {
        // Check if solution exists (phi - theta - beta > 0)
        if phi - theta - beta <= 0.0 {
            return f64::INFINITY; // No solution - slope unstable
        }

        let num = (phi - theta - alpha).cos().powi(2);
        let denom1 = theta.cos() * alpha.cos().powi(2) * (alpha + delta + theta).cos();
        
        let sin_term = (phi + delta).sin() * (phi - theta - beta).sin();
        let cos_term = (alpha + delta + theta).cos() * (alpha - beta).cos();
        
        let sqrt_term = if cos_term > 0.0 {
            (sin_term / cos_term).sqrt()
        } else {
            return f64::INFINITY;
        };

        let denom2 = (1.0 + sqrt_term).powi(2);

        if denom1 * denom2 > 0.0 {
            num / (denom1 * denom2)
        } else {
            f64::INFINITY
        }
    }

    fn calculate_kpe(phi: f64, delta: f64, alpha: f64, beta: f64, theta: f64) -> f64 {
        let num = (phi + theta - alpha).cos().powi(2);
        let denom1 = theta.cos() * alpha.cos().powi(2) * (alpha - delta + theta).cos();
        
        let sin_term = (phi + delta).sin() * (phi + theta + beta).sin();
        let cos_term = (alpha - delta + theta).cos() * (alpha - beta).cos();
        
        let sqrt_term = if cos_term > 0.0 {
            (sin_term / cos_term).sqrt()
        } else {
            0.0
        };

        let denom2 = (1.0 - sqrt_term).powi(2);

        if denom1 * denom2 > 0.0 && denom2 > 0.0 {
            num / (denom1 * denom2)
        } else {
            f64::INFINITY
        }
    }

    /// Calculate total active earth pressure (kN/m)
    pub fn total_active_pressure(&self) -> f64 {
        0.5 * self.wall.gamma * self.wall.height.powi(2) * self.kae * (1.0 - self.kv)
    }

    /// Calculate dynamic increment of earth pressure (kN/m)
    pub fn dynamic_increment(&self) -> f64 {
        0.5 * self.wall.gamma * self.wall.height.powi(2) * self.delta_kae * (1.0 - self.kv)
    }

    /// Point of application of dynamic increment (from base)
    pub fn dynamic_application_height(&self) -> f64 {
        // Seed & Whitman (1970): applied at 0.6H for dynamic increment
        0.6 * self.wall.height
    }
}

// ============================================================================
// PILE NEGATIVE SKIN FRICTION
// ============================================================================

/// Negative skin friction (downdrag) analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NegativeSkinFriction {
    /// Pile properties
    pub pile: PileProperties,
    /// Soil layers
    pub layers: Vec<DowndragLayer>,
    /// Neutral plane depth (m)
    pub neutral_plane: f64,
    /// Total dragload (kN)
    pub dragload: f64,
    /// Settlement at pile tip (mm)
    pub settlement: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileProperties {
    /// Pile diameter (m)
    pub diameter: f64,
    /// Pile length (m)
    pub length: f64,
    /// Pile perimeter (m)
    pub perimeter: f64,
    /// Pile tip area (m²)
    pub tip_area: f64,
    /// Pile axial stiffness EA (kN)
    pub ea: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowndragLayer {
    /// Layer depth (m from ground)
    pub depth: f64,
    /// Layer thickness (m)
    pub thickness: f64,
    /// Effective vertical stress (kPa)
    pub sigma_v: f64,
    /// Beta coefficient
    pub beta: f64,
    /// Calculated downdrag (kN)
    pub downdrag: f64,
    /// Is this layer above neutral plane?
    pub above_neutral: bool,
}

impl NegativeSkinFriction {
    /// Calculate negative skin friction
    pub fn new(pile: PileProperties, soil_layers: Vec<SoilLayer>, settlement_profile: &[f64]) -> Self {
        let mut layers = Vec::new();
        let mut cumulative_depth = 0.0;
        let mut total_dragload = 0.0;

        // Find neutral plane (where pile settlement = soil settlement)
        // Simplified: assume neutral plane at 2/3 of compressible layer depth
        let compressible_depth: f64 = soil_layers.iter()
            .filter(|l| l.is_compressible)
            .map(|l| l.thickness)
            .sum();
        
        let neutral_plane = (compressible_depth * 2.0 / 3.0).min(pile.length);

        for layer in &soil_layers {
            cumulative_depth += layer.thickness;
            let mid_depth = cumulative_depth - layer.thickness / 2.0;

            let above_neutral = mid_depth <= neutral_plane;
            
            // Beta method for unit skin friction
            let beta = layer.beta_coefficient;
            let sigma_v = layer.sigma_v;
            
            let unit_friction = beta * sigma_v; // kPa
            let downdrag = if above_neutral {
                unit_friction * pile.perimeter * layer.thickness
            } else {
                0.0
            };

            if above_neutral {
                total_dragload += downdrag;
            }

            layers.push(DowndragLayer {
                depth: cumulative_depth,
                thickness: layer.thickness,
                sigma_v,
                beta,
                downdrag,
                above_neutral,
            });
        }

        // Estimate settlement (simplified)
        let settlement = if !settlement_profile.is_empty() {
            settlement_profile.iter().sum::<f64>() / settlement_profile.len() as f64
        } else {
            0.0
        };

        Self {
            pile,
            layers,
            neutral_plane,
            dragload: total_dragload,
            settlement,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    pub thickness: f64,
    pub sigma_v: f64,
    pub beta_coefficient: f64,
    pub is_compressible: bool,
}

// ============================================================================
// SETTLEMENT CALCULATIONS
// ============================================================================

/// Comprehensive settlement analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementAnalysis {
    /// Immediate (elastic) settlement (mm)
    pub immediate: f64,
    /// Primary consolidation settlement (mm)
    pub consolidation: f64,
    /// Secondary compression settlement (mm)
    pub secondary: f64,
    /// Total settlement (mm)
    pub total: f64,
    /// Time for 90% consolidation (days)
    pub t90: f64,
    /// Layer-by-layer breakdown
    pub layers: Vec<SettlementLayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementLayer {
    pub depth: f64,
    pub thickness: f64,
    pub immediate: f64,
    pub consolidation: f64,
    pub secondary: f64,
}

impl SettlementAnalysis {
    /// Calculate settlement for layered soil
    pub fn new(
        foundation: &FoundationParams,
        soil_layers: Vec<ConsolidationLayer>,
        time_years: f64,
    ) -> Self {
        let mut layers = Vec::new();
        let mut total_immediate = 0.0;
        let mut total_consolidation = 0.0;
        let mut total_secondary = 0.0;
        let mut cumulative_depth = 0.0;

        for layer in &soil_layers {
            cumulative_depth += layer.thickness;

            // Immediate settlement (Janbu, 1963)
            let mu_0 = 1.0; // Shape factor
            let mu_1 = 0.5; // Depth factor (simplified)
            let immediate = mu_0 * mu_1 * foundation.pressure * foundation.width 
                / layer.elastic_modulus * 1000.0; // Convert to mm

            // Consolidation settlement
            let delta_sigma = Self::stress_at_depth(
                foundation.pressure,
                foundation.width,
                foundation.length,
                cumulative_depth - layer.thickness / 2.0,
            );

            // mv = Cc / ((1 + e0) × σ'v × ln(10)) — standard definition
            let mv = layer.compression_index / (1.0 + layer.void_ratio) / layer.sigma_v / 2.302585;
            let consolidation = mv * delta_sigma * layer.thickness * 1000.0;

            // Secondary compression
            let t_primary = layer.thickness.powi(2) / layer.cv / 4.0 * 365.0; // days
            let time_days = time_years * 365.0;
            
            let secondary = if time_days > t_primary {
                layer.secondary_index * layer.thickness 
                    * (time_days / t_primary).log10() * 1000.0
            } else {
                0.0
            };

            total_immediate += immediate;
            total_consolidation += consolidation;
            total_secondary += secondary;

            layers.push(SettlementLayer {
                depth: cumulative_depth,
                thickness: layer.thickness,
                immediate,
                consolidation,
                secondary,
            });
        }

        // Time for 90% consolidation
        let total_h: f64 = soil_layers.iter().map(|l| l.thickness).sum();
        let avg_cv: f64 = soil_layers.iter().map(|l| l.cv).sum::<f64>() / soil_layers.len() as f64;
        let t90 = 0.848 * total_h.powi(2) / avg_cv;

        Self {
            immediate: total_immediate,
            consolidation: total_consolidation,
            secondary: total_secondary,
            total: total_immediate + total_consolidation + total_secondary,
            t90,
            layers,
        }
    }

    fn stress_at_depth(q: f64, b: f64, l: f64, z: f64) -> f64 {
        // 2:1 stress distribution (simplified)
        q * b * l / ((b + z) * (l + z))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundationParams {
    pub width: f64,
    pub length: f64,
    pub depth: f64,
    pub pressure: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsolidationLayer {
    pub thickness: f64,
    pub void_ratio: f64,
    pub compression_index: f64,  // Cc
    pub recompression_index: f64, // Cr
    pub secondary_index: f64,     // Cα
    pub cv: f64,                  // Coefficient of consolidation (m²/day)
    pub elastic_modulus: f64,
    pub sigma_v: f64,             // Current effective stress
    pub ocr: f64,                 // Overconsolidation ratio
}

// ============================================================================
// BEARING CAPACITY
// ============================================================================

/// Bearing capacity factors and calculations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCapacity {
    /// Ultimate bearing capacity (kPa)
    pub qu: f64,
    /// Allowable bearing capacity (kPa)
    pub qa: f64,
    /// Bearing capacity factors
    pub nc: f64,
    pub nq: f64,
    pub ng: f64,
    /// Shape factors
    pub sc: f64,
    pub sq: f64,
    pub sg: f64,
    /// Depth factors
    pub dc: f64,
    pub dq: f64,
    pub dg: f64,
    /// Inclination factors
    pub ic: f64,
    pub iq: f64,
    pub ig: f64,
    /// Method used
    pub method: BearingCapacityMethod,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BearingCapacityMethod {
    Terzaghi,
    Meyerhof,
    Hansen,
    Vesic,
}

impl BearingCapacity {
    /// Calculate bearing capacity using specified method
    pub fn new(
        method: BearingCapacityMethod,
        c: f64,      // Cohesion (kPa)
        phi: f64,    // Friction angle (degrees)
        gamma: f64,  // Unit weight (kN/m³)
        b: f64,      // Foundation width (m)
        l: f64,      // Foundation length (m)
        df: f64,     // Embedment depth (m)
        q: f64,      // Surcharge (kPa)
        fs: f64,     // Factor of safety
    ) -> Self {
        let phi_rad = phi.to_radians();

        // Bearing capacity factors
        let (nc, nq, ng) = match method {
            BearingCapacityMethod::Terzaghi => Self::terzaghi_factors(phi_rad),
            BearingCapacityMethod::Meyerhof => Self::meyerhof_factors(phi_rad),
            BearingCapacityMethod::Hansen => Self::hansen_factors(phi_rad),
            BearingCapacityMethod::Vesic => Self::vesic_factors(phi_rad),
        };

        // Shape factors
        let (sc, sq, sg) = Self::shape_factors(b, l, phi_rad, method);

        // Depth factors
        let (dc, dq, dg) = Self::depth_factors(df, b, phi_rad, method);

        // Inclination factors (assume vertical load)
        let (ic, iq, ig) = (1.0, 1.0, 1.0);

        // Ultimate bearing capacity
        let qu = c * nc * sc * dc * ic 
            + q * nq * sq * dq * iq 
            + 0.5 * gamma * b * ng * sg * dg * ig;

        let qa = qu / fs;

        Self {
            qu,
            qa,
            nc,
            nq,
            ng,
            sc,
            sq,
            sg,
            dc,
            dq,
            dg,
            ic,
            iq,
            ig,
            method,
        }
    }

    fn terzaghi_factors(phi: f64) -> (f64, f64, f64) {
        let nq = (PI / 4.0 + phi / 2.0).tan().powi(2) * (PI * phi.tan()).exp();
        let nc = (nq - 1.0) / phi.tan().max(0.001);
        let ng = 2.0 * (nq + 1.0) * phi.tan();
        (nc.max(5.14), nq.max(1.0), ng.max(0.0))
    }

    fn meyerhof_factors(phi: f64) -> (f64, f64, f64) {
        let nq = (PI * phi.tan()).exp() * (PI / 4.0 + phi / 2.0).tan().powi(2);
        let nc = (nq - 1.0) / phi.tan().max(0.001);
        let ng = (nq - 1.0) * (1.4 * phi).tan();
        (nc.max(5.14), nq.max(1.0), ng.max(0.0))
    }

    fn hansen_factors(phi: f64) -> (f64, f64, f64) {
        let nq = (PI * phi.tan()).exp() * (PI / 4.0 + phi / 2.0).tan().powi(2);
        let nc = (nq - 1.0) / phi.tan().max(0.001);
        let ng = 1.5 * (nq - 1.0) * phi.tan();
        (nc.max(5.14), nq.max(1.0), ng.max(0.0))
    }

    fn vesic_factors(phi: f64) -> (f64, f64, f64) {
        let nq = (PI * phi.tan()).exp() * (PI / 4.0 + phi / 2.0).tan().powi(2);
        let nc = (nq - 1.0) / phi.tan().max(0.001);
        let ng = 2.0 * (nq + 1.0) * phi.tan();
        (nc.max(5.14), nq.max(1.0), ng.max(0.0))
    }

    fn shape_factors(b: f64, l: f64, phi: f64, _method: BearingCapacityMethod) -> (f64, f64, f64) {
        let nq = (PI * phi.tan()).exp() * (PI / 4.0 + phi / 2.0).tan().powi(2);
        let nc = (nq - 1.0) / phi.tan().max(0.001);
        
        let sc = 1.0 + (b / l) * (nq / nc);
        let sq = 1.0 + (b / l) * phi.tan();
        let sg = 1.0 - 0.4 * (b / l);
        
        (sc, sq, sg.max(0.6))
    }

    fn depth_factors(df: f64, b: f64, phi: f64, _method: BearingCapacityMethod) -> (f64, f64, f64) {
        let k = if df / b <= 1.0 { df / b } else { (df / b).atan() };
        
        let dc = 1.0 + 0.4 * k;
        let dq = 1.0 + 2.0 * phi.tan() * (1.0 - phi.sin()).powi(2) * k;
        let dg = 1.0;
        
        (dc, dq, dg)
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_liquefaction_assessment() {
        let spt_data = vec![
            SptData { depth: 2.0, n_value: 8.0, fines_content: 10.0, ..Default::default() },
            SptData { depth: 4.0, n_value: 12.0, fines_content: 15.0, ..Default::default() },
            SptData { depth: 6.0, n_value: 18.0, fines_content: 5.0, ..Default::default() },
        ];

        let assessment = LiquefactionAssessment::from_spt(
            spt_data,
            0.3,   // PGA = 0.3g
            7.0,   // Mw = 7.0
            1.0,   // GWT at 1m
            18.0,  // kN/m³
            8.0,   // Submerged weight
        );

        assert!(!assessment.layers.is_empty());
        assert!(assessment.lpi >= 0.0);
    }

    #[test]
    fn test_mononobe_okabe() {
        let wall = RetainingWallParams {
            height: 6.0,
            gamma: 18.0,
            phi: 30.0,
            delta: 20.0,
            alpha: 0.0,
            beta: 0.0,
            cohesion: 0.0,
        };

        let mo = MononobeOkabe::new(wall, 0.1, 0.0);

        assert!(mo.kae > mo.ka);
        assert!(mo.delta_kae > 0.0);
        assert!(mo.total_active_pressure() > 0.0);
    }

    #[test]
    fn test_bearing_capacity() {
        let bc = BearingCapacity::new(
            BearingCapacityMethod::Terzaghi,
            25.0,   // c = 25 kPa
            30.0,   // phi = 30°
            18.0,   // gamma = 18 kN/m³
            2.0,    // B = 2m
            3.0,    // L = 3m
            1.5,    // Df = 1.5m
            27.0,   // q = 27 kPa
            3.0,    // FS = 3
        );

        assert!(bc.qu > 0.0);
        assert!(bc.qa > 0.0);
        assert!(bc.qu > bc.qa);
        assert!(bc.nc > 5.0);
    }
}
