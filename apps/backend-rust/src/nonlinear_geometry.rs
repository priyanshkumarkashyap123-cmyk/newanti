//! Nonlinear Geometry Analysis Module
//! 
//! Large displacement and finite rotation analysis:
//! - Corotational formulation
//! - Updated Lagrangian
//! - Total Lagrangian
//! - Follower forces
//! - Geometric stiffness matrix
//! - Arc-length methods

use serde::{Deserialize, Serialize};

/// Nonlinear geometry analyzer
#[derive(Debug, Clone)]
pub struct NonlinearGeometryAnalyzer {
    /// Analysis formulation
    pub formulation: GeometricFormulation,
    /// Solution parameters
    pub parameters: SolutionParameters,
    /// Current state
    pub state: AnalysisState,
}

/// Geometric formulation type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GeometricFormulation {
    /// Corotational - separates rigid body rotation
    Corotational,
    /// Updated Lagrangian - current config reference
    UpdatedLagrangian,
    /// Total Lagrangian - initial config reference
    TotalLagrangian,
}

/// Solution parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionParameters {
    /// Maximum iterations per step
    pub max_iterations: usize,
    /// Convergence tolerance (force)
    pub force_tolerance: f64,
    /// Convergence tolerance (displacement)
    pub displacement_tolerance: f64,
    /// Load increment
    pub load_factor_increment: f64,
    /// Arc-length parameter
    pub arc_length: Option<f64>,
    /// Line search enabled
    pub line_search: bool,
}

impl Default for SolutionParameters {
    fn default() -> Self {
        Self {
            max_iterations: 50,
            force_tolerance: 1e-6,
            displacement_tolerance: 1e-8,
            load_factor_increment: 0.1,
            arc_length: None,
            line_search: true,
        }
    }
}

/// Analysis state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisState {
    /// Current load factor
    pub load_factor: f64,
    /// Current displacement vector
    pub displacement: Vec<f64>,
    /// Current velocity (for dynamics)
    pub velocity: Option<Vec<f64>>,
    /// Converged flag
    pub converged: bool,
    /// Iteration count
    pub iterations: usize,
    /// Residual norm
    pub residual_norm: f64,
}

impl Default for AnalysisState {
    fn default() -> Self {
        Self {
            load_factor: 0.0,
            displacement: Vec::new(),
            velocity: None,
            converged: true,
            iterations: 0,
            residual_norm: 0.0,
        }
    }
}

impl NonlinearGeometryAnalyzer {
    /// Create new analyzer
    pub fn new(formulation: GeometricFormulation) -> Self {
        Self {
            formulation,
            parameters: SolutionParameters::default(),
            state: AnalysisState::default(),
        }
    }
    
    /// Initialize for analysis
    pub fn initialize(&mut self, ndof: usize) {
        self.state.displacement = vec![0.0; ndof];
        self.state.load_factor = 0.0;
        self.state.converged = true;
    }
}

/// Corotational frame element
#[derive(Debug, Clone)]
pub struct CorotationalBeam {
    /// Node 1 position (initial)
    pub node1_initial: [f64; 3],
    /// Node 2 position (initial)
    pub node2_initial: [f64; 3],
    /// Node 1 position (current)
    pub node1_current: [f64; 3],
    /// Node 2 position (current)
    pub node2_current: [f64; 3],
    /// Section properties
    pub properties: BeamProperties,
}

/// Beam section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamProperties {
    /// Area (m²)
    pub area: f64,
    /// Moment of inertia Iy (m⁴)
    pub iy: f64,
    /// Moment of inertia Iz (m⁴)
    pub iz: f64,
    /// Torsional constant J (m⁴)
    pub j: f64,
    /// Elastic modulus (Pa)
    pub e_modulus: f64,
    /// Shear modulus (Pa)
    pub g_modulus: f64,
}

impl CorotationalBeam {
    /// Create beam element
    pub fn new(
        node1: [f64; 3],
        node2: [f64; 3],
        properties: BeamProperties,
    ) -> Self {
        Self {
            node1_initial: node1,
            node2_initial: node2,
            node1_current: node1,
            node2_current: node2,
            properties,
        }
    }
    
    /// Get initial length
    pub fn initial_length(&self) -> f64 {
        let dx = self.node2_initial[0] - self.node1_initial[0];
        let dy = self.node2_initial[1] - self.node1_initial[1];
        let dz = self.node2_initial[2] - self.node1_initial[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Get current length
    pub fn current_length(&self) -> f64 {
        let dx = self.node2_current[0] - self.node1_current[0];
        let dy = self.node2_current[1] - self.node1_current[1];
        let dz = self.node2_current[2] - self.node1_current[2];
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Get axial strain
    pub fn axial_strain(&self) -> f64 {
        let l0 = self.initial_length();
        let l = self.current_length();
        (l - l0) / l0
    }
    
    /// Get Green-Lagrange axial strain
    pub fn green_lagrange_strain(&self) -> f64 {
        let l0 = self.initial_length();
        let l = self.current_length();
        0.5 * (l * l - l0 * l0) / (l0 * l0)
    }
    
    /// Update current configuration
    pub fn update_configuration(&mut self, displacements: &[f64]) {
        // Assuming displacements: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
        if displacements.len() >= 6 {
            self.node1_current[0] = self.node1_initial[0] + displacements[0];
            self.node1_current[1] = self.node1_initial[1] + displacements[1];
            self.node1_current[2] = self.node1_initial[2] + displacements[2];
        }
        if displacements.len() >= 12 {
            self.node2_current[0] = self.node2_initial[0] + displacements[6];
            self.node2_current[1] = self.node2_initial[1] + displacements[7];
            self.node2_current[2] = self.node2_initial[2] + displacements[8];
        }
    }
    
    /// Calculate corotational transformation matrix
    pub fn corotational_transform(&self) -> [[f64; 3]; 3] {
        let dx = self.node2_current[0] - self.node1_current[0];
        let dy = self.node2_current[1] - self.node1_current[1];
        let dz = self.node2_current[2] - self.node1_current[2];
        let l = self.current_length();
        
        // Local x-axis along element
        let e1 = [dx / l, dy / l, dz / l];
        
        // Choose reference vector for y-axis
        let ref_vec = if e1[2].abs() < 0.9 {
            [0.0, 0.0, 1.0]
        } else {
            [1.0, 0.0, 0.0]
        };
        
        // e2 = ref × e1 (normalized)
        let e2_raw = [
            ref_vec[1] * e1[2] - ref_vec[2] * e1[1],
            ref_vec[2] * e1[0] - ref_vec[0] * e1[2],
            ref_vec[0] * e1[1] - ref_vec[1] * e1[0],
        ];
        let norm2 = (e2_raw[0] * e2_raw[0] + e2_raw[1] * e2_raw[1] + e2_raw[2] * e2_raw[2]).sqrt();
        let e2 = [e2_raw[0] / norm2, e2_raw[1] / norm2, e2_raw[2] / norm2];
        
        // e3 = e1 × e2
        let e3 = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0],
        ];
        
        [e1, e2, e3]
    }
    
    /// Calculate local elastic stiffness
    pub fn local_elastic_stiffness(&self) -> [[f64; 12]; 12] {
        let l = self.current_length();
        let e = self.properties.e_modulus;
        let g = self.properties.g_modulus;
        let a = self.properties.area;
        let iy = self.properties.iy;
        let iz = self.properties.iz;
        let j = self.properties.j;
        
        let ea_l = e * a / l;
        let gj_l = g * j / l;
        let ei_y = e * iy;
        let ei_z = e * iz;
        
        // Beam stiffness coefficients
        let k_y_12 = 12.0 * ei_y / (l * l * l);
        let k_y_6 = 6.0 * ei_y / (l * l);
        let k_y_4 = 4.0 * ei_y / l;
        let k_y_2 = 2.0 * ei_y / l;
        
        let k_z_12 = 12.0 * ei_z / (l * l * l);
        let k_z_6 = 6.0 * ei_z / (l * l);
        let k_z_4 = 4.0 * ei_z / l;
        let k_z_2 = 2.0 * ei_z / l;
        
        // Build symmetric stiffness matrix
        let mut k = [[0.0; 12]; 12];
        
        // Axial terms
        k[0][0] = ea_l;
        k[6][6] = ea_l;
        k[0][6] = -ea_l;
        k[6][0] = -ea_l;
        
        // Bending about y
        k[2][2] = k_y_12;
        k[8][8] = k_y_12;
        k[2][8] = -k_y_12;
        k[8][2] = -k_y_12;
        
        k[4][4] = k_y_4;
        k[10][10] = k_y_4;
        k[4][10] = k_y_2;
        k[10][4] = k_y_2;
        
        k[2][4] = k_y_6;
        k[4][2] = k_y_6;
        k[2][10] = k_y_6;
        k[10][2] = k_y_6;
        k[8][4] = -k_y_6;
        k[4][8] = -k_y_6;
        k[8][10] = -k_y_6;
        k[10][8] = -k_y_6;
        
        // Bending about z
        k[1][1] = k_z_12;
        k[7][7] = k_z_12;
        k[1][7] = -k_z_12;
        k[7][1] = -k_z_12;
        
        k[5][5] = k_z_4;
        k[11][11] = k_z_4;
        k[5][11] = k_z_2;
        k[11][5] = k_z_2;
        
        k[1][5] = -k_z_6;
        k[5][1] = -k_z_6;
        k[1][11] = -k_z_6;
        k[11][1] = -k_z_6;
        k[7][5] = k_z_6;
        k[5][7] = k_z_6;
        k[7][11] = k_z_6;
        k[11][7] = k_z_6;
        
        // Torsion
        k[3][3] = gj_l;
        k[9][9] = gj_l;
        k[3][9] = -gj_l;
        k[9][3] = -gj_l;
        
        k
    }
    
    /// Calculate geometric stiffness matrix
    pub fn geometric_stiffness(&self, axial_force: f64) -> [[f64; 12]; 12] {
        let l = self.current_length();
        let p = axial_force;
        
        let mut kg = [[0.0; 12]; 12];
        
        // Geometric stiffness coefficients
        let c1 = p / l;
        let c2 = p * l / 30.0;
        let c3 = p / 10.0;
        
        // Lateral displacements
        kg[1][1] = 6.0 * c1 / 5.0;
        kg[7][7] = 6.0 * c1 / 5.0;
        kg[1][7] = -6.0 * c1 / 5.0;
        kg[7][1] = -6.0 * c1 / 5.0;
        
        kg[2][2] = 6.0 * c1 / 5.0;
        kg[8][8] = 6.0 * c1 / 5.0;
        kg[2][8] = -6.0 * c1 / 5.0;
        kg[8][2] = -6.0 * c1 / 5.0;
        
        // Rotations
        kg[4][4] = 2.0 * c2;
        kg[10][10] = 2.0 * c2;
        kg[4][10] = -c2;
        kg[10][4] = -c2;
        
        kg[5][5] = 2.0 * c2;
        kg[11][11] = 2.0 * c2;
        kg[5][11] = -c2;
        kg[11][5] = -c2;
        
        // Coupling
        kg[1][5] = c3;
        kg[5][1] = c3;
        kg[1][11] = -c3;
        kg[11][1] = -c3;
        kg[7][5] = -c3;
        kg[5][7] = -c3;
        kg[7][11] = c3;
        kg[11][7] = c3;
        
        kg[2][4] = -c3;
        kg[4][2] = -c3;
        kg[2][10] = c3;
        kg[10][2] = c3;
        kg[8][4] = c3;
        kg[4][8] = c3;
        kg[8][10] = -c3;
        kg[10][8] = -c3;
        
        kg
    }
    
    /// Calculate internal force vector
    pub fn internal_forces(&self) -> [f64; 12] {
        let e = self.properties.e_modulus;
        let a = self.properties.area;
        let _l0 = self.initial_length();
        let _l = self.current_length();
        
        // Axial force (using Green-Lagrange strain)
        let eps = self.green_lagrange_strain();
        let axial_force = e * a * eps;
        
        // Get transformation
        let r = self.corotational_transform();
        
        // Local forces (simplified - axial only for now)
        let f_local = [-axial_force, 0.0, 0.0, 0.0, 0.0, 0.0, axial_force, 0.0, 0.0, 0.0, 0.0, 0.0];
        
        // Transform to global (simplified)
        let mut f_global = [0.0; 12];
        for i in 0..3 {
            f_global[i] = r[0][i] * f_local[0];
            f_global[i + 6] = r[0][i] * f_local[6];
        }
        
        f_global
    }
}

/// Arc-length method solver
#[derive(Debug, Clone)]
pub struct ArcLengthSolver {
    /// Arc-length parameter
    pub delta_l: f64,
    /// Constraint type
    pub constraint: ArcLengthConstraint,
    /// Scaling factor for rotations
    pub rotation_scale: f64,
    /// History of converged points
    pub history: Vec<ConvergedPoint>,
}

/// Arc-length constraint type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ArcLengthConstraint {
    /// Spherical (Crisfield)
    Spherical,
    /// Cylindrical (Riks)
    Cylindrical,
    /// Updated normal plane
    UpdatedNormalPlane,
}

/// Converged point on equilibrium path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergedPoint {
    /// Load factor
    pub lambda: f64,
    /// Displacement vector
    pub displacement: Vec<f64>,
    /// Incremental work
    pub incremental_work: f64,
}

impl ArcLengthSolver {
    /// Create new solver
    pub fn new(delta_l: f64) -> Self {
        Self {
            delta_l,
            constraint: ArcLengthConstraint::Spherical,
            rotation_scale: 1.0,
            history: Vec::new(),
        }
    }
    
    /// Calculate arc-length constraint
    pub fn arc_constraint(
        &self,
        delta_u: &[f64],
        delta_lambda: f64,
        u_ref: &[f64],
    ) -> f64 {
        let mut sum_u_sq = 0.0;
        for du in delta_u {
            sum_u_sq += du * du;
        }
        
        match self.constraint {
            ArcLengthConstraint::Spherical => {
                let f_ref_sq: f64 = u_ref.iter().map(|x| x * x).sum();
                sum_u_sq + delta_lambda * delta_lambda * f_ref_sq - self.delta_l * self.delta_l
            }
            ArcLengthConstraint::Cylindrical => {
                sum_u_sq - self.delta_l * self.delta_l
            }
            ArcLengthConstraint::UpdatedNormalPlane => {
                // Using previous displacement increment as normal
                if let Some(last) = self.history.last() {
                    let dot: f64 = delta_u.iter().zip(&last.displacement).map(|(a, b)| a * b).sum();
                    dot
                } else {
                    sum_u_sq - self.delta_l * self.delta_l
                }
            }
        }
    }
    
    /// Solve quadratic for load factor increment
    pub fn solve_quadratic(
        &self,
        a: f64,
        b: f64,
        c: f64,
        delta_u_t: &[f64],
        delta_u_prev: &[f64],
        delta_lambda_prev: f64,
    ) -> Option<f64> {
        let discriminant = b * b - 4.0 * a * c;
        
        if discriminant < 0.0 {
            return None;
        }
        
        let sqrt_d = discriminant.sqrt();
        let sol1 = (-b + sqrt_d) / (2.0 * a);
        let sol2 = (-b - sqrt_d) / (2.0 * a);
        
        // Choose solution that gives positive work (forward progress)
        let work1: f64 = delta_u_t.iter().zip(delta_u_prev).map(|(a, b)| a * b).sum();
        let _work2 = work1; // Same for both solutions in this simplified case
        
        // Prefer solution that continues in same direction
        if delta_lambda_prev >= 0.0 {
            Some(sol1.max(sol2))
        } else {
            Some(sol1.min(sol2))
        }
    }
    
    /// Record converged point
    pub fn record_point(&mut self, lambda: f64, displacement: Vec<f64>) {
        let work = if let Some(last) = self.history.last() {
            let d_lambda = lambda - last.lambda;
            let d_u: f64 = displacement.iter().zip(&last.displacement)
                .map(|(a, b)| (a - b).abs())
                .sum();
            d_lambda * d_u
        } else {
            0.0
        };
        
        self.history.push(ConvergedPoint {
            lambda,
            displacement,
            incremental_work: work,
        });
    }
}

/// Follower load (pressure that follows surface)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowerLoad {
    /// Load magnitude
    pub magnitude: f64,
    /// Initial direction
    pub initial_direction: [f64; 3],
    /// Load type
    pub load_type: FollowerLoadType,
}

/// Follower load type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FollowerLoadType {
    /// Pressure (normal to surface)
    Pressure,
    /// Point load (rotates with element)
    PointLoad,
    /// Moment (follows rotation)
    Moment,
}

impl FollowerLoad {
    /// Create pressure load
    pub fn pressure(magnitude: f64) -> Self {
        Self {
            magnitude,
            initial_direction: [0.0, 0.0, 1.0],
            load_type: FollowerLoadType::Pressure,
        }
    }
    
    /// Calculate current direction after rotation
    pub fn current_direction(&self, rotation_matrix: &[[f64; 3]; 3]) -> [f64; 3] {
        let d = &self.initial_direction;
        let r = rotation_matrix;
        
        [
            r[0][0] * d[0] + r[0][1] * d[1] + r[0][2] * d[2],
            r[1][0] * d[0] + r[1][1] * d[1] + r[1][2] * d[2],
            r[2][0] * d[0] + r[2][1] * d[1] + r[2][2] * d[2],
        ]
    }
    
    /// Calculate load vector contribution
    pub fn load_vector(&self, rotation_matrix: &[[f64; 3]; 3], area: f64) -> [f64; 3] {
        let dir = self.current_direction(rotation_matrix);
        let mag = self.magnitude * area;
        
        [mag * dir[0], mag * dir[1], mag * dir[2]]
    }
    
    /// Calculate load stiffness (for tangent)
    pub fn load_stiffness(&self, area: f64) -> [[f64; 3]; 3] {
        // Simplified - skew-symmetric part
        let p = self.magnitude * area;
        let d = &self.initial_direction;
        
        [
            [0.0, -p * d[2], p * d[1]],
            [p * d[2], 0.0, -p * d[0]],
            [-p * d[1], p * d[0], 0.0],
        ]
    }
}

/// Finite rotation handler
#[derive(Debug, Clone)]
pub struct FiniteRotation {
    /// Rotation vector (axis-angle)
    pub rotation_vector: [f64; 3],
}

impl FiniteRotation {
    /// Create from rotation vector
    pub fn from_vector(rv: [f64; 3]) -> Self {
        Self { rotation_vector: rv }
    }
    
    /// Create identity rotation
    pub fn identity() -> Self {
        Self { rotation_vector: [0.0, 0.0, 0.0] }
    }
    
    /// Get rotation angle
    pub fn angle(&self) -> f64 {
        let rv = &self.rotation_vector;
        (rv[0] * rv[0] + rv[1] * rv[1] + rv[2] * rv[2]).sqrt()
    }
    
    /// Get rotation axis
    pub fn axis(&self) -> [f64; 3] {
        let theta = self.angle();
        if theta < 1e-12 {
            [1.0, 0.0, 0.0] // Default axis
        } else {
            [
                self.rotation_vector[0] / theta,
                self.rotation_vector[1] / theta,
                self.rotation_vector[2] / theta,
            ]
        }
    }
    
    /// Convert to rotation matrix (Rodrigues formula)
    pub fn to_matrix(&self) -> [[f64; 3]; 3] {
        let theta = self.angle();
        
        if theta < 1e-12 {
            return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        }
        
        let n = self.axis();
        let s = theta.sin();
        let c = theta.cos();
        let c1 = 1.0 - c;
        
        [
            [c + n[0] * n[0] * c1, n[0] * n[1] * c1 - n[2] * s, n[0] * n[2] * c1 + n[1] * s],
            [n[1] * n[0] * c1 + n[2] * s, c + n[1] * n[1] * c1, n[1] * n[2] * c1 - n[0] * s],
            [n[2] * n[0] * c1 - n[1] * s, n[2] * n[1] * c1 + n[0] * s, c + n[2] * n[2] * c1],
        ]
    }
    
    /// Compose rotations (multiplicative update)
    pub fn compose(&self, delta: &FiniteRotation) -> FiniteRotation {
        let r1 = self.to_matrix();
        let r2 = delta.to_matrix();
        
        // R = R2 * R1
        let mut r = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    r[i][j] += r2[i][k] * r1[k][j];
                }
            }
        }
        
        // Extract rotation vector from matrix
        Self::from_matrix(&r)
    }
    
    /// Extract rotation vector from matrix
    pub fn from_matrix(r: &[[f64; 3]; 3]) -> FiniteRotation {
        let trace = r[0][0] + r[1][1] + r[2][2];
        let cos_theta = (trace - 1.0) / 2.0;
        let theta = cos_theta.clamp(-1.0, 1.0).acos();
        
        if theta.abs() < 1e-12 {
            return Self::identity();
        }
        
        let s = theta.sin();
        let factor = theta / (2.0 * s);
        
        let rv = [
            factor * (r[2][1] - r[1][2]),
            factor * (r[0][2] - r[2][0]),
            factor * (r[1][0] - r[0][1]),
        ];
        
        Self { rotation_vector: rv }
    }
    
    /// Calculate tangent operator (for linearization)
    pub fn tangent_operator(&self) -> [[f64; 3]; 3] {
        let theta = self.angle();
        
        if theta < 1e-12 {
            return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        }
        
        let n = self.axis();
        let s = theta.sin();
        let c = theta.cos();
        
        let c1 = (1.0 - c) / (theta * theta);
        let c2 = (theta - s) / (theta * theta * theta);
        
        // T = I + c1 * S + c2 * S^2
        // where S is skew-symmetric matrix of rotation vector
        let mut t = [[0.0; 3]; 3];
        t[0][0] = 1.0 - c1 * (n[1] * n[1] + n[2] * n[2]) * theta * theta;
        t[1][1] = 1.0 - c1 * (n[0] * n[0] + n[2] * n[2]) * theta * theta;
        t[2][2] = 1.0 - c1 * (n[0] * n[0] + n[1] * n[1]) * theta * theta;
        
        t[0][1] = c1 * n[0] * n[1] * theta * theta - c2 * n[2] * theta * theta * theta;
        t[1][0] = c1 * n[0] * n[1] * theta * theta + c2 * n[2] * theta * theta * theta;
        
        t[0][2] = c1 * n[0] * n[2] * theta * theta + c2 * n[1] * theta * theta * theta;
        t[2][0] = c1 * n[0] * n[2] * theta * theta - c2 * n[1] * theta * theta * theta;
        
        t[1][2] = c1 * n[1] * n[2] * theta * theta - c2 * n[0] * theta * theta * theta;
        t[2][1] = c1 * n[1] * n[2] * theta * theta + c2 * n[0] * theta * theta * theta;
        
        t
    }
}

/// Line search for convergence improvement
#[derive(Debug, Clone)]
pub struct LineSearch {
    /// Maximum iterations
    pub max_iterations: usize,
    /// Tolerance
    pub tolerance: f64,
    /// Minimum step
    pub min_step: f64,
    /// Maximum step
    pub max_step: f64,
}

impl Default for LineSearch {
    fn default() -> Self {
        Self {
            max_iterations: 10,
            tolerance: 0.8,
            min_step: 0.1,
            max_step: 2.0,
        }
    }
}

impl LineSearch {
    /// Perform line search
    pub fn search<F>(&self, mut energy_func: F, initial_energy: f64) -> f64
    where
        F: FnMut(f64) -> f64,
    {
        let mut step = 1.0;
        
        for _ in 0..self.max_iterations {
            let energy = energy_func(step);
            
            if energy < self.tolerance * initial_energy {
                return step;
            }
            
            // Bisection
            step *= 0.5;
            
            if step < self.min_step {
                return self.min_step;
            }
        }
        
        step.clamp(self.min_step, self.max_step)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;
    
    #[test]
    fn test_analyzer_creation() {
        let analyzer = NonlinearGeometryAnalyzer::new(GeometricFormulation::Corotational);
        assert_eq!(analyzer.formulation, GeometricFormulation::Corotational);
    }
    
    #[test]
    fn test_analyzer_initialization() {
        let mut analyzer = NonlinearGeometryAnalyzer::new(GeometricFormulation::UpdatedLagrangian);
        analyzer.initialize(12);
        
        assert_eq!(analyzer.state.displacement.len(), 12);
        assert!(analyzer.state.converged);
    }
    
    #[test]
    fn test_beam_lengths() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        
        assert!((beam.initial_length() - 5.0).abs() < 1e-10);
        assert!((beam.current_length() - 5.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_beam_strain() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let mut beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        
        // Apply 1% elongation
        beam.node2_current = [5.05, 0.0, 0.0];
        
        let eps = beam.axial_strain();
        assert!((eps - 0.01).abs() < 1e-6);
    }
    
    #[test]
    fn test_green_lagrange_strain() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let mut beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        beam.node2_current = [5.05, 0.0, 0.0];
        
        let eps_gl = beam.green_lagrange_strain();
        let eps = beam.axial_strain();
        
        // For small strain, GL ≈ engineering strain
        assert!((eps_gl - eps).abs() < 0.001);
    }
    
    #[test]
    fn test_corotational_transform() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        let r = beam.corotational_transform();
        
        // x-axis should be along beam
        assert!((r[0][0] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_elastic_stiffness() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        let k = beam.local_elastic_stiffness();
        
        // Check symmetry
        for i in 0..12 {
            for j in 0..12 {
                assert!((k[i][j] - k[j][i]).abs() < 1e-6);
            }
        }
        
        // Axial stiffness
        let ea_l = 200e9 * 0.01 / 5.0;
        assert!((k[0][0] - ea_l).abs() < 1.0);
    }
    
    #[test]
    fn test_geometric_stiffness() {
        let props = BeamProperties {
            area: 0.01,
            iy: 1e-4,
            iz: 1e-4,
            j: 2e-4,
            e_modulus: 200e9,
            g_modulus: 80e9,
        };
        
        let beam = CorotationalBeam::new([0.0, 0.0, 0.0], [5.0, 0.0, 0.0], props);
        let kg = beam.geometric_stiffness(1000.0);
        
        // Check symmetry
        for i in 0..12 {
            for j in 0..12 {
                assert!((kg[i][j] - kg[j][i]).abs() < 1e-6);
            }
        }
    }
    
    #[test]
    fn test_arc_length_solver() {
        let solver = ArcLengthSolver::new(0.1);
        assert!((solver.delta_l - 0.1).abs() < 1e-10);
    }
    
    #[test]
    fn test_arc_constraint() {
        let solver = ArcLengthSolver::new(0.1);
        
        let delta_u = vec![0.05, 0.05];
        let u_ref = vec![1.0, 1.0];
        
        let constraint = solver.arc_constraint(&delta_u, 0.05, &u_ref);
        
        // Should be close to 0 if on arc
        assert!(constraint.abs() < 1.0);
    }
    
    #[test]
    fn test_follower_load() {
        let load = FollowerLoad::pressure(1000.0);
        assert_eq!(load.load_type, FollowerLoadType::Pressure);
    }
    
    #[test]
    fn test_follower_current_direction() {
        let load = FollowerLoad::pressure(1000.0);
        
        // Identity rotation
        let r = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let dir = load.current_direction(&r);
        
        assert!((dir[2] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_finite_rotation_identity() {
        let rot = FiniteRotation::identity();
        let r = rot.to_matrix();
        
        assert!((r[0][0] - 1.0).abs() < 1e-10);
        assert!((r[1][1] - 1.0).abs() < 1e-10);
        assert!((r[2][2] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_finite_rotation_90_deg() {
        let rot = FiniteRotation::from_vector([0.0, 0.0, PI / 2.0]);
        let r = rot.to_matrix();
        
        // 90° rotation about z-axis
        assert!((r[0][0]).abs() < 1e-10);
        assert!((r[0][1] - (-1.0)).abs() < 1e-10);
        assert!((r[1][0] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_rotation_composition() {
        let rot1 = FiniteRotation::from_vector([0.0, 0.0, PI / 4.0]);
        let rot2 = FiniteRotation::from_vector([0.0, 0.0, PI / 4.0]);
        
        let composed = rot1.compose(&rot2);
        let angle = composed.angle();
        
        // Should be ~90 degrees
        assert!((angle - PI / 2.0).abs() < 0.1);
    }
    
    #[test]
    fn test_line_search() {
        let ls = LineSearch::default();
        
        // Simple quadratic energy
        let step = ls.search(|s| (s - 1.0).powi(2), 1.0);
        
        assert!(step >= ls.min_step);
        assert!(step <= ls.max_step);
    }
    
    #[test]
    fn test_solution_parameters() {
        let params = SolutionParameters::default();
        assert_eq!(params.max_iterations, 50);
    }
    
    #[test]
    fn test_formulation_types() {
        assert_ne!(GeometricFormulation::Corotational, GeometricFormulation::TotalLagrangian);
    }
}
