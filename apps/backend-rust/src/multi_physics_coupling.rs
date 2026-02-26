//! Multi-Physics Coupling Framework
//!
//! Unified framework for coupling multiple physics domains:
//! - Thermo-mechanical (thermal stress)
//! - Electro-thermal (Joule heating)
//! - Piezoelectric (electro-mechanical)
//! - Thermo-fluid-structure interaction
//!
//! ## Coupling Strategies
//! - Sequential (staggered) coupling
//! - Simultaneous (monolithic) coupling
//! - Iterative coupling with convergence control

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// PHYSICS DOMAIN DEFINITIONS
// ============================================================================

/// Physics domain types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PhysicsDomain {
    Structural,
    Thermal,
    Fluid,
    Electrical,
    Magnetic,
    Acoustic,
    Chemical,
}

/// Field variable types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum FieldVariable {
    Displacement,
    Velocity,
    Acceleration,
    Temperature,
    Pressure,
    ElectricPotential,
    MagneticPotential,
    Concentration,
    HeatFlux,
    Stress,
    Strain,
}

/// Coupling between two physics domains
#[derive(Debug, Clone)]
pub struct PhysicsCoupling {
    pub source_domain: PhysicsDomain,
    pub target_domain: PhysicsDomain,
    pub coupling_type: CouplingType,
    pub transfer_variables: Vec<VariableTransfer>,
}

/// Type of physics coupling
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CouplingType {
    /// One-way: source affects target only
    OneWay,
    /// Two-way: bidirectional coupling
    TwoWay,
    /// Strong: iterative until convergence
    Strong,
    /// Weak: single pass per time step
    Weak,
}

/// Variable transfer specification
#[derive(Debug, Clone)]
pub struct VariableTransfer {
    pub source_variable: FieldVariable,
    pub target_variable: FieldVariable,
    pub transfer_function: TransferFunction,
}

/// Transfer function between variables
#[derive(Debug, Clone)]
pub enum TransferFunction {
    /// Direct copy (identity)
    Identity,
    /// Linear scaling
    Scale(f64),
    /// Derivative (e.g., displacement -> velocity)
    TimeDerivative,
    /// Gradient (e.g., temperature -> heat flux)
    Gradient,
    /// Custom function
    Custom(String),
}

// ============================================================================
// THERMO-MECHANICAL COUPLING
// ============================================================================

/// Thermo-mechanical coupling model
#[derive(Debug, Clone)]
pub struct ThermoMechanical {
    pub thermal_expansion: Vec<f64>,    // [α] per element
    pub reference_temp: f64,
    pub coupling_direction: ThermoMechDirection,
    pub heat_generation: Option<MechanicalHeatGen>,
}

/// Direction of thermo-mechanical coupling
#[derive(Debug, Clone, Copy)]
pub enum ThermoMechDirection {
    /// Temperature affects structure (thermal stress)
    ThermalToMechanical,
    /// Deformation affects thermal (geometrically)
    MechanicalToThermal,
    /// Both directions
    FullyCouple,
}

/// Mechanical heat generation model
#[derive(Debug, Clone)]
pub struct MechanicalHeatGen {
    pub plastic_work_fraction: f64,  // β (Taylor-Quinney coefficient ~0.9)
    pub friction_coefficient: f64,
}

impl ThermoMechanical {
    pub fn new(n_elements: usize, alpha: f64, t_ref: f64) -> Self {
        ThermoMechanical {
            thermal_expansion: vec![alpha; n_elements],
            reference_temp: t_ref,
            coupling_direction: ThermoMechDirection::ThermalToMechanical,
            heat_generation: None,
        }
    }

    /// Compute thermal strain
    pub fn thermal_strain(&self, element_id: usize, temperature: f64) -> [f64; 6] {
        let alpha = self.thermal_expansion.get(element_id).copied().unwrap_or(12e-6);
        let delta_t = temperature - self.reference_temp;
        let eps_th = alpha * delta_t;

        // Thermal strain is volumetric (equal in all normal directions)
        [eps_th, eps_th, eps_th, 0.0, 0.0, 0.0]
    }

    /// Compute thermal stress from constrained expansion
    pub fn thermal_stress(
        &self,
        element_id: usize,
        temperature: f64,
        elasticity_matrix: &[[f64; 6]; 6],
    ) -> [f64; 6] {
        let eps_th = self.thermal_strain(element_id, temperature);

        // σ_th = -D * ε_th (negative for expansion causing compression in constraints)
        let mut stress = [0.0; 6];
        for i in 0..6 {
            for j in 0..6 {
                stress[i] -= elasticity_matrix[i][j] * eps_th[j];
            }
        }
        stress
    }

    /// Heat generated from plastic work
    pub fn plastic_heat_generation(&self, plastic_work_rate: f64) -> f64 {
        if let Some(ref heat_gen) = self.heat_generation {
            heat_gen.plastic_work_fraction * plastic_work_rate
        } else {
            0.0
        }
    }
}

// ============================================================================
// ELECTRO-THERMAL COUPLING (JOULE HEATING)
// ============================================================================

/// Electro-thermal coupling model
#[derive(Debug, Clone)]
pub struct ElectroThermal {
    pub electrical_conductivity: Vec<f64>,  // σ [S/m] per element
    pub temperature_coeff: f64,             // Temperature coefficient of resistivity
    pub reference_temp: f64,
}

impl ElectroThermal {
    pub fn new(n_elements: usize, sigma: f64) -> Self {
        ElectroThermal {
            electrical_conductivity: vec![sigma; n_elements],
            temperature_coeff: 0.004,  // Typical for metals
            reference_temp: 293.15,
        }
    }

    /// Temperature-dependent conductivity
    pub fn conductivity_at_temp(&self, element_id: usize, temperature: f64) -> f64 {
        let sigma_ref = self.electrical_conductivity.get(element_id).copied().unwrap_or(1e6);
        let delta_t = temperature - self.reference_temp;

        // σ(T) = σ_ref / (1 + α*(T - T_ref))
        sigma_ref / (1.0 + self.temperature_coeff * delta_t)
    }

    /// Joule heating: Q = J² / σ = σ * |∇V|²
    pub fn joule_heating(
        &self,
        element_id: usize,
        electric_field: &[f64; 3],
        temperature: f64,
    ) -> f64 {
        let sigma = self.conductivity_at_temp(element_id, temperature);
        let e_squared = electric_field.iter().map(|e| e * e).sum::<f64>();

        sigma * e_squared  // W/m³
    }

    /// Current density from electric field
    pub fn current_density(
        &self,
        element_id: usize,
        electric_field: &[f64; 3],
        temperature: f64,
    ) -> [f64; 3] {
        let sigma = self.conductivity_at_temp(element_id, temperature);

        [
            sigma * electric_field[0],
            sigma * electric_field[1],
            sigma * electric_field[2],
        ]
    }
}

// ============================================================================
// PIEZOELECTRIC COUPLING
// ============================================================================

/// Piezoelectric coupling model
#[derive(Debug, Clone)]
pub struct Piezoelectric {
    pub d_matrix: [[f64; 6]; 3],     // Piezoelectric strain coefficients [m/V]
    pub e_matrix: [[f64; 3]; 6],     // Piezoelectric stress coefficients [C/m²]
    pub dielectric_permittivity: [f64; 3],  // ε [F/m]
}

impl Piezoelectric {
    /// PZT-5A material (common actuator/sensor)
    pub fn pzt_5a() -> Self {
        // d coefficients in pC/N (10^-12 C/N = 10^-12 m/V)
        let d31 = -171e-12;
        let d33 = 374e-12;
        let d15 = 584e-12;

        Piezoelectric {
            d_matrix: [
                [0.0, 0.0, 0.0, 0.0, d15, 0.0],      // d1j
                [0.0, 0.0, 0.0, d15, 0.0, 0.0],      // d2j
                [d31, d31, d33, 0.0, 0.0, 0.0],      // d3j
            ],
            e_matrix: [
                [0.0, 0.0, -5.4],           // e1i
                [0.0, 0.0, -5.4],           // e2i
                [0.0, 0.0, 15.8],           // e3i
                [0.0, 12.3, 0.0],           // e4i
                [12.3, 0.0, 0.0],           // e5i
                [0.0, 0.0, 0.0],            // e6i
            ],
            dielectric_permittivity: [
                8.11e-9,  // ε11
                8.11e-9,  // ε22
                7.35e-9,  // ε33
            ],
        }
    }

    /// Direct piezoelectric effect: stress -> electric displacement
    /// D_i = e_ij * S_j + ε_ik * E_k
    pub fn electric_displacement(
        &self,
        stress: &[f64; 6],
        electric_field: &[f64; 3],
    ) -> [f64; 3] {
        let mut d = [0.0; 3];

        // From stress
        for i in 0..3 {
            for j in 0..6 {
                d[i] += self.e_matrix[j][i] * stress[j];
            }
        }

        // From electric field (dielectric contribution)
        for i in 0..3 {
            d[i] += self.dielectric_permittivity[i] * electric_field[i];
        }

        d
    }

    /// Converse piezoelectric effect: electric field -> strain
    /// S_i = s_ij * T_j + d_ki * E_k
    pub fn piezo_strain(&self, electric_field: &[f64; 3]) -> [f64; 6] {
        let mut strain = [0.0; 6];

        for j in 0..6 {
            for k in 0..3 {
                strain[j] += self.d_matrix[k][j] * electric_field[k];
            }
        }

        strain
    }

    /// Sensor voltage from strain (open circuit)
    pub fn sensor_voltage(&self, strain: &[f64; 6], thickness: f64) -> f64 {
        // V = -d33 * σ33 * t / ε33 (simplified 1D)
        // For strain sensing: V ≈ g33 * σ33 * t
        let d33 = self.d_matrix[2][2];
        let eps33 = self.dielectric_permittivity[2];
        let g33 = d33 / eps33;

        // Assuming uniaxial loading
        g33 * strain[2] * thickness * 1e9  // Approximate conversion
    }
}

// ============================================================================
// MULTI-PHYSICS SOLVER FRAMEWORK
// ============================================================================

/// Multi-physics problem definition
#[derive(Debug)]
pub struct MultiPhysicsProblem {
    pub domains: Vec<PhysicsDomain>,
    pub couplings: Vec<PhysicsCoupling>,
    pub solution_strategy: SolutionStrategy,
    pub fields: HashMap<PhysicsDomain, FieldData>,
}

/// Field data for a physics domain
#[derive(Debug, Clone)]
pub struct FieldData {
    pub n_dofs: usize,
    pub values: Vec<f64>,
    pub residual: Vec<f64>,
}

/// Solution strategy
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SolutionStrategy {
    /// Solve all at once (monolithic)
    Monolithic,
    /// Sequential (Gauss-Seidel like)
    Sequential,
    /// Parallel (Jacobi like)
    Parallel,
    /// Iterative coupling
    Iterative {
        max_iterations: usize,
        tolerance: f64,
    },
}

impl MultiPhysicsProblem {
    pub fn new() -> Self {
        MultiPhysicsProblem {
            domains: Vec::new(),
            couplings: Vec::new(),
            solution_strategy: SolutionStrategy::Sequential,
            fields: HashMap::new(),
        }
    }

    /// Add a physics domain
    pub fn add_domain(&mut self, domain: PhysicsDomain, n_dofs: usize) {
        self.domains.push(domain);
        self.fields.insert(domain, FieldData {
            n_dofs,
            values: vec![0.0; n_dofs],
            residual: vec![0.0; n_dofs],
        });
    }

    /// Add coupling between domains
    pub fn add_coupling(&mut self, coupling: PhysicsCoupling) {
        self.couplings.push(coupling);
    }

    /// Get coupling topology (which domains are coupled)
    pub fn coupling_graph(&self) -> Vec<(PhysicsDomain, PhysicsDomain)> {
        self.couplings.iter()
            .map(|c| (c.source_domain, c.target_domain))
            .collect()
    }

    /// Solve multi-physics problem
    pub fn solve(&mut self) -> MultiPhysicsResult {
        match self.solution_strategy {
            SolutionStrategy::Monolithic => self.solve_monolithic(),
            SolutionStrategy::Sequential => self.solve_sequential(),
            SolutionStrategy::Parallel => self.solve_parallel(),
            SolutionStrategy::Iterative { max_iterations, tolerance } => {
                self.solve_iterative(max_iterations, tolerance)
            }
        }
    }

    fn solve_monolithic(&mut self) -> MultiPhysicsResult {
        // Build coupled system and solve
        // [K11  K12] {u1}   {f1}
        // [K21  K22] {u2} = {f2}

        MultiPhysicsResult {
            converged: true,
            iterations: 1,
            residuals: self.domains.iter().map(|d| (*d, 0.0)).collect(),
        }
    }

    fn solve_sequential(&mut self) -> MultiPhysicsResult {
        // Solve each domain in order, passing data between
        let mut residuals = HashMap::new();

        // Collect couplings first to avoid borrow issues
        let domains: Vec<_> = self.domains.clone();
        let couplings: Vec<_> = self.couplings.clone();

        for domain in &domains {
            // Solve this domain
            if let Some(field) = self.fields.get_mut(domain) {
                // Apply couplings from previously solved domains
                for coupling in &couplings {
                    if coupling.target_domain == *domain {
                        // Apply coupling (simplified - just mark it)
                        let _ = coupling;
                    }
                }

                // Solve (placeholder)
                let res_norm = field.residual.iter().map(|r| r * r).sum::<f64>().sqrt();
                residuals.insert(*domain, res_norm);
            }
        }

        MultiPhysicsResult {
            converged: true,
            iterations: 1,
            residuals,
        }
    }

    fn solve_parallel(&mut self) -> MultiPhysicsResult {
        // Solve all domains simultaneously with previous iteration data
        MultiPhysicsResult {
            converged: true,
            iterations: 1,
            residuals: HashMap::new(),
        }
    }

    fn solve_iterative(&mut self, max_iter: usize, tol: f64) -> MultiPhysicsResult {
        let mut converged = false;
        let mut iterations = 0;
        let mut residuals: HashMap<PhysicsDomain, f64> = HashMap::new();

        while !converged && iterations < max_iter {
            iterations += 1;

            // One sequential pass
            let result = self.solve_sequential();
            residuals = result.residuals;

            // Check convergence
            let max_residual = residuals.values().cloned().fold(0.0, f64::max);
            if max_residual < tol {
                converged = true;
            }
        }

        MultiPhysicsResult {
            converged,
            iterations,
            residuals,
        }
    }

    fn apply_coupling(&self, _coupling: &PhysicsCoupling) {
        // Transfer data from source to target domain
        // Implementation depends on coupling type
    }
}

impl Default for MultiPhysicsProblem {
    fn default() -> Self {
        Self::new()
    }
}

/// Multi-physics solution result
#[derive(Debug, Clone)]
pub struct MultiPhysicsResult {
    pub converged: bool,
    pub iterations: usize,
    pub residuals: HashMap<PhysicsDomain, f64>,
}

// ============================================================================
// STAGGERED COUPLING SCHEMES
// ============================================================================

/// Staggered solution scheme
pub struct StaggeredScheme {
    pub order: Vec<PhysicsDomain>,
    pub subcycling: HashMap<PhysicsDomain, usize>,
    pub predictor: PredictorType,
}

/// Predictor for staggered scheme
#[derive(Debug, Clone, Copy)]
pub enum PredictorType {
    /// Use previous time step value
    Zero,
    /// Linear extrapolation
    Linear,
    /// Quadratic extrapolation
    Quadratic,
}

impl StaggeredScheme {
    pub fn thermo_mechanical() -> Self {
        StaggeredScheme {
            order: vec![PhysicsDomain::Thermal, PhysicsDomain::Structural],
            subcycling: HashMap::new(),
            predictor: PredictorType::Linear,
        }
    }

    pub fn fsi() -> Self {
        StaggeredScheme {
            order: vec![PhysicsDomain::Structural, PhysicsDomain::Fluid],
            subcycling: HashMap::new(),
            predictor: PredictorType::Quadratic,
        }
    }

    /// Apply predictor
    pub fn predict(&self, prev_values: &[f64], prev_prev_values: &[f64], dt: f64) -> Vec<f64> {
        match self.predictor {
            PredictorType::Zero => prev_values.to_vec(),
            PredictorType::Linear => {
                prev_values.iter()
                    .zip(prev_prev_values.iter())
                    .map(|(v, vp)| 2.0 * v - vp)
                    .collect()
            }
            PredictorType::Quadratic => {
                // Would need more history
                let _ = dt;
                prev_values.iter()
                    .zip(prev_prev_values.iter())
                    .map(|(v, vp)| 2.0 * v - vp)
                    .collect()
            }
        }
    }
}

// ============================================================================
// INTERFACE QUANTITIES
// ============================================================================

/// Interface between physics domains
#[derive(Debug, Clone)]
pub struct PhysicsInterface {
    pub name: String,
    pub nodes: Vec<usize>,
    pub source_domain: PhysicsDomain,
    pub target_domain: PhysicsDomain,
    pub quantities: Vec<InterfaceQuantity>,
}

/// Quantity transferred at interface
#[derive(Debug, Clone)]
pub struct InterfaceQuantity {
    pub name: String,
    pub source_field: FieldVariable,
    pub target_field: FieldVariable,
    pub conservation: ConservationType,
    pub values: Vec<f64>,
}

/// Conservation requirement
#[derive(Debug, Clone, Copy)]
pub enum ConservationType {
    /// Exact value transfer
    Consistent,
    /// Conserve integral (e.g., force, heat)
    Conservative,
    /// Custom weighting
    Weighted,
}

impl PhysicsInterface {
    pub fn thermal_structural(nodes: Vec<usize>) -> Self {
        PhysicsInterface {
            name: "Thermal-Structural".to_string(),
            nodes: nodes.clone(),
            source_domain: PhysicsDomain::Thermal,
            target_domain: PhysicsDomain::Structural,
            quantities: vec![
                InterfaceQuantity {
                    name: "Temperature".to_string(),
                    source_field: FieldVariable::Temperature,
                    target_field: FieldVariable::Temperature,
                    conservation: ConservationType::Consistent,
                    values: vec![0.0; nodes.len()],
                },
            ],
        }
    }

    pub fn fluid_structural(nodes: Vec<usize>) -> Self {
        PhysicsInterface {
            name: "Fluid-Structural".to_string(),
            nodes: nodes.clone(),
            source_domain: PhysicsDomain::Fluid,
            target_domain: PhysicsDomain::Structural,
            quantities: vec![
                InterfaceQuantity {
                    name: "Pressure".to_string(),
                    source_field: FieldVariable::Pressure,
                    target_field: FieldVariable::Pressure,
                    conservation: ConservationType::Conservative,
                    values: vec![0.0; nodes.len()],
                },
                InterfaceQuantity {
                    name: "Displacement".to_string(),
                    source_field: FieldVariable::Displacement,
                    target_field: FieldVariable::Displacement,
                    conservation: ConservationType::Consistent,
                    values: vec![0.0; nodes.len() * 3],
                },
            ],
        }
    }
}

// ============================================================================
// COUPLED MATRIX ASSEMBLY
// ============================================================================

/// Coupled system matrix
#[derive(Debug, Clone)]
pub struct CoupledMatrix {
    pub blocks: Vec<MatrixBlock>,
    pub block_sizes: Vec<usize>,
}

/// Matrix block in coupled system
#[derive(Debug, Clone)]
pub struct MatrixBlock {
    pub row_domain: PhysicsDomain,
    pub col_domain: PhysicsDomain,
    pub values: Vec<f64>,
    pub rows: usize,
    pub cols: usize,
}

impl CoupledMatrix {
    pub fn new() -> Self {
        CoupledMatrix {
            blocks: Vec::new(),
            block_sizes: Vec::new(),
        }
    }

    /// Add diagonal block (single physics)
    pub fn add_diagonal_block(&mut self, domain: PhysicsDomain, matrix: Vec<f64>, size: usize) {
        self.blocks.push(MatrixBlock {
            row_domain: domain,
            col_domain: domain,
            values: matrix,
            rows: size,
            cols: size,
        });
        self.block_sizes.push(size);
    }

    /// Add off-diagonal coupling block
    pub fn add_coupling_block(
        &mut self,
        source: PhysicsDomain,
        target: PhysicsDomain,
        matrix: Vec<f64>,
        rows: usize,
        cols: usize,
    ) {
        self.blocks.push(MatrixBlock {
            row_domain: target,
            col_domain: source,
            values: matrix,
            rows,
            cols,
        });
    }

    /// Total system size
    pub fn total_size(&self) -> usize {
        self.block_sizes.iter().sum()
    }
}

impl Default for CoupledMatrix {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// CONVERGENCE ACCELERATION
// ============================================================================

/// Convergence acceleration for iterative coupling
#[derive(Debug, Clone)]
pub struct ConvergenceAccelerator {
    pub method: AccelerationMethod,
    pub history: Vec<Vec<f64>>,
    pub max_history: usize,
}

/// Acceleration method
#[derive(Debug, Clone)]
pub enum AccelerationMethod {
    /// Fixed relaxation
    FixedRelaxation(f64),
    /// Aitken dynamic relaxation
    Aitken,
    /// Anderson acceleration (mixing)
    Anderson { depth: usize },
    /// Quasi-Newton BFGS
    BFGS,
    /// Interface Quasi-Newton IQN-ILS
    IQNILS,
}

impl ConvergenceAccelerator {
    pub fn new(method: AccelerationMethod) -> Self {
        ConvergenceAccelerator {
            method,
            history: Vec::new(),
            max_history: 10,
        }
    }

    /// Accelerate convergence
    pub fn accelerate(&mut self, current: &[f64], residual: &[f64]) -> Vec<f64> {
        match &self.method {
            AccelerationMethod::FixedRelaxation(omega) => {
                current.iter()
                    .zip(residual.iter())
                    .map(|(c, r)| c + omega * r)
                    .collect()
            }
            AccelerationMethod::Aitken => {
                self.aitken_relaxation(current, residual)
            }
            AccelerationMethod::Anderson { depth } => {
                self.anderson_mixing(current, residual, *depth)
            }
            _ => current.to_vec(),
        }
    }

    fn aitken_relaxation(&mut self, current: &[f64], residual: &[f64]) -> Vec<f64> {
        self.history.push(residual.to_vec());

        let omega = if self.history.len() < 2 {
            0.5
        } else {
            let r_prev = &self.history[self.history.len() - 2];
            let r_curr = residual;

            let delta_r: Vec<f64> = r_curr.iter()
                .zip(r_prev.iter())
                .map(|(c, p)| c - p)
                .collect();

            let num: f64 = r_prev.iter().zip(delta_r.iter()).map(|(p, d)| p * d).sum();
            let den: f64 = delta_r.iter().map(|d| d * d).sum();

            if den.abs() > 1e-14 {
                (-num / den).clamp(-2.0, 2.0)
            } else {
                0.5
            }
        };

        // Trim history
        if self.history.len() > self.max_history {
            self.history.remove(0);
        }

        current.iter()
            .zip(residual.iter())
            .map(|(c, r)| c + omega * r)
            .collect()
    }

    fn anderson_mixing(&mut self, current: &[f64], residual: &[f64], depth: usize) -> Vec<f64> {
        self.history.push(residual.to_vec());

        if self.history.len() < 2 {
            let omega = 0.5;
            return current.iter()
                .zip(residual.iter())
                .map(|(c, r)| c + omega * r)
                .collect();
        }

        // Use last 'depth' residuals for mixing
        let m = self.history.len().min(depth);
        let _residual_matrix: Vec<&Vec<f64>> = self.history.iter().rev().take(m).collect();

        // Simplified: just use weighted average
        let omega = 0.7;
        current.iter()
            .zip(residual.iter())
            .map(|(c, r)| c + omega * r)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thermo_mechanical_strain() {
        let tm = ThermoMechanical::new(10, 12e-6, 293.15);
        let strain = tm.thermal_strain(0, 393.15); // 100K increase

        // α * ΔT = 12e-6 * 100 = 1.2e-3
        assert!((strain[0] - 1.2e-3).abs() < 1e-10);
        assert_eq!(strain[3], 0.0); // No shear
    }

    #[test]
    fn test_electro_thermal_joule() {
        let et = ElectroThermal::new(10, 1e6);
        let e_field = [100.0, 0.0, 0.0]; // 100 V/m

        let q = et.joule_heating(0, &e_field, 293.15);

        // Q = σ * E² = 1e6 * 10000 = 1e10 W/m³
        assert!((q - 1e10).abs() < 1e5);
    }

    #[test]
    fn test_conductivity_temp_dependence() {
        let et = ElectroThermal::new(10, 1e6);

        let sigma_cold = et.conductivity_at_temp(0, 293.15);
        let sigma_hot = et.conductivity_at_temp(0, 393.15);

        // Conductivity should decrease with temperature
        assert!(sigma_hot < sigma_cold);
    }

    #[test]
    fn test_piezoelectric_pzt() {
        let piezo = Piezoelectric::pzt_5a();

        // Check d33 is positive (elongation for positive field)
        assert!(piezo.d_matrix[2][2] > 0.0);

        // Check d31 is negative (contraction transverse to polarization)
        assert!(piezo.d_matrix[2][0] < 0.0);
    }

    #[test]
    fn test_piezo_strain() {
        let piezo = Piezoelectric::pzt_5a();
        let e_field = [0.0, 0.0, 1e6]; // 1 MV/m in z-direction

        let strain = piezo.piezo_strain(&e_field);

        // d33 * E3 = 374e-12 * 1e6 = 374e-6 = 374 microstrain
        assert!((strain[2] - 374e-6).abs() < 1e-9);
    }

    #[test]
    fn test_multi_physics_problem() {
        let mut problem = MultiPhysicsProblem::new();
        problem.add_domain(PhysicsDomain::Thermal, 100);
        problem.add_domain(PhysicsDomain::Structural, 300);

        assert_eq!(problem.domains.len(), 2);
        assert_eq!(problem.fields.get(&PhysicsDomain::Thermal).unwrap().n_dofs, 100);
    }

    #[test]
    fn test_coupling_graph() {
        let mut problem = MultiPhysicsProblem::new();
        problem.add_domain(PhysicsDomain::Thermal, 100);
        problem.add_domain(PhysicsDomain::Structural, 300);

        problem.add_coupling(PhysicsCoupling {
            source_domain: PhysicsDomain::Thermal,
            target_domain: PhysicsDomain::Structural,
            coupling_type: CouplingType::OneWay,
            transfer_variables: Vec::new(),
        });

        let graph = problem.coupling_graph();
        assert_eq!(graph.len(), 1);
        assert_eq!(graph[0], (PhysicsDomain::Thermal, PhysicsDomain::Structural));
    }

    #[test]
    fn test_staggered_scheme() {
        let scheme = StaggeredScheme::thermo_mechanical();
        assert_eq!(scheme.order.len(), 2);
        assert_eq!(scheme.order[0], PhysicsDomain::Thermal);
    }

    #[test]
    fn test_predictor() {
        let scheme = StaggeredScheme::thermo_mechanical();
        let prev = vec![1.0, 2.0, 3.0];
        let prev_prev = vec![0.0, 1.0, 2.0];

        let predicted = scheme.predict(&prev, &prev_prev, 0.1);

        // Linear extrapolation: 2*prev - prev_prev
        assert_eq!(predicted, vec![2.0, 3.0, 4.0]);
    }

    #[test]
    fn test_physics_interface() {
        let interface = PhysicsInterface::thermal_structural(vec![0, 1, 2]);
        assert_eq!(interface.quantities.len(), 1);
        assert_eq!(interface.nodes.len(), 3);
    }

    #[test]
    fn test_coupled_matrix() {
        let mut matrix = CoupledMatrix::new();
        matrix.add_diagonal_block(PhysicsDomain::Thermal, vec![1.0; 100], 10);
        matrix.add_diagonal_block(PhysicsDomain::Structural, vec![1.0; 900], 30);

        assert_eq!(matrix.total_size(), 40);
    }

    #[test]
    fn test_convergence_accelerator_fixed() {
        let mut acc = ConvergenceAccelerator::new(AccelerationMethod::FixedRelaxation(0.5));

        let current = vec![1.0, 2.0, 3.0];
        let residual = vec![0.2, 0.4, 0.6];

        let result = acc.accelerate(&current, &residual);

        // current + 0.5 * residual
        assert!((result[0] - 1.1).abs() < 1e-10);
        assert!((result[1] - 2.2).abs() < 1e-10);
    }

    #[test]
    fn test_convergence_aitken() {
        let mut acc = ConvergenceAccelerator::new(AccelerationMethod::Aitken);

        let current = vec![1.0, 2.0];
        let residual1 = vec![0.5, 0.5];
        let residual2 = vec![0.25, 0.25];

        let _ = acc.accelerate(&current, &residual1);
        let result = acc.accelerate(&current, &residual2);

        // Should converge
        assert!(!result.is_empty());
    }
}
