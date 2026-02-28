//! Deep Excavation Module
//! 
//! Implements deep excavation and shoring system design per:
//! - ASCE Guidelines for Design of Deep Excavations
//! - FHWA-IF-99-015 (Geotechnical Engineering Circular No. 4)
//! - EAB (German Recommendations)
//! - Eurocode 7 (EN 1997)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// EXCAVATION PARAMETERS
// ============================================================================

/// Excavation support type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SupportType {
    /// Cantilevered wall (no bracing)
    Cantilever,
    /// Single level of bracing
    SingleBraced,
    /// Multi-level bracing
    MultiBraced,
    /// Tied-back (anchored)
    TiedBack,
    /// Top-down construction
    TopDown,
    /// Soil nailed wall
    SoilNailed,
}

/// Wall type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WallType {
    /// Steel sheet pile
    SheetPile,
    /// Soldier pile and lagging
    SoldierPile,
    /// Secant pile wall
    SecantPile,
    /// Tangent pile wall
    TangentPile,
    /// Diaphragm wall (slurry wall)
    DiaphragmWall,
    /// Soil mix wall (SMW)
    SoilMixWall,
    /// Jet grout wall
    JetGroutWall,
}

impl WallType {
    /// Typical stiffness ratio (EI per unit width, kN·m²/m)
    pub fn typical_stiffness(&self) -> f64 {
        match self {
            Self::SheetPile => 50_000.0,
            Self::SoldierPile => 30_000.0,
            Self::SecantPile => 150_000.0,
            Self::TangentPile => 120_000.0,
            Self::DiaphragmWall => 300_000.0,
            Self::SoilMixWall => 80_000.0,
            Self::JetGroutWall => 60_000.0,
        }
    }
    
    /// Typical minimum embedment ratio (D/H)
    pub fn embedment_ratio(&self) -> f64 {
        match self {
            Self::SheetPile => 0.6,
            Self::SoldierPile => 0.5,
            Self::SecantPile => 0.5,
            Self::TangentPile => 0.5,
            Self::DiaphragmWall => 0.4,
            Self::SoilMixWall => 0.5,
            Self::JetGroutWall => 0.5,
        }
    }
}

/// Deep excavation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExcavationParameters {
    /// Excavation depth (m)
    pub depth: f64,
    /// Excavation width (m)
    pub width: f64,
    /// Excavation length (m)
    pub length: f64,
    /// Wall type
    pub wall_type: WallType,
    /// Support type
    pub support_type: SupportType,
    /// Number of bracing levels
    pub n_bracing_levels: usize,
    /// Wall embedment depth (m)
    pub embedment: f64,
    /// Wall stiffness EI (kN·m²/m)
    pub wall_stiffness: f64,
}

impl ExcavationParameters {
    pub fn new(
        depth: f64,
        width: f64,
        length: f64,
        wall_type: WallType,
        support_type: SupportType,
    ) -> Self {
        let n_bracing = match support_type {
            SupportType::Cantilever => 0,
            SupportType::SingleBraced => 1,
            SupportType::MultiBraced | SupportType::TiedBack => ((depth / 3.0).ceil() as usize).max(2),
            SupportType::TopDown => ((depth / 4.0).ceil() as usize).max(1),
            SupportType::SoilNailed => ((depth / 1.5).ceil() as usize).max(2),
        };
        
        Self {
            depth,
            width,
            length,
            wall_type,
            support_type,
            n_bracing_levels: n_bracing,
            embedment: depth * wall_type.embedment_ratio(),
            wall_stiffness: wall_type.typical_stiffness(),
        }
    }
    
    /// Total wall length
    pub fn wall_length(&self) -> f64 {
        self.depth + self.embedment
    }
    
    /// Perimeter
    pub fn perimeter(&self) -> f64 {
        2.0 * (self.width + self.length)
    }
}

// ============================================================================
// EARTH PRESSURE
// ============================================================================

/// Earth pressure state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PressureState {
    /// At-rest (K0)
    AtRest,
    /// Active (Ka)
    Active,
    /// Passive (Kp)
    Passive,
}

/// Soil layer for excavation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Layer thickness (m)
    pub thickness: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
    /// Friction angle (degrees)
    pub phi: f64,
    /// Cohesion (kPa)
    pub cohesion: f64,
    /// Wall friction angle (degrees)
    pub delta: f64,
    /// Undrained shear strength (kPa)
    pub su: Option<f64>,
    /// Young's modulus (MPa)
    pub modulus: f64,
}

impl SoilLayer {
    /// At-rest coefficient (Jaky's formula)
    pub fn k0(&self) -> f64 {
        1.0 - (self.phi * PI / 180.0).sin()
    }
    
    /// Active earth pressure coefficient (Rankine)
    pub fn ka_rankine(&self) -> f64 {
        let phi_rad = self.phi * PI / 180.0;
        (PI / 4.0 - phi_rad / 2.0).tan().powi(2)
    }
    
    /// Passive earth pressure coefficient (Rankine)
    pub fn kp_rankine(&self) -> f64 {
        let phi_rad = self.phi * PI / 180.0;
        (PI / 4.0 + phi_rad / 2.0).tan().powi(2)
    }
    
    /// Active coefficient with wall friction (Coulomb)
    /// Ka = sin²(α+φ) / [sin²α · sin(α−δ) · (1 + √(sin(φ+δ)sin(φ−β)/(sin(α−δ)sin(α+β))))²]
    pub fn ka_coulomb(&self) -> f64 {
        let phi = self.phi * PI / 180.0;
        let delta = self.delta * PI / 180.0;
        let alpha = PI / 2.0; // Vertical wall
        let beta = 0.0; // Horizontal backfill
        
        let num = (alpha + phi).sin().powi(2);
        let denom = alpha.sin().powi(2) * (alpha - delta).sin()
            * (1.0 + ((phi + delta).sin() * (phi - beta).sin()
                / ((alpha - delta).sin() * (alpha + beta).sin())).sqrt()).powi(2);
        
        num / denom
    }
    
    /// Passive coefficient with wall friction (Coulomb)
    /// Kp = cos²φ / [cosδ · (1 − √(sin(φ+δ)sinφ/cosδ))²]
    pub fn kp_coulomb(&self) -> f64 {
        let phi = self.phi * PI / 180.0;
        let delta = self.delta * PI / 180.0;
        
        let num = phi.cos().powi(2);
        let denom = delta.cos()
            * (1.0 - ((phi + delta).sin() * phi.sin() / delta.cos()).sqrt()).powi(2);
        
        num / denom
    }
}

/// Earth pressure calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarthPressure {
    /// Depth points (m)
    pub depth: Vec<f64>,
    /// Horizontal pressure (kPa)
    pub pressure: Vec<f64>,
    /// Total horizontal force (kN/m)
    pub total_force: f64,
    /// Point of application from top (m)
    pub application_point: f64,
}

impl EarthPressure {
    /// Calculate active earth pressure
    pub fn active(layers: &[SoilLayer], total_depth: f64, surcharge: f64) -> Self {
        let mut depth = Vec::new();
        let mut pressure = Vec::new();
        
        let n_points = 50;
        let dz = total_depth / n_points as f64;
        
        let mut z = 0.0;
        let mut current_layer = 0;
        let mut layer_top = 0.0;
        
        while z <= total_depth && current_layer < layers.len() {
            let layer = &layers[current_layer];
            let layer_bottom = layer_top + layer.thickness;
            
            depth.push(z);
            
            // Vertical stress at depth
            let z_in_layer = z - layer_top;
            let mut sigma_v = surcharge;
            for (i, l) in layers.iter().enumerate() {
                if i < current_layer {
                    sigma_v += l.unit_weight * l.thickness;
                } else if i == current_layer {
                    sigma_v += l.unit_weight * z_in_layer;
                    break;
                }
            }
            
            // Active pressure
            let ka = layer.ka_coulomb();
            let c = layer.cohesion;
            let p = ka * sigma_v - 2.0 * c * ka.sqrt();
            pressure.push(p.max(0.0));
            
            z += dz;
            if z >= layer_bottom && current_layer + 1 < layers.len() {
                current_layer += 1;
                layer_top = layer_bottom;
            }
        }
        
        // Calculate total force and application point
        let total_force = Self::integrate(&depth, &pressure);
        let moment = Self::moment(&depth, &pressure);
        let application_point = if total_force > 0.0 { moment / total_force } else { total_depth / 3.0 };
        
        Self {
            depth,
            pressure,
            total_force,
            application_point,
        }
    }
    
    /// Calculate passive earth pressure
    pub fn passive(layers: &[SoilLayer], embedment: f64) -> Self {
        let mut depth = Vec::new();
        let mut pressure = Vec::new();
        
        let n_points = 30;
        let dz = embedment / n_points as f64;
        
        for i in 0..=n_points {
            let z = i as f64 * dz;
            depth.push(z);
            
            // Find layer at this depth (accumulate overburden)
            let mut z_top = 0.0;
            let mut sigma_v_accum = 0.0;
            for layer in layers {
                if z <= z_top + layer.thickness {
                    let z_in_layer = z - z_top;
                    sigma_v_accum += layer.unit_weight * z_in_layer;
                    let kp = layer.kp_coulomb();
                    let c = layer.cohesion;
                    let p = kp * sigma_v_accum + 2.0 * c * kp.sqrt();
                    pressure.push(p);
                    break;
                }
                sigma_v_accum += layer.unit_weight * layer.thickness;
                z_top += layer.thickness;
            }
        }
        
        // Ensure we have matching lengths
        while pressure.len() < depth.len() {
            pressure.push(0.0);
        }
        
        let total_force = Self::integrate(&depth, &pressure);
        let moment = Self::moment(&depth, &pressure);
        let application_point = if total_force > 0.0 { moment / total_force } else { embedment / 3.0 };
        
        Self {
            depth,
            pressure,
            total_force,
            application_point,
        }
    }
    
    fn integrate(depth: &[f64], pressure: &[f64]) -> f64 {
        let mut sum = 0.0;
        for i in 1..depth.len() {
            let dz = depth[i] - depth[i-1];
            let p_avg = (pressure[i] + pressure[i-1]) / 2.0;
            sum += p_avg * dz;
        }
        sum
    }
    
    fn moment(depth: &[f64], pressure: &[f64]) -> f64 {
        let mut sum = 0.0;
        for i in 1..depth.len() {
            let dz = depth[i] - depth[i-1];
            let z_mid = (depth[i] + depth[i-1]) / 2.0;
            let p_avg = (pressure[i] + pressure[i-1]) / 2.0;
            sum += p_avg * dz * z_mid;
        }
        sum
    }
}

// ============================================================================
// APPARENT EARTH PRESSURE (TERZAGHI-PECK)
// ============================================================================

/// Apparent earth pressure diagrams
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ApparentPressureType {
    /// Sand
    Sand,
    /// Soft to medium clay
    SoftClay,
    /// Stiff clay
    StiffClay,
    /// Layered soil
    Layered,
}

/// Apparent earth pressure (Terzaghi-Peck envelopes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApparentPressure {
    /// Diagram type
    pub pressure_type: ApparentPressureType,
    /// Maximum pressure ordinate (kPa)
    pub max_pressure: f64,
    /// Excavation depth (m)
    pub depth: f64,
}

impl ApparentPressure {
    /// Calculate for sand (rectangular)
    pub fn sand(depth: f64, gamma: f64, phi: f64, surcharge: f64) -> Self {
        let phi_rad = phi * PI / 180.0;
        let ka = (PI / 4.0 - phi_rad / 2.0).tan().powi(2);
        
        // P = 0.65 * Ka * (γH + q) per Terzaghi-Peck
        let max_pressure = 0.65 * ka * (gamma * depth + surcharge);
        
        Self {
            pressure_type: ApparentPressureType::Sand,
            max_pressure,
            depth,
        }
    }
    
    /// Calculate for soft to medium clay
    pub fn soft_clay(depth: f64, gamma: f64, su: f64, surcharge: f64) -> Self {
        // Stability number N = γH/Su
        let _n = gamma * depth / su;
        
        // Ka = 1 - m*4Su/(γH), with m = 1.0 default, min Ka = 0.25 per FHWA
        let ka = (1.0 - 4.0 * su / (gamma * depth)).max(0.25);
        let max_pressure = ka * (gamma * depth + surcharge);
        
        Self {
            pressure_type: ApparentPressureType::SoftClay,
            max_pressure,
            depth,
        }
    }
    
    /// Calculate for stiff clay
    pub fn stiff_clay(depth: f64, gamma: f64, su: f64, surcharge: f64) -> Self {
        // Stability number
        let n = gamma * depth / su;
        
        // For stiff clay N < 4
        let max_pressure = if n < 4.0 {
            // Stiff clay: use 0.3γH per Terzaghi-Peck
            0.3 * gamma * depth + 0.3 * surcharge
        } else {
            // N >= 4: transition to soft clay ka formulation
            let ka = (1.0 - 4.0 * su / (gamma * depth)).max(0.25);
            ka * (gamma * depth + surcharge)
        };
        
        Self {
            pressure_type: ApparentPressureType::StiffClay,
            max_pressure,
            depth,
        }
    }
    
    /// Pressure at depth z
    pub fn pressure_at_depth(&self, z: f64) -> f64 {
        match self.pressure_type {
            ApparentPressureType::Sand => {
                // Rectangular: constant from 0 to H
                self.max_pressure
            }
            ApparentPressureType::SoftClay => {
                // Rectangular per Terzaghi-Peck: constant over full depth
                self.max_pressure
            }
            ApparentPressureType::StiffClay => {
                // Rectangular envelope per Terzaghi-Peck for stiff clay
                self.max_pressure
            }
            ApparentPressureType::Layered => {
                // Simplified: average of sand and clay
                0.5 * self.max_pressure * z / self.depth + 0.5 * self.max_pressure
            }
        }
    }
    
    /// Total force per unit length
    pub fn total_force(&self) -> f64 {
        match self.pressure_type {
            ApparentPressureType::Sand => self.max_pressure * self.depth,
            ApparentPressureType::SoftClay => self.max_pressure * self.depth,
            ApparentPressureType::StiffClay => self.max_pressure * self.depth,
            ApparentPressureType::Layered => 0.65 * self.max_pressure * self.depth,
        }
    }
}

// ============================================================================
// WALL ANALYSIS
// ============================================================================

/// Bracing level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracingLevel {
    /// Depth from top (m)
    pub depth: f64,
    /// Strut spacing (m)
    pub spacing: f64,
    /// Strut force (kN)
    pub strut_force: f64,
    /// Pre-load (kN)
    pub preload: f64,
}

/// Wall analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WallAnalysis {
    /// Maximum bending moment (kN·m/m)
    pub max_moment: f64,
    /// Maximum shear force (kN/m)
    pub max_shear: f64,
    /// Depth of maximum moment (m)
    pub max_moment_depth: f64,
    /// Bracing forces (kN)
    pub strut_forces: Vec<f64>,
    /// Toe embedment factor of safety
    pub toe_fos: f64,
    /// Required embedment (m)
    pub required_embedment: f64,
}

impl WallAnalysis {
    /// Analyze cantilevered wall
    pub fn cantilever(
        active: &EarthPressure,
        passive: &EarthPressure,
        excavation_depth: f64,
        embedment: f64,
        factor_of_safety: f64,
    ) -> Self {
        // Free earth support method
        let pa = active.total_force;
        let ya = active.application_point;
        
        // Passive resistance (reduced by FoS)
        let pp = passive.total_force / factor_of_safety;
        let _yp = excavation_depth + passive.application_point;
        
        // Required embedment from moment equilibrium
        // Pa * ya = Pp * (H + 2d/3) / FoS
        // Solve iteratively
        let mut d = embedment;
        for _ in 0..20 {
            let pp_d = pp * d / embedment;
            let moment_active = pa * ya;
            let moment_passive = pp_d * (excavation_depth + 2.0 * d / 3.0);
            
            if moment_passive >= moment_active {
                break;
            }
            d *= 1.1;
        }
        
        // Maximum moment at dredge level (conservative)
        let max_moment = pa * (excavation_depth - ya);
        let max_shear = pa;
        
        // Factor of safety (moments about toe)
        let arm_active = (excavation_depth + d) - ya;
        let arm_passive = d / 3.0; // centroid of triangular passive from toe
        let toe_fos = (passive.total_force * arm_passive) / (active.total_force * arm_active);
        
        Self {
            max_moment,
            max_shear,
            max_moment_depth: excavation_depth + d / 3.0, // Below dredge at ~zero-shear point
            strut_forces: Vec::new(),
            toe_fos,
            required_embedment: d * 1.2, // 20% margin
        }
    }
    
    /// Analyze braced wall using tributary area method
    pub fn braced_tributary(
        apparent: &ApparentPressure,
        bracing_depths: &[f64],
        excavation_depth: f64,
    ) -> Self {
        let n_struts = bracing_depths.len();
        let mut strut_forces = Vec::with_capacity(n_struts);
        
        // Calculate tributary areas for each strut
        for (i, &depth) in bracing_depths.iter().enumerate() {
            let top = if i == 0 { 0.0 } else { (depth + bracing_depths[i-1]) / 2.0 };
            let bottom = if i == n_struts - 1 { 
                excavation_depth 
            } else { 
                (depth + bracing_depths[i+1]) / 2.0 
            };
            
            // Integrate pressure over tributary area
            let mut force = 0.0;
            let n_steps = 20;
            let dz = (bottom - top) / n_steps as f64;
            for j in 0..n_steps {
                let z = top + (j as f64 + 0.5) * dz;
                force += apparent.pressure_at_depth(z) * dz;
            }
            
            strut_forces.push(force);
        }
        
        // Maximum moment between struts
        let mut max_moment: f64 = 0.0;
        for i in 0..=n_struts {
            let top = if i == 0 { 0.0 } else { bracing_depths[i-1] };
            let bottom = if i == n_struts { excavation_depth } else { bracing_depths[i] };
            
            // Simple beam moment for uniform load
            let w = apparent.max_pressure;
            let l = bottom - top;
            let m = w * l.powi(2) / 8.0;
            max_moment = max_moment.max(m);
        }
        
        let max_shear = strut_forces.iter().cloned().fold(0.0_f64, f64::max);
        
        Self {
            max_moment,
            max_shear,
            max_moment_depth: bracing_depths.get(0).copied().unwrap_or(0.0),
            strut_forces,
            toe_fos: 2.0, // Assumed adequate for braced walls
            required_embedment: excavation_depth * 0.3,
        }
    }
}

// ============================================================================
// GROUND MOVEMENT
// ============================================================================

/// Settlement prediction type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SettlementMethod {
    /// Peck (1969) charts
    Peck,
    /// Clough-O'Rourke (1990)
    CloughORourke,
    /// Hsieh-Ou (1998)
    HsiehOu,
    /// Empirical correlation
    Empirical,
}

/// Ground settlement prediction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundSettlement {
    /// Distance from wall (m)
    pub distance: Vec<f64>,
    /// Vertical settlement (mm)
    pub settlement: Vec<f64>,
    /// Maximum settlement (mm)
    pub max_settlement: f64,
    /// Distance to maximum settlement (m)
    pub max_settlement_distance: f64,
    /// Influence zone (m)
    pub influence_zone: f64,
}

impl GroundSettlement {
    /// Peck (1969) envelope - Zone I (Sand)
    pub fn peck_zone_i(excavation_depth: f64, max_wall_deflection: f64) -> Self {
        let h = excavation_depth;
        
        // Influence extends to 2H
        let influence = 2.0 * h;
        let max_s = max_wall_deflection * 0.5;
        
        let n_points = 20;
        let mut distance = Vec::with_capacity(n_points);
        let mut settlement = Vec::with_capacity(n_points);
        
        for i in 0..n_points {
            let d = i as f64 * influence / n_points as f64;
            distance.push(d);
            
            // Triangular distribution
            let s = max_s * (1.0 - d / influence).max(0.0);
            settlement.push(s * 1000.0); // Convert to mm
        }
        
        Self {
            distance,
            settlement,
            max_settlement: max_s * 1000.0,
            max_settlement_distance: 0.0,
            influence_zone: influence,
        }
    }
    
    /// Peck (1969) envelope - Zone II (Soft to medium clay)
    pub fn peck_zone_ii(excavation_depth: f64) -> Self {
        let h = excavation_depth;
        
        // Settlement 1-2% of H, extending to 2H
        let influence = 2.0 * h;
        let max_s = 0.02 * h;
        
        let n_points = 20;
        let mut distance = Vec::with_capacity(n_points);
        let mut settlement = Vec::with_capacity(n_points);
        
        for i in 0..n_points {
            let d = i as f64 * influence / n_points as f64;
            distance.push(d);
            
            // Concave profile
            let ratio = d / influence;
            let s = max_s * (1.0 - ratio.sqrt());
            settlement.push(s * 1000.0);
        }
        
        Self {
            distance,
            settlement,
            max_settlement: max_s * 1000.0,
            max_settlement_distance: 0.0,
            influence_zone: influence,
        }
    }
    
    /// Clough-O'Rourke (1990) method
    pub fn clough_orourke(
        excavation_depth: f64,
        wall_deflection_ratio: f64, // δh,max / H
        soil_type: ApparentPressureType,
    ) -> Self {
        let h = excavation_depth;
        let delta_h = wall_deflection_ratio * h;
        
        // Influence zone depends on soil type
        let (influence, profile_type) = match soil_type {
            ApparentPressureType::Sand => (2.0 * h, "triangular"),
            ApparentPressureType::StiffClay => (2.0 * h, "trapezoidal"),
            ApparentPressureType::SoftClay => (2.0 * h, "concave"),
            _ => (3.0 * h, "trapezoidal"),
        };
        
        // Maximum settlement approximately equal to max wall deflection
        let max_s = delta_h;
        
        let n_points = 30;
        let mut distance = Vec::with_capacity(n_points);
        let mut settlement = Vec::with_capacity(n_points);
        
        for i in 0..n_points {
            let d = i as f64 * influence / n_points as f64;
            distance.push(d);
            
            let ratio = d / influence;
            let s = match profile_type {
                "triangular" => max_s * (1.0 - ratio),
                "trapezoidal" => {
                    if ratio < 0.5 { max_s } 
                    else { max_s * (2.0 * (1.0 - ratio)) }
                },
                "concave" => max_s * (1.0 - ratio.powi(2)),
                _ => max_s * (1.0 - ratio),
            };
            
            settlement.push(s.max(0.0) * 1000.0);
        }
        
        Self {
            distance,
            settlement,
            max_settlement: max_s * 1000.0,
            max_settlement_distance: 0.0,
            influence_zone: influence,
        }
    }
    
    /// Check building damage potential
    pub fn check_building_damage(&self, building_distance: f64, building_length: f64) -> BuildingDamage {
        // Interpolate settlement at building corners
        let s1 = self.settlement_at_distance(building_distance);
        let s2 = self.settlement_at_distance(building_distance + building_length);
        
        // Angular distortion
        let beta = (s1 - s2).abs() / building_length / 1000.0;
        
        // Settlement ratio
        let _ratio = s1.max(s2) / self.max_settlement;
        
        let category = if beta < 1.0 / 500.0 {
            DamageCategory::Negligible
        } else if beta < 1.0 / 300.0 {
            DamageCategory::VerySlightToSlight
        } else if beta < 1.0 / 150.0 {
            DamageCategory::SlightToModerate
        } else {
            DamageCategory::ModerateToSevere
        };
        
        BuildingDamage {
            max_settlement: s1.max(s2),
            differential_settlement: (s1 - s2).abs(),
            angular_distortion: beta,
            damage_category: category,
        }
    }
    
    fn settlement_at_distance(&self, d: f64) -> f64 {
        // Linear interpolation
        for i in 1..self.distance.len() {
            if d <= self.distance[i] {
                let ratio = (d - self.distance[i-1]) / (self.distance[i] - self.distance[i-1]);
                return self.settlement[i-1] + ratio * (self.settlement[i] - self.settlement[i-1]);
            }
        }
        0.0
    }
}

/// Building damage assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildingDamage {
    /// Maximum settlement (mm)
    pub max_settlement: f64,
    /// Differential settlement (mm)
    pub differential_settlement: f64,
    /// Angular distortion (rad)
    pub angular_distortion: f64,
    /// Damage category
    pub damage_category: DamageCategory,
}

/// Damage category per Burland (1977)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DamageCategory {
    /// Negligible (< 1/500)
    Negligible,
    /// Very slight to slight (1/500 to 1/300)
    VerySlightToSlight,
    /// Slight to moderate (1/300 to 1/150)
    SlightToModerate,
    /// Moderate to severe (> 1/150)
    ModerateToSevere,
}

// ============================================================================
// BASE HEAVE STABILITY
// ============================================================================

/// Base heave analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaseHeave {
    /// Factor of safety against heave
    pub factor_of_safety: f64,
    /// Heave potential (mm)
    pub heave_potential: f64,
    /// Stability number
    pub stability_number: f64,
    /// Critical depth ratio
    pub critical_depth_ratio: f64,
}

impl BaseHeave {
    /// Terzaghi method for clay
    pub fn terzaghi_clay(
        excavation_depth: f64,
        excavation_width: f64,
        gamma: f64,
        su: f64,
        surcharge: f64,
    ) -> Self {
        let h = excavation_depth;
        let b = excavation_width;
        
        // Stability number
        let n = gamma * h / su;
        
        // Bearing capacity factor (Nc depends on D/B) per Terzaghi 1943
        let d_b_ratio = h / b;
        let nc = if d_b_ratio < 1.0 {
            5.7 * (1.0 + 0.2 * d_b_ratio)
        } else {
            5.7 * 1.2
        };
        
        // Factor of safety
        let q = gamma * h + surcharge;
        let qu = nc * su;
        let fos = qu / q;
        
        // Heave potential (elastic estimate)
        let heave = if fos > 1.0 {
            0.0
        } else {
            q / (1.5 * su) * 10.0 // mm, approximate
        };
        
        Self {
            factor_of_safety: fos,
            heave_potential: heave,
            stability_number: n,
            critical_depth_ratio: d_b_ratio,
        }
    }
    
    /// Bjerrum-Eide method
    pub fn bjerrum_eide(
        excavation_depth: f64,
        excavation_width: f64,
        gamma: f64,
        su: f64,
        surcharge: f64,
        embedment: f64,
    ) -> Self {
        let h = excavation_depth;
        let b = excavation_width;
        let _d = embedment;
        
        // Skempton Nc with depth factor (up to D/B = 2.5)
        let d_b_ratio = (h / b).min(2.5);
        let nc = 5.14 * (1.0 + 0.2 * d_b_ratio);
        
        // Driving pressure
        let q_drive = gamma * h + surcharge;
        
        // Resisting pressure (Bjerrum-Eide: Nc*su only, no embedment term)
        let q_resist = nc * su;
        
        let fos = q_resist / q_drive;
        
        Self {
            factor_of_safety: fos,
            heave_potential: 0.0,
            stability_number: gamma * h / su,
            critical_depth_ratio: h / b,
        }
    }
    
    /// Check adequacy
    pub fn is_stable(&self, required_fos: f64) -> bool {
        self.factor_of_safety >= required_fos
    }
}

// ============================================================================
// PIPING AND HYDRAULIC HEAVE
// ============================================================================

/// Hydraulic heave analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HydraulicHeave {
    /// Factor of safety against piping
    pub piping_fos: f64,
    /// Factor of safety against heave
    pub heave_fos: f64,
    /// Critical hydraulic gradient
    pub critical_gradient: f64,
    /// Exit gradient
    pub exit_gradient: f64,
}

impl HydraulicHeave {
    /// Calculate hydraulic stability
    pub fn calculate(
        water_head_difference: f64,
        seepage_path: f64,
        embedment: f64,
        soil_unit_weight: f64,
        water_unit_weight: f64,
    ) -> Self {
        // Exit gradient
        let exit_gradient = water_head_difference / seepage_path;
        
        // Critical gradient
        let gamma_sub = soil_unit_weight - water_unit_weight;
        let critical_gradient = gamma_sub / water_unit_weight;
        
        // Factor of safety against piping
        let piping_fos = critical_gradient / exit_gradient;
        
        // Factor of safety against heave (Terzaghi)
        let uplift_pressure = water_unit_weight * water_head_difference;
        let overburden = gamma_sub * embedment;
        let heave_fos = overburden / uplift_pressure;
        
        Self {
            piping_fos,
            heave_fos,
            critical_gradient,
            exit_gradient,
        }
    }
    
    /// Minimum required embedment
    pub fn required_embedment(
        water_head_difference: f64,
        soil_unit_weight: f64,
        water_unit_weight: f64,
        required_fos: f64,
    ) -> f64 {
        let gamma_sub = soil_unit_weight - water_unit_weight;
        let uplift = water_unit_weight * water_head_difference;
        
        required_fos * uplift / gamma_sub
    }
}

// ============================================================================
// STRUT DESIGN
// ============================================================================

/// Strut type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StrutType {
    /// Steel pipe strut
    SteelPipe,
    /// Steel wide flange
    SteelWF,
    /// Concrete strut
    Concrete,
    /// Timber strut
    Timber,
}

/// Strut design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrutDesign {
    /// Strut type
    pub strut_type: StrutType,
    /// Required axial capacity (kN)
    pub required_capacity: f64,
    /// Design length (m)
    pub length: f64,
    /// Spacing (m)
    pub spacing: f64,
    /// Section properties
    pub section: StrutSection,
    /// Utilization ratio
    pub utilization: f64,
}

/// Strut section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrutSection {
    /// Outer diameter or depth (mm)
    pub diameter: f64,
    /// Wall thickness (mm)
    pub thickness: f64,
    /// Area (mm²)
    pub area: f64,
    /// Moment of inertia (mm⁴)
    pub inertia: f64,
    /// Yield strength (MPa)
    pub fy: f64,
}

impl StrutDesign {
    /// Design steel pipe strut
    pub fn design_pipe_strut(
        required_force: f64,
        length: f64,
        spacing: f64,
        fy: f64,
    ) -> Self {
        // Required capacity (ASD: unfactored)
        let required_capacity = required_force * spacing;
        
        // Trial diameter (empirical)
        let d = (required_capacity * 1000.0 / fy).sqrt() * 4.0; // mm
        let t = d / 20.0; // D/t ≈ 20
        
        let area = PI * d * t;
        let inertia = PI * d.powi(3) * t / 8.0;
        
        // Buckling capacity (Euler) — convert to kN
        let e = 200_000.0; // MPa
        let k = 1.0; // Effective length factor
        let pe = PI.powi(2) * e * inertia / (k * length * 1000.0).powi(2) / 1000.0; // kN
        
        // Yield capacity (kN)
        let py = area * fy / 1000.0;
        
        // Design capacity per AISC 360-16 E3 ASD (kN)
        // Crossover at Fy/Fe = 2.25 → Pe/Py = 1/2.25 ≈ 0.444
        let p_design = if py / pe <= 2.25 {
            // Inelastic buckling (KL/r ≤ 4.71√(E/Fy))
            py * (0.658_f64.powf(py / pe)) / 1.67
        } else {
            // Elastic buckling (KL/r > 4.71√(E/Fy))
            0.877 * pe / 1.67
        };
        
        let utilization = required_capacity / p_design;
        
        Self {
            strut_type: StrutType::SteelPipe,
            required_capacity,
            length,
            spacing,
            section: StrutSection {
                diameter: d,
                thickness: t,
                area,
                inertia,
                fy,
            },
            utilization,
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
    fn test_excavation_parameters() {
        let params = ExcavationParameters::new(
            10.0, // depth
            20.0, // width
            50.0, // length
            WallType::DiaphragmWall,
            SupportType::MultiBraced,
        );
        
        assert!(params.n_bracing_levels >= 2);
        assert!(params.embedment > 0.0);
    }

    #[test]
    fn test_soil_layer() {
        let layer = SoilLayer {
            thickness: 5.0,
            unit_weight: 18.0,
            phi: 30.0,
            cohesion: 0.0,
            delta: 20.0,
            su: None,
            modulus: 20.0,
        };
        
        let ka = layer.ka_rankine();
        let kp = layer.kp_rankine();
        
        assert!(ka < 1.0);
        assert!(kp > 1.0);
        assert!(ka < kp);
    }

    #[test]
    fn test_active_pressure() {
        let layers = vec![SoilLayer {
            thickness: 15.0,
            unit_weight: 19.0,
            phi: 32.0,
            cohesion: 5.0,
            delta: 20.0,
            su: None,
            modulus: 25.0,
        }];
        
        let active = EarthPressure::active(&layers, 10.0, 10.0);
        
        assert!(active.total_force > 0.0);
        assert!(active.application_point > 0.0);
    }

    #[test]
    fn test_apparent_pressure_sand() {
        let ap = ApparentPressure::sand(10.0, 18.0, 32.0, 15.0);
        
        assert!(ap.max_pressure > 0.0);
        assert!(ap.total_force() > 0.0);
    }

    #[test]
    fn test_apparent_pressure_clay() {
        let ap = ApparentPressure::soft_clay(12.0, 17.0, 30.0, 10.0);
        
        assert!(ap.max_pressure > 0.0);
    }

    #[test]
    fn test_cantilever_wall() {
        let layers = vec![SoilLayer {
            thickness: 10.0,
            unit_weight: 18.0,
            phi: 30.0,
            cohesion: 0.0,
            delta: 20.0,
            su: None,
            modulus: 20.0,
        }];
        
        let active = EarthPressure::active(&layers, 5.0, 0.0);
        let passive = EarthPressure::passive(&layers, 3.0);
        
        let analysis = WallAnalysis::cantilever(&active, &passive, 5.0, 3.0, 1.5);
        
        assert!(analysis.max_moment > 0.0);
        assert!(analysis.required_embedment > 0.0);
    }

    #[test]
    fn test_braced_wall() {
        let ap = ApparentPressure::sand(12.0, 19.0, 35.0, 20.0);
        let bracing = vec![2.0, 5.0, 8.0];
        
        let analysis = WallAnalysis::braced_tributary(&ap, &bracing, 12.0);
        
        assert_eq!(analysis.strut_forces.len(), 3);
        assert!(analysis.max_moment > 0.0);
    }

    #[test]
    fn test_settlement_peck() {
        let settlement = GroundSettlement::peck_zone_ii(10.0);
        
        assert!(settlement.max_settlement > 0.0);
        assert!(settlement.influence_zone > 0.0);
    }

    #[test]
    fn test_building_damage() {
        let settlement = GroundSettlement::peck_zone_ii(10.0);
        let damage = settlement.check_building_damage(5.0, 20.0);
        
        assert!(damage.angular_distortion >= 0.0);
    }

    #[test]
    fn test_base_heave() {
        let heave = BaseHeave::terzaghi_clay(10.0, 15.0, 17.0, 40.0, 10.0);
        
        assert!(heave.factor_of_safety > 0.0);
        assert!(heave.stability_number > 0.0);
    }

    #[test]
    fn test_hydraulic_heave() {
        let hydraulic = HydraulicHeave::calculate(5.0, 15.0, 5.0, 18.0, 9.81);
        
        assert!(hydraulic.piping_fos > 0.0);
        assert!(hydraulic.heave_fos > 0.0);
    }

    #[test]
    fn test_strut_design() {
        let strut = StrutDesign::design_pipe_strut(
            300.0, // force per meter
            10.0,  // length
            3.0,   // spacing
            355.0, // fy
        );
        
        assert!(strut.section.diameter > 0.0);
        assert!(strut.utilization > 0.0);
    }

    #[test]
    fn test_wall_type_properties() {
        let diaphragm = WallType::DiaphragmWall;
        let sheet = WallType::SheetPile;
        
        assert!(diaphragm.typical_stiffness() > sheet.typical_stiffness());
    }

    #[test]
    fn test_clough_orourke() {
        let settlement = GroundSettlement::clough_orourke(
            15.0,
            0.002, // 0.2% wall deflection
            ApparentPressureType::SoftClay,
        );
        
        assert!(settlement.max_settlement > 0.0);
        assert!(settlement.influence_zone > 15.0);
    }
}
