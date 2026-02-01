//! Foundation Spring Stiffness
//!
//! Soil-structure interaction modeling with Winkler springs,
//! pile stiffness coefficients, and subgrade reaction modulus.
//!
//! ## Features
//! - Winkler spring stiffness (kv, kh)
//! - Pile group stiffness matrix
//! - Subgrade reaction modulus (k_s)
//! - Vesic, Terzaghi, Bowles correlations
//! - Pile lateral stiffness (p-y curves)
//! - Mat foundation springs

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SOIL TYPES AND PARAMETERS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    /// Loose sand
    LooseSand,
    /// Medium sand
    MediumSand,
    /// Dense sand
    DenseSand,
    /// Very dense sand
    VeryDenseSand,
    /// Soft clay
    SoftClay,
    /// Medium clay
    MediumClay,
    /// Stiff clay
    StiffClay,
    /// Very stiff clay
    VeryStiffClay,
    /// Hard clay/rock
    HardClay,
    /// Gravel
    Gravel,
    /// Rock
    Rock,
}

impl SoilType {
    /// Typical subgrade modulus ks (kN/m³) - Terzaghi recommendations
    pub fn typical_subgrade_modulus(&self) -> f64 {
        match self {
            SoilType::LooseSand => 10_000.0,
            SoilType::MediumSand => 30_000.0,
            SoilType::DenseSand => 80_000.0,
            SoilType::VeryDenseSand => 150_000.0,
            SoilType::SoftClay => 12_000.0,
            SoilType::MediumClay => 25_000.0,
            SoilType::StiffClay => 50_000.0,
            SoilType::VeryStiffClay => 100_000.0,
            SoilType::HardClay => 200_000.0,
            SoilType::Gravel => 100_000.0,
            SoilType::Rock => 500_000.0,
        }
    }
    
    /// Typical unit weight (kN/m³)
    pub fn typical_unit_weight(&self) -> f64 {
        match self {
            SoilType::LooseSand => 16.0,
            SoilType::MediumSand => 18.0,
            SoilType::DenseSand => 20.0,
            SoilType::VeryDenseSand => 21.0,
            SoilType::SoftClay => 16.0,
            SoilType::MediumClay => 18.0,
            SoilType::StiffClay => 19.0,
            SoilType::VeryStiffClay => 20.0,
            SoilType::HardClay => 21.0,
            SoilType::Gravel => 20.0,
            SoilType::Rock => 25.0,
        }
    }
    
    /// Typical friction angle (degrees) for granular soils
    pub fn typical_friction_angle(&self) -> Option<f64> {
        match self {
            SoilType::LooseSand => Some(28.0),
            SoilType::MediumSand => Some(32.0),
            SoilType::DenseSand => Some(36.0),
            SoilType::VeryDenseSand => Some(40.0),
            SoilType::Gravel => Some(38.0),
            _ => None, // Clay uses cohesion
        }
    }
    
    /// Typical undrained cohesion (kPa) for cohesive soils
    pub fn typical_cohesion(&self) -> Option<f64> {
        match self {
            SoilType::SoftClay => Some(25.0),
            SoilType::MediumClay => Some(50.0),
            SoilType::StiffClay => Some(100.0),
            SoilType::VeryStiffClay => Some(200.0),
            SoilType::HardClay => Some(400.0),
            _ => None, // Sand uses friction
        }
    }
}

/// Soil profile parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProfile {
    /// Soil type
    pub soil_type: SoilType,
    /// Elastic modulus Es (kPa)
    pub elastic_modulus: f64,
    /// Poisson's ratio
    pub poisson_ratio: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
    /// Subgrade modulus ks (kN/m³)
    pub subgrade_modulus: f64,
    /// Friction angle (degrees)
    pub friction_angle: Option<f64>,
    /// Undrained cohesion cu (kPa)
    pub cohesion: Option<f64>,
    /// Depth to water table (m)
    pub water_table_depth: Option<f64>,
}

impl SoilProfile {
    pub fn new(soil_type: SoilType) -> Self {
        SoilProfile {
            soil_type,
            elastic_modulus: Self::estimate_modulus(soil_type),
            poisson_ratio: Self::typical_poisson(soil_type),
            unit_weight: soil_type.typical_unit_weight(),
            subgrade_modulus: soil_type.typical_subgrade_modulus(),
            friction_angle: soil_type.typical_friction_angle(),
            cohesion: soil_type.typical_cohesion(),
            water_table_depth: None,
        }
    }
    
    fn estimate_modulus(soil_type: SoilType) -> f64 {
        match soil_type {
            SoilType::LooseSand => 10_000.0,
            SoilType::MediumSand => 25_000.0,
            SoilType::DenseSand => 50_000.0,
            SoilType::VeryDenseSand => 80_000.0,
            SoilType::SoftClay => 5_000.0,
            SoilType::MediumClay => 15_000.0,
            SoilType::StiffClay => 30_000.0,
            SoilType::VeryStiffClay => 60_000.0,
            SoilType::HardClay => 100_000.0,
            SoilType::Gravel => 80_000.0,
            SoilType::Rock => 500_000.0,
        }
    }
    
    fn typical_poisson(soil_type: SoilType) -> f64 {
        match soil_type {
            SoilType::LooseSand | SoilType::MediumSand => 0.30,
            SoilType::DenseSand | SoilType::VeryDenseSand => 0.35,
            SoilType::SoftClay | SoilType::MediumClay => 0.45,
            SoilType::StiffClay | SoilType::VeryStiffClay => 0.40,
            SoilType::HardClay => 0.35,
            SoilType::Gravel => 0.30,
            SoilType::Rock => 0.25,
        }
    }
}

// ============================================================================
// WINKLER SPRING STIFFNESS
// ============================================================================

/// Winkler spring model for shallow foundations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinklerSpring {
    /// Vertical stiffness kv (kN/m)
    pub kv: f64,
    /// Horizontal stiffness kh (kN/m)
    pub kh: f64,
    /// Rotational stiffness about X (kN·m/rad)
    pub krx: f64,
    /// Rotational stiffness about Y (kN·m/rad)
    pub kry: f64,
    /// Tributary area (m²)
    pub tributary_area: f64,
}

/// Winkler spring calculator
pub struct WinklerCalculator {
    pub soil: SoilProfile,
}

impl WinklerCalculator {
    pub fn new(soil: SoilProfile) -> Self {
        WinklerCalculator { soil }
    }
    
    /// Calculate spring stiffness for a nodal tributary area
    pub fn nodal_spring(&self, tributary_area: f64, influence_width: f64) -> WinklerSpring {
        let ks = self.soil.subgrade_modulus;
        
        // Vertical stiffness: Kv = ks × A
        let kv = ks * tributary_area;
        
        // Horizontal stiffness (typically 0.5-0.7 of vertical)
        let kh = 0.6 * kv;
        
        // Rotational stiffness (approximate)
        let krx = ks * tributary_area * influence_width.powi(2) / 12.0;
        let kry = krx;
        
        WinklerSpring {
            kv,
            kh,
            krx,
            kry,
            tributary_area,
        }
    }
    
    /// Calculate spring stiffness using Vesic formula
    /// ks = 0.65 × (Es × B^4 / (EI × (1 - ν²)))^(1/12) × Es / (1 - ν²)
    pub fn vesic_spring(
        &self,
        footing_width: f64,
        footing_length: f64,
        footing_ei: f64,
    ) -> WinklerSpring {
        let es = self.soil.elastic_modulus;
        let nu = self.soil.poisson_ratio;
        
        // Vesic modulus of subgrade reaction
        let term = (es * footing_width.powi(4) / (footing_ei * (1.0 - nu * nu))).powf(1.0 / 12.0);
        let ks = 0.65 * term * es / (1.0 - nu * nu);
        
        let area = footing_width * footing_length;
        let kv = ks * area;
        let kh = 0.6 * kv;
        
        let krx = ks * footing_width * footing_length.powi(3) / 12.0;
        let kry = ks * footing_length * footing_width.powi(3) / 12.0;
        
        WinklerSpring {
            kv,
            kh,
            krx,
            kry,
            tributary_area: area,
        }
    }
    
    /// Calculate springs for mat foundation grid
    pub fn mat_springs(
        &self,
        mat_width: f64,
        mat_length: f64,
        nx: usize,
        ny: usize,
    ) -> Vec<WinklerSpring> {
        let dx = mat_width / (nx as f64);
        let dy = mat_length / (ny as f64);
        
        let mut springs = Vec::new();
        
        for i in 0..=nx {
            for j in 0..=ny {
                // Tributary area factors
                let ax = if i == 0 || i == nx { 0.5 } else { 1.0 };
                let ay = if j == 0 || j == ny { 0.5 } else { 1.0 };
                
                let tributary = dx * dy * ax * ay;
                let influence = (dx + dy) / 2.0;
                
                springs.push(self.nodal_spring(tributary, influence));
            }
        }
        
        springs
    }
}

// ============================================================================
// PILE STIFFNESS
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PileType {
    /// Driven precast concrete
    DrivenConcrete,
    /// Driven steel H-pile
    DrivenSteelH,
    /// Driven steel pipe
    DrivenSteelPipe,
    /// Bored/drilled shaft
    BoredPile,
    /// CFA (Continuous Flight Auger)
    CFA,
    /// Micropile
    Micropile,
}

/// Pile parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileProperties {
    /// Pile type
    pub pile_type: PileType,
    /// Pile diameter (m)
    pub diameter: f64,
    /// Pile length (m)
    pub length: f64,
    /// Elastic modulus (kPa)
    pub elastic_modulus: f64,
    /// Moment of inertia (m⁴)
    pub moment_of_inertia: f64,
    /// Cross-sectional area (m²)
    pub area: f64,
}

impl PileProperties {
    pub fn circular(diameter: f64, length: f64, elastic_modulus: f64) -> Self {
        let area = PI * diameter * diameter / 4.0;
        let moment_of_inertia = PI * diameter.powi(4) / 64.0;
        
        PileProperties {
            pile_type: PileType::BoredPile,
            diameter,
            length,
            elastic_modulus,
            moment_of_inertia,
            area,
        }
    }
}

/// Pile stiffness matrix (6×6)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileStiffness {
    /// Axial stiffness kv (kN/m)
    pub kv: f64,
    /// Lateral stiffness kh (kN/m)
    pub kh: f64,
    /// Rotational stiffness kr (kN·m/rad)
    pub kr: f64,
    /// Coupled lateral-rotational (kN/rad)
    pub khr: f64,
    /// Torsional stiffness (kN·m/rad)
    pub kt: f64,
}

/// Pile stiffness calculator
pub struct PileStiffnessCalculator {
    pub soil: SoilProfile,
}

impl PileStiffnessCalculator {
    pub fn new(soil: SoilProfile) -> Self {
        PileStiffnessCalculator { soil }
    }
    
    /// Calculate single pile stiffness
    pub fn single_pile_stiffness(&self, pile: &PileProperties) -> PileStiffness {
        let _es = self.soil.elastic_modulus;
        let ep = pile.elastic_modulus;
        let ip = pile.moment_of_inertia;
        let ap = pile.area;
        let l = pile.length;
        let d = pile.diameter;
        
        // Axial stiffness (simplified)
        // Kv ≈ (Ep × Ap) / L × factor for skin friction
        let skin_factor = 1.5; // Account for skin friction contribution
        let kv = ep * ap / l * skin_factor;
        
        // Lateral stiffness using characteristic length
        // λ = (nh × D / (Ep × Ip))^(1/5) for granular soil
        // λ = (ks × D / (Ep × Ip))^(1/4) for cohesive soil
        let nh = self.estimate_nh(pile);
        let lambda = (nh * d / (ep * ip)).powf(0.20);
        
        // Lateral stiffness at pile head (free head)
        let kh = ep * ip * lambda.powi(3) * 2.0;
        
        // Rotational stiffness
        let kr = ep * ip * lambda * 2.0;
        
        // Coupled stiffness
        let khr = ep * ip * lambda.powi(2) * 2.0;
        
        // Torsional stiffness
        let kt = 0.5 * ep * ip / l; // Approximate
        
        PileStiffness { kv, kh, kr, khr, kt }
    }
    
    /// Estimate horizontal subgrade modulus nh (kN/m³)
    fn estimate_nh(&self, _pile: &PileProperties) -> f64 {
        match self.soil.soil_type {
            SoilType::LooseSand => 2_000.0,
            SoilType::MediumSand => 6_000.0,
            SoilType::DenseSand => 15_000.0,
            SoilType::VeryDenseSand => 25_000.0,
            SoilType::SoftClay => 500.0,
            SoilType::MediumClay => 2_000.0,
            SoilType::StiffClay => 8_000.0,
            SoilType::VeryStiffClay => 20_000.0,
            SoilType::HardClay => 40_000.0,
            SoilType::Gravel => 20_000.0,
            SoilType::Rock => 100_000.0,
        }
    }
    
    /// Calculate pile group stiffness with group reduction factors
    pub fn pile_group_stiffness(
        &self,
        pile: &PileProperties,
        pile_positions: &[(f64, f64)], // (x, y) positions
    ) -> PileGroupStiffness {
        let n = pile_positions.len();
        if n == 0 {
            return PileGroupStiffness::default();
        }
        
        let single = self.single_pile_stiffness(pile);
        
        // Group efficiency factors
        let spacing = self.average_spacing(pile_positions, pile.diameter);
        let eta_v = self.axial_group_efficiency(n, spacing);
        let eta_h = self.lateral_group_efficiency(n, spacing);
        
        // Centroid
        let (cx, cy) = Self::centroid(pile_positions);
        
        // Group stiffness
        let kv_group = single.kv * n as f64 * eta_v;
        let kh_group = single.kh * n as f64 * eta_h;
        
        // Rotational stiffness from pile arrangement
        let mut krx_from_piles = 0.0;
        let mut kry_from_piles = 0.0;
        
        for (x, y) in pile_positions {
            let dx = x - cx;
            let dy = y - cy;
            krx_from_piles += single.kv * eta_v * dy * dy;
            kry_from_piles += single.kv * eta_v * dx * dx;
        }
        
        // Add individual pile rotational stiffness
        let krx_group = krx_from_piles + single.kr * n as f64 * eta_h;
        let kry_group = kry_from_piles + single.kr * n as f64 * eta_h;
        
        let kt_group = single.kt * n as f64 * eta_h;
        
        PileGroupStiffness {
            num_piles: n,
            centroid: (cx, cy),
            kv: kv_group,
            khx: kh_group,
            khy: kh_group,
            krx: krx_group,
            kry: kry_group,
            kt: kt_group,
            eta_axial: eta_v,
            eta_lateral: eta_h,
        }
    }
    
    fn average_spacing(&self, positions: &[(f64, f64)], diameter: f64) -> f64 {
        if positions.len() < 2 {
            return 3.0; // Default 3D spacing
        }
        
        let mut total_spacing = 0.0;
        let mut count = 0;
        
        for i in 0..positions.len() {
            for j in (i + 1)..positions.len() {
                let dx = positions[i].0 - positions[j].0;
                let dy = positions[i].1 - positions[j].1;
                let dist = (dx * dx + dy * dy).sqrt();
                total_spacing += dist / diameter;
                count += 1;
            }
        }
        
        if count > 0 {
            total_spacing / count as f64
        } else {
            3.0
        }
    }
    
    fn axial_group_efficiency(&self, n: usize, spacing_ratio: f64) -> f64 {
        // Converse-Labarre formula approximation
        if n == 1 {
            return 1.0;
        }
        
        // Efficiency increases with spacing
        let base_efficiency = 0.65 + 0.10 * (spacing_ratio - 3.0).max(0.0).min(3.0);
        base_efficiency.min(1.0).max(0.3)
    }
    
    fn lateral_group_efficiency(&self, n: usize, spacing_ratio: f64) -> f64 {
        if n == 1 {
            return 1.0;
        }
        
        // P-multipliers concept (simplified)
        let fm = match n {
            1 => 1.0,
            2..=4 => 0.8,
            5..=9 => 0.6,
            _ => 0.5,
        };
        
        // Increase with spacing
        (fm + 0.05 * (spacing_ratio - 3.0).max(0.0)).min(1.0)
    }
    
    fn centroid(positions: &[(f64, f64)]) -> (f64, f64) {
        if positions.is_empty() {
            return (0.0, 0.0);
        }
        
        let sum_x: f64 = positions.iter().map(|(x, _)| x).sum();
        let sum_y: f64 = positions.iter().map(|(_, y)| y).sum();
        let n = positions.len() as f64;
        
        (sum_x / n, sum_y / n)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PileGroupStiffness {
    pub num_piles: usize,
    pub centroid: (f64, f64),
    /// Vertical stiffness (kN/m)
    pub kv: f64,
    /// Horizontal X stiffness (kN/m)
    pub khx: f64,
    /// Horizontal Y stiffness (kN/m)
    pub khy: f64,
    /// Rotational about X (kN·m/rad)
    pub krx: f64,
    /// Rotational about Y (kN·m/rad)
    pub kry: f64,
    /// Torsional (kN·m/rad)
    pub kt: f64,
    /// Axial group efficiency
    pub eta_axial: f64,
    /// Lateral group efficiency
    pub eta_lateral: f64,
}

// ============================================================================
// FOOTING STIFFNESS (GAZETAS FORMULAS)
// ============================================================================

/// Gazetas (1991) formulas for foundation impedance
pub struct GazetasImpedance {
    pub soil: SoilProfile,
}

impl GazetasImpedance {
    pub fn new(soil: SoilProfile) -> Self {
        GazetasImpedance { soil }
    }
    
    /// Calculate static stiffness for rectangular footing (Gazetas, 1991)
    pub fn rectangular_footing(
        &self,
        length: f64,  // 2L (full length)
        width: f64,   // 2B (full width)
        embedment: f64, // D (depth of embedment)
    ) -> FootingImpedance {
        let g = self.soil.elastic_modulus / (2.0 * (1.0 + self.soil.poisson_ratio));
        let nu = self.soil.poisson_ratio;
        
        let l = length / 2.0; // Half-length
        let b = width / 2.0;  // Half-width
        let ab = l / b;       // Aspect ratio
        
        // Vertical stiffness (Eq. 2-1)
        let kv = (g * l / (1.0 - nu)) * (0.73 + 1.54 * ab.powf(-0.75));
        
        // Horizontal stiffness (Eq. 2-2)
        let khx = (g * l / (2.0 - nu)) * (6.8 * ab.powf(-0.65) + 0.8 * ab + 1.6);
        let khy = (g * l / (2.0 - nu)) * (6.8 * ab.powf(-0.65) + 2.4);
        
        // Rocking stiffness (Eq. 2-3, 2-4)
        let krx = (g * l.powi(3) / (1.0 - nu)) * (3.2 * ab + 0.8);
        let kry = (g * l.powi(3) / (1.0 - nu)) * (3.2 / ab + 0.8);
        
        // Torsional stiffness (Eq. 2-5)
        let kt = g * l.powi(3) * (4.25 * ab.powf(-0.75) + 4.06 * ab);
        
        // Embedment factors (simplified)
        let eta_v = 1.0 + 0.4 * embedment / b;
        let eta_h = 1.0 + 0.5 * embedment / b;
        let eta_r = 1.0 + 1.6 * embedment / b;
        
        FootingImpedance {
            kv: kv * eta_v,
            khx: khx * eta_h,
            khy: khy * eta_h,
            krx: krx * eta_r,
            kry: kry * eta_r,
            kt,
            length,
            width,
            embedment,
        }
    }
    
    /// Calculate static stiffness for circular footing
    pub fn circular_footing(
        &self,
        radius: f64,
        embedment: f64,
    ) -> FootingImpedance {
        let g = self.soil.elastic_modulus / (2.0 * (1.0 + self.soil.poisson_ratio));
        let nu = self.soil.poisson_ratio;
        let r = radius;
        
        // Vertical stiffness
        let kv = 4.0 * g * r / (1.0 - nu);
        
        // Horizontal stiffness
        let kh = 8.0 * g * r / (2.0 - nu);
        
        // Rocking stiffness
        let kr = 8.0 * g * r.powi(3) / (3.0 * (1.0 - nu));
        
        // Torsional stiffness
        let kt = 16.0 * g * r.powi(3) / 3.0;
        
        // Embedment factors
        let eta_v = 1.0 + 0.4 * embedment / r;
        let eta_h = 1.0 + 0.5 * embedment / r;
        let eta_r = 1.0 + 1.6 * embedment / r;
        
        FootingImpedance {
            kv: kv * eta_v,
            khx: kh * eta_h,
            khy: kh * eta_h,
            krx: kr * eta_r,
            kry: kr * eta_r,
            kt,
            length: 2.0 * radius,
            width: 2.0 * radius,
            embedment,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FootingImpedance {
    /// Vertical stiffness (kN/m)
    pub kv: f64,
    /// Horizontal X stiffness (kN/m)
    pub khx: f64,
    /// Horizontal Y stiffness (kN/m)
    pub khy: f64,
    /// Rocking about X (kN·m/rad)
    pub krx: f64,
    /// Rocking about Y (kN·m/rad)
    pub kry: f64,
    /// Torsional (kN·m/rad)
    pub kt: f64,
    /// Footing length (m)
    pub length: f64,
    /// Footing width (m)
    pub width: f64,
    /// Embedment depth (m)
    pub embedment: f64,
}

// ============================================================================
// SPRING GENERATION FOR FE MODEL
// ============================================================================

/// Spring element for FE model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpringElement {
    /// Spring ID
    pub id: usize,
    /// Node ID
    pub node_id: usize,
    /// Position (x, y, z)
    pub position: (f64, f64, f64),
    /// Stiffness values (kx, ky, kz, krx, kry, krz)
    pub stiffness: [f64; 6],
    /// Spring type
    pub spring_type: SpringType,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SpringType {
    Winkler,
    Pile,
    Footing,
    Custom,
}

/// Generate springs for model
pub fn generate_foundation_springs(
    nodes: &[(usize, f64, f64, f64)], // (id, x, y, z)
    soil: &SoilProfile,
    tributary_areas: &[f64],
) -> Vec<SpringElement> {
    let calc = WinklerCalculator::new(soil.clone());
    
    nodes.iter()
        .zip(tributary_areas.iter())
        .enumerate()
        .map(|(i, ((node_id, x, y, z), area))| {
            let spring = calc.nodal_spring(*area, area.sqrt());
            
            SpringElement {
                id: i + 1,
                node_id: *node_id,
                position: (*x, *y, *z),
                stiffness: [spring.kh, spring.kh, spring.kv, spring.krx, spring.kry, 0.0],
                spring_type: SpringType::Winkler,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_soil_profile() {
        let profile = SoilProfile::new(SoilType::MediumSand);
        assert!(profile.elastic_modulus > 0.0);
        assert!(profile.friction_angle.is_some());
        assert!(profile.cohesion.is_none());
    }
    
    #[test]
    fn test_winkler_springs() {
        let soil = SoilProfile::new(SoilType::StiffClay);
        let calc = WinklerCalculator::new(soil);
        
        let spring = calc.nodal_spring(4.0, 2.0);
        
        assert!(spring.kv > 0.0);
        assert!(spring.kh > 0.0);
        assert!(spring.kh < spring.kv); // Horizontal < vertical
    }
    
    #[test]
    fn test_mat_springs() {
        let soil = SoilProfile::new(SoilType::DenseSand);
        let calc = WinklerCalculator::new(soil);
        
        let springs = calc.mat_springs(10.0, 15.0, 5, 5);
        
        // (5+1) × (5+1) = 36 nodes
        assert_eq!(springs.len(), 36);
        
        // Corner springs should have 1/4 area of interior
        let corner_area = springs[0].tributary_area;
        let interior_area = springs[7].tributary_area; // An interior node
        assert!((interior_area / corner_area - 4.0).abs() < 0.1);
    }
    
    #[test]
    fn test_pile_stiffness() {
        let soil = SoilProfile::new(SoilType::MediumSand);
        let calc = PileStiffnessCalculator::new(soil);
        
        let pile = PileProperties::circular(0.6, 15.0, 30_000_000.0);
        let stiffness = calc.single_pile_stiffness(&pile);
        
        assert!(stiffness.kv > 0.0);
        assert!(stiffness.kh > 0.0);
    }
    
    #[test]
    fn test_pile_group() {
        let soil = SoilProfile::new(SoilType::StiffClay);
        let calc = PileStiffnessCalculator::new(soil);
        
        let pile = PileProperties::circular(0.5, 12.0, 30_000_000.0);
        
        // 2×2 pile group at 3D spacing
        let positions = vec![
            (0.0, 0.0),
            (1.5, 0.0),
            (0.0, 1.5),
            (1.5, 1.5),
        ];
        
        let group = calc.pile_group_stiffness(&pile, &positions);
        
        assert_eq!(group.num_piles, 4);
        assert!(group.eta_axial < 1.0); // Group efficiency < 1
        assert!(group.kv > 0.0);
    }
    
    #[test]
    fn test_gazetas_rectangular() {
        let soil = SoilProfile::new(SoilType::DenseSand);
        let calc = GazetasImpedance::new(soil);
        
        let impedance = calc.rectangular_footing(4.0, 2.0, 1.0);
        
        assert!(impedance.kv > 0.0);
        assert!(impedance.khx > 0.0);
        assert!(impedance.krx > 0.0);
    }
    
    #[test]
    fn test_gazetas_circular() {
        let soil = SoilProfile::new(SoilType::MediumClay);
        let calc = GazetasImpedance::new(soil);
        
        let impedance = calc.circular_footing(1.5, 0.5);
        
        assert!(impedance.kv > 0.0);
        assert!((impedance.khx - impedance.khy).abs() < 0.001); // Symmetric
    }
    
    #[test]
    fn test_spring_generation() {
        let soil = SoilProfile::new(SoilType::StiffClay);
        let nodes = vec![
            (1, 0.0, 0.0, 0.0),
            (2, 2.0, 0.0, 0.0),
            (3, 0.0, 2.0, 0.0),
            (4, 2.0, 2.0, 0.0),
        ];
        let areas = vec![1.0, 1.0, 1.0, 1.0];
        
        let springs = generate_foundation_springs(&nodes, &soil, &areas);
        
        assert_eq!(springs.len(), 4);
        assert_eq!(springs[0].node_id, 1);
        assert!(springs[0].stiffness[2] > 0.0); // kz (vertical) > 0
    }
}
