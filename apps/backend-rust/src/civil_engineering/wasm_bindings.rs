//! # WebAssembly Bindings for Civil Engineering Module
//! 
//! WASM bindings to expose Rust civil engineering calculations to JavaScript/TypeScript.
//! Uses wasm-bindgen for seamless interoperability.
//! 
//! This module provides simplified wrappers around the core civil engineering calculations
//! designed for easy consumption from JavaScript.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use nalgebra::{DMatrix, DVector};
use std::collections::HashMap;
use std::f64::consts::PI;

use crate::civil_engineering::{
    core::*,
    geotechnical::{FoundationInput, FoundationShape, SoilProperties, SoilLayer, Drainage},
    hydraulics::*,
    transportation::*,
    surveying::*,
};

// ============================================================================
// SIMPLIFIED STRUCTURAL TYPES FOR WASM
// ============================================================================

/// Simple 2D node for WASM
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SimpleNode2D {
    x: f64,
    y: f64,
}

/// Simple support enum for WASM
#[derive(Debug, Clone, Copy)]
enum SimpleSupport {
    Free,
    Pinned,   // x, y fixed
    Roller,   // y fixed only
    Fixed,    // x, y, rotation fixed
}

/// Simple member for WASM
#[derive(Debug, Clone)]
struct SimpleMember2D {
    start_node: usize,
    end_node: usize,
    e: f64,
    a: f64,
    i: f64,
}

/// Simple nodal load for WASM
#[derive(Debug, Clone)]
struct SimpleNodalLoad {
    fx: f64,
    fy: f64,
    mz: f64,
}

/// Frame2D Analysis Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleAnalysisResult {
    pub displacements: Vec<f64>,
    pub reactions: Vec<f64>,
    pub member_forces: Vec<Vec<f64>>,
    pub success: bool,
}

// ============================================================================
// FRAME ANALYSIS WASM WRAPPER
// ============================================================================

/// Simple 2D Frame Analysis for WASM
#[wasm_bindgen]
pub struct WasmFrame2D {
    nodes: Vec<SimpleNode2D>,
    members: Vec<SimpleMember2D>,
    supports: HashMap<usize, SimpleSupport>,
    nodal_loads: HashMap<usize, SimpleNodalLoad>,
}

#[wasm_bindgen]
impl WasmFrame2D {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmFrame2D {
        WasmFrame2D {
            nodes: Vec::new(),
            members: Vec::new(),
            supports: HashMap::new(),
            nodal_loads: HashMap::new(),
        }
    }
    
    /// Add a node and return its index
    #[wasm_bindgen]
    pub fn add_node(&mut self, x: f64, y: f64) -> usize {
        let idx = self.nodes.len();
        self.nodes.push(SimpleNode2D { x, y });
        idx
    }
    
    /// Add support at node
    /// support_type: 0=Free, 1=Pinned, 2=Roller, 3=Fixed
    #[wasm_bindgen]
    pub fn add_support(&mut self, node_idx: usize, support_type: u8) {
        let support = match support_type {
            0 => SimpleSupport::Free,
            1 => SimpleSupport::Pinned,
            2 => SimpleSupport::Roller,
            _ => SimpleSupport::Fixed,
        };
        self.supports.insert(node_idx, support);
    }
    
    /// Add member and return its index
    #[wasm_bindgen]
    pub fn add_member(&mut self, start_node: usize, end_node: usize, e: f64, a: f64, i: f64) -> usize {
        let idx = self.members.len();
        self.members.push(SimpleMember2D {
            start_node,
            end_node,
            e,
            a,
            i,
        });
        idx
    }
    
    /// Add nodal load
    #[wasm_bindgen]
    pub fn add_nodal_load(&mut self, node_idx: usize, fx: f64, fy: f64, mz: f64) {
        self.nodal_loads.insert(node_idx, SimpleNodalLoad { fx, fy, mz });
    }
    
    /// Run analysis and return results as JSON
    #[wasm_bindgen]
    pub fn analyze(&self) -> String {
        let result = self.solve_frame();
        serde_json::to_string(&result).unwrap_or_else(|_| r#"{"success": false}"#.to_string())
    }
    
    fn solve_frame(&self) -> SimpleAnalysisResult {
        let n_nodes = self.nodes.len();
        let n_dof = n_nodes * 3; // 3 DOF per node (dx, dy, rotation)
        
        // Initialize global stiffness matrix and force vector
        let mut k_global = DMatrix::<f64>::zeros(n_dof, n_dof);
        let mut f_global = DVector::<f64>::zeros(n_dof);
        
        // Assemble global stiffness matrix
        for member in &self.members {
            let node_i = &self.nodes[member.start_node];
            let node_j = &self.nodes[member.end_node];
            
            let dx = node_j.x - node_i.x;
            let dy = node_j.y - node_i.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;
            
            // Element stiffness in local coordinates
            let k_local = self.beam_element_stiffness(member.e, member.a, member.i, l);
            
            // Transformation matrix
            let t = self.transformation_matrix(c, s);
            
            // Transform to global: K_global = T' * K_local * T
            let k_elem = t.transpose() * &k_local * &t;
            
            // Assembly
            let dofs: [usize; 6] = [
                member.start_node * 3,
                member.start_node * 3 + 1,
                member.start_node * 3 + 2,
                member.end_node * 3,
                member.end_node * 3 + 1,
                member.end_node * 3 + 2,
            ];
            
            for (i, &di) in dofs.iter().enumerate() {
                for (j, &dj) in dofs.iter().enumerate() {
                    k_global[(di, dj)] += k_elem[(i, j)];
                }
            }
        }
        
        // Apply nodal loads
        for (node_idx, load) in &self.nodal_loads {
            let base = node_idx * 3;
            f_global[base] += load.fx;
            f_global[base + 1] += load.fy;
            f_global[base + 2] += load.mz;
        }
        
        // Apply boundary conditions using penalty method
        let penalty = 1e15_f64;
        for (node_idx, support) in &self.supports {
            let base = node_idx * 3;
            match support {
                SimpleSupport::Free => {}
                SimpleSupport::Roller => {
                    k_global[(base + 1, base + 1)] += penalty;
                }
                SimpleSupport::Pinned => {
                    k_global[(base, base)] += penalty;
                    k_global[(base + 1, base + 1)] += penalty;
                }
                SimpleSupport::Fixed => {
                    k_global[(base, base)] += penalty;
                    k_global[(base + 1, base + 1)] += penalty;
                    k_global[(base + 2, base + 2)] += penalty;
                }
            }
        }
        
        // Solve K * u = F
        let decomp = k_global.lu();
        let displacements: Vec<f64> = match decomp.solve(&f_global) {
            Some(u) => u.iter().cloned().collect(),
            None => {
                return SimpleAnalysisResult {
                    displacements: vec![],
                    reactions: vec![],
                    member_forces: vec![],
                    success: false,
                };
            }
        };
        
        // Calculate reactions
        let mut reactions = vec![0.0_f64; n_dof];
        for (node_idx, support) in &self.supports {
            let base = node_idx * 3;
            match support {
                SimpleSupport::Free => {}
                SimpleSupport::Roller => {
                    reactions[base + 1] = penalty * displacements[base + 1];
                }
                SimpleSupport::Pinned => {
                    reactions[base] = penalty * displacements[base];
                    reactions[base + 1] = penalty * displacements[base + 1];
                }
                SimpleSupport::Fixed => {
                    reactions[base] = penalty * displacements[base];
                    reactions[base + 1] = penalty * displacements[base + 1];
                    reactions[base + 2] = penalty * displacements[base + 2];
                }
            }
        }
        
        // Calculate member forces
        let member_forces = self.calculate_member_forces(&displacements);
        
        SimpleAnalysisResult {
            displacements,
            reactions,
            member_forces,
            success: true,
        }
    }
    
    fn beam_element_stiffness(&self, e: f64, a: f64, i: f64, l: f64) -> DMatrix<f64> {
        let l2 = l * l;
        let l3 = l2 * l;
        let ea_l = e * a / l;
        let ei_l3 = e * i / l3;
        
        DMatrix::from_row_slice(6, 6, &[
            ea_l,     0.0,           0.0,        -ea_l,    0.0,           0.0,
            0.0,      12.0*ei_l3,    6.0*ei_l3*l, 0.0,     -12.0*ei_l3,   6.0*ei_l3*l,
            0.0,      6.0*ei_l3*l,   4.0*e*i/l,   0.0,     -6.0*ei_l3*l,  2.0*e*i/l,
            -ea_l,    0.0,           0.0,         ea_l,    0.0,           0.0,
            0.0,      -12.0*ei_l3,  -6.0*ei_l3*l, 0.0,      12.0*ei_l3,  -6.0*ei_l3*l,
            0.0,      6.0*ei_l3*l,   2.0*e*i/l,   0.0,     -6.0*ei_l3*l,  4.0*e*i/l,
        ])
    }
    
    fn transformation_matrix(&self, c: f64, s: f64) -> DMatrix<f64> {
        DMatrix::from_row_slice(6, 6, &[
            c,  s,  0.0, 0.0, 0.0, 0.0,
            -s, c,  0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, c,   s,  0.0,
            0.0, 0.0, 0.0, -s,  c,  0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ])
    }
    
    fn calculate_member_forces(&self, displacements: &[f64]) -> Vec<Vec<f64>> {
        let mut forces = Vec::new();
        
        for member in &self.members {
            let node_i = &self.nodes[member.start_node];
            let node_j = &self.nodes[member.end_node];
            
            let dx = node_j.x - node_i.x;
            let dy = node_j.y - node_i.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;
            
            // Get element displacements
            let u_elem = vec![
                displacements[member.start_node * 3],
                displacements[member.start_node * 3 + 1],
                displacements[member.start_node * 3 + 2],
                displacements[member.end_node * 3],
                displacements[member.end_node * 3 + 1],
                displacements[member.end_node * 3 + 2],
            ];
            
            // Transform to local coordinates
            let t = self.transformation_matrix(c, s);
            let u_local = &t * DVector::from_vec(u_elem);
            
            // Calculate local forces
            let k_local = self.beam_element_stiffness(member.e, member.a, member.i, l);
            let f_local = &k_local * &u_local;
            
            forces.push(f_local.iter().cloned().collect());
        }
        
        forces
    }
}

// ============================================================================
// TRUSS ANALYSIS WASM WRAPPER
// ============================================================================

/// Simple 2D Truss Analysis for WASM
#[wasm_bindgen]
pub struct WasmTruss2D {
    nodes: Vec<SimpleNode2D>,
    members: Vec<(usize, usize, f64, f64)>, // (start, end, E, A)
    supports: HashMap<usize, (bool, bool)>, // (x_fixed, y_fixed)
    loads: HashMap<usize, (f64, f64)>,      // (fx, fy)
}

#[wasm_bindgen]
impl WasmTruss2D {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmTruss2D {
        WasmTruss2D {
            nodes: Vec::new(),
            members: Vec::new(),
            supports: HashMap::new(),
            loads: HashMap::new(),
        }
    }
    
    #[wasm_bindgen]
    pub fn add_node(&mut self, x: f64, y: f64) -> usize {
        let idx = self.nodes.len();
        self.nodes.push(SimpleNode2D { x, y });
        idx
    }
    
    #[wasm_bindgen]
    pub fn add_support(&mut self, node_idx: usize, x_fixed: bool, y_fixed: bool) {
        self.supports.insert(node_idx, (x_fixed, y_fixed));
    }
    
    #[wasm_bindgen]
    pub fn add_member(&mut self, start: usize, end: usize, e: f64, a: f64) -> usize {
        let idx = self.members.len();
        self.members.push((start, end, e, a));
        idx
    }
    
    #[wasm_bindgen]
    pub fn add_load(&mut self, node_idx: usize, fx: f64, fy: f64) {
        self.loads.insert(node_idx, (fx, fy));
    }
    
    #[wasm_bindgen]
    pub fn analyze(&self) -> String {
        let n_nodes = self.nodes.len();
        let n_dof = n_nodes * 2;
        
        let mut k_global = DMatrix::<f64>::zeros(n_dof, n_dof);
        let mut f_global = DVector::<f64>::zeros(n_dof);
        
        // Assemble
        for &(start, end, e, a) in &self.members {
            let ni = &self.nodes[start];
            let nj = &self.nodes[end];
            
            let dx = nj.x - ni.x;
            let dy = nj.y - ni.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;
            let k = e * a / l;
            
            let c2 = c * c;
            let s2 = s * s;
            let cs = c * s;
            
            let k_elem = [
                [k*c2,  k*cs, -k*c2, -k*cs],
                [k*cs,  k*s2, -k*cs, -k*s2],
                [-k*c2, -k*cs, k*c2,  k*cs],
                [-k*cs, -k*s2, k*cs,  k*s2],
            ];
            
            let dofs = [start*2, start*2+1, end*2, end*2+1];
            for i in 0..4 {
                for j in 0..4 {
                    k_global[(dofs[i], dofs[j])] += k_elem[i][j];
                }
            }
        }
        
        // Loads
        for (&node, &(fx, fy)) in &self.loads {
            f_global[node * 2] += fx;
            f_global[node * 2 + 1] += fy;
        }
        
        // Boundary conditions
        let penalty = 1e15_f64;
        for (&node, &(x_fixed, y_fixed)) in &self.supports {
            if x_fixed {
                k_global[(node*2, node*2)] += penalty;
            }
            if y_fixed {
                k_global[(node*2+1, node*2+1)] += penalty;
            }
        }
        
        // Solve
        if let Some(u) = k_global.lu().solve(&f_global) {
            let mut member_forces = Vec::new();
            for &(start, end, e, a) in &self.members {
                let ni = &self.nodes[start];
                let nj = &self.nodes[end];
                let dx = nj.x - ni.x;
                let dy = nj.y - ni.y;
                let l = (dx * dx + dy * dy).sqrt();
                let c = dx / l;
                let s = dy / l;
                
                let u_local = c * (u[end*2] - u[start*2]) + s * (u[end*2+1] - u[start*2+1]);
                let force = e * a / l * u_local;
                member_forces.push(force);
            }
            
            serde_json::json!({
                "success": true,
                "displacements": u.iter().cloned().collect::<Vec<f64>>(),
                "member_forces": member_forces
            }).to_string()
        } else {
            r#"{"success": false}"#.to_string()
        }
    }
}

// ============================================================================
// GEOTECHNICAL BINDINGS
// ============================================================================

/// Bearing capacity calculator - Terzaghi method
#[wasm_bindgen]
pub fn calc_bearing_capacity_terzaghi(
    c: f64,       // Cohesion (kPa)
    phi: f64,     // Friction angle (degrees)
    gamma: f64,   // Unit weight (kN/m³)
    b: f64,       // Foundation width (m)
    df: f64,      // Foundation depth (m)
    shape: u8,    // 0=Strip, 1=Square, 2=Circular
    fos: f64,     // Factor of safety
) -> String {
    let foundation = FoundationInput {
        b,
        l: b,
        df,
        shape: match shape {
            0 => FoundationShape::Strip,
            1 => FoundationShape::Square,
            _ => FoundationShape::Circular,
        },
        inclination: 0.0,
        ground_slope: 0.0,
    };
    
    let soil = SoilProperties {
        classification: "Unknown".to_string(),
        gamma,
        gamma_sat: gamma + 2.0,
        c,
        c_prime: c,
        phi,
        phi_prime: phi,
        cc: 0.3,
        cr: 0.05,
        e0: 0.8,
        mv: 0.0003,
        cv: 3.0,
        n_spt: None,
        su: None,
    };
    
    let result = crate::civil_engineering::geotechnical::BearingCapacity::terzaghi(&foundation, &soil, fos);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Immediate settlement calculation
#[wasm_bindgen]
pub fn calc_immediate_settlement(
    delta_sigma: f64,  // Applied stress (kPa)
    b: f64,            // Foundation width (m)
    es: f64,           // Elastic modulus of soil (kPa)
    nu: f64,           // Poisson's ratio
    influence_factor: f64,  // Influence factor
) -> f64 {
    // Elastic settlement formula
    delta_sigma * b * (1.0 - nu * nu) * influence_factor / es
}

/// Consolidation settlement calculation
#[wasm_bindgen]
pub fn calc_consolidation_settlement(
    cc: f64,           // Compression index
    e0: f64,           // Initial void ratio
    h: f64,            // Layer thickness (m)
    sigma0: f64,       // Initial effective stress (kPa)
    delta_sigma: f64,  // Stress increase (kPa)
) -> f64 {
    // Normally consolidated settlement
    cc * h / (1.0 + e0) * ((sigma0 + delta_sigma) / sigma0).log10()
}

/// Earth pressure calculation - Rankine
#[wasm_bindgen]
pub fn calc_earth_pressure_rankine(phi: f64, c: f64, h: f64, gamma: f64) -> String {
    let phi_rad = phi.to_radians();
    
    let ka = (1.0 - phi_rad.sin()) / (1.0 + phi_rad.sin());
    let kp = (1.0 + phi_rad.sin()) / (1.0 - phi_rad.sin());
    let k0 = 1.0 - phi_rad.sin();
    
    let pa_cohesionless = 0.5 * ka * gamma * h * h;
    let pp_cohesionless = 0.5 * kp * gamma * h * h;
    
    serde_json::json!({
        "ka": ka,
        "kp": kp,
        "k0": k0,
        "active_force": pa_cohesionless,
        "passive_force": pp_cohesionless,
        "c": c
    }).to_string()
}

/// Slope stability - Infinite slope
#[wasm_bindgen]
pub fn calc_slope_infinite(c: f64, phi: f64, gamma: f64, beta: f64, depth: f64) -> f64 {
    let beta_rad = beta.to_radians();
    let phi_rad = phi.to_radians();
    
    let fos = (c / (gamma * depth * beta_rad.cos().powi(2) * beta_rad.tan()))
        + (phi_rad.tan() / beta_rad.tan());
    
    fos
}

// ============================================================================
// HYDRAULICS BINDINGS
// ============================================================================

/// Open channel flow analysis
#[wasm_bindgen]
pub fn calc_open_channel_flow(
    channel_type: u8,  // 0=Rectangular, 1=Trapezoidal, 2=Triangular, 3=Circular
    b: f64,            // Bottom width
    z: f64,            // Side slope
    diameter: f64,     // For circular
    n: f64,            // Manning's n
    s0: f64,           // Bed slope
    discharge: f64,    // Flow rate
) -> String {
    let ch_type = match channel_type {
        0 => ChannelType::Rectangular,
        1 => ChannelType::Trapezoidal,
        2 => ChannelType::Triangular,
        3 => ChannelType::Circular,
        _ => ChannelType::Rectangular,
    };
    
    let section = ChannelSection {
        channel_type: ch_type,
        b,
        z,
        diameter,
        n,
        s0,
    };
    
    let result = OpenChannelFlow::analyze(&section, discharge);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Hydraulic jump calculation
#[wasm_bindgen]
pub fn calc_hydraulic_jump(y1: f64, froude1: f64) -> String {
    let result = OpenChannelFlow::hydraulic_jump(y1, froude1);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Pipe flow analysis
#[wasm_bindgen]
pub fn calc_pipe_flow(
    diameter: f64,
    length: f64,
    roughness: f64,
    viscosity: f64,
    discharge: f64,
) -> String {
    let pipe = PipeInput {
        diameter,
        length,
        roughness,
        viscosity,
    };
    
    let result = PipeFlow::analyze(&pipe, discharge);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Rational method hydrology
#[wasm_bindgen]
pub fn calc_rational_method(
    area_km2: f64,
    tc_hours: f64,
    c: f64,
    intensity_mm_hr: f64,
    duration_hours: f64,
) -> String {
    let catchment = CatchmentInput {
        area: area_km2,
        tc: tc_hours,
        c,
        cn: 75.0,
    };
    
    let rainfall = RainfallInput {
        intensity: intensity_mm_hr,
        total_rainfall: intensity_mm_hr * duration_hours,
        duration: duration_hours,
    };
    
    let result = Hydrology::rational_method(&catchment, &rainfall);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Weir discharge
#[wasm_bindgen]
pub fn calc_weir_discharge(
    weir_type: u8,    // 0=Sharp rect, 1=V-notch, 2=Broad, 3=Cipolletti
    width: f64,       // or angle for V-notch
    head: f64,
    cd: f64,
) -> f64 {
    match weir_type {
        0 => Weirs::sharp_crested_rectangular(width, head, cd),
        1 => Weirs::v_notch(width, head, cd), // width = angle in degrees
        2 => Weirs::broad_crested(width, head, cd),
        3 => Weirs::cipolletti(width, head, cd),
        _ => Weirs::sharp_crested_rectangular(width, head, cd),
    }
}

// ============================================================================
// TRANSPORTATION BINDINGS
// ============================================================================

/// Horizontal curve design
#[wasm_bindgen]
pub fn calc_horizontal_curve(
    delta: f64,        // Deflection angle (degrees)
    design_speed: f64, // km/h
    e: f64,            // Superelevation
    f: f64,            // Side friction
) -> String {
    let input = HorizontalCurveInput {
        delta,
        design_speed,
        e,
        f,
    };
    
    let result = HorizontalCurve::design(&input);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Vertical curve design
#[wasm_bindgen]
pub fn calc_vertical_curve(
    g1: f64,           // Grade 1 (%)
    g2: f64,           // Grade 2 (%)
    design_speed: f64, // km/h
    pvi_station: f64,
    pvi_elevation: f64,
) -> String {
    let input = VerticalCurveInput {
        g1,
        g2,
        design_speed,
        pvi_station,
        pvi_elevation,
    };
    
    let result = VerticalCurve::design(&input);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Stopping sight distance
#[wasm_bindgen]
pub fn calc_stopping_sight_distance(
    speed_kmh: f64,
    grade_percent: f64,
    reaction_time: f64,
) -> f64 {
    SightDistance::stopping(speed_kmh, grade_percent, reaction_time)
}

/// Flexible pavement design
#[wasm_bindgen]
pub fn calc_flexible_pavement(
    design_esal: f64,
    reliability: f64,
    s0: f64,
    pt: f64,
    p0: f64,
    mr: f64,
) -> String {
    let input = FlexiblePavementInput {
        design_esal,
        reliability,
        s0,
        pt,
        p0,
        mr,
    };
    
    let result = PavementDesign::flexible(&input);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

/// Traffic flow analysis
#[wasm_bindgen]
pub fn calc_traffic_flow(
    flow_vph: f64,
    free_flow_speed: f64,
    jam_density: f64,
) -> String {
    let result = TrafficFlow::analyze(flow_vph, free_flow_speed, jam_density);
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

// ============================================================================
// SURVEYING BINDINGS
// ============================================================================

/// Calculate bearing between two points
#[wasm_bindgen]
pub fn calc_bearing(x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let p1 = Point2D { x: x1, y: y1 };
    let p2 = Point2D { x: x2, y: y2 };
    Coordinates::bearing(&p1, &p2)
}

/// Calculate distance between two points
#[wasm_bindgen]
pub fn calc_distance_2d(x1: f64, y1: f64, x2: f64, y2: f64) -> f64 {
    let p1 = Point2D { x: x1, y: y1 };
    let p2 = Point2D { x: x2, y: y2 };
    Coordinates::distance_2d(&p1, &p2)
}

/// Calculate point from bearing and distance
#[wasm_bindgen]
pub fn calc_point_from_bearing(origin_x: f64, origin_y: f64, bearing: f64, distance: f64) -> String {
    let origin = Point2D { x: origin_x, y: origin_y };
    let point = Coordinates::point_from_bearing(&origin, bearing, distance);
    format!(r#"{{"x": {}, "y": {}}}"#, point.x, point.y)
}

/// Geographic to UTM conversion
#[wasm_bindgen]
pub fn geo_to_utm(lat: f64, lon: f64) -> String {
    let (easting, northing, zone) = Coordinates::geo_to_utm(lat, lon);
    format!(r#"{{"easting": {}, "northing": {}, "zone": {}}}"#, easting, northing, zone)
}

/// DMS to Degrees conversion
#[wasm_bindgen]
pub fn dms_to_degrees(deg: i32, min: i32, sec: f64) -> f64 {
    Coordinates::dms_to_deg(deg, min, sec)
}

/// Degrees to DMS conversion
#[wasm_bindgen]
pub fn degrees_to_dms(degrees: f64) -> String {
    let (d, m, s) = Coordinates::deg_to_dms(degrees);
    format!(r#"{{"degrees": {}, "minutes": {}, "seconds": {}}}"#, d, m, s)
}

/// Calculate area from coordinates (cross-coordinate method)
#[wasm_bindgen]
pub fn calc_area_from_coords(coords_json: &str) -> f64 {
    if let Ok(coords) = serde_json::from_str::<Vec<(f64, f64)>>(coords_json) {
        let points: Vec<Point2D> = coords.iter()
            .map(|(x, y)| Point2D { x: *x, y: *y })
            .collect();
        AreaCalculation::cross_coordinate(&points)
    } else {
        0.0
    }
}

/// Simpson's rule area calculation
#[wasm_bindgen]
pub fn calc_area_simpson(ordinates_json: &str, spacing: f64) -> f64 {
    if let Ok(ordinates) = serde_json::from_str::<Vec<f64>>(ordinates_json) {
        AreaCalculation::simpson_rule(&ordinates, spacing)
    } else {
        0.0
    }
}

/// Total station point calculation
#[wasm_bindgen]
pub fn calc_total_station_point(
    station_x: f64,
    station_y: f64,
    station_z: f64,
    horizontal_angle: f64,
    vertical_angle: f64,
    slope_distance: f64,
    instrument_height: f64,
    prism_height: f64,
    backsight_bearing: f64,
) -> String {
    let station = Point3D {
        x: station_x,
        y: station_y,
        z: station_z,
    };
    
    let point = TotalStation::calculate_point(
        &station,
        horizontal_angle,
        vertical_angle,
        slope_distance,
        instrument_height,
        prism_height,
        backsight_bearing,
    );
    
    format!(r#"{{"x": {}, "y": {}, "z": {}}}"#, point.x, point.y, point.z)
}

// ============================================================================
// CORE UTILITIES BINDINGS
// ============================================================================

/// Create material properties for concrete
#[wasm_bindgen]
pub fn create_material_concrete(grade: u32) -> String {
    let mat = Material::concrete(grade);
    serde_json::to_string(&mat).unwrap_or_else(|_| "{}".to_string())
}

/// Create material properties for steel
#[wasm_bindgen]
pub fn create_material_steel(grade: u32) -> String {
    let mat = Material::structural_steel(grade);
    serde_json::to_string(&mat).unwrap_or_else(|_| "{}".to_string())
}

/// Calculate section properties for rectangular section
#[wasm_bindgen]
pub fn calc_section_rectangular(width: f64, height: f64) -> String {
    let props = SectionProperties::rectangular(width, height);
    serde_json::to_string(&props).unwrap_or_else(|_| "{}".to_string())
}

/// Calculate section properties for circular section
#[wasm_bindgen]
pub fn calc_section_circular(diameter: f64) -> String {
    let props = SectionProperties::circular(diameter);
    serde_json::to_string(&props).unwrap_or_else(|_| "{}".to_string())
}

/// Calculate section properties for I-section
#[wasm_bindgen]
pub fn calc_section_i_beam(
    flange_width: f64,
    total_depth: f64,
    flange_thickness: f64,
    web_thickness: f64,
) -> String {
    let props = SectionProperties::i_section(flange_width, total_depth, flange_thickness, web_thickness);
    serde_json::to_string(&props).unwrap_or_else(|_| "{}".to_string())
}

/// Unit conversion - length (m to ft)
#[wasm_bindgen]
pub fn convert_m_to_ft(value: f64) -> f64 {
    Units::m_to_ft(value)
}

/// Unit conversion - length (ft to m)
#[wasm_bindgen]
pub fn convert_ft_to_m(value: f64) -> f64 {
    Units::ft_to_m(value)
}

/// Unit conversion - force (kN to kips)
#[wasm_bindgen]
pub fn convert_kn_to_kips(value: f64) -> f64 {
    Units::kn_to_kips(value)
}

/// Unit conversion - force (kips to kN)
#[wasm_bindgen]
pub fn convert_kips_to_kn(value: f64) -> f64 {
    Units::kips_to_kn(value)
}

/// Unit conversion - stress (MPa to ksi)
#[wasm_bindgen]
pub fn convert_mpa_to_ksi(value: f64) -> f64 {
    Units::mpa_to_ksi(value)
}

/// Unit conversion - stress (ksi to MPa)
#[wasm_bindgen]
pub fn convert_ksi_to_mpa(value: f64) -> f64 {
    Units::ksi_to_mpa(value)
}
