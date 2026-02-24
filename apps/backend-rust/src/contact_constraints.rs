//! Contact and Constraint Handling Module
//!
//! Advanced constraint handling for realistic structural connections,
//! contact mechanics, and multi-point constraints.
//!
//! ## Constraint Types
//! - **Rigid links** - Master-slave constraints
//! - **Multi-point constraints** - Linear combinations of DOFs
//! - **Contact** - Node-to-surface, surface-to-surface
//! - **Gap/Hook elements** - Compression/tension only
//! - **Friction** - Coulomb friction model
//!
//! ## Methods
//! - **Lagrange multipliers** - Exact constraint enforcement
//! - **Penalty method** - Approximate but robust
//! - **Augmented Lagrangian** - Combined approach

use serde::{Deserialize, Serialize};

// ============================================================================
// CONSTRAINT TYPES
// ============================================================================

/// Constraint type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConstraintType {
    RigidLink,
    MasterSlave,
    MultiPointConstraint,
    TiedContact,
    GapElement,
    HookElement,
    FrictionContact,
    Coupling,
}

/// Enforcement method
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnforcementMethod {
    LagrangeMultiplier,
    Penalty,
    AugmentedLagrangian,
    Transformation,
}

/// Contact status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContactStatus {
    Open,       // No contact
    Closed,     // In contact, no sliding
    Sliding,    // In contact, sliding with friction
    Sticking,   // In contact, friction prevents sliding
}

// ============================================================================
// MULTI-POINT CONSTRAINT
// ============================================================================

/// Multi-point constraint: Σ(ai * ui) = c
/// Example: u1 - u2 = 0 (tie two DOFs)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiPointConstraint {
    pub id: usize,
    pub dof_indices: Vec<usize>,
    pub coefficients: Vec<f64>,
    pub constant: f64,
    pub tolerance: f64,
}

impl MultiPointConstraint {
    /// Create constraint that ties two DOFs: dof1 = dof2
    pub fn tie_dofs(id: usize, dof1: usize, dof2: usize) -> Self {
        MultiPointConstraint {
            id,
            dof_indices: vec![dof1, dof2],
            coefficients: vec![1.0, -1.0],
            constant: 0.0,
            tolerance: 1e-10,
        }
    }

    /// Create rigid link in direction
    pub fn rigid_link(id: usize, master_dof: usize, slave_dof: usize, ratio: f64) -> Self {
        MultiPointConstraint {
            id,
            dof_indices: vec![slave_dof, master_dof],
            coefficients: vec![1.0, -ratio],
            constant: 0.0,
            tolerance: 1e-10,
        }
    }

    /// Evaluate constraint violation
    pub fn evaluate(&self, displacements: &[f64]) -> f64 {
        let mut sum = -self.constant;
        for (i, &dof) in self.dof_indices.iter().enumerate() {
            if dof < displacements.len() {
                sum += self.coefficients[i] * displacements[dof];
            }
        }
        sum
    }

    /// Check if constraint is satisfied
    pub fn is_satisfied(&self, displacements: &[f64]) -> bool {
        self.evaluate(displacements).abs() < self.tolerance
    }
}

// ============================================================================
// RIGID BODY CONSTRAINT
// ============================================================================

/// Rigid body constraint connecting nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RigidBody {
    pub id: usize,
    pub master_node: usize,
    pub slave_nodes: Vec<usize>,
    pub constrained_dofs: [bool; 6], // Which DOFs to constrain
}

impl RigidBody {
    pub fn new(id: usize, master: usize, slaves: Vec<usize>) -> Self {
        RigidBody {
            id,
            master_node: master,
            slave_nodes: slaves,
            constrained_dofs: [true; 6], // All DOFs by default
        }
    }

    /// Generate MPCs for rigid body
    pub fn generate_mpcs(
        &self,
        master_coords: [f64; 3],
        slave_coords: &[[f64; 3]],
        dofs_per_node: usize,
    ) -> Vec<MultiPointConstraint> {
        let mut mpcs = Vec::new();
        let mut mpc_id = self.id * 1000;

        for (i, slave) in self.slave_nodes.iter().enumerate() {
            let dx = slave_coords[i][0] - master_coords[0];
            let dy = slave_coords[i][1] - master_coords[1];
            let dz = slave_coords[i][2] - master_coords[2];

            let master_base = self.master_node * dofs_per_node;
            let slave_base = slave * dofs_per_node;

            if dofs_per_node >= 6 {
                // Translation X: us_x = um_x - dy*θz + dz*θy
                if self.constrained_dofs[0] {
                    mpcs.push(MultiPointConstraint {
                        id: mpc_id,
                        dof_indices: vec![slave_base, master_base, master_base + 4, master_base + 5],
                        coefficients: vec![1.0, -1.0, -dz, dy],
                        constant: 0.0,
                        tolerance: 1e-10,
                    });
                    mpc_id += 1;
                }

                // Translation Y: us_y = um_y + dx*θz - dz*θx
                if self.constrained_dofs[1] {
                    mpcs.push(MultiPointConstraint {
                        id: mpc_id,
                        dof_indices: vec![slave_base + 1, master_base + 1, master_base + 3, master_base + 5],
                        coefficients: vec![1.0, -1.0, dz, -dx],
                        constant: 0.0,
                        tolerance: 1e-10,
                    });
                    mpc_id += 1;
                }

                // Translation Z: us_z = um_z - dx*θy + dy*θx
                if self.constrained_dofs[2] {
                    mpcs.push(MultiPointConstraint {
                        id: mpc_id,
                        dof_indices: vec![slave_base + 2, master_base + 2, master_base + 3, master_base + 4],
                        coefficients: vec![1.0, -1.0, -dy, dx],
                        constant: 0.0,
                        tolerance: 1e-10,
                    });
                    mpc_id += 1;
                }

                // Rotations: θs = θm
                for r in 0..3 {
                    if self.constrained_dofs[3 + r] {
                        mpcs.push(MultiPointConstraint::tie_dofs(
                            mpc_id,
                            slave_base + 3 + r,
                            master_base + 3 + r,
                        ));
                        mpc_id += 1;
                    }
                }
            }
        }

        mpcs
    }
}

// ============================================================================
// CONTACT ELEMENT
// ============================================================================

/// Node-to-node contact element
#[derive(Debug, Clone)]
pub struct ContactPair {
    pub id: usize,
    pub node1: usize,
    pub node2: usize,
    pub normal: [f64; 3],
    pub gap: f64,
    pub status: ContactStatus,
    pub friction_coeff: f64,
    pub penalty_normal: f64,
    pub penalty_tangent: f64,
}

impl ContactPair {
    pub fn new(id: usize, node1: usize, node2: usize, normal: [f64; 3]) -> Self {
        ContactPair {
            id,
            node1,
            node2,
            normal,
            gap: 0.0,
            status: ContactStatus::Open,
            friction_coeff: 0.3,
            penalty_normal: 1e10,
            penalty_tangent: 1e10,
        }
    }

    /// Update gap based on current displacements
    pub fn update_gap(&mut self, coords1: [f64; 3], coords2: [f64; 3], disp1: [f64; 3], disp2: [f64; 3]) {
        let current1 = [
            coords1[0] + disp1[0],
            coords1[1] + disp1[1],
            coords1[2] + disp1[2],
        ];
        let current2 = [
            coords2[0] + disp2[0],
            coords2[1] + disp2[1],
            coords2[2] + disp2[2],
        ];

        // Gap in normal direction
        self.gap = (current2[0] - current1[0]) * self.normal[0]
            + (current2[1] - current1[1]) * self.normal[1]
            + (current2[2] - current1[2]) * self.normal[2];

        // Update status
        self.status = if self.gap > 0.0 {
            ContactStatus::Open
        } else {
            ContactStatus::Closed
        };
    }

    /// Get contact force (penalty method)
    pub fn contact_force(&self) -> f64 {
        if self.gap < 0.0 {
            -self.penalty_normal * self.gap
        } else {
            0.0
        }
    }

    /// Get contact stiffness contribution
    pub fn contact_stiffness(&self) -> f64 {
        if self.gap < 0.0 {
            self.penalty_normal
        } else {
            0.0
        }
    }
}

// ============================================================================
// GAP ELEMENT
// ============================================================================

/// Gap (compression-only) element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GapElement {
    pub id: usize,
    pub node1: usize,
    pub node2: usize,
    pub direction: [f64; 3],
    pub initial_gap: f64,
    pub stiffness: f64,
    pub is_active: bool,
}

impl GapElement {
    pub fn new(id: usize, node1: usize, node2: usize, direction: [f64; 3], stiffness: f64) -> Self {
        // Normalize direction
        let len = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let dir = if len > 1e-10 {
            [direction[0] / len, direction[1] / len, direction[2] / len]
        } else {
            [1.0, 0.0, 0.0]
        };

        GapElement {
            id,
            node1,
            node2,
            direction: dir,
            initial_gap: 0.0,
            stiffness,
            is_active: false,
        }
    }

    /// Check if gap is closed and update status
    pub fn update(&mut self, delta: f64) {
        // delta = relative displacement in gap direction
        self.is_active = delta < -self.initial_gap;
    }

    /// Get element stiffness (only when active)
    pub fn get_stiffness(&self) -> f64 {
        if self.is_active {
            self.stiffness
        } else {
            0.0
        }
    }

    /// Compute stiffness matrix (2 nodes, 3 DOF each)
    pub fn stiffness_matrix(&self) -> [[f64; 6]; 6] {
        let mut k = [[0.0; 6]; 6];

        if !self.is_active {
            return k;
        }

        let d = self.direction;
        let s = self.stiffness;

        // K = s * n * n^T (outer product)
        for i in 0..3 {
            for j in 0..3 {
                let val = s * d[i] * d[j];
                k[i][j] = val;
                k[i][j + 3] = -val;
                k[i + 3][j] = -val;
                k[i + 3][j + 3] = val;
            }
        }

        k
    }
}

// ============================================================================
// HOOK ELEMENT
// ============================================================================

/// Hook (tension-only) element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookElement {
    pub id: usize,
    pub node1: usize,
    pub node2: usize,
    pub direction: [f64; 3],
    pub slack: f64,
    pub stiffness: f64,
    pub is_active: bool,
}

impl HookElement {
    pub fn new(id: usize, node1: usize, node2: usize, direction: [f64; 3], stiffness: f64) -> Self {
        let len = (direction[0].powi(2) + direction[1].powi(2) + direction[2].powi(2)).sqrt();
        let dir = if len > 1e-10 {
            [direction[0] / len, direction[1] / len, direction[2] / len]
        } else {
            [1.0, 0.0, 0.0]
        };

        HookElement {
            id,
            node1,
            node2,
            direction: dir,
            slack: 0.0,
            stiffness,
            is_active: false,
        }
    }

    /// Update hook status based on elongation
    pub fn update(&mut self, elongation: f64) {
        self.is_active = elongation > self.slack;
    }

    /// Get element stiffness
    pub fn get_stiffness(&self) -> f64 {
        if self.is_active {
            self.stiffness
        } else {
            0.0
        }
    }

    /// Compute stiffness matrix
    pub fn stiffness_matrix(&self) -> [[f64; 6]; 6] {
        let mut k = [[0.0; 6]; 6];

        if !self.is_active {
            return k;
        }

        let d = self.direction;
        let s = self.stiffness;

        for i in 0..3 {
            for j in 0..3 {
                let val = s * d[i] * d[j];
                k[i][j] = val;
                k[i][j + 3] = -val;
                k[i + 3][j] = -val;
                k[i + 3][j + 3] = val;
            }
        }

        k
    }
}

// ============================================================================
// CONSTRAINT HANDLER
// ============================================================================

/// Unified constraint handler
pub struct ConstraintHandler {
    pub mpcs: Vec<MultiPointConstraint>,
    pub rigid_bodies: Vec<RigidBody>,
    pub contact_pairs: Vec<ContactPair>,
    pub gap_elements: Vec<GapElement>,
    pub hook_elements: Vec<HookElement>,
    pub method: EnforcementMethod,
    pub penalty_factor: f64,
}

impl Default for ConstraintHandler {
    fn default() -> Self {
        ConstraintHandler {
            mpcs: Vec::new(),
            rigid_bodies: Vec::new(),
            contact_pairs: Vec::new(),
            gap_elements: Vec::new(),
            hook_elements: Vec::new(),
            method: EnforcementMethod::Penalty,
            penalty_factor: 1e10,
        }
    }
}

impl ConstraintHandler {
    pub fn new() -> Self {
        ConstraintHandler::default()
    }

    pub fn add_mpc(&mut self, mpc: MultiPointConstraint) {
        self.mpcs.push(mpc);
    }

    pub fn add_rigid_body(&mut self, rb: RigidBody) {
        self.rigid_bodies.push(rb);
    }

    pub fn add_contact_pair(&mut self, cp: ContactPair) {
        self.contact_pairs.push(cp);
    }

    pub fn add_gap_element(&mut self, ge: GapElement) {
        self.gap_elements.push(ge);
    }

    pub fn add_hook_element(&mut self, he: HookElement) {
        self.hook_elements.push(he);
    }

    /// Apply penalty method to stiffness matrix
    pub fn apply_penalty_to_stiffness(&self, k: &mut Vec<f64>, n_dof: usize) {
        for mpc in &self.mpcs {
            // Add penalty: K += α * cᵀ * c
            for (i, &dof_i) in mpc.dof_indices.iter().enumerate() {
                for (j, &dof_j) in mpc.dof_indices.iter().enumerate() {
                    if dof_i < n_dof && dof_j < n_dof {
                        let penalty = self.penalty_factor * mpc.coefficients[i] * mpc.coefficients[j];
                        k[dof_i * n_dof + dof_j] += penalty;
                    }
                }
            }
        }
    }

    /// Apply penalty method to force vector
    pub fn apply_penalty_to_force(&self, f: &mut [f64]) {
        for mpc in &self.mpcs {
            // Add penalty force: F += α * c * constant
            for (i, &dof) in mpc.dof_indices.iter().enumerate() {
                if dof < f.len() {
                    f[dof] += self.penalty_factor * mpc.coefficients[i] * mpc.constant;
                }
            }
        }
    }

    /// Build transformation matrix for constraint elimination
    pub fn build_transformation_matrix(&self, n_dof: usize) -> (Vec<f64>, Vec<usize>) {
        // Returns transformation matrix T and retained DOFs
        // u = T * u_reduced

        let mut retained_dofs: Vec<usize> = (0..n_dof).collect();
        let mut eliminated_dofs = Vec::new();

        // Find slave DOFs to eliminate
        for mpc in &self.mpcs {
            if mpc.dof_indices.len() >= 2 && mpc.coefficients[0].abs() > 1e-10 {
                let slave_dof = mpc.dof_indices[0];
                if !eliminated_dofs.contains(&slave_dof) {
                    eliminated_dofs.push(slave_dof);
                }
            }
        }

        // Remove eliminated DOFs
        retained_dofs.retain(|d| !eliminated_dofs.contains(d));

        let n_retained = retained_dofs.len();
        let mut t = vec![0.0; n_dof * n_retained];

        // Identity for retained DOFs
        for (j, &dof) in retained_dofs.iter().enumerate() {
            t[dof * n_retained + j] = 1.0;
        }

        // Add constraint relationships for eliminated DOFs
        for mpc in &self.mpcs {
            if mpc.dof_indices.len() >= 2 && mpc.coefficients[0].abs() > 1e-10 {
                let slave_dof = mpc.dof_indices[0];
                let slave_coeff = mpc.coefficients[0];

                for k in 1..mpc.dof_indices.len() {
                    let master_dof = mpc.dof_indices[k];
                    if let Some(j) = retained_dofs.iter().position(|&d| d == master_dof) {
                        t[slave_dof * n_retained + j] = -mpc.coefficients[k] / slave_coeff;
                    }
                }
            }
        }

        (t, retained_dofs)
    }

    /// Update contact status for all pairs
    pub fn update_contact_status(&mut self, displacements: &[f64], coords: &[[f64; 3]]) {
        for pair in &mut self.contact_pairs {
            let node1 = pair.node1;
            let node2 = pair.node2;

            if node1 * 3 + 2 < displacements.len() && node2 * 3 + 2 < displacements.len() {
                let disp1 = [
                    displacements[node1 * 3],
                    displacements[node1 * 3 + 1],
                    displacements[node1 * 3 + 2],
                ];
                let disp2 = [
                    displacements[node2 * 3],
                    displacements[node2 * 3 + 1],
                    displacements[node2 * 3 + 2],
                ];

                pair.update_gap(coords[node1], coords[node2], disp1, disp2);
            }
        }
    }

    /// Get total constraint violation
    pub fn total_violation(&self, displacements: &[f64]) -> f64 {
        self.mpcs.iter()
            .map(|mpc| mpc.evaluate(displacements).abs())
            .sum()
    }
}

// ============================================================================
// LAGRANGE MULTIPLIER SYSTEM
// ============================================================================

/// Lagrange multiplier constraint system
pub struct LagrangeMultiplierSystem {
    pub constraints: Vec<MultiPointConstraint>,
    pub multipliers: Vec<f64>,
}

impl LagrangeMultiplierSystem {
    pub fn new(constraints: Vec<MultiPointConstraint>) -> Self {
        let n = constraints.len();
        LagrangeMultiplierSystem {
            constraints,
            multipliers: vec![0.0; n],
        }
    }

    /// Build augmented system [K C^T; C 0] * [u; λ] = [f; g]
    pub fn build_augmented_system(
        &self,
        k: &[f64],
        f: &[f64],
        n_dof: usize,
    ) -> (Vec<f64>, Vec<f64>) {
        let n_constraints = self.constraints.len();
        let n_total = n_dof + n_constraints;

        let mut k_aug = vec![0.0; n_total * n_total];
        let mut f_aug = vec![0.0; n_total];

        // Copy K into upper-left block
        for i in 0..n_dof {
            for j in 0..n_dof {
                k_aug[i * n_total + j] = k[i * n_dof + j];
            }
            f_aug[i] = f[i];
        }

        // Add constraint matrix C and C^T
        for (c, constraint) in self.constraints.iter().enumerate() {
            f_aug[n_dof + c] = constraint.constant;

            for (k, &dof) in constraint.dof_indices.iter().enumerate() {
                if dof < n_dof {
                    // C in lower-left
                    k_aug[(n_dof + c) * n_total + dof] = constraint.coefficients[k];
                    // C^T in upper-right
                    k_aug[dof * n_total + (n_dof + c)] = constraint.coefficients[k];
                }
            }
        }

        (k_aug, f_aug)
    }

    /// Extract displacements and multipliers from augmented solution
    pub fn extract_solution(&mut self, solution: &[f64], n_dof: usize) -> Vec<f64> {
        let displacements: Vec<f64> = solution[..n_dof].to_vec();

        self.multipliers = solution[n_dof..].to_vec();

        displacements
    }

    /// Get constraint reactions (Lagrange multipliers)
    pub fn get_constraint_reactions(&self) -> &[f64] {
        &self.multipliers
    }
}

// ============================================================================
// FRICTION MODEL
// ============================================================================

/// Coulomb friction model
#[derive(Debug, Clone)]
pub struct CoulombFriction {
    pub static_coeff: f64,
    pub kinetic_coeff: f64,
    pub velocity_threshold: f64,
}

impl Default for CoulombFriction {
    fn default() -> Self {
        CoulombFriction {
            static_coeff: 0.3,
            kinetic_coeff: 0.25,
            velocity_threshold: 1e-6,
        }
    }
}

impl CoulombFriction {
    /// Compute friction force given normal force and tangent velocity
    pub fn friction_force(&self, normal_force: f64, tangent_velocity: f64) -> f64 {
        if normal_force <= 0.0 {
            return 0.0;
        }

        let mu = if tangent_velocity.abs() < self.velocity_threshold {
            self.static_coeff
        } else {
            self.kinetic_coeff
        };

        let max_friction = mu * normal_force;
        let direction = if tangent_velocity >= 0.0 { -1.0 } else { 1.0 };

        direction * max_friction
    }

    /// Check if sliding occurs
    pub fn is_sliding(&self, normal_force: f64, applied_tangent_force: f64) -> bool {
        if normal_force <= 0.0 {
            return false;
        }
        applied_tangent_force.abs() > self.static_coeff * normal_force
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mpc_tie_dofs() {
        let mpc = MultiPointConstraint::tie_dofs(1, 0, 1);

        // u0 = u1 should be satisfied when both are equal
        let displacements = vec![1.0, 1.0, 0.0];
        assert!(mpc.is_satisfied(&displacements));

        // Should not be satisfied when different
        let displacements = vec![1.0, 2.0, 0.0];
        assert!(!mpc.is_satisfied(&displacements));
    }

    #[test]
    fn test_mpc_evaluate() {
        let mpc = MultiPointConstraint {
            id: 1,
            dof_indices: vec![0, 1, 2],
            coefficients: vec![1.0, 2.0, -1.0],
            constant: 3.0,
            tolerance: 1e-10,
        };

        // 1*u0 + 2*u1 - 1*u2 = 3
        let displacements = vec![1.0, 2.0, 2.0];
        let violation = mpc.evaluate(&displacements);
        // 1*1 + 2*2 - 1*2 - 3 = 1 + 4 - 2 - 3 = 0
        assert!((violation - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_gap_element() {
        let mut gap = GapElement::new(1, 0, 1, [1.0, 0.0, 0.0], 1e6);

        // Gap open (positive relative displacement)
        gap.update(0.1);
        assert!(!gap.is_active);
        assert_eq!(gap.get_stiffness(), 0.0);

        // Gap closed (negative relative displacement)
        gap.update(-0.1);
        assert!(gap.is_active);
        assert!((gap.get_stiffness() - 1e6).abs() < 1.0);
    }

    #[test]
    fn test_hook_element() {
        let mut hook = HookElement::new(1, 0, 1, [1.0, 0.0, 0.0], 1e6);

        // Hook slack (no tension)
        hook.update(-0.1);
        assert!(!hook.is_active);

        // Hook active (in tension)
        hook.update(0.1);
        assert!(hook.is_active);
    }

    #[test]
    fn test_contact_pair() {
        let mut contact = ContactPair::new(1, 0, 1, [0.0, 1.0, 0.0]);
        contact.penalty_normal = 1e6;

        // Initial position
        let coords1 = [0.0, 0.0, 0.0];
        let coords2 = [0.0, 0.1, 0.0];

        // No displacement - gap open
        contact.update_gap(coords1, coords2, [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]);
        assert_eq!(contact.status, ContactStatus::Open);

        // Displacement closes gap
        contact.update_gap(coords1, coords2, [0.0, 0.0, 0.0], [0.0, -0.2, 0.0]);
        assert_eq!(contact.status, ContactStatus::Closed);
        assert!(contact.contact_force() > 0.0);
    }

    #[test]
    fn test_constraint_handler() {
        let mut handler = ConstraintHandler::new();

        handler.add_mpc(MultiPointConstraint::tie_dofs(1, 0, 1));
        handler.add_gap_element(GapElement::new(1, 0, 1, [1.0, 0.0, 0.0], 1e6));

        assert_eq!(handler.mpcs.len(), 1);
        assert_eq!(handler.gap_elements.len(), 1);
    }

    #[test]
    fn test_coulomb_friction() {
        let friction = CoulombFriction::default();

        // No normal force = no friction
        assert_eq!(friction.friction_force(0.0, 1.0), 0.0);

        // Normal force with zero velocity (static)
        let f = friction.friction_force(100.0, 0.0);
        assert!((f.abs() - 30.0).abs() < 1.0); // μs * N = 0.3 * 100

        // Check sliding condition
        assert!(friction.is_sliding(100.0, 35.0));  // > μs * N
        assert!(!friction.is_sliding(100.0, 25.0)); // < μs * N
    }

    #[test]
    fn test_lagrange_multiplier_system() {
        let constraints = vec![
            MultiPointConstraint::tie_dofs(1, 0, 1),
        ];

        let system = LagrangeMultiplierSystem::new(constraints);

        let k = vec![1.0, 0.0, 0.0, 1.0]; // 2x2 identity
        let f = vec![1.0, 2.0];

        let (k_aug, f_aug) = system.build_augmented_system(&k, &f, 2);

        assert_eq!(k_aug.len(), 9); // 3x3
        assert_eq!(f_aug.len(), 3);
    }

    #[test]
    fn test_rigid_body_mpc_generation() {
        let rb = RigidBody::new(1, 0, vec![1]);

        let master_coords = [0.0, 0.0, 0.0];
        let slave_coords = [[1.0, 0.0, 0.0]];

        let mpcs = rb.generate_mpcs(master_coords, &slave_coords, 6);

        // Should generate 6 MPCs for all DOFs
        assert_eq!(mpcs.len(), 6);
    }
}
