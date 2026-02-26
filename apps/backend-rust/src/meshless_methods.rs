// ============================================================================
// MESHLESS METHODS - SPH, RKPM, EFG, MLPG
// Smoothed Particle Hydrodynamics, Reproducing Kernel Particle Methods
// Element-Free Galerkin, Meshless Local Petrov-Galerkin
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// KERNEL FUNCTIONS
// ============================================================================

/// Kernel function types for meshless methods
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KernelType {
    /// Cubic spline (B-spline)
    CubicSpline,
    /// Quartic spline
    QuarticSpline,
    /// Quintic spline
    QuinticSpline,
    /// Gaussian
    Gaussian { alpha: f64 },
    /// Wendland C2
    WendlandC2,
    /// Wendland C4
    WendlandC4,
    /// Wendland C6
    WendlandC6,
}

impl KernelType {
    /// Evaluate kernel W(r, h)
    pub fn evaluate(&self, r: f64, h: f64) -> f64 {
        let q = r / h;
        
        match self {
            KernelType::CubicSpline => {
                let alpha_d = 1.0 / (PI * h.powi(3)); // 3D
                
                if q <= 1.0 {
                    alpha_d * (1.0 - 1.5 * q.powi(2) + 0.75 * q.powi(3))
                } else if q <= 2.0 {
                    alpha_d * 0.25 * (2.0 - q).powi(3)
                } else {
                    0.0
                }
            }
            KernelType::QuarticSpline => {
                let alpha_d = 15.0 / (7.0 * PI * h.powi(2)); // 2D
                
                if q <= 2.0 {
                    let t1 = (2.0 - q).powi(4);
                    let t2 = if q <= 1.0 { 8.0 * (1.0 - q).powi(4) } else { 0.0 };
                    alpha_d * (t1 - t2)
                } else {
                    0.0
                }
            }
            KernelType::QuinticSpline => {
                let alpha_d = 7.0 / (478.0 * PI * h.powi(2)); // 2D
                
                if q <= 3.0 {
                    let t1 = (3.0 - q).powi(5);
                    let t2 = if q <= 2.0 { 6.0 * (2.0 - q).powi(5) } else { 0.0 };
                    let t3 = if q <= 1.0 { 15.0 * (1.0 - q).powi(5) } else { 0.0 };
                    alpha_d * (t1 - t2 + t3)
                } else {
                    0.0
                }
            }
            KernelType::Gaussian { alpha } => {
                let norm = alpha.powi(3) / PI.powf(1.5);
                norm * (-alpha.powi(2) * q.powi(2)).exp()
            }
            KernelType::WendlandC2 => {
                let alpha_d = 21.0 / (2.0 * PI * h.powi(3)); // 3D
                
                if q <= 1.0 {
                    alpha_d * (1.0 - q).powi(4) * (1.0 + 4.0 * q)
                } else {
                    0.0
                }
            }
            KernelType::WendlandC4 => {
                let alpha_d = 495.0 / (32.0 * PI * h.powi(3)); // 3D
                
                if q <= 1.0 {
                    alpha_d * (1.0 - q).powi(6) * (1.0 + 6.0 * q + 35.0 / 3.0 * q.powi(2))
                } else {
                    0.0
                }
            }
            KernelType::WendlandC6 => {
                let alpha_d = 1365.0 / (64.0 * PI * h.powi(3)); // 3D
                
                if q <= 1.0 {
                    alpha_d * (1.0 - q).powi(8) * (1.0 + 8.0 * q + 25.0 * q.powi(2) + 32.0 * q.powi(3))
                } else {
                    0.0
                }
            }
        }
    }
    
    /// Gradient of kernel dW/dr
    pub fn gradient(&self, r: f64, h: f64) -> f64 {
        let q = r / h;
        
        if r < 1e-10 {
            return 0.0;
        }
        
        match self {
            KernelType::CubicSpline => {
                let alpha_d = 1.0 / (PI * h.powi(3));
                
                if q <= 1.0 {
                    alpha_d / h * (-3.0 * q + 2.25 * q.powi(2))
                } else if q <= 2.0 {
                    alpha_d / h * (-0.75 * (2.0 - q).powi(2))
                } else {
                    0.0
                }
            }
            KernelType::WendlandC2 => {
                let alpha_d = 21.0 / (2.0 * PI * h.powi(3));
                
                if q <= 1.0 {
                    alpha_d / h * (-20.0 * q * (1.0 - q).powi(3))
                } else {
                    0.0
                }
            }
            _ => {
                // Numerical gradient for other kernels
                let eps = 1e-6;
                (self.evaluate(r + eps, h) - self.evaluate(r - eps, h)) / (2.0 * eps)
            }
        }
    }
    
    /// Second derivative d²W/dr²
    pub fn laplacian(&self, r: f64, h: f64) -> f64 {
        let eps = 1e-6;
        let dw_plus = self.gradient(r + eps, h);
        let dw_minus = self.gradient(r - eps, h);
        
        (dw_plus - dw_minus) / (2.0 * eps)
    }
}

// ============================================================================
// SPH PARTICLE
// ============================================================================

/// SPH particle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SphParticle {
    pub id: usize,
    pub position: [f64; 3],
    pub velocity: [f64; 3],
    pub acceleration: [f64; 3],
    pub mass: f64,
    pub density: f64,
    pub pressure: f64,
    pub internal_energy: f64,
    pub smoothing_length: f64,
    pub stress: [[f64; 3]; 3],
}

impl SphParticle {
    pub fn new(id: usize, position: [f64; 3], mass: f64, h: f64) -> Self {
        Self {
            id,
            position,
            velocity: [0.0; 3],
            acceleration: [0.0; 3],
            mass,
            density: 0.0,
            pressure: 0.0,
            internal_energy: 0.0,
            smoothing_length: h,
            stress: [[0.0; 3]; 3],
        }
    }
    
    /// Distance to another particle
    pub fn distance(&self, other: &SphParticle) -> f64 {
        let dx = self.position[0] - other.position[0];
        let dy = self.position[1] - other.position[1];
        let dz = self.position[2] - other.position[2];
        
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
    
    /// Update position (leapfrog)
    pub fn update_position(&mut self, dt: f64) {
        for i in 0..3 {
            self.position[i] += self.velocity[i] * dt + 0.5 * self.acceleration[i] * dt * dt;
        }
    }
    
    /// Update velocity
    pub fn update_velocity(&mut self, dt: f64) {
        for i in 0..3 {
            self.velocity[i] += self.acceleration[i] * dt;
        }
    }
    
    /// Kinetic energy
    pub fn kinetic_energy(&self) -> f64 {
        let v_sq: f64 = self.velocity.iter().map(|v| v * v).sum();
        0.5 * self.mass * v_sq
    }
}

// ============================================================================
// SPH SIMULATION
// ============================================================================

/// Equation of state types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EquationOfState {
    /// Ideal gas
    IdealGas { gamma: f64, c0: f64 },
    /// Tait equation (weakly compressible)
    Tait { rho0: f64, c0: f64, gamma: f64 },
    /// Linear elastic
    LinearElastic { k: f64 },
}

impl EquationOfState {
    /// Compute pressure from density
    pub fn pressure(&self, density: f64) -> f64 {
        match self {
            EquationOfState::IdealGas { gamma, c0 } => {
                (gamma - 1.0) * density * c0.powi(2) / gamma
            }
            EquationOfState::Tait { rho0, c0, gamma } => {
                let b = rho0 * c0.powi(2) / gamma;
                b * ((density / rho0).powf(*gamma) - 1.0)
            }
            EquationOfState::LinearElastic { k } => {
                *k * density
            }
        }
    }
    
    /// Sound speed
    pub fn sound_speed(&self, density: f64) -> f64 {
        match self {
            EquationOfState::IdealGas { gamma, c0: _ } => {
                (gamma * self.pressure(density) / density).sqrt()
            }
            EquationOfState::Tait { rho0, c0, gamma } => {
                c0 * (density / rho0).powf((gamma - 1.0) / 2.0)
            }
            EquationOfState::LinearElastic { k } => {
                k.sqrt()
            }
        }
    }
}

/// SPH simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SphSimulation {
    pub particles: Vec<SphParticle>,
    pub kernel: KernelType,
    pub eos: EquationOfState,
    pub viscosity: f64,
    pub time: f64,
    pub dt: f64,
}

impl SphSimulation {
    pub fn new(kernel: KernelType, eos: EquationOfState) -> Self {
        Self {
            particles: Vec::new(),
            kernel,
            eos,
            viscosity: 0.01,
            time: 0.0,
            dt: 0.001,
        }
    }
    
    /// Add particle
    pub fn add_particle(&mut self, position: [f64; 3], mass: f64, h: f64) {
        let id = self.particles.len();
        self.particles.push(SphParticle::new(id, position, mass, h));
    }
    
    /// Compute density for all particles
    pub fn compute_density(&mut self) {
        let n = self.particles.len();
        
        for i in 0..n {
            let mut rho = 0.0;
            let hi = self.particles[i].smoothing_length;
            
            for j in 0..n {
                let r = self.particles[i].distance(&self.particles[j]);
                let w = self.kernel.evaluate(r, hi);
                rho += self.particles[j].mass * w;
            }
            
            self.particles[i].density = rho;
        }
    }
    
    /// Compute pressure from density
    pub fn compute_pressure(&mut self) {
        for particle in &mut self.particles {
            particle.pressure = self.eos.pressure(particle.density);
        }
    }
    
    /// Compute accelerations
    pub fn compute_accelerations(&mut self) {
        let n = self.particles.len();
        
        // Reset accelerations
        for i in 0..n {
            self.particles[i].acceleration = [0.0; 3];
        }
        
        // Compute pairwise interactions
        for i in 0..n {
            let hi = self.particles[i].smoothing_length;
            let rhoi = self.particles[i].density;
            let pi = self.particles[i].pressure;
            
            for j in (i + 1)..n {
                let r = self.particles[i].distance(&self.particles[j]);
                
                if r < 2.0 * hi {
                    let hj = self.particles[j].smoothing_length;
                    let rhoj = self.particles[j].density;
                    let pj = self.particles[j].pressure;
                    
                    // Average smoothing length
                    let h_avg = 0.5 * (hi + hj);
                    
                    // Kernel gradient
                    let dw = self.kernel.gradient(r, h_avg);
                    
                    // Unit vector
                    let mut e = [0.0; 3];
                    if r > 1e-10 {
                        for k in 0..3 {
                            e[k] = (self.particles[i].position[k] - self.particles[j].position[k]) / r;
                        }
                    }
                    
                    // Pressure force (symmetric)
                    let pterm = pi / (rhoi * rhoi) + pj / (rhoj * rhoj);
                    
                    let mi = self.particles[i].mass;
                    let mj = self.particles[j].mass;
                    
                    for k in 0..3 {
                        let f = -pterm * dw * e[k];
                        self.particles[i].acceleration[k] += mj * f;
                        self.particles[j].acceleration[k] -= mi * f;
                    }
                }
            }
        }
    }
    
    /// Time step
    pub fn step(&mut self) {
        self.compute_density();
        self.compute_pressure();
        self.compute_accelerations();
        
        for particle in &mut self.particles {
            particle.update_velocity(self.dt);
            particle.update_position(self.dt);
        }
        
        self.time += self.dt;
    }
    
    /// Total kinetic energy
    pub fn kinetic_energy(&self) -> f64 {
        self.particles.iter().map(|p| p.kinetic_energy()).sum()
    }
    
    /// CFL time step
    pub fn cfl_timestep(&self) -> f64 {
        let mut dt_min = f64::MAX;
        
        for particle in &self.particles {
            let c = self.eos.sound_speed(particle.density);
            let dt = 0.3 * particle.smoothing_length / c;
            dt_min = dt_min.min(dt);
        }
        
        dt_min
    }
}

// ============================================================================
// RKPM SHAPE FUNCTIONS
// ============================================================================

/// RKPM (Reproducing Kernel Particle Method) shape functions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RkpmShapeFunction {
    pub kernel: KernelType,
    pub order: usize, // Polynomial order (0, 1, 2)
    pub dilation: f64,
}

impl RkpmShapeFunction {
    pub fn new(kernel: KernelType, order: usize, dilation: f64) -> Self {
        Self { kernel, order, dilation }
    }
    
    /// Moment matrix M(x) for 2D
    pub fn moment_matrix_2d(&self, x: [f64; 2], nodes: &[[f64; 2]]) -> [[f64; 6]; 6] {
        let mut m = [[0.0; 6]; 6];
        
        for node in nodes {
            let dx = x[0] - node[0];
            let dy = x[1] - node[1];
            let r = (dx * dx + dy * dy).sqrt();
            let w = self.kernel.evaluate(r, self.dilation);
            
            // Polynomial basis: 1, x, y, x², xy, y²
            let p = [1.0, dx, dy, dx * dx, dx * dy, dy * dy];
            
            for i in 0..6 {
                for j in 0..6 {
                    m[i][j] += w * p[i] * p[j];
                }
            }
        }
        
        m
    }
    
    /// Shape function value at x for node I
    pub fn shape_function_2d(&self, x: [f64; 2], node: [f64; 2], _nodes: &[[f64; 2]]) -> f64 {
        let dx = x[0] - node[0];
        let dy = x[1] - node[1];
        let r = (dx * dx + dy * dy).sqrt();
        let w = self.kernel.evaluate(r, self.dilation);
        
        if w < 1e-12 {
            return 0.0;
        }
        
        // For linear basis (order 1)
        let _p0 = [1.0, 0.0, 0.0];
        let _h_basis = [1.0, dx, dy];
        
        // Simplified correction (full implementation would solve M * c = H(0))
        let correction = 1.0;
        
        correction * w
    }
}

// ============================================================================
// EFG (ELEMENT-FREE GALERKIN)
// ============================================================================

/// EFG analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EfgAnalysis {
    pub nodes: Vec<[f64; 2]>,
    pub support_sizes: Vec<f64>,
    pub kernel: KernelType,
    pub weight_function: WeightFunction,
}

/// Weight function for MLS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WeightFunction {
    Cubic,
    Quartic,
    Exponential { beta: f64 },
    Gaussian { alpha: f64 },
}

impl WeightFunction {
    pub fn evaluate(&self, s: f64) -> f64 {
        // s = r / d_max (normalized distance)
        match self {
            WeightFunction::Cubic => {
                if s <= 0.5 {
                    2.0 / 3.0 - 4.0 * s * s + 4.0 * s * s * s
                } else if s <= 1.0 {
                    4.0 / 3.0 - 4.0 * s + 4.0 * s * s - 4.0 / 3.0 * s * s * s
                } else {
                    0.0
                }
            }
            WeightFunction::Quartic => {
                if s <= 1.0 {
                    1.0 - 6.0 * s * s + 8.0 * s * s * s - 3.0 * s.powi(4)
                } else {
                    0.0
                }
            }
            WeightFunction::Exponential { beta } => {
                if s <= 1.0 {
                    ((-beta * s * s).exp() - (-beta).exp()) / (1.0 - (-beta).exp())
                } else {
                    0.0
                }
            }
            WeightFunction::Gaussian { alpha } => {
                (-alpha * s * s).exp()
            }
        }
    }
    
    pub fn derivative(&self, s: f64) -> f64 {
        let eps = 1e-6;
        (self.evaluate(s + eps) - self.evaluate(s - eps)) / (2.0 * eps)
    }
}

impl EfgAnalysis {
    pub fn new(kernel: KernelType) -> Self {
        Self {
            nodes: Vec::new(),
            support_sizes: Vec::new(),
            kernel,
            weight_function: WeightFunction::Cubic,
        }
    }
    
    /// Add node
    pub fn add_node(&mut self, x: f64, y: f64, support: f64) {
        self.nodes.push([x, y]);
        self.support_sizes.push(support);
    }
    
    /// Find nodes in support of point x
    pub fn nodes_in_support(&self, x: [f64; 2], support: f64) -> Vec<usize> {
        self.nodes
            .iter()
            .enumerate()
            .filter(|(_, node)| {
                let dx = x[0] - node[0];
                let dy = x[1] - node[1];
                (dx * dx + dy * dy).sqrt() <= support
            })
            .map(|(i, _)| i)
            .collect()
    }
    
    /// MLS shape functions at point
    pub fn mls_shape_functions(&self, x: [f64; 2]) -> Vec<(usize, f64)> {
        let support = 2.5; // Characteristic support size
        let nodes_in_support = self.nodes_in_support(x, support);
        
        let mut shapes = Vec::new();
        
        for &i in &nodes_in_support {
            let node = self.nodes[i];
            let dx = x[0] - node[0];
            let dy = x[1] - node[1];
            let r = (dx * dx + dy * dy).sqrt();
            let s = r / support;
            let w = self.weight_function.evaluate(s);
            
            shapes.push((i, w));
        }
        
        // Normalize
        let sum: f64 = shapes.iter().map(|(_, w)| w).sum();
        
        if sum > 1e-12 {
            for (_, w) in &mut shapes {
                *w /= sum;
            }
        }
        
        shapes
    }
}

// ============================================================================
// MLPG (MESHLESS LOCAL PETROV-GALERKIN)
// ============================================================================

/// MLPG method
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MlpgAnalysis {
    pub nodes: Vec<[f64; 2]>,
    pub test_function: TestFunction,
    pub trial_kernel: KernelType,
    pub quadrature_points: usize,
}

/// Test function for MLPG
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestFunction {
    /// Heaviside step function
    Heaviside,
    /// Same as trial function (Galerkin)
    Galerkin,
    /// Delta function (collocation)
    Delta,
    /// Radial basis
    RadialBasis { r0: f64 },
}

impl TestFunction {
    pub fn evaluate(&self, r: f64, support: f64) -> f64 {
        match self {
            TestFunction::Heaviside => {
                if r <= support { 1.0 } else { 0.0 }
            }
            TestFunction::Galerkin => {
                // Use cubic spline
                let q = r / support;
                if q <= 1.0 {
                    1.0 - 1.5 * q * q + 0.75 * q * q * q
                } else if q <= 2.0 {
                    0.25 * (2.0 - q).powi(3)
                } else {
                    0.0
                }
            }
            TestFunction::Delta => {
                if r < 1e-6 { 1.0 } else { 0.0 }
            }
            TestFunction::RadialBasis { r0 } => {
                (-(r / r0).powi(2)).exp()
            }
        }
    }
}

impl MlpgAnalysis {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            test_function: TestFunction::Heaviside,
            trial_kernel: KernelType::CubicSpline,
            quadrature_points: 4,
        }
    }
    
    /// Add node
    pub fn add_node(&mut self, x: f64, y: f64) {
        self.nodes.push([x, y]);
    }
    
    /// Local domain radius for node
    pub fn local_domain_radius(&self, _node_id: usize) -> f64 {
        // Could be adaptive
        1.0
    }
}

// ============================================================================
// RADIAL BASIS FUNCTIONS
// ============================================================================

/// RBF interpolation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RbfInterpolation {
    pub centers: Vec<[f64; 2]>,
    pub values: Vec<f64>,
    pub rbf_type: RbfType,
    pub coefficients: Vec<f64>,
}

/// RBF types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RbfType {
    /// Multiquadric
    Multiquadric { c: f64 },
    /// Inverse multiquadric
    InverseMultiquadric { c: f64 },
    /// Thin plate spline
    ThinPlateSpline,
    /// Gaussian
    Gaussian { epsilon: f64 },
    /// Polyharmonic spline
    Polyharmonic { k: i32 },
}

impl RbfType {
    pub fn evaluate(&self, r: f64) -> f64 {
        match self {
            RbfType::Multiquadric { c } => (r * r + c * c).sqrt(),
            RbfType::InverseMultiquadric { c } => 1.0 / (r * r + c * c).sqrt(),
            RbfType::ThinPlateSpline => {
                if r > 1e-10 {
                    r * r * r.ln()
                } else {
                    0.0
                }
            }
            RbfType::Gaussian { epsilon } => (-epsilon * r * r).exp(),
            RbfType::Polyharmonic { k } => {
                if *k % 2 == 0 {
                    if r > 1e-10 {
                        r.powi(*k) * r.ln()
                    } else {
                        0.0
                    }
                } else {
                    r.powi(*k)
                }
            }
        }
    }
}

impl RbfInterpolation {
    pub fn new(rbf_type: RbfType) -> Self {
        Self {
            centers: Vec::new(),
            values: Vec::new(),
            rbf_type,
            coefficients: Vec::new(),
        }
    }
    
    /// Add data point
    pub fn add_point(&mut self, x: f64, y: f64, value: f64) {
        self.centers.push([x, y]);
        self.values.push(value);
    }
    
    /// Solve for coefficients
    pub fn solve(&mut self) {
        let n = self.centers.len();
        
        if n == 0 {
            return;
        }
        
        // Build interpolation matrix
        let mut a = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            for j in 0..n {
                let dx = self.centers[i][0] - self.centers[j][0];
                let dy = self.centers[i][1] - self.centers[j][1];
                let r = (dx * dx + dy * dy).sqrt();
                a[i][j] = self.rbf_type.evaluate(r);
            }
        }
        
        // Solve A * c = f (simplified Gaussian elimination)
        self.coefficients = self.values.clone();
        
        // Forward elimination
        for k in 0..n {
            for i in (k + 1)..n {
                if a[k][k].abs() < 1e-12 {
                    continue;
                }
                let factor = a[i][k] / a[k][k];
                for j in k..n {
                    a[i][j] -= factor * a[k][j];
                }
                self.coefficients[i] -= factor * self.coefficients[k];
            }
        }
        
        // Back substitution
        for k in (0..n).rev() {
            if a[k][k].abs() < 1e-12 {
                continue;
            }
            for j in (k + 1)..n {
                self.coefficients[k] -= a[k][j] * self.coefficients[j];
            }
            self.coefficients[k] /= a[k][k];
        }
    }
    
    /// Interpolate at point
    pub fn interpolate(&self, x: f64, y: f64) -> f64 {
        let mut value = 0.0;
        
        for (i, center) in self.centers.iter().enumerate() {
            let dx = x - center[0];
            let dy = y - center[1];
            let r = (dx * dx + dy * dy).sqrt();
            value += self.coefficients[i] * self.rbf_type.evaluate(r);
        }
        
        value
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cubic_spline_kernel() {
        let kernel = KernelType::CubicSpline;
        
        let w0 = kernel.evaluate(0.0, 1.0);
        let w1 = kernel.evaluate(0.5, 1.0);
        let w2 = kernel.evaluate(2.5, 1.0);
        
        assert!(w0 > w1);
        assert!(w1 > 0.0);
        assert!((w2 - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_wendland_kernel() {
        let kernel = KernelType::WendlandC2;
        
        let w0 = kernel.evaluate(0.0, 1.0);
        let w1 = kernel.evaluate(1.5, 1.0);
        
        assert!(w0 > 0.0);
        assert!((w1 - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_kernel_gradient() {
        let kernel = KernelType::CubicSpline;
        
        let dw = kernel.gradient(0.5, 1.0);
        assert!(dw < 0.0); // Gradient should be negative
    }

    #[test]
    fn test_sph_particle() {
        let mut p = SphParticle::new(0, [0.0, 0.0, 0.0], 1.0, 0.5);
        
        p.velocity = [1.0, 0.0, 0.0];
        p.acceleration = [0.0, -9.81, 0.0];
        
        p.update_position(0.01);
        
        assert!(p.position[0] > 0.0);
    }

    #[test]
    fn test_tait_eos() {
        let eos = EquationOfState::Tait {
            rho0: 1000.0,
            c0: 1500.0,
            gamma: 7.0,
        };
        
        let p = eos.pressure(1000.0);
        assert!(p.abs() < 1.0); // Should be near zero at reference density
        
        let c = eos.sound_speed(1000.0);
        assert!((c - 1500.0).abs() < 1.0);
    }

    #[test]
    fn test_sph_simulation() {
        let kernel = KernelType::CubicSpline;
        let eos = EquationOfState::Tait {
            rho0: 1000.0,
            c0: 50.0,
            gamma: 7.0,
        };
        
        let mut sim = SphSimulation::new(kernel, eos);
        
        sim.add_particle([0.0, 0.0, 0.0], 1.0, 0.1);
        sim.add_particle([0.05, 0.0, 0.0], 1.0, 0.1);
        
        sim.compute_density();
        
        assert!(sim.particles[0].density > 0.0);
    }

    #[test]
    fn test_weight_functions() {
        let cubic = WeightFunction::Cubic;
        let quartic = WeightFunction::Quartic;
        
        assert!((cubic.evaluate(0.0) - 2.0 / 3.0).abs() < 0.01);
        assert!((quartic.evaluate(0.0) - 1.0).abs() < 0.01);
        
        assert!(cubic.evaluate(1.5) < 0.01);
    }

    #[test]
    fn test_rbf_interpolation() {
        let mut rbf = RbfInterpolation::new(RbfType::Gaussian { epsilon: 1.0 });
        
        rbf.add_point(0.0, 0.0, 1.0);
        rbf.add_point(1.0, 0.0, 0.0);
        rbf.add_point(0.0, 1.0, 0.0);
        
        rbf.solve();
        
        let v = rbf.interpolate(0.0, 0.0);
        assert!((v - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_efg_analysis() {
        let mut efg = EfgAnalysis::new(KernelType::CubicSpline);
        
        efg.add_node(0.0, 0.0, 1.0);
        efg.add_node(1.0, 0.0, 1.0);
        efg.add_node(0.5, 0.5, 1.0);
        
        let shapes = efg.mls_shape_functions([0.5, 0.25]);
        
        assert!(!shapes.is_empty());
        
        let sum: f64 = shapes.iter().map(|(_, w)| w).sum();
        assert!((sum - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_rbf_types() {
        let mq = RbfType::Multiquadric { c: 1.0 };
        let gauss = RbfType::Gaussian { epsilon: 1.0 };
        
        assert!(mq.evaluate(0.0) > 0.0);
        assert!((gauss.evaluate(0.0) - 1.0).abs() < 0.01);
    }
}
