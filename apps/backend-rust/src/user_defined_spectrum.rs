//! User-Defined Response Spectrum
//!
//! Provides capability to input arbitrary Sa-T curves beyond code-based spectra,
//! matching STAAD.Pro's custom spectrum functionality for:
//! - Site-specific PSHA results
//! - Nuclear facility spectra (NRC RG 1.60)
//! - Recorded ground motion spectra
//! - Probabilistic hazard spectra (MCE, DBE, OBE)
//!
//! ## Features

#![allow(non_camel_case_types)] // Industry-standard code names: NRC_RG160
//! - Arbitrary Sa-T point input with interpolation
//! - Multiple interpolation methods (linear, log-linear, log-log)
//! - Spectrum enveloping and scaling
//! - UHS (Uniform Hazard Spectrum) support
//! - Multi-damping spectrum families

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// USER-DEFINED SPECTRUM
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum InterpolationType {
    /// Linear interpolation (T, Sa)
    Linear,
    /// Log-Linear (log T, linear Sa)
    LogLinear,
    /// Log-Log (log T, log Sa)
    LogLog,
    /// Semi-log (linear T, log Sa)
    SemiLog,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SpectrumType {
    /// Design Basis Earthquake
    DBE,
    /// Maximum Credible Earthquake
    MCE,
    /// Operating Basis Earthquake
    OBE,
    /// Service Level Earthquake
    SLE,
    /// Uniform Hazard Spectrum
    UHS,
    /// Site-Specific (PSHA)
    SiteSpecific,
    /// NRC RG 1.60 (Nuclear)
    NRC_RG160,
    /// Recorded Ground Motion
    RecordedMotion,
    /// User Defined
    UserDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpectrumPoint {
    /// Period (seconds)
    pub period: f64,
    /// Spectral acceleration (g or m/s²)
    pub sa: f64,
    /// Optional: Spectral velocity (m/s)
    pub sv: Option<f64>,
    /// Optional: Spectral displacement (m)
    pub sd: Option<f64>,
}

impl SpectrumPoint {
    pub fn new(period: f64, sa: f64) -> Self {
        SpectrumPoint {
            period,
            sa,
            sv: None,
            sd: None,
        }
    }
    
    /// Create with derived Sv and Sd (for SDOF systems)
    pub fn with_derived_values(period: f64, sa: f64) -> Self {
        let omega = 2.0 * PI / period.max(0.001);
        let sa_ms2 = sa * 9.81; // Convert g to m/s²
        let sv = sa_ms2 / omega;
        let sd = sa_ms2 / omega.powi(2);
        
        SpectrumPoint {
            period,
            sa,
            sv: Some(sv),
            sd: Some(sd),
        }
    }
}

/// User-defined response spectrum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDefinedSpectrum {
    /// Spectrum name/identifier
    pub name: String,
    /// Spectrum type
    pub spectrum_type: SpectrumType,
    /// Damping ratio (0.05 = 5%)
    pub damping: f64,
    /// Spectrum points (must be sorted by period)
    pub points: Vec<SpectrumPoint>,
    /// Interpolation method
    pub interpolation: InterpolationType,
    /// Scale factor
    pub scale_factor: f64,
    /// Units: true if Sa in g, false if m/s²
    pub sa_in_g: bool,
    /// Return period (years) for probabilistic spectra
    pub return_period: Option<f64>,
    /// Source description
    pub source: Option<String>,
}

impl UserDefinedSpectrum {
    /// Create new user-defined spectrum
    pub fn new(name: &str) -> Self {
        UserDefinedSpectrum {
            name: name.to_string(),
            spectrum_type: SpectrumType::UserDefined,
            damping: 0.05,
            points: Vec::new(),
            interpolation: InterpolationType::LogLinear,
            scale_factor: 1.0,
            sa_in_g: true,
            return_period: None,
            source: None,
        }
    }
    
    /// Create from period-Sa pairs
    pub fn from_points(name: &str, periods: &[f64], sa_values: &[f64]) -> Self {
        let mut spectrum = Self::new(name);
        for (&t, &sa) in periods.iter().zip(sa_values.iter()) {
            spectrum.add_point(t, sa);
        }
        spectrum.sort_points();
        spectrum
    }
    
    /// Add a spectrum point
    pub fn add_point(&mut self, period: f64, sa: f64) {
        self.points.push(SpectrumPoint::new(period, sa));
    }
    
    /// Sort points by period
    pub fn sort_points(&mut self) {
        self.points.sort_by(|a, b| a.period.partial_cmp(&b.period).unwrap_or(std::cmp::Ordering::Equal));
    }
    
    /// Get spectral acceleration at given period
    pub fn get_sa(&self, period: f64) -> f64 {
        if self.points.is_empty() {
            return 0.0;
        }
        
        let n = self.points.len();
        
        // Handle edge cases
        if period <= self.points[0].period {
            return self.points[0].sa * self.scale_factor;
        }
        if period >= self.points[n - 1].period {
            // Extrapolate using 1/T decay
            let t_last = self.points[n - 1].period;
            let sa_last = self.points[n - 1].sa;
            return sa_last * t_last / period * self.scale_factor;
        }
        
        // Find bracketing points
        for i in 0..(n - 1) {
            if period >= self.points[i].period && period <= self.points[i + 1].period {
                let sa = self.interpolate(
                    self.points[i].period,
                    self.points[i].sa,
                    self.points[i + 1].period,
                    self.points[i + 1].sa,
                    period,
                );
                return sa * self.scale_factor;
            }
        }
        
        self.points[n - 1].sa * self.scale_factor
    }
    
    /// Interpolate between two points
    fn interpolate(&self, t1: f64, sa1: f64, t2: f64, sa2: f64, t: f64) -> f64 {
        // Handle exact matches to avoid floating point issues
        if (t - t1).abs() < 1e-10 {
            return sa1;
        }
        if (t - t2).abs() < 1e-10 {
            return sa2;
        }
        
        // For log-based interpolation, fall back to linear if any period is near zero
        let use_linear = t1 < 1e-10 || t2 < 1e-10 || t < 1e-10;
        
        match self.interpolation {
            InterpolationType::Linear => {
                let ratio = (t - t1) / (t2 - t1);
                sa1 + ratio * (sa2 - sa1)
            }
            InterpolationType::LogLinear => {
                if use_linear {
                    let ratio = (t - t1) / (t2 - t1);
                    sa1 + ratio * (sa2 - sa1)
                } else {
                    let log_t1 = t1.ln();
                    let log_t2 = t2.ln();
                    let log_t = t.ln();
                    let ratio = (log_t - log_t1) / (log_t2 - log_t1);
                    sa1 + ratio * (sa2 - sa1)
                }
            }
            InterpolationType::LogLog => {
                if use_linear {
                    let ratio = (t - t1) / (t2 - t1);
                    sa1 + ratio * (sa2 - sa1)
                } else {
                    let log_t1 = t1.ln();
                    let log_t2 = t2.ln();
                    let log_t = t.ln();
                    let log_sa1 = sa1.max(1e-10).ln();
                    let log_sa2 = sa2.max(1e-10).ln();
                    let ratio = (log_t - log_t1) / (log_t2 - log_t1);
                    (log_sa1 + ratio * (log_sa2 - log_sa1)).exp()
                }
            }
            InterpolationType::SemiLog => {
                let ratio = (t - t1) / (t2 - t1);
                let log_sa1 = sa1.max(1e-10).ln();
                let log_sa2 = sa2.max(1e-10).ln();
                (log_sa1 + ratio * (log_sa2 - log_sa1)).exp()
            }
        }
    }
    
    /// Get spectral velocity at given period
    pub fn get_sv(&self, period: f64) -> f64 {
        let sa = self.get_sa(period);
        let sa_ms2 = if self.sa_in_g { sa * 9.81 } else { sa };
        let omega = 2.0 * PI / period.max(0.001);
        sa_ms2 / omega
    }
    
    /// Get spectral displacement at given period
    pub fn get_sd(&self, period: f64) -> f64 {
        let sa = self.get_sa(period);
        let sa_ms2 = if self.sa_in_g { sa * 9.81 } else { sa };
        let omega = 2.0 * PI / period.max(0.001);
        sa_ms2 / omega.powi(2)
    }
    
    /// Scale spectrum to target PGA
    pub fn scale_to_pga(&mut self, target_pga: f64) {
        let current_pga = self.get_sa(0.0);
        if current_pga > 1e-10 {
            self.scale_factor *= target_pga / current_pga;
        }
    }
    
    /// Scale spectrum to target Sa at specific period
    pub fn scale_to_sa(&mut self, target_sa: f64, at_period: f64) {
        let current_sa = self.get_sa(at_period);
        if current_sa > 1e-10 {
            self.scale_factor *= target_sa / current_sa;
        }
    }
    
    /// Validate spectrum data
    pub fn validate(&self) -> Result<(), String> {
        if self.points.is_empty() {
            return Err("Spectrum has no points".to_string());
        }
        
        if self.points.len() < 2 {
            return Err("Spectrum needs at least 2 points".to_string());
        }
        
        for (i, point) in self.points.iter().enumerate() {
            if point.period < 0.0 {
                return Err(format!("Point {} has negative period", i));
            }
            if point.sa < 0.0 {
                return Err(format!("Point {} has negative Sa", i));
            }
        }
        
        // Check monotonically increasing periods
        for i in 1..self.points.len() {
            if self.points[i].period <= self.points[i - 1].period {
                return Err(format!(
                    "Periods not monotonically increasing at points {} and {}",
                    i - 1, i
                ));
            }
        }
        
        Ok(())
    }
}

// ============================================================================
// MULTI-DAMPING SPECTRUM FAMILY
// ============================================================================

/// Family of spectra for different damping ratios
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpectrumFamily {
    /// Base spectrum at reference damping
    pub base_spectrum: UserDefinedSpectrum,
    /// Reference damping ratio
    pub reference_damping: f64,
    /// Additional damping ratios with their spectra
    pub damping_spectra: Vec<(f64, UserDefinedSpectrum)>,
}

impl SpectrumFamily {
    /// Create family from base spectrum
    pub fn new(base_spectrum: UserDefinedSpectrum) -> Self {
        let reference_damping = base_spectrum.damping;
        SpectrumFamily {
            base_spectrum,
            reference_damping,
            damping_spectra: Vec::new(),
        }
    }
    
    /// Add spectrum for different damping
    pub fn add_damping_spectrum(&mut self, damping: f64, spectrum: UserDefinedSpectrum) {
        self.damping_spectra.push((damping, spectrum));
    }
    
    /// Generate spectrum for arbitrary damping using scaling
    pub fn get_spectrum_for_damping(&self, damping: f64) -> UserDefinedSpectrum {
        // Check if exact match exists
        if (damping - self.reference_damping).abs() < 0.001 {
            return self.base_spectrum.clone();
        }
        
        for &(d, ref spectrum) in &self.damping_spectra {
            if (damping - d).abs() < 0.001 {
                return spectrum.clone();
            }
        }
        
        // Scale using damping correction factor
        let eta = damping_correction_factor(damping, self.reference_damping);
        let mut scaled = self.base_spectrum.clone();
        scaled.scale_factor *= eta;
        scaled.damping = damping;
        scaled
    }
}

/// Damping correction factor (EC8 approach)
pub fn damping_correction_factor(target_damping: f64, reference_damping: f64) -> f64 {
    // η = sqrt(10 / (5 + ξ*100)) where ξ is damping ratio
    // For 5% reference: η = sqrt(10 / (5 + 5)) = 1.0
    // For 2% : η = sqrt(10 / (5 + 2)) ≈ 1.20
    // For 10%: η = sqrt(10 / (5 + 10)) ≈ 0.82
    
    let ref_factor = (10.0 / (5.0 + reference_damping * 100.0)).sqrt();
    let target_factor = (10.0 / (5.0 + target_damping * 100.0)).sqrt();
    
    target_factor / ref_factor
}

// ============================================================================
// NRC RG 1.60 NUCLEAR SPECTRUM
// ============================================================================

/// NRC Regulatory Guide 1.60 spectrum for nuclear facilities
pub fn create_nrc_rg160_spectrum(pga: f64, damping: f64) -> UserDefinedSpectrum {
    // NRC RG 1.60 defines spectral amplification factors
    // These are for horizontal motion at 5% damping
    
    let mut spectrum = UserDefinedSpectrum::new("NRC RG 1.60");
    spectrum.spectrum_type = SpectrumType::NRC_RG160;
    spectrum.damping = damping;
    spectrum.source = Some("NRC Regulatory Guide 1.60, Rev 2".to_string());
    
    // Control periods and amplification factors for 5% damping
    let t_values = [0.0, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 1.0, 2.0, 3.0, 5.0, 10.0];
    let amp_5pct = [1.0, 1.0, 1.87, 2.77, 2.77, 2.77, 2.50, 1.60, 0.80, 0.53, 0.32, 0.16];
    
    // Damping correction factors from RG 1.60
    let damping_factor = match (damping * 100.0).round() as i32 {
        1 => 1.70,
        2 => 1.40,
        3 => 1.22,
        5 => 1.00,
        7 => 0.87,
        10 => 0.73,
        _ => (10.0 / (5.0 + damping * 100.0)).sqrt().min(1.70).max(0.50),
    };
    
    for (&t, &amp) in t_values.iter().zip(amp_5pct.iter()) {
        let sa = pga * amp * damping_factor;
        spectrum.add_point(t, sa);
    }
    
    spectrum.sort_points();
    spectrum
}

// ============================================================================
// UNIFORM HAZARD SPECTRUM (UHS)
// ============================================================================

/// Uniform Hazard Spectrum from PSHA
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniformHazardSpectrum {
    /// UHS for different return periods
    pub spectra: Vec<(f64, UserDefinedSpectrum)>,
    /// Location description
    pub location: String,
    /// Latitude
    pub latitude: Option<f64>,
    /// Longitude  
    pub longitude: Option<f64>,
    /// Site class
    pub site_class: Option<String>,
    /// PSHA source
    pub psha_source: Option<String>,
}

impl UniformHazardSpectrum {
    pub fn new(location: &str) -> Self {
        UniformHazardSpectrum {
            spectra: Vec::new(),
            location: location.to_string(),
            latitude: None,
            longitude: None,
            site_class: None,
            psha_source: None,
        }
    }
    
    /// Add UHS for specific return period
    pub fn add_spectrum(&mut self, return_period: f64, mut spectrum: UserDefinedSpectrum) {
        spectrum.spectrum_type = SpectrumType::UHS;
        spectrum.return_period = Some(return_period);
        self.spectra.push((return_period, spectrum));
    }
    
    /// Get spectrum for specific return period (interpolates if needed)
    pub fn get_spectrum(&self, return_period: f64) -> Option<UserDefinedSpectrum> {
        if self.spectra.is_empty() {
            return None;
        }
        
        // Exact match
        for &(rp, ref spectrum) in &self.spectra {
            if (rp - return_period).abs() < 1.0 {
                return Some(spectrum.clone());
            }
        }
        
        // Log-linear interpolation in return period
        let mut sorted: Vec<_> = self.spectra.iter().collect();
        sorted.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        
        if return_period <= sorted[0].0 {
            return Some(sorted[0].1.clone());
        }
        if return_period >= sorted[sorted.len() - 1].0 {
            return Some(sorted[sorted.len() - 1].1.clone());
        }
        
        // Find bracketing return periods
        for i in 0..(sorted.len() - 1) {
            if return_period >= sorted[i].0 && return_period <= sorted[i + 1].0 {
                // Interpolate in log space
                let log_rp1 = sorted[i].0.ln();
                let log_rp2 = sorted[i + 1].0.ln();
                let log_rp = return_period.ln();
                let ratio = (log_rp - log_rp1) / (log_rp2 - log_rp1);
                
                // Create interpolated spectrum
                let mut result = sorted[i].1.clone();
                result.return_period = Some(return_period);
                
                // Interpolate each Sa value
                for (j, point) in result.points.iter_mut().enumerate() {
                    if j < sorted[i + 1].1.points.len() {
                        let sa1 = sorted[i].1.points[j].sa;
                        let sa2 = sorted[i + 1].1.points[j].sa;
                        point.sa = sa1 + ratio * (sa2 - sa1);
                    }
                }
                
                return Some(result);
            }
        }
        
        None
    }
}

// ============================================================================
// SPECTRUM ENVELOPE
// ============================================================================

/// Create envelope of multiple spectra
pub fn envelope_spectra(spectra: &[UserDefinedSpectrum]) -> UserDefinedSpectrum {
    if spectra.is_empty() {
        return UserDefinedSpectrum::new("Empty Envelope");
    }
    
    // Collect all unique periods
    let mut all_periods: Vec<f64> = spectra
        .iter()
        .flat_map(|s| s.points.iter().map(|p| p.period))
        .collect();
    all_periods.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    all_periods.dedup_by(|a, b| (*a - *b).abs() < 0.0001);
    
    // Create envelope
    let mut envelope = UserDefinedSpectrum::new("Spectrum Envelope");
    envelope.spectrum_type = SpectrumType::UserDefined;
    
    for t in all_periods {
        let max_sa = spectra
            .iter()
            .map(|s| s.get_sa(t))
            .fold(0.0_f64, f64::max);
        envelope.add_point(t, max_sa);
    }
    
    envelope.sort_points();
    envelope
}

// ============================================================================
// SPECTRUM FROM GROUND MOTION
// ============================================================================

/// Generate response spectrum from ground motion time history
pub fn spectrum_from_time_history(
    acceleration: &[f64],
    dt: f64,
    damping: f64,
    periods: &[f64],
) -> UserDefinedSpectrum {
    let mut spectrum = UserDefinedSpectrum::new("Time History Spectrum");
    spectrum.spectrum_type = SpectrumType::RecordedMotion;
    spectrum.damping = damping;
    spectrum.sa_in_g = false; // m/s²
    
    for &period in periods {
        let sa = compute_sdof_max_response(acceleration, dt, period, damping);
        spectrum.add_point(period, sa);
    }
    
    spectrum.sort_points();
    spectrum
}

/// Compute maximum SDOF response (Newmark-beta integration)
fn compute_sdof_max_response(
    acceleration: &[f64],
    dt: f64,
    period: f64,
    damping: f64,
) -> f64 {
    if period < 0.001 {
        // ZPA (zero period acceleration)
        return acceleration.iter().map(|a| a.abs()).fold(0.0_f64, f64::max);
    }
    
    let omega = 2.0 * PI / period;
    let _omega_d = omega * (1.0 - damping.powi(2)).sqrt();
    let c = 2.0 * damping * omega;
    let k = omega.powi(2);
    
    // Newmark-beta constants (average acceleration)
    let beta = 0.25;
    let gamma = 0.5;
    
    let a1 = 1.0 / (beta * dt.powi(2)) + gamma * c / (beta * dt);
    let a2 = 1.0 / (beta * dt) + (gamma / beta - 1.0) * c;
    let a3 = (1.0 / (2.0 * beta) - 1.0) + dt * (gamma / (2.0 * beta) - 1.0) * c;
    
    let k_eff = k + a1;
    
    let mut u = 0.0;
    let mut v = 0.0;
    let mut a = 0.0;
    let mut max_abs_a: f64 = 0.0;
    
    for &ag in acceleration {
        let p_eff = -ag + a1 * u + a2 * v + a3 * a;
        let u_new = p_eff / k_eff;
        let v_new = gamma / (beta * dt) * (u_new - u) + (1.0 - gamma / beta) * v + dt * (1.0 - gamma / (2.0 * beta)) * a;
        let a_new = (u_new - u) / (beta * dt.powi(2)) - v / (beta * dt) - (1.0 / (2.0 * beta) - 1.0) * a;
        
        // Total acceleration = relative + ground
        let total_a = (a_new + ag).abs();
        max_abs_a = max_abs_a.max(total_a);
        
        u = u_new;
        v = v_new;
        a = a_new;
    }
    
    max_abs_a
}

// ============================================================================
// STANDARD SPECTRUM IMPORT FORMATS
// ============================================================================

/// Parse spectrum from CSV format (Period, Sa)
pub fn parse_spectrum_csv(csv_data: &str, name: &str) -> Result<UserDefinedSpectrum, String> {
    let mut spectrum = UserDefinedSpectrum::new(name);
    
    for (line_num, line) in csv_data.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("Period") {
            continue;
        }
        
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 2 {
            continue;
        }
        
        let period: f64 = parts[0].trim().parse()
            .map_err(|_| format!("Invalid period at line {}", line_num + 1))?;
        let sa: f64 = parts[1].trim().parse()
            .map_err(|_| format!("Invalid Sa at line {}", line_num + 1))?;
        
        spectrum.add_point(period, sa);
    }
    
    if spectrum.points.is_empty() {
        return Err("No valid spectrum points found".to_string());
    }
    
    spectrum.sort_points();
    spectrum.validate()?;
    
    Ok(spectrum)
}

/// Parse PEER NGA format spectrum
pub fn parse_peer_nga_spectrum(data: &str, name: &str) -> Result<UserDefinedSpectrum, String> {
    let mut spectrum = UserDefinedSpectrum::new(name);
    spectrum.source = Some("PEER NGA Database".to_string());
    
    let lines: Vec<&str> = data.lines().collect();
    let mut data_start = 0;
    
    // Find data start (after header)
    for (i, line) in lines.iter().enumerate() {
        if line.contains("PERIOD") || line.contains("T(SEC)") {
            data_start = i + 1;
            break;
        }
    }
    
    for line in &lines[data_start..] {
        let parts: Vec<f64> = line
            .split_whitespace()
            .filter_map(|s| s.parse().ok())
            .collect();
        
        if parts.len() >= 2 {
            spectrum.add_point(parts[0], parts[1]);
        }
    }
    
    if spectrum.points.is_empty() {
        return Err("No valid spectrum points found in PEER format".to_string());
    }
    
    spectrum.sort_points();
    Ok(spectrum)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_user_defined_spectrum() {
        let mut spectrum = UserDefinedSpectrum::new("Test");
        spectrum.add_point(0.0, 0.5);
        spectrum.add_point(0.2, 1.2);
        spectrum.add_point(0.5, 1.0);
        spectrum.add_point(1.0, 0.6);
        spectrum.add_point(2.0, 0.3);
        spectrum.sort_points();
        
        assert!(spectrum.validate().is_ok());
        
        // Test interpolation
        let sa_03 = spectrum.get_sa(0.3);
        assert!(sa_03 > 0.9 && sa_03 < 1.2);
        
        // Test ZPA
        let pga = spectrum.get_sa(0.0);
        assert!((pga - 0.5).abs() < 0.01);
    }
    
    #[test]
    fn test_spectrum_scaling() {
        let mut spectrum = UserDefinedSpectrum::from_points(
            "Test",
            &[0.0, 0.2, 0.5, 1.0],
            &[0.4, 1.0, 0.8, 0.5],
        );
        
        spectrum.scale_to_pga(0.6);
        let new_pga = spectrum.get_sa(0.0);
        assert!((new_pga - 0.6).abs() < 0.01);
    }
    
    #[test]
    fn test_nrc_rg160() {
        let spectrum = create_nrc_rg160_spectrum(0.3, 0.05);
        
        assert!(spectrum.validate().is_ok());
        assert!((spectrum.get_sa(0.0) - 0.3).abs() < 0.01);
        
        // Check amplification at plateau
        let sa_02 = spectrum.get_sa(0.2);
        assert!(sa_02 > 0.7); // Should be amplified
    }
    
    #[test]
    fn test_spectrum_envelope() {
        let s1 = UserDefinedSpectrum::from_points(
            "S1",
            &[0.1, 0.5, 1.0],
            &[0.3, 1.0, 0.5],
        );
        
        let s2 = UserDefinedSpectrum::from_points(
            "S2",
            &[0.1, 0.5, 1.0],
            &[0.4, 0.8, 0.7],
        );
        
        let envelope = envelope_spectra(&[s1, s2]);
        
        assert!((envelope.get_sa(0.1) - 0.4).abs() < 0.01);
        assert!((envelope.get_sa(0.5) - 1.0).abs() < 0.01);
        assert!((envelope.get_sa(1.0) - 0.7).abs() < 0.01);
    }
    
    #[test]
    fn test_damping_correction() {
        let factor_2pct = damping_correction_factor(0.02, 0.05);
        let factor_10pct = damping_correction_factor(0.10, 0.05);
        
        assert!(factor_2pct > 1.0); // Higher for lower damping
        assert!(factor_10pct < 1.0); // Lower for higher damping
    }
    
    #[test]
    fn test_csv_parse() {
        let csv = "Period, Sa\n0.0, 0.4\n0.2, 1.0\n0.5, 0.8\n1.0, 0.5";
        let spectrum = parse_spectrum_csv(csv, "Test").unwrap();
        
        assert_eq!(spectrum.points.len(), 4);
        assert!((spectrum.get_sa(0.0) - 0.4).abs() < 0.01);
    }
}
