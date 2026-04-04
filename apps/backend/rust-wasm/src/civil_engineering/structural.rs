//! # Structural Analysis Engine (Rust)
//! 
//! High-performance structural analysis using the Direct Stiffness Method.
//! Supports 2D/3D frame analysis, truss analysis, and continuous beam analysis.

use nalgebra::{DMatrix, DVector, Matrix2, Matrix3, Matrix6, Vector3, Vector6};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// 2D Node definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node2D {
    pub id: String,
    pub x: f64,
    pub y: f64,
}

/// 3D Node definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node3D {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Support/Boundary condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Support {
    pub node_id: String,
    /// Restrained DOFs [dx, dy, dz, rx, ry, rz] - true = fixed
    pub restraints: Vec<bool>,
    /// Prescribed displacements (if any)
    pub prescribed: Option<Vec<f64>>,
    /// Spring stiffnesses (if elastic support)
    pub springs: Option<Vec<f64>>,
}

/// Member/Element definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member2D {
    pub id: String,
    pub start_node: String,
    pub end_node: String,
    /// Young's modulus (Pa)
    pub e: f64,
    /// Moment of inertia (m^4)
    pub i: f64,
    /// Cross-sectional area (m^2)
    pub a: f64,
    /// Member type
    pub member_type: MemberType,
    /// Release at start [axial, shear, moment]
    pub start_release: Option<[bool; 3]>,
    /// Release at end
    pub end_release: Option<[bool; 3]>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MemberType {
    Beam,
    Column,
    Brace,
    Truss, // Axial only, pinned ends
}

/// Point load on node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointLoad {
    pub node_id: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: Option<f64>,
    pub mx: Option<f64>,
    pub my: Option<f64>,
    pub mz: f64,
}

/// Distributed load on member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DistributedLoad {
    pub member_id: String,
    /// Load at start (kN/m)
    pub w_start: f64,
    /// Load at end (kN/m)  
    pub w_end: f64,
    /// Load direction in global coordinates
    pub direction: LoadDirection,
    /// Distance from start (0-1 fraction)
    pub start_pos: f64,
    /// Distance from end (0-1 fraction)
    pub end_pos: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadDirection {
    GlobalX,
    GlobalY,
    GlobalZ,
    LocalX,
    LocalY,
    LocalZ,
}

/// Analysis result for a single load case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub success: bool,
    pub error: Option<String>,
    /// Node displacements: node_id -> [dx, dy, rz] or [dx, dy, dz, rx, ry, rz]
    pub displacements: HashMap<String, Vec<f64>>,
    /// Support reactions: node_id -> [Fx, Fy, Mz] or [Fx, Fy, Fz, Mx, My, Mz]
    pub reactions: HashMap<String, Vec<f64>>,
    /// Member end forces: member_id -> [[start forces], [end forces]]
    pub member_forces: HashMap<String, MemberForces>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberForces {
    /// Forces at start: [axial, shear, moment]
    pub start: Vec<f64>,
    /// Forces at end: [axial, shear, moment]
    pub end: Vec<f64>,
    /// Maximum values along member
    pub max_moment: f64,
    pub max_shear: f64,
    pub max_axial: f64,
}

// ============================================================================
// 2D FRAME ANALYSIS ENGINE
// ============================================================================

/// High-performance 2D Frame Analysis
pub struct Frame2DAnalysis {
    nodes: Vec<Node2D>,
    members: Vec<Member2D>,
    supports: Vec<Support>,
    point_loads: Vec<PointLoad>,
    distributed_loads: Vec<DistributedLoad>,
    node_map: HashMap<String, usize>,
    member_map: HashMap<String, usize>,
}

impl Frame2DAnalysis {
    pub fn new() -> Self {
        Frame2DAnalysis {
            nodes: Vec::new(),
            members: Vec::new(),
            supports: Vec::new(),
            point_loads: Vec::new(),
            distributed_loads: Vec::new(),
            node_map: HashMap::new(),
            member_map: HashMap::new(),
        }
    }
    
    pub fn add_node(&mut self, node: Node2D) {
        let idx = self.nodes.len();
        self.node_map.insert(node.id.clone(), idx);
        self.nodes.push(node);
    }
    
    pub fn add_member(&mut self, member: Member2D) {
        let idx = self.members.len();
        self.member_map.insert(member.id.clone(), idx);
        self.members.push(member);
    }
    
    pub fn add_support(&mut self, support: Support) {
        self.supports.push(support);
    }
    
    pub fn add_point_load(&mut self, load: PointLoad) {
        self.point_loads.push(load);
    }
    
    pub fn add_distributed_load(&mut self, load: DistributedLoad) {
        self.distributed_loads.push(load);
    }
    
    /// Perform the analysis
    pub fn analyze(&self) -> Result<AnalysisResult, String> {
        let num_nodes = self.nodes.len();
        let num_dof = num_nodes * 3; // 3 DOF per node in 2D frame
        
        if num_nodes == 0 {
            return Err("No nodes defined".to_string());
        }
        
        if self.members.is_empty() {
            return Err("No members defined".to_string());
        }
        
        // Build global stiffness matrix
        let mut k_global = DMatrix::zeros(num_dof, num_dof);
        let mut f_global = DVector::zeros(num_dof);
        
        // Assemble member stiffnesses
        for member in &self.members {
            let start_idx = *self.node_map.get(&member.start_node)
                .ok_or_else(|| format!("Start node {} not found", member.start_node))?;
            let end_idx = *self.node_map.get(&member.end_node)
                .ok_or_else(|| format!("End node {} not found", member.end_node))?;
            
            let n1 = &self.nodes[start_idx];
            let n2 = &self.nodes[end_idx];
            
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let length = (dx * dx + dy * dy).sqrt();
            
            if length < 1e-10 {
                return Err(format!("Member {} has zero length", member.id));
            }
            
            let c = dx / length;
            let s = dy / length;
            
            // Get element stiffness matrix
            let k_elem = if member.member_type == MemberType::Truss {
                self.truss_element_stiffness(member, length, c, s)
            } else {
                self.frame_element_stiffness(member, length, c, s)
            };
            
            // Assembly indices
            let indices = [
                start_idx * 3, start_idx * 3 + 1, start_idx * 3 + 2,
                end_idx * 3, end_idx * 3 + 1, end_idx * 3 + 2,
            ];
            
            // Assemble into global matrix
            for i in 0..6 {
                for j in 0..6 {
                    k_global[(indices[i], indices[j])] += k_elem[(i, j)];
                }
            }
        }
        
        // Apply point loads
        for load in &self.point_loads {
            if let Some(&idx) = self.node_map.get(&load.node_id) {
                f_global[idx * 3] += load.fx;
                f_global[idx * 3 + 1] += load.fy;
                f_global[idx * 3 + 2] += load.mz;
            }
        }
        
        // Apply distributed loads (convert to equivalent nodal loads)
        for load in &self.distributed_loads {
            if let Some(&member_idx) = self.member_map.get(&load.member_id) {
                let member = &self.members[member_idx];
                let start_idx = match self.node_map.get(&member.start_node) {
                    Some(&idx) => idx,
                    None => continue,
                };
                let end_idx = match self.node_map.get(&member.end_node) {
                    Some(&idx) => idx,
                    None => continue,
                };
                
                let n1 = &self.nodes[start_idx];
                let n2 = &self.nodes[end_idx];
                let length = ((n2.x - n1.x).powi(2) + (n2.y - n1.y).powi(2)).sqrt();
                
                // Fixed-end forces for UDL
                let w = (load.w_start + load.w_end) / 2.0;
                let l = length * (load.end_pos - load.start_pos);
                
                // Equivalent nodal loads (for uniform load on full span)
                let fy_start = -w * l / 2.0;
                let fy_end = -w * l / 2.0;
                let mz_start = -w * l * l / 12.0;
                let mz_end = w * l * l / 12.0;
                
                f_global[start_idx * 3 + 1] += fy_start;
                f_global[start_idx * 3 + 2] += mz_start;
                f_global[end_idx * 3 + 1] += fy_end;
                f_global[end_idx * 3 + 2] += mz_end;
            }
        }
        
        // Apply boundary conditions using penalty method
        let penalty = 1e20;
        for support in &self.supports {
            if let Some(&idx) = self.node_map.get(&support.node_id) {
                for (i, &restrained) in support.restraints.iter().enumerate().take(3) {
                    if restrained {
                        let dof = idx * 3 + i;
                        k_global[(dof, dof)] += penalty;
                        
                        // Handle prescribed displacement
                        if let Some(ref prescribed) = support.prescribed {
                            if i < prescribed.len() {
                                f_global[dof] += penalty * prescribed[i];
                            }
                        }
                    }
                }
                
                // Apply spring stiffnesses
                if let Some(ref springs) = support.springs {
                    for (i, &k_spring) in springs.iter().enumerate().take(3) {
                        if k_spring > 0.0 {
                            let dof = idx * 3 + i;
                            k_global[(dof, dof)] += k_spring;
                        }
                    }
                }
            }
        }
        
        // Solve the system
        let displacements = k_global.clone().lu().solve(&f_global)
            .ok_or("Failed to solve - matrix may be singular")?;
        
        // Extract results
        let mut disp_map = HashMap::new();
        for (idx, node) in self.nodes.iter().enumerate() {
            disp_map.insert(node.id.clone(), vec![
                displacements[idx * 3],
                displacements[idx * 3 + 1],
                displacements[idx * 3 + 2],
            ]);
        }
        
        // Calculate reactions
        let mut reactions = HashMap::new();
        for support in &self.supports {
            if let Some(&idx) = self.node_map.get(&support.node_id) {
                let mut reaction = vec![0.0; 3];
                for (i, &restrained) in support.restraints.iter().enumerate().take(3) {
                    if restrained {
                        let dof = idx * 3 + i;
                        // Reaction = penalty * (prescribed - actual)
                        let prescribed = support.prescribed.as_ref()
                            .and_then(|p| p.get(i))
                            .copied()
                            .unwrap_or(0.0);
                        reaction[i] = penalty * (prescribed - displacements[dof]) + f_global[dof];
                    }
                }
                reactions.insert(support.node_id.clone(), reaction);
            }
        }
        
        // Calculate member forces
        let mut member_forces = HashMap::new();
        for member in &self.members {
            let forces = self.calculate_member_forces(member, &displacements)?;
            member_forces.insert(member.id.clone(), forces);
        }
        
        Ok(AnalysisResult {
            success: true,
            error: None,
            displacements: disp_map,
            reactions,
            member_forces,
        })
    }
    
    /// Calculate frame element stiffness matrix in global coordinates
    fn frame_element_stiffness(&self, member: &Member2D, l: f64, c: f64, s: f64) -> DMatrix<f64> {
        let e = member.e;
        let i = member.i;
        let a = member.a;
        
        // Local stiffness matrix coefficients
        let k1 = e * a / l;
        let k2 = 12.0 * e * i / l.powi(3);
        let k3 = 6.0 * e * i / l.powi(2);
        let k4 = 4.0 * e * i / l;
        let k5 = 2.0 * e * i / l;
        
        // Local stiffness matrix
        #[rustfmt::skip]
        let k_local = DMatrix::from_row_slice(6, 6, &[
            k1,   0.0,   0.0, -k1,   0.0,   0.0,
            0.0,  k2,    k3,   0.0, -k2,    k3,
            0.0,  k3,    k4,   0.0, -k3,    k5,
           -k1,   0.0,   0.0,  k1,   0.0,   0.0,
            0.0, -k2,   -k3,   0.0,  k2,   -k3,
            0.0,  k3,    k5,   0.0, -k3,    k4,
        ]);
        
        // Transformation matrix
        #[rustfmt::skip]
        let t = DMatrix::from_row_slice(6, 6, &[
             c,  s, 0.0,  0.0, 0.0, 0.0,
            -s,  c, 0.0,  0.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,  c,  s, 0.0,
            0.0, 0.0, 0.0, -s,  c, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ]);
        
        // K_global = T^T * K_local * T
        t.transpose() * k_local * t
    }
    
    /// Calculate truss element stiffness matrix (axial only)
    fn truss_element_stiffness(&self, member: &Member2D, l: f64, c: f64, s: f64) -> DMatrix<f64> {
        let k = member.e * member.a / l;
        let c2 = c * c;
        let s2 = s * s;
        let cs = c * s;
        
        let data = [
             k*c2,  k*cs, 0.0, -k*c2, -k*cs, 0.0,
             k*cs,  k*s2, 0.0, -k*cs, -k*s2, 0.0,
             0.0,   0.0,  0.0,  0.0,   0.0,  0.0,
            -k*c2, -k*cs, 0.0,  k*c2,  k*cs, 0.0,
            -k*cs, -k*s2, 0.0,  k*cs,  k*s2, 0.0,
             0.0,   0.0,  0.0,  0.0,   0.0,  0.0,
        ];
        DMatrix::from_row_slice(6, 6, &data)
    }
    
    /// Calculate member end forces from global displacements
    fn calculate_member_forces(&self, member: &Member2D, displacements: &DVector<f64>) -> Result<MemberForces, String> {
        let start_idx = *self.node_map.get(&member.start_node)
            .ok_or_else(|| format!("Node {} not found in node_map", &member.start_node))?;
        let end_idx = *self.node_map.get(&member.end_node)
            .ok_or_else(|| format!("Node {} not found in node_map", &member.end_node))?;
        
        let n1 = &self.nodes[start_idx];
        let n2 = &self.nodes[end_idx];
        
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        let l = (dx * dx + dy * dy).sqrt();
        let c = dx / l;
        let s = dy / l;
        
        // Extract element displacements
        let u_elem = DVector::from_vec(vec![
            displacements[start_idx * 3],
            displacements[start_idx * 3 + 1],
            displacements[start_idx * 3 + 2],
            displacements[end_idx * 3],
            displacements[end_idx * 3 + 1],
            displacements[end_idx * 3 + 2],
        ]);
        
        // Transform to local coordinates
        #[rustfmt::skip]
        let t = DMatrix::from_row_slice(6, 6, &[
             c,  s, 0.0,  0.0, 0.0, 0.0,
            -s,  c, 0.0,  0.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,  c,  s, 0.0,
            0.0, 0.0, 0.0, -s,  c, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ]);
        
        let u_local = &t * &u_elem;
        
        // Local stiffness
        let e = member.e;
        let i = member.i;
        let a = member.a;
        
        let k1 = e * a / l;
        let k2 = 12.0 * e * i / l.powi(3);
        let k3 = 6.0 * e * i / l.powi(2);
        let k4 = 4.0 * e * i / l;
        let k5 = 2.0 * e * i / l;
        
        #[rustfmt::skip]
        let k_local = DMatrix::from_row_slice(6, 6, &[
            k1,   0.0,   0.0, -k1,   0.0,   0.0,
            0.0,  k2,    k3,   0.0, -k2,    k3,
            0.0,  k3,    k4,   0.0, -k3,    k5,
           -k1,   0.0,   0.0,  k1,   0.0,   0.0,
            0.0, -k2,   -k3,   0.0,  k2,   -k3,
            0.0,  k3,    k5,   0.0, -k3,    k4,
        ]);
        
        let f_local = k_local * u_local;
        
        Ok(MemberForces {
            start: vec![f_local[0], f_local[1], f_local[2]],
            end: vec![f_local[3], f_local[4], f_local[5]],
            max_axial: f_local[0].abs().max(f_local[3].abs()),
            max_shear: f_local[1].abs().max(f_local[4].abs()),
            max_moment: f_local[2].abs().max(f_local[5].abs()),
        })
    }
}

// ============================================================================
// 2D TRUSS ANALYSIS ENGINE
// ============================================================================

/// Optimized 2D Truss Analysis (2 DOF per node)
pub struct Truss2DAnalysis {
    nodes: Vec<Node2D>,
    members: Vec<Member2D>,
    supports: Vec<Support>,
    loads: Vec<PointLoad>,
    node_map: HashMap<String, usize>,
}

impl Truss2DAnalysis {
    pub fn new() -> Self {
        Truss2DAnalysis {
            nodes: Vec::new(),
            members: Vec::new(),
            supports: Vec::new(),
            loads: Vec::new(),
            node_map: HashMap::new(),
        }
    }
    
    pub fn add_node(&mut self, node: Node2D) {
        let idx = self.nodes.len();
        self.node_map.insert(node.id.clone(), idx);
        self.nodes.push(node);
    }
    
    pub fn add_member(&mut self, member: Member2D) {
        self.members.push(member);
    }
    
    pub fn add_support(&mut self, support: Support) {
        self.supports.push(support);
    }
    
    pub fn add_load(&mut self, load: PointLoad) {
        self.loads.push(load);
    }
    
    pub fn analyze(&self) -> Result<TrussAnalysisResult, String> {
        let num_nodes = self.nodes.len();
        let num_dof = num_nodes * 2; // 2 DOF per node for truss
        
        let mut k_global = DMatrix::zeros(num_dof, num_dof);
        let mut f_global = DVector::zeros(num_dof);
        
        // Assemble member stiffnesses
        for member in &self.members {
            let start_idx = *self.node_map.get(&member.start_node)
                .ok_or("Start node not found")?;
            let end_idx = *self.node_map.get(&member.end_node)
                .ok_or("End node not found")?;
            
            let n1 = &self.nodes[start_idx];
            let n2 = &self.nodes[end_idx];
            
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let l = (dx * dx + dy * dy).sqrt();
            
            if l < 1e-10 {
                return Err(format!("Zero length member: {}", member.id));
            }
            
            let c = dx / l;
            let s = dy / l;
            let k = member.e * member.a / l;
            
            let c2 = c * c * k;
            let s2 = s * s * k;
            let cs = c * s * k;
            
            // Assembly indices (2 DOF per node)
            let i0 = start_idx * 2;
            let i1 = start_idx * 2 + 1;
            let i2 = end_idx * 2;
            let i3 = end_idx * 2 + 1;
            
            // Assemble (upper triangle, symmetric)
            k_global[(i0, i0)] += c2;
            k_global[(i0, i1)] += cs;
            k_global[(i0, i2)] -= c2;
            k_global[(i0, i3)] -= cs;
            
            k_global[(i1, i0)] += cs;
            k_global[(i1, i1)] += s2;
            k_global[(i1, i2)] -= cs;
            k_global[(i1, i3)] -= s2;
            
            k_global[(i2, i0)] -= c2;
            k_global[(i2, i1)] -= cs;
            k_global[(i2, i2)] += c2;
            k_global[(i2, i3)] += cs;
            
            k_global[(i3, i0)] -= cs;
            k_global[(i3, i1)] -= s2;
            k_global[(i3, i2)] += cs;
            k_global[(i3, i3)] += s2;
        }
        
        // Apply loads
        for load in &self.loads {
            if let Some(&idx) = self.node_map.get(&load.node_id) {
                f_global[idx * 2] += load.fx;
                f_global[idx * 2 + 1] += load.fy;
            }
        }
        
        // Apply boundary conditions (penalty method)
        let penalty = 1e20;
        for support in &self.supports {
            if let Some(&idx) = self.node_map.get(&support.node_id) {
                if support.restraints.len() > 0 && support.restraints[0] {
                    k_global[(idx * 2, idx * 2)] += penalty;
                }
                if support.restraints.len() > 1 && support.restraints[1] {
                    k_global[(idx * 2 + 1, idx * 2 + 1)] += penalty;
                }
            }
        }
        
        // Solve
        let displacements = k_global.clone().lu().solve(&f_global)
            .ok_or("Failed to solve system")?;
        
        // Calculate member forces
        let mut member_forces = HashMap::new();
        for member in &self.members {
            let start_idx = match self.node_map.get(&member.start_node) {
                Some(&idx) => idx,
                None => continue,
            };
            let end_idx = match self.node_map.get(&member.end_node) {
                Some(&idx) => idx,
                None => continue,
            };
            
            let n1 = &self.nodes[start_idx];
            let n2 = &self.nodes[end_idx];
            
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let l = (dx * dx + dy * dy).sqrt();
            let c = dx / l;
            let s = dy / l;
            
            // Axial deformation
            let du = displacements[end_idx * 2] - displacements[start_idx * 2];
            let dv = displacements[end_idx * 2 + 1] - displacements[start_idx * 2 + 1];
            let delta = c * du + s * dv;
            
            // Axial force (positive = tension)
            let force = member.e * member.a * delta / l;
            
            member_forces.insert(member.id.clone(), TrussMemberForce {
                axial_force: force,
                is_tension: force > 0.0,
            });
        }
        
        // Extract displacements
        let mut disp_map: HashMap<String, Vec<f64>> = HashMap::new();
        for (idx, node) in self.nodes.iter().enumerate() {
            disp_map.insert(node.id.clone(), vec![
                displacements[idx * 2],
                displacements[idx * 2 + 1],
            ]);
        }
        
        // Calculate reactions
        let mut reactions = HashMap::new();
        for support in &self.supports {
            if let Some(&idx) = self.node_map.get(&support.node_id) {
                let mut reaction = vec![0.0; 2];
                if support.restraints.len() > 0 && support.restraints[0] {
                    reaction[0] = penalty * (-displacements[idx * 2]);
                }
                if support.restraints.len() > 1 && support.restraints[1] {
                    reaction[1] = penalty * (-displacements[idx * 2 + 1]);
                }
                reactions.insert(support.node_id.clone(), reaction);
            }
        }
        
        Ok(TrussAnalysisResult {
            success: true,
            error: None,
            displacements: disp_map,
            reactions,
            member_forces,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrussAnalysisResult {
    pub success: bool,
    pub error: Option<String>,
    pub displacements: HashMap<String, Vec<f64>>,
    pub reactions: HashMap<String, Vec<f64>>,
    pub member_forces: HashMap<String, TrussMemberForce>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrussMemberForce {
    pub axial_force: f64,
    pub is_tension: bool,
}

// ============================================================================
// CONTINUOUS BEAM ANALYSIS
// ============================================================================

/// Continuous beam analysis using Three-Moment Equation
pub struct ContinuousBeamAnalysis {
    spans: Vec<BeamSpan>,
    supports: Vec<BeamSupport>,
    loads: Vec<BeamLoad>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamSpan {
    pub length: f64,
    pub ei: f64, // Flexural rigidity
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BeamSupport {
    Simple,      // Pinned/roller
    Fixed,       // Fixed end
    Cantilever,  // Free end
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamLoad {
    pub span_index: usize,
    pub load_type: BeamLoadType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BeamLoadType {
    UniformLoad { w: f64 },
    PointLoad { p: f64, a: f64 }, // a = distance from left
    TriangularLoad { w_max: f64 },
    Moment { m: f64, a: f64 },
}

impl ContinuousBeamAnalysis {
    pub fn new() -> Self {
        ContinuousBeamAnalysis {
            spans: Vec::new(),
            supports: Vec::new(),
            loads: Vec::new(),
        }
    }
    
    pub fn add_span(&mut self, span: BeamSpan) {
        self.spans.push(span);
    }
    
    pub fn add_support(&mut self, support: BeamSupport) {
        self.supports.push(support);
    }
    
    pub fn add_load(&mut self, load: BeamLoad) {
        self.loads.push(load);
    }
    
    pub fn analyze(&self) -> Result<ContinuousBeamResult, String> {
        let n_spans = self.spans.len();
        if n_spans == 0 {
            return Err("No spans defined".to_string());
        }
        
        let n_supports = n_spans + 1;
        
        // Build three-moment equation system
        // For n spans, we have n-1 interior supports with unknown moments
        let n_equations = n_spans - 1;
        
        if n_equations == 0 {
            // Single span beam - use fixed-end moments
            return self.analyze_single_span();
        }
        
        let mut a_matrix = DMatrix::zeros(n_equations, n_equations);
        let mut b_vector = DVector::zeros(n_equations);
        
        for i in 0..n_equations {
            let span_left = &self.spans[i];
            let span_right = &self.spans[i + 1];
            
            let l1 = span_left.length;
            let l2 = span_right.length;
            let ei1 = span_left.ei;
            let ei2 = span_right.ei;
            
            // Coefficients of three-moment equation
            // M_{i-1} * L1/EI1 + 2*M_i*(L1/EI1 + L2/EI2) + M_{i+1} * L2/EI2 = -6*(A1*x1/(L1*EI1) + A2*x2/(L2*EI2))
            
            if i > 0 {
                a_matrix[(i, i - 1)] = l1 / ei1;
            }
            
            a_matrix[(i, i)] = 2.0 * (l1 / ei1 + l2 / ei2);
            
            if i < n_equations - 1 {
                a_matrix[(i, i + 1)] = l2 / ei2;
            }
            
            // Calculate RHS from loads
            let rhs = self.calculate_rhs_for_support(i + 1);
            b_vector[i] = rhs;
        }
        
        // Solve for support moments
        let moments = a_matrix.clone().lu().solve(&b_vector)
            .ok_or("Failed to solve three-moment equations")?;
        
        // Build complete moment vector (including end supports)
        let mut support_moments = vec![0.0; n_supports];
        for i in 0..n_equations {
            support_moments[i + 1] = moments[i];
        }
        
        // Calculate reactions and span data
        let mut reactions = vec![0.0; n_supports];
        let mut span_results = Vec::new();
        
        for i in 0..n_spans {
            let span = &self.spans[i];
            let m_left = support_moments[i];
            let m_right = support_moments[i + 1];
            
            // Simple beam reaction from distributed load
            let w = self.get_uniform_load_on_span(i);
            let l = span.length;
            
            let r_left = w * l / 2.0 + (m_right - m_left) / l;
            let r_right = w * l / 2.0 - (m_right - m_left) / l;
            
            reactions[i] += r_left;
            reactions[i + 1] += r_right;
            
            span_results.push(SpanResult {
                left_moment: m_left,
                right_moment: m_right,
                left_reaction: r_left,
                right_reaction: r_right,
                max_positive_moment: self.calculate_max_moment(w, l, r_left, m_left),
            });
        }
        
        Ok(ContinuousBeamResult {
            success: true,
            support_moments,
            reactions,
            span_results,
        })
    }
    
    fn analyze_single_span(&self) -> Result<ContinuousBeamResult, String> {
        let span = &self.spans[0];
        let w = self.get_uniform_load_on_span(0);
        let l = span.length;
        
        // Simple beam
        let reaction = w * l / 2.0;
        let max_moment = w * l * l / 8.0;
        
        Ok(ContinuousBeamResult {
            success: true,
            support_moments: vec![0.0, 0.0],
            reactions: vec![reaction, reaction],
            span_results: vec![SpanResult {
                left_moment: 0.0,
                right_moment: 0.0,
                left_reaction: reaction,
                right_reaction: reaction,
                max_positive_moment: max_moment,
            }],
        })
    }
    
    fn calculate_rhs_for_support(&self, support_idx: usize) -> f64 {
        let mut rhs = 0.0;
        
        // Left span contribution
        if support_idx > 0 {
            let span = &self.spans[support_idx - 1];
            let w = self.get_uniform_load_on_span(support_idx - 1);
            let l = span.length;
            // Area × centroid distance / (L × EI)
            // For UDL: A = wL²/2, x̄ = L/3 from right
            rhs -= 6.0 * (w * l * l / 2.0) * (l / 3.0) / (l * span.ei);
        }
        
        // Right span contribution
        if support_idx < self.spans.len() {
            let span = &self.spans[support_idx];
            let w = self.get_uniform_load_on_span(support_idx);
            let l = span.length;
            // For UDL: A = wL²/2, x̄ = L/3 from left
            rhs -= 6.0 * (w * l * l / 2.0) * (l / 3.0) / (l * span.ei);
        }
        
        rhs
    }
    
    fn get_uniform_load_on_span(&self, span_idx: usize) -> f64 {
        for load in &self.loads {
            if load.span_index == span_idx {
                if let BeamLoadType::UniformLoad { w } = load.load_type {
                    return w;
                }
            }
        }
        0.0
    }
    
    fn calculate_max_moment(&self, w: f64, l: f64, r_left: f64, m_left: f64) -> f64 {
        // Location of max moment (where shear = 0)
        let x = r_left / w;
        if x > 0.0 && x < l {
            // M(x) = R*x - w*x²/2 + M_left
            r_left * x - w * x * x / 2.0 + m_left
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuousBeamResult {
    pub success: bool,
    pub support_moments: Vec<f64>,
    pub reactions: Vec<f64>,
    pub span_results: Vec<SpanResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpanResult {
    pub left_moment: f64,
    pub right_moment: f64,
    pub left_reaction: f64,
    pub right_reaction: f64,
    pub max_positive_moment: f64,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_truss() {
        let mut truss = Truss2DAnalysis::new();
        
        // Simple 2-node truss
        truss.add_node(Node2D { id: "1".to_string(), x: 0.0, y: 0.0 });
        truss.add_node(Node2D { id: "2".to_string(), x: 3.0, y: 0.0 });
        
        truss.add_member(Member2D {
            id: "m1".to_string(),
            start_node: "1".to_string(),
            end_node: "2".to_string(),
            e: 200e9,
            i: 1e-4,
            a: 0.01,
            member_type: MemberType::Truss,
            start_release: None,
            end_release: None,
        });
        
        truss.add_support(Support {
            node_id: "1".to_string(),
            restraints: vec![true, true],
            prescribed: None,
            springs: None,
        });
        
        truss.add_support(Support {
            node_id: "2".to_string(),
            restraints: vec![false, true],
            prescribed: None,
            springs: None,
        });
        
        truss.add_load(PointLoad {
            node_id: "2".to_string(),
            fx: 10000.0,
            fy: 0.0,
            fz: None,
            mx: None,
            my: None,
            mz: 0.0,
        });
        
        let result = truss.analyze().unwrap();
        assert!(result.success);
        
        // Check displacement at node 2
        let disp = result.displacements.get("2").unwrap();
        assert!(disp[0] > 0.0); // Should deflect in +X direction
    }
}
