//! # SIMD-Optimized Computations
//!
//! Ultra-lightweight CPU computations using explicit SIMD vectorization.
//! Optimized for minimal CPU cycles and cache-friendly memory access.

use std::mem;

// ============================================================================
// SIMD VECTOR TYPES (Portable)
// ============================================================================

/// 4-wide f32 vector for SIMD operations
#[repr(C, align(16))]
#[derive(Clone, Copy, Debug)]
pub struct F32x4 {
    pub data: [f32; 4],
}

impl F32x4 {
    #[inline(always)]
    pub const fn new(a: f32, b: f32, c: f32, d: f32) -> Self {
        Self { data: [a, b, c, d] }
    }

    #[inline(always)]
    pub const fn splat(v: f32) -> Self {
        Self { data: [v, v, v, v] }
    }

    #[inline(always)]
    pub const fn zero() -> Self {
        Self::splat(0.0)
    }

    #[inline(always)]
    pub fn add(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0] + other.data[0],
                self.data[1] + other.data[1],
                self.data[2] + other.data[2],
                self.data[3] + other.data[3],
            ],
        }
    }

    #[inline(always)]
    pub fn sub(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0] - other.data[0],
                self.data[1] - other.data[1],
                self.data[2] - other.data[2],
                self.data[3] - other.data[3],
            ],
        }
    }

    #[inline(always)]
    pub fn mul(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0] * other.data[0],
                self.data[1] * other.data[1],
                self.data[2] * other.data[2],
                self.data[3] * other.data[3],
            ],
        }
    }

    #[inline(always)]
    pub fn div(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0] / other.data[0],
                self.data[1] / other.data[1],
                self.data[2] / other.data[2],
                self.data[3] / other.data[3],
            ],
        }
    }

    #[inline(always)]
    pub fn mul_add(self, mul: Self, add: Self) -> Self {
        Self {
            data: [
                self.data[0] * mul.data[0] + add.data[0],
                self.data[1] * mul.data[1] + add.data[1],
                self.data[2] * mul.data[2] + add.data[2],
                self.data[3] * mul.data[3] + add.data[3],
            ],
        }
    }

    #[inline(always)]
    pub fn horizontal_sum(self) -> f32 {
        self.data[0] + self.data[1] + self.data[2] + self.data[3]
    }

    #[inline(always)]
    pub fn dot(self, other: Self) -> f32 {
        self.mul(other).horizontal_sum()
    }

    #[inline(always)]
    pub fn min(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0].min(other.data[0]),
                self.data[1].min(other.data[1]),
                self.data[2].min(other.data[2]),
                self.data[3].min(other.data[3]),
            ],
        }
    }

    #[inline(always)]
    pub fn max(self, other: Self) -> Self {
        Self {
            data: [
                self.data[0].max(other.data[0]),
                self.data[1].max(other.data[1]),
                self.data[2].max(other.data[2]),
                self.data[3].max(other.data[3]),
            ],
        }
    }

    #[inline(always)]
    pub fn sqrt(self) -> Self {
        Self {
            data: [
                self.data[0].sqrt(),
                self.data[1].sqrt(),
                self.data[2].sqrt(),
                self.data[3].sqrt(),
            ],
        }
    }

    #[inline(always)]
    pub fn abs(self) -> Self {
        Self {
            data: [
                self.data[0].abs(),
                self.data[1].abs(),
                self.data[2].abs(),
                self.data[3].abs(),
            ],
        }
    }

    #[inline(always)]
    pub fn reciprocal(self) -> Self {
        Self {
            data: [
                1.0 / self.data[0],
                1.0 / self.data[1],
                1.0 / self.data[2],
                1.0 / self.data[3],
            ],
        }
    }
}

// ============================================================================
// 8-WIDE SIMD FOR AVX (when available)
// ============================================================================

/// 8-wide f32 vector for AVX operations
#[repr(C, align(32))]
#[derive(Clone, Copy, Debug)]
pub struct F32x8 {
    pub data: [f32; 8],
}

impl F32x8 {
    #[inline(always)]
    pub const fn splat(v: f32) -> Self {
        Self { data: [v; 8] }
    }

    #[inline(always)]
    pub const fn zero() -> Self {
        Self::splat(0.0)
    }

    #[inline(always)]
    pub fn from_slice(s: &[f32]) -> Self {
        let mut data = [0.0f32; 8];
        let len = s.len().min(8);
        data[..len].copy_from_slice(&s[..len]);
        Self { data }
    }

    #[inline(always)]
    pub fn add(self, other: Self) -> Self {
        let mut result = [0.0f32; 8];
        for i in 0..8 {
            result[i] = self.data[i] + other.data[i];
        }
        Self { data: result }
    }

    #[inline(always)]
    pub fn mul(self, other: Self) -> Self {
        let mut result = [0.0f32; 8];
        for i in 0..8 {
            result[i] = self.data[i] * other.data[i];
        }
        Self { data: result }
    }

    #[inline(always)]
    pub fn mul_add(self, mul: Self, add: Self) -> Self {
        let mut result = [0.0f32; 8];
        for i in 0..8 {
            result[i] = self.data[i] * mul.data[i] + add.data[i];
        }
        Self { data: result }
    }

    #[inline(always)]
    pub fn horizontal_sum(self) -> f32 {
        self.data.iter().sum()
    }
}

// ============================================================================
// SIMD MATRIX OPERATIONS (4x4)
// ============================================================================

/// SIMD-optimized 4x4 matrix (column-major)
#[repr(C, align(64))]
#[derive(Clone, Copy, Debug)]
pub struct Mat4x4Simd {
    pub cols: [F32x4; 4],
}

impl Mat4x4Simd {
    #[inline(always)]
    pub const fn identity() -> Self {
        Self {
            cols: [
                F32x4::new(1.0, 0.0, 0.0, 0.0),
                F32x4::new(0.0, 1.0, 0.0, 0.0),
                F32x4::new(0.0, 0.0, 1.0, 0.0),
                F32x4::new(0.0, 0.0, 0.0, 1.0),
            ],
        }
    }

    #[inline(always)]
    pub const fn zero() -> Self {
        Self {
            cols: [F32x4::zero(), F32x4::zero(), F32x4::zero(), F32x4::zero()],
        }
    }

    /// Matrix-vector multiplication
    #[inline(always)]
    pub fn mul_vec4(self, v: F32x4) -> F32x4 {
        let x = F32x4::splat(v.data[0]);
        let y = F32x4::splat(v.data[1]);
        let z = F32x4::splat(v.data[2]);
        let w = F32x4::splat(v.data[3]);

        self.cols[0]
            .mul(x)
            .add(self.cols[1].mul(y))
            .add(self.cols[2].mul(z))
            .add(self.cols[3].mul(w))
    }

    /// Matrix-matrix multiplication
    #[inline(always)]
    pub fn mul_mat4(self, other: Self) -> Self {
        Self {
            cols: [
                self.mul_vec4(other.cols[0]),
                self.mul_vec4(other.cols[1]),
                self.mul_vec4(other.cols[2]),
                self.mul_vec4(other.cols[3]),
            ],
        }
    }

    /// Transpose
    #[inline(always)]
    pub fn transpose(self) -> Self {
        Self {
            cols: [
                F32x4::new(
                    self.cols[0].data[0],
                    self.cols[1].data[0],
                    self.cols[2].data[0],
                    self.cols[3].data[0],
                ),
                F32x4::new(
                    self.cols[0].data[1],
                    self.cols[1].data[1],
                    self.cols[2].data[1],
                    self.cols[3].data[1],
                ),
                F32x4::new(
                    self.cols[0].data[2],
                    self.cols[1].data[2],
                    self.cols[2].data[2],
                    self.cols[3].data[2],
                ),
                F32x4::new(
                    self.cols[0].data[3],
                    self.cols[1].data[3],
                    self.cols[2].data[3],
                    self.cols[3].data[3],
                ),
            ],
        }
    }

    /// Create translation matrix
    #[inline(always)]
    pub fn translation(x: f32, y: f32, z: f32) -> Self {
        Self {
            cols: [
                F32x4::new(1.0, 0.0, 0.0, 0.0),
                F32x4::new(0.0, 1.0, 0.0, 0.0),
                F32x4::new(0.0, 0.0, 1.0, 0.0),
                F32x4::new(x, y, z, 1.0),
            ],
        }
    }

    /// Create scale matrix
    #[inline(always)]
    pub fn scale(x: f32, y: f32, z: f32) -> Self {
        Self {
            cols: [
                F32x4::new(x, 0.0, 0.0, 0.0),
                F32x4::new(0.0, y, 0.0, 0.0),
                F32x4::new(0.0, 0.0, z, 0.0),
                F32x4::new(0.0, 0.0, 0.0, 1.0),
            ],
        }
    }

    /// Create rotation matrix from quaternion
    #[inline(always)]
    pub fn from_quaternion(q: F32x4) -> Self {
        let x = q.data[0];
        let y = q.data[1];
        let z = q.data[2];
        let w = q.data[3];

        let x2 = x + x;
        let y2 = y + y;
        let z2 = z + z;
        let xx = x * x2;
        let xy = x * y2;
        let xz = x * z2;
        let yy = y * y2;
        let yz = y * z2;
        let zz = z * z2;
        let wx = w * x2;
        let wy = w * y2;
        let wz = w * z2;

        Self {
            cols: [
                F32x4::new(1.0 - (yy + zz), xy + wz, xz - wy, 0.0),
                F32x4::new(xy - wz, 1.0 - (xx + zz), yz + wx, 0.0),
                F32x4::new(xz + wy, yz - wx, 1.0 - (xx + yy), 0.0),
                F32x4::new(0.0, 0.0, 0.0, 1.0),
            ],
        }
    }
}

// ============================================================================
// SIMD 6x6 MATRIX FOR FRAME ELEMENTS
// ============================================================================

/// SIMD-optimized 6x6 stiffness matrix
#[repr(C, align(64))]
#[derive(Clone, Copy)]
pub struct Mat6x6Simd {
    /// Stored as 9 blocks of 2x2 for SIMD efficiency + remainder
    pub data: [f32; 36],
}

impl Mat6x6Simd {
    #[inline(always)]
    pub const fn zero() -> Self {
        Self { data: [0.0; 36] }
    }

    #[inline(always)]
    pub fn get(&self, row: usize, col: usize) -> f32 {
        self.data[row * 6 + col]
    }

    #[inline(always)]
    pub fn set(&mut self, row: usize, col: usize, val: f32) {
        self.data[row * 6 + col] = val;
    }

    #[inline(always)]
    pub fn add_assign(&mut self, row: usize, col: usize, val: f32) {
        self.data[row * 6 + col] += val;
    }

    /// SIMD matrix-vector multiply (6x6 * 6x1)
    #[inline]
    pub fn mul_vec6(&self, v: &[f32; 6]) -> [f32; 6] {
        let mut result = [0.0f32; 6];

        // Process 4 columns at a time using SIMD
        for row in 0..6 {
            let row_offset = row * 6;

            // First 4 elements
            let m = F32x4::new(
                self.data[row_offset],
                self.data[row_offset + 1],
                self.data[row_offset + 2],
                self.data[row_offset + 3],
            );
            let v4 = F32x4::new(v[0], v[1], v[2], v[3]);
            let sum4 = m.mul(v4).horizontal_sum();

            // Last 2 elements
            let sum2 = self.data[row_offset + 4] * v[4] + self.data[row_offset + 5] * v[5];

            result[row] = sum4 + sum2;
        }

        result
    }

    /// Frame element stiffness matrix in local coordinates
    #[inline]
    pub fn frame_local_stiffness(e: f32, a: f32, i: f32, l: f32) -> Self {
        let k1 = e * a / l;
        let k2 = 12.0 * e * i / (l * l * l);
        let k3 = 6.0 * e * i / (l * l);
        let k4 = 4.0 * e * i / l;
        let k5 = 2.0 * e * i / l;

        #[rustfmt::skip]
        let data = [
            k1,   0.0,   0.0, -k1,   0.0,   0.0,
            0.0,  k2,    k3,   0.0, -k2,    k3,
            0.0,  k3,    k4,   0.0, -k3,    k5,
           -k1,   0.0,   0.0,  k1,   0.0,   0.0,
            0.0, -k2,   -k3,   0.0,  k2,   -k3,
            0.0,  k3,    k5,   0.0, -k3,    k4,
        ];

        Self { data }
    }

    /// Transform local to global coordinates
    #[inline]
    pub fn transform_to_global(&self, cos: f32, sin: f32) -> Self {
        let c = cos;
        let s = sin;
        let c2 = c * c;
        let s2 = s * s;
        let cs = c * s;

        // Build transformation matrix
        #[rustfmt::skip]
        let t_data: [f32; 36] = [
             c,   s, 0.0,  0.0, 0.0, 0.0,
            -s,   c, 0.0,  0.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0,  c,   s, 0.0,
            0.0, 0.0, 0.0, -s,   c, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ];

        // K_global = T^T * K_local * T
        // Optimized direct computation for frame elements
        let mut result = Self::zero();

        for i in 0..6 {
            for j in 0..6 {
                let mut sum = 0.0;
                for k in 0..6 {
                    for l in 0..6 {
                        sum += t_data[k * 6 + i] * self.data[k * 6 + l] * t_data[l * 6 + j];
                    }
                }
                result.data[i * 6 + j] = sum;
            }
        }

        result
    }
}

// ============================================================================
// VECTORIZED BATCH OPERATIONS
// ============================================================================

/// Process multiple nodes in parallel using SIMD
#[inline]
pub fn batch_compute_member_lengths(
    nodes_x: &[f32],
    nodes_y: &[f32],
    member_start: &[u32],
    member_end: &[u32],
    lengths: &mut [f32],
    cos_angles: &mut [f32],
    sin_angles: &mut [f32],
) {
    let n = member_start.len();
    let mut i = 0;

    // Process 4 members at a time
    while i + 4 <= n {
        let s0 = member_start[i] as usize;
        let s1 = member_start[i + 1] as usize;
        let s2 = member_start[i + 2] as usize;
        let s3 = member_start[i + 3] as usize;

        let e0 = member_end[i] as usize;
        let e1 = member_end[i + 1] as usize;
        let e2 = member_end[i + 2] as usize;
        let e3 = member_end[i + 3] as usize;

        let dx = F32x4::new(
            nodes_x[e0] - nodes_x[s0],
            nodes_x[e1] - nodes_x[s1],
            nodes_x[e2] - nodes_x[s2],
            nodes_x[e3] - nodes_x[s3],
        );

        let dy = F32x4::new(
            nodes_y[e0] - nodes_y[s0],
            nodes_y[e1] - nodes_y[s1],
            nodes_y[e2] - nodes_y[s2],
            nodes_y[e3] - nodes_y[s3],
        );

        let dx2 = dx.mul(dx);
        let dy2 = dy.mul(dy);
        let len2 = dx2.add(dy2);
        let len = len2.sqrt();
        let inv_len = len.reciprocal();

        let cos_a = dx.mul(inv_len);
        let sin_a = dy.mul(inv_len);

        lengths[i..i + 4].copy_from_slice(&len.data);
        cos_angles[i..i + 4].copy_from_slice(&cos_a.data);
        sin_angles[i..i + 4].copy_from_slice(&sin_a.data);

        i += 4;
    }

    // Handle remainder
    while i < n {
        let s = member_start[i] as usize;
        let e = member_end[i] as usize;
        let dx = nodes_x[e] - nodes_x[s];
        let dy = nodes_y[e] - nodes_y[s];
        let len = (dx * dx + dy * dy).sqrt();
        lengths[i] = len;
        cos_angles[i] = dx / len;
        sin_angles[i] = dy / len;
        i += 1;
    }
}

/// SIMD dot product for large vectors
#[inline]
pub fn simd_dot_product(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len());
    let mut sum = F32x8::zero();
    let mut i = 0;

    // Process 8 elements at a time
    while i + 8 <= n {
        let va = F32x8::from_slice(&a[i..]);
        let vb = F32x8::from_slice(&b[i..]);
        sum = sum.add(va.mul(vb));
        i += 8;
    }

    let mut result = sum.horizontal_sum();

    // Handle remainder
    while i < n {
        result += a[i] * b[i];
        i += 1;
    }

    result
}

/// SIMD vector addition: c = a + alpha * b
#[inline]
pub fn simd_axpy(alpha: f32, a: &[f32], b: &[f32], c: &mut [f32]) {
    let n = a.len().min(b.len()).min(c.len());
    let alpha_vec = F32x8::splat(alpha);
    let mut i = 0;

    while i + 8 <= n {
        let va = F32x8::from_slice(&a[i..]);
        let vb = F32x8::from_slice(&b[i..]);
        let vc = va.add(vb.mul(alpha_vec));
        c[i..i + 8].copy_from_slice(&vc.data);
        i += 8;
    }

    while i < n {
        c[i] = a[i] + alpha * b[i];
        i += 1;
    }
}

/// SIMD sparse matrix-vector multiplication (CSR format)
#[inline]
pub fn simd_spmv_csr(
    values: &[f32],
    col_indices: &[u32],
    row_ptr: &[u32],
    x: &[f32],
    y: &mut [f32],
) {
    let num_rows = row_ptr.len() - 1;

    for row in 0..num_rows {
        let start = row_ptr[row] as usize;
        let end = row_ptr[row + 1] as usize;
        let mut sum = F32x4::zero();
        let mut j = start;

        // Process 4 non-zeros at a time
        while j + 4 <= end {
            let vals = F32x4::new(values[j], values[j + 1], values[j + 2], values[j + 3]);

            let cols = [
                col_indices[j] as usize,
                col_indices[j + 1] as usize,
                col_indices[j + 2] as usize,
                col_indices[j + 3] as usize,
            ];

            let x_vals = F32x4::new(x[cols[0]], x[cols[1]], x[cols[2]], x[cols[3]]);

            sum = sum.add(vals.mul(x_vals));
            j += 4;
        }

        let mut scalar_sum = sum.horizontal_sum();

        // Handle remainder
        while j < end {
            scalar_sum += values[j] * x[col_indices[j] as usize];
            j += 1;
        }

        y[row] = scalar_sum;
    }
}

// ============================================================================
// SIMD CONJUGATE GRADIENT SOLVER
// ============================================================================

/// SIMD-optimized Conjugate Gradient solver
pub struct SimdCGSolver {
    /// Maximum iterations
    pub max_iter: usize,
    /// Convergence tolerance
    pub tolerance: f32,
}

impl SimdCGSolver {
    pub fn new(max_iter: usize, tolerance: f32) -> Self {
        Self { max_iter, tolerance }
    }

    /// Solve Ax = b using Conjugate Gradient with SIMD acceleration
    #[inline]
    pub fn solve_csr(
        &self,
        values: &[f32],
        col_indices: &[u32],
        row_ptr: &[u32],
        b: &[f32],
        x: &mut [f32],
    ) -> (bool, usize) {
        let n = b.len();

        // Allocate work vectors
        let mut r = vec![0.0f32; n];
        let mut p = vec![0.0f32; n];
        let mut ap = vec![0.0f32; n];
        let mut temp = vec![0.0f32; n];

        // r = b - A*x (initial x = 0, so r = b)
        r.copy_from_slice(b);
        p.copy_from_slice(b);

        let mut r_dot_r = simd_dot_product(&r, &r);

        for iter in 0..self.max_iter {
            // Check convergence
            if r_dot_r.sqrt() < self.tolerance {
                return (true, iter);
            }

            // ap = A * p
            simd_spmv_csr(values, col_indices, row_ptr, &p, &mut ap);

            // alpha = r_dot_r / (p · ap)
            let p_dot_ap = simd_dot_product(&p, &ap);
            if p_dot_ap.abs() < 1e-20 {
                return (false, iter);
            }
            let alpha = r_dot_r / p_dot_ap;

            // x = x + alpha * p (using temp to avoid borrow conflict)
            simd_axpy(alpha, x, &p, &mut temp);
            x.copy_from_slice(&temp);

            // r = r - alpha * ap (using temp to avoid borrow conflict)
            simd_axpy(-alpha, &r, &ap, &mut temp);
            r.copy_from_slice(&temp);

            // beta = r_new · r_new / r_old · r_old
            let r_dot_r_new = simd_dot_product(&r, &r);
            let beta = r_dot_r_new / r_dot_r;
            r_dot_r = r_dot_r_new;

            // p = r + beta * p (using temp to avoid borrow conflict)
            simd_axpy(beta, &r, &p, &mut temp);
            p.copy_from_slice(&temp);
        }

        (false, self.max_iter)
    }
}

// ============================================================================
// SIMD MESH OPERATIONS
// ============================================================================

/// SIMD-accelerated AABB computation
#[inline]
pub fn simd_compute_aabb(vertices: &[f32]) -> (F32x4, F32x4) {
    // vertices layout: [x0, y0, z0, x1, y1, z1, ...]
    let n = vertices.len() / 3;
    if n == 0 {
        return (F32x4::zero(), F32x4::zero());
    }

    let mut min_x = F32x4::splat(f32::MAX);
    let mut min_y = F32x4::splat(f32::MAX);
    let mut min_z = F32x4::splat(f32::MAX);
    let mut max_x = F32x4::splat(f32::MIN);
    let mut max_y = F32x4::splat(f32::MIN);
    let mut max_z = F32x4::splat(f32::MIN);

    let mut i = 0;

    // Process 4 vertices at a time
    while i + 4 <= n {
        let base = i * 3;
        let x = F32x4::new(
            vertices[base],
            vertices[base + 3],
            vertices[base + 6],
            vertices[base + 9],
        );
        let y = F32x4::new(
            vertices[base + 1],
            vertices[base + 4],
            vertices[base + 7],
            vertices[base + 10],
        );
        let z = F32x4::new(
            vertices[base + 2],
            vertices[base + 5],
            vertices[base + 8],
            vertices[base + 11],
        );

        min_x = min_x.min(x);
        min_y = min_y.min(y);
        min_z = min_z.min(z);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
        max_z = max_z.max(z);

        i += 4;
    }

    // Reduce to scalar
    let mut final_min = [f32::MAX; 3];
    let mut final_max = [f32::MIN; 3];

    for j in 0..4 {
        final_min[0] = final_min[0].min(min_x.data[j]);
        final_min[1] = final_min[1].min(min_y.data[j]);
        final_min[2] = final_min[2].min(min_z.data[j]);
        final_max[0] = final_max[0].max(max_x.data[j]);
        final_max[1] = final_max[1].max(max_y.data[j]);
        final_max[2] = final_max[2].max(max_z.data[j]);
    }

    // Handle remainder
    while i < n {
        let base = i * 3;
        final_min[0] = final_min[0].min(vertices[base]);
        final_min[1] = final_min[1].min(vertices[base + 1]);
        final_min[2] = final_min[2].min(vertices[base + 2]);
        final_max[0] = final_max[0].max(vertices[base]);
        final_max[1] = final_max[1].max(vertices[base + 1]);
        final_max[2] = final_max[2].max(vertices[base + 2]);
        i += 1;
    }

    (
        F32x4::new(final_min[0], final_min[1], final_min[2], 0.0),
        F32x4::new(final_max[0], final_max[1], final_max[2], 0.0),
    )
}

/// SIMD frustum culling for multiple AABBs
#[inline]
pub fn simd_frustum_cull_aabbs(
    aabb_min: &[[f32; 3]],
    aabb_max: &[[f32; 3]],
    frustum_planes: &[[f32; 4]; 6],
    visible: &mut [bool],
) {
    let n = aabb_min.len();

    for i in 0..n {
        let center = F32x4::new(
            (aabb_min[i][0] + aabb_max[i][0]) * 0.5,
            (aabb_min[i][1] + aabb_max[i][1]) * 0.5,
            (aabb_min[i][2] + aabb_max[i][2]) * 0.5,
            1.0,
        );

        let extent = F32x4::new(
            (aabb_max[i][0] - aabb_min[i][0]) * 0.5,
            (aabb_max[i][1] - aabb_min[i][1]) * 0.5,
            (aabb_max[i][2] - aabb_min[i][2]) * 0.5,
            0.0,
        );

        let mut is_visible = true;

        for plane in frustum_planes {
            let normal = F32x4::new(plane[0], plane[1], plane[2], 0.0);
            let d = plane[3];

            // Effective radius
            let r = extent.mul(normal.abs()).horizontal_sum();

            // Signed distance from center to plane
            let dist = center.mul(normal).horizontal_sum() + d;

            if dist + r < 0.0 {
                is_visible = false;
                break;
            }
        }

        visible[i] = is_visible;
    }
}

// ============================================================================
// LIGHTWEIGHT VERTEX COMPRESSION
// ============================================================================

/// Compress float position to 16-bit quantized
#[inline(always)]
pub fn quantize_position(value: f32, min: f32, scale: f32) -> u16 {
    let normalized = (value - min) / scale;
    (normalized.clamp(0.0, 1.0) * 65535.0) as u16
}

/// Octahedral normal encoding (3D unit vector to 2D)
#[inline(always)]
pub fn encode_octahedral_normal(nx: f32, ny: f32, nz: f32) -> (i16, i16) {
    let sum = nx.abs() + ny.abs() + nz.abs();
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

/// Batch compress vertices using SIMD where possible
pub fn simd_compress_vertices(
    positions: &[f32],    // [x, y, z, x, y, z, ...]
    normals: &[f32],      // [nx, ny, nz, ...]
    aabb_min: [f32; 3],
    aabb_scale: f32,
    compressed_pos: &mut [u16],
    compressed_normals: &mut [i16],
) {
    let vertex_count = positions.len() / 3;

    for i in 0..vertex_count {
        let base = i * 3;

        // Quantize position
        compressed_pos[base] = quantize_position(positions[base], aabb_min[0], aabb_scale);
        compressed_pos[base + 1] = quantize_position(positions[base + 1], aabb_min[1], aabb_scale);
        compressed_pos[base + 2] = quantize_position(positions[base + 2], aabb_min[2], aabb_scale);

        // Encode normal
        let (ox, oy) = encode_octahedral_normal(normals[base], normals[base + 1], normals[base + 2]);
        compressed_normals[i * 2] = ox;
        compressed_normals[i * 2 + 1] = oy;
    }
}

// ============================================================================
// SIMD TRANSFORM OPERATIONS
// ============================================================================

/// Batch transform vertices by instance matrices
pub fn simd_transform_vertices_instanced(
    vertices: &[f32],        // Source vertices [x,y,z,...]
    matrices: &[Mat4x4Simd], // Instance matrices
    output: &mut [f32],      // Output buffer
) {
    let vertex_count = vertices.len() / 3;
    let instance_count = matrices.len();

    for inst in 0..instance_count {
        let mat = matrices[inst];
        let out_offset = inst * vertex_count * 3;

        for v in 0..vertex_count {
            let in_base = v * 3;
            let out_base = out_offset + v * 3;

            let pos = F32x4::new(vertices[in_base], vertices[in_base + 1], vertices[in_base + 2], 1.0);

            let transformed = mat.mul_vec4(pos);

            output[out_base] = transformed.data[0];
            output[out_base + 1] = transformed.data[1];
            output[out_base + 2] = transformed.data[2];
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_f32x4_operations() {
        let a = F32x4::new(1.0, 2.0, 3.0, 4.0);
        let b = F32x4::new(5.0, 6.0, 7.0, 8.0);

        let sum = a.add(b);
        assert_eq!(sum.data, [6.0, 8.0, 10.0, 12.0]);

        let product = a.mul(b);
        assert_eq!(product.data, [5.0, 12.0, 21.0, 32.0]);

        let dot = a.dot(b);
        assert_eq!(dot, 70.0);
    }

    #[test]
    fn test_mat4x4_mul() {
        let identity = Mat4x4Simd::identity();
        let v = F32x4::new(1.0, 2.0, 3.0, 1.0);

        let result = identity.mul_vec4(v);
        assert_eq!(result.data, v.data);
    }

    #[test]
    fn test_simd_dot_product() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let b = vec![1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

        let result = simd_dot_product(&a, &b);
        assert_eq!(result, 55.0);
    }

    #[test]
    fn test_octahedral_encoding() {
        // Test unit normal along Z
        let (ox, oy) = encode_octahedral_normal(0.0, 0.0, 1.0);
        assert_eq!(ox, 0);
        assert_eq!(oy, 0);

        // Test unit normal along X
        let (ox, oy) = encode_octahedral_normal(1.0, 0.0, 0.0);
        assert!(ox > 30000); // Close to max
    }
}
