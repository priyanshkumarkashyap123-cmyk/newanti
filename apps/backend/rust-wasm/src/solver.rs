use nalgebra::{DMatrix, DVector};
use serde::{Deserialize, Serialize};

use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Node {
    pub id: String,  // Changed from usize to String to match frontend
    pub x: f64,
    pub y: f64,
    // [dof_x, dof_y, dof_rotation] - each is true if fixed, false if free
    pub fixed: [bool; 3], 
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Element {
    pub id: String,  // Changed from usize to String
    pub node_start: String,  // Node ID references are now strings
    pub node_end: String,    // Node ID references are now strings
    pub e: f64, // Young's Modulus
    pub i: f64, // Moment of Inertia
    pub a: f64, // Area
}

/// 2D Nodal Load structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NodalLoad2D {
    pub node_id: String,
    #[serde(default)]
    pub fx: f64,    // Force in X direction [N]
    #[serde(default)]
    pub fy: f64,    // Force in Y direction [N]
    #[serde(default)]
    pub mz: f64,    // Moment about Z axis [N·m]
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AnalysisResult {
    // Map of Node ID to displacements [u, v, theta]
    pub displacements: HashMap<String, Vec<f64>>,
    /// Support reactions: node_id -> [Rx, Ry, Mz]
    #[serde(default)]
    pub reactions: HashMap<String, Vec<f64>>,
    pub success: bool,
    pub error: Option<String>,
}

/// Perform 2D frame analysis with nodal loads
pub fn analyze_with_loads(
    nodes: Vec<Node>, 
    elements: Vec<Element>,
    loads: Vec<NodalLoad2D>
) -> Result<AnalysisResult, String> {
    let num_nodes = nodes.len();
    let num_dof = num_nodes * 3;

    // Create mapping from Node ID to index
    let mut node_map = HashMap::new();
    for (idx, node) in nodes.iter().enumerate() {
        node_map.insert(node.id.clone(), idx);
    }

    let mut k_global = DMatrix::zeros(num_dof, num_dof);
    let mut f_global: DVector<f64> = DVector::zeros(num_dof);

    // Apply nodal loads to force vector
    for load in &loads {
        if let Some(&idx) = node_map.get(&load.node_id) {
            let dof_base = idx * 3;
            f_global[dof_base + 0] += load.fx;
            f_global[dof_base + 1] += load.fy;
            f_global[dof_base + 2] += load.mz;
        }
    }

    for element in &elements {
        let start_idx = *node_map.get(&element.node_start).ok_or("Node not found")?;
        let end_idx = *node_map.get(&element.node_end).ok_or("Node not found")?;

        let node1 = &nodes[start_idx];
        let node2 = &nodes[end_idx];

        let dx = node2.x - node1.x;
        let dy = node2.y - node1.y;
        let length = (dx * dx + dy * dy).sqrt();
        
        if length < 1e-6 {
            return Err(format!("Element {} has zero length", element.id));
        }

        let c = dx / length;
        let s = dy / length;

        let e = element.e;
        let i = element.i;
        let a = element.a;
        let l = length;

        // Local Stiffness Matrix (6x6)
        let mut k_local = DMatrix::zeros(6, 6);
        
        let k1 = e * a / l;
        let k2 = 12.0 * e * i / (l * l * l);
        let k3 = 6.0 * e * i / (l * l);
        let k4 = 4.0 * e * i / l;
        let k5 = 2.0 * e * i / l;

        // Populate upper triangle
        k_local[(0, 0)] = k1;  k_local[(0, 3)] = -k1;
        k_local[(1, 1)] = k2;  k_local[(1, 2)] = k3;  k_local[(1, 4)] = -k2; k_local[(1, 5)] = k3;
        k_local[(2, 2)] = k4;  k_local[(2, 4)] = -k3; k_local[(2, 5)] = k5;
        k_local[(3, 3)] = k1;
        k_local[(4, 4)] = k2;  k_local[(4, 5)] = -k3;
        k_local[(5, 5)] = k4;

        // Symmetric lower triangle
        for r in 0..6 {
            for c in r+1..6 {
                k_local[(c, r)] = k_local[(r, c)];
            }
        }

        // Transformation Matrix T (6x6)
        let mut t = DMatrix::zeros(6, 6);
        t[(0, 0)] = c; t[(0, 1)] = s;
        t[(1, 0)] = -s; t[(1, 1)] = c;
        t[(2, 2)] = 1.0;
        t[(3, 3)] = c; t[(3, 4)] = s;
        t[(4, 3)] = -s; t[(4, 4)] = c;
        t[(5, 5)] = 1.0;

        // Global element stiffness: K_g = T^T * K_l * T
        let k_global_elem = t.transpose() * k_local * t;

        // Assembly indices
        let indices = [
            start_idx * 3, start_idx * 3 + 1, start_idx * 3 + 2,
            end_idx * 3, end_idx * 3 + 1, end_idx * 3 + 2
        ];

        for r in 0..6 {
            for c in 0..6 {
                let gl_r = indices[r];
                let gl_c = indices[c];
                k_global[(gl_r, gl_c)] += k_global_elem[(r, c)];
            }
        }
    }

    // Apply boundary conditions using reduction method
    let mut free_dofs = Vec::new();
    let mut fixed_dofs = Vec::new();
    
    for (i, node) in nodes.iter().enumerate() {
        for dof in 0..3 {
            let global_dof = i * 3 + dof;
            if node.fixed[dof] {
                fixed_dofs.push(global_dof);
            } else {
                free_dofs.push(global_dof);
            }
        }
    }

    let n_free = free_dofs.len();
    if n_free == 0 {
        // All fixed - return zero displacements
        let mut disp_map = HashMap::new();
        let mut react_map = HashMap::new();
        
        for node in &nodes {
            disp_map.insert(node.id.clone(), vec![0.0, 0.0, 0.0]);
            if node.fixed.iter().any(|&f| f) {
                // Reactions = applied loads (negative)
                let idx = node_map.get(&node.id).unwrap();
                let dof_base = idx * 3;
                react_map.insert(node.id.clone(), vec![
                    -f_global[dof_base],
                    -f_global[dof_base + 1],
                    -f_global[dof_base + 2],
                ]);
            }
        }
        
        return Ok(AnalysisResult {
            displacements: disp_map,
            reactions: react_map,
            success: true,
            error: None,
        });
    }

    let mut k_reduced = DMatrix::zeros(n_free, n_free);
    let mut f_reduced: DVector<f64> = DVector::zeros(n_free);

    for (i, &r_idx) in free_dofs.iter().enumerate() {
        f_reduced[i] = f_global[r_idx];
        for (j, &c_idx) in free_dofs.iter().enumerate() {
            k_reduced[(i, j)] = k_global[(r_idx, c_idx)];
        }
    }

    // Solve K_reduced * u_reduced = F_reduced
    let u_reduced = k_reduced.lu().solve(&f_reduced);

    let u_reduced = match u_reduced {
        Some(u) => u,
        None => return Err("Structure is unstable (singular matrix)".to_string()),
    };

    // Reconstruct full displacement vector
    let mut u_global = DVector::zeros(num_dof);
    for (i, &dof_idx) in free_dofs.iter().enumerate() {
        u_global[dof_idx] = u_reduced[i];
    }

    // Calculate reactions: R = K * u - F
    let r_global = &k_global * &u_global - &f_global;

    // Build result maps
    let mut disp_map = HashMap::new();
    let mut react_map = HashMap::new();
    
    for (idx, node) in nodes.iter().enumerate() {
        let dof_base = idx * 3;
        
        disp_map.insert(node.id.clone(), vec![
            u_global[dof_base],
            u_global[dof_base + 1],
            u_global[dof_base + 2],
        ]);
        
        // Include reactions for nodes with any restraint
        if node.fixed.iter().any(|&f| f) {
            react_map.insert(node.id.clone(), vec![
                r_global[dof_base],
                r_global[dof_base + 1],
                r_global[dof_base + 2],
            ]);
        }
    }

    Ok(AnalysisResult {
        displacements: disp_map,
        reactions: react_map,
        success: true,
        error: None,
    })
}

/// Legacy analyze function (backward compatible, zero loads)
pub fn analyze(nodes: Vec<Node>, elements: Vec<Element>) -> Result<AnalysisResult, String> {
    analyze_with_loads(nodes, elements, vec![])
}
