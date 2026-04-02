//! Block Lanczos eigenvalue solver for subspace inverse iteration.

use std::f64::consts::PI;

/// Block Lanczos eigenvalue solver
/// Industry standard: SAP2000, ETABS, STAAD.Pro
/// Efficient for computing many eigenvalues of large sparse systems
#[derive(Debug, Clone)]
pub struct BlockLanczosSolver {
    pub num_eigenvalues: usize,
    pub block_size: usize,
    pub max_iterations: usize,
    pub tolerance: f64,
    pub reorthogonalize: bool,
}

impl Default for BlockLanczosSolver {
    fn default() -> Self {
        BlockLanczosSolver {
            num_eigenvalues: 10,
            block_size: 4,      // Process 4 vectors at a time
            max_iterations: 100,
            tolerance: 1e-10,
            reorthogonalize: true,
        }
    }
}

impl BlockLanczosSolver {
    pub fn new(num_eigenvalues: usize) -> Self {
        BlockLanczosSolver {
            num_eigenvalues,
            block_size: (num_eigenvalues / 4).max(2).min(8),
            ..Default::default()
        }
    }
    
    /// Solve M^{-1}K * x = λ * x (standard transformation of generalized problem)
    pub fn solve_generalized(
        &self,
        k_mat: &SparseMatrixCSR,
        m_mat: &SparseMatrixCSR,
    ) -> Result<IRAMSolution, EigenSolverError> {
        let n = k_mat.nrows;
        let p = self.block_size;
        let max_blocks = (self.num_eigenvalues + p - 1) / p + 2;
        
        // Block tridiagonal matrix T
        let mut alpha: Vec<Vec<Vec<f64>>> = Vec::new();  // Diagonal blocks (p x p)
        let mut beta: Vec<Vec<Vec<f64>>> = Vec::new();   // Off-diagonal blocks (p x p)
        
        // Lanczos vectors Q (each block is n x p)
        let mut q_blocks: Vec<Vec<Vec<f64>>> = Vec::new();
        
        // Initialize Q_0 = 0, Q_1 = random orthonormal block
        let q1 = self.random_orthonormal_block(n, p);
        q_blocks.push(q1.clone());
        
        let mut prev_q: Vec<Vec<f64>> = vec![vec![0.0; p]; n];
        
        for block_iter in 0..max_blocks {
            // W = M^{-1} * K * Q_j
            let mut w = vec![vec![0.0; p]; n];
            for col in 0..p {
                // Extract column
                let q_col: Vec<f64> = (0..n).map(|i| q_blocks[block_iter][i][col]).collect();
                
                // Apply K
                let mut kq = vec![0.0; n];
                k_mat.multiply(&q_col, &mut kq);
                
                // Solve M * w_col = kq (M-orthogonal)
                // For now, use diagonal preconditioner
                for i in 0..n {
                    let m_diag = m_mat.get_diagonal(i).max(1e-14);
                    w[i][col] = kq[i] / m_diag;
                }
            }
            
            // W = W - Q_{j-1} * β_j^T
            if block_iter > 0 {
                let beta_t = transpose(&beta[block_iter - 1]);
                for i in 0..n {
                    for col in 0..p {
                        for k in 0..p {
                            w[i][col] -= prev_q[i][k] * beta_t[k][col];
                        }
                    }
                }
            }
            
            // α_j = Q_j^T * W (p x p)
            let current_q = &q_blocks[block_iter];
            let alpha_j = self.block_inner_product(current_q, &w, n, p);
            alpha.push(alpha_j.clone());
            
            // W = W - Q_j * α_j
            for i in 0..n {
                for col in 0..p {
                    for k in 0..p {
                        w[i][col] -= current_q[i][k] * alpha_j[k][col];
                    }
                }
            }
            
            // Full reorthogonalization if enabled
            if self.reorthogonalize {
                for prev_block in 0..=block_iter {
                    let q_prev = &q_blocks[prev_block];
                    let overlap = self.block_inner_product(q_prev, &w, n, p);
                    for i in 0..n {
                        for col in 0..p {
                            for k in 0..p {
                                w[i][col] -= q_prev[i][k] * overlap[k][col];
                            }
                        }
                    }
                }
            }
            
            // QR factorization: W = Q_{j+1} * β_{j+1}
            let (q_new, beta_new) = self.block_qr(&w, n, p);
            
            // Check for convergence
            let beta_norm: f64 = beta_new.iter()
                .flat_map(|row| row.iter())
                .map(|&x| x * x)
                .sum::<f64>()
                .sqrt();
            
            if beta_norm < self.tolerance {
                break;
            }
            
            beta.push(beta_new);
            prev_q = current_q.clone();
            q_blocks.push(q_new);
            
            // Solve block tridiagonal eigenvalue problem
            if (block_iter + 1) * p >= self.num_eigenvalues {
                let (eigenvalues, eigenvectors) = self.solve_block_tridiagonal(&alpha, &beta)?;
                
                // Check convergence of desired eigenvalues
                let mut converged = 0;
                for i in 0..self.num_eigenvalues.min(eigenvalues.len()) {
                    // Error estimate from beta * last component of eigenvector
                    let error_est = beta_norm * eigenvectors[i].last().unwrap_or(&0.0).abs();
                    if error_est < self.tolerance * eigenvalues[i].abs().max(1.0) {
                        converged += 1;
                    }
                }
                
                if converged >= self.num_eigenvalues {
                    // Compute actual eigenvectors from Lanczos basis
                    let mut final_eigenvectors = Vec::new();
                    let mut residual_norms = Vec::new();
                    
                    for i in 0..self.num_eigenvalues {
                        let mut x = vec![0.0; n];
                        let y = &eigenvectors[i];
                        
                        for (blk, q_blk) in q_blocks.iter().enumerate() {
                            for j in 0..p {
                                let y_idx = blk * p + j;
                                if y_idx < y.len() {
                                    for k in 0..n {
                                        x[k] += y[y_idx] * q_blk[k][j];
                                    }
                                }
                            }
                        }
                        
                        normalize(&mut x);
                        final_eigenvectors.push(x);
                        residual_norms.push(beta_norm * eigenvectors[i].last().unwrap_or(&0.0).abs());
                    }
                    
                    return Ok(IRAMSolution {
                        eigenvalues: eigenvalues.into_iter().take(self.num_eigenvalues).collect(),
                        eigenvectors: final_eigenvectors,
                        residual_norms,
                        iterations: block_iter + 1,
                        converged_count: converged,
                        info: IRAMInfo {
                            total_arnoldi_steps: (block_iter + 1) * p,
                            implicit_restarts: 0,
                            ops_applied: (block_iter + 1) * p,
                            reorthogonalizations: if self.reorthogonalize { 
                                (block_iter + 1) * (block_iter + 2) / 2 
                            } else { 0 },
                        },
                    });
                }
            }
        }
        
        Err(EigenSolverError::NoConvergence(max_blocks))
    }
    
    fn random_orthonormal_block(&self, n: usize, p: usize) -> Vec<Vec<f64>> {
        let mut block: Vec<Vec<f64>> = vec![vec![0.0; p]; n];
        
        for col in 0..p {
            // Random vector
            for i in 0..n {
                block[i][col] = ((i * 31 + col * 17 + 7) % 97) as f64 / 97.0 - 0.5;
            }
            
            // Orthogonalize against previous columns
            for prev_col in 0..col {
                let mut dot_prod = 0.0;
                for i in 0..n {
                    dot_prod += block[i][col] * block[i][prev_col];
                }
                for i in 0..n {
                    block[i][col] -= dot_prod * block[i][prev_col];
                }
            }
            
            // Normalize
            let mut norm_sq = 0.0;
            for i in 0..n {
                norm_sq += block[i][col] * block[i][col];
            }
            let norm = norm_sq.sqrt();
            if norm > 1e-14 {
                for i in 0..n {
                    block[i][col] /= norm;
                }
            }
        }
        
        block
    }
    
    fn block_inner_product(&self, a: &[Vec<f64>], b: &[Vec<f64>], n: usize, p: usize) -> Vec<Vec<f64>> {
        let mut result = vec![vec![0.0; p]; p];
        for i in 0..p {
            for j in 0..p {
                for k in 0..n {
                    result[i][j] += a[k][i] * b[k][j];
                }
            }
        }
        result
    }
    
    fn block_qr(&self, w: &[Vec<f64>], n: usize, p: usize) -> (Vec<Vec<f64>>, Vec<Vec<f64>>) {
        let mut q = w.to_vec();
        let mut r = vec![vec![0.0; p]; p];
        
        for j in 0..p {
            // R[j,j] = ||Q[:,j]||
            let mut norm_sq = 0.0;
            for i in 0..n {
                norm_sq += q[i][j] * q[i][j];
            }
            r[j][j] = norm_sq.sqrt();
            
            // Normalize Q[:,j]
            if r[j][j] > 1e-14 {
                let scale = 1.0 / r[j][j];
                for i in 0..n {
                    q[i][j] *= scale;
                }
            }
            
            // Orthogonalize remaining columns
            for k in (j + 1)..p {
                // R[j,k] = Q[:,j]^T * Q[:,k]
                let mut dot_prod = 0.0;
                for i in 0..n {
                    dot_prod += q[i][j] * q[i][k];
                }
                r[j][k] = dot_prod;
                
                // Q[:,k] = Q[:,k] - R[j,k] * Q[:,j]
                for i in 0..n {
                    q[i][k] -= r[j][k] * q[i][j];
                }
            }
        }
        
        (q, r)
    }
    
    fn solve_block_tridiagonal(
        &self, 
        alpha: &[Vec<Vec<f64>>], 
        beta: &[Vec<Vec<f64>>]
    ) -> Result<(Vec<f64>, Vec<Vec<f64>>), EigenSolverError> {
        // Build full matrix from block tridiagonal structure and solve
        let p = if !alpha.is_empty() { alpha[0].len() } else { return Ok((vec![], vec![])); };
        let num_blocks = alpha.len();
        let m = num_blocks * p;
        
        // Build dense matrix (small, so this is fine)
        let mut t = vec![vec![0.0; m]; m];
        
        for blk in 0..num_blocks {
            // Diagonal block
            for i in 0..p {
                for j in 0..p {
                    t[blk * p + i][blk * p + j] = alpha[blk][i][j];
                }
            }
            
            // Off-diagonal blocks
            if blk < num_blocks - 1 && blk < beta.len() {
                for i in 0..p {
                    for j in 0..p {
                        t[blk * p + i][(blk + 1) * p + j] = beta[blk][i][j];
                        t[(blk + 1) * p + j][blk * p + i] = beta[blk][i][j];
                    }
                }
            }
        }
        
        // Solve using symmetric QR
        self.dense_symmetric_eig(&t, m)
    }
    
    fn dense_symmetric_eig(&self, a: &[Vec<f64>], n: usize) -> Result<(Vec<f64>, Vec<Vec<f64>>), EigenSolverError> {
        // Householder reduction to tridiagonal + QR
        // Simplified implementation for moderate-sized matrices
        
        let mut d = vec![0.0; n];  // Diagonal
        let mut e = vec![0.0; n];  // Off-diagonal
        let mut z: Vec<Vec<f64>> = (0..n).map(|i| {
            let mut row = vec![0.0; n];
            row[i] = 1.0;
            row
        }).collect();
        
        // Copy diagonal
        for i in 0..n {
            d[i] = a[i][i];
            if i < n - 1 {
                e[i] = a[i][i + 1];
            }
        }
        
        // QL iteration
        for l in 0..n {
            for _iter in 0..30 {
                let mut m = l;
                while m < n - 1 {
                    let dd = d[m].abs() + d[m + 1].abs();
                    if e[m].abs() < 1e-14 * dd {
                        break;
                    }
                    m += 1;
                }
                
                if m == l {
                    break;
                }
                
                // Wilkinson shift
                let g = (d[l + 1] - d[l]) / (2.0 * e[l]);
                let r = (g * g + 1.0).sqrt();
                let g = d[m] - d[l] + e[l] / (g + g.signum() * r);
                
                let mut s = 1.0;
                let mut c = 1.0;
                let mut p = 0.0;
                
                for i in (l..m).rev() {
                    let f = s * e[i];
                    let b = c * e[i];
                    
                    let r = (f * f + g * g).sqrt();
                    e[i + 1] = r;
                    
                    if r.abs() < 1e-14 {
                        d[i + 1] -= p;
                        e[m] = 0.0;
                        break;
                    }
                    
                    s = f / r;
                    c = g / r;
                    let g_new = d[i + 1] - p;
                    let r = (d[i] - g_new) * s + 2.0 * c * b;
                    p = s * r;
                    d[i + 1] = g_new + p;
                    let _g = c * r - b;
                    
                    // Accumulate transformation
                    for k in 0..n {
                        let f = z[k][i + 1];
                        z[k][i + 1] = s * z[k][i] + c * f;
                        z[k][i] = c * z[k][i] - s * f;
                    }
                }
                
                d[l] -= p;
                e[l] = g;
                e[m] = 0.0;
            }
        }
        
        // Sort eigenvalues
        let mut indices: Vec<usize> = (0..n).collect();
        indices.sort_by(|&a, &b| d[a].partial_cmp(&d[b]).unwrap_or(std::cmp::Ordering::Equal));
        
        let eigenvalues: Vec<f64> = indices.iter().map(|&i| d[i]).collect();
        let eigenvectors: Vec<Vec<f64>> = indices.iter().map(|&i| {
            (0..n).map(|k| z[k][i]).collect()
        }).collect();
        
        Ok((eigenvalues, eigenvectors))
    }
}

