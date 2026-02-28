//! Caisson Foundation Module
//! 
//! Implements design and analysis of caisson foundations:
//! - Open caisson design
//! - Pneumatic caisson design
//! - Box caisson design
//! - Drilled shaft (bored pile) design
//! - Sinking analysis
//! - Bearing capacity
//! - Settlement prediction

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CAISSON TYPES
// ============================================================================

/// Caisson type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CaissonType {
    /// Open caisson (well foundation)
    Open,
    /// Pneumatic caisson (compressed air)
    Pneumatic,
    /// Box caisson (floated and sunk)
    Box,
    /// Drilled shaft (bored pile)
    DrilledShaft,
    /// Floating caisson
    Floating,
    /// Monopile caisson
    Monopile,
}

impl CaissonType {
    /// Typical depth range (m)
    pub fn depth_range(&self) -> (f64, f64) {
        match self {
            Self::Open => (5.0, 30.0),
            Self::Pneumatic => (10.0, 40.0),
            Self::Box => (3.0, 20.0),
            Self::DrilledShaft => (10.0, 80.0),
            Self::Floating => (5.0, 15.0),
            Self::Monopile => (20.0, 60.0),
        }
    }
    
    /// Typical diameter range (m)
    pub fn diameter_range(&self) -> (f64, f64) {
        match self {
            Self::Open => (3.0, 20.0),
            Self::Pneumatic => (5.0, 25.0),
            Self::Box => (5.0, 30.0),
            Self::DrilledShaft => (0.6, 3.0),
            Self::Floating => (10.0, 50.0),
            Self::Monopile => (4.0, 10.0),
        }
    }
    
    /// Suitable soil conditions
    pub fn suitable_soils(&self) -> Vec<SoilType> {
        match self {
            Self::Open => vec![SoilType::Sand, SoilType::Gravel, SoilType::SoftCite],
            Self::Pneumatic => vec![SoilType::Sand, SoilType::Gravel, SoilType::Clay],
            Self::Box => vec![SoilType::Sand, SoilType::Gravel],
            Self::DrilledShaft => vec![SoilType::Clay, SoilType::Sand, SoilType::Rock],
            Self::Floating => vec![SoilType::Sand, SoilType::Gravel],
            Self::Monopile => vec![SoilType::Sand, SoilType::Clay],
        }
    }
}

/// Soil type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    /// Loose sand
    Sand,
    /// Dense sand
    DenseSand,
    /// Gravel
    Gravel,
    /// Soft clay
    SoftCite,
    /// Stiff clay
    Clay,
    /// Very stiff clay
    StiffClay,
    /// Rock
    Rock,
    /// Weathered rock
    WeatheredRock,
}

impl SoilType {
    /// Unit weight (kN/m³)
    pub fn unit_weight(&self) -> f64 {
        match self {
            Self::Sand => 18.0,
            Self::DenseSand => 20.0,
            Self::Gravel => 21.0,
            Self::SoftCite => 16.0,
            Self::Clay => 18.0,
            Self::StiffClay => 19.0,
            Self::Rock => 25.0,
            Self::WeatheredRock => 22.0,
        }
    }
    
    /// Typical friction angle (degrees)
    pub fn friction_angle(&self) -> f64 {
        match self {
            Self::Sand => 30.0,
            Self::DenseSand => 38.0,
            Self::Gravel => 40.0,
            Self::SoftCite => 0.0,
            Self::Clay => 20.0,
            Self::StiffClay => 25.0,
            Self::Rock => 45.0,
            Self::WeatheredRock => 35.0,
        }
    }
    
    /// Typical cohesion (kPa)
    pub fn cohesion(&self) -> f64 {
        match self {
            Self::Sand => 0.0,
            Self::DenseSand => 0.0,
            Self::Gravel => 0.0,
            Self::SoftCite => 15.0,
            Self::Clay => 50.0,
            Self::StiffClay => 100.0,
            Self::Rock => 500.0,
            Self::WeatheredRock => 100.0,
        }
    }
    
    /// Skin friction coefficient (α for clay, K·tan(δ) for sand)
    pub fn skin_friction_coeff(&self) -> f64 {
        match self {
            Self::Sand => 0.4,
            Self::DenseSand => 0.5,
            Self::Gravel => 0.6,
            Self::SoftCite => 1.0,  // α factor
            Self::Clay => 0.5,
            Self::StiffClay => 0.35,
            Self::Rock => 0.2,
            Self::WeatheredRock => 0.3,
        }
    }
}

// ============================================================================
// CAISSON GEOMETRY
// ============================================================================

/// Caisson cross-section shape
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CrossSection {
    /// Circular
    Circular,
    /// Rectangular
    Rectangular,
    /// Dumbbell (two circles connected)
    Dumbbell,
    /// Twin (two separate circles)
    Twin,
    /// Octagonal
    Octagonal,
}

/// Caisson geometry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaissonGeometry {
    /// Caisson type
    pub caisson_type: CaissonType,
    /// Cross-section shape
    pub cross_section: CrossSection,
    /// Outer diameter or width (m)
    pub outer_dimension: f64,
    /// Inner diameter or width (m)
    pub inner_dimension: f64,
    /// Length (for rectangular, m)
    pub length: Option<f64>,
    /// Total depth (m)
    pub depth: f64,
    /// Wall thickness (m)
    pub wall_thickness: f64,
    /// Cutting edge angle (degrees)
    pub cutting_edge_angle: f64,
}

impl CaissonGeometry {
    /// Create circular caisson
    pub fn circular(outer_d: f64, inner_d: f64, depth: f64) -> Self {
        Self {
            caisson_type: CaissonType::Open,
            cross_section: CrossSection::Circular,
            outer_dimension: outer_d,
            inner_dimension: inner_d,
            length: None,
            depth,
            wall_thickness: (outer_d - inner_d) / 2.0,
            cutting_edge_angle: 30.0,
        }
    }
    
    /// Create rectangular caisson
    pub fn rectangular(width: f64, length: f64, wall: f64, depth: f64) -> Self {
        Self {
            caisson_type: CaissonType::Open,
            cross_section: CrossSection::Rectangular,
            outer_dimension: width,
            inner_dimension: width - 2.0 * wall,
            length: Some(length),
            depth,
            wall_thickness: wall,
            cutting_edge_angle: 30.0,
        }
    }
    
    /// Outer perimeter (m)
    pub fn outer_perimeter(&self) -> f64 {
        match self.cross_section {
            CrossSection::Circular => PI * self.outer_dimension,
            CrossSection::Rectangular => {
                2.0 * (self.outer_dimension + self.length.unwrap_or(self.outer_dimension))
            }
            CrossSection::Dumbbell => {
                PI * self.outer_dimension * 1.5 // Approximate
            }
            CrossSection::Twin => 2.0 * PI * self.outer_dimension,
            CrossSection::Octagonal => {
                // Regular octagon: P = 8s where s = d/(1+√2), d = across flats
                8.0 * self.outer_dimension / (1.0 + 2.0_f64.sqrt())
            }
        }
    }
    
    /// Inner perimeter (m)
    pub fn inner_perimeter(&self) -> f64 {
        match self.cross_section {
            CrossSection::Circular => PI * self.inner_dimension,
            CrossSection::Rectangular => {
                let inner_length = self.length.unwrap_or(self.outer_dimension) - 2.0 * self.wall_thickness;
                2.0 * (self.inner_dimension + inner_length)
            }
            CrossSection::Dumbbell => PI * self.inner_dimension * 1.5,
            CrossSection::Twin => 2.0 * PI * self.inner_dimension,
            CrossSection::Octagonal => {
                8.0 * self.inner_dimension / (1.0 + 2.0_f64.sqrt())
            }
        }
    }
    
    /// Gross area (m²)
    pub fn gross_area(&self) -> f64 {
        match self.cross_section {
            CrossSection::Circular => PI * (self.outer_dimension / 2.0).powi(2),
            CrossSection::Rectangular => {
                self.outer_dimension * self.length.unwrap_or(self.outer_dimension)
            }
            CrossSection::Dumbbell => PI * (self.outer_dimension / 2.0).powi(2) * 1.5,
            CrossSection::Twin => 2.0 * PI * (self.outer_dimension / 2.0).powi(2),
            CrossSection::Octagonal => {
                2.0 * (1.0 + 2.0_f64.sqrt()) * (self.outer_dimension / 2.0).powi(2)
            }
        }
    }
    
    /// Net area (for bearing) (m²)
    pub fn net_area(&self) -> f64 {
        match self.cross_section {
            CrossSection::Circular => PI * (self.inner_dimension / 2.0).powi(2),
            CrossSection::Rectangular => {
                let inner_length = self.length.unwrap_or(self.outer_dimension) - 2.0 * self.wall_thickness;
                self.inner_dimension * inner_length
            }
            _ => self.gross_area() - self.wall_area(),
        }
    }
    
    /// Wall area (m²)
    pub fn wall_area(&self) -> f64 {
        self.gross_area() - self.net_area()
    }
    
    /// Concrete volume (m³)
    pub fn concrete_volume(&self) -> f64 {
        self.wall_area() * self.depth
    }
    
    /// Self weight (kN)
    pub fn self_weight(&self, concrete_unit_weight: f64) -> f64 {
        self.concrete_volume() * concrete_unit_weight
    }
}

// ============================================================================
// BEARING CAPACITY
// ============================================================================

/// Bearing capacity analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BearingCapacity {
    /// Ultimate base resistance (kN)
    pub ultimate_base: f64,
    /// Ultimate shaft resistance (kN)
    pub ultimate_shaft: f64,
    /// Allowable bearing capacity (kN)
    pub allowable: f64,
    /// Factor of safety
    pub factor_of_safety: f64,
}

impl BearingCapacity {
    /// Calculate bearing capacity (Terzaghi's method)
    pub fn calculate_terzaghi(
        geometry: &CaissonGeometry,
        soil: &SoilLayer,
        water_depth: f64,
    ) -> Self {
        let phi_rad = soil.friction_angle * PI / 180.0;
        
        // Bearing capacity factors
        let nq = ((45.0 + soil.friction_angle / 2.0) * PI / 180.0).tan().powi(2) 
            * (PI * phi_rad.tan()).exp();
        let nc = (nq - 1.0) / phi_rad.tan().max(0.01);
        let n_gamma = 2.0 * (nq + 1.0) * phi_rad.tan();
        
        // Shape factors (Hansen/Vesic) for circular caisson: B/L = 1.0
        let b_over_l = match geometry.cross_section {
            CrossSection::Circular | CrossSection::Octagonal => 1.0,
            CrossSection::Rectangular => {
                geometry.outer_dimension / geometry.length.unwrap_or(geometry.outer_dimension)
            }
            _ => 1.0,
        };
        let sq = 1.0 + b_over_l * phi_rad.sin();
        let sc = 1.0 + nq / nc * b_over_l;
        let s_gamma = 1.0 - 0.4 * b_over_l;
        
        // Depth factors
        let dq = 1.0 + 2.0 * phi_rad.tan() * (1.0 - phi_rad.sin()).powi(2) 
            * (geometry.depth / geometry.outer_dimension).atan();
        let dc = dq - (1.0 - dq) / (nc * phi_rad.tan().max(0.01));
        let d_gamma = 1.0;
        
        // Effective overburden: dry soil above WT + buoyant soil below WT
        let dry_depth = water_depth.min(geometry.depth);
        let submerged_depth = (geometry.depth - water_depth).max(0.0);
        let sigma_v = soil.unit_weight * dry_depth 
            + (soil.unit_weight - 10.0).max(0.0) * submerged_depth;
        
        // Ultimate base resistance
        let q_ult = soil.cohesion * nc * sc * dc 
            + sigma_v * nq * sq * dq 
            + 0.5 * (soil.unit_weight - 10.0).max(0.0) * geometry.outer_dimension * n_gamma * s_gamma * d_gamma;
        
        let ultimate_base = q_ult * geometry.gross_area();
        
        // Shaft resistance
        let alpha = soil.alpha_factor();
        let ks_tan_delta = soil.skin_friction_coeff();
        
        let avg_sigma_v = sigma_v / 2.0;
        let shaft_unit = if soil.cohesion > 0.0 {
            alpha * soil.cohesion
        } else {
            ks_tan_delta * avg_sigma_v
        };
        
        let ultimate_shaft = shaft_unit * geometry.outer_perimeter() * geometry.depth;
        
        // Factor of safety
        let fs = 2.5;
        let allowable = (ultimate_base + ultimate_shaft) / fs;
        
        Self {
            ultimate_base,
            ultimate_shaft,
            allowable,
            factor_of_safety: fs,
        }
    }
    
    /// Calculate using IRC 78 (Indian code)
    pub fn calculate_irc78(
        geometry: &CaissonGeometry,
        soil: &SoilLayer,
        _water_depth: f64,
    ) -> Self {
        // IRC 78 method for well foundations
        let base_area = geometry.gross_area();
        let perimeter = geometry.outer_perimeter();
        
        // Base resistance
        let n = match soil.soil_type {
            SoilType::Sand | SoilType::DenseSand => 5.14,
            SoilType::Gravel => 6.0,
            SoilType::Clay | SoilType::StiffClay => 5.7,
            _ => 5.0,
        };
        
        let sigma_v = soil.unit_weight * geometry.depth;
        let q_base = n * soil.cohesion + sigma_v;
        let ultimate_base = q_base * base_area * 0.5; // IRC reduction
        
        // Shaft resistance
        let fs_unit = soil.skin_friction_coeff() * sigma_v / 2.0 + soil.cohesion * 0.5;
        let ultimate_shaft = fs_unit * perimeter * geometry.depth;
        
        let fs = 2.5;
        let allowable = (ultimate_base + ultimate_shaft) / fs;
        
        Self {
            ultimate_base,
            ultimate_shaft,
            allowable,
            factor_of_safety: fs,
        }
    }
    
    /// Total ultimate capacity (kN)
    pub fn ultimate_capacity(&self) -> f64 {
        self.ultimate_base + self.ultimate_shaft
    }
}

// ============================================================================
// SOIL LAYER
// ============================================================================

/// Soil layer for caisson analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoilLayer {
    /// Soil type
    pub soil_type: SoilType,
    /// Layer thickness (m)
    pub thickness: f64,
    /// Depth to top of layer (m)
    pub depth_to_top: f64,
    /// Unit weight (kN/m³)
    pub unit_weight: f64,
    /// Friction angle (degrees)
    pub friction_angle: f64,
    /// Cohesion (kPa)
    pub cohesion: f64,
    /// SPT N value
    pub spt_n: Option<f64>,
}

impl SoilLayer {
    /// Create from soil type with default properties
    pub fn from_type(soil_type: SoilType, thickness: f64, depth_to_top: f64) -> Self {
        Self {
            soil_type,
            thickness,
            depth_to_top,
            unit_weight: soil_type.unit_weight(),
            friction_angle: soil_type.friction_angle(),
            cohesion: soil_type.cohesion(),
            spt_n: None,
        }
    }
    
    /// Alpha factor for shaft resistance (clay)
    pub fn alpha_factor(&self) -> f64 {
        if self.cohesion > 0.0 {
            // API method
            let psi = self.cohesion / (self.unit_weight * (self.depth_to_top + self.thickness / 2.0)).max(1.0);
            if psi <= 1.0 {
                0.5 * psi.powf(-0.5)
            } else {
                0.5 * psi.powf(-0.25)
            }.min(1.0)
        } else {
            0.0
        }
    }
    
    /// Skin friction coefficient
    pub fn skin_friction_coeff(&self) -> f64 {
        self.soil_type.skin_friction_coeff()
    }
}

// ============================================================================
// SINKING ANALYSIS
// ============================================================================

/// Sinking resistance analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinkingAnalysis {
    /// Total sinking force available (kN)
    pub sinking_force: f64,
    /// Skin friction resistance (kN)
    pub skin_friction: f64,
    /// Tip resistance (kN)
    pub tip_resistance: f64,
    /// Net sinking force (kN)
    pub net_force: f64,
    /// Sinking possible
    pub can_sink: bool,
    /// Kentledge required (kN)
    pub kentledge_required: f64,
}

impl SinkingAnalysis {
    /// Calculate sinking forces
    pub fn calculate(
        geometry: &CaissonGeometry,
        soil_layers: &[SoilLayer],
        current_depth: f64,
        water_level: f64,
        concrete_weight: f64,
    ) -> Self {
        // Sinking force (self weight - buoyancy)
        let buoyancy = if current_depth > water_level {
            let submerged = current_depth - water_level;
            geometry.gross_area() * submerged * 10.0 // Water unit weight
        } else {
            0.0
        };
        
        let self_weight = geometry.self_weight(concrete_weight);
        let sinking_force = self_weight - buoyancy;
        
        // Calculate resistance
        let mut skin_friction = 0.0;
        let mut tip_resistance = 0.0;
        
        for layer in soil_layers {
            let top = layer.depth_to_top;
            let bottom = top + layer.thickness;
            
            if current_depth > top {
                let effective_top = top;
                let effective_bottom = current_depth.min(bottom);
                let effective_thickness = effective_bottom - effective_top;
                
                // Calculate sigma_v at the level for both skin friction and tip resistance
                let avg_depth = (effective_top + effective_bottom) / 2.0;
                let sigma_v = layer.unit_weight * avg_depth;
                
                if effective_thickness > 0.0 {
                    // Skin friction for this layer
                    let fs_unit = if layer.cohesion > 0.0 {
                        layer.alpha_factor() * layer.cohesion
                    } else {
                        layer.skin_friction_coeff() * sigma_v
                    };
                    
                    skin_friction += fs_unit * geometry.outer_perimeter() * effective_thickness;
                }
                
                // Tip resistance at cutting edge
                if current_depth <= bottom && current_depth >= top {
                    let cutting_edge_area = geometry.wall_area() * 0.1; // Simplified
                    tip_resistance = layer.cohesion * 9.0 * cutting_edge_area 
                        + layer.friction_angle.to_radians().tan() * sigma_v * cutting_edge_area;
                }
            }
        }
        
        let net_force = sinking_force - skin_friction - tip_resistance;
        let can_sink = net_force > 0.0;
        let kentledge_required = if can_sink { 0.0 } else { -net_force * 1.5 };
        
        Self {
            sinking_force,
            skin_friction,
            tip_resistance,
            net_force,
            can_sink,
            kentledge_required,
        }
    }
}

// ============================================================================
// DRILLED SHAFT DESIGN
// ============================================================================

/// Drilled shaft (bored pile) design parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrilledShaft {
    /// Shaft diameter (m)
    pub diameter: f64,
    /// Shaft length (m)
    pub length: f64,
    /// Bell diameter if belled (m)
    pub bell_diameter: Option<f64>,
    /// Concrete strength (MPa)
    pub fc: f64,
    /// Steel reinforcement ratio
    pub rho_s: f64,
    /// Construction method
    pub construction_method: ConstructionMethod,
}

/// Drilled shaft construction method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConstructionMethod {
    /// Dry method
    Dry,
    /// Casing method
    Casing,
    /// Slurry (wet) method
    Slurry,
}

impl DrilledShaft {
    /// Create new drilled shaft
    pub fn new(diameter: f64, length: f64, fc: f64) -> Self {
        Self {
            diameter,
            length,
            bell_diameter: None,
            fc,
            rho_s: 0.01,
            construction_method: ConstructionMethod::Slurry,
        }
    }
    
    /// Add bell
    pub fn with_bell(mut self, bell_diameter: f64) -> Self {
        self.bell_diameter = Some(bell_diameter);
        self
    }
    
    /// Shaft area (m²)
    pub fn shaft_area(&self) -> f64 {
        PI * (self.diameter / 2.0).powi(2)
    }
    
    /// Bell area (m²)
    pub fn bell_area(&self) -> f64 {
        let d = self.bell_diameter.unwrap_or(self.diameter);
        PI * (d / 2.0).powi(2)
    }
    
    /// Side surface area (m²)
    pub fn side_area(&self) -> f64 {
        PI * self.diameter * self.length
    }
    
    /// Tip bearing capacity (kN) - FHWA method
    pub fn tip_capacity(&self, soil: &SoilLayer) -> f64 {
        let area = self.bell_area();
        
        if soil.cohesion > 0.0 {
            // Clay: q_p = N_c * c_u
            let nc = 9.0;
            nc * soil.cohesion * area
        } else {
            // Sand: q_p = q * N_q
            let phi_rad = soil.friction_angle * PI / 180.0;
            let nq = ((45.0 + soil.friction_angle / 2.0) * PI / 180.0).tan().powi(2) 
                * (PI * phi_rad.tan()).exp();
            let sigma_v = soil.unit_weight * self.length;
            
            // Limit tip resistance
            let q_max = 50.0 * soil.spt_n.unwrap_or(30.0); // kPa
            (sigma_v * nq).min(q_max) * area
        }
    }
    
    /// Side resistance capacity (kN) - FHWA method
    pub fn side_capacity(&self, soil_layers: &[SoilLayer]) -> f64 {
        let perimeter = PI * self.diameter;
        let mut total_side = 0.0;
        
        for layer in soil_layers {
            let top = layer.depth_to_top;
            let bottom = top + layer.thickness;
            let effective_length = (self.length.min(bottom) - top).max(0.0);
            
            if effective_length > 0.0 {
                let fs_unit = if layer.cohesion > 0.0 {
                    // Alpha method for clay
                    let alpha = layer.alpha_factor() * self.construction_method_factor();
                    alpha * layer.cohesion
                } else {
                    // Beta method for sand
                    let avg_depth = (top + top + effective_length) / 2.0;
                    let sigma_v = layer.unit_weight * avg_depth;
                    let beta = (1.0 - (layer.friction_angle * PI / 180.0).sin()) 
                        * (layer.friction_angle * PI / 180.0).tan();
                    (beta * sigma_v).min(200.0) // Limit to 200 kPa
                };
                
                total_side += fs_unit * perimeter * effective_length;
            }
        }
        
        total_side
    }
    
    /// Construction method factor
    fn construction_method_factor(&self) -> f64 {
        match self.construction_method {
            ConstructionMethod::Dry => 1.0,
            ConstructionMethod::Casing => 0.9,
            ConstructionMethod::Slurry => 0.8,
        }
    }
    
    /// Total capacity (kN)
    pub fn total_capacity(&self, soil_layers: &[SoilLayer]) -> f64 {
        let bearing_layer = match soil_layers.last() {
            Some(layer) => layer,
            None => return 0.0,
        };
        self.tip_capacity(bearing_layer) + self.side_capacity(soil_layers)
    }
    
    /// Allowable capacity (kN)
    pub fn allowable_capacity(&self, soil_layers: &[SoilLayer], fs: f64) -> f64 {
        self.total_capacity(soil_layers) / fs
    }
}

// ============================================================================
// LATERAL LOAD ANALYSIS
// ============================================================================

/// Lateral load analysis for caisson
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LateralAnalysis {
    /// Applied lateral load (kN)
    pub lateral_load: f64,
    /// Applied moment (kN·m)
    pub moment: f64,
    /// Embedment depth (m)
    pub embedment: f64,
    /// Rotation (radians)
    pub rotation: f64,
    /// Deflection at top (m)
    pub deflection: f64,
    /// Maximum soil pressure (kPa)
    pub max_soil_pressure: f64,
    /// Factor of safety
    pub factor_of_safety: f64,
}

impl LateralAnalysis {
    /// Calculate lateral resistance (Broms method for short piles)
    pub fn calculate_broms(
        geometry: &CaissonGeometry,
        soil: &SoilLayer,
        lateral_load: f64,
        moment: f64,
    ) -> Self {
        let d = geometry.outer_dimension;
        let l = geometry.depth;
        
        // Passive earth pressure coefficient
        let phi_rad = soil.friction_angle * PI / 180.0;
        let kp = (1.0 + phi_rad.sin()) / (1.0 - phi_rad.sin());
        
        // Ultimate lateral resistance
        let qu = if soil.cohesion > 0.0 {
            // Cohesive soil
            9.0 * soil.cohesion * d
        } else {
            // Cohesionless soil
            3.0 * kp * soil.unit_weight * l * d
        };
        
        // Maximum lateral load capacity
        let h_ult = qu * l / 2.0;
        
        // Factor of safety
        let fs = h_ult / lateral_load.max(1.0);
        
        // Rotation and deflection (elastic)
        let es = 500.0 * soil.cohesion.max(soil.friction_angle); // Approximate soil modulus
        let i = PI * d.powi(4) / 64.0;
        
        let rotation = lateral_load * l.powi(2) / (2.0 * es * i);
        let deflection = lateral_load * l.powi(3) / (3.0 * es * i);
        
        // Maximum soil pressure
        let max_soil_pressure = lateral_load / (d * l) * 2.0;
        
        Self {
            lateral_load,
            moment,
            embedment: l,
            rotation,
            deflection,
            max_soil_pressure,
            factor_of_safety: fs,
        }
    }
    
    /// Is design adequate
    pub fn is_adequate(&self, min_fs: f64, max_deflection: f64) -> bool {
        self.factor_of_safety >= min_fs && self.deflection <= max_deflection
    }
}

// ============================================================================
// SETTLEMENT ANALYSIS
// ============================================================================

/// Settlement analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettlementAnalysis {
    /// Elastic settlement (mm)
    pub elastic: f64,
    /// Consolidation settlement (mm)
    pub consolidation: f64,
    /// Immediate settlement (mm)
    pub immediate: f64,
    /// Total settlement (mm)
    pub total: f64,
}

impl SettlementAnalysis {
    /// Calculate settlement
    pub fn calculate(
        geometry: &CaissonGeometry,
        soil_layers: &[SoilLayer],
        load: f64,
    ) -> Self {
        let base_area = geometry.gross_area();
        let base_pressure = load / base_area;
        let d = geometry.outer_dimension;
        
        // Elastic settlement (Vesic)
        let bearing_layer = match soil_layers.last() {
            Some(layer) => layer,
            None => return Self {
                elastic: 0.0, consolidation: 0.0, immediate: 0.0, total: 0.0,
            },
        };
        let es = 500.0 * bearing_layer.cohesion.max(bearing_layer.friction_angle);
        let poisson: f64 = 0.3;
        let ip = 0.88; // Influence factor for circular base
        
        let elastic = base_pressure * d * (1.0 - poisson.powi(2)) * ip / es * 1000.0; // mm
        
        // Consolidation settlement (for clay layers below)
        let mut consolidation = 0.0;
        let stress_at_depth = |z: f64| -> f64 {
            // Boussinesq stress distribution
            let m = d / (2.0 * z);
            let i_z = 1.0 - 1.0 / (1.0 + m.powi(2)).powf(1.5);
            base_pressure * i_z
        };
        
        for layer in soil_layers {
            if layer.cohesion > 0.0 && layer.depth_to_top > geometry.depth {
                let cc = 0.009 * (layer.cohesion / 10.0); // Approximate compression index
                let eo = 0.8; // Initial void ratio
                let z_mid = layer.depth_to_top + layer.thickness / 2.0 - geometry.depth;
                
                let sigma_o = layer.unit_weight * z_mid;
                let delta_sigma = stress_at_depth(z_mid);
                
                let delta_h = layer.thickness * cc / (1.0 + eo) 
                    * ((sigma_o + delta_sigma) / sigma_o).log10();
                consolidation += delta_h * 1000.0; // mm
            }
        }
        
        // Immediate settlement (undrained for clay)
        let immediate = elastic * 0.5;
        
        let total = elastic + consolidation;
        
        Self {
            elastic,
            consolidation,
            immediate,
            total,
        }
    }
}

// ============================================================================
// STRUCTURAL DESIGN
// ============================================================================

/// Caisson structural design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralDesign {
    /// Wall thickness (m)
    pub wall_thickness: f64,
    /// Steining concrete grade (MPa)
    pub concrete_grade: f64,
    /// Vertical reinforcement ratio
    pub vert_rebar_ratio: f64,
    /// Horizontal reinforcement ratio
    pub horiz_rebar_ratio: f64,
    /// Bottom plug thickness (m)
    pub plug_thickness: f64,
}

impl StructuralDesign {
    /// Design wall thickness (IRC 78)
    pub fn design_wall_thickness(
        outer_diameter: f64,
        depth: f64,
        water_pressure: f64,
        fc: f64,
    ) -> f64 {
        // Minimum thickness from IRC 78
        let min_practical = 0.45 + 0.025 * outer_diameter;
        
        // Hoop stress consideration
        let sigma_allow = 0.25 * fc * 1000.0; // kPa
        let t_hoop = water_pressure * outer_diameter / 2.0 / sigma_allow;
        
        // Sinking stress consideration
        let sinking_stress = 100.0; // kPa assumption
        let t_sink = sinking_stress * depth / sigma_allow;
        
        min_practical.max(t_hoop).max(t_sink)
    }
    
    /// Design reinforcement
    pub fn design_reinforcement(
        geometry: &CaissonGeometry,
        lateral_load: f64,
        _fc: f64,
        fy: f64,
    ) -> (f64, f64) {
        // Vertical reinforcement for flexure
        let moment = lateral_load * geometry.depth / 3.0;
        let d_eff = geometry.wall_thickness * 0.9;
        let area_per_m = geometry.outer_perimeter();
        
        let as_vert = moment / (0.87 * fy * d_eff) / area_per_m;
        let rho_vert = as_vert / (geometry.wall_thickness * 1.0);
        
        // Horizontal reinforcement (minimum)
        let rho_horiz = 0.002;
        
        (rho_vert.max(0.004), rho_horiz)
    }
    
    /// Design bottom plug
    pub fn design_plug_thickness(
        geometry: &CaissonGeometry,
        uplift_pressure: f64,
        fc: f64,
    ) -> f64 {
        // Plug acts as circular slab
        let radius = geometry.inner_dimension / 2.0;
        let m_max = uplift_pressure * radius.powi(2) / 8.0;
        
        // Required thickness for flexure
        let d = (6.0 * m_max / (0.138 * fc * 1000.0)).sqrt();
        
        d.max(1.5) // Minimum 1.5m
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_caisson_geometry() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        
        assert!((geom.wall_thickness - 1.5).abs() < 0.01);
        assert!(geom.gross_area() > geom.net_area());
        assert!(geom.concrete_volume() > 0.0);
    }

    #[test]
    fn test_rectangular_geometry() {
        let geom = CaissonGeometry::rectangular(6.0, 10.0, 1.0, 15.0);
        
        assert!((geom.wall_thickness - 1.0).abs() < 0.01);
        assert!(geom.outer_perimeter() > 0.0);
    }

    #[test]
    fn test_soil_layer() {
        let soil = SoilLayer::from_type(SoilType::Clay, 10.0, 5.0);
        
        assert!(soil.unit_weight > 0.0);
        assert!(soil.cohesion > 0.0);
        assert!(soil.alpha_factor() > 0.0);
    }

    #[test]
    fn test_bearing_capacity() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let soil = SoilLayer::from_type(SoilType::DenseSand, 30.0, 0.0);
        
        let capacity = BearingCapacity::calculate_terzaghi(&geom, &soil, 5.0);
        
        assert!(capacity.ultimate_base > 0.0);
        assert!(capacity.ultimate_shaft > 0.0);
        assert!(capacity.allowable > 0.0);
    }

    #[test]
    fn test_sinking_analysis() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let layers = vec![
            SoilLayer::from_type(SoilType::SoftCite, 5.0, 0.0),
            SoilLayer::from_type(SoilType::Sand, 15.0, 5.0),
        ];
        
        let sinking = SinkingAnalysis::calculate(&geom, &layers, 10.0, 2.0, 25.0);
        
        assert!(sinking.sinking_force > 0.0);
        assert!(sinking.skin_friction > 0.0);
    }

    #[test]
    fn test_drilled_shaft() {
        let shaft = DrilledShaft::new(1.5, 25.0, 35.0);
        let layers = vec![
            SoilLayer::from_type(SoilType::Clay, 10.0, 0.0),
            SoilLayer::from_type(SoilType::DenseSand, 20.0, 10.0),
        ];
        
        let capacity = shaft.total_capacity(&layers);
        assert!(capacity > 0.0);
    }

    #[test]
    fn test_drilled_shaft_with_bell() {
        let shaft = DrilledShaft::new(1.5, 25.0, 35.0).with_bell(3.0);
        
        assert!(shaft.bell_area() > shaft.shaft_area());
    }

    #[test]
    fn test_lateral_analysis() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let soil = SoilLayer::from_type(SoilType::Clay, 30.0, 0.0);
        
        let lateral = LateralAnalysis::calculate_broms(&geom, &soil, 500.0, 1000.0);
        
        assert!(lateral.factor_of_safety > 0.0);
        assert!(lateral.deflection >= 0.0);
    }

    #[test]
    fn test_settlement_analysis() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let layers = vec![
            SoilLayer::from_type(SoilType::Sand, 10.0, 0.0),
            SoilLayer::from_type(SoilType::Clay, 10.0, 20.0),
        ];
        
        let settlement = SettlementAnalysis::calculate(&geom, &layers, 10000.0);
        
        assert!(settlement.total > 0.0);
    }

    #[test]
    fn test_wall_thickness_design() {
        let thickness = StructuralDesign::design_wall_thickness(8.0, 20.0, 200.0, 30.0);
        
        assert!(thickness >= 0.45);
    }

    #[test]
    fn test_plug_design() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let plug_t = StructuralDesign::design_plug_thickness(&geom, 150.0, 30.0);
        
        assert!(plug_t >= 1.5);
    }

    #[test]
    fn test_reinforcement_design() {
        let geom = CaissonGeometry::circular(8.0, 5.0, 20.0);
        let (rho_v, rho_h) = StructuralDesign::design_reinforcement(&geom, 500.0, 30.0, 500.0);
        
        assert!(rho_v >= 0.004);
        assert!(rho_h >= 0.002);
    }

    #[test]
    fn test_construction_method_factor() {
        let dry = DrilledShaft {
            diameter: 1.5,
            length: 20.0,
            bell_diameter: None,
            fc: 35.0,
            rho_s: 0.01,
            construction_method: ConstructionMethod::Dry,
        };
        
        let slurry = DrilledShaft {
            diameter: 1.5,
            length: 20.0,
            bell_diameter: None,
            fc: 35.0,
            rho_s: 0.01,
            construction_method: ConstructionMethod::Slurry,
        };
        
        assert!(dry.construction_method_factor() > slurry.construction_method_factor());
    }
}
