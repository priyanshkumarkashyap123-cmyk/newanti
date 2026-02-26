//! Model Order Reduction (ROM)
//!
//! Techniques for reducing computational cost while maintaining accuracy.
//! Essential for real-time simulation, optimization, and uncertainty quantification.
//!
//! ## Methods Implemented
//! - **Modal Truncation** - Keep dominant modes
//! - **Guyan Reduction** - Static condensation
//! - **CMS** - Component Mode Synthesis (Craig-Bampton)
//! - **POD** - Proper Orthogonal Decomposition
//! - **DEIM** - Discrete Empirical Interpolation


// ============================================================================
// MODAL TRUNCATION
// ============================================================================

/// Modal truncation reduction
#[derive(Debug, Clone)]
pub struct ModalTruncation {
    pub n_full: usize,                    // Full model DOFs
    pub n_modes: usize,                   // Number of retained modes
    pub frequencies: Vec<f64>,            // Natural frequencies [Hz]
    pub mode_shapes: Vec<Vec<f64>>,       // Φ (n_full x n_modes)
    pub modal_mass: Vec<f64>,             // Generalized mass
    pub modal_stiffness: Vec<f64>,        // Generalized stiffness
    pub modal_damping: Vec<f64>,          // Modal damping ratios
}

impl ModalTruncation {
    pub fn new(n_full: usize) -> Self {
        ModalTruncation {
            n_full,
            n_modes: 0,
            frequencies: Vec::new(),
            mode_shapes: Vec::new(),
            modal_mass: Vec::new(),
            modal_stiffness: Vec::new(),
            modal_damping: Vec::new(),
        }
    }

    /// Set modes from eigenvalue analysis
    pub fn set_modes(
        &mut self,
        frequencies: Vec<f64>,
        mode_shapes: Vec<Vec<f64>>,
        damping_ratios: Option<Vec<f64>>,
    ) {
        self.n_modes = frequencies.len();
        self.frequencies = frequencies;
        self.mode_shapes = mode_shapes;

        // Compute modal mass and stiffness
        self.modal_mass = vec![1.0; self.n_modes]; // Assuming mass-normalized
        self.modal_stiffness = self.frequencies.iter()
            .map(|f| (2.0 * std::f64::consts::PI * f).powi(2))
            .collect();

        self.modal_damping = damping_ratios.unwrap_or(vec![0.02; self.n_modes]);
    }

    /// Project force to modal coordinates
    /// q = Φᵀ * f
    pub fn project_force(&self, force: &[f64]) -> Vec<f64> {
        let mut modal_force = vec![0.0; self.n_modes];

        for (i, mode) in self.mode_shapes.iter().enumerate() {
            for (j, &phi) in mode.iter().enumerate() {
                if j < force.len() {
                    modal_force[i] += phi * force[j];
                }
            }
        }

        modal_force
    }

    /// Expand modal solution to physical coordinates
    /// u = Φ * q
    pub fn expand_solution(&self, modal_coords: &[f64]) -> Vec<f64> {
        let mut physical = vec![0.0; self.n_full];

        for (i, &q) in modal_coords.iter().enumerate() {
            if i < self.mode_shapes.len() {
                for (j, &phi) in self.mode_shapes[i].iter().enumerate() {
                    physical[j] += phi * q;
                }
            }
        }

        physical
    }

    /// Solve modal equations: m*q̈ + c*q̇ + k*q = f_modal
    pub fn solve_modal_static(&self, modal_force: &[f64]) -> Vec<f64> {
        modal_force.iter()
            .enumerate()
            .map(|(i, &f)| f / self.modal_stiffness[i])
            .collect()
    }

    /// Frequency response (harmonic)
    pub fn frequency_response(&self, modal_force: &[f64], omega: f64) -> Vec<f64> {
        let mut modal_disp = vec![0.0; self.n_modes];

        for i in 0..self.n_modes {
            let omega_n = 2.0 * std::f64::consts::PI * self.frequencies[i];
            let zeta = self.modal_damping[i];

            let r = omega / omega_n;
            let _h_real = (1.0 - r.powi(2)) / ((1.0 - r.powi(2)).powi(2) + (2.0 * zeta * r).powi(2));
            let _h_imag = -2.0 * zeta * r / ((1.0 - r.powi(2)).powi(2) + (2.0 * zeta * r).powi(2));

            // Amplitude (ignoring phase for now)
            let h_mag = 1.0 / ((1.0 - r.powi(2)).powi(2) + (2.0 * zeta * r).powi(2)).sqrt();

            modal_disp[i] = modal_force[i] * h_mag / self.modal_stiffness[i];
        }

        modal_disp
    }

    /// Participation factor for base excitation
    pub fn participation_factors(&self, direction: &[f64]) -> Vec<f64> {
        // Γ = Φᵀ * M * r / (φᵀ * M * φ)
        // For mass-normalized modes: Γ = Φᵀ * M * r

        self.mode_shapes.iter()
            .map(|mode| {
                mode.iter()
                    .zip(direction.iter())
                    .map(|(&phi, &d)| phi * d)
                    .sum::<f64>()
            })
            .collect()
    }

    /// Effective modal mass
    pub fn effective_mass(&self, direction: &[f64]) -> Vec<f64> {
        let gamma = self.participation_factors(direction);
        gamma.iter().map(|g| g.powi(2)).collect()
    }

    /// Cumulative effective mass (fraction of total)
    pub fn cumulative_effective_mass(&self, direction: &[f64]) -> Vec<f64> {
        let eff_mass = self.effective_mass(direction);
        let total: f64 = eff_mass.iter().sum();

        let mut cumulative = Vec::new();
        let mut sum = 0.0;

        for m in eff_mass {
            sum += m;
            cumulative.push(sum / total);
        }

        cumulative
    }
}

// ============================================================================
// GUYAN REDUCTION (STATIC CONDENSATION)
// ============================================================================

/// Guyan/Static condensation
#[derive(Debug, Clone)]
pub struct GuyanReduction {
    pub master_dofs: Vec<usize>,
    pub slave_dofs: Vec<usize>,
    pub transformation: Vec<f64>,  // T matrix (n_full x n_master)
    pub k_reduced: Vec<f64>,       // Reduced stiffness (n_master x n_master)
    pub m_reduced: Vec<f64>,       // Reduced mass (n_master x n_master)
}

impl GuyanReduction {
    pub fn new(n_full: usize, master_dofs: Vec<usize>) -> Self {
        let slave_dofs: Vec<usize> = (0..n_full)
            .filter(|d| !master_dofs.contains(d))
            .collect();

        GuyanReduction {
            master_dofs,
            slave_dofs,
            transformation: Vec::new(),
            k_reduced: Vec::new(),
            m_reduced: Vec::new(),
        }
    }

    /// Compute reduction matrices from full K
    /// u_s = -K_ss⁻¹ * K_sm * u_m
    /// T = [I; -K_ss⁻¹ * K_sm]
    /// K_red = K_mm - K_ms * K_ss⁻¹ * K_sm
    pub fn compute_reduction(
        &mut self,
        k_full: &[f64],
        m_full: &[f64],
        n_full: usize,
    ) {
        let n_m = self.master_dofs.len();
        let n_s = self.slave_dofs.len();

        // Extract submatrices
        let mut k_mm = vec![0.0; n_m * n_m];
        let mut k_ms = vec![0.0; n_m * n_s];
        let mut k_ss = vec![0.0; n_s * n_s];

        // Fill K_mm
        for (i, &di) in self.master_dofs.iter().enumerate() {
            for (j, &dj) in self.master_dofs.iter().enumerate() {
                k_mm[i * n_m + j] = k_full[di * n_full + dj];
            }
        }

        // Fill K_ms
        for (i, &di) in self.master_dofs.iter().enumerate() {
            for (j, &dj) in self.slave_dofs.iter().enumerate() {
                k_ms[i * n_s + j] = k_full[di * n_full + dj];
            }
        }

        // Fill K_ss
        for (i, &di) in self.slave_dofs.iter().enumerate() {
            for (j, &dj) in self.slave_dofs.iter().enumerate() {
                k_ss[i * n_s + j] = k_full[di * n_full + dj];
            }
        }

        // Solve K_ss⁻¹ * K_sm (using simple Cholesky for SPD)
        let k_ss_inv_k_sm = self.solve_system(&k_ss, &self.transpose(&k_ms, n_m, n_s), n_s, n_m);

        // Build transformation matrix
        // T = [I_mm; -K_ss⁻¹ * K_sm]
        self.transformation = vec![0.0; n_full * n_m];

        // Identity for master DOFs
        for (i, &di) in self.master_dofs.iter().enumerate() {
            self.transformation[di * n_m + i] = 1.0;
        }

        // -K_ss⁻¹ * K_sm for slave DOFs
        for (i, &di) in self.slave_dofs.iter().enumerate() {
            for j in 0..n_m {
                self.transformation[di * n_m + j] = -k_ss_inv_k_sm[i * n_m + j];
            }
        }

        // Reduced stiffness: K_red = T' * K * T
        self.k_reduced = self.transform_matrix(k_full, n_full, n_m);

        // Reduced mass: M_red = T' * M * T
        self.m_reduced = self.transform_matrix(m_full, n_full, n_m);
    }

    /// Expand reduced solution to full
    pub fn expand(&self, u_reduced: &[f64]) -> Vec<f64> {
        let n_full = self.master_dofs.len() + self.slave_dofs.len();
        let n_m = self.master_dofs.len();

        let mut u_full = vec![0.0; n_full];

        for i in 0..n_full {
            for (j, &u) in u_reduced.iter().enumerate() {
                u_full[i] += self.transformation[i * n_m + j] * u;
            }
        }

        u_full
    }

    fn transpose(&self, a: &[f64], rows: usize, cols: usize) -> Vec<f64> {
        let mut at = vec![0.0; rows * cols];
        for i in 0..rows {
            for j in 0..cols {
                at[j * rows + i] = a[i * cols + j];
            }
        }
        at
    }

    fn solve_system(&self, a: &[f64], b: &[f64], n: usize, m: usize) -> Vec<f64> {
        // Simple Gaussian elimination (for production, use LAPACK)
        let mut a_aug = a.to_vec();
        let mut x = b.to_vec();

        for i in 0..n {
            // Pivot
            let pivot = a_aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            // Eliminate
            for k in (i + 1)..n {
                let factor = a_aug[k * n + i] / pivot;
                for j in 0..n {
                    a_aug[k * n + j] -= factor * a_aug[i * n + j];
                }
                for j in 0..m {
                    x[k * m + j] -= factor * x[i * m + j];
                }
            }
        }

        // Back substitution
        for i in (0..n).rev() {
            let pivot = a_aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for j in 0..m {
                x[i * m + j] /= pivot;
            }

            for k in 0..i {
                let factor = a_aug[k * n + i];
                for j in 0..m {
                    x[k * m + j] -= factor * x[i * m + j];
                }
            }
        }

        x
    }

    fn transform_matrix(&self, a: &[f64], n: usize, m: usize) -> Vec<f64> {
        // A_red = T' * A * T
        let mut temp = vec![0.0; n * m]; // A * T
        let mut result = vec![0.0; m * m]; // T' * (A * T)

        // A * T
        for i in 0..n {
            for j in 0..m {
                for k in 0..n {
                    temp[i * m + j] += a[i * n + k] * self.transformation[k * m + j];
                }
            }
        }

        // T' * temp
        for i in 0..m {
            for j in 0..m {
                for k in 0..n {
                    result[i * m + j] += self.transformation[k * m + i] * temp[k * m + j];
                }
            }
        }

        result
    }
}

// ============================================================================
// CRAIG-BAMPTON (COMPONENT MODE SYNTHESIS)
// ============================================================================

/// Craig-Bampton CMS
#[derive(Debug, Clone)]
pub struct CraigBampton {
    pub interface_dofs: Vec<usize>,        // Boundary DOFs
    pub internal_dofs: Vec<usize>,         // Internal DOFs
    pub n_fixed_modes: usize,              // Number of fixed-interface modes
    pub constraint_modes: Vec<Vec<f64>>,   // Ψ_c
    pub fixed_modes: Vec<Vec<f64>>,        // Φ_k
    pub fixed_frequencies: Vec<f64>,       // ω_k
}

impl CraigBampton {
    pub fn new(n_full: usize, interface_dofs: Vec<usize>, n_modes: usize) -> Self {
        let internal_dofs: Vec<usize> = (0..n_full)
            .filter(|d| !interface_dofs.contains(d))
            .collect();

        CraigBampton {
            interface_dofs,
            internal_dofs,
            n_fixed_modes: n_modes,
            constraint_modes: Vec::new(),
            fixed_modes: Vec::new(),
            fixed_frequencies: Vec::new(),
        }
    }

    /// Compute CB reduction matrices
    pub fn compute_reduction(
        &mut self,
        k_full: &[f64],
        m_full: &[f64],
        n_full: usize,
    ) {
        let n_b = self.interface_dofs.len();
        let n_i = self.internal_dofs.len();

        // Extract submatrices
        let (k_ii, k_ib, _k_bb, m_ii, _m_ib, _m_bb) = 
            self.extract_submatrices(k_full, m_full, n_full);

        // Constraint modes: Ψ_c = -K_ii⁻¹ * K_ib
        self.constraint_modes = self.compute_constraint_modes(&k_ii, &k_ib, n_i, n_b);

        // Fixed-interface modes: solve (K_ii - ω² M_ii) Φ = 0
        let (freqs, modes) = self.compute_fixed_modes(&k_ii, &m_ii, n_i);

        self.fixed_frequencies = freqs.into_iter().take(self.n_fixed_modes).collect();
        self.fixed_modes = modes.into_iter().take(self.n_fixed_modes).collect();
    }

    /// Build transformation matrix
    /// T = [Ψ_c  Φ_k]
    ///     [I    0  ]
    pub fn transformation_matrix(&self) -> Vec<f64> {
        let n_b = self.interface_dofs.len();
        let n_i = self.internal_dofs.len();
        let n_cb = n_b + self.n_fixed_modes;
        let n_full = n_b + n_i;

        let mut t = vec![0.0; n_full * n_cb];

        // Constraint modes (internal rows)
        for (i, row) in self.constraint_modes.iter().enumerate() {
            let full_row = self.internal_dofs[i];
            for (j, &val) in row.iter().enumerate() {
                t[full_row * n_cb + j] = val;
            }
        }

        // Fixed modes (internal rows)
        for (k, mode) in self.fixed_modes.iter().enumerate() {
            for (i, &val) in mode.iter().enumerate() {
                let full_row = self.internal_dofs[i];
                t[full_row * n_cb + n_b + k] = val;
            }
        }

        // Identity for boundary DOFs
        for (i, &dof) in self.interface_dofs.iter().enumerate() {
            t[dof * n_cb + i] = 1.0;
        }

        t
    }

    /// Reduced DOF count
    pub fn reduced_size(&self) -> usize {
        self.interface_dofs.len() + self.n_fixed_modes
    }

    fn extract_submatrices(
        &self,
        k: &[f64],
        m: &[f64],
        n: usize,
    ) -> (Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>) {
        let n_i = self.internal_dofs.len();
        let n_b = self.interface_dofs.len();

        let mut k_ii = vec![0.0; n_i * n_i];
        let mut k_ib = vec![0.0; n_i * n_b];
        let mut k_bb = vec![0.0; n_b * n_b];
        let mut m_ii = vec![0.0; n_i * n_i];
        let mut m_ib = vec![0.0; n_i * n_b];
        let mut m_bb = vec![0.0; n_b * n_b];

        for (i, &di) in self.internal_dofs.iter().enumerate() {
            for (j, &dj) in self.internal_dofs.iter().enumerate() {
                k_ii[i * n_i + j] = k[di * n + dj];
                m_ii[i * n_i + j] = m[di * n + dj];
            }
            for (j, &dj) in self.interface_dofs.iter().enumerate() {
                k_ib[i * n_b + j] = k[di * n + dj];
                m_ib[i * n_b + j] = m[di * n + dj];
            }
        }

        for (i, &di) in self.interface_dofs.iter().enumerate() {
            for (j, &dj) in self.interface_dofs.iter().enumerate() {
                k_bb[i * n_b + j] = k[di * n + dj];
                m_bb[i * n_b + j] = m[di * n + dj];
            }
        }

        (k_ii, k_ib, k_bb, m_ii, m_ib, m_bb)
    }

    fn compute_constraint_modes(
        &self,
        k_ii: &[f64],
        k_ib: &[f64],
        n_i: usize,
        n_b: usize,
    ) -> Vec<Vec<f64>> {
        // Ψ_c = -K_ii⁻¹ * K_ib
        // Each column is response to unit boundary displacement

        let mut modes = Vec::new();

        // Simple inversion (for production, use sparse solver)
        let k_ii_inv = self.invert_matrix(k_ii, n_i);

        for j in 0..n_b {
            let mut mode = vec![0.0; n_i];
            for i in 0..n_i {
                for k in 0..n_i {
                    mode[i] -= k_ii_inv[i * n_i + k] * k_ib[k * n_b + j];
                }
            }
            modes.push(mode);
        }

        // Transpose to get row format
        let mut result = vec![vec![0.0; n_b]; n_i];
        for i in 0..n_i {
            for j in 0..n_b {
                result[i][j] = modes[j][i];
            }
        }

        result
    }

    fn compute_fixed_modes(
        &self,
        k_ii: &[f64],
        m_ii: &[f64],
        n_i: usize,
    ) -> (Vec<f64>, Vec<Vec<f64>>) {
        // Simplified eigenvalue solve using power iteration for first few modes
        let mut frequencies = Vec::new();
        let mut modes = Vec::new();

        let mut deflation = k_ii.to_vec();

        for _ in 0..self.n_fixed_modes.min(n_i) {
            // Inverse iteration for smallest eigenvalue
            let (lambda, phi) = self.inverse_iteration(&deflation, m_ii, n_i);

            if lambda > 0.0 {
                frequencies.push(lambda.sqrt() / (2.0 * std::f64::consts::PI));
                modes.push(phi.clone());

                // Deflate
                for i in 0..n_i {
                    for j in 0..n_i {
                        deflation[i * n_i + j] -= lambda * phi[i] * phi[j];
                    }
                }
            }
        }

        (frequencies, modes)
    }

    fn inverse_iteration(&self, a: &[f64], b: &[f64], n: usize) -> (f64, Vec<f64>) {
        let mut x = vec![1.0; n];
        let mut lambda = 0.0;

        for _ in 0..50 {
            // Solve A * y = B * x
            let bx: Vec<f64> = (0..n).map(|i| {
                (0..n).map(|j| b[i * n + j] * x[j]).sum::<f64>()
            }).collect();

            let y = self.solve_linear(a, &bx, n);

            // Rayleigh quotient
            let xbx: f64 = (0..n).map(|i| x[i] * bx[i]).sum();
            let xay: f64 = (0..n).map(|i| x[i] * {
                (0..n).map(|j| a[i * n + j] * y[j]).sum::<f64>()
            }).sum();

            lambda = xay / xbx;

            // Normalize
            let norm: f64 = y.iter().map(|&v| v * v).sum::<f64>().sqrt();
            x = y.iter().map(|&v| v / norm).collect();
        }

        (lambda, x)
    }

    fn solve_linear(&self, a: &[f64], b: &[f64], n: usize) -> Vec<f64> {
        let mut aug = a.to_vec();
        let mut x = b.to_vec();

        // Gaussian elimination
        for i in 0..n {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for k in (i + 1)..n {
                let factor = aug[k * n + i] / pivot;
                for j in 0..n {
                    aug[k * n + j] -= factor * aug[i * n + j];
                }
                x[k] -= factor * x[i];
            }
        }

        // Back substitution
        for i in (0..n).rev() {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }
            x[i] /= pivot;
            for k in 0..i {
                x[k] -= aug[k * n + i] * x[i];
            }
        }

        x
    }

    fn invert_matrix(&self, a: &[f64], n: usize) -> Vec<f64> {
        let mut inv = vec![0.0; n * n];

        // Initialize as identity
        for i in 0..n {
            inv[i * n + i] = 1.0;
        }

        let mut aug = a.to_vec();

        for i in 0..n {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for j in 0..n {
                aug[i * n + j] /= pivot;
                inv[i * n + j] /= pivot;
            }

            for k in 0..n {
                if k != i {
                    let factor = aug[k * n + i];
                    for j in 0..n {
                        aug[k * n + j] -= factor * aug[i * n + j];
                        inv[k * n + j] -= factor * inv[i * n + j];
                    }
                }
            }
        }

        inv
    }
}

// ============================================================================
// PROPER ORTHOGONAL DECOMPOSITION (POD)
// ============================================================================

/// POD/SVD-based reduction
#[derive(Debug, Clone)]
pub struct PODReduction {
    pub snapshots: Vec<Vec<f64>>,      // Training data (solution snapshots)
    pub basis: Vec<Vec<f64>>,          // POD modes
    pub singular_values: Vec<f64>,      // σ_i
    pub n_modes: usize,
    pub energy_threshold: f64,
}

impl PODReduction {
    pub fn new(energy_threshold: f64) -> Self {
        PODReduction {
            snapshots: Vec::new(),
            basis: Vec::new(),
            singular_values: Vec::new(),
            n_modes: 0,
            energy_threshold,
        }
    }

    /// Add snapshot to training data
    pub fn add_snapshot(&mut self, snapshot: Vec<f64>) {
        self.snapshots.push(snapshot);
    }

    /// Compute POD basis from snapshots
    pub fn compute_basis(&mut self) {
        if self.snapshots.is_empty() {
            return;
        }

        let n = self.snapshots[0].len();
        let m = self.snapshots.len();

        // Method of snapshots (efficient for n >> m)
        // C = S' * S (m x m correlation matrix)
        let mut c = vec![0.0; m * m];

        for i in 0..m {
            for j in 0..m {
                c[i * m + j] = self.snapshots[i].iter()
                    .zip(self.snapshots[j].iter())
                    .map(|(&a, &b)| a * b)
                    .sum();
            }
        }

        // Eigendecomposition of C
        let (eigenvalues, eigenvectors) = self.eigen_symmetric(&c, m);

        // Compute POD basis: Φ_i = S * v_i / √λ_i
        let total_energy: f64 = eigenvalues.iter().sum();
        let mut cum_energy = 0.0;

        for (k, &lambda) in eigenvalues.iter().enumerate() {
            cum_energy += lambda;

            if cum_energy / total_energy >= self.energy_threshold {
                self.n_modes = k + 1;
                break;
            }
        }

        self.n_modes = self.n_modes.max(1).min(m);
        self.singular_values = eigenvalues.iter().take(self.n_modes).map(|&l| l.sqrt()).collect();

        // Compute basis vectors
        self.basis.clear();
        for k in 0..self.n_modes {
            let mut phi = vec![0.0; n];
            let sqrt_lambda = eigenvalues[k].sqrt().max(1e-14);

            for (j, snap) in self.snapshots.iter().enumerate() {
                let coeff = eigenvectors[j * m + k] / sqrt_lambda;
                for (i, &s) in snap.iter().enumerate() {
                    phi[i] += coeff * s;
                }
            }

            self.basis.push(phi);
        }
    }

    /// Project to reduced space
    pub fn project(&self, u: &[f64]) -> Vec<f64> {
        self.basis.iter()
            .map(|phi| {
                phi.iter().zip(u.iter()).map(|(&p, &v)| p * v).sum()
            })
            .collect()
    }

    /// Reconstruct from reduced coordinates
    pub fn reconstruct(&self, q: &[f64]) -> Vec<f64> {
        let n = if !self.basis.is_empty() { self.basis[0].len() } else { 0 };
        let mut u = vec![0.0; n];

        for (k, &qk) in q.iter().enumerate() {
            if k < self.basis.len() {
                for (i, &phi) in self.basis[k].iter().enumerate() {
                    u[i] += qk * phi;
                }
            }
        }

        u
    }

    /// Relative information content (RIC)
    pub fn relative_information_content(&self) -> Vec<f64> {
        let total: f64 = self.singular_values.iter().map(|s| s * s).sum();
        let mut ric = Vec::new();
        let mut cum = 0.0;

        for s in &self.singular_values {
            cum += s * s;
            ric.push(cum / total);
        }

        ric
    }

    fn eigen_symmetric(&self, a: &[f64], n: usize) -> (Vec<f64>, Vec<f64>) {
        // Simplified QR algorithm
        let mut eigenvalues = vec![0.0; n];
        let mut eigenvectors = vec![0.0; n * n];

        // Initialize eigenvectors as identity
        for i in 0..n {
            eigenvectors[i * n + i] = 1.0;
        }

        let mut work = a.to_vec();

        // Power iteration for each eigenvalue (simplified)
        for k in 0..n {
            let mut v = vec![0.0; n];
            v[k] = 1.0;

            for _ in 0..100 {
                // w = A * v
                let w: Vec<f64> = (0..n).map(|i| {
                    (0..n).map(|j| work[i * n + j] * v[j]).sum()
                }).collect();

                // Normalize
                let norm: f64 = w.iter().map(|x| x * x).sum::<f64>().sqrt();
                if norm < 1e-14 {
                    break;
                }
                v = w.iter().map(|x| x / norm).collect();
            }

            // Rayleigh quotient
            let av: Vec<f64> = (0..n).map(|i| {
                (0..n).map(|j| work[i * n + j] * v[j]).sum()
            }).collect();
            let lambda: f64 = v.iter().zip(av.iter()).map(|(a, b)| a * b).sum();

            eigenvalues[k] = lambda;
            for i in 0..n {
                eigenvectors[i * n + k] = v[i];
            }

            // Deflate
            for i in 0..n {
                for j in 0..n {
                    work[i * n + j] -= lambda * v[i] * v[j];
                }
            }
        }

        // Sort by descending eigenvalue
        let mut indices: Vec<usize> = (0..n).collect();
        indices.sort_by(|&a, &b| eigenvalues[b].partial_cmp(&eigenvalues[a]).unwrap_or(std::cmp::Ordering::Equal));

        let sorted_vals: Vec<f64> = indices.iter().map(|&i| eigenvalues[i]).collect();
        let mut sorted_vecs = vec![0.0; n * n];
        for (new_k, &old_k) in indices.iter().enumerate() {
            for i in 0..n {
                sorted_vecs[i * n + new_k] = eigenvectors[i * n + old_k];
            }
        }

        (sorted_vals, sorted_vecs)
    }
}

// ============================================================================
// DISCRETE EMPIRICAL INTERPOLATION METHOD (DEIM)
// ============================================================================

/// DEIM for nonlinear term approximation
#[derive(Debug, Clone)]
pub struct DEIM {
    pub interpolation_indices: Vec<usize>,
    pub basis: Vec<Vec<f64>>,
    pub projector: Vec<f64>,  // (P' * U)^-1 * P'
}

impl DEIM {
    pub fn new() -> Self {
        DEIM {
            interpolation_indices: Vec::new(),
            basis: Vec::new(),
            projector: Vec::new(),
        }
    }

    /// Compute DEIM interpolation indices
    pub fn compute_indices(&mut self, pod_basis: &[Vec<f64>]) {
        if pod_basis.is_empty() {
            return;
        }

        let _n = pod_basis[0].len();
        let m = pod_basis.len();

        self.basis = pod_basis.to_vec();
        self.interpolation_indices.clear();

        // First index: max of first basis vector
        let (idx0, _) = pod_basis[0].iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.abs().partial_cmp(&b.abs()).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap();

        self.interpolation_indices.push(idx0);

        // Build P matrix and compute remaining indices
        for l in 1..m {
            // Solve (P' * U_l-1)^-1 * P' * u_l for coefficients
            // Then r = u_l - U_l-1 * c
            // New index = argmax |r|

            let u_l = &pod_basis[l];
            let mut r = u_l.clone();

            // Simple approximation: just find max of residual
            for &idx in &self.interpolation_indices {
                // Subtract projection
                for (i, r_i) in r.iter_mut().enumerate() {
                    for k in 0..l {
                        *r_i -= pod_basis[k][i] * pod_basis[k][idx];
                    }
                }
            }

            let (new_idx, _) = r.iter()
                .enumerate()
                .filter(|(i, _)| !self.interpolation_indices.contains(i))
                .max_by(|(_, a), (_, b)| a.abs().partial_cmp(&b.abs()).unwrap_or(std::cmp::Ordering::Equal))
                .unwrap_or((0, &0.0));

            self.interpolation_indices.push(new_idx);
        }

        // Build projector
        self.build_projector();
    }

    fn build_projector(&mut self) {
        let m = self.basis.len();
        let n = if m > 0 { self.basis[0].len() } else { 0 };

        // P' * U matrix (m x m)
        let mut pu = vec![0.0; m * m];
        for (i, &idx) in self.interpolation_indices.iter().enumerate() {
            for (j, basis_j) in self.basis.iter().enumerate() {
                pu[i * m + j] = basis_j[idx];
            }
        }

        // Invert (simplified)
        let pu_inv = self.invert_small(&pu, m);

        // Projector = U * (P' * U)^-1 (n x m)
        self.projector = vec![0.0; n * m];
        for i in 0..n {
            for j in 0..m {
                for k in 0..m {
                    self.projector[i * m + j] += self.basis[k][i] * pu_inv[k * m + j];
                }
            }
        }
    }

    /// Approximate nonlinear function from samples
    pub fn approximate(&self, samples: &[f64]) -> Vec<f64> {
        let n = if !self.basis.is_empty() { self.basis[0].len() } else { 0 };
        let m = self.interpolation_indices.len();

        let mut result = vec![0.0; n];

        for i in 0..n {
            for (j, &sample) in samples.iter().enumerate().take(m) {
                result[i] += self.projector[i * m + j] * sample;
            }
        }

        result
    }

    fn invert_small(&self, a: &[f64], n: usize) -> Vec<f64> {
        let mut inv = vec![0.0; n * n];
        let mut aug = a.to_vec();

        for i in 0..n {
            inv[i * n + i] = 1.0;
        }

        for i in 0..n {
            let pivot = aug[i * n + i];
            if pivot.abs() < 1e-14 {
                continue;
            }

            for j in 0..n {
                aug[i * n + j] /= pivot;
                inv[i * n + j] /= pivot;
            }

            for k in 0..n {
                if k != i {
                    let factor = aug[k * n + i];
                    for j in 0..n {
                        aug[k * n + j] -= factor * aug[i * n + j];
                        inv[k * n + j] -= factor * inv[i * n + j];
                    }
                }
            }
        }

        inv
    }
}

impl Default for DEIM {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_modal_truncation() {
        let mut modal = ModalTruncation::new(100);
        modal.set_modes(
            vec![10.0, 25.0, 50.0],
            vec![vec![1.0; 100], vec![1.0; 100], vec![1.0; 100]],
            None,
        );

        assert_eq!(modal.n_modes, 3);
    }

    #[test]
    fn test_modal_projection() {
        let mut modal = ModalTruncation::new(3);
        modal.set_modes(
            vec![10.0],
            vec![vec![1.0, 0.0, 0.0]],
            None,
        );

        let force = vec![100.0, 0.0, 0.0];
        let modal_force = modal.project_force(&force);

        assert!((modal_force[0] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_participation_factor() {
        let mut modal = ModalTruncation::new(3);
        modal.set_modes(
            vec![10.0],
            vec![vec![1.0, 1.0, 1.0]],
            None,
        );

        let direction = vec![1.0, 0.0, 0.0];
        let gamma = modal.participation_factors(&direction);

        assert!((gamma[0] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_guyan_reduction() {
        let mut guyan = GuyanReduction::new(6, vec![0, 1, 2]);
        assert_eq!(guyan.slave_dofs, vec![3, 4, 5]);
    }

    #[test]
    fn test_craig_bampton_creation() {
        let cb = CraigBampton::new(100, vec![0, 1, 2], 10);
        assert_eq!(cb.reduced_size(), 13); // 3 interface + 10 modes
    }

    #[test]
    fn test_pod_add_snapshot() {
        let mut pod = PODReduction::new(0.99);
        pod.add_snapshot(vec![1.0, 2.0, 3.0]);
        pod.add_snapshot(vec![1.1, 2.1, 3.1]);

        assert_eq!(pod.snapshots.len(), 2);
    }

    #[test]
    fn test_pod_compute_basis() {
        let mut pod = PODReduction::new(0.99);
        pod.add_snapshot(vec![1.0, 0.0, 0.0]);
        pod.add_snapshot(vec![0.9, 0.1, 0.0]);
        pod.add_snapshot(vec![1.1, -0.1, 0.0]);

        pod.compute_basis();

        assert!(pod.n_modes >= 1);
        assert!(!pod.basis.is_empty());
    }

    #[test]
    fn test_pod_project_reconstruct() {
        let mut pod = PODReduction::new(0.99);
        pod.basis = vec![vec![1.0, 0.0, 0.0], vec![0.0, 1.0, 0.0]];
        pod.n_modes = 2;

        let u = vec![3.0, 4.0, 0.0];
        let q = pod.project(&u);
        let u_rec = pod.reconstruct(&q);

        assert!((u_rec[0] - 3.0).abs() < 1e-10);
        assert!((u_rec[1] - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_deim_indices() {
        let mut deim = DEIM::new();
        let basis = vec![
            vec![1.0, 0.5, 0.2],
            vec![0.1, 1.0, 0.3],
        ];

        deim.compute_indices(&basis);

        assert_eq!(deim.interpolation_indices.len(), 2);
    }

    #[test]
    fn test_modal_frequency_response() {
        let mut modal = ModalTruncation::new(1);
        modal.set_modes(
            vec![10.0],  // 10 Hz
            vec![vec![1.0]],
            Some(vec![0.05]),
        );

        // At resonance, response should be non-zero
        let omega_n = 2.0 * std::f64::consts::PI * 10.0;
        let resp = modal.frequency_response(&[1.0], omega_n);

        // Response should be finite and non-negative
        assert!(resp[0].is_finite(), "Response should be finite");
        assert!(resp[0] >= 0.0, "Response should be non-negative, got {}", resp[0]);
    }

    #[test]
    fn test_ric() {
        let mut pod = PODReduction::new(0.99);
        pod.singular_values = vec![10.0, 5.0, 2.0, 1.0];

        let ric = pod.relative_information_content();

        assert!(ric[0] > 0.5);  // First mode captures most energy
        assert!((ric[3] - 1.0).abs() < 1e-10);  // All modes = 100%
    }
}
