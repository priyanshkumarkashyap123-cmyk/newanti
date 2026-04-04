//! Foundation Design Module
//! 
//! Comprehensive foundation design including spread footings, mat foundations,
//! pile foundations, and pile caps per ACI 318 and geotechnical standards.

use std::f64::consts::PI;

/// Soil type classification
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SoilType {
    Gravel,
    Sand,
    SiltySand,
    Clay,
    SiltyClay,
    Rock,
    OrganicSoil,
}

/// Foundation type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FoundationType {
    Isolated,
    Combined,
    Strip,
    Mat,
    Pile,
    Caisson,
}

/// Soil properties
#[derive(Debug, Clone)]
pub struct SoilProperties {
    pub soil_type: SoilType,
    pub bearing_capacity: f64,      // kPa - allowable
    pub unit_weight: f64,           // kN/m³
    pub friction_angle: f64,        // degrees
    pub cohesion: f64,              // kPa
    pub elastic_modulus: f64,       // MPa
    pub poisson_ratio: f64,
    pub subgrade_modulus: f64,      // kN/m³
    pub water_table_depth: f64,     // m below surface
}

impl SoilProperties {
    /// Create medium dense sand properties
    pub fn medium_sand() -> Self {
        SoilProperties {
            soil_type: SoilType::Sand,
            bearing_capacity: 200.0,
            unit_weight: 18.0,
            friction_angle: 32.0,
            cohesion: 0.0,
            elastic_modulus: 30.0,
            poisson_ratio: 0.3,
            subgrade_modulus: 25000.0,
            water_table_depth: 5.0,
        }
    }

    /// Create stiff clay properties
    pub fn stiff_clay() -> Self {
        SoilProperties {
            soil_type: SoilType::Clay,
            bearing_capacity: 150.0,
            unit_weight: 19.0,
            friction_angle: 0.0,
            cohesion: 75.0,
            elastic_modulus: 20.0,
            poisson_ratio: 0.4,
            subgrade_modulus: 15000.0,
            water_table_depth: 3.0,
        }
    }

    /// Create rock properties
    pub fn rock() -> Self {
        SoilProperties {
            soil_type: SoilType::Rock,
            bearing_capacity: 1000.0,
            unit_weight: 25.0,
            friction_angle: 45.0,
            cohesion: 500.0,
            elastic_modulus: 5000.0,
            poisson_ratio: 0.2,
            subgrade_modulus: 100000.0,
            water_table_depth: 10.0,
        }
    }
}

/// Spread footing design
#[derive(Debug, Clone)]
pub struct SpreadFooting {
    pub length: f64,            // m
    pub width: f64,             // m
    pub thickness: f64,         // m
    pub depth: f64,             // m - embedment depth
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub cover: f64,             // mm
    pub column_length: f64,     // m
    pub column_width: f64,      // m
    pub soil: SoilProperties,
}

/// Footing analysis results
#[derive(Debug, Clone)]
pub struct FootingAnalysis {
    pub bearing_pressure: f64,      // kPa
    pub bearing_ratio: f64,         // demand/capacity
    pub one_way_shear_ok: bool,
    pub two_way_shear_ok: bool,
    pub flexure_ok: bool,
    pub settlement: f64,            // mm
    pub reinforcement: FootingReinforcement,
}

/// Footing reinforcement
#[derive(Debug, Clone)]
pub struct FootingReinforcement {
    pub as_long: f64,           // mm²/m - longitudinal
    pub as_trans: f64,          // mm²/m - transverse
    pub bar_size_long: f64,     // mm
    pub bar_size_trans: f64,    // mm
    pub spacing_long: f64,      // mm
    pub spacing_trans: f64,     // mm
}

/// Punching shear results
#[derive(Debug, Clone)]
pub struct PunchingShear {
    pub vu: f64,                // kN - applied shear
    pub vc: f64,                // kN - concrete capacity
    pub bo: f64,                // m - critical perimeter
    pub d: f64,                 // m - effective depth
    pub ratio: f64,             // demand/capacity
    pub adequate: bool,
}

/// Mat foundation
#[derive(Debug, Clone)]
pub struct MatFoundation {
    pub length: f64,            // m
    pub width: f64,             // m
    pub thickness: f64,         // m
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub soil: SoilProperties,
    pub column_loads: Vec<ColumnLoad>,
}

/// Column load on mat
#[derive(Debug, Clone)]
pub struct ColumnLoad {
    pub x: f64,                 // m from origin
    pub y: f64,                 // m from origin
    pub axial: f64,             // kN
    pub moment_x: f64,          // kN·m
    pub moment_y: f64,          // kN·m
}

/// Mat analysis results
#[derive(Debug, Clone)]
pub struct MatAnalysis {
    pub max_pressure: f64,      // kPa
    pub min_pressure: f64,      // kPa
    pub uplift_area: f64,       // m² (if any)
    pub max_moment_x: f64,      // kN·m/m
    pub max_moment_y: f64,      // kN·m/m
    pub max_shear: f64,         // kN/m
    pub differential_settlement: f64, // mm
}

/// Pile foundation
#[derive(Debug, Clone)]
pub struct PileFoundation {
    pub pile_type: PileType,
    pub diameter: f64,          // m
    pub length: f64,            // m
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub soil_layers: Vec<SoilLayer>,
}

/// Pile types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PileType {
    Driven,
    Bored,
    CFA,         // Continuous flight auger
    Micropile,
    HelicalPile,
}

/// Soil layer for pile analysis
#[derive(Debug, Clone)]
pub struct SoilLayer {
    pub depth_top: f64,         // m
    pub depth_bottom: f64,      // m
    pub soil_type: SoilType,
    pub unit_weight: f64,       // kN/m³
    pub friction_angle: f64,    // degrees
    pub cohesion: f64,          // kPa
    pub spt_n: f64,             // SPT blow count
}

/// Pile capacity results
#[derive(Debug, Clone)]
pub struct PileCapacity {
    pub end_bearing: f64,       // kN
    pub skin_friction: f64,     // kN
    pub ultimate_capacity: f64, // kN
    pub allowable_capacity: f64,// kN (with FOS)
    pub settlement: f64,        // mm at working load
}

/// Pile cap design
#[derive(Debug, Clone)]
pub struct PileCap {
    pub length: f64,            // m
    pub width: f64,             // m
    pub thickness: f64,         // m
    pub num_piles: usize,
    pub pile_diameter: f64,     // m
    pub pile_spacing: f64,      // m
    pub pile_capacity: f64,     // kN per pile
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
}

/// Pile cap analysis
#[derive(Debug, Clone)]
pub struct PileCapAnalysis {
    pub max_pile_load: f64,     // kN
    pub min_pile_load: f64,     // kN
    pub pile_utilization: f64,  // ratio
    pub punching_ok: bool,
    pub flexure_ok: bool,
    pub strut_tie_ok: bool,
    pub reinforcement: PileCapReinforcement,
}

/// Pile cap reinforcement
#[derive(Debug, Clone)]
pub struct PileCapReinforcement {
    pub bottom_x: f64,          // mm²
    pub bottom_y: f64,          // mm²
    pub top_x: f64,             // mm²
    pub top_y: f64,             // mm²
}

impl SpreadFooting {
    /// Create new spread footing
    pub fn new(length: f64, width: f64, thickness: f64) -> Self {
        SpreadFooting {
            length,
            width,
            thickness,
            depth: 1.0,
            concrete_fc: 25.0,
            steel_fy: 420.0,
            cover: 75.0,
            column_length: 0.4,
            column_width: 0.4,
            soil: SoilProperties::medium_sand(),
        }
    }

    /// Set column dimensions
    pub fn with_column(&mut self, length: f64, width: f64) -> &mut Self {
        self.column_length = length;
        self.column_width = width;
        self
    }

    /// Set soil properties
    pub fn with_soil(&mut self, soil: SoilProperties) -> &mut Self {
        self.soil = soil;
        self
    }

    /// Analyze footing under loads
    pub fn analyze(&self, axial: f64, mx: f64, my: f64) -> FootingAnalysis {
        let area = self.length * self.width;
        
        // Guard: prevent division by zero for degenerate footings
        if area < 1e-10 || self.length < 1e-10 || self.width < 1e-10 {
            return FootingAnalysis {
                bearing_pressure: f64::INFINITY,
                bearing_ratio: f64::INFINITY,
                one_way_shear_ok: false,
                two_way_shear_ok: false,
                flexure_ok: false,
                settlement: 0.0,
                reinforcement: FootingReinforcement {
                    as_long: 0.0, as_trans: 0.0,
                    bar_size_long: 0.0, bar_size_trans: 0.0,
                    spacing_long: 0.0, spacing_trans: 0.0,
                },
            };
        }
        
        let sx = self.width * self.length.powi(2) / 6.0;
        let sy = self.length * self.width.powi(2) / 6.0;

        // Bearing pressure (trapezoidal distribution)
        let q_max = axial / area + mx.abs() / sx + my.abs() / sy;
        let _q_min = axial / area - mx.abs() / sx - my.abs() / sy;
        
        let bearing_ratio = q_max / self.soil.bearing_capacity;
        
        // Effective depth
        let d = self.thickness - self.cover / 1000.0 - 0.01; // m
        
        // One-way shear check (both directions) — ACI 22.5
        let crit_l = ((self.length - self.column_length) / 2.0 - d).max(0.0);
        let crit_w = ((self.width - self.column_width) / 2.0 - d).max(0.0);
        let vu_l = q_max * self.width * crit_l;
        let vu_w = q_max * self.length * crit_w;
        let vc_l = 0.17 * self.concrete_fc.sqrt() * 1000.0 * self.width * d;
        let vc_w = 0.17 * self.concrete_fc.sqrt() * 1000.0 * self.length * d;
        let one_way_ok = vu_l < 0.75 * vc_l && vu_w < 0.75 * vc_w;
        
        // Two-way (punching) shear
        let punching = self.punching_shear(axial, d);
        
        // Flexure
        let mu = q_max * self.width * ((self.length - self.column_length) / 2.0).powi(2) / 2.0;
        let rho_min = 0.0018;
        let _as_required = rho_min * self.width * 1000.0 * d * 1000.0; // mm²
        
        // Settlement
        let settlement = self.calculate_settlement(q_max);
        
        // Reinforcement design
        let reinforcement = self.design_reinforcement(mu, d);
        
        FootingAnalysis {
            bearing_pressure: q_max,
            bearing_ratio,
            one_way_shear_ok: one_way_ok,
            two_way_shear_ok: punching.adequate,
            flexure_ok: true, // Simplified
            settlement,
            reinforcement,
        }
    }

    /// Punching shear analysis
    pub fn punching_shear(&self, axial: f64, d: f64) -> PunchingShear {
        // Critical perimeter at d/2 from column face
        let b1 = self.column_length + d;
        let b2 = self.column_width + d;
        let bo = 2.0 * (b1 + b2);
        
        // Shear stress
        let vu = axial; // kN
        let _vu_stress = vu / (bo * d) / 1000.0; // MPa
        
        // Concrete capacity (ACI 318)
        let beta_c = self.column_length / self.column_width;
        let vc1 = 0.33 * self.concrete_fc.sqrt();
        let vc2 = (0.17 + 0.33 / beta_c) * self.concrete_fc.sqrt();
        let alpha_s = 40.0; // Interior column
        // ACI 318M Eq. 22.6.5.2(c): 0.083(αs·d/bo + 2)√f'c
        let vc3 = 0.083 * (alpha_s * d / bo + 2.0) * self.concrete_fc.sqrt();
        
        let vc = vc1.min(vc2).min(vc3);
        let vc_total = 0.75 * vc * bo * d * 1000.0; // kN
        
        PunchingShear {
            vu,
            vc: vc_total,
            bo,
            d,
            ratio: vu / vc_total,
            adequate: vu < vc_total,
        }
    }

    /// Calculate settlement
    fn calculate_settlement(&self, q: f64) -> f64 {
        // Immediate settlement using elastic theory
        let b = self.width.min(self.length);
        let l = self.width.max(self.length);
        let ratio = l / b;
        
        // Influence factor (Boussinesq/Schleicher) - increases with L/B ratio
        // Approximate values: L/B=1: 1.12, L/B=2: 1.53, L/B=5: 2.10
        let i_f = if ratio <= 1.0 {
            1.12
        } else if ratio <= 1.5 {
            1.12 + (1.36 - 1.12) * (ratio - 1.0) / 0.5
        } else if ratio <= 2.0 {
            1.36 + (1.53 - 1.36) * (ratio - 1.5) / 0.5
        } else if ratio <= 3.0 {
            1.53 + (1.78 - 1.53) * (ratio - 2.0) / 1.0
        } else if ratio <= 5.0 {
            1.78 + (2.10 - 1.78) * (ratio - 3.0) / 2.0
        } else {
            2.10 + 0.1 * (ratio - 5.0).min(5.0)
        };
        
        // Settlement (mm)
        let es = self.soil.elastic_modulus * 1000.0; // kPa
        let nu = self.soil.poisson_ratio;
        
        q * b * (1.0 - nu.powi(2)) * i_f / es * 1000.0
    }

    /// Design reinforcement
    fn design_reinforcement(&self, mu: f64, d: f64) -> FootingReinforcement {
        // Moment in kN·m, d in m
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        
        // Required steel area
        let phi = 0.9;
        let b = self.width * 1000.0; // mm
        let d_mm = d * 1000.0;
        
        let rn = mu * 1e6 / (phi * b * d_mm.powi(2));
        let rho = 0.85 * fc / fy * (1.0 - (1.0 - 2.0 * rn / (0.85 * fc)).max(0.0).sqrt());
        let rho = rho.max(0.0018); // Minimum
        
        let as_req = rho * b * d_mm;
        
        // Select bars
        let bar_dia: f64 = 16.0; // mm
        let bar_area = PI * (bar_dia / 2.0).powi(2);
        let spacing = (bar_area / as_req * 1000.0).min(300.0);
        
        FootingReinforcement {
            as_long: as_req,
            as_trans: as_req,
            bar_size_long: bar_dia,
            bar_size_trans: bar_dia,
            spacing_long: spacing,
            spacing_trans: spacing,
        }
    }

    /// Size footing for given loads
    pub fn size_footing(axial: f64, mx: f64, my: f64, soil: &SoilProperties) -> Self {
        // Initial estimate
        let area_required = axial / soil.bearing_capacity * 1.5; // 50% oversize for moments
        let b = area_required.sqrt();
        
        let mut footing = SpreadFooting::new(b, b, 0.4);
        footing.soil = soil.clone();
        
        // Iterate to find adequate size
        for _ in 0..10 {
            let analysis = footing.analyze(axial, mx, my);
            
            if analysis.bearing_ratio <= 1.0 && analysis.two_way_shear_ok {
                break;
            }
            
            if analysis.bearing_ratio > 1.0 {
                footing.length *= 1.1;
                footing.width *= 1.1;
            }
            
            if !analysis.two_way_shear_ok {
                footing.thickness += 0.05;
            }
        }
        
        footing
    }
}

impl MatFoundation {
    /// Create mat foundation
    pub fn new(length: f64, width: f64, thickness: f64) -> Self {
        MatFoundation {
            length,
            width,
            thickness,
            concrete_fc: 30.0,
            steel_fy: 420.0,
            soil: SoilProperties::medium_sand(),
            column_loads: Vec::new(),
        }
    }

    /// Add column load
    pub fn add_column(&mut self, x: f64, y: f64, axial: f64, mx: f64, my: f64) {
        self.column_loads.push(ColumnLoad {
            x, y, axial, moment_x: mx, moment_y: my,
        });
    }

    /// Analyze mat foundation
    pub fn analyze(&self) -> MatAnalysis {
        let area = self.length * self.width;
        let ix = self.width * self.length.powi(3) / 12.0;
        let iy = self.length * self.width.powi(3) / 12.0;
        
        // Total loads
        let total_p: f64 = self.column_loads.iter().map(|c| c.axial).sum();
        let total_mx: f64 = self.column_loads.iter()
            .map(|c| c.moment_x + c.axial * (c.y - self.width / 2.0))
            .sum();
        let total_my: f64 = self.column_loads.iter()
            .map(|c| c.moment_y + c.axial * (c.x - self.length / 2.0))
            .sum();
        
        // Pressure at corners
        let _ex = total_my / total_p;
        let _ey = total_mx / total_p;
        
        let q_avg = total_p / area;
        let q_mx = total_mx * (self.width / 2.0) / iy;
        let q_my = total_my * (self.length / 2.0) / ix;
        
        let q_max = q_avg + q_mx.abs() + q_my.abs();
        let q_min = q_avg - q_mx.abs() - q_my.abs();
        
        // Uplift area
        let uplift = if q_min < 0.0 {
            let ratio = q_min.abs() / (q_max - q_min);
            area * ratio
        } else {
            0.0
        };
        
        // Approximate moments using beam strip method
        let strip_width = 1.0; // 1m strip
        let max_span = self.column_loads.windows(2)
            .map(|w| ((w[1].x - w[0].x).powi(2) + (w[1].y - w[0].y).powi(2)).sqrt())
            .fold(0.0_f64, |a, b| a.max(b))
            .max(3.0);
        
        let max_moment = q_max * strip_width * max_span.powi(2) / 8.0;
        
        // Differential settlement
        let avg_pressure = (q_max + q_min.max(0.0)) / 2.0;
        // Elastic settlement: delta = q * B * (1 - nu^2) * I_w / Es
        // Use width (shorter dimension) as characteristic dimension B
        let b_char = self.width.min(self.length);
        let nu = self.soil.poisson_ratio;
        let l_over_b = self.length.max(self.width) / b_char;
        // Shape influence factor (Schleicher) for flexible foundation
        let i_w = if l_over_b <= 1.0 { 1.12 }
                  else if l_over_b <= 2.0 { 1.12 + (1.53 - 1.12) * (l_over_b - 1.0) }
                  else if l_over_b <= 5.0 { 1.53 + (2.10 - 1.53) * (l_over_b - 2.0) / 3.0 }
                  else { 2.10 };
        let settlement = avg_pressure * b_char * (1.0 - nu.powi(2)) * i_w /
                        (self.soil.elastic_modulus * 1000.0) * 1000.0; // mm
        let diff_settlement = settlement * 0.5; // Approximate
        
        MatAnalysis {
            max_pressure: q_max,
            min_pressure: q_min,
            uplift_area: uplift,
            max_moment_x: max_moment,
            max_moment_y: max_moment,
            max_shear: q_max * max_span / 2.0,
            differential_settlement: diff_settlement,
        }
    }

    /// Calculate required thickness
    pub fn required_thickness(&self) -> f64 {
        let _analysis = self.analyze();
        
        // Punching shear governs
        let max_column_load = self.column_loads.iter()
            .map(|c| c.axial)
            .fold(0.0_f64, |a, b| a.max(b));
        
        // Assume 400mm column
        let col_size = 0.4;
        let vc = 0.33 * self.concrete_fc.sqrt() * 1000.0; // kPa
        
        // d = P / (vc * bo) approximately
        // bo ≈ 4 * (col_size + d)
        // Iterate
        let mut d = 0.3;
        for _ in 0..10 {
            let bo = 4.0 * (col_size + d);
            let d_new = max_column_load / (0.75 * vc * bo);
            if (d_new - d).abs() < 0.01 {
                break;
            }
            d = (d + d_new) / 2.0;
        }
        
        (d + 0.1).max(0.4) // Add cover, minimum 400mm
    }
}

impl PileFoundation {
    /// Create bored pile
    pub fn bored_pile(diameter: f64, length: f64) -> Self {
        PileFoundation {
            pile_type: PileType::Bored,
            diameter,
            length,
            concrete_fc: 30.0,
            steel_fy: 420.0,
            soil_layers: Vec::new(),
        }
    }

    /// Create driven pile
    pub fn driven_pile(diameter: f64, length: f64) -> Self {
        PileFoundation {
            pile_type: PileType::Driven,
            diameter,
            length,
            concrete_fc: 40.0,
            steel_fy: 420.0,
            soil_layers: Vec::new(),
        }
    }

    /// Add soil layer
    pub fn add_soil_layer(&mut self, layer: SoilLayer) {
        self.soil_layers.push(layer);
    }

    /// Calculate pile capacity
    pub fn capacity(&self) -> PileCapacity {
        let pile_area = PI * (self.diameter / 2.0).powi(2);
        let pile_perimeter = PI * self.diameter;
        
        let mut end_bearing = 0.0;
        let mut skin_friction = 0.0;
        
        // Get bearing layer (at pile tip)
        if let Some(tip_layer) = self.soil_layers.iter()
            .find(|l| l.depth_bottom >= self.length) 
        {
            end_bearing = self.calculate_end_bearing(tip_layer, pile_area);
        }
        
        // Sum skin friction through all layers
        for layer in &self.soil_layers {
            let depth_in_layer = (layer.depth_bottom.min(self.length) - 
                                 layer.depth_top.max(0.0)).max(0.0);
            if depth_in_layer > 0.0 {
                skin_friction += self.calculate_skin_friction(
                    layer, 
                    pile_perimeter, 
                    depth_in_layer
                );
            }
        }
        
        let ultimate = end_bearing + skin_friction;
        let fos = match self.pile_type {
            PileType::Driven => 2.5,
            PileType::Bored => 3.0,
            _ => 2.5,
        };
        
        let allowable = ultimate / fos;
        let settlement = self.estimate_settlement(allowable);
        
        PileCapacity {
            end_bearing,
            skin_friction,
            ultimate_capacity: ultimate,
            allowable_capacity: allowable,
            settlement,
        }
    }

    /// Calculate end bearing
    fn calculate_end_bearing(&self, layer: &SoilLayer, area: f64) -> f64 {
        match layer.soil_type {
            SoilType::Sand | SoilType::Gravel | SoilType::SiltySand => {
                // Meyerhof method for cohesionless soils
                // Nq = tan²(45 + phi/2) * e^(pi * tan(phi))
                let nq = ((45.0 + layer.friction_angle / 2.0).to_radians().tan()).powi(2) *
                        (PI * layer.friction_angle.to_radians().tan()).exp();
                let sigma_v = layer.unit_weight * self.length;
                let qb = sigma_v * nq;
                // SPT-based cap: differentiate by pile type
                let spt_cap = match self.pile_type {
                    PileType::Driven => layer.spt_n * 400.0, // Meyerhof for driven
                    PileType::Bored => layer.spt_n * 120.0,  // IS 2911 Part 1/Sec 2 for bored
                    _ => layer.spt_n * 250.0,                // Intermediate for other types
                };
                qb.min(spt_cap) * area
            }
            SoilType::Clay | SoilType::SiltyClay => {
                // Undrained bearing capacity
                let nc = 9.0;
                let qb = nc * layer.cohesion;
                qb * area
            }
            SoilType::Rock => {
                // Rock socket
                let qu = 2.0 * layer.cohesion; // Approximate UCS
                (0.3 * qu).min(5000.0) * area
            }
            _ => 0.0,
        }
    }

    /// Calculate skin friction
    fn calculate_skin_friction(&self, layer: &SoilLayer, perimeter: f64, length: f64) -> f64 {
        let mid_depth = (layer.depth_top + layer.depth_bottom.min(self.length)) / 2.0;
        
        match layer.soil_type {
            SoilType::Sand | SoilType::Gravel | SoilType::SiltySand => {
                // Beta method
                // K depends on pile installation: driven piles increase lateral pressure
                let ko_at_rest = 1.0 - layer.friction_angle.to_radians().sin(); // Jaky's K0
                let k = match self.pile_type {
                    PileType::Driven => (1.0_f64).max(1.5 * ko_at_rest), // Driven: K = 1.0 to 2.0
                    PileType::Bored => 0.9 * ko_at_rest,                 // Bored: slightly less than K0
                    _ => ko_at_rest,                                      // Default: at-rest
                };
                let beta = k * layer.friction_angle.to_radians().tan();
                let sigma_v = layer.unit_weight * mid_depth;
                let fs = beta * sigma_v;
                
                let fs_limit = match self.pile_type {
                    PileType::Driven => layer.spt_n * 2.0,
                    PileType::Bored => layer.spt_n * 1.0,
                    _ => layer.spt_n * 1.5,
                };
                
                fs.min(fs_limit) * perimeter * length
            }
            SoilType::Clay | SoilType::SiltyClay => {
                // Alpha method
                let alpha = if layer.cohesion > 100.0 { 0.45 } 
                           else if layer.cohesion > 50.0 { 0.6 }
                           else { 0.8 };
                let fs = alpha * layer.cohesion;
                fs * perimeter * length
            }
            _ => 0.0,
        }
    }

    /// Estimate settlement
    fn estimate_settlement(&self, load: f64) -> f64 {
        // Simplified elastic settlement
        let pile_area = PI * (self.diameter / 2.0).powi(2);
        let e_pile = 30000.0; // MPa for concrete
        
        // Elastic shortening
        let delta_e = load / (pile_area * e_pile * 1000.0) * self.length * 1000.0;
        
        // Base settlement (approximate)
        let delta_b = load / (self.diameter * 50.0 * 1000.0) * 25.0;
        
        delta_e + delta_b
    }

    /// Lateral capacity (Broms method)
    pub fn lateral_capacity(&self, free_head: bool) -> f64 {
        let d = self.diameter;
        
        // Get average soil properties
        let clay_layers: Vec<&SoilLayer> = self.soil_layers.iter()
            .filter(|l| l.soil_type == SoilType::Clay || l.soil_type == SoilType::SiltyClay)
            .collect();
        let avg_cu: f64 = clay_layers.iter()
            .map(|l| l.cohesion)
            .sum::<f64>() / clay_layers.len().max(1) as f64;
        
        if avg_cu > 0.0 {
            // Short pile in clay (Broms method)
            let l = self.length;
            // Free-head: lower capacity due to no rotational restraint
            // Fixed-head: higher capacity (1.5-2x free-head)
            let e = if free_head { 0.5 * d } else { 0.0 };
            
            let hu = 9.0 * avg_cu * d * (l - 1.5 * d);
            // For free-head, reduce by eccentricity effect
            // For fixed-head, use full capacity
            hu / (1.0 + 1.5 * e / l)
        } else {
            // Cohesionless - simplified
            let kp = self.soil_layers.first()
                .map(|l| (45.0 + l.friction_angle / 2.0).to_radians().tan().powi(2))
                .unwrap_or(3.0);
            let gamma = 18.0; // kN/m³ assumed
            
            let hu = 0.5 * kp * gamma * d * self.length.powi(2);
            if free_head { hu } else { 2.0 * hu }
        }
    }
}

impl PileCap {
    /// Create pile cap
    pub fn new(num_piles: usize, pile_diameter: f64, pile_spacing: f64) -> Self {
        let (length, width) = Self::calculate_dimensions(num_piles, pile_diameter, pile_spacing);
        
        PileCap {
            length,
            width,
            thickness: 0.8,
            num_piles,
            pile_diameter,
            pile_spacing,
            pile_capacity: 500.0,
            concrete_fc: 30.0,
            steel_fy: 420.0,
        }
    }

    /// Calculate cap dimensions for pile arrangement
    fn calculate_dimensions(num_piles: usize, dia: f64, spacing: f64) -> (f64, f64) {
        let edge = dia / 2.0 + 0.15; // Edge distance
        
        match num_piles {
            1 => (dia + 0.6, dia + 0.6),
            2 => (spacing + 2.0 * edge, dia + 0.6),
            3 => (spacing + 2.0 * edge, spacing * 0.866 + 2.0 * edge),
            4 => (spacing + 2.0 * edge, spacing + 2.0 * edge),
            5 => (spacing + 2.0 * edge, spacing + 2.0 * edge), // 4 + 1 center
            6 => (2.0 * spacing + 2.0 * edge, spacing + 2.0 * edge),
            _ => {
                let rows = ((num_piles as f64).sqrt()).ceil() as usize;
                let cols = (num_piles + rows - 1) / rows;
                ((cols - 1) as f64 * spacing + 2.0 * edge,
                 (rows - 1) as f64 * spacing + 2.0 * edge)
            }
        }
    }

    /// Analyze pile cap
    pub fn analyze(&self, axial: f64, mx: f64, my: f64) -> PileCapAnalysis {
        // Pile reactions
        let n = self.num_piles as f64;
        let avg_load = axial / n;
        
        // Moment distribution to piles
        let sum_x2: f64 = (0..self.num_piles).map(|i| {
            let x = self.pile_x_coord(i) - self.length / 2.0;
            x.powi(2)
        }).sum();
        
        let sum_y2: f64 = (0..self.num_piles).map(|i| {
            let y = self.pile_y_coord(i) - self.width / 2.0;
            y.powi(2)
        }).sum();
        
        let mut max_load = 0.0_f64;
        let mut min_load = f64::MAX;
        
        for i in 0..self.num_piles {
            let x = self.pile_x_coord(i) - self.length / 2.0;
            let y = self.pile_y_coord(i) - self.width / 2.0;
            
            let p_moment = my * x / sum_x2.max(0.01) + mx * y / sum_y2.max(0.01);
            let p_total = avg_load + p_moment;
            
            max_load = max_load.max(p_total);
            min_load = min_load.min(p_total);
        }
        
        let utilization = if self.pile_capacity > 1e-10 {
            max_load / self.pile_capacity
        } else {
            f64::INFINITY
        };
        
        // Punching shear check
        let d = self.thickness - 0.1; // Effective depth
        let bo = PI * (self.pile_diameter + d);
        let vc = 0.33 * self.concrete_fc.sqrt() * 1000.0 * bo * d;
        let punching_ok = max_load < 0.75 * vc;
        
        // Flexural design (beam theory)
        let cantilever = (self.length - self.pile_spacing) / 2.0 - 0.2;
        let mu = max_load * cantilever.max(0.0);
        
        let d_mm = d * 1000.0;
        let b = self.width * 1000.0;
        let rho = 0.85 * self.concrete_fc / self.steel_fy * 
                  (1.0 - (1.0 - 2.0 * mu * 1e6 / (0.9 * 0.85 * self.concrete_fc * b * d_mm.powi(2))).sqrt().max(0.0));
        let rho = rho.max(0.002).min(0.025);
        
        let as_req = rho * b * d_mm;
        
        PileCapAnalysis {
            max_pile_load: max_load,
            min_pile_load: min_load,
            pile_utilization: utilization,
            punching_ok,
            flexure_ok: true,
            strut_tie_ok: true,
            reinforcement: PileCapReinforcement {
                bottom_x: as_req,
                bottom_y: as_req,
                top_x: as_req * 0.3,
                top_y: as_req * 0.3,
            },
        }
    }

    /// Get pile X coordinate
    fn pile_x_coord(&self, index: usize) -> f64 {
        let edge = self.pile_diameter / 2.0 + 0.15;
        match self.num_piles {
            1 => self.length / 2.0,
            2 => edge + index as f64 * self.pile_spacing,
            3 => {
                if index < 2 {
                    edge + index as f64 * self.pile_spacing
                } else {
                    edge + self.pile_spacing / 2.0 // Apex pile centered
                }
            }
            4 | 5 | 6 => {
                let cols = if self.num_piles <= 4 { 2 } else { 3 };
                edge + (index % cols) as f64 * self.pile_spacing
            }
            _ => edge + (index % 3) as f64 * self.pile_spacing,
        }
    }

    /// Get pile Y coordinate
    fn pile_y_coord(&self, index: usize) -> f64 {
        let edge = self.pile_diameter / 2.0 + 0.15;
        match self.num_piles {
            1 | 2 => self.width / 2.0,
            3 => edge + (index / 2) as f64 * self.pile_spacing * 0.866,
            4 | 5 | 6 => edge + (index / 2) as f64 * self.pile_spacing,
            _ => edge + (index / 3) as f64 * self.pile_spacing,
        }
    }
}

/// Combined footing design
#[derive(Debug, Clone)]
pub struct CombinedFooting {
    pub length: f64,
    pub width: f64,
    pub thickness: f64,
    pub columns: Vec<(f64, f64, f64)>, // (x position, axial, moment)
    pub soil: SoilProperties,
}

impl CombinedFooting {
    /// Design combined footing for two columns
    pub fn for_two_columns(
        p1: f64, p2: f64,
        spacing: f64,
        soil: &SoilProperties,
    ) -> Self {
        let total_load = p1 + p2;
        let centroid = p2 * spacing / total_load;
        
        // Length to have uniform pressure
        let length = 2.0 * centroid + 0.5; // Add for edge
        let area_required = total_load / soil.bearing_capacity;
        let width = area_required / length;
        
        CombinedFooting {
            length: length.max(spacing + 1.0),
            width: width.max(1.0),
            thickness: 0.5,
            columns: vec![
                (0.25, p1, 0.0),
                (spacing + 0.25, p2, 0.0),
            ],
            soil: soil.clone(),
        }
    }

    /// Check bearing pressure
    pub fn bearing_check(&self) -> (f64, bool) {
        let total_load: f64 = self.columns.iter().map(|c| c.1).sum();
        let area = self.length * self.width;
        let pressure = total_load / area;
        
        (pressure, pressure <= self.soil.bearing_capacity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spread_footing_creation() {
        let footing = SpreadFooting::new(2.0, 2.0, 0.5);
        assert_eq!(footing.length, 2.0);
        assert_eq!(footing.width, 2.0);
    }

    #[test]
    fn test_footing_analysis() {
        let footing = SpreadFooting::new(2.5, 2.5, 0.6);
        let analysis = footing.analyze(1000.0, 50.0, 50.0);
        
        assert!(analysis.bearing_pressure > 0.0);
        assert!(analysis.bearing_ratio < 2.0);
    }

    #[test]
    fn test_punching_shear() {
        let footing = SpreadFooting::new(2.5, 2.5, 0.6);
        let punching = footing.punching_shear(800.0, 0.5);
        
        assert!(punching.vu > 0.0);
        assert!(punching.vc > 0.0);
        assert!(punching.bo > 0.0);
    }

    #[test]
    fn test_footing_sizing() {
        let soil = SoilProperties::medium_sand();
        let footing = SpreadFooting::size_footing(1500.0, 100.0, 100.0, &soil);
        
        assert!(footing.length > 2.0);
        assert!(footing.width > 2.0);
    }

    #[test]
    fn test_mat_foundation() {
        let mut mat = MatFoundation::new(20.0, 15.0, 0.8);
        mat.add_column(5.0, 5.0, 2000.0, 100.0, 50.0);
        mat.add_column(15.0, 5.0, 2500.0, 150.0, 75.0);
        mat.add_column(5.0, 10.0, 1800.0, 80.0, 40.0);
        mat.add_column(15.0, 10.0, 2200.0, 120.0, 60.0);
        
        let analysis = mat.analyze();
        assert!(analysis.max_pressure > 0.0);
    }

    #[test]
    fn test_mat_thickness() {
        let mut mat = MatFoundation::new(20.0, 15.0, 0.8);
        mat.add_column(5.0, 5.0, 3000.0, 0.0, 0.0);
        
        let thickness = mat.required_thickness();
        assert!(thickness >= 0.4);
    }

    #[test]
    fn test_bored_pile() {
        let mut pile = PileFoundation::bored_pile(0.6, 15.0);
        pile.add_soil_layer(SoilLayer {
            depth_top: 0.0,
            depth_bottom: 10.0,
            soil_type: SoilType::Clay,
            unit_weight: 18.0,
            friction_angle: 0.0,
            cohesion: 50.0,
            spt_n: 10.0,
        });
        pile.add_soil_layer(SoilLayer {
            depth_top: 10.0,
            depth_bottom: 20.0,
            soil_type: SoilType::Sand,
            unit_weight: 19.0,
            friction_angle: 35.0,
            cohesion: 0.0,
            spt_n: 30.0,
        });
        
        let capacity = pile.capacity();
        assert!(capacity.ultimate_capacity > 0.0);
        assert!(capacity.allowable_capacity > 0.0);
        assert!(capacity.end_bearing > 0.0);
        assert!(capacity.skin_friction > 0.0);
    }

    #[test]
    fn test_driven_pile() {
        let pile = PileFoundation::driven_pile(0.4, 12.0);
        assert_eq!(pile.pile_type, PileType::Driven);
    }

    #[test]
    fn test_lateral_capacity() {
        let mut pile = PileFoundation::bored_pile(0.6, 12.0);
        pile.add_soil_layer(SoilLayer {
            depth_top: 0.0,
            depth_bottom: 15.0,
            soil_type: SoilType::Clay,
            unit_weight: 18.0,
            friction_angle: 0.0,
            cohesion: 60.0,
            spt_n: 12.0,
        });
        
        let lateral = pile.lateral_capacity(true);
        assert!(lateral > 0.0);
    }

    #[test]
    fn test_pile_cap() {
        let cap = PileCap::new(4, 0.6, 1.8);
        
        assert!(cap.length > 2.0);
        assert!(cap.width > 2.0);
    }

    #[test]
    fn test_pile_cap_analysis() {
        let cap = PileCap::new(4, 0.6, 1.8);
        let analysis = cap.analyze(2000.0, 100.0, 100.0);
        
        assert!(analysis.max_pile_load > 0.0);
        assert!(analysis.pile_utilization > 0.0);
    }

    #[test]
    fn test_combined_footing() {
        let soil = SoilProperties::medium_sand();
        let footing = CombinedFooting::for_two_columns(800.0, 1200.0, 3.0, &soil);
        
        let (pressure, ok) = footing.bearing_check();
        assert!(pressure > 0.0);
        assert!(ok);
    }

    #[test]
    fn test_soil_properties() {
        let sand = SoilProperties::medium_sand();
        let clay = SoilProperties::stiff_clay();
        let rock = SoilProperties::rock();
        
        assert!(rock.bearing_capacity > sand.bearing_capacity);
        assert!(sand.bearing_capacity > clay.bearing_capacity);
    }
}
