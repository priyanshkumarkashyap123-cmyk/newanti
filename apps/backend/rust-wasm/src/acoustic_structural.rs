//! Structural Acoustics Module
//!
//! Sound transmission and acoustic performance of structures.
//! Based on: ISO 717, ASTM E90, EN 12354
//!
//! Features:
//! - Sound transmission loss calculation
//! - Impact sound insulation
//! - Flanking transmission
//! - Room acoustics

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Frequency bands for acoustic analysis (Hz)
pub const OCTAVE_BANDS: [f64; 8] = [63.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0];
pub const THIRD_OCTAVE_BANDS: [f64; 21] = [
    50.0, 63.0, 80.0, 100.0, 125.0, 160.0, 200.0, 250.0, 315.0, 400.0, 500.0,
    630.0, 800.0, 1000.0, 1250.0, 1600.0, 2000.0, 2500.0, 3150.0, 4000.0, 5000.0,
];

/// Material acoustic properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcousticMaterial {
    /// Material name
    pub name: String,
    /// Surface density (kg/m²)
    pub surface_density: f64,
    /// Young's modulus (GPa)
    pub youngs_modulus: f64,
    /// Poisson's ratio
    pub poissons_ratio: f64,
    /// Internal loss factor
    pub loss_factor: f64,
    /// Thickness (mm)
    pub thickness: f64,
}

impl AcousticMaterial {
    /// Create concrete material
    pub fn concrete(thickness: f64) -> Self {
        Self {
            name: "Concrete".to_string(),
            surface_density: 2400.0 * thickness / 1000.0,
            youngs_modulus: 30.0,
            poissons_ratio: 0.2,
            loss_factor: 0.006,
            thickness,
        }
    }
    
    /// Create steel material
    pub fn steel(thickness: f64) -> Self {
        Self {
            name: "Steel".to_string(),
            surface_density: 7850.0 * thickness / 1000.0,
            youngs_modulus: 200.0,
            poissons_ratio: 0.3,
            loss_factor: 0.001,
            thickness,
        }
    }
    
    /// Create gypsum board material
    pub fn gypsum(thickness: f64) -> Self {
        Self {
            name: "Gypsum Board".to_string(),
            surface_density: 800.0 * thickness / 1000.0,
            youngs_modulus: 2.5,
            poissons_ratio: 0.24,
            loss_factor: 0.015,
            thickness,
        }
    }
    
    /// Create glass material
    pub fn glass(thickness: f64) -> Self {
        Self {
            name: "Glass".to_string(),
            surface_density: 2500.0 * thickness / 1000.0,
            youngs_modulus: 70.0,
            poissons_ratio: 0.22,
            loss_factor: 0.003,
            thickness,
        }
    }
    
    /// Calculate critical frequency
    pub fn critical_frequency(&self) -> f64 {
        let c0: f64 = 343.0; // Speed of sound in air (m/s)
        let t = self.thickness / 1000.0; // Convert to meters
        
        // Bending stiffness per unit width
        let d = self.youngs_modulus * 1e9 * t.powi(3) 
            / (12.0 * (1.0 - self.poissons_ratio.powi(2)));
        
        // Critical frequency
        c0.powi(2) / (2.0 * PI) * (self.surface_density / d).sqrt()
    }
}

/// Sound transmission loss calculator
#[derive(Debug, Clone)]
pub struct TransmissionLoss {
    /// Construction layers
    pub layers: Vec<AcousticMaterial>,
    /// Air gaps (mm)
    pub air_gaps: Vec<f64>,
    /// Transmission loss values (dB) per frequency band
    pub tl_values: Vec<(f64, f64)>,
    /// Weighted sound reduction index Rw
    pub rw: f64,
}

impl TransmissionLoss {
    /// Create new TL calculator
    pub fn new() -> Self {
        Self {
            layers: Vec::new(),
            air_gaps: Vec::new(),
            tl_values: Vec::new(),
            rw: 0.0,
        }
    }
    
    /// Add layer
    pub fn add_layer(&mut self, material: AcousticMaterial) {
        self.layers.push(material);
    }
    
    /// Add air gap
    pub fn add_air_gap(&mut self, gap: f64) {
        self.air_gaps.push(gap);
    }
    
    /// Calculate TL for single layer (mass law)
    pub fn calculate_single_layer(&mut self) {
        if self.layers.is_empty() {
            return;
        }
        
        let material = &self.layers[0];
        let fc = material.critical_frequency();
        
        self.tl_values.clear();
        
        for &freq in &THIRD_OCTAVE_BANDS {
            let tl = if freq < fc {
                // Mass law region
                20.0 * (material.surface_density * freq).log10() - 47.0
            } else {
                // Coincidence region
                20.0 * (material.surface_density * freq).log10() - 47.0
                    + 10.0 * (2.0 * material.loss_factor * freq / fc).log10()
            };
            
            self.tl_values.push((freq, tl.max(0.0)));
        }
        
        self.calculate_rw();
    }
    
    /// Calculate TL for double wall
    pub fn calculate_double_wall(&mut self) {
        if self.layers.len() < 2 {
            return;
        }
        
        let layer1 = &self.layers[0];
        let layer2 = &self.layers[1];
        let gap = if self.air_gaps.is_empty() { 50.0 } else { self.air_gaps[0] };
        
        // Mass-air-mass resonance frequency
        let m1 = layer1.surface_density;
        let m2 = layer2.surface_density;
        let d = gap / 1000.0; // meters
        
        let rho_air: f64 = 1.2; // kg/m³
        let c0: f64 = 343.0; // m/s
        
        let f0 = 1.0 / (2.0 * PI) * (rho_air * c0.powi(2) / d * (1.0/m1 + 1.0/m2)).sqrt();
        
        self.tl_values.clear();
        
        for &freq in &THIRD_OCTAVE_BANDS {
            // Single panel mass law values
            let tl1 = 20.0 * (m1 * freq).log10() - 47.0;
            let tl2 = 20.0 * (m2 * freq).log10() - 47.0;
            
            let tl = if freq < f0 {
                // Below resonance - simple addition
                tl1 + tl2 - 6.0
            } else if freq < 2.0 * f0 {
                // Near resonance - reduced performance
                (tl1 + tl2) / 2.0
            } else {
                // Above resonance - improved performance
                tl1 + tl2 + 6.0 * (freq / f0).log10()
            };
            
            self.tl_values.push((freq, tl.max(0.0)));
        }
        
        self.calculate_rw();
    }
    
    /// Calculate weighted sound reduction index (ISO 717-1)
    fn calculate_rw(&mut self) {
        // Reference curve at 500 Hz
        let reference_curve = [
            (100.0, -16.0), (125.0, -13.0), (160.0, -10.0), (200.0, -7.0),
            (250.0, -4.0), (315.0, -1.0), (400.0, 2.0), (500.0, 5.0),
            (630.0, 8.0), (800.0, 11.0), (1000.0, 14.0), (1250.0, 17.0),
            (1600.0, 20.0), (2000.0, 23.0), (2500.0, 26.0), (3150.0, 29.0),
        ];
        
        // Shift reference curve to find Rw
        let mut shift = 30.0; // Start with high value
        
        while shift > -30.0 {
            let mut sum_deficiency = 0.0;
            
            for &(ref_freq, ref_val) in &reference_curve {
                if let Some(&(_, measured_val)) = self.tl_values.iter()
                    .find(|(f, _)| (*f - ref_freq).abs() < 1.0) {
                    let deficiency = (ref_val + shift) - measured_val;
                    if deficiency > 0.0 {
                        sum_deficiency += deficiency;
                    }
                }
            }
            
            if sum_deficiency <= 32.0 {
                self.rw = 52.0 + shift; // 52 dB reference + shift
                return;
            }
            
            shift -= 1.0;
        }
        
        self.rw = 22.0; // Minimum
    }
    
    /// Get TL at specific frequency (interpolated)
    pub fn tl_at(&self, freq: f64) -> f64 {
        if self.tl_values.is_empty() {
            return 0.0;
        }
        
        // Find bracketing frequencies
        for i in 1..self.tl_values.len() {
            let (f1, tl1) = self.tl_values[i-1];
            let (f2, tl2) = self.tl_values[i];
            
            if freq >= f1 && freq <= f2 {
                let log_ratio = (freq / f1).log10() / (f2 / f1).log10();
                return tl1 + (tl2 - tl1) * log_ratio;
            }
        }
        
        self.tl_values.last().map(|(_, tl)| *tl).unwrap_or(0.0)
    }
}

/// Impact sound insulation
#[derive(Debug, Clone)]
pub struct ImpactSound {
    /// Floor construction
    pub floor: AcousticMaterial,
    /// Floor covering
    pub covering: Option<FloorCovering>,
    /// Normalized impact sound pressure level (dB)
    pub ln_values: Vec<(f64, f64)>,
    /// Weighted normalized impact sound Ln,w
    pub lnw: f64,
}

/// Floor covering properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorCovering {
    /// Covering name
    pub name: String,
    /// Impact sound improvement delta_Lw (dB)
    pub delta_lw: f64,
}

impl FloorCovering {
    /// Carpet
    pub fn carpet() -> Self {
        Self {
            name: "Carpet".to_string(),
            delta_lw: 25.0,
        }
    }
    
    /// Vinyl flooring
    pub fn vinyl() -> Self {
        Self {
            name: "Vinyl".to_string(),
            delta_lw: 15.0,
        }
    }
    
    /// Floating floor
    pub fn floating_floor() -> Self {
        Self {
            name: "Floating Floor".to_string(),
            delta_lw: 18.0,
        }
    }
    
    /// Hard floor (tile/wood)
    pub fn hard_floor() -> Self {
        Self {
            name: "Hard Floor".to_string(),
            delta_lw: 5.0,
        }
    }
}

impl ImpactSound {
    /// Create new impact sound calculator
    pub fn new(floor: AcousticMaterial) -> Self {
        Self {
            floor,
            covering: None,
            ln_values: Vec::new(),
            lnw: 0.0,
        }
    }
    
    /// Add floor covering
    pub fn add_covering(&mut self, covering: FloorCovering) {
        self.covering = Some(covering);
    }
    
    /// Calculate normalized impact sound level (simplified)
    pub fn calculate(&mut self) {
        // Cremer formula for bare slab
        let m = self.floor.surface_density;
        
        self.ln_values.clear();
        
        for &freq in &THIRD_OCTAVE_BANDS {
            // Bare slab level (empirical formula)
            let ln_bare = 164.0 - 35.0 * m.log10() - 30.0 * (freq / 1000.0).log10();
            
            // Apply covering improvement if present
            let delta_l = if let Some(ref covering) = self.covering {
                // Simplified frequency-dependent improvement
                let f_ratio = (freq / 500.0).log10();
                covering.delta_lw * (1.0 + 0.2 * f_ratio).max(0.5).min(1.5)
            } else {
                0.0
            };
            
            self.ln_values.push((freq, (ln_bare - delta_l).max(0.0)));
        }
        
        self.calculate_lnw();
    }
    
    /// Calculate weighted impact sound level (ISO 717-2)
    fn calculate_lnw(&mut self) {
        // Reference curve (inverted from ISO 717-2)
        let reference = [
            (100.0, 62.0), (125.0, 62.0), (160.0, 62.0), (200.0, 62.0),
            (250.0, 62.0), (315.0, 62.0), (400.0, 61.0), (500.0, 60.0),
            (630.0, 59.0), (800.0, 58.0), (1000.0, 57.0), (1250.0, 54.0),
            (1600.0, 51.0), (2000.0, 48.0), (2500.0, 45.0), (3150.0, 42.0),
        ];
        
        // Shift to find Ln,w
        let mut shift = -20.0;
        
        while shift < 30.0 {
            let mut sum_excess = 0.0;
            
            for &(ref_freq, ref_val) in &reference {
                if let Some(&(_, measured_val)) = self.ln_values.iter()
                    .find(|(f, _)| (*f - ref_freq).abs() < 1.0) {
                    let excess = measured_val - (ref_val + shift);
                    if excess > 0.0 {
                        sum_excess += excess;
                    }
                }
            }
            
            if sum_excess <= 32.0 {
                self.lnw = 60.0 + shift;
                return;
            }
            
            shift += 1.0;
        }
        
        self.lnw = 90.0; // Maximum
    }
}

/// Room acoustics calculator
#[derive(Debug, Clone)]
pub struct RoomAcoustics {
    /// Room volume (m³)
    pub volume: f64,
    /// Room surfaces
    pub surfaces: Vec<RoomSurface>,
    /// Reverberation time T60 (s)
    pub t60: Vec<(f64, f64)>,
}

/// Room surface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomSurface {
    /// Surface name
    pub name: String,
    /// Area (m²)
    pub area: f64,
    /// Absorption coefficients by frequency
    pub absorption: Vec<(f64, f64)>,
}

impl RoomSurface {
    /// Create surface with uniform absorption
    pub fn new(name: &str, area: f64, alpha: f64) -> Self {
        let absorption: Vec<(f64, f64)> = OCTAVE_BANDS.iter()
            .map(|&f| (f, alpha))
            .collect();
        
        Self {
            name: name.to_string(),
            area,
            absorption,
        }
    }
    
    /// Create concrete surface
    pub fn concrete(area: f64) -> Self {
        Self {
            name: "Concrete".to_string(),
            area,
            absorption: vec![
                (125.0, 0.01), (250.0, 0.01), (500.0, 0.02),
                (1000.0, 0.02), (2000.0, 0.02), (4000.0, 0.03),
            ],
        }
    }
    
    /// Create carpet surface
    pub fn carpet(area: f64) -> Self {
        Self {
            name: "Carpet".to_string(),
            area,
            absorption: vec![
                (125.0, 0.05), (250.0, 0.10), (500.0, 0.20),
                (1000.0, 0.35), (2000.0, 0.50), (4000.0, 0.60),
            ],
        }
    }
    
    /// Create acoustic panel surface
    pub fn acoustic_panel(area: f64) -> Self {
        Self {
            name: "Acoustic Panel".to_string(),
            area,
            absorption: vec![
                (125.0, 0.30), (250.0, 0.60), (500.0, 0.90),
                (1000.0, 0.90), (2000.0, 0.85), (4000.0, 0.80),
            ],
        }
    }
    
    /// Get absorption at frequency (interpolated)
    pub fn alpha_at(&self, freq: f64) -> f64 {
        if self.absorption.is_empty() {
            return 0.1;
        }
        
        for i in 1..self.absorption.len() {
            let (f1, a1) = self.absorption[i-1];
            let (f2, a2) = self.absorption[i];
            
            if freq >= f1 && freq <= f2 {
                let ratio = (freq.log10() - f1.log10()) / (f2.log10() - f1.log10());
                return a1 + (a2 - a1) * ratio;
            }
        }
        
        self.absorption.last().map(|(_, a)| *a).unwrap_or(0.1)
    }
}

impl RoomAcoustics {
    /// Create new room acoustics calculator
    pub fn new(volume: f64) -> Self {
        Self {
            volume,
            surfaces: Vec::new(),
            t60: Vec::new(),
        }
    }
    
    /// Add surface
    pub fn add_surface(&mut self, surface: RoomSurface) {
        self.surfaces.push(surface);
    }
    
    /// Calculate reverberation time (Sabine formula)
    pub fn calculate_sabine(&mut self) {
        self.t60.clear();
        
        for &freq in &OCTAVE_BANDS {
            let mut total_absorption = 0.0;
            
            for surface in &self.surfaces {
                let alpha = surface.alpha_at(freq);
                total_absorption += alpha * surface.area;
            }
            
            // Sabine formula: T60 = 0.161 * V / A
            let t60 = if total_absorption > 0.0 {
                0.161 * self.volume / total_absorption
            } else {
                10.0 // Very reverberant
            };
            
            self.t60.push((freq, t60));
        }
    }
    
    /// Calculate reverberation time (Eyring formula)
    pub fn calculate_eyring(&mut self) {
        self.t60.clear();
        
        let total_area: f64 = self.surfaces.iter().map(|s| s.area).sum();
        
        for &freq in &OCTAVE_BANDS {
            let mut weighted_alpha = 0.0;
            
            for surface in &self.surfaces {
                let alpha = surface.alpha_at(freq);
                weighted_alpha += alpha * surface.area;
            }
            
            let avg_alpha = weighted_alpha / total_area.max(1.0);
            
            // Eyring formula: T60 = 0.161 * V / (-S * ln(1 - alpha_avg))
            let t60 = if avg_alpha < 0.99 {
                0.161 * self.volume / (-total_area * (1.0 - avg_alpha).ln())
            } else {
                0.05 // Very absorptive
            };
            
            self.t60.push((freq, t60));
        }
    }
    
    /// Get T60 at specific frequency
    pub fn t60_at(&self, freq: f64) -> f64 {
        for &(f, t) in &self.t60 {
            if (f - freq).abs() < freq * 0.1 {
                return t;
            }
        }
        0.5 // Default
    }
    
    /// Calculate NRC (Noise Reduction Coefficient)
    pub fn calculate_nrc(&self) -> f64 {
        if self.surfaces.is_empty() {
            return 0.0;
        }
        
        let total_area: f64 = self.surfaces.iter().map(|s| s.area).sum();
        let mut nrc = 0.0;
        
        let nrc_freqs = [250.0, 500.0, 1000.0, 2000.0];
        
        for &freq in &nrc_freqs {
            let mut weighted_alpha = 0.0;
            for surface in &self.surfaces {
                weighted_alpha += surface.alpha_at(freq) * surface.area;
            }
            nrc += weighted_alpha / total_area;
        }
        
        nrc / 4.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_acoustic_material_concrete() {
        let concrete = AcousticMaterial::concrete(150.0);
        
        assert!(concrete.surface_density > 300.0);
        assert_eq!(concrete.thickness, 150.0);
    }
    
    #[test]
    fn test_critical_frequency() {
        let concrete = AcousticMaterial::concrete(150.0);
        let fc = concrete.critical_frequency();
        
        // Typical concrete critical frequency around 100-200 Hz for 150mm
        assert!(fc > 50.0 && fc < 500.0);
    }
    
    #[test]
    fn test_transmission_loss_single() {
        let mut tl = TransmissionLoss::new();
        tl.add_layer(AcousticMaterial::concrete(200.0));
        tl.calculate_single_layer();
        
        assert!(!tl.tl_values.is_empty());
        assert!(tl.rw > 40.0);
    }
    
    #[test]
    fn test_transmission_loss_double() {
        let mut tl = TransmissionLoss::new();
        tl.add_layer(AcousticMaterial::gypsum(12.5));
        tl.add_layer(AcousticMaterial::gypsum(12.5));
        tl.add_air_gap(100.0);
        tl.calculate_double_wall();
        
        assert!(!tl.tl_values.is_empty());
        assert!(tl.rw > 30.0);
    }
    
    #[test]
    fn test_tl_interpolation() {
        let mut tl = TransmissionLoss::new();
        tl.add_layer(AcousticMaterial::concrete(150.0));
        tl.calculate_single_layer();
        
        let tl_500 = tl.tl_at(500.0);
        assert!(tl_500 > 0.0);
    }
    
    #[test]
    fn test_impact_sound_bare() {
        let floor = AcousticMaterial::concrete(150.0);
        let mut impact = ImpactSound::new(floor);
        impact.calculate();
        
        assert!(!impact.ln_values.is_empty());
        assert!(impact.lnw > 50.0);
    }
    
    #[test]
    fn test_impact_sound_with_carpet() {
        let floor = AcousticMaterial::concrete(150.0);
        let mut impact = ImpactSound::new(floor);
        impact.add_covering(FloorCovering::carpet());
        impact.calculate();
        
        // Carpet should significantly improve Ln,w
        let mut bare = ImpactSound::new(AcousticMaterial::concrete(150.0));
        bare.calculate();
        
        assert!(impact.lnw < bare.lnw);
    }
    
    #[test]
    fn test_floor_coverings() {
        let carpet = FloorCovering::carpet();
        let vinyl = FloorCovering::vinyl();
        
        assert!(carpet.delta_lw > vinyl.delta_lw);
    }
    
    #[test]
    fn test_room_acoustics() {
        let mut room = RoomAcoustics::new(200.0);
        
        room.add_surface(RoomSurface::concrete(60.0)); // Floor
        room.add_surface(RoomSurface::concrete(60.0)); // Ceiling
        room.add_surface(RoomSurface::concrete(80.0)); // Walls
        
        room.calculate_sabine();
        
        assert!(!room.t60.is_empty());
        
        let t60_500 = room.t60_at(500.0);
        assert!(t60_500 > 0.0);
    }
    
    #[test]
    fn test_room_with_treatment() {
        let mut untreated = RoomAcoustics::new(100.0);
        untreated.add_surface(RoomSurface::concrete(100.0));
        untreated.calculate_sabine();
        
        let mut treated = RoomAcoustics::new(100.0);
        treated.add_surface(RoomSurface::concrete(50.0));
        treated.add_surface(RoomSurface::acoustic_panel(50.0));
        treated.calculate_sabine();
        
        // Treated room should have lower T60
        assert!(treated.t60_at(1000.0) < untreated.t60_at(1000.0));
    }
    
    #[test]
    fn test_eyring_formula() {
        let mut room = RoomAcoustics::new(150.0);
        room.add_surface(RoomSurface::carpet(75.0));
        room.add_surface(RoomSurface::concrete(75.0));
        
        room.calculate_eyring();
        
        assert!(!room.t60.is_empty());
    }
    
    #[test]
    fn test_nrc_calculation() {
        let mut room = RoomAcoustics::new(100.0);
        room.add_surface(RoomSurface::acoustic_panel(100.0));
        
        let nrc = room.calculate_nrc();
        
        // Acoustic panels should have high NRC
        assert!(nrc > 0.6);
    }
    
    #[test]
    fn test_surface_alpha_interpolation() {
        let surface = RoomSurface::carpet(50.0);
        
        let alpha_250 = surface.alpha_at(250.0);
        let alpha_500 = surface.alpha_at(500.0);
        
        assert!(alpha_500 > alpha_250); // Carpet absorption increases with frequency
    }
    
    #[test]
    fn test_material_types() {
        let steel = AcousticMaterial::steel(6.0);
        let glass = AcousticMaterial::glass(8.0);
        
        assert!(steel.youngs_modulus > glass.youngs_modulus);
    }
    
    #[test]
    fn test_octave_bands() {
        assert_eq!(OCTAVE_BANDS.len(), 8);
        assert_eq!(OCTAVE_BANDS[4], 1000.0); // 1 kHz
    }
    
    #[test]
    fn test_third_octave_bands() {
        assert_eq!(THIRD_OCTAVE_BANDS.len(), 21);
    }
}
