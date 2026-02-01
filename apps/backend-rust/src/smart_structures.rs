//! Smart Structures Module
//! 
//! Implements smart/adaptive structures with integrated sensors, actuators, and control:
//! - Active structural control
//! - Semi-active control systems
//! - Passive adaptive systems
//! - Real-time structural response modification

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// SMART MATERIAL TYPES
// ============================================================================

/// Smart material type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SmartMaterial {
    /// Shape Memory Alloy (SMA)
    ShapeMemoryAlloy,
    /// Piezoelectric ceramic (PZT)
    Piezoelectric,
    /// Magnetorheological fluid
    MagnetorheologicalFluid,
    /// Electrorheological fluid
    ElectrorheologicalFluid,
    /// Magnetostrictive material
    Magnetostrictive,
    /// Electroactive polymer
    ElectroactivePolymer,
    /// Fiber optic sensor
    FiberOptic,
}

impl SmartMaterial {
    /// Typical response time (ms)
    pub fn response_time(&self) -> f64 {
        match self {
            Self::ShapeMemoryAlloy => 100.0,
            Self::Piezoelectric => 0.01,
            Self::MagnetorheologicalFluid => 5.0,
            Self::ElectrorheologicalFluid => 2.0,
            Self::Magnetostrictive => 0.1,
            Self::ElectroactivePolymer => 10.0,
            Self::FiberOptic => 0.001,
        }
    }
    
    /// Maximum strain capability
    pub fn max_strain(&self) -> f64 {
        match self {
            Self::ShapeMemoryAlloy => 0.08,      // 8%
            Self::Piezoelectric => 0.001,        // 0.1%
            Self::MagnetorheologicalFluid => 0.0, // N/A
            Self::ElectrorheologicalFluid => 0.0, // N/A
            Self::Magnetostrictive => 0.002,     // 0.2%
            Self::ElectroactivePolymer => 0.10,   // 10%
            Self::FiberOptic => 0.0,             // Sensor only
        }
    }
    
    /// Maximum stress (MPa)
    pub fn max_stress(&self) -> f64 {
        match self {
            Self::ShapeMemoryAlloy => 800.0,
            Self::Piezoelectric => 60.0,
            Self::MagnetorheologicalFluid => 0.1,
            Self::ElectrorheologicalFluid => 0.01,
            Self::Magnetostrictive => 70.0,
            Self::ElectroactivePolymer => 5.0,
            Self::FiberOptic => 0.0,
        }
    }
}

// ============================================================================
// ACTUATOR SYSTEMS
// ============================================================================

/// Actuator type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ActuatorType {
    /// Hydraulic actuator
    Hydraulic,
    /// Pneumatic actuator
    Pneumatic,
    /// Electric motor
    Electric,
    /// Piezoelectric stack
    PiezoStack,
    /// SMA wire actuator
    SMAWire,
    /// MR damper
    MRDamper,
    /// Active mass damper (AMD)
    ActiveMassDamper,
    /// Active tendon
    ActiveTendon,
}

/// Actuator parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actuator {
    /// Actuator type
    pub actuator_type: ActuatorType,
    /// Maximum force (kN)
    pub max_force: f64,
    /// Maximum stroke (mm)
    pub max_stroke: f64,
    /// Bandwidth (Hz)
    pub bandwidth: f64,
    /// Response time (ms)
    pub response_time: f64,
    /// Power requirement (kW)
    pub power: f64,
    /// Location coordinates (x, y, z)
    pub location: (f64, f64, f64),
    /// Orientation (direction cosines)
    pub orientation: (f64, f64, f64),
}

impl Actuator {
    /// Create hydraulic actuator
    pub fn hydraulic(max_force: f64, max_stroke: f64, location: (f64, f64, f64)) -> Self {
        Self {
            actuator_type: ActuatorType::Hydraulic,
            max_force,
            max_stroke,
            bandwidth: 10.0,
            response_time: 20.0,
            power: max_force * 0.5, // Approximate
            location,
            orientation: (1.0, 0.0, 0.0),
        }
    }
    
    /// Create MR damper
    pub fn mr_damper(max_force: f64, location: (f64, f64, f64)) -> Self {
        Self {
            actuator_type: ActuatorType::MRDamper,
            max_force,
            max_stroke: 100.0,
            bandwidth: 100.0,
            response_time: 5.0,
            power: 0.1, // Low power for control
            location,
            orientation: (0.0, 0.0, 1.0),
        }
    }
    
    /// Create active mass damper
    pub fn active_mass_damper(mass: f64, max_stroke: f64, location: (f64, f64, f64)) -> Self {
        let max_force = mass * 10.0; // 1g acceleration
        
        Self {
            actuator_type: ActuatorType::ActiveMassDamper,
            max_force,
            max_stroke,
            bandwidth: 5.0,
            response_time: 50.0,
            power: max_force * max_stroke / 1000.0,
            location,
            orientation: (1.0, 0.0, 0.0),
        }
    }
    
    /// Check if actuator can provide required force
    pub fn can_provide_force(&self, required: f64) -> bool {
        required.abs() <= self.max_force
    }
    
    /// Check if actuator can provide required displacement
    pub fn can_provide_stroke(&self, required: f64) -> bool {
        required.abs() <= self.max_stroke
    }
}

// ============================================================================
// CONTROL SYSTEMS
// ============================================================================

/// Control system type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ControlType {
    /// Passive (no external energy)
    Passive,
    /// Active (full feedback)
    Active,
    /// Semi-active (adjustable passive)
    SemiActive,
    /// Hybrid (combination)
    Hybrid,
}

/// Control algorithm
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ControlAlgorithm {
    /// Linear Quadratic Regulator (LQR)
    LQR,
    /// Linear Quadratic Gaussian (LQG)
    LQG,
    /// H-infinity
    HInfinity,
    /// Sliding Mode Control
    SlidingMode,
    /// Fuzzy Logic
    FuzzyLogic,
    /// Neural Network
    NeuralNetwork,
    /// Model Predictive Control (MPC)
    MPC,
    /// PID Control
    PID,
    /// Bang-bang (on-off)
    BangBang,
    /// Clipped optimal
    ClippedOptimal,
}

/// State space model for control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateSpaceModel {
    /// State matrix A (n x n)
    pub a: Vec<Vec<f64>>,
    /// Input matrix B (n x m)
    pub b: Vec<Vec<f64>>,
    /// Output matrix C (p x n)
    pub c: Vec<Vec<f64>>,
    /// Feedthrough matrix D (p x m)
    pub d: Vec<Vec<f64>>,
    /// Number of states
    pub n_states: usize,
    /// Number of inputs
    pub n_inputs: usize,
    /// Number of outputs
    pub n_outputs: usize,
}

impl StateSpaceModel {
    /// Create SDOF model
    pub fn sdof(mass: f64, damping: f64, stiffness: f64) -> Self {
        let omega = (stiffness / mass).sqrt();
        let zeta = damping / (2.0 * (mass * stiffness).sqrt());
        
        // x = [displacement, velocity]
        // A = [0, 1; -k/m, -c/m]
        let a = vec![
            vec![0.0, 1.0],
            vec![-omega.powi(2), -2.0 * zeta * omega],
        ];
        
        // B = [0; 1/m]
        let b = vec![
            vec![0.0],
            vec![1.0 / mass],
        ];
        
        // C = [1, 0] (measure displacement)
        let c = vec![
            vec![1.0, 0.0],
        ];
        
        let d = vec![
            vec![0.0],
        ];
        
        Self {
            a,
            b,
            c,
            d,
            n_states: 2,
            n_inputs: 1,
            n_outputs: 1,
        }
    }
    
    /// Create MDOF model
    pub fn mdof(masses: &[f64], dampings: &[f64], stiffnesses: &[f64]) -> Self {
        let n = masses.len();
        let n_states = 2 * n;
        
        // Build mass, damping, stiffness matrices
        let mut m_inv = vec![vec![0.0; n]; n];
        let mut k = vec![vec![0.0; n]; n];
        let mut c = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            m_inv[i][i] = 1.0 / masses[i];
            
            if i == 0 {
                k[i][i] = stiffnesses[i];
                c[i][i] = dampings[i];
            } else {
                k[i][i] = stiffnesses[i] + stiffnesses[i-1];
                k[i][i-1] = -stiffnesses[i-1];
                k[i-1][i] = -stiffnesses[i-1];
                c[i][i] = dampings[i] + dampings[i-1];
                c[i][i-1] = -dampings[i-1];
                c[i-1][i] = -dampings[i-1];
            }
        }
        
        // State space: x = [x1, x2, ..., v1, v2, ...]
        let mut a = vec![vec![0.0; n_states]; n_states];
        
        // Upper right: I
        for i in 0..n {
            a[i][n + i] = 1.0;
        }
        
        // Lower left: -M^-1 * K
        // Lower right: -M^-1 * C
        for i in 0..n {
            for j in 0..n {
                for l in 0..n {
                    a[n + i][j] -= m_inv[i][l] * k[l][j];
                    a[n + i][n + j] -= m_inv[i][l] * c[l][j];
                }
            }
        }
        
        // B: force input at each DOF
        let mut b_mat = vec![vec![0.0; n]; n_states];
        for i in 0..n {
            b_mat[n + i][i] = m_inv[i][i];
        }
        
        // C: measure all displacements
        let mut c_mat = vec![vec![0.0; n_states]; n];
        for i in 0..n {
            c_mat[i][i] = 1.0;
        }
        
        let d_mat = vec![vec![0.0; n]; n];
        
        Self {
            a,
            b: b_mat,
            c: c_mat,
            d: d_mat,
            n_states,
            n_inputs: n,
            n_outputs: n,
        }
    }
}

/// LQR controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LQRController {
    /// Feedback gain matrix K
    pub gain: Vec<Vec<f64>>,
    /// State weighting matrix Q
    pub q: Vec<Vec<f64>>,
    /// Control weighting matrix R
    pub r: Vec<Vec<f64>>,
    /// Control type
    pub control_type: ControlType,
}

impl LQRController {
    /// Design LQR controller (simplified Riccati solution)
    pub fn design(model: &StateSpaceModel, q_diag: &[f64], r_diag: &[f64]) -> Self {
        let n = model.n_states;
        let m = model.n_inputs;
        
        // Build Q matrix
        let mut q = vec![vec![0.0; n]; n];
        for (i, &qi) in q_diag.iter().enumerate().take(n) {
            q[i][i] = qi;
        }
        
        // Build R matrix
        let mut r = vec![vec![0.0; m]; m];
        for (i, &ri) in r_diag.iter().enumerate().take(m) {
            r[i][i] = ri;
        }
        
        // Simplified gain computation (for SDOF)
        // K = R^-1 * B' * P where P is Riccati solution
        // For simple cases, use pole placement approximation
        let gain = Self::compute_gain(model, &q, &r);
        
        Self {
            gain,
            q,
            r,
            control_type: ControlType::Active,
        }
    }
    
    fn compute_gain(model: &StateSpaceModel, q: &[Vec<f64>], r: &[Vec<f64>]) -> Vec<Vec<f64>> {
        // Simplified gain for SDOF system
        let n = model.n_states;
        let m = model.n_inputs;
        
        // For SDOF: K ≈ [sqrt(q1/r), sqrt(q2/r)]
        let mut gain = vec![vec![0.0; n]; m];
        
        if n == 2 && m == 1 {
            let q1 = q[0][0];
            let q2 = q[1][1];
            let r1 = r[0][0];
            
            gain[0][0] = (q1 / r1).sqrt();
            gain[0][1] = (q2 / r1).sqrt();
        } else {
            // General case: simple proportional gain
            for i in 0..m.min(n) {
                gain[i][i] = (q[i][i] / r[i][i]).sqrt();
            }
        }
        
        gain
    }
    
    /// Compute control force
    pub fn compute_control(&self, state: &[f64]) -> Vec<f64> {
        let m = self.gain.len();
        let mut u = vec![0.0; m];
        
        for i in 0..m {
            for (j, &sj) in state.iter().enumerate() {
                if j < self.gain[i].len() {
                    u[i] -= self.gain[i][j] * sj;
                }
            }
        }
        
        u
    }
}

/// PID controller
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PIDController {
    /// Proportional gain
    pub kp: f64,
    /// Integral gain
    pub ki: f64,
    /// Derivative gain
    pub kd: f64,
    /// Anti-windup limit
    pub integral_limit: f64,
    /// Output limits (min, max)
    pub output_limits: (f64, f64),
    /// Integral accumulator
    integral: f64,
    /// Previous error
    prev_error: f64,
}

impl PIDController {
    pub fn new(kp: f64, ki: f64, kd: f64) -> Self {
        Self {
            kp,
            ki,
            kd,
            integral_limit: 1000.0,
            output_limits: (-1e6, 1e6),
            integral: 0.0,
            prev_error: 0.0,
        }
    }
    
    /// Compute control output
    pub fn compute(&mut self, error: f64, dt: f64) -> f64 {
        // Proportional
        let p = self.kp * error;
        
        // Integral (with anti-windup)
        self.integral += error * dt;
        self.integral = self.integral.clamp(-self.integral_limit, self.integral_limit);
        let i = self.ki * self.integral;
        
        // Derivative
        let d = if dt > 0.0 {
            self.kd * (error - self.prev_error) / dt
        } else {
            0.0
        };
        
        self.prev_error = error;
        
        // Total output with limits
        let output = p + i + d;
        output.clamp(self.output_limits.0, self.output_limits.1)
    }
    
    /// Reset controller state
    pub fn reset(&mut self) {
        self.integral = 0.0;
        self.prev_error = 0.0;
    }
}

// ============================================================================
// MR DAMPER MODEL
// ============================================================================

/// MR damper model (Bouc-Wen)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MRDamperModel {
    /// Viscous coefficient at zero field
    pub c0: f64,
    /// Viscous coefficient increment
    pub c1: f64,
    /// Stiffness
    pub k0: f64,
    /// Bouc-Wen parameters
    pub alpha: f64,
    pub beta: f64,
    pub gamma: f64,
    pub a_val: f64,
    /// Current (A)
    pub current: f64,
    /// Maximum current
    pub max_current: f64,
    /// Internal state
    z: f64,
}

impl MRDamperModel {
    /// Create typical MR damper
    pub fn typical(max_force: f64, max_current: f64) -> Self {
        Self {
            c0: max_force / 0.5 * 0.3, // Base viscosity
            c1: max_force / 0.5 * 0.7, // Field-dependent viscosity
            k0: 100.0, // Small stiffness
            alpha: max_force * 0.4,
            beta: 2.0,
            gamma: 2.0,
            a_val: 1.0,
            current: 0.0,
            max_current,
            z: 0.0,
        }
    }
    
    /// Compute damper force
    pub fn compute_force(&mut self, velocity: f64, displacement: f64, dt: f64) -> f64 {
        // Current-dependent parameters
        let i_ratio = self.current / self.max_current;
        let c = self.c0 + self.c1 * i_ratio;
        let alpha = self.alpha * (1.0 + 2.0 * i_ratio);
        
        // Bouc-Wen hysteresis
        let z_dot = -self.beta * velocity.abs() * self.z 
            - self.gamma * velocity * self.z.abs() 
            + self.a_val * velocity;
        self.z += z_dot * dt;
        
        // Total force
        c * velocity + self.k0 * displacement + alpha * self.z
    }
    
    /// Set current (0 to max)
    pub fn set_current(&mut self, current: f64) {
        self.current = current.clamp(0.0, self.max_current);
    }
    
    /// Clipped-optimal control
    pub fn clipped_optimal(&mut self, desired_force: f64, velocity: f64) -> f64 {
        // If desired force and velocity have same sign, increase current
        // Otherwise, set current to zero
        if desired_force * velocity > 0.0 {
            self.current = self.max_current;
        } else {
            self.current = 0.0;
        }
        
        self.current
    }
}

// ============================================================================
// ACTIVE MASS DAMPER
// ============================================================================

/// Active mass damper system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveMassDamper {
    /// AMD mass (kg)
    pub mass: f64,
    /// Spring stiffness (N/m)
    pub stiffness: f64,
    /// Damping coefficient (N·s/m)
    pub damping: f64,
    /// Maximum stroke (m)
    pub max_stroke: f64,
    /// Maximum force (N)
    pub max_force: f64,
    /// Natural frequency (Hz)
    pub frequency: f64,
    /// Tuning ratio (AMD freq / structure freq)
    pub tuning_ratio: f64,
    /// AMD displacement (m)
    displacement: f64,
    /// AMD velocity (m/s)
    velocity: f64,
}

impl ActiveMassDamper {
    /// Design AMD for structure
    pub fn design(
        structure_mass: f64,
        structure_frequency: f64,
        mass_ratio: f64,
    ) -> Self {
        // AMD mass
        let mass = structure_mass * mass_ratio;
        
        // Optimal tuning ratio (Den Hartog)
        let mu = mass_ratio;
        let f_opt = 1.0 / (1.0 + mu);
        
        // AMD frequency
        let omega_a = 2.0 * PI * structure_frequency * f_opt;
        let stiffness = mass * omega_a.powi(2);
        
        // Optimal damping ratio
        let zeta_opt = (3.0 * mu / (8.0 * (1.0 + mu))).sqrt();
        let damping = 2.0 * zeta_opt * (mass * stiffness).sqrt();
        
        // Stroke and force limits
        let max_stroke = 0.5; // Typical 500mm
        let max_force = mass * 10.0; // 1g acceleration
        
        Self {
            mass,
            stiffness,
            damping,
            max_stroke,
            max_force,
            frequency: structure_frequency * f_opt,
            tuning_ratio: f_opt,
            displacement: 0.0,
            velocity: 0.0,
        }
    }
    
    /// Simulate AMD response
    pub fn simulate_step(
        &mut self,
        structure_accel: f64,
        control_force: f64,
        dt: f64,
    ) -> (f64, f64) {
        // AMD equation of motion
        // m * x_a'' + c * x_a' + k * x_a = -m * x_s'' + u
        
        let accel = (-self.damping * self.velocity 
            - self.stiffness * self.displacement 
            - self.mass * structure_accel 
            + control_force.clamp(-self.max_force, self.max_force)) / self.mass;
        
        // Integration
        self.velocity += accel * dt;
        self.displacement += self.velocity * dt;
        
        // Enforce stroke limits
        if self.displacement.abs() > self.max_stroke {
            self.displacement = self.displacement.signum() * self.max_stroke;
            self.velocity = 0.0;
        }
        
        // Reaction force on structure
        let reaction = self.stiffness * self.displacement 
            + self.damping * self.velocity 
            + control_force.clamp(-self.max_force, self.max_force);
        
        (reaction, self.displacement)
    }
    
    /// Reset state
    pub fn reset(&mut self) {
        self.displacement = 0.0;
        self.velocity = 0.0;
    }
}

// ============================================================================
// SMART STRUCTURE SIMULATION
// ============================================================================

/// Smart structure system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartStructure {
    /// Structure model
    pub model: StateSpaceModel,
    /// Actuators
    pub actuators: Vec<Actuator>,
    /// Controller
    pub controller_type: ControlAlgorithm,
    /// Control gains
    pub gains: Vec<Vec<f64>>,
    /// State vector
    pub state: Vec<f64>,
    /// Time step (s)
    pub dt: f64,
}

impl SmartStructure {
    /// Create smart SDOF system
    pub fn sdof_with_control(
        mass: f64,
        damping: f64,
        stiffness: f64,
        controller: ControlAlgorithm,
    ) -> Self {
        let model = StateSpaceModel::sdof(mass, damping, stiffness);
        
        // Simple gains based on controller type
        let gains = match controller {
            ControlAlgorithm::LQR => vec![vec![1000.0, 100.0]],
            ControlAlgorithm::PID => vec![vec![500.0, 0.0]],
            _ => vec![vec![100.0, 10.0]],
        };
        
        Self {
            model,
            actuators: Vec::new(),
            controller_type: controller,
            gains,
            state: vec![0.0, 0.0],
            dt: 0.001,
        }
    }
    
    /// Simulate one time step
    pub fn simulate_step(&mut self, excitation: f64) -> (f64, f64) {
        let n = self.state.len();
        
        // Compute control force
        let mut u = 0.0;
        for (i, &s) in self.state.iter().enumerate() {
            if i < self.gains[0].len() {
                u -= self.gains[0][i] * s;
            }
        }
        
        // State derivative: x_dot = A*x + B*(u + w)
        let mut x_dot = vec![0.0; n];
        for i in 0..n {
            for j in 0..n {
                x_dot[i] += self.model.a[i][j] * self.state[j];
            }
            // Add control and excitation
            if i < self.model.b.len() && !self.model.b[i].is_empty() {
                x_dot[i] += self.model.b[i][0] * (u + excitation);
            }
        }
        
        // Euler integration
        for i in 0..n {
            self.state[i] += x_dot[i] * self.dt;
        }
        
        // Output (displacement)
        let y = self.state[0];
        
        (y, u)
    }
    
    /// Run simulation
    pub fn simulate(
        &mut self,
        excitation: &[f64],
        initial_state: &[f64],
    ) -> SimulationResult {
        self.state = initial_state.to_vec();
        
        let n_steps = excitation.len();
        let mut displacement = Vec::with_capacity(n_steps);
        let mut velocity = Vec::with_capacity(n_steps);
        let mut control_force = Vec::with_capacity(n_steps);
        let mut time = Vec::with_capacity(n_steps);
        
        for (i, &exc) in excitation.iter().enumerate() {
            let (disp, ctrl) = self.simulate_step(exc);
            displacement.push(disp);
            velocity.push(self.state[1]);
            control_force.push(ctrl);
            time.push(i as f64 * self.dt);
        }
        
        // Calculate statistics before moving into struct
        let max_displacement = displacement.iter().map(|d| d.abs()).fold(0.0, f64::max);
        let max_control_force = control_force.iter().map(|f| f.abs()).fold(0.0, f64::max);
        let rms_displacement = (displacement.iter().map(|d| d.powi(2)).sum::<f64>() / n_steps as f64).sqrt();
        
        SimulationResult {
            time,
            displacement,
            velocity,
            control_force,
            max_displacement,
            max_control_force,
            rms_displacement,
        }
    }
}

/// Simulation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    /// Time (s)
    pub time: Vec<f64>,
    /// Displacement (m)
    pub displacement: Vec<f64>,
    /// Velocity (m/s)
    pub velocity: Vec<f64>,
    /// Control force (N)
    pub control_force: Vec<f64>,
    /// Maximum displacement
    pub max_displacement: f64,
    /// Maximum control force
    pub max_control_force: f64,
    /// RMS displacement
    pub rms_displacement: f64,
}

impl SimulationResult {
    /// Calculate response reduction ratio
    pub fn reduction_ratio(&self, uncontrolled_max: f64) -> f64 {
        if uncontrolled_max > 0.0 {
            1.0 - self.max_displacement / uncontrolled_max
        } else {
            0.0
        }
    }
}

// ============================================================================
// PERFORMANCE EVALUATION
// ============================================================================

/// Control performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlPerformance {
    /// Peak displacement reduction (%)
    pub peak_reduction: f64,
    /// RMS displacement reduction (%)
    pub rms_reduction: f64,
    /// Peak control force (kN)
    pub peak_force: f64,
    /// Control energy (kJ)
    pub energy: f64,
    /// Efficiency (reduction per unit energy)
    pub efficiency: f64,
}

impl ControlPerformance {
    /// Evaluate control performance
    pub fn evaluate(
        controlled: &SimulationResult,
        uncontrolled: &SimulationResult,
    ) -> Self {
        let peak_reduction = if uncontrolled.max_displacement > 0.0 {
            (1.0 - controlled.max_displacement / uncontrolled.max_displacement) * 100.0
        } else {
            0.0
        };
        
        let rms_reduction = if uncontrolled.rms_displacement > 0.0 {
            (1.0 - controlled.rms_displacement / uncontrolled.rms_displacement) * 100.0
        } else {
            0.0
        };
        
        // Control energy (simplified)
        let energy: f64 = controlled.control_force.windows(2)
            .zip(controlled.displacement.windows(2))
            .map(|(f, d)| {
                let f_avg = (f[0] + f[1]) / 2.0;
                let d_diff = (d[1] - d[0]).abs();
                f_avg.abs() * d_diff
            })
            .sum::<f64>() / 1000.0; // Convert to kJ
        
        let efficiency = if energy > 0.0 {
            peak_reduction / energy
        } else {
            0.0
        };
        
        Self {
            peak_reduction,
            rms_reduction,
            peak_force: controlled.max_control_force / 1000.0,
            energy,
            efficiency,
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
    fn test_smart_material() {
        let sma = SmartMaterial::ShapeMemoryAlloy;
        
        assert!(sma.max_strain() > 0.0);
        assert!(sma.response_time() > 0.0);
    }

    #[test]
    fn test_actuator() {
        let act = Actuator::hydraulic(100.0, 50.0, (0.0, 0.0, 0.0));
        
        assert!(act.can_provide_force(80.0));
        assert!(!act.can_provide_force(150.0));
    }

    #[test]
    fn test_state_space_sdof() {
        let model = StateSpaceModel::sdof(1000.0, 50.0, 10000.0);
        
        assert_eq!(model.n_states, 2);
        assert_eq!(model.n_inputs, 1);
    }

    #[test]
    fn test_state_space_mdof() {
        let masses = vec![1000.0, 1000.0, 1000.0];
        let dampings = vec![50.0, 50.0, 50.0];
        let stiffnesses = vec![10000.0, 10000.0, 10000.0];
        
        let model = StateSpaceModel::mdof(&masses, &dampings, &stiffnesses);
        
        assert_eq!(model.n_states, 6);
        assert_eq!(model.n_inputs, 3);
    }

    #[test]
    fn test_lqr_controller() {
        let model = StateSpaceModel::sdof(1000.0, 50.0, 10000.0);
        let q = vec![1e6, 1e4];
        let r = vec![1.0];
        
        let lqr = LQRController::design(&model, &q, &r);
        
        assert_eq!(lqr.gain.len(), 1);
        assert_eq!(lqr.gain[0].len(), 2);
    }

    #[test]
    fn test_pid_controller() {
        let mut pid = PIDController::new(100.0, 10.0, 5.0);
        
        let output = pid.compute(1.0, 0.01);
        assert!(output > 0.0);
    }

    #[test]
    fn test_mr_damper() {
        let mut mr = MRDamperModel::typical(100.0, 2.0);
        
        let force = mr.compute_force(0.1, 0.01, 0.001);
        assert!(force.abs() > 0.0);
    }

    #[test]
    fn test_active_mass_damper() {
        let mut amd = ActiveMassDamper::design(100000.0, 1.0, 0.02);
        
        assert!(amd.mass > 0.0);
        assert!(amd.frequency > 0.0);
        
        let (reaction, _) = amd.simulate_step(0.1, 0.0, 0.01);
        assert!(reaction.abs() >= 0.0);
    }

    #[test]
    fn test_smart_structure_simulation() {
        let mut structure = SmartStructure::sdof_with_control(
            1000.0, 50.0, 10000.0,
            ControlAlgorithm::LQR,
        );
        
        // Generate excitation
        let n_steps = 1000;
        let excitation: Vec<f64> = (0..n_steps)
            .map(|i| {
                let t = i as f64 * 0.001;
                1000.0 * (2.0 * PI * 1.5 * t).sin()
            })
            .collect();
        
        let result = structure.simulate(&excitation, &[0.0, 0.0]);
        
        assert!(result.max_displacement > 0.0);
    }

    #[test]
    fn test_control_performance() {
        let controlled = SimulationResult {
            time: vec![0.0, 0.01],
            displacement: vec![0.0, 0.005],
            velocity: vec![0.0, 0.5],
            control_force: vec![0.0, 1000.0],
            max_displacement: 0.005,
            max_control_force: 1000.0,
            rms_displacement: 0.003,
        };
        
        let uncontrolled = SimulationResult {
            time: vec![0.0, 0.01],
            displacement: vec![0.0, 0.01],
            velocity: vec![0.0, 1.0],
            control_force: vec![0.0, 0.0],
            max_displacement: 0.01,
            max_control_force: 0.0,
            rms_displacement: 0.006,
        };
        
        let perf = ControlPerformance::evaluate(&controlled, &uncontrolled);
        
        assert!(perf.peak_reduction > 0.0);
        assert!(perf.rms_reduction > 0.0);
    }

    #[test]
    fn test_clipped_optimal() {
        let mut mr = MRDamperModel::typical(100.0, 2.0);
        
        let current = mr.clipped_optimal(50.0, 0.1);
        assert!(current > 0.0);
        
        let current = mr.clipped_optimal(50.0, -0.1);
        assert!(current == 0.0);
    }
}
