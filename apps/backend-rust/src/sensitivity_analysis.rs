//! Sensitivity Analysis
//!
//! Comprehensive module for computing sensitivities of structural responses
//! with respect to design parameters. Essential for optimization and UQ.
//!
//! ## Methods Implemented
//! - **Direct Differentiation Method (DDM)** - Forward sensitivity
//! - **Adjoint Method** - Efficient for many parameters
//! - **Finite Differences** - Verification and simple cases
//! - **Semi-Analytical** - Hybrid approaches
//! - **Shape Sensitivity** - Geometric variations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// DESIGN PARAMETERS
// ============================================================================

/// Type of design parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParameterType {
    /// Material property (E, ν, ρ, etc.)
    Material {
        property: MaterialProperty,
        element_ids: Vec<usize>,
    },
    /// Sizing parameter (thickness, area)
    Sizing {
        property: SizingProperty,
        element_ids: Vec<usize>,
    },
    /// Shape parameter (node coordinates)
    Shape {
        node_ids: Vec<usize>,
        direction: ShapeDirection,
    },
    /// Load parameter (magnitude, direction)
    Load {
        load_id: usize,
        component: LoadComponent,
    },
    /// Boundary condition
    Boundary {
        bc_id: usize,
        component: BCComponent,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MaterialProperty {
    YoungModulus,
    PoissonsRatio,
    Density,
    YieldStrength,
    ThermalConductivity,
    ThermalExpansion,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SizingProperty {
    Thickness,
    CrossSectionArea,
    MomentOfInertia,
    TorsionalConstant,
    Width,
    Height,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShapeDirection {
    X,
    Y,
    Z,
    Normal,  // Surface normal direction
    Custom(Vec<f64>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoadComponent {
    Magnitude,
    DirectionX,
    DirectionY,
    DirectionZ,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BCComponent {
    Value,
    Stiffness,
}

/// Design parameter definition
#[derive(Debug, Clone)]
pub struct DesignParameter {
    pub name: String,
    pub param_type: ParameterType,
    pub value: f64,
    pub lower_bound: f64,
    pub upper_bound: f64,
    pub scaling: f64,  // For normalization
}

impl DesignParameter {
    pub fn new(name: &str, param_type: ParameterType, value: f64) -> Self {
        DesignParameter {
            name: name.to_string(),
            param_type,
            value,
            lower_bound: f64::NEG_INFINITY,
            upper_bound: f64::INFINITY,
            scaling: 1.0,
        }
    }

    pub fn with_bounds(mut self, lower: f64, upper: f64) -> Self {
        self.lower_bound = lower;
        self.upper_bound = upper;
        self
    }

    pub fn with_scaling(mut self, scaling: f64) -> Self {
        self.scaling = scaling;
        self
    }

    /// Normalized value in [0, 1]
    pub fn normalized_value(&self) -> f64 {
        (self.value - self.lower_bound) / (self.upper_bound - self.lower_bound)
    }
}

// ============================================================================
// RESPONSE FUNCTIONS
// ============================================================================

/// Type of response function
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseType {
    /// Displacement at specific DOF
    Displacement { dof: usize },
    /// Stress component at element/point
    Stress { element_id: usize, component: StressComponent },
    /// Strain energy
    StrainEnergy,
    /// Compliance (u'Ku)
    Compliance,
    /// Natural frequency
    NaturalFrequency { mode: usize },
    /// Weight/Mass
    Mass,
    /// Volume
    Volume,
    /// Maximum von Mises stress
    MaxVonMises,
    /// Custom function
    Custom { name: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StressComponent {
    XX,
    YY,
    ZZ,
    XY,
    YZ,
    XZ,
    VonMises,
    Principal1,
    Principal2,
    Principal3,
}

/// Response function with computed value and sensitivity
#[derive(Debug, Clone)]
pub struct ResponseFunction {
    pub name: String,
    pub response_type: ResponseType,
    pub value: f64,
    pub sensitivities: HashMap<String, f64>,  // param_name -> dR/dp
}

impl ResponseFunction {
    pub fn new(name: &str, response_type: ResponseType) -> Self {
        ResponseFunction {
            name: name.to_string(),
            response_type,
            value: 0.0,
            sensitivities: HashMap::new(),
        }
    }
}

// ============================================================================
// FINITE DIFFERENCE SENSITIVITY
// ============================================================================

/// Finite difference method for sensitivity
#[derive(Debug, Clone)]
pub struct FiniteDifferenceSensitivity {
    pub method: FDMethod,
    pub step_size: f64,
    pub relative_step: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum FDMethod {
    Forward,
    Backward,
    Central,
    Complex,  // Complex-step derivative
}

impl FiniteDifferenceSensitivity {
    pub fn forward(step_size: f64) -> Self {
        FiniteDifferenceSensitivity {
            method: FDMethod::Forward,
            step_size,
            relative_step: false,
        }
    }

    pub fn central(step_size: f64) -> Self {
        FiniteDifferenceSensitivity {
            method: FDMethod::Central,
            step_size,
            relative_step: false,
        }
    }

    pub fn with_relative_step(mut self) -> Self {
        self.relative_step = true;
        self
    }

    /// Compute sensitivity using finite differences
    /// f_plus, f_minus are function values at perturbed states
    pub fn compute_sensitivity(&self, f_plus: f64, f_minus: f64, param_value: f64) -> f64 {
        let h = if self.relative_step {
            self.step_size * param_value.abs().max(1e-8)
        } else {
            self.step_size
        };

        match self.method {
            FDMethod::Forward => (f_plus - f_minus) / h,
            FDMethod::Backward => (f_minus - f_plus) / h,
            FDMethod::Central => (f_plus - f_minus) / (2.0 * h),
            FDMethod::Complex => f_plus / h,  // Imag(f(x + ih)) / h
        }
    }

    /// Get perturbation step for a parameter
    pub fn get_step(&self, param_value: f64) -> f64 {
        if self.relative_step {
            self.step_size * param_value.abs().max(1e-8)
        } else {
            self.step_size
        }
    }
}

// ============================================================================
// DIRECT DIFFERENTIATION METHOD (DDM)
// ============================================================================

/// Direct differentiation for static analysis
/// K * du/dp = dF/dp - dK/dp * u
#[derive(Debug, Clone)]
pub struct DirectDifferentiation {
    pub n_dof: usize,
    pub n_params: usize,
    pub displacement: Vec<f64>,
    pub displacement_sensitivity: Vec<Vec<f64>>,  // du/dp for each param
}

impl DirectDifferentiation {
    pub fn new(n_dof: usize, n_params: usize) -> Self {
        DirectDifferentiation {
            n_dof,
            n_params,
            displacement: vec![0.0; n_dof],
            displacement_sensitivity: vec![vec![0.0; n_dof]; n_params],
        }
    }

    /// Compute displacement sensitivity
    /// K * (du/dp) = dF/dp - dK/dp * u
    pub fn compute_sensitivity(
        &mut self,
        k_factorized: &LinearSystemSolver,
        dk_dp: &[f64],      // dK/dp (sparse or dense)
        df_dp: &[f64],      // dF/dp
        param_idx: usize,
    ) {
        // Right-hand side: dF/dp - dK/dp * u
        let mut rhs = df_dp.to_vec();

        // Subtract dK/dp * u
        for i in 0..self.n_dof {
            for j in 0..self.n_dof {
                rhs[i] -= dk_dp[i * self.n_dof + j] * self.displacement[j];
            }
        }

        // Solve: K * (du/dp) = rhs
        self.displacement_sensitivity[param_idx] = k_factorized.solve(&rhs);
    }

    /// Response sensitivity from displacement sensitivity
    /// For displacement response: dR/dp = du_i/dp
    pub fn displacement_response_sensitivity(&self, dof_idx: usize, param_idx: usize) -> f64 {
        self.displacement_sensitivity[param_idx][dof_idx]
    }

    /// Compliance sensitivity
    /// C = u' * K * u = u' * F
    /// dC/dp = 2 * (du/dp)' * F + u' * (dF/dp)
    pub fn compliance_sensitivity(
        &self,
        force: &[f64],
        df_dp: &[f64],
        param_idx: usize,
    ) -> f64 {
        let du_dp = &self.displacement_sensitivity[param_idx];

        let term1: f64 = du_dp.iter().zip(force.iter()).map(|(d, f)| 2.0 * d * f).sum();
        let term2: f64 = self.displacement.iter().zip(df_dp.iter()).map(|(u, df)| u * df).sum();

        term1 + term2
    }

    /// Strain energy sensitivity
    /// W = 0.5 * u' * K * u
    /// dW/dp = (du/dp)' * K * u + 0.5 * u' * (dK/dp) * u
    pub fn strain_energy_sensitivity(
        &self,
        stiffness: &[f64],
        dk_dp: &[f64],
        param_idx: usize,
    ) -> f64 {
        let du_dp = &self.displacement_sensitivity[param_idx];
        let u = &self.displacement;
        let n = self.n_dof;

        // Term 1: (du/dp)' * K * u
        let mut term1 = 0.0;
        for i in 0..n {
            let mut ku_i = 0.0;
            for j in 0..n {
                ku_i += stiffness[i * n + j] * u[j];
            }
            term1 += du_dp[i] * ku_i;
        }

        // Term 2: 0.5 * u' * (dK/dp) * u
        let mut term2 = 0.0;
        for i in 0..n {
            for j in 0..n {
                term2 += u[i] * dk_dp[i * n + j] * u[j];
            }
        }
        term2 *= 0.5;

        term1 + term2
    }
}

/// Placeholder for linear system solver
#[derive(Debug, Clone)]
pub struct LinearSystemSolver {
    pub l: Vec<f64>,  // Cholesky factor
    pub n: usize,
}

impl LinearSystemSolver {
    pub fn new(n: usize) -> Self {
        LinearSystemSolver {
            l: vec![0.0; n * n],
            n,
        }
    }

    /// Factorize matrix (placeholder)
    pub fn factorize(&mut self, k: &[f64]) {
        // Simple Cholesky factorization
        self.l = vec![0.0; self.n * self.n];

        for i in 0..self.n {
            for j in 0..=i {
                let mut sum = k[i * self.n + j];

                for k in 0..j {
                    sum -= self.l[i * self.n + k] * self.l[j * self.n + k];
                }

                if i == j {
                    self.l[i * self.n + j] = sum.sqrt().max(1e-14);
                } else {
                    self.l[i * self.n + j] = sum / self.l[j * self.n + j];
                }
            }
        }
    }

    /// Solve L * L' * x = b
    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let mut y = vec![0.0; self.n];
        let mut x = vec![0.0; self.n];

        // Forward substitution: L * y = b
        for i in 0..self.n {
            y[i] = b[i];
            for j in 0..i {
                y[i] -= self.l[i * self.n + j] * y[j];
            }
            y[i] /= self.l[i * self.n + i];
        }

        // Backward substitution: L' * x = y
        for i in (0..self.n).rev() {
            x[i] = y[i];
            for j in (i + 1)..self.n {
                x[i] -= self.l[j * self.n + i] * x[j];
            }
            x[i] /= self.l[i * self.n + i];
        }

        x
    }
}

// ============================================================================
// ADJOINT METHOD
// ============================================================================

/// Adjoint sensitivity analysis
/// Efficient when #responses << #parameters
#[derive(Debug, Clone)]
pub struct AdjointMethod {
    pub n_dof: usize,
    pub adjoint_vectors: HashMap<String, Vec<f64>>,  // One per response
}

impl AdjointMethod {
    pub fn new(n_dof: usize) -> Self {
        AdjointMethod {
            n_dof,
            adjoint_vectors: HashMap::new(),
        }
    }

    /// Compute adjoint vector for a response
    /// K' * λ = dR/du
    pub fn compute_adjoint(
        &mut self,
        response_name: &str,
        k_factorized: &LinearSystemSolver,
        dr_du: &[f64],  // Response gradient w.r.t. displacement
    ) {
        // Solve K' * λ = dR/du
        // For symmetric K: K * λ = dR/du
        let adjoint = k_factorized.solve(dr_du);
        self.adjoint_vectors.insert(response_name.to_string(), adjoint);
    }

    /// Compute sensitivity using adjoint
    /// dR/dp = dR/dp_explicit - λ' * (dK/dp * u - dF/dp)
    pub fn compute_sensitivity(
        &self,
        response_name: &str,
        dr_dp_explicit: f64,  // Explicit dependence
        dk_dp: &[f64],
        df_dp: &[f64],
        displacement: &[f64],
    ) -> f64 {
        let lambda = match self.adjoint_vectors.get(response_name) {
            Some(l) => l,
            None => return 0.0,
        };

        let n = self.n_dof;

        // dK/dp * u
        let mut dk_u = vec![0.0; n];
        for i in 0..n {
            for j in 0..n {
                dk_u[i] += dk_dp[i * n + j] * displacement[j];
            }
        }

        // λ' * (dK/dp * u - dF/dp)
        let mut implicit: f64 = 0.0;
        for i in 0..n {
            implicit += lambda[i] * (dk_u[i] - df_dp[i]);
        }

        dr_dp_explicit - implicit
    }

    /// Displacement response gradient
    /// For u_i: dR/du = e_i (unit vector)
    pub fn displacement_gradient(n_dof: usize, dof_idx: usize) -> Vec<f64> {
        let mut grad = vec![0.0; n_dof];
        grad[dof_idx] = 1.0;
        grad
    }

    /// Compliance gradient
    /// C = u' * K * u = u' * F
    /// dC/du = 2 * F
    pub fn compliance_gradient(force: &[f64]) -> Vec<f64> {
        force.iter().map(|f| 2.0 * f).collect()
    }

    /// Strain energy gradient
    /// W = 0.5 * u' * K * u
    /// dW/du = K * u
    pub fn strain_energy_gradient(stiffness: &[f64], displacement: &[f64], n: usize) -> Vec<f64> {
        let mut grad = vec![0.0; n];
        for i in 0..n {
            for j in 0..n {
                grad[i] += stiffness[i * n + j] * displacement[j];
            }
        }
        grad
    }
}

// ============================================================================
// SEMI-ANALYTICAL SENSITIVITY
// ============================================================================

/// Semi-analytical method for matrix derivatives
#[derive(Debug, Clone)]
pub struct SemiAnalytical {
    pub element_k_derivs: Vec<ElementKDerivative>,
}

#[derive(Debug, Clone)]
pub struct ElementKDerivative {
    pub element_id: usize,
    pub param_idx: usize,
    pub dk_dp: Vec<f64>,  // Element stiffness derivative
    pub dm_dp: Vec<f64>,  // Element mass derivative
}

impl SemiAnalytical {
    pub fn new() -> Self {
        SemiAnalytical {
            element_k_derivs: Vec::new(),
        }
    }

    /// Stiffness derivative for Young's modulus
    /// K = E * K_0  =>  dK/dE = K_0 = K/E
    pub fn dk_de(element_k: &[f64], youngs_modulus: f64) -> Vec<f64> {
        element_k.iter().map(|k| k / youngs_modulus).collect()
    }

    /// Stiffness derivative for thickness (shell/plate)
    /// K ~ t^3 for bending, t for membrane
    pub fn dk_dt_shell(element_k_bend: &[f64], element_k_memb: &[f64], thickness: f64) -> Vec<f64> {
        let n = (element_k_bend.len() as f64).sqrt() as usize;
        let mut dk = vec![0.0; n * n];

        for i in 0..n * n {
            dk[i] = 3.0 * element_k_bend[i] / thickness + element_k_memb[i] / thickness;
        }

        dk
    }

    /// Mass derivative for density
    /// M = ρ * M_0  =>  dM/dρ = M_0 = M/ρ
    pub fn dm_drho(element_m: &[f64], density: f64) -> Vec<f64> {
        element_m.iter().map(|m| m / density).collect()
    }

    /// Mass derivative for thickness
    /// M ~ t for shells
    pub fn dm_dt_shell(element_m: &[f64], thickness: f64) -> Vec<f64> {
        element_m.iter().map(|m| m / thickness).collect()
    }

    /// Assemble global derivative from element derivatives
    pub fn assemble_global_derivative(
        &self,
        param_idx: usize,
        connectivity: &[Vec<usize>],
        n_dof: usize,
    ) -> Vec<f64> {
        let mut dk_global = vec![0.0; n_dof * n_dof];

        for elem_deriv in &self.element_k_derivs {
            if elem_deriv.param_idx != param_idx {
                continue;
            }

            let elem_id = elem_deriv.element_id;
            if elem_id >= connectivity.len() {
                continue;
            }

            let dofs = &connectivity[elem_id];
            let n_elem = dofs.len();

            for (i, &gi) in dofs.iter().enumerate() {
                for (j, &gj) in dofs.iter().enumerate() {
                    if gi < n_dof && gj < n_dof {
                        dk_global[gi * n_dof + gj] += elem_deriv.dk_dp[i * n_elem + j];
                    }
                }
            }
        }

        dk_global
    }
}

impl Default for SemiAnalytical {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SHAPE SENSITIVITY
// ============================================================================

/// Shape sensitivity analysis
#[derive(Debug, Clone)]
pub struct ShapeSensitivity {
    pub velocity_field: Vec<Vec<f64>>,  // Design velocity at each node
    pub boundary_integrals: bool,
}

impl ShapeSensitivity {
    pub fn new() -> Self {
        ShapeSensitivity {
            velocity_field: Vec::new(),
            boundary_integrals: true,
        }
    }

    /// Set design velocity field
    pub fn set_velocity_field(&mut self, velocities: Vec<Vec<f64>>) {
        self.velocity_field = velocities;
    }

    /// Compute volume derivative
    /// dV/dp = ∫ V·n dΓ
    pub fn volume_sensitivity(&self, surface_normals: &[[f64; 3]], surface_areas: &[f64]) -> f64 {
        let mut dv_dp = 0.0;

        for (i, (normal, area)) in surface_normals.iter().zip(surface_areas.iter()).enumerate() {
            if i < self.velocity_field.len() {
                let v = &self.velocity_field[i];
                let v_dot_n = v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2];
                dv_dp += v_dot_n * area;
            }
        }

        dv_dp
    }

    /// Material derivative of stress
    /// Includes both spatial and velocity contributions
    pub fn stress_material_derivative(
        &self,
        _stress: &[f64],          // Stress tensor (6 components)
        stress_gradient: &[f64], // Spatial gradient of stress
        velocity: &[f64],        // Design velocity (3 components)
    ) -> Vec<f64> {
        // D(σ)/Dp = ∂σ/∂p + V · ∇σ
        let mut d_stress = vec![0.0; 6];

        for i in 0..6 {
            // Advection term: V · ∇σ_i
            for j in 0..3 {
                d_stress[i] += velocity[j] * stress_gradient[i * 3 + j];
            }
        }

        d_stress
    }

    /// Compliance shape sensitivity using boundary integral
    pub fn compliance_shape_sensitivity(
        &self,
        strain_energy_density: &[f64],
        traction: &[[f64; 3]],
        displacement: &[[f64; 3]],
        velocity: &[[f64; 3]],
        surface_areas: &[f64],
        surface_normals: &[[f64; 3]],
    ) -> f64 {
        let n_surf = surface_areas.len();
        let mut dc_dp = 0.0;

        for i in 0..n_surf {
            let v = &velocity[i];
            let n = &surface_normals[i];
            let t = &traction[i];
            let u = &displacement[i];
            let w = strain_energy_density[i];
            let a = surface_areas[i];

            // V·n term
            let v_dot_n = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];

            // t·u term
            let t_dot_u = t[0] * u[0] + t[1] * u[1] + t[2] * u[2];

            // Contribution: (W - t·u) * V·n * dA
            dc_dp += (w - t_dot_u) * v_dot_n * a;
        }

        dc_dp
    }
}

impl Default for ShapeSensitivity {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// EIGENVALUE SENSITIVITY
// ============================================================================

/// Sensitivity of eigenvalues and eigenvectors
#[derive(Debug, Clone)]
pub struct EigenvalueSensitivity {
    pub eigenvalues: Vec<f64>,
    pub eigenvectors: Vec<Vec<f64>>,
    pub mass_normalized: bool,
}

impl EigenvalueSensitivity {
    pub fn new(eigenvalues: Vec<f64>, eigenvectors: Vec<Vec<f64>>) -> Self {
        EigenvalueSensitivity {
            eigenvalues,
            eigenvectors,
            mass_normalized: true,
        }
    }

    /// Eigenvalue sensitivity
    /// dλ/dp = φ' * (dK/dp - λ * dM/dp) * φ
    pub fn eigenvalue_sensitivity(
        &self,
        mode_idx: usize,
        dk_dp: &[f64],
        dm_dp: &[f64],
    ) -> f64 {
        let phi = &self.eigenvectors[mode_idx];
        let lambda = self.eigenvalues[mode_idx];
        let n = phi.len();

        let mut d_lambda = 0.0;

        for i in 0..n {
            for j in 0..n {
                let dk = dk_dp[i * n + j];
                let dm = dm_dp[i * n + j];
                d_lambda += phi[i] * (dk - lambda * dm) * phi[j];
            }
        }

        d_lambda
    }

    /// Frequency sensitivity
    /// ω = √λ  =>  dω/dp = (1/2ω) * dλ/dp
    pub fn frequency_sensitivity(
        &self,
        mode_idx: usize,
        dk_dp: &[f64],
        dm_dp: &[f64],
    ) -> f64 {
        let lambda = self.eigenvalues[mode_idx];
        let omega = lambda.sqrt();

        if omega < 1e-14 {
            return 0.0;
        }

        let d_lambda = self.eigenvalue_sensitivity(mode_idx, dk_dp, dm_dp);
        d_lambda / (2.0 * omega)
    }

    /// Natural frequency sensitivity in Hz
    /// f = ω/(2π)  =>  df/dp = (1/2π) * dω/dp
    pub fn natural_frequency_sensitivity(
        &self,
        mode_idx: usize,
        dk_dp: &[f64],
        dm_dp: &[f64],
    ) -> f64 {
        let d_omega = self.frequency_sensitivity(mode_idx, dk_dp, dm_dp);
        d_omega / (2.0 * std::f64::consts::PI)
    }

    /// Eigenvector sensitivity (Nelson's method)
    pub fn eigenvector_sensitivity(
        &self,
        mode_idx: usize,
        _stiffness: &[f64],
        _mass: &[f64],
        dk_dp: &[f64],
        dm_dp: &[f64],
    ) -> Vec<f64> {
        let phi = &self.eigenvectors[mode_idx];
        let lambda = self.eigenvalues[mode_idx];
        let n = phi.len();

        // dφ/dp = Σ c_j * φ_j  (j ≠ i)
        // c_j = φ_j' * (dK/dp - λ * dM/dp) * φ_i / (λ_i - λ_j)

        let mut d_phi = vec![0.0; n];

        for j in 0..self.eigenvectors.len() {
            if j == mode_idx {
                continue;
            }

            let phi_j = &self.eigenvectors[j];
            let lambda_j = self.eigenvalues[j];

            let diff = lambda - lambda_j;
            if diff.abs() < 1e-10 {
                continue; // Skip for repeated eigenvalues
            }

            // Compute c_j
            let mut c_j = 0.0;
            for ii in 0..n {
                for jj in 0..n {
                    let dk = dk_dp[ii * n + jj];
                    let dm = dm_dp[ii * n + jj];
                    c_j += phi_j[ii] * (dk - lambda * dm) * phi[jj];
                }
            }
            c_j /= diff;

            // Add contribution
            for ii in 0..n {
                d_phi[ii] += c_j * phi_j[ii];
            }
        }

        d_phi
    }
}

// ============================================================================
// SENSITIVITY MANAGER
// ============================================================================

/// Central manager for sensitivity computations
#[derive(Debug)]
pub struct SensitivityManager {
    pub parameters: Vec<DesignParameter>,
    pub responses: Vec<ResponseFunction>,
    pub method: SensitivityMethod,
    pub computed_sensitivities: HashMap<(String, String), f64>,  // (response, param) -> value
}

#[derive(Debug, Clone)]
pub enum SensitivityMethod {
    FiniteDifference(FDMethod, f64),
    Direct,
    Adjoint,
    SemiAnalytical,
}

impl SensitivityManager {
    pub fn new(method: SensitivityMethod) -> Self {
        SensitivityManager {
            parameters: Vec::new(),
            responses: Vec::new(),
            method,
            computed_sensitivities: HashMap::new(),
        }
    }

    /// Add design parameter
    pub fn add_parameter(&mut self, param: DesignParameter) {
        self.parameters.push(param);
    }

    /// Add response function
    pub fn add_response(&mut self, response: ResponseFunction) {
        self.responses.push(response);
    }

    /// Get sensitivity value
    pub fn get_sensitivity(&self, response_name: &str, param_name: &str) -> Option<f64> {
        self.computed_sensitivities
            .get(&(response_name.to_string(), param_name.to_string()))
            .copied()
    }

    /// Store computed sensitivity
    pub fn store_sensitivity(&mut self, response_name: &str, param_name: &str, value: f64) {
        self.computed_sensitivities
            .insert((response_name.to_string(), param_name.to_string()), value);
    }

    /// Get gradient vector for a response
    pub fn get_gradient(&self, response_name: &str) -> Vec<f64> {
        self.parameters
            .iter()
            .map(|p| {
                self.get_sensitivity(response_name, &p.name).unwrap_or(0.0)
            })
            .collect()
    }

    /// Get Jacobian matrix (responses x parameters)
    pub fn get_jacobian(&self) -> Vec<Vec<f64>> {
        self.responses
            .iter()
            .map(|r| self.get_gradient(&r.name))
            .collect()
    }

    /// Normalized gradient (scaled by parameter bounds)
    pub fn get_normalized_gradient(&self, response_name: &str) -> Vec<f64> {
        self.parameters
            .iter()
            .map(|p| {
                let sens = self.get_sensitivity(response_name, &p.name).unwrap_or(0.0);
                sens * (p.upper_bound - p.lower_bound) / p.scaling
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_design_parameter() {
        let param = DesignParameter::new(
            "thickness",
            ParameterType::Sizing {
                property: SizingProperty::Thickness,
                element_ids: vec![0, 1, 2],
            },
            0.01,
        ).with_bounds(0.001, 0.05);

        assert_eq!(param.name, "thickness");
        assert!((param.value - 0.01).abs() < 1e-10);
    }

    #[test]
    fn test_normalized_value() {
        let param = DesignParameter::new(
            "E",
            ParameterType::Material {
                property: MaterialProperty::YoungModulus,
                element_ids: vec![],
            },
            150e9,
        ).with_bounds(100e9, 200e9);

        let norm = param.normalized_value();
        assert!((norm - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_finite_difference_forward() {
        let fd = FiniteDifferenceSensitivity::forward(1e-6);

        let f_plus = 1.001;
        let f_minus = 1.0;
        let sens = fd.compute_sensitivity(f_plus, f_minus, 1.0);

        assert!((sens - 1000.0).abs() < 1.0);
    }

    #[test]
    fn test_finite_difference_central() {
        let fd = FiniteDifferenceSensitivity::central(1e-6);

        let f_plus = 1.001;
        let f_minus = 0.999;
        let sens = fd.compute_sensitivity(f_plus, f_minus, 1.0);

        assert!((sens - 1000.0).abs() < 1.0);
    }

    #[test]
    fn test_linear_solver() {
        let mut solver = LinearSystemSolver::new(2);

        // K = [[4, 1], [1, 3]]
        let k = vec![4.0, 1.0, 1.0, 3.0];
        solver.factorize(&k);

        let b = vec![5.0, 4.0];
        let x = solver.solve(&b);

        // Solution should be [1, 1]
        assert!((x[0] - 1.0).abs() < 1e-10);
        assert!((x[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_adjoint_displacement_gradient() {
        let grad = AdjointMethod::displacement_gradient(5, 2);

        assert_eq!(grad.len(), 5);
        assert!((grad[2] - 1.0).abs() < 1e-10);
        assert!((grad[0]).abs() < 1e-10);
    }

    #[test]
    fn test_compliance_gradient() {
        let force = vec![100.0, 200.0];
        let grad = AdjointMethod::compliance_gradient(&force);

        assert!((grad[0] - 200.0).abs() < 1e-10);
        assert!((grad[1] - 400.0).abs() < 1e-10);
    }

    #[test]
    fn test_semi_analytical_dk_de() {
        let elem_k = vec![1000.0, 0.0, 0.0, 1000.0];
        let e = 200e9;

        let dk = SemiAnalytical::dk_de(&elem_k, e);

        assert!((dk[0] - 1000.0 / e).abs() < 1e-20);
    }

    #[test]
    fn test_eigenvalue_sensitivity() {
        let eig_sens = EigenvalueSensitivity::new(
            vec![100.0, 400.0],
            vec![vec![1.0, 0.0], vec![0.0, 1.0]],
        );

        // dK/dp = identity, dM/dp = 0
        let dk_dp = vec![1.0, 0.0, 0.0, 1.0];
        let dm_dp = vec![0.0, 0.0, 0.0, 0.0];

        let d_lambda = eig_sens.eigenvalue_sensitivity(0, &dk_dp, &dm_dp);

        // φ' * dK/dp * φ = 1.0 for first mode
        assert!((d_lambda - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_sensitivity_manager() {
        let mut manager = SensitivityManager::new(
            SensitivityMethod::FiniteDifference(FDMethod::Central, 1e-6)
        );

        manager.add_parameter(DesignParameter::new(
            "t1",
            ParameterType::Sizing {
                property: SizingProperty::Thickness,
                element_ids: vec![0],
            },
            0.01,
        ));

        manager.add_response(ResponseFunction::new(
            "compliance",
            ResponseType::Compliance,
        ));

        manager.store_sensitivity("compliance", "t1", -100.0);

        let sens = manager.get_sensitivity("compliance", "t1");
        assert!(sens.is_some());
        assert!((sens.unwrap() - (-100.0)).abs() < 1e-10);
    }

    #[test]
    fn test_gradient_vector() {
        let mut manager = SensitivityManager::new(SensitivityMethod::Direct);

        manager.add_parameter(DesignParameter::new(
            "t1",
            ParameterType::Sizing { property: SizingProperty::Thickness, element_ids: vec![] },
            0.01,
        ));
        manager.add_parameter(DesignParameter::new(
            "t2",
            ParameterType::Sizing { property: SizingProperty::Thickness, element_ids: vec![] },
            0.02,
        ));

        manager.store_sensitivity("stress", "t1", -50.0);
        manager.store_sensitivity("stress", "t2", -75.0);

        let grad = manager.get_gradient("stress");
        assert_eq!(grad.len(), 2);
        assert!((grad[0] - (-50.0)).abs() < 1e-10);
        assert!((grad[1] - (-75.0)).abs() < 1e-10);
    }

    #[test]
    fn test_shape_sensitivity_creation() {
        let shape_sens = ShapeSensitivity::new();
        assert!(shape_sens.boundary_integrals);
    }

    #[test]
    fn test_frequency_sensitivity() {
        let eig_sens = EigenvalueSensitivity::new(
            vec![100.0],
            vec![vec![1.0]],
        );

        let dk_dp = vec![2.0];
        let dm_dp = vec![0.0];

        let d_omega = eig_sens.frequency_sensitivity(0, &dk_dp, &dm_dp);
        // dω/dp = (1/2ω) * dλ/dp = (1/20) * 2 = 0.1
        assert!((d_omega - 0.1).abs() < 1e-10);
    }
}
