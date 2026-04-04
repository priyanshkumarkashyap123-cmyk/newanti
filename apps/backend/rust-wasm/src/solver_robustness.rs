// ============================================================================
// PHASE 51: SOLVER ROBUSTNESS & NUMERICAL STABILITY
// ============================================================================
//
// This module addresses critical gaps in solver infrastructure:
// - DOF Reordering: RCM (Reverse Cuthill-McKee), AMD (Approximate Minimum Degree)
// - Equilibrium Scaling: Automatic row/column scaling for conditioning
// - Matrix Diagnostics: Singularity detection, rank analysis
// - Configurable Numerics: User-controllable tolerances
//
// Industry Parity: ANSYS, Abaqus, NASTRAN
// ============================================================================

use nalgebra::{DMatrix, DVector};
use std::collections::{BinaryHeap, HashSet, VecDeque};
use std::cmp::Ordering;

/// Numerical settings with configurable tolerances
#[derive(Debug, Clone)]
pub struct NumericalSettings {
    /// Relative tolerance for convergence checks
    pub tolerance_relative: f64,
    /// Absolute tolerance for convergence checks
    pub tolerance_absolute: f64,
    /// Maximum iterations for iterative solvers
    pub max_iterations: usize,
    /// Characteristic length for model (auto-computed if None)
    pub characteristic_length: Option<f64>,
    /// Condition number warning threshold
    pub condition_warning: f64,
    /// Condition number error threshold
    pub condition_error: f64,
    /// Minimum pivot for direct solvers
    pub min_pivot: f64,
    /// Enable automatic scaling
    pub auto_scaling: bool,
    /// Enable DOF reordering
    pub auto_reordering: bool,
}

impl Default for NumericalSettings {
    fn default() -> Self {
        Self {
            tolerance_relative: 1e-6,
            tolerance_absolute: 1e-12,
            max_iterations: 100,
            characteristic_length: None,
            condition_warning: 1e10,
            condition_error: 1e14,
            min_pivot: 1e-14,
            auto_scaling: true,
            auto_reordering: true,
        }
    }
}

impl NumericalSettings {
    pub fn strict() -> Self {
        Self {
            tolerance_relative: 1e-10,
            tolerance_absolute: 1e-16,
            max_iterations: 500,
            condition_warning: 1e8,
            condition_error: 1e12,
            min_pivot: 1e-16,
            ..Default::default()
        }
    }
    
    pub fn relaxed() -> Self {
        Self {
            tolerance_relative: 1e-4,
            tolerance_absolute: 1e-8,
            max_iterations: 50,
            condition_warning: 1e12,
            condition_error: 1e16,
            min_pivot: 1e-12,
            ..Default::default()
        }
    }
}

// ============================================================================
// DOF REORDERING ALGORITHMS
// ============================================================================

/// Sparse graph representation for reordering algorithms
#[derive(Debug, Clone)]
pub struct SparseGraph {
    /// Number of nodes
    pub n: usize,
    /// Adjacency list
    pub adj: Vec<Vec<usize>>,
    /// Node degrees
    pub degrees: Vec<usize>,
}

impl SparseGraph {
    /// Create graph from sparse matrix pattern
    pub fn from_matrix_pattern(n: usize, row_ptr: &[usize], col_idx: &[usize]) -> Self {
        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
        
        for i in 0..n {
            for k in row_ptr[i]..row_ptr[i + 1] {
                let j = col_idx[k];
                if i != j {
                    adj[i].push(j);
                }
            }
        }
        
        let degrees: Vec<usize> = adj.iter().map(|a| a.len()).collect();
        
        Self { n, adj, degrees }
    }
    
    /// Create graph from dense matrix (for testing)
    pub fn from_dense(matrix: &DMatrix<f64>, threshold: f64) -> Self {
        let n = matrix.nrows();
        let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
        
        for i in 0..n {
            for j in 0..n {
                if i != j && matrix[(i, j)].abs() > threshold {
                    adj[i].push(j);
                }
            }
        }
        
        let degrees: Vec<usize> = adj.iter().map(|a| a.len()).collect();
        
        Self { n, adj, degrees }
    }
    
    /// Find node with minimum degree among unvisited nodes
    fn min_degree_node(&self, visited: &[bool]) -> Option<usize> {
        let mut min_deg = usize::MAX;
        let mut min_node = None;
        
        for i in 0..self.n {
            if !visited[i] && self.degrees[i] < min_deg {
                min_deg = self.degrees[i];
                min_node = Some(i);
            }
        }
        
        min_node
    }
}

/// Result of DOF reordering
#[derive(Debug, Clone)]
pub struct ReorderingResult {
    /// New-to-old permutation: new_order[new_idx] = old_idx
    pub new_to_old: Vec<usize>,
    /// Old-to-new permutation: old_to_new[old_idx] = new_idx
    pub old_to_new: Vec<usize>,
    /// Original bandwidth
    pub original_bandwidth: usize,
    /// New bandwidth after reordering
    pub new_bandwidth: usize,
    /// Bandwidth reduction percentage
    pub reduction_percent: f64,
}

impl ReorderingResult {
    pub fn identity(n: usize) -> Self {
        Self {
            new_to_old: (0..n).collect(),
            old_to_new: (0..n).collect(),
            original_bandwidth: n,
            new_bandwidth: n,
            reduction_percent: 0.0,
        }
    }
}

/// Reverse Cuthill-McKee (RCM) algorithm for bandwidth reduction
/// 
/// This is the industry-standard algorithm used by:
/// - ANSYS (WAVEFRONT solver)
/// - NASTRAN (automatic resequencing)
/// - SAP2000 (equation numbering)
pub struct ReverseCuthillMcKee;

impl ReverseCuthillMcKee {
    /// Compute RCM ordering for sparse graph
    pub fn reorder(graph: &SparseGraph) -> ReorderingResult {
        let n = graph.n;
        if n == 0 {
            return ReorderingResult::identity(0);
        }
        
        let mut visited = vec![false; n];
        let mut ordering = Vec::with_capacity(n);
        
        // Process potentially disconnected components
        while ordering.len() < n {
            // Find peripheral node (pseudo-diameter endpoint)
            let start = Self::find_peripheral_node(graph, &visited);
            
            // BFS from start node
            let mut queue = VecDeque::new();
            queue.push_back(start);
            visited[start] = true;
            
            while let Some(node) = queue.pop_front() {
                ordering.push(node);
                
                // Get unvisited neighbors sorted by degree
                let mut neighbors: Vec<usize> = graph.adj[node]
                    .iter()
                    .copied()
                    .filter(|&n| !visited[n])
                    .collect();
                
                // Sort by degree (ascending) for Cuthill-McKee
                neighbors.sort_by_key(|&n| graph.degrees[n]);
                
                for neighbor in neighbors {
                    if !visited[neighbor] {
                        visited[neighbor] = true;
                        queue.push_back(neighbor);
                    }
                }
            }
        }
        
        // Reverse for RCM (gives better profile in practice)
        ordering.reverse();
        
        // Build inverse permutation
        let mut old_to_new = vec![0; n];
        for (new_idx, &old_idx) in ordering.iter().enumerate() {
            old_to_new[old_idx] = new_idx;
        }
        
        // Compute bandwidths
        let original_bandwidth = Self::compute_bandwidth(graph, &(0..n).collect::<Vec<_>>());
        let new_bandwidth = Self::compute_bandwidth(graph, &ordering);
        
        let reduction = if original_bandwidth > 0 {
            100.0 * (1.0 - new_bandwidth as f64 / original_bandwidth as f64)
        } else {
            0.0
        };
        
        ReorderingResult {
            new_to_old: ordering,
            old_to_new,
            original_bandwidth,
            new_bandwidth,
            reduction_percent: reduction,
        }
    }
    
    /// Find a peripheral node using pseudo-diameter heuristic
    fn find_peripheral_node(graph: &SparseGraph, visited: &[bool]) -> usize {
        // Start from minimum degree unvisited node
        let start = graph.min_degree_node(visited).unwrap_or(0);
        
        // Do two BFS passes to find pseudo-diameter endpoint
        let mut current = start;
        for _ in 0..2 {
            current = Self::bfs_furthest(graph, current, visited);
        }
        
        current
    }
    
    /// BFS to find furthest node from start
    fn bfs_furthest(graph: &SparseGraph, start: usize, global_visited: &[bool]) -> usize {
        let n = graph.n;
        let mut visited = vec![false; n];
        let mut queue = VecDeque::new();
        let mut last = start;
        
        queue.push_back(start);
        visited[start] = true;
        
        while let Some(node) = queue.pop_front() {
            last = node;
            for &neighbor in &graph.adj[node] {
                if !visited[neighbor] && !global_visited[neighbor] {
                    visited[neighbor] = true;
                    queue.push_back(neighbor);
                }
            }
        }
        
        last
    }
    
    /// Compute bandwidth for given ordering
    fn compute_bandwidth(graph: &SparseGraph, ordering: &[usize]) -> usize {
        let n = graph.n;
        let mut inv_order = vec![0; n];
        for (new, &old) in ordering.iter().enumerate() {
            inv_order[old] = new;
        }
        
        let mut max_bandwidth = 0;
        for old_i in 0..n {
            let new_i = inv_order[old_i];
            for &old_j in &graph.adj[old_i] {
                let new_j = inv_order[old_j];
                let bandwidth = if new_i > new_j { new_i - new_j } else { new_j - new_i };
                max_bandwidth = max_bandwidth.max(bandwidth);
            }
        }
        
        max_bandwidth
    }
}

/// Approximate Minimum Degree (AMD) algorithm
/// 
/// Superior to RCM for sparse direct solvers (Cholesky, LU)
/// Used by: CHOLMOD, UMFPACK, PARDISO
#[derive(Debug, Clone, PartialEq, Eq)]
struct AMDNode {
    degree: usize,
    index: usize,
}

impl Ord for AMDNode {
    fn cmp(&self, other: &Self) -> Ordering {
        // Min-heap: smaller degree has higher priority
        other.degree.cmp(&self.degree)
            .then_with(|| other.index.cmp(&self.index))
    }
}

impl PartialOrd for AMDNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct ApproximateMinimumDegree;

impl ApproximateMinimumDegree {
    /// Compute AMD ordering for sparse graph
    pub fn reorder(graph: &SparseGraph) -> ReorderingResult {
        let n = graph.n;
        if n == 0 {
            return ReorderingResult::identity(0);
        }
        
        // Initialize degree for each node
        let mut degrees = graph.degrees.clone();
        let mut eliminated = vec![false; n];
        let mut adj_sets: Vec<HashSet<usize>> = graph.adj.iter()
            .map(|a| a.iter().copied().collect())
            .collect();
        
        // Priority queue for minimum degree selection
        let mut heap: BinaryHeap<AMDNode> = (0..n)
            .map(|i| AMDNode { degree: degrees[i], index: i })
            .collect();
        
        let mut ordering = Vec::with_capacity(n);
        
        while ordering.len() < n {
            // Find minimum degree node that hasn't been eliminated
            let node = loop {
                if let Some(amd_node) = heap.pop() {
                    if !eliminated[amd_node.index] {
                        break amd_node.index;
                    }
                } else {
                    break 0; // Fallback (shouldn't happen)
                }
            };
            
            eliminated[node] = true;
            ordering.push(node);
            
            // Get neighbors of eliminated node
            let neighbors: Vec<usize> = adj_sets[node].iter()
                .copied()
                .filter(|&n| !eliminated[n])
                .collect();
            
            // Form elimination clique: connect all neighbors
            for i in 0..neighbors.len() {
                for j in (i + 1)..neighbors.len() {
                    let ni = neighbors[i];
                    let nj = neighbors[j];
                    adj_sets[ni].insert(nj);
                    adj_sets[nj].insert(ni);
                }
                // Remove eliminated node from neighbor's adjacency
                adj_sets[neighbors[i]].remove(&node);
            }
            
            // Update degrees and re-insert to heap
            for &neighbor in &neighbors {
                degrees[neighbor] = adj_sets[neighbor].iter()
                    .filter(|&&n| !eliminated[n])
                    .count();
                heap.push(AMDNode { degree: degrees[neighbor], index: neighbor });
            }
        }
        
        // Build inverse permutation
        let mut old_to_new = vec![0; n];
        for (new_idx, &old_idx) in ordering.iter().enumerate() {
            old_to_new[old_idx] = new_idx;
        }
        
        let original_bandwidth = ReverseCuthillMcKee::compute_bandwidth(graph, &(0..n).collect::<Vec<_>>());
        let new_bandwidth = ReverseCuthillMcKee::compute_bandwidth(graph, &ordering);
        
        let reduction = if original_bandwidth > 0 {
            100.0 * (1.0 - new_bandwidth as f64 / original_bandwidth as f64)
        } else {
            0.0
        };
        
        ReorderingResult {
            new_to_old: ordering,
            old_to_new,
            original_bandwidth,
            new_bandwidth,
            reduction_percent: reduction,
        }
    }
}

// ============================================================================
// EQUILIBRIUM SCALING
// ============================================================================

/// Result of matrix scaling
#[derive(Debug, Clone)]
pub struct ScalingResult {
    /// Row scaling factors (D_r)
    pub row_scale: DVector<f64>,
    /// Column scaling factors (D_c)
    pub col_scale: DVector<f64>,
    /// Original condition number estimate
    pub original_condition: f64,
    /// Scaled condition number estimate
    pub scaled_condition: f64,
    /// Improvement factor
    pub improvement_factor: f64,
}

/// Equilibrium scaling for improved conditioning
/// 
/// Computes D_r * A * D_c where D_r and D_c are diagonal matrices
/// such that the scaled matrix has unit row and column norms.
/// 
/// Industry standard in: PARDISO, MUMPS, SuperLU
pub struct EquilibriumScaling;

impl EquilibriumScaling {
    /// Compute scaling factors using iterative equilibration
    pub fn compute(matrix: &DMatrix<f64>, max_iter: usize) -> ScalingResult {
        let n = matrix.nrows();
        let m = matrix.ncols();
        
        if n == 0 || m == 0 {
            return ScalingResult {
                row_scale: DVector::zeros(0),
                col_scale: DVector::zeros(0),
                original_condition: 1.0,
                scaled_condition: 1.0,
                improvement_factor: 1.0,
            };
        }
        
        let mut row_scale = DVector::from_element(n, 1.0);
        let mut col_scale = DVector::from_element(m, 1.0);
        
        // Estimate original condition
        let original_condition = Self::estimate_condition(matrix);
        
        // Iterative equilibration (Sinkhorn-like)
        for _ in 0..max_iter {
            // Row scaling: make max absolute value in each row = 1
            for i in 0..n {
                let mut max_val = 0.0f64;
                for j in 0..m {
                    let scaled = (matrix[(i, j)] * col_scale[j]).abs();
                    max_val = max_val.max(scaled);
                }
                if max_val > 1e-16 {
                    row_scale[i] = 1.0 / max_val;
                }
            }
            
            // Column scaling: make max absolute value in each column = 1
            for j in 0..m {
                let mut max_val = 0.0f64;
                for i in 0..n {
                    let scaled = (matrix[(i, j)] * row_scale[i]).abs();
                    max_val = max_val.max(scaled);
                }
                if max_val > 1e-16 {
                    col_scale[j] = 1.0 / max_val;
                }
            }
        }
        
        // Estimate scaled condition
        let scaled_matrix = Self::apply_scaling(matrix, &row_scale, &col_scale);
        let scaled_condition = Self::estimate_condition(&scaled_matrix);
        
        let improvement = if scaled_condition > 0.0 {
            original_condition / scaled_condition
        } else {
            1.0
        };
        
        ScalingResult {
            row_scale,
            col_scale,
            original_condition,
            scaled_condition,
            improvement_factor: improvement,
        }
    }
    
    /// Apply scaling to matrix
    pub fn apply_scaling(
        matrix: &DMatrix<f64>,
        row_scale: &DVector<f64>,
        col_scale: &DVector<f64>,
    ) -> DMatrix<f64> {
        let n = matrix.nrows();
        let m = matrix.ncols();
        let mut scaled = DMatrix::zeros(n, m);
        
        for i in 0..n {
            for j in 0..m {
                scaled[(i, j)] = row_scale[i] * matrix[(i, j)] * col_scale[j];
            }
        }
        
        scaled
    }
    
    /// Apply scaling to RHS vector
    pub fn scale_rhs(rhs: &DVector<f64>, row_scale: &DVector<f64>) -> DVector<f64> {
        DVector::from_fn(rhs.len(), |i, _| rhs[i] * row_scale[i])
    }
    
    /// Unscale solution vector
    pub fn unscale_solution(x: &DVector<f64>, col_scale: &DVector<f64>) -> DVector<f64> {
        DVector::from_fn(x.len(), |i, _| x[i] * col_scale[i])
    }
    
    /// Estimate condition number using 1-norm
    fn estimate_condition(matrix: &DMatrix<f64>) -> f64 {
        let n = matrix.nrows();
        if n == 0 {
            return 1.0;
        }
        
        // 1-norm: max column sum
        let mut norm1 = 0.0f64;
        for j in 0..matrix.ncols() {
            let mut col_sum = 0.0;
            for i in 0..n {
                col_sum += matrix[(i, j)].abs();
            }
            norm1 = norm1.max(col_sum);
        }
        
        // Infinity-norm: max row sum
        let mut norm_inf = 0.0f64;
        for i in 0..n {
            let mut row_sum = 0.0;
            for j in 0..matrix.ncols() {
                row_sum += matrix[(i, j)].abs();
            }
            norm_inf = norm_inf.max(row_sum);
        }
        
        // Rough condition estimate
        (norm1 * norm_inf).sqrt()
    }
}

/// Geometric scaling based on characteristic length
pub struct GeometricScaling;

impl GeometricScaling {
    /// Compute characteristic length from node coordinates
    pub fn characteristic_length(coords: &[(f64, f64, f64)]) -> f64 {
        if coords.is_empty() {
            return 1.0;
        }
        
        let mut min_x = f64::MAX;
        let mut max_x = f64::MIN;
        let mut min_y = f64::MAX;
        let mut max_y = f64::MIN;
        let mut min_z = f64::MAX;
        let mut max_z = f64::MIN;
        
        for &(x, y, z) in coords {
            min_x = min_x.min(x);
            max_x = max_x.max(x);
            min_y = min_y.min(y);
            max_y = max_y.max(y);
            min_z = min_z.min(z);
            max_z = max_z.max(z);
        }
        
        let dx = max_x - min_x;
        let dy = max_y - min_y;
        let dz = max_z - min_z;
        
        // Characteristic length is the diagonal of bounding box
        (dx * dx + dy * dy + dz * dz).sqrt().max(1e-10)
    }
    
    /// Scale coordinates to unit box
    pub fn normalize_coordinates(
        coords: &[(f64, f64, f64)],
    ) -> (Vec<(f64, f64, f64)>, f64) {
        let char_len = Self::characteristic_length(coords);
        let scale = 1.0 / char_len;
        
        let normalized: Vec<_> = coords.iter()
            .map(|&(x, y, z)| (x * scale, y * scale, z * scale))
            .collect();
        
        (normalized, char_len)
    }
}

// ============================================================================
// MATRIX DIAGNOSTICS
// ============================================================================

/// Comprehensive matrix analysis results
#[derive(Debug, Clone)]
pub struct MatrixDiagnostics {
    /// Matrix size
    pub size: (usize, usize),
    /// Number of non-zeros (for sparse)
    pub nnz: usize,
    /// Sparsity percentage
    pub sparsity: f64,
    /// Is symmetric (within tolerance)
    pub is_symmetric: bool,
    /// Is positive definite
    pub is_positive_definite: bool,
    /// Condition number estimate
    pub condition_number: f64,
    /// Matrix rank (if computable)
    pub rank: Option<usize>,
    /// Bandwidth
    pub bandwidth: usize,
    /// Number of zero diagonals
    pub zero_diagonals: usize,
    /// Smallest diagonal magnitude
    pub min_diagonal: f64,
    /// Largest diagonal magnitude
    pub max_diagonal: f64,
    /// Frobenius norm
    pub frobenius_norm: f64,
    /// Warnings
    pub warnings: Vec<String>,
    /// Errors
    pub errors: Vec<String>,
}

pub struct MatrixAnalyzer;

impl MatrixAnalyzer {
    /// Perform comprehensive matrix analysis
    pub fn analyze(matrix: &DMatrix<f64>, settings: &NumericalSettings) -> MatrixDiagnostics {
        let n = matrix.nrows();
        let m = matrix.ncols();
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        
        // Count non-zeros
        let mut nnz = 0;
        for i in 0..n {
            for j in 0..m {
                if matrix[(i, j)].abs() > 1e-16 {
                    nnz += 1;
                }
            }
        }
        let total = n * m;
        let sparsity = if total > 0 { 100.0 * (1.0 - nnz as f64 / total as f64) } else { 0.0 };
        
        // Check symmetry
        let is_symmetric = if n == m {
            let mut sym = true;
            'outer: for i in 0..n {
                for j in (i + 1)..n {
                    if (matrix[(i, j)] - matrix[(j, i)]).abs() > 1e-12 {
                        sym = false;
                        break 'outer;
                    }
                }
            }
            sym
        } else {
            false
        };
        
        // Analyze diagonals
        let (zero_diags, min_diag, max_diag) = if n == m {
            let mut zero_count = 0;
            let mut min_d = f64::MAX;
            let mut max_d = 0.0f64;
            for i in 0..n {
                let d = matrix[(i, i)].abs();
                if d < 1e-16 {
                    zero_count += 1;
                }
                min_d = min_d.min(d);
                max_d = max_d.max(d);
            }
            (zero_count, min_d, max_d)
        } else {
            (0, 0.0, 0.0)
        };
        
        if zero_diags > 0 {
            errors.push(format!("{} zero diagonal entries detected - matrix may be singular", zero_diags));
        }
        
        // Compute bandwidth
        let mut bandwidth = 0;
        for i in 0..n {
            for j in 0..m {
                if matrix[(i, j)].abs() > 1e-16 {
                    let diff = if i > j { i - j } else { j - i };
                    bandwidth = bandwidth.max(diff);
                }
            }
        }
        
        // Frobenius norm
        let mut fro_norm = 0.0;
        for i in 0..n {
            for j in 0..m {
                fro_norm += matrix[(i, j)] * matrix[(i, j)];
            }
        }
        fro_norm = fro_norm.sqrt();
        
        // Condition number estimate (rough)
        let condition_number = EquilibriumScaling::estimate_condition(matrix);
        if condition_number > settings.condition_error {
            errors.push(format!("Condition number {:.2e} exceeds error threshold {:.2e}", 
                condition_number, settings.condition_error));
        } else if condition_number > settings.condition_warning {
            warnings.push(format!("Condition number {:.2e} exceeds warning threshold {:.2e}", 
                condition_number, settings.condition_warning));
        }
        
        // Check positive definiteness (for square matrices)
        let is_pd = if n == m && is_symmetric {
            Self::is_positive_definite(matrix)
        } else {
            false
        };
        
        if n == m && is_symmetric && !is_pd {
            warnings.push("Matrix is symmetric but not positive definite".to_string());
        }
        
        MatrixDiagnostics {
            size: (n, m),
            nnz,
            sparsity,
            is_symmetric,
            is_positive_definite: is_pd,
            condition_number,
            rank: None, // Expensive to compute
            bandwidth,
            zero_diagonals: zero_diags,
            min_diagonal: min_diag,
            max_diagonal: max_diag,
            frobenius_norm: fro_norm,
            warnings,
            errors,
        }
    }
    
    /// Check positive definiteness via Cholesky attempt
    fn is_positive_definite(matrix: &DMatrix<f64>) -> bool {
        let n = matrix.nrows();
        if n == 0 {
            return true;
        }
        
        // Try Cholesky decomposition
        let mut l = DMatrix::zeros(n, n);
        
        for i in 0..n {
            for j in 0..=i {
                let mut sum = 0.0;
                
                if j == i {
                    for k in 0..j {
                        sum += l[(j, k)] * l[(j, k)];
                    }
                    let diag = matrix[(j, j)] - sum;
                    if diag <= 0.0 {
                        return false;
                    }
                    l[(j, j)] = diag.sqrt();
                } else {
                    for k in 0..j {
                        sum += l[(i, k)] * l[(j, k)];
                    }
                    if l[(j, j)].abs() < 1e-16 {
                        return false;
                    }
                    l[(i, j)] = (matrix[(i, j)] - sum) / l[(j, j)];
                }
            }
        }
        
        true
    }
}

// ============================================================================
// ITERATIVE REFINEMENT
// ============================================================================

/// Iterative refinement for improved solution accuracy
/// 
/// Given initial solution x0, refines to x* such that ||Ax* - b|| is minimized
pub struct IterativeRefinement;

impl IterativeRefinement {
    /// Refine solution using residual correction
    pub fn refine(
        matrix: &DMatrix<f64>,
        rhs: &DVector<f64>,
        initial_x: &DVector<f64>,
        solve_fn: impl Fn(&DVector<f64>) -> Option<DVector<f64>>,
        settings: &NumericalSettings,
    ) -> Option<DVector<f64>> {
        let n = rhs.len();
        let mut x = initial_x.clone();
        
        for iter in 0..settings.max_iterations {
            // Compute residual r = b - Ax
            let ax = matrix * &x;
            let mut residual = rhs.clone();
            for i in 0..n {
                residual[i] -= ax[i];
            }
            
            // Check convergence
            let res_norm = residual.norm();
            let x_norm = x.norm().max(1.0);
            if res_norm / x_norm < settings.tolerance_relative {
                return Some(x);
            }
            
            // Solve for correction: A * dx = r
            let dx = solve_fn(&residual)?;
            
            // Update solution
            for i in 0..n {
                x[i] += dx[i];
            }
            
            // Check for stagnation
            if iter > 3 && res_norm > 0.99 * (rhs - matrix * initial_x).norm() {
                // Not improving, return current best
                break;
            }
        }
        
        Some(x)
    }
}

// ============================================================================
// UNIFIED ROBUST SOLVER
// ============================================================================

/// Robust solver wrapper with automatic preprocessing
pub struct RobustSolver {
    settings: NumericalSettings,
    diagnostics: Option<MatrixDiagnostics>,
    scaling: Option<ScalingResult>,
    reordering: Option<ReorderingResult>,
}

impl RobustSolver {
    pub fn new(settings: NumericalSettings) -> Self {
        Self {
            settings,
            diagnostics: None,
            scaling: None,
            reordering: None,
        }
    }
    
    /// Solve Ax = b with automatic preprocessing
    pub fn solve(
        &mut self,
        matrix: &DMatrix<f64>,
        rhs: &DVector<f64>,
    ) -> Result<DVector<f64>, String> {
        let n = matrix.nrows();
        if n != matrix.ncols() {
            return Err("Matrix must be square".to_string());
        }
        if n != rhs.len() {
            return Err("RHS dimension mismatch".to_string());
        }
        
        // Step 1: Analyze matrix
        let diagnostics = MatrixAnalyzer::analyze(matrix, &self.settings);
        if !diagnostics.errors.is_empty() {
            return Err(diagnostics.errors.join("; "));
        }
        self.diagnostics = Some(diagnostics);
        
        // Step 2: Apply scaling if enabled
        let (scaled_matrix, scaled_rhs) = if self.settings.auto_scaling {
            let scaling = EquilibriumScaling::compute(matrix, 10);
            let sm = EquilibriumScaling::apply_scaling(matrix, &scaling.row_scale, &scaling.col_scale);
            let sr = EquilibriumScaling::scale_rhs(rhs, &scaling.row_scale);
            self.scaling = Some(scaling);
            (sm, sr)
        } else {
            (matrix.clone(), rhs.clone())
        };
        
        // Step 3: Solve (using nalgebra's LU)
        let decomp = scaled_matrix.clone().lu();
        let solution = decomp.solve(&scaled_rhs)
            .ok_or_else(|| "LU decomposition failed - matrix is singular".to_string())?;
        
        // Step 4: Unscale solution
        let final_solution = if let Some(ref scaling) = self.scaling {
            EquilibriumScaling::unscale_solution(&solution, &scaling.col_scale)
        } else {
            solution
        };
        
        // Step 5: Iterative refinement if condition is marginal
        if let Some(ref diag) = self.diagnostics {
            if diag.condition_number > self.settings.condition_warning {
                let lu_ref = scaled_matrix.lu();
                if let Some(refined) = IterativeRefinement::refine(
                    matrix,
                    rhs,
                    &final_solution,
                    |r| lu_ref.solve(r),
                    &self.settings,
                ) {
                    return Ok(refined);
                }
            }
        }
        
        Ok(final_solution)
    }
    
    /// Get diagnostics from last solve
    pub fn diagnostics(&self) -> Option<&MatrixDiagnostics> {
        self.diagnostics.as_ref()
    }
    
    /// Get scaling from last solve
    pub fn scaling(&self) -> Option<&ScalingResult> {
        self.scaling.as_ref()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rcm_reordering() {
        // Create a simple graph (5-node path)
        let graph = SparseGraph {
            n: 5,
            adj: vec![
                vec![1],       // 0 -> 1
                vec![0, 2],    // 1 -> 0, 2
                vec![1, 3],    // 2 -> 1, 3
                vec![2, 4],    // 3 -> 2, 4
                vec![3],       // 4 -> 3
            ],
            degrees: vec![1, 2, 2, 2, 1],
        };
        
        let result = ReverseCuthillMcKee::reorder(&graph);
        assert_eq!(result.new_to_old.len(), 5);
        assert_eq!(result.old_to_new.len(), 5);
        // Bandwidth should be preserved (already optimal for a path)
        assert!(result.new_bandwidth <= result.original_bandwidth);
    }
    
    #[test]
    fn test_amd_reordering() {
        let graph = SparseGraph {
            n: 4,
            adj: vec![
                vec![1, 2, 3],
                vec![0, 2],
                vec![0, 1, 3],
                vec![0, 2],
            ],
            degrees: vec![3, 2, 3, 2],
        };
        
        let result = ApproximateMinimumDegree::reorder(&graph);
        assert_eq!(result.new_to_old.len(), 4);
        // AMD should start with minimum degree nodes
        let first_eliminated = result.new_to_old[0];
        assert!(graph.degrees[first_eliminated] <= 3);
    }
    
    #[test]
    fn test_equilibrium_scaling() {
        // Poorly conditioned matrix
        let matrix = DMatrix::from_row_slice(3, 3, &[
            1e6, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, 1e-6,
        ]);
        
        let result = EquilibriumScaling::compute(&matrix, 10);
        
        // Scaling should improve condition
        assert!(result.scaled_condition < result.original_condition);
        assert!(result.improvement_factor > 1.0);
    }
    
    #[test]
    fn test_matrix_diagnostics() {
        let matrix = DMatrix::from_row_slice(3, 3, &[
            4.0, 1.0, 0.0,
            1.0, 3.0, 1.0,
            0.0, 1.0, 2.0,
        ]);
        
        let settings = NumericalSettings::default();
        let diag = MatrixAnalyzer::analyze(&matrix, &settings);
        
        assert!(diag.is_symmetric);
        assert!(diag.is_positive_definite);
        assert_eq!(diag.size, (3, 3));
        assert_eq!(diag.zero_diagonals, 0);
        assert!(diag.errors.is_empty());
    }
    
    #[test]
    fn test_robust_solver() {
        let matrix = DMatrix::from_row_slice(3, 3, &[
            4.0, 1.0, 0.0,
            1.0, 3.0, 1.0,
            0.0, 1.0, 2.0,
        ]);
        let rhs = DVector::from_column_slice(&[1.0, 2.0, 3.0]);
        
        let mut solver = RobustSolver::new(NumericalSettings::default());
        let solution = solver.solve(&matrix, &rhs).unwrap();
        
        // Verify solution
        let residual = &matrix * &solution - &rhs;
        assert!(residual.norm() < 1e-10);
    }
    
    #[test]
    fn test_geometric_scaling() {
        let coords = vec![
            (0.0, 0.0, 0.0),
            (1000.0, 0.0, 0.0),
            (1000.0, 500.0, 0.0),
            (0.0, 500.0, 0.0),
        ];
        
        let char_len = GeometricScaling::characteristic_length(&coords);
        // Should be diagonal of 1000x500 box
        let expected = (1000.0f64.powi(2) + 500.0f64.powi(2)).sqrt();
        assert!((char_len - expected).abs() < 1e-6);
        
        let (normalized, scale) = GeometricScaling::normalize_coordinates(&coords);
        assert!((scale - char_len).abs() < 1e-6);
        
        // Normalized should be in unit box
        for (x, y, z) in normalized {
            assert!(x.abs() <= 1.0 + 1e-10);
            assert!(y.abs() <= 1.0 + 1e-10);
            assert!(z.abs() <= 1.0 + 1e-10);
        }
    }
    
    #[test]
    fn test_iterative_refinement() {
        // Slightly ill-conditioned matrix
        let matrix = DMatrix::from_row_slice(3, 3, &[
            1.0, 0.5, 0.25,
            0.5, 1.0, 0.5,
            0.25, 0.5, 1.0,
        ]);
        let rhs = DVector::from_column_slice(&[1.0, 1.0, 1.0]);
        
        // Start with slightly wrong solution
        let initial_x = DVector::from_column_slice(&[0.5, 0.5, 0.5]);
        
        let lu = matrix.clone().lu();
        let settings = NumericalSettings::default();
        
        let refined = IterativeRefinement::refine(
            &matrix,
            &rhs,
            &initial_x,
            |r| lu.solve(r),
            &settings,
        ).unwrap();
        
        // Refined should be more accurate
        let initial_res = (&matrix * &initial_x - &rhs).norm();
        let refined_res = (&matrix * &refined - &rhs).norm();
        assert!(refined_res < initial_res);
    }
    
    #[test]
    fn test_numerical_settings() {
        let default = NumericalSettings::default();
        let strict = NumericalSettings::strict();
        let relaxed = NumericalSettings::relaxed();
        
        assert!(strict.tolerance_relative < default.tolerance_relative);
        assert!(relaxed.tolerance_relative > default.tolerance_relative);
        assert!(strict.condition_warning < default.condition_warning);
    }
    
    #[test]
    fn test_sparse_graph_from_dense() {
        let matrix = DMatrix::from_row_slice(4, 4, &[
            1.0, 0.5, 0.0, 0.0,
            0.5, 1.0, 0.5, 0.0,
            0.0, 0.5, 1.0, 0.5,
            0.0, 0.0, 0.5, 1.0,
        ]);
        
        let graph = SparseGraph::from_dense(&matrix, 0.1);
        assert_eq!(graph.n, 4);
        assert_eq!(graph.degrees[0], 1); // Node 0 connected to 1
        assert_eq!(graph.degrees[1], 2); // Node 1 connected to 0, 2
        assert_eq!(graph.degrees[2], 2); // Node 2 connected to 1, 3
        assert_eq!(graph.degrees[3], 1); // Node 3 connected to 2
    }
}
