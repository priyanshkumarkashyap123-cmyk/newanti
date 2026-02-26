//! Error Estimation and Adaptive Refinement Module
//!
//! A-posteriori error estimation for mesh adaptivity in FEA.
//! Supports h-refinement, p-refinement, and hp-adaptivity.
//!
//! ## Estimators
//! - **Zienkiewicz-Zhu (ZZ)** - Superconvergent patch recovery
//! - **Residual-based** - Element residual norms
//! - **Goal-oriented** - Quantity of interest focused
//!
//! ## Refinement Strategies
//! - h-refinement (mesh subdivision)
//! - p-refinement (polynomial order increase)
//! - hp-adaptivity (combined)


// ============================================================================
// ERROR INDICATORS
// ============================================================================

/// Element-wise error indicator
#[derive(Debug, Clone)]
pub struct ElementError {
    pub element_id: usize,
    pub error_value: f64,
    pub relative_error: f64,
    pub error_type: ErrorType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ErrorType {
    Energy,       // Energy norm error
    L2,           // L2 norm error
    Infinity,     // Maximum error
    QoI,          // Quantity of interest
}

/// Global error summary
#[derive(Debug, Clone, Default)]
pub struct ErrorSummary {
    pub total_error: f64,
    pub max_element_error: f64,
    pub min_element_error: f64,
    pub mean_element_error: f64,
    pub std_dev_error: f64,
    pub effectivity_index: f64,
    pub num_elements: usize,
}

impl ErrorSummary {
    pub fn from_element_errors(errors: &[ElementError]) -> Self {
        if errors.is_empty() {
            return Self::default();
        }

        let values: Vec<f64> = errors.iter().map(|e| e.error_value).collect();
        let total: f64 = values.iter().map(|&v| v * v).sum::<f64>().sqrt();
        let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
        let mean = values.iter().sum::<f64>() / values.len() as f64;

        let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
        let std_dev = variance.sqrt();

        ErrorSummary {
            total_error: total,
            max_element_error: max,
            min_element_error: min,
            mean_element_error: mean,
            std_dev_error: std_dev,
            effectivity_index: 1.0, // Updated when exact error known
            num_elements: errors.len(),
        }
    }
}

// ============================================================================
// ZIENKIEWICZ-ZHU ERROR ESTIMATOR
// ============================================================================

/// Superconvergent Patch Recovery (SPR) based error estimator
pub struct ZienkiewiczZhuEstimator {
    pub smoothing_order: usize,  // Polynomial order for recovery
    pub use_improved_recovery: bool,
}

impl Default for ZienkiewiczZhuEstimator {
    fn default() -> Self {
        ZienkiewiczZhuEstimator {
            smoothing_order: 1,
            use_improved_recovery: true,
        }
    }
}

impl ZienkiewiczZhuEstimator {
    /// Estimate error from FE stress and recovered stress
    pub fn estimate_error(
        &self,
        element_stresses: &[ElementStress],
        mesh: &SimpleMesh,
    ) -> Vec<ElementError> {
        // Step 1: Recover smooth stress field at nodes
        let nodal_stresses = self.recover_stresses(element_stresses, mesh);

        // Step 2: Compute error for each element
        let mut errors = Vec::with_capacity(mesh.num_elements);

        for (eid, elem_stress) in element_stresses.iter().enumerate() {
            let recovered = self.interpolate_recovered_stress(eid, &nodal_stresses, mesh);
            let error = self.compute_element_error(elem_stress, &recovered);

            errors.push(ElementError {
                element_id: eid,
                error_value: error,
                relative_error: 0.0, // Updated later
                error_type: ErrorType::Energy,
            });
        }

        // Compute relative errors
        let total_error = errors.iter().map(|e| e.error_value.powi(2)).sum::<f64>().sqrt();
        if total_error > 1e-15 {
            for error in &mut errors {
                error.relative_error = error.error_value / total_error;
            }
        }

        errors
    }

    /// Recover nodal stresses using patch recovery
    fn recover_stresses(
        &self,
        element_stresses: &[ElementStress],
        mesh: &SimpleMesh,
    ) -> Vec<StressState> {
        let mut nodal_stresses = vec![StressState::default(); mesh.num_nodes];
        let mut node_counts = vec![0usize; mesh.num_nodes];

        // Simple averaging (improved SPR would use polynomial fitting)
        for elem_stress in element_stresses {
            for &node_id in &elem_stress.node_ids {
                if node_id < mesh.num_nodes {
                    let ns = &mut nodal_stresses[node_id];
                    ns.add(&elem_stress.stress);
                    node_counts[node_id] += 1;
                }
            }
        }

        // Average
        for (nid, ns) in nodal_stresses.iter_mut().enumerate() {
            if node_counts[nid] > 0 {
                ns.scale(1.0 / node_counts[nid] as f64);
            }
        }

        nodal_stresses
    }

    /// Interpolate recovered stress at element center
    fn interpolate_recovered_stress(
        &self,
        element_id: usize,
        nodal_stresses: &[StressState],
        mesh: &SimpleMesh,
    ) -> StressState {
        let node_ids = mesh.get_element_nodes(element_id);
        let n = node_ids.len();

        if n == 0 {
            return StressState::default();
        }

        // Simple average of nodal values
        let mut recovered = StressState::default();
        for &nid in &node_ids {
            if nid < nodal_stresses.len() {
                recovered.add(&nodal_stresses[nid]);
            }
        }
        recovered.scale(1.0 / n as f64);
        recovered
    }

    /// Compute element error in energy norm
    fn compute_element_error(&self, fe_stress: &ElementStress, recovered: &StressState) -> f64 {
        // Error = ||σ* - σ_h||_E = sqrt(∫ (σ* - σ_h)^T : C^-1 : (σ* - σ_h) dΩ)
        // Simplified: just use L2 norm of stress difference
        let diff = [
            recovered.sigma[0] - fe_stress.stress.sigma[0],
            recovered.sigma[1] - fe_stress.stress.sigma[1],
            recovered.sigma[2] - fe_stress.stress.sigma[2],
            recovered.sigma[3] - fe_stress.stress.sigma[3],
            recovered.sigma[4] - fe_stress.stress.sigma[4],
            recovered.sigma[5] - fe_stress.stress.sigma[5],
        ];

        let l2_error: f64 = diff.iter().map(|d| d * d).sum::<f64>();
        (l2_error * fe_stress.volume).sqrt()
    }
}

/// Element stress data
#[derive(Debug, Clone)]
pub struct ElementStress {
    pub element_id: usize,
    pub node_ids: Vec<usize>,
    pub stress: StressState,
    pub volume: f64,
}

/// Stress tensor (Voigt notation: σxx, σyy, σzz, τxy, τyz, τxz)
#[derive(Debug, Clone, Copy, Default)]
pub struct StressState {
    pub sigma: [f64; 6],
}

impl StressState {
    pub fn add(&mut self, other: &StressState) {
        for i in 0..6 {
            self.sigma[i] += other.sigma[i];
        }
    }

    pub fn scale(&mut self, factor: f64) {
        for s in &mut self.sigma {
            *s *= factor;
        }
    }

    pub fn von_mises(&self) -> f64 {
        let s = &self.sigma;
        let vm = ((s[0] - s[1]).powi(2) + (s[1] - s[2]).powi(2) + (s[2] - s[0]).powi(2)
            + 6.0 * (s[3].powi(2) + s[4].powi(2) + s[5].powi(2)))
            / 2.0;
        vm.sqrt()
    }
}

// ============================================================================
// RESIDUAL-BASED ERROR ESTIMATOR
// ============================================================================

/// Element residual-based error estimator
pub struct ResidualEstimator {
    pub c_r: f64,   // Residual constant
    pub c_j: f64,   // Jump constant
}

impl Default for ResidualEstimator {
    fn default() -> Self {
        ResidualEstimator {
            c_r: 1.0,
            c_j: 1.0,
        }
    }
}

impl ResidualEstimator {
    /// Compute residual-based error indicator
    /// η_K^2 = h_K^2 ||R||_K^2 + h_K ||J||_∂K^2
    pub fn estimate_error(
        &self,
        element_residuals: &[ElementResidual],
    ) -> Vec<ElementError> {
        element_residuals
            .iter()
            .map(|res| {
                let h = res.element_size;
                let interior_term = self.c_r * h.powi(2) * res.interior_residual.powi(2);
                let jump_term = self.c_j * h * res.edge_jump.powi(2);
                let error = (interior_term + jump_term).sqrt();

                ElementError {
                    element_id: res.element_id,
                    error_value: error,
                    relative_error: 0.0,
                    error_type: ErrorType::Energy,
                }
            })
            .collect()
    }
}

/// Element residual data
#[derive(Debug, Clone)]
pub struct ElementResidual {
    pub element_id: usize,
    pub element_size: f64,     // Characteristic size h_K
    pub interior_residual: f64, // ||div(σ) + f||_K
    pub edge_jump: f64,         // ||[σ·n]||_∂K (stress jump across edges)
}

// ============================================================================
// GOAL-ORIENTED ERROR ESTIMATOR
// ============================================================================

/// Goal-oriented error estimator (dual-weighted residual)
pub struct GoalOrientedEstimator {
    pub qoi_type: QuantityOfInterest,
}

#[derive(Debug, Clone, Copy)]
pub enum QuantityOfInterest {
    PointDisplacement { node_id: usize, dof: usize },
    AverageStress { element_ids: [usize; 0] }, // Placeholder
    Reaction { node_id: usize },
    Compliance,
}

impl Default for GoalOrientedEstimator {
    fn default() -> Self {
        GoalOrientedEstimator {
            qoi_type: QuantityOfInterest::Compliance,
        }
    }
}

impl GoalOrientedEstimator {
    /// Estimate error using dual-weighted residual
    /// η_K = |R(e_h)(z - z_h)| where z is dual solution
    pub fn estimate_error(
        &self,
        primal_residuals: &[f64],
        dual_weights: &[f64],
    ) -> Vec<ElementError> {
        primal_residuals
            .iter()
            .zip(dual_weights.iter())
            .enumerate()
            .map(|(eid, (&res, &weight))| {
                let error = (res * weight).abs();
                ElementError {
                    element_id: eid,
                    error_value: error,
                    relative_error: 0.0,
                    error_type: ErrorType::QoI,
                }
            })
            .collect()
    }
}

// ============================================================================
// MESH REFINEMENT
// ============================================================================

/// Refinement strategy
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RefinementStrategy {
    /// Uniform refinement (all elements)
    Uniform,
    /// Refine elements above threshold
    Threshold(f64),
    /// Refine fixed percentage of elements
    FixedFraction(f64),
    /// Dörfler/bulk criterion
    Doerfler(f64),
    /// Maximum element refinement
    MaxElements(usize),
}

/// Refinement marking result
#[derive(Debug, Clone)]
pub struct RefinementMarking {
    pub elements_to_refine: Vec<usize>,
    pub elements_to_coarsen: Vec<usize>,
    pub total_marked: usize,
}

/// Adaptive refinement controller
pub struct AdaptiveRefinement {
    pub strategy: RefinementStrategy,
    pub coarsen_fraction: f64,  // Fraction of elements to coarsen
    pub min_element_size: f64,
    pub max_element_size: f64,
    pub max_refinement_level: usize,
}

impl Default for AdaptiveRefinement {
    fn default() -> Self {
        AdaptiveRefinement {
            strategy: RefinementStrategy::Doerfler(0.5),
            coarsen_fraction: 0.1,
            min_element_size: 1e-6,
            max_element_size: 1.0,
            max_refinement_level: 10,
        }
    }
}

impl AdaptiveRefinement {
    /// Mark elements for refinement based on error indicators
    pub fn mark_elements(&self, errors: &[ElementError]) -> RefinementMarking {
        if errors.is_empty() {
            return RefinementMarking {
                elements_to_refine: vec![],
                elements_to_coarsen: vec![],
                total_marked: 0,
            };
        }

        let elements_to_refine = match self.strategy {
            RefinementStrategy::Uniform => {
                (0..errors.len()).collect()
            }

            RefinementStrategy::Threshold(tol) => {
                errors
                    .iter()
                    .filter(|e| e.error_value > tol)
                    .map(|e| e.element_id)
                    .collect()
            }

            RefinementStrategy::FixedFraction(fraction) => {
                self.mark_fixed_fraction(errors, fraction)
            }

            RefinementStrategy::Doerfler(theta) => {
                self.mark_doerfler(errors, theta)
            }

            RefinementStrategy::MaxElements(max) => {
                self.mark_max_elements(errors, max)
            }
        };

        // Mark elements for coarsening (smallest errors)
        let elements_to_coarsen = self.mark_for_coarsening(errors);

        let total_marked = elements_to_refine.len();

        RefinementMarking {
            elements_to_refine,
            elements_to_coarsen,
            total_marked,
        }
    }

    /// Mark fixed fraction of elements with largest errors
    fn mark_fixed_fraction(&self, errors: &[ElementError], fraction: f64) -> Vec<usize> {
        let mut sorted: Vec<_> = errors.iter().collect();
        sorted.sort_by(|a, b| b.error_value.partial_cmp(&a.error_value).unwrap());

        let n_mark = ((errors.len() as f64 * fraction).ceil() as usize).max(1);
        sorted.iter().take(n_mark).map(|e| e.element_id).collect()
    }

    /// Dörfler (bulk) marking criterion
    /// Mark smallest set M such that θ * total_error^2 ≤ Σ_{K∈M} η_K^2
    fn mark_doerfler(&self, errors: &[ElementError], theta: f64) -> Vec<usize> {
        let total_error_sq: f64 = errors.iter().map(|e| e.error_value.powi(2)).sum();
        let target = theta * total_error_sq;

        let mut sorted: Vec<_> = errors.iter().collect();
        sorted.sort_by(|a, b| b.error_value.partial_cmp(&a.error_value).unwrap());

        let mut marked = Vec::new();
        let mut cumulative = 0.0;

        for error in sorted {
            marked.push(error.element_id);
            cumulative += error.error_value.powi(2);
            if cumulative >= target {
                break;
            }
        }

        marked
    }

    /// Mark elements up to maximum count
    fn mark_max_elements(&self, errors: &[ElementError], max: usize) -> Vec<usize> {
        let mut sorted: Vec<_> = errors.iter().collect();
        sorted.sort_by(|a, b| b.error_value.partial_cmp(&a.error_value).unwrap());

        sorted.iter().take(max).map(|e| e.element_id).collect()
    }

    /// Mark elements for coarsening (optional)
    fn mark_for_coarsening(&self, errors: &[ElementError]) -> Vec<usize> {
        if self.coarsen_fraction <= 0.0 {
            return vec![];
        }

        let mut sorted: Vec<_> = errors.iter().collect();
        sorted.sort_by(|a, b| a.error_value.partial_cmp(&b.error_value).unwrap());

        let n_coarsen = (errors.len() as f64 * self.coarsen_fraction).floor() as usize;
        sorted.iter().take(n_coarsen).map(|e| e.element_id).collect()
    }
}

// ============================================================================
// H-REFINEMENT
// ============================================================================

/// Element subdivision patterns
pub struct HRefinement;

impl HRefinement {
    /// Subdivide triangle into 4 triangles
    pub fn refine_triangle(
        vertices: [[f64; 3]; 3],
    ) -> Vec<[[f64; 3]; 3]> {
        let mid01 = midpoint(vertices[0], vertices[1]);
        let mid12 = midpoint(vertices[1], vertices[2]);
        let mid20 = midpoint(vertices[2], vertices[0]);

        vec![
            [vertices[0], mid01, mid20],
            [mid01, vertices[1], mid12],
            [mid20, mid12, vertices[2]],
            [mid01, mid12, mid20],
        ]
    }

    /// Subdivide quadrilateral into 4 quadrilaterals
    pub fn refine_quad(
        vertices: [[f64; 3]; 4],
    ) -> Vec<[[f64; 3]; 4]> {
        let mid01 = midpoint(vertices[0], vertices[1]);
        let mid12 = midpoint(vertices[1], vertices[2]);
        let mid23 = midpoint(vertices[2], vertices[3]);
        let mid30 = midpoint(vertices[3], vertices[0]);
        let center = [
            (vertices[0][0] + vertices[1][0] + vertices[2][0] + vertices[3][0]) / 4.0,
            (vertices[0][1] + vertices[1][1] + vertices[2][1] + vertices[3][1]) / 4.0,
            (vertices[0][2] + vertices[1][2] + vertices[2][2] + vertices[3][2]) / 4.0,
        ];

        vec![
            [vertices[0], mid01, center, mid30],
            [mid01, vertices[1], mid12, center],
            [center, mid12, vertices[2], mid23],
            [mid30, center, mid23, vertices[3]],
        ]
    }

    /// Subdivide tetrahedron into 8 tetrahedra
    pub fn refine_tetrahedron(
        vertices: [[f64; 3]; 4],
    ) -> Vec<[[f64; 3]; 4]> {
        let m01 = midpoint(vertices[0], vertices[1]);
        let m02 = midpoint(vertices[0], vertices[2]);
        let m03 = midpoint(vertices[0], vertices[3]);
        let m12 = midpoint(vertices[1], vertices[2]);
        let m13 = midpoint(vertices[1], vertices[3]);
        let m23 = midpoint(vertices[2], vertices[3]);

        vec![
            [vertices[0], m01, m02, m03],
            [m01, vertices[1], m12, m13],
            [m02, m12, vertices[2], m23],
            [m03, m13, m23, vertices[3]],
            [m01, m12, m02, m03],
            [m01, m13, m12, m03],
            [m03, m13, m12, m23],
            [m03, m12, m02, m23],
        ]
    }
}

fn midpoint(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [(a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, (a[2] + b[2]) / 2.0]
}

// ============================================================================
// P-REFINEMENT
// ============================================================================

/// Polynomial order refinement
pub struct PRefinement {
    pub min_order: usize,
    pub max_order: usize,
}

impl Default for PRefinement {
    fn default() -> Self {
        PRefinement {
            min_order: 1,
            max_order: 10,
        }
    }
}

impl PRefinement {
    /// Recommend polynomial order based on error and smoothness
    pub fn recommend_order(
        &self,
        current_order: usize,
        error: f64,
        target_error: f64,
        smoothness_indicator: f64,  // Higher = smoother solution
    ) -> usize {
        if error <= target_error {
            return current_order;
        }

        // Smooth solutions benefit from p-refinement
        // Non-smooth solutions need h-refinement
        if smoothness_indicator > 0.5 {
            (current_order + 1).min(self.max_order)
        } else {
            current_order
        }
    }

    /// Estimate smoothness from solution coefficients decay
    pub fn estimate_smoothness(coefficients: &[f64]) -> f64 {
        if coefficients.len() < 3 {
            return 0.5;
        }

        // Check decay rate of coefficients
        let n = coefficients.len();
        let high_order: f64 = coefficients[n - 3..].iter().map(|c| c.abs()).sum::<f64>() / 3.0;
        let low_order: f64 = coefficients[..3].iter().map(|c| c.abs()).sum::<f64>() / 3.0;

        if low_order > 1e-15 {
            let decay = high_order / low_order;
            (1.0 - decay).max(0.0).min(1.0)
        } else {
            0.5
        }
    }
}

// ============================================================================
// HP-ADAPTIVITY
// ============================================================================

/// HP-adaptive refinement controller
pub struct HPAdaptivity {
    pub h_refinement: AdaptiveRefinement,
    pub p_refinement: PRefinement,
    pub smoothness_threshold: f64,
}

impl Default for HPAdaptivity {
    fn default() -> Self {
        HPAdaptivity {
            h_refinement: AdaptiveRefinement::default(),
            p_refinement: PRefinement::default(),
            smoothness_threshold: 0.5,
        }
    }
}

#[derive(Debug, Clone)]
pub enum RefinementDecision {
    HRefine,
    PRefine,
    HPRefine,
    NoAction,
}

impl HPAdaptivity {
    /// Decide refinement type for each element
    pub fn decide_refinement(
        &self,
        errors: &[ElementError],
        smoothness: &[f64],
        current_orders: &[usize],
        _target_error: f64,
    ) -> Vec<(usize, RefinementDecision)> {
        let marking = self.h_refinement.mark_elements(errors);

        let mut decisions = Vec::new();

        for &eid in &marking.elements_to_refine {
            let smooth = smoothness.get(eid).copied().unwrap_or(0.5);
            let current_p = current_orders.get(eid).copied().unwrap_or(1);

            let decision = if smooth > self.smoothness_threshold
                && current_p < self.p_refinement.max_order
            {
                RefinementDecision::PRefine
            } else {
                RefinementDecision::HRefine
            };

            decisions.push((eid, decision));
        }

        decisions
    }
}

// ============================================================================
// SIMPLE MESH STRUCTURE
// ============================================================================

/// Simple mesh representation for error estimation
#[derive(Debug, Clone)]
pub struct SimpleMesh {
    pub num_nodes: usize,
    pub num_elements: usize,
    pub element_nodes: Vec<Vec<usize>>,
}

impl SimpleMesh {
    pub fn new(num_nodes: usize, element_nodes: Vec<Vec<usize>>) -> Self {
        let num_elements = element_nodes.len();
        SimpleMesh {
            num_nodes,
            num_elements,
            element_nodes,
        }
    }

    pub fn get_element_nodes(&self, element_id: usize) -> Vec<usize> {
        self.element_nodes.get(element_id).cloned().unwrap_or_default()
    }
}

// ============================================================================
// CONVERGENCE STUDY
// ============================================================================

/// Results from adaptive refinement iteration
#[derive(Debug, Clone)]
pub struct AdaptiveIterationResult {
    pub iteration: usize,
    pub num_elements: usize,
    pub num_dofs: usize,
    pub global_error: f64,
    pub elements_refined: usize,
    pub elements_coarsened: usize,
}

/// Convergence tracking for adaptive refinement
pub struct AdaptiveConvergence {
    pub history: Vec<AdaptiveIterationResult>,
    pub target_error: f64,
    pub max_iterations: usize,
}

impl AdaptiveConvergence {
    pub fn new(target_error: f64, max_iterations: usize) -> Self {
        AdaptiveConvergence {
            history: Vec::new(),
            target_error,
            max_iterations,
        }
    }

    pub fn add_iteration(&mut self, result: AdaptiveIterationResult) {
        self.history.push(result);
    }

    pub fn is_converged(&self) -> bool {
        self.history
            .last()
            .map(|r| r.global_error <= self.target_error)
            .unwrap_or(false)
    }

    pub fn should_continue(&self) -> bool {
        !self.is_converged() && self.history.len() < self.max_iterations
    }

    /// Estimate convergence rate
    pub fn convergence_rate(&self) -> Option<f64> {
        if self.history.len() < 2 {
            return None;
        }

        let n = self.history.len();
        let e1 = self.history[n - 2].global_error;
        let e2 = self.history[n - 1].global_error;
        let h1 = 1.0 / (self.history[n - 2].num_elements as f64).powf(1.0 / 3.0); // ~element size
        let h2 = 1.0 / (self.history[n - 1].num_elements as f64).powf(1.0 / 3.0);

        if h1 > h2 && e1 > e2 && h1 > 1e-14 && h2 > 1e-14 {
            let rate = (e1 / e2).ln() / (h1 / h2).ln();
            Some(rate)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stress_state_von_mises() {
        let stress = StressState {
            sigma: [100.0, 0.0, 0.0, 0.0, 0.0, 0.0], // Uniaxial tension
        };

        assert!((stress.von_mises() - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_error_summary() {
        let errors = vec![
            ElementError { element_id: 0, error_value: 1.0, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 1, error_value: 2.0, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 2, error_value: 3.0, relative_error: 0.0, error_type: ErrorType::Energy },
        ];

        let summary = ErrorSummary::from_element_errors(&errors);

        assert_eq!(summary.num_elements, 3);
        assert!((summary.max_element_error - 3.0).abs() < 1e-10);
        assert!((summary.min_element_error - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_threshold_marking() {
        let errors = vec![
            ElementError { element_id: 0, error_value: 0.5, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 1, error_value: 1.5, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 2, error_value: 2.5, relative_error: 0.0, error_type: ErrorType::Energy },
        ];

        let refinement = AdaptiveRefinement {
            strategy: RefinementStrategy::Threshold(1.0),
            ..Default::default()
        };

        let marking = refinement.mark_elements(&errors);

        assert_eq!(marking.elements_to_refine.len(), 2);
        assert!(marking.elements_to_refine.contains(&1));
        assert!(marking.elements_to_refine.contains(&2));
    }

    #[test]
    fn test_doerfler_marking() {
        let errors = vec![
            ElementError { element_id: 0, error_value: 1.0, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 1, error_value: 2.0, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 2, error_value: 3.0, relative_error: 0.0, error_type: ErrorType::Energy },
        ];

        let refinement = AdaptiveRefinement {
            strategy: RefinementStrategy::Doerfler(0.5),
            ..Default::default()
        };

        let marking = refinement.mark_elements(&errors);

        // Total error^2 = 1 + 4 + 9 = 14
        // Need 50% = 7
        // Element 2 alone has 9 > 7, so only it should be marked
        assert!(marking.elements_to_refine.contains(&2));
    }

    #[test]
    fn test_triangle_refinement() {
        let vertices = [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
        ];

        let refined = HRefinement::refine_triangle(vertices);

        assert_eq!(refined.len(), 4);
    }

    #[test]
    fn test_quad_refinement() {
        let vertices = [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 0.0],
            [0.0, 1.0, 0.0],
        ];

        let refined = HRefinement::refine_quad(vertices);

        assert_eq!(refined.len(), 4);
    }

    #[test]
    fn test_tetrahedron_refinement() {
        let vertices = [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ];

        let refined = HRefinement::refine_tetrahedron(vertices);

        assert_eq!(refined.len(), 8);
    }

    #[test]
    fn test_smoothness_estimation() {
        // Rapidly decaying coefficients = smooth
        let smooth_coeffs = vec![1.0, 0.5, 0.1, 0.01, 0.001];
        let smoothness = PRefinement::estimate_smoothness(&smooth_coeffs);
        assert!(smoothness > 0.5);

        // Non-decaying coefficients = not smooth
        let rough_coeffs = vec![1.0, 1.0, 1.0, 1.0, 1.0];
        let roughness = PRefinement::estimate_smoothness(&rough_coeffs);
        assert!(roughness < 0.5);
    }

    #[test]
    fn test_hp_adaptivity_decision() {
        let errors = vec![
            ElementError { element_id: 0, error_value: 1.0, relative_error: 0.0, error_type: ErrorType::Energy },
            ElementError { element_id: 1, error_value: 2.0, relative_error: 0.0, error_type: ErrorType::Energy },
        ];

        let smoothness = vec![0.8, 0.2]; // Element 0 smooth, element 1 rough
        let orders = vec![1, 1];

        let hp = HPAdaptivity::default();
        let decisions = hp.decide_refinement(&errors, &smoothness, &orders, 0.1);

        // Both should be refined (error > target)
        assert!(!decisions.is_empty());
    }

    #[test]
    fn test_adaptive_convergence() {
        let mut conv = AdaptiveConvergence::new(0.01, 10);

        conv.add_iteration(AdaptiveIterationResult {
            iteration: 0,
            num_elements: 100,
            num_dofs: 200,
            global_error: 1.0,
            elements_refined: 50,
            elements_coarsened: 0,
        });

        assert!(conv.should_continue());
        assert!(!conv.is_converged());

        conv.add_iteration(AdaptiveIterationResult {
            iteration: 1,
            num_elements: 200,
            num_dofs: 400,
            global_error: 0.005,
            elements_refined: 80,
            elements_coarsened: 10,
        });

        assert!(conv.is_converged());
        assert!(!conv.should_continue());
    }

    #[test]
    fn test_residual_estimator() {
        let residuals = vec![
            ElementResidual {
                element_id: 0,
                element_size: 0.1,
                interior_residual: 1.0,
                edge_jump: 0.5,
            },
        ];

        let estimator = ResidualEstimator::default();
        let errors = estimator.estimate_error(&residuals);

        assert_eq!(errors.len(), 1);
        assert!(errors[0].error_value > 0.0);
    }
}
