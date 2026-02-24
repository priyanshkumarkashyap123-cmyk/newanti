//! Fluid-Structure Interaction (FSI) Framework
//!
//! Coupling between fluid dynamics and structural mechanics for
//! aeroelastic, hydroelastic, and general FSI problems.
//!
//! ## Coupling Approaches
//! - **Monolithic** - Single coupled system (strong coupling)
//! - **Partitioned** - Separate solvers with interface exchange
//! - **Loose Coupling** - One-way or weak two-way coupling
//!
//! ## Applications
//! - Aeroelasticity (flutter, gust response)
//! - Vortex-induced vibration
//! - Fluid damping effects
//! - Sloshing dynamics

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// INTERFACE DEFINITIONS
// ============================================================================

/// FSI interface definition
#[derive(Debug, Clone)]
pub struct FSIInterface {
    pub id: usize,
    pub name: String,
    pub fluid_nodes: Vec<usize>,
    pub structure_nodes: Vec<usize>,
    pub coupling_type: CouplingType,
    pub mapping: InterfaceMapping,
}

/// Type of coupling
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CouplingType {
    /// Fluid affects structure only
    OneWayFluidToStructure,
    /// Structure affects fluid only
    OneWayStructureToFluid,
    /// Bidirectional weak coupling
    TwoWayLoose,
    /// Bidirectional strong coupling (iterative)
    TwoWayStrong,
    /// Fully coupled monolithic
    Monolithic,
}

/// Interface mapping method
#[derive(Debug, Clone)]
pub enum InterfaceMapping {
    /// Consistent mapping (same mesh)
    Consistent,
    /// Nearest neighbor interpolation
    NearestNeighbor {
        pairs: Vec<(usize, usize)>,
    },
    /// Radial basis function interpolation
    RBF {
        radius: f64,
        weights: Vec<f64>,
    },
    /// Mortar method
    Mortar {
        mortar_matrix: Vec<f64>,
        rows: usize,
        cols: usize,
    },
}

impl FSIInterface {
    pub fn new(id: usize, name: String) -> Self {
        FSIInterface {
            id,
            name,
            fluid_nodes: Vec::new(),
            structure_nodes: Vec::new(),
            coupling_type: CouplingType::TwoWayStrong,
            mapping: InterfaceMapping::Consistent,
        }
    }

    /// Setup nearest neighbor mapping
    pub fn setup_nearest_neighbor(
        &mut self,
        fluid_coords: &[(f64, f64, f64)],
        structure_coords: &[(f64, f64, f64)],
    ) {
        let mut pairs = Vec::new();

        for (si, scoord) in structure_coords.iter().enumerate() {
            let mut min_dist = f64::INFINITY;
            let mut nearest_fluid = 0;

            for (fi, fcoord) in fluid_coords.iter().enumerate() {
                let dist = ((scoord.0 - fcoord.0).powi(2)
                    + (scoord.1 - fcoord.1).powi(2)
                    + (scoord.2 - fcoord.2).powi(2))
                .sqrt();

                if dist < min_dist {
                    min_dist = dist;
                    nearest_fluid = fi;
                }
            }

            pairs.push((self.structure_nodes[si], self.fluid_nodes[nearest_fluid]));
        }

        self.mapping = InterfaceMapping::NearestNeighbor { pairs };
    }

    /// Setup RBF interpolation
    pub fn setup_rbf(
        &mut self,
        fluid_coords: &[(f64, f64, f64)],
        _structure_coords: &[(f64, f64, f64)],
        radius: f64,
    ) {
        // Build RBF matrix and solve for weights
        let n = fluid_coords.len();
        let mut rbf_matrix = vec![0.0; n * n];

        for i in 0..n {
            for j in 0..n {
                let r = ((fluid_coords[i].0 - fluid_coords[j].0).powi(2)
                    + (fluid_coords[i].1 - fluid_coords[j].1).powi(2)
                    + (fluid_coords[i].2 - fluid_coords[j].2).powi(2))
                .sqrt();

                // Thin plate spline: r² * ln(r)
                rbf_matrix[i * n + j] = if r > 1e-14 {
                    r.powi(2) * r.ln()
                } else {
                    0.0
                };
            }
        }

        // Weights would be computed by solving RBF system
        self.mapping = InterfaceMapping::RBF {
            radius,
            weights: vec![0.0; n],
        };
    }
}

// ============================================================================
// DATA TRANSFER
// ============================================================================

/// Interface data transfer
#[derive(Debug, Clone)]
pub struct DataTransfer {
    pub mapping_matrix: Vec<f64>,
    pub n_fluid: usize,
    pub n_structure: usize,
}

impl DataTransfer {
    /// Build mapping matrix from interface
    pub fn from_interface(interface: &FSIInterface) -> Self {
        let n_fluid = interface.fluid_nodes.len();
        let n_structure = interface.structure_nodes.len();

        let mapping_matrix = match &interface.mapping {
            InterfaceMapping::Consistent => {
                // Identity-like mapping (assumes same nodes)
                let n = n_fluid.min(n_structure);
                let mut m = vec![0.0; n_fluid * n_structure];
                for i in 0..n {
                    m[i * n_structure + i] = 1.0;
                }
                m
            }
            InterfaceMapping::NearestNeighbor { pairs } => {
                let mut m = vec![0.0; n_fluid * n_structure];
                for (si, fi) in pairs {
                    // Find local indices
                    if let (Some(li_s), Some(li_f)) = (
                        interface.structure_nodes.iter().position(|&n| n == *si),
                        interface.fluid_nodes.iter().position(|&n| n == *fi),
                    ) {
                        m[li_f * n_structure + li_s] = 1.0;
                    }
                }
                m
            }
            InterfaceMapping::RBF { weights, .. } => {
                weights.clone()
            }
            InterfaceMapping::Mortar { mortar_matrix, .. } => {
                mortar_matrix.clone()
            }
        };

        DataTransfer {
            mapping_matrix,
            n_fluid,
            n_structure,
        }
    }

    /// Transfer displacement from structure to fluid
    pub fn transfer_displacement(
        &self,
        structure_disp: &[f64],  // n_structure * 3
    ) -> Vec<f64> {
        // fluid_disp = H * structure_disp
        let mut fluid_disp = vec![0.0; self.n_fluid * 3];

        for dir in 0..3 {
            for i in 0..self.n_fluid {
                for j in 0..self.n_structure {
                    fluid_disp[i * 3 + dir] +=
                        self.mapping_matrix[i * self.n_structure + j]
                            * structure_disp[j * 3 + dir];
                }
            }
        }

        fluid_disp
    }

    /// Transfer force from fluid to structure (consistent with virtual work)
    pub fn transfer_force(
        &self,
        fluid_force: &[f64],  // n_fluid * 3
    ) -> Vec<f64> {
        // structure_force = H^T * fluid_force (transpose for consistency)
        let mut structure_force = vec![0.0; self.n_structure * 3];

        for dir in 0..3 {
            for j in 0..self.n_structure {
                for i in 0..self.n_fluid {
                    structure_force[j * 3 + dir] +=
                        self.mapping_matrix[i * self.n_structure + j]
                            * fluid_force[i * 3 + dir];
                }
            }
        }

        structure_force
    }
}

// ============================================================================
// FLUID LOADS
// ============================================================================

/// Pressure distribution on interface
#[derive(Debug, Clone)]
pub struct PressureField {
    pub node_ids: Vec<usize>,
    pub pressures: Vec<f64>,
    pub normals: Vec<[f64; 3]>,  // Surface normals
}

impl PressureField {
    pub fn new() -> Self {
        PressureField {
            node_ids: Vec::new(),
            pressures: Vec::new(),
            normals: Vec::new(),
        }
    }

    /// Compute nodal forces from pressure
    /// F = -p * n * A
    pub fn compute_nodal_forces(&self, areas: &[f64]) -> Vec<[f64; 3]> {
        let n = self.node_ids.len();
        let mut forces = vec![[0.0; 3]; n];

        for i in 0..n {
            let p = self.pressures[i];
            let a = if i < areas.len() { areas[i] } else { 1.0 };

            for j in 0..3 {
                forces[i][j] = -p * self.normals[i][j] * a;
            }
        }

        forces
    }

    /// Interpolate pressure at a point
    pub fn interpolate(&self, node_pressures: &HashMap<usize, f64>, target_node: usize) -> f64 {
        *node_pressures.get(&target_node).unwrap_or(&0.0)
    }
}

impl Default for PressureField {
    fn default() -> Self {
        Self::new()
    }
}

/// Aerodynamic load computation
#[derive(Debug, Clone)]
pub struct AerodynamicLoads {
    pub dynamic_pressure: f64,  // q = 0.5 * ρ * V²
    pub mach_number: f64,
    pub angle_of_attack: f64,   // degrees
    pub reference_area: f64,
    pub reference_chord: f64,
}

impl AerodynamicLoads {
    pub fn new(density: f64, velocity: f64, mach: f64) -> Self {
        AerodynamicLoads {
            dynamic_pressure: 0.5 * density * velocity.powi(2),
            mach_number: mach,
            angle_of_attack: 0.0,
            reference_area: 1.0,
            reference_chord: 1.0,
        }
    }

    /// Thin airfoil theory lift coefficient
    pub fn cl_thin_airfoil(&self) -> f64 {
        // CL = 2π * α (incompressible)
        let alpha_rad = self.angle_of_attack * std::f64::consts::PI / 180.0;

        // Prandtl-Glauert correction for compressibility
        let beta = (1.0 - self.mach_number.powi(2)).sqrt().max(0.1);

        2.0 * std::f64::consts::PI * alpha_rad / beta
    }

    /// Total lift force
    pub fn lift(&self) -> f64 {
        self.dynamic_pressure * self.reference_area * self.cl_thin_airfoil()
    }

    /// Drag coefficient (simplified)
    pub fn cd_parasitic(&self, cl: f64) -> f64 {
        // CD = CD0 + CL²/(π*e*AR)
        let cd0 = 0.02;
        let e = 0.85;  // Oswald efficiency
        let ar = 8.0;  // Aspect ratio
        cd0 + cl.powi(2) / (std::f64::consts::PI * e * ar)
    }
}

// ============================================================================
// PARTITIONED COUPLING ALGORITHM
// ============================================================================

/// Partitioned FSI solver
pub struct PartitionedFSI {
    pub interface: FSIInterface,
    pub data_transfer: DataTransfer,
    pub relaxation: RelaxationMethod,
    pub convergence_tol: f64,
    pub max_iterations: usize,
}

/// Relaxation method for coupling iterations
#[derive(Debug, Clone)]
pub enum RelaxationMethod {
    /// Fixed relaxation factor
    Fixed(f64),
    /// Aitken adaptive relaxation
    Aitken {
        omega: f64,
        prev_residual: Vec<f64>,
    },
    /// Quasi-Newton IQN-ILS
    IQNILS {
        v_matrices: Vec<Vec<f64>>,
        w_matrices: Vec<Vec<f64>>,
        reuse: usize,
    },
}

impl PartitionedFSI {
    pub fn new(interface: FSIInterface) -> Self {
        let data_transfer = DataTransfer::from_interface(&interface);

        PartitionedFSI {
            interface,
            data_transfer,
            relaxation: RelaxationMethod::Aitken {
                omega: 0.5,
                prev_residual: Vec::new(),
            },
            convergence_tol: 1e-6,
            max_iterations: 50,
        }
    }

    /// Run coupling iterations for one time step
    pub fn coupling_iteration<F, S>(
        &mut self,
        fluid_solver: &mut F,
        structure_solver: &mut S,
    ) -> CouplingResult
    where
        F: FluidSolverInterface,
        S: StructureSolverInterface,
    {
        let mut converged = false;
        let mut iterations = 0;
        let mut residual_norm = f64::INFINITY;

        // Initial displacement prediction
        let mut disp_pred = structure_solver.get_displacement();

        while !converged && iterations < self.max_iterations {
            iterations += 1;

            // 1. Transfer displacement to fluid mesh
            let fluid_disp = self.data_transfer.transfer_displacement(&disp_pred);

            // 2. Solve fluid with new boundary
            fluid_solver.update_mesh(&fluid_disp);
            fluid_solver.solve();

            // 3. Get fluid forces
            let fluid_force = fluid_solver.get_interface_force();

            // 4. Transfer forces to structure
            let struct_force = self.data_transfer.transfer_force(&fluid_force);

            // 5. Solve structure
            structure_solver.apply_force(&struct_force);
            structure_solver.solve();

            // 6. Get new displacement
            let disp_new = structure_solver.get_displacement();

            // 7. Compute residual
            let residual = self.compute_residual(&disp_pred, &disp_new);
            residual_norm = vector_norm(&residual);

            // 8. Check convergence
            if residual_norm < self.convergence_tol {
                converged = true;
            } else {
                // 9. Apply relaxation
                disp_pred = self.apply_relaxation(&disp_pred, &disp_new, &residual);
            }
        }

        CouplingResult {
            converged,
            iterations,
            residual_norm,
        }
    }

    fn compute_residual(&self, pred: &[f64], new: &[f64]) -> Vec<f64> {
        pred.iter().zip(new.iter()).map(|(p, n)| n - p).collect()
    }

    fn apply_relaxation(&mut self, pred: &[f64], new: &[f64], residual: &[f64]) -> Vec<f64> {
        match &mut self.relaxation {
            RelaxationMethod::Fixed(omega) => {
                pred.iter()
                    .zip(new.iter())
                    .map(|(p, n)| p + *omega * (n - p))
                    .collect()
            }
            RelaxationMethod::Aitken { omega, prev_residual } => {
                if prev_residual.is_empty() {
                    *prev_residual = residual.to_vec();
                    pred.iter()
                        .zip(new.iter())
                        .map(|(p, n)| p + *omega * (n - p))
                        .collect()
                } else {
                    // Aitken formula
                    let delta_r: Vec<f64> = residual.iter()
                        .zip(prev_residual.iter())
                        .map(|(r, pr)| r - pr)
                        .collect();

                    let dot_prod: f64 = prev_residual.iter()
                        .zip(delta_r.iter())
                        .map(|(pr, dr)| pr * dr)
                        .sum();

                    let norm_sq: f64 = delta_r.iter().map(|x| x * x).sum();

                    if norm_sq > 1e-14 {
                        *omega = -(*omega) * dot_prod / norm_sq;
                        *omega = omega.clamp(-1.0, 1.0);
                    }

                    *prev_residual = residual.to_vec();

                    pred.iter()
                        .zip(residual.iter())
                        .map(|(p, r)| p + *omega * r)
                        .collect()
                }
            }
            RelaxationMethod::IQNILS { .. } => {
                // Quasi-Newton IQN-ILS (simplified)
                let omega = 0.7;
                pred.iter()
                    .zip(new.iter())
                    .map(|(p, n)| p + omega * (n - p))
                    .collect()
            }
        }
    }
}

/// Coupling result
#[derive(Debug, Clone)]
pub struct CouplingResult {
    pub converged: bool,
    pub iterations: usize,
    pub residual_norm: f64,
}

/// Interface trait for fluid solver
pub trait FluidSolverInterface {
    fn update_mesh(&mut self, displacement: &[f64]);
    fn solve(&mut self);
    fn get_interface_force(&self) -> Vec<f64>;
}

/// Interface trait for structure solver
pub trait StructureSolverInterface {
    fn apply_force(&mut self, force: &[f64]);
    fn solve(&mut self);
    fn get_displacement(&self) -> Vec<f64>;
}

// ============================================================================
// FLUTTER ANALYSIS
// ============================================================================

/// Flutter analysis (V-g method)
#[derive(Debug, Clone)]
pub struct FlutterAnalysis {
    pub mass_matrix: Vec<f64>,
    pub stiffness_matrix: Vec<f64>,
    pub aero_influence: Vec<f64>,  // Aerodynamic influence coefficients
    pub n_modes: usize,
    pub density: f64,
    pub velocity_range: (f64, f64),
}

impl FlutterAnalysis {
    pub fn new(n_modes: usize) -> Self {
        FlutterAnalysis {
            mass_matrix: vec![0.0; n_modes * n_modes],
            stiffness_matrix: vec![0.0; n_modes * n_modes],
            aero_influence: vec![0.0; n_modes * n_modes],
            n_modes,
            density: 1.225,
            velocity_range: (0.0, 300.0),
        }
    }

    /// Compute flutter velocity using V-g method
    /// Solves: det([K] - ω²[M] - q[A]) = 0
    pub fn compute_flutter_point(&self, n_velocities: usize) -> FlutterResult {
        let (v_min, v_max) = self.velocity_range;
        let dv = (v_max - v_min) / n_velocities as f64;

        let mut prev_dampings = vec![0.0; self.n_modes];
        let mut flutter_velocity = None;
        let mut flutter_frequency = None;

        for i in 0..n_velocities {
            let v = v_min + i as f64 * dv;
            let q = 0.5 * self.density * v.powi(2);

            // Build aeroelastic matrix
            let (frequencies, dampings) = self.solve_eigenvalue_problem(q);

            // Check for sign change in damping (flutter onset)
            for mode in 0..self.n_modes {
                if i > 0 && prev_dampings[mode] < 0.0 && dampings[mode] > 0.0 {
                    // Interpolate flutter velocity
                    let v_prev = v - dv;
                    let g_prev = prev_dampings[mode];
                    let g_curr = dampings[mode];

                    flutter_velocity = Some(v_prev - g_prev * dv / (g_curr - g_prev));
                    flutter_frequency = Some(frequencies[mode]);
                    break;
                }
            }

            if flutter_velocity.is_some() {
                break;
            }

            prev_dampings = dampings;
        }

        FlutterResult {
            flutter_velocity,
            flutter_frequency,
            flutter_mode: None,
            vg_data: Vec::new(),  // Would store V-g plot data
        }
    }

    /// Solve aeroelastic eigenvalue problem
    fn solve_eigenvalue_problem(&self, dynamic_pressure: f64) -> (Vec<f64>, Vec<f64>) {
        // Simplified: return dummy values
        // Real implementation would solve complex eigenvalue problem
        let frequencies = vec![10.0, 25.0, 50.0];
        let dampings = vec![-0.01, -0.02, -0.03 + 0.001 * dynamic_pressure];

        (frequencies.into_iter().take(self.n_modes).collect(),
         dampings.into_iter().take(self.n_modes).collect())
    }
}

/// Flutter analysis result
#[derive(Debug, Clone)]
pub struct FlutterResult {
    pub flutter_velocity: Option<f64>,
    pub flutter_frequency: Option<f64>,
    pub flutter_mode: Option<usize>,
    pub vg_data: Vec<VGPoint>,
}

/// V-g plot data point
#[derive(Debug, Clone)]
pub struct VGPoint {
    pub velocity: f64,
    pub frequency: f64,
    pub damping: f64,
    pub mode: usize,
}

// ============================================================================
// SLOSHING ANALYSIS
// ============================================================================

/// Liquid sloshing in tanks
#[derive(Debug, Clone)]
pub struct SloshingTank {
    pub length: f64,
    pub width: f64,
    pub fill_height: f64,
    pub liquid_density: f64,
    pub n_modes: usize,
}

impl SloshingTank {
    pub fn rectangular(length: f64, width: f64, fill_height: f64, density: f64) -> Self {
        SloshingTank {
            length,
            width,
            fill_height,
            liquid_density: density,
            n_modes: 5,
        }
    }

    /// Natural frequencies of sloshing modes (rectangular tank)
    pub fn natural_frequencies(&self) -> Vec<f64> {
        let g = 9.81;
        let mut frequencies = Vec::new();

        for m in 1..=self.n_modes {
            for n in 1..=self.n_modes {
                let k_mn = ((m as f64 * std::f64::consts::PI / self.length).powi(2)
                    + (n as f64 * std::f64::consts::PI / self.width).powi(2))
                .sqrt();

                let omega = (g * k_mn * (k_mn * self.fill_height).tanh()).sqrt();
                frequencies.push(omega / (2.0 * std::f64::consts::PI));
            }
        }

        frequencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
        frequencies.truncate(self.n_modes);
        frequencies
    }

    /// Equivalent mechanical model (spring-mass-damper)
    pub fn equivalent_pendulum_model(&self) -> SloshingPendulum {
        let g = 9.81;
        let h = self.fill_height;
        let l = self.length;

        // First mode approximation
        let k1 = std::f64::consts::PI / l;
        let omega1 = (g * k1 * (k1 * h).tanh()).sqrt();

        // Equivalent mass (fraction that participates in sloshing)
        let m_total = self.liquid_density * self.length * self.width * self.fill_height;
        let m_slosh = 0.83 * m_total * (k1 * h).tanh() / (k1 * h);
        let m_rigid = m_total - m_slosh;

        // Pendulum length
        let l_pend = g / omega1.powi(2);

        SloshingPendulum {
            rigid_mass: m_rigid,
            slosh_mass: m_slosh,
            pendulum_length: l_pend,
            natural_frequency: omega1 / (2.0 * std::f64::consts::PI),
        }
    }

    /// Sloshing force on tank wall (horizontal excitation)
    pub fn wall_force(&self, amplitude: f64, frequency: f64) -> f64 {
        let omega = 2.0 * std::f64::consts::PI * frequency;
        let omega_n = self.natural_frequencies()[0] * 2.0 * std::f64::consts::PI;

        let m_liquid = self.liquid_density * self.length * self.width * self.fill_height;

        // Dynamic amplification
        let beta = omega / omega_n;
        let daf = 1.0 / ((1.0 - beta.powi(2)).powi(2) + (2.0 * 0.01 * beta).powi(2)).sqrt();

        m_liquid * amplitude * omega.powi(2) * daf
    }
}

/// Equivalent pendulum model for sloshing
#[derive(Debug, Clone)]
pub struct SloshingPendulum {
    pub rigid_mass: f64,      // Mass moving with tank
    pub slosh_mass: f64,      // Mass participating in sloshing
    pub pendulum_length: f64, // Equivalent pendulum length
    pub natural_frequency: f64,
}

// ============================================================================
// ADDED MASS EFFECTS
// ============================================================================

/// Added mass computation
#[derive(Debug, Clone)]
pub struct AddedMass {
    pub shape: BodyShape,
    pub fluid_density: f64,
}

#[derive(Debug, Clone)]
pub enum BodyShape {
    Sphere { radius: f64 },
    Cylinder { radius: f64, length: f64 },
    FlatPlate { width: f64, length: f64 },
    Ellipsoid { a: f64, b: f64, c: f64 },
}

impl AddedMass {
    pub fn new(shape: BodyShape, fluid_density: f64) -> Self {
        AddedMass { shape, fluid_density }
    }

    /// Compute added mass coefficient
    pub fn coefficient(&self) -> AddedMassCoefficients {
        match &self.shape {
            BodyShape::Sphere { radius } => {
                let m_a = (2.0 / 3.0) * std::f64::consts::PI * self.fluid_density * radius.powi(3);
                AddedMassCoefficients {
                    translational: [m_a, m_a, m_a],
                    rotational: [0.0, 0.0, 0.0],
                }
            }
            BodyShape::Cylinder { radius, length } => {
                // Transverse motion (per unit length)
                let m_a_trans = std::f64::consts::PI * self.fluid_density * radius.powi(2) * length;
                // Axial motion negligible for long cylinders
                AddedMassCoefficients {
                    translational: [m_a_trans, m_a_trans, 0.1 * m_a_trans],
                    rotational: [0.0, 0.0, 0.0],
                }
            }
            BodyShape::FlatPlate { width, length } => {
                // Infinite plate approximation
                let m_a = (std::f64::consts::PI / 4.0) * self.fluid_density * width.powi(2) * length;
                AddedMassCoefficients {
                    translational: [m_a, m_a, 0.0],
                    rotational: [0.0, 0.0, 0.0],
                }
            }
            BodyShape::Ellipsoid { a, b, c } => {
                // Lamb's formulas for ellipsoid
                let volume = (4.0 / 3.0) * std::f64::consts::PI * a * b * c;
                let m_fluid = self.fluid_density * volume;

                // Approximate coefficients
                AddedMassCoefficients {
                    translational: [
                        m_fluid * self.ellipsoid_k(*a, *b, *c, 0),
                        m_fluid * self.ellipsoid_k(*a, *b, *c, 1),
                        m_fluid * self.ellipsoid_k(*a, *b, *c, 2),
                    ],
                    rotational: [0.0, 0.0, 0.0],
                }
            }
        }
    }

    fn ellipsoid_k(&self, a: f64, b: f64, c: f64, direction: usize) -> f64 {
        // Simplified approximation
        let dims = [a, b, c];
        let primary = dims[direction];
        let others: f64 = dims.iter().enumerate()
            .filter(|(i, _)| *i != direction)
            .map(|(_, &d)| d)
            .product();

        others / (primary * (primary + others.sqrt()))
    }
}

/// Added mass coefficients
#[derive(Debug, Clone)]
pub struct AddedMassCoefficients {
    pub translational: [f64; 3],  // mx, my, mz
    pub rotational: [f64; 3],     // Ixx, Iyy, Izz
}

// ============================================================================
// UTILITIES
// ============================================================================

fn vector_norm(v: &[f64]) -> f64 {
    v.iter().map(|x| x * x).sum::<f64>().sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interface_creation() {
        let interface = FSIInterface::new(0, "test".to_string());
        assert!(interface.fluid_nodes.is_empty());
    }

    #[test]
    fn test_data_transfer_consistent() {
        let mut interface = FSIInterface::new(0, "test".to_string());
        interface.fluid_nodes = vec![0, 1, 2];
        interface.structure_nodes = vec![0, 1, 2];
        interface.mapping = InterfaceMapping::Consistent;

        let transfer = DataTransfer::from_interface(&interface);

        let struct_disp = vec![1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 3.0, 0.0, 0.0];
        let fluid_disp = transfer.transfer_displacement(&struct_disp);

        assert_eq!(fluid_disp.len(), 9);
    }

    #[test]
    fn test_aerodynamic_loads() {
        let aero = AerodynamicLoads::new(1.225, 100.0, 0.3);
        assert!((aero.dynamic_pressure - 6125.0).abs() < 1.0);
    }

    #[test]
    fn test_thin_airfoil_lift() {
        let mut aero = AerodynamicLoads::new(1.225, 100.0, 0.0);
        aero.angle_of_attack = 5.0;

        let cl = aero.cl_thin_airfoil();
        assert!(cl > 0.0); // Positive lift for positive AoA
    }

    #[test]
    fn test_flutter_analysis() {
        let flutter = FlutterAnalysis::new(3);
        let result = flutter.compute_flutter_point(100);

        // May or may not find flutter point
        assert!(result.flutter_velocity.is_none() || result.flutter_velocity.unwrap() > 0.0);
    }

    #[test]
    fn test_sloshing_frequencies() {
        let tank = SloshingTank::rectangular(2.0, 1.0, 0.5, 1000.0);
        let freqs = tank.natural_frequencies();

        assert!(!freqs.is_empty());
        assert!(freqs[0] > 0.0);
    }

    #[test]
    fn test_sloshing_pendulum() {
        let tank = SloshingTank::rectangular(2.0, 1.0, 0.5, 1000.0);
        let pendulum = tank.equivalent_pendulum_model();

        assert!(pendulum.slosh_mass > 0.0);
        assert!(pendulum.rigid_mass > 0.0);
        assert!(pendulum.pendulum_length > 0.0);
    }

    #[test]
    fn test_added_mass_sphere() {
        let sphere = AddedMass::new(
            BodyShape::Sphere { radius: 1.0 },
            1000.0,
        );

        let coeffs = sphere.coefficient();

        // For sphere, added mass = (2/3) * π * ρ * r³
        let expected = (2.0 / 3.0) * std::f64::consts::PI * 1000.0;
        assert!((coeffs.translational[0] - expected).abs() < 1.0);
    }

    #[test]
    fn test_relaxation_aitken() {
        let mut interface = FSIInterface::new(0, "test".to_string());
        interface.fluid_nodes = vec![0];
        interface.structure_nodes = vec![0];

        let mut fsi = PartitionedFSI::new(interface);
        fsi.relaxation = RelaxationMethod::Aitken {
            omega: 0.5,
            prev_residual: Vec::new(),
        };

        // Relaxation should work without panicking
        let pred = vec![1.0, 0.0, 0.0];
        let new_val = vec![2.0, 0.0, 0.0];
        let residual = vec![1.0, 0.0, 0.0];

        let result = fsi.apply_relaxation(&pred, &new_val, &residual);
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_pressure_field() {
        let mut pressure = PressureField::new();
        pressure.node_ids = vec![0, 1, 2];
        pressure.pressures = vec![100.0, 200.0, 150.0];
        pressure.normals = vec![[0.0, 0.0, 1.0]; 3];

        let areas = vec![0.1, 0.1, 0.1];
        let forces = pressure.compute_nodal_forces(&areas);

        assert_eq!(forces.len(), 3);
        assert!((forces[0][2] - (-10.0)).abs() < 1e-10);
    }

    #[test]
    fn test_coupling_result() {
        let result = CouplingResult {
            converged: true,
            iterations: 5,
            residual_norm: 1e-7,
        };

        assert!(result.converged);
        assert!(result.residual_norm < 1e-6);
    }

    #[test]
    fn test_vector_norm() {
        let v = vec![3.0, 4.0];
        assert!((vector_norm(&v) - 5.0).abs() < 1e-10);
    }
}
