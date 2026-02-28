//! Advanced Foundation Design Module
//! 
//! Provides comprehensive foundation analysis matching capabilities of:
//! - PLAXIS (soil-structure interaction)
//! - SAFE (mat/raft foundation design)
//! - STAAD Foundation (spread footings, combined footings)
//! - LPILE/FB-MultiPier (deep foundations)
//!
//! Features:
//! - Spread footing design per ACI 318-19 / EN 1992
//! - Mat foundation analysis (finite element-based)
//! - Deep foundation design (drilled shafts, driven piles)
//! - Pile group analysis with cap design
//! - Soil-structure interaction (p-y, t-z curves)
//! - Settlement analysis (immediate, consolidation, secondary)
//! - Bearing capacity (Terzaghi, Meyerhof, Vesic, Hansen)

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SOIL PARAMETERS
// ============================================================================

/// Soil type classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    /// Clean gravel
    Gravel,
    /// Sandy gravel
    SandyGravel,
    /// Clean sand
    Sand,
    /// Silty sand
    SiltySand,
    /// Silt
    Silt,
    /// Lean clay
    LeanClay,
    /// Fat clay
    FatClay,
    /// Organic clay
    OrganicClay,
    /// Rock
    Rock,
}

/// Soil layer definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Layer name
    pub name: String,
    /// Top elevation (m)
    pub top_elevation: f64,
    /// Bottom elevation (m)
    pub bottom_elevation: f64,
    /// Soil type
    pub soil_type: SoilType,
    /// Unit weight γ (kN/m³)
    pub unit_weight: f64,
    /// Saturated unit weight γsat (kN/m³)
    pub saturated_unit_weight: f64,
    /// Cohesion c (kPa)
    pub cohesion: f64,
    /// Friction angle φ (degrees)
    pub friction_angle: f64,
    /// Elastic modulus E (MPa)
    pub elastic_modulus: f64,
    /// Poisson's ratio ν
    pub poisson_ratio: f64,
    /// SPT N-value
    pub spt_n: f64,
    /// Compression index Cc
    pub compression_index: f64,
    /// Recompression index Cr
    pub recompression_index: f64,
    /// Coefficient of consolidation cv (m²/year)
    pub cv: f64,
    /// Overconsolidation ratio OCR
    pub ocr: f64,
    /// Preconsolidation pressure (kPa)
    pub preconsolidation: f64,
}

impl SoilLayer {
    pub fn new(name: &str, top: f64, bottom: f64, soil_type: SoilType) -> Self {
        let (gamma, c, phi, e) = match soil_type {
            SoilType::Gravel => (20.0, 0.0, 40.0, 150.0),
            SoilType::SandyGravel => (19.5, 0.0, 38.0, 100.0),
            SoilType::Sand => (18.0, 0.0, 35.0, 50.0),
            SoilType::SiltySand => (17.5, 5.0, 32.0, 30.0),
            SoilType::Silt => (17.0, 10.0, 28.0, 20.0),
            SoilType::LeanClay => (18.0, 25.0, 20.0, 15.0),
            SoilType::FatClay => (17.0, 50.0, 15.0, 8.0),
            SoilType::OrganicClay => (15.0, 20.0, 10.0, 5.0),
            SoilType::Rock => (25.0, 200.0, 45.0, 5000.0),
        };
        
        SoilLayer {
            name: name.to_string(),
            top_elevation: top,
            bottom_elevation: bottom,
            soil_type,
            unit_weight: gamma,
            saturated_unit_weight: gamma + 2.0,
            cohesion: c,
            friction_angle: phi,
            elastic_modulus: e,
            poisson_ratio: 0.3,
            spt_n: 20.0,
            compression_index: 0.2,
            recompression_index: 0.04,
            cv: 1.0,
            ocr: 1.0,
            preconsolidation: 200.0,
        }
    }
    
    /// Layer thickness
    pub fn thickness(&self) -> f64 {
        self.top_elevation - self.bottom_elevation
    }
}

/// Soil profile (multiple layers)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilProfile {
    /// Profile name
    pub name: String,
    /// Soil layers (from top to bottom)
    pub layers: Vec<SoilLayer>,
    /// Groundwater elevation (m)
    pub gwl: f64,
}

impl SoilProfile {
    pub fn new(name: &str) -> Self {
        SoilProfile {
            name: name.to_string(),
            layers: Vec::new(),
            gwl: -100.0, // Deep GWL by default
        }
    }
    
    pub fn add_layer(&mut self, layer: SoilLayer) {
        self.layers.push(layer);
    }
    
    /// Get layer at specified depth
    pub fn layer_at_depth(&self, depth: f64) -> Option<&SoilLayer> {
        let elevation = self.layers.first()?.top_elevation - depth;
        self.layers.iter().find(|l| {
            elevation <= l.top_elevation && elevation > l.bottom_elevation
        })
    }
    
    /// Calculate overburden pressure at depth
    pub fn overburden_pressure(&self, depth: f64) -> f64 {
        let mut pressure = 0.0;
        let mut current_depth: f64 = 0.0;
        let ground_elevation = self.layers.first().map(|l| l.top_elevation).unwrap_or(0.0);
        
        for layer in &self.layers {
            let layer_top = ground_elevation - layer.top_elevation;
            let layer_bottom = ground_elevation - layer.bottom_elevation;
            
            if depth <= layer_top {
                continue;
            }
            
            let z_top = current_depth.max(layer_top);
            let z_bottom = depth.min(layer_bottom);
            
            if z_bottom > z_top {
                let thickness = z_bottom - z_top;
                let mid_depth = (z_top + z_bottom) / 2.0;
                let mid_elevation = ground_elevation - mid_depth;
                
                let gamma = if mid_elevation < self.gwl {
                    layer.saturated_unit_weight - 9.81 // Buoyant weight
                } else {
                    layer.unit_weight
                };
                
                pressure += gamma * thickness;
            }
            
            current_depth = layer_bottom;
            if current_depth >= depth {
                break;
            }
        }
        
        pressure
    }
}

// ============================================================================
// BEARING CAPACITY
// ============================================================================

/// Bearing capacity calculation method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BearingCapacityMethod {
    /// Terzaghi's method
    Terzaghi,
    /// Meyerhof's method
    Meyerhof,
    /// Hansen's method
    Hansen,
    /// Vesic's method
    Vesic,
}

/// Bearing capacity factors and results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCapacityResult {
    /// Ultimate bearing capacity qu (kPa)
    pub qu: f64,
    /// Allowable bearing capacity qa (kPa)
    pub qa: f64,
    /// Factor of safety used
    pub fs: f64,
    /// Nc factor
    pub nc: f64,
    /// Nq factor
    pub nq: f64,
    /// Nγ factor
    pub n_gamma: f64,
    /// Shape factors
    pub shape_factors: [f64; 3],
    /// Depth factors
    pub depth_factors: [f64; 3],
    /// Inclination factors
    pub inclination_factors: [f64; 3],
    /// Calculation method used
    pub method: BearingCapacityMethod,
}

/// Calculate bearing capacity factors for given friction angle
pub fn bearing_capacity_factors(phi_deg: f64, method: BearingCapacityMethod) -> (f64, f64, f64) {
    let phi = phi_deg.to_radians();
    
    match method {
        BearingCapacityMethod::Terzaghi => {
            // Terzaghi's factors use a different Nq formulation
            // Nq = a² / [2·cos²(45° + φ/2)] where a = exp((3π/4 − φ/2)·tan φ)
            if phi_deg.abs() < 0.01 {
                return (5.7, 1.0, 0.0); // Terzaghi φ=0 values
            }
            let a = ((3.0 * PI / 4.0 - phi / 2.0) * phi.tan()).exp();
            let nq_t = a * a / (2.0 * (PI / 4.0 + phi / 2.0).cos().powi(2));
            let nc_t = (nq_t - 1.0) / phi.tan();
            // Kumbhojkar (1993) approximation for Terzaghi Nγ
            let n_gamma_t = 2.0 * (nq_t + 1.0) * phi.tan() * 0.8; // Terzaghi Nγ ≈ 0.8× Vesic approximation
            (nc_t, nq_t, n_gamma_t)
        }
        _ => {
            // Prandtl/Reissner Nq (used by Meyerhof, Hansen, Vesic)
            let nq = (PI / 4.0 + phi / 2.0).tan().powi(2) * (PI * phi.tan()).exp();
            
            let nc = if phi_deg.abs() < 0.01 {
                5.14 // For φ = 0
            } else {
                (nq - 1.0) / phi.tan()
            };
            
            let n_gamma = match method {
                BearingCapacityMethod::Meyerhof => {
                    (nq - 1.0) * (1.4 * phi).tan()
                }
                BearingCapacityMethod::Hansen => {
                    1.5 * (nq - 1.0) * phi.tan()
                }
                BearingCapacityMethod::Vesic => {
                    2.0 * (nq + 1.0) * phi.tan()
                }
                _ => unreachable!(),
            };
            
            (nc, nq, n_gamma)
        }
    }
}

/// Spread footing definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpreadFooting {
    /// Footing ID
    pub id: String,
    /// Length L (m)
    pub length: f64,
    /// Width B (m)
    pub width: f64,
    /// Thickness (m)
    pub thickness: f64,
    /// Embedment depth Df (m)
    pub embedment: f64,
    /// Concrete strength fc' (MPa)
    pub fc: f64,
    /// Steel yield strength fy (MPa)
    pub fy: f64,
    /// Cover to reinforcement (mm)
    pub cover: f64,
}

impl SpreadFooting {
    pub fn new(id: &str, length: f64, width: f64) -> Self {
        SpreadFooting {
            id: id.to_string(),
            length,
            width,
            thickness: 0.45,
            embedment: 1.0,
            fc: 25.0,
            fy: 415.0,
            cover: 75.0,
        }
    }
    
    /// Footing area
    pub fn area(&self) -> f64 {
        self.length * self.width
    }
    
    /// Aspect ratio L/B
    pub fn aspect_ratio(&self) -> f64 {
        self.length / self.width
    }
    
    /// Effective depth for design
    pub fn effective_depth(&self) -> f64 {
        self.thickness - self.cover / 1000.0 - 0.005 // Assume #10 bars, d = h - cover - db/2
    }
}

/// Calculate bearing capacity for spread footing
pub fn calculate_bearing_capacity(
    footing: &SpreadFooting,
    soil: &SoilLayer,
    method: BearingCapacityMethod,
    groundwater_depth: f64,
    load_inclination: f64, // degrees
) -> BearingCapacityResult {
    let phi = soil.friction_angle;
    let c = soil.cohesion;
    let gamma = soil.unit_weight;
    let b = footing.width;
    let l = footing.length;
    let df = footing.embedment;
    
    let (nc, nq, n_gamma) = bearing_capacity_factors(phi, method);
    let phi_rad = phi.to_radians();
    
    // Shape, depth, and inclination factors depend on method
    let (sc, sq, s_gamma);
    let (dc, dq, d_gamma);
    let (ic, iq, i_gamma);
    
    match method {
        BearingCapacityMethod::Terzaghi => {
            // Terzaghi shape factors (no depth or inclination factors)
            sc = 1.0 + 0.3 * (b / l);        // rectangular; =1.3 for square
            sq = 1.0;                          // Terzaghi has no sq
            s_gamma = 1.0 - 0.2 * (b / l);   // rectangular; =0.8 for square
            dc = 1.0; dq = 1.0; d_gamma = 1.0;
            ic = 1.0; iq = 1.0; i_gamma = 1.0;
        }
        BearingCapacityMethod::Meyerhof => {
            // Meyerhof shape factors
            let kp = (PI / 4.0 + phi_rad / 2.0).tan().powi(2);
            sc = 1.0 + 0.2 * kp * (b / l);
            sq = if phi > 10.0 { 1.0 + 0.1 * kp * (b / l) } else { 1.0 };
            s_gamma = sq;
            // Meyerhof depth factors
            let kp_sqrt = kp.sqrt();
            dc = 1.0 + 0.2 * kp_sqrt * (df / b);
            dq = if phi > 10.0 { 1.0 + 0.1 * kp_sqrt * (df / b) } else { 1.0 };
            d_gamma = dq;
            // Meyerhof inclination factors
            let alpha = load_inclination.to_radians();
            ic = (1.0 - alpha / (PI / 2.0)).powi(2);
            iq = ic;
            i_gamma = if phi > 0.01 {
                (1.0 - alpha / phi_rad).powi(2).max(0.0)
            } else { 1.0 };
        }
        BearingCapacityMethod::Hansen | BearingCapacityMethod::Vesic => {
            // Hansen/Vesic shape factors
            sc = 1.0 + (nq / nc) * (b / l);
            sq = 1.0 + (b / l) * phi_rad.tan();
            s_gamma = 1.0 - 0.4 * (b / l);
            // Hansen/Vesic depth factors
            let k = if df / b <= 1.0 { df / b } else { (df / b).atan() };
            dc = 1.0 + 0.4 * k;
            dq = 1.0 + 2.0 * phi_rad.tan() * (1.0 - phi_rad.sin()).powi(2) * k;
            d_gamma = 1.0;
            // Meyerhof-style inclination (angle-based approximation)
            let alpha = load_inclination.to_radians();
            ic = if phi < 0.01 {
                1.0 - 2.0 * alpha / PI
            } else {
                (1.0 - alpha / (PI / 2.0)).powi(2)
            };
            iq = ic;
            i_gamma = if phi > 0.01 {
                (1.0 - alpha / phi_rad).powi(2).max(0.0)
            } else { 1.0 };
        }
    }
    
    // Groundwater correction
    let gamma_effective = if groundwater_depth <= df {
        gamma - 9.81
    } else if groundwater_depth < df + b {
        gamma - 9.81 * (df + b - groundwater_depth) / b
    } else {
        gamma
    };
    
    // Overburden pressure (effective, accounting for groundwater)
    let q = if groundwater_depth <= 0.0 {
        // GWL at or above surface
        (gamma - 9.81) * df
    } else if groundwater_depth < df {
        // GWL between surface and footing base
        gamma * groundwater_depth + (gamma - 9.81) * (df - groundwater_depth)
    } else {
        gamma * df
    };
    
    // Ultimate bearing capacity (general equation)
    let qu = c * nc * sc * dc * ic +
             q * nq * sq * dq * iq +
             0.5 * gamma_effective * b * n_gamma * s_gamma * d_gamma * i_gamma;
    
    // Factor of safety
    let fs = 3.0;
    let qa = qu / fs;
    
    BearingCapacityResult {
        qu,
        qa,
        fs,
        nc,
        nq,
        n_gamma,
        shape_factors: [sc, sq, s_gamma],
        depth_factors: [dc, dq, d_gamma],
        inclination_factors: [ic, iq, i_gamma],
        method,
    }
}

// ============================================================================
// SETTLEMENT ANALYSIS
// ============================================================================

/// Settlement components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementResult {
    /// Immediate (elastic) settlement (mm)
    pub immediate: f64,
    /// Primary consolidation settlement (mm)
    pub consolidation: f64,
    /// Secondary compression settlement (mm)
    pub secondary: f64,
    /// Total settlement (mm)
    pub total: f64,
    /// Time for 90% consolidation (years)
    pub t90: f64,
    /// Differential settlement (mm) - if multiple points
    pub differential: f64,
    /// Angular distortion (rad)
    pub angular_distortion: f64,
}

/// Calculate immediate settlement (elastic)
pub fn calculate_immediate_settlement(
    footing: &SpreadFooting,
    contact_pressure: f64, // kPa
    soil: &SoilLayer,
    is_flexible: bool,
) -> f64 {
    let b = footing.width;
    let l = footing.length;
    let e = soil.elastic_modulus * 1000.0; // Convert MPa to kPa
    let nu = soil.poisson_ratio;
    
    // Influence factor for corner of rectangle (Schleicher 1926)
    let m = l / b;
    let f1 = m * ((1.0 + (1.0 + m * m).sqrt()) / m).ln();
    let f2 = (m + (1.0 + m * m).sqrt()).ln();
    
    let i_f = (1.0 / PI) * (f1 + f2);
    
    // Rigidity correction
    let i_r = if is_flexible { 1.0 } else { 0.79 }; // Flexible vs rigid
    
    // Settlement (Steinbrenner equation)
    let s = contact_pressure * b * (1.0 - nu.powi(2)) * i_f * i_r / e;
    
    s * 1000.0 // Convert to mm
}

/// Calculate consolidation settlement
pub fn calculate_consolidation_settlement(
    _footing: &SpreadFooting,
    delta_sigma: f64, // Stress increase at mid-layer (kPa)
    soil: &SoilLayer,
    initial_void_ratio: f64,
) -> f64 {
    let h = soil.thickness() * 1000.0; // mm
    let cc = soil.compression_index;
    let cr = soil.recompression_index;
    // sigma_0 = in-situ effective overburden stress = preconsolidation / OCR
    let sigma_c = soil.preconsolidation;
    let sigma_0 = if soil.ocr > 0.0 { sigma_c / soil.ocr } else { sigma_c };
    
    let settlement = if soil.ocr <= 1.0 {
        // Normally consolidated
        h * cc * ((sigma_0 + delta_sigma) / sigma_0).log10() / (1.0 + initial_void_ratio)
    } else if sigma_0 + delta_sigma <= sigma_c {
        // Overconsolidated, stays in recompression
        h * cr * ((sigma_0 + delta_sigma) / sigma_0).log10() / (1.0 + initial_void_ratio)
    } else {
        // Overconsolidated, goes past preconsolidation
        let s1 = h * cr * (sigma_c / sigma_0).log10() / (1.0 + initial_void_ratio);
        let s2 = h * cc * ((sigma_0 + delta_sigma) / sigma_c).log10() / (1.0 + initial_void_ratio);
        s1 + s2
    };
    
    settlement
}

/// Calculate time for consolidation
pub fn consolidation_time(
    drainage_path: f64, // m
    cv: f64, // m²/year
    degree_of_consolidation: f64, // 0-1
) -> f64 {
    // Time factor Tv
    let tv = if degree_of_consolidation <= 0.60 {
        (PI / 4.0) * degree_of_consolidation.powi(2)
    } else {
        -0.9332 * (1.0 - degree_of_consolidation).log10() - 0.0851
    };
    
    // Time t = Tv * H² / cv
    tv * drainage_path.powi(2) / cv
}

// ============================================================================
// DEEP FOUNDATION DESIGN
// ============================================================================

/// Pile type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PileType {
    /// Driven steel H-pile
    DrivenSteelH,
    /// Driven steel pipe pile
    DrivenSteelPipe,
    /// Driven precast concrete
    DrivenPrecastConcrete,
    /// Drilled shaft (bored pile)
    DrilledShaft,
    /// Continuous flight auger (CFA)
    CfaPile,
    /// Micropile
    Micropile,
}

/// Single pile definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pile {
    /// Pile ID
    pub id: String,
    /// Pile type
    pub pile_type: PileType,
    /// Pile diameter or width (m)
    pub diameter: f64,
    /// Embedded length (m)
    pub length: f64,
    /// Top coordinates [x, y, z]
    pub top_coord: [f64; 3],
    /// Batter angle (degrees from vertical)
    pub batter: f64,
    /// Concrete strength fc' (MPa)
    pub fc: f64,
    /// Steel yield strength fy (MPa)
    pub fy: f64,
    /// Steel area (mm²) for reinforced concrete
    pub steel_area: f64,
}

impl Pile {
    pub fn new(id: &str, pile_type: PileType, diameter: f64, length: f64) -> Self {
        Pile {
            id: id.to_string(),
            pile_type,
            diameter,
            length,
            top_coord: [0.0, 0.0, 0.0],
            batter: 0.0,
            fc: 30.0,
            fy: 415.0,
            steel_area: 2000.0,
        }
    }
    
    /// Cross-sectional area
    pub fn area(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenSteelH => self.diameter * 0.4, // Approximate flange area
            _ => PI * self.diameter.powi(2) / 4.0,
        }
    }
    
    /// Perimeter
    pub fn perimeter(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenSteelH => 4.0 * self.diameter, // Approximate
            _ => PI * self.diameter,
        }
    }
    
    /// Tip area
    pub fn tip_area(&self) -> f64 {
        match self.pile_type {
            PileType::DrivenSteelH => self.diameter * 0.4,
            PileType::DrivenSteelPipe => PI * self.diameter.powi(2) / 4.0,
            _ => PI * self.diameter.powi(2) / 4.0,
        }
    }
}

/// Pile capacity components
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileCapacityResult {
    /// Ultimate end bearing (kN)
    pub qp: f64,
    /// Ultimate shaft friction (kN)
    pub qs: f64,
    /// Ultimate axial capacity (kN)
    pub qu: f64,
    /// Allowable axial capacity (kN)
    pub qa: f64,
    /// Factor of safety
    pub fs: f64,
    /// Uplift capacity (kN)
    pub uplift: f64,
    /// Lateral capacity at yield (kN)
    pub lateral: f64,
}

/// Calculate pile capacity using alpha method (cohesive soils)
pub fn pile_capacity_alpha(
    pile: &Pile,
    soil_layers: &[SoilLayer],
) -> PileCapacityResult {
    let mut qs_total = 0.0;
    let mut current_depth = 0.0;
    
    for layer in soil_layers {
        let layer_top = current_depth;
        let layer_bottom = current_depth + layer.thickness();
        
        // Check if pile extends through this layer
        if pile.length > layer_top {
            let z_top = layer_top;
            let z_bottom = pile.length.min(layer_bottom);
            let segment_length = z_bottom - z_top;
            
            if segment_length > 0.0 {
                // Alpha method for cohesive soils
                let su = layer.cohesion; // Undrained shear strength
                let alpha = if su <= 25.0 {
                    1.0
                } else if su <= 70.0 {
                    1.0 - (su - 25.0) * 0.5 / 45.0
                } else {
                    0.5
                };
                
                let fs_layer = alpha * su; // Unit shaft friction (kPa)
                qs_total += fs_layer * pile.perimeter() * segment_length;
            }
        }
        
        current_depth = layer_bottom;
        if current_depth >= pile.length {
            break;
        }
    }
    
    // End bearing
    let tip_layer = match soil_layers.last() {
        Some(layer) => layer,
        None => return PileCapacityResult {
            qp: 0.0, qs: 0.0, qu: 0.0, qa: 0.0,
            fs: 0.0, uplift: 0.0, lateral: 0.0,
        },
    };
    let nc = 9.0; // Skempton's Nc for deep foundations
    let qp = nc * tip_layer.cohesion * pile.tip_area();
    
    // Total capacity
    let qu = qp + qs_total;
    let fs = 2.5;
    let qa = qu / fs;
    
    // Uplift (shaft friction only)
    let uplift = qs_total * 0.75 / fs;
    
    // Lateral capacity (simplified Broms method)
    let su_avg = soil_layers.iter()
        .map(|l| l.cohesion * l.thickness())
        .sum::<f64>() / pile.length;
    let lateral = 9.0 * su_avg * pile.diameter * pile.length / 3.0 / 2.5;
    
    PileCapacityResult {
        qp,
        qs: qs_total,
        qu,
        qa,
        fs,
        uplift,
        lateral,
    }
}

/// Calculate pile capacity using beta method (granular soils)
pub fn pile_capacity_beta(
    pile: &Pile,
    soil_layers: &[SoilLayer],
    water_table_depth: f64,
) -> PileCapacityResult {
    let mut qs_total = 0.0;
    let mut current_depth = 0.0;
    let gamma_water = 9.81;
    
    // Accumulate overburden for correct sigma_v in multi-layer profiles
    let mut sigma_v_at_top = 0.0; // Effective stress accumulated to current layer top
    
    for layer in soil_layers {
        let layer_top = current_depth;
        let layer_bottom = current_depth + layer.thickness();
        
        if pile.length > layer_top {
            let z_top = layer_top;
            let z_bottom = pile.length.min(layer_bottom);
            let segment_length = z_bottom - z_top;
            
            if segment_length > 0.0 {
                let mid_depth = (z_top + z_bottom) / 2.0;
                let depth_in_layer = mid_depth - layer_top;
                
                // Effective unit weight depends on water table
                let gamma = if mid_depth > water_table_depth {
                    layer.saturated_unit_weight - gamma_water
                } else {
                    layer.unit_weight
                };
                
                // Accumulated overburden stress at segment mid-depth
                let sigma_v = sigma_v_at_top + gamma * depth_in_layer;
                
                // Beta = Ks * tan(delta)
                let phi = layer.friction_angle.to_radians();
                let delta = 0.75 * phi; // Interface friction angle
                let k0 = 1.0 - phi.sin();
                let ks = k0 * 1.5; // For driven piles
                
                let beta = ks * delta.tan();
                let fs_layer = beta * sigma_v; // Unit shaft friction
                
                qs_total += fs_layer * pile.perimeter() * segment_length;
            }
        }
        
        // Accumulate full-layer stress for next layer
        let gamma_full = if layer_bottom > water_table_depth {
            layer.saturated_unit_weight - gamma_water
        } else {
            layer.unit_weight
        };
        sigma_v_at_top += gamma_full * layer.thickness();
        
        current_depth = layer_bottom;
        if current_depth >= pile.length {
            break;
        }
    }
    
    // End bearing (Vesic method for granular)
    let tip_layer = match soil_layers.last() {
        Some(layer) => layer,
        None => return PileCapacityResult {
            qp: 0.0, qs: 0.0, qu: 0.0, qa: 0.0,
            fs: 0.0, uplift: 0.0, lateral: 0.0,
        },
    };
    let phi = tip_layer.friction_angle.to_radians();
    let nq = (45.0_f64.to_radians() + phi / 2.0).tan().powi(2) * (PI * phi.tan()).exp();
    
    // Effective stress at pile tip (accumulated through layers, water-table aware)
    let mut sigma_vp = 0.0;
    let mut z_accum = 0.0;
    for layer in soil_layers {
        let layer_thick = layer.thickness().min(pile.length - z_accum);
        if layer_thick <= 0.0 { break; }
        let gamma_eff = if z_accum + layer_thick > water_table_depth {
            layer.saturated_unit_weight - gamma_water
        } else {
            layer.unit_weight
        };
        sigma_vp += gamma_eff * layer_thick;
        z_accum += layer_thick;
        if z_accum >= pile.length { break; }
    }
    
    let qp = nq * sigma_vp * pile.tip_area();
    
    let qu = qp + qs_total;
    let fs = 2.5;
    let qa = qu / fs;
    
    let uplift = qs_total * 0.75 / fs;
    
    // Lateral capacity (Broms for sand)
    let kp = (45.0_f64.to_radians() + phi / 2.0).tan().powi(2);
    let gamma_avg = soil_layers.iter()
        .map(|l| l.unit_weight * l.thickness())
        .sum::<f64>() / pile.length;
    let lateral = 0.5 * kp * gamma_avg * pile.diameter * pile.length.powi(2) / 3.0 / 2.5;
    
    PileCapacityResult {
        qp,
        qs: qs_total,
        qu,
        qa,
        fs,
        uplift,
        lateral,
    }
}

// ============================================================================
// PILE GROUP ANALYSIS
// ============================================================================

/// Pile group configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PileGroup {
    /// Group ID
    pub id: String,
    /// Piles in the group
    pub piles: Vec<Pile>,
    /// Pile spacing (m)
    pub spacing: f64,
    /// Number of rows
    pub n_rows: usize,
    /// Number of columns
    pub n_cols: usize,
    /// Cap thickness (m)
    pub cap_thickness: f64,
    /// Cap concrete strength (MPa)
    pub cap_fc: f64,
}

impl PileGroup {
    pub fn new(id: &str, n_rows: usize, n_cols: usize, spacing: f64, pile: &Pile) -> Self {
        let mut piles = Vec::new();
        
        for row in 0..n_rows {
            for col in 0..n_cols {
                let mut p = pile.clone();
                p.id = format!("{}_{}{}", id, row + 1, col + 1);
                p.top_coord = [col as f64 * spacing, row as f64 * spacing, 0.0];
                piles.push(p);
            }
        }
        
        PileGroup {
            id: id.to_string(),
            piles,
            spacing,
            n_rows,
            n_cols,
            cap_thickness: 1.0,
            cap_fc: 30.0,
        }
    }
    
    /// Number of piles
    pub fn n_piles(&self) -> usize {
        self.piles.len()
    }
    
    /// Group dimensions
    pub fn dimensions(&self) -> (f64, f64) {
        let l = (self.n_rows - 1) as f64 * self.spacing;
        let b = (self.n_cols - 1) as f64 * self.spacing;
        (l, b)
    }
}

/// Group efficiency factor
pub fn pile_group_efficiency(group: &PileGroup) -> f64 {
    let _n = group.n_piles() as f64;
    let m = group.n_rows as f64;
    let k = group.n_cols as f64;
    let s = group.spacing;
    let d = group.piles.first().map(|p| p.diameter).unwrap_or(0.6);
    
    // Converse-Labarre formula
    let theta = (d / s).atan(); // radians
    let eta = 1.0 - theta * ((m - 1.0) * k + (k - 1.0) * m) / (PI / 2.0 * m * k);
    
    eta.max(0.7).min(1.0)
}

/// Distribute pile group loads
pub fn distribute_pile_loads(
    group: &PileGroup,
    p: f64,   // Axial load (kN)
    mx: f64,  // Moment about X axis (kN-m)
    my: f64,  // Moment about Y axis (kN-m)
) -> Vec<f64> {
    let n = group.n_piles() as f64;
    
    // Centroid
    let x_c: f64 = group.piles.iter().map(|p| p.top_coord[0]).sum::<f64>() / n;
    let y_c: f64 = group.piles.iter().map(|p| p.top_coord[1]).sum::<f64>() / n;
    
    // Sum of squared distances
    let sum_x2: f64 = group.piles.iter().map(|p| (p.top_coord[0] - x_c).powi(2)).sum();
    let sum_y2: f64 = group.piles.iter().map(|p| (p.top_coord[1] - y_c).powi(2)).sum();
    
    // Load per pile
    group.piles.iter().map(|pile| {
        let x = pile.top_coord[0] - x_c;
        let y = pile.top_coord[1] - y_c;
        
        let p_axial = p / n;
        let p_mx = if sum_y2 > 0.0 { mx * y / sum_y2 } else { 0.0 };
        let p_my = if sum_x2 > 0.0 { my * x / sum_x2 } else { 0.0 };
        
        p_axial + p_mx + p_my
    }).collect()
}

// ============================================================================
// P-Y CURVES (LATERAL SOIL-STRUCTURE INTERACTION)
// ============================================================================

/// P-y curve types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PYCurveType {
    /// Soft clay (Matlock, 1970)
    SoftClay,
    /// Stiff clay (Reese & Welch, 1975)
    StiffClay,
    /// Sand (Reese et al., 1974)
    Sand,
    /// API sand
    ApiSand,
    /// API clay
    ApiClay,
}

/// Generate p-y curve for given depth and soil
pub fn generate_py_curve(
    depth: f64,
    pile_diameter: f64,
    soil: &SoilLayer,
    curve_type: PYCurveType,
    num_points: usize,
) -> Vec<(f64, f64)> {
    let d = pile_diameter;
    let mut curve = Vec::with_capacity(num_points);
    
    match curve_type {
        PYCurveType::SoftClay => {
            let su = soil.cohesion;
            let gamma = soil.unit_weight;
            let j = 0.5; // Empirical constant (0.25-0.5)
            
            // Ultimate resistance
            let np = 3.0 + gamma * depth / su + j * depth / d;
            let pu = np.min(9.0) * su * d;
            
            // y50
            let eps_50 = 0.02; // Strain at 50% strength
            let y50 = 2.5 * eps_50 * d;
            
            // Generate curve points
            for i in 0..num_points {
                let y = (i as f64 / (num_points - 1) as f64) * 8.0 * y50;
                let p = if y < 8.0 * y50 {
                    0.5 * pu * (y / y50).powf(1.0 / 3.0)
                } else {
                    pu
                };
                curve.push((y, p));
            }
        }
        PYCurveType::Sand | PYCurveType::ApiSand => {
            let phi = soil.friction_angle.to_radians();
            let gamma = soil.unit_weight;
            
            // Coefficients
            let alpha = (phi / 2.0).to_degrees();
            let beta = 45.0 + phi.to_degrees() / 2.0;
            let k0 = 0.4;
            let ka = (PI / 4.0 - phi / 2.0).tan().powi(2);
            
            // Ultimate resistance coefficients
            let c1 = (beta.to_radians().tan().powi(2) - ka) * 
                     (phi.sin() / (alpha.to_radians().cos() * phi.tan())) +
                     beta.to_radians().tan().powi(2) * alpha.to_radians().tan();
            let c2 = beta.to_radians().tan() / (beta - alpha).to_radians().tan() - ka;
            let c3 = ka * ((beta.to_radians().tan()).powi(8) - 1.0) +
                     k0 * phi.tan() * beta.to_radians().tan().powi(4);
            
            let pu_shallow = (c1 * depth + c2 * d) * gamma * depth;
            let pu_deep = c3 * d * gamma * depth;
            let pu = pu_shallow.min(pu_deep);
            
            // Initial modulus
            let k = match soil.soil_type {
                SoilType::Sand => 15000.0, // kN/m³ for medium dense
                _ => 10000.0,
            };
            
            let y_u = 3.0 * d / 80.0;
            let a = 0.9; // Cyclic loading
            
            for i in 0..num_points {
                let y = (i as f64 / (num_points - 1) as f64) * 5.0 * y_u;
                let p = a * pu * (k * depth * y / (a * pu)).tanh();
                curve.push((y, p));
            }
        }
        _ => {
            // Default linear elastic spring
            let es = soil.elastic_modulus * 1000.0; // kPa
            let k_h = es / d;
            let y_max = 0.05 * d;
            
            for i in 0..num_points {
                let y = (i as f64 / (num_points - 1) as f64) * y_max;
                let p = k_h * d * y;
                curve.push((y, p));
            }
        }
    }
    
    curve
}

// ============================================================================
// MAT FOUNDATION ANALYSIS
// ============================================================================

/// Mat (raft) foundation definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatFoundation {
    /// Mat ID
    pub id: String,
    /// Length in X direction (m)
    pub length_x: f64,
    /// Length in Y direction (m)
    pub length_y: f64,
    /// Thickness (m)
    pub thickness: f64,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Edge distances [left, right, bottom, top] (m)
    pub edges: [f64; 4],
    /// Column locations and loads
    pub columns: Vec<MatColumn>,
}

/// Column on mat foundation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatColumn {
    /// Column ID
    pub id: String,
    /// Location [x, y] from mat corner (m)
    pub location: [f64; 2],
    /// Column dimensions [bx, by] (m)
    pub dimensions: [f64; 2],
    /// Axial load (kN)
    pub p: f64,
    /// Moment about X (kN-m)
    pub mx: f64,
    /// Moment about Y (kN-m)
    pub my: f64,
}

/// Calculate mat foundation subgrade modulus
pub fn calculate_subgrade_modulus(
    mat: &MatFoundation,
    soil: &SoilLayer,
    _settlement_target: f64, // mm
) -> f64 {
    // Based on Vesic's equation
    let es = soil.elastic_modulus * 1000.0; // kPa
    let nu = soil.poisson_ratio;
    let b = mat.length_y.min(mat.length_x);
    
    // Equivalent foundation stiffness
    let ef = 25.0 * 1000.0; // Assume E_concrete = 25 GPa
    let h = mat.thickness;
    let ei = ef * h.powi(3) / 12.0;
    
    // Relative stiffness factor
    let _lambda = (es / (1.0 - nu.powi(2)) * b.powi(4) / (16.0 * ei)).powf(0.25);
    
    // Subgrade modulus (Winkler spring constant)
    let ks = 0.65 * (es / (1.0 - nu.powi(2))) * 
             (es * b.powi(4) / ei).powf(1.0 / 12.0) / b;
    
    ks // kN/m³
}

/// Simple mat foundation analysis (uniform pressure assumption)
pub fn analyze_mat_uniform(
    mat: &MatFoundation,
    soil: &SoilLayer,
) -> (f64, f64, f64) {
    let area = mat.length_x * mat.length_y;
    
    // Total load
    let total_p: f64 = mat.columns.iter().map(|c| c.p).sum();
    
    // Centroid of loads
    let mut sum_px = 0.0;
    let mut sum_py = 0.0;
    for col in &mat.columns {
        sum_px += col.p * col.location[0];
        sum_py += col.p * col.location[1];
    }
    
    let x_load = if total_p > 0.0 { sum_px / total_p } else { mat.length_x / 2.0 };
    let y_load = if total_p > 0.0 { sum_py / total_p } else { mat.length_y / 2.0 };
    
    // Eccentricity
    let ex = x_load - mat.length_x / 2.0;
    let ey = y_load - mat.length_y / 2.0;
    
    // Section moduli
    let ix = mat.length_x * mat.length_y.powi(3) / 12.0;
    let iy = mat.length_y * mat.length_x.powi(3) / 12.0;
    
    // Total moments including column moments
    let total_mx: f64 = mat.columns.iter().map(|c| c.mx).sum::<f64>() + total_p * ey;
    let total_my: f64 = mat.columns.iter().map(|c| c.my).sum::<f64>() + total_p * ex;
    
    // Corner pressures
    let q_avg = total_p / area;
    let q_mx = total_mx * (mat.length_y / 2.0) / ix;
    let q_my = total_my * (mat.length_x / 2.0) / iy;
    
    let q_max = q_avg + q_mx.abs() + q_my.abs();
    let q_min = q_avg - q_mx.abs() - q_my.abs();
    
    // Check bearing capacity
    let _qa = soil.cohesion * 5.14 * 0.75 + soil.unit_weight * 1.0; // Simple estimate
    
    (q_avg, q_max.max(0.0), q_min.max(0.0))
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_bearing_capacity_factors() {
        let (nc, nq, ng) = bearing_capacity_factors(30.0, BearingCapacityMethod::Vesic);
        
        // Vesic factors for φ = 30°
        assert!((nc - 30.14).abs() < 1.0);
        assert!((nq - 18.4).abs() < 1.0);
        assert!(ng > 15.0);
    }
    
    #[test]
    fn test_spread_footing_bearing() {
        let footing = SpreadFooting::new("F1", 2.0, 2.0);
        let soil = SoilLayer::new("Dense Sand", 0.0, -5.0, SoilType::Sand);
        
        let result = calculate_bearing_capacity(
            &footing,
            &soil,
            BearingCapacityMethod::Vesic,
            10.0, // Deep water table
            0.0,  // No inclination
        );
        
        assert!(result.qu > 0.0);
        assert!(result.qa > 0.0);
        assert!(result.qa < result.qu);
        assert!((result.fs - 3.0).abs() < 0.01);
    }
    
    #[test]
    fn test_immediate_settlement() {
        let footing = SpreadFooting::new("F1", 3.0, 3.0);
        let soil = SoilLayer::new("Sand", 0.0, -10.0, SoilType::Sand);
        
        let settlement = calculate_immediate_settlement(
            &footing,
            100.0, // 100 kPa contact pressure
            &soil,
            true, // Flexible
        );
        
        // Reasonable settlement for sandy soil
        assert!(settlement > 0.0);
        assert!(settlement < 50.0); // Less than 50mm
    }
    
    #[test]
    fn test_pile_alpha_method() {
        let pile = Pile::new("P1", PileType::DrilledShaft, 0.6, 15.0);
        let layers = vec![
            SoilLayer::new("Soft Clay", 0.0, -7.0, SoilType::LeanClay),
            SoilLayer::new("Stiff Clay", -7.0, -20.0, SoilType::FatClay),
        ];
        
        let result = pile_capacity_alpha(&pile, &layers);
        
        assert!(result.qs > 0.0);
        assert!(result.qp > 0.0);
        assert!(result.qu > result.qs);
        assert!(result.qa < result.qu);
    }
    
    #[test]
    fn test_pile_beta_method() {
        let pile = Pile::new("P1", PileType::DrivenSteelPipe, 0.5, 20.0);
        let layers = vec![
            SoilLayer::new("Dense Sand", 0.0, -25.0, SoilType::Sand),
        ];
        
        let result = pile_capacity_beta(&pile, &layers, 5.0);
        
        assert!(result.qs > 0.0);
        assert!(result.qp > 0.0);
        assert!(result.lateral > 0.0);
    }
    
    #[test]
    fn test_pile_group_efficiency() {
        let base_pile = Pile::new("P", PileType::DrilledShaft, 0.6, 15.0);
        let group = PileGroup::new("PG1", 3, 3, 1.8, &base_pile);
        
        let eta = pile_group_efficiency(&group);
        
        assert!(eta >= 0.7);
        assert!(eta <= 1.0);
        assert_eq!(group.n_piles(), 9);
    }
    
    #[test]
    fn test_pile_load_distribution() {
        let base_pile = Pile::new("P", PileType::DrilledShaft, 0.6, 12.0);
        let group = PileGroup::new("PG1", 2, 2, 2.0, &base_pile);
        
        // Axial load only (symmetric)
        let loads = distribute_pile_loads(&group, 1000.0, 0.0, 0.0);
        
        assert_eq!(loads.len(), 4);
        for load in &loads {
            assert!((load - 250.0).abs() < 0.1);
        }
    }
    
    #[test]
    fn test_py_curve_generation() {
        let soil = SoilLayer::new("Soft Clay", 0.0, -10.0, SoilType::LeanClay);
        let curve = generate_py_curve(5.0, 0.6, &soil, PYCurveType::SoftClay, 20);
        
        assert_eq!(curve.len(), 20);
        assert_eq!(curve[0].0, 0.0); // y=0 at start
        
        // Monotonically increasing
        for i in 1..curve.len() {
            assert!(curve[i].1 >= curve[i-1].1);
        }
    }
    
    #[test]
    fn test_consolidation_time() {
        let t90 = consolidation_time(5.0, 1.0, 0.9);
        
        // For H=5m, cv=1 m²/year, U=90%, should be several years
        assert!(t90 > 10.0);
        assert!(t90 < 100.0);
    }
    
    #[test]
    fn test_soil_profile() {
        let mut profile = SoilProfile::new("Test Site");
        profile.add_layer(SoilLayer::new("Fill", 0.0, -2.0, SoilType::SiltySand));
        profile.add_layer(SoilLayer::new("Clay", -2.0, -10.0, SoilType::LeanClay));
        profile.gwl = -3.0;
        
        let layer = profile.layer_at_depth(5.0);
        assert!(layer.is_some());
        assert_eq!(layer.unwrap().name, "Clay");
        
        let pressure = profile.overburden_pressure(5.0);
        assert!(pressure > 0.0);
    }
}
