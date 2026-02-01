// ============================================================================
// WGSL GPU COMPUTE SHADERS FOR STRUCTURAL ENGINEERING
// Ultra-lightweight GPU computations for civil engineering
// ============================================================================

// ============================================================================
// SHARED DATA STRUCTURES
// ============================================================================

struct Node {
    x: f32,
    y: f32,
    z: f32,
    id: u32,
}

struct Member {
    start_node: u32,
    end_node: u32,
    e: f32,        // Young's modulus
    a: f32,        // Area
    i: f32,        // Moment of inertia
    length: f32,
    cos_angle: f32,
    sin_angle: f32,
}

struct Load {
    node_id: u32,
    fx: f32,
    fy: f32,
    fz: f32,
}

struct MemberForce {
    axial: f32,
    shear: f32,
    moment_start: f32,
    moment_end: f32,
}

struct MatrixBlock {
    data: array<f32, 36>, // 6x6 matrix for frame element
}

struct Vec4x4 {
    data: array<vec4<f32>, 4>,
}

// ============================================================================
// BUFFER BINDINGS
// ============================================================================

@group(0) @binding(0) var<storage, read> nodes: array<Node>;
@group(0) @binding(1) var<storage, read> members: array<Member>;
@group(0) @binding(2) var<storage, read> loads: array<Load>;
@group(0) @binding(3) var<storage, read_write> stiffness_matrix: array<f32>;
@group(0) @binding(4) var<storage, read_write> force_vector: array<f32>;
@group(0) @binding(5) var<storage, read_write> displacement_vector: array<f32>;
@group(0) @binding(6) var<storage, read_write> member_forces: array<MemberForce>;

// Uniforms
struct Uniforms {
    num_nodes: u32,
    num_members: u32,
    num_loads: u32,
    num_dof: u32,
    penalty: f32,
    tolerance: f32,
    max_iterations: u32,
    padding: u32,
}

@group(1) @binding(0) var<uniform> uniforms: Uniforms;

// ============================================================================
// TRUSS ELEMENT STIFFNESS (2 DOF per node - axial only)
// ============================================================================

@compute @workgroup_size(64)
fn compute_truss_stiffness(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let member_idx = global_id.x;
    if (member_idx >= uniforms.num_members) {
        return;
    }
    
    let member = members[member_idx];
    let k = member.e * member.a / member.length;
    
    let c = member.cos_angle;
    let s = member.sin_angle;
    let c2 = c * c * k;
    let s2 = s * s * k;
    let cs = c * s * k;
    
    // DOF indices (2 per node for truss)
    let i0 = member.start_node * 2u;
    let i1 = member.start_node * 2u + 1u;
    let i2 = member.end_node * 2u;
    let i3 = member.end_node * 2u + 1u;
    
    let stride = uniforms.num_dof;
    
    // Atomic add to global stiffness matrix
    // Row i0
    atomicAddF32(&stiffness_matrix[i0 * stride + i0], c2);
    atomicAddF32(&stiffness_matrix[i0 * stride + i1], cs);
    atomicAddF32(&stiffness_matrix[i0 * stride + i2], -c2);
    atomicAddF32(&stiffness_matrix[i0 * stride + i3], -cs);
    
    // Row i1
    atomicAddF32(&stiffness_matrix[i1 * stride + i0], cs);
    atomicAddF32(&stiffness_matrix[i1 * stride + i1], s2);
    atomicAddF32(&stiffness_matrix[i1 * stride + i2], -cs);
    atomicAddF32(&stiffness_matrix[i1 * stride + i3], -s2);
    
    // Row i2
    atomicAddF32(&stiffness_matrix[i2 * stride + i0], -c2);
    atomicAddF32(&stiffness_matrix[i2 * stride + i1], -cs);
    atomicAddF32(&stiffness_matrix[i2 * stride + i2], c2);
    atomicAddF32(&stiffness_matrix[i2 * stride + i3], cs);
    
    // Row i3
    atomicAddF32(&stiffness_matrix[i3 * stride + i0], -cs);
    atomicAddF32(&stiffness_matrix[i3 * stride + i1], -s2);
    atomicAddF32(&stiffness_matrix[i3 * stride + i2], cs);
    atomicAddF32(&stiffness_matrix[i3 * stride + i3], s2);
}

// ============================================================================
// FRAME ELEMENT STIFFNESS (3 DOF per node - axial, shear, moment)
// ============================================================================

@compute @workgroup_size(64)
fn compute_frame_stiffness(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let member_idx = global_id.x;
    if (member_idx >= uniforms.num_members) {
        return;
    }
    
    let member = members[member_idx];
    let l = member.length;
    let e = member.e;
    let a = member.a;
    let i = member.i;
    let c = member.cos_angle;
    let s = member.sin_angle;
    
    // Local stiffness coefficients
    let k1 = e * a / l;
    let k2 = 12.0 * e * i / (l * l * l);
    let k3 = 6.0 * e * i / (l * l);
    let k4 = 4.0 * e * i / l;
    let k5 = 2.0 * e * i / l;
    
    // Pre-compute transformation terms
    let c2 = c * c;
    let s2 = s * s;
    let cs = c * s;
    
    // Global stiffness matrix terms (6x6 -> compressed to upper triangle)
    // Transformed: K_global = T^T * K_local * T
    
    // DOF indices (3 per node for frame)
    let i0 = member.start_node * 3u;
    let i3 = member.end_node * 3u;
    let stride = uniforms.num_dof;
    
    // Compute transformed stiffness terms
    let k11 = k1 * c2 + k2 * s2;
    let k12 = (k1 - k2) * cs;
    let k13 = -k3 * s;
    let k22 = k1 * s2 + k2 * c2;
    let k23 = k3 * c;
    let k33 = k4;
    
    // Assemble (using symmetric property)
    // Start-Start block
    atomicAddF32(&stiffness_matrix[(i0) * stride + i0], k11);
    atomicAddF32(&stiffness_matrix[(i0) * stride + i0 + 1u], k12);
    atomicAddF32(&stiffness_matrix[(i0) * stride + i0 + 2u], k13);
    atomicAddF32(&stiffness_matrix[(i0 + 1u) * stride + i0 + 1u], k22);
    atomicAddF32(&stiffness_matrix[(i0 + 1u) * stride + i0 + 2u], k23);
    atomicAddF32(&stiffness_matrix[(i0 + 2u) * stride + i0 + 2u], k33);
    
    // Start-End block (negative of start-start for most terms)
    atomicAddF32(&stiffness_matrix[(i0) * stride + i3], -k11);
    atomicAddF32(&stiffness_matrix[(i0) * stride + i3 + 1u], -k12);
    atomicAddF32(&stiffness_matrix[(i0) * stride + i3 + 2u], k13);
    atomicAddF32(&stiffness_matrix[(i0 + 1u) * stride + i3], -k12);
    atomicAddF32(&stiffness_matrix[(i0 + 1u) * stride + i3 + 1u], -k22);
    atomicAddF32(&stiffness_matrix[(i0 + 1u) * stride + i3 + 2u], k23);
    atomicAddF32(&stiffness_matrix[(i0 + 2u) * stride + i3], -k13);
    atomicAddF32(&stiffness_matrix[(i0 + 2u) * stride + i3 + 1u], -k23);
    atomicAddF32(&stiffness_matrix[(i0 + 2u) * stride + i3 + 2u], k5);
    
    // End-End block
    atomicAddF32(&stiffness_matrix[(i3) * stride + i3], k11);
    atomicAddF32(&stiffness_matrix[(i3) * stride + i3 + 1u], k12);
    atomicAddF32(&stiffness_matrix[(i3) * stride + i3 + 2u], -k13);
    atomicAddF32(&stiffness_matrix[(i3 + 1u) * stride + i3 + 1u], k22);
    atomicAddF32(&stiffness_matrix[(i3 + 1u) * stride + i3 + 2u], -k23);
    atomicAddF32(&stiffness_matrix[(i3 + 2u) * stride + i3 + 2u], k33);
}

// ============================================================================
// APPLY LOADS TO FORCE VECTOR
// ============================================================================

@compute @workgroup_size(64)
fn apply_loads(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let load_idx = global_id.x;
    if (load_idx >= uniforms.num_loads) {
        return;
    }
    
    let load = loads[load_idx];
    let base_dof = load.node_id * 3u; // 3 DOF per node for frame
    
    atomicAddF32(&force_vector[base_dof], load.fx);
    atomicAddF32(&force_vector[base_dof + 1u], load.fy);
    atomicAddF32(&force_vector[base_dof + 2u], load.fz); // Moment for 2D, Fz for 3D
}

// ============================================================================
// CONJUGATE GRADIENT SOLVER (GPU-parallel)
// ============================================================================

@group(2) @binding(0) var<storage, read_write> cg_r: array<f32>;      // Residual
@group(2) @binding(1) var<storage, read_write> cg_p: array<f32>;      // Search direction
@group(2) @binding(2) var<storage, read_write> cg_Ap: array<f32>;     // A * p
@group(2) @binding(3) var<storage, read_write> cg_scalars: array<f32>; // [r_dot_r, p_dot_Ap, alpha, beta]

// Initialize CG solver
@compute @workgroup_size(256)
fn cg_initialize(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= uniforms.num_dof) {
        return;
    }
    
    // r = b - A*x (initial x = 0, so r = b)
    cg_r[idx] = force_vector[idx];
    cg_p[idx] = force_vector[idx];
    displacement_vector[idx] = 0.0;
}

// Compute A * p (matrix-vector multiplication)
@compute @workgroup_size(256)
fn cg_matrix_vector(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let row = global_id.x;
    if (row >= uniforms.num_dof) {
        return;
    }
    
    var sum: f32 = 0.0;
    let stride = uniforms.num_dof;
    
    // Sparse-aware multiplication (skip zeros)
    for (var col: u32 = 0u; col < uniforms.num_dof; col = col + 1u) {
        let val = stiffness_matrix[row * stride + col];
        if (abs(val) > 1e-12) {
            sum = sum + val * cg_p[col];
        }
    }
    
    cg_Ap[row] = sum;
}

// Compute dot products (parallel reduction)
@compute @workgroup_size(256)
fn cg_dot_products(@builtin(global_invocation_id) global_id: vec3<u32>,
                   @builtin(local_invocation_id) local_id: vec3<u32>,
                   @builtin(workgroup_id) wg_id: vec3<u32>) {
    var<workgroup> shared_r_dot_r: array<f32, 256>;
    var<workgroup> shared_p_dot_Ap: array<f32, 256>;
    
    let idx = global_id.x;
    let lid = local_id.x;
    
    // Load data
    if (idx < uniforms.num_dof) {
        shared_r_dot_r[lid] = cg_r[idx] * cg_r[idx];
        shared_p_dot_Ap[lid] = cg_p[idx] * cg_Ap[idx];
    } else {
        shared_r_dot_r[lid] = 0.0;
        shared_p_dot_Ap[lid] = 0.0;
    }
    
    workgroupBarrier();
    
    // Parallel reduction
    for (var s: u32 = 128u; s > 0u; s = s >> 1u) {
        if (lid < s) {
            shared_r_dot_r[lid] = shared_r_dot_r[lid] + shared_r_dot_r[lid + s];
            shared_p_dot_Ap[lid] = shared_p_dot_Ap[lid] + shared_p_dot_Ap[lid + s];
        }
        workgroupBarrier();
    }
    
    // Write partial results
    if (lid == 0u) {
        atomicAddF32(&cg_scalars[0], shared_r_dot_r[0]); // r_dot_r
        atomicAddF32(&cg_scalars[1], shared_p_dot_Ap[0]); // p_dot_Ap
    }
}

// Update solution and residual
@compute @workgroup_size(256)
fn cg_update(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= uniforms.num_dof) {
        return;
    }
    
    let alpha = cg_scalars[2];
    let beta = cg_scalars[3];
    
    // x = x + alpha * p
    displacement_vector[idx] = displacement_vector[idx] + alpha * cg_p[idx];
    
    // r = r - alpha * Ap
    let r_old = cg_r[idx];
    cg_r[idx] = r_old - alpha * cg_Ap[idx];
    
    // p = r + beta * p
    cg_p[idx] = cg_r[idx] + beta * cg_p[idx];
}

// ============================================================================
// MEMBER FORCE CALCULATION
// ============================================================================

@compute @workgroup_size(64)
fn compute_member_forces(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let member_idx = global_id.x;
    if (member_idx >= uniforms.num_members) {
        return;
    }
    
    let member = members[member_idx];
    let c = member.cos_angle;
    let s = member.sin_angle;
    let l = member.length;
    
    // Get displacements
    let i0 = member.start_node * 3u;
    let i3 = member.end_node * 3u;
    
    let u1 = displacement_vector[i0];
    let v1 = displacement_vector[i0 + 1u];
    let r1 = displacement_vector[i0 + 2u];
    let u2 = displacement_vector[i3];
    let v2 = displacement_vector[i3 + 1u];
    let r2 = displacement_vector[i3 + 2u];
    
    // Transform to local coordinates
    let u1_local = c * u1 + s * v1;
    let v1_local = -s * u1 + c * v1;
    let u2_local = c * u2 + s * v2;
    let v2_local = -s * u2 + c * v2;
    
    // Calculate forces
    let e = member.e;
    let a = member.a;
    let i = member.i;
    
    // Axial force
    let axial = e * a / l * (u2_local - u1_local);
    
    // Shear and moment
    let k2 = 12.0 * e * i / (l * l * l);
    let k3 = 6.0 * e * i / (l * l);
    let k4 = 4.0 * e * i / l;
    let k5 = 2.0 * e * i / l;
    
    let shear = k2 * (v1_local - v2_local) + k3 * (r1 + r2);
    let m_start = k3 * (v1_local - v2_local) + k4 * r1 + k5 * r2;
    let m_end = k3 * (v1_local - v2_local) + k5 * r1 + k4 * r2;
    
    member_forces[member_idx] = MemberForce(axial, shear, m_start, m_end);
}

// ============================================================================
// MESH PROCESSING FOR RENDERING
// ============================================================================

struct Vertex {
    position: vec3<f32>,
    normal: vec3<f32>,
    uv: vec2<f32>,
}

struct CompressedVertex {
    position: u32,  // Quantized to 16-bit per component, packed
    normal: u32,    // Octahedral encoded
    uv: u32,        // 16-bit per component
}

@group(3) @binding(0) var<storage, read> input_vertices: array<Vertex>;
@group(3) @binding(1) var<storage, read_write> output_vertices: array<CompressedVertex>;
@group(3) @binding(2) var<uniform> mesh_bounds: vec4<f32>; // min_x, min_y, min_z, scale

// Compress vertices (quantization + octahedral normal encoding)
@compute @workgroup_size(256)
fn compress_vertices(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&input_vertices)) {
        return;
    }
    
    let v = input_vertices[idx];
    
    // Quantize position to 16-bit
    let scale = mesh_bounds.w;
    let normalized = (v.position - mesh_bounds.xyz) / scale;
    let quantized = vec3<u32>(
        u32(clamp(normalized.x * 65535.0, 0.0, 65535.0)),
        u32(clamp(normalized.y * 65535.0, 0.0, 65535.0)),
        u32(clamp(normalized.z * 65535.0, 0.0, 65535.0))
    );
    
    // Pack position (x,y in first u32, z in second with uv)
    let pos_packed = (quantized.x & 0xFFFFu) | ((quantized.y & 0xFFFFu) << 16u);
    
    // Octahedral normal encoding
    let n = normalize(v.normal);
    let oct = octahedron_encode(n);
    let normal_packed = (u32(oct.x * 32767.0 + 32768.0) & 0xFFFFu) | 
                        ((u32(oct.y * 32767.0 + 32768.0) & 0xFFFFu) << 16u);
    
    // UV packing
    let uv_packed = (u32(clamp(v.uv.x * 65535.0, 0.0, 65535.0)) & 0xFFFFu) |
                   ((u32(clamp(v.uv.y * 65535.0, 0.0, 65535.0)) & 0xFFFFu) << 16u);
    
    output_vertices[idx] = CompressedVertex(pos_packed, normal_packed, uv_packed);
}

// Octahedral normal encoding (2D to unit sphere)
fn octahedron_encode(n: vec3<f32>) -> vec2<f32> {
    let sum = abs(n.x) + abs(n.y) + abs(n.z);
    var oct = n.xy / sum;
    
    if (n.z < 0.0) {
        oct = (1.0 - abs(oct.yx)) * sign_not_zero(oct);
    }
    
    return oct;
}

fn sign_not_zero(v: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(
        select(-1.0, 1.0, v.x >= 0.0),
        select(-1.0, 1.0, v.y >= 0.0)
    );
}

// ============================================================================
// LOD MESH SIMPLIFICATION (Edge Collapse)
// ============================================================================

struct Edge {
    v0: u32,
    v1: u32,
    error: f32,
    collapsed: u32,
}

@group(4) @binding(0) var<storage, read_write> edges: array<Edge>;
@group(4) @binding(1) var<storage, read_write> vertex_quadrics: array<Vec4x4>;
@group(4) @binding(2) var<uniform> lod_params: vec4<f32>; // target_ratio, threshold, 0, 0

// Compute edge collapse error using Quadric Error Metrics
@compute @workgroup_size(256)
fn compute_edge_errors(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let edge_idx = global_id.x;
    if (edge_idx >= arrayLength(&edges)) {
        return;
    }
    
    var edge = edges[edge_idx];
    if (edge.collapsed != 0u) {
        return;
    }
    
    let q0 = vertex_quadrics[edge.v0];
    let q1 = vertex_quadrics[edge.v1];
    
    // Sum quadrics
    var q_sum: Vec4x4;
    for (var i: u32 = 0u; i < 4u; i = i + 1u) {
        q_sum.data[i] = q0.data[i] + q1.data[i];
    }
    
    // Compute optimal vertex position and error
    // Using midpoint approximation for speed
    let v0 = input_vertices[edge.v0].position;
    let v1 = input_vertices[edge.v1].position;
    let mid = (v0 + v1) * 0.5;
    
    // Evaluate quadric error at midpoint
    let v4 = vec4<f32>(mid, 1.0);
    var error: f32 = 0.0;
    for (var i: u32 = 0u; i < 4u; i = i + 1u) {
        error = error + dot(v4, q_sum.data[i]) * v4[i];
    }
    
    edge.error = error;
    edges[edge_idx] = edge;
}

// ============================================================================
// FRUSTUM CULLING (Octree traversal on GPU)
// ============================================================================

struct OctreeNode {
    bounds_min: vec3<f32>,
    bounds_max: vec3<f32>,
    child_offset: u32,  // 0 = leaf
    object_start: u32,
    object_count: u32,
    padding: u32,
}

struct FrustumPlane {
    normal: vec3<f32>,
    distance: f32,
}

@group(5) @binding(0) var<storage, read> octree_nodes: array<OctreeNode>;
@group(5) @binding(1) var<storage, read> frustum_planes: array<FrustumPlane, 6>;
@group(5) @binding(2) var<storage, read_write> visible_objects: array<u32>;
@group(5) @binding(3) var<storage, read_write> visible_count: atomic<u32>;

@compute @workgroup_size(64)
fn frustum_cull_octree(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let node_idx = global_id.x;
    if (node_idx >= arrayLength(&octree_nodes)) {
        return;
    }
    
    let node = octree_nodes[node_idx];
    
    // Test AABB against frustum
    let center = (node.bounds_min + node.bounds_max) * 0.5;
    let extent = (node.bounds_max - node.bounds_min) * 0.5;
    
    var visible = true;
    for (var i: u32 = 0u; i < 6u; i = i + 1u) {
        let plane = frustum_planes[i];
        let r = dot(extent, abs(plane.normal));
        let d = dot(center, plane.normal) + plane.distance;
        
        if (d + r < 0.0) {
            visible = false;
            break;
        }
    }
    
    // If visible and is a leaf node, add objects to visible list
    if (visible && node.child_offset == 0u && node.object_count > 0u) {
        let base_idx = atomicAdd(&visible_count, node.object_count);
        for (var i: u32 = 0u; i < node.object_count; i = i + 1u) {
            visible_objects[base_idx + i] = node.object_start + i;
        }
    }
}

// ============================================================================
// INSTANCE BUFFER GENERATION
// ============================================================================

struct InstanceData {
    model_matrix: mat4x4<f32>,
    color: vec4<f32>,
    metadata: vec4<f32>,
}

struct InstanceInput {
    position: vec3<f32>,
    rotation: vec4<f32>,  // Quaternion
    scale: vec3<f32>,
    color: vec4<f32>,
}

@group(6) @binding(0) var<storage, read> instance_inputs: array<InstanceInput>;
@group(6) @binding(1) var<storage, read_write> instance_outputs: array<InstanceData>;

@compute @workgroup_size(256)
fn generate_instance_matrices(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&instance_inputs)) {
        return;
    }
    
    let input = instance_inputs[idx];
    
    // Quaternion to rotation matrix
    let q = input.rotation;
    let x2 = q.x + q.x;
    let y2 = q.y + q.y;
    let z2 = q.z + q.z;
    let xx = q.x * x2;
    let xy = q.x * y2;
    let xz = q.x * z2;
    let yy = q.y * y2;
    let yz = q.y * z2;
    let zz = q.z * z2;
    let wx = q.w * x2;
    let wy = q.w * y2;
    let wz = q.w * z2;
    
    let rot = mat3x3<f32>(
        vec3<f32>(1.0 - (yy + zz), xy + wz, xz - wy),
        vec3<f32>(xy - wz, 1.0 - (xx + zz), yz + wx),
        vec3<f32>(xz + wy, yz - wx, 1.0 - (xx + yy))
    );
    
    // Build model matrix: TRS
    let s = input.scale;
    let model = mat4x4<f32>(
        vec4<f32>(rot[0] * s.x, 0.0),
        vec4<f32>(rot[1] * s.y, 0.0),
        vec4<f32>(rot[2] * s.z, 0.0),
        vec4<f32>(input.position, 1.0)
    );
    
    instance_outputs[idx] = InstanceData(model, input.color, vec4<f32>(0.0));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Atomic float add using CAS loop (WGSL doesn't have native atomic float)
fn atomicAddF32(addr: ptr<storage, f32, read_write>, value: f32) {
    // Note: In real WGSL, we'd use atomicCompareExchangeWeak with bit casting
    // This is a simplified representation - actual implementation needs atomic u32
    *addr = *addr + value;
}

// ============================================================================
// STRESS/STRAIN VISUALIZATION
// ============================================================================

struct StressResult {
    von_mises: f32,
    principal_1: f32,
    principal_2: f32,
    principal_3: f32,
}

@group(7) @binding(0) var<storage, read> stress_tensors: array<mat3x3<f32>>;
@group(7) @binding(1) var<storage, read_write> stress_results: array<StressResult>;

@compute @workgroup_size(256)
fn compute_principal_stresses(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= arrayLength(&stress_tensors)) {
        return;
    }
    
    let s = stress_tensors[idx];
    
    // Stress invariants
    let I1 = s[0][0] + s[1][1] + s[2][2];
    let I2 = s[0][0]*s[1][1] + s[1][1]*s[2][2] + s[2][2]*s[0][0] 
           - s[0][1]*s[0][1] - s[1][2]*s[1][2] - s[2][0]*s[2][0];
    let I3 = determinant(s);
    
    // Solve cubic equation for principal stresses
    let p = I1 / 3.0;
    let q = (2.0*I1*I1*I1 - 9.0*I1*I2 + 27.0*I3) / 54.0;
    let r = sqrt(max((I1*I1 - 3.0*I2) / 9.0, 0.0));
    
    let theta = acos(clamp(q / (r*r*r + 1e-10), -1.0, 1.0)) / 3.0;
    
    let s1 = p + 2.0*r*cos(theta);
    let s2 = p + 2.0*r*cos(theta + 2.0944); // 2π/3
    let s3 = p + 2.0*r*cos(theta + 4.1888); // 4π/3
    
    // Von Mises stress
    let vm = sqrt(0.5*((s1-s2)*(s1-s2) + (s2-s3)*(s2-s3) + (s3-s1)*(s3-s1)));
    
    stress_results[idx] = StressResult(vm, s1, s2, s3);
}

fn determinant(m: mat3x3<f32>) -> f32 {
    return m[0][0] * (m[1][1]*m[2][2] - m[1][2]*m[2][1])
         - m[0][1] * (m[1][0]*m[2][2] - m[1][2]*m[2][0])
         + m[0][2] * (m[1][0]*m[2][1] - m[1][1]*m[2][0]);
}
