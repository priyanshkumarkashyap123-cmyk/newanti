//! Adaptive Mesh Refinement Module
//! 
//! Implements adaptive mesh refinement strategies with error estimation
//! for finite element analysis per best practices from:
//! - Zienkiewicz-Zhu error estimator
//! - Kelly error indicator
//! - H-adaptivity and P-adaptivity methods

use serde::{Deserialize, Serialize};

// ============================================================================
// ERROR ESTIMATORS
// ============================================================================

/// Error estimator types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ErrorEstimator {
    /// Zienkiewicz-Zhu recovery-based
    ZienkiewiczZhu,
    /// Kelly error indicator (gradient jump)
    Kelly,
    /// Residual-based estimator
    Residual,
    /// Goal-oriented (adjoint-based)
    GoalOriented,
    /// Hierarchical basis estimator
    Hierarchical,
}

/// Element error data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementError {
    /// Element ID
    pub element_id: usize,
    /// Local error indicator
    pub error_indicator: f64,
    /// Relative contribution to global error
    pub relative_error: f64,
    /// Recommended action
    pub action: RefinementAction,
    /// Estimated element size after refinement
    pub target_size: f64,
}

/// Refinement action for element
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RefinementAction {
    /// Keep current mesh
    None,
    /// Refine (h-refinement)
    Refine,
    /// Coarsen
    Coarsen,
    /// Increase polynomial order (p-refinement)
    IncreaseOrder,
    /// Decrease polynomial order
    DecreaseOrder,
}

/// Zienkiewicz-Zhu error estimator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZZErrorEstimator {
    /// Smoothing patch type
    pub patch_type: PatchType,
    /// Superconvergent point sampling
    pub use_superconvergent: bool,
    /// Polynomial order for recovery
    pub recovery_order: usize,
}

/// Patch type for stress recovery
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PatchType {
    /// Node-based patch
    Nodal,
    /// Element-based patch
    Element,
    /// Global L2 projection
    GlobalL2,
}

impl ZZErrorEstimator {
    pub fn new() -> Self {
        Self {
            patch_type: PatchType::Nodal,
            use_superconvergent: true,
            recovery_order: 2,
        }
    }
    
    /// Estimate error for element given FE and recovered stresses
    pub fn element_error(
        &self,
        fe_stress: &[f64; 6],
        recovered_stress: &[f64; 6],
        volume: f64,
        elastic_modulus: f64,
    ) -> f64 {
        // Energy norm of stress difference
        let mut diff_sq = 0.0;
        for i in 0..6 {
            diff_sq += (fe_stress[i] - recovered_stress[i]).powi(2);
        }
        
        // Error in energy norm
        (diff_sq * volume / elastic_modulus).sqrt()
    }
    
    /// Global error estimate
    pub fn global_error(&self, element_errors: &[f64]) -> f64 {
        element_errors.iter().map(|e| e.powi(2)).sum::<f64>().sqrt()
    }
    
    /// Effectivity index (should be close to 1.0)
    pub fn effectivity_index(&self, estimated_error: f64, exact_error: f64) -> f64 {
        if exact_error > 1e-15 {
            estimated_error / exact_error
        } else {
            1.0
        }
    }
}

impl Default for ZZErrorEstimator {
    fn default() -> Self {
        Self::new()
    }
}

/// Kelly error indicator (gradient-based)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KellyErrorIndicator {
    /// Face integration order
    pub face_quadrature_order: usize,
    /// Coefficient for face jump term
    pub jump_coefficient: f64,
}

impl KellyErrorIndicator {
    pub fn new() -> Self {
        Self {
            face_quadrature_order: 2,
            jump_coefficient: 1.0,
        }
    }
    
    /// Compute face jump contribution
    pub fn face_jump_error(
        &self,
        grad_plus: &[f64; 3],
        grad_minus: &[f64; 3],
        face_area: f64,
        h: f64,
    ) -> f64 {
        let jump_sq: f64 = (0..3)
            .map(|i| (grad_plus[i] - grad_minus[i]).powi(2))
            .sum();
        
        self.jump_coefficient * h * face_area * jump_sq
    }
    
    /// Element error from face contributions
    pub fn element_error(&self, face_contributions: &[f64]) -> f64 {
        face_contributions.iter().sum::<f64>().sqrt()
    }
}

impl Default for KellyErrorIndicator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// REFINEMENT STRATEGIES
// ============================================================================

/// Refinement strategy
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RefinementStrategy {
    /// Uniform refinement
    Uniform,
    /// Fixed fraction (refine top X%)
    FixedFraction,
    /// Fixed number (refine N elements)
    FixedNumber,
    /// Threshold-based
    Threshold,
    /// Optimality criterion (Dörfler marking)
    Doerfler,
    /// Maximum strategy
    Maximum,
}

/// Adaptive refinement controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveController {
    /// Target global error
    pub target_error: f64,
    /// Maximum number of elements
    pub max_elements: usize,
    /// Maximum refinement levels
    pub max_levels: usize,
    /// Refinement strategy
    pub strategy: RefinementStrategy,
    /// Refinement fraction (for fixed fraction)
    pub refine_fraction: f64,
    /// Coarsening fraction
    pub coarsen_fraction: f64,
    /// Dörfler parameter (0 < theta < 1)
    pub doerfler_theta: f64,
    /// Current refinement level
    pub current_level: usize,
}

impl AdaptiveController {
    pub fn new(target_error: f64) -> Self {
        Self {
            target_error,
            max_elements: 100000,
            max_levels: 10,
            strategy: RefinementStrategy::FixedFraction,
            refine_fraction: 0.3,
            coarsen_fraction: 0.03,
            doerfler_theta: 0.5,
            current_level: 0,
        }
    }
    
    /// Mark elements for refinement
    pub fn mark_elements(&self, errors: &[ElementError]) -> Vec<RefinementAction> {
        let n = errors.len();
        let mut actions = vec![RefinementAction::None; n];
        
        if n == 0 {
            return actions;
        }
        
        // Sort by error (descending)
        let mut sorted_indices: Vec<usize> = (0..n).collect();
        sorted_indices.sort_by(|&a, &b| {
            errors[b].error_indicator
                .partial_cmp(&errors[a].error_indicator)
                .unwrap()
        });
        
        match self.strategy {
            RefinementStrategy::Uniform => {
                for action in &mut actions {
                    *action = RefinementAction::Refine;
                }
            }
            
            RefinementStrategy::FixedFraction => {
                let n_refine = ((n as f64) * self.refine_fraction).ceil() as usize;
                let n_coarsen = ((n as f64) * self.coarsen_fraction).floor() as usize;
                
                for &idx in sorted_indices.iter().take(n_refine) {
                    actions[idx] = RefinementAction::Refine;
                }
                for &idx in sorted_indices.iter().rev().take(n_coarsen) {
                    actions[idx] = RefinementAction::Coarsen;
                }
            }
            
            RefinementStrategy::FixedNumber => {
                let n_refine = (n / 4).max(1);
                for &idx in sorted_indices.iter().take(n_refine) {
                    actions[idx] = RefinementAction::Refine;
                }
            }
            
            RefinementStrategy::Threshold => {
                let max_error = errors[sorted_indices[0]].error_indicator;
                let refine_threshold = 0.5 * max_error;
                let coarsen_threshold = 0.1 * max_error;
                
                for (i, err) in errors.iter().enumerate() {
                    if err.error_indicator > refine_threshold {
                        actions[i] = RefinementAction::Refine;
                    } else if err.error_indicator < coarsen_threshold {
                        actions[i] = RefinementAction::Coarsen;
                    }
                }
            }
            
            RefinementStrategy::Doerfler => {
                let total_error_sq: f64 = errors.iter()
                    .map(|e| e.error_indicator.powi(2))
                    .sum();
                let target = self.doerfler_theta * total_error_sq;
                
                let mut cumsum = 0.0;
                for &idx in &sorted_indices {
                    if cumsum >= target {
                        break;
                    }
                    actions[idx] = RefinementAction::Refine;
                    cumsum += errors[idx].error_indicator.powi(2);
                }
            }
            
            RefinementStrategy::Maximum => {
                let max_error = errors[sorted_indices[0]].error_indicator;
                for (i, err) in errors.iter().enumerate() {
                    if err.error_indicator > 0.5 * max_error {
                        actions[i] = RefinementAction::Refine;
                    }
                }
            }
        }
        
        actions
    }
    
    /// Check convergence
    pub fn is_converged(&self, global_error: f64) -> bool {
        global_error <= self.target_error
    }
    
    /// Check if refinement should stop
    pub fn should_stop(&self, n_elements: usize, global_error: f64) -> bool {
        self.is_converged(global_error)
            || n_elements >= self.max_elements
            || self.current_level >= self.max_levels
    }
    
    /// Estimate required mesh size for target error
    pub fn estimate_target_size(
        &self,
        current_size: f64,
        current_error: f64,
        convergence_rate: f64,
    ) -> f64 {
        if current_error <= self.target_error {
            return current_size;
        }
        
        // h_new = h_old * (target/current)^(1/rate)
        current_size * (self.target_error / current_error).powf(1.0 / convergence_rate)
    }
}

// ============================================================================
// MESH REFINEMENT OPERATIONS
// ============================================================================

/// 2D Triangle refinement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriangleRefinement {
    /// Red refinement (1->4 uniform)
    pub red_refinement: bool,
    /// Green refinement (1->2 closure)
    pub green_closure: bool,
    /// Longest edge bisection
    pub longest_edge: bool,
}

impl TriangleRefinement {
    /// Red refinement: split into 4 similar triangles
    pub fn red_refine(vertices: &[[f64; 2]; 3]) -> Vec<[[f64; 2]; 3]> {
        let mid01 = [
            (vertices[0][0] + vertices[1][0]) / 2.0,
            (vertices[0][1] + vertices[1][1]) / 2.0,
        ];
        let mid12 = [
            (vertices[1][0] + vertices[2][0]) / 2.0,
            (vertices[1][1] + vertices[2][1]) / 2.0,
        ];
        let mid20 = [
            (vertices[2][0] + vertices[0][0]) / 2.0,
            (vertices[2][1] + vertices[0][1]) / 2.0,
        ];
        
        vec![
            [vertices[0], mid01, mid20],
            [mid01, vertices[1], mid12],
            [mid20, mid12, vertices[2]],
            [mid01, mid12, mid20],
        ]
    }
    
    /// Green refinement: bisect one edge
    pub fn green_refine(
        vertices: &[[f64; 2]; 3],
        edge_to_bisect: usize,
    ) -> Vec<[[f64; 2]; 3]> {
        let (i, j, k) = match edge_to_bisect {
            0 => (0, 1, 2),
            1 => (1, 2, 0),
            _ => (2, 0, 1),
        };
        
        let mid = [
            (vertices[i][0] + vertices[j][0]) / 2.0,
            (vertices[i][1] + vertices[j][1]) / 2.0,
        ];
        
        vec![
            [vertices[i], mid, vertices[k]],
            [mid, vertices[j], vertices[k]],
        ]
    }
    
    /// Longest edge bisection
    pub fn longest_edge_bisection(vertices: &[[f64; 2]; 3]) -> Vec<[[f64; 2]; 3]> {
        // Find longest edge
        let edges = [
            ((vertices[1][0] - vertices[0][0]).powi(2) + (vertices[1][1] - vertices[0][1]).powi(2)).sqrt(),
            ((vertices[2][0] - vertices[1][0]).powi(2) + (vertices[2][1] - vertices[1][1]).powi(2)).sqrt(),
            ((vertices[0][0] - vertices[2][0]).powi(2) + (vertices[0][1] - vertices[2][1]).powi(2)).sqrt(),
        ];
        
        let longest = if edges[0] >= edges[1] && edges[0] >= edges[2] {
            0
        } else if edges[1] >= edges[2] {
            1
        } else {
            2
        };
        
        Self::green_refine(vertices, longest)
    }
}

/// 3D Tetrahedron refinement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TetrahedronRefinement;

impl TetrahedronRefinement {
    /// Regular refinement: split into 8 tetrahedra
    pub fn regular_refine(vertices: &[[f64; 3]; 4]) -> Vec<[[f64; 3]; 4]> {
        // Compute edge midpoints
        let mid = |i: usize, j: usize| -> [f64; 3] {
            [
                (vertices[i][0] + vertices[j][0]) / 2.0,
                (vertices[i][1] + vertices[j][1]) / 2.0,
                (vertices[i][2] + vertices[j][2]) / 2.0,
            ]
        };
        
        let m01 = mid(0, 1);
        let m02 = mid(0, 2);
        let m03 = mid(0, 3);
        let m12 = mid(1, 2);
        let m13 = mid(1, 3);
        let m23 = mid(2, 3);
        
        vec![
            [vertices[0], m01, m02, m03],
            [m01, vertices[1], m12, m13],
            [m02, m12, vertices[2], m23],
            [m03, m13, m23, vertices[3]],
            [m01, m02, m03, m13],
            [m01, m02, m12, m13],
            [m02, m03, m13, m23],
            [m02, m12, m13, m23],
        ]
    }
    
    /// Bisection refinement
    pub fn bisection_refine(
        vertices: &[[f64; 3]; 4],
        edge: (usize, usize),
    ) -> Vec<[[f64; 3]; 4]> {
        let mid = [
            (vertices[edge.0][0] + vertices[edge.1][0]) / 2.0,
            (vertices[edge.0][1] + vertices[edge.1][1]) / 2.0,
            (vertices[edge.0][2] + vertices[edge.1][2]) / 2.0,
        ];
        
        // Find opposite vertices
        let others: Vec<usize> = (0..4)
            .filter(|&i| i != edge.0 && i != edge.1)
            .collect();
        
        vec![
            [vertices[edge.0], mid, vertices[others[0]], vertices[others[1]]],
            [mid, vertices[edge.1], vertices[others[0]], vertices[others[1]]],
        ]
    }
}

/// Quadrilateral refinement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuadRefinement;

impl QuadRefinement {
    /// Uniform 1->4 refinement
    pub fn uniform_refine(vertices: &[[f64; 2]; 4]) -> Vec<[[f64; 2]; 4]> {
        let center = [
            (vertices[0][0] + vertices[1][0] + vertices[2][0] + vertices[3][0]) / 4.0,
            (vertices[0][1] + vertices[1][1] + vertices[2][1] + vertices[3][1]) / 4.0,
        ];
        
        let mid = |i: usize, j: usize| -> [f64; 2] {
            [
                (vertices[i][0] + vertices[j][0]) / 2.0,
                (vertices[i][1] + vertices[j][1]) / 2.0,
            ]
        };
        
        let m01 = mid(0, 1);
        let m12 = mid(1, 2);
        let m23 = mid(2, 3);
        let m30 = mid(3, 0);
        
        vec![
            [vertices[0], m01, center, m30],
            [m01, vertices[1], m12, center],
            [center, m12, vertices[2], m23],
            [m30, center, m23, vertices[3]],
        ]
    }
}

/// Hexahedron refinement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexRefinement;

impl HexRefinement {
    /// Uniform 1->8 refinement
    pub fn uniform_refine(vertices: &[[f64; 3]; 8]) -> Vec<[[f64; 3]; 8]> {
        // Center of hex
        let _center: [f64; 3] = [
            vertices.iter().map(|v| v[0]).sum::<f64>() / 8.0,
            vertices.iter().map(|v| v[1]).sum::<f64>() / 8.0,
            vertices.iter().map(|v| v[2]).sum::<f64>() / 8.0,
        ];
        
        // Face centers and edge midpoints would be computed
        // For simplicity, return placeholder
        vec![[vertices[0], vertices[1], vertices[2], vertices[3],
              vertices[4], vertices[5], vertices[6], vertices[7]]; 8]
    }
}

// ============================================================================
// MESH QUALITY
// ============================================================================

/// Mesh quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshQuality {
    /// Minimum quality
    pub min_quality: f64,
    /// Maximum quality
    pub max_quality: f64,
    /// Average quality
    pub avg_quality: f64,
    /// Number of poor elements
    pub poor_elements: usize,
    /// Quality threshold
    pub threshold: f64,
}

impl MeshQuality {
    /// Triangle quality (radius ratio)
    pub fn triangle_quality(vertices: &[[f64; 2]; 3]) -> f64 {
        let a = ((vertices[1][0] - vertices[0][0]).powi(2) + 
                 (vertices[1][1] - vertices[0][1]).powi(2)).sqrt();
        let b = ((vertices[2][0] - vertices[1][0]).powi(2) + 
                 (vertices[2][1] - vertices[1][1]).powi(2)).sqrt();
        let c = ((vertices[0][0] - vertices[2][0]).powi(2) + 
                 (vertices[0][1] - vertices[2][1]).powi(2)).sqrt();
        
        let s = (a + b + c) / 2.0;
        let area = (s * (s - a) * (s - b) * (s - c)).sqrt();
        
        if area < 1e-15 {
            return 0.0;
        }
        
        // Normalized radius ratio (1 = equilateral)
        let r_in = area / s;
        let r_out = a * b * c / (4.0 * area);
        
        2.0 * r_in / r_out
    }
    
    /// Tetrahedron quality
    pub fn tetrahedron_quality(vertices: &[[f64; 3]; 4]) -> f64 {
        // Simplified: ratio of inscribed to circumscribed radius
        // For equilateral tet, this is 1/3
        
        let volume = Self::tet_volume(vertices);
        if volume.abs() < 1e-15 {
            return 0.0;
        }
        
        // Sum of face areas
        let faces = [
            [vertices[0], vertices[1], vertices[2]],
            [vertices[0], vertices[1], vertices[3]],
            [vertices[0], vertices[2], vertices[3]],
            [vertices[1], vertices[2], vertices[3]],
        ];
        
        let total_area: f64 = faces.iter()
            .map(|f| Self::triangle_area_3d(f))
            .sum();
        
        // r_in = 3V / A
        let r_in = 3.0 * volume.abs() / total_area;
        
        // Approximate circumradius from edge lengths
        let edges = Self::tet_edge_lengths(vertices);
        let avg_edge = edges.iter().sum::<f64>() / 6.0;
        
        // Normalized quality
        (r_in / avg_edge * 4.0).min(1.0)
    }
    
    fn tet_volume(v: &[[f64; 3]; 4]) -> f64 {
        let a = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
        let b = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
        let c = [v[3][0] - v[0][0], v[3][1] - v[0][1], v[3][2] - v[0][2]];
        
        (a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6.0
    }
    
    fn triangle_area_3d(v: &[[f64; 3]; 3]) -> f64 {
        let ab = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
        let ac = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
        
        let cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
        ];
        
        (cross[0].powi(2) + cross[1].powi(2) + cross[2].powi(2)).sqrt() / 2.0
    }
    
    fn tet_edge_lengths(v: &[[f64; 3]; 4]) -> [f64; 6] {
        let dist = |i: usize, j: usize| {
            ((v[i][0] - v[j][0]).powi(2) + 
             (v[i][1] - v[j][1]).powi(2) + 
             (v[i][2] - v[j][2]).powi(2)).sqrt()
        };
        
        [dist(0, 1), dist(0, 2), dist(0, 3), dist(1, 2), dist(1, 3), dist(2, 3)]
    }
}

// ============================================================================
// ADAPTIVE MESH REFINEMENT
// ============================================================================

/// Adaptive mesh refinement engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveMeshRefinement {
    /// Error estimator type
    pub estimator: ErrorEstimator,
    /// Refinement controller
    pub controller: AdaptiveController,
    /// Current iteration
    pub iteration: usize,
    /// Error history
    pub error_history: Vec<f64>,
    /// Element count history
    pub element_history: Vec<usize>,
}

impl AdaptiveMeshRefinement {
    pub fn new(target_error: f64, estimator: ErrorEstimator) -> Self {
        Self {
            estimator,
            controller: AdaptiveController::new(target_error),
            iteration: 0,
            error_history: Vec::new(),
            element_history: Vec::new(),
        }
    }
    
    /// Perform one adaptive refinement iteration
    pub fn refine_iteration(
        &mut self,
        element_errors: Vec<ElementError>,
        n_elements: usize,
    ) -> AdaptiveResult {
        self.iteration += 1;
        
        // Compute global error
        let global_error = element_errors.iter()
            .map(|e| e.error_indicator.powi(2))
            .sum::<f64>()
            .sqrt();
        
        self.error_history.push(global_error);
        self.element_history.push(n_elements);
        
        // Check convergence
        if self.controller.should_stop(n_elements, global_error) {
            return AdaptiveResult {
                converged: self.controller.is_converged(global_error),
                global_error,
                n_elements,
                actions: vec![RefinementAction::None; element_errors.len()],
                iteration: self.iteration,
            };
        }
        
        // Mark elements
        let actions = self.controller.mark_elements(&element_errors);
        
        AdaptiveResult {
            converged: false,
            global_error,
            n_elements,
            actions,
            iteration: self.iteration,
        }
    }
    
    /// Estimate convergence rate
    pub fn convergence_rate(&self) -> f64 {
        if self.error_history.len() < 2 {
            return 2.0; // Default assumption for linear elements
        }
        
        let n = self.error_history.len();
        let e1 = self.error_history[n - 2];
        let e2 = self.error_history[n - 1];
        let h1 = (self.element_history[n - 2] as f64).powf(-0.5);
        let h2 = (self.element_history[n - 1] as f64).powf(-0.5);
        
        if (h1 - h2).abs() < 1e-15 || e1 < 1e-15 || e2 < 1e-15 {
            return 2.0;
        }
        
        (e1 / e2).ln() / (h1 / h2).ln()
    }
}

/// Result of adaptive refinement iteration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveResult {
    /// Whether target error achieved
    pub converged: bool,
    /// Current global error
    pub global_error: f64,
    /// Current number of elements
    pub n_elements: usize,
    /// Actions for each element
    pub actions: Vec<RefinementAction>,
    /// Iteration number
    pub iteration: usize,
}

// ============================================================================
// P-ADAPTIVITY
// ============================================================================

/// P-adaptivity controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PAdaptivity {
    /// Minimum polynomial order
    pub p_min: usize,
    /// Maximum polynomial order
    pub p_max: usize,
    /// Current element orders
    pub element_orders: Vec<usize>,
}

impl PAdaptivity {
    pub fn new(n_elements: usize, initial_order: usize) -> Self {
        Self {
            p_min: 1,
            p_max: 10,
            element_orders: vec![initial_order; n_elements],
        }
    }
    
    /// Increase order for element
    pub fn increase_order(&mut self, element_id: usize) -> bool {
        if element_id < self.element_orders.len() 
            && self.element_orders[element_id] < self.p_max 
        {
            self.element_orders[element_id] += 1;
            true
        } else {
            false
        }
    }
    
    /// Decrease order for element
    pub fn decrease_order(&mut self, element_id: usize) -> bool {
        if element_id < self.element_orders.len() 
            && self.element_orders[element_id] > self.p_min 
        {
            self.element_orders[element_id] -= 1;
            true
        } else {
            false
        }
    }
    
    /// Get total DOFs estimate
    pub fn total_dofs(&self, dof_per_order: &[usize]) -> usize {
        self.element_orders.iter()
            .map(|&p| dof_per_order.get(p).copied().unwrap_or(0))
            .sum()
    }
}

// ============================================================================
// HP-ADAPTIVITY
// ============================================================================

/// HP-adaptivity decision
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HPDecision {
    /// h-refinement (split element)
    HRefine,
    /// p-refinement (increase order)
    PRefine,
    /// Both h and p
    HPRefine,
    /// No change
    None,
}

/// HP-adaptivity controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HPAdaptivity {
    /// Smoothness indicator threshold
    pub smoothness_threshold: f64,
    /// Error reduction factor for h-refinement
    pub h_reduction: f64,
    /// Error reduction factor for p-refinement
    pub p_reduction: f64,
}

impl HPAdaptivity {
    pub fn new() -> Self {
        Self {
            smoothness_threshold: 0.5,
            h_reduction: 0.5,
            p_reduction: 0.7,
        }
    }
    
    /// Decide between h and p refinement
    pub fn decide(&self, smoothness: f64, current_p: usize, max_p: usize) -> HPDecision {
        if smoothness > self.smoothness_threshold {
            // Smooth solution -> p-refinement preferred
            if current_p < max_p {
                HPDecision::PRefine
            } else {
                HPDecision::HRefine
            }
        } else {
            // Non-smooth (singularity) -> h-refinement
            HPDecision::HRefine
        }
    }
    
    /// Estimate smoothness from Legendre coefficients
    pub fn estimate_smoothness(&self, coefficients: &[f64]) -> f64 {
        if coefficients.len() < 3 {
            return 1.0;
        }
        
        // Decay rate of coefficients indicates smoothness
        let n = coefficients.len();
        let low_sum: f64 = coefficients[..n/2].iter().map(|c| c.abs()).sum();
        let high_sum: f64 = coefficients[n/2..].iter().map(|c| c.abs()).sum();
        
        if low_sum < 1e-15 {
            return 1.0;
        }
        
        1.0 - (high_sum / low_sum).min(1.0)
    }
}

impl Default for HPAdaptivity {
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
    fn test_zz_estimator() {
        let estimator = ZZErrorEstimator::new();
        
        let fe_stress = [100.0, 50.0, 0.0, 25.0, 0.0, 0.0];
        let recovered = [105.0, 48.0, 2.0, 24.0, 1.0, 0.0];
        
        let error = estimator.element_error(&fe_stress, &recovered, 1.0, 200000.0);
        assert!(error > 0.0);
    }

    #[test]
    fn test_kelly_indicator() {
        let indicator = KellyErrorIndicator::new();
        
        let grad_plus = [10.0, 5.0, 0.0];
        let grad_minus = [8.0, 6.0, 0.0];
        
        let error = indicator.face_jump_error(&grad_plus, &grad_minus, 1.0, 0.1);
        assert!(error > 0.0);
    }

    #[test]
    fn test_adaptive_controller() {
        let controller = AdaptiveController::new(0.01);
        
        let errors: Vec<ElementError> = (0..10).map(|i| ElementError {
            element_id: i,
            error_indicator: 0.1 - 0.01 * i as f64,
            relative_error: 0.1,
            action: RefinementAction::None,
            target_size: 1.0,
        }).collect();
        
        let actions = controller.mark_elements(&errors);
        
        let refine_count = actions.iter()
            .filter(|&&a| a == RefinementAction::Refine)
            .count();
        assert!(refine_count > 0);
    }

    #[test]
    fn test_triangle_red_refine() {
        let tri = [[0.0, 0.0], [1.0, 0.0], [0.5, 0.866]];
        let refined = TriangleRefinement::red_refine(&tri);
        
        assert_eq!(refined.len(), 4);
    }

    #[test]
    fn test_triangle_quality() {
        // Equilateral triangle
        let equilateral = [[0.0, 0.0], [1.0, 0.0], [0.5, 0.866]];
        let q_eq = MeshQuality::triangle_quality(&equilateral);
        
        // Degenerate triangle
        let degenerate = [[0.0, 0.0], [1.0, 0.0], [0.5, 0.1]];
        let q_deg = MeshQuality::triangle_quality(&degenerate);
        
        assert!(q_eq > q_deg);
    }

    #[test]
    fn test_tet_refinement() {
        let tet = [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.5, 0.866, 0.0],
            [0.5, 0.289, 0.816],
        ];
        
        let refined = TetrahedronRefinement::regular_refine(&tet);
        assert_eq!(refined.len(), 8);
    }

    #[test]
    fn test_adaptive_mesh_refinement() {
        let mut amr = AdaptiveMeshRefinement::new(0.01, ErrorEstimator::ZienkiewiczZhu);
        
        let errors: Vec<ElementError> = (0..100).map(|i| ElementError {
            element_id: i,
            error_indicator: 0.1 / (i as f64 + 1.0),
            relative_error: 0.01,
            action: RefinementAction::None,
            target_size: 1.0,
        }).collect();
        
        let result = amr.refine_iteration(errors, 100);
        
        assert!(!result.converged);
        assert!(result.global_error > 0.0);
    }

    #[test]
    fn test_p_adaptivity() {
        let mut p_adapt = PAdaptivity::new(10, 2);
        
        assert!(p_adapt.increase_order(0));
        assert_eq!(p_adapt.element_orders[0], 3);
        
        assert!(p_adapt.decrease_order(1));
        assert_eq!(p_adapt.element_orders[1], 1);
    }

    #[test]
    fn test_hp_decision() {
        let hp = HPAdaptivity::new();
        
        let smooth = hp.decide(0.8, 2, 5);
        assert_eq!(smooth, HPDecision::PRefine);
        
        let singular = hp.decide(0.2, 2, 5);
        assert_eq!(singular, HPDecision::HRefine);
    }

    #[test]
    fn test_convergence_check() {
        let controller = AdaptiveController::new(0.01);
        
        assert!(controller.is_converged(0.005));
        assert!(!controller.is_converged(0.05));
    }

    #[test]
    fn test_doerfler_marking() {
        let mut controller = AdaptiveController::new(0.01);
        controller.strategy = RefinementStrategy::Doerfler;
        controller.doerfler_theta = 0.5;
        
        let errors: Vec<ElementError> = vec![
            ElementError { element_id: 0, error_indicator: 0.5, relative_error: 0.5, action: RefinementAction::None, target_size: 1.0 },
            ElementError { element_id: 1, error_indicator: 0.3, relative_error: 0.3, action: RefinementAction::None, target_size: 1.0 },
            ElementError { element_id: 2, error_indicator: 0.1, relative_error: 0.1, action: RefinementAction::None, target_size: 1.0 },
            ElementError { element_id: 3, error_indicator: 0.05, relative_error: 0.05, action: RefinementAction::None, target_size: 1.0 },
        ];
        
        let actions = controller.mark_elements(&errors);
        
        // At least element 0 should be marked
        assert_eq!(actions[0], RefinementAction::Refine);
    }

    #[test]
    fn test_quad_refinement() {
        let quad = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
        let refined = QuadRefinement::uniform_refine(&quad);
        
        assert_eq!(refined.len(), 4);
    }
}
