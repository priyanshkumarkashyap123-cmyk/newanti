//! # Advanced Rendering Optimization Module
//! 
//! High-performance rendering system for complex structural engineering models.
//! Designed for minimal GPU/CPU usage and server load through:
//! - Level of Detail (LOD) management
//! - Spatial partitioning (Octree/BVH)
//! - Mesh simplification algorithms
//! - Instanced rendering
//! - Progressive streaming
//! - Geometry compression

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// CORE GEOMETRY TYPES
// ============================================================================

/// 3D Vector for rendering calculations
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }
    
    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0, z: 0.0 }
    }
    
    pub fn length(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }
    
    pub fn length_squared(&self) -> f64 {
        self.x * self.x + self.y * self.y + self.z * self.z
    }
    
    pub fn normalize(&self) -> Self {
        let len = self.length();
        if len > 1e-10 {
            Self { x: self.x / len, y: self.y / len, z: self.z / len }
        } else {
            Self::zero()
        }
    }
    
    pub fn dot(&self, other: &Vec3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }
    
    pub fn cross(&self, other: &Vec3) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
    
    pub fn distance_to(&self, other: &Vec3) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    pub fn add(&self, other: &Vec3) -> Self {
        Self { x: self.x + other.x, y: self.y + other.y, z: self.z + other.z }
    }
    
    pub fn sub(&self, other: &Vec3) -> Self {
        Self { x: self.x - other.x, y: self.y - other.y, z: self.z - other.z }
    }
    
    pub fn scale(&self, s: f64) -> Self {
        Self { x: self.x * s, y: self.y * s, z: self.z * s }
    }
    
    pub fn lerp(&self, other: &Vec3, t: f64) -> Self {
        Self {
            x: self.x + (other.x - self.x) * t,
            y: self.y + (other.y - self.y) * t,
            z: self.z + (other.z - self.z) * t,
        }
    }
}

/// Axis-Aligned Bounding Box for spatial queries
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct AABB {
    pub min: Vec3,
    pub max: Vec3,
}

impl AABB {
    pub fn new(min: Vec3, max: Vec3) -> Self {
        Self { min, max }
    }
    
    pub fn from_points(points: &[Vec3]) -> Self {
        if points.is_empty() {
            return Self { min: Vec3::zero(), max: Vec3::zero() };
        }
        
        let mut min = points[0];
        let mut max = points[0];
        
        for p in points.iter().skip(1) {
            min.x = min.x.min(p.x);
            min.y = min.y.min(p.y);
            min.z = min.z.min(p.z);
            max.x = max.x.max(p.x);
            max.y = max.y.max(p.y);
            max.z = max.z.max(p.z);
        }
        
        Self { min, max }
    }
    
    pub fn center(&self) -> Vec3 {
        Vec3 {
            x: (self.min.x + self.max.x) * 0.5,
            y: (self.min.y + self.max.y) * 0.5,
            z: (self.min.z + self.max.z) * 0.5,
        }
    }
    
    pub fn size(&self) -> Vec3 {
        Vec3 {
            x: self.max.x - self.min.x,
            y: self.max.y - self.min.y,
            z: self.max.z - self.min.z,
        }
    }
    
    pub fn diagonal(&self) -> f64 {
        self.size().length()
    }
    
    pub fn contains(&self, point: &Vec3) -> bool {
        point.x >= self.min.x && point.x <= self.max.x &&
        point.y >= self.min.y && point.y <= self.max.y &&
        point.z >= self.min.z && point.z <= self.max.z
    }
    
    pub fn intersects(&self, other: &AABB) -> bool {
        self.min.x <= other.max.x && self.max.x >= other.min.x &&
        self.min.y <= other.max.y && self.max.y >= other.min.y &&
        self.min.z <= other.max.z && self.max.z >= other.min.z
    }
    
    pub fn merge(&self, other: &AABB) -> AABB {
        AABB {
            min: Vec3 {
                x: self.min.x.min(other.min.x),
                y: self.min.y.min(other.min.y),
                z: self.min.z.min(other.min.z),
            },
            max: Vec3 {
                x: self.max.x.max(other.max.x),
                y: self.max.y.max(other.max.y),
                z: self.max.z.max(other.max.z),
            },
        }
    }
    
    pub fn expand(&self, margin: f64) -> AABB {
        AABB {
            min: Vec3 {
                x: self.min.x - margin,
                y: self.min.y - margin,
                z: self.min.z - margin,
            },
            max: Vec3 {
                x: self.max.x + margin,
                y: self.max.y + margin,
                z: self.max.z + margin,
            },
        }
    }
    
    /// Surface area for SAH (Surface Area Heuristic)
    pub fn surface_area(&self) -> f64 {
        let s = self.size();
        2.0 * (s.x * s.y + s.y * s.z + s.z * s.x)
    }
}

/// Frustum for view culling
#[derive(Debug, Clone)]
pub struct Frustum {
    pub planes: [Vec4; 6], // left, right, bottom, top, near, far
}

#[derive(Debug, Clone, Copy)]
pub struct Vec4 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub w: f64,
}

impl Frustum {
    /// Create frustum from view-projection matrix (column-major)
    pub fn from_matrix(m: &[f64; 16]) -> Self {
        let planes = [
            // Left
            Vec4 { x: m[3] + m[0], y: m[7] + m[4], z: m[11] + m[8], w: m[15] + m[12] },
            // Right
            Vec4 { x: m[3] - m[0], y: m[7] - m[4], z: m[11] - m[8], w: m[15] - m[12] },
            // Bottom
            Vec4 { x: m[3] + m[1], y: m[7] + m[5], z: m[11] + m[9], w: m[15] + m[13] },
            // Top
            Vec4 { x: m[3] - m[1], y: m[7] - m[5], z: m[11] - m[9], w: m[15] - m[13] },
            // Near
            Vec4 { x: m[3] + m[2], y: m[7] + m[6], z: m[11] + m[10], w: m[15] + m[14] },
            // Far
            Vec4 { x: m[3] - m[2], y: m[7] - m[6], z: m[11] - m[10], w: m[15] - m[14] },
        ];
        Self { planes }
    }
    
    /// Check if AABB is inside or intersects frustum
    pub fn contains_aabb(&self, aabb: &AABB) -> bool {
        for plane in &self.planes {
            let p = Vec3 {
                x: if plane.x > 0.0 { aabb.max.x } else { aabb.min.x },
                y: if plane.y > 0.0 { aabb.max.y } else { aabb.min.y },
                z: if plane.z > 0.0 { aabb.max.z } else { aabb.min.z },
            };
            
            if plane.x * p.x + plane.y * p.y + plane.z * p.z + plane.w < 0.0 {
                return false;
            }
        }
        true
    }
}

// ============================================================================
// MESH DATA STRUCTURES
// ============================================================================

/// Compact vertex format for memory efficiency
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CompactVertex {
    pub position: [f32; 3],
    pub normal: [i8; 3],     // Normalized to -127..127
    pub uv: [u16; 2],        // Normalized 0..65535
}

/// Triangle with vertex indices
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Triangle {
    pub indices: [u32; 3],
}

/// Optimized mesh structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedMesh {
    pub id: String,
    pub vertices: Vec<CompactVertex>,
    pub indices: Vec<u32>,
    pub bounds: AABB,
    pub lod_level: u8,
    pub triangle_count: u32,
    pub vertex_count: u32,
}

impl OptimizedMesh {
    pub fn new(id: String) -> Self {
        Self {
            id,
            vertices: Vec::new(),
            indices: Vec::new(),
            bounds: AABB::new(Vec3::zero(), Vec3::zero()),
            lod_level: 0,
            triangle_count: 0,
            vertex_count: 0,
        }
    }
    
    pub fn from_positions_indices(
        id: String,
        positions: &[[f64; 3]],
        normals: &[[f64; 3]],
        indices: &[u32],
    ) -> Self {
        let vertices: Vec<CompactVertex> = positions.iter().zip(normals.iter())
            .map(|(pos, norm)| CompactVertex {
                position: [pos[0] as f32, pos[1] as f32, pos[2] as f32],
                normal: [
                    (norm[0] * 127.0).clamp(-127.0, 127.0) as i8,
                    (norm[1] * 127.0).clamp(-127.0, 127.0) as i8,
                    (norm[2] * 127.0).clamp(-127.0, 127.0) as i8,
                ],
                uv: [0, 0],
            })
            .collect();
        
        let points: Vec<Vec3> = positions.iter()
            .map(|p| Vec3::new(p[0], p[1], p[2]))
            .collect();
        
        Self {
            id,
            bounds: AABB::from_points(&points),
            triangle_count: (indices.len() / 3) as u32,
            vertex_count: vertices.len() as u32,
            vertices,
            indices: indices.to_vec(),
            lod_level: 0,
        }
    }
    
    /// Memory footprint in bytes
    pub fn memory_size(&self) -> usize {
        self.vertices.len() * std::mem::size_of::<CompactVertex>() +
        self.indices.len() * std::mem::size_of::<u32>()
    }
}

// ============================================================================
// LEVEL OF DETAIL (LOD) SYSTEM
// ============================================================================

/// LOD configuration for automatic level selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LODConfig {
    /// Distance thresholds for each LOD level (in world units)
    pub distance_thresholds: Vec<f64>,
    /// Target triangle reduction ratio for each level (0.0-1.0)
    pub reduction_ratios: Vec<f64>,
    /// Screen-space error threshold (pixels)
    pub screen_error_threshold: f64,
    /// Enable smooth LOD transitions
    pub smooth_transitions: bool,
    /// Hysteresis factor to prevent LOD flickering
    pub hysteresis: f64,
}

impl Default for LODConfig {
    fn default() -> Self {
        Self {
            distance_thresholds: vec![50.0, 100.0, 200.0, 500.0, 1000.0],
            reduction_ratios: vec![1.0, 0.5, 0.25, 0.125, 0.0625],
            screen_error_threshold: 2.0,
            smooth_transitions: true,
            hysteresis: 0.1,
        }
    }
}

/// LOD chain for a single mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LODChain {
    pub base_mesh_id: String,
    pub lod_meshes: Vec<OptimizedMesh>,
    pub bounds: AABB,
    pub current_lod: u8,
    pub config: LODConfig,
}

impl LODChain {
    pub fn new(base_mesh: OptimizedMesh, config: LODConfig) -> Self {
        let bounds = base_mesh.bounds;
        let base_id = base_mesh.id.clone();
        
        Self {
            base_mesh_id: base_id,
            lod_meshes: vec![base_mesh],
            bounds,
            current_lod: 0,
            config,
        }
    }
    
    /// Select appropriate LOD based on distance
    pub fn select_lod(&mut self, camera_pos: &Vec3) -> u8 {
        let center = self.bounds.center();
        let distance = camera_pos.distance_to(&center);
        
        let mut new_lod = 0u8;
        for (i, threshold) in self.config.distance_thresholds.iter().enumerate() {
            if distance > *threshold {
                new_lod = (i + 1) as u8;
            }
        }
        
        // Apply hysteresis
        if new_lod != self.current_lod {
            let current_threshold = if self.current_lod == 0 {
                0.0
            } else {
                self.config.distance_thresholds[(self.current_lod - 1) as usize]
            };
            
            let hysteresis_range = current_threshold * self.config.hysteresis;
            
            if new_lod > self.current_lod {
                // Going to lower quality - add hysteresis
                let threshold_with_hysteresis = 
                    self.config.distance_thresholds[(new_lod - 1) as usize] + hysteresis_range;
                if distance > threshold_with_hysteresis {
                    self.current_lod = new_lod.min(self.lod_meshes.len() as u8 - 1);
                }
            } else {
                // Going to higher quality - subtract hysteresis
                let threshold_with_hysteresis = 
                    self.config.distance_thresholds[new_lod as usize] - hysteresis_range;
                if distance < threshold_with_hysteresis {
                    self.current_lod = new_lod;
                }
            }
        }
        
        self.current_lod
    }
    
    /// Get current LOD mesh
    pub fn get_current_mesh(&self) -> Option<&OptimizedMesh> {
        self.lod_meshes.get(self.current_lod as usize)
    }
    
    /// Calculate screen-space error for LOD selection
    pub fn screen_space_error(&self, camera_pos: &Vec3, screen_height: f64, fov: f64) -> f64 {
        let distance = camera_pos.distance_to(&self.bounds.center());
        let object_size = self.bounds.diagonal();
        
        // Project to screen space
        let projected_size = (object_size / distance) * (screen_height / (2.0 * (fov / 2.0).tan()));
        
        // Error based on current LOD reduction
        let reduction = if (self.current_lod as usize) < self.config.reduction_ratios.len() {
            self.config.reduction_ratios[self.current_lod as usize]
        } else {
            0.0625
        };
        
        projected_size * (1.0 - reduction)
    }
}

/// LOD Manager for entire scene
#[derive(Debug)]
pub struct LODManager {
    pub lod_chains: HashMap<String, LODChain>,
    pub global_config: LODConfig,
    pub max_triangles_per_frame: u32,
    pub current_triangle_budget: u32,
}

impl LODManager {
    pub fn new(config: LODConfig, max_triangles: u32) -> Self {
        Self {
            lod_chains: HashMap::new(),
            global_config: config,
            max_triangles_per_frame: max_triangles,
            current_triangle_budget: max_triangles,
        }
    }
    
    pub fn add_lod_chain(&mut self, chain: LODChain) {
        self.lod_chains.insert(chain.base_mesh_id.clone(), chain);
    }
    
    /// Update all LOD levels based on camera position
    pub fn update(&mut self, camera_pos: &Vec3) -> Vec<(String, u8)> {
        let mut updates = Vec::new();
        
        for (id, chain) in self.lod_chains.iter_mut() {
            let old_lod = chain.current_lod;
            let new_lod = chain.select_lod(camera_pos);
            
            if old_lod != new_lod {
                updates.push((id.clone(), new_lod));
            }
        }
        
        updates
    }
    
    /// Get total triangle count for current LOD state
    pub fn total_triangles(&self) -> u32 {
        self.lod_chains.values()
            .filter_map(|chain| chain.get_current_mesh())
            .map(|mesh| mesh.triangle_count)
            .sum()
    }
}

// ============================================================================
// MESH SIMPLIFICATION
// ============================================================================

/// Edge for mesh simplification
#[derive(Debug, Clone)]
struct Edge {
    v1: usize,
    v2: usize,
    cost: f64,
    collapse_target: Vec3,
}

/// Quadric Error Metrics for mesh simplification
#[derive(Debug, Clone)]
pub struct QuadricSimplifier {
    vertices: Vec<Vec3>,
    triangles: Vec<[usize; 3]>,
    quadrics: Vec<[[f64; 4]; 4]>,
    vertex_neighbors: Vec<Vec<usize>>,
}

impl QuadricSimplifier {
    pub fn new(positions: &[[f64; 3]], indices: &[u32]) -> Self {
        let vertices: Vec<Vec3> = positions.iter()
            .map(|p| Vec3::new(p[0], p[1], p[2]))
            .collect();
        
        let triangles: Vec<[usize; 3]> = indices.chunks(3)
            .map(|chunk| [chunk[0] as usize, chunk[1] as usize, chunk[2] as usize])
            .collect();
        
        let mut quadrics = vec![[[0.0_f64; 4]; 4]; vertices.len()];
        let mut vertex_neighbors: Vec<Vec<usize>> = vec![Vec::new(); vertices.len()];
        
        // Compute quadrics from triangle planes
        for tri in &triangles {
            let v0 = &vertices[tri[0]];
            let v1 = &vertices[tri[1]];
            let v2 = &vertices[tri[2]];
            
            // Plane equation: ax + by + cz + d = 0
            let edge1 = v1.sub(v0);
            let edge2 = v2.sub(v0);
            let normal = edge1.cross(&edge2).normalize();
            
            let a = normal.x;
            let b = normal.y;
            let c = normal.z;
            let d = -(a * v0.x + b * v0.y + c * v0.z);
            
            // Quadric matrix: p * p^T
            let q = [
                [a*a, a*b, a*c, a*d],
                [a*b, b*b, b*c, b*d],
                [a*c, b*c, c*c, c*d],
                [a*d, b*d, c*d, d*d],
            ];
            
            // Add to vertex quadrics
            for &vi in tri {
                for i in 0..4 {
                    for j in 0..4 {
                        quadrics[vi][i][j] += q[i][j];
                    }
                }
            }
            
            // Track neighbors
            for i in 0..3 {
                let vi = tri[i];
                for j in 0..3 {
                    if i != j {
                        let vj = tri[j];
                        if !vertex_neighbors[vi].contains(&vj) {
                            vertex_neighbors[vi].push(vj);
                        }
                    }
                }
            }
        }
        
        Self {
            vertices,
            triangles,
            quadrics,
            vertex_neighbors,
        }
    }
    
    /// Calculate cost of collapsing edge
    fn edge_collapse_cost(&self, v1: usize, v2: usize) -> (f64, Vec3) {
        // Combined quadric
        let mut q = [[0.0_f64; 4]; 4];
        for i in 0..4 {
            for j in 0..4 {
                q[i][j] = self.quadrics[v1][i][j] + self.quadrics[v2][i][j];
            }
        }
        
        // Try to find optimal position (simplified: use midpoint)
        let midpoint = self.vertices[v1].lerp(&self.vertices[v2], 0.5);
        
        // Calculate error at midpoint
        let v = [midpoint.x, midpoint.y, midpoint.z, 1.0];
        let mut error = 0.0;
        for i in 0..4 {
            for j in 0..4 {
                error += v[i] * q[i][j] * v[j];
            }
        }
        
        (error.abs(), midpoint)
    }
    
    /// Simplify mesh to target triangle count
    pub fn simplify(&mut self, target_triangles: usize) -> (Vec<[f64; 3]>, Vec<u32>) {
        let mut vertex_alive: Vec<bool> = vec![true; self.vertices.len()];
        let mut triangle_alive: Vec<bool> = vec![true; self.triangles.len()];
        let mut vertex_remap: Vec<usize> = (0..self.vertices.len()).collect();
        
        let current_triangles = self.triangles.len();
        let triangles_to_remove = current_triangles.saturating_sub(target_triangles);
        
        // Build edge heap
        let mut edges: Vec<Edge> = Vec::new();
        for v1 in 0..self.vertices.len() {
            for &v2 in &self.vertex_neighbors[v1] {
                if v1 < v2 {
                    let (cost, target) = self.edge_collapse_cost(v1, v2);
                    edges.push(Edge { v1, v2, cost, collapse_target: target });
                }
            }
        }
        
        // Sort by cost
        edges.sort_by(|a, b| a.cost.partial_cmp(&b.cost).unwrap_or(std::cmp::Ordering::Equal));
        
        // Collapse edges
        let mut removed = 0;
        for edge in edges {
            if removed >= triangles_to_remove {
                break;
            }
            
            let v1 = vertex_remap[edge.v1];
            let v2 = vertex_remap[edge.v2];
            
            if !vertex_alive[v1] || !vertex_alive[v2] || v1 == v2 {
                continue;
            }
            
            // Collapse v2 into v1
            self.vertices[v1] = edge.collapse_target;
            vertex_alive[v2] = false;
            
            // Update quadric
            for i in 0..4 {
                for j in 0..4 {
                    self.quadrics[v1][i][j] += self.quadrics[v2][i][j];
                }
            }
            
            // Remap all references to v2
            for i in 0..self.vertices.len() {
                if vertex_remap[i] == v2 {
                    vertex_remap[i] = v1;
                }
            }
            
            // Update triangles
            for (ti, tri) in self.triangles.iter().enumerate() {
                if !triangle_alive[ti] {
                    continue;
                }
                
                let remapped = [
                    vertex_remap[tri[0]],
                    vertex_remap[tri[1]],
                    vertex_remap[tri[2]],
                ];
                
                // Degenerate triangle check
                if remapped[0] == remapped[1] || remapped[1] == remapped[2] || remapped[2] == remapped[0] {
                    triangle_alive[ti] = false;
                    removed += 1;
                }
            }
        }
        
        // Build output
        let mut new_vertices: Vec<[f64; 3]> = Vec::new();
        let mut vertex_new_index: Vec<Option<usize>> = vec![None; self.vertices.len()];
        
        for (i, alive) in vertex_alive.iter().enumerate() {
            if *alive {
                vertex_new_index[i] = Some(new_vertices.len());
                let v = &self.vertices[i];
                new_vertices.push([v.x, v.y, v.z]);
            }
        }
        
        let mut new_indices: Vec<u32> = Vec::new();
        for (ti, tri) in self.triangles.iter().enumerate() {
            if !triangle_alive[ti] {
                continue;
            }
            
            let remapped = [
                vertex_remap[tri[0]],
                vertex_remap[tri[1]],
                vertex_remap[tri[2]],
            ];
            
            if let (Some(i0), Some(i1), Some(i2)) = (
                vertex_new_index[remapped[0]],
                vertex_new_index[remapped[1]],
                vertex_new_index[remapped[2]],
            ) {
                new_indices.push(i0 as u32);
                new_indices.push(i1 as u32);
                new_indices.push(i2 as u32);
            }
        }
        
        (new_vertices, new_indices)
    }
}

/// Generate LOD chain from base mesh
pub fn generate_lod_chain(
    base_positions: &[[f64; 3]],
    base_normals: &[[f64; 3]],
    base_indices: &[u32],
    mesh_id: &str,
    config: &LODConfig,
) -> LODChain {
    let base_mesh = OptimizedMesh::from_positions_indices(
        mesh_id.to_string(),
        base_positions,
        base_normals,
        base_indices,
    );
    
    let mut chain = LODChain::new(base_mesh, config.clone());
    let base_triangle_count = base_indices.len() / 3;
    
    // Generate lower LOD levels
    for (level, &ratio) in config.reduction_ratios.iter().enumerate().skip(1) {
        let target_triangles = ((base_triangle_count as f64) * ratio) as usize;
        
        if target_triangles < 4 {
            break;
        }
        
        let mut simplifier = QuadricSimplifier::new(base_positions, base_indices);
        let (simplified_positions, simplified_indices) = simplifier.simplify(target_triangles);
        
        // Recalculate normals for simplified mesh
        let simplified_normals = calculate_normals(&simplified_positions, &simplified_indices);
        
        let mut lod_mesh = OptimizedMesh::from_positions_indices(
            format!("{}_lod{}", mesh_id, level),
            &simplified_positions,
            &simplified_normals,
            &simplified_indices,
        );
        lod_mesh.lod_level = level as u8;
        
        chain.lod_meshes.push(lod_mesh);
    }
    
    chain
}

/// Calculate vertex normals from mesh
fn calculate_normals(positions: &[[f64; 3]], indices: &[u32]) -> Vec<[f64; 3]> {
    let mut normals = vec![[0.0_f64; 3]; positions.len()];
    
    for chunk in indices.chunks(3) {
        let i0 = chunk[0] as usize;
        let i1 = chunk[1] as usize;
        let i2 = chunk[2] as usize;
        
        let v0 = Vec3::new(positions[i0][0], positions[i0][1], positions[i0][2]);
        let v1 = Vec3::new(positions[i1][0], positions[i1][1], positions[i1][2]);
        let v2 = Vec3::new(positions[i2][0], positions[i2][1], positions[i2][2]);
        
        let edge1 = v1.sub(&v0);
        let edge2 = v2.sub(&v0);
        let face_normal = edge1.cross(&edge2);
        
        for &i in &[i0, i1, i2] {
            normals[i][0] += face_normal.x;
            normals[i][1] += face_normal.y;
            normals[i][2] += face_normal.z;
        }
    }
    
    // Normalize
    for normal in &mut normals {
        let len = (normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]).sqrt();
        if len > 1e-10 {
            normal[0] /= len;
            normal[1] /= len;
            normal[2] /= len;
        }
    }
    
    normals
}

// ============================================================================
// OCTREE SPATIAL PARTITIONING
// ============================================================================

/// Octree node for spatial queries
#[derive(Debug)]
pub struct OctreeNode {
    pub bounds: AABB,
    pub depth: u8,
    pub children: Option<Box<[OctreeNode; 8]>>,
    pub objects: Vec<u32>, // Object indices
}

impl OctreeNode {
    pub fn new(bounds: AABB, depth: u8) -> Self {
        Self {
            bounds,
            depth,
            children: None,
            objects: Vec::new(),
        }
    }
    
    /// Subdivide node into 8 children
    pub fn subdivide(&mut self) {
        let center = self.bounds.center();
        let min = self.bounds.min;
        let max = self.bounds.max;
        
        let children = [
            OctreeNode::new(AABB::new(min, center), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(center.x, min.y, min.z), Vec3::new(max.x, center.y, center.z)), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(min.x, center.y, min.z), Vec3::new(center.x, max.y, center.z)), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(center.x, center.y, min.z), Vec3::new(max.x, max.y, center.z)), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(min.x, min.y, center.z), Vec3::new(center.x, center.y, max.z)), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(center.x, min.y, center.z), Vec3::new(max.x, center.y, max.z)), self.depth + 1),
            OctreeNode::new(AABB::new(Vec3::new(min.x, center.y, center.z), Vec3::new(center.x, max.y, max.z)), self.depth + 1),
            OctreeNode::new(AABB::new(center, max), self.depth + 1),
        ];
        
        self.children = Some(Box::new(children));
    }
    
    /// Get child index for a point
    fn child_index(&self, point: &Vec3) -> usize {
        let center = self.bounds.center();
        let mut index = 0;
        if point.x >= center.x { index |= 1; }
        if point.y >= center.y { index |= 2; }
        if point.z >= center.z { index |= 4; }
        index
    }
}

/// Octree for efficient spatial queries
#[derive(Debug)]
pub struct Octree {
    pub root: OctreeNode,
    pub max_depth: u8,
    pub max_objects_per_node: usize,
    pub object_bounds: Vec<AABB>,
}

impl Octree {
    pub fn new(bounds: AABB, max_depth: u8, max_objects_per_node: usize) -> Self {
        Self {
            root: OctreeNode::new(bounds, 0),
            max_depth,
            max_objects_per_node,
            object_bounds: Vec::new(),
        }
    }
    
    /// Build octree from object bounds
    pub fn build(bounds: &[AABB], max_depth: u8, max_objects: usize) -> Self {
        let world_bounds = bounds.iter().fold(
            AABB::new(Vec3::new(f64::MAX, f64::MAX, f64::MAX), Vec3::new(f64::MIN, f64::MIN, f64::MIN)),
            |acc, b| acc.merge(b)
        ).expand(1.0);
        
        let mut octree = Self::new(world_bounds, max_depth, max_objects);
        octree.object_bounds = bounds.to_vec();
        
        for (i, aabb) in bounds.iter().enumerate() {
            octree.insert(i as u32, aabb);
        }
        
        octree
    }
    
    /// Insert object into octree
    pub fn insert(&mut self, object_id: u32, bounds: &AABB) {
        Self::insert_recursive(&mut self.root, object_id, bounds, self.max_depth, self.max_objects_per_node);
    }
    
    fn insert_recursive(
        node: &mut OctreeNode,
        object_id: u32,
        bounds: &AABB,
        max_depth: u8,
        max_objects: usize,
    ) {
        if !node.bounds.intersects(bounds) {
            return;
        }
        
        if node.children.is_none() {
            node.objects.push(object_id);
            
            // Subdivide if needed
            if node.objects.len() > max_objects && node.depth < max_depth {
                node.subdivide();
                
                // Redistribute objects
                let objects = std::mem::take(&mut node.objects);
                if let Some(ref mut children) = node.children {
                    for obj_id in objects {
                        // Simplified: add to all intersecting children
                        for child in children.iter_mut() {
                            if child.bounds.intersects(bounds) {
                                child.objects.push(obj_id);
                            }
                        }
                    }
                }
            }
        } else if let Some(ref mut children) = node.children {
            for child in children.iter_mut() {
                Self::insert_recursive(child, object_id, bounds, max_depth, max_objects);
            }
        }
    }
    
    /// Query objects intersecting with given bounds
    pub fn query(&self, query_bounds: &AABB) -> Vec<u32> {
        let mut results = Vec::new();
        Self::query_recursive(&self.root, query_bounds, &mut results);
        results.sort_unstable();
        results.dedup();
        results
    }
    
    fn query_recursive(node: &OctreeNode, query_bounds: &AABB, results: &mut Vec<u32>) {
        if !node.bounds.intersects(query_bounds) {
            return;
        }
        
        results.extend(&node.objects);
        
        if let Some(ref children) = node.children {
            for child in children.iter() {
                Self::query_recursive(child, query_bounds, results);
            }
        }
    }
    
    /// Query objects visible in frustum
    pub fn query_frustum(&self, frustum: &Frustum) -> Vec<u32> {
        let mut results = Vec::new();
        Self::query_frustum_recursive(&self.root, frustum, &mut results);
        results.sort_unstable();
        results.dedup();
        results
    }
    
    fn query_frustum_recursive(node: &OctreeNode, frustum: &Frustum, results: &mut Vec<u32>) {
        if !frustum.contains_aabb(&node.bounds) {
            return;
        }
        
        results.extend(&node.objects);
        
        if let Some(ref children) = node.children {
            for child in children.iter() {
                Self::query_frustum_recursive(child, frustum, results);
            }
        }
    }
    
    /// Get statistics
    pub fn stats(&self) -> OctreeStats {
        let mut stats = OctreeStats::default();
        Self::collect_stats(&self.root, &mut stats);
        stats
    }
    
    fn collect_stats(node: &OctreeNode, stats: &mut OctreeStats) {
        stats.total_nodes += 1;
        stats.total_objects += node.objects.len();
        stats.max_depth = stats.max_depth.max(node.depth);
        
        if node.children.is_none() {
            stats.leaf_nodes += 1;
        } else if let Some(ref children) = node.children {
            for child in children.iter() {
                Self::collect_stats(child, stats);
            }
        }
    }
}

#[derive(Debug, Default)]
pub struct OctreeStats {
    pub total_nodes: usize,
    pub leaf_nodes: usize,
    pub total_objects: usize,
    pub max_depth: u8,
}

// ============================================================================
// INSTANCED RENDERING
// ============================================================================

/// Instance data for GPU instancing
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct InstanceData {
    pub transform: [[f32; 4]; 4], // 4x4 transformation matrix
    pub color: [f32; 4],          // RGBA color/tint
    pub custom: [f32; 4],         // Custom per-instance data
}

impl Default for InstanceData {
    fn default() -> Self {
        Self {
            transform: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            color: [1.0, 1.0, 1.0, 1.0],
            custom: [0.0; 4],
        }
    }
}

impl InstanceData {
    pub fn from_position(x: f64, y: f64, z: f64) -> Self {
        Self {
            transform: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [x as f32, y as f32, z as f32, 1.0],
            ],
            ..Default::default()
        }
    }
    
    pub fn with_scale(mut self, sx: f64, sy: f64, sz: f64) -> Self {
        self.transform[0][0] *= sx as f32;
        self.transform[1][1] *= sy as f32;
        self.transform[2][2] *= sz as f32;
        self
    }
    
    pub fn with_rotation_y(mut self, angle_rad: f64) -> Self {
        let c = angle_rad.cos() as f32;
        let s = angle_rad.sin() as f32;
        
        let m00 = self.transform[0][0];
        let m20 = self.transform[2][0];
        
        self.transform[0][0] = c * m00 + s * m20;
        self.transform[2][0] = -s * m00 + c * m20;
        
        self
    }
    
    pub fn with_color(mut self, r: f32, g: f32, b: f32, a: f32) -> Self {
        self.color = [r, g, b, a];
        self
    }
}

/// Instance group for batched rendering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceGroup {
    pub mesh_id: String,
    pub instances: Vec<InstanceData>,
    pub bounds: AABB,
    pub visible_count: u32,
}

impl InstanceGroup {
    pub fn new(mesh_id: String) -> Self {
        Self {
            mesh_id,
            instances: Vec::new(),
            bounds: AABB::new(Vec3::zero(), Vec3::zero()),
            visible_count: 0,
        }
    }
    
    pub fn add_instance(&mut self, instance: InstanceData, mesh_bounds: &AABB) {
        // Transform mesh bounds by instance transform
        let tx = instance.transform[3][0] as f64;
        let ty = instance.transform[3][1] as f64;
        let tz = instance.transform[3][2] as f64;
        let sx = instance.transform[0][0] as f64;
        let sy = instance.transform[1][1] as f64;
        let sz = instance.transform[2][2] as f64;
        
        let instance_bounds = AABB::new(
            Vec3::new(
                mesh_bounds.min.x * sx + tx,
                mesh_bounds.min.y * sy + ty,
                mesh_bounds.min.z * sz + tz,
            ),
            Vec3::new(
                mesh_bounds.max.x * sx + tx,
                mesh_bounds.max.y * sy + ty,
                mesh_bounds.max.z * sz + tz,
            ),
        );
        
        if self.instances.is_empty() {
            self.bounds = instance_bounds;
        } else {
            self.bounds = self.bounds.merge(&instance_bounds);
        }
        
        self.instances.push(instance);
        self.visible_count = self.instances.len() as u32;
    }
    
    /// Cull instances against frustum
    pub fn cull(&mut self, frustum: &Frustum, mesh_bounds: &AABB) -> u32 {
        self.visible_count = 0;
        
        for instance in &self.instances {
            let tx = instance.transform[3][0] as f64;
            let ty = instance.transform[3][1] as f64;
            let tz = instance.transform[3][2] as f64;
            
            let instance_bounds = AABB::new(
                Vec3::new(
                    mesh_bounds.min.x + tx,
                    mesh_bounds.min.y + ty,
                    mesh_bounds.min.z + tz,
                ),
                Vec3::new(
                    mesh_bounds.max.x + tx,
                    mesh_bounds.max.y + ty,
                    mesh_bounds.max.z + tz,
                ),
            );
            
            if frustum.contains_aabb(&instance_bounds) {
                self.visible_count += 1;
            }
        }
        
        self.visible_count
    }
    
    /// Memory footprint
    pub fn memory_size(&self) -> usize {
        self.instances.len() * std::mem::size_of::<InstanceData>()
    }
}

// ============================================================================
// PROGRESSIVE STREAMING
// ============================================================================

/// Streaming priority for progressive loading
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum StreamingPriority {
    Critical = 0,  // Must load immediately
    High = 1,      // Load soon
    Medium = 2,    // Load when bandwidth available
    Low = 3,       // Background loading
    Idle = 4,      // Load when idle
}

/// Streaming chunk for progressive loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingChunk {
    pub id: String,
    pub bounds: AABB,
    pub lod_level: u8,
    pub data_size: usize,
    pub loaded: bool,
    pub priority: u8,
    pub last_access: u64,
}

/// Streaming manager for progressive content loading
#[derive(Debug)]
pub struct StreamingManager {
    pub chunks: HashMap<String, StreamingChunk>,
    pub memory_budget: usize,
    pub current_memory: usize,
    pub pending_loads: Vec<String>,
    pub pending_unloads: Vec<String>,
    pub frame_counter: u64,
}

impl StreamingManager {
    pub fn new(memory_budget_mb: usize) -> Self {
        Self {
            chunks: HashMap::new(),
            memory_budget: memory_budget_mb * 1024 * 1024,
            current_memory: 0,
            pending_loads: Vec::new(),
            pending_unloads: Vec::new(),
            frame_counter: 0,
        }
    }
    
    /// Register a streamable chunk
    pub fn register_chunk(&mut self, chunk: StreamingChunk) {
        self.chunks.insert(chunk.id.clone(), chunk);
    }
    
    /// Update streaming based on camera position
    pub fn update(&mut self, camera_pos: &Vec3, view_distance: f64) {
        self.frame_counter += 1;
        self.pending_loads.clear();
        self.pending_unloads.clear();
        
        let mut chunks_to_update: Vec<(String, f64, bool)> = Vec::new();
        
        for (id, chunk) in &self.chunks {
            let distance = camera_pos.distance_to(&chunk.bounds.center());
            let should_be_loaded = distance < view_distance;
            chunks_to_update.push((id.clone(), distance, should_be_loaded));
        }
        
        // Sort by distance
        chunks_to_update.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        
        for (id, distance, should_load) in chunks_to_update {
            if let Some(chunk) = self.chunks.get_mut(&id) {
                // Calculate priority
                let priority = if distance < view_distance * 0.25 {
                    StreamingPriority::Critical
                } else if distance < view_distance * 0.5 {
                    StreamingPriority::High
                } else if distance < view_distance * 0.75 {
                    StreamingPriority::Medium
                } else if distance < view_distance {
                    StreamingPriority::Low
                } else {
                    StreamingPriority::Idle
                };
                
                chunk.priority = priority as u8;
                
                if should_load && !chunk.loaded {
                    if self.current_memory + chunk.data_size <= self.memory_budget {
                        self.pending_loads.push(id.clone());
                    }
                } else if !should_load && chunk.loaded {
                    // Mark for unload if memory pressure
                    if self.current_memory > self.memory_budget * 80 / 100 {
                        self.pending_unloads.push(id.clone());
                    }
                }
                
                if chunk.loaded {
                    chunk.last_access = self.frame_counter;
                }
            }
        }
        
        // Process unloads first to free memory
        for id in &self.pending_unloads {
            if let Some(chunk) = self.chunks.get_mut(id) {
                chunk.loaded = false;
                self.current_memory = self.current_memory.saturating_sub(chunk.data_size);
            }
        }
        
        // Process loads
        for id in &self.pending_loads {
            if let Some(chunk) = self.chunks.get_mut(id) {
                if self.current_memory + chunk.data_size <= self.memory_budget {
                    chunk.loaded = true;
                    self.current_memory += chunk.data_size;
                }
            }
        }
    }
    
    /// Get chunks that need to be loaded
    pub fn get_pending_loads(&self) -> &[String] {
        &self.pending_loads
    }
    
    /// Get chunks that can be unloaded
    pub fn get_pending_unloads(&self) -> &[String] {
        &self.pending_unloads
    }
    
    /// Get memory usage statistics
    pub fn memory_stats(&self) -> StreamingStats {
        let loaded_count = self.chunks.values().filter(|c| c.loaded).count();
        StreamingStats {
            total_chunks: self.chunks.len(),
            loaded_chunks: loaded_count,
            memory_used: self.current_memory,
            memory_budget: self.memory_budget,
            utilization: (self.current_memory as f64 / self.memory_budget as f64) * 100.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingStats {
    pub total_chunks: usize,
    pub loaded_chunks: usize,
    pub memory_used: usize,
    pub memory_budget: usize,
    pub utilization: f64,
}

// ============================================================================
// GEOMETRY COMPRESSION
// ============================================================================

/// Compressed mesh format for reduced memory/bandwidth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompressedMesh {
    pub id: String,
    /// Quantized positions (relative to bounds)
    pub positions: Vec<[u16; 3]>,
    /// Quantized normals (octahedral encoding)
    pub normals: Vec<[i8; 2]>,
    /// Delta-encoded indices
    pub indices: Vec<i32>,
    /// Bounding box for dequantization
    pub bounds: AABB,
    /// Original vertex count
    pub vertex_count: u32,
    /// Original triangle count  
    pub triangle_count: u32,
}

impl CompressedMesh {
    /// Compress mesh from standard format
    pub fn compress(
        id: String,
        positions: &[[f64; 3]],
        normals: &[[f64; 3]],
        indices: &[u32],
    ) -> Self {
        let bounds = AABB::from_points(
            &positions.iter().map(|p| Vec3::new(p[0], p[1], p[2])).collect::<Vec<_>>()
        );
        
        let size = bounds.size();
        
        // Quantize positions to 16-bit
        let compressed_positions: Vec<[u16; 3]> = positions.iter()
            .map(|p| {
                [
                    Self::quantize_coord(p[0], bounds.min.x, size.x),
                    Self::quantize_coord(p[1], bounds.min.y, size.y),
                    Self::quantize_coord(p[2], bounds.min.z, size.z),
                ]
            })
            .collect();
        
        // Encode normals using octahedral mapping
        let compressed_normals: Vec<[i8; 2]> = normals.iter()
            .map(|n| Self::octahedral_encode(n))
            .collect();
        
        // Delta encode indices
        let compressed_indices: Vec<i32> = Self::delta_encode_indices(indices);
        
        Self {
            id,
            positions: compressed_positions,
            normals: compressed_normals,
            indices: compressed_indices,
            bounds,
            vertex_count: positions.len() as u32,
            triangle_count: (indices.len() / 3) as u32,
        }
    }
    
    /// Decompress to standard format
    pub fn decompress(&self) -> (Vec<[f64; 3]>, Vec<[f64; 3]>, Vec<u32>) {
        let size = self.bounds.size();
        
        // Dequantize positions
        let positions: Vec<[f64; 3]> = self.positions.iter()
            .map(|p| {
                [
                    Self::dequantize_coord(p[0], self.bounds.min.x, size.x),
                    Self::dequantize_coord(p[1], self.bounds.min.y, size.y),
                    Self::dequantize_coord(p[2], self.bounds.min.z, size.z),
                ]
            })
            .collect();
        
        // Decode normals
        let normals: Vec<[f64; 3]> = self.normals.iter()
            .map(|n| Self::octahedral_decode(n))
            .collect();
        
        // Delta decode indices
        let indices = Self::delta_decode_indices(&self.indices);
        
        (positions, normals, indices)
    }
    
    fn quantize_coord(value: f64, min: f64, range: f64) -> u16 {
        if range < 1e-10 {
            return 0;
        }
        let normalized = (value - min) / range;
        (normalized.clamp(0.0, 1.0) * 65535.0) as u16
    }
    
    fn dequantize_coord(quantized: u16, min: f64, range: f64) -> f64 {
        min + (quantized as f64 / 65535.0) * range
    }
    
    /// Octahedral normal encoding (maps 3D unit vector to 2D)
    fn octahedral_encode(n: &[f64; 3]) -> [i8; 2] {
        let sum = n[0].abs() + n[1].abs() + n[2].abs();
        let mut oct = [n[0] / sum, n[1] / sum];
        
        if n[2] < 0.0 {
            let x = oct[0];
            let y = oct[1];
            oct[0] = (1.0 - y.abs()) * if x >= 0.0 { 1.0 } else { -1.0 };
            oct[1] = (1.0 - x.abs()) * if y >= 0.0 { 1.0 } else { -1.0 };
        }
        
        [
            (oct[0].clamp(-1.0, 1.0) * 127.0) as i8,
            (oct[1].clamp(-1.0, 1.0) * 127.0) as i8,
        ]
    }
    
    /// Octahedral normal decoding
    fn octahedral_decode(oct: &[i8; 2]) -> [f64; 3] {
        let x = oct[0] as f64 / 127.0;
        let y = oct[1] as f64 / 127.0;
        let z = 1.0 - x.abs() - y.abs();
        
        let (x, y) = if z < 0.0 {
            let x_new = (1.0 - y.abs()) * if x >= 0.0 { 1.0 } else { -1.0 };
            let y_new = (1.0 - x.abs()) * if y >= 0.0 { 1.0 } else { -1.0 };
            (x_new, y_new)
        } else {
            (x, y)
        };
        
        let len = (x * x + y * y + z * z).sqrt();
        [x / len, y / len, z / len]
    }
    
    /// Delta encode indices for better compression
    fn delta_encode_indices(indices: &[u32]) -> Vec<i32> {
        let mut result = Vec::with_capacity(indices.len());
        let mut prev = 0i64;
        
        for &idx in indices {
            let delta = idx as i64 - prev;
            result.push(delta as i32);
            prev = idx as i64;
        }
        
        result
    }
    
    /// Delta decode indices
    fn delta_decode_indices(deltas: &[i32]) -> Vec<u32> {
        let mut result = Vec::with_capacity(deltas.len());
        let mut current = 0i64;
        
        for &delta in deltas {
            current += delta as i64;
            result.push(current as u32);
        }
        
        result
    }
    
    /// Compression ratio
    pub fn compression_ratio(&self) -> f64 {
        let original_size = self.vertex_count as usize * (3 * 8 + 3 * 8) // positions + normals (f64)
            + self.triangle_count as usize * 3 * 4; // indices (u32)
        
        let compressed_size = self.positions.len() * 6  // u16 * 3
            + self.normals.len() * 2                   // i8 * 2
            + self.indices.len() * 4;                  // i32
        
        original_size as f64 / compressed_size as f64
    }
    
    /// Memory size in bytes
    pub fn memory_size(&self) -> usize {
        self.positions.len() * 6 + self.normals.len() * 2 + self.indices.len() * 4
    }
}

// ============================================================================
// STRUCTURAL ELEMENT PRIMITIVES (Optimized Generation)
// ============================================================================

/// Generate optimized beam mesh with configurable LOD
pub fn generate_beam_mesh(
    start: Vec3,
    end: Vec3,
    width: f64,
    height: f64,
    segments: u8,
) -> OptimizedMesh {
    let direction = end.sub(&start).normalize();
    let length = start.distance_to(&end);
    
    // Create local coordinate system
    let up = if direction.y.abs() < 0.99 {
        Vec3::new(0.0, 1.0, 0.0)
    } else {
        Vec3::new(1.0, 0.0, 0.0)
    };
    
    let right = direction.cross(&up).normalize();
    let up = right.cross(&direction).normalize();
    
    let hw = width / 2.0;
    let hh = height / 2.0;
    
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut indices = Vec::new();
    
    let seg_length = length / segments as f64;
    
    // Generate vertices along beam
    for i in 0..=segments {
        let t = i as f64 / segments as f64;
        let center = start.lerp(&end, t);
        
        // Four corners at this section
        let corners = [
            center.add(&right.scale(-hw)).add(&up.scale(-hh)),
            center.add(&right.scale(hw)).add(&up.scale(-hh)),
            center.add(&right.scale(hw)).add(&up.scale(hh)),
            center.add(&right.scale(-hw)).add(&up.scale(hh)),
        ];
        
        for corner in corners {
            positions.push([corner.x, corner.y, corner.z]);
        }
    }
    
    // Generate faces
    for i in 0..segments as u32 {
        let base = i * 4;
        
        // Bottom face
        indices.extend_from_slice(&[base, base + 4, base + 5, base, base + 5, base + 1]);
        // Right face  
        indices.extend_from_slice(&[base + 1, base + 5, base + 6, base + 1, base + 6, base + 2]);
        // Top face
        indices.extend_from_slice(&[base + 2, base + 6, base + 7, base + 2, base + 7, base + 3]);
        // Left face
        indices.extend_from_slice(&[base + 3, base + 7, base + 4, base + 3, base + 4, base]);
    }
    
    // End caps
    indices.extend_from_slice(&[0, 2, 1, 0, 3, 2]); // Start cap
    let end_base = segments as u32 * 4;
    indices.extend_from_slice(&[end_base, end_base + 1, end_base + 2, end_base, end_base + 2, end_base + 3]); // End cap
    
    // Calculate normals
    normals = calculate_normals(&positions, &indices);
    
    OptimizedMesh::from_positions_indices(
        format!("beam_{}seg", segments),
        &positions,
        &normals,
        &indices,
    )
}

/// Generate optimized column mesh
pub fn generate_column_mesh(
    base: Vec3,
    top: Vec3,
    radius: f64,
    sides: u8,
) -> OptimizedMesh {
    let height = base.distance_to(&top);
    let direction = top.sub(&base).normalize();
    
    let mut positions = Vec::new();
    let mut indices = Vec::new();
    
    let angle_step = 2.0 * PI / sides as f64;
    
    // Find perpendicular vectors
    let up = if direction.y.abs() < 0.99 {
        Vec3::new(0.0, 1.0, 0.0)
    } else {
        Vec3::new(1.0, 0.0, 0.0)
    };
    let perp1 = direction.cross(&up).normalize();
    let perp2 = direction.cross(&perp1).normalize();
    
    // Bottom ring
    for i in 0..sides {
        let angle = i as f64 * angle_step;
        let offset = perp1.scale(angle.cos() * radius).add(&perp2.scale(angle.sin() * radius));
        let pos = base.add(&offset);
        positions.push([pos.x, pos.y, pos.z]);
    }
    
    // Top ring
    for i in 0..sides {
        let angle = i as f64 * angle_step;
        let offset = perp1.scale(angle.cos() * radius).add(&perp2.scale(angle.sin() * radius));
        let pos = top.add(&offset);
        positions.push([pos.x, pos.y, pos.z]);
    }
    
    // Center points for caps
    positions.push([base.x, base.y, base.z]); // Bottom center
    positions.push([top.x, top.y, top.z]);     // Top center
    
    let bottom_center = (sides * 2) as u32;
    let top_center = bottom_center + 1;
    
    // Side faces
    for i in 0..sides as u32 {
        let next = (i + 1) % sides as u32;
        
        indices.extend_from_slice(&[
            i, next, sides as u32 + next,
            i, sides as u32 + next, sides as u32 + i,
        ]);
    }
    
    // Bottom cap
    for i in 0..sides as u32 {
        let next = (i + 1) % sides as u32;
        indices.extend_from_slice(&[bottom_center, next, i]);
    }
    
    // Top cap
    for i in 0..sides as u32 {
        let next = (i + 1) % sides as u32;
        indices.extend_from_slice(&[top_center, sides as u32 + i, sides as u32 + next]);
    }
    
    let normals = calculate_normals(&positions, &indices);
    
    OptimizedMesh::from_positions_indices(
        format!("column_{}sides", sides),
        &positions,
        &normals,
        &indices,
    )
}

/// Generate slab mesh with optimized triangle count
pub fn generate_slab_mesh(
    center: Vec3,
    width: f64,
    depth: f64,
    thickness: f64,
    subdivisions: u8,
) -> OptimizedMesh {
    let hw = width / 2.0;
    let hd = depth / 2.0;
    let ht = thickness / 2.0;
    
    let mut positions = Vec::new();
    let mut indices = Vec::new();
    
    let step_x = width / subdivisions as f64;
    let step_z = depth / subdivisions as f64;
    
    // Top face vertices
    for iz in 0..=subdivisions {
        for ix in 0..=subdivisions {
            let x = center.x - hw + ix as f64 * step_x;
            let z = center.z - hd + iz as f64 * step_z;
            positions.push([x, center.y + ht, z]);
        }
    }
    
    // Bottom face vertices
    let bottom_start = positions.len();
    for iz in 0..=subdivisions {
        for ix in 0..=subdivisions {
            let x = center.x - hw + ix as f64 * step_x;
            let z = center.z - hd + iz as f64 * step_z;
            positions.push([x, center.y - ht, z]);
        }
    }
    
    let stride = (subdivisions + 1) as u32;
    
    // Top face triangles
    for iz in 0..subdivisions as u32 {
        for ix in 0..subdivisions as u32 {
            let i00 = iz * stride + ix;
            let i10 = i00 + 1;
            let i01 = i00 + stride;
            let i11 = i01 + 1;
            
            indices.extend_from_slice(&[i00, i01, i11, i00, i11, i10]);
        }
    }
    
    // Bottom face triangles (reversed winding)
    let offset = bottom_start as u32;
    for iz in 0..subdivisions as u32 {
        for ix in 0..subdivisions as u32 {
            let i00 = offset + iz * stride + ix;
            let i10 = i00 + 1;
            let i01 = i00 + stride;
            let i11 = i01 + 1;
            
            indices.extend_from_slice(&[i00, i10, i11, i00, i11, i01]);
        }
    }
    
    // Side faces (simplified - just 4 quads)
    let top_corners = [
        0_u32,
        subdivisions as u32,
        stride * subdivisions as u32 + subdivisions as u32,
        stride * subdivisions as u32,
    ];
    let bottom_corners = [
        offset,
        offset + subdivisions as u32,
        offset + stride * subdivisions as u32 + subdivisions as u32,
        offset + stride * subdivisions as u32,
    ];
    
    for i in 0..4 {
        let next = (i + 1) % 4;
        indices.extend_from_slice(&[
            top_corners[i], bottom_corners[i], bottom_corners[next],
            top_corners[i], bottom_corners[next], top_corners[next],
        ]);
    }
    
    let normals = calculate_normals(&positions, &indices);
    
    OptimizedMesh::from_positions_indices(
        format!("slab_{}subdiv", subdivisions),
        &positions,
        &normals,
        &indices,
    )
}

// ============================================================================
// RENDER BATCH OPTIMIZER
// ============================================================================

/// Render batch for draw call minimization
#[derive(Debug, Clone)]
pub struct RenderBatch {
    pub mesh_id: String,
    pub material_id: String,
    pub instances: Vec<InstanceData>,
    pub triangle_count: u32,
    pub draw_call_count: u32,
}

/// Batch optimizer for minimizing draw calls
#[derive(Debug)]
pub struct BatchOptimizer {
    batches: HashMap<String, RenderBatch>,
    max_instances_per_batch: usize,
}

impl BatchOptimizer {
    pub fn new(max_instances: usize) -> Self {
        Self {
            batches: HashMap::new(),
            max_instances_per_batch: max_instances,
        }
    }
    
    /// Add instance to appropriate batch
    pub fn add_instance(&mut self, mesh_id: &str, material_id: &str, instance: InstanceData, triangles: u32) {
        let key = format!("{}_{}", mesh_id, material_id);
        
        let batch = self.batches.entry(key.clone()).or_insert_with(|| RenderBatch {
            mesh_id: mesh_id.to_string(),
            material_id: material_id.to_string(),
            instances: Vec::new(),
            triangle_count: triangles,
            draw_call_count: 1,
        });
        
        batch.instances.push(instance);
        
        // Split batch if too large
        if batch.instances.len() > self.max_instances_per_batch {
            batch.draw_call_count = (batch.instances.len() / self.max_instances_per_batch + 1) as u32;
        }
    }
    
    /// Get optimized batches for rendering
    pub fn get_batches(&self) -> Vec<&RenderBatch> {
        self.batches.values().collect()
    }
    
    /// Get total draw calls
    pub fn total_draw_calls(&self) -> u32 {
        self.batches.values().map(|b| b.draw_call_count).sum()
    }
    
    /// Get total triangles
    pub fn total_triangles(&self) -> u64 {
        self.batches.values()
            .map(|b| b.triangle_count as u64 * b.instances.len() as u64)
            .sum()
    }
    
    /// Clear all batches
    pub fn clear(&mut self) {
        self.batches.clear();
    }
    
    /// Get rendering statistics
    pub fn stats(&self) -> BatchStats {
        BatchStats {
            total_batches: self.batches.len(),
            total_instances: self.batches.values().map(|b| b.instances.len()).sum(),
            total_draw_calls: self.total_draw_calls(),
            total_triangles: self.total_triangles(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchStats {
    pub total_batches: usize,
    pub total_instances: usize,
    pub total_draw_calls: u32,
    pub total_triangles: u64,
}

// ============================================================================
// SCENE OPTIMIZATION MANAGER
// ============================================================================

/// Complete scene optimization manager
#[derive(Debug)]
pub struct SceneOptimizer {
    pub lod_manager: LODManager,
    pub octree: Option<Octree>,
    pub streaming_manager: StreamingManager,
    pub batch_optimizer: BatchOptimizer,
    pub meshes: HashMap<String, OptimizedMesh>,
    pub compressed_meshes: HashMap<String, CompressedMesh>,
    pub instance_groups: HashMap<String, InstanceGroup>,
}

impl SceneOptimizer {
    pub fn new(memory_budget_mb: usize, max_triangles: u32) -> Self {
        Self {
            lod_manager: LODManager::new(LODConfig::default(), max_triangles),
            octree: None,
            streaming_manager: StreamingManager::new(memory_budget_mb),
            batch_optimizer: BatchOptimizer::new(1000),
            meshes: HashMap::new(),
            compressed_meshes: HashMap::new(),
            instance_groups: HashMap::new(),
        }
    }
    
    /// Add mesh to scene
    pub fn add_mesh(&mut self, mesh: OptimizedMesh) {
        self.meshes.insert(mesh.id.clone(), mesh);
    }
    
    /// Add LOD chain
    pub fn add_lod_chain(&mut self, chain: LODChain) {
        self.lod_manager.add_lod_chain(chain);
    }
    
    /// Add instance group
    pub fn add_instance_group(&mut self, group: InstanceGroup) {
        self.instance_groups.insert(group.mesh_id.clone(), group);
    }
    
    /// Build spatial index from all objects
    pub fn build_spatial_index(&mut self) {
        let bounds: Vec<AABB> = self.meshes.values()
            .map(|m| m.bounds)
            .chain(self.instance_groups.values().map(|g| g.bounds))
            .collect();
        
        if !bounds.is_empty() {
            self.octree = Some(Octree::build(&bounds, 8, 16));
        }
    }
    
    /// Update scene for current frame
    pub fn update(&mut self, camera_pos: &Vec3, frustum: &Frustum, view_distance: f64) {
        // Update LODs
        self.lod_manager.update(camera_pos);
        
        // Update streaming
        self.streaming_manager.update(camera_pos, view_distance);
        
        // Cull instances
        for (mesh_id, group) in self.instance_groups.iter_mut() {
            if let Some(mesh) = self.meshes.get(mesh_id) {
                group.cull(frustum, &mesh.bounds);
            }
        }
        
        // Rebuild batches
        self.batch_optimizer.clear();
        
        for (mesh_id, group) in &self.instance_groups {
            if let Some(mesh) = self.meshes.get(mesh_id) {
                for instance in &group.instances {
                    self.batch_optimizer.add_instance(
                        mesh_id,
                        "default",
                        *instance,
                        mesh.triangle_count,
                    );
                }
            }
        }
    }
    
    /// Get rendering statistics
    pub fn stats(&self) -> SceneStats {
        SceneStats {
            total_meshes: self.meshes.len(),
            total_triangles: self.lod_manager.total_triangles(),
            total_instances: self.instance_groups.values().map(|g| g.instances.len()).sum(),
            batch_stats: self.batch_optimizer.stats(),
            streaming_stats: self.streaming_manager.memory_stats(),
            octree_stats: self.octree.as_ref().map(|o| o.stats()),
        }
    }
}

#[derive(Debug)]
pub struct SceneStats {
    pub total_meshes: usize,
    pub total_triangles: u32,
    pub total_instances: usize,
    pub batch_stats: BatchStats,
    pub streaming_stats: StreamingStats,
    pub octree_stats: Option<OctreeStats>,
}
