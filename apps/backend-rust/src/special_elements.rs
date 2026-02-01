//! # Special Elements Module
//! 
//! Advanced special-purpose elements matching STAAD.Pro capabilities.
//! 
//! ## Element Types
//! - **Link Element** - Connects DOFs with specified stiffness
//! - **Rigid Element** - Rigid body connections (RIGID)
//! - **Spring Element** - Grounded/floating springs
//! - **Gap Element** - Compression-only contact
//! - **Hook Element** - Tension-only connection
//! - **Cable Element** - Tension-only with sag
//! - **Foundation Spring** - Winkler soil model
//! - **Damper Element** - Viscous damping

use serde::{Deserialize, Serialize};

// ============================================================================
// SPRING ELEMENTS
// ============================================================================

/// Spring DOF type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SpringDof {
    /// Translational X
    Tx,
    /// Translational Y  
    Ty,
    /// Translational Z
    Tz,
    /// Rotational X (about X axis)
    Rx,
    /// Rotational Y
    Ry,
    /// Rotational Z
    Rz,
}

impl SpringDof {
    /// Get local DOF index (0-5)
    pub fn index(&self) -> usize {
        match self {
            SpringDof::Tx => 0,
            SpringDof::Ty => 1,
            SpringDof::Tz => 2,
            SpringDof::Rx => 3,
            SpringDof::Ry => 4,
            SpringDof::Rz => 5,
        }
    }
}

/// Grounded spring element (connects node to ground)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroundSpring {
    /// Node ID
    pub node: usize,
    /// DOF
    pub dof: SpringDof,
    /// Spring stiffness (N/m or N-m/rad)
    pub stiffness: f64,
    /// Preload (optional)
    pub preload: f64,
}

impl GroundSpring {
    pub fn new(node: usize, dof: SpringDof, stiffness: f64) -> Self {
        Self {
            node,
            dof,
            stiffness,
            preload: 0.0,
        }
    }
    
    pub fn with_preload(mut self, preload: f64) -> Self {
        self.preload = preload;
        self
    }
    
    /// Get stiffness matrix contribution (1x1)
    pub fn stiffness_matrix(&self) -> (usize, f64) {
        (self.dof.index(), self.stiffness)
    }
    
    /// Get load vector contribution from preload
    pub fn load_vector(&self) -> (usize, f64) {
        (self.dof.index(), self.preload)
    }
}

/// Floating spring element (connects two nodes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloatingSpring {
    /// Node I
    pub node_i: usize,
    /// Node J
    pub node_j: usize,
    /// DOF at node I
    pub dof_i: SpringDof,
    /// DOF at node J (usually same as dof_i)
    pub dof_j: SpringDof,
    /// Spring stiffness
    pub stiffness: f64,
}

impl FloatingSpring {
    pub fn new(node_i: usize, node_j: usize, dof: SpringDof, stiffness: f64) -> Self {
        Self {
            node_i,
            node_j,
            dof_i: dof,
            dof_j: dof,
            stiffness,
        }
    }
    
    /// Get 2x2 stiffness matrix in local DOF
    pub fn stiffness_matrix(&self) -> [f64; 4] {
        let k = self.stiffness;
        [k, -k, -k, k]
    }
    
    /// Get DOF mapping
    pub fn dof_map(&self) -> [(usize, usize); 2] {
        [
            (self.node_i, self.dof_i.index()),
            (self.node_j, self.dof_j.index()),
        ]
    }
}

// ============================================================================
// LINK ELEMENT (MULTILINEAR SPRING)
// ============================================================================

/// Link element - general multi-DOF connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkElement {
    /// Node I
    pub node_i: usize,
    /// Node J
    pub node_j: usize,
    /// Stiffnesses for each DOF [Kx, Ky, Kz, Krx, Kry, Krz]
    pub stiffness: [f64; 6],
    /// Fixed DOFs (infinite stiffness approximation)
    pub fixed: [bool; 6],
}

impl LinkElement {
    pub fn new(node_i: usize, node_j: usize) -> Self {
        Self {
            node_i,
            node_j,
            stiffness: [0.0; 6],
            fixed: [false; 6],
        }
    }
    
    /// Set stiffness for a DOF
    pub fn set_stiffness(&mut self, dof: SpringDof, k: f64) {
        self.stiffness[dof.index()] = k;
    }
    
    /// Fix a DOF (rigid connection)
    pub fn fix_dof(&mut self, dof: SpringDof) {
        self.fixed[dof.index()] = true;
    }
    
    /// Rigid link (all DOFs fixed)
    pub fn rigid(node_i: usize, node_j: usize) -> Self {
        Self {
            node_i,
            node_j,
            stiffness: [0.0; 6],
            fixed: [true; 6],
        }
    }
    
    /// Get 12x12 stiffness matrix
    pub fn stiffness_matrix(&self, penalty: f64) -> Vec<f64> {
        let mut k = vec![0.0; 12 * 12];
        
        for d in 0..6 {
            let stiff = if self.fixed[d] {
                penalty
            } else {
                self.stiffness[d]
            };
            
            if stiff > 0.0 {
                // DOF d at node I: local index d
                // DOF d at node J: local index d + 6
                let i = d;
                let j = d + 6;
                
                k[i * 12 + i] += stiff;
                k[i * 12 + j] -= stiff;
                k[j * 12 + i] -= stiff;
                k[j * 12 + j] += stiff;
            }
        }
        
        k
    }
}

// ============================================================================
// RIGID ELEMENT
// ============================================================================

/// Rigid element - maintains rigid body relationship
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidElement {
    /// Master node
    pub master: usize,
    /// Slave nodes
    pub slaves: Vec<usize>,
    /// Constraint type
    pub constraint_type: RigidConstraintType,
}

/// Type of rigid constraint
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RigidConstraintType {
    /// All 6 DOFs constrained (RIGID)
    Full,
    /// Only translational DOFs (RIGID DIAPHRAGM)
    Diaphragm,
    /// Custom DOF selection
    Custom([bool; 6]),
}

impl RigidElement {
    pub fn new(master: usize, slaves: Vec<usize>, constraint_type: RigidConstraintType) -> Self {
        Self {
            master,
            slaves,
            constraint_type,
        }
    }
    
    /// Create diaphragm constraint (for floor slabs)
    pub fn diaphragm(master: usize, slaves: Vec<usize>) -> Self {
        Self::new(master, slaves, RigidConstraintType::Diaphragm)
    }
    
    /// Generate constraint equations
    /// Returns: (slave_dof, coefficients for master DOFs)
    pub fn constraint_equations(&self, slave_coords: &[f64; 3], master_coords: &[f64; 3]) 
        -> Vec<(usize, usize, [f64; 6])> 
    {
        let mut equations = Vec::new();
        
        // Relative position
        let dx = slave_coords[0] - master_coords[0];
        let dy = slave_coords[1] - master_coords[1];
        let dz = slave_coords[2] - master_coords[2];
        
        let constrained_dofs = match self.constraint_type {
            RigidConstraintType::Full => [true, true, true, true, true, true],
            RigidConstraintType::Diaphragm => [true, true, false, false, false, true],
            RigidConstraintType::Custom(dofs) => dofs,
        };
        
        for slave in &self.slaves {
            // u_slave = u_master - dz*θy + dy*θz
            if constrained_dofs[0] {
                equations.push((*slave, 0, [1.0, 0.0, 0.0, 0.0, -dz, dy]));
            }
            
            // v_slave = v_master + dz*θx - dx*θz
            if constrained_dofs[1] {
                equations.push((*slave, 1, [0.0, 1.0, 0.0, dz, 0.0, -dx]));
            }
            
            // w_slave = w_master - dy*θx + dx*θy
            if constrained_dofs[2] {
                equations.push((*slave, 2, [0.0, 0.0, 1.0, -dy, dx, 0.0]));
            }
            
            // Rotational DOFs equal master (for full rigid)
            if constrained_dofs[3] {
                equations.push((*slave, 3, [0.0, 0.0, 0.0, 1.0, 0.0, 0.0]));
            }
            if constrained_dofs[4] {
                equations.push((*slave, 4, [0.0, 0.0, 0.0, 0.0, 1.0, 0.0]));
            }
            if constrained_dofs[5] {
                equations.push((*slave, 5, [0.0, 0.0, 0.0, 0.0, 0.0, 1.0]));
            }
        }
        
        equations
    }
}

// ============================================================================
// GAP ELEMENT (COMPRESSION-ONLY)
// ============================================================================

/// Gap element - compression only contact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GapElement {
    /// Node I
    pub node_i: usize,
    /// Node J  
    pub node_j: usize,
    /// Gap direction (local X axis toward node J)
    pub direction: [f64; 3],
    /// Initial gap (positive = open)
    pub initial_gap: f64,
    /// Compression stiffness
    pub stiffness: f64,
    /// Current state
    pub state: GapState,
}

/// Gap element state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GapState {
    Open,
    Closed,
}

impl GapElement {
    pub fn new(node_i: usize, node_j: usize, direction: [f64; 3], stiffness: f64) -> Self {
        // Normalize direction
        let len = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let dir = if len > 0.0 {
            [direction[0] / len, direction[1] / len, direction[2] / len]
        } else {
            [1.0, 0.0, 0.0]
        };
        
        Self {
            node_i,
            node_j,
            direction: dir,
            initial_gap: 0.0,
            stiffness,
            state: GapState::Open,
        }
    }
    
    pub fn with_initial_gap(mut self, gap: f64) -> Self {
        self.initial_gap = gap;
        self
    }
    
    /// Check and update gap state based on displacements
    pub fn update_state(&mut self, disp_i: &[f64; 3], disp_j: &[f64; 3]) {
        // Relative displacement in gap direction
        let du = (disp_j[0] - disp_i[0]) * self.direction[0]
               + (disp_j[1] - disp_i[1]) * self.direction[1]
               + (disp_j[2] - disp_i[2]) * self.direction[2];
        
        // Gap closes when du < -initial_gap
        if du < -self.initial_gap {
            self.state = GapState::Closed;
        } else {
            self.state = GapState::Open;
        }
    }
    
    /// Get stiffness matrix (only active when closed)
    pub fn stiffness_matrix(&self) -> Option<Vec<f64>> {
        if self.state == GapState::Open {
            return None;
        }
        
        let d = self.direction;
        let k = self.stiffness;
        
        // 6x6 matrix for two nodes (3 DOF each)
        let mut ke = vec![0.0; 6 * 6];
        
        // K = k * n * n' where n is direction vector
        for i in 0..3 {
            for j in 0..3 {
                let kij = k * d[i] * d[j];
                
                // Node I block
                ke[i * 6 + j] = kij;
                // Node J block
                ke[(i + 3) * 6 + (j + 3)] = kij;
                // Coupling blocks
                ke[i * 6 + (j + 3)] = -kij;
                ke[(i + 3) * 6 + j] = -kij;
            }
        }
        
        Some(ke)
    }
    
    /// Get contact force
    pub fn contact_force(&self, disp_i: &[f64; 3], disp_j: &[f64; 3]) -> f64 {
        if self.state == GapState::Open {
            return 0.0;
        }
        
        let du = (disp_j[0] - disp_i[0]) * self.direction[0]
               + (disp_j[1] - disp_i[1]) * self.direction[1]
               + (disp_j[2] - disp_i[2]) * self.direction[2];
        
        let penetration = -du - self.initial_gap;
        self.stiffness * penetration.max(0.0)
    }
}

// ============================================================================
// HOOK ELEMENT (TENSION-ONLY)
// ============================================================================

/// Hook element - tension only connection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookElement {
    /// Node I
    pub node_i: usize,
    /// Node J
    pub node_j: usize,
    /// Direction (local X axis)
    pub direction: [f64; 3],
    /// Initial slack (positive = slack)
    pub initial_slack: f64,
    /// Tension stiffness
    pub stiffness: f64,
    /// Current state
    pub state: HookState,
}

/// Hook element state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HookState {
    Slack,
    Taut,
}

impl HookElement {
    pub fn new(node_i: usize, node_j: usize, direction: [f64; 3], stiffness: f64) -> Self {
        let len = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let dir = if len > 0.0 {
            [direction[0] / len, direction[1] / len, direction[2] / len]
        } else {
            [1.0, 0.0, 0.0]
        };
        
        Self {
            node_i,
            node_j,
            direction: dir,
            initial_slack: 0.0,
            stiffness,
            state: HookState::Slack,
        }
    }
    
    pub fn with_initial_slack(mut self, slack: f64) -> Self {
        self.initial_slack = slack;
        self
    }
    
    /// Update state based on displacements
    pub fn update_state(&mut self, disp_i: &[f64; 3], disp_j: &[f64; 3]) {
        let du = (disp_j[0] - disp_i[0]) * self.direction[0]
               + (disp_j[1] - disp_i[1]) * self.direction[1]
               + (disp_j[2] - disp_i[2]) * self.direction[2];
        
        // Hook becomes taut when du > initial_slack
        if du > self.initial_slack {
            self.state = HookState::Taut;
        } else {
            self.state = HookState::Slack;
        }
    }
    
    /// Get stiffness matrix (only active when taut)
    pub fn stiffness_matrix(&self) -> Option<Vec<f64>> {
        if self.state == HookState::Slack {
            return None;
        }
        
        let d = self.direction;
        let k = self.stiffness;
        
        let mut ke = vec![0.0; 6 * 6];
        
        for i in 0..3 {
            for j in 0..3 {
                let kij = k * d[i] * d[j];
                ke[i * 6 + j] = kij;
                ke[(i + 3) * 6 + (j + 3)] = kij;
                ke[i * 6 + (j + 3)] = -kij;
                ke[(i + 3) * 6 + j] = -kij;
            }
        }
        
        Some(ke)
    }
    
    /// Get tension force
    pub fn tension_force(&self, disp_i: &[f64; 3], disp_j: &[f64; 3]) -> f64 {
        if self.state == HookState::Slack {
            return 0.0;
        }
        
        let du = (disp_j[0] - disp_i[0]) * self.direction[0]
               + (disp_j[1] - disp_i[1]) * self.direction[1]
               + (disp_j[2] - disp_i[2]) * self.direction[2];
        
        let extension = du - self.initial_slack;
        self.stiffness * extension.max(0.0)
    }
}

// ============================================================================
// CABLE ELEMENT
// ============================================================================

/// Cable element - tension-only with catenary effects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CableElement {
    /// Node I
    pub node_i: usize,
    /// Node J
    pub node_j: usize,
    /// Unstressed length
    pub length: f64,
    /// Cross-sectional area
    pub area: f64,
    /// Elastic modulus
    pub modulus: f64,
    /// Self-weight per unit length
    pub weight: f64,
    /// Pretension force
    pub pretension: f64,
}

impl CableElement {
    pub fn new(node_i: usize, node_j: usize, length: f64, area: f64, modulus: f64) -> Self {
        Self {
            node_i,
            node_j,
            length,
            area,
            modulus,
            weight: 0.0,
            pretension: 0.0,
        }
    }
    
    pub fn with_weight(mut self, weight: f64) -> Self {
        self.weight = weight;
        self
    }
    
    pub fn with_pretension(mut self, pretension: f64) -> Self {
        self.pretension = pretension;
        self
    }
    
    /// Axial stiffness
    pub fn axial_stiffness(&self) -> f64 {
        self.modulus * self.area / self.length
    }
    
    /// Calculate cable tension for given chord length
    /// Uses catenary approximation for small sag
    pub fn tension(&self, chord_length: f64) -> f64 {
        let strain = (chord_length - self.length) / self.length;
        
        if strain > 0.0 {
            // Cable in tension
            let elastic_force = self.modulus * self.area * strain;
            self.pretension + elastic_force
        } else {
            // Cable slack or pretension only
            self.pretension.max(0.0)
        }
    }
    
    /// Sag at midpoint for horizontal cable under self-weight
    pub fn sag(&self, horizontal_span: f64) -> f64 {
        let tension = self.pretension.max(1.0); // Avoid division by zero
        self.weight * horizontal_span.powi(2) / (8.0 * tension)
    }
    
    /// Tangent stiffness matrix (6x6) accounting for geometric stiffness
    pub fn tangent_stiffness(&self, chord_length: f64, direction: &[f64; 3]) -> Vec<f64> {
        let t = self.tension(chord_length);
        let ea_l = self.axial_stiffness();
        
        let mut ke = vec![0.0; 6 * 6];
        
        // Elastic stiffness + geometric stiffness
        let k_material = ea_l;
        let k_geometric = if chord_length > 0.0 { t / chord_length } else { 0.0 };
        
        for i in 0..3 {
            for j in 0..3 {
                let k_axial = k_material * direction[i] * direction[j];
                let k_trans = if i == j {
                    k_geometric * (1.0 - direction[i] * direction[j])
                } else {
                    -k_geometric * direction[i] * direction[j]
                };
                
                let kij = k_axial + k_trans;
                
                ke[i * 6 + j] = kij;
                ke[(i + 3) * 6 + (j + 3)] = kij;
                ke[i * 6 + (j + 3)] = -kij;
                ke[(i + 3) * 6 + j] = -kij;
            }
        }
        
        ke
    }
}

// ============================================================================
// FOUNDATION SPRINGS (WINKLER MODEL)
// ============================================================================

/// Winkler foundation spring model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinklerFoundation {
    /// Nodes along foundation
    pub nodes: Vec<usize>,
    /// Tributary areas per node
    pub areas: Vec<f64>,
    /// Vertical subgrade modulus (N/m³)
    pub subgrade_modulus: f64,
    /// Horizontal subgrade modulus (optional)
    pub horizontal_modulus: Option<f64>,
}

impl WinklerFoundation {
    pub fn new(nodes: Vec<usize>, areas: Vec<f64>, subgrade_modulus: f64) -> Self {
        Self {
            nodes,
            areas,
            subgrade_modulus,
            horizontal_modulus: None,
        }
    }
    
    pub fn with_horizontal_modulus(mut self, modulus: f64) -> Self {
        self.horizontal_modulus = Some(modulus);
        self
    }
    
    /// Generate spring stiffnesses for each node
    pub fn spring_stiffnesses(&self) -> Vec<(usize, f64, Option<f64>)> {
        self.nodes.iter()
            .zip(self.areas.iter())
            .map(|(&node, &area)| {
                let kv = self.subgrade_modulus * area;
                let kh = self.horizontal_modulus.map(|m| m * area);
                (node, kv, kh)
            })
            .collect()
    }
    
    /// Estimate subgrade modulus from soil properties
    pub fn estimate_subgrade_modulus(soil_type: SoilType, footing_width: f64) -> f64 {
        // Terzaghi's correlation (simplified)
        let k1 = match soil_type {
            SoilType::LooseSand => 5000.0,
            SoilType::MediumSand => 16000.0,
            SoilType::DenseSand => 50000.0,
            SoilType::SoftClay => 12000.0,
            SoilType::StiffClay => 25000.0,
            SoilType::Rock => 100000.0,
        };
        
        // Correction for footing size (Terzaghi's formula)
        // k = k1 * ((B + 0.305) / (2 * B))²
        k1 * ((footing_width + 0.305) / (2.0 * footing_width)).powi(2) * 1000.0
    }
}

/// Soil type for foundation spring estimation
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoilType {
    LooseSand,
    MediumSand,
    DenseSand,
    SoftClay,
    StiffClay,
    Rock,
}

// ============================================================================
// DAMPER ELEMENT
// ============================================================================

/// Viscous damper element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamperElement {
    /// Node I
    pub node_i: usize,
    /// Node J
    pub node_j: usize,
    /// Damping coefficient (N-s/m)
    pub damping: f64,
    /// Direction
    pub direction: [f64; 3],
    /// Velocity exponent (1.0 = linear)
    pub exponent: f64,
}

impl DamperElement {
    pub fn new(node_i: usize, node_j: usize, damping: f64, direction: [f64; 3]) -> Self {
        let len = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let dir = if len > 0.0 {
            [direction[0] / len, direction[1] / len, direction[2] / len]
        } else {
            [1.0, 0.0, 0.0]
        };
        
        Self {
            node_i,
            node_j,
            damping,
            direction: dir,
            exponent: 1.0,
        }
    }
    
    /// Set nonlinear exponent (default 1.0 = linear)
    pub fn with_exponent(mut self, exp: f64) -> Self {
        self.exponent = exp;
        self
    }
    
    /// Get damping matrix (6x6)
    pub fn damping_matrix(&self) -> Vec<f64> {
        let d = self.direction;
        let c = self.damping;
        
        let mut ce = vec![0.0; 6 * 6];
        
        for i in 0..3 {
            for j in 0..3 {
                let cij = c * d[i] * d[j];
                ce[i * 6 + j] = cij;
                ce[(i + 3) * 6 + (j + 3)] = cij;
                ce[i * 6 + (j + 3)] = -cij;
                ce[(i + 3) * 6 + j] = -cij;
            }
        }
        
        ce
    }
    
    /// Calculate damping force given velocities
    pub fn damping_force(&self, vel_i: &[f64; 3], vel_j: &[f64; 3]) -> f64 {
        let dv = (vel_j[0] - vel_i[0]) * self.direction[0]
               + (vel_j[1] - vel_i[1]) * self.direction[1]
               + (vel_j[2] - vel_i[2]) * self.direction[2];
        
        // Nonlinear damping: F = c * |v|^α * sign(v)
        self.damping * dv.abs().powf(self.exponent) * dv.signum()
    }
}

// ============================================================================
// ISOLATOR ELEMENT (BASE ISOLATION)
// ============================================================================

/// Base isolator element (bilinear model)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatorElement {
    /// Node I (superstructure)
    pub node_i: usize,
    /// Node J (foundation)
    pub node_j: usize,
    /// Initial stiffness (pre-yield)
    pub k_initial: f64,
    /// Post-yield stiffness
    pub k_post: f64,
    /// Yield force
    pub fy: f64,
    /// Vertical stiffness
    pub kv: f64,
    /// Current state
    pub state: IsolatorState,
}

/// Isolator state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsolatorState {
    /// Current plastic displacement
    pub plastic_disp: f64,
    /// Yielded flag
    pub yielded: bool,
    /// Back-stress (kinematic hardening)
    pub back_stress: f64,
}

impl Default for IsolatorState {
    fn default() -> Self {
        Self {
            plastic_disp: 0.0,
            yielded: false,
            back_stress: 0.0,
        }
    }
}

impl IsolatorElement {
    pub fn new(node_i: usize, node_j: usize, k_initial: f64, k_post: f64, fy: f64, kv: f64) -> Self {
        Self {
            node_i,
            node_j,
            k_initial,
            k_post,
            fy,
            kv,
            state: IsolatorState::default(),
        }
    }
    
    /// Create lead rubber bearing (LRB) isolator
    pub fn lead_rubber_bearing(
        node_i: usize, 
        node_j: usize,
        rubber_area: f64,
        lead_area: f64,
        rubber_shear_modulus: f64,
        total_rubber_height: f64,
        lead_yield_stress: f64,
    ) -> Self {
        // LRB parameters
        let k_rubber = rubber_shear_modulus * rubber_area / total_rubber_height;
        let k_lead = 6.5 * lead_yield_stress * lead_area / total_rubber_height; // Approximate
        let k_initial = k_rubber + k_lead;
        let k_post = k_rubber; // Post-yield = rubber only
        let fy = lead_yield_stress * lead_area;
        
        // Vertical stiffness (compression)
        let e_rubber = rubber_shear_modulus * 3.0; // Approximate bulk modulus
        let kv = e_rubber * rubber_area / total_rubber_height;
        
        Self::new(node_i, node_j, k_initial, k_post, fy, kv)
    }
    
    /// Get tangent stiffness based on current state
    pub fn tangent_stiffness(&self, displacement: f64) -> f64 {
        let trial_force = self.k_initial * (displacement - self.state.plastic_disp);
        
        if trial_force.abs() > self.fy {
            self.k_post
        } else {
            self.k_initial
        }
    }
    
    /// Update state for given displacement increment
    pub fn update(&mut self, disp: f64) {
        let trial_force = self.k_initial * (disp - self.state.plastic_disp);
        
        if trial_force.abs() > self.fy {
            self.state.yielded = true;
            
            // Plastic correction
            let d_plastic = (trial_force.abs() - self.fy) / self.k_initial;
            self.state.plastic_disp += d_plastic * trial_force.signum();
        }
    }
    
    /// Get restoring force
    pub fn force(&self, displacement: f64) -> f64 {
        let elastic_disp = displacement - self.state.plastic_disp;
        let trial_force = self.k_initial * elastic_disp;
        
        if trial_force.abs() > self.fy {
            self.fy * trial_force.signum() + self.k_post * (elastic_disp - self.fy / self.k_initial * trial_force.signum())
        } else {
            trial_force
        }
    }
    
    /// Get hysteresis energy dissipated
    pub fn energy_dissipated(&self) -> f64 {
        // Approximate from plastic displacement
        2.0 * self.fy * self.state.plastic_disp.abs()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ground_spring() {
        let spring = GroundSpring::new(1, SpringDof::Tz, 1e6);
        let (dof, k) = spring.stiffness_matrix();
        
        assert_eq!(dof, 2); // Z translation
        assert!((k - 1e6).abs() < 1e-6);
    }
    
    #[test]
    fn test_floating_spring() {
        let spring = FloatingSpring::new(1, 2, SpringDof::Tx, 1e5);
        let k = spring.stiffness_matrix();
        
        // Check stiffness matrix pattern
        assert!((k[0] - 1e5).abs() < 1e-6);  // K11
        assert!((k[1] + 1e5).abs() < 1e-6);  // K12
        assert!((k[2] + 1e5).abs() < 1e-6);  // K21
        assert!((k[3] - 1e5).abs() < 1e-6);  // K22
    }
    
    #[test]
    fn test_link_element() {
        let mut link = LinkElement::new(1, 2);
        link.set_stiffness(SpringDof::Tx, 1e6);
        link.set_stiffness(SpringDof::Ry, 1e4);
        
        let k = link.stiffness_matrix(1e12);
        
        // Check X translation stiffness
        assert!((k[0 * 12 + 0] - 1e6).abs() < 1e-6);
        // Check Y rotation stiffness
        assert!((k[4 * 12 + 4] - 1e4).abs() < 1e-6);
    }
    
    #[test]
    fn test_rigid_link() {
        let link = LinkElement::rigid(1, 2);
        let k = link.stiffness_matrix(1e12);
        
        // All diagonal elements should have penalty stiffness
        for i in 0..6 {
            assert!((k[i * 12 + i] - 1e12).abs() < 1e-6);
        }
    }
    
    #[test]
    fn test_gap_element() {
        let mut gap = GapElement::new(1, 2, [1.0, 0.0, 0.0], 1e8);
        
        // Initially open
        assert_eq!(gap.state, GapState::Open);
        assert!(gap.stiffness_matrix().is_none());
        
        // Close gap
        gap.update_state(&[0.0, 0.0, 0.0], &[-0.001, 0.0, 0.0]);
        assert_eq!(gap.state, GapState::Closed);
        assert!(gap.stiffness_matrix().is_some());
    }
    
    #[test]
    fn test_hook_element() {
        let mut hook = HookElement::new(1, 2, [1.0, 0.0, 0.0], 1e6);
        
        // Initially slack
        assert_eq!(hook.state, HookState::Slack);
        
        // Extend to make taut
        hook.update_state(&[0.0, 0.0, 0.0], &[0.001, 0.0, 0.0]);
        assert_eq!(hook.state, HookState::Taut);
        
        // Check tension
        let force = hook.tension_force(&[0.0, 0.0, 0.0], &[0.001, 0.0, 0.0]);
        assert!((force - 1000.0).abs() < 1e-6); // 1e6 * 0.001 = 1000
    }
    
    #[test]
    fn test_cable_element() {
        let cable = CableElement::new(1, 2, 10.0, 0.001, 200e9)
            .with_pretension(10000.0);
        
        // Check axial stiffness
        let k = cable.axial_stiffness();
        let expected = 200e9 * 0.001 / 10.0;
        assert!((k - expected).abs() < 1e-6);
        
        // Check tension with no strain
        let t = cable.tension(10.0);
        assert!((t - 10000.0).abs() < 1e-6);
        
        // Check tension with extension
        let t_ext = cable.tension(10.01);
        assert!(t_ext > 10000.0);
    }
    
    #[test]
    fn test_winkler_foundation() {
        let foundation = WinklerFoundation::new(
            vec![1, 2, 3],
            vec![1.0, 2.0, 1.0],
            50e6, // 50 MN/m³
        );
        
        let springs = foundation.spring_stiffnesses();
        
        assert_eq!(springs.len(), 3);
        assert!((springs[0].1 - 50e6).abs() < 1e-6);
        assert!((springs[1].1 - 100e6).abs() < 1e-6);
    }
    
    #[test]
    fn test_subgrade_modulus_estimation() {
        let ks = WinklerFoundation::estimate_subgrade_modulus(SoilType::MediumSand, 2.0);
        
        // Should be in reasonable range for medium sand
        // k1 = 16000, B = 2.0, correction = ((2.305)/(4))^2 = 0.33
        // ks = 16000 * 0.33 * 1000 ≈ 5.3e6 kN/m³
        assert!(ks > 1e6);
        assert!(ks < 100e6);
    }
    
    #[test]
    fn test_damper_element() {
        let damper = DamperElement::new(1, 2, 1e5, [1.0, 0.0, 0.0]);
        
        let c = damper.damping_matrix();
        assert!((c[0] - 1e5).abs() < 1e-6);
        
        // Check damping force
        let force = damper.damping_force(&[0.0, 0.0, 0.0], &[0.1, 0.0, 0.0]);
        assert!((force - 10000.0).abs() < 1e-6); // 1e5 * 0.1 = 10000
    }
    
    #[test]
    fn test_isolator_element() {
        let mut isolator = IsolatorElement::new(1, 2, 1e7, 1e6, 50000.0, 1e9);
        
        // Small displacement - elastic
        let f_small = isolator.force(0.001);
        assert!((f_small - 10000.0).abs() < 1e-6); // k_initial * 0.001
        
        // Large displacement - yielded
        isolator.update(0.01);
        assert!(isolator.state.yielded);
    }
    
    #[test]
    fn test_lead_rubber_bearing() {
        let lrb = IsolatorElement::lead_rubber_bearing(
            1, 2,
            0.5,  // Rubber area
            0.05, // Lead area
            1.0e6, // Rubber shear modulus
            0.2,   // Total rubber height
            10e6,  // Lead yield stress
        );
        
        assert!(lrb.k_initial > lrb.k_post);
        assert!(lrb.fy > 0.0);
        assert!(lrb.kv > 0.0);
    }
    
    #[test]
    fn test_rigid_element_constraints() {
        let rigid = RigidElement::diaphragm(1, vec![2, 3, 4]);
        
        let slave_coords = [5.0, 3.0, 0.0];
        let master_coords = [0.0, 0.0, 0.0];
        
        let equations = rigid.constraint_equations(&slave_coords, &master_coords);
        
        // Diaphragm should constrain X, Y, and Rz
        assert!(equations.len() >= 3);
    }
}
