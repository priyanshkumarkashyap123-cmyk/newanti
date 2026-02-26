//! Advanced Boundary Conditions Module
//!
//! Comprehensive boundary condition handling for FEA including
//! prescribed displacements, follower loads, and coupled constraints.
//!
//! ## Supported BC Types
//! - **Displacement BCs** - Fixed, prescribed, symmetric
//! - **Force BCs** - Point loads, distributed, pressure
//! - **Thermal BCs** - Temperature, flux, convection
//! - **Coupled BCs** - Enforced motion, multi-point constraints
//! - **Nonlinear BCs** - Follower forces, contact

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// CORE BC STRUCTURES
// ============================================================================

/// Boundary condition type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BCType {
    // Displacement BCs
    FixedDisplacement,
    PrescribedDisplacement,
    SymmetryX,
    SymmetryY,
    SymmetryZ,
    Roller,
    Hinge,
    Antisymmetry,

    // Force BCs
    PointForce,
    DistributedForce,
    Pressure,
    Moment,
    Traction,

    // Thermal BCs
    Temperature,
    HeatFlux,
    Convection,
    Radiation,

    // Special BCs
    Spring,
    Damper,
    Mass,
    EnforcedMotion,
    FollowerForce,
}

/// Single boundary condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundaryCondition {
    pub id: usize,
    pub bc_type: BCType,
    pub entity_type: EntityType,
    pub entity_ids: Vec<usize>,
    pub dofs: Vec<usize>,           // Affected DOFs (0=x, 1=y, 2=z, 3=rx, 4=ry, 5=rz)
    pub values: Vec<f64>,           // Values for each DOF
    pub time_function: Option<TimeFunction>,
    pub coordinate_system: CoordinateSystem,
    pub is_active: bool,
}

/// Entity type for BC application
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum EntityType {
    Node,
    NodeSet,
    Edge,
    Surface,
    Element,
    ElementSet,
}

/// Time-dependent function for BCs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeFunction {
    pub function_type: TimeFunctionType,
    pub parameters: Vec<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TimeFunctionType {
    Constant,
    Linear,
    Ramp,
    Step,
    Sine,
    Cosine,
    Tabular,
    Expression,
}

impl TimeFunction {
    pub fn constant() -> Self {
        TimeFunction {
            function_type: TimeFunctionType::Constant,
            parameters: vec![1.0],
        }
    }

    pub fn linear(slope: f64, offset: f64) -> Self {
        TimeFunction {
            function_type: TimeFunctionType::Linear,
            parameters: vec![slope, offset],
        }
    }

    pub fn ramp(start_time: f64, end_time: f64) -> Self {
        TimeFunction {
            function_type: TimeFunctionType::Ramp,
            parameters: vec![start_time, end_time],
        }
    }

    pub fn step(step_time: f64) -> Self {
        TimeFunction {
            function_type: TimeFunctionType::Step,
            parameters: vec![step_time],
        }
    }

    pub fn sine(amplitude: f64, frequency: f64, phase: f64) -> Self {
        TimeFunction {
            function_type: TimeFunctionType::Sine,
            parameters: vec![amplitude, frequency, phase],
        }
    }

    pub fn evaluate(&self, time: f64) -> f64 {
        match self.function_type {
            TimeFunctionType::Constant => {
                self.parameters.get(0).copied().unwrap_or(1.0)
            }
            TimeFunctionType::Linear => {
                let slope = self.parameters.get(0).copied().unwrap_or(0.0);
                let offset = self.parameters.get(1).copied().unwrap_or(0.0);
                slope * time + offset
            }
            TimeFunctionType::Ramp => {
                let t0 = self.parameters.get(0).copied().unwrap_or(0.0);
                let t1 = self.parameters.get(1).copied().unwrap_or(1.0);
                if time <= t0 {
                    0.0
                } else if time >= t1 {
                    1.0
                } else {
                    (time - t0) / (t1 - t0)
                }
            }
            TimeFunctionType::Step => {
                let t_step = self.parameters.get(0).copied().unwrap_or(0.0);
                if time >= t_step { 1.0 } else { 0.0 }
            }
            TimeFunctionType::Sine => {
                let amp = self.parameters.get(0).copied().unwrap_or(1.0);
                let freq = self.parameters.get(1).copied().unwrap_or(1.0);
                let phase = self.parameters.get(2).copied().unwrap_or(0.0);
                amp * (2.0 * PI * freq * time + phase).sin()
            }
            TimeFunctionType::Cosine => {
                let amp = self.parameters.get(0).copied().unwrap_or(1.0);
                let freq = self.parameters.get(1).copied().unwrap_or(1.0);
                let phase = self.parameters.get(2).copied().unwrap_or(0.0);
                amp * (2.0 * PI * freq * time + phase).cos()
            }
            TimeFunctionType::Tabular | TimeFunctionType::Expression => {
                // Would need interpolation or expression parsing
                1.0
            }
        }
    }
}

/// Coordinate system for BC specification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CoordinateSystem {
    Global,
    Local,
    Cylindrical,
    Spherical,
    UserDefined(usize),  // Reference to user-defined CS
}

impl Default for CoordinateSystem {
    fn default() -> Self {
        CoordinateSystem::Global
    }
}

// ============================================================================
// DISPLACEMENT BOUNDARY CONDITIONS
// ============================================================================

/// Displacement BC handler
pub struct DisplacementBC {
    /// Node ID -> (DOF, value) pairs
    pub constraints: HashMap<usize, Vec<(usize, f64)>>,
}

impl DisplacementBC {
    pub fn new() -> Self {
        DisplacementBC {
            constraints: HashMap::new(),
        }
    }

    /// Add fixed (zero) displacement
    pub fn add_fixed(&mut self, node_id: usize, dofs: &[usize]) {
        let entry = self.constraints.entry(node_id).or_default();
        for &dof in dofs {
            entry.push((dof, 0.0));
        }
    }

    /// Add prescribed displacement
    pub fn add_prescribed(&mut self, node_id: usize, dof: usize, value: f64) {
        let entry = self.constraints.entry(node_id).or_default();
        entry.push((dof, value));
    }

    /// Add symmetry condition (normal displacement = 0)
    pub fn add_symmetry(&mut self, node_id: usize, normal_dof: usize) {
        self.add_fixed(node_id, &[normal_dof]);
    }

    /// Get constrained DOFs for a node
    pub fn get_constraints(&self, node_id: usize) -> Option<&Vec<(usize, f64)>> {
        self.constraints.get(&node_id)
    }

    /// Get all constrained DOFs globally
    pub fn get_global_constrained_dofs(&self, dof_per_node: usize) -> Vec<(usize, f64)> {
        let mut global = Vec::new();
        for (&node_id, constraints) in &self.constraints {
            for &(local_dof, value) in constraints {
                let global_dof = node_id * dof_per_node + local_dof;
                global.push((global_dof, value));
            }
        }
        global.sort_by_key(|&(dof, _)| dof);
        global
    }

    /// Apply to stiffness matrix using penalty method
    pub fn apply_penalty(
        &self,
        k: &mut Vec<f64>,
        f: &mut Vec<f64>,
        n_dof: usize,
        penalty: f64,
    ) {
        let dof_per_node = 6; // Assume 6 DOF per node
        let constraints = self.get_global_constrained_dofs(dof_per_node);

        for (global_dof, value) in constraints {
            if global_dof < n_dof {
                // Add penalty to diagonal
                k[global_dof * n_dof + global_dof] += penalty;
                // Modify load vector
                f[global_dof] = penalty * value;
            }
        }
    }

    /// Apply using direct elimination (row/column zeroing)
    pub fn apply_elimination(
        &self,
        k: &mut Vec<f64>,
        f: &mut Vec<f64>,
        n_dof: usize,
    ) {
        let dof_per_node = 6;
        let constraints = self.get_global_constrained_dofs(dof_per_node);

        for (global_dof, value) in constraints {
            if global_dof < n_dof {
                // Zero row except diagonal
                for j in 0..n_dof {
                    if j != global_dof {
                        // Modify RHS for non-zero prescribed values
                        f[j] -= k[j * n_dof + global_dof] * value;
                        k[j * n_dof + global_dof] = 0.0;
                    }
                }

                // Zero column except diagonal
                for i in 0..n_dof {
                    if i != global_dof {
                        k[global_dof * n_dof + i] = 0.0;
                    }
                }

                // Set diagonal to 1 and RHS to prescribed value
                k[global_dof * n_dof + global_dof] = 1.0;
                f[global_dof] = value;
            }
        }
    }
}

impl Default for DisplacementBC {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// FORCE BOUNDARY CONDITIONS
// ============================================================================

/// Force BC handler
pub struct ForceBC {
    /// Node ID -> (DOF, force) pairs
    pub point_forces: HashMap<usize, Vec<(usize, f64)>>,
    /// Distributed loads on elements
    pub distributed_loads: Vec<DistributedLoad>,
    /// Pressure loads on surfaces
    pub pressure_loads: Vec<PressureLoad>,
}

impl ForceBC {
    pub fn new() -> Self {
        ForceBC {
            point_forces: HashMap::new(),
            distributed_loads: Vec::new(),
            pressure_loads: Vec::new(),
        }
    }

    /// Add point force
    pub fn add_point_force(&mut self, node_id: usize, dof: usize, force: f64) {
        let entry = self.point_forces.entry(node_id).or_default();
        entry.push((dof, force));
    }

    /// Add point force vector
    pub fn add_force_vector(&mut self, node_id: usize, force: [f64; 3]) {
        let entry = self.point_forces.entry(node_id).or_default();
        for (dof, &f) in force.iter().enumerate() {
            if f.abs() > 1e-15 {
                entry.push((dof, f));
            }
        }
    }

    /// Add moment
    pub fn add_moment(&mut self, node_id: usize, moment: [f64; 3]) {
        let entry = self.point_forces.entry(node_id).or_default();
        for (i, &m) in moment.iter().enumerate() {
            if m.abs() > 1e-15 {
                entry.push((3 + i, m)); // DOFs 3, 4, 5 for rotations
            }
        }
    }

    /// Add distributed load on beam element
    pub fn add_distributed_load(&mut self, element_id: usize, load_type: DistributedLoadType, values: [f64; 6]) {
        self.distributed_loads.push(DistributedLoad {
            element_id,
            load_type,
            values,
        });
    }

    /// Add pressure load on surface
    pub fn add_pressure_load(&mut self, surface_id: usize, pressure: f64, is_follower: bool) {
        self.pressure_loads.push(PressureLoad {
            surface_id,
            pressure,
            is_follower,
        });
    }

    /// Assemble global force vector from point forces
    pub fn assemble_point_forces(&self, n_dof: usize, dof_per_node: usize) -> Vec<f64> {
        let mut f = vec![0.0; n_dof];

        for (&node_id, forces) in &self.point_forces {
            for &(local_dof, force) in forces {
                let global_dof = node_id * dof_per_node + local_dof;
                if global_dof < n_dof {
                    f[global_dof] += force;
                }
            }
        }

        f
    }
}

impl Default for ForceBC {
    fn default() -> Self {
        Self::new()
    }
}

/// Distributed load on element
#[derive(Debug, Clone)]
pub struct DistributedLoad {
    pub element_id: usize,
    pub load_type: DistributedLoadType,
    pub values: [f64; 6],  // q_x1, q_y1, q_z1, q_x2, q_y2, q_z2
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DistributedLoadType {
    Uniform,      // Constant along element
    Linear,       // Linear variation
    Trapezoidal,  // General trapezoidal
    Parabolic,    // Parabolic distribution
}

/// Pressure load on surface
#[derive(Debug, Clone)]
pub struct PressureLoad {
    pub surface_id: usize,
    pub pressure: f64,      // Positive = compression
    pub is_follower: bool,  // Updates with deformation
}

// ============================================================================
// THERMAL BOUNDARY CONDITIONS
// ============================================================================

/// Thermal BC handler
pub struct ThermalBC {
    /// Prescribed temperatures: Node ID -> temperature
    pub prescribed_temps: HashMap<usize, f64>,
    /// Heat flux BCs
    pub heat_flux: Vec<HeatFluxBC>,
    /// Convection BCs
    pub convection: Vec<ConvectionBC>,
    /// Radiation BCs
    pub radiation: Vec<RadiationBC>,
}

impl ThermalBC {
    pub fn new() -> Self {
        ThermalBC {
            prescribed_temps: HashMap::new(),
            heat_flux: Vec::new(),
            convection: Vec::new(),
            radiation: Vec::new(),
        }
    }

    /// Add prescribed temperature
    pub fn add_temperature(&mut self, node_id: usize, temperature: f64) {
        self.prescribed_temps.insert(node_id, temperature);
    }

    /// Add heat flux BC (Neumann)
    pub fn add_heat_flux(&mut self, surface_id: usize, flux: f64) {
        self.heat_flux.push(HeatFluxBC { surface_id, flux });
    }

    /// Add convection BC (Robin)
    pub fn add_convection(&mut self, surface_id: usize, h: f64, t_ambient: f64) {
        self.convection.push(ConvectionBC {
            surface_id,
            convection_coeff: h,
            ambient_temp: t_ambient,
        });
    }

    /// Add radiation BC
    pub fn add_radiation(&mut self, surface_id: usize, emissivity: f64, t_ambient: f64) {
        self.radiation.push(RadiationBC {
            surface_id,
            emissivity,
            ambient_temp: t_ambient,
        });
    }
}

impl Default for ThermalBC {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct HeatFluxBC {
    pub surface_id: usize,
    pub flux: f64,  // W/m² (positive = into body)
}

#[derive(Debug, Clone)]
pub struct ConvectionBC {
    pub surface_id: usize,
    pub convection_coeff: f64,  // W/(m²·K)
    pub ambient_temp: f64,
}

#[derive(Debug, Clone)]
pub struct RadiationBC {
    pub surface_id: usize,
    pub emissivity: f64,
    pub ambient_temp: f64,
}

// ============================================================================
// SPECIAL BOUNDARY CONDITIONS
// ============================================================================

/// Spring element BC
#[derive(Debug, Clone)]
pub struct SpringBC {
    pub node_id: usize,
    pub dof: usize,
    pub stiffness: f64,
    pub ground_node: Option<usize>,  // None = grounded spring
}

impl SpringBC {
    /// Grounded spring (one end fixed)
    pub fn grounded(node_id: usize, dof: usize, stiffness: f64) -> Self {
        SpringBC {
            node_id,
            dof,
            stiffness,
            ground_node: None,
        }
    }

    /// Spring between two nodes
    pub fn between_nodes(node1: usize, node2: usize, dof: usize, stiffness: f64) -> Self {
        SpringBC {
            node_id: node1,
            dof,
            stiffness,
            ground_node: Some(node2),
        }
    }

    /// Get contribution to stiffness matrix
    pub fn get_stiffness_contribution(&self, dof_per_node: usize) -> Vec<(usize, usize, f64)> {
        let dof1 = self.node_id * dof_per_node + self.dof;
        let k = self.stiffness;

        match self.ground_node {
            None => {
                // Grounded spring: only diagonal term
                vec![(dof1, dof1, k)]
            }
            Some(node2) => {
                let dof2 = node2 * dof_per_node + self.dof;
                vec![
                    (dof1, dof1, k),
                    (dof1, dof2, -k),
                    (dof2, dof1, -k),
                    (dof2, dof2, k),
                ]
            }
        }
    }
}

/// Damper element BC
#[derive(Debug, Clone)]
pub struct DamperBC {
    pub node_id: usize,
    pub dof: usize,
    pub damping_coeff: f64,
    pub ground_node: Option<usize>,
}

/// Enforced motion BC
#[derive(Debug, Clone)]
pub struct EnforcedMotionBC {
    pub node_ids: Vec<usize>,
    pub dofs: Vec<usize>,
    pub motion_type: MotionType,
    pub time_history: Vec<(f64, f64)>,  // (time, value) pairs
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MotionType {
    Displacement,
    Velocity,
    Acceleration,
}

impl EnforcedMotionBC {
    /// Interpolate motion value at given time
    pub fn get_value(&self, time: f64) -> f64 {
        if self.time_history.is_empty() {
            return 0.0;
        }

        // Find bracketing points
        let mut i = 0;
        while i < self.time_history.len() - 1 && self.time_history[i + 1].0 < time {
            i += 1;
        }

        if i >= self.time_history.len() - 1 {
            return self.time_history.last().map(|p| p.1).unwrap_or(0.0);
        }

        // Linear interpolation
        let (t0, v0) = self.time_history[i];
        let (t1, v1) = self.time_history[i + 1];

        if (t1 - t0).abs() < 1e-15 {
            return v0;
        }

        v0 + (v1 - v0) * (time - t0) / (t1 - t0)
    }
}

// ============================================================================
// FOLLOWER LOADS
// ============================================================================

/// Follower force that rotates with the structure
pub struct FollowerForce {
    pub node_id: usize,
    pub local_direction: [f64; 3],  // Direction in local coords
    pub magnitude: f64,
    pub time_function: TimeFunction,
}

impl FollowerForce {
    pub fn new(node_id: usize, direction: [f64; 3], magnitude: f64) -> Self {
        let norm = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let local_direction = if norm > 1e-14 {
            [direction[0] / norm, direction[1] / norm, direction[2] / norm]
        } else {
            [0.0, 0.0, -1.0]  // Default: gravity direction
        };

        FollowerForce {
            node_id,
            local_direction,
            magnitude,
            time_function: TimeFunction::constant(),
        }
    }

    /// Get current force vector in global coordinates
    /// rotation_matrix: current rotation of the node
    pub fn get_force(&self, rotation_matrix: [[f64; 3]; 3], time: f64) -> [f64; 3] {
        let scale = self.magnitude * self.time_function.evaluate(time);

        // Rotate local direction to global
        let d = self.local_direction;
        [
            scale * (rotation_matrix[0][0] * d[0] + rotation_matrix[0][1] * d[1] + rotation_matrix[0][2] * d[2]),
            scale * (rotation_matrix[1][0] * d[0] + rotation_matrix[1][1] * d[1] + rotation_matrix[1][2] * d[2]),
            scale * (rotation_matrix[2][0] * d[0] + rotation_matrix[2][1] * d[1] + rotation_matrix[2][2] * d[2]),
        ]
    }

    /// Get linearized stiffness contribution (geometric stiffness)
    pub fn get_geometric_stiffness(&self, _rotation_matrix: [[f64; 3]; 3]) -> [[f64; 3]; 3] {
        // Simplified - full implementation needs derivative of rotation
        [[0.0; 3]; 3]
    }
}

// ============================================================================
// BOUNDARY CONDITION MANAGER
// ============================================================================

/// Comprehensive BC manager
pub struct BCManager {
    pub displacement_bcs: DisplacementBC,
    pub force_bcs: ForceBC,
    pub thermal_bcs: ThermalBC,
    pub springs: Vec<SpringBC>,
    pub dampers: Vec<DamperBC>,
    pub enforced_motions: Vec<EnforcedMotionBC>,
    pub follower_forces: Vec<FollowerForce>,
}

impl BCManager {
    pub fn new() -> Self {
        BCManager {
            displacement_bcs: DisplacementBC::new(),
            force_bcs: ForceBC::new(),
            thermal_bcs: ThermalBC::new(),
            springs: Vec::new(),
            dampers: Vec::new(),
            enforced_motions: Vec::new(),
            follower_forces: Vec::new(),
        }
    }

    /// Apply all displacement BCs to system
    pub fn apply_displacement_bcs(
        &self,
        k: &mut Vec<f64>,
        f: &mut Vec<f64>,
        n_dof: usize,
        method: BCApplicationMethod,
    ) {
        match method {
            BCApplicationMethod::Penalty(p) => {
                self.displacement_bcs.apply_penalty(k, f, n_dof, p);
            }
            BCApplicationMethod::Elimination => {
                self.displacement_bcs.apply_elimination(k, f, n_dof);
            }
            BCApplicationMethod::LagrangeMultiplier => {
                // Would require augmented system
            }
        }
    }

    /// Assemble load vector with all force BCs
    pub fn assemble_forces(&self, n_dof: usize, dof_per_node: usize, time: f64) -> Vec<f64> {
        let mut f = self.force_bcs.assemble_point_forces(n_dof, dof_per_node);

        // Add follower forces (using identity rotation for now)
        let identity = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        for ff in &self.follower_forces {
            let force = ff.get_force(identity, time);
            let base_dof = ff.node_id * dof_per_node;
            if base_dof + 2 < n_dof {
                f[base_dof] += force[0];
                f[base_dof + 1] += force[1];
                f[base_dof + 2] += force[2];
            }
        }

        f
    }

    /// Add spring contributions to stiffness matrix
    pub fn add_spring_stiffness(&self, k: &mut Vec<f64>, n_dof: usize, dof_per_node: usize) {
        for spring in &self.springs {
            let contributions = spring.get_stiffness_contribution(dof_per_node);
            for (i, j, value) in contributions {
                if i < n_dof && j < n_dof {
                    k[i * n_dof + j] += value;
                }
            }
        }
    }

    /// Get enforced displacement at given time
    pub fn get_enforced_displacement(&self, time: f64) -> HashMap<usize, f64> {
        let mut enforced = HashMap::new();

        for em in &self.enforced_motions {
            if em.motion_type == MotionType::Displacement {
                let value = em.get_value(time);
                for (&node_id, &dof) in em.node_ids.iter().zip(em.dofs.iter()) {
                    enforced.insert(node_id * 6 + dof, value); // Assuming 6 DOF per node
                }
            }
        }

        enforced
    }

    /// Validate BCs for consistency
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check for conflicting BCs on same DOF
        let constrained: std::collections::HashSet<_> = self
            .displacement_bcs
            .constraints
            .iter()
            .flat_map(|(&nid, cs)| cs.iter().map(move |&(dof, _)| (nid, dof)))
            .collect();

        for (&nid, forces) in &self.force_bcs.point_forces {
            for &(dof, _) in forces {
                if constrained.contains(&(nid, dof)) {
                    errors.push(format!(
                        "Warning: Force applied to constrained DOF at node {} DOF {}",
                        nid, dof
                    ));
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

impl Default for BCManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Method for applying BCs
#[derive(Debug, Clone, Copy)]
pub enum BCApplicationMethod {
    Penalty(f64),      // Penalty factor
    Elimination,       // Direct elimination
    LagrangeMultiplier,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_function_constant() {
        let tf = TimeFunction::constant();
        assert_eq!(tf.evaluate(0.0), 1.0);
        assert_eq!(tf.evaluate(100.0), 1.0);
    }

    #[test]
    fn test_time_function_linear() {
        let tf = TimeFunction::linear(2.0, 1.0); // f(t) = 2t + 1
        assert_eq!(tf.evaluate(0.0), 1.0);
        assert_eq!(tf.evaluate(1.0), 3.0);
    }

    #[test]
    fn test_time_function_ramp() {
        let tf = TimeFunction::ramp(1.0, 3.0);
        assert_eq!(tf.evaluate(0.0), 0.0);
        assert_eq!(tf.evaluate(2.0), 0.5);
        assert_eq!(tf.evaluate(4.0), 1.0);
    }

    #[test]
    fn test_time_function_step() {
        let tf = TimeFunction::step(1.0);
        assert_eq!(tf.evaluate(0.5), 0.0);
        assert_eq!(tf.evaluate(1.5), 1.0);
    }

    #[test]
    fn test_time_function_sine() {
        let tf = TimeFunction::sine(1.0, 1.0, 0.0);
        assert!((tf.evaluate(0.0)).abs() < 1e-10);
        assert!((tf.evaluate(0.25) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_displacement_bc() {
        let mut bc = DisplacementBC::new();
        bc.add_fixed(0, &[0, 1, 2]);
        bc.add_prescribed(1, 0, 0.1);

        let constraints = bc.get_global_constrained_dofs(6);
        assert_eq!(constraints.len(), 4); // 3 fixed + 1 prescribed
    }

    #[test]
    fn test_force_bc() {
        let mut bc = ForceBC::new();
        bc.add_force_vector(0, [100.0, 200.0, 300.0]);

        let f = bc.assemble_point_forces(12, 6);
        assert_eq!(f[0], 100.0);
        assert_eq!(f[1], 200.0);
        assert_eq!(f[2], 300.0);
    }

    #[test]
    fn test_spring_bc_grounded() {
        let spring = SpringBC::grounded(0, 0, 1000.0);
        let contributions = spring.get_stiffness_contribution(6);

        assert_eq!(contributions.len(), 1);
        assert_eq!(contributions[0], (0, 0, 1000.0));
    }

    #[test]
    fn test_spring_bc_between_nodes() {
        let spring = SpringBC::between_nodes(0, 1, 0, 1000.0);
        let contributions = spring.get_stiffness_contribution(6);

        assert_eq!(contributions.len(), 4);
    }

    #[test]
    fn test_enforced_motion_interpolation() {
        let em = EnforcedMotionBC {
            node_ids: vec![0],
            dofs: vec![0],
            motion_type: MotionType::Displacement,
            time_history: vec![(0.0, 0.0), (1.0, 1.0), (2.0, 0.5)],
        };

        assert_eq!(em.get_value(0.0), 0.0);
        assert_eq!(em.get_value(0.5), 0.5);
        assert_eq!(em.get_value(1.0), 1.0);
        assert_eq!(em.get_value(1.5), 0.75);
    }

    #[test]
    fn test_follower_force() {
        let ff = FollowerForce::new(0, [0.0, 0.0, -1.0], 100.0);
        let identity = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];

        let force = ff.get_force(identity, 0.0);
        assert!((force[2] + 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_bc_manager() {
        let mut manager = BCManager::new();

        manager.displacement_bcs.add_fixed(0, &[0, 1, 2]);
        manager.force_bcs.add_force_vector(1, [0.0, -1000.0, 0.0]);
        manager.springs.push(SpringBC::grounded(1, 1, 500.0));

        assert!(manager.validate().is_ok());
    }

    #[test]
    fn test_bc_validation_warning() {
        let mut manager = BCManager::new();

        // Add constraint and force on same DOF
        manager.displacement_bcs.add_fixed(0, &[0]);
        manager.force_bcs.add_point_force(0, 0, 100.0);

        let result = manager.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_thermal_bc() {
        let mut thermal = ThermalBC::new();
        thermal.add_temperature(0, 100.0);
        thermal.add_convection(1, 10.0, 25.0);

        assert_eq!(thermal.prescribed_temps.get(&0), Some(&100.0));
        assert_eq!(thermal.convection.len(), 1);
    }
}
