//! Isogeometric Analysis (IGA) Module
//! 
//! Implements NURBS-based finite element analysis bridging CAD and FEA
//! per Hughes et al. (2005) and subsequent developments:
//! - B-spline and NURBS basis functions
//! - Bézier extraction for element implementation
//! - T-spline support for local refinement
//! - CAD geometry integration

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// B-SPLINE FUNDAMENTALS
// ============================================================================

/// B-spline curve definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BSplineCurve {
    /// Polynomial degree
    pub degree: usize,
    /// Control points [x, y, z]
    pub control_points: Vec<[f64; 3]>,
    /// Knot vector
    pub knots: Vec<f64>,
}

impl BSplineCurve {
    pub fn new(degree: usize, control_points: Vec<[f64; 3]>, knots: Vec<f64>) -> Self {
        Self { degree, control_points, knots }
    }
    
    /// Number of control points
    pub fn n_control_points(&self) -> usize {
        self.control_points.len()
    }
    
    /// Number of basis functions
    pub fn n_basis(&self) -> usize {
        self.control_points.len()
    }
    
    /// Evaluate B-spline basis function N_{i,p}(u)
    pub fn basis_function(&self, i: usize, p: usize, u: f64) -> f64 {
        self.cox_deboor(i, p, u, &self.knots)
    }
    
    /// Cox-de Boor recursion
    fn cox_deboor(&self, i: usize, p: usize, u: f64, knots: &[f64]) -> f64 {
        if p == 0 {
            if u >= knots[i] && u < knots[i + 1] {
                return 1.0;
            }
            // Handle last knot span
            if (u - knots[i + 1]).abs() < 1e-12 && i + 1 == knots.len() - 1 {
                return 1.0;
            }
            return 0.0;
        }
        
        let mut result = 0.0;
        
        let denom1 = knots[i + p] - knots[i];
        if denom1.abs() > 1e-12 {
            result += (u - knots[i]) / denom1 * self.cox_deboor(i, p - 1, u, knots);
        }
        
        let denom2 = knots[i + p + 1] - knots[i + 1];
        if denom2.abs() > 1e-12 {
            result += (knots[i + p + 1] - u) / denom2 * self.cox_deboor(i + 1, p - 1, u, knots);
        }
        
        result
    }
    
    /// Evaluate basis function derivative
    pub fn basis_derivative(&self, i: usize, p: usize, u: f64) -> f64 {
        if p == 0 {
            return 0.0;
        }
        
        let mut result = 0.0;
        
        let denom1 = self.knots[i + p] - self.knots[i];
        if denom1.abs() > 1e-12 {
            result += p as f64 / denom1 * self.cox_deboor(i, p - 1, u, &self.knots);
        }
        
        let denom2 = self.knots[i + p + 1] - self.knots[i + 1];
        if denom2.abs() > 1e-12 {
            result -= p as f64 / denom2 * self.cox_deboor(i + 1, p - 1, u, &self.knots);
        }
        
        result
    }
    
    /// Evaluate point on curve
    pub fn evaluate(&self, u: f64) -> [f64; 3] {
        let mut point = [0.0; 3];
        
        for i in 0..self.n_control_points() {
            let n = self.basis_function(i, self.degree, u);
            for j in 0..3 {
                point[j] += n * self.control_points[i][j];
            }
        }
        
        point
    }
    
    /// Evaluate tangent vector
    pub fn tangent(&self, u: f64) -> [f64; 3] {
        let mut tangent = [0.0; 3];
        
        for i in 0..self.n_control_points() {
            let dn = self.basis_derivative(i, self.degree, u);
            for j in 0..3 {
                tangent[j] += dn * self.control_points[i][j];
            }
        }
        
        tangent
    }
    
    /// Get knot spans (unique segments)
    pub fn knot_spans(&self) -> Vec<(f64, f64)> {
        let mut spans = Vec::new();
        let mut prev = self.knots[0];
        
        for &k in &self.knots[1..] {
            if (k - prev).abs() > 1e-12 {
                spans.push((prev, k));
                prev = k;
            }
        }
        
        spans
    }
    
    /// Insert knot (Oslo algorithm)
    pub fn insert_knot(&mut self, u_new: f64) {
        let n = self.n_control_points();
        let p = self.degree;
        
        // Find knot span
        let k = self.find_span(u_new);
        
        // New knot vector
        let mut new_knots = Vec::with_capacity(self.knots.len() + 1);
        new_knots.extend_from_slice(&self.knots[..=k]);
        new_knots.push(u_new);
        new_knots.extend_from_slice(&self.knots[k + 1..]);
        
        // New control points
        let mut new_points = Vec::with_capacity(n + 1);
        
        for i in 0..=n {
            if i <= k - p {
                new_points.push(self.control_points[i]);
            } else if i > k {
                new_points.push(self.control_points[i - 1]);
            } else {
                let alpha = (u_new - self.knots[i]) / (self.knots[i + p] - self.knots[i]);
                let mut point = [0.0; 3];
                for j in 0..3 {
                    point[j] = (1.0 - alpha) * self.control_points[i - 1][j]
                        + alpha * self.control_points[i][j];
                }
                new_points.push(point);
            }
        }
        
        self.knots = new_knots;
        self.control_points = new_points;
    }
    
    fn find_span(&self, u: f64) -> usize {
        let n = self.n_control_points() - 1;
        
        if u >= self.knots[n + 1] {
            return n;
        }
        
        for i in self.degree..n + 1 {
            if u < self.knots[i + 1] {
                return i;
            }
        }
        
        self.degree
    }
}

// ============================================================================
// NURBS
// ============================================================================

/// NURBS curve (rational B-spline)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NurbsCurve {
    /// Underlying B-spline
    pub bspline: BSplineCurve,
    /// Weights for each control point
    pub weights: Vec<f64>,
}

impl NurbsCurve {
    pub fn new(degree: usize, control_points: Vec<[f64; 3]>, knots: Vec<f64>, weights: Vec<f64>) -> Self {
        Self {
            bspline: BSplineCurve::new(degree, control_points, knots),
            weights,
        }
    }
    
    /// Create circle arc
    pub fn circle_arc(center: [f64; 2], radius: f64, start_angle: f64, end_angle: f64) -> Self {
        let angle = end_angle - start_angle;
        let n_arcs = ((angle.abs() / (PI / 2.0)).ceil() as usize).max(1);
        let d_angle = angle / n_arcs as f64;
        
        let mut control_points = Vec::new();
        let mut weights = Vec::new();
        let mut knots = vec![0.0; 3];
        
        for i in 0..=n_arcs {
            let a1 = start_angle + i as f64 * d_angle;
            
            if i < n_arcs {
                let a_mid = a1 + d_angle / 2.0;
                let w_mid = (d_angle / 2.0).cos();
                
                // Start/end point
                control_points.push([
                    center[0] + radius * a1.cos(),
                    center[1] + radius * a1.sin(),
                    0.0,
                ]);
                weights.push(1.0);
                
                // Mid control point (off curve)
                control_points.push([
                    center[0] + radius * a_mid.cos() / w_mid,
                    center[1] + radius * a_mid.sin() / w_mid,
                    0.0,
                ]);
                weights.push(w_mid);
                
                if i > 0 {
                    knots.push(i as f64 / n_arcs as f64);
                    knots.push(i as f64 / n_arcs as f64);
                }
            } else {
                // Last point
                control_points.push([
                    center[0] + radius * a1.cos(),
                    center[1] + radius * a1.sin(),
                    0.0,
                ]);
                weights.push(1.0);
            }
        }
        
        knots.extend(vec![1.0; 3]);
        
        Self::new(2, control_points, knots, weights)
    }
    
    /// Evaluate NURBS basis function R_{i,p}(u)
    pub fn rational_basis(&self, i: usize, u: f64) -> f64 {
        let n_i = self.bspline.basis_function(i, self.bspline.degree, u);
        let w_i = self.weights[i];
        
        let mut w_sum = 0.0;
        for j in 0..self.bspline.n_control_points() {
            w_sum += self.bspline.basis_function(j, self.bspline.degree, u) * self.weights[j];
        }
        
        if w_sum.abs() < 1e-15 {
            return 0.0;
        }
        
        n_i * w_i / w_sum
    }
    
    /// Evaluate point on NURBS curve
    pub fn evaluate(&self, u: f64) -> [f64; 3] {
        let mut point = [0.0; 3];
        let mut w_sum = 0.0;
        
        for i in 0..self.bspline.n_control_points() {
            let n = self.bspline.basis_function(i, self.bspline.degree, u);
            let w = self.weights[i];
            let nw = n * w;
            
            for j in 0..3 {
                point[j] += nw * self.bspline.control_points[i][j];
            }
            w_sum += nw;
        }
        
        if w_sum.abs() > 1e-15 {
            for j in 0..3 {
                point[j] /= w_sum;
            }
        }
        
        point
    }
}

// ============================================================================
// B-SPLINE SURFACE
// ============================================================================

/// B-spline surface (tensor product)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BSplineSurface {
    /// Degree in u direction
    pub degree_u: usize,
    /// Degree in v direction
    pub degree_v: usize,
    /// Control point grid [n_u][n_v]
    pub control_points: Vec<Vec<[f64; 3]>>,
    /// Knot vector in u
    pub knots_u: Vec<f64>,
    /// Knot vector in v
    pub knots_v: Vec<f64>,
}

impl BSplineSurface {
    pub fn new(
        degree_u: usize,
        degree_v: usize,
        control_points: Vec<Vec<[f64; 3]>>,
        knots_u: Vec<f64>,
        knots_v: Vec<f64>,
    ) -> Self {
        Self {
            degree_u,
            degree_v,
            control_points,
            knots_u,
            knots_v,
        }
    }
    
    /// Number of control points in u direction
    pub fn n_u(&self) -> usize {
        self.control_points.len()
    }
    
    /// Number of control points in v direction
    pub fn n_v(&self) -> usize {
        if self.control_points.is_empty() {
            0
        } else {
            self.control_points[0].len()
        }
    }
    
    /// Evaluate basis function product
    fn basis_2d(&self, i: usize, j: usize, u: f64, v: f64) -> f64 {
        let n_u = self.basis_1d(&self.knots_u, i, self.degree_u, u);
        let n_v = self.basis_1d(&self.knots_v, j, self.degree_v, v);
        n_u * n_v
    }
    
    fn basis_1d(&self, knots: &[f64], i: usize, p: usize, t: f64) -> f64 {
        if p == 0 {
            if t >= knots[i] && t < knots[i + 1] {
                return 1.0;
            }
            if (t - knots[i + 1]).abs() < 1e-12 && i + 2 == knots.len() {
                return 1.0;
            }
            return 0.0;
        }
        
        let mut result = 0.0;
        
        let d1 = knots[i + p] - knots[i];
        if d1.abs() > 1e-12 {
            result += (t - knots[i]) / d1 * self.basis_1d(knots, i, p - 1, t);
        }
        
        let d2 = knots[i + p + 1] - knots[i + 1];
        if d2.abs() > 1e-12 {
            result += (knots[i + p + 1] - t) / d2 * self.basis_1d(knots, i + 1, p - 1, t);
        }
        
        result
    }
    
    /// Evaluate point on surface
    pub fn evaluate(&self, u: f64, v: f64) -> [f64; 3] {
        let mut point = [0.0; 3];
        
        for i in 0..self.n_u() {
            for j in 0..self.n_v() {
                let n = self.basis_2d(i, j, u, v);
                for k in 0..3 {
                    point[k] += n * self.control_points[i][j][k];
                }
            }
        }
        
        point
    }
    
    /// Evaluate partial derivatives
    pub fn derivatives(&self, u: f64, v: f64) -> SurfaceDerivatives {
        // Simplified - returns point and tangent vectors
        let point = self.evaluate(u, v);
        
        let du = 1e-6;
        let dv = 1e-6;
        
        let p_u = self.evaluate((u + du).min(1.0), v);
        let p_v = self.evaluate(u, (v + dv).min(1.0));
        
        let d_du = [
            (p_u[0] - point[0]) / du,
            (p_u[1] - point[1]) / du,
            (p_u[2] - point[2]) / du,
        ];
        
        let d_dv = [
            (p_v[0] - point[0]) / dv,
            (p_v[1] - point[1]) / dv,
            (p_v[2] - point[2]) / dv,
        ];
        
        // Normal = du × dv
        let normal = [
            d_du[1] * d_dv[2] - d_du[2] * d_dv[1],
            d_du[2] * d_dv[0] - d_du[0] * d_dv[2],
            d_du[0] * d_dv[1] - d_du[1] * d_dv[0],
        ];
        
        let mag = (normal[0].powi(2) + normal[1].powi(2) + normal[2].powi(2)).sqrt();
        let normal = if mag > 1e-15 {
            [normal[0] / mag, normal[1] / mag, normal[2] / mag]
        } else {
            [0.0, 0.0, 1.0]
        };
        
        SurfaceDerivatives {
            point,
            du: d_du,
            dv: d_dv,
            normal,
        }
    }
}

/// Surface derivatives at a point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurfaceDerivatives {
    /// Point coordinates
    pub point: [f64; 3],
    /// Derivative w.r.t. u
    pub du: [f64; 3],
    /// Derivative w.r.t. v
    pub dv: [f64; 3],
    /// Unit normal
    pub normal: [f64; 3],
}

// ============================================================================
// NURBS SURFACE
// ============================================================================

/// NURBS surface
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NurbsSurface {
    /// Underlying B-spline surface
    pub bspline: BSplineSurface,
    /// Weight grid
    pub weights: Vec<Vec<f64>>,
}

impl NurbsSurface {
    pub fn new(
        degree_u: usize,
        degree_v: usize,
        control_points: Vec<Vec<[f64; 3]>>,
        knots_u: Vec<f64>,
        knots_v: Vec<f64>,
        weights: Vec<Vec<f64>>,
    ) -> Self {
        Self {
            bspline: BSplineSurface::new(degree_u, degree_v, control_points, knots_u, knots_v),
            weights,
        }
    }
    
    /// Create cylinder surface
    pub fn cylinder(radius: f64, height: f64) -> Self {
        let circle = NurbsCurve::circle_arc([0.0, 0.0], radius, 0.0, 2.0 * PI);
        
        let mut control_points = Vec::new();
        let mut weights = Vec::new();
        
        for (i, cp) in circle.bspline.control_points.iter().enumerate() {
            control_points.push(vec![
                *cp,
                [cp[0], cp[1], height],
            ]);
            weights.push(vec![circle.weights[i], circle.weights[i]]);
        }
        
        let knots_v = vec![0.0, 0.0, 1.0, 1.0];
        
        Self::new(
            circle.bspline.degree,
            1,
            control_points,
            circle.bspline.knots,
            knots_v,
            weights,
        )
    }
    
    /// Evaluate point on NURBS surface
    pub fn evaluate(&self, u: f64, v: f64) -> [f64; 3] {
        let mut point = [0.0; 3];
        let mut w_sum = 0.0;
        
        for i in 0..self.bspline.n_u() {
            for j in 0..self.bspline.n_v() {
                let n = self.bspline.basis_2d(i, j, u, v);
                let w = self.weights[i][j];
                let nw = n * w;
                
                for k in 0..3 {
                    point[k] += nw * self.bspline.control_points[i][j][k];
                }
                w_sum += nw;
            }
        }
        
        if w_sum.abs() > 1e-15 {
            for k in 0..3 {
                point[k] /= w_sum;
            }
        }
        
        point
    }
}

// ============================================================================
// BÉZIER EXTRACTION
// ============================================================================

/// Bézier extraction operator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BezierExtraction {
    /// Extraction operators for each element
    pub operators: Vec<Vec<Vec<f64>>>,
    /// Knot spans (element boundaries)
    pub knot_spans: Vec<(f64, f64)>,
    /// Number of basis functions per element
    pub n_basis_per_element: usize,
}

impl BezierExtraction {
    /// Compute Bézier extraction for 1D B-spline
    pub fn extract_1d(knots: &[f64], degree: usize) -> Self {
        let _n = knots.len() - degree - 1;
        let mut operators = Vec::new();
        let mut knot_spans = Vec::new();
        
        // Find unique knot spans
        let mut prev = knots[degree];
        for i in degree + 1..knots.len() - degree {
            if (knots[i] - prev).abs() > 1e-12 {
                knot_spans.push((prev, knots[i]));
                prev = knots[i];
            }
        }
        
        // For each element, compute extraction operator
        // Simplified: identity for Bézier elements
        for _ in &knot_spans {
            let mut op = vec![vec![0.0; degree + 1]; degree + 1];
            for i in 0..=degree {
                op[i][i] = 1.0;
            }
            operators.push(op);
        }
        
        Self {
            operators,
            knot_spans,
            n_basis_per_element: degree + 1,
        }
    }
    
    /// Get element connectivity (which basis functions are active)
    pub fn element_connectivity(&self, element: usize, n_basis: usize) -> Vec<usize> {
        let p = self.n_basis_per_element - 1;
        
        if element + p + 1 <= n_basis {
            (element..element + p + 1).collect()
        } else {
            (0..p + 1).collect()
        }
    }
}

// ============================================================================
// IGA ELEMENT
// ============================================================================

/// IGA element type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IgaElementType {
    /// 1D curve element
    Curve,
    /// 2D surface element
    Surface,
    /// 3D solid element
    Solid,
}

/// IGA element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgaElement {
    /// Element type
    pub element_type: IgaElementType,
    /// Element ID
    pub id: usize,
    /// Polynomial degrees [p_u, p_v, p_w]
    pub degrees: Vec<usize>,
    /// Parametric domain bounds
    pub domain: Vec<(f64, f64)>,
    /// Global control point indices
    pub control_point_ids: Vec<usize>,
    /// Bézier extraction operator (flattened)
    pub extraction_operator: Vec<f64>,
}

impl IgaElement {
    /// Create 1D IGA element
    pub fn curve(
        id: usize,
        degree: usize,
        domain: (f64, f64),
        control_point_ids: Vec<usize>,
    ) -> Self {
        Self {
            element_type: IgaElementType::Curve,
            id,
            degrees: vec![degree],
            domain: vec![domain],
            control_point_ids,
            extraction_operator: Vec::new(),
        }
    }
    
    /// Create 2D IGA element
    pub fn surface(
        id: usize,
        degree_u: usize,
        degree_v: usize,
        domain_u: (f64, f64),
        domain_v: (f64, f64),
        control_point_ids: Vec<usize>,
    ) -> Self {
        Self {
            element_type: IgaElementType::Surface,
            id,
            degrees: vec![degree_u, degree_v],
            domain: vec![domain_u, domain_v],
            control_point_ids,
            extraction_operator: Vec::new(),
        }
    }
    
    /// Number of basis functions
    pub fn n_basis(&self) -> usize {
        self.degrees.iter().map(|&p| p + 1).product()
    }
    
    /// Number of DOFs (assuming 3D displacement)
    pub fn n_dofs(&self) -> usize {
        self.n_basis() * 3
    }
    
    /// Gauss point count per direction
    pub fn gauss_per_direction(&self) -> Vec<usize> {
        self.degrees.iter().map(|&p| p + 1).collect()
    }
}

// ============================================================================
// IGA MESH
// ============================================================================

/// IGA mesh (collection of elements sharing control points)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgaMesh {
    /// Control points (global)
    pub control_points: Vec<[f64; 3]>,
    /// Weights (global)
    pub weights: Vec<f64>,
    /// Elements
    pub elements: Vec<IgaElement>,
    /// Knot vectors per direction
    pub knots: Vec<Vec<f64>>,
    /// Degrees per direction
    pub degrees: Vec<usize>,
}

impl IgaMesh {
    /// Create from NURBS surface
    pub fn from_nurbs_surface(surface: &NurbsSurface) -> Self {
        let n_u = surface.bspline.n_u();
        let n_v = surface.bspline.n_v();
        
        // Flatten control points
        let mut control_points = Vec::new();
        let mut weights = Vec::new();
        
        for i in 0..n_u {
            for j in 0..n_v {
                control_points.push(surface.bspline.control_points[i][j]);
                weights.push(surface.weights[i][j]);
            }
        }
        
        // Create elements from knot spans
        let extraction_u = BezierExtraction::extract_1d(&surface.bspline.knots_u, surface.bspline.degree_u);
        let extraction_v = BezierExtraction::extract_1d(&surface.bspline.knots_v, surface.bspline.degree_v);
        
        let mut elements = Vec::new();
        let mut elem_id = 0;
        
        for (i, &(u0, u1)) in extraction_u.knot_spans.iter().enumerate() {
            for (j, &(v0, v1)) in extraction_v.knot_spans.iter().enumerate() {
                // Determine active control points
                let mut cp_ids = Vec::new();
                for di in 0..=surface.bspline.degree_u {
                    for dj in 0..=surface.bspline.degree_v {
                        let gi = (i + di).min(n_u - 1);
                        let gj = (j + dj).min(n_v - 1);
                        cp_ids.push(gi * n_v + gj);
                    }
                }
                
                elements.push(IgaElement::surface(
                    elem_id,
                    surface.bspline.degree_u,
                    surface.bspline.degree_v,
                    (u0, u1),
                    (v0, v1),
                    cp_ids,
                ));
                elem_id += 1;
            }
        }
        
        Self {
            control_points,
            weights,
            elements,
            knots: vec![surface.bspline.knots_u.clone(), surface.bspline.knots_v.clone()],
            degrees: vec![surface.bspline.degree_u, surface.bspline.degree_v],
        }
    }
    
    /// Number of control points (DOF locations)
    pub fn n_control_points(&self) -> usize {
        self.control_points.len()
    }
    
    /// Number of elements
    pub fn n_elements(&self) -> usize {
        self.elements.len()
    }
    
    /// Total DOFs (3D displacement)
    pub fn n_dofs(&self) -> usize {
        self.n_control_points() * 3
    }
    
    /// Refine by knot insertion
    pub fn refine_knot_insertion(&mut self, direction: usize, new_knots: &[f64]) {
        // Simplified: just record that refinement is needed
        for &knot in new_knots {
            if direction < self.knots.len() {
                self.knots[direction].push(knot);
                self.knots[direction].sort_by(|a, b| a.partial_cmp(b).unwrap());
            }
        }
    }
    
    /// Order elevation
    pub fn elevate_degree(&mut self, direction: usize, times: usize) {
        if direction < self.degrees.len() {
            self.degrees[direction] += times;
        }
    }
}

// ============================================================================
// T-SPLINE SUPPORT
// ============================================================================

/// T-spline vertex type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TVertexType {
    /// Regular vertex (4 neighbors)
    Regular,
    /// T-junction (3 neighbors)
    TJunction,
    /// L-corner (2 neighbors)
    LCorner,
    /// Extraordinary vertex (!=4 neighbors)
    Extraordinary,
}

/// T-spline control vertex
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TVertex {
    /// Vertex index
    pub id: usize,
    /// Position
    pub position: [f64; 3],
    /// Weight
    pub weight: f64,
    /// Local knot vectors (u and v)
    pub local_knots_u: Vec<f64>,
    pub local_knots_v: Vec<f64>,
    /// Vertex type
    pub vertex_type: TVertexType,
    /// Neighbor vertex IDs
    pub neighbors: Vec<usize>,
}

impl TVertex {
    pub fn new(id: usize, position: [f64; 3], weight: f64) -> Self {
        Self {
            id,
            position,
            weight,
            local_knots_u: Vec::new(),
            local_knots_v: Vec::new(),
            vertex_type: TVertexType::Regular,
            neighbors: Vec::new(),
        }
    }
    
    /// Set local knot vectors
    pub fn set_local_knots(&mut self, knots_u: Vec<f64>, knots_v: Vec<f64>) {
        self.local_knots_u = knots_u;
        self.local_knots_v = knots_v;
    }
    
    /// Determine vertex type from neighbors
    pub fn determine_type(&mut self) {
        self.vertex_type = match self.neighbors.len() {
            2 => TVertexType::LCorner,
            3 => TVertexType::TJunction,
            4 => TVertexType::Regular,
            _ => TVertexType::Extraordinary,
        };
    }
}

/// T-spline mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TSplineMesh {
    /// T-vertices
    pub vertices: Vec<TVertex>,
    /// Face connectivity
    pub faces: Vec<Vec<usize>>,
    /// Polynomial degree
    pub degree: usize,
}

impl TSplineMesh {
    pub fn new(degree: usize) -> Self {
        Self {
            vertices: Vec::new(),
            faces: Vec::new(),
            degree,
        }
    }
    
    /// Add vertex
    pub fn add_vertex(&mut self, position: [f64; 3], weight: f64) -> usize {
        let id = self.vertices.len();
        self.vertices.push(TVertex::new(id, position, weight));
        id
    }
    
    /// Add face
    pub fn add_face(&mut self, vertex_ids: Vec<usize>) {
        self.faces.push(vertex_ids);
    }
    
    /// Local refinement at T-junction
    pub fn local_refine(&mut self, vertex_id: usize) {
        if vertex_id < self.vertices.len() {
            // Mark for T-junction refinement
            self.vertices[vertex_id].vertex_type = TVertexType::TJunction;
        }
    }
    
    /// Check analysis suitability
    pub fn is_analysis_suitable(&self) -> bool {
        // Simplified check - all vertices should have proper knot vectors
        self.vertices.iter().all(|v| {
            v.local_knots_u.len() >= 2 * self.degree + 2
                && v.local_knots_v.len() >= 2 * self.degree + 2
        })
    }
}

// ============================================================================
// IGA ANALYSIS
// ============================================================================

/// IGA stiffness computation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgaAnalysisParams {
    /// Young's modulus (MPa)
    pub youngs_modulus: f64,
    /// Poisson's ratio
    pub poissons_ratio: f64,
    /// Thickness (for shells)
    pub thickness: f64,
    /// Integration order multiplier
    pub integration_order: usize,
}

impl IgaAnalysisParams {
    pub fn steel() -> Self {
        Self {
            youngs_modulus: 200000.0,
            poissons_ratio: 0.3,
            thickness: 10.0,
            integration_order: 1,
        }
    }
    
    /// Plane stress constitutive matrix
    pub fn plane_stress_d(&self) -> [[f64; 3]; 3] {
        let e = self.youngs_modulus;
        let nu = self.poissons_ratio;
        let c = e / (1.0 - nu * nu);
        
        [
            [c, c * nu, 0.0],
            [c * nu, c, 0.0],
            [0.0, 0.0, c * (1.0 - nu) / 2.0],
        ]
    }
    
    /// Plane strain constitutive matrix
    pub fn plane_strain_d(&self) -> [[f64; 3]; 3] {
        let e = self.youngs_modulus;
        let nu = self.poissons_ratio;
        let c = e / ((1.0 + nu) * (1.0 - 2.0 * nu));
        
        [
            [c * (1.0 - nu), c * nu, 0.0],
            [c * nu, c * (1.0 - nu), 0.0],
            [0.0, 0.0, c * (1.0 - 2.0 * nu) / 2.0],
        ]
    }
}

/// IGA solver
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgaSolver {
    /// Mesh
    pub mesh: IgaMesh,
    /// Analysis parameters
    pub params: IgaAnalysisParams,
    /// Displacement results
    pub displacements: Vec<f64>,
    /// Stress results at control points
    pub stresses: Vec<[f64; 6]>,
}

impl IgaSolver {
    pub fn new(mesh: IgaMesh, params: IgaAnalysisParams) -> Self {
        let n_dofs = mesh.n_dofs();
        Self {
            mesh,
            params,
            displacements: vec![0.0; n_dofs],
            stresses: Vec::new(),
        }
    }
    
    /// Compute element stiffness (simplified)
    pub fn element_stiffness(&self, element: &IgaElement) -> Vec<Vec<f64>> {
        let n_dofs = element.n_dofs();
        let mut ke = vec![vec![0.0; n_dofs]; n_dofs];
        
        // Simplified: diagonal stiffness
        let k = self.params.youngs_modulus * self.params.thickness;
        for i in 0..n_dofs {
            ke[i][i] = k;
        }
        
        ke
    }
    
    /// Get deformed control points
    pub fn deformed_geometry(&self, scale: f64) -> Vec<[f64; 3]> {
        self.mesh.control_points.iter().enumerate()
            .map(|(i, &cp)| [
                cp[0] + scale * self.displacements.get(3 * i).copied().unwrap_or(0.0),
                cp[1] + scale * self.displacements.get(3 * i + 1).copied().unwrap_or(0.0),
                cp[2] + scale * self.displacements.get(3 * i + 2).copied().unwrap_or(0.0),
            ])
            .collect()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bspline_basis() {
        let curve = BSplineCurve::new(
            2,
            vec![[0.0, 0.0, 0.0], [1.0, 1.0, 0.0], [2.0, 0.0, 0.0]],
            vec![0.0, 0.0, 0.0, 1.0, 1.0, 1.0],
        );
        
        // Basis functions should sum to 1
        let u = 0.5;
        let mut sum = 0.0;
        for i in 0..3 {
            sum += curve.basis_function(i, 2, u);
        }
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_bspline_evaluate() {
        let curve = BSplineCurve::new(
            1,
            vec![[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]],
            vec![0.0, 0.0, 1.0, 1.0],
        );
        
        let mid = curve.evaluate(0.5);
        assert!((mid[0] - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_nurbs_circle() {
        let circle = NurbsCurve::circle_arc([0.0, 0.0], 1.0, 0.0, PI / 2.0);
        
        // Point at u=0.5 should be at 45 degrees
        let point = circle.evaluate(0.5);
        let radius = (point[0].powi(2) + point[1].powi(2)).sqrt();
        assert!((radius - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_bspline_surface() {
        let control_points = vec![
            vec![[0.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
            vec![[1.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
        ];
        
        let surface = BSplineSurface::new(
            1, 1,
            control_points,
            vec![0.0, 0.0, 1.0, 1.0],
            vec![0.0, 0.0, 1.0, 1.0],
        );
        
        let center = surface.evaluate(0.5, 0.5);
        assert!((center[0] - 0.5).abs() < 1e-10);
        assert!((center[1] - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_bezier_extraction() {
        let knots = vec![0.0, 0.0, 0.0, 0.5, 1.0, 1.0, 1.0];
        let extraction = BezierExtraction::extract_1d(&knots, 2);
        
        assert_eq!(extraction.knot_spans.len(), 2);
    }

    #[test]
    fn test_iga_element() {
        let elem = IgaElement::surface(0, 2, 2, (0.0, 0.5), (0.0, 1.0), vec![0, 1, 2, 3, 4, 5, 6, 7, 8]);
        
        assert_eq!(elem.n_basis(), 9); // (2+1) * (2+1)
        assert_eq!(elem.n_dofs(), 27); // 9 * 3
    }

    #[test]
    fn test_knot_insertion() {
        let mut curve = BSplineCurve::new(
            2,
            vec![[0.0, 0.0, 0.0], [1.0, 1.0, 0.0], [2.0, 0.0, 0.0]],
            vec![0.0, 0.0, 0.0, 1.0, 1.0, 1.0],
        );
        
        let p_before = curve.evaluate(0.5);
        curve.insert_knot(0.5);
        let p_after = curve.evaluate(0.5);
        
        // Shape should be preserved
        assert!((p_before[0] - p_after[0]).abs() < 1e-10);
        assert!((p_before[1] - p_after[1]).abs() < 1e-10);
    }

    #[test]
    fn test_nurbs_surface_cylinder() {
        let cylinder = NurbsSurface::cylinder(1.0, 2.0);
        
        // Point at u=0 should be on circle at z=0
        let p = cylinder.evaluate(0.0, 0.0);
        let r = (p[0].powi(2) + p[1].powi(2)).sqrt();
        assert!((r - 1.0).abs() < 0.01);
        assert!(p[2].abs() < 0.01);
    }

    #[test]
    fn test_tspline_vertex() {
        let mut vertex = TVertex::new(0, [0.0, 0.0, 0.0], 1.0);
        vertex.neighbors = vec![1, 2, 3, 4];
        vertex.determine_type();
        
        assert_eq!(vertex.vertex_type, TVertexType::Regular);
    }

    #[test]
    fn test_iga_mesh_from_surface() {
        let control_points = vec![
            vec![[0.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
            vec![[1.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
        ];
        
        let surface = NurbsSurface::new(
            1, 1,
            control_points,
            vec![0.0, 0.0, 1.0, 1.0],
            vec![0.0, 0.0, 1.0, 1.0],
            vec![vec![1.0, 1.0], vec![1.0, 1.0]],
        );
        
        let mesh = IgaMesh::from_nurbs_surface(&surface);
        
        assert_eq!(mesh.n_control_points(), 4);
        assert!(mesh.n_elements() >= 1);
    }

    #[test]
    fn test_plane_stress_d() {
        let params = IgaAnalysisParams::steel();
        let d = params.plane_stress_d();
        
        // Check symmetry
        assert!((d[0][1] - d[1][0]).abs() < 1e-10);
        assert!(d[0][0] > 0.0);
    }

    #[test]
    fn test_iga_solver() {
        let control_points = vec![
            vec![[0.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
            vec![[1.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
        ];
        
        let surface = NurbsSurface::new(
            1, 1,
            control_points,
            vec![0.0, 0.0, 1.0, 1.0],
            vec![0.0, 0.0, 1.0, 1.0],
            vec![vec![1.0, 1.0], vec![1.0, 1.0]],
        );
        
        let mesh = IgaMesh::from_nurbs_surface(&surface);
        let params = IgaAnalysisParams::steel();
        let solver = IgaSolver::new(mesh, params);
        
        assert_eq!(solver.displacements.len(), 12); // 4 control points * 3 DOF
    }
}
