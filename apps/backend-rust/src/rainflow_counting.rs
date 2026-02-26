//! Advanced Rainflow Cycle Counting and Fatigue Extensions
//!
//! Extends the fatigue_analysis module with production-grade features:
//! - Complete ASTM E1049-85 rainflow algorithm
//! - Residue processing
//! - Cycle histogram generation
//! - Variable amplitude loading support
//! - Integration with multiaxial criteria

use serde::{Deserialize, Serialize};

// ============================================================================
// COMPLETE RAINFLOW IMPLEMENTATION (ASTM E1049-85)
// ============================================================================

/// A fatigue cycle with full metadata
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ExtendedCycle {
    /// Stress/strain range
    pub range: f64,
    /// Mean value
    pub mean: f64,
    /// Amplitude (range/2)
    pub amplitude: f64,
    /// Number of occurrences (0.5 or 1.0)
    pub count: f64,
    /// Starting index in original history
    pub start_idx: usize,
    /// Ending index in original history
    pub end_idx: usize,
    /// R-ratio (min/max)
    pub r_ratio: f64,
    /// Maximum value in cycle
    pub max_val: f64,
    /// Minimum value in cycle
    pub min_val: f64,
}

impl ExtendedCycle {
    pub fn from_extremes(min: f64, max: f64, count: f64, start: usize, end: usize) -> Self {
        let range = max - min;
        let mean = (max + min) / 2.0;
        let r = if max.abs() > 1e-14 { min / max } else { 0.0 };
        
        ExtendedCycle {
            range,
            mean,
            amplitude: range / 2.0,
            count,
            start_idx: start,
            end_idx: end,
            r_ratio: r,
            max_val: max,
            min_val: min,
        }
    }
}

/// Complete rainflow counter with ASTM E1049-85 four-point algorithm
pub struct AdvancedRainflowCounter {
    /// Tolerance for peak/valley detection
    pub hysteresis: f64,
    /// Maximum number of residue items
    pub max_residue: usize,
    /// Include half-cycles from residue
    pub include_residue: bool,
}

impl Default for AdvancedRainflowCounter {
    fn default() -> Self {
        AdvancedRainflowCounter {
            hysteresis: 0.0,
            max_residue: 1000000,
            include_residue: true,
        }
    }
}

impl AdvancedRainflowCounter {
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn with_hysteresis(mut self, h: f64) -> Self {
        self.hysteresis = h;
        self
    }
    
    /// Extract turning points from time history
    pub fn extract_turning_points(&self, history: &[f64]) -> Vec<(f64, usize)> {
        if history.len() < 3 {
            return history.iter().enumerate().map(|(i, &v)| (v, i)).collect();
        }
        
        let mut points: Vec<(f64, usize)> = Vec::new();
        points.push((history[0], 0));
        
        let mut last_direction: Option<bool> = None; // true = rising, false = falling
        let mut last_extreme_idx = 0;
        let mut last_extreme_val = history[0];
        
        for i in 1..history.len() {
            let current = history[i];
            let diff = current - last_extreme_val;
            
            if diff.abs() < self.hysteresis {
                continue;
            }
            
            let rising = diff > 0.0;
            
            match last_direction {
                None => {
                    last_direction = Some(rising);
                    last_extreme_val = current;
                    last_extreme_idx = i;
                }
                Some(was_rising) => {
                    if was_rising != rising {
                        // Direction changed - record the extreme point
                        points.push((last_extreme_val, last_extreme_idx));
                        last_direction = Some(rising);
                    }
                    last_extreme_val = current;
                    last_extreme_idx = i;
                }
            }
        }
        
        // Add last point
        points.push((history[history.len() - 1], history.len() - 1));
        
        // Remove consecutive duplicates
        points.dedup_by(|a, b| (a.0 - b.0).abs() < 1e-14);
        
        points
    }
    
    /// Four-point rainflow counting
    pub fn count(&self, history: &[f64]) -> RainflowResult {
        let points = self.extract_turning_points(history);
        
        if points.len() < 4 {
            return RainflowResult {
                cycles: Vec::new(),
                residue: points,
                total_count: 0.0,
            };
        }
        
        let mut cycles: Vec<ExtendedCycle> = Vec::new();
        let mut stack: Vec<(f64, usize)> = Vec::new();
        
        for &(value, idx) in &points {
            stack.push((value, idx));
            
            while stack.len() >= 4 {
                let n = stack.len();
                let (s0_val, _s0_idx) = stack[n - 4];
                let (s1_val, s1_idx) = stack[n - 3];
                let (s2_val, s2_idx) = stack[n - 2];
                let (_s3_val, _s3_idx) = stack[n - 1];
                
                let range_inner = (s1_val - s2_val).abs();
                let range_outer = (s0_val - s1_val).abs();
                
                if range_inner <= range_outer {
                    // Inner range forms a complete cycle
                    let min = s1_val.min(s2_val);
                    let max = s1_val.max(s2_val);
                    cycles.push(ExtendedCycle::from_extremes(min, max, 1.0, s1_idx, s2_idx));
                    
                    // Remove the two middle points
                    stack.remove(n - 3);
                    stack.remove(n - 3);
                } else {
                    break;
                }
            }
        }
        
        // Process residue if requested
        if self.include_residue && stack.len() >= 2 {
            self.process_residue(&stack, &mut cycles);
        }
        
        let total_count = cycles.iter().map(|c| c.count).sum();
        
        RainflowResult {
            cycles,
            residue: stack,
            total_count,
        }
    }
    
    fn process_residue(&self, stack: &[(f64, usize)], cycles: &mut Vec<ExtendedCycle>) {
        if stack.len() < 2 {
            return;
        }
        
        // Create wrapped sequence
        let mut extended: Vec<(f64, usize)> = stack.to_vec();
        extended.extend(stack.iter().skip(1));
        
        let mut processed = vec![false; stack.len()];
        
        for i in 0..stack.len() - 1 {
            if processed[i] {
                continue;
            }
            
            let (val_i, idx_i) = extended[i];
            let (val_j, idx_j) = extended[i + 1];
            
            let min = val_i.min(val_j);
            let max = val_i.max(val_j);
            
            // Half-cycle
            cycles.push(ExtendedCycle::from_extremes(min, max, 0.5, idx_i, idx_j));
            processed[i] = true;
        }
    }
    
    /// Count cycles from history and return summary
    pub fn analyze(&self, history: &[f64]) -> CycleAnalysisSummary {
        let result = self.count(history);
        
        if result.cycles.is_empty() {
            return CycleAnalysisSummary::empty();
        }
        
        let ranges: Vec<f64> = result.cycles.iter().map(|c| c.range).collect();
        let means: Vec<f64> = result.cycles.iter().map(|c| c.mean).collect();
        let counts: Vec<f64> = result.cycles.iter().map(|c| c.count).collect();
        
        let max_range = ranges.iter().fold(0.0_f64, |a, &b| a.max(b));
        let min_range = ranges.iter().fold(f64::MAX, |a, &b| a.min(b));
        let total_count: f64 = counts.iter().sum();
        
        let weighted_mean_range: f64 = ranges.iter().zip(counts.iter())
            .map(|(r, c)| r * c)
            .sum::<f64>() / total_count.max(1.0);
        
        // RMS range
        let rms_range = (ranges.iter().zip(counts.iter())
            .map(|(r, c)| r.powi(2) * c)
            .sum::<f64>() / total_count.max(1.0)).sqrt();
        
        CycleAnalysisSummary {
            total_cycles: total_count,
            max_range,
            min_range,
            mean_range: weighted_mean_range,
            rms_range,
            mean_of_means: means.iter().sum::<f64>() / means.len() as f64,
            max_stress: result.cycles.iter().map(|c| c.max_val).fold(f64::MIN, f64::max),
            min_stress: result.cycles.iter().map(|c| c.min_val).fold(f64::MAX, f64::min),
        }
    }
}

/// Result of rainflow counting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RainflowResult {
    /// Extracted cycles
    pub cycles: Vec<ExtendedCycle>,
    /// Residual turning points
    pub residue: Vec<(f64, usize)>,
    /// Total cycle count (including half cycles)
    pub total_count: f64,
}

impl RainflowResult {
    /// Create histogram with specified number of bins
    pub fn histogram(&self, n_bins: usize) -> CycleHistogram {
        let mut histogram = CycleHistogram::new(n_bins);
        
        if self.cycles.is_empty() {
            return histogram;
        }
        
        let max_range = self.cycles.iter()
            .map(|c| c.range)
            .fold(0.0_f64, f64::max);
        
        let bin_width = max_range / n_bins as f64;
        histogram.bin_width = bin_width;
        histogram.max_range = max_range;
        
        for cycle in &self.cycles {
            let bin_idx = if bin_width > 0.0 {
                ((cycle.range / bin_width).floor() as usize).min(n_bins - 1)
            } else {
                0
            };
            histogram.counts[bin_idx] += cycle.count;
        }
        
        histogram
    }
    
    /// Create 2D histogram (range vs mean)
    pub fn histogram_2d(&self, n_range_bins: usize, n_mean_bins: usize) -> CycleHistogram2D {
        let mut hist = CycleHistogram2D::new(n_range_bins, n_mean_bins);
        
        if self.cycles.is_empty() {
            return hist;
        }
        
        let max_range = self.cycles.iter().map(|c| c.range).fold(0.0_f64, f64::max);
        let max_mean = self.cycles.iter().map(|c| c.mean).fold(f64::MIN, f64::max);
        let min_mean = self.cycles.iter().map(|c| c.mean).fold(f64::MAX, f64::min);
        
        let range_width = max_range / n_range_bins as f64;
        let mean_width = (max_mean - min_mean) / n_mean_bins as f64;
        
        hist.range_bin_width = range_width;
        hist.mean_bin_width = mean_width;
        hist.min_mean = min_mean;
        
        for cycle in &self.cycles {
            let range_bin = if range_width > 0.0 {
                ((cycle.range / range_width).floor() as usize).min(n_range_bins - 1)
            } else {
                0
            };
            let mean_bin = if mean_width > 0.0 {
                (((cycle.mean - min_mean) / mean_width).floor() as usize).min(n_mean_bins - 1)
            } else {
                0
            };
            
            hist.counts[range_bin][mean_bin] += cycle.count;
        }
        
        hist
    }
}

/// 1D cycle histogram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleHistogram {
    pub counts: Vec<f64>,
    pub bin_width: f64,
    pub max_range: f64,
}

impl CycleHistogram {
    pub fn new(n_bins: usize) -> Self {
        CycleHistogram {
            counts: vec![0.0; n_bins],
            bin_width: 0.0,
            max_range: 0.0,
        }
    }
    
    /// Get bin edges
    pub fn bin_edges(&self) -> Vec<f64> {
        (0..=self.counts.len())
            .map(|i| i as f64 * self.bin_width)
            .collect()
    }
    
    /// Get bin centers
    pub fn bin_centers(&self) -> Vec<f64> {
        (0..self.counts.len())
            .map(|i| (i as f64 + 0.5) * self.bin_width)
            .collect()
    }
}

/// 2D cycle histogram (range vs mean)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleHistogram2D {
    pub counts: Vec<Vec<f64>>,
    pub range_bin_width: f64,
    pub mean_bin_width: f64,
    pub min_mean: f64,
}

impl CycleHistogram2D {
    pub fn new(n_range_bins: usize, n_mean_bins: usize) -> Self {
        CycleHistogram2D {
            counts: vec![vec![0.0; n_mean_bins]; n_range_bins],
            range_bin_width: 0.0,
            mean_bin_width: 0.0,
            min_mean: 0.0,
        }
    }
}

/// Summary statistics from cycle analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleAnalysisSummary {
    pub total_cycles: f64,
    pub max_range: f64,
    pub min_range: f64,
    pub mean_range: f64,
    pub rms_range: f64,
    pub mean_of_means: f64,
    pub max_stress: f64,
    pub min_stress: f64,
}

impl CycleAnalysisSummary {
    pub fn empty() -> Self {
        CycleAnalysisSummary {
            total_cycles: 0.0,
            max_range: 0.0,
            min_range: 0.0,
            mean_range: 0.0,
            rms_range: 0.0,
            mean_of_means: 0.0,
            max_stress: 0.0,
            min_stress: 0.0,
        }
    }
}

// ============================================================================
// CYCLE SEQUENCE EFFECTS
// ============================================================================

/// Load interaction effects beyond Miner's rule
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SequenceEffect {
    /// Pure Miner's rule (no sequence effects)
    None,
    /// Marco-Starkey (high-low sequence beneficial)
    MarcoStarkey,
    /// Manson-Halford (DCA)
    DoubleLinear,
    /// Corten-Dolan
    CortenDolan,
}

/// Apply load sequence correction to damage
pub fn apply_sequence_correction(
    damage: f64,
    sequence_effect: SequenceEffect,
    cycle_stats: &CycleAnalysisSummary,
) -> f64 {
    match sequence_effect {
        SequenceEffect::None => damage,
        SequenceEffect::MarcoStarkey => {
            // Interaction factor depends on load ratio
            let q = cycle_stats.rms_range / cycle_stats.max_range;
            damage * (1.0 + 0.5 * (1.0 - q))
        }
        SequenceEffect::DoubleLinear => {
            // Manson double-linear rule
            let q = 0.35; // Typically between 0.25-0.45
            damage.powf(q)
        }
        SequenceEffect::CortenDolan => {
            // Corten-Dolan approach
            let d = 0.6; // Material constant
            damage.powf(d)
        }
    }
}

// ============================================================================
// VARIABLE AMPLITUDE LOADING SPECTRA
// ============================================================================

/// Standard loading spectrum types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadingSpectrum {
    /// Constant amplitude
    Constant { amplitude: f64, mean: f64, cycles: f64 },
    /// TWIST (Transport Wing Standard)
    Twist { severity: f64 },
    /// FALSTAFF (Fighter Aircraft Loading Standard)
    Falstaff { severity: f64 },
    /// WASH (Wing And Horizontal Standard)
    Wash { severity: f64 },
    /// Custom spectrum
    Custom { cycles: Vec<ExtendedCycle> },
}

impl LoadingSpectrum {
    /// Generate representative cycles
    pub fn generate_cycles(&self, base_stress: f64) -> Vec<ExtendedCycle> {
        match self {
            LoadingSpectrum::Constant { amplitude, mean, cycles } => {
                vec![ExtendedCycle::from_extremes(
                    mean - amplitude,
                    mean + amplitude,
                    *cycles,
                    0,
                    1,
                )]
            }
            LoadingSpectrum::Twist { severity } => {
                // Simplified TWIST spectrum
                let mut cycles = Vec::new();
                let levels = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25];
                let counts = [10.0, 50.0, 200.0, 1000.0, 5000.0, 20000.0];
                
                for (i, &level) in levels.iter().enumerate() {
                    let amp = level * severity * base_stress;
                    cycles.push(ExtendedCycle::from_extremes(
                        -amp * 0.1,
                        amp,
                        counts[i],
                        0,
                        1,
                    ));
                }
                cycles
            }
            LoadingSpectrum::Falstaff { severity } => {
                // Simplified FALSTAFF spectrum
                let mut cycles = Vec::new();
                let levels = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
                let counts = [1.0, 5.0, 20.0, 100.0, 500.0, 2000.0, 10000.0, 50000.0];
                
                for (i, &level) in levels.iter().enumerate() {
                    let amp = level * severity * base_stress;
                    cycles.push(ExtendedCycle::from_extremes(
                        -amp * 0.2,
                        amp,
                        counts[i],
                        0,
                        1,
                    ));
                }
                cycles
            }
            LoadingSpectrum::Wash { severity } => {
                // Simplified WASH spectrum for transport aircraft
                let mut cycles = Vec::new();
                let levels = [1.0, 0.8, 0.6, 0.4, 0.2];
                let counts = [100.0, 1000.0, 10000.0, 100000.0, 1000000.0];
                
                for (i, &level) in levels.iter().enumerate() {
                    let amp = level * severity * base_stress;
                    cycles.push(ExtendedCycle::from_extremes(
                        amp * 0.5, // Positive mean for ground-air-ground
                        amp * 1.5,
                        counts[i],
                        0,
                        1,
                    ));
                }
                cycles
            }
            LoadingSpectrum::Custom { cycles } => cycles.clone(),
        }
    }
}

// ============================================================================
// EQUIVALENT STRESS RANGE
// ============================================================================

/// Calculate equivalent constant amplitude stress range
pub fn equivalent_stress_range(cycles: &[ExtendedCycle], m: f64) -> f64 {
    let total_n: f64 = cycles.iter().map(|c| c.count).sum();
    if total_n < 1e-14 {
        return 0.0;
    }
    
    let sum_ni_si_m: f64 = cycles.iter()
        .map(|c| c.count * c.range.powf(m))
        .sum();
    
    (sum_ni_si_m / total_n).powf(1.0 / m)
}

/// Calculate damage-equivalent stress range (with cutoff)
pub fn damage_equivalent_stress_range(
    cycles: &[ExtendedCycle],
    m: f64,
    cutoff_ratio: f64, // Fraction of max range below which cycles are ignored
) -> f64 {
    let max_range = cycles.iter()
        .map(|c| c.range)
        .fold(0.0_f64, f64::max);
    
    let cutoff = max_range * cutoff_ratio;
    
    let filtered: Vec<&ExtendedCycle> = cycles.iter()
        .filter(|c| c.range >= cutoff)
        .collect();
    
    let total_n: f64 = filtered.iter().map(|c| c.count).sum();
    if total_n < 1e-14 {
        return 0.0;
    }
    
    let sum_ni_si_m: f64 = filtered.iter()
        .map(|c| c.count * c.range.powf(m))
        .sum();
    
    (sum_ni_si_m / total_n).powf(1.0 / m)
}

// ============================================================================
// STRESS SPECTRUM SCALING
// ============================================================================

/// Scale a stress spectrum to a reference life
pub fn scale_spectrum_to_life(
    cycles: &[ExtendedCycle],
    target_life: f64, // blocks
    m: f64,
    current_damage: f64,
) -> Vec<ExtendedCycle> {
    if current_damage < 1e-14 || target_life < 1e-14 {
        return cycles.to_vec();
    }
    
    // Scale factor: new_range = old_range * k
    // Damage ~ Σ n * range^m
    // For target life: Σ n * (k*range)^m = 1/target_life
    // k^m * Σ n * range^m = 1/target_life
    // k^m = 1/(target_life * current_damage)
    // k = (1/(target_life * current_damage))^(1/m)
    
    let scale_factor = (1.0 / (target_life * current_damage)).powf(1.0 / m);
    
    cycles.iter()
        .map(|c| {
            let new_range = c.range * scale_factor;
            let new_amp = new_range / 2.0;
            ExtendedCycle {
                range: new_range,
                amplitude: new_amp,
                max_val: c.mean + new_amp,
                min_val: c.mean - new_amp,
                ..*c
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_turning_points() {
        let counter = AdvancedRainflowCounter::new();
        let history = vec![0.0, 5.0, 3.0, 8.0, 2.0, 6.0, 0.0];
        
        let points = counter.extract_turning_points(&history);
        
        assert!(points.len() >= 4); // Start, peaks, valleys, end
    }
    
    #[test]
    fn test_simple_cycle() {
        let counter = AdvancedRainflowCounter::new();
        // Complete sine wave
        let history: Vec<f64> = (0..101)
            .map(|i| 100.0 * (2.0 * std::f64::consts::PI * i as f64 / 100.0).sin())
            .collect();
        
        let result = counter.count(&history);
        
        // Should extract approximately 1 cycle
        assert!(result.total_count >= 0.5);
    }
    
    #[test]
    fn test_multiple_cycles() {
        let counter = AdvancedRainflowCounter::new();
        let history = vec![
            0.0, 100.0, 0.0, 100.0, 0.0, 100.0, 0.0,
            50.0, 80.0, 50.0, // Inner cycle
            100.0, 0.0,
        ];
        
        let result = counter.count(&history);
        
        assert!(!result.cycles.is_empty());
    }
    
    #[test]
    fn test_histogram() {
        let counter = AdvancedRainflowCounter::new();
        let history = vec![0.0, 100.0, 0.0, 80.0, 20.0, 100.0, 0.0, 60.0, 40.0];
        
        let result = counter.count(&history);
        let hist = result.histogram(10);
        
        assert_eq!(hist.counts.len(), 10);
    }
    
    #[test]
    fn test_analysis_summary() {
        let counter = AdvancedRainflowCounter::new();
        let history = vec![0.0, 100.0, 0.0, 100.0, 0.0, 100.0, 0.0];
        
        let summary = counter.analyze(&history);
        
        assert!(summary.total_cycles >= 2.0);
        assert!((summary.max_range - 100.0).abs() < 1.0);
    }
    
    #[test]
    fn test_equivalent_stress_range() {
        let cycles = vec![
            ExtendedCycle::from_extremes(0.0, 100.0, 100.0, 0, 1),
            ExtendedCycle::from_extremes(0.0, 50.0, 1000.0, 0, 1),
        ];
        
        let seq = equivalent_stress_range(&cycles, 3.0);
        
        // Should be between 50 and 100
        assert!(seq > 50.0 && seq < 100.0);
    }
    
    #[test]
    fn test_loading_spectrum() {
        let spectrum = LoadingSpectrum::Twist { severity: 1.0 };
        let cycles = spectrum.generate_cycles(100.0);
        
        assert!(!cycles.is_empty());
    }
    
    #[test]
    fn test_hysteresis() {
        let counter = AdvancedRainflowCounter::new().with_hysteresis(5.0);
        // Small oscillations should be filtered
        let history = vec![0.0, 2.0, 0.0, 100.0, 98.0, 100.0, 0.0];
        
        let points = counter.extract_turning_points(&history);
        
        // Small oscillations (2 and 98-100) should be filtered
        assert!(points.len() < 7);
    }
}
