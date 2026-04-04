// ============================================================================
// PILE FOUNDATION DESIGN MODULE
// IS 2911, API RP2A, Eurocode 7 - Deep foundation design
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// PILE TYPES
// ============================================================================

/// Pile type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PileType {
    /// Driven precast concrete pile
    DrivenPrecast,
    /// Driven steel H-pile
    DrivenSteelH,
    /// Driven steel pipe pile
    DrivenPipe,
    /// Bored cast-in-situ pile
    BoredCastInSitu,
    /// Continuous flight auger (CFA)
    CFA,
    /// Micropile/minipile
    Micropile,
    /// Drilled shaft/caisson
    DrilledShaft,
    /// Driven timber pile
    DrivenTimber,
}

impl PileType {
    /// Installation factor for skin friction
    pub fn skin_friction_factor(&self) -> f64 {
        match self {
            PileType::DrivenPrecast => 1.0,
            PileType::DrivenSteelH => 0.8,
            PileType::DrivenPipe => 0.9,
            PileType::BoredCastInSitu => 0.7,
            PileType::CFA => 0.75,
            PileType::Micropile => 0.85,
            PileType::DrilledShaft => 0.6,
            PileType::DrivenTimber => 0.9,
        }
    }
    
    /// End bearing factor
    pub fn end_bearing_factor(&self) -> f64 {
        match self {
            PileType::DrivenPrecast => 1.0,
            PileType::DrivenSteelH => 0.7,
            PileType::DrivenPipe => 0.9,
            PileType::BoredCastInSitu => 0.6,
            PileType::CFA => 0.65,
            PileType::Micropile => 0.5,
            PileType::DrilledShaft => 0.55,
            PileType::DrivenTimber => 0.8,
        }
    }
}

/// Soil type for pile design
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SoilType {
    /// Soft clay (Cu < 25 kPa)
    SoftCite,
    /// Medium clay (25 < Cu < 50 kPa)
    MediumClay,
    /// Stiff clay (50 < Cu < 100 kPa)
    StiffClay,
    /// Very stiff clay (Cu > 100 kPa)
    VeryStiffClay,
    /// Loose sand (N < 10)
    LooseSand,
    /// Medium dense sand (10 < N < 30)
    MediumSand,
    /// Dense sand (N > 30)
    DenseSand,
    /// Gravel
    Gravel,
    /// Rock
    Rock,
}

// ============================================================================
// SOIL LAYER
// ============================================================================

/// Soil layer for pile analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Layer thickness (m)
    pub thickness: f64,
    /// Soil type
    pub soil_type: SoilType,
    /// Undrained shear strength Cu (kPa) - for clay
    pub cu: Option<f64>,
    /// SPT N-value - for granular soils
    pub n_spt: Option<u32>,
    /// Effective friction angle (degrees)
    pub phi: f64,
    /// Unit weight (kN/m³)
    pub gamma: f64,
    /// Earth pressure coefficient at rest
    pub k0: f64,
}

impl SoilLayer {
    pub fn clay(thickness: f64, cu: f64, gamma: f64) -> Self {
        let soil_type = if cu < 25.0 {
            SoilType::SoftCite
        } else if cu < 50.0 {
            SoilType::MediumClay
        } else if cu < 100.0 {
            SoilType::StiffClay
        } else {
            SoilType::VeryStiffClay
        };
        
        Self {
            thickness,
            soil_type,
            cu: Some(cu),
            n_spt: None,
            phi: 0.0,
            gamma,
            k0: 0.5,
        }
    }
    
    pub fn sand(thickness: f64, n_spt: u32, phi: f64, gamma: f64) -> Self {
        let soil_type = if n_spt < 10 {
            SoilType::LooseSand
        } else if n_spt < 30 {
            SoilType::MediumSand
        } else {
            SoilType::DenseSand
        };
        
        Self {
            thickness,
            soil_type,
            cu: None,
            n_spt: Some(n_spt),
            phi,
            gamma,
            k0: 1.0 - phi.to_radians().sin(),
        }
    }
    
    /// Ultimate skin friction (kPa)
    pub fn skin_friction(&self, depth: f64, pile_type: PileType) -> f64 {
        let factor = pile_type.skin_friction_factor();
        
        match self.soil_type {
            SoilType::SoftCite | SoilType::MediumClay | 
            SoilType::StiffClay | SoilType::VeryStiffClay => {
                // Alpha method for clay
                let cu = self.cu.unwrap_or(50.0);
                let alpha = if cu < 25.0 {
                    1.0
                } else if cu < 50.0 {
                    0.9
                } else if cu < 100.0 {
                    0.6
                } else {
                    0.45
                };
                alpha * cu * factor
            }
            SoilType::LooseSand | SoilType::MediumSand | 
            SoilType::DenseSand | SoilType::Gravel => {
                // Beta method for sand
                let sigma_v = self.gamma * depth;
                let beta = self.k0 * self.phi.to_radians().tan();
                let fs = beta * sigma_v * factor;
                fs.min(200.0) // Limiting value
            }
            SoilType::Rock => {
                // Rock socket friction
                500.0 * factor
            }
        }
    }
    
    /// Ultimate end bearing (kPa)
    pub fn end_bearing(&self, pile_type: PileType) -> f64 {
        let factor = pile_type.end_bearing_factor();
        
        match self.soil_type {
            SoilType::SoftCite | SoilType::MediumClay | 
            SoilType::StiffClay | SoilType::VeryStiffClay => {
                let cu = self.cu.unwrap_or(50.0);
                9.0 * cu * factor
            }
            SoilType::LooseSand | SoilType::MediumSand | 
            SoilType::DenseSand | SoilType::Gravel => {
                let n = self.n_spt.unwrap_or(20) as f64;
                let nq = (45.0 + self.phi / 2.0).to_radians().tan().powi(2) 
                         * (PI * self.phi.to_radians().tan()).exp();
                let qb = nq * self.gamma * 10.0; // At 10m depth reference
                (qb * factor).min(n * 400.0) // Limiting value
            }
            SoilType::Rock => {
                // Rock bearing
                5000.0 * factor
            }
        }
    }
}

// ============================================================================
// PILE GEOMETRY
// ============================================================================

/// Single pile definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pile {
    /// Pile type
    pub pile_type: PileType,
    /// Pile diameter or width (m)
    pub diameter: f64,
    /// Pile length (m)
    pub length: f64,
    /// Embedded length (m)
    pub embedded_length: f64,
    /// Concrete strength (MPa) if applicable
    pub fck: Option<f64>,
    /// Steel yield strength (MPa) if applicable
    pub fy: Option<f64>,
    /// Wall thickness for pipe piles (m)
    pub wall_thickness: Option<f64>,
}

impl Pile {
    pub fn bored(diameter: f64, length: f64) -> Self {
        Self {
            pile_type: PileType::BoredCastInSitu,
            diameter,
            length,
            embedded_length: length,
            fck: Some(30.0),
            fy: Some(500.0),
            wall_thickness: None,
        }
    }
    
    pub fn driven_precast(diameter: f64, length: f64) -> Self {
        Self {
            pile_type: PileType::DrivenPrecast,
            diameter,
            length,
            embedded_length: length,
            fck: Some(40.0),
            fy: Some(500.0),
            wall_thickness: None,
        }
    }
    
    pub fn pipe_pile(diameter: f64, wall_thickness: f64, length: f64) -> Self {
        Self {
            pile_type: PileType::DrivenPipe,
            diameter,
            length,
            embedded_length: length,
            fck: None,
            fy: Some(345.0),
            wall_thickness: Some(wall_thickness),
        }
    }
    
    /// Cross-sectional area (m²)
    pub fn area(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenPipe => {
                let t = self.wall_thickness.unwrap_or(0.02);
                PI * (self.diameter - t) * t
            }
            PileType::DrivenSteelH => {
                // Approximate H-pile area
                self.diameter * 0.3 * 0.02 * 2.0 + self.diameter * 0.015
            }
            _ => PI * self.diameter.powi(2) / 4.0,
        }
    }
    
    /// Perimeter (m)
    pub fn perimeter(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenSteelH => {
                // Full perimeter of H-section
                2.0 * (self.diameter + self.diameter * 0.3)
            }
            _ => PI * self.diameter,
        }
    }
    
    /// End area for bearing (m²)
    pub fn end_area(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenPipe => {
                // Open-ended vs closed
                PI * self.diameter.powi(2) / 4.0 * 0.5 // Partial plugging
            }
            PileType::DrivenSteelH => {
                // Box area between flanges
                self.diameter * self.diameter * 0.3
            }
            _ => PI * self.diameter.powi(2) / 4.0,
        }
    }
    
    /// Moment of inertia (m⁴)
    pub fn moment_of_inertia(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenPipe => {
                let d = self.diameter;
                let t = self.wall_thickness.unwrap_or(0.02);
                PI * (d.powi(4) - (d - 2.0 * t).powi(4)) / 64.0
            }
            _ => PI * self.diameter.powi(4) / 64.0,
        }
    }
    
    /// Section modulus (m³)
    pub fn section_modulus(&self) -> f64 {
        self.moment_of_inertia() / (self.diameter / 2.0)
    }
    
    /// Structural capacity (kN)
    pub fn structural_capacity(&self) -> f64 {
        match self.pile_type {
            PileType::BoredCastInSitu | PileType::DrivenPrecast | 
            PileType::CFA | PileType::DrilledShaft => {
                let fck = self.fck.unwrap_or(30.0);
                0.4 * fck * self.area() * 1000.0
            }
            PileType::DrivenPipe | PileType::DrivenSteelH => {
                let fy = self.fy.unwrap_or(345.0);
                0.85 * fy * self.area() * 1000.0
            }
            _ => {
                // Conservative default
                0.3 * 30.0 * self.area() * 1000.0
            }
        }
    }
}

// ============================================================================
// PILE CAPACITY CALCULATOR
// ============================================================================

/// Pile capacity calculator per IS 2911 / API RP2A
pub struct PileCapacityCalculator {
    pub pile: Pile,
    pub soil_layers: Vec<SoilLayer>,
}

impl PileCapacityCalculator {
    pub fn new(pile: Pile, soil_layers: Vec<SoilLayer>) -> Self {
        Self { pile, soil_layers }
    }
    
    /// Ultimate skin friction capacity (kN)
    pub fn skin_friction_capacity(&self) -> f64 {
        let mut total = 0.0;
        let mut depth = 0.0;
        
        for layer in &self.soil_layers {
            let layer_top = depth;
            let layer_bottom = depth + layer.thickness;
            
            // Check if pile penetrates this layer
            if layer_top >= self.pile.embedded_length {
                break;
            }
            
            let effective_top = layer_top;
            let effective_bottom = layer_bottom.min(self.pile.embedded_length);
            let effective_thickness = effective_bottom - effective_top;
            
            if effective_thickness > 0.0 {
                let mid_depth = (effective_top + effective_bottom) / 2.0;
                let fs = layer.skin_friction(mid_depth, self.pile.pile_type);
                total += fs * self.pile.perimeter() * effective_thickness;
            }
            
            depth = layer_bottom;
        }
        
        total
    }
    
    /// Ultimate end bearing capacity (kN)
    pub fn end_bearing_capacity(&self) -> f64 {
        // Find layer at pile tip
        let mut depth = 0.0;
        
        for layer in &self.soil_layers {
            let layer_bottom = depth + layer.thickness;
            
            if layer_bottom >= self.pile.embedded_length {
                let qb = layer.end_bearing(self.pile.pile_type);
                return qb * self.pile.end_area();
            }
            
            depth = layer_bottom;
        }
        
        // If pile extends beyond defined layers, use last layer
        if let Some(layer) = self.soil_layers.last() {
            let qb = layer.end_bearing(self.pile.pile_type);
            return qb * self.pile.end_area();
        }
        
        0.0
    }
    
    /// Ultimate compression capacity (kN)
    pub fn ultimate_compression(&self) -> f64 {
        self.skin_friction_capacity() + self.end_bearing_capacity()
    }
    
    /// Ultimate tension capacity (kN)
    pub fn ultimate_tension(&self) -> f64 {
        // Typically 70-80% of skin friction for tension
        self.skin_friction_capacity() * 0.7
    }
    
    /// Allowable compression capacity (kN) - IS 2911
    pub fn allowable_compression(&self, fos: f64) -> f64 {
        self.ultimate_compression() / fos
    }
    
    /// Allowable tension capacity (kN)
    pub fn allowable_tension(&self, fos: f64) -> f64 {
        self.ultimate_tension() / fos
    }
    
    /// Settlement estimation (mm) - Vesic method
    pub fn settlement(&self, load: f64) -> f64 {
        let qu = self.ultimate_compression();
        let qs = self.skin_friction_capacity();
        let qb = self.end_bearing_capacity();
        
        let e = 30_000.0; // Concrete E (MPa)
        let l = self.pile.length;
        let a = self.pile.area();
        let d = self.pile.diameter;
        
        // Elastic shortening of pile
        let s_elastic = (load * l) / (a * e * 1000.0);
        
        // Settlement from skin friction
        let s_skin = if qs > 0.0 {
            (0.57 * load * qs / qu) / (d * 1000.0 * qs / (l * 1000.0)).sqrt()
        } else {
            0.0
        };
        
        // Settlement from end bearing
        let s_base = if qb > 0.0 {
            (load * qb / qu) * d * 1000.0 / (qb * 4.0)
        } else {
            0.0
        };
        
        s_elastic + s_skin + s_base
    }
}

// ============================================================================
// PILE GROUP ANALYSIS
// ============================================================================

/// Pile group configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileGroup {
    /// Individual pile
    pub pile: Pile,
    /// Number of rows
    pub rows: u32,
    /// Number of columns
    pub cols: u32,
    /// Spacing in X direction (m)
    pub spacing_x: f64,
    /// Spacing in Y direction (m)
    pub spacing_y: f64,
    /// Pile cap thickness (m)
    pub cap_thickness: f64,
}

impl PileGroup {
    pub fn new(pile: Pile, rows: u32, cols: u32, spacing: f64) -> Self {
        Self {
            pile,
            rows,
            cols,
            spacing_x: spacing,
            spacing_y: spacing,
            cap_thickness: 1.0,
        }
    }
    
    /// Total number of piles
    pub fn num_piles(&self) -> u32 {
        self.rows * self.cols
    }
    
    /// Group efficiency factor (Converse-Labarre)
    pub fn efficiency(&self) -> f64 {
        let m = self.rows as f64;
        let n = self.cols as f64;
        let d = self.pile.diameter;
        let s = (self.spacing_x + self.spacing_y) / 2.0;
        
        let theta = (d / s).atan().to_degrees();
        
        1.0 - theta * ((m - 1.0) * n + (n - 1.0) * m) / (90.0 * m * n)
    }
    
    /// Group dimensions (m)
    pub fn group_dimensions(&self) -> (f64, f64) {
        let lx = (self.cols - 1) as f64 * self.spacing_x + self.pile.diameter;
        let ly = (self.rows - 1) as f64 * self.spacing_y + self.pile.diameter;
        (lx, ly)
    }
    
    /// Pile cap area (m²)
    pub fn cap_area(&self) -> f64 {
        let (lx, ly) = self.group_dimensions();
        // Add edge distance
        let edge = self.pile.diameter / 2.0 + 0.15;
        (lx + 2.0 * edge) * (ly + 2.0 * edge)
    }
    
    /// Ultimate group capacity (kN)
    pub fn ultimate_capacity(&self, soil_layers: &[SoilLayer]) -> f64 {
        let calc = PileCapacityCalculator::new(self.pile.clone(), soil_layers.to_vec());
        let single_capacity = calc.ultimate_compression();
        let n = self.num_piles() as f64;
        let eta = self.efficiency();
        
        // Group capacity is minimum of:
        // 1. Sum of individual capacities × efficiency
        // 2. Block failure capacity
        let individual = n * single_capacity * eta;
        
        // Block failure
        let (lx, ly) = self.group_dimensions();
        let perimeter = 2.0 * (lx + ly);
        let block_skin = calc.skin_friction_capacity() / self.pile.perimeter() * perimeter;
        let block_base = calc.end_bearing_capacity() / self.pile.end_area() * lx * ly;
        let block = block_skin + block_base;
        
        individual.min(block)
    }
    
    /// Load distribution to individual piles under vertical load and moments
    pub fn pile_loads(&self, p: f64, mx: f64, my: f64) -> Vec<f64> {
        let n = self.num_piles();
        let mut loads = Vec::with_capacity(n as usize);
        
        // Calculate sum of squared distances
        let mut sum_x2 = 0.0;
        let mut sum_y2 = 0.0;
        
        for row in 0..self.rows {
            for col in 0..self.cols {
                let x = (col as f64 - (self.cols - 1) as f64 / 2.0) * self.spacing_x;
                let y = (row as f64 - (self.rows - 1) as f64 / 2.0) * self.spacing_y;
                sum_x2 += x.powi(2);
                sum_y2 += y.powi(2);
            }
        }
        
        // Calculate load on each pile
        for row in 0..self.rows {
            for col in 0..self.cols {
                let x = (col as f64 - (self.cols - 1) as f64 / 2.0) * self.spacing_x;
                let y = (row as f64 - (self.rows - 1) as f64 / 2.0) * self.spacing_y;
                
                let p_axial = p / (n as f64);
                let p_mx = if sum_y2 > 0.0 { mx * y / sum_y2 } else { 0.0 };
                let p_my = if sum_x2 > 0.0 { my * x / sum_x2 } else { 0.0 };
                
                loads.push(p_axial + p_mx + p_my);
            }
        }
        
        loads
    }
    
    /// Maximum and minimum pile loads
    pub fn pile_load_extremes(&self, p: f64, mx: f64, my: f64) -> (f64, f64) {
        let loads = self.pile_loads(p, mx, my);
        let max = loads.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let min = loads.iter().cloned().fold(f64::INFINITY, f64::min);
        (max, min)
    }
}

// ============================================================================
// LATERAL PILE ANALYSIS
// ============================================================================

/// Lateral pile analysis (p-y method simplified)
pub struct LateralPileAnalyzer {
    pub pile: Pile,
    pub soil_layers: Vec<SoilLayer>,
    /// Pile head fixity (true = fixed, false = free)
    pub head_fixed: bool,
}

impl LateralPileAnalyzer {
    pub fn new(pile: Pile, soil_layers: Vec<SoilLayer>) -> Self {
        Self {
            pile,
            soil_layers,
            head_fixed: false,
        }
    }
    
    /// Characteristic length (m)
    pub fn characteristic_length(&self) -> f64 {
        // Average soil modulus
        let avg_k = self.soil_layers.iter()
            .map(|l| l.gamma * 500.0) // Approximate subgrade modulus
            .sum::<f64>() / self.soil_layers.len() as f64;
        
        let ei = self.pile_stiffness();
        let d = self.pile.diameter;
        
        (4.0 * ei / (avg_k * d)).powf(0.25)
    }
    
    /// Pile stiffness EI (kN·m²)
    pub fn pile_stiffness(&self) -> f64 {
        let e = match self.pile.pile_type {
            PileType::DrivenPipe | PileType::DrivenSteelH => 200_000_000.0,
            _ => 30_000_000.0,
        };
        e * self.pile.moment_of_inertia()
    }
    
    /// Lateral deflection at head (m)
    pub fn head_deflection(&self, h: f64, m: f64) -> f64 {
        let t = self.characteristic_length();
        let ei = self.pile_stiffness();
        
        if self.head_fixed {
            // Fixed head
            h * t.powi(3) / (4.0 * ei) + m * t.powi(2) / (2.0 * ei)
        } else {
            // Free head
            h * t.powi(3) / (3.0 * ei) + m * t.powi(2) / (2.0 * ei)
        }
    }
    
    /// Maximum bending moment (kN·m)
    pub fn max_moment(&self, h: f64, m0: f64) -> f64 {
        let t = self.characteristic_length();
        
        if self.head_fixed {
            // Fixed head - moment at head governs
            h * t + m0
        } else {
            // Free head - max moment below ground
            0.77 * h * t + m0
        }
    }
    
    /// Ultimate lateral capacity (kN) - Broms method
    pub fn ultimate_lateral_capacity(&self) -> f64 {
        let d = self.pile.diameter;
        let l = self.pile.embedded_length;
        
        // Average soil strength
        let avg_cu = self.soil_layers.iter()
            .filter_map(|l| l.cu)
            .sum::<f64>() / self.soil_layers.iter().filter(|l| l.cu.is_some()).count().max(1) as f64;
        
        if avg_cu > 0.0 {
            // Cohesive soil - short pile
            9.0 * avg_cu * d * l * 0.5
        } else {
            // Cohesionless soil - Broms method
            let avg_gamma = self.soil_layers.iter().map(|l| l.gamma).sum::<f64>() 
                          / self.soil_layers.len() as f64;
            let avg_phi = self.soil_layers.iter()
                .filter(|l| l.phi > 0.0)
                .map(|l| l.phi)
                .sum::<f64>() / self.soil_layers.iter().filter(|l| l.phi > 0.0).count().max(1) as f64;
            let kp = (45.0_f64 + avg_phi / 2.0).to_radians().tan().powi(2);
            kp * avg_gamma * d * l.powi(2) / 2.0
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pile_area() {
        let pile = Pile::bored(0.6, 15.0);
        let area = pile.area();
        
        assert!((area - PI * 0.6_f64.powi(2) / 4.0).abs() < 0.001);
    }

    #[test]
    fn test_pile_perimeter() {
        let pile = Pile::bored(0.6, 15.0);
        let perim = pile.perimeter();
        
        assert!((perim - PI * 0.6).abs() < 0.001);
    }

    #[test]
    fn test_pipe_pile() {
        let pile = Pile::pipe_pile(0.6, 0.02, 30.0);
        
        assert!(pile.area() < PI * 0.6_f64.powi(2) / 4.0);
    }

    #[test]
    fn test_soil_layer_clay() {
        let layer = SoilLayer::clay(5.0, 50.0, 18.0);
        
        assert_eq!(layer.soil_type, SoilType::StiffClay);
        assert_eq!(layer.cu, Some(50.0));
    }

    #[test]
    fn test_soil_layer_sand() {
        let layer = SoilLayer::sand(5.0, 25, 35.0, 19.0);
        
        assert_eq!(layer.soil_type, SoilType::MediumSand);
    }

    #[test]
    fn test_skin_friction_clay() {
        let layer = SoilLayer::clay(10.0, 50.0, 18.0);
        let fs = layer.skin_friction(5.0, PileType::BoredCastInSitu);
        
        assert!(fs > 0.0 && fs < 100.0);
    }

    #[test]
    fn test_end_bearing_clay() {
        let layer = SoilLayer::clay(10.0, 100.0, 19.0);
        let qb = layer.end_bearing(PileType::BoredCastInSitu);
        
        assert!((qb - 9.0 * 100.0 * 0.6).abs() < 1.0);
    }

    #[test]
    fn test_pile_capacity() {
        let pile = Pile::bored(0.6, 15.0);
        let layers = vec![
            SoilLayer::clay(5.0, 30.0, 17.0),
            SoilLayer::clay(10.0, 60.0, 18.0),
            SoilLayer::sand(10.0, 30, 35.0, 19.0),
        ];
        
        let calc = PileCapacityCalculator::new(pile, layers);
        let qu = calc.ultimate_compression();
        
        assert!(qu > 500.0); // Should be several hundred kN
    }

    #[test]
    fn test_skin_vs_end_bearing() {
        let pile = Pile::bored(0.6, 20.0);
        let layers = vec![
            SoilLayer::clay(25.0, 80.0, 18.0),
        ];
        
        let calc = PileCapacityCalculator::new(pile, layers);
        let qs = calc.skin_friction_capacity();
        let qb = calc.end_bearing_capacity();
        
        assert!(qs > 0.0);
        assert!(qb > 0.0);
    }

    #[test]
    fn test_tension_less_than_compression() {
        let pile = Pile::bored(0.6, 15.0);
        let layers = vec![SoilLayer::clay(20.0, 60.0, 18.0)];
        
        let calc = PileCapacityCalculator::new(pile, layers);
        
        assert!(calc.ultimate_tension() < calc.ultimate_compression());
    }

    #[test]
    fn test_pile_group() {
        let pile = Pile::bored(0.6, 15.0);
        let group = PileGroup::new(pile, 3, 3, 1.8);
        
        assert_eq!(group.num_piles(), 9);
    }

    #[test]
    fn test_group_efficiency() {
        let pile = Pile::bored(0.6, 15.0);
        let group = PileGroup::new(pile, 3, 3, 1.8);
        let eta = group.efficiency();
        
        assert!(eta > 0.5 && eta < 1.0);
    }

    #[test]
    fn test_pile_loads_symmetric() {
        let pile = Pile::bored(0.6, 15.0);
        let group = PileGroup::new(pile, 2, 2, 1.5);
        
        let loads = group.pile_loads(1000.0, 0.0, 0.0);
        
        // All loads should be equal for symmetric case
        for load in &loads {
            assert!((load - 250.0).abs() < 0.1);
        }
    }

    #[test]
    fn test_pile_loads_with_moment() {
        let pile = Pile::bored(0.6, 15.0);
        let group = PileGroup::new(pile, 2, 2, 1.5);
        
        let (max, min) = group.pile_load_extremes(1000.0, 500.0, 0.0);
        
        assert!(max > min);
    }

    #[test]
    fn test_lateral_analysis() {
        let pile = Pile::bored(0.6, 15.0);
        let layers = vec![SoilLayer::clay(20.0, 50.0, 18.0)];
        
        let analyzer = LateralPileAnalyzer::new(pile, layers);
        let t = analyzer.characteristic_length();
        
        assert!(t > 0.0 && t < 10.0);
    }

    #[test]
    fn test_lateral_deflection() {
        let pile = Pile::bored(0.6, 15.0);
        let layers = vec![SoilLayer::clay(20.0, 50.0, 18.0)];
        
        let analyzer = LateralPileAnalyzer::new(pile, layers);
        let defl = analyzer.head_deflection(100.0, 0.0);
        
        assert!(defl > 0.0);
    }

    #[test]
    fn test_structural_capacity() {
        let pile = Pile::bored(0.6, 15.0);
        let cap = pile.structural_capacity();
        
        assert!(cap > 1000.0); // Should be > 1000 kN for 600mm diameter
    }

    #[test]
    fn test_installation_factors() {
        assert!(PileType::DrivenPrecast.skin_friction_factor() > 
                PileType::BoredCastInSitu.skin_friction_factor());
    }
}
