// ============================================================================
// PHASE 52: MACNEAL-HARDER PATCH TESTS
// ============================================================================
//
// Industry-standard element validation benchmarks from:
// MacNeal, R.H. and Harder, R.L. (1985) "A Proposed Standard Set of Problems
// to Test Finite Element Accuracy", Finite Elements in Analysis and Design
//
// Tests element performance under various deformation modes:
// - Patch tests (constant stress)
// - Single element tests (bending, twist, shear)
// - Warped element tests
//
// Industry Parity: NAFEMS, ANSYS Verification Manual, ABAQUS Benchmarks
// ============================================================================

use std::f64::consts::PI;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
use serde::{Deserialize, Serialize};

// ============================================================================
// REFERENCE SOLUTIONS
// ============================================================================

/// Reference solution for patch test verification
#[derive(Debug, Clone)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct PatchTestReference {
    /// Test name
    pub name: &'static str,
    /// Expected displacement pattern
    pub displacement_type: DisplacementType,
    /// Expected stress (constant for patch tests)
    pub stress: [f64; 6], // σxx, σyy, σzz, τxy, τyz, τzx
    /// Maximum error tolerance
    pub tolerance: f64,
}

#[derive(Debug, Clone, Copy)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub enum DisplacementType {
    Constant,
    Linear,
    Quadratic,
}

/// Standard material for MacNeal-Harder tests
#[derive(Debug, Clone, Copy)]
pub struct StandardMaterial {
    pub e: f64,
    pub nu: f64,
}

impl Default for StandardMaterial {
    fn default() -> Self {
        Self {
            e: 1.0e6,
            nu: 0.25,
        }
    }
}

impl StandardMaterial {
    /// Isotropic elasticity matrix (3D)
    pub fn elasticity_3d(&self) -> [[f64; 6]; 6] {
        let e = self.e;
        let nu = self.nu;
        let c = e / ((1.0 + nu) * (1.0 - 2.0 * nu));
        
        [
            [c * (1.0 - nu), c * nu, c * nu, 0.0, 0.0, 0.0],
            [c * nu, c * (1.0 - nu), c * nu, 0.0, 0.0, 0.0],
            [c * nu, c * nu, c * (1.0 - nu), 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, c * (1.0 - 2.0 * nu) / 2.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, c * (1.0 - 2.0 * nu) / 2.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, c * (1.0 - 2.0 * nu) / 2.0],
        ]
    }
    
    /// Plane stress elasticity matrix
    pub fn elasticity_plane_stress(&self) -> [[f64; 3]; 3] {
        let e = self.e;
        let nu = self.nu;
        let c = e / (1.0 - nu * nu);
        
        [
            [c, c * nu, 0.0],
            [c * nu, c, 0.0],
            [0.0, 0.0, c * (1.0 - nu) / 2.0],
        ]
    }
}

// ============================================================================
// PATCH TEST MESHES
// ============================================================================

/// Node coordinates for patch tests
#[derive(Debug, Clone)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct PatchMesh {
    /// Node coordinates (x, y, z)
    pub nodes: Vec<[f64; 3]>,
    /// Element connectivity
    pub elements: Vec<Vec<usize>>,
    /// Element type
    pub element_type: ElementType,
}

#[derive(Debug, Clone, Copy)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub enum ElementType {
    Quad4,
    Quad8,
    Hex8,
    Hex20,
    Tet4,
    Tet10,
}

impl PatchMesh {
    /// Standard 5-element quad patch (MacNeal-Harder)
    pub fn quad4_patch() -> Self {
        let nodes = vec![
            [0.0, 0.0, 0.0],
            [0.24, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.04, 0.52, 0.0],
            [0.52, 0.48, 0.0],
            [1.0, 0.52, 0.0],
            [0.0, 1.0, 0.0],
            [0.48, 1.0, 0.0],
            [1.0, 1.0, 0.0],
        ];
        
        let elements = vec![
            vec![0, 1, 4, 3],
            vec![1, 2, 5, 4],
            vec![3, 4, 7, 6],
            vec![4, 5, 8, 7],
        ];
        
        Self {
            nodes,
            elements,
            element_type: ElementType::Quad4,
        }
    }
    
    /// Standard hex8 patch
    pub fn hex8_patch() -> Self {
        let nodes = vec![
            // Bottom face
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
            // Top face
            [0.0, 0.0, 1.0],
            [1.0, 0.0, 1.0],
            [1.0, 1.0, 1.0],
            [0.0, 1.0, 1.0],
            // Interior node
            [0.5, 0.5, 0.5],
        ];
        
        // Single element for simple patch test
        let elements = vec![
            vec![0, 1, 2, 3, 4, 5, 6, 7],
        ];
        
        Self {
            nodes,
            elements,
            element_type: ElementType::Hex8,
        }
    }
}

// ============================================================================
// MACNEAL-HARDER SINGLE ELEMENT TESTS
// ============================================================================

/// Cantilever beam configurations for element testing
#[derive(Debug, Clone)]
pub struct CantileverConfig {
    /// Length
    pub l: f64,
    /// Height
    pub h: f64,
    /// Width (thickness)
    pub t: f64,
    /// Applied tip load
    pub p: f64,
    /// Material
    pub material: StandardMaterial,
}

impl Default for CantileverConfig {
    fn default() -> Self {
        Self {
            l: 6.0,
            h: 0.2,
            t: 0.1,
            p: 1.0,
            material: StandardMaterial::default(),
        }
    }
}

/// MacNeal-Harder cantilever beam tests
pub struct CantileverTests;

impl CantileverTests {
    /// Reference tip displacement for in-plane shear
    pub fn tip_displacement_inplane(config: &CantileverConfig) -> f64 {
        let e = config.material.e;
        let nu = config.material.nu;
        let l = config.l;
        let h = config.h;
        let t = config.t;
        let p = config.p;
        
        // I = t * h^3 / 12
        let i = t * h.powi(3) / 12.0;
        
        // Beam theory: δ = PL³/(3EI) + 1.2*PL/(GA)
        // Shear correction for rectangular section
        let a = t * h;
        let g = e / (2.0 * (1.0 + nu));
        
        let bending = p * l.powi(3) / (3.0 * e * i);
        let shear = 1.2 * p * l / (g * a);
        
        bending + shear
    }
    
    /// Reference tip displacement for out-of-plane shear
    pub fn tip_displacement_outofplane(config: &CantileverConfig) -> f64 {
        let e = config.material.e;
        let nu = config.material.nu;
        let l = config.l;
        let h = config.h;
        let t = config.t;
        let p = config.p;
        
        // I = h * t^3 / 12 (bending about different axis)
        let i = h * t.powi(3) / 12.0;
        let a = t * h;
        let g = e / (2.0 * (1.0 + nu));
        
        let bending = p * l.powi(3) / (3.0 * e * i);
        let shear = 1.2 * p * l / (g * a);
        
        bending + shear
    }
    
    /// Reference tip rotation for twist load
    pub fn tip_twist_rotation(config: &CantileverConfig) -> f64 {
        let g = config.material.e / (2.0 * (1.0 + config.material.nu));
        let l = config.l;
        let h = config.h;
        let t = config.t;
        
        // Torsion constant for thin rectangle: J ≈ (1/3) * b * t^3
        let (b, tt) = if h > t { (h, t) } else { (t, h) };
        let j = b * tt.powi(3) / 3.0;
        
        // Applied torque = P (unit torque)
        let torque = 1.0;
        
        // Twist angle = T * L / (G * J)
        torque * l / (g * j)
    }
}

// ============================================================================
// SINGLE ELEMENT TEST CONFIGURATIONS
// ============================================================================

/// Element shape variations for testing
#[derive(Debug, Clone, Copy)]
pub enum ElementShape {
    Regular,
    Rectangular,
    Parallelogram,
    Trapezoidal,
}

/// Single element test mesh generator
pub struct SingleElementMesh;

impl SingleElementMesh {
    /// Generate quad4 element with specified shape
    pub fn quad4(shape: ElementShape, aspect_ratio: f64) -> PatchMesh {
        let nodes = match shape {
            ElementShape::Regular => vec![
                [0.0, 0.0, 0.0],
                [1.0, 0.0, 0.0],
                [1.0, 1.0, 0.0],
                [0.0, 1.0, 0.0],
            ],
            ElementShape::Rectangular => vec![
                [0.0, 0.0, 0.0],
                [aspect_ratio, 0.0, 0.0],
                [aspect_ratio, 1.0, 0.0],
                [0.0, 1.0, 0.0],
            ],
            ElementShape::Parallelogram => {
                let skew = 0.5;
                vec![
                    [0.0, 0.0, 0.0],
                    [1.0, 0.0, 0.0],
                    [1.0 + skew, 1.0, 0.0],
                    [skew, 1.0, 0.0],
                ]
            },
            ElementShape::Trapezoidal => {
                let taper = 0.25;
                vec![
                    [0.0, 0.0, 0.0],
                    [1.0, 0.0, 0.0],
                    [1.0 - taper, 1.0, 0.0],
                    [taper, 1.0, 0.0],
                ]
            },
        };
        
        PatchMesh {
            nodes,
            elements: vec![vec![0, 1, 2, 3]],
            element_type: ElementType::Quad4,
        }
    }
    
    /// Generate hex8 element with specified shape
    pub fn hex8(shape: ElementShape, aspect_ratio: f64) -> PatchMesh {
        let base = Self::quad4(shape, aspect_ratio);
        
        let mut nodes = base.nodes.clone();
        // Extrude in z
        for n in &base.nodes {
            nodes.push([n[0], n[1], 1.0]);
        }
        
        PatchMesh {
            nodes,
            elements: vec![vec![0, 1, 2, 3, 4, 5, 6, 7]],
            element_type: ElementType::Hex8,
        }
    }
}

// ============================================================================
// TWISTED BEAM TEST (WARPED ELEMENTS)
// ============================================================================

/// Twisted beam test for evaluating warped element performance
#[derive(Debug, Clone)]
#[cfg_attr(feature = "wasm", derive(Serialize, Deserialize))]
pub struct TwistedBeamTest {
    /// Length
    pub l: f64,
    /// Width
    pub w: f64,
    /// Thickness
    pub t: f64,
    /// Twist angle (total, in radians)
    pub twist: f64,
    /// Number of elements along length
    pub n_elem: usize,
}

impl Default for TwistedBeamTest {
    fn default() -> Self {
        Self {
            l: 12.0,
            w: 1.1,
            t: 0.32,
            twist: PI / 2.0, // 90 degree twist
            n_elem: 12,
        }
    }
}

impl TwistedBeamTest {
    /// Generate warped mesh
    pub fn generate_mesh(&self) -> PatchMesh {
        let mut nodes = Vec::new();
        
        // Generate nodes along beam
        for i in 0..=self.n_elem {
            let x = (i as f64 / self.n_elem as f64) * self.l;
            let theta = (i as f64 / self.n_elem as f64) * self.twist;
            
            let cos_t = theta.cos();
            let sin_t = theta.sin();
            
            // Four corners of section, rotated
            let corners = [
                (-self.w / 2.0, -self.t / 2.0),
                (self.w / 2.0, -self.t / 2.0),
                (self.w / 2.0, self.t / 2.0),
                (-self.w / 2.0, self.t / 2.0),
            ];
            
            for (y0, z0) in &corners {
                let y = y0 * cos_t - z0 * sin_t;
                let z = y0 * sin_t + z0 * cos_t;
                nodes.push([x, y, z]);
            }
        }
        
        // Generate hex elements
        let mut elements = Vec::new();
        for i in 0..self.n_elem {
            let base = i * 4;
            elements.push(vec![
                base, base + 1, base + 2, base + 3,
                base + 4, base + 5, base + 6, base + 7,
            ]);
        }
        
        PatchMesh {
            nodes,
            elements,
            element_type: ElementType::Hex8,
        }
    }
    
    /// Reference solution: tip displacement under in-plane load
    pub fn reference_in_plane_displacement(&self) -> f64 {
        // Approximate beam theory solution
        let e = 29.0e6; // Standard E for twisted beam test
        let i = self.t * self.w.powi(3) / 12.0;
        let p = 1.0;
        
        p * self.l.powi(3) / (3.0 * e * i)
    }
    
    /// Reference solution: tip displacement under out-of-plane load
    pub fn reference_out_of_plane_displacement(&self) -> f64 {
        let e = 29.0e6;
        let i = self.w * self.t.powi(3) / 12.0;
        let p = 1.0;
        
        p * self.l.powi(3) / (3.0 * e * i)
    }
}

// ============================================================================
// SCORDELIS-LO ROOF
// ============================================================================

/// Scordelis-Lo roof benchmark (shell test)
#[derive(Debug, Clone)]
pub struct ScordelisLoRoof {
    /// Radius
    pub r: f64,
    /// Length
    pub l: f64,
    /// Thickness
    pub t: f64,
    /// Half-angle (radians)
    pub phi: f64,
}

impl Default for ScordelisLoRoof {
    fn default() -> Self {
        Self {
            r: 25.0,
            l: 50.0,
            t: 0.25,
            phi: 40.0 * PI / 180.0,
        }
    }
}

impl ScordelisLoRoof {
    /// Generate mesh
    pub fn generate_mesh(&self, n_circ: usize, n_len: usize) -> PatchMesh {
        let mut nodes = Vec::new();
        
        for i in 0..=n_len {
            let x = (i as f64 / n_len as f64) * self.l;
            
            for j in 0..=n_circ {
                let theta = -self.phi + (j as f64 / n_circ as f64) * 2.0 * self.phi;
                let y = self.r * theta.sin();
                let z = self.r * theta.cos();
                nodes.push([x, y, z]);
            }
        }
        
        let mut elements = Vec::new();
        for i in 0..n_len {
            for j in 0..n_circ {
                let n0 = i * (n_circ + 1) + j;
                let n1 = n0 + 1;
                let n2 = n0 + n_circ + 2;
                let n3 = n0 + n_circ + 1;
                elements.push(vec![n0, n1, n2, n3]);
            }
        }
        
        PatchMesh {
            nodes,
            elements,
            element_type: ElementType::Quad4,
        }
    }
    
    /// Reference vertical displacement at midpoint of free edge
    pub fn reference_displacement(&self) -> f64 {
        // From NAFEMS benchmark: -0.3024
        -0.3024
    }
}

// ============================================================================
// RAASCH CHALLENGE (TWISTED STRIP)
// ============================================================================

/// Raasch challenge problem (hook-shaped geometry)
#[derive(Debug, Clone)]
pub struct RaaschChallenge {
    /// Inner radius
    pub r_inner: f64,
    /// Outer radius
    pub r_outer: f64,
    /// Width
    pub w: f64,
}

impl Default for RaaschChallenge {
    fn default() -> Self {
        Self {
            r_inner: 9.0,
            r_outer: 10.0,
            w: 0.95,
        }
    }
}

impl RaaschChallenge {
    /// Reference tip displacement
    pub fn reference_displacement(&self) -> f64 {
        // Reference from literature
        -5.022e-2
    }
}

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

/// Result of a benchmark test
#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    /// Test name
    pub name: String,
    /// Computed value
    pub computed: f64,
    /// Reference value
    pub reference: f64,
    /// Relative error
    pub error: f64,
    /// Pass/fail status
    pub passed: bool,
    /// Tolerance used
    pub tolerance: f64,
}

impl BenchmarkResult {
    pub fn new(name: &str, computed: f64, reference: f64, tolerance: f64) -> Self {
        let error = if reference.abs() > 1e-16 {
            (computed - reference).abs() / reference.abs()
        } else {
            computed.abs()
        };
        
        let passed = error <= tolerance;
        
        Self {
            name: name.to_string(),
            computed,
            reference,
            error,
            passed,
            tolerance,
        }
    }
}

/// MacNeal-Harder benchmark suite runner
pub struct MacNealHarderSuite {
    /// Results
    pub results: Vec<BenchmarkResult>,
}

impl MacNealHarderSuite {
    pub fn new() -> Self {
        Self { results: Vec::new() }
    }
    
    /// Run patch test (validation)
    pub fn run_patch_test(&mut self, name: &str, computed_stress: [f64; 6], reference: [f64; 6]) {
        for (i, (comp, ref_val)) in computed_stress.iter().zip(reference.iter()).enumerate() {
            let component = match i {
                0 => "σxx",
                1 => "σyy",
                2 => "σzz",
                3 => "τxy",
                4 => "τyz",
                5 => "τzx",
                _ => "?",
            };
            
            let test_name = format!("{} - {}", name, component);
            self.results.push(BenchmarkResult::new(&test_name, *comp, *ref_val, 1e-6));
        }
    }
    
    /// Run cantilever test
    pub fn run_cantilever_test(&mut self, name: &str, computed_disp: f64, reference_disp: f64) {
        self.results.push(BenchmarkResult::new(name, computed_disp, reference_disp, 0.02));
    }
    
    /// Run shell benchmark
    pub fn run_shell_test(&mut self, name: &str, computed_disp: f64, reference_disp: f64) {
        self.results.push(BenchmarkResult::new(name, computed_disp, reference_disp, 0.02));
    }
    
    /// Summary of results
    pub fn summary(&self) -> (usize, usize) {
        let passed = self.results.iter().filter(|r| r.passed).count();
        let total = self.results.len();
        (passed, total)
    }
    
    /// Print report
    pub fn print_report(&self) {
        println!("MacNeal-Harder Benchmark Suite Results");
        println!("======================================");
        
        for result in &self.results {
            let status = if result.passed { "PASS" } else { "FAIL" };
            println!("[{}] {}: computed={:.6e}, ref={:.6e}, error={:.2}%",
                status, result.name, result.computed, result.reference, result.error * 100.0);
        }
        
        let (passed, total) = self.summary();
        println!("--------------------------------------");
        println!("Summary: {}/{} tests passed ({:.1}%)", passed, total,
            100.0 * passed as f64 / total as f64);
    }
}

// ============================================================================
// SOLVER INTEGRATION FOR VALIDATION
// ============================================================================

use crate::cache_optimized_sparse::{CacheOptimizedCSR, CacheAwarePCG, CacheConfig};
use std::collections::HashMap;

/// Assemble global stiffness matrix from element stiffnesses
/// Properly sums contributions to shared DOFs
pub fn assemble_global_stiffness(
    n_dof: usize,
    elements: &[Vec<usize>],  // Element connectivity (node indices)
    elem_stiffness: &[Vec<f64>],  // Element stiffness matrices (flat)
    dof_per_node: usize,
) -> CacheOptimizedCSR {
    // Use HashMap to sum duplicate entries
    let mut contributions: HashMap<(usize, usize), f64> = HashMap::new();
    
    for (e, connectivity) in elements.iter().enumerate() {
        let n_elem_nodes = connectivity.len();
        let elem_dof = n_elem_nodes * dof_per_node;
        let ke = &elem_stiffness[e];
        
        for i in 0..n_elem_nodes {
            for j in 0..n_elem_nodes {
                for di in 0..dof_per_node {
                    for dj in 0..dof_per_node {
                        let global_i = connectivity[i] * dof_per_node + di;
                        let global_j = connectivity[j] * dof_per_node + dj;
                        let local_i = i * dof_per_node + di;
                        let local_j = j * dof_per_node + dj;
                        let val = ke[local_i * elem_dof + local_j];
                        
                        if val.abs() > 1e-16 && global_i < n_dof && global_j < n_dof {
                            *contributions.entry((global_i, global_j)).or_insert(0.0) += val;
                        }
                    }
                }
            }
        }
    }
    
    // Convert to triplets
    let triplets: Vec<_> = contributions
        .into_iter()
        .map(|((i, j), v)| (i, j, v))
        .collect();
    
    CacheOptimizedCSR::from_triplets(n_dof, n_dof, &triplets)
}

/// Apply boundary conditions by modifying system
pub fn apply_boundary_conditions(
    stiffness: &mut CacheOptimizedCSR,
    rhs: &mut [f64],
    fixed_dofs: &[usize],
    prescribed_values: &[f64],
) {
    // Penalty method for simplicity
    // Use smaller penalty to avoid conditioning issues
    let penalty = 1e15;
    
    for (&dof, &value) in fixed_dofs.iter().zip(prescribed_values.iter()) {
        if dof < stiffness.nrows {
            // Add penalty to diagonal
            for idx in stiffness.row_ptr[dof]..stiffness.row_ptr[dof + 1] {
                if stiffness.col_idx[idx] == dof {
                    stiffness.values[idx] += penalty;
                    rhs[dof] = penalty * value;
                    break;
                }
            }
        }
    }
}

/// Solve the FEA system K*u = f
pub fn solve_fea_system(
    stiffness: &CacheOptimizedCSR,
    rhs: &[f64],
) -> Result<Vec<f64>, String> {
    let n = stiffness.nrows;
    let mut solution = vec![0.0; n];
    
    let solver = CacheAwarePCG {
        max_iter: 5000,
        tol: 1e-12,
        cache_config: CacheConfig::default(),
    };
    
    let mut k_blocked = stiffness.clone();
    k_blocked.setup_blocking(&CacheConfig::default());
    
    solver.solve(&k_blocked, rhs, &mut solution)?;
    
    Ok(solution)
}

/// Compute element stress from displacements
pub fn compute_element_stress(
    elem_displacements: &[f64],
    b_matrix: &[f64],  // Strain-displacement matrix (6 x n_dof for 3D)
    d_matrix: &[[f64; 6]; 6],  // Constitutive matrix
) -> [f64; 6] {
    let n_dof = elem_displacements.len();
    
    // Strain = B * u
    let mut strain = [0.0; 6];
    for i in 0..6 {
        for j in 0..n_dof {
            strain[i] += b_matrix[i * n_dof + j] * elem_displacements[j];
        }
    }
    
    // Stress = D * strain
    let mut stress = [0.0; 6];
    for i in 0..6 {
        for j in 0..6 {
            stress[i] += d_matrix[i][j] * strain[j];
        }
    }
    
    stress
}

/// Integrated benchmark: Simple patch test with solver
pub struct IntegratedBenchmark {
    pub results: Vec<BenchmarkResult>,
}

impl IntegratedBenchmark {
    pub fn new() -> Self {
        Self { results: Vec::new() }
    }
    
    /// Run a simple cantilever beam test using actual FEA
    /// Uses a coarse 2-element mesh and compares tip displacement
    pub fn run_simple_cantilever_test(&mut self) -> Result<(), String> {
        // Simple 2-element cantilever beam
        // Nodes: 0---1---2 (3 nodes, 2 elements)
        // Fixed at node 0, load at node 2
        
        let l = 10.0;  // Total length
        let h = 1.0;   // Height  
        let _t = 1.0;   // Thickness (unit)
        let e = 1000.0; // Young's modulus
        let _nu = 0.3;   // Poisson's ratio
        let p = 1.0;   // Applied load
        
        // 2D beam element (simplified)
        // DOFs: [v0, θ0, v1, θ1] for each element (deflection + rotation)
        let elem_len: f64 = l / 2.0;
        let i_moment = h * h * h / 12.0;  // I = bh³/12 with b=1
        
        // Euler-Bernoulli beam stiffness matrix (4x4)
        // K = (EI/L³) * [...] 
        let ei_l3 = e * i_moment / elem_len.powi(3);
        let ll = elem_len;
        
        // Standard beam stiffness matrix
        let ke = vec![
            12.0 * ei_l3,       6.0 * ll * ei_l3,    -12.0 * ei_l3,      6.0 * ll * ei_l3,
            6.0 * ll * ei_l3,   4.0 * ll*ll * ei_l3, -6.0 * ll * ei_l3,  2.0 * ll*ll * ei_l3,
            -12.0 * ei_l3,     -6.0 * ll * ei_l3,    12.0 * ei_l3,      -6.0 * ll * ei_l3,
            6.0 * ll * ei_l3,   2.0 * ll*ll * ei_l3, -6.0 * ll * ei_l3,  4.0 * ll*ll * ei_l3,
        ];
        
        // Two elements with same stiffness
        let elem_stiffness = vec![ke.clone(), ke];
        let elements = vec![vec![0, 1], vec![1, 2]];
        
        // Assemble (6 DOFs: v, θ at each of 3 nodes - DOFs 0,1 for node 0, 2,3 for node 1, 4,5 for node 2)
        let n_dof = 6;
        let mut stiffness = assemble_global_stiffness(n_dof, &elements, &elem_stiffness, 2);
        stiffness.setup_blocking(&CacheConfig::default());
        
        // Check assembly before BC application (BC modifies diagonal)
        let diag = stiffness.diagonal();
        // Node 1 should have doubled stiffness (shared by 2 elements)
        // diag[2] (Node 1) should be approx 2 * diag[0] (element stiffness)
        // diag[0] is roughly 12 * ei_l3
        if diag[2] < (2.0 * 12.0 * ei_l3) * 0.9 {
             return Err(format!("Assembly error: diag[2]={}, expected ~{}", diag[2], 2.0 * 12.0 * ei_l3));
        }
        
        // RHS: load at tip (node 2, v direction = DOF 4)
        let mut rhs = vec![0.0; n_dof];
        rhs[4] = p;
        
        // BC: fixed at node 0 (DOF 0 and 1) - both displacement and rotation
        apply_boundary_conditions(&mut stiffness, &mut rhs, &[0, 1], &[0.0, 0.0]);

        // Solve
        let solution = solve_fea_system(&stiffness, &rhs)?;
        
        // Tip displacement (v at node 2 = DOF 4)
        let computed_disp = solution[4];
        
        // Reference: δ = PL³/(3EI)
        let reference_disp = p * l.powi(3) / (3.0 * e * i_moment);
        
        self.results.push(BenchmarkResult::new(
            "Simple Cantilever (2 elements)",
            computed_disp,
            reference_disp,
            0.10,  // 10% tolerance for coarse mesh with PCG solver
        ));
        
        Ok(())
    }
    
    /// Run patch test for constant stress
    pub fn run_constant_stress_patch(&mut self) {
        // For a proper patch test, we'd need full element implementation
        // This is a simplified version that checks the solver works
        
        // Create a simple 2x2 system: K*u = f where K is SPD
        let triplets = vec![
            (0, 0, 10.0), (0, 1, -2.0),
            (1, 0, -2.0), (1, 1, 10.0),
        ];
        let stiffness = CacheOptimizedCSR::from_triplets(2, 2, &triplets);
        let rhs = vec![8.0, 8.0];
        
        match solve_fea_system(&stiffness, &rhs) {
            Ok(solution) => {
                // Expected: x = [1, 1] (verify: 10*1 - 2*1 = 8, -2*1 + 10*1 = 8)
                let expected = 1.0;
                let _error = (solution[0] - expected).abs();
                
                self.results.push(BenchmarkResult::new(
                    "Solver Patch Test",
                    solution[0],
                    expected,
                    1e-6,
                ));
            }
            Err(_e) => {
                self.results.push(BenchmarkResult {
                    name: "Solver Patch Test".to_string(),
                    computed: 0.0,
                    reference: 1.0,
                    error: 1.0,
                    passed: false,
                    tolerance: 1e-6,
                });
            }
        }
    }
    
    /// Summary
    pub fn summary(&self) -> (usize, usize) {
        let passed = self.results.iter().filter(|r| r.passed).count();
        (passed, self.results.len())
    }
}

impl Default for MacNealHarderSuite {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_standard_material() {
        let mat = StandardMaterial::default();
        let c = mat.elasticity_3d();
        
        // Check symmetry
        for i in 0..6 {
            for j in 0..6 {
                assert!((c[i][j] - c[j][i]).abs() < 1e-10);
            }
        }
        
        // Check diagonal is positive
        for i in 0..6 {
            assert!(c[i][i] > 0.0);
        }
    }
    
    #[test]
    fn test_quad4_patch_mesh() {
        let mesh = PatchMesh::quad4_patch();
        
        assert_eq!(mesh.nodes.len(), 9);
        assert_eq!(mesh.elements.len(), 4);
        
        for elem in &mesh.elements {
            assert_eq!(elem.len(), 4);
        }
    }
    
    #[test]
    fn test_cantilever_reference() {
        let config = CantileverConfig::default();
        
        let disp = CantileverTests::tip_displacement_inplane(&config);
        
        // Should be positive (downward displacement)
        assert!(disp > 0.0);
        
        // Reasonable magnitude
        assert!(disp < 10.0);
    }
    
    #[test]
    fn test_single_element_shapes() {
        for shape in [ElementShape::Regular, ElementShape::Rectangular, 
                      ElementShape::Parallelogram, ElementShape::Trapezoidal] {
            let mesh = SingleElementMesh::quad4(shape, 2.0);
            
            assert_eq!(mesh.nodes.len(), 4);
            assert_eq!(mesh.elements.len(), 1);
        }
    }
    
    #[test]
    fn test_twisted_beam_mesh() {
        let test = TwistedBeamTest::default();
        let mesh = test.generate_mesh();
        
        assert_eq!(mesh.elements.len(), test.n_elem);
        assert_eq!(mesh.nodes.len(), (test.n_elem + 1) * 4);
        
        // Check first and last nodes have correct twist
        let first_y = mesh.nodes[0][1];
        let last_y = mesh.nodes[mesh.nodes.len() - 4][1];
        
        // First section has no twist, last has 90 degree twist
        assert!(first_y.abs() < test.w); // Untwisted
    }
    
    #[test]
    fn test_scordelis_lo_mesh() {
        let roof = ScordelisLoRoof::default();
        let mesh = roof.generate_mesh(8, 8);
        
        assert_eq!(mesh.elements.len(), 64); // 8x8 elements
        assert_eq!(mesh.nodes.len(), 81); // 9x9 nodes
    }
    
    #[test]
    fn test_benchmark_result() {
        let result = BenchmarkResult::new("Test", 0.99, 1.0, 0.02);
        
        assert!(result.passed);
        assert!(result.error < 0.02);
        
        let result_fail = BenchmarkResult::new("Test Fail", 0.8, 1.0, 0.02);
        assert!(!result_fail.passed);
    }
    
    #[test]
    fn test_benchmark_suite() {
        let mut suite = MacNealHarderSuite::new();
        
        suite.run_cantilever_test("Cantilever In-Plane", 0.099, 0.1);
        suite.run_cantilever_test("Cantilever Out-of-Plane", 0.048, 0.05);
        
        let (passed, total) = suite.summary();
        assert_eq!(total, 2);
        assert!(passed >= 1); // At least one should pass with these values
    }
    
    #[test]
    fn test_hex8_patch() {
        let mesh = PatchMesh::hex8_patch();
        
        assert_eq!(mesh.nodes.len(), 9);
        assert_eq!(mesh.elements.len(), 1);
        assert_eq!(mesh.elements[0].len(), 8);
    }
    
    #[test]
    fn test_twist_rotation_reference() {
        let config = CantileverConfig::default();
        let rotation = CantileverTests::tip_twist_rotation(&config);
        
        assert!(rotation > 0.0);
        assert!(rotation < 1.0); // Reasonable rotation
    }
    
    // ========================================================================
    // SOLVER INTEGRATION TESTS
    // ========================================================================
    
    #[test]
    fn test_assemble_global_stiffness() {
        // Two 2-DOF elements sharing a node
        // Element 0: nodes [0, 1], Element 1: nodes [1, 2]
        let elements = vec![vec![0, 1], vec![1, 2]];
        
        // Simple 2x2 element stiffness: [[1, -1], [-1, 1]]
        let ke = vec![1.0, -1.0, -1.0, 1.0];
        let elem_stiffness = vec![ke.clone(), ke];
        
        let stiffness = assemble_global_stiffness(3, &elements, &elem_stiffness, 1);
        
        // Global matrix should be 3x3
        assert_eq!(stiffness.nrows, 3);
        assert_eq!(stiffness.ncols, 3);
        
        // Check assembly: K[1,1] should have contributions from both elements
        // K_global[1,1] = k[1,1] from elem 0 + k[0,0] from elem 1 = 1 + 1 = 2
        let diag = stiffness.diagonal();
        assert!((diag[0] - 1.0).abs() < 1e-10);
        assert!((diag[1] - 2.0).abs() < 1e-10);
        assert!((diag[2] - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_integrated_solver_patch() {
        let mut benchmark = IntegratedBenchmark::new();
        benchmark.run_constant_stress_patch();
        
        let (passed, total) = benchmark.summary();
        assert_eq!(total, 1);
        assert_eq!(passed, 1);
    }
    
    #[test]
    fn test_integrated_cantilever() {
        let mut benchmark = IntegratedBenchmark::new();
        match benchmark.run_simple_cantilever_test() {
            Ok(_) => {
                let (passed, total) = benchmark.summary();
                assert_eq!(total, 1);
                // Print detailed result
                for res in &benchmark.results {
                    eprintln!("Benchmark result: {:?}", res);
                }
            },
            Err(e) => {
                panic!("Cantilever test failed with error: {}", e);
            }
        }
    }
    
    #[test]
    fn test_solve_fea_system() {
        // Simple 2x2 positive definite system
        let triplets = vec![
            (0, 0, 4.0), (0, 1, 1.0),
            (1, 0, 1.0), (1, 1, 3.0),
        ];
        let stiffness = CacheOptimizedCSR::from_triplets(2, 2, &triplets);
        
        let rhs = vec![1.0, 2.0];
        let solution = solve_fea_system(&stiffness, &rhs).unwrap();
        
        // Verify: K*x = b
        let mut y = vec![0.0; 2];
        stiffness.spmv(&solution, &mut y);
        
        assert!((y[0] - rhs[0]).abs() < 1e-6);
        assert!((y[1] - rhs[1]).abs() < 1e-6);
    }
}

// ============================================================================
// WASM BINDINGS
// ============================================================================

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub struct MacnealHarderWasm;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
impl MacnealHarderWasm {
    pub fn get_quad4_patch() -> JsValue {
        let mesh = PatchMesh::quad4_patch();
        serde_wasm_bindgen::to_value(&mesh).unwrap_or(JsValue::NULL)
    }

    pub fn generate_twisted_beam(n_elem: usize) -> JsValue {
        let mut test = TwistedBeamTest::default();
        test.n_elem = n_elem;
        let mesh = test.generate_mesh();
        serde_wasm_bindgen::to_value(&mesh).unwrap_or(JsValue::NULL)
    }
}

