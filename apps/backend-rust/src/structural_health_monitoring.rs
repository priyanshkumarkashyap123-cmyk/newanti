// ============================================================================
// STRUCTURAL HEALTH MONITORING (SHM) - Sensors, Damage Detection
// Vibration-Based Methods, Guided Waves, Model Updating
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SENSOR TYPES
// ============================================================================

/// Sensor type enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SensorType {
    /// Accelerometer
    Accelerometer { sensitivity: f64, range: f64, noise_floor: f64 },
    /// Strain gauge
    StrainGauge { gauge_factor: f64, resistance: f64 },
    /// Fiber optic (FBG)
    FiberBraggGrating { wavelength: f64, sensitivity: f64 },
    /// Piezoelectric (PZT)
    Piezoelectric { d31: f64, capacitance: f64 },
    /// LVDT displacement
    Lvdt { range: f64, resolution: f64 },
    /// Load cell
    LoadCell { capacity: f64, accuracy: f64 },
    /// Inclinometer
    Inclinometer { range: f64, resolution: f64 },
    /// Crack meter
    CrackMeter { range: f64, resolution: f64 },
}

impl SensorType {
    /// Typical accelerometer
    pub fn accelerometer_typical() -> Self {
        SensorType::Accelerometer {
            sensitivity: 1000.0, // mV/g
            range: 2.0,         // g
            noise_floor: 0.0001, // g/√Hz
        }
    }
    
    /// Typical strain gauge
    pub fn strain_gauge_typical() -> Self {
        SensorType::StrainGauge {
            gauge_factor: 2.0,
            resistance: 120.0, // Ohm
        }
    }
    
    /// Typical FBG
    pub fn fbg_typical() -> Self {
        SensorType::FiberBraggGrating {
            wavelength: 1550.0, // nm
            sensitivity: 1.2,   // pm/με
        }
    }
}

/// Sensor location and properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sensor {
    pub id: usize,
    pub sensor_type: SensorType,
    pub position: [f64; 3],
    pub orientation: [f64; 3],
    pub sampling_rate: f64, // Hz
    pub is_active: bool,
}

impl Sensor {
    pub fn new(id: usize, sensor_type: SensorType, position: [f64; 3]) -> Self {
        Self {
            id,
            sensor_type,
            position,
            orientation: [1.0, 0.0, 0.0],
            sampling_rate: 100.0,
            is_active: true,
        }
    }
}

// ============================================================================
// SENSOR NETWORK
// ============================================================================

/// Sensor network configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorNetwork {
    pub sensors: Vec<Sensor>,
    pub data_acquisition: DataAcquisition,
    pub communication: CommunicationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataAcquisition {
    pub sampling_rate: f64,     // Hz
    pub resolution: usize,      // bits
    pub channels: usize,
    pub synchronization: SyncType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncType {
    Hardware,
    Software,
    Gps,
    Wireless,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationType {
    Wired,
    Wireless { protocol: String, range: f64 },
    Hybrid,
}

impl SensorNetwork {
    pub fn new() -> Self {
        Self {
            sensors: Vec::new(),
            data_acquisition: DataAcquisition {
                sampling_rate: 100.0,
                resolution: 24,
                channels: 16,
                synchronization: SyncType::Hardware,
            },
            communication: CommunicationType::Wired,
        }
    }
    
    /// Add sensor
    pub fn add_sensor(&mut self, sensor: Sensor) {
        self.sensors.push(sensor);
    }
    
    /// Number of active sensors
    pub fn active_count(&self) -> usize {
        self.sensors.iter().filter(|s| s.is_active).count()
    }
    
    /// Coverage analysis (simplified)
    pub fn coverage_volume(&self, sensor_range: f64) -> f64 {
        // Simplified: sphere of influence for each sensor
        let single_vol = 4.0 / 3.0 * PI * sensor_range.powi(3);
        self.active_count() as f64 * single_vol * 0.7 // Overlap factor
    }
}

// ============================================================================
// OPTIMAL SENSOR PLACEMENT
// ============================================================================

/// Sensor placement optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorPlacement {
    /// Candidate locations
    pub candidates: Vec<[f64; 3]>,
    /// Number of sensors to place
    pub num_sensors: usize,
    /// Mode shapes at candidates
    pub mode_shapes: Vec<Vec<f64>>,
    /// Selected indices
    pub selected: Vec<usize>,
}

impl SensorPlacement {
    pub fn new(candidates: Vec<[f64; 3]>, num_sensors: usize) -> Self {
        Self {
            candidates,
            num_sensors,
            mode_shapes: Vec::new(),
            selected: Vec::new(),
        }
    }
    
    /// Set mode shape data
    pub fn set_mode_shapes(&mut self, shapes: Vec<Vec<f64>>) {
        self.mode_shapes = shapes;
    }
    
    /// Effective Independence (EI) method
    pub fn effective_independence(&mut self) -> Vec<usize> {
        let n_cand = self.candidates.len();
        let n_modes = self.mode_shapes.len();
        
        if n_modes == 0 || n_cand == 0 {
            return Vec::new();
        }
        
        // Build Fisher Information Matrix contribution for each candidate
        let mut ei_values: Vec<f64> = vec![0.0; n_cand];
        
        // Simplified EI calculation
        for (i, _) in self.candidates.iter().enumerate() {
            let mut contribution = 0.0;
            for mode in &self.mode_shapes {
                if i < mode.len() {
                    contribution += mode[i].powi(2);
                }
            }
            ei_values[i] = contribution;
        }
        
        // Select top sensors
        let mut indices: Vec<usize> = (0..n_cand).collect();
        indices.sort_by(|&a, &b| ei_values[b].partial_cmp(&ei_values[a]).unwrap());
        
        self.selected = indices[..self.num_sensors.min(n_cand)].to_vec();
        self.selected.clone()
    }
    
    /// Modal Assurance Criterion (MAC) matrix
    pub fn mac_matrix(&self) -> Vec<Vec<f64>> {
        let n = self.mode_shapes.len();
        let mut mac = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            for j in 0..n {
                mac[i][j] = self.calculate_mac(&self.mode_shapes[i], &self.mode_shapes[j]);
            }
        }
        
        mac
    }
    
    fn calculate_mac(&self, mode1: &[f64], mode2: &[f64]) -> f64 {
        let n = mode1.len().min(mode2.len());
        
        let mut dot = 0.0;
        let mut norm1 = 0.0;
        let mut norm2 = 0.0;
        
        for i in 0..n {
            dot += mode1[i] * mode2[i];
            norm1 += mode1[i].powi(2);
            norm2 += mode2[i].powi(2);
        }
        
        if norm1 > 1e-10 && norm2 > 1e-10 {
            (dot.powi(2)) / (norm1 * norm2)
        } else {
            0.0
        }
    }
}

// ============================================================================
// DAMAGE DETECTION
// ============================================================================

/// Damage indicator types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DamageIndicator {
    /// Frequency shift
    FrequencyShift { baseline: f64, current: f64 },
    /// Mode shape curvature
    ModeShapeCurvature { curvature: Vec<f64> },
    /// Flexibility change
    FlexibilityChange { delta_f: Vec<Vec<f64>> },
    /// Strain energy
    StrainEnergy { baseline: Vec<f64>, current: Vec<f64> },
    /// Transfer function
    TransferFunction { h_baseline: Vec<f64>, h_current: Vec<f64> },
}

impl DamageIndicator {
    /// Calculate damage index
    pub fn damage_index(&self) -> f64 {
        match self {
            DamageIndicator::FrequencyShift { baseline, current } => {
                if *baseline > 1e-10 {
                    ((baseline - current) / baseline).abs()
                } else {
                    0.0
                }
            }
            DamageIndicator::ModeShapeCurvature { curvature } => {
                curvature.iter().map(|c| c.abs()).fold(0.0, f64::max)
            }
            DamageIndicator::FlexibilityChange { delta_f } => {
                delta_f.iter()
                    .flat_map(|row| row.iter())
                    .map(|v| v.abs())
                    .fold(0.0, f64::max)
            }
            DamageIndicator::StrainEnergy { baseline, current } => {
                baseline.iter()
                    .zip(current.iter())
                    .map(|(b, c)| if *b > 1e-10 { (c - b).abs() / b } else { 0.0 })
                    .fold(0.0, f64::max)
            }
            DamageIndicator::TransferFunction { h_baseline, h_current } => {
                h_baseline.iter()
                    .zip(h_current.iter())
                    .map(|(b, c)| (c - b).abs())
                    .sum::<f64>() / h_baseline.len() as f64
            }
        }
    }
}

/// Damage detection system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamageDetection {
    /// Baseline frequencies
    pub baseline_frequencies: Vec<f64>,
    /// Baseline mode shapes
    pub baseline_modes: Vec<Vec<f64>>,
    /// Current frequencies
    pub current_frequencies: Vec<f64>,
    /// Current mode shapes
    pub current_modes: Vec<Vec<f64>>,
    /// Damage threshold
    pub threshold: f64,
}

impl DamageDetection {
    pub fn new() -> Self {
        Self {
            baseline_frequencies: Vec::new(),
            baseline_modes: Vec::new(),
            current_frequencies: Vec::new(),
            current_modes: Vec::new(),
            threshold: 0.05,
        }
    }
    
    /// Set baseline
    pub fn set_baseline(&mut self, frequencies: Vec<f64>, modes: Vec<Vec<f64>>) {
        self.baseline_frequencies = frequencies;
        self.baseline_modes = modes;
    }
    
    /// Set current state
    pub fn set_current(&mut self, frequencies: Vec<f64>, modes: Vec<Vec<f64>>) {
        self.current_frequencies = frequencies;
        self.current_modes = modes;
    }
    
    /// Frequency-based damage detection
    pub fn frequency_damage_index(&self) -> Vec<f64> {
        self.baseline_frequencies.iter()
            .zip(self.current_frequencies.iter())
            .map(|(fb, fc)| {
                if *fb > 1e-10 {
                    (fb - fc).abs() / fb
                } else {
                    0.0
                }
            })
            .collect()
    }
    
    /// Mode shape damage index (MSC-based)
    pub fn mode_shape_damage_index(&self) -> Vec<f64> {
        if self.baseline_modes.is_empty() || self.current_modes.is_empty() {
            return Vec::new();
        }
        
        let n_dof = self.baseline_modes[0].len();
        let mut damage_idx = vec![0.0; n_dof];
        
        for mode_idx in 0..self.baseline_modes.len().min(self.current_modes.len()) {
            let baseline = &self.baseline_modes[mode_idx];
            let current = &self.current_modes[mode_idx];
            
            // Compute curvature difference
            for i in 1..(n_dof - 1) {
                let curv_b = baseline[i + 1] - 2.0 * baseline[i] + baseline[i - 1];
                let curv_c = current[i + 1] - 2.0 * current[i] + current[i - 1];
                
                damage_idx[i] += (curv_c - curv_b).abs();
            }
        }
        
        damage_idx
    }
    
    /// Detect damage
    pub fn detect_damage(&self) -> bool {
        let freq_idx = self.frequency_damage_index();
        freq_idx.iter().any(|&di| di > self.threshold)
    }
    
    /// Locate damage (simplified)
    pub fn locate_damage(&self) -> Vec<usize> {
        let msdi = self.mode_shape_damage_index();
        
        // Find peaks above threshold
        let max_di = msdi.iter().cloned().fold(0.0, f64::max);
        let local_threshold = 0.5 * max_di;
        
        msdi.iter()
            .enumerate()
            .filter(|(_, &di)| di > local_threshold)
            .map(|(i, _)| i)
            .collect()
    }
}

// ============================================================================
// MODAL IDENTIFICATION
// ============================================================================

/// Modal identification methods
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModalIdMethod {
    /// Peak picking
    PeakPicking,
    /// Frequency Domain Decomposition
    Fdd,
    /// Stochastic Subspace Identification
    Ssi { order: usize },
    /// Enhanced Frequency Domain Decomposition
    Efdd,
    /// PolyMAX
    PolyMax { order: usize },
}

/// Modal identification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalResult {
    pub frequency: f64,
    pub damping: f64,
    pub mode_shape: Vec<f64>,
    pub mac_value: f64,
}

/// Modal identification system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModalIdentification {
    pub method: ModalIdMethod,
    pub frequency_range: (f64, f64),
    pub results: Vec<ModalResult>,
}

impl ModalIdentification {
    pub fn new(method: ModalIdMethod) -> Self {
        Self {
            method,
            frequency_range: (0.1, 100.0),
            results: Vec::new(),
        }
    }
    
    /// Peak picking from PSD
    pub fn peak_picking(&self, frequencies: &[f64], psd: &[f64]) -> Vec<f64> {
        let mut peaks = Vec::new();
        
        for i in 1..(frequencies.len() - 1) {
            if frequencies[i] >= self.frequency_range.0 && 
               frequencies[i] <= self.frequency_range.1 &&
               psd[i] > psd[i - 1] && psd[i] > psd[i + 1] {
                peaks.push(frequencies[i]);
            }
        }
        
        peaks
    }
    
    /// Half-power bandwidth damping
    pub fn half_power_damping(&self, freq: f64, frequencies: &[f64], psd: &[f64]) -> f64 {
        // Find peak index
        let peak_idx = frequencies.iter()
            .position(|&f| (f - freq).abs() < 0.1)
            .unwrap_or(0);
        
        let peak_val = psd[peak_idx];
        let half_power = peak_val / 2.0_f64.sqrt();
        
        // Find half-power points
        let mut f1 = freq;
        let mut f2 = freq;
        
        for i in (0..peak_idx).rev() {
            if psd[i] < half_power {
                f1 = frequencies[i];
                break;
            }
        }
        
        for i in (peak_idx + 1)..frequencies.len() {
            if psd[i] < half_power {
                f2 = frequencies[i];
                break;
            }
        }
        
        (f2 - f1) / (2.0 * freq)
    }
}

// ============================================================================
// GUIDED WAVE INSPECTION
// ============================================================================

/// Guided wave parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuidedWave {
    /// Central frequency (kHz)
    pub frequency: f64,
    /// Number of cycles
    pub cycles: usize,
    /// Wave type
    pub wave_type: WaveType,
    /// Plate thickness (mm)
    pub thickness: f64,
    /// Material properties
    pub cl: f64, // Longitudinal velocity (m/s)
    pub ct: f64, // Transverse velocity (m/s)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WaveType {
    /// Symmetric Lamb wave
    SymmetricLamb { mode: usize },
    /// Antisymmetric Lamb wave
    AntisymmetricLamb { mode: usize },
    /// Shear horizontal
    ShearHorizontal { mode: usize },
    /// Rayleigh wave
    Rayleigh,
}

impl GuidedWave {
    pub fn new(frequency: f64, thickness: f64, cl: f64, ct: f64) -> Self {
        Self {
            frequency,
            cycles: 5,
            wave_type: WaveType::AntisymmetricLamb { mode: 0 },
            thickness,
            cl,
            ct,
        }
    }
    
    /// Frequency-thickness product
    pub fn fd_product(&self) -> f64 {
        self.frequency * self.thickness / 1000.0 // MHz·mm
    }
    
    /// Rayleigh wave velocity (approximate)
    pub fn rayleigh_velocity(&self) -> f64 {
        let nu = (self.cl.powi(2) - 2.0 * self.ct.powi(2)) / 
                 (2.0 * (self.cl.powi(2) - self.ct.powi(2)));
        
        self.ct * (0.87 + 1.12 * nu) / (1.0 + nu)
    }
    
    /// A0 mode velocity (low frequency approximation)
    pub fn a0_velocity_approx(&self) -> f64 {
        let omega = 2.0 * PI * self.frequency * 1000.0; // rad/s
        let d = self.thickness / 1000.0; // m
        
        // Plate bending wave velocity
        let cl = self.cl;
        let ct = self.ct;
        let cp = (cl.powi(2) - ct.powi(2)).sqrt();
        
        (cp * omega * d / 3.0_f64.sqrt()).sqrt()
    }
    
    /// Wavelength
    pub fn wavelength(&self) -> f64 {
        let v = match &self.wave_type {
            WaveType::Rayleigh => self.rayleigh_velocity(),
            WaveType::AntisymmetricLamb { .. } => self.a0_velocity_approx(),
            _ => self.ct,
        };
        
        v / (self.frequency * 1000.0) * 1000.0 // mm
    }
    
    /// Detection range (rule of thumb)
    pub fn detection_range(&self, attenuation: f64) -> f64 {
        // Range based on 40 dB loss
        40.0 / attenuation // meters
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sensor_creation() {
        let sensor = Sensor::new(
            1,
            SensorType::accelerometer_typical(),
            [0.0, 0.0, 0.0],
        );
        
        assert_eq!(sensor.id, 1);
        assert!(sensor.is_active);
    }

    #[test]
    fn test_sensor_network() {
        let mut network = SensorNetwork::new();
        
        network.add_sensor(Sensor::new(1, SensorType::strain_gauge_typical(), [0.0, 0.0, 0.0]));
        network.add_sensor(Sensor::new(2, SensorType::strain_gauge_typical(), [1.0, 0.0, 0.0]));
        
        assert_eq!(network.active_count(), 2);
    }

    #[test]
    fn test_sensor_placement_ei() {
        let candidates = vec![
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [2.0, 0.0, 0.0],
            [3.0, 0.0, 0.0],
        ];
        
        let mut placement = SensorPlacement::new(candidates, 2);
        placement.set_mode_shapes(vec![
            vec![0.1, 0.5, 0.8, 0.3],
            vec![0.2, 0.3, 0.9, 0.4],
        ]);
        
        let selected = placement.effective_independence();
        assert_eq!(selected.len(), 2);
    }

    #[test]
    fn test_damage_indicator() {
        let di = DamageIndicator::FrequencyShift {
            baseline: 10.0,
            current: 9.5,
        };
        
        let idx = di.damage_index();
        assert!((idx - 0.05).abs() < 0.01);
    }

    #[test]
    fn test_damage_detection() {
        let mut dd = DamageDetection::new();
        
        dd.set_baseline(vec![10.0, 25.0, 45.0], vec![]);
        dd.set_current(vec![9.4, 24.5, 44.0], vec![]);
        
        assert!(dd.detect_damage());
    }

    #[test]
    fn test_modal_identification() {
        let mi = ModalIdentification::new(ModalIdMethod::PeakPicking);
        
        let freqs = vec![0.0, 5.0, 10.0, 15.0, 20.0, 25.0];
        let psd = vec![0.1, 0.5, 1.0, 0.3, 0.8, 0.2];
        
        let peaks = mi.peak_picking(&freqs, &psd);
        assert!(peaks.contains(&10.0));
    }

    #[test]
    fn test_guided_wave() {
        let gw = GuidedWave::new(100.0, 2.0, 5900.0, 3200.0);
        
        let fd = gw.fd_product();
        assert!((fd - 0.2).abs() < 0.01);
        
        let vr = gw.rayleigh_velocity();
        assert!(vr > 2900.0 && vr < 3200.0);
    }

    #[test]
    fn test_mac_matrix() {
        let candidates = vec![[0.0, 0.0, 0.0]; 4];
        let mut placement = SensorPlacement::new(candidates, 2);
        
        placement.set_mode_shapes(vec![
            vec![1.0, 0.0, 0.0, 0.0],
            vec![0.0, 1.0, 0.0, 0.0],
        ]);
        
        let mac = placement.mac_matrix();
        
        assert!((mac[0][0] - 1.0).abs() < 0.01);
        assert!(mac[0][1].abs() < 0.01);
    }
}
