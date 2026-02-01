// ============================================================================
// AUTOMATIC MESH GENERATION MODULE
// Finite Element Mesh Generation for Complex Geometries
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// MESH TYPES
// ============================================================================

/// Element type for mesh generation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeshElementType {
    /// 3-node triangle
    Tri3,
    /// 6-node triangle (quadratic)
    Tri6,
    /// 4-node quadrilateral
    Quad4,
    /// 8-node quadrilateral (quadratic)
    Quad8,
    /// 4-node tetrahedron
    Tet4,
    /// 10-node tetrahedron (quadratic)
    Tet10,
    /// 8-node hexahedron (brick)
    Hex8,
    /// 20-node hexahedron (quadratic)
    Hex20,
}

impl MeshElementType {
    /// Number of nodes per element
    pub fn nodes_per_element(&self) -> usize {
        match self {
            MeshElementType::Tri3 => 3,
            MeshElementType::Tri6 => 6,
            MeshElementType::Quad4 => 4,
            MeshElementType::Quad8 => 8,
            MeshElementType::Tet4 => 4,
            MeshElementType::Tet10 => 10,
            MeshElementType::Hex8 => 8,
            MeshElementType::Hex20 => 20,
        }
    }
    
    /// Is this a 2D element?
    pub fn is_2d(&self) -> bool {
        matches!(self, MeshElementType::Tri3 | MeshElementType::Tri6 | 
                       MeshElementType::Quad4 | MeshElementType::Quad8)
    }
    
    /// Is this a 3D element?
    pub fn is_3d(&self) -> bool {
        !self.is_2d()
    }
}

/// Mesh quality metrics
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MeshQualityMetric {
    /// Aspect ratio (ideal = 1.0)
    AspectRatio,
    /// Jacobian quality
    Jacobian,
    /// Skewness (ideal = 0.0)
    Skewness,
    /// Minimum angle
    MinAngle,
    /// Maximum angle
    MaxAngle,
}

// ============================================================================
// GEOMETRY PRIMITIVES
// ============================================================================

/// 2D point
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
    
    pub fn distance_to(&self, other: &Point2D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
    
    pub fn midpoint(&self, other: &Point2D) -> Point2D {
        Point2D::new((self.x + other.x) / 2.0, (self.y + other.y) / 2.0)
    }
}

/// 3D point
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }
    
    pub fn distance_to(&self, other: &Point3D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2) + (self.z - other.z).powi(2)).sqrt()
    }
    
    pub fn midpoint(&self, other: &Point3D) -> Point3D {
        Point3D::new(
            (self.x + other.x) / 2.0,
            (self.y + other.y) / 2.0,
            (self.z + other.z) / 2.0,
        )
    }
}

/// 2D line segment
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Line2D {
    pub start: Point2D,
    pub end: Point2D,
}

impl Line2D {
    pub fn new(start: Point2D, end: Point2D) -> Self {
        Self { start, end }
    }
    
    pub fn length(&self) -> f64 {
        self.start.distance_to(&self.end)
    }
    
    pub fn midpoint(&self) -> Point2D {
        self.start.midpoint(&self.end)
    }
    
    /// Divide line into n segments
    pub fn divide(&self, n: usize) -> Vec<Point2D> {
        let mut points = Vec::with_capacity(n + 1);
        for i in 0..=n {
            let t = i as f64 / n as f64;
            points.push(Point2D::new(
                self.start.x + t * (self.end.x - self.start.x),
                self.start.y + t * (self.end.y - self.start.y),
            ));
        }
        points
    }
}

/// 2D polygon (closed region)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Polygon2D {
    pub vertices: Vec<Point2D>,
}

impl Polygon2D {
    pub fn new(vertices: Vec<Point2D>) -> Self {
        Self { vertices }
    }
    
    /// Create rectangle
    pub fn rectangle(x_min: f64, y_min: f64, x_max: f64, y_max: f64) -> Self {
        Self {
            vertices: vec![
                Point2D::new(x_min, y_min),
                Point2D::new(x_max, y_min),
                Point2D::new(x_max, y_max),
                Point2D::new(x_min, y_max),
            ],
        }
    }
    
    /// Create circle (approximated)
    pub fn circle(center: Point2D, radius: f64, n_points: usize) -> Self {
        let mut vertices = Vec::with_capacity(n_points);
        for i in 0..n_points {
            let theta = 2.0 * PI * i as f64 / n_points as f64;
            vertices.push(Point2D::new(
                center.x + radius * theta.cos(),
                center.y + radius * theta.sin(),
            ));
        }
        Self { vertices }
    }
    
    /// Calculate area using shoelace formula
    pub fn area(&self) -> f64 {
        let n = self.vertices.len();
        if n < 3 {
            return 0.0;
        }
        
        let mut sum = 0.0;
        for i in 0..n {
            let j = (i + 1) % n;
            sum += self.vertices[i].x * self.vertices[j].y;
            sum -= self.vertices[j].x * self.vertices[i].y;
        }
        sum.abs() / 2.0
    }
    
    /// Calculate centroid
    pub fn centroid(&self) -> Point2D {
        let n = self.vertices.len();
        if n == 0 {
            return Point2D::new(0.0, 0.0);
        }
        
        let mut cx = 0.0;
        let mut cy = 0.0;
        for v in &self.vertices {
            cx += v.x;
            cy += v.y;
        }
        Point2D::new(cx / n as f64, cy / n as f64)
    }
    
    /// Check if point is inside polygon (ray casting)
    pub fn contains(&self, p: &Point2D) -> bool {
        let n = self.vertices.len();
        let mut inside = false;
        
        let mut j = n - 1;
        for i in 0..n {
            let vi = &self.vertices[i];
            let vj = &self.vertices[j];
            
            if ((vi.y > p.y) != (vj.y > p.y)) &&
               (p.x < (vj.x - vi.x) * (p.y - vi.y) / (vj.y - vi.y) + vi.x) {
                inside = !inside;
            }
            j = i;
        }
        inside
    }
    
    /// Get bounding box
    pub fn bounding_box(&self) -> (f64, f64, f64, f64) {
        let mut x_min = f64::MAX;
        let mut y_min = f64::MAX;
        let mut x_max = f64::MIN;
        let mut y_max = f64::MIN;
        
        for v in &self.vertices {
            x_min = x_min.min(v.x);
            y_min = y_min.min(v.y);
            x_max = x_max.max(v.x);
            y_max = y_max.max(v.y);
        }
        
        (x_min, y_min, x_max, y_max)
    }
}

// ============================================================================
// MESH DATA STRUCTURES
// ============================================================================

/// Node in a mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Element in a mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshElement {
    pub id: usize,
    pub element_type: MeshElementType,
    pub node_ids: Vec<usize>,
}

/// Complete mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mesh {
    pub nodes: Vec<MeshNode>,
    pub elements: Vec<MeshElement>,
    pub element_type: MeshElementType,
}

impl Mesh {
    pub fn new(element_type: MeshElementType) -> Self {
        Self {
            nodes: Vec::new(),
            elements: Vec::new(),
            element_type,
        }
    }
    
    /// Add a node and return its ID
    pub fn add_node(&mut self, x: f64, y: f64, z: f64) -> usize {
        let id = self.nodes.len();
        self.nodes.push(MeshNode { id, x, y, z });
        id
    }
    
    /// Add an element
    pub fn add_element(&mut self, node_ids: Vec<usize>) {
        let id = self.elements.len();
        self.elements.push(MeshElement {
            id,
            element_type: self.element_type,
            node_ids,
        });
    }
    
    /// Get mesh statistics
    pub fn statistics(&self) -> MeshStatistics {
        let n_nodes = self.nodes.len();
        let n_elements = self.elements.len();
        
        // Calculate bounding box
        let mut x_min = f64::MAX;
        let mut y_min = f64::MAX;
        let mut z_min = f64::MAX;
        let mut x_max = f64::MIN;
        let mut y_max = f64::MIN;
        let mut z_max = f64::MIN;
        
        for node in &self.nodes {
            x_min = x_min.min(node.x);
            y_min = y_min.min(node.y);
            z_min = z_min.min(node.z);
            x_max = x_max.max(node.x);
            y_max = y_max.max(node.y);
            z_max = z_max.max(node.z);
        }
        
        MeshStatistics {
            n_nodes,
            n_elements,
            element_type: self.element_type,
            bounding_box: (x_min, y_min, z_min, x_max, y_max, z_max),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshStatistics {
    pub n_nodes: usize,
    pub n_elements: usize,
    pub element_type: MeshElementType,
    pub bounding_box: (f64, f64, f64, f64, f64, f64),
}

// ============================================================================
// MESH GENERATORS
// ============================================================================

/// Structured quad mesh generator for rectangular regions
pub struct StructuredQuadMesher;

impl StructuredQuadMesher {
    /// Generate structured quad mesh for rectangle
    pub fn generate_rectangle(
        x_min: f64,
        y_min: f64,
        x_max: f64,
        y_max: f64,
        nx: usize,
        ny: usize,
    ) -> Mesh {
        let mut mesh = Mesh::new(MeshElementType::Quad4);
        
        let dx = (x_max - x_min) / nx as f64;
        let dy = (y_max - y_min) / ny as f64;
        
        // Generate nodes
        let mut node_map: HashMap<(usize, usize), usize> = HashMap::new();
        
        for j in 0..=ny {
            for i in 0..=nx {
                let x = x_min + i as f64 * dx;
                let y = y_min + j as f64 * dy;
                let id = mesh.add_node(x, y, 0.0);
                node_map.insert((i, j), id);
            }
        }
        
        // Generate elements
        for j in 0..ny {
            for i in 0..nx {
                let n1 = node_map[&(i, j)];
                let n2 = node_map[&(i + 1, j)];
                let n3 = node_map[&(i + 1, j + 1)];
                let n4 = node_map[&(i, j + 1)];
                mesh.add_element(vec![n1, n2, n3, n4]);
            }
        }
        
        mesh
    }
    
    /// Generate mesh with grading (refinement toward edges)
    pub fn generate_graded(
        x_min: f64,
        y_min: f64,
        x_max: f64,
        y_max: f64,
        nx: usize,
        ny: usize,
        grading_x: f64,
        grading_y: f64,
    ) -> Mesh {
        let mut mesh = Mesh::new(MeshElementType::Quad4);
        
        // Generate graded spacing
        let x_coords = Self::graded_spacing(x_min, x_max, nx, grading_x);
        let y_coords = Self::graded_spacing(y_min, y_max, ny, grading_y);
        
        // Generate nodes
        let mut node_map: HashMap<(usize, usize), usize> = HashMap::new();
        
        for (j, &y) in y_coords.iter().enumerate() {
            for (i, &x) in x_coords.iter().enumerate() {
                let id = mesh.add_node(x, y, 0.0);
                node_map.insert((i, j), id);
            }
        }
        
        // Generate elements
        for j in 0..ny {
            for i in 0..nx {
                let n1 = node_map[&(i, j)];
                let n2 = node_map[&(i + 1, j)];
                let n3 = node_map[&(i + 1, j + 1)];
                let n4 = node_map[&(i, j + 1)];
                mesh.add_element(vec![n1, n2, n3, n4]);
            }
        }
        
        mesh
    }
    
    fn graded_spacing(start: f64, end: f64, n: usize, grading: f64) -> Vec<f64> {
        let mut coords = Vec::with_capacity(n + 1);
        let length = end - start;
        
        if (grading - 1.0).abs() < 1e-6 {
            // Uniform spacing
            for i in 0..=n {
                coords.push(start + length * i as f64 / n as f64);
            }
        } else {
            // Geometric grading
            let r = grading;
            let sum = if (r - 1.0).abs() < 1e-6 {
                n as f64
            } else {
                (1.0 - r.powi(n as i32)) / (1.0 - r)
            };
            
            let mut cumulative = 0.0;
            coords.push(start);
            
            for i in 0..n {
                let segment = r.powi(i as i32) / sum;
                cumulative += segment;
                coords.push(start + length * cumulative);
            }
        }
        
        coords
    }
}

/// Triangle mesh generator using advancing front method
pub struct TriangleMesher {
    target_size: f64,
}

impl TriangleMesher {
    pub fn new(target_size: f64) -> Self {
        Self { target_size }
    }
    
    /// Generate triangle mesh for polygon
    pub fn generate(&self, polygon: &Polygon2D) -> Mesh {
        let mut mesh = Mesh::new(MeshElementType::Tri3);
        
        // Get bounding box and create background grid
        let (x_min, y_min, x_max, y_max) = polygon.bounding_box();
        let margin = self.target_size;
        
        let nx = ((x_max - x_min + 2.0 * margin) / self.target_size).ceil() as usize;
        let ny = ((y_max - y_min + 2.0 * margin) / self.target_size).ceil() as usize;
        
        // First, create boundary nodes
        let boundary_nodes = self.discretize_boundary(polygon);
        
        // Add boundary nodes to mesh
        let mut node_ids: Vec<usize> = Vec::new();
        for p in &boundary_nodes {
            let id = mesh.add_node(p.x, p.y, 0.0);
            node_ids.push(id);
        }
        
        // Create internal points
        let internal_points = self.generate_internal_points(polygon, nx, ny, x_min - margin, y_min - margin);
        
        for p in &internal_points {
            mesh.add_node(p.x, p.y, 0.0);
        }
        
        // Simple Delaunay-like triangulation
        self.triangulate(&mut mesh, &boundary_nodes, &internal_points);
        
        mesh
    }
    
    fn discretize_boundary(&self, polygon: &Polygon2D) -> Vec<Point2D> {
        let mut points = Vec::new();
        let n = polygon.vertices.len();
        
        for i in 0..n {
            let j = (i + 1) % n;
            let line = Line2D::new(polygon.vertices[i], polygon.vertices[j]);
            let n_segments = (line.length() / self.target_size).ceil() as usize;
            let divided = line.divide(n_segments.max(1));
            
            // Add all but the last point (to avoid duplicates)
            for k in 0..divided.len() - 1 {
                points.push(divided[k]);
            }
        }
        
        points
    }
    
    fn generate_internal_points(
        &self,
        polygon: &Polygon2D,
        nx: usize,
        ny: usize,
        x_start: f64,
        y_start: f64,
    ) -> Vec<Point2D> {
        let mut points = Vec::new();
        
        for j in 0..=ny {
            for i in 0..=nx {
                let x = x_start + i as f64 * self.target_size;
                let y = y_start + j as f64 * self.target_size;
                let p = Point2D::new(x, y);
                
                if polygon.contains(&p) {
                    points.push(p);
                }
            }
        }
        
        points
    }
    
    fn triangulate(
        &self,
        mesh: &mut Mesh,
        boundary: &[Point2D],
        internal: &[Point2D],
    ) {
        // Combine all points
        let mut all_points: Vec<Point2D> = Vec::new();
        all_points.extend(boundary.iter().cloned());
        all_points.extend(internal.iter().cloned());
        
        if all_points.len() < 3 {
            return;
        }
        
        // Simple ear-clipping style triangulation for the boundary first
        // Then add internal points
        
        // For simplicity, use a basic triangulation
        let centroid = Point2D::new(
            all_points.iter().map(|p| p.x).sum::<f64>() / all_points.len() as f64,
            all_points.iter().map(|p| p.y).sum::<f64>() / all_points.len() as f64,
        );
        
        // Add centroid as a node
        let centroid_id = mesh.nodes.len();
        mesh.add_node(centroid.x, centroid.y, 0.0);
        
        // Create triangles from boundary
        let n_boundary = boundary.len();
        for i in 0..n_boundary {
            let j = (i + 1) % n_boundary;
            mesh.add_element(vec![i, j, centroid_id]);
        }
    }
}

/// 3D hexahedral mesh generator
pub struct HexMesher;

impl HexMesher {
    /// Generate structured hex mesh for rectangular prism
    pub fn generate_box(
        x_min: f64, y_min: f64, z_min: f64,
        x_max: f64, y_max: f64, z_max: f64,
        nx: usize, ny: usize, nz: usize,
    ) -> Mesh {
        let mut mesh = Mesh::new(MeshElementType::Hex8);
        
        let dx = (x_max - x_min) / nx as f64;
        let dy = (y_max - y_min) / ny as f64;
        let dz = (z_max - z_min) / nz as f64;
        
        // Generate nodes
        let mut node_map: HashMap<(usize, usize, usize), usize> = HashMap::new();
        
        for k in 0..=nz {
            for j in 0..=ny {
                for i in 0..=nx {
                    let x = x_min + i as f64 * dx;
                    let y = y_min + j as f64 * dy;
                    let z = z_min + k as f64 * dz;
                    let id = mesh.add_node(x, y, z);
                    node_map.insert((i, j, k), id);
                }
            }
        }
        
        // Generate elements
        for k in 0..nz {
            for j in 0..ny {
                for i in 0..nx {
                    let n1 = node_map[&(i, j, k)];
                    let n2 = node_map[&(i + 1, j, k)];
                    let n3 = node_map[&(i + 1, j + 1, k)];
                    let n4 = node_map[&(i, j + 1, k)];
                    let n5 = node_map[&(i, j, k + 1)];
                    let n6 = node_map[&(i + 1, j, k + 1)];
                    let n7 = node_map[&(i + 1, j + 1, k + 1)];
                    let n8 = node_map[&(i, j + 1, k + 1)];
                    mesh.add_element(vec![n1, n2, n3, n4, n5, n6, n7, n8]);
                }
            }
        }
        
        mesh
    }
    
    /// Generate mesh for cylindrical region
    pub fn generate_cylinder(
        center: Point3D,
        radius: f64,
        height: f64,
        n_radial: usize,
        n_circum: usize,
        n_axial: usize,
    ) -> Mesh {
        let mut mesh = Mesh::new(MeshElementType::Hex8);
        
        let dr = radius / n_radial as f64;
        let dtheta = 2.0 * PI / n_circum as f64;
        let dz = height / n_axial as f64;
        
        // Generate nodes
        let mut node_map: HashMap<(usize, usize, usize), usize> = HashMap::new();
        
        for k in 0..=n_axial {
            for j in 0..n_circum {
                for i in 0..=n_radial {
                    let r = if i == 0 { 0.001 * radius } else { i as f64 * dr };
                    let theta = j as f64 * dtheta;
                    let z = k as f64 * dz;
                    
                    let x = center.x + r * theta.cos();
                    let y = center.y + r * theta.sin();
                    let z_coord = center.z + z;
                    
                    let id = mesh.add_node(x, y, z_coord);
                    node_map.insert((i, j, k), id);
                }
            }
        }
        
        // Generate elements
        for k in 0..n_axial {
            for j in 0..n_circum {
                let j_next = (j + 1) % n_circum;
                for i in 0..n_radial {
                    let n1 = node_map[&(i, j, k)];
                    let n2 = node_map[&(i + 1, j, k)];
                    let n3 = node_map[&(i + 1, j_next, k)];
                    let n4 = node_map[&(i, j_next, k)];
                    let n5 = node_map[&(i, j, k + 1)];
                    let n6 = node_map[&(i + 1, j, k + 1)];
                    let n7 = node_map[&(i + 1, j_next, k + 1)];
                    let n8 = node_map[&(i, j_next, k + 1)];
                    mesh.add_element(vec![n1, n2, n3, n4, n5, n6, n7, n8]);
                }
            }
        }
        
        mesh
    }
}

// ============================================================================
// MESH QUALITY
// ============================================================================

/// Mesh quality analyzer
pub struct MeshQualityAnalyzer;

impl MeshQualityAnalyzer {
    /// Calculate aspect ratio for quad element
    pub fn quad_aspect_ratio(p1: &Point2D, p2: &Point2D, p3: &Point2D, p4: &Point2D) -> f64 {
        let l1 = p1.distance_to(p2);
        let l2 = p2.distance_to(p3);
        let l3 = p3.distance_to(p4);
        let l4 = p4.distance_to(p1);
        
        let l_max = l1.max(l2).max(l3).max(l4);
        let l_min = l1.min(l2).min(l3).min(l4);
        
        if l_min > 0.0 {
            l_max / l_min
        } else {
            f64::INFINITY
        }
    }
    
    /// Calculate skewness for quad element
    pub fn quad_skewness(p1: &Point2D, p2: &Point2D, p3: &Point2D, p4: &Point2D) -> f64 {
        // Calculate angles at each corner
        let angles = [
            Self::angle_at_vertex(p4, p1, p2),
            Self::angle_at_vertex(p1, p2, p3),
            Self::angle_at_vertex(p2, p3, p4),
            Self::angle_at_vertex(p3, p4, p1),
        ];
        
        let ideal_angle = 90.0_f64.to_radians();
        let max_deviation = angles.iter()
            .map(|&a| (a - ideal_angle).abs())
            .fold(0.0_f64, |a, b| a.max(b));
        
        max_deviation / ideal_angle
    }
    
    /// Calculate aspect ratio for triangle
    pub fn tri_aspect_ratio(p1: &Point2D, p2: &Point2D, p3: &Point2D) -> f64 {
        let a = p1.distance_to(p2);
        let b = p2.distance_to(p3);
        let c = p3.distance_to(p1);
        
        let s = (a + b + c) / 2.0;
        let area = (s * (s - a) * (s - b) * (s - c)).sqrt();
        
        if area > 0.0 {
            let l_max = a.max(b).max(c);
            l_max * (a + b + c) / (4.0 * 3.0_f64.sqrt() * area)
        } else {
            f64::INFINITY
        }
    }
    
    fn angle_at_vertex(p1: &Point2D, vertex: &Point2D, p2: &Point2D) -> f64 {
        let v1 = (p1.x - vertex.x, p1.y - vertex.y);
        let v2 = (p2.x - vertex.x, p2.y - vertex.y);
        
        let dot = v1.0 * v2.0 + v1.1 * v2.1;
        let len1 = (v1.0 * v1.0 + v1.1 * v1.1).sqrt();
        let len2 = (v2.0 * v2.0 + v2.1 * v2.1).sqrt();
        
        if len1 > 0.0 && len2 > 0.0 {
            (dot / (len1 * len2)).clamp(-1.0, 1.0).acos()
        } else {
            0.0
        }
    }
    
    /// Analyze mesh quality
    pub fn analyze(mesh: &Mesh) -> MeshQualityReport {
        let mut aspect_ratios = Vec::new();
        let mut skewness_values = Vec::new();
        
        for element in &mesh.elements {
            if element.node_ids.len() >= 4 && mesh.element_type.is_2d() {
                let nodes: Vec<_> = element.node_ids.iter()
                    .map(|&id| &mesh.nodes[id])
                    .collect();
                
                let p1 = Point2D::new(nodes[0].x, nodes[0].y);
                let p2 = Point2D::new(nodes[1].x, nodes[1].y);
                let p3 = Point2D::new(nodes[2].x, nodes[2].y);
                
                if element.node_ids.len() >= 4 {
                    let p4 = Point2D::new(nodes[3].x, nodes[3].y);
                    aspect_ratios.push(Self::quad_aspect_ratio(&p1, &p2, &p3, &p4));
                    skewness_values.push(Self::quad_skewness(&p1, &p2, &p3, &p4));
                } else {
                    aspect_ratios.push(Self::tri_aspect_ratio(&p1, &p2, &p3));
                }
            }
        }
        
        let n = aspect_ratios.len() as f64;
        
        MeshQualityReport {
            n_elements: mesh.elements.len(),
            avg_aspect_ratio: if n > 0.0 { aspect_ratios.iter().sum::<f64>() / n } else { 0.0 },
            max_aspect_ratio: aspect_ratios.iter().cloned().fold(0.0_f64, f64::max),
            avg_skewness: if n > 0.0 && !skewness_values.is_empty() { 
                skewness_values.iter().sum::<f64>() / skewness_values.len() as f64 
            } else { 0.0 },
            max_skewness: skewness_values.iter().cloned().fold(0.0_f64, f64::max),
            quality_grade: Self::compute_grade(&aspect_ratios, &skewness_values),
        }
    }
    
    fn compute_grade(aspect_ratios: &[f64], skewness: &[f64]) -> MeshQualityGrade {
        let max_ar = aspect_ratios.iter().cloned().fold(0.0_f64, f64::max);
        let max_skew = skewness.iter().cloned().fold(0.0_f64, f64::max);
        
        if max_ar < 2.0 && max_skew < 0.25 {
            MeshQualityGrade::Excellent
        } else if max_ar < 3.0 && max_skew < 0.5 {
            MeshQualityGrade::Good
        } else if max_ar < 5.0 && max_skew < 0.75 {
            MeshQualityGrade::Acceptable
        } else {
            MeshQualityGrade::Poor
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MeshQualityGrade {
    Excellent,
    Good,
    Acceptable,
    Poor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshQualityReport {
    pub n_elements: usize,
    pub avg_aspect_ratio: f64,
    pub max_aspect_ratio: f64,
    pub avg_skewness: f64,
    pub max_skewness: f64,
    pub quality_grade: MeshQualityGrade,
}

// ============================================================================
// MESH REFINEMENT
// ============================================================================

/// Adaptive mesh refiner
pub struct MeshRefiner;

impl MeshRefiner {
    /// Refine mesh uniformly by splitting each element
    pub fn refine_uniform(mesh: &Mesh) -> Mesh {
        match mesh.element_type {
            MeshElementType::Quad4 => Self::refine_quads(mesh),
            MeshElementType::Tri3 => Self::refine_triangles(mesh),
            _ => mesh.clone(),
        }
    }
    
    fn refine_quads(mesh: &Mesh) -> Mesh {
        let mut new_mesh = Mesh::new(MeshElementType::Quad4);
        
        // Copy existing nodes
        for node in &mesh.nodes {
            new_mesh.add_node(node.x, node.y, node.z);
        }
        
        // Track edge midpoints to avoid duplicates
        let mut edge_midpoints: HashMap<(usize, usize), usize> = HashMap::new();
        
        for element in &mesh.elements {
            let nodes = &element.node_ids;
            if nodes.len() < 4 {
                continue;
            }
            
            // Get or create midpoint nodes for each edge
            let m01 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[0], nodes[1]);
            let m12 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[1], nodes[2]);
            let m23 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[2], nodes[3]);
            let m30 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[3], nodes[0]);
            
            // Center node
            let center_x = (new_mesh.nodes[nodes[0]].x + new_mesh.nodes[nodes[1]].x + 
                          new_mesh.nodes[nodes[2]].x + new_mesh.nodes[nodes[3]].x) / 4.0;
            let center_y = (new_mesh.nodes[nodes[0]].y + new_mesh.nodes[nodes[1]].y + 
                          new_mesh.nodes[nodes[2]].y + new_mesh.nodes[nodes[3]].y) / 4.0;
            let center_z = (new_mesh.nodes[nodes[0]].z + new_mesh.nodes[nodes[1]].z + 
                          new_mesh.nodes[nodes[2]].z + new_mesh.nodes[nodes[3]].z) / 4.0;
            let center = new_mesh.add_node(center_x, center_y, center_z);
            
            // Create 4 new quads
            new_mesh.add_element(vec![nodes[0], m01, center, m30]);
            new_mesh.add_element(vec![m01, nodes[1], m12, center]);
            new_mesh.add_element(vec![center, m12, nodes[2], m23]);
            new_mesh.add_element(vec![m30, center, m23, nodes[3]]);
        }
        
        new_mesh
    }
    
    fn refine_triangles(mesh: &Mesh) -> Mesh {
        let mut new_mesh = Mesh::new(MeshElementType::Tri3);
        
        // Copy existing nodes
        for node in &mesh.nodes {
            new_mesh.add_node(node.x, node.y, node.z);
        }
        
        let mut edge_midpoints: HashMap<(usize, usize), usize> = HashMap::new();
        
        for element in &mesh.elements {
            let nodes = &element.node_ids;
            if nodes.len() < 3 {
                continue;
            }
            
            let m01 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[0], nodes[1]);
            let m12 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[1], nodes[2]);
            let m20 = Self::get_or_create_midpoint(&mut new_mesh, &mut edge_midpoints, nodes[2], nodes[0]);
            
            // Create 4 new triangles
            new_mesh.add_element(vec![nodes[0], m01, m20]);
            new_mesh.add_element(vec![m01, nodes[1], m12]);
            new_mesh.add_element(vec![m20, m12, nodes[2]]);
            new_mesh.add_element(vec![m01, m12, m20]);
        }
        
        new_mesh
    }
    
    fn get_or_create_midpoint(
        mesh: &mut Mesh,
        edge_map: &mut HashMap<(usize, usize), usize>,
        n1: usize,
        n2: usize,
    ) -> usize {
        let key = if n1 < n2 { (n1, n2) } else { (n2, n1) };
        
        if let Some(&mid_id) = edge_map.get(&key) {
            return mid_id;
        }
        
        let p1 = &mesh.nodes[n1];
        let p2 = &mesh.nodes[n2];
        
        let mid_x = (p1.x + p2.x) / 2.0;
        let mid_y = (p1.y + p2.y) / 2.0;
        let mid_z = (p1.z + p2.z) / 2.0;
        
        let mid_id = mesh.add_node(mid_x, mid_y, mid_z);
        edge_map.insert(key, mid_id);
        mid_id
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point2d_distance() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(3.0, 4.0);
        assert!((p1.distance_to(&p2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_polygon_area() {
        let rect = Polygon2D::rectangle(0.0, 0.0, 10.0, 5.0);
        assert!((rect.area() - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_polygon_contains() {
        let rect = Polygon2D::rectangle(0.0, 0.0, 10.0, 10.0);
        assert!(rect.contains(&Point2D::new(5.0, 5.0)));
        assert!(!rect.contains(&Point2D::new(15.0, 5.0)));
    }

    #[test]
    fn test_structured_quad_mesh() {
        let mesh = StructuredQuadMesher::generate_rectangle(0.0, 0.0, 10.0, 10.0, 5, 5);
        
        assert_eq!(mesh.nodes.len(), 36); // (5+1) * (5+1)
        assert_eq!(mesh.elements.len(), 25); // 5 * 5
    }

    #[test]
    fn test_hex_mesh() {
        let mesh = HexMesher::generate_box(0.0, 0.0, 0.0, 10.0, 10.0, 10.0, 2, 2, 2);
        
        assert_eq!(mesh.nodes.len(), 27); // (2+1)^3
        assert_eq!(mesh.elements.len(), 8); // 2^3
    }

    #[test]
    fn test_mesh_statistics() {
        let mesh = StructuredQuadMesher::generate_rectangle(0.0, 0.0, 100.0, 50.0, 10, 5);
        let stats = mesh.statistics();
        
        assert_eq!(stats.n_nodes, 66);
        assert_eq!(stats.n_elements, 50);
        assert_eq!(stats.element_type, MeshElementType::Quad4);
    }

    #[test]
    fn test_mesh_quality() {
        let mesh = StructuredQuadMesher::generate_rectangle(0.0, 0.0, 10.0, 10.0, 4, 4);
        let report = MeshQualityAnalyzer::analyze(&mesh);
        
        assert!(report.avg_aspect_ratio >= 1.0);
        assert!(report.max_aspect_ratio < 2.0); // Uniform mesh should have good aspect ratio
    }

    #[test]
    fn test_mesh_refinement() {
        let mesh = StructuredQuadMesher::generate_rectangle(0.0, 0.0, 10.0, 10.0, 2, 2);
        let refined = MeshRefiner::refine_uniform(&mesh);
        
        // Refinement should increase element count by 4
        assert_eq!(refined.elements.len(), mesh.elements.len() * 4);
    }

    #[test]
    fn test_triangle_mesher() {
        let polygon = Polygon2D::rectangle(0.0, 0.0, 10.0, 10.0);
        let mesher = TriangleMesher::new(2.0);
        let mesh = mesher.generate(&polygon);
        
        assert!(mesh.nodes.len() > 4);
        assert!(mesh.elements.len() > 0);
    }

    #[test]
    fn test_graded_mesh() {
        let mesh = StructuredQuadMesher::generate_graded(
            0.0, 0.0, 10.0, 10.0, 5, 5, 1.2, 1.2
        );
        
        assert_eq!(mesh.elements.len(), 25);
        
        // Check that spacing is non-uniform
        let dx_first = mesh.nodes[1].x - mesh.nodes[0].x;
        let dx_last = mesh.nodes[5].x - mesh.nodes[4].x;
        assert!(dx_first != dx_last || (dx_first - dx_last).abs() < 1e-6);
    }

    #[test]
    fn test_cylinder_mesh() {
        let center = Point3D::new(0.0, 0.0, 0.0);
        let mesh = HexMesher::generate_cylinder(center, 5.0, 10.0, 3, 8, 4);
        
        assert!(mesh.nodes.len() > 0);
        assert!(mesh.elements.len() > 0);
    }

    #[test]
    fn test_line_divide() {
        let line = Line2D::new(Point2D::new(0.0, 0.0), Point2D::new(10.0, 0.0));
        let points = line.divide(5);
        
        assert_eq!(points.len(), 6);
        assert!((points[0].x - 0.0).abs() < 1e-10);
        assert!((points[5].x - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_polygon_centroid() {
        let rect = Polygon2D::rectangle(0.0, 0.0, 10.0, 10.0);
        let centroid = rect.centroid();
        
        assert!((centroid.x - 5.0).abs() < 1e-10);
        assert!((centroid.y - 5.0).abs() < 1e-10);
    }
}
