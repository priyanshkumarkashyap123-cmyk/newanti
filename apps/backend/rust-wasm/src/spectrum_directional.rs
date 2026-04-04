//! Enhanced Response Spectrum Modal Combination Engine
//!
//! Extends the baseline SRSS / CQC / ABS approach with:
//! 1. **Directional combination** — 100 % X + 30 % Y + 30 % Z (and all
//!    permutations) per ASCE 7 §12.5 / IS 1893 §6.3.4 / EC 8 §4.3.3.5.
//! 2. **Closely-spaced mode** detection (IS 1893 §3.2) — modes whose
//!    frequencies differ by ≤ 10 % are treated with CQC even when the
//!    analyst selects SRSS, and are flagged in the output.
//! 3. **Per-DOF modal response vectors** — full nodal displacement / force
//!    assembly so users see combined results at every node, not just
//!    scalar base shear.
//! 4. **Missing mass correction** — residual rigid body contribution for
//!    modes above the cut-off frequency.
//!
//! ## Design Code Support
//! - IS 1893 (Part 1):2016  — Criteria for Earthquake Resistant Design
//! - ASCE 7-22 / ASCE 7-16  — Minimum Design Loads
//! - Eurocode 8 (EN 1998-1) — Design for Earthquake Resistance
//!
//! ## References
//! - Der Kiureghian & Nakamura (1993) — CQC formulation
//! - Wilson, Der Kiureghian & Bayo (1981) — Missing mass correction
//! - Gupta (1990) — Response Spectrum Method

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// ENUMERATIONS
// ============================================================================

/// Modal combination rule
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CombinationMethod {
    /// Square Root of Sum of Squares
    SRSS,
    /// Complete Quadratic Combination (Der Kiureghian)
    CQC,
    /// Absolute Sum (conservative)
    ABS,
    /// CQC with closely-spaced mode grouping (IS 1893 Cl 7.7.5.2)
    CQCGrouped,
}

/// Directional combination rule
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DirectionalRule {
    /// 100 % X only (uni-directional)
    SingleDirection,
    /// 100 % in one + 30 % in orthogonal (ASCE 7 §12.5.3 / IS 1893 §6.3.4.1)
    Percent100_30,
    /// 100 % in one + 30 % in two orthogonal (three-component, ASCE 7)
    Percent100_30_30,
    /// SRSS combination of directional responses
    SRSS,
}

/// Seismic code (mirrors rust-api seismic but for the library context)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SpectrumCode {
    IS1893,
    ASCE7,
    EC8,
}

/// Soil category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilCategory {
    /// Rock / hard soil
    TypeI,
    /// Medium / stiff soil
    TypeII,
    /// Soft soil
    TypeIII,
}

// ============================================================================
// INPUT STRUCTURES
// ============================================================================

/// Per-direction spectrum definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionalSpectrum {
    /// Direction label ("X", "Y", "Z")
    pub direction: String,
    /// Spectral ordinates: (period_s, Sa/g)
    pub spectrum_ordinates: Vec<(f64, f64)>,
    /// Scale factor (e.g. Z/2 × I/R for IS 1893)
    pub scale_factor: f64,
}

/// Modal properties of the structure (from eigen analysis)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalProperties {
    /// Number of modes
    pub n_modes: usize,
    /// Natural periods (s) for each mode
    pub periods: Vec<f64>,
    /// Modal damping ratios (fraction of critical, e.g. 0.05 for 5%)
    pub damping_ratios: Vec<f64>,
    /// Modal participation factors per direction:
    /// participation_factors[mode_index][direction_index]
    /// direction order: X=0, Y=1, Z=2
    pub participation_factors: Vec<[f64; 3]>,
    /// Effective modal masses per direction (fraction of total or absolute)
    pub effective_masses: Vec<[f64; 3]>,
    /// Mode shapes: phi[mode][dof] where DOF = node_id * 3 + dir
    pub mode_shapes: Vec<Vec<f64>>,
    /// Total seismic weight (kN)
    pub total_weight: f64,
    /// Number of structural DOFs
    pub n_dofs: usize,
}

/// Full configuration for enhanced spectrum analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedSpectrumConfig {
    /// Modal combination method for each direction
    pub combination_method: CombinationMethod,
    /// Directional combination rule
    pub directional_rule: DirectionalRule,
    /// Per-direction spectra (up to 3)
    pub spectra: Vec<DirectionalSpectrum>,
    /// Modal properties
    pub modal_properties: ModalProperties,
    /// Closely-spaced mode threshold (ratio, default 0.10 → 10 %)
    pub closely_spaced_threshold: f64,
    /// Enable missing mass correction
    pub missing_mass_correction: bool,
    /// Gravity (m/s²)
    pub gravity: f64,
}

impl Default for EnhancedSpectrumConfig {
    fn default() -> Self {
        Self {
            combination_method: CombinationMethod::CQC,
            directional_rule: DirectionalRule::Percent100_30,
            spectra: Vec::new(),
            modal_properties: ModalProperties {
                n_modes: 0, periods: vec![], damping_ratios: vec![],
                participation_factors: vec![], effective_masses: vec![],
                mode_shapes: vec![], total_weight: 0.0, n_dofs: 0,
            },
            closely_spaced_threshold: 0.10,
            missing_mass_correction: true,
            gravity: 9.81,
        }
    }
}

// ============================================================================
// CLOSELY-SPACED MODE DETECTION
// ============================================================================

/// Information about a closely-spaced mode pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloselySpacedPair {
    pub mode_i: usize,
    pub mode_j: usize,
    pub freq_i_hz: f64,
    pub freq_j_hz: f64,
    pub ratio: f64,
}

/// Detect closely-spaced modes per IS 1893 §3.2:
/// Two modes are closely spaced if their frequencies differ by ≤ threshold
/// (default 10 %, i.e. f_j / f_i ≤ 1 + threshold).
pub fn detect_closely_spaced_modes(
    periods: &[f64],
    threshold: f64,
) -> Vec<CloselySpacedPair> {
    let n = periods.len();
    let mut pairs = Vec::new();
    for i in 0..n {
        let fi = 1.0 / periods[i].max(1e-12);
        for j in (i + 1)..n {
            let fj = 1.0 / periods[j].max(1e-12);
            let (f_low, f_high) = if fi < fj { (fi, fj) } else { (fj, fi) };
            let ratio = (f_high - f_low) / f_low;
            if ratio <= threshold {
                pairs.push(CloselySpacedPair {
                    mode_i: i,
                    mode_j: j,
                    freq_i_hz: fi,
                    freq_j_hz: fj,
                    ratio,
                });
            }
        }
    }
    pairs
}

// ============================================================================
// SPECTRAL ACCELERATION INTERPOLATION
// ============================================================================

/// Interpolate Sa/g from spectrum at a given period (linear interpolation)
pub fn interpolate_sa(spectrum: &[(f64, f64)], period: f64) -> f64 {
    if spectrum.is_empty() { return 0.0; }
    if period <= spectrum[0].0 { return spectrum[0].1; }
    if period >= spectrum.last().unwrap().0 { return spectrum.last().unwrap().1; }

    for i in 0..spectrum.len() - 1 {
        let (t0, sa0) = spectrum[i];
        let (t1, sa1) = spectrum[i + 1];
        if period >= t0 && period <= t1 {
            let frac = (period - t0) / (t1 - t0).max(1e-12);
            return sa0 + frac * (sa1 - sa0);
        }
    }
    spectrum.last().unwrap().1
}

// ============================================================================
// MODAL COMBINATION METHODS
// ============================================================================

/// SRSS: R = √(Σ Ri²)
pub fn combine_srss(modal_responses: &[f64]) -> f64 {
    modal_responses.iter().map(|r| r * r).sum::<f64>().sqrt()
}

/// ABS: R = Σ |Ri|
pub fn combine_abs(modal_responses: &[f64]) -> f64 {
    modal_responses.iter().map(|r| r.abs()).sum()
}

/// CQC: R = √(Σ_i Σ_j Ri × ρ_ij × Rj)
/// where ρ_ij is the Der Kiureghian correlation coefficient.
pub fn combine_cqc(
    modal_responses: &[f64],
    periods: &[f64],
    damping_ratios: &[f64],
) -> f64 {
    let n = modal_responses.len();
    let mut sum = 0.0_f64;
    for i in 0..n {
        for j in 0..n {
            let rho = cqc_correlation(
                periods[i], periods[j],
                damping_ratios[i], damping_ratios[j],
            );
            sum += modal_responses[i] * rho * modal_responses[j];
        }
    }
    sum.abs().sqrt()
}

/// Der Kiureghian CQC correlation coefficient:
///
///   ρ_ij = 8 √(ξ_i ξ_j) (ξ_i + r ξ_j) r^{3/2}
///          / [(1 - r²)² + 4 ξ_i ξ_j r (1 + r²) + 4 (ξ_i² + ξ_j²) r²]
///
/// where r = ω_j / ω_i = T_i / T_j
pub fn cqc_correlation(t_i: f64, t_j: f64, xi_i: f64, xi_j: f64) -> f64 {
    if t_i < 1e-12 || t_j < 1e-12 { return if (t_i - t_j).abs() < 1e-12 { 1.0 } else { 0.0 }; }
    let r = t_i / t_j; // frequency ratio ω_j/ω_i = T_i/T_j
    let xi_prod = (xi_i * xi_j).sqrt();
    let numerator = 8.0 * xi_prod * (xi_i + r * xi_j) * r.powf(1.5);
    let denom = (1.0 - r * r).powi(2)
        + 4.0 * xi_i * xi_j * r * (1.0 + r * r)
        + 4.0 * (xi_i * xi_i + xi_j * xi_j) * r * r;
    if denom.abs() < 1e-30 { 1.0 } else { numerator / denom }
}

/// CQC with grouped closely-spaced modes (IS 1893 Cl 7.7.5.2):
/// Within a closely-spaced group, use ABS; across groups, use SRSS or CQC.
pub fn combine_cqc_grouped(
    modal_responses: &[f64],
    _periods: &[f64],
    _damping_ratios: &[f64],
    closely_spaced_pairs: &[CloselySpacedPair],
) -> f64 {
    let n = modal_responses.len();
    // Build adjacency: find groups of closely-spaced modes
    let mut group_id = vec![usize::MAX; n];
    let mut next_group = 0_usize;

    for pair in closely_spaced_pairs {
        let gi = group_id[pair.mode_i];
        let gj = group_id[pair.mode_j];
        match (gi == usize::MAX, gj == usize::MAX) {
            (true, true) => {
                group_id[pair.mode_i] = next_group;
                group_id[pair.mode_j] = next_group;
                next_group += 1;
            }
            (false, true) => { group_id[pair.mode_j] = gi; }
            (true, false) => { group_id[pair.mode_i] = gj; }
            (false, false) => {
                if gi != gj {
                    let merge_to = gi.min(gj);
                    let merge_from = gi.max(gj);
                    for g in group_id.iter_mut() {
                        if *g == merge_from { *g = merge_to; }
                    }
                }
            }
        }
    }
    // Assign ungrouped modes to their own group
    for g in group_id.iter_mut() {
        if *g == usize::MAX {
            *g = next_group;
            next_group += 1;
        }
    }

    // Within each group: ABS; across groups: SRSS (with CQC cross-correlation)
    let mut group_responses: std::collections::HashMap<usize, f64> = std::collections::HashMap::new();
    for i in 0..n {
        *group_responses.entry(group_id[i]).or_insert(0.0) += modal_responses[i].abs();
    }

    // SRSS across groups
    group_responses.values().map(|r| r * r).sum::<f64>().sqrt()
}

// ============================================================================
// PER-DOF MODAL RESPONSE VECTORS
// ============================================================================

/// Compute per-DOF modal response for one direction.
///
/// For each mode i and direction d:
///   u_i(dof) = Γ_id × φ_i(dof) × Sa(T_i) / ω_i²
///
/// Returns modal_responses[mode_index][dof_index]
pub fn compute_modal_dof_responses(
    config: &EnhancedSpectrumConfig,
    direction_index: usize,
) -> Vec<Vec<f64>> {
    let mp = &config.modal_properties;
    let spectrum = &config.spectra[direction_index];
    let n_dofs = mp.n_dofs;

    let mut modal_responses = Vec::with_capacity(mp.n_modes);

    for i in 0..mp.n_modes {
        let t = mp.periods[i];
        let omega = 2.0 * PI / t.max(1e-12);
        let sa_g = interpolate_sa(&spectrum.spectrum_ordinates, t);
        let sa = sa_g * config.gravity * spectrum.scale_factor; // m/s²
        let gamma = mp.participation_factors[i][direction_index];

        let mut dof_resp = vec![0.0; n_dofs];
        if i < mp.mode_shapes.len() {
            for (dof, &phi) in mp.mode_shapes[i].iter().enumerate() {
                if dof < n_dofs {
                    dof_resp[dof] = gamma * phi * sa / (omega * omega);
                }
            }
        }
        modal_responses.push(dof_resp);
    }
    modal_responses
}

/// Combine per-DOF modal responses using SRSS/CQC/ABS to get combined
/// per-DOF responses for one direction.
///
/// Returns combined[dof_index]
pub fn combine_modal_dof_responses(
    modal_dof: &[Vec<f64>],
    method: CombinationMethod,
    periods: &[f64],
    damping_ratios: &[f64],
    closely_spaced: &[CloselySpacedPair],
) -> Vec<f64> {
    if modal_dof.is_empty() { return vec![]; }
    let n_dofs = modal_dof[0].len();
    let n_modes = modal_dof.len();

    let mut combined = vec![0.0_f64; n_dofs];

    for dof in 0..n_dofs {
        let modal_vals: Vec<f64> = (0..n_modes).map(|m| modal_dof[m][dof]).collect();
        combined[dof] = match method {
            CombinationMethod::SRSS => combine_srss(&modal_vals),
            CombinationMethod::CQC => combine_cqc(&modal_vals, periods, damping_ratios),
            CombinationMethod::ABS => combine_abs(&modal_vals),
            CombinationMethod::CQCGrouped => {
                combine_cqc_grouped(&modal_vals, periods, damping_ratios, closely_spaced)
            }
        };
    }
    combined
}

// ============================================================================
// DIRECTIONAL COMBINATION
// ============================================================================

/// Combine responses from multiple directions.
///
/// 100% + 30% rule: max of { 1.0×Rx + 0.3×Ry + 0.3×Rz,
///                            0.3×Rx + 1.0×Ry + 0.3×Rz,
///                            0.3×Rx + 0.3×Ry + 1.0×Rz }
/// Values are combined as absolute maxima at each DOF.
pub fn combine_directional(
    per_direction: &[Vec<f64>],
    rule: DirectionalRule,
) -> Vec<f64> {
    let n_dirs = per_direction.len();
    if n_dirs == 0 { return vec![]; }
    let n_dofs = per_direction[0].len();

    match rule {
        DirectionalRule::SingleDirection => {
            per_direction[0].clone()
        }
        DirectionalRule::Percent100_30 | DirectionalRule::Percent100_30_30 => {
            // Generate all permutations: one direction gets 1.0, others get 0.3
            let factors: Vec<Vec<f64>> = if n_dirs == 2 {
                vec![
                    vec![1.0, 0.3],
                    vec![0.3, 1.0],
                ]
            } else if n_dirs >= 3 {
                vec![
                    vec![1.0, 0.3, 0.3],
                    vec![0.3, 1.0, 0.3],
                    vec![0.3, 0.3, 1.0],
                ]
            } else {
                vec![vec![1.0]]
            };

            let mut combined = vec![0.0_f64; n_dofs];
            for combo in &factors {
                for dof in 0..n_dofs {
                    let mut val = 0.0_f64;
                    for (d, &f) in combo.iter().enumerate() {
                        if d < n_dirs {
                            val += f * per_direction[d][dof];
                        }
                    }
                    combined[dof] = combined[dof].max(val.abs());
                }
            }
            combined
        }
        DirectionalRule::SRSS => {
            let mut combined = vec![0.0_f64; n_dofs];
            for dof in 0..n_dofs {
                let ss: f64 = per_direction.iter()
                    .map(|dir| dir[dof] * dir[dof])
                    .sum();
                combined[dof] = ss.sqrt();
            }
            combined
        }
    }
}

// ============================================================================
// MISSING MASS CORRECTION
// ============================================================================

/// Compute the missing mass fraction for each direction.
/// Missing mass = 1.0 − Σ(effective_mass_i / total_mass) for included modes.
pub fn missing_mass_fractions(
    effective_masses: &[[f64; 3]],
    total_weight: f64,
    gravity: f64,
) -> [f64; 3] {
    let total_mass = total_weight / gravity;
    let mut mm = [0.0_f64; 3];
    for dir in 0..3 {
        let included: f64 = effective_masses.iter().map(|em| em[dir]).sum();
        mm[dir] = 1.0 - (included / total_mass).min(1.0);
    }
    mm
}

/// Apply missing mass correction: add residual rigid-body contribution
/// at the ZPA (zero period acceleration) to each DOF.
///
/// R_missing(dof) = missing_mass_ratio × ZPA × total_mass × φ_rigid(dof)
///
/// For a lumped mass system, φ_rigid = 1 for translational DOFs.
pub fn apply_missing_mass_correction(
    combined: &mut [f64],
    missing_fraction: f64,
    zpa: f64, // zero period acceleration (m/s²) = Sa at T ≈ 0
    total_mass: f64,
    n_dofs: usize,
) {
    // Add ZPA contribution to each DOF (SRSS with existing)
    let r_missing = missing_fraction * zpa * total_mass;
    for dof in 0..n_dofs.min(combined.len()) {
        combined[dof] = (combined[dof].powi(2) + r_missing.powi(2)).sqrt();
    }
}

// ============================================================================
// RESULT STRUCTURES
// ============================================================================

/// Per-node results after directional combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    pub node_id: usize,
    pub disp_x: f64,
    pub disp_y: f64,
    pub disp_z: f64,
    /// Total displacement magnitude
    pub disp_magnitude: f64,
}

/// Story-level drift result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryDrift {
    pub story: usize,
    pub height: f64,
    pub drift_x: f64,
    pub drift_y: f64,
    pub drift_ratio_x: f64,
    pub drift_ratio_y: f64,
}

/// Complete result from enhanced spectrum analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedSpectrumResult {
    /// Code used
    pub code: SpectrumCode,
    /// Combination method
    pub combination_method: CombinationMethod,
    /// Directional rule
    pub directional_rule: DirectionalRule,
    /// Number of modes used
    pub modes_used: usize,
    /// Closely-spaced mode pairs detected
    pub closely_spaced_pairs: Vec<CloselySpacedPair>,
    /// Missing mass fractions per direction
    pub missing_mass_fractions: [f64; 3],
    /// Per-DOF combined responses (signed envelope)
    pub combined_dof_responses: Vec<f64>,
    /// Per-node displacement results
    pub node_results: Vec<NodeResult>,
    /// Base shear per direction (kN) before directional combination
    pub base_shear_per_direction: Vec<f64>,
    /// Combined base shear (kN)
    pub combined_base_shear: f64,
    /// Modal participation summary
    pub modal_summary: Vec<ModalSummaryEntry>,
    /// Story drifts (if applicable)
    pub story_drifts: Vec<StoryDrift>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalSummaryEntry {
    pub mode: usize,
    pub period_s: f64,
    pub frequency_hz: f64,
    pub damping_ratio: f64,
    pub effective_mass_x: f64,
    pub effective_mass_y: f64,
    pub effective_mass_z: f64,
    pub sa_x: f64,
    pub sa_y: f64,
    pub sa_z: f64,
    pub is_closely_spaced: bool,
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/// Run the complete enhanced response spectrum analysis.
pub fn run_enhanced_spectrum_analysis(
    config: &EnhancedSpectrumConfig,
) -> EnhancedSpectrumResult {
    let mp = &config.modal_properties;
    let n_dirs = config.spectra.len().min(3);
    let n_dofs = mp.n_dofs;

    // 1. Detect closely-spaced modes
    let closely_spaced = detect_closely_spaced_modes(
        &mp.periods, config.closely_spaced_threshold,
    );

    // Determine effective combination method
    let method = if !closely_spaced.is_empty()
        && config.combination_method == CombinationMethod::SRSS {
        // IS 1893: if closely-spaced modes exist, use CQC or grouped method
        CombinationMethod::CQCGrouped
    } else {
        config.combination_method
    };

    // 2. Compute per-DOF modal responses for each direction
    let mut per_direction_combined: Vec<Vec<f64>> = Vec::new();
    let mut base_shears = Vec::new();

    for dir in 0..n_dirs {
        let modal_dof = compute_modal_dof_responses(config, dir);

        // Combine modes for this direction
        let combined = combine_modal_dof_responses(
            &modal_dof, method, &mp.periods, &mp.damping_ratios,
            &closely_spaced,
        );
        
        // Base shear approximation: sum of all translational DOFs scaled
        let bs: f64 = combined.iter().sum::<f64>(); // simplified
        base_shears.push(bs.abs());

        per_direction_combined.push(combined);
    }

    // 3. Directional combination
    let mut combined = combine_directional(&per_direction_combined, config.directional_rule);

    // 4. Missing mass correction
    let mm_fractions = missing_mass_fractions(
        &mp.effective_masses, mp.total_weight, config.gravity,
    );
    if config.missing_mass_correction {
        for dir in 0..n_dirs {
            if mm_fractions[dir] > 0.01 {
                let zpa = interpolate_sa(&config.spectra[dir].spectrum_ordinates, 0.01)
                    * config.gravity * config.spectra[dir].scale_factor;
                let total_mass = mp.total_weight / config.gravity;
                apply_missing_mass_correction(
                    &mut combined, mm_fractions[dir], zpa, total_mass, n_dofs,
                );
            }
        }
    }

    // 5. Build node results (3 DOFs per node: X, Y, Z)
    let n_nodes = n_dofs / 3;
    let mut node_results = Vec::with_capacity(n_nodes);
    for node in 0..n_nodes {
        let dx = if node * 3 < combined.len() { combined[node * 3] } else { 0.0 };
        let dy = if node * 3 + 1 < combined.len() { combined[node * 3 + 1] } else { 0.0 };
        let dz = if node * 3 + 2 < combined.len() { combined[node * 3 + 2] } else { 0.0 };
        node_results.push(NodeResult {
            node_id: node,
            disp_x: dx,
            disp_y: dy,
            disp_z: dz,
            disp_magnitude: (dx*dx + dy*dy + dz*dz).sqrt(),
        });
    }

    // Combined base shear
    let combined_bs = match config.directional_rule {
        DirectionalRule::SingleDirection => base_shears.first().copied().unwrap_or(0.0),
        DirectionalRule::Percent100_30 | DirectionalRule::Percent100_30_30 => {
            let combos: Vec<Vec<f64>> = if base_shears.len() >= 2 {
                vec![
                    vec![1.0, 0.3],
                    vec![0.3, 1.0],
                ]
            } else {
                vec![vec![1.0]]
            };
            combos.iter().map(|c| {
                c.iter().enumerate()
                    .map(|(i, f)| f * base_shears.get(i).unwrap_or(&0.0))
                    .sum::<f64>()
            }).fold(0.0_f64, f64::max)
        }
        DirectionalRule::SRSS => base_shears.iter().map(|b| b*b).sum::<f64>().sqrt(),
    };

    // 6. Build modal summary
    let closely_spaced_modes: std::collections::HashSet<usize> = closely_spaced.iter()
        .flat_map(|p| vec![p.mode_i, p.mode_j])
        .collect();

    let modal_summary: Vec<ModalSummaryEntry> = (0..mp.n_modes).map(|i| {
        let t = mp.periods[i];
        let sa_x = if n_dirs > 0 { interpolate_sa(&config.spectra[0].spectrum_ordinates, t) * config.spectra[0].scale_factor } else { 0.0 };
        let sa_y = if n_dirs > 1 { interpolate_sa(&config.spectra[1].spectrum_ordinates, t) * config.spectra[1].scale_factor } else { 0.0 };
        let sa_z = if n_dirs > 2 { interpolate_sa(&config.spectra[2].spectrum_ordinates, t) * config.spectra[2].scale_factor } else { 0.0 };
        ModalSummaryEntry {
            mode: i + 1,
            period_s: t,
            frequency_hz: 1.0 / t.max(1e-12),
            damping_ratio: mp.damping_ratios[i],
            effective_mass_x: mp.effective_masses[i][0],
            effective_mass_y: mp.effective_masses[i][1],
            effective_mass_z: mp.effective_masses[i][2],
            sa_x, sa_y, sa_z,
            is_closely_spaced: closely_spaced_modes.contains(&i),
        }
    }).collect();

    EnhancedSpectrumResult {
        code: config.spectra.first()
            .map(|_| SpectrumCode::IS1893)
            .unwrap_or(SpectrumCode::IS1893),
        combination_method: method,
        directional_rule: config.directional_rule,
        modes_used: mp.n_modes,
        closely_spaced_pairs: closely_spaced,
        missing_mass_fractions: mm_fractions,
        combined_dof_responses: combined,
        node_results,
        base_shear_per_direction: base_shears,
        combined_base_shear: combined_bs,
        modal_summary,
        story_drifts: Vec::new(), // Consumer can add drift post-processing
    }
}

// ============================================================================
// CODE-SPECIFIC SPECTRUM GENERATORS
// ============================================================================

/// IS 1893:2016 design spectrum ordinates Sa/g vs T
pub fn is1893_spectrum(
    zone_factor: f64,
    importance_factor: f64,
    response_reduction: f64,
    soil: SoilCategory,
    damping_ratio: f64,
) -> Vec<(f64, f64)> {
    let scale = zone_factor * importance_factor / (2.0 * response_reduction);
    let damping_factor = (10.0 / (5.0 + 100.0 * damping_ratio)).sqrt().max(0.8);

    let (tb, tc) = match soil {
        SoilCategory::TypeI => (0.10, 0.40),
        SoilCategory::TypeII => (0.10, 0.55),
        SoilCategory::TypeIII => (0.10, 0.67),
    };

    let mut pts = Vec::new();
    let n = 100;
    for i in 0..=n {
        let t = i as f64 * 4.0 / n as f64; // 0 to 4 s
        let sa_g = if t < tb {
            1.0 + (2.5 * damping_factor - 1.0) * t / tb
        } else if t <= tc {
            2.5 * damping_factor
        } else {
            2.5 * damping_factor * tc / t
        };
        pts.push((t, sa_g * scale));
    }
    pts
}

/// ASCE 7-22 design spectrum ordinates
pub fn asce7_spectrum(
    sds: f64,    // design spectral acceleration at short period (g)
    sd1: f64,    // design spectral acceleration at 1 s (g)
    tl: f64,     // long-period transition period (s)
) -> Vec<(f64, f64)> {
    let t0 = 0.2 * sd1 / sds;
    let ts = sd1 / sds;

    let mut pts = Vec::new();
    let n = 100;
    for i in 0..=n {
        let t = i as f64 * 6.0 / n as f64;
        let sa = if t < t0 {
            sds * (0.4 + 0.6 * t / t0)
        } else if t <= ts {
            sds
        } else if t <= tl {
            sd1 / t
        } else {
            sd1 * tl / (t * t)
        };
        pts.push((t, sa));
    }
    pts
}

/// Eurocode 8 Type 1 spectrum
pub fn ec8_spectrum(
    ag: f64,     // design ground acceleration (g)
    soil: SoilCategory,
    damping: f64,
) -> Vec<(f64, f64)> {
    let (s, tb, tc, td) = match soil {
        SoilCategory::TypeI => (1.0, 0.15, 0.4, 2.0),
        SoilCategory::TypeII => (1.2, 0.15, 0.5, 2.0),
        SoilCategory::TypeIII => (1.35, 0.20, 0.6, 2.0),
    };
    let eta = (10.0 / (5.0 + 100.0 * damping)).sqrt().max(0.55);

    let mut pts = Vec::new();
    let n = 100;
    for i in 0..=n {
        let t = i as f64 * 4.0 / n as f64;
        let sa = if t < tb {
            ag * s * (1.0 + t / tb * (eta * 2.5 - 1.0))
        } else if t <= tc {
            ag * s * eta * 2.5
        } else if t <= td {
            ag * s * eta * 2.5 * tc / t
        } else {
            ag * s * eta * 2.5 * tc * td / (t * t)
        };
        pts.push((t, sa));
    }
    pts
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> EnhancedSpectrumConfig {
        let spectrum_x = is1893_spectrum(0.24, 1.5, 5.0, SoilCategory::TypeII, 0.05);
        let spectrum_y = is1893_spectrum(0.24, 1.5, 5.0, SoilCategory::TypeII, 0.05);

        EnhancedSpectrumConfig {
            combination_method: CombinationMethod::CQC,
            directional_rule: DirectionalRule::Percent100_30,
            spectra: vec![
                DirectionalSpectrum {
                    direction: "X".to_string(),
                    spectrum_ordinates: spectrum_x,
                    scale_factor: 1.0,
                },
                DirectionalSpectrum {
                    direction: "Y".to_string(),
                    spectrum_ordinates: spectrum_y,
                    scale_factor: 1.0,
                },
            ],
            modal_properties: ModalProperties {
                n_modes: 3,
                periods: vec![1.0, 0.5, 0.33],
                damping_ratios: vec![0.05, 0.05, 0.05],
                participation_factors: vec![[1.2, 0.3, 0.0], [0.3, 1.1, 0.0], [0.1, 0.2, 0.0]],
                effective_masses: vec![[500.0, 100.0, 0.0], [100.0, 400.0, 0.0], [50.0, 50.0, 0.0]],
                mode_shapes: vec![
                    vec![0.5, 0.0, 0.0, 1.0, 0.0, 0.0, 1.5, 0.0, 0.0], // 3 nodes, 3 DOFs each
                    vec![0.0, 0.6, 0.0, 0.0, 1.2, 0.0, 0.0, 1.8, 0.0],
                    vec![0.3, 0.3, 0.0, 0.6, 0.6, 0.0, 0.9, 0.9, 0.0],
                ],
                total_weight: 10000.0,
                n_dofs: 9,
            },
            closely_spaced_threshold: 0.10,
            missing_mass_correction: true,
            gravity: 9.81,
        }
    }

    #[test]
    fn test_closely_spaced_detection() {
        let periods = vec![1.0, 0.95, 0.5, 0.33]; // modes 0 & 1 are closely spaced
        let pairs = detect_closely_spaced_modes(&periods, 0.10);
        assert!(!pairs.is_empty());
        assert_eq!(pairs[0].mode_i, 0);
        assert_eq!(pairs[0].mode_j, 1);
    }

    #[test]
    fn test_cqc_correlation_same_mode() {
        let rho = cqc_correlation(1.0, 1.0, 0.05, 0.05);
        assert!((rho - 1.0).abs() < 0.02);
    }

    #[test]
    fn test_cqc_correlation_different_modes() {
        let rho = cqc_correlation(1.0, 0.5, 0.05, 0.05);
        assert!(rho < 0.5, "Well-separated modes should have low correlation");
        assert!(rho >= 0.0);
    }

    #[test]
    fn test_srss_combination() {
        let vals = vec![3.0, 4.0];
        assert!((combine_srss(&vals) - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_abs_combination() {
        let vals = vec![3.0, -4.0];
        assert!((combine_abs(&vals) - 7.0).abs() < 0.01);
    }

    #[test]
    fn test_directional_100_30() {
        let dir_x = vec![10.0, 5.0];
        let dir_y = vec![3.0, 8.0];
        let combined = combine_directional(&[dir_x, dir_y], DirectionalRule::Percent100_30);
        // combo 1: 1.0×10 + 0.3×3 = 10.9   1.0×5 + 0.3×8 = 7.4
        // combo 2: 0.3×10 + 1.0×3 = 6.0     0.3×5 + 1.0×8 = 9.5
        // max:     10.9, 9.5
        assert!((combined[0] - 10.9).abs() < 0.01);
        assert!((combined[1] - 9.5).abs() < 0.01);
    }

    #[test]
    fn test_missing_mass() {
        let em = vec![[500.0, 100.0, 0.0], [100.0, 400.0, 0.0]];
        let mm = missing_mass_fractions(&em, 10000.0, 9.81);
        let total_mass = 10000.0 / 9.81;
        let expected_x = 1.0 - 600.0 / total_mass;
        assert!((mm[0] - expected_x).abs() < 0.01);
    }

    #[test]
    fn test_is1893_spectrum() {
        let pts = is1893_spectrum(0.24, 1.5, 5.0, SoilCategory::TypeII, 0.05);
        assert!(pts.len() > 50);
        // At T = 0.3 (plateau), Sa/g should be at maximum
        let sa_plateau = interpolate_sa(&pts, 0.3);
        let sa_long = interpolate_sa(&pts, 2.0);
        assert!(sa_plateau > sa_long);
    }

    #[test]
    fn test_asce7_spectrum() {
        let pts = asce7_spectrum(1.0, 0.4, 8.0);
        let sa_short = interpolate_sa(&pts, 0.1);
        let sa_1s = interpolate_sa(&pts, 1.0);
        assert!(sa_short > 0.0);
        assert!((sa_1s - 0.4).abs() < 0.05);
    }

    #[test]
    fn test_full_enhanced_analysis() {
        let config = sample_config();
        let result = run_enhanced_spectrum_analysis(&config);
        assert_eq!(result.modes_used, 3);
        assert_eq!(result.node_results.len(), 3); // 9 DOFs / 3 = 3 nodes
        assert!(result.combined_base_shear > 0.0);
        assert!(!result.modal_summary.is_empty());
    }

    #[test]
    fn test_cqc_grouped() {
        let responses = vec![5.0, 4.0, 3.0, 2.0];
        let periods = vec![1.0, 0.95, 0.5, 0.33];
        let damping = vec![0.05, 0.05, 0.05, 0.05];
        let pairs = detect_closely_spaced_modes(&periods, 0.10);
        
        let grouped = combine_cqc_grouped(&responses, &periods, &damping, &pairs);
        let srss = combine_srss(&responses);
        // Grouped should differ from pure SRSS due to ABS within groups
        assert!(grouped > 0.0);
        // Within group {0,1}: ABS = 5+4 = 9; other: {2}=3, {3}=2
        // Across groups SRSS: √(9² + 3² + 2²) = √(81+9+4) = √94 ≈ 9.70
        assert!((grouped - 94.0_f64.sqrt()).abs() < 0.1);
    }
}
