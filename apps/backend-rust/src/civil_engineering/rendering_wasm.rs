//! # WebAssembly Bindings for Rendering Optimization Module
//!
//! WASM bindings for high-performance rendering optimizations.
//! Enables browser-based structural visualization with minimal resource usage.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::civil_engineering::rendering::*;

// ============================================================================
// WASM SCENE OPTIMIZER
// ============================================================================

/// WASM-compatible scene optimizer
#[wasm_bindgen]
pub struct WasmSceneOptimizer {
    optimizer: SceneOptimizer,
    camera_pos: Vec3,
    frustum_matrix: [f64; 16],
}

#[wasm_bindgen]
impl WasmSceneOptimizer {
    #[wasm_bindgen(constructor)]
    pub fn new(memory_budget_mb: usize, max_triangles: u32) -> Self {
        Self {
            optimizer: SceneOptimizer::new(memory_budget_mb, max_triangles),
            camera_pos: Vec3::zero(),
            frustum_matrix: [
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ],
        }
    }
    
    /// Set camera position
    #[wasm_bindgen]
    pub fn set_camera(&mut self, x: f64, y: f64, z: f64) {
        self.camera_pos = Vec3::new(x, y, z);
    }
    
    /// Set view-projection matrix for frustum culling
    #[wasm_bindgen]
    pub fn set_view_projection(&mut self, matrix: &[f64]) {
        if matrix.len() >= 16 {
            self.frustum_matrix.copy_from_slice(&matrix[0..16]);
        }
    }
    
    /// Add a simple mesh (JSON format)
    #[wasm_bindgen]
    pub fn add_mesh_json(&mut self, json: &str) -> bool {
        if let Ok(mesh_data) = serde_json::from_str::<MeshInputData>(json) {
            let mesh = OptimizedMesh::from_positions_indices(
                mesh_data.id,
                &mesh_data.positions,
                &mesh_data.normals,
                &mesh_data.indices,
            );
            self.optimizer.add_mesh(mesh);
            true
        } else {
            false
        }
    }
    
    /// Add beam element
    #[wasm_bindgen]
    pub fn add_beam(
        &mut self,
        id: &str,
        start_x: f64, start_y: f64, start_z: f64,
        end_x: f64, end_y: f64, end_z: f64,
        width: f64, height: f64,
        segments: u8,
    ) {
        let mesh = generate_beam_mesh(
            Vec3::new(start_x, start_y, start_z),
            Vec3::new(end_x, end_y, end_z),
            width,
            height,
            segments,
        );
        let mut mesh = mesh;
        mesh.id = id.to_string();
        self.optimizer.add_mesh(mesh);
    }
    
    /// Add column element
    #[wasm_bindgen]
    pub fn add_column(
        &mut self,
        id: &str,
        base_x: f64, base_y: f64, base_z: f64,
        top_x: f64, top_y: f64, top_z: f64,
        radius: f64,
        sides: u8,
    ) {
        let mesh = generate_column_mesh(
            Vec3::new(base_x, base_y, base_z),
            Vec3::new(top_x, top_y, top_z),
            radius,
            sides,
        );
        let mut mesh = mesh;
        mesh.id = id.to_string();
        self.optimizer.add_mesh(mesh);
    }
    
    /// Add slab element
    #[wasm_bindgen]
    pub fn add_slab(
        &mut self,
        id: &str,
        center_x: f64, center_y: f64, center_z: f64,
        width: f64, depth: f64, thickness: f64,
        subdivisions: u8,
    ) {
        let mesh = generate_slab_mesh(
            Vec3::new(center_x, center_y, center_z),
            width,
            depth,
            thickness,
            subdivisions,
        );
        let mut mesh = mesh;
        mesh.id = id.to_string();
        self.optimizer.add_mesh(mesh);
    }
    
    /// Add instance of existing mesh
    #[wasm_bindgen]
    pub fn add_instance(
        &mut self,
        mesh_id: &str,
        x: f64, y: f64, z: f64,
        scale_x: f64, scale_y: f64, scale_z: f64,
        rotation_y: f64,
    ) {
        let instance = InstanceData::from_position(x, y, z)
            .with_scale(scale_x, scale_y, scale_z)
            .with_rotation_y(rotation_y);
        
        if let Some(mesh) = self.optimizer.meshes.get(mesh_id) {
            let bounds = mesh.bounds;
            let group = self.optimizer.instance_groups
                .entry(mesh_id.to_string())
                .or_insert_with(|| InstanceGroup::new(mesh_id.to_string()));
            group.add_instance(instance, &bounds);
        }
    }
    
    /// Build spatial index
    #[wasm_bindgen]
    pub fn build_spatial_index(&mut self) {
        self.optimizer.build_spatial_index();
    }
    
    /// Update scene optimization
    #[wasm_bindgen]
    pub fn update(&mut self, view_distance: f64) {
        let frustum = Frustum::from_matrix(&self.frustum_matrix);
        self.optimizer.update(&self.camera_pos, &frustum, view_distance);
    }
    
    /// Get visible meshes (JSON array of IDs)
    #[wasm_bindgen]
    pub fn get_visible_meshes(&self) -> String {
        let visible: Vec<&String> = self.optimizer.meshes.keys().collect();
        serde_json::to_string(&visible).unwrap_or_else(|_| "[]".to_string())
    }
    
    /// Get rendering statistics as JSON
    #[wasm_bindgen]
    pub fn get_stats(&self) -> String {
        let stats = self.optimizer.stats();
        serde_json::json!({
            "total_meshes": stats.total_meshes,
            "total_triangles": stats.total_triangles,
            "total_instances": stats.total_instances,
            "draw_calls": stats.batch_stats.total_draw_calls,
            "memory_used_mb": stats.streaming_stats.memory_used as f64 / (1024.0 * 1024.0),
            "memory_utilization": stats.streaming_stats.utilization
        }).to_string()
    }
    
    /// Get batch data for rendering (returns serialized batches)
    #[wasm_bindgen]
    pub fn get_render_batches(&self) -> String {
        let batches: Vec<_> = self.optimizer.batch_optimizer.get_batches()
            .iter()
            .map(|b| BatchOutput {
                mesh_id: b.mesh_id.clone(),
                material_id: b.material_id.clone(),
                instance_count: b.instances.len(),
                triangle_count: b.triangle_count,
            })
            .collect();
        
        serde_json::to_string(&batches).unwrap_or_else(|_| "[]".to_string())
    }
}

#[derive(Serialize, Deserialize)]
struct MeshInputData {
    id: String,
    positions: Vec<[f64; 3]>,
    normals: Vec<[f64; 3]>,
    indices: Vec<u32>,
}

#[derive(Serialize)]
struct BatchOutput {
    mesh_id: String,
    material_id: String,
    instance_count: usize,
    triangle_count: u32,
}

// ============================================================================
// LOD CHAIN GENERATOR
// ============================================================================

/// Generate LOD chain from mesh data
#[wasm_bindgen]
pub fn generate_lod_chain_wasm(
    mesh_json: &str,
    distance_thresholds_json: &str,
) -> String {
    let mesh_data: MeshInputData = match serde_json::from_str(mesh_json) {
        Ok(d) => d,
        Err(_) => return r#"{"error": "Invalid mesh JSON"}"#.to_string(),
    };
    
    let thresholds: Vec<f64> = serde_json::from_str(distance_thresholds_json)
        .unwrap_or_else(|_| vec![50.0, 100.0, 200.0, 500.0]);
    
    let config = LODConfig {
        distance_thresholds: thresholds.clone(),
        reduction_ratios: thresholds.iter()
            .enumerate()
            .map(|(i, _)| 1.0 / (2.0_f64.powi(i as i32)))
            .collect(),
        ..Default::default()
    };
    
    let chain = generate_lod_chain(
        &mesh_data.positions,
        &mesh_data.normals,
        &mesh_data.indices,
        &mesh_data.id,
        &config,
    );
    
    let output = LODChainOutput {
        base_mesh_id: chain.base_mesh_id,
        lod_count: chain.lod_meshes.len(),
        lod_triangle_counts: chain.lod_meshes.iter().map(|m| m.triangle_count).collect(),
        total_memory_kb: chain.lod_meshes.iter().map(|m| m.memory_size()).sum::<usize>() / 1024,
    };
    
    serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string())
}

#[derive(Serialize)]
struct LODChainOutput {
    base_mesh_id: String,
    lod_count: usize,
    lod_triangle_counts: Vec<u32>,
    total_memory_kb: usize,
}

// ============================================================================
// MESH COMPRESSION
// ============================================================================

/// Compress mesh data for network transfer
#[wasm_bindgen]
pub fn compress_mesh_wasm(mesh_json: &str) -> String {
    let mesh_data: MeshInputData = match serde_json::from_str(mesh_json) {
        Ok(d) => d,
        Err(_) => return r#"{"error": "Invalid mesh JSON"}"#.to_string(),
    };
    
    let compressed = CompressedMesh::compress(
        mesh_data.id,
        &mesh_data.positions,
        &mesh_data.normals,
        &mesh_data.indices,
    );
    
    let memory_size = compressed.memory_size();
    let ratio = compressed.compression_ratio();
    
    let output = CompressionOutput {
        id: compressed.id,
        original_size_kb: (mesh_data.positions.len() * 24 + mesh_data.indices.len() * 4) / 1024,
        compressed_size_kb: memory_size / 1024,
        compression_ratio: ratio,
        vertex_count: compressed.vertex_count,
        triangle_count: compressed.triangle_count,
    };
    
    serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string())
}

#[derive(Serialize)]
struct CompressionOutput {
    id: String,
    original_size_kb: usize,
    compressed_size_kb: usize,
    compression_ratio: f64,
    vertex_count: u32,
    triangle_count: u32,
}

// ============================================================================
// MESH SIMPLIFICATION
// ============================================================================

/// Simplify mesh to target triangle count
#[wasm_bindgen]
pub fn simplify_mesh_wasm(mesh_json: &str, target_triangles: usize) -> String {
    let mesh_data: MeshInputData = match serde_json::from_str(mesh_json) {
        Ok(d) => d,
        Err(_) => return r#"{"error": "Invalid mesh JSON"}"#.to_string(),
    };
    
    let mut simplifier = QuadricSimplifier::new(&mesh_data.positions, &mesh_data.indices);
    let (simplified_positions, simplified_indices) = simplifier.simplify(target_triangles);
    let simplified_normals = calculate_normals_external(&simplified_positions, &simplified_indices);
    
    let output = SimplifiedMeshOutput {
        id: mesh_data.id,
        original_triangles: mesh_data.indices.len() / 3,
        simplified_triangles: simplified_indices.len() / 3,
        reduction_ratio: 1.0 - (simplified_indices.len() as f64 / mesh_data.indices.len() as f64),
        positions: simplified_positions,
        normals: simplified_normals,
        indices: simplified_indices,
    };
    
    serde_json::to_string(&output).unwrap_or_else(|_| "{}".to_string())
}

fn calculate_normals_external(positions: &[[f64; 3]], indices: &[u32]) -> Vec<[f64; 3]> {
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

#[derive(Serialize)]
struct SimplifiedMeshOutput {
    id: String,
    original_triangles: usize,
    simplified_triangles: usize,
    reduction_ratio: f64,
    positions: Vec<[f64; 3]>,
    normals: Vec<[f64; 3]>,
    indices: Vec<u32>,
}

// ============================================================================
// STRUCTURAL ELEMENT GENERATORS
// ============================================================================

/// Generate optimized beam mesh
#[wasm_bindgen]
pub fn generate_beam_mesh_wasm(
    start_x: f64, start_y: f64, start_z: f64,
    end_x: f64, end_y: f64, end_z: f64,
    width: f64, height: f64,
    segments: u8,
) -> String {
    let mesh = generate_beam_mesh(
        Vec3::new(start_x, start_y, start_z),
        Vec3::new(end_x, end_y, end_z),
        width,
        height,
        segments,
    );
    
    mesh_to_json(&mesh)
}

/// Generate optimized column mesh
#[wasm_bindgen]
pub fn generate_column_mesh_wasm(
    base_x: f64, base_y: f64, base_z: f64,
    top_x: f64, top_y: f64, top_z: f64,
    radius: f64,
    sides: u8,
) -> String {
    let mesh = generate_column_mesh(
        Vec3::new(base_x, base_y, base_z),
        Vec3::new(top_x, top_y, top_z),
        radius,
        sides,
    );
    
    mesh_to_json(&mesh)
}

/// Generate optimized slab mesh
#[wasm_bindgen]
pub fn generate_slab_mesh_wasm(
    center_x: f64, center_y: f64, center_z: f64,
    width: f64, depth: f64, thickness: f64,
    subdivisions: u8,
) -> String {
    let mesh = generate_slab_mesh(
        Vec3::new(center_x, center_y, center_z),
        width,
        depth,
        thickness,
        subdivisions,
    );
    
    mesh_to_json(&mesh)
}

fn mesh_to_json(mesh: &OptimizedMesh) -> String {
    // Convert compact vertices back to standard format for JS
    let positions: Vec<[f64; 3]> = mesh.vertices.iter()
        .map(|v| [v.position[0] as f64, v.position[1] as f64, v.position[2] as f64])
        .collect();
    
    let normals: Vec<[f64; 3]> = mesh.vertices.iter()
        .map(|v| [
            v.normal[0] as f64 / 127.0,
            v.normal[1] as f64 / 127.0,
            v.normal[2] as f64 / 127.0,
        ])
        .collect();
    
    serde_json::json!({
        "id": mesh.id,
        "positions": positions,
        "normals": normals,
        "indices": mesh.indices,
        "bounds": {
            "min": [mesh.bounds.min.x, mesh.bounds.min.y, mesh.bounds.min.z],
            "max": [mesh.bounds.max.x, mesh.bounds.max.y, mesh.bounds.max.z]
        },
        "triangle_count": mesh.triangle_count,
        "vertex_count": mesh.vertex_count,
        "memory_kb": mesh.memory_size() / 1024
    }).to_string()
}

// ============================================================================
// OCTREE SPATIAL QUERIES
// ============================================================================

/// WASM-compatible octree for frustum culling
#[wasm_bindgen]
pub struct WasmOctree {
    octree: Option<Octree>,
    object_ids: Vec<String>,
}

#[wasm_bindgen]
impl WasmOctree {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            octree: None,
            object_ids: Vec::new(),
        }
    }
    
    /// Build octree from object bounds (JSON array)
    #[wasm_bindgen]
    pub fn build(&mut self, bounds_json: &str, ids_json: &str) {
        let bounds_data: Vec<[[f64; 3]; 2]> = match serde_json::from_str(bounds_json) {
            Ok(d) => d,
            Err(_) => return,
        };
        
        self.object_ids = serde_json::from_str(ids_json).unwrap_or_default();
        
        let bounds: Vec<AABB> = bounds_data.iter()
            .map(|b| AABB::new(
                Vec3::new(b[0][0], b[0][1], b[0][2]),
                Vec3::new(b[1][0], b[1][1], b[1][2]),
            ))
            .collect();
        
        self.octree = Some(Octree::build(&bounds, 8, 16));
    }
    
    /// Query objects in frustum (returns JSON array of IDs)
    #[wasm_bindgen]
    pub fn query_frustum(&self, matrix: &[f64]) -> String {
        if matrix.len() < 16 {
            return "[]".to_string();
        }
        
        let mut matrix_arr = [0.0_f64; 16];
        matrix_arr.copy_from_slice(&matrix[0..16]);
        let frustum = Frustum::from_matrix(&matrix_arr);
        
        if let Some(ref octree) = self.octree {
            let indices = octree.query_frustum(&frustum);
            let visible_ids: Vec<&String> = indices.iter()
                .filter_map(|&i| self.object_ids.get(i as usize))
                .collect();
            
            serde_json::to_string(&visible_ids).unwrap_or_else(|_| "[]".to_string())
        } else {
            "[]".to_string()
        }
    }
    
    /// Query objects in AABB region
    #[wasm_bindgen]
    pub fn query_box(
        &self,
        min_x: f64, min_y: f64, min_z: f64,
        max_x: f64, max_y: f64, max_z: f64,
    ) -> String {
        let query_bounds = AABB::new(
            Vec3::new(min_x, min_y, min_z),
            Vec3::new(max_x, max_y, max_z),
        );
        
        if let Some(ref octree) = self.octree {
            let indices = octree.query(&query_bounds);
            let visible_ids: Vec<&String> = indices.iter()
                .filter_map(|&i| self.object_ids.get(i as usize))
                .collect();
            
            serde_json::to_string(&visible_ids).unwrap_or_else(|_| "[]".to_string())
        } else {
            "[]".to_string()
        }
    }
    
    /// Get octree statistics
    #[wasm_bindgen]
    pub fn get_stats(&self) -> String {
        if let Some(ref octree) = self.octree {
            let stats = octree.stats();
            serde_json::json!({
                "total_nodes": stats.total_nodes,
                "leaf_nodes": stats.leaf_nodes,
                "total_objects": stats.total_objects,
                "max_depth": stats.max_depth
            }).to_string()
        } else {
            r#"{"error": "Octree not built"}"#.to_string()
        }
    }
}

// ============================================================================
// INSTANCED RENDERING HELPER
// ============================================================================

/// WASM instance buffer for GPU instancing
#[wasm_bindgen]
pub struct WasmInstanceBuffer {
    instances: Vec<InstanceData>,
    mesh_id: String,
}

#[wasm_bindgen]
impl WasmInstanceBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(mesh_id: &str) -> Self {
        Self {
            instances: Vec::new(),
            mesh_id: mesh_id.to_string(),
        }
    }
    
    /// Add instance at position
    #[wasm_bindgen]
    pub fn add(&mut self, x: f64, y: f64, z: f64) {
        self.instances.push(InstanceData::from_position(x, y, z));
    }
    
    /// Add instance with full transform
    #[wasm_bindgen]
    pub fn add_transformed(
        &mut self,
        x: f64, y: f64, z: f64,
        sx: f64, sy: f64, sz: f64,
        rotation_y: f64,
        r: f32, g: f32, b: f32, a: f32,
    ) {
        let instance = InstanceData::from_position(x, y, z)
            .with_scale(sx, sy, sz)
            .with_rotation_y(rotation_y)
            .with_color(r, g, b, a);
        
        self.instances.push(instance);
    }
    
    /// Get instance count
    #[wasm_bindgen]
    pub fn count(&self) -> usize {
        self.instances.len()
    }
    
    /// Get flat Float32Array for GPU upload
    #[wasm_bindgen]
    pub fn get_buffer(&self) -> Vec<f32> {
        let mut buffer = Vec::with_capacity(self.instances.len() * 24); // 16 transform + 4 color + 4 custom
        
        for instance in &self.instances {
            // Flatten transform matrix (column-major for WebGL)
            for col in &instance.transform {
                for &val in col {
                    buffer.push(val);
                }
            }
            // Color
            for &val in &instance.color {
                buffer.push(val);
            }
            // Custom
            for &val in &instance.custom {
                buffer.push(val);
            }
        }
        
        buffer
    }
    
    /// Clear all instances
    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.instances.clear();
    }
    
    /// Memory size in bytes
    #[wasm_bindgen]
    pub fn memory_size(&self) -> usize {
        self.instances.len() * std::mem::size_of::<InstanceData>()
    }
}

// ============================================================================
// STREAMING MANAGER
// ============================================================================

/// WASM streaming manager for progressive loading
#[wasm_bindgen]
pub struct WasmStreamingManager {
    manager: StreamingManager,
}

#[wasm_bindgen]
impl WasmStreamingManager {
    #[wasm_bindgen(constructor)]
    pub fn new(memory_budget_mb: usize) -> Self {
        Self {
            manager: StreamingManager::new(memory_budget_mb),
        }
    }
    
    /// Register streamable chunk
    #[wasm_bindgen]
    pub fn register_chunk(
        &mut self,
        id: &str,
        min_x: f64, min_y: f64, min_z: f64,
        max_x: f64, max_y: f64, max_z: f64,
        data_size_kb: usize,
    ) {
        let chunk = StreamingChunk {
            id: id.to_string(),
            bounds: AABB::new(
                Vec3::new(min_x, min_y, min_z),
                Vec3::new(max_x, max_y, max_z),
            ),
            lod_level: 0,
            data_size: data_size_kb * 1024,
            loaded: false,
            priority: 4,
            last_access: 0,
        };
        
        self.manager.register_chunk(chunk);
    }
    
    /// Update streaming based on camera
    #[wasm_bindgen]
    pub fn update(&mut self, camera_x: f64, camera_y: f64, camera_z: f64, view_distance: f64) {
        let camera_pos = Vec3::new(camera_x, camera_y, camera_z);
        self.manager.update(&camera_pos, view_distance);
    }
    
    /// Get chunks to load (JSON array)
    #[wasm_bindgen]
    pub fn get_pending_loads(&self) -> String {
        serde_json::to_string(self.manager.get_pending_loads()).unwrap_or_else(|_| "[]".to_string())
    }
    
    /// Get chunks to unload (JSON array)
    #[wasm_bindgen]
    pub fn get_pending_unloads(&self) -> String {
        serde_json::to_string(self.manager.get_pending_unloads()).unwrap_or_else(|_| "[]".to_string())
    }
    
    /// Get memory statistics
    #[wasm_bindgen]
    pub fn get_stats(&self) -> String {
        let stats = self.manager.memory_stats();
        serde_json::to_string(&stats).unwrap_or_else(|_| "{}".to_string())
    }
}
