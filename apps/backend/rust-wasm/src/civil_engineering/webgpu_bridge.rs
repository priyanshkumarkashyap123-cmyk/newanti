//! # WebGPU Compute Bridge
//!
//! Rust/WASM interface for WebGPU compute shaders.
//! Provides buffer management, shader compilation, and dispatch coordination.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================================================
// WEBGPU BUFFER DESCRIPTORS (for JavaScript interop)
// ============================================================================

/// GPU Buffer usage flags (mirrors WebGPU)
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum GpuBufferUsage {
    MapRead = 0x0001,
    MapWrite = 0x0002,
    CopySrc = 0x0004,
    CopyDst = 0x0008,
    Index = 0x0010,
    Vertex = 0x0020,
    Uniform = 0x0040,
    Storage = 0x0080,
    Indirect = 0x0100,
    QueryResolve = 0x0200,
}

/// Buffer descriptor for creating GPU buffers
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct GpuBufferDescriptor {
    pub size: u32,
    pub usage: u32,
    mapped_at_creation: bool,
    label: String,
}

#[wasm_bindgen]
impl GpuBufferDescriptor {
    #[wasm_bindgen(constructor)]
    pub fn new(size: u32, usage: u32) -> Self {
        Self {
            size,
            usage,
            mapped_at_creation: false,
            label: String::new(),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn mapped_at_creation(&self) -> bool {
        self.mapped_at_creation
    }

    #[wasm_bindgen(setter)]
    pub fn set_mapped_at_creation(&mut self, value: bool) {
        self.mapped_at_creation = value;
    }

    #[wasm_bindgen(getter)]
    pub fn label(&self) -> String {
        self.label.clone()
    }

    #[wasm_bindgen(setter)]
    pub fn set_label(&mut self, value: String) {
        self.label = value;
    }

    pub fn to_json(&self) -> String {
        format!(
            r#"{{"size":{},"usage":{},"mappedAtCreation":{},"label":"{}"}}"#,
            self.size, self.usage, self.mapped_at_creation, self.label
        )
    }
}

// ============================================================================
// COMPUTE PIPELINE DESCRIPTORS
// ============================================================================

/// Compute pipeline configuration
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct ComputePipelineConfig {
    shader_code: String,
    entry_point: String,
    workgroup_size: [u32; 3],
    label: String,
}

#[wasm_bindgen]
impl ComputePipelineConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(shader_code: &str, entry_point: &str) -> Self {
        Self {
            shader_code: shader_code.to_string(),
            entry_point: entry_point.to_string(),
            workgroup_size: [64, 1, 1],
            label: String::new(),
        }
    }

    pub fn set_workgroup_size(&mut self, x: u32, y: u32, z: u32) {
        self.workgroup_size = [x, y, z];
    }

    #[wasm_bindgen(getter)]
    pub fn shader_code(&self) -> String {
        self.shader_code.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn entry_point(&self) -> String {
        self.entry_point.clone()
    }

    pub fn workgroup_x(&self) -> u32 {
        self.workgroup_size[0]
    }

    pub fn workgroup_y(&self) -> u32 {
        self.workgroup_size[1]
    }

    pub fn workgroup_z(&self) -> u32 {
        self.workgroup_size[2]
    }
}

// ============================================================================
// STRUCTURAL ANALYSIS GPU DATA STRUCTURES
// ============================================================================

/// Node data packed for GPU upload
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct GpuNodeBuffer {
    data: Vec<f32>, // [x, y, z, id, x, y, z, id, ...]
    count: u32,
}

#[wasm_bindgen]
impl GpuNodeBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            data: Vec::with_capacity((capacity * 4) as usize),
            count: 0,
        }
    }

    pub fn add_node(&mut self, x: f32, y: f32, z: f32, id: u32) {
        self.data.push(x);
        self.data.push(y);
        self.data.push(z);
        self.data.push(id as f32);
        self.count += 1;
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn byte_size(&self) -> u32 {
        (self.data.len() * 4) as u32
    }

    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn clear(&mut self) {
        self.data.clear();
        self.count = 0;
    }
}

/// Member data packed for GPU upload
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct GpuMemberBuffer {
    data: Vec<f32>, // [start_node, end_node, E, A, I, length, cos, sin, ...]
    count: u32,
}

#[wasm_bindgen]
impl GpuMemberBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            data: Vec::with_capacity((capacity * 8) as usize),
            count: 0,
        }
    }

    pub fn add_member(
        &mut self,
        start_node: u32,
        end_node: u32,
        e: f32,
        a: f32,
        i: f32,
        length: f32,
        cos_angle: f32,
        sin_angle: f32,
    ) {
        self.data.push(start_node as f32);
        self.data.push(end_node as f32);
        self.data.push(e);
        self.data.push(a);
        self.data.push(i);
        self.data.push(length);
        self.data.push(cos_angle);
        self.data.push(sin_angle);
        self.count += 1;
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn byte_size(&self) -> u32 {
        (self.data.len() * 4) as u32
    }

    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 {
        self.count
    }
}

/// Load data packed for GPU upload
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct GpuLoadBuffer {
    data: Vec<f32>, // [node_id, fx, fy, fz, ...]
    count: u32,
}

#[wasm_bindgen]
impl GpuLoadBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            data: Vec::with_capacity((capacity * 4) as usize),
            count: 0,
        }
    }

    pub fn add_load(&mut self, node_id: u32, fx: f32, fy: f32, fz: f32) {
        self.data.push(node_id as f32);
        self.data.push(fx);
        self.data.push(fy);
        self.data.push(fz);
        self.count += 1;
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn byte_size(&self) -> u32 {
        (self.data.len() * 4) as u32
    }

    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 {
        self.count
    }
}

// ============================================================================
// GPU COMPUTE DISPATCH CALCULATOR
// ============================================================================

/// Calculate optimal dispatch dimensions
#[wasm_bindgen]
pub struct DispatchCalculator;

#[wasm_bindgen]
impl DispatchCalculator {
    /// Calculate workgroup count for 1D dispatch
    pub fn workgroups_1d(total_items: u32, workgroup_size: u32) -> u32 {
        (total_items + workgroup_size - 1) / workgroup_size
    }

    /// Calculate workgroup counts for 2D dispatch
    pub fn workgroups_2d(
        width: u32,
        height: u32,
        workgroup_size_x: u32,
        workgroup_size_y: u32,
    ) -> Vec<u32> {
        vec![
            (width + workgroup_size_x - 1) / workgroup_size_x,
            (height + workgroup_size_y - 1) / workgroup_size_y,
        ]
    }

    /// Calculate optimal workgroup size based on problem size
    pub fn optimal_workgroup_size(total_items: u32, max_workgroup_size: u32) -> u32 {
        // Use powers of 2, capped at max
        let mut size = 32u32;
        while size < max_workgroup_size && size * 2 <= total_items {
            size *= 2;
        }
        size.min(max_workgroup_size)
    }
}

// ============================================================================
// UNIFORMS BUFFER BUILDER
// ============================================================================

/// Build uniform buffer for structural analysis
#[wasm_bindgen]
pub struct StructuralUniforms {
    data: Vec<f32>,
}

#[wasm_bindgen]
impl StructuralUniforms {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            data: vec![0.0; 8], // 8 floats = 32 bytes (aligned)
        }
    }

    pub fn set_counts(&mut self, num_nodes: u32, num_members: u32, num_loads: u32, num_dof: u32) {
        // Store as f32 for uniform buffer compatibility
        self.data[0] = num_nodes as f32;
        self.data[1] = num_members as f32;
        self.data[2] = num_loads as f32;
        self.data[3] = num_dof as f32;
    }

    pub fn set_solver_params(&mut self, penalty: f32, tolerance: f32, max_iterations: u32) {
        self.data[4] = penalty;
        self.data[5] = tolerance;
        self.data[6] = max_iterations as f32;
        self.data[7] = 0.0; // Padding
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn byte_size(&self) -> u32 {
        32 // 8 * 4 bytes
    }
}

// ============================================================================
// MESH COMPRESSION BUFFERS
// ============================================================================

/// Compressed vertex buffer for GPU upload
#[wasm_bindgen]
#[derive(Clone)]
pub struct GpuCompressedMesh {
    positions: Vec<u16>,  // Quantized positions
    normals: Vec<i16>,    // Octahedral encoded normals
    indices: Vec<u16>,    // Triangle indices
    bounds_min: [f32; 3],
    bounds_scale: f32,
    vertex_count: u32,
    index_count: u32,
}

#[wasm_bindgen]
impl GpuCompressedMesh {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            positions: Vec::new(),
            normals: Vec::new(),
            indices: Vec::new(),
            bounds_min: [0.0; 3],
            bounds_scale: 1.0,
            vertex_count: 0,
            index_count: 0,
        }
    }

    /// Compress vertices from float positions/normals
    pub fn compress_vertices(&mut self, positions: Vec<f32>, normals: Vec<f32>) {
        let vertex_count = positions.len() / 3;

        // Calculate bounds
        let mut min = [f32::MAX; 3];
        let mut max = [f32::MIN; 3];

        for i in 0..vertex_count {
            for j in 0..3 {
                min[j] = min[j].min(positions[i * 3 + j]);
                max[j] = max[j].max(positions[i * 3 + j]);
            }
        }

        let scale = (max[0] - min[0])
            .max(max[1] - min[1])
            .max(max[2] - min[2])
            .max(0.001);

        self.bounds_min = min;
        self.bounds_scale = scale;
        self.vertex_count = vertex_count as u32;

        // Quantize positions to 16-bit
        self.positions.clear();
        self.positions.reserve(vertex_count * 3);

        for i in 0..vertex_count {
            for j in 0..3 {
                let normalized = (positions[i * 3 + j] - min[j]) / scale;
                let quantized = (normalized.clamp(0.0, 1.0) * 65535.0) as u16;
                self.positions.push(quantized);
            }
        }

        // Encode normals using octahedral encoding
        self.normals.clear();
        self.normals.reserve(vertex_count * 2);

        for i in 0..vertex_count {
            let nx = normals[i * 3];
            let ny = normals[i * 3 + 1];
            let nz = normals[i * 3 + 2];

            let (ox, oy) = encode_octahedral(nx, ny, nz);
            self.normals.push(ox);
            self.normals.push(oy);
        }
    }

    /// Set triangle indices
    pub fn set_indices(&mut self, indices: Vec<u16>) {
        self.index_count = indices.len() as u32;
        self.indices = indices;
    }

    /// Get compressed position data
    pub fn get_positions(&self) -> Vec<u16> {
        self.positions.clone()
    }

    /// Get compressed normal data
    pub fn get_normals(&self) -> Vec<i16> {
        self.normals.clone()
    }

    /// Get index data
    pub fn get_indices(&self) -> Vec<u16> {
        self.indices.clone()
    }

    /// Get bounds for decompression in shader
    pub fn get_bounds(&self) -> Vec<f32> {
        vec![
            self.bounds_min[0],
            self.bounds_min[1],
            self.bounds_min[2],
            self.bounds_scale,
        ]
    }

    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }

    #[wasm_bindgen(getter)]
    pub fn index_count(&self) -> u32 {
        self.index_count
    }

    /// Memory savings ratio
    pub fn compression_ratio(&self) -> f32 {
        let original = self.vertex_count * 24; // 3 floats pos + 3 floats normal = 24 bytes
        let compressed = (self.positions.len() * 2 + self.normals.len() * 2) as u32;
        if compressed > 0 {
            original as f32 / compressed as f32
        } else {
            1.0
        }
    }
}

/// Octahedral normal encoding helper
fn encode_octahedral(nx: f32, ny: f32, nz: f32) -> (i16, i16) {
    let sum = nx.abs() + ny.abs() + nz.abs();
    if sum < 0.0001 {
        return (0, 0);
    }

    let mut ox = nx / sum;
    let mut oy = ny / sum;

    if nz < 0.0 {
        let temp_x = ox;
        let temp_y = oy;
        ox = (1.0 - temp_y.abs()) * if temp_x >= 0.0 { 1.0 } else { -1.0 };
        oy = (1.0 - temp_x.abs()) * if temp_y >= 0.0 { 1.0 } else { -1.0 };
    }

    ((ox * 32767.0) as i16, (oy * 32767.0) as i16)
}

// ============================================================================
// INSTANCE BUFFER BUILDER
// ============================================================================

/// GPU instance data for instanced rendering
#[wasm_bindgen]
pub struct GpuInstanceBuffer {
    // Packed as: [px, py, pz, scale, qx, qy, qz, qw, r, g, b, a] per instance
    data: Vec<f32>,
    count: u32,
}

#[wasm_bindgen]
impl GpuInstanceBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: u32) -> Self {
        Self {
            data: Vec::with_capacity((capacity * 12) as usize),
            count: 0,
        }
    }

    /// Add instance with position, scale, rotation quaternion, and color
    pub fn add_instance(
        &mut self,
        px: f32,
        py: f32,
        pz: f32,
        scale: f32,
        qx: f32,
        qy: f32,
        qz: f32,
        qw: f32,
        r: f32,
        g: f32,
        b: f32,
        a: f32,
    ) {
        self.data.extend_from_slice(&[px, py, pz, scale, qx, qy, qz, qw, r, g, b, a]);
        self.count += 1;
    }

    /// Add instance with position and uniform scale only (identity rotation, white color)
    pub fn add_instance_simple(&mut self, px: f32, py: f32, pz: f32, scale: f32) {
        self.add_instance(px, py, pz, scale, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0);
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }

    pub fn byte_size(&self) -> u32 {
        (self.data.len() * 4) as u32
    }

    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn clear(&mut self) {
        self.data.clear();
        self.count = 0;
    }
}

// ============================================================================
// FRUSTUM CULLING DATA
// ============================================================================

/// Frustum planes for GPU culling
#[wasm_bindgen]
pub struct GpuFrustum {
    planes: Vec<f32>, // 6 planes × 4 components = 24 floats
}

#[wasm_bindgen]
impl GpuFrustum {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            planes: vec![0.0; 24],
        }
    }

    /// Set plane (index 0-5) with normal (nx, ny, nz) and distance d
    pub fn set_plane(&mut self, index: u32, nx: f32, ny: f32, nz: f32, d: f32) {
        let base = (index * 4) as usize;
        if base + 3 < self.planes.len() {
            self.planes[base] = nx;
            self.planes[base + 1] = ny;
            self.planes[base + 2] = nz;
            self.planes[base + 3] = d;
        }
    }

    /// Extract frustum from view-projection matrix (column-major)
    pub fn from_view_projection(&mut self, m: Vec<f32>) {
        if m.len() < 16 {
            return;
        }

        // Left plane
        self.planes[0] = m[3] + m[0];
        self.planes[1] = m[7] + m[4];
        self.planes[2] = m[11] + m[8];
        self.planes[3] = m[15] + m[12];

        // Right plane
        self.planes[4] = m[3] - m[0];
        self.planes[5] = m[7] - m[4];
        self.planes[6] = m[11] - m[8];
        self.planes[7] = m[15] - m[12];

        // Bottom plane
        self.planes[8] = m[3] + m[1];
        self.planes[9] = m[7] + m[5];
        self.planes[10] = m[11] + m[9];
        self.planes[11] = m[15] + m[13];

        // Top plane
        self.planes[12] = m[3] - m[1];
        self.planes[13] = m[7] - m[5];
        self.planes[14] = m[11] - m[9];
        self.planes[15] = m[15] - m[13];

        // Near plane
        self.planes[16] = m[3] + m[2];
        self.planes[17] = m[7] + m[6];
        self.planes[18] = m[11] + m[10];
        self.planes[19] = m[15] + m[14];

        // Far plane
        self.planes[20] = m[3] - m[2];
        self.planes[21] = m[7] - m[6];
        self.planes[22] = m[11] - m[10];
        self.planes[23] = m[15] - m[14];

        // Normalize all planes
        for i in 0..6 {
            let base = i * 4;
            let len = (self.planes[base].powi(2)
                + self.planes[base + 1].powi(2)
                + self.planes[base + 2].powi(2))
            .sqrt();
            if len > 0.0001 {
                self.planes[base] /= len;
                self.planes[base + 1] /= len;
                self.planes[base + 2] /= len;
                self.planes[base + 3] /= len;
            }
        }
    }

    pub fn get_data(&self) -> Vec<f32> {
        self.planes.clone()
    }

    pub fn byte_size(&self) -> u32 {
        96 // 24 * 4 bytes
    }
}

// ============================================================================
// SHADER CODE GENERATOR
// ============================================================================

/// Generate optimized WGSL shader code
#[wasm_bindgen]
pub struct ShaderGenerator;

#[wasm_bindgen]
impl ShaderGenerator {
    /// Get truss stiffness assembly shader
    pub fn truss_stiffness_shader() -> String {
        include_str!("gpu_compute.wgsl").to_string()
    }

    /// Generate simple vertex decompression shader
    pub fn vertex_decompress_shader() -> String {
        r#"
struct VertexInput {
    @location(0) position_packed: vec2<u32>,
    @location(1) normal_packed: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec4<f32>,
}

struct Uniforms {
    mvp: mat4x4<f32>,
    bounds_min: vec3<f32>,
    bounds_scale: f32,
    color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Decompress position
    let px = f32(input.position_packed.x & 0xFFFFu) / 65535.0;
    let py = f32(input.position_packed.x >> 16u) / 65535.0;
    let pz = f32(input.position_packed.y & 0xFFFFu) / 65535.0;
    
    let pos = uniforms.bounds_min + vec3<f32>(px, py, pz) * uniforms.bounds_scale;
    output.position = uniforms.mvp * vec4<f32>(pos, 1.0);
    
    // Decompress octahedral normal
    let ox = f32(i32(input.normal_packed & 0xFFFFu) - 32768) / 32767.0;
    let oy = f32(i32(input.normal_packed >> 16u) - 32768) / 32767.0;
    
    let oz = 1.0 - abs(ox) - abs(oy);
    var n = vec3<f32>(ox, oy, oz);
    if (oz < 0.0) {
        n.x = (1.0 - abs(oy)) * select(-1.0, 1.0, ox >= 0.0);
        n.y = (1.0 - abs(ox)) * select(-1.0, 1.0, oy >= 0.0);
    }
    output.normal = normalize(n);
    
    output.color = uniforms.color;
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Simple directional lighting
    let light_dir = normalize(vec3<f32>(0.5, 1.0, 0.3));
    let diffuse = max(dot(input.normal, light_dir), 0.2);
    return vec4<f32>(input.color.rgb * diffuse, input.color.a);
}
"#
        .to_string()
    }

    /// Generate instanced rendering shader
    pub fn instanced_render_shader() -> String {
        r#"
struct InstanceData {
    @location(4) position: vec3<f32>,
    @location(5) scale: f32,
    @location(6) rotation: vec4<f32>,
    @location(7) color: vec4<f32>,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_normal: vec3<f32>,
    @location(1) color: vec4<f32>,
}

struct Camera {
    view_proj: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: Camera;

fn quat_rotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
    let t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
}

@vertex
fn vs_main(vertex: VertexInput, instance: InstanceData) -> VertexOutput {
    var output: VertexOutput;
    
    // Apply instance transform
    let scaled = vertex.position * instance.scale;
    let rotated = quat_rotate(instance.rotation, scaled);
    let world_pos = rotated + instance.position;
    
    output.clip_position = camera.view_proj * vec4<f32>(world_pos, 1.0);
    output.world_normal = quat_rotate(instance.rotation, vertex.normal);
    output.color = instance.color;
    
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let light_dir = normalize(vec3<f32>(0.3, 0.8, 0.5));
    let ambient = 0.15;
    let diffuse = max(dot(normalize(input.world_normal), light_dir), 0.0);
    let lighting = ambient + diffuse * 0.85;
    
    return vec4<f32>(input.color.rgb * lighting, input.color.a);
}
"#
        .to_string()
    }
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/// Track GPU compute performance
#[wasm_bindgen]
pub struct GpuPerformanceTracker {
    dispatch_count: u32,
    total_workgroups: u64,
    buffer_bytes_uploaded: u64,
    buffer_bytes_downloaded: u64,
}

#[wasm_bindgen]
impl GpuPerformanceTracker {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            dispatch_count: 0,
            total_workgroups: 0,
            buffer_bytes_uploaded: 0,
            buffer_bytes_downloaded: 0,
        }
    }

    pub fn record_dispatch(&mut self, workgroup_count: u32) {
        self.dispatch_count += 1;
        self.total_workgroups += workgroup_count as u64;
    }

    pub fn record_upload(&mut self, bytes: u32) {
        self.buffer_bytes_uploaded += bytes as u64;
    }

    pub fn record_download(&mut self, bytes: u32) {
        self.buffer_bytes_downloaded += bytes as u64;
    }

    pub fn get_stats(&self) -> String {
        format!(
            r#"{{"dispatches":{},"workgroups":{},"uploaded_mb":{:.2},"downloaded_mb":{:.2}}}"#,
            self.dispatch_count,
            self.total_workgroups,
            self.buffer_bytes_uploaded as f64 / (1024.0 * 1024.0),
            self.buffer_bytes_downloaded as f64 / (1024.0 * 1024.0)
        )
    }

    pub fn reset(&mut self) {
        self.dispatch_count = 0;
        self.total_workgroups = 0;
        self.buffer_bytes_uploaded = 0;
        self.buffer_bytes_downloaded = 0;
    }
}

// ============================================================================
// BUFFER LAYOUT HELPERS
// ============================================================================

/// Calculate aligned buffer size for WebGPU
#[wasm_bindgen]
pub fn aligned_buffer_size(size: u32, alignment: u32) -> u32 {
    ((size + alignment - 1) / alignment) * alignment
}

/// Calculate storage buffer size with WebGPU alignment (256 bytes for uniform, 4 for storage)
#[wasm_bindgen]
pub fn storage_buffer_size(element_count: u32, element_size: u32) -> u32 {
    aligned_buffer_size(element_count * element_size, 4)
}

/// Calculate uniform buffer size (256-byte alignment)
#[wasm_bindgen]
pub fn uniform_buffer_size(data_size: u32) -> u32 {
    aligned_buffer_size(data_size, 256)
}
