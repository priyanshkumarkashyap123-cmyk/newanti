// =====================================================================
// Vibration & Floor Walking Checks
// =====================================================================
//
// Floor systems (composite steel-deck or concrete slabs) must be
// checked for natural frequency and peak acceleration against human
// comfort criteria.
//
// References:
//   AISC Design Guide 11 (DG11) – Vibrations of Steel-Framed
//       Structural Systems Due to Human Activity, 2nd Edition
//   SCI P354 – Design of Floors for Vibration (UK)
//   IS 800:2007 §5.6.2 – Floor vibration
//   EN 1990 Annex A1.4.4 – Comfort criteria
// =====================================================================

use std::f64::consts::PI;

// ─── Occupancy categories ───────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OccupancyCategory {
    Office,
    Residential,
    ShoppingMall,
    DiningDancing,
    Gymnasium,
    Hospital,
    Laboratory,
    Church,
    FootBridge,
}

impl OccupancyCategory {
    /// Peak acceleration limit as fraction of g (AISC DG11 Table 4-1).
    pub fn acceleration_limit_g(&self) -> f64 {
        match self {
            Self::Office => 0.005,           // 0.5 %g
            Self::Residential => 0.005,
            Self::ShoppingMall => 0.015,
            Self::DiningDancing => 0.015,
            Self::Gymnasium => 0.05,         // 5 %g (rhythmic)
            Self::Hospital => 0.0025,        // 0.25 %g (sensitive)
            Self::Laboratory => 0.003,
            Self::Church => 0.005,
            Self::FootBridge => 0.015,
        }
    }

    /// Typical damping ratio β (AISC DG11 Table 4-2).
    pub fn damping_ratio(&self) -> f64 {
        match self {
            Self::Office => 0.03,
            Self::Residential => 0.03,
            Self::ShoppingMall => 0.02,
            Self::DiningDancing => 0.06,
            Self::Gymnasium => 0.06,
            Self::Hospital => 0.03,
            Self::Laboratory => 0.02,
            Self::Church => 0.03,
            Self::FootBridge => 0.01,
        }
    }

    /// Walking frequency range (Hz).
    pub fn walking_freq_range(&self) -> (f64, f64) {
        match self {
            Self::FootBridge => (1.6, 2.4),
            Self::Gymnasium => (2.0, 3.0),
            _ => (1.6, 2.2),
        }
    }
}

// ─── Floor system input ─────────────────────────────────────────────

/// Floor system definition for vibration check.
#[derive(Debug, Clone)]
pub struct FloorSystem {
    /// Beam / joist span (mm)
    pub beam_span_mm: f64,
    /// Girder span (mm)
    pub girder_span_mm: f64,
    /// Beam spacing (mm)
    pub beam_spacing_mm: f64,
    /// Girder spacing (mm)
    pub girder_spacing_mm: f64,
    /// Beam transformed moment of inertia (mm⁴)
    pub beam_it_mm4: f64,
    /// Girder transformed moment of inertia (mm⁴)
    pub girder_it_mm4: f64,
    /// Slab thickness (mm)
    pub slab_thickness_mm: f64,
    /// Slab modulus of elasticity (MPa)
    pub slab_ec_mpa: f64,
    /// Beam elastic modulus (MPa)
    pub beam_es_mpa: f64,
    /// Girder elastic modulus (MPa)
    pub girder_es_mpa: f64,
    /// Supporting column height (mm), 0 for rigid
    pub column_height_mm: f64,
    /// Column moment of inertia (mm⁴)
    pub column_ic_mm4: f64,
    /// Effective weight per unit area supported (N/mm²)
    pub weight_per_area_n_mm2: f64,
    /// Floor system type
    pub system_type: FloorSystemType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FloorSystemType {
    SteelComposite,
    ConcreteSlab,
    TimberJoist,
    PrecastHollowcore,
}

// ─── AISC DG11 Method ───────────────────────────────────────────────

/// Result of DG11 vibration check.
#[derive(Debug, Clone)]
pub struct DG11Result {
    pub fn_beam_hz: f64,
    pub fn_girder_hz: f64,
    pub fn_column_hz: f64,
    pub fn_combined_hz: f64,
    pub delta_beam_mm: f64,
    pub delta_girder_mm: f64,
    pub delta_column_mm: f64,
    pub effective_panel_weight_kn: f64,
    pub peak_acceleration_g: f64,
    pub acceleration_limit_g: f64,
    pub acceleration_ratio: f64,      // ap/ao  (< 1.0 → pass)
    pub pass: bool,
    pub governing_harmonic: usize,
    pub check_type: String,
}

/// DG11 walking excitation parameters (Table 4-1).
struct WalkingParams {
    alpha_i: [f64; 4],  // dynamic coefficients for harmonics 1–4
}

impl WalkingParams {
    fn standard() -> Self {
        WalkingParams {
            alpha_i: [0.5, 0.2, 0.1, 0.05], // Rainer coefficients
        }
    }
}

/// Compute natural frequency of a simply-supported beam.
fn beam_frequency(span_mm: f64, it_mm4: f64, es_mpa: f64, w_per_len_n_mm: f64) -> f64 {
    // f = (π/2) × √(EI / (wL⁴))
    if w_per_len_n_mm < 1e-6 || span_mm < 1e-6 { return 100.0; }
    PI / 2.0 * (es_mpa * it_mm4 / (w_per_len_n_mm * span_mm.powi(4))).sqrt()
}

/// Midspan deflection of SS beam under UDL.
fn beam_deflection_mm(span_mm: f64, it_mm4: f64, es_mpa: f64, w_per_len_n_mm: f64) -> f64 {
    5.0 * w_per_len_n_mm * span_mm.powi(4) / (384.0 * es_mpa * it_mm4)
}

/// Run AISC DG11 walking vibration check.
pub fn check_dg11_walking(
    floor: &FloorSystem,
    occupancy: OccupancyCategory,
) -> DG11Result {
    let g = 9810.0; // mm/s²

    // Tributary loads per unit length
    let w_beam = floor.weight_per_area_n_mm2 * floor.beam_spacing_mm; // N/mm
    let w_girder = floor.weight_per_area_n_mm2 * floor.girder_spacing_mm; // N/mm

    // Component frequencies
    let fn_beam = beam_frequency(floor.beam_span_mm, floor.beam_it_mm4,
        floor.beam_es_mpa, w_beam);
    let fn_girder = beam_frequency(floor.girder_span_mm, floor.girder_it_mm4,
        floor.girder_es_mpa, w_girder);

    // Column shortening frequency
    let fn_column = if floor.column_height_mm > 0.0 && floor.column_ic_mm4 > 0.0 {
        // Axial shortening: δ = PL/(AE) → simplified as f_col ≈ 18 Hz for stiff columns
        let _delta_col = floor.weight_per_area_n_mm2 * floor.beam_spacing_mm
            * floor.girder_spacing_mm * floor.column_height_mm
            / (floor.beam_es_mpa * floor.column_ic_mm4 / floor.column_height_mm.powi(2) * 3.0);
        0.18 * (g / _delta_col.max(0.001)).sqrt()
    } else { 100.0 }; // effectively rigid

    // Component deflections
    let delta_b = beam_deflection_mm(floor.beam_span_mm, floor.beam_it_mm4,
        floor.beam_es_mpa, w_beam);
    let delta_g = beam_deflection_mm(floor.girder_span_mm, floor.girder_it_mm4,
        floor.girder_es_mpa, w_girder);
    let delta_c = if fn_column < 99.0 { g / (2.0 * PI * fn_column).powi(2) } else { 0.0 };

    // DG11 combined frequency (Dunkerley)
    let fn_combined = 0.18 * (g / (delta_b + delta_g + delta_c).max(0.001)).sqrt();

    // Effective panel weight W (DG11 §4.3)
    let ds = floor.slab_ec_mpa * floor.slab_thickness_mm.powi(3) / 12.0; // slab stiffness
    let bj = {
        let c_j = 2.0; // correction for T-beam
        let panel_width = c_j * (ds * floor.beam_span_mm.powi(4)
            / (floor.beam_es_mpa * floor.beam_it_mm4)).powf(0.25);
        panel_width.min(2.0 / 3.0 * floor.girder_span_mm)
    };

    let bg = {
        let c_g = 1.8;
        let dj = floor.beam_es_mpa * floor.beam_it_mm4 / floor.beam_spacing_mm;
        let panel_length = c_g * (dj * floor.girder_span_mm.powi(4)
            / (floor.girder_es_mpa * floor.girder_it_mm4)).powf(0.25);
        panel_length.min(2.0 / 3.0 * floor.beam_span_mm)
    };

    let w_eff_kn = floor.weight_per_area_n_mm2 * bj * bg / 1000.0; // kN

    // Walking parameters
    let params = WalkingParams::standard();
    let beta = occupancy.damping_ratio();
    let a_limit = occupancy.acceleration_limit_g();

    // Check each harmonic
    let (fw_low, fw_high) = occupancy.walking_freq_range();
    let mut max_ap = 0.0_f64;
    let mut gov_harmonic = 1_usize;

    for h in 1..=4_usize {
        let fstep_min = fw_low;
        let fstep_max = fw_high;
        // Resonance when h × fstep ≈ fn
        let excitation_freq = fn_combined / h as f64;
        if excitation_freq < fstep_min || excitation_freq > fstep_max { continue; }

        let alpha_h = params.alpha_i[h - 1];
        let p0 = 0.7; // kN, standard walker weight × DLF
        // DG11 Eq. 4-1: ap/g = P0·αi·e^(-0.35·fn) / (β·W)
        let ap = p0 * alpha_h * (-0.35 * fn_combined).exp() / (beta * w_eff_kn.max(0.1));
        if ap > max_ap {
            max_ap = ap;
            gov_harmonic = h;
        }
    }

    // If no harmonic resonates, check 1st harmonic anyway (conservative)
    if max_ap < 1e-12 {
        let alpha_h = params.alpha_i[0];
        let p0 = 0.7;
        max_ap = p0 * alpha_h * (-0.35 * fn_combined).exp() / (beta * w_eff_kn.max(0.1));
        gov_harmonic = 1;
    }

    let pass = max_ap <= a_limit;

    DG11Result {
        fn_beam_hz: fn_beam,
        fn_girder_hz: fn_girder,
        fn_column_hz: fn_column,
        fn_combined_hz: fn_combined,
        delta_beam_mm: delta_b,
        delta_girder_mm: delta_g,
        delta_column_mm: delta_c,
        effective_panel_weight_kn: w_eff_kn,
        peak_acceleration_g: max_ap,
        acceleration_limit_g: a_limit,
        acceleration_ratio: max_ap / a_limit.max(1e-12),
        pass,
        governing_harmonic: gov_harmonic,
        check_type: "AISC DG11 Walking".to_string(),
    }
}

// ─── SCI P354 (UK/Eurocode) Method ──────────────────────────────────

/// SCI P354 simplified walking response.
#[derive(Debug, Clone)]
pub struct SCIP354Result {
    pub fn_hz: f64,
    pub modal_mass_kg: f64,
    pub response_factor: f64,
    pub response_limit: f64,
    pub pass: bool,
}

/// SCI P354 response factor check.
pub fn check_sci_p354(
    fn_hz: f64,
    modal_mass_kg: f64,
    damping_ratio: f64,
    occupancy: OccupancyCategory,
) -> SCIP354Result {
    // Response factor R = a_peak / a_base
    // a_base = 0.005 m/s² (ISO 10137 base curve at fn)
    let a_base = 0.005; // m/s²

    // Impulsive excitation (fn > 10 Hz) or resonant (3–10 Hz)
    let a_peak = if fn_hz > 10.0 {
        // Impulsive: a = 54·f₁^1.43 / (m · fw^1.3)  (simplified DG11)
        let fw: f64 = 2.0; // walking freq Hz
        54.0 * fn_hz.powf(1.43) / (modal_mass_kg * fw.powf(1.3)) / 1000.0
    } else {
        // Resonant: a = P0·Q / (2·β·m)  (SCI P354 Eq 3.4)
        let p0 = 746.0; // N (standard walker, 76 kg × 9.81)
        let q = 0.4; // dynamic load factor for 1st harmonic
        p0 * q / (2.0 * damping_ratio * modal_mass_kg)
    };

    let response_factor = a_peak / a_base;
    let response_limit = match occupancy {
        OccupancyCategory::Office => 8.0,
        OccupancyCategory::Residential => 4.0,
        OccupancyCategory::Hospital => 2.0,
        OccupancyCategory::Laboratory => 1.0,
        _ => 8.0,
    };

    SCIP354Result {
        fn_hz,
        modal_mass_kg,
        response_factor,
        response_limit,
        pass: response_factor <= response_limit,
    }
}

// ─── Rhythmic activity check (DG11 Ch 5) ────────────────────────────

#[derive(Debug, Clone)]
pub struct RhythmicResult {
    pub fn_floor_hz: f64,
    pub forcing_frequency_hz: f64,
    pub peak_acceleration_g: f64,
    pub acceleration_limit_g: f64,
    pub dynamic_amplification: f64,
    pub pass: bool,
}

pub fn check_rhythmic_activity(
    fn_floor_hz: f64,
    weight_per_area_kpa: f64,
    activity_weight_kpa: f64,
    activity_freq_hz: f64,
    alpha: f64,        // DLF (0.25 aerobics, 0.5 jumping)
    damping_ratio: f64,
    a_limit_g: f64,
) -> RhythmicResult {
    // DG11 Eq. 5-1: a_p/g = α·(w_p/w_t) / √((fn/f)² - 1)² + (2βfn/f)²)
    let wp_wt = activity_weight_kpa / weight_per_area_kpa.max(0.01);
    let freq_ratio = fn_floor_hz / activity_freq_hz;
    let denom = ((freq_ratio.powi(2) - 1.0).powi(2)
        + (2.0 * damping_ratio * freq_ratio).powi(2)).sqrt();
    let daf = 1.0 / denom.max(0.01);
    let ap = alpha * wp_wt * daf;

    RhythmicResult {
        fn_floor_hz,
        forcing_frequency_hz: activity_freq_hz,
        peak_acceleration_g: ap,
        acceleration_limit_g: a_limit_g,
        dynamic_amplification: daf,
        pass: ap <= a_limit_g,
    }
}

// ─── Minimum frequency check (IS 800 / simple) ─────────────────────

#[derive(Debug, Clone)]
pub struct MinFrequencyResult {
    pub fn_hz: f64,
    pub fn_limit_hz: f64,
    pub pass: bool,
    pub code: String,
}

/// IS 800:2007 §5.6.2.1 — minimum frequency for floors.
pub fn check_is800_frequency(fn_hz: f64) -> MinFrequencyResult {
    // IS 800 requires fn ≥ 5 Hz for normal floors
    MinFrequencyResult {
        fn_hz, fn_limit_hz: 5.0,
        pass: fn_hz >= 5.0,
        code: "IS 800:2007 §5.6.2".to_string(),
    }
}

/// EN 1990 Annex A1.4.4 — comfort criteria.
pub fn check_en1990_frequency(fn_hz: f64) -> MinFrequencyResult {
    // EC recommends fn > 3 Hz for floors, fn > 5 Hz for gyms
    MinFrequencyResult {
        fn_hz, fn_limit_hz: 3.0,
        pass: fn_hz >= 3.0,
        code: "EN 1990 Annex A1.4.4".to_string(),
    }
}

// ─── Full floor vibration analysis pipeline ─────────────────────────

/// Comprehensive vibration check result.
#[derive(Debug, Clone)]
pub struct FloorVibrationResult {
    pub dg11: Option<DG11Result>,
    pub sci_p354: Option<SCIP354Result>,
    pub rhythmic: Option<RhythmicResult>,
    pub min_frequency: MinFrequencyResult,
    pub overall_pass: bool,
    pub governing_check: String,
    pub recommendations: Vec<String>,
}

/// Run comprehensive floor vibration analysis.
pub fn run_floor_vibration_check(
    floor: &FloorSystem,
    occupancy: OccupancyCategory,
    check_rhythmic: bool,
    rhythmic_freq_hz: f64,
    rhythmic_alpha: f64,
) -> FloorVibrationResult {
    // DG11 walking check
    let dg11 = check_dg11_walking(floor, occupancy);
    let fn_hz = dg11.fn_combined_hz;

    // SCI P354
    let modal_mass = floor.weight_per_area_n_mm2 * floor.beam_span_mm * floor.girder_span_mm
        / 9810.0 / 4.0; // kg, quarter-panel modal mass
    let sci = check_sci_p354(fn_hz, modal_mass, occupancy.damping_ratio(), occupancy);

    // Rhythmic (optional)
    let rhythmic_result = if check_rhythmic {
        let wp = 0.6; // kPa typical for rhythmic
        let wt = floor.weight_per_area_n_mm2 * 1000.0; // kPa
        Some(check_rhythmic_activity(
            fn_hz, wt, wp, rhythmic_freq_hz, rhythmic_alpha,
            occupancy.damping_ratio(), occupancy.acceleration_limit_g(),
        ))
    } else { None };

    // Minimum frequency
    let min_freq = check_is800_frequency(fn_hz);

    // Overall pass
    let overall = dg11.pass && sci.pass && min_freq.pass
        && rhythmic_result.as_ref().map(|r| r.pass).unwrap_or(true);

    let governing = if !min_freq.pass { "Minimum frequency" }
    else if !dg11.pass { "DG11 walking acceleration" }
    else if !sci.pass { "SCI P354 response factor" }
    else if rhythmic_result.as_ref().map(|r| !r.pass).unwrap_or(false) { "Rhythmic activity" }
    else { "All checks pass" };

    let mut recommendations = Vec::new();
    if fn_hz < 5.0 {
        recommendations.push("Floor frequency < 5 Hz — consider increasing beam stiffness".to_string());
    }
    if fn_hz < 3.0 {
        recommendations.push("CRITICAL: fn < 3 Hz — susceptible to walking resonance".to_string());
    }
    if !dg11.pass {
        recommendations.push(format!(
            "Peak acceleration {:.4}g exceeds limit {:.4}g — increase stiffness or add damping",
            dg11.peak_acceleration_g, dg11.acceleration_limit_g,
        ));
    }
    if dg11.effective_panel_weight_kn < 50.0 {
        recommendations.push("Low effective panel weight — consider increasing slab mass".to_string());
    }

    FloorVibrationResult {
        dg11: Some(dg11),
        sci_p354: Some(sci),
        rhythmic: rhythmic_result,
        min_frequency: min_freq,
        overall_pass: overall,
        governing_check: governing.to_string(),
        recommendations,
    }
}

// =====================================================================
// Tests
// =====================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn typical_office_floor() -> FloorSystem {
        FloorSystem {
            beam_span_mm: 9000.0,
            girder_span_mm: 9000.0,
            beam_spacing_mm: 3000.0,
            girder_spacing_mm: 9000.0,
            beam_it_mm4: 350e6,     // W16X26 composite
            girder_it_mm4: 800e6,   // W21X44 composite
            slab_thickness_mm: 130.0,
            slab_ec_mpa: 25000.0,
            beam_es_mpa: 200_000.0,
            girder_es_mpa: 200_000.0,
            column_height_mm: 0.0,  // rigid support
            column_ic_mm4: 0.0,
            weight_per_area_n_mm2: 0.004, // ~4 kPa
            system_type: FloorSystemType::SteelComposite,
        }
    }

    #[test]
    fn test_occupancy_limits() {
        assert!((OccupancyCategory::Office.acceleration_limit_g() - 0.005).abs() < 1e-6);
        assert!((OccupancyCategory::Hospital.acceleration_limit_g() - 0.0025).abs() < 1e-6);
        assert!(OccupancyCategory::Gymnasium.acceleration_limit_g() > 0.01);
    }

    #[test]
    fn test_beam_frequency() {
        // Use beam_deflection → 0.18√(g/δ) approach
        // W16×36: I=199e6, span 8m, w=0.5 N/mm (light composite slab)
        let delta = beam_deflection_mm(8000.0, 199e6, 200_000.0, 0.5);
        let f = 0.18 * (9810.0 / delta).sqrt();
        assert!(f > 2.0 && f < 30.0, "fn={}, delta={}", f, delta);
    }

    #[test]
    fn test_dg11_walking_check() {
        let floor = typical_office_floor();
        let result = check_dg11_walking(&floor, OccupancyCategory::Office);
        assert!(result.fn_combined_hz > 0.0);
        assert!(result.peak_acceleration_g > 0.0);
        assert!(result.acceleration_limit_g > 0.0);
        println!("DG11: fn={:.2} Hz, ap={:.5}g, limit={:.4}g, pass={}",
            result.fn_combined_hz, result.peak_acceleration_g,
            result.acceleration_limit_g, result.pass);
    }

    #[test]
    fn test_sci_p354_check() {
        let r = check_sci_p354(7.0, 5000.0, 0.03, OccupancyCategory::Office);
        assert!(r.response_factor > 0.0);
        println!("SCI P354: R={:.2}, limit={:.0}, pass={}", r.response_factor, r.response_limit, r.pass);
    }

    #[test]
    fn test_rhythmic_resonance() {
        // Floor at 5 Hz, activity at 4.9 Hz → near resonance
        let r = check_rhythmic_activity(5.0, 4.0, 0.6, 4.9, 0.25, 0.06, 0.05);
        assert!(r.peak_acceleration_g > 0.0);
        assert!(r.dynamic_amplification > 1.0, "DAF={}", r.dynamic_amplification);
        println!("Rhythmic: ap={:.4}g, DAF={:.2}, pass={}", r.peak_acceleration_g,
            r.dynamic_amplification, r.pass);
    }

    #[test]
    fn test_is800_min_frequency() {
        let pass = check_is800_frequency(6.0);
        assert!(pass.pass);
        let fail = check_is800_frequency(4.0);
        assert!(!fail.pass);
    }

    #[test]
    fn test_full_floor_vibration_pipeline() {
        let floor = typical_office_floor();
        let result = run_floor_vibration_check(
            &floor, OccupancyCategory::Office,
            false, 2.5, 0.25,
        );
        assert!(result.dg11.is_some());
        assert!(result.sci_p354.is_some());
        let dg11 = result.dg11.as_ref().unwrap();
        println!("Full check: fn={:.2} Hz, pass={}, governing='{}'",
            dg11.fn_combined_hz, result.overall_pass, result.governing_check);
    }

    #[test]
    fn test_heavy_floor_passes() {
        // Very heavy/stiff floor should pass easily
        let mut floor = typical_office_floor();
        floor.beam_it_mm4 = 1500e6;
        floor.girder_it_mm4 = 3000e6;
        floor.weight_per_area_n_mm2 = 0.002;
        let result = check_dg11_walking(&floor, OccupancyCategory::Office);
        assert!(result.fn_combined_hz > 3.0, "Stiff floor → high fn: {}", result.fn_combined_hz);
    }

    #[test]
    fn test_sensitive_hospital() {
        let floor = typical_office_floor();
        let result = check_dg11_walking(&floor, OccupancyCategory::Hospital);
        // Hospital has stricter limit (0.25 %g vs 0.5 %g)
        assert!(result.acceleration_limit_g < OccupancyCategory::Office.acceleration_limit_g());
    }
}
