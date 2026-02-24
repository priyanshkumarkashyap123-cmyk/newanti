// ============================================================================
// SOIL-STRUCTURE INTERACTION MODULE
// Foundation Modeling, Pile Analysis, and Subgrade Reactions
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SOIL PROPERTIES
// ============================================================================

/// Soil classification per IS 1893 / ASCE 7
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SoilType {
    /// Rock or hard soil (Type I / Site Class A)
    Rock,
    /// Medium/stiff soil (Type II / Site Class C)
    MediumStiff,
    /// Soft soil (Type III / Site Class D)
    Soft,
    /// Very soft (Site Class E)
    VerySoft,
    /// Liquefiable (Site Class F)
    Liquefiable,
}

impl SoilType {
    /// Typical shear wave velocity range (m/s)
    pub fn vs_range(&self) -> (f64, f64) {
        match self {
            SoilType::Rock => (760.0, 1500.0),
            SoilType::MediumStiff => (360.0, 760.0),
            SoilType::Soft => (180.0, 360.0),
            SoilType::VerySoft => (90.0, 180.0),
            SoilType::Liquefiable => (0.0, 90.0),
        }
    }
    
    /// Site amplification factor (Fa) for short periods
    pub fn fa(&self, ss: f64) -> f64 {
        match self {
            SoilType::Rock => 0.8,
            SoilType::MediumStiff => {
                if ss <= 0.25 { 1.2 }
                else if ss <= 0.50 { 1.2 - 0.2 * (ss - 0.25) / 0.25 }
                else if ss <= 0.75 { 1.0 - 0.1 * (ss - 0.50) / 0.25 }
                else if ss <= 1.00 { 0.9 - 0.1 * (ss - 0.75) / 0.25 }
                else { 0.9 }
            }
            SoilType::Soft => {
                if ss <= 0.25 { 1.6 }
                else if ss <= 0.50 { 1.4 }
                else if ss <= 0.75 { 1.2 }
                else if ss <= 1.00 { 1.1 }
                else { 1.0 }
            }
            SoilType::VerySoft => {
                if ss <= 0.25 { 2.5 }
                else if ss <= 0.50 { 1.7 }
                else if ss <= 0.75 { 1.2 }
                else { 0.9 }
            }
            SoilType::Liquefiable => 1.0, // Requires site-specific analysis
        }
    }
}

/// Soil layer properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Layer thickness (m)
    pub thickness: f64,
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Saturated unit weight (kN/m³)
    pub gamma_sat: f64,
    /// Cohesion (kPa)
    pub cohesion: f64,
    /// Friction angle (degrees)
    pub phi: f64,
    /// Elastic modulus (MPa)
    pub e_s: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// SPT N-value
    pub n_spt: f64,
    /// Shear wave velocity (m/s)
    pub vs: f64,
}

impl SoilLayer {
    /// Create clay layer
    pub fn clay(thickness: f64, cu: f64, gamma: f64) -> Self {
        Self {
            thickness,
            gamma,
            gamma_sat: gamma + 2.0,
            cohesion: cu,
            phi: 0.0,
            e_s: 500.0 * cu / 1000.0, // Es ≈ 500*cu
            nu: 0.45,
            n_spt: cu / 6.0,
            vs: 100.0 * (cu / 50.0).powf(0.5),
        }
    }
    
    /// Create sand layer
    pub fn sand(thickness: f64, phi: f64, gamma: f64, n_spt: f64) -> Self {
        Self {
            thickness,
            gamma,
            gamma_sat: gamma + 2.0,
            cohesion: 0.0,
            phi,
            e_s: 0.5 * n_spt, // Es ≈ 0.5*N MPa (approximate)
            nu: 0.30,
            n_spt,
            vs: 85.0 * n_spt.powf(0.34),
        }
    }
    
    /// Subgrade modulus (kN/m³) - Vesic's equation
    pub fn subgrade_modulus(&self, foundation_width: f64) -> f64 {
        let es_kpa = self.e_s * 1000.0;
        let b = foundation_width;
        0.65 * es_kpa / (1.0 - self.nu.powi(2)) * (es_kpa * b.powi(4) / (1.0 - self.nu.powi(2))).powf(1.0 / 12.0) / b
    }
}

/// Soil profile (multiple layers)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProfile {
    pub layers: Vec<SoilLayer>,
    /// Water table depth from ground level (m)
    pub water_table: f64,
}

impl SoilProfile {
    pub fn new() -> Self {
        Self {
            layers: Vec::new(),
            water_table: f64::MAX,
        }
    }
    
    pub fn add_layer(&mut self, layer: SoilLayer) {
        self.layers.push(layer);
    }
    
    /// Total depth of profile
    pub fn total_depth(&self) -> f64 {
        self.layers.iter().map(|l| l.thickness).sum()
    }
    
    /// Get layer at depth
    pub fn layer_at_depth(&self, depth: f64) -> Option<&SoilLayer> {
        let mut cumulative = 0.0;
        for layer in &self.layers {
            cumulative += layer.thickness;
            if depth <= cumulative {
                return Some(layer);
            }
        }
        self.layers.last()
    }
    
    /// Effective overburden pressure at depth (kPa)
    pub fn overburden_pressure(&self, depth: f64) -> f64 {
        let mut pressure = 0.0;
        let mut cumulative = 0.0;
        
        for layer in &self.layers {
            let layer_depth = cumulative + layer.thickness;
            let effective_depth = depth.min(layer_depth) - cumulative;
            
            if effective_depth <= 0.0 {
                break;
            }
            
            // Use effective unit weight below water table
            let gamma_eff = if cumulative >= self.water_table {
                layer.gamma_sat - 10.0 // Submerged weight
            } else if layer_depth > self.water_table {
                let above_wt = self.water_table - cumulative;
                let below_wt = effective_depth - above_wt;
                (layer.gamma * above_wt + (layer.gamma_sat - 10.0) * below_wt) / effective_depth
            } else {
                layer.gamma
            };
            
            pressure += gamma_eff * effective_depth;
            cumulative = layer_depth;
            
            if cumulative >= depth {
                break;
            }
        }
        
        pressure
    }
    
    /// Average shear wave velocity for top 30m
    pub fn vs30(&self) -> f64 {
        let mut sum_d_vs = 0.0;
        let mut total_depth = 0.0;
        
        for layer in &self.layers {
            let d = layer.thickness.min(30.0 - total_depth);
            if d <= 0.0 {
                break;
            }
            sum_d_vs += d / layer.vs;
            total_depth += d;
        }
        
        if sum_d_vs > 0.0 {
            30.0 / sum_d_vs
        } else {
            250.0 // Default
        }
    }
}

impl Default for SoilProfile {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SHALLOW FOUNDATIONS
// ============================================================================

/// Foundation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FoundationType {
    Isolated,
    Combined,
    Strip,
    Mat,
}

/// Isolated footing design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatedFooting {
    /// Length (m)
    pub length: f64,
    /// Width (m)
    pub width: f64,
    /// Depth (m)
    pub depth: f64,
    /// Thickness (m)
    pub thickness: f64,
    /// Column dimensions (m)
    pub col_length: f64,
    pub col_width: f64,
}

impl IsolatedFooting {
    pub fn new(length: f64, width: f64, depth: f64, thickness: f64) -> Self {
        Self {
            length,
            width,
            depth,
            thickness,
            col_length: 0.4,
            col_width: 0.4,
        }
    }
    
    /// Bearing area (m²)
    pub fn area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Section modulus about X-axis (m³)
    pub fn zx(&self) -> f64 {
        self.width * self.length.powi(2) / 6.0
    }
    
    /// Section modulus about Y-axis (m³)
    pub fn zy(&self) -> f64 {
        self.length * self.width.powi(2) / 6.0
    }
    
    /// Spring stiffness for vertical (kN/m)
    pub fn vertical_stiffness(&self, ks: f64) -> f64 {
        ks * self.area()
    }
    
    /// Rotational stiffness about X (kNm/rad)
    pub fn rotational_stiffness_x(&self, ks: f64) -> f64 {
        ks * self.width * self.length.powi(3) / 12.0
    }
    
    /// Rotational stiffness about Y (kNm/rad)
    pub fn rotational_stiffness_y(&self, ks: f64) -> f64 {
        ks * self.length * self.width.powi(3) / 12.0
    }
}

/// Bearing capacity calculator (IS 6403 / Terzaghi)
pub struct BearingCapacity;

impl BearingCapacity {
    /// Ultimate bearing capacity - Terzaghi's equation (kPa)
    pub fn terzaghi(
        cohesion: f64,      // kPa
        phi: f64,           // degrees
        gamma: f64,         // kN/m³
        df: f64,            // foundation depth (m)
        b: f64,             // foundation width (m)
        shape: FoundationType,
    ) -> BearingCapacityResult {
        let phi_rad = phi.to_radians();
        
        // Bearing capacity factors
        let nq = ((45.0 + phi / 2.0).to_radians().tan()).powi(2) * 
                 (PI * phi_rad.tan()).exp();
        let nc = (nq - 1.0) / phi_rad.tan().max(0.001);
        let ny = 2.0 * (nq + 1.0) * phi_rad.tan();
        
        // Shape factors
        let (sc, sq, sy) = match shape {
            FoundationType::Strip => (1.0, 1.0, 1.0),
            FoundationType::Isolated | FoundationType::Combined => (1.3, 1.2, 0.8),
            FoundationType::Mat => (1.3, 1.2, 0.8),
        };
        
        // Ultimate bearing capacity
        let qu = cohesion * nc * sc + gamma * df * nq * sq + 0.5 * gamma * b * ny * sy;
        
        // Safe bearing capacity (FOS = 3.0)
        let q_safe = qu / 3.0;
        
        BearingCapacityResult {
            nc, nq, ny,
            sc, sq, sy,
            q_ultimate: qu,
            q_safe,
            fos: 3.0,
        }
    }
    
    /// IS 6403 bearing capacity with depth and inclination factors
    pub fn is6403(
        cohesion: f64,
        phi: f64,
        gamma: f64,
        df: f64,
        b: f64,
        l: f64,
        inclination: f64,  // Load inclination (degrees)
        water_table: Option<f64>,
    ) -> BearingCapacityResult {
        let phi_rad = phi.to_radians();
        let incl_rad = inclination.to_radians();
        
        // Bearing capacity factors
        let nq = ((45.0 + phi / 2.0).to_radians().tan()).powi(2) * 
                 (PI * phi_rad.tan()).exp();
        let nc = if phi > 0.0 { (nq - 1.0) / phi_rad.tan() } else { 5.14 };
        let ny = 2.0 * (nq - 1.0) * phi_rad.tan();
        
        // Shape factors
        let sc = 1.0 + 0.2 * b / l;
        let sq = 1.0 + 0.2 * b / l;
        let sy = 1.0 - 0.4 * b / l;
        
        // Depth factors
        let dc = 1.0 + 0.2 * (df / b).min(1.0);
        let dq = 1.0 + 0.1 * (df / b).min(1.0) * (45.0 + phi / 2.0).to_radians().tan();
        let dy = dq;
        
        // Inclination factors
        let ic = (1.0 - incl_rad / (PI / 2.0)).powi(2);
        let iq = ic;
        let iy = (1.0 - incl_rad / phi_rad.max(0.01)).powi(2).max(0.0);
        
        // Water table correction
        let gamma_eff = if let Some(wt) = water_table {
            if wt < df {
                gamma - 10.0 // Fully submerged
            } else if wt < df + b {
                gamma - (10.0 * (df + b - wt) / b)
            } else {
                gamma
            }
        } else {
            gamma
        };
        
        let qu = cohesion * nc * sc * dc * ic 
               + gamma * df * nq * sq * dq * iq 
               + 0.5 * gamma_eff * b * ny * sy * dy * iy;
        
        BearingCapacityResult {
            nc, nq, ny,
            sc, sq, sy,
            q_ultimate: qu,
            q_safe: qu / 2.5,
            fos: 2.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCapacityResult {
    pub nc: f64,
    pub nq: f64,
    pub ny: f64,
    pub sc: f64,
    pub sq: f64,
    pub sy: f64,
    pub q_ultimate: f64,
    pub q_safe: f64,
    pub fos: f64,
}

// ============================================================================
// WINKLER SPRINGS
// ============================================================================

/// Winkler spring model for foundation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinklerFoundation {
    /// Subgrade modulus (kN/m³)
    pub ks: f64,
    /// Foundation length (m)
    pub length: f64,
    /// Foundation width (m)
    pub width: f64,
    /// Number of springs in length direction
    pub nx: usize,
    /// Number of springs in width direction
    pub ny: usize,
}

impl WinklerFoundation {
    pub fn new(ks: f64, length: f64, width: f64, nx: usize, ny: usize) -> Self {
        Self { ks, length, width, nx, ny }
    }
    
    /// Generate spring locations and stiffnesses
    pub fn generate_springs(&self) -> Vec<WinklerSpring> {
        let mut springs = Vec::new();
        let dx = self.length / self.nx as f64;
        let dy = self.width / self.ny as f64;
        
        // Tributary area per spring
        let area = dx * dy;
        let k = self.ks * area;
        
        for i in 0..=self.nx {
            for j in 0..=self.ny {
                let x = i as f64 * dx - self.length / 2.0;
                let y = j as f64 * dy - self.width / 2.0;
                
                // Corner springs get 1/4, edge springs get 1/2
                let factor = match (i == 0 || i == self.nx, j == 0 || j == self.ny) {
                    (true, true) => 0.25,
                    (true, false) | (false, true) => 0.5,
                    (false, false) => 1.0,
                };
                
                springs.push(WinklerSpring {
                    x,
                    y,
                    z: 0.0,
                    kz: k * factor,
                });
            }
        }
        
        springs
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinklerSpring {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub kz: f64,
}

// ============================================================================
// PILE FOUNDATIONS
// ============================================================================

/// Pile types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PileType {
    Driven,
    Bored,
    CFA,  // Continuous Flight Auger
    Micropile,
    HelicalPile,
}

/// Pile properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pile {
    pub pile_type: PileType,
    /// Diameter (m)
    pub diameter: f64,
    /// Length (m)
    pub length: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Concrete/steel strength (MPa)
    pub f: f64,
}

impl Pile {
    pub fn new(pile_type: PileType, diameter: f64, length: f64) -> Self {
        let (e, f) = match pile_type {
            PileType::Driven => (30000.0, 40.0),      // Concrete
            PileType::Bored => (28000.0, 35.0),       // Concrete
            PileType::CFA => (28000.0, 30.0),         // Concrete
            PileType::Micropile => (200000.0, 250.0), // Steel
            PileType::HelicalPile => (200000.0, 250.0),
        };
        Self { pile_type, diameter, length, e, f }
    }
    
    /// Cross-sectional area (m²)
    pub fn area(&self) -> f64 {
        PI * self.diameter.powi(2) / 4.0
    }
    
    /// Perimeter (m)
    pub fn perimeter(&self) -> f64 {
        PI * self.diameter
    }
    
    /// Moment of inertia (m⁴)
    pub fn inertia(&self) -> f64 {
        PI * self.diameter.powi(4) / 64.0
    }
}

/// Pile capacity calculator
pub struct PileCapacity;

impl PileCapacity {
    /// Calculate axial capacity (kN) - IS 2911 method
    pub fn axial_capacity(
        pile: &Pile,
        soil_profile: &SoilProfile,
    ) -> PileCapacityResult {
        let mut shaft_friction = 0.0;
        let mut cumulative_depth = 0.0;
        
        // Calculate shaft friction for each layer
        for layer in &soil_profile.layers {
            let layer_top = cumulative_depth;
            let layer_bottom = (cumulative_depth + layer.thickness).min(pile.length);
            let effective_length = layer_bottom - layer_top;
            
            if effective_length <= 0.0 {
                break;
            }
            
            // Shaft friction
            let fs = if layer.cohesion > 0.0 {
                // Clay: fs = α * cu
                let alpha = Self::alpha_adhesion(layer.cohesion);
                alpha * layer.cohesion
            } else {
                // Sand: fs = β * σv'
                let sigma_v = soil_profile.overburden_pressure((layer_top + layer_bottom) / 2.0);
                let beta = Self::beta_factor(layer.phi, pile.pile_type);
                beta * sigma_v
            };
            
            shaft_friction += fs * pile.perimeter() * effective_length;
            cumulative_depth = layer_bottom;
        }
        
        // End bearing
        let tip_layer = soil_profile.layer_at_depth(pile.length).unwrap_or(&soil_profile.layers[0]);
        let qb = if tip_layer.cohesion > 0.0 {
            // Clay: qb = 9 * cu
            9.0 * tip_layer.cohesion
        } else {
            // Sand: qb = Nq * σv'
            let sigma_v = soil_profile.overburden_pressure(pile.length);
            let nq = Self::nq_factor(tip_layer.phi);
            nq * sigma_v
        };
        
        let end_bearing = qb * pile.area();
        let ultimate_capacity = shaft_friction + end_bearing;
        
        // Factor of safety
        let fos = match pile.pile_type {
            PileType::Bored | PileType::CFA => 2.5,
            _ => 2.0,
        };
        
        PileCapacityResult {
            shaft_friction,
            end_bearing,
            ultimate_capacity,
            safe_capacity: ultimate_capacity / fos,
            fos,
        }
    }
    
    fn alpha_adhesion(cu: f64) -> f64 {
        // Alpha factor for clay (API method)
        if cu <= 25.0 {
            1.0
        } else if cu <= 75.0 {
            1.0 - 0.5 * (cu - 25.0) / 50.0
        } else {
            0.5
        }
    }
    
    fn beta_factor(phi: f64, pile_type: PileType) -> f64 {
        let k = match pile_type {
            PileType::Driven => 1.0,
            PileType::Bored => 0.7,
            _ => 0.8,
        };
        k * phi.to_radians().tan()
    }
    
    fn nq_factor(phi: f64) -> f64 {
        // Berezantzev's Nq
        let phi_rad = phi.to_radians();
        ((45.0 + phi / 2.0).to_radians().tan()).powi(2) * (PI * phi_rad.tan()).exp()
    }
    
    /// Calculate lateral stiffness (kN/m) - p-y method
    pub fn lateral_stiffness(pile: &Pile, soil: &SoilLayer, depth: f64) -> f64 {
        let es_kpa = soil.e_s * 1000.0;
        let d = pile.diameter;
        let ei = pile.e * 1000.0 * pile.inertia(); // kN.m²
        
        // Characteristic length
        let _eta = (es_kpa / (4.0 * ei)).powf(0.25);
        
        // Lateral spring stiffness per unit length
        1.2 * es_kpa * d * (depth / d + 0.5)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileCapacityResult {
    pub shaft_friction: f64,
    pub end_bearing: f64,
    pub ultimate_capacity: f64,
    pub safe_capacity: f64,
    pub fos: f64,
}

/// Pile group analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileGroup {
    pub piles: Vec<(f64, f64)>, // (x, y) coordinates
    pub pile: Pile,
    pub cap_thickness: f64,
}

impl PileGroup {
    pub fn new(pile: Pile, cap_thickness: f64) -> Self {
        Self {
            piles: Vec::new(),
            pile,
            cap_thickness,
        }
    }
    
    /// Add pile at location
    pub fn add_pile(&mut self, x: f64, y: f64) {
        self.piles.push((x, y));
    }
    
    /// Create rectangular grid of piles
    pub fn rectangular_grid(pile: Pile, nx: usize, ny: usize, spacing_x: f64, spacing_y: f64, cap_thickness: f64) -> Self {
        let mut group = Self::new(pile, cap_thickness);
        
        let x_offset = (nx - 1) as f64 * spacing_x / 2.0;
        let y_offset = (ny - 1) as f64 * spacing_y / 2.0;
        
        for i in 0..nx {
            for j in 0..ny {
                let x = i as f64 * spacing_x - x_offset;
                let y = j as f64 * spacing_y - y_offset;
                group.add_pile(x, y);
            }
        }
        
        group
    }
    
    /// Number of piles
    pub fn n_piles(&self) -> usize {
        self.piles.len()
    }
    
    /// Group efficiency factor
    pub fn efficiency(&self, spacing: f64) -> f64 {
        let _s_d = spacing / self.pile.diameter;
        
        // Converse-Labarre formula
        let n = self.n_piles() as f64;
        let m = (n.sqrt()).ceil();
        
        let theta = (self.pile.diameter / spacing).atan().to_degrees();
        1.0 - theta * (2.0 * m - 2.0) / (90.0 * m.powi(2))
    }
    
    /// Calculate pile loads under vertical load and moments
    pub fn pile_loads(&self, p: f64, mx: f64, my: f64) -> Vec<f64> {
        let n = self.n_piles() as f64;
        
        // Sum of squared distances
        let sum_x2: f64 = self.piles.iter().map(|(x, _)| x.powi(2)).sum();
        let sum_y2: f64 = self.piles.iter().map(|(_, y)| y.powi(2)).sum();
        
        self.piles.iter().map(|(x, y)| {
            let p_vertical = p / n;
            let p_mx = if sum_y2 > 0.0 { mx * y / sum_y2 } else { 0.0 };
            let p_my = if sum_x2 > 0.0 { my * x / sum_x2 } else { 0.0 };
            p_vertical + p_mx + p_my
        }).collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_soil_layer_clay() {
        let clay = SoilLayer::clay(5.0, 50.0, 18.0);
        assert_eq!(clay.thickness, 5.0);
        assert_eq!(clay.cohesion, 50.0);
        assert!(clay.e_s > 0.0);
    }

    #[test]
    fn test_soil_layer_sand() {
        let sand = SoilLayer::sand(10.0, 35.0, 19.0, 25.0);
        assert_eq!(sand.phi, 35.0);
        assert_eq!(sand.n_spt, 25.0);
    }

    #[test]
    fn test_soil_profile() {
        let mut profile = SoilProfile::new();
        profile.add_layer(SoilLayer::sand(5.0, 30.0, 18.0, 15.0));
        profile.add_layer(SoilLayer::clay(10.0, 60.0, 17.0));
        
        assert_eq!(profile.total_depth(), 15.0);
        assert!(profile.layer_at_depth(3.0).is_some());
    }

    #[test]
    fn test_overburden_pressure() {
        let mut profile = SoilProfile::new();
        profile.add_layer(SoilLayer::sand(10.0, 30.0, 18.0, 20.0));
        profile.water_table = 5.0;
        
        let p5 = profile.overburden_pressure(5.0);
        let p10 = profile.overburden_pressure(10.0);
        
        assert!(p5 > 0.0);
        assert!(p10 > p5);
    }

    #[test]
    fn test_vs30() {
        let mut profile = SoilProfile::new();
        profile.add_layer(SoilLayer::sand(15.0, 35.0, 19.0, 30.0));
        profile.add_layer(SoilLayer::clay(15.0, 80.0, 18.0));
        
        let vs30 = profile.vs30();
        assert!(vs30 > 100.0 && vs30 < 500.0);
    }

    #[test]
    fn test_bearing_capacity_terzaghi() {
        let result = BearingCapacity::terzaghi(
            50.0,  // cohesion
            30.0,  // phi
            18.0,  // gamma
            1.5,   // depth
            2.0,   // width
            FoundationType::Isolated,
        );
        
        assert!(result.q_ultimate > 0.0);
        assert!(result.q_safe < result.q_ultimate);
        assert!(result.nc > 0.0);
    }

    #[test]
    fn test_bearing_capacity_is6403() {
        let result = BearingCapacity::is6403(
            25.0,       // cohesion
            28.0,       // phi
            17.0,       // gamma
            1.2,        // depth
            2.5,        // width
            3.0,        // length
            5.0,        // inclination
            Some(3.0),  // water table
        );
        
        assert!(result.q_ultimate > 0.0);
        assert!(result.fos == 2.5);
    }

    #[test]
    fn test_isolated_footing() {
        let footing = IsolatedFooting::new(3.0, 2.5, 1.5, 0.6);
        
        assert!((footing.area() - 7.5).abs() < 0.01);
        assert!(footing.zx() > 0.0);
        assert!(footing.zy() > 0.0);
    }

    #[test]
    fn test_footing_stiffness() {
        let footing = IsolatedFooting::new(2.0, 2.0, 1.0, 0.5);
        let ks = 30000.0; // kN/m³
        
        let kv = footing.vertical_stiffness(ks);
        assert!((kv - 120000.0).abs() < 1.0);
    }

    #[test]
    fn test_winkler_springs() {
        let foundation = WinklerFoundation::new(25000.0, 4.0, 3.0, 4, 3);
        let springs = foundation.generate_springs();
        
        assert_eq!(springs.len(), 20); // (4+1) * (3+1)
        assert!(springs.iter().all(|s| s.kz > 0.0));
    }

    #[test]
    fn test_pile_properties() {
        let pile = Pile::new(PileType::Bored, 0.6, 15.0);
        
        assert!((pile.area() - PI * 0.36 / 4.0).abs() < 0.001);
        assert!((pile.perimeter() - PI * 0.6).abs() < 0.001);
    }

    #[test]
    fn test_pile_capacity() {
        let pile = Pile::new(PileType::Bored, 0.6, 20.0);
        let mut profile = SoilProfile::new();
        profile.add_layer(SoilLayer::sand(10.0, 32.0, 18.0, 20.0));
        profile.add_layer(SoilLayer::clay(15.0, 80.0, 17.0));
        
        let result = PileCapacity::axial_capacity(&pile, &profile);
        
        assert!(result.shaft_friction > 0.0);
        assert!(result.end_bearing > 0.0);
        assert!(result.safe_capacity < result.ultimate_capacity);
    }

    #[test]
    fn test_pile_group() {
        let pile = Pile::new(PileType::Driven, 0.45, 12.0);
        let group = PileGroup::rectangular_grid(pile, 3, 2, 1.35, 1.35, 0.8);
        
        assert_eq!(group.n_piles(), 6);
        assert!(group.efficiency(1.35) > 0.5 && group.efficiency(1.35) <= 1.0);
    }

    #[test]
    fn test_pile_group_loads() {
        let pile = Pile::new(PileType::Driven, 0.45, 12.0);
        let group = PileGroup::rectangular_grid(pile, 2, 2, 1.5, 1.5, 0.8);
        
        let loads = group.pile_loads(1000.0, 100.0, 50.0);
        
        assert_eq!(loads.len(), 4);
        let total: f64 = loads.iter().sum();
        assert!((total - 1000.0).abs() < 1.0);
    }

    #[test]
    fn test_soil_type_amplification() {
        let soil = SoilType::Soft;
        let fa = soil.fa(0.5);
        
        assert!(fa > 1.0); // Soft soil amplifies
    }
}
