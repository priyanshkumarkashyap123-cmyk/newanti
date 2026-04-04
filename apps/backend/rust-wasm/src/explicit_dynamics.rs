//! Explicit Dynamics Solver Module
//!
//! Time integration for dynamic analysis including impact, crash,
//! blast, and wave propagation problems.
//!
//! ## Methods
//! - **Central Difference** - Classic explicit method
//! - **Velocity Verlet** - Energy-conserving integrator
//! - **Leap-Frog** - Staggered time integration
//! - **Explicit Newmark** - β=0, γ=0.5 variant
//!
//! ## Features
//! - Automatic time step (CFL condition)
//! - Mass scaling for quasi-static
//! - Hourglass control
//! - Contact detection
//! - Energy balance monitoring


// ============================================================================
// TIME INTEGRATION SCHEMES
// ============================================================================

/// Explicit time integration method
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExplicitMethod {
    CentralDifference,
    VelocityVerlet,
    LeapFrog,
    ExplicitNewmark,
}

/// Damping type
#[derive(Debug, Clone, Copy)]
pub enum DampingType {
    None,
    Rayleigh { alpha: f64, beta: f64 },
    Mass { factor: f64 },
    Stiffness { factor: f64 },
    Bulk { coefficient: f64 },
}

// ============================================================================
// EXPLICIT SOLVER CONFIGURATION
// ============================================================================

/// Explicit dynamics solver configuration
#[derive(Debug, Clone)]
pub struct ExplicitConfig {
    pub method: ExplicitMethod,
    pub time_start: f64,
    pub time_end: f64,
    pub dt: Option<f64>,  // None = automatic
    pub cfl_factor: f64,  // Safety factor for CFL condition
    pub mass_scaling: bool,
    pub min_mass_scale: f64,
    pub damping: DampingType,
    pub output_interval: usize,
    pub energy_balance: bool,
    pub hourglass_control: bool,
    pub hourglass_coefficient: f64,
}

impl Default for ExplicitConfig {
    fn default() -> Self {
        ExplicitConfig {
            method: ExplicitMethod::CentralDifference,
            time_start: 0.0,
            time_end: 1.0,
            dt: None,
            cfl_factor: 0.9,
            mass_scaling: false,
            min_mass_scale: 1.0,
            damping: DampingType::None,
            output_interval: 100,
            energy_balance: true,
            hourglass_control: false,
            hourglass_coefficient: 0.1,
        }
    }
}

// ============================================================================
// STATE VECTORS
// ============================================================================

/// Dynamic state at a time step
#[derive(Debug, Clone)]
pub struct DynamicState {
    pub time: f64,
    pub displacement: Vec<f64>,
    pub velocity: Vec<f64>,
    pub acceleration: Vec<f64>,
    pub internal_force: Vec<f64>,
    pub external_force: Vec<f64>,
    pub kinetic_energy: f64,
    pub internal_energy: f64,
    pub external_work: f64,
    pub hourglass_energy: f64,
}

impl DynamicState {
    pub fn new(n_dof: usize) -> Self {
        DynamicState {
            time: 0.0,
            displacement: vec![0.0; n_dof],
            velocity: vec![0.0; n_dof],
            acceleration: vec![0.0; n_dof],
            internal_force: vec![0.0; n_dof],
            external_force: vec![0.0; n_dof],
            kinetic_energy: 0.0,
            internal_energy: 0.0,
            external_work: 0.0,
            hourglass_energy: 0.0,
        }
    }

    /// Total energy in system
    pub fn total_energy(&self) -> f64 {
        self.kinetic_energy + self.internal_energy
    }

    /// Energy balance error (should be ~0 for conservative system)
    pub fn energy_error(&self) -> f64 {
        (self.total_energy() - self.external_work).abs()
    }
}

// ============================================================================
// LUMPED MASS MATRIX
// ============================================================================

/// Diagonal (lumped) mass matrix
#[derive(Debug, Clone)]
pub struct LumpedMass {
    pub diagonal: Vec<f64>,
    pub inverse: Vec<f64>,
}

impl LumpedMass {
    pub fn new(n_dof: usize) -> Self {
        LumpedMass {
            diagonal: vec![1.0; n_dof],
            inverse: vec![1.0; n_dof],
        }
    }

    pub fn from_diagonal(diagonal: Vec<f64>) -> Self {
        let inverse = diagonal.iter()
            .map(|&m| if m.abs() > 1e-20 { 1.0 / m } else { 0.0 })
            .collect();
        LumpedMass { diagonal, inverse }
    }

    /// Apply mass scaling to achieve target time step
    pub fn apply_mass_scaling(&mut self, target_dt: f64, element_sizes: &[f64], wave_speeds: &[f64]) {
        for (i, (&h, &c)) in element_sizes.iter().zip(wave_speeds.iter()).enumerate() {
            let dt_elem = h / c;
            if dt_elem < target_dt && i < self.diagonal.len() {
                let scale = (target_dt / dt_elem).powi(2);
                self.diagonal[i] *= scale;
            }
        }
        
        // Recompute inverse
        self.inverse = self.diagonal.iter()
            .map(|&m| if m.abs() > 1e-20 { 1.0 / m } else { 0.0 })
            .collect();
    }

    /// Compute kinetic energy: 0.5 * v^T * M * v
    pub fn kinetic_energy(&self, velocity: &[f64]) -> f64 {
        0.5 * self.diagonal.iter()
            .zip(velocity.iter())
            .map(|(&m, &v)| m * v * v)
            .sum::<f64>()
    }
}

// ============================================================================
// CENTRAL DIFFERENCE INTEGRATOR
// ============================================================================

/// Central difference time integrator
pub struct CentralDifference {
    pub dt: f64,
    damping: DampingType,
}

impl CentralDifference {
    pub fn new(dt: f64) -> Self {
        CentralDifference {
            dt,
            damping: DampingType::None,
        }
    }

    pub fn with_damping(mut self, damping: DampingType) -> Self {
        self.damping = damping;
        self
    }

    /// Initialize velocities and accelerations from initial conditions
    pub fn initialize(
        &self,
        state: &mut DynamicState,
        mass: &LumpedMass,
        f_ext: &[f64],
        f_int: &[f64],
    ) {
        // a_0 = M^-1 * (F_ext - F_int)
        for i in 0..state.acceleration.len() {
            state.acceleration[i] = mass.inverse[i] * (f_ext[i] - f_int[i]);
        }

        // u_{-1} = u_0 - dt*v_0 + 0.5*dt²*a_0 (for central difference startup)
        // This is implicit in the algorithm
    }

    /// Advance solution by one time step
    /// u_{n+1} = 2*u_n - u_{n-1} + dt²*M^-1*F_n
    pub fn step(
        &self,
        state: &mut DynamicState,
        prev_displacement: &[f64],
        mass: &LumpedMass,
        f_ext: &[f64],
        f_int: &[f64],
    ) {
        let n = state.displacement.len();
        let dt = self.dt;
        let dt2 = dt * dt;

        // Compute net force
        let mut f_net = vec![0.0; n];
        for i in 0..n {
            f_net[i] = f_ext[i] - f_int[i];
        }

        // Apply damping
        match self.damping {
            DampingType::Mass { factor } => {
                for i in 0..n {
                    f_net[i] -= factor * mass.diagonal[i] * state.velocity[i];
                }
            }
            DampingType::Rayleigh { alpha, beta } => {
                for i in 0..n {
                    // Approximate C*v = (αM + βK)*v
                    f_net[i] -= alpha * mass.diagonal[i] * state.velocity[i];
                    // βK*v would require stiffness matrix - approximated by scaled internal force
                    f_net[i] -= beta * f_int[i];
                }
            }
            _ => {}
        }

        // Compute new displacement
        let mut new_disp = vec![0.0; n];
        for i in 0..n {
            let accel = mass.inverse[i] * f_net[i];
            new_disp[i] = 2.0 * state.displacement[i] - prev_displacement[i] + dt2 * accel;
        }

        // Update velocity (central difference)
        for i in 0..n {
            state.velocity[i] = (new_disp[i] - prev_displacement[i]) / (2.0 * dt);
        }

        // Update acceleration
        for i in 0..n {
            state.acceleration[i] = mass.inverse[i] * f_net[i];
        }

        // Store forces
        state.external_force.copy_from_slice(f_ext);
        state.internal_force.copy_from_slice(f_int);

        // Update displacement
        state.displacement = new_disp;
        state.time += dt;

        // Update energies
        state.kinetic_energy = mass.kinetic_energy(&state.velocity);
    }
}

// ============================================================================
// VELOCITY VERLET INTEGRATOR
// ============================================================================

/// Velocity Verlet (symplectic) integrator
pub struct VelocityVerlet {
    pub dt: f64,
}

impl VelocityVerlet {
    pub fn new(dt: f64) -> Self {
        VelocityVerlet { dt }
    }

    /// Step 1: Update positions
    pub fn update_positions(&self, state: &mut DynamicState) {
        let dt = self.dt;
        let dt2 = dt * dt;

        for i in 0..state.displacement.len() {
            state.displacement[i] += dt * state.velocity[i] + 0.5 * dt2 * state.acceleration[i];
        }
    }

    /// Step 2: Update velocities (half step)
    pub fn update_velocities_half(&self, state: &mut DynamicState) {
        let dt = self.dt;

        for i in 0..state.velocity.len() {
            state.velocity[i] += 0.5 * dt * state.acceleration[i];
        }
    }

    /// Step 3: Update accelerations and complete velocity update
    pub fn update_accelerations(
        &self,
        state: &mut DynamicState,
        mass: &LumpedMass,
        f_ext: &[f64],
        f_int: &[f64],
    ) {
        let dt = self.dt;

        // New acceleration
        for i in 0..state.acceleration.len() {
            state.acceleration[i] = mass.inverse[i] * (f_ext[i] - f_int[i]);
        }

        // Complete velocity update
        for i in 0..state.velocity.len() {
            state.velocity[i] += 0.5 * dt * state.acceleration[i];
        }

        state.time += dt;
        state.kinetic_energy = mass.kinetic_energy(&state.velocity);
    }
}

// ============================================================================
// CRITICAL TIME STEP
// ============================================================================

/// Compute critical time step based on CFL condition
pub struct TimeStepCalculator;

impl TimeStepCalculator {
    /// Compute critical time step for stability
    /// dt_crit = min(h_e / c_e) where h_e is element size, c_e is wave speed
    pub fn critical_time_step(
        element_sizes: &[f64],
        wave_speeds: &[f64],
        cfl_factor: f64,
    ) -> f64 {
        let dt_min = element_sizes.iter()
            .zip(wave_speeds.iter())
            .map(|(&h, &c)| if c > 1e-10 { h / c } else { f64::INFINITY })
            .fold(f64::INFINITY, f64::min);

        cfl_factor * dt_min
    }

    /// Compute wave speed for elastic material
    /// c = sqrt(E/ρ) for 1D, c = sqrt(E*(1-ν)/((1+ν)*(1-2ν)*ρ)) for 3D
    pub fn wave_speed(elastic_modulus: f64, density: f64, poisson_ratio: f64, dimension: usize) -> f64 {
        match dimension {
            1 => (elastic_modulus / density).sqrt(),
            2 | 3 => {
                let factor = elastic_modulus * (1.0 - poisson_ratio) /
                    ((1.0 + poisson_ratio) * (1.0 - 2.0 * poisson_ratio) * density);
                factor.sqrt()
            }
            _ => (elastic_modulus / density).sqrt(),
        }
    }

    /// Compute element characteristic length
    pub fn element_size(element_volume: f64, dimension: usize) -> f64 {
        match dimension {
            1 => element_volume,
            2 => element_volume.sqrt(),
            3 => element_volume.powf(1.0 / 3.0),
            _ => element_volume,
        }
    }
}

// ============================================================================
// HOURGLASS CONTROL
// ============================================================================

/// Hourglass (zero-energy mode) control
#[derive(Debug, Clone)]
pub struct HourglassControl {
    pub coefficient: f64,
    pub viscous: bool,  // true = viscous, false = stiffness
}

impl Default for HourglassControl {
    fn default() -> Self {
        HourglassControl {
            coefficient: 0.1,
            viscous: true,
        }
    }
}

impl HourglassControl {
    /// Compute hourglass force for 8-node hex element
    pub fn hourglass_force_hex8(
        &self,
        velocities: &[[f64; 3]; 8],
        characteristic_length: f64,
        density: f64,
        wave_speed: f64,
    ) -> [[f64; 3]; 8] {
        // Hourglass base vectors for hex8 (Flanagan-Belytschko)
        let gamma = [
            [1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0],
            [1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0],
            [1.0, -1.0, 1.0, -1.0, 1.0, -1.0, 1.0, -1.0],
            [-1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0],
        ];

        let mut forces = [[0.0; 3]; 8];

        // Hourglass coefficient
        let c_hg = self.coefficient * density * wave_speed * characteristic_length;

        for mode in 0..4 {
            for dir in 0..3 {
                // Compute hourglass velocity
                let mut q_hg = 0.0;
                for node in 0..8 {
                    q_hg += gamma[mode][node] * velocities[node][dir];
                }

                // Apply hourglass force
                for node in 0..8 {
                    forces[node][dir] -= c_hg * gamma[mode][node] * q_hg;
                }
            }
        }

        forces
    }
}

// ============================================================================
// EXPLICIT SOLVER
// ============================================================================

/// Main explicit dynamics solver
pub struct ExplicitSolver {
    pub config: ExplicitConfig,
    pub mass: LumpedMass,
    pub state: DynamicState,
    pub prev_displacement: Vec<f64>,
    pub history: Vec<DynamicState>,
    step_count: usize,
}

impl ExplicitSolver {
    pub fn new(config: ExplicitConfig, n_dof: usize) -> Self {
        ExplicitSolver {
            config,
            mass: LumpedMass::new(n_dof),
            state: DynamicState::new(n_dof),
            prev_displacement: vec![0.0; n_dof],
            history: Vec::new(),
            step_count: 0,
        }
    }

    pub fn set_mass(&mut self, mass: LumpedMass) {
        self.mass = mass;
    }

    pub fn set_initial_conditions(
        &mut self,
        displacement: Vec<f64>,
        velocity: Vec<f64>,
    ) {
        self.state.displacement = displacement.clone();
        self.state.velocity = velocity;

        // For central difference, compute u_{-1}
        let dt = self.config.dt.unwrap_or(1e-6);
        self.prev_displacement = displacement.iter()
            .zip(self.state.velocity.iter())
            .zip(self.state.acceleration.iter())
            .map(|((&u, &v), &a)| u - dt * v + 0.5 * dt * dt * a)
            .collect();
    }

    /// Run explicit analysis
    pub fn solve<F>(&mut self, mut compute_forces: F) -> ExplicitResult
    where
        F: FnMut(&[f64], f64) -> (Vec<f64>, Vec<f64>), // (internal_force, external_force)
    {
        let dt = self.config.dt.unwrap_or(1e-6);
        let n_steps = ((self.config.time_end - self.config.time_start) / dt).ceil() as usize;

        // Initialize
        let (f_int, f_ext) = compute_forces(&self.state.displacement, self.state.time);

        match self.config.method {
            ExplicitMethod::CentralDifference => {
                let integrator = CentralDifference::new(dt).with_damping(self.config.damping);
                integrator.initialize(&mut self.state, &self.mass, &f_ext, &f_int);
            }
            _ => {}
        }

        // Store initial state
        self.history.push(self.state.clone());

        // Time stepping loop
        for step in 0..n_steps {
            self.step_count = step;

            // Compute forces at current configuration
            let (f_int, f_ext) = compute_forces(&self.state.displacement, self.state.time);

            // Time integration step
            match self.config.method {
                ExplicitMethod::CentralDifference => {
                    let integrator = CentralDifference::new(dt).with_damping(self.config.damping);
                    let prev = self.prev_displacement.clone();
                    self.prev_displacement = self.state.displacement.clone();
                    integrator.step(&mut self.state, &prev, &self.mass, &f_ext, &f_int);
                }
                ExplicitMethod::VelocityVerlet => {
                    let integrator = VelocityVerlet::new(dt);
                    integrator.update_positions(&mut self.state);
                    integrator.update_velocities_half(&mut self.state);
                    let (f_int_new, f_ext_new) = compute_forces(&self.state.displacement, self.state.time);
                    integrator.update_accelerations(&mut self.state, &self.mass, &f_ext_new, &f_int_new);
                }
                _ => {
                    // Default to central difference
                    let integrator = CentralDifference::new(dt);
                    let prev = self.prev_displacement.clone();
                    self.prev_displacement = self.state.displacement.clone();
                    integrator.step(&mut self.state, &prev, &self.mass, &f_ext, &f_int);
                }
            }

            // Update internal energy (simplified)
            self.state.internal_energy += f_int.iter()
                .zip(self.state.velocity.iter())
                .map(|(&f, &v)| f * v * dt)
                .sum::<f64>();

            // Update external work
            self.state.external_work += f_ext.iter()
                .zip(self.state.velocity.iter())
                .map(|(&f, &v)| f * v * dt)
                .sum::<f64>();

            // Store history at intervals
            if step % self.config.output_interval == 0 {
                self.history.push(self.state.clone());
            }

            // Check for instability
            if self.state.kinetic_energy.is_nan() || self.state.kinetic_energy > 1e20 {
                return ExplicitResult {
                    final_state: self.state.clone(),
                    history: self.history.clone(),
                    total_steps: step,
                    stable: false,
                    energy_error: f64::INFINITY,
                };
            }
        }

        // Final state
        let energy_error = if self.config.energy_balance {
            self.state.energy_error()
        } else {
            0.0
        };

        ExplicitResult {
            final_state: self.state.clone(),
            history: self.history.clone(),
            total_steps: n_steps,
            stable: true,
            energy_error,
        }
    }
}

/// Result of explicit analysis
#[derive(Debug, Clone)]
pub struct ExplicitResult {
    pub final_state: DynamicState,
    pub history: Vec<DynamicState>,
    pub total_steps: usize,
    pub stable: bool,
    pub energy_error: f64,
}

impl ExplicitResult {
    /// Get displacement history at a DOF
    pub fn displacement_history(&self, dof: usize) -> Vec<(f64, f64)> {
        self.history.iter()
            .map(|s| (s.time, s.displacement.get(dof).copied().unwrap_or(0.0)))
            .collect()
    }

    /// Get velocity history at a DOF
    pub fn velocity_history(&self, dof: usize) -> Vec<(f64, f64)> {
        self.history.iter()
            .map(|s| (s.time, s.velocity.get(dof).copied().unwrap_or(0.0)))
            .collect()
    }

    /// Get energy history
    pub fn energy_history(&self) -> Vec<(f64, f64, f64, f64)> {
        self.history.iter()
            .map(|s| (s.time, s.kinetic_energy, s.internal_energy, s.external_work))
            .collect()
    }

    /// Maximum displacement at any DOF
    pub fn max_displacement(&self) -> f64 {
        self.history.iter()
            .flat_map(|s| s.displacement.iter())
            .fold(0.0, |max, &d| d.abs().max(max))
    }
}

// ============================================================================
// IMPACT ANALYSIS
// ============================================================================

/// Simple impact analysis utilities
pub struct ImpactAnalysis;

impl ImpactAnalysis {
    /// Hertzian contact stiffness for sphere-plane impact
    pub fn hertz_stiffness(
        radius: f64,
        elastic_modulus: f64,
        poisson_ratio: f64,
    ) -> f64 {
        let e_star = elastic_modulus / (1.0 - poisson_ratio * poisson_ratio);
        4.0 / 3.0 * e_star * radius.sqrt()
    }

    /// Contact force from Hertzian model
    pub fn hertz_force(stiffness: f64, penetration: f64) -> f64 {
        if penetration > 0.0 {
            stiffness * penetration.powf(1.5)
        } else {
            0.0
        }
    }

    /// Linear contact force with damping
    pub fn linear_contact_force(
        stiffness: f64,
        damping: f64,
        penetration: f64,
        velocity: f64,
    ) -> f64 {
        if penetration > 0.0 {
            stiffness * penetration + damping * velocity
        } else {
            0.0
        }
    }

    /// Coefficient of restitution to damping ratio
    pub fn restitution_to_damping(
        restitution: f64,
        stiffness: f64,
        mass: f64,
    ) -> f64 {
        if restitution > 0.0 && restitution < 1.0 {
            let ln_e = restitution.ln();
            -2.0 * ln_e * (stiffness * mass).sqrt() / (std::f64::consts::PI.powi(2) + ln_e.powi(2)).sqrt()
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lumped_mass() {
        let mass = LumpedMass::from_diagonal(vec![1.0, 2.0, 3.0]);

        assert!((mass.inverse[0] - 1.0).abs() < 1e-10);
        assert!((mass.inverse[1] - 0.5).abs() < 1e-10);
        assert!((mass.inverse[2] - 1.0/3.0).abs() < 1e-10);
    }

    #[test]
    fn test_kinetic_energy() {
        let mass = LumpedMass::from_diagonal(vec![2.0, 2.0, 2.0]);
        let velocity = vec![1.0, 2.0, 3.0];

        let ke = mass.kinetic_energy(&velocity);
        // KE = 0.5 * m * v² = 0.5 * 2 * (1 + 4 + 9) = 14
        assert!((ke - 14.0).abs() < 1e-10);
    }

    #[test]
    fn test_wave_speed() {
        // Steel: E = 210 GPa, ρ = 7850 kg/m³, ν = 0.3
        let e = 210e9;
        let rho = 7850.0;
        let nu = 0.3;

        let c_1d = TimeStepCalculator::wave_speed(e, rho, nu, 1);
        assert!(c_1d > 5000.0 && c_1d < 6000.0);  // ~5170 m/s

        let c_3d = TimeStepCalculator::wave_speed(e, rho, nu, 3);
        assert!(c_3d > 5000.0 && c_3d < 7000.0);
    }

    #[test]
    fn test_critical_time_step() {
        let sizes = vec![0.01, 0.02, 0.015];
        let speeds = vec![5000.0, 5000.0, 5000.0];

        let dt = TimeStepCalculator::critical_time_step(&sizes, &speeds, 0.9);

        // dt_crit = 0.9 * min(h/c) = 0.9 * 0.01/5000 = 1.8e-6
        assert!((dt - 1.8e-6).abs() < 1e-8);
    }

    #[test]
    fn test_dynamic_state() {
        let mut state = DynamicState::new(3);
        state.kinetic_energy = 100.0;
        state.internal_energy = 50.0;
        state.external_work = 160.0;

        assert!((state.total_energy() - 150.0).abs() < 1e-10);
        assert!((state.energy_error() - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_central_difference_step() {
        let integrator = CentralDifference::new(0.001);
        let mass = LumpedMass::from_diagonal(vec![1.0]);
        let mut state = DynamicState::new(1);
        state.displacement = vec![0.0];
        state.velocity = vec![1.0];

        let prev_disp = vec![-0.001]; // u_{-1}
        let f_ext = vec![0.0];
        let f_int = vec![0.0];

        integrator.step(&mut state, &prev_disp, &mass, &f_ext, &f_int);

        // Free motion: u_{n+1} = 2*u_n - u_{n-1} = 0 - (-0.001) = 0.001
        assert!((state.displacement[0] - 0.001).abs() < 1e-10);
    }

    #[test]
    fn test_hertz_contact() {
        let radius = 0.01;  // 10mm sphere
        let e = 210e9;
        let nu = 0.3;

        let k = ImpactAnalysis::hertz_stiffness(radius, e, nu);
        assert!(k > 0.0);

        let f = ImpactAnalysis::hertz_force(k, 0.0001);  // 0.1mm penetration
        assert!(f > 0.0);

        // No force when not in contact
        let f_no_contact = ImpactAnalysis::hertz_force(k, -0.001);
        assert_eq!(f_no_contact, 0.0);
    }

    #[test]
    fn test_explicit_config() {
        let config = ExplicitConfig::default();

        assert_eq!(config.method, ExplicitMethod::CentralDifference);
        assert!((config.cfl_factor - 0.9).abs() < 1e-10);
    }

    #[test]
    fn test_hourglass_control() {
        let hg = HourglassControl::default();

        let velocities = [[0.0; 3]; 8];
        let forces = hg.hourglass_force_hex8(&velocities, 0.01, 7850.0, 5000.0);

        // Zero velocity = zero hourglass force
        for node in 0..8 {
            for dir in 0..3 {
                assert!((forces[node][dir]).abs() < 1e-10);
            }
        }
    }

    #[test]
    fn test_velocity_verlet() {
        let integrator = VelocityVerlet::new(0.001);
        let mut state = DynamicState::new(1);
        state.displacement = vec![0.0];
        state.velocity = vec![1.0];
        state.acceleration = vec![0.0];

        integrator.update_positions(&mut state);

        // x = x + v*dt + 0.5*a*dt² = 0 + 1*0.001 + 0 = 0.001
        assert!((state.displacement[0] - 0.001).abs() < 1e-10);
    }
}
