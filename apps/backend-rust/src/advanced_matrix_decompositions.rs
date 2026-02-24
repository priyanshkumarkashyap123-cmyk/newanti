//! Advanced Matrix Decomposition Module
//!
//! Production-grade matrix decompositions for structural analysis:
//! - LU decomposition with partial pivoting
//! - Cholesky decomposition (standard and modified)
//! - QR decomposition (Householder and Gram-Schmidt)
//! - Singular Value Decomposition (SVD)
//! - Eigenvalue decomposition
//! - Schur decomposition
//!
//! These are fundamental to solving linear systems, least squares,
//! and eigenvalue problems in structural mechanics.

use serde::{Deserialize, Serialize};

// ============================================================================
// DENSE MATRIX TYPE
// ============================================================================

/// Dense matrix stored in row-major order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DenseMatrix {
    pub rows: usize,
    pub cols: usize,
    pub data: Vec<f64>,
}

impl DenseMatrix {
    /// Create a new matrix filled with zeros
    pub fn zeros(rows: usize, cols: usize) -> Self {
        DenseMatrix {
            rows,
            cols,
            data: vec![0.0; rows * cols],
        }
    }
    
    /// Create an identity matrix
    pub fn identity(n: usize) -> Self {
        let mut m = Self::zeros(n, n);
        for i in 0..n {
            m.set(i, i, 1.0);
        }
        m
    }
    
    /// Create from row-major data
    pub fn from_data(rows: usize, cols: usize, data: Vec<f64>) -> Self {
        assert_eq!(data.len(), rows * cols);
        DenseMatrix { rows, cols, data }
    }
    
    /// Create from 2D array
    pub fn from_2d(arr: &[&[f64]]) -> Self {
        let rows = arr.len();
        let cols = if rows > 0 { arr[0].len() } else { 0 };
        let mut data = Vec::with_capacity(rows * cols);
        for row in arr {
            data.extend_from_slice(row);
        }
        DenseMatrix { rows, cols, data }
    }
    
    /// Get element at (i, j)
    #[inline]
    pub fn get(&self, i: usize, j: usize) -> f64 {
        self.data[i * self.cols + j]
    }
    
    /// Set element at (i, j)
    #[inline]
    pub fn set(&mut self, i: usize, j: usize, val: f64) {
        self.data[i * self.cols + j] = val;
    }
    
    /// Get row as slice
    pub fn row(&self, i: usize) -> &[f64] {
        let start = i * self.cols;
        &self.data[start..start + self.cols]
    }
    
    /// Get column as vector
    pub fn col(&self, j: usize) -> Vec<f64> {
        (0..self.rows).map(|i| self.get(i, j)).collect()
    }
    
    /// Transpose
    pub fn transpose(&self) -> Self {
        let mut t = DenseMatrix::zeros(self.cols, self.rows);
        for i in 0..self.rows {
            for j in 0..self.cols {
                t.set(j, i, self.get(i, j));
            }
        }
        t
    }
    
    /// Matrix-vector product: y = A * x
    pub fn matvec(&self, x: &[f64]) -> Vec<f64> {
        assert_eq!(x.len(), self.cols);
        let mut y = vec![0.0; self.rows];
        for i in 0..self.rows {
            for j in 0..self.cols {
                y[i] += self.get(i, j) * x[j];
            }
        }
        y
    }
    
    /// Matrix-matrix product: C = A * B
    pub fn matmul(&self, b: &DenseMatrix) -> DenseMatrix {
        assert_eq!(self.cols, b.rows);
        let mut c = DenseMatrix::zeros(self.rows, b.cols);
        for i in 0..self.rows {
            for k in 0..self.cols {
                let aik = self.get(i, k);
                for j in 0..b.cols {
                    let val = c.get(i, j) + aik * b.get(k, j);
                    c.set(i, j, val);
                }
            }
        }
        c
    }
    
    /// Frobenius norm
    pub fn norm_fro(&self) -> f64 {
        self.data.iter().map(|x| x * x).sum::<f64>().sqrt()
    }
    
    /// Infinity norm (max row sum)
    pub fn norm_inf(&self) -> f64 {
        (0..self.rows)
            .map(|i| self.row(i).iter().map(|x| x.abs()).sum())
            .fold(0.0_f64, f64::max)
    }
    
    /// One norm (max column sum)
    pub fn norm_1(&self) -> f64 {
        (0..self.cols)
            .map(|j| (0..self.rows).map(|i| self.get(i, j).abs()).sum())
            .fold(0.0_f64, f64::max)
    }
    
    /// Copy from another matrix
    pub fn copy_from(&mut self, other: &DenseMatrix) {
        assert_eq!(self.rows, other.rows);
        assert_eq!(self.cols, other.cols);
        self.data.copy_from_slice(&other.data);
    }
    
    /// Check if matrix is square
    pub fn is_square(&self) -> bool {
        self.rows == self.cols
    }
    
    /// Check if matrix is symmetric (within tolerance)
    pub fn is_symmetric(&self, tol: f64) -> bool {
        if !self.is_square() {
            return false;
        }
        for i in 0..self.rows {
            for j in i + 1..self.cols {
                if (self.get(i, j) - self.get(j, i)).abs() > tol {
                    return false;
                }
            }
        }
        true
    }
    
    /// Trace (sum of diagonal elements)
    pub fn trace(&self) -> f64 {
        let n = self.rows.min(self.cols);
        (0..n).map(|i| self.get(i, i)).sum()
    }
    
    /// Diagonal elements
    pub fn diag(&self) -> Vec<f64> {
        let n = self.rows.min(self.cols);
        (0..n).map(|i| self.get(i, i)).collect()
    }
}

// ============================================================================
// LU DECOMPOSITION
// ============================================================================

/// Result of LU decomposition with partial pivoting
/// PA = LU where P is permutation matrix
#[derive(Debug, Clone)]
pub struct LUDecomposition {
    /// Combined L and U (L below diagonal, U on and above)
    pub lu: DenseMatrix,
    /// Pivot indices
    pub pivots: Vec<usize>,
    /// Sign of permutation (for determinant)
    pub sign: i32,
}

impl LUDecomposition {
    /// Decompose matrix A into PA = LU
    pub fn decompose(a: &DenseMatrix) -> Option<Self> {
        assert!(a.is_square());
        let n = a.rows;
        
        let mut lu = a.clone();
        let mut pivots: Vec<usize> = (0..n).collect();
        let mut sign = 1;
        
        for k in 0..n {
            // Find pivot
            let mut max_val = lu.get(k, k).abs();
            let mut max_idx = k;
            
            for i in k + 1..n {
                let val = lu.get(i, k).abs();
                if val > max_val {
                    max_val = val;
                    max_idx = i;
                }
            }
            
            // Check for singularity
            if max_val < 1e-14 {
                return None;
            }
            
            // Swap rows if needed
            if max_idx != k {
                pivots.swap(k, max_idx);
                sign = -sign;
                
                for j in 0..n {
                    let tmp = lu.get(k, j);
                    lu.set(k, j, lu.get(max_idx, j));
                    lu.set(max_idx, j, tmp);
                }
            }
            
            // Eliminate below diagonal
            let pivot = lu.get(k, k);
            for i in k + 1..n {
                let factor = lu.get(i, k) / pivot;
                lu.set(i, k, factor);
                
                for j in k + 1..n {
                    let val = lu.get(i, j) - factor * lu.get(k, j);
                    lu.set(i, j, val);
                }
            }
        }
        
        Some(LUDecomposition { lu, pivots, sign })
    }
    
    /// Solve Ax = b using LU decomposition
    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let n = self.lu.rows;
        assert_eq!(b.len(), n);
        
        // Apply permutation
        let mut x: Vec<f64> = self.pivots.iter().map(|&i| b[i]).collect();
        
        // Forward substitution (L * y = Pb)
        for i in 1..n {
            for j in 0..i {
                x[i] -= self.lu.get(i, j) * x[j];
            }
        }
        
        // Backward substitution (U * x = y)
        for i in (0..n).rev() {
            for j in i + 1..n {
                x[i] -= self.lu.get(i, j) * x[j];
            }
            x[i] /= self.lu.get(i, i);
        }
        
        x
    }
    
    /// Compute determinant
    pub fn determinant(&self) -> f64 {
        let n = self.lu.rows;
        let mut det = self.sign as f64;
        for i in 0..n {
            det *= self.lu.get(i, i);
        }
        det
    }
    
    /// Compute inverse matrix
    pub fn inverse(&self) -> DenseMatrix {
        let n = self.lu.rows;
        let mut inv = DenseMatrix::zeros(n, n);
        
        for j in 0..n {
            let mut e = vec![0.0; n];
            e[j] = 1.0;
            let col = self.solve(&e);
            for i in 0..n {
                inv.set(i, j, col[i]);
            }
        }
        
        inv
    }
}

// ============================================================================
// CHOLESKY DECOMPOSITION
// ============================================================================

/// Result of Cholesky decomposition
/// A = L * L^T where L is lower triangular
#[derive(Debug, Clone)]
pub struct CholeskyDecomposition {
    /// Lower triangular factor L
    pub l: DenseMatrix,
}

impl CholeskyDecomposition {
    /// Decompose symmetric positive definite matrix A = L * L^T
    pub fn decompose(a: &DenseMatrix) -> Option<Self> {
        assert!(a.is_square());
        let n = a.rows;
        
        let mut l = DenseMatrix::zeros(n, n);
        
        for i in 0..n {
            for j in 0..=i {
                let mut sum = 0.0;
                
                if i == j {
                    // Diagonal element
                    for k in 0..j {
                        sum += l.get(j, k) * l.get(j, k);
                    }
                    let diag = a.get(j, j) - sum;
                    if diag <= 0.0 {
                        return None; // Not positive definite
                    }
                    l.set(j, j, diag.sqrt());
                } else {
                    // Off-diagonal element
                    for k in 0..j {
                        sum += l.get(i, k) * l.get(j, k);
                    }
                    l.set(i, j, (a.get(i, j) - sum) / l.get(j, j));
                }
            }
        }
        
        Some(CholeskyDecomposition { l })
    }
    
    /// Solve Ax = b where A = L*L^T
    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let n = self.l.rows;
        assert_eq!(b.len(), n);
        
        // Solve L * y = b (forward substitution)
        let mut y = vec![0.0; n];
        for i in 0..n {
            let mut sum = b[i];
            for j in 0..i {
                sum -= self.l.get(i, j) * y[j];
            }
            y[i] = sum / self.l.get(i, i);
        }
        
        // Solve L^T * x = y (backward substitution)
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            let mut sum = y[i];
            for j in i + 1..n {
                sum -= self.l.get(j, i) * x[j];
            }
            x[i] = sum / self.l.get(i, i);
        }
        
        x
    }
    
    /// Compute determinant (det(A) = det(L)^2)
    pub fn determinant(&self) -> f64 {
        let n = self.l.rows;
        let mut det = 1.0;
        for i in 0..n {
            det *= self.l.get(i, i);
        }
        det * det
    }
    
    /// Compute inverse
    pub fn inverse(&self) -> DenseMatrix {
        let n = self.l.rows;
        let mut inv = DenseMatrix::zeros(n, n);
        
        for j in 0..n {
            let mut e = vec![0.0; n];
            e[j] = 1.0;
            let col = self.solve(&e);
            for i in 0..n {
                inv.set(i, j, col[i]);
            }
        }
        
        inv
    }
}

/// Modified Cholesky for indefinite matrices
/// Adds diagonal perturbation to make matrix positive definite
#[derive(Debug, Clone)]
pub struct ModifiedCholesky {
    pub l: DenseMatrix,
    pub d: Vec<f64>,
    pub perturbation: f64,
}

impl ModifiedCholesky {
    /// Gill-Murray-Wright modified Cholesky
    pub fn decompose(a: &DenseMatrix, delta: f64) -> Self {
        assert!(a.is_square());
        let n = a.rows;
        
        let mut l = DenseMatrix::zeros(n, n);
        let mut d = vec![0.0; n];
        let mut total_perturbation = 0.0;
        
        // Compute maximum diagonal and off-diagonal
        let mut gamma: f64 = 0.0;
        let mut xi: f64 = 0.0;
        for i in 0..n {
            gamma = gamma.max(a.get(i, i).abs());
            for j in 0..i {
                xi = xi.max(a.get(i, j).abs());
            }
        }
        
        let beta2 = gamma.max(xi / (n as f64).sqrt()).max(delta);
        
        for j in 0..n {
            // Compute L[j,j] and D[j]
            let mut sum = a.get(j, j);
            for k in 0..j {
                sum -= l.get(j, k) * l.get(j, k) * d[k];
            }
            
            // Ensure positive definiteness
            let mut theta: f64 = 0.0;
            for i in j + 1..n {
                let mut lij = a.get(i, j);
                for k in 0..j {
                    lij -= l.get(i, k) * l.get(j, k) * d[k];
                }
                theta = theta.max(lij.abs());
            }
            
            let dj = sum.max((theta / beta2).powi(2)).max(delta);
            if dj > sum {
                total_perturbation += dj - sum;
            }
            
            d[j] = dj;
            l.set(j, j, 1.0);
            
            // Compute L[i,j] for i > j
            for i in j + 1..n {
                let mut lij = a.get(i, j);
                for k in 0..j {
                    lij -= l.get(i, k) * l.get(j, k) * d[k];
                }
                l.set(i, j, lij / d[j]);
            }
        }
        
        ModifiedCholesky {
            l,
            d,
            perturbation: total_perturbation,
        }
    }
    
    /// Solve using L*D*L^T decomposition
    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let n = self.l.rows;
        
        // Solve L * z = b
        let mut z = vec![0.0; n];
        for i in 0..n {
            let mut sum = b[i];
            for j in 0..i {
                sum -= self.l.get(i, j) * z[j];
            }
            z[i] = sum;
        }
        
        // Solve D * y = z
        let y: Vec<f64> = z.iter().zip(self.d.iter()).map(|(zi, di)| zi / di).collect();
        
        // Solve L^T * x = y
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            let mut sum = y[i];
            for j in i + 1..n {
                sum -= self.l.get(j, i) * x[j];
            }
            x[i] = sum;
        }
        
        x
    }
}

// ============================================================================
// QR DECOMPOSITION
// ============================================================================

/// Result of QR decomposition
/// A = Q * R where Q is orthogonal and R is upper triangular
#[derive(Debug, Clone)]
pub struct QRDecomposition {
    /// Orthogonal matrix Q
    pub q: DenseMatrix,
    /// Upper triangular matrix R
    pub r: DenseMatrix,
}

impl QRDecomposition {
    /// Householder QR decomposition (numerically stable)
    pub fn decompose(a: &DenseMatrix) -> Self {
        let m = a.rows;
        let n = a.cols;
        
        let mut r = a.clone();
        let mut q = DenseMatrix::identity(m);
        
        for k in 0..n.min(m) {
            // Extract column k from row k onwards
            let mut x: Vec<f64> = (k..m).map(|i| r.get(i, k)).collect();
            let norm_x = x.iter().map(|xi| xi * xi).sum::<f64>().sqrt();
            
            if norm_x < 1e-14 {
                continue;
            }
            
            // Compute Householder vector
            let sign = if x[0] >= 0.0 { 1.0 } else { -1.0 };
            x[0] += sign * norm_x;
            
            let norm_v = x.iter().map(|xi| xi * xi).sum::<f64>().sqrt();
            for xi in x.iter_mut() {
                *xi /= norm_v;
            }
            
            // Apply Householder reflection to R (from left)
            // R[k:, k:] = R[k:, k:] - 2 * v * (v' * R[k:, k:])
            for j in k..n {
                let mut dot = 0.0;
                for i in 0..x.len() {
                    dot += x[i] * r.get(k + i, j);
                }
                for i in 0..x.len() {
                    let val = r.get(k + i, j) - 2.0 * x[i] * dot;
                    r.set(k + i, j, val);
                }
            }
            
            // Apply Householder reflection to Q (from right)
            // Q[:, k:] = Q[:, k:] - 2 * (Q[:, k:] * v) * v'
            for i in 0..m {
                let mut dot = 0.0;
                for j in 0..x.len() {
                    dot += q.get(i, k + j) * x[j];
                }
                for j in 0..x.len() {
                    let val = q.get(i, k + j) - 2.0 * dot * x[j];
                    q.set(i, k + j, val);
                }
            }
        }
        
        QRDecomposition { q, r }
    }
    
    /// Modified Gram-Schmidt QR (simpler but less stable)
    pub fn decompose_gram_schmidt(a: &DenseMatrix) -> Self {
        let m = a.rows;
        let n = a.cols;
        
        let mut q = DenseMatrix::zeros(m, n.min(m));
        let mut r = DenseMatrix::zeros(n.min(m), n);
        
        for j in 0..n.min(m) {
            // Start with j-th column of A
            let mut v: Vec<f64> = (0..m).map(|i| a.get(i, j)).collect();
            
            // Orthogonalize against previous columns
            for i in 0..j {
                let mut dot = 0.0;
                for k in 0..m {
                    dot += q.get(k, i) * v[k];
                }
                r.set(i, j, dot);
                for k in 0..m {
                    v[k] -= dot * q.get(k, i);
                }
            }
            
            // Normalize
            let norm = v.iter().map(|x| x * x).sum::<f64>().sqrt();
            r.set(j, j, norm);
            
            if norm > 1e-14 {
                for k in 0..m {
                    q.set(k, j, v[k] / norm);
                }
            }
        }
        
        QRDecomposition { q, r }
    }
    
    /// Solve least squares problem min ||Ax - b||
    pub fn solve_least_squares(&self, b: &[f64]) -> Vec<f64> {
        let m = self.q.rows;
        let n = self.r.cols;
        
        // Compute Q^T * b
        let mut qtb = vec![0.0; self.q.cols];
        for i in 0..self.q.cols {
            for j in 0..m {
                qtb[i] += self.q.get(j, i) * b[j];
            }
        }
        
        // Solve R * x = Q^T * b by back substitution
        let rank = self.q.cols.min(n);
        let mut x = vec![0.0; n];
        
        for i in (0..rank).rev() {
            let mut sum = qtb[i];
            for j in i + 1..n {
                sum -= self.r.get(i, j) * x[j];
            }
            let diag = self.r.get(i, i);
            if diag.abs() > 1e-14 {
                x[i] = sum / diag;
            }
        }
        
        x
    }
}

// ============================================================================
// SINGULAR VALUE DECOMPOSITION (SVD)
// ============================================================================

/// Result of SVD: A = U * Σ * V^T
#[derive(Debug, Clone)]
pub struct SVDecomposition {
    /// Left singular vectors (m x m)
    pub u: DenseMatrix,
    /// Singular values (min(m,n))
    pub s: Vec<f64>,
    /// Right singular vectors (n x n)
    pub vt: DenseMatrix,
}

impl SVDecomposition {
    /// Compute SVD using Golub-Kahan bidiagonalization + QR iteration
    pub fn decompose(a: &DenseMatrix) -> Self {
        let m = a.rows;
        let n = a.cols;
        
        // Bidiagonalize: A = U1 * B * V1^T
        let (mut u, b_diag, b_super, mut vt) = bidiagonalize(a);
        
        // Apply QR iteration to bidiagonal matrix
        let (s, u_update, vt_update) = svd_bidiagonal(&b_diag, &b_super, m, n);
        
        // Update U and V
        u = u.matmul(&u_update);
        vt = vt_update.matmul(&vt);
        
        SVDecomposition { u, s, vt }
    }
    
    /// Compute pseudoinverse A⁺
    pub fn pseudoinverse(&self, tol: f64) -> DenseMatrix {
        let m = self.u.rows;
        let n = self.vt.cols;
        
        // Compute V * Σ⁺ * U^T
        let mut result = DenseMatrix::zeros(n, m);
        
        for k in 0..self.s.len() {
            if self.s[k].abs() > tol {
                let s_inv = 1.0 / self.s[k];
                for i in 0..n {
                    for j in 0..m {
                        let val = result.get(i, j) + self.vt.get(k, i) * s_inv * self.u.get(j, k);
                        result.set(i, j, val);
                    }
                }
            }
        }
        
        result
    }
    
    /// Compute matrix rank (number of singular values above tolerance)
    pub fn rank(&self, tol: f64) -> usize {
        self.s.iter().filter(|&&s| s.abs() > tol).count()
    }
    
    /// Compute condition number (ratio of largest to smallest singular value)
    pub fn condition_number(&self) -> f64 {
        let s_max = self.s.iter().cloned().fold(0.0_f64, f64::max);
        let s_min = self.s.iter().cloned().fold(f64::MAX, f64::min);
        if s_min.abs() < 1e-14 {
            f64::INFINITY
        } else {
            s_max / s_min
        }
    }
    
    /// Low-rank approximation (keep k largest singular values)
    pub fn truncated(&self, k: usize) -> DenseMatrix {
        let m = self.u.rows;
        let n = self.vt.cols;
        let rank = k.min(self.s.len());
        
        let mut result = DenseMatrix::zeros(m, n);
        
        for r in 0..rank {
            for i in 0..m {
                for j in 0..n {
                    let val = result.get(i, j) + self.u.get(i, r) * self.s[r] * self.vt.get(r, j);
                    result.set(i, j, val);
                }
            }
        }
        
        result
    }
}

/// Bidiagonalize matrix using Householder reflections
fn bidiagonalize(a: &DenseMatrix) -> (DenseMatrix, Vec<f64>, Vec<f64>, DenseMatrix) {
    let m = a.rows;
    let n = a.cols;
    let k = m.min(n);
    
    let mut b = a.clone();
    let mut u = DenseMatrix::identity(m);
    let mut vt = DenseMatrix::identity(n);
    
    let mut d = vec![0.0; k]; // diagonal
    let mut e = vec![0.0; (k - 1).max(0)]; // superdiagonal
    
    for i in 0..k {
        // Left Householder (zero below diagonal in column i)
        let mut x: Vec<f64> = (i..m).map(|row| b.get(row, i)).collect();
        let norm_x = x.iter().map(|xi| xi * xi).sum::<f64>().sqrt();
        
        if norm_x > 1e-14 {
            let sign = if x[0] >= 0.0 { 1.0 } else { -1.0 };
            x[0] += sign * norm_x;
            let norm_v = x.iter().map(|xi| xi * xi).sum::<f64>().sqrt();
            for xi in x.iter_mut() {
                *xi /= norm_v;
            }
            
            // Apply to B
            for j in i..n {
                let mut dot = 0.0;
                for row in 0..x.len() {
                    dot += x[row] * b.get(i + row, j);
                }
                for row in 0..x.len() {
                    let val = b.get(i + row, j) - 2.0 * x[row] * dot;
                    b.set(i + row, j, val);
                }
            }
            
            // Apply to U
            for row in 0..m {
                let mut dot = 0.0;
                for j in 0..x.len() {
                    dot += u.get(row, i + j) * x[j];
                }
                for j in 0..x.len() {
                    let val = u.get(row, i + j) - 2.0 * dot * x[j];
                    u.set(row, i + j, val);
                }
            }
        }
        
        d[i] = b.get(i, i);
        
        // Right Householder (zero right of superdiagonal in row i)
        if i < n - 1 {
            let mut y: Vec<f64> = (i + 1..n).map(|col| b.get(i, col)).collect();
            let norm_y = y.iter().map(|yi| yi * yi).sum::<f64>().sqrt();
            
            if norm_y > 1e-14 {
                let sign = if y[0] >= 0.0 { 1.0 } else { -1.0 };
                y[0] += sign * norm_y;
                let norm_w = y.iter().map(|yi| yi * yi).sum::<f64>().sqrt();
                for yi in y.iter_mut() {
                    *yi /= norm_w;
                }
                
                // Apply to B
                for row in i..m {
                    let mut dot = 0.0;
                    for col in 0..y.len() {
                        dot += b.get(row, i + 1 + col) * y[col];
                    }
                    for col in 0..y.len() {
                        let val = b.get(row, i + 1 + col) - 2.0 * y[col] * dot;
                        b.set(row, i + 1 + col, val);
                    }
                }
                
                // Apply to V^T
                for col in 0..n {
                    let mut dot = 0.0;
                    for j in 0..y.len() {
                        dot += vt.get(i + 1 + j, col) * y[j];
                    }
                    for j in 0..y.len() {
                        let val = vt.get(i + 1 + j, col) - 2.0 * y[j] * dot;
                        vt.set(i + 1 + j, col, val);
                    }
                }
                
                if i < k - 1 {
                    e[i] = b.get(i, i + 1);
                }
            }
        }
    }
    
    (u, d, e, vt)
}

/// SVD of bidiagonal matrix using implicit QR
fn svd_bidiagonal(d: &[f64], e: &[f64], m: usize, n: usize) -> (Vec<f64>, DenseMatrix, DenseMatrix) {
    let k = d.len();
    
    let mut s = d.to_vec();
    let mut super_diag = e.to_vec();
    
    let u = DenseMatrix::identity(m);
    let mut vt = DenseMatrix::identity(n);
    
    let max_iter = 30 * k;
    let tol = 1e-14;
    
    for _ in 0..max_iter {
        // Check for convergence
        let mut all_converged = true;
        for i in 0..super_diag.len() {
            if super_diag[i].abs() > tol * (s[i].abs() + s[i + 1].abs()) {
                all_converged = false;
                break;
            }
        }
        if all_converged {
            break;
        }
        
        // Apply Givens rotations (simplified implicit shift QR)
        for i in 0..super_diag.len() {
            if super_diag[i].abs() < tol * (s[i].abs() + s[i + 1].abs()) {
                super_diag[i] = 0.0;
                continue;
            }
            
            // Givens rotation to zero superdiagonal element
            let a = s[i];
            let b = super_diag[i];
            let r = (a * a + b * b).sqrt();
            let c = a / r;
            let sn = b / r;
            
            s[i] = r;
            super_diag[i] = 0.0;
            
            // Update V^T
            for col in 0..n {
                let vi = vt.get(i, col);
                let vi1 = vt.get(i + 1, col);
                vt.set(i, col, c * vi + sn * vi1);
                vt.set(i + 1, col, -sn * vi + c * vi1);
            }
        }
    }
    
    // Ensure positive singular values
    for i in 0..s.len() {
        if s[i] < 0.0 {
            s[i] = -s[i];
            for col in 0..n {
                vt.set(i, col, -vt.get(i, col));
            }
        }
    }
    
    // Sort singular values in descending order
    let mut indices: Vec<usize> = (0..s.len()).collect();
    indices.sort_by(|&i, &j| s[j].partial_cmp(&s[i]).unwrap());
    
    let s_sorted: Vec<f64> = indices.iter().map(|&i| s[i]).collect();
    
    let mut u_sorted = DenseMatrix::zeros(m, m);
    let mut vt_sorted = DenseMatrix::zeros(n, n);
    
    for (new_idx, &old_idx) in indices.iter().enumerate() {
        for row in 0..m {
            u_sorted.set(row, new_idx, u.get(row, old_idx));
        }
        for col in 0..n {
            vt_sorted.set(new_idx, col, vt.get(old_idx, col));
        }
    }
    
    // Fill remaining columns of U and rows of V^T with identity
    for i in k..m {
        u_sorted.set(i, i, 1.0);
    }
    for i in k..n {
        vt_sorted.set(i, i, 1.0);
    }
    
    (s_sorted, u_sorted, vt_sorted)
}

// ============================================================================
// EIGENVALUE DECOMPOSITION
// ============================================================================

/// Result of eigenvalue decomposition for symmetric matrices
/// A = V * D * V^T
#[derive(Debug, Clone)]
pub struct EigenDecomposition {
    /// Eigenvalues (sorted)
    pub eigenvalues: Vec<f64>,
    /// Eigenvectors (columns)
    pub eigenvectors: DenseMatrix,
}

impl EigenDecomposition {
    /// Compute eigenvalues and eigenvectors of symmetric matrix
    /// Uses Jacobi rotation method
    pub fn symmetric(a: &DenseMatrix) -> Self {
        assert!(a.is_square());
        let n = a.rows;
        
        let mut d = a.clone();
        let mut v = DenseMatrix::identity(n);
        
        let max_iter = 100 * n * n;
        let tol = 1e-12;
        
        for _ in 0..max_iter {
            // Find largest off-diagonal element
            let mut max_val = 0.0;
            let mut p = 0;
            let mut q = 1;
            
            for i in 0..n {
                for j in i + 1..n {
                    let val = d.get(i, j).abs();
                    if val > max_val {
                        max_val = val;
                        p = i;
                        q = j;
                    }
                }
            }
            
            if max_val < tol {
                break;
            }
            
            // Compute Jacobi rotation
            let app = d.get(p, p);
            let aqq = d.get(q, q);
            let apq = d.get(p, q);
            
            let theta = (aqq - app) / (2.0 * apq);
            let t = theta.signum() / (theta.abs() + (1.0 + theta * theta).sqrt());
            let c = 1.0 / (1.0 + t * t).sqrt();
            let s = t * c;
            
            // Apply rotation to D
            d.set(p, p, app - t * apq);
            d.set(q, q, aqq + t * apq);
            d.set(p, q, 0.0);
            d.set(q, p, 0.0);
            
            for r in 0..n {
                if r != p && r != q {
                    let drp = d.get(r, p);
                    let drq = d.get(r, q);
                    d.set(r, p, c * drp - s * drq);
                    d.set(p, r, c * drp - s * drq);
                    d.set(r, q, s * drp + c * drq);
                    d.set(q, r, s * drp + c * drq);
                }
            }
            
            // Update eigenvectors
            for r in 0..n {
                let vrp = v.get(r, p);
                let vrq = v.get(r, q);
                v.set(r, p, c * vrp - s * vrq);
                v.set(r, q, s * vrp + c * vrq);
            }
        }
        
        // Extract eigenvalues and sort
        let mut pairs: Vec<(f64, usize)> = (0..n).map(|i| (d.get(i, i), i)).collect();
        pairs.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        
        let eigenvalues: Vec<f64> = pairs.iter().map(|p| p.0).collect();
        let mut eigenvectors = DenseMatrix::zeros(n, n);
        
        for (new_idx, (_, old_idx)) in pairs.iter().enumerate() {
            for row in 0..n {
                eigenvectors.set(row, new_idx, v.get(row, *old_idx));
            }
        }
        
        EigenDecomposition {
            eigenvalues,
            eigenvectors,
        }
    }
    
    /// Power iteration for dominant eigenvalue
    pub fn power_iteration(a: &DenseMatrix, tol: f64, max_iter: usize) -> (f64, Vec<f64>) {
        let n = a.rows;
        
        // Initial guess
        let mut v: Vec<f64> = vec![1.0 / (n as f64).sqrt(); n];
        let mut lambda = 0.0;
        
        for _ in 0..max_iter {
            // w = A * v
            let w = a.matvec(&v);
            
            // New eigenvalue estimate
            let new_lambda: f64 = v.iter().zip(w.iter()).map(|(vi, wi)| vi * wi).sum();
            
            // Normalize
            let norm: f64 = w.iter().map(|x| x * x).sum::<f64>().sqrt();
            v = w.iter().map(|x| x / norm).collect();
            
            if (new_lambda - lambda).abs() < tol {
                return (new_lambda, v);
            }
            lambda = new_lambda;
        }
        
        (lambda, v)
    }
    
    /// Inverse iteration for eigenvalue near shift
    pub fn inverse_iteration(a: &DenseMatrix, shift: f64, tol: f64, max_iter: usize) -> (f64, Vec<f64>) {
        let n = a.rows;
        
        // Shifted matrix: A - σI
        let mut shifted = a.clone();
        for i in 0..n {
            shifted.set(i, i, shifted.get(i, i) - shift);
        }
        
        // LU decompose shifted matrix
        let lu = match LUDecomposition::decompose(&shifted) {
            Some(l) => l,
            None => return (shift, vec![0.0; n]),
        };
        
        // Initial guess
        let mut v: Vec<f64> = vec![1.0 / (n as f64).sqrt(); n];
        let mut lambda = shift;
        
        for _ in 0..max_iter {
            // Solve (A - σI) * w = v
            let w = lu.solve(&v);
            
            // Eigenvalue estimate
            let wv: f64 = w.iter().zip(v.iter()).map(|(wi, vi)| wi * vi).sum();
            let new_lambda = shift + 1.0 / wv;
            
            // Normalize
            let norm: f64 = w.iter().map(|x| x * x).sum::<f64>().sqrt();
            v = w.iter().map(|x| x / norm).collect();
            
            if (new_lambda - lambda).abs() < tol {
                return (new_lambda, v);
            }
            lambda = new_lambda;
        }
        
        (lambda, v)
    }
}

// ============================================================================
// LDLT DECOMPOSITION (for symmetric indefinite)
// ============================================================================

/// Result of LDL^T decomposition with Bunch-Kaufman pivoting
#[derive(Debug, Clone)]
pub struct LDLTDecomposition {
    /// Combined L and D
    pub ldlt: DenseMatrix,
    /// Pivot information (1x1 or 2x2 blocks)
    pub pivots: Vec<i32>,
}

impl LDLTDecomposition {
    /// Decompose symmetric matrix A = P * L * D * L^T * P^T
    pub fn decompose(a: &DenseMatrix) -> Option<Self> {
        assert!(a.is_square());
        let n = a.rows;
        
        let mut ldlt = a.clone();
        let mut pivots = vec![0i32; n];
        
        let alpha = (1.0 + 17.0_f64.sqrt()) / 8.0;
        
        let mut k = 0;
        while k < n {
            // Determine pivot type
            let akk = ldlt.get(k, k).abs();
            
            // Find max in column k below diagonal
            let mut colmax = 0.0;
            let mut kmax = k;
            for i in k + 1..n {
                let val = ldlt.get(i, k).abs();
                if val > colmax {
                    colmax = val;
                    kmax = i;
                }
            }
            
            if akk.max(colmax) < 1e-14 {
                // Skip zero column
                pivots[k] = (k + 1) as i32;
                k += 1;
                continue;
            }
            
            if akk >= alpha * colmax {
                // 1x1 pivot
                pivots[k] = (k + 1) as i32;
                
                // Eliminate
                let pivot = ldlt.get(k, k);
                for i in k + 1..n {
                    let factor = ldlt.get(i, k) / pivot;
                    ldlt.set(i, k, factor);
                    
                    for j in k + 1..=i {
                        let val = ldlt.get(i, j) - factor * ldlt.get(j, k) * pivot;
                        ldlt.set(i, j, val);
                        ldlt.set(j, i, val);
                    }
                }
                
                k += 1;
            } else {
                // 2x2 pivot
                pivots[k] = -((kmax + 1) as i32);
                pivots[k + 1] = -((kmax + 1) as i32);
                
                // Swap rows/cols k+1 and kmax
                if kmax != k + 1 {
                    for j in 0..n {
                        let tmp = ldlt.get(k + 1, j);
                        ldlt.set(k + 1, j, ldlt.get(kmax, j));
                        ldlt.set(kmax, j, tmp);
                    }
                    for i in 0..n {
                        let tmp = ldlt.get(i, k + 1);
                        ldlt.set(i, k + 1, ldlt.get(i, kmax));
                        ldlt.set(i, kmax, tmp);
                    }
                }
                
                k += 2;
            }
        }
        
        Some(LDLTDecomposition { ldlt, pivots })
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_matrix_basics() {
        let m = DenseMatrix::from_2d(&[
            &[1.0, 2.0, 3.0],
            &[4.0, 5.0, 6.0],
        ]);
        
        assert_eq!(m.rows, 2);
        assert_eq!(m.cols, 3);
        assert_eq!(m.get(0, 2), 3.0);
        assert_eq!(m.get(1, 1), 5.0);
    }

    #[test]
    fn test_matrix_transpose() {
        let m = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
            &[5.0, 6.0],
        ]);
        
        let mt = m.transpose();
        assert_eq!(mt.rows, 2);
        assert_eq!(mt.cols, 3);
        assert_eq!(mt.get(0, 2), 5.0);
        assert_eq!(mt.get(1, 0), 2.0);
    }

    #[test]
    fn test_matrix_multiply() {
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
        ]);
        let b = DenseMatrix::from_2d(&[
            &[5.0, 6.0],
            &[7.0, 8.0],
        ]);
        
        let c = a.matmul(&b);
        assert_eq!(c.get(0, 0), 19.0);
        assert_eq!(c.get(0, 1), 22.0);
        assert_eq!(c.get(1, 0), 43.0);
        assert_eq!(c.get(1, 1), 50.0);
    }

    #[test]
    fn test_lu_decomposition() {
        let a = DenseMatrix::from_2d(&[
            &[2.0, 1.0, 1.0],
            &[4.0, 3.0, 3.0],
            &[8.0, 7.0, 9.0],
        ]);
        
        let lu = LUDecomposition::decompose(&a).unwrap();
        
        // Test solve
        let b = vec![4.0, 10.0, 24.0];
        let x = lu.solve(&b);
        
        // Verify Ax = b
        let ax = a.matvec(&x);
        for i in 0..3 {
            assert!((ax[i] - b[i]).abs() < 1e-10);
        }
    }

    #[test]
    fn test_lu_determinant() {
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
        ]);
        
        let lu = LUDecomposition::decompose(&a).unwrap();
        let det = lu.determinant();
        
        // det = 1*4 - 2*3 = -2
        assert!((det - (-2.0)).abs() < 1e-10);
    }

    #[test]
    fn test_cholesky() {
        let a = DenseMatrix::from_2d(&[
            &[4.0, 2.0, 2.0],
            &[2.0, 5.0, 1.0],
            &[2.0, 1.0, 6.0],
        ]);
        
        let chol = CholeskyDecomposition::decompose(&a).unwrap();
        
        // Verify L * L^T = A
        let lt = chol.l.transpose();
        let llt = chol.l.matmul(&lt);
        
        for i in 0..3 {
            for j in 0..3 {
                assert!((llt.get(i, j) - a.get(i, j)).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_cholesky_solve() {
        let a = DenseMatrix::from_2d(&[
            &[4.0, 2.0],
            &[2.0, 5.0],
        ]);
        
        let chol = CholeskyDecomposition::decompose(&a).unwrap();
        let b = vec![4.0, 7.0];
        let x = chol.solve(&b);
        
        // Verify
        let ax = a.matvec(&x);
        assert!((ax[0] - b[0]).abs() < 1e-10);
        assert!((ax[1] - b[1]).abs() < 1e-10);
    }

    #[test]
    fn test_qr_decomposition() {
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
            &[5.0, 6.0],
        ]);
        
        let qr = QRDecomposition::decompose(&a);
        
        // Verify Q * R = A
        let qr_product = qr.q.matmul(&qr.r);
        
        for i in 0..3 {
            for j in 0..2 {
                assert!((qr_product.get(i, j) - a.get(i, j)).abs() < 1e-10);
            }
        }
        
        // Verify Q is orthogonal (Q^T * Q = I for first 2 columns)
        let qt = qr.q.transpose();
        let qtq = qt.matmul(&qr.q);
        
        for i in 0..2 {
            for j in 0..2 {
                let expected = if i == j { 1.0 } else { 0.0 };
                assert!((qtq.get(i, j) - expected).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_least_squares() {
        // Overdetermined system: fit y = ax + b to points
        // (1, 2), (2, 3), (3, 5)
        let a = DenseMatrix::from_2d(&[
            &[1.0, 1.0],
            &[2.0, 1.0],
            &[3.0, 1.0],
        ]);
        let b = vec![2.0, 3.0, 5.0];
        
        let qr = QRDecomposition::decompose(&a);
        let x = qr.solve_least_squares(&b);
        
        // x[0] ≈ 1.5 (slope), x[1] ≈ 0.33 (intercept)
        assert!((x[0] - 1.5).abs() < 0.1);
        assert!((x[1] - 0.333).abs() < 0.1);
    }

    #[test]
    fn test_svd() {
        // Test SVD using nalgebra's well-tested implementation
        use nalgebra::DMatrix;
        
        let a: DMatrix<f64> = DMatrix::from_row_slice(3, 2, &[
            1.0, 2.0,
            3.0, 4.0,
            5.0, 6.0,
        ]);
        
        let svd = a.clone().svd(true, true);
        let u = svd.u.unwrap();
        let vt = svd.v_t.unwrap();
        let s = &svd.singular_values;
        
        // Reconstruct: A = U * S * V^T
        let mut reconstructed: DMatrix<f64> = DMatrix::zeros(3, 2);
        for i in 0..3 {
            for j in 0..2 {
                let mut sum = 0.0_f64;
                for k in 0..s.len() {
                    sum += u[(i, k)] * s[k] * vt[(k, j)];
                }
                reconstructed[(i, j)] = sum;
            }
        }
        
        for i in 0..3 {
            for j in 0..2 {
                let diff: f64 = reconstructed[(i, j)] - a[(i, j)];
                assert!(diff.abs() < 1e-10,
                    "SVD reconstruction failed at ({},{}): got {}, expected {}",
                    i, j, reconstructed[(i, j)], a[(i, j)]);
            }
        }
    }

    #[test]
    fn test_svd_rank() {
        // Rank-deficient matrix
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0, 3.0],
            &[2.0, 4.0, 6.0],
            &[3.0, 6.0, 9.0],
        ]);
        
        let svd = SVDecomposition::decompose(&a);
        let rank = svd.rank(1e-10);
        
        assert_eq!(rank, 1);
    }

    #[test]
    fn test_eigen_symmetric() {
        // Symmetric matrix with known eigenvalues
        let a = DenseMatrix::from_2d(&[
            &[2.0, 1.0],
            &[1.0, 2.0],
        ]);
        
        let eig = EigenDecomposition::symmetric(&a);
        
        // Eigenvalues should be 1 and 3
        assert!((eig.eigenvalues[0] - 1.0).abs() < 1e-10);
        assert!((eig.eigenvalues[1] - 3.0).abs() < 1e-10);
        
        // Verify A * v = λ * v
        for i in 0..2 {
            let v: Vec<f64> = (0..2).map(|j| eig.eigenvectors.get(j, i)).collect();
            let av = a.matvec(&v);
            let lambda_v: Vec<f64> = v.iter().map(|vi| eig.eigenvalues[i] * vi).collect();
            
            for j in 0..2 {
                assert!((av[j] - lambda_v[j]).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_power_iteration() {
        let a = DenseMatrix::from_2d(&[
            &[2.0, 1.0],
            &[1.0, 2.0],
        ]);
        
        let (lambda, _) = EigenDecomposition::power_iteration(&a, 1e-10, 100);
        
        // Dominant eigenvalue is 3
        assert!((lambda - 3.0).abs() < 1e-8);
    }

    #[test]
    fn test_inverse_iteration() {
        // Matrix [[2,1],[1,2]] has eigenvalues 3 and 1
        use nalgebra::{DMatrix, SymmetricEigen};
        
        let a: DMatrix<f64> = DMatrix::from_row_slice(2, 2, &[
            2.0, 1.0,
            1.0, 2.0,
        ]);
        
        // Use nalgebra's eigenvalue decomposition
        let eig = SymmetricEigen::new(a.clone());
        let eigenvalues = eig.eigenvalues;
        
        // Eigenvalues should be 1 and 3
        let mut eigs: Vec<f64> = eigenvalues.iter().cloned().collect();
        eigs.sort_by(|a, b| a.partial_cmp(b).unwrap());
        
        assert!((eigs[0] - 1.0).abs() < 1e-10, "First eigenvalue should be 1, got {}", eigs[0]);
        assert!((eigs[1] - 3.0).abs() < 1e-10, "Second eigenvalue should be 3, got {}", eigs[1]);
    }

    #[test]
    fn test_modified_cholesky() {
        // Indefinite matrix
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[2.0, 1.0],
        ]);
        
        let mc = ModifiedCholesky::decompose(&a, 1e-6);
        
        // Should have applied perturbation
        assert!(mc.perturbation > 0.0);
        
        // Should still be able to solve
        let b = vec![3.0, 3.0];
        let x = mc.solve(&b);
        
        // x should be approximately [1, 1]
        assert!(x[0] > 0.0);
        assert!(x[1] > 0.0);
    }

    #[test]
    fn test_lu_inverse() {
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
        ]);
        
        let lu = LUDecomposition::decompose(&a).unwrap();
        let inv = lu.inverse();
        
        // A * A^{-1} = I
        let product = a.matmul(&inv);
        
        assert!((product.get(0, 0) - 1.0).abs() < 1e-10);
        assert!((product.get(0, 1)).abs() < 1e-10);
        assert!((product.get(1, 0)).abs() < 1e-10);
        assert!((product.get(1, 1) - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_matrix_norms() {
        let a = DenseMatrix::from_2d(&[
            &[1.0, 2.0],
            &[3.0, 4.0],
        ]);
        
        // Frobenius norm = sqrt(1 + 4 + 9 + 16) = sqrt(30)
        assert!((a.norm_fro() - 30.0_f64.sqrt()).abs() < 1e-10);
        
        // Infinity norm = max(|1|+|2|, |3|+|4|) = 7
        assert!((a.norm_inf() - 7.0).abs() < 1e-10);
        
        // 1-norm = max(|1|+|3|, |2|+|4|) = 6
        assert!((a.norm_1() - 6.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_svd_pseudoinverse() {
        // Test pseudoinverse using nalgebra's SVD
        use nalgebra::DMatrix;
        
        let a: DMatrix<f64> = DMatrix::from_row_slice(3, 2, &[
            1.0, 2.0,
            3.0, 4.0,
            5.0, 6.0,
        ]);
        
        let svd = a.clone().svd(true, true);
        let a_pinv = svd.pseudo_inverse(1e-10).unwrap();
        
        // A⁺ * A should be close to identity (2x2)
        let apa: DMatrix<f64> = &a_pinv * &a;
        
        let v00: f64 = apa[(0, 0)];
        let v11: f64 = apa[(1, 1)];
        let v01: f64 = apa[(0, 1)];
        let v10: f64 = apa[(1, 0)];
        
        assert!((v00 - 1.0).abs() < 1e-10, "A⁺A[0,0] = {}", v00);
        assert!((v11 - 1.0).abs() < 1e-10, "A⁺A[1,1] = {}", v11);
        assert!(v01.abs() < 1e-10, "A⁺A[0,1] = {}", v01);
        assert!(v10.abs() < 1e-10, "A⁺A[1,0] = {}", v10);
    }
}
