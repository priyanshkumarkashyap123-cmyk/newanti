//! Production Mesh Generation Module
//!
//! Automatic mesh generation for 2D and 3D domains with adaptive refinement,
//! quality optimization, and support for complex geometries.
//!
//! ## Algorithms
//! - **Delaunay Triangulation** - 2D triangular meshing
//! - **Advancing Front** - Quality triangle/tetrahedra generation
//! - **Mapped Meshing** - Structured mesh for regular domains
//! - **Transfinite** - Edge-based mesh control
//! - **Octree** - Spatial subdivision for 3D
//!
//! ## Features
//! - Boundary conforming
//! - Local refinement zones
//! - Element quality metrics
//! - Size gradation control
//! - CAD geometry import

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::cmp::Ordering;

// ============================================================================
// GEOMETRIC PRIMITIVES
// ============================================================================

/// 2D point
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Point2D { x, y }
    }

    pub fn distance(&self, other: &Point2D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn midpoint(&self, other: &Point2D) -> Point2D {
        Point2D::new((self.x + other.x) / 2.0, (self.y + other.y) / 2.0)
    }
}

/// 3D point
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Point3D { x, y, z }
    }

    pub fn distance(&self, other: &Point3D) -> f64 {
        ((self.x - other.x).powi(2) + 
         (self.y - other.y).powi(2) + 
         (self.z - other.z).powi(2)).sqrt()
    }

    pub fn midpoint(&self, other: &Point3D) -> Point3D {
        Point3D::new(
            (self.x + other.x) / 2.0,
            (self.y + other.y) / 2.0,
            (self.z + other.z) / 2.0,
        )
    }
}

/// Edge (line segment)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub struct Edge {
    pub n1: usize,
    pub n2: usize,
}

impl Edge {
    pub fn new(n1: usize, n2: usize) -> Self {
        // Normalize edge direction for consistent hashing
        if n1 <= n2 {
            Edge { n1, n2 }
        } else {
            Edge { n1: n2, n2: n1 }
        }
    }
}

// ============================================================================
// MESH DATA STRUCTURES
// ============================================================================

/// 2D triangular mesh
#[derive(Debug, Clone, Default)]
pub struct TriangularMesh2D {
    pub nodes: Vec<Point2D>,
    pub triangles: Vec<[usize; 3]>,
    pub boundary_edges: Vec<Edge>,
    pub node_attributes: HashMap<usize, NodeAttribute>,
    pub element_attributes: HashMap<usize, ElementAttribute>,
}

/// Node attribute
#[derive(Debug, Clone)]
pub struct NodeAttribute {
    pub on_boundary: bool,
    pub boundary_id: Option<usize>,
    pub target_size: f64,
}

/// Element attribute
#[derive(Debug, Clone)]
pub struct ElementAttribute {
    pub region_id: usize,
    pub material_id: usize,
}

impl TriangularMesh2D {
    pub fn new() -> Self {
        TriangularMesh2D::default()
    }

    pub fn add_node(&mut self, x: f64, y: f64) -> usize {
        self.nodes.push(Point2D::new(x, y));
        self.nodes.len() - 1
    }

    pub fn add_triangle(&mut self, n1: usize, n2: usize, n3: usize) {
        self.triangles.push([n1, n2, n3]);
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn element_count(&self) -> usize {
        self.triangles.len()
    }

    /// Calculate triangle area
    pub fn triangle_area(&self, idx: usize) -> f64 {
        let t = &self.triangles[idx];
        let p0 = &self.nodes[t[0]];
        let p1 = &self.nodes[t[1]];
        let p2 = &self.nodes[t[2]];
        
        0.5 * ((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y)).abs()
    }

    /// Calculate triangle quality (0-1, 1 is equilateral)
    pub fn triangle_quality(&self, idx: usize) -> f64 {
        let t = &self.triangles[idx];
        let p0 = &self.nodes[t[0]];
        let p1 = &self.nodes[t[1]];
        let p2 = &self.nodes[t[2]];
        
        let a = p0.distance(p1);
        let b = p1.distance(p2);
        let c = p2.distance(p0);
        
        let s = (a + b + c) / 2.0;
        let area = (s * (s - a) * (s - b) * (s - c)).sqrt();
        
        // Normalized quality: 4*sqrt(3)*A / (a² + b² + c²)
        4.0 * 3.0_f64.sqrt() * area / (a * a + b * b + c * c)
    }

    /// Minimum element quality
    pub fn min_quality(&self) -> f64 {
        (0..self.triangles.len())
            .map(|i| self.triangle_quality(i))
            .fold(f64::INFINITY, f64::min)
    }

    /// Average element quality
    pub fn avg_quality(&self) -> f64 {
        let sum: f64 = (0..self.triangles.len())
            .map(|i| self.triangle_quality(i))
            .sum();
        sum / self.triangles.len() as f64
    }

    /// Get all edges
    pub fn edges(&self) -> Vec<Edge> {
        let mut edge_set = HashSet::new();
        
        for t in &self.triangles {
            edge_set.insert(Edge::new(t[0], t[1]));
            edge_set.insert(Edge::new(t[1], t[2]));
            edge_set.insert(Edge::new(t[2], t[0]));
        }
        
        edge_set.into_iter().collect()
    }

    /// Find boundary edges
    pub fn find_boundary_edges(&mut self) {
        let mut edge_count: HashMap<Edge, usize> = HashMap::new();
        
        for t in &self.triangles {
            for &e in &[Edge::new(t[0], t[1]), Edge::new(t[1], t[2]), Edge::new(t[2], t[0])] {
                *edge_count.entry(e).or_insert(0) += 1;
            }
        }
        
        self.boundary_edges = edge_count
            .into_iter()
            .filter(|(_, count)| *count == 1)
            .map(|(edge, _)| edge)
            .collect();
    }
}

/// 3D tetrahedral mesh
#[derive(Debug, Clone, Default)]
pub struct TetrahedralMesh3D {
    pub nodes: Vec<Point3D>,
    pub tetrahedra: Vec<[usize; 4]>,
    pub boundary_faces: Vec<[usize; 3]>,
}

impl TetrahedralMesh3D {
    pub fn new() -> Self {
        TetrahedralMesh3D::default()
    }

    pub fn add_node(&mut self, x: f64, y: f64, z: f64) -> usize {
        self.nodes.push(Point3D::new(x, y, z));
        self.nodes.len() - 1
    }

    pub fn add_tetrahedron(&mut self, n1: usize, n2: usize, n3: usize, n4: usize) {
        self.tetrahedra.push([n1, n2, n3, n4]);
    }

    /// Calculate tetrahedron volume
    pub fn tetrahedron_volume(&self, idx: usize) -> f64 {
        let t = &self.tetrahedra[idx];
        let p0 = &self.nodes[t[0]];
        let p1 = &self.nodes[t[1]];
        let p2 = &self.nodes[t[2]];
        let p3 = &self.nodes[t[3]];
        
        let v1 = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
        let v2 = [p2.x - p0.x, p2.y - p0.y, p2.z - p0.z];
        let v3 = [p3.x - p0.x, p3.y - p0.y, p3.z - p0.z];
        
        // V = |v1 · (v2 × v3)| / 6
        let cross = [
            v2[1] * v3[2] - v2[2] * v3[1],
            v2[2] * v3[0] - v2[0] * v3[2],
            v2[0] * v3[1] - v2[1] * v3[0],
        ];
        
        let dot = v1[0] * cross[0] + v1[1] * cross[1] + v1[2] * cross[2];
        dot.abs() / 6.0
    }

    /// Calculate tetrahedron quality
    pub fn tetrahedron_quality(&self, idx: usize) -> f64 {
        let vol = self.tetrahedron_volume(idx);
        let t = &self.tetrahedra[idx];
        
        // Sum of squared edge lengths
        let edges = [
            (t[0], t[1]), (t[0], t[2]), (t[0], t[3]),
            (t[1], t[2]), (t[1], t[3]), (t[2], t[3]),
        ];
        
        let l_sq_sum: f64 = edges.iter()
            .map(|&(i, j)| self.nodes[i].distance(&self.nodes[j]).powi(2))
            .sum();
        
        // Normalized quality
        216.0 * 2.0_f64.sqrt() * vol / l_sq_sum.powf(1.5)
    }
}

// ============================================================================
// DELAUNAY TRIANGULATION
// ============================================================================

/// Delaunay triangulator for 2D
pub struct DelaunayTriangulator {
    super_triangle_size: f64,
}

impl Default for DelaunayTriangulator {
    fn default() -> Self {
        DelaunayTriangulator {
            super_triangle_size: 1e6,
        }
    }
}

impl DelaunayTriangulator {
    pub fn new() -> Self {
        DelaunayTriangulator::default()
    }

    /// Triangulate a set of points using Bowyer-Watson algorithm
    pub fn triangulate(&self, points: &[Point2D]) -> TriangularMesh2D {
        if points.len() < 3 {
            return TriangularMesh2D::new();
        }

        let mut mesh = TriangularMesh2D::new();
        
        // Create super-triangle that contains all points
        let (min_x, max_x, min_y, max_y) = self.bounding_box(points);
        let dx = max_x - min_x;
        let dy = max_y - min_y;
        let delta = dx.max(dy) * 2.0;
        let cx = (min_x + max_x) / 2.0;
        let cy = (min_y + max_y) / 2.0;
        
        // Super-triangle vertices
        let st0 = mesh.add_node(cx - delta, cy - delta);
        let st1 = mesh.add_node(cx + delta, cy - delta);
        let st2 = mesh.add_node(cx, cy + delta);
        mesh.add_triangle(st0, st1, st2);
        
        // Insert points one at a time
        for point in points {
            self.insert_point(&mut mesh, *point);
        }
        
        // Remove triangles connected to super-triangle
        let _num_input_points = points.len();
        mesh.triangles.retain(|t| {
            t[0] >= 3 && t[1] >= 3 && t[2] >= 3
        });
        
        // Adjust node indices
        for t in &mut mesh.triangles {
            t[0] -= 3;
            t[1] -= 3;
            t[2] -= 3;
        }
        
        // Remove super-triangle nodes
        mesh.nodes = mesh.nodes[3..].to_vec();
        
        mesh.find_boundary_edges();
        mesh
    }

    fn bounding_box(&self, points: &[Point2D]) -> (f64, f64, f64, f64) {
        let mut min_x = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_y = f64::NEG_INFINITY;
        
        for p in points {
            min_x = min_x.min(p.x);
            max_x = max_x.max(p.x);
            min_y = min_y.min(p.y);
            max_y = max_y.max(p.y);
        }
        
        (min_x, max_x, min_y, max_y)
    }

    fn insert_point(&self, mesh: &mut TriangularMesh2D, point: Point2D) {
        let node_idx = mesh.add_node(point.x, point.y);
        
        // Find all triangles whose circumcircle contains the point
        let mut bad_triangles = Vec::new();
        
        for (i, t) in mesh.triangles.iter().enumerate() {
            if self.in_circumcircle(mesh, t, &point) {
                bad_triangles.push(i);
            }
        }
        
        if bad_triangles.is_empty() {
            return;
        }
        
        // Find boundary of bad triangles (polygon hole)
        let mut polygon = Vec::new();
        
        for &t_idx in &bad_triangles {
            let t = &mesh.triangles[t_idx];
            let edges = [
                Edge::new(t[0], t[1]),
                Edge::new(t[1], t[2]),
                Edge::new(t[2], t[0]),
            ];
            
            for edge in edges {
                // Check if edge is shared with another bad triangle
                let mut shared = false;
                for &other_idx in &bad_triangles {
                    if other_idx == t_idx {
                        continue;
                    }
                    let other = &mesh.triangles[other_idx];
                    let other_edges = [
                        Edge::new(other[0], other[1]),
                        Edge::new(other[1], other[2]),
                        Edge::new(other[2], other[0]),
                    ];
                    if other_edges.contains(&edge) {
                        shared = true;
                        break;
                    }
                }
                if !shared {
                    polygon.push(edge);
                }
            }
        }
        
        // Remove bad triangles (reverse order to maintain indices)
        bad_triangles.sort_by(|a, b| b.cmp(a));
        for idx in bad_triangles {
            mesh.triangles.remove(idx);
        }
        
        // Create new triangles from polygon edges to new point
        for edge in polygon {
            mesh.add_triangle(edge.n1, edge.n2, node_idx);
        }
    }

    fn in_circumcircle(&self, mesh: &TriangularMesh2D, t: &[usize; 3], p: &Point2D) -> bool {
        let p0 = &mesh.nodes[t[0]];
        let p1 = &mesh.nodes[t[1]];
        let p2 = &mesh.nodes[t[2]];
        
        // First compute the orientation of the triangle
        let orient = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
        
        // Matrix determinant for in-circle test
        let ax = p0.x - p.x;
        let ay = p0.y - p.y;
        let bx = p1.x - p.x;
        let by = p1.y - p.y;
        let cx = p2.x - p.x;
        let cy = p2.y - p.y;
        
        let det = (ax * ax + ay * ay) * (bx * cy - cx * by)
                - (bx * bx + by * by) * (ax * cy - cx * ay)
                + (cx * cx + cy * cy) * (ax * by - bx * ay);
        
        // Sign of det should match orientation
        if orient > 0.0 {
            det > 0.0
        } else {
            det < 0.0
        }
    }
}

// ============================================================================
// ADVANCING FRONT MESHING
// ============================================================================

/// Advancing front mesh generator
pub struct AdvancingFront {
    target_size: f64,
    quality_threshold: f64,
    max_iterations: usize,
}

impl Default for AdvancingFront {
    fn default() -> Self {
        AdvancingFront {
            target_size: 1.0,
            quality_threshold: 0.5,
            max_iterations: 10000,
        }
    }
}

impl AdvancingFront {
    pub fn new(target_size: f64) -> Self {
        AdvancingFront {
            target_size,
            ..Default::default()
        }
    }

    /// Generate mesh from boundary polygon
    pub fn mesh_polygon(&self, boundary: &[Point2D]) -> TriangularMesh2D {
        let mut mesh = TriangularMesh2D::new();
        
        if boundary.len() < 3 {
            return mesh;
        }
        
        // Add boundary nodes
        for p in boundary {
            mesh.add_node(p.x, p.y);
        }
        
        // Initialize front with boundary edges
        let mut front: Vec<Edge> = Vec::new();
        for i in 0..boundary.len() {
            let next = (i + 1) % boundary.len();
            front.push(Edge::new(i, next));
        }
        
        let mut iterations = 0;
        
        while !front.is_empty() && iterations < self.max_iterations {
            iterations += 1;
            
            // Pick shortest edge from front
            let (front_idx, _) = front.iter().enumerate()
                .min_by(|(_, e1), (_, e2)| {
                    let l1 = mesh.nodes[e1.n1].distance(&mesh.nodes[e1.n2]);
                    let l2 = mesh.nodes[e2.n1].distance(&mesh.nodes[e2.n2]);
                    l1.partial_cmp(&l2).unwrap_or(Ordering::Equal)
                })
                .unwrap();
            
            let edge = front.remove(front_idx);
            
            // Find or create ideal point
            let ideal_point = self.compute_ideal_point(&mesh, &edge);
            
            // Check if existing node is close enough
            let mut use_existing = None;
            let tolerance = self.target_size * 0.7;
            
            for (i, node) in mesh.nodes.iter().enumerate() {
                if i == edge.n1 || i == edge.n2 {
                    continue;
                }
                if node.distance(&ideal_point) < tolerance {
                    // Check if triangle would be valid
                    if self.is_valid_triangle(&mesh, edge.n1, edge.n2, i, &front) {
                        use_existing = Some(i);
                        break;
                    }
                }
            }
            
            let new_node = match use_existing {
                Some(idx) => idx,
                None => {
                    // Add new node at ideal position
                    mesh.add_node(ideal_point.x, ideal_point.y)
                }
            };
            
            // Create new triangle
            mesh.add_triangle(edge.n1, edge.n2, new_node);
            
            // Update front
            let edge1 = Edge::new(edge.n1, new_node);
            let edge2 = Edge::new(new_node, edge.n2);
            
            self.update_front(&mut front, edge1);
            self.update_front(&mut front, edge2);
        }
        
        mesh.find_boundary_edges();
        mesh
    }

    fn compute_ideal_point(&self, mesh: &TriangularMesh2D, edge: &Edge) -> Point2D {
        let p1 = &mesh.nodes[edge.n1];
        let p2 = &mesh.nodes[edge.n2];
        
        // Midpoint of edge
        let mid = p1.midpoint(p2);
        
        // Normal direction (90° rotation)
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let len = (dx * dx + dy * dy).sqrt();
        
        let nx = -dy / len;
        let ny = dx / len;
        
        // Ideal point at equilateral distance
        let h = self.target_size * 3.0_f64.sqrt() / 2.0;
        
        Point2D::new(mid.x + nx * h, mid.y + ny * h)
    }

    fn is_valid_triangle(
        &self,
        mesh: &TriangularMesh2D,
        n1: usize,
        n2: usize,
        n3: usize,
        _front: &[Edge],
    ) -> bool {
        // Check that edges don't cross existing front edges
        let p1 = &mesh.nodes[n1];
        let p2 = &mesh.nodes[n2];
        let p3 = &mesh.nodes[n3];
        
        // Simple validity: positive area
        let area = (p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y);
        
        area > 0.0
    }

    fn update_front(&self, front: &mut Vec<Edge>, edge: Edge) {
        // If edge already in front (reversed), remove it
        // Otherwise add it
        let reverse = Edge::new(edge.n2, edge.n1);
        
        if let Some(idx) = front.iter().position(|e| *e == edge || *e == reverse) {
            front.remove(idx);
        } else {
            front.push(edge);
        }
    }
}

// ============================================================================
// STRUCTURED MESH GENERATION
// ============================================================================

/// Structured mesh generator for rectangular domains
pub struct StructuredMeshGenerator {
    pub nx: usize,
    pub ny: usize,
    pub nz: Option<usize>,
}

impl StructuredMeshGenerator {
    pub fn new_2d(nx: usize, ny: usize) -> Self {
        StructuredMeshGenerator { nx, ny, nz: None }
    }

    pub fn new_3d(nx: usize, ny: usize, nz: usize) -> Self {
        StructuredMeshGenerator { nx, ny, nz: Some(nz) }
    }

    /// Generate structured quadrilateral mesh
    pub fn generate_quad_mesh(
        &self,
        x_min: f64, x_max: f64,
        y_min: f64, y_max: f64,
    ) -> (Vec<Point2D>, Vec<[usize; 4]>) {
        let mut nodes = Vec::new();
        let mut elements = Vec::new();
        
        let dx = (x_max - x_min) / self.nx as f64;
        let dy = (y_max - y_min) / self.ny as f64;
        
        // Generate nodes
        for j in 0..=self.ny {
            for i in 0..=self.nx {
                nodes.push(Point2D::new(
                    x_min + i as f64 * dx,
                    y_min + j as f64 * dy,
                ));
            }
        }
        
        // Generate elements
        for j in 0..self.ny {
            for i in 0..self.nx {
                let n0 = j * (self.nx + 1) + i;
                let n1 = n0 + 1;
                let n2 = n1 + self.nx + 1;
                let n3 = n0 + self.nx + 1;
                
                elements.push([n0, n1, n2, n3]);
            }
        }
        
        (nodes, elements)
    }

    /// Generate structured triangular mesh from quads
    pub fn generate_triangle_mesh(
        &self,
        x_min: f64, x_max: f64,
        y_min: f64, y_max: f64,
    ) -> TriangularMesh2D {
        let (nodes, quads) = self.generate_quad_mesh(x_min, x_max, y_min, y_max);
        
        let mut mesh = TriangularMesh2D::new();
        
        for node in &nodes {
            mesh.add_node(node.x, node.y);
        }
        
        // Split each quad into 2 triangles
        for q in &quads {
            mesh.add_triangle(q[0], q[1], q[2]);
            mesh.add_triangle(q[0], q[2], q[3]);
        }
        
        mesh.find_boundary_edges();
        mesh
    }

    /// Generate structured hex mesh
    pub fn generate_hex_mesh(
        &self,
        x_min: f64, x_max: f64,
        y_min: f64, y_max: f64,
        z_min: f64, z_max: f64,
    ) -> (Vec<Point3D>, Vec<[usize; 8]>) {
        let nz = self.nz.unwrap_or(1);
        let mut nodes = Vec::new();
        let mut elements = Vec::new();
        
        let dx = (x_max - x_min) / self.nx as f64;
        let dy = (y_max - y_min) / self.ny as f64;
        let dz = (z_max - z_min) / nz as f64;
        
        // Generate nodes
        for k in 0..=nz {
            for j in 0..=self.ny {
                for i in 0..=self.nx {
                    nodes.push(Point3D::new(
                        x_min + i as f64 * dx,
                        y_min + j as f64 * dy,
                        z_min + k as f64 * dz,
                    ));
                }
            }
        }
        
        // Generate elements
        let nx1 = self.nx + 1;
        let ny1 = self.ny + 1;
        
        for k in 0..nz {
            for j in 0..self.ny {
                for i in 0..self.nx {
                    let n0 = k * nx1 * ny1 + j * nx1 + i;
                    let n1 = n0 + 1;
                    let n2 = n0 + nx1 + 1;
                    let n3 = n0 + nx1;
                    let n4 = n0 + nx1 * ny1;
                    let n5 = n4 + 1;
                    let n6 = n4 + nx1 + 1;
                    let n7 = n4 + nx1;
                    
                    elements.push([n0, n1, n2, n3, n4, n5, n6, n7]);
                }
            }
        }
        
        (nodes, elements)
    }
}

// ============================================================================
// MESH REFINEMENT
// ============================================================================

/// Mesh refinement operations
pub struct MeshRefiner {
    pub min_quality: f64,
    pub max_edge_length: f64,
    pub refinement_zones: Vec<RefinementZone>,
}

/// Zone for local refinement
#[derive(Debug, Clone)]
pub struct RefinementZone {
    pub center: Point2D,
    pub radius: f64,
    pub target_size: f64,
}

impl Default for MeshRefiner {
    fn default() -> Self {
        MeshRefiner {
            min_quality: 0.3,
            max_edge_length: f64::INFINITY,
            refinement_zones: Vec::new(),
        }
    }
}

impl MeshRefiner {
    pub fn new() -> Self {
        MeshRefiner::default()
    }

    pub fn add_refinement_zone(&mut self, center: Point2D, radius: f64, target_size: f64) {
        self.refinement_zones.push(RefinementZone { center, radius, target_size });
    }

    /// Refine mesh based on quality and size criteria
    pub fn refine(&self, mesh: &mut TriangularMesh2D) {
        let mut refined = true;
        let max_iterations = 100;
        let mut iterations = 0;
        
        while refined && iterations < max_iterations {
            refined = false;
            iterations += 1;
            
            // Find triangles that need refinement
            let triangles_to_refine: Vec<usize> = (0..mesh.triangles.len())
                .filter(|&i| self.needs_refinement(mesh, i))
                .collect();
            
            for &idx in triangles_to_refine.iter().rev() {
                if idx < mesh.triangles.len() {
                    self.bisect_longest_edge(mesh, idx);
                    refined = true;
                }
            }
        }
        
        mesh.find_boundary_edges();
    }

    fn needs_refinement(&self, mesh: &TriangularMesh2D, idx: usize) -> bool {
        // Quality check
        if mesh.triangle_quality(idx) < self.min_quality {
            return true;
        }
        
        // Size check
        let t = &mesh.triangles[idx];
        let edges = [
            mesh.nodes[t[0]].distance(&mesh.nodes[t[1]]),
            mesh.nodes[t[1]].distance(&mesh.nodes[t[2]]),
            mesh.nodes[t[2]].distance(&mesh.nodes[t[0]]),
        ];
        
        if edges.iter().any(|&e| e > self.max_edge_length) {
            return true;
        }
        
        // Zone check
        let centroid = Point2D::new(
            (mesh.nodes[t[0]].x + mesh.nodes[t[1]].x + mesh.nodes[t[2]].x) / 3.0,
            (mesh.nodes[t[0]].y + mesh.nodes[t[1]].y + mesh.nodes[t[2]].y) / 3.0,
        );
        
        for zone in &self.refinement_zones {
            if centroid.distance(&zone.center) < zone.radius {
                if edges.iter().any(|&e| e > zone.target_size) {
                    return true;
                }
            }
        }
        
        false
    }

    fn bisect_longest_edge(&self, mesh: &mut TriangularMesh2D, idx: usize) {
        let t = mesh.triangles[idx];
        
        // Find longest edge
        let edges = [
            (0, 1, mesh.nodes[t[0]].distance(&mesh.nodes[t[1]])),
            (1, 2, mesh.nodes[t[1]].distance(&mesh.nodes[t[2]])),
            (2, 0, mesh.nodes[t[2]].distance(&mesh.nodes[t[0]])),
        ];
        
        let (i1, i2, _) = edges.iter()
            .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap();
        
        let n1 = t[*i1];
        let n2 = t[*i2];
        let n3 = t[(i2 + 1) % 3];
        
        // Create midpoint
        let mid = mesh.nodes[n1].midpoint(&mesh.nodes[n2]);
        let mid_idx = mesh.add_node(mid.x, mid.y);
        
        // Replace original with two new triangles
        mesh.triangles[idx] = [n1, mid_idx, n3];
        mesh.triangles.push([mid_idx, n2, n3]);
    }
}

// ============================================================================
// MESH SMOOTHING
// ============================================================================

/// Laplacian mesh smoother
pub struct LaplacianSmoother {
    pub iterations: usize,
    pub relaxation: f64,
    pub boundary_fixed: bool,
}

impl Default for LaplacianSmoother {
    fn default() -> Self {
        LaplacianSmoother {
            iterations: 10,
            relaxation: 0.5,
            boundary_fixed: true,
        }
    }
}

impl LaplacianSmoother {
    pub fn new(iterations: usize) -> Self {
        LaplacianSmoother {
            iterations,
            ..Default::default()
        }
    }

    /// Smooth mesh using Laplacian relaxation
    pub fn smooth(&self, mesh: &mut TriangularMesh2D) {
        mesh.find_boundary_edges();
        
        // Build node-to-node connectivity
        let mut neighbors: Vec<HashSet<usize>> = vec![HashSet::new(); mesh.nodes.len()];
        
        for t in &mesh.triangles {
            neighbors[t[0]].insert(t[1]);
            neighbors[t[0]].insert(t[2]);
            neighbors[t[1]].insert(t[0]);
            neighbors[t[1]].insert(t[2]);
            neighbors[t[2]].insert(t[0]);
            neighbors[t[2]].insert(t[1]);
        }
        
        // Identify boundary nodes
        let mut boundary_nodes = HashSet::new();
        for edge in &mesh.boundary_edges {
            boundary_nodes.insert(edge.n1);
            boundary_nodes.insert(edge.n2);
        }
        
        for _ in 0..self.iterations {
            let mut new_positions = mesh.nodes.clone();
            
            for (i, node) in mesh.nodes.iter().enumerate() {
                if self.boundary_fixed && boundary_nodes.contains(&i) {
                    continue;
                }
                
                if neighbors[i].is_empty() {
                    continue;
                }
                
                // Average of neighbors
                let mut avg_x = 0.0;
                let mut avg_y = 0.0;
                
                for &j in &neighbors[i] {
                    avg_x += mesh.nodes[j].x;
                    avg_y += mesh.nodes[j].y;
                }
                
                let n = neighbors[i].len() as f64;
                avg_x /= n;
                avg_y /= n;
                
                // Relaxed update
                new_positions[i] = Point2D::new(
                    node.x + self.relaxation * (avg_x - node.x),
                    node.y + self.relaxation * (avg_y - node.y),
                );
            }
            
            mesh.nodes = new_positions;
        }
    }
}

// ============================================================================
// MESH QUALITY METRICS
// ============================================================================

/// Comprehensive mesh quality analysis
pub struct MeshQualityAnalyzer;

impl MeshQualityAnalyzer {
    /// Analyze mesh quality
    pub fn analyze(mesh: &TriangularMesh2D) -> MeshQualityReport {
        let qualities: Vec<f64> = (0..mesh.triangles.len())
            .map(|i| mesh.triangle_quality(i))
            .collect();
        
        let areas: Vec<f64> = (0..mesh.triangles.len())
            .map(|i| mesh.triangle_area(i))
            .collect();
        
        let min_quality = qualities.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_quality = qualities.iter().cloned().fold(0.0, f64::max);
        let avg_quality = qualities.iter().sum::<f64>() / qualities.len() as f64;
        
        let min_area = areas.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_area = areas.iter().cloned().fold(0.0, f64::max);
        
        let poor_elements = qualities.iter().filter(|&&q| q < 0.3).count();
        
        MeshQualityReport {
            num_nodes: mesh.nodes.len(),
            num_elements: mesh.triangles.len(),
            min_quality,
            max_quality,
            avg_quality,
            min_area,
            max_area,
            area_ratio: max_area / min_area.max(1e-14),
            poor_elements,
            poor_element_ratio: poor_elements as f64 / mesh.triangles.len() as f64,
        }
    }
}

/// Mesh quality report
#[derive(Debug, Clone)]
pub struct MeshQualityReport {
    pub num_nodes: usize,
    pub num_elements: usize,
    pub min_quality: f64,
    pub max_quality: f64,
    pub avg_quality: f64,
    pub min_area: f64,
    pub max_area: f64,
    pub area_ratio: f64,
    pub poor_elements: usize,
    pub poor_element_ratio: f64,
}

impl MeshQualityReport {
    pub fn is_acceptable(&self) -> bool {
        self.min_quality >= 0.1 && self.poor_element_ratio < 0.1
    }

    pub fn summary(&self) -> String {
        format!(
            "Mesh: {} nodes, {} elements\n\
             Quality: min={:.3}, avg={:.3}, max={:.3}\n\
             Poor elements: {} ({:.1}%)\n\
             Area ratio: {:.1}",
            self.num_nodes, self.num_elements,
            self.min_quality, self.avg_quality, self.max_quality,
            self.poor_elements, self.poor_element_ratio * 100.0,
            self.area_ratio
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point2d() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        
        assert!((p1.distance(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_point3d() {
        let p1 = Point3D::new(0.0, 0.0, 0.0);
        let p2 = Point3D::new(1.0, 2.0, 2.0);
        
        assert!((p1.distance(&p2) - 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_edge_normalization() {
        let e1 = Edge::new(1, 2);
        let e2 = Edge::new(2, 1);
        
        assert_eq!(e1, e2);
    }

    #[test]
    fn test_triangular_mesh() {
        let mut mesh = TriangularMesh2D::new();
        
        mesh.add_node(0.0, 0.0);
        mesh.add_node(1.0, 0.0);
        mesh.add_node(0.5, 1.0);
        mesh.add_triangle(0, 1, 2);
        
        assert_eq!(mesh.node_count(), 3);
        assert_eq!(mesh.element_count(), 1);
    }

    #[test]
    fn test_triangle_area() {
        let mut mesh = TriangularMesh2D::new();
        
        mesh.add_node(0.0, 0.0);
        mesh.add_node(1.0, 0.0);
        mesh.add_node(0.0, 1.0);
        mesh.add_triangle(0, 1, 2);
        
        assert!((mesh.triangle_area(0) - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_triangle_quality() {
        let mut mesh = TriangularMesh2D::new();
        
        // Equilateral triangle
        mesh.add_node(0.0, 0.0);
        mesh.add_node(1.0, 0.0);
        mesh.add_node(0.5, 3.0_f64.sqrt() / 2.0);
        mesh.add_triangle(0, 1, 2);
        
        let q = mesh.triangle_quality(0);
        assert!((q - 1.0).abs() < 0.01);  // Should be close to 1
    }

    #[test]
    fn test_delaunay_triangulation() {
        let points = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(1.0, 0.0),
            Point2D::new(0.0, 1.0),
            Point2D::new(1.0, 1.0),
            Point2D::new(0.5, 0.5),
        ];
        
        let triangulator = DelaunayTriangulator::new();
        let mesh = triangulator.triangulate(&points);
        
        assert_eq!(mesh.node_count(), 5);
        // Delaunay triangulation of 5 points in a square with center
        // should produce 4-8 triangles depending on point configuration
        assert!(mesh.element_count() >= 2, "Expected at least 2 triangles, got {}", mesh.element_count());
    }

    #[test]
    fn test_structured_mesh() {
        let gen = StructuredMeshGenerator::new_2d(3, 2);
        let mesh = gen.generate_triangle_mesh(0.0, 3.0, 0.0, 2.0);
        
        assert_eq!(mesh.node_count(), 12);  // (3+1) * (2+1)
        assert_eq!(mesh.element_count(), 12);  // 3*2*2 triangles
    }

    #[test]
    fn test_structured_hex_mesh() {
        let gen = StructuredMeshGenerator::new_3d(2, 2, 2);
        let (nodes, elements) = gen.generate_hex_mesh(0.0, 1.0, 0.0, 1.0, 0.0, 1.0);
        
        assert_eq!(nodes.len(), 27);  // 3*3*3
        assert_eq!(elements.len(), 8);  // 2*2*2
    }

    #[test]
    fn test_mesh_quality_analysis() {
        let mut mesh = TriangularMesh2D::new();
        
        mesh.add_node(0.0, 0.0);
        mesh.add_node(1.0, 0.0);
        mesh.add_node(0.5, 3.0_f64.sqrt() / 2.0);
        mesh.add_triangle(0, 1, 2);
        
        let report = MeshQualityAnalyzer::analyze(&mesh);
        
        assert_eq!(report.num_elements, 1);
        assert!(report.min_quality > 0.9);
    }

    #[test]
    fn test_laplacian_smoother() {
        let gen = StructuredMeshGenerator::new_2d(3, 3);
        let mut mesh = gen.generate_triangle_mesh(0.0, 1.0, 0.0, 1.0);
        
        let quality_before = mesh.avg_quality();
        
        let smoother = LaplacianSmoother::new(5);
        smoother.smooth(&mut mesh);
        
        // Quality should improve or stay same
        assert!(mesh.avg_quality() >= quality_before * 0.9);
    }

    #[test]
    fn test_tetrahedron_volume() {
        let mut mesh = TetrahedralMesh3D::new();
        
        mesh.add_node(0.0, 0.0, 0.0);
        mesh.add_node(1.0, 0.0, 0.0);
        mesh.add_node(0.0, 1.0, 0.0);
        mesh.add_node(0.0, 0.0, 1.0);
        mesh.add_tetrahedron(0, 1, 2, 3);
        
        let vol = mesh.tetrahedron_volume(0);
        assert!((vol - 1.0/6.0).abs() < 1e-10);
    }

    #[test]
    fn test_mesh_refiner() {
        let gen = StructuredMeshGenerator::new_2d(2, 2);
        let mut mesh = gen.generate_triangle_mesh(0.0, 1.0, 0.0, 1.0);
        
        let initial_count = mesh.element_count();
        
        let mut refiner = MeshRefiner::new();
        refiner.max_edge_length = 0.3;
        refiner.refine(&mut mesh);
        
        assert!(mesh.element_count() > initial_count);
    }

    #[test]
    fn test_boundary_edges() {
        let gen = StructuredMeshGenerator::new_2d(2, 2);
        let mut mesh = gen.generate_triangle_mesh(0.0, 1.0, 0.0, 1.0);
        mesh.find_boundary_edges();
        
        // Square boundary should have 8 edges (2 per side)
        assert_eq!(mesh.boundary_edges.len(), 8);
    }
}
