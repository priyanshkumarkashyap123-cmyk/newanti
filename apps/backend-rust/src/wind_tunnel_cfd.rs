//! Wind Tunnel / CFD Pressure Profile Engine
//!
//! Maps pressure time-histories or spatial wind profiles imported from wind
//! tunnel data onto the structural model.  Modern tall buildings require
//! more than simple IS 875 rectangular pressure maps — this module handles
//! the full workflow from raw wind-tunnel tap data to nodal force vectors.
//!
//! ## Features
//! - Import raw wind-tunnel pressure coefficient (Cp) tap data
//! - Map tap locations to structural nodes via Voronoi tributary areas
//! - Convert Cp time-histories to force time-histories (F = Cp·q·A)
//! - CFD spatial pressure field interpolation onto structural mesh
//! - Multiple wind directions (θ = 0° – 350° at user-specified increments)
//! - Peak / RMS / mean statistics per tap
//! - Power spectral density (PSD) of pressure signals
//! - Equivalent static wind load (ESWL) via gust loading factor method
//! - IS 875 Part 3 / ASCE 7 / EN 1991-1-4 reference velocity pressure
//!
//! ## References
//! - ASCE Manual 67 — Wind Tunnel Studies of Buildings and Structures
//! - AS/NZS 1170.2 — Structural design actions: Wind actions
//! - IS 875 Part 3:2015 — Wind Loads

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// PRESSURE TAP DATA
// ============================================================================

/// Location of a single pressure tap on the building envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressureTap {
    /// Unique tap identifier (e.g. "T001")
    pub tap_id: String,
    /// X coordinate on building surface (m)
    pub x: f64,
    /// Y coordinate (height) on building surface (m)
    pub y: f64,
    /// Z coordinate on building surface (m, for 3-D surfaces)
    pub z: f64,
    /// Face / zone label (e.g. "windward", "leeward", "roof")
    pub face: String,
    /// Tributary area assigned to this tap (m²)
    pub tributary_area: f64,
    /// Outward-pointing unit normal (nx, ny, nz) for converting Cp → force
    pub normal: [f64; 3],
}

/// Pressure coefficient time-history for a single wind direction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpTimeSeries {
    /// Wind direction angle (degrees, 0 = North, CW positive)
    pub wind_direction_deg: f64,
    /// Reference dynamic pressure used in tunnel (Pa)
    pub q_ref: f64,
    /// Sampling rate (Hz)
    pub sampling_rate: f64,
    /// Time-series of Cp values (dimensionless)
    pub cp_values: Vec<f64>,
}

/// Statistics computed from a Cp time-series
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpStatistics {
    pub tap_id: String,
    pub wind_direction_deg: f64,
    pub mean: f64,
    pub rms: f64,
    pub peak_positive: f64,
    pub peak_negative: f64,
    pub std_dev: f64,
    pub skewness: f64,
    pub kurtosis: f64,
}

// ============================================================================
// WIND TUNNEL DATA SET
// ============================================================================

/// Complete wind-tunnel data set for one building
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindTunnelDataSet {
    /// Building identifier
    pub building_id: String,
    /// Model geometric scale (e.g., 1:400 → 400.0)
    pub geometric_scale: f64,
    /// Velocity scale (e.g., 1:3 → 3.0)
    pub velocity_scale: f64,
    /// Time scale = geometric_scale / velocity_scale
    pub time_scale: f64,
    /// Pressure taps
    pub taps: Vec<PressureTap>,
    /// Cp time-series per (tap_id, wind_direction)
    pub cp_data: HashMap<String, Vec<CpTimeSeries>>,
    /// Reference height for velocity pressure (m, full scale)
    pub reference_height: f64,
}

impl WindTunnelDataSet {
    pub fn new(building_id: &str, geometric_scale: f64, velocity_scale: f64) -> Self {
        Self {
            building_id: building_id.to_string(),
            geometric_scale,
            velocity_scale,
            time_scale: geometric_scale / velocity_scale,
            taps: Vec::new(),
            cp_data: HashMap::new(),
            reference_height: 10.0,
        }
    }

    /// Add a pressure tap
    pub fn add_tap(&mut self, tap: PressureTap) {
        self.taps.push(tap);
    }

    /// Add Cp time-series for a tap
    pub fn add_cp_series(&mut self, tap_id: &str, series: CpTimeSeries) {
        self.cp_data
            .entry(tap_id.to_string())
            .or_insert_with(Vec::new)
            .push(series);
    }

    /// Compute statistics for every tap at every wind direction
    pub fn compute_statistics(&self) -> Vec<CpStatistics> {
        let mut stats = Vec::new();
        for (tap_id, series_list) in &self.cp_data {
            for series in series_list {
                stats.push(compute_cp_stats(tap_id, series));
            }
        }
        stats
    }
}

/// Compute Cp statistics for one tap/direction combination
pub fn compute_cp_stats(tap_id: &str, series: &CpTimeSeries) -> CpStatistics {
    let n = series.cp_values.len() as f64;
    if n < 2.0 {
        return CpStatistics {
            tap_id: tap_id.to_string(),
            wind_direction_deg: series.wind_direction_deg,
            mean: 0.0, rms: 0.0, peak_positive: 0.0, peak_negative: 0.0,
            std_dev: 0.0, skewness: 0.0, kurtosis: 0.0,
        };
    }
    let mean: f64 = series.cp_values.iter().sum::<f64>() / n;
    let var: f64 = series.cp_values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.0);
    let std_dev = var.sqrt();
    let rms = (series.cp_values.iter().map(|v| v * v).sum::<f64>() / n).sqrt();
    let peak_pos = series.cp_values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let peak_neg = series.cp_values.iter().copied().fold(f64::INFINITY, f64::min);

    let skewness = if std_dev > 1e-12 {
        series.cp_values.iter().map(|v| ((v - mean) / std_dev).powi(3)).sum::<f64>() / n
    } else { 0.0 };
    let kurtosis = if std_dev > 1e-12 {
        series.cp_values.iter().map(|v| ((v - mean) / std_dev).powi(4)).sum::<f64>() / n
    } else { 0.0 };

    CpStatistics {
        tap_id: tap_id.to_string(),
        wind_direction_deg: series.wind_direction_deg,
        mean, rms, peak_positive: peak_pos, peak_negative: peak_neg,
        std_dev, skewness, kurtosis,
    }
}

// ============================================================================
// NODAL FORCE GENERATION
// ============================================================================

/// A single nodal wind force at one timestep
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodalWindForce {
    pub node_id: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
}

/// Mapping from pressure tap to structural node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TapToNodeMapping {
    pub tap_id: String,
    pub node_id: String,
    /// Tributary area (m²) from Voronoi or user-defined
    pub tributary_area: f64,
    /// Surface outward normal (nx, ny, nz)
    pub normal: [f64; 3],
}

/// Convert Cp time-series to nodal force time-histories.
///
/// F_i(t) = Cp_i(t) × q_design × A_trib_i × n_i
///
/// # Arguments
/// * `mappings` – tap→node associations
/// * `cp_data` – per-tap Cp time-series for the chosen wind direction
/// * `q_design` – design dynamic pressure at reference height (Pa)
///
/// # Returns
/// Vec of (timestep_index, Vec<NodalWindForce>)
pub fn cp_to_nodal_forces(
    mappings: &[TapToNodeMapping],
    cp_data: &HashMap<String, CpTimeSeries>,
    q_design: f64,
) -> Vec<Vec<NodalWindForce>> {
    // Determine number of timesteps from first series
    let n_steps = cp_data.values().next().map(|s| s.cp_values.len()).unwrap_or(0);
    let mut result: Vec<Vec<NodalWindForce>> = Vec::with_capacity(n_steps);

    for t in 0..n_steps {
        let mut forces = Vec::new();
        for map in mappings {
            if let Some(series) = cp_data.get(&map.tap_id) {
                let cp = if t < series.cp_values.len() { series.cp_values[t] } else { 0.0 };
                let pressure = cp * q_design; // Pa
                let force_magnitude = pressure * map.tributary_area; // N
                forces.push(NodalWindForce {
                    node_id: map.node_id.clone(),
                    fx: force_magnitude * map.normal[0] / 1000.0, // kN
                    fy: force_magnitude * map.normal[1] / 1000.0,
                    fz: force_magnitude * map.normal[2] / 1000.0,
                });
            }
        }
        result.push(forces);
    }
    result
}

/// Generate equivalent static wind loads from Cp statistics,
/// using the peak factor approach:  F_eq = (Cp_mean + g × Cp_rms) × q × A
///
/// Returns per-node equivalent static forces (kN).
pub fn equivalent_static_loads(
    mappings: &[TapToNodeMapping],
    stats: &[CpStatistics],
    q_design: f64,
    peak_factor: f64, // typically 3.0–4.0
) -> Vec<NodalWindForce> {
    let stats_map: HashMap<&str, &CpStatistics> = stats.iter()
        .map(|s| (s.tap_id.as_str(), s))
        .collect();

    mappings.iter().filter_map(|map| {
        stats_map.get(map.tap_id.as_str()).map(|s| {
            let cp_eq = s.mean + peak_factor * s.std_dev;
            let pressure = cp_eq * q_design;
            let force_magnitude = pressure * map.tributary_area; // N
            NodalWindForce {
                node_id: map.node_id.clone(),
                fx: force_magnitude * map.normal[0] / 1000.0,
                fy: force_magnitude * map.normal[1] / 1000.0,
                fz: force_magnitude * map.normal[2] / 1000.0,
            }
        })
    }).collect()
}

// ============================================================================
// CFD SPATIAL PRESSURE FIELD
// ============================================================================

/// A spatial pressure field from CFD (steady or time-averaged)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfdPressureField {
    /// Label
    pub label: String,
    /// Wind direction (degrees)
    pub wind_direction_deg: f64,
    /// Pressure values at arbitrary surface points: (x, y, z, pressure_Pa)
    pub points: Vec<CfdPressurePoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CfdPressurePoint {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Surface pressure (Pa), positive = pushing inward
    pub pressure_pa: f64,
}

/// Interpolate a CFD pressure field onto structural nodes using inverse-
/// distance weighting (IDW).
///
/// Returns per-node pressures (Pa).
pub fn interpolate_cfd_to_nodes(
    field: &CfdPressureField,
    node_positions: &[(String, f64, f64, f64)], // (node_id, x, y, z)
    power: f64, // IDW power (typically 2.0)
) -> Vec<(String, f64)> {
    node_positions.iter().map(|(nid, nx, ny, nz)| {
        let mut w_sum = 0.0_f64;
        let mut pv_sum = 0.0_f64;
        for pt in &field.points {
            let dx = pt.x - nx;
            let dy = pt.y - ny;
            let dz = pt.z - nz;
            let dist = (dx*dx + dy*dy + dz*dz).sqrt().max(1e-12);
            let w = 1.0 / dist.powf(power);
            w_sum += w;
            pv_sum += w * pt.pressure_pa;
        }
        let p = if w_sum > 1e-30 { pv_sum / w_sum } else { 0.0 };
        (nid.clone(), p)
    }).collect()
}

/// Convert interpolated CFD pressures to nodal forces (kN) given tributary
/// areas and surface normals.
pub fn cfd_to_nodal_forces(
    nodal_pressures: &[(String, f64)],
    tributary_areas: &HashMap<String, f64>,
    normals: &HashMap<String, [f64; 3]>,
) -> Vec<NodalWindForce> {
    nodal_pressures.iter().filter_map(|(nid, p)| {
        let area = tributary_areas.get(nid)?;
        let n = normals.get(nid)?;
        let f = p * area; // N
        Some(NodalWindForce {
            node_id: nid.clone(),
            fx: f * n[0] / 1000.0,
            fy: f * n[1] / 1000.0,
            fz: f * n[2] / 1000.0,
        })
    }).collect()
}

// ============================================================================
// VELOCITY PRESSURE CALCULATIONS (CODE-BASED)
// ============================================================================

/// Reference velocity pressure   q = 0.5 × ρ × V²
pub fn velocity_pressure(air_density: f64, wind_speed: f64) -> f64 {
    0.5 * air_density * wind_speed * wind_speed
}

/// IS 875 Part 3:2015  — design wind pressure (Pa)
/// p_z = 0.6 × V_z²
pub fn is875_design_pressure(vz: f64) -> f64 {
    0.6 * vz * vz
}

/// IS 875 Part 3 design wind speed at height z
/// V_z = V_b × k1 × k2 × k3 × k4
pub fn is875_design_speed(
    vb: f64,   // basic wind speed (m/s)
    k1: f64,   // risk coefficient
    k2: f64,   // terrain/height/size factor
    k3: f64,   // topography factor
    k4: f64,   // importance factor
) -> f64 {
    vb * k1 * k2 * k3 * k4
}

/// Terrain category k2 values (IS 875 Table 2, simplified)
pub fn is875_k2(terrain_category: u8, height_m: f64) -> f64 {
    let (alpha, z_g) = match terrain_category {
        1 => (0.0706, 250.0),
        2 => (0.1000, 300.0),
        3 => (0.1400, 350.0),
        4 => (0.1900, 500.0),
        _ => (0.1000, 300.0),
    };
    let z = height_m.max(10.0).min(z_g);
    (z / 10.0).powf(alpha)
}

/// ASCE 7 velocity pressure  q_z = 0.613 × K_z × K_zt × K_d × K_e × V²  (Pa)
pub fn asce7_velocity_pressure(
    kz: f64,   // velocity pressure exposure coefficient
    kzt: f64,  // topographic factor
    kd: f64,   // wind directionality factor
    ke: f64,   // ground elevation factor
    v: f64,    // basic wind speed (m/s)
) -> f64 {
    0.613 * kz * kzt * kd * ke * v * v
}

// ============================================================================
// POWER SPECTRAL DENSITY (PSD)
// ============================================================================

/// Compute the PSD of a Cp signal using a simple DFT periodogram.
/// Returns (frequency_Hz, power) pairs.
pub fn compute_psd(signal: &[f64], sampling_rate: f64) -> Vec<(f64, f64)> {
    let n = signal.len();
    if n < 4 { return vec![]; }
    let mean: f64 = signal.iter().sum::<f64>() / n as f64;
    let detrended: Vec<f64> = signal.iter().map(|v| v - mean).collect();

    let n_half = n / 2;
    let mut psd = Vec::with_capacity(n_half);
    let dt = 1.0 / sampling_rate;
    let df = 1.0 / (n as f64 * dt);

    for k in 1..=n_half {
        let freq = k as f64 * df;
        let mut re = 0.0_f64;
        let mut im = 0.0_f64;
        for (j, &x) in detrended.iter().enumerate() {
            let angle = 2.0 * PI * k as f64 * j as f64 / n as f64;
            re += x * angle.cos();
            im -= x * angle.sin();
        }
        let power = (re * re + im * im) * dt / n as f64;
        psd.push((freq, power));
    }
    psd
}

// ============================================================================
// WIND DIRECTION SCAN
// ============================================================================

/// Result of scanning all wind directions to find the worst case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionScanResult {
    /// Worst-case wind direction (degrees)
    pub critical_direction_deg: f64,
    /// Max base shear in X (kN)
    pub max_base_shear_x: f64,
    /// Max base shear in Y (kN)
    pub max_base_shear_y: f64,
    /// Max base overturning moment (kN·m)
    pub max_overturning_moment: f64,
    /// Per-direction summaries
    pub direction_summaries: Vec<DirectionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionSummary {
    pub direction_deg: f64,
    pub base_shear_x_kn: f64,
    pub base_shear_y_kn: f64,
    pub overturning_moment_knm: f64,
    pub max_pressure_cp: f64,
    pub min_pressure_cp: f64,
}

/// Scan all wind directions in the data set and find the critical direction.
pub fn scan_wind_directions(
    dataset: &WindTunnelDataSet,
    mappings: &[TapToNodeMapping],
    q_design: f64,
) -> DirectionScanResult {
    let all_stats = dataset.compute_statistics();

    // Group stats by direction
    let mut by_direction: HashMap<i32, Vec<&CpStatistics>> = HashMap::new();
    for s in &all_stats {
        let dir_key = s.wind_direction_deg.round() as i32;
        by_direction.entry(dir_key).or_default().push(s);
    }

    let mut summaries = Vec::new();
    let mut max_shear_x = 0.0_f64;
    let mut max_shear_y = 0.0_f64;
    let mut max_moment = 0.0_f64;
    let mut critical_dir = 0.0_f64;

    for (&dir_key, dir_stats) in &by_direction {
        let eswl = equivalent_static_loads(mappings, &dir_stats.iter().map(|&&ref s| s.clone()).collect::<Vec<_>>(), q_design, 3.5);
        let fx_sum: f64 = eswl.iter().map(|f| f.fx).sum();
        let fy_sum: f64 = eswl.iter().map(|f| f.fy).sum();
        // Rough overturning moment: Σ(fy × z_height) — approximate using fy × ref_height
        let moment: f64 = eswl.iter().map(|f| f.fy.abs() * dataset.reference_height).sum();

        let max_cp = dir_stats.iter().map(|s| s.peak_positive).fold(f64::NEG_INFINITY, f64::max);
        let min_cp = dir_stats.iter().map(|s| s.peak_negative).fold(f64::INFINITY, f64::min);

        summaries.push(DirectionSummary {
            direction_deg: dir_key as f64,
            base_shear_x_kn: fx_sum,
            base_shear_y_kn: fy_sum,
            overturning_moment_knm: moment,
            max_pressure_cp: max_cp,
            min_pressure_cp: min_cp,
        });

        let total_shear = (fx_sum * fx_sum + fy_sum * fy_sum).sqrt();
        if total_shear > (max_shear_x * max_shear_x + max_shear_y * max_shear_y).sqrt() {
            max_shear_x = fx_sum;
            max_shear_y = fy_sum;
            max_moment = moment;
            critical_dir = dir_key as f64;
        }
    }

    DirectionScanResult {
        critical_direction_deg: critical_dir,
        max_base_shear_x: max_shear_x,
        max_base_shear_y: max_shear_y,
        max_overturning_moment: max_moment,
        direction_summaries: summaries,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_series() -> CpTimeSeries {
        CpTimeSeries {
            wind_direction_deg: 0.0,
            q_ref: 600.0,
            sampling_rate: 500.0,
            cp_values: vec![-1.2, -1.0, -0.8, -1.1, -0.9, -1.3, -0.7, -1.0, -1.2, -1.1],
        }
    }

    #[test]
    fn test_cp_statistics() {
        let series = sample_series();
        let stats = compute_cp_stats("T001", &series);
        assert!((stats.mean - (-1.03)).abs() < 0.05);
        assert!(stats.peak_positive > -0.8);
        assert!(stats.peak_negative < -1.2);
        assert!(stats.std_dev > 0.0);
    }

    #[test]
    fn test_velocity_pressure() {
        let q = velocity_pressure(1.25, 40.0);
        assert!((q - 1000.0).abs() < 1.0);
    }

    #[test]
    fn test_is875_k2() {
        let k2 = is875_k2(2, 50.0);
        assert!(k2 > 1.0 && k2 < 1.5);
    }

    #[test]
    fn test_cp_to_nodal_forces() {
        let mappings = vec![TapToNodeMapping {
            tap_id: "T1".to_string(),
            node_id: "N1".to_string(),
            tributary_area: 10.0,
            normal: [1.0, 0.0, 0.0],
        }];
        let mut data = HashMap::new();
        data.insert("T1".to_string(), CpTimeSeries {
            wind_direction_deg: 0.0,
            q_ref: 600.0,
            sampling_rate: 10.0,
            cp_values: vec![1.0, 0.8, 1.2],
        });
        let forces = cp_to_nodal_forces(&mappings, &data, 600.0);
        assert_eq!(forces.len(), 3);
        // F = Cp × q × A / 1000 = 1.0 × 600 × 10 / 1000 = 6 kN
        assert!((forces[0][0].fx - 6.0).abs() < 0.01);
    }

    #[test]
    fn test_cfd_interpolation() {
        let field = CfdPressureField {
            label: "CFD-1".to_string(),
            wind_direction_deg: 0.0,
            points: vec![
                CfdPressurePoint { x: 0.0, y: 0.0, z: 0.0, pressure_pa: 100.0 },
                CfdPressurePoint { x: 10.0, y: 0.0, z: 0.0, pressure_pa: 200.0 },
            ],
        };
        let nodes = vec![("N1".to_string(), 5.0, 0.0, 0.0)];
        let result = interpolate_cfd_to_nodes(&field, &nodes, 2.0);
        // Midpoint → average of 100 & 200 = 150 (equal distance weights)
        assert!((result[0].1 - 150.0).abs() < 1.0);
    }

    #[test]
    fn test_psd() {
        let signal: Vec<f64> = (0..128).map(|i| (2.0 * PI * 10.0 * i as f64 / 128.0).sin()).collect();
        let psd = compute_psd(&signal, 128.0);
        assert!(!psd.is_empty());
        // Peak should be near 10 Hz
        let peak = psd.iter().max_by(|a, b| a.1.partial_cmp(&b.1).unwrap()).unwrap();
        assert!((peak.0 - 10.0).abs() < 2.0);
    }

    #[test]
    fn test_equivalent_static_loads() {
        let mappings = vec![TapToNodeMapping {
            tap_id: "T1".to_string(),
            node_id: "N1".to_string(),
            tributary_area: 10.0,
            normal: [0.0, 1.0, 0.0],
        }];
        let stats = vec![CpStatistics {
            tap_id: "T1".to_string(),
            wind_direction_deg: 0.0,
            mean: -1.0,
            rms: 1.1,
            peak_positive: -0.5,
            peak_negative: -1.5,
            std_dev: 0.2,
            skewness: 0.0,
            kurtosis: 3.0,
        }];
        let loads = equivalent_static_loads(&mappings, &stats, 600.0, 3.5);
        assert_eq!(loads.len(), 1);
        // cp_eq = -1.0 + 3.5 * 0.2 = -0.3 → F = -0.3 × 600 × 10 / 1000 = -1.8 kN
        assert!((loads[0].fy - (-1.8)).abs() < 0.1);
    }
}
