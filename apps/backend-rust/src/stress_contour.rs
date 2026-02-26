//! Stress Contour Generation
//!
//! Post-processing module for generating stress contour data from
//! FEA results for visualization in VTK/ParaView or web viewers.
//!
//! ## Features
//! - Von Mises stress calculation
//! - Principal stresses (σ1, σ2, σ3)
//! - Tresca (max shear) stress
//! - Octahedral shear stress
//! - Stress invariants (I1, I2, I3)
//! - Contour band generation
//! - VTK cell/point data output
//! - Color mapping (jet, rainbow, viridis)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// STRESS TENSOR
// ============================================================================

/// 3D stress tensor (6 components: σxx, σyy, σzz, τxy, τyz, τzx)
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct StressTensor {
    /// Normal stress in X direction (MPa)
    pub sigma_xx: f64,
    /// Normal stress in Y direction (MPa)
    pub sigma_yy: f64,
    /// Normal stress in Z direction (MPa)
    pub sigma_zz: f64,
    /// Shear stress XY (MPa)
    pub tau_xy: f64,
    /// Shear stress YZ (MPa)
    pub tau_yz: f64,
    /// Shear stress ZX (MPa)
    pub tau_zx: f64,
}

impl StressTensor {
    /// Create from components
    pub fn new(
        sigma_xx: f64, sigma_yy: f64, sigma_zz: f64,
        tau_xy: f64, tau_yz: f64, tau_zx: f64,
    ) -> Self {
        StressTensor { sigma_xx, sigma_yy, sigma_zz, tau_xy, tau_yz, tau_zx }
    }
    
    /// Create 2D plane stress tensor
    pub fn plane_stress(sigma_xx: f64, sigma_yy: f64, tau_xy: f64) -> Self {
        StressTensor {
            sigma_xx, sigma_yy, sigma_zz: 0.0,
            tau_xy, tau_yz: 0.0, tau_zx: 0.0,
        }
    }
    
    /// First stress invariant I1 = σxx + σyy + σzz
    pub fn i1(&self) -> f64 {
        self.sigma_xx + self.sigma_yy + self.sigma_zz
    }
    
    /// Second stress invariant I2
    pub fn i2(&self) -> f64 {
        self.sigma_xx * self.sigma_yy + 
        self.sigma_yy * self.sigma_zz + 
        self.sigma_zz * self.sigma_xx -
        self.tau_xy.powi(2) - 
        self.tau_yz.powi(2) - 
        self.tau_zx.powi(2)
    }
    
    /// Third stress invariant I3 (determinant)
    pub fn i3(&self) -> f64 {
        self.sigma_xx * (self.sigma_yy * self.sigma_zz - self.tau_yz.powi(2)) -
        self.tau_xy * (self.tau_xy * self.sigma_zz - self.tau_yz * self.tau_zx) +
        self.tau_zx * (self.tau_xy * self.tau_yz - self.sigma_yy * self.tau_zx)
    }
    
    /// Hydrostatic (mean) stress
    pub fn hydrostatic(&self) -> f64 {
        self.i1() / 3.0
    }
    
    /// Von Mises equivalent stress
    pub fn von_mises(&self) -> f64 {
        let s = self.deviatoric();
        (0.5 * (
            (s.sigma_xx - s.sigma_yy).powi(2) +
            (s.sigma_yy - s.sigma_zz).powi(2) +
            (s.sigma_zz - s.sigma_xx).powi(2) +
            6.0 * (s.tau_xy.powi(2) + s.tau_yz.powi(2) + s.tau_zx.powi(2))
        )).sqrt()
    }
    
    /// Alternative Von Mises formula using invariants
    pub fn von_mises_invariant(&self) -> f64 {
        let j2 = self.j2();
        (3.0 * j2).sqrt()
    }
    
    /// Deviatoric stress tensor (s = σ - σ_hydrostatic × I)
    pub fn deviatoric(&self) -> StressTensor {
        let p = self.hydrostatic();
        StressTensor {
            sigma_xx: self.sigma_xx - p,
            sigma_yy: self.sigma_yy - p,
            sigma_zz: self.sigma_zz - p,
            tau_xy: self.tau_xy,
            tau_yz: self.tau_yz,
            tau_zx: self.tau_zx,
        }
    }
    
    /// Second deviatoric invariant J2
    pub fn j2(&self) -> f64 {
        let s = self.deviatoric();
        0.5 * (s.sigma_xx.powi(2) + s.sigma_yy.powi(2) + s.sigma_zz.powi(2)) +
        s.tau_xy.powi(2) + s.tau_yz.powi(2) + s.tau_zx.powi(2)
    }
    
    /// Principal stresses (σ1 ≥ σ2 ≥ σ3)
    pub fn principal_stresses(&self) -> (f64, f64, f64) {
        // Check for simple uniaxial/biaxial cases with no shear
        if self.tau_xy.abs() < 1e-12 && self.tau_yz.abs() < 1e-12 && self.tau_zx.abs() < 1e-12 {
            let mut principals = [self.sigma_xx, self.sigma_yy, self.sigma_zz];
            principals.sort_by(|a, b| b.partial_cmp(a).unwrap());
            return (principals[0], principals[1], principals[2]);
        }
        
        let i1 = self.i1();
        let i2 = self.i2();
        let i3 = self.i3();
        
        // Solve cubic: σ³ - I1·σ² + I2·σ - I3 = 0
        // Using Cardano's formula or eigenvalue approach
        let p = i2 - i1.powi(2) / 3.0;
        let q = 2.0 * i1.powi(3) / 27.0 - i1 * i2 / 3.0 + i3;
        
        let discriminant = -(4.0 * p.powi(3) + 27.0 * q.powi(2));
        
        if discriminant >= 0.0 {
            // Three real roots
            let phi = if p.abs() < 1e-12 {
                0.0
            } else {
                let cos_arg = (3.0 * q / (2.0 * p)) * (-3.0 / p).sqrt();
                (cos_arg.clamp(-1.0, 1.0)).acos() / 3.0
            };
            
            let sqrt_term = if p < 0.0 { 2.0 * (-p / 3.0).sqrt() } else { 0.0 };
            
            let mut s1 = sqrt_term * phi.cos() + i1 / 3.0;
            let mut s2 = sqrt_term * (phi - 2.0 * std::f64::consts::PI / 3.0).cos() + i1 / 3.0;
            let mut s3 = sqrt_term * (phi - 4.0 * std::f64::consts::PI / 3.0).cos() + i1 / 3.0;
            
            // Sort: s1 >= s2 >= s3
            if s1 < s2 { std::mem::swap(&mut s1, &mut s2); }
            if s2 < s3 { std::mem::swap(&mut s2, &mut s3); }
            if s1 < s2 { std::mem::swap(&mut s1, &mut s2); }
            
            (s1, s2, s3)
        } else {
            // Should not happen for real stress tensor, fallback
            (self.sigma_xx, self.sigma_yy, self.sigma_zz)
        }
    }
    
    /// Maximum shear stress (Tresca)
    pub fn tresca(&self) -> f64 {
        let (s1, _, s3) = self.principal_stresses();
        (s1 - s3) / 2.0
    }
    
    /// Octahedral shear stress
    pub fn octahedral_shear(&self) -> f64 {
        (2.0_f64 / 3.0).sqrt() * self.j2().sqrt()
    }
    
    /// Maximum principal stress
    pub fn max_principal(&self) -> f64 {
        self.principal_stresses().0
    }
    
    /// Minimum principal stress
    pub fn min_principal(&self) -> f64 {
        self.principal_stresses().2
    }
    
    /// Signed Von Mises (uses sign of first principal)
    pub fn signed_von_mises(&self) -> f64 {
        let vm = self.von_mises();
        let (s1, _, s3) = self.principal_stresses();
        if s1.abs() >= s3.abs() {
            s1.signum() * vm
        } else {
            s3.signum() * vm
        }
    }
}

// ============================================================================
// STRESS TYPE SELECTION
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StressType {
    VonMises,
    Tresca,
    MaxPrincipal,
    MidPrincipal,
    MinPrincipal,
    OctahedralShear,
    Hydrostatic,
    SigmaXX,
    SigmaYY,
    SigmaZZ,
    TauXY,
    TauYZ,
    TauZX,
    SignedVonMises,
}

impl StressType {
    /// Extract the specific stress value from a tensor
    pub fn extract(&self, tensor: &StressTensor) -> f64 {
        match self {
            StressType::VonMises => tensor.von_mises(),
            StressType::Tresca => tensor.tresca(),
            StressType::MaxPrincipal => tensor.max_principal(),
            StressType::MidPrincipal => tensor.principal_stresses().1,
            StressType::MinPrincipal => tensor.min_principal(),
            StressType::OctahedralShear => tensor.octahedral_shear(),
            StressType::Hydrostatic => tensor.hydrostatic(),
            StressType::SigmaXX => tensor.sigma_xx,
            StressType::SigmaYY => tensor.sigma_yy,
            StressType::SigmaZZ => tensor.sigma_zz,
            StressType::TauXY => tensor.tau_xy,
            StressType::TauYZ => tensor.tau_yz,
            StressType::TauZX => tensor.tau_zx,
            StressType::SignedVonMises => tensor.signed_von_mises(),
        }
    }
    
    pub fn label(&self) -> &'static str {
        match self {
            StressType::VonMises => "Von Mises Stress",
            StressType::Tresca => "Tresca Stress",
            StressType::MaxPrincipal => "Max Principal σ₁",
            StressType::MidPrincipal => "Mid Principal σ₂",
            StressType::MinPrincipal => "Min Principal σ₃",
            StressType::OctahedralShear => "Octahedral Shear",
            StressType::Hydrostatic => "Hydrostatic Stress",
            StressType::SigmaXX => "σxx",
            StressType::SigmaYY => "σyy",
            StressType::SigmaZZ => "σzz",
            StressType::TauXY => "τxy",
            StressType::TauYZ => "τyz",
            StressType::TauZX => "τzx",
            StressType::SignedVonMises => "Signed Von Mises",
        }
    }
}

// ============================================================================
// COLOR MAPS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ColorMap {
    Jet,
    Rainbow,
    Viridis,
    Plasma,
    Inferno,
    BlueRed,
    GrayScale,
    Turbo,
}

/// RGB color (0-255)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RGB {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl RGB {
    pub fn new(r: u8, g: u8, b: u8) -> Self {
        RGB { r, g, b }
    }
    
    pub fn to_hex(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }
    
    pub fn to_float(&self) -> (f64, f64, f64) {
        (self.r as f64 / 255.0, self.g as f64 / 255.0, self.b as f64 / 255.0)
    }
}

/// Interpolate color from colormap
pub fn map_color(value: f64, min_val: f64, max_val: f64, colormap: ColorMap) -> RGB {
    let t = if (max_val - min_val).abs() > 1e-12 {
        ((value - min_val) / (max_val - min_val)).clamp(0.0, 1.0)
    } else {
        0.5
    };
    
    match colormap {
        ColorMap::Jet => jet_color(t),
        ColorMap::Rainbow => rainbow_color(t),
        ColorMap::Viridis => viridis_color(t),
        ColorMap::Plasma => plasma_color(t),
        ColorMap::Inferno => inferno_color(t),
        ColorMap::BlueRed => blue_red_color(t),
        ColorMap::GrayScale => grayscale_color(t),
        ColorMap::Turbo => turbo_color(t),
    }
}

fn jet_color(t: f64) -> RGB {
    let r = (1.5 - (4.0 * t - 3.0).abs()).clamp(0.0, 1.0);
    let g = (1.5 - (4.0 * t - 2.0).abs()).clamp(0.0, 1.0);
    let b = (1.5 - (4.0 * t - 1.0).abs()).clamp(0.0, 1.0);
    RGB::new((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

fn rainbow_color(t: f64) -> RGB {
    let hue = (1.0 - t) * 270.0; // Blue to Red
    hsv_to_rgb(hue, 1.0, 1.0)
}

fn viridis_color(t: f64) -> RGB {
    // Simplified viridis approximation
    let r = (0.267004 + t * (0.993248 - 0.267004)).clamp(0.0, 1.0);
    let g = (0.004874 + t * (0.906157 - 0.004874)).clamp(0.0, 1.0);
    let b = (0.329415 + t * (0.143936 - 0.329415)).clamp(0.0, 1.0);
    RGB::new((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

fn plasma_color(t: f64) -> RGB {
    let r = (0.050383 + t * (0.940015 - 0.050383)).clamp(0.0, 1.0);
    let g = (0.029803 + t * (0.975158 - 0.029803)).clamp(0.0, 1.0);
    let b = (0.527975 + t * (0.131326 - 0.527975)).clamp(0.0, 1.0);
    RGB::new((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

fn inferno_color(t: f64) -> RGB {
    let r = (0.001462 + t * (0.988362 - 0.001462)).clamp(0.0, 1.0);
    let g = (0.000466 + t * (0.998364 - 0.000466)).clamp(0.0, 1.0);
    let b = (0.013866 + t * (0.644924 - 0.013866)).clamp(0.0, 1.0);
    RGB::new((r * 255.0) as u8, (g * 255.0) as u8, (b * 255.0) as u8)
}

fn blue_red_color(t: f64) -> RGB {
    // Diverging: blue (0) -> white (0.5) -> red (1)
    if t < 0.5 {
        let s = t * 2.0;
        RGB::new((s * 255.0) as u8, (s * 255.0) as u8, 255)
    } else {
        let s = (t - 0.5) * 2.0;
        RGB::new(255, ((1.0 - s) * 255.0) as u8, ((1.0 - s) * 255.0) as u8)
    }
}

fn grayscale_color(t: f64) -> RGB {
    let v = (t * 255.0) as u8;
    RGB::new(v, v, v)
}

fn turbo_color(t: f64) -> RGB {
    // Simplified turbo colormap
    let r = (0.18995 + t * 3.5 * (1.0 - t).powi(2)).clamp(0.0, 1.0);
    let g = (0.07176 + t * 2.5 * t * (1.0 - t)).clamp(0.0, 1.0);
    let b = (0.23217 + t.powi(2) * (1.0 - 0.8 * t)).clamp(0.0, 1.0);
    RGB::new((r * 255.0) as u8, ((g * 4.0).min(1.0) * 255.0) as u8, (b * 255.0) as u8)
}

fn hsv_to_rgb(h: f64, s: f64, v: f64) -> RGB {
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = v - c;
    
    let (r, g, b) = if h < 60.0 {
        (c, x, 0.0)
    } else if h < 120.0 {
        (x, c, 0.0)
    } else if h < 180.0 {
        (0.0, c, x)
    } else if h < 240.0 {
        (0.0, x, c)
    } else if h < 300.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };
    
    RGB::new(
        ((r + m) * 255.0) as u8,
        ((g + m) * 255.0) as u8,
        ((b + m) * 255.0) as u8,
    )
}

// ============================================================================
// CONTOUR BANDS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContourBand {
    /// Band index (0 = lowest)
    pub index: usize,
    /// Minimum value in band
    pub min_value: f64,
    /// Maximum value in band
    pub max_value: f64,
    /// Color for this band
    pub color: RGB,
    /// Label text
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContourConfig {
    /// Number of bands
    pub num_bands: usize,
    /// Color map
    pub colormap: ColorMap,
    /// Use logarithmic scale
    pub log_scale: bool,
    /// Custom min value (None = auto)
    pub custom_min: Option<f64>,
    /// Custom max value (None = auto)
    pub custom_max: Option<f64>,
    /// Show band labels
    pub show_labels: bool,
}

impl Default for ContourConfig {
    fn default() -> Self {
        ContourConfig {
            num_bands: 12,
            colormap: ColorMap::Jet,
            log_scale: false,
            custom_min: None,
            custom_max: None,
            show_labels: true,
        }
    }
}

/// Generate contour bands for a range of values
pub fn generate_contour_bands(
    values: &[f64],
    config: &ContourConfig,
) -> Vec<ContourBand> {
    if values.is_empty() {
        return Vec::new();
    }
    
    let min_val = config.custom_min.unwrap_or_else(|| 
        values.iter().cloned().fold(f64::MAX, f64::min)
    );
    let max_val = config.custom_max.unwrap_or_else(||
        values.iter().cloned().fold(f64::MIN, f64::max)
    );
    
    let range = max_val - min_val;
    let band_width = range / config.num_bands as f64;
    
    (0..config.num_bands).map(|i| {
        let band_min = min_val + i as f64 * band_width;
        let band_max = min_val + (i + 1) as f64 * band_width;
        let mid = (band_min + band_max) / 2.0;
        
        ContourBand {
            index: i,
            min_value: band_min,
            max_value: band_max,
            color: map_color(mid, min_val, max_val, config.colormap),
            label: format!("{:.2} - {:.2}", band_min, band_max),
        }
    }).collect()
}

// ============================================================================
// ELEMENT/NODE STRESS DATA
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementStress {
    /// Element ID
    pub element_id: usize,
    /// Stress tensor at element centroid
    pub centroid_stress: StressTensor,
    /// Stress tensors at integration points (if available)
    pub integration_point_stresses: Vec<StressTensor>,
    /// Stress tensors at nodes (extrapolated)
    pub nodal_stresses: HashMap<usize, StressTensor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodalStress {
    /// Node ID
    pub node_id: usize,
    /// Averaged stress tensor at node
    pub stress: StressTensor,
    /// Number of elements contributing
    pub num_contributions: usize,
}

/// Average element stresses to nodes
pub fn average_to_nodes(
    element_stresses: &[ElementStress],
) -> Vec<NodalStress> {
    let mut node_data: HashMap<usize, (StressTensor, usize)> = HashMap::new();
    
    for elem in element_stresses {
        for (&node_id, stress) in &elem.nodal_stresses {
            let entry = node_data.entry(node_id).or_insert((
                StressTensor::default(),
                0,
            ));
            entry.0.sigma_xx += stress.sigma_xx;
            entry.0.sigma_yy += stress.sigma_yy;
            entry.0.sigma_zz += stress.sigma_zz;
            entry.0.tau_xy += stress.tau_xy;
            entry.0.tau_yz += stress.tau_yz;
            entry.0.tau_zx += stress.tau_zx;
            entry.1 += 1;
        }
    }
    
    node_data.into_iter().map(|(node_id, (sum, count))| {
        let n = count as f64;
        NodalStress {
            node_id,
            stress: StressTensor {
                sigma_xx: sum.sigma_xx / n,
                sigma_yy: sum.sigma_yy / n,
                sigma_zz: sum.sigma_zz / n,
                tau_xy: sum.tau_xy / n,
                tau_yz: sum.tau_yz / n,
                tau_zx: sum.tau_zx / n,
            },
            num_contributions: count,
        }
    }).collect()
}

// ============================================================================
// VTK OUTPUT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VTKStressData {
    /// Point data array name
    pub array_name: String,
    /// Scalar values per point
    pub point_scalars: Vec<f64>,
    /// Colors per point (if computed)
    pub point_colors: Vec<RGB>,
    /// Cell data array name
    pub cell_array_name: String,
    /// Scalar values per cell
    pub cell_scalars: Vec<f64>,
    /// Min/max range
    pub value_range: (f64, f64),
}

/// Generate VTK stress data for visualization
pub fn generate_vtk_stress_data(
    nodal_stresses: &[NodalStress],
    element_stresses: &[ElementStress],
    stress_type: StressType,
    config: &ContourConfig,
) -> VTKStressData {
    // Point (nodal) data
    let point_scalars: Vec<f64> = nodal_stresses.iter()
        .map(|n| stress_type.extract(&n.stress))
        .collect();
    
    // Cell (element) data
    let cell_scalars: Vec<f64> = element_stresses.iter()
        .map(|e| stress_type.extract(&e.centroid_stress))
        .collect();
    
    // Determine range
    let all_values: Vec<f64> = point_scalars.iter()
        .chain(cell_scalars.iter())
        .cloned()
        .collect();
    
    let min_val = config.custom_min.unwrap_or_else(||
        all_values.iter().cloned().fold(f64::MAX, f64::min)
    );
    let max_val = config.custom_max.unwrap_or_else(||
        all_values.iter().cloned().fold(f64::MIN, f64::max)
    );
    
    // Generate colors
    let point_colors: Vec<RGB> = point_scalars.iter()
        .map(|&v| map_color(v, min_val, max_val, config.colormap))
        .collect();
    
    VTKStressData {
        array_name: format!("{}_point", stress_type.label()),
        point_scalars,
        point_colors,
        cell_array_name: format!("{}_cell", stress_type.label()),
        cell_scalars,
        value_range: (min_val, max_val),
    }
}

/// Generate VTK legacy ASCII format string
pub fn to_vtk_point_data_ascii(data: &VTKStressData) -> String {
    let mut output = String::new();
    
    output.push_str(&format!(
        "SCALARS {} float 1\n",
        data.array_name.replace(' ', "_")
    ));
    output.push_str("LOOKUP_TABLE default\n");
    
    for &val in &data.point_scalars {
        output.push_str(&format!("{:.6}\n", val));
    }
    
    output
}

// ============================================================================
// CONTOUR STATISTICS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressStatistics {
    /// Stress type
    pub stress_type: StressType,
    /// Minimum value
    pub min: f64,
    /// Maximum value
    pub max: f64,
    /// Average value
    pub average: f64,
    /// Standard deviation
    pub std_dev: f64,
    /// Location of max (element or node ID)
    pub max_location: String,
    /// Location of min
    pub min_location: String,
    /// Number of elements/nodes exceeding limit
    pub num_exceeding: usize,
    /// Limit used for exceedance check
    pub limit: Option<f64>,
}

/// Calculate stress statistics
pub fn calculate_stress_statistics(
    nodal_stresses: &[NodalStress],
    stress_type: StressType,
    limit: Option<f64>,
) -> StressStatistics {
    let values: Vec<(usize, f64)> = nodal_stresses.iter()
        .map(|n| (n.node_id, stress_type.extract(&n.stress)))
        .collect();
    
    if values.is_empty() {
        return StressStatistics {
            stress_type,
            min: 0.0,
            max: 0.0,
            average: 0.0,
            std_dev: 0.0,
            max_location: "N/A".to_string(),
            min_location: "N/A".to_string(),
            num_exceeding: 0,
            limit,
        };
    }
    
    let (min_id, min_val) = values.iter()
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
        .unwrap();
    let (max_id, max_val) = values.iter()
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
        .unwrap();
    
    let sum: f64 = values.iter().map(|(_, v)| v).sum();
    let avg = sum / values.len() as f64;
    
    let variance: f64 = values.iter()
        .map(|(_, v)| (v - avg).powi(2))
        .sum::<f64>() / values.len() as f64;
    let std_dev = variance.sqrt();
    
    let num_exceeding = limit.map(|l| 
        values.iter().filter(|(_, v)| v.abs() > l).count()
    ).unwrap_or(0);
    
    StressStatistics {
        stress_type,
        min: *min_val,
        max: *max_val,
        average: avg,
        std_dev,
        max_location: format!("Node {}", max_id),
        min_location: format!("Node {}", min_id),
        num_exceeding,
        limit,
    }
}

// ============================================================================
// STRESS RESULT EXTRACTION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressResult {
    /// Load case name
    pub load_case: String,
    /// Element stresses
    pub element_stresses: Vec<ElementStress>,
    /// Averaged nodal stresses
    pub nodal_stresses: Vec<NodalStress>,
    /// Statistics for different stress types
    pub statistics: Vec<StressStatistics>,
}

/// Create a complete stress result with all derived quantities
pub fn create_stress_result(
    load_case: &str,
    element_stresses: Vec<ElementStress>,
    allowable_stress: Option<f64>,
) -> StressResult {
    let nodal_stresses = average_to_nodes(&element_stresses);
    
    let stress_types = [
        StressType::VonMises,
        StressType::MaxPrincipal,
        StressType::MinPrincipal,
        StressType::Tresca,
    ];
    
    let statistics: Vec<StressStatistics> = stress_types.iter()
        .map(|&st| calculate_stress_statistics(&nodal_stresses, st, allowable_stress))
        .collect();
    
    StressResult {
        load_case: load_case.to_string(),
        element_stresses,
        nodal_stresses,
        statistics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_stress_tensor() {
        let t = StressTensor::new(100.0, 50.0, 30.0, 20.0, 10.0, 5.0);
        assert!((t.i1() - 180.0).abs() < 0.01);
        assert!(t.von_mises() > 0.0);
    }
    
    #[test]
    fn test_von_mises_uniaxial() {
        // Uniaxial tension: von Mises should equal the applied stress
        let t = StressTensor::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        assert!((t.von_mises() - 100.0).abs() < 0.1);
    }
    
    #[test]
    fn test_principal_stresses() {
        // Uniaxial: principals should be (100, 0, 0)
        let t = StressTensor::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        let (s1, s2, s3) = t.principal_stresses();
        assert!((s1 - 100.0).abs() < 1.0);
        assert!(s2.abs() < 1.0);
        assert!(s3.abs() < 1.0);
    }
    
    #[test]
    fn test_tresca() {
        let t = StressTensor::new(100.0, 0.0, -50.0, 0.0, 0.0, 0.0);
        let tresca = t.tresca();
        assert!((tresca - 75.0).abs() < 1.0); // (100 - (-50))/2 = 75
    }
    
    #[test]
    fn test_color_maps() {
        let c = map_color(0.5, 0.0, 1.0, ColorMap::Jet);
        assert!(c.g > c.r); // Green dominant at midpoint
        
        let c2 = map_color(0.0, 0.0, 1.0, ColorMap::BlueRed);
        assert!(c2.b == 255); // Blue at 0
    }
    
    #[test]
    fn test_contour_bands() {
        let values = vec![0.0, 50.0, 100.0, 150.0, 200.0];
        let config = ContourConfig {
            num_bands: 4,
            ..Default::default()
        };
        let bands = generate_contour_bands(&values, &config);
        
        assert_eq!(bands.len(), 4);
        assert!((bands[0].min_value - 0.0).abs() < 0.1);
        assert!((bands[3].max_value - 200.0).abs() < 0.1);
    }
    
    #[test]
    fn test_stress_statistics() {
        let stresses = vec![
            NodalStress {
                node_id: 1,
                stress: StressTensor::new(100.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                num_contributions: 1,
            },
            NodalStress {
                node_id: 2,
                stress: StressTensor::new(200.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                num_contributions: 1,
            },
        ];
        
        let stats = calculate_stress_statistics(&stresses, StressType::VonMises, Some(150.0));
        
        assert!((stats.min - 100.0).abs() < 1.0);
        assert!((stats.max - 200.0).abs() < 1.0);
        assert_eq!(stats.num_exceeding, 1);
    }
}
