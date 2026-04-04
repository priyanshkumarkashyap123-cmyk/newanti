//! Numerical integration (quadrature) algorithms extracted from advanced numerical methods.

use crate::numerics::IntegrationResult;
use std::f64::consts::PI;

// ============================================================================
// NUMERICAL INTEGRATION (QUADRATURE)
// ============================================================================

/// Gauss-Legendre quadrature nodes and weights
/// 
/// Exact for polynomials of degree 2n-1.
/// Industry standard for high-accuracy integration.
pub struct GaussLegendre {
    nodes: Vec<f64>,
    weights: Vec<f64>,
}

impl GaussLegendre {
    /// Create n-point Gauss-Legendre quadrature
    pub fn new(n: usize) -> Self {
        let (nodes, weights) = gauss_legendre_nodes_weights(n);
        GaussLegendre { nodes, weights }
    }
    
    /// Integrate f over [a, b]
    pub fn integrate<F>(&self, f: F, a: f64, b: f64) -> f64
    where
        F: Fn(f64) -> f64,
    {
        let half_len = (b - a) / 2.0;
        let mid = (a + b) / 2.0;
        
        let mut sum = 0.0;
        for (i, &xi) in self.nodes.iter().enumerate() {
            let x = mid + half_len * xi;
            sum += self.weights[i] * f(x);
        }
        
        half_len * sum
    }
    
    /// Number of quadrature points
    pub fn order(&self) -> usize {
        self.nodes.len()
    }
}

/// Compute Gauss-Legendre nodes and weights using Newton's method
/// 
/// Finds roots of Legendre polynomial and computes weights.
fn gauss_legendre_nodes_weights(n: usize) -> (Vec<f64>, Vec<f64>) {
    if n == 0 {
        return (vec![], vec![]);
    }
    if n == 1 {
        return (vec![0.0], vec![2.0]);
    }
    
    let mut nodes = Vec::with_capacity(n);
    let mut weights = Vec::with_capacity(n);
    
    // Find roots of Legendre polynomial P_n(x) using Newton's method
    for i in 1..=n {
        // Initial guess using Chebyshev points
        let m = i as f64;
        let x = -((PI * (m - 0.25)) / (n as f64 + 0.5)).cos();
        
        let x = newton_legendre_root(x, n);
        
        // Compute weight using formula: w_i = 2 / ((1 - x_i^2) * [P'_n(x_i)]^2)
        let (_, dp) = legendre_poly_and_derivative(n, x);
        let weight = 2.0 / ((1.0 - x * x) * dp * dp);
        
        nodes.push(x);
        weights.push(weight);
    }
    
    (nodes, weights)
}

/// Find a root of Legendre polynomial using Newton's method
fn newton_legendre_root(mut x: f64, n: usize) -> f64 {
    for _ in 0..20 {
        let (p, dp) = legendre_poly_and_derivative(n, x);
        let delta = p / dp;
        x -= delta;
        if delta.abs() < 1e-14 * x.abs().max(1.0) {
            break;
        }
    }
    x
}

/// Compute Legendre polynomial P_n(x) and its derivative using recurrence
fn legendre_poly_and_derivative(n: usize, x: f64) -> (f64, f64) {
    if n == 0 {
        return (1.0, 0.0);
    }
    if n == 1 {
        return (x, 1.0);
    }
    
    let mut p_prev = 1.0;
    let mut p_curr = x;
    
    for k in 2..=n {
        let kf = k as f64;
        let p_next = ((2.0 * kf - 1.0) * x * p_curr - (kf - 1.0) * p_prev) / kf;
        p_prev = p_curr;
        p_curr = p_next;
    }
    
    // Derivative: (1 - x^2) P'_n(x) = n * (P_{n-1}(x) - x * P_n(x))
    let dp = (p_prev - x * p_curr) * (n as f64) / (1.0 - x * x);
    
    (p_curr, dp)
}

/// Gauss-Lobatto quadrature (includes endpoints)
/// 
/// Useful when endpoint values are needed (e.g., for boundary conditions).
pub struct GaussLobatto {
    nodes: Vec<f64>,
    weights: Vec<f64>,
}

impl GaussLobatto {
    /// Create n-point Gauss-Lobatto quadrature
    pub fn new(n: usize) -> Self {
        let (nodes, weights) = gauss_lobatto_nodes_weights(n);
        GaussLobatto { nodes, weights }
    }
    
    /// Integrate f over [a, b]
    pub fn integrate<F>(&self, f: F, a: f64, b: f64) -> f64
    where
        F: Fn(f64) -> f64,
    {
        let half_len = (b - a) / 2.0;
        let mid = (a + b) / 2.0;
        
        let mut sum = 0.0;
        for (i, &xi) in self.nodes.iter().enumerate() {
            let x = mid + half_len * xi;
            sum += self.weights[i] * f(x);
        }
        
        half_len * sum
    }
}

/// Compute Gauss-Lobatto nodes and weights
fn gauss_lobatto_nodes_weights(n: usize) -> (Vec<f64>, Vec<f64>) {
    if n < 2 {
        return (vec![-1.0, 1.0], vec![1.0, 1.0]);
    }
    
    let mut nodes = vec![0.0; n];
    let mut weights = vec![0.0; n];
    
    // Endpoints
    nodes[0] = -1.0;
    nodes[n - 1] = 1.0;
    
    // Interior nodes are roots of P'_{n-1}
    if n > 2 {
        // Initial guesses using Chebyshev nodes
        for i in 1..n - 1 {
            nodes[i] = -((PI * i as f64) / (n - 1) as f64).cos();
        }
        
        // Newton iteration for roots of P'_{n-1}
        for i in 1..n - 1 {
            let mut x = nodes[i];
            for _ in 0..10 {
                let (_p, dp) = legendre_derivative(n - 1, x);
                let (_, ddp) = legendre_second_derivative(n - 1, x);
                let delta = dp / ddp;
                x -= delta;
                if delta.abs() < 1e-15 {
                    break;
                }
            }
            nodes[i] = x;
        }
    }
    
    // Weights
    for i in 0..n {
        let x = nodes[i];
        let (p, _) = legendre_derivative(n - 1, x);
        weights[i] = 2.0 / ((n * (n - 1)) as f64 * p * p);
    }
    
    (nodes, weights)
}

/// Legendre polynomial P_n(x) and its derivative
fn legendre_derivative(n: usize, x: f64) -> (f64, f64) {
    if n == 0 {
        return (1.0, 0.0);
    }
    if n == 1 {
        return (x, 1.0);
    }
    
    let mut p_prev = 1.0;
    let mut p_curr = x;
    let mut dp_prev = 0.0;
    let mut dp_curr = 1.0;
    
    for k in 2..=n {
        let kf = k as f64;
        let p_next = ((2.0 * kf - 1.0) * x * p_curr - (kf - 1.0) * p_prev) / kf;
        let dp_next = ((2.0 * kf - 1.0) * (p_curr + x * dp_curr) - (kf - 1.0) * dp_prev) / kf;
        
        p_prev = p_curr;
        p_curr = p_next;
        dp_prev = dp_curr;
        dp_curr = dp_next;
    }
    
    (p_curr, dp_curr)
}

/// Legendre polynomial second derivative
fn legendre_second_derivative(n: usize, x: f64) -> (f64, f64) {
    if n == 0 {
        return (0.0, 0.0);
    }
    if n == 1 {
        return (0.0, 0.0);
    }
    
    let mut p_prev = 1.0;
    let mut p_curr = x;
    let mut dp_prev = 0.0;
    let mut dp_curr = 1.0;
    let mut ddp_prev = 0.0;
    let mut ddp_curr = 0.0;
    
    for k in 2..=n {
        let kf = k as f64;
        let p_next = ((2.0 * kf - 1.0) * x * p_curr - (kf - 1.0) * p_prev) / kf;
        let dp_next = ((2.0 * kf - 1.0) * (p_curr + x * dp_curr) - (kf - 1.0) * dp_prev) / kf;
        let ddp_next = ((2.0 * kf - 1.0) * (2.0 * dp_curr + x * ddp_curr) - (kf - 1.0) * ddp_prev) / kf;
        
        p_prev = p_curr;
        p_curr = p_next;
        dp_prev = dp_curr;
        dp_curr = dp_next;
        ddp_prev = ddp_curr;
        ddp_curr = ddp_next;
    }
    
    (dp_curr, ddp_curr)
}

/// Adaptive Simpson's rule with error estimation
/// 
/// Automatically refines intervals until error tolerance is met.
pub fn adaptive_simpson<F>(f: F, a: f64, b: f64, tol: f64, max_depth: usize) -> IntegrationResult
where
    F: Fn(f64) -> f64,
{
    let mut total_error = 0.0;
    
    fn simpson_step<F>(f: &F, a: f64, b: f64) -> (f64, usize)
    where
        F: Fn(f64) -> f64,
    {
        let c = (a + b) / 2.0;
        let h = (b - a) / 6.0;
        let result = h * (f(a) + 4.0 * f(c) + f(b));
        (result, 3)
    }
    
    fn adaptive_helper<F>(
        f: &F,
        a: f64,
        b: f64,
        tol: f64,
        whole: f64,
        depth: usize,
        max_depth: usize,
        evaluations: &mut usize,
        total_error: &mut f64,
    ) -> f64
    where
        F: Fn(f64) -> f64,
    {
        let c = (a + b) / 2.0;
        let (left, _) = simpson_step(f, a, c);
        let (right, _) = simpson_step(f, c, b);
        *evaluations += 4; // 4 new evaluations (c, (a+c)/2, (c+b)/2, reuse endpoints)
        
        let delta = left + right - whole;
        
        if depth >= max_depth || delta.abs() < 15.0 * tol {
            *total_error += delta.abs() / 15.0;
            return left + right + delta / 15.0; // Richardson extrapolation
        }
        
        let tol_half = tol / 2.0;
        adaptive_helper(f, a, c, tol_half, left, depth + 1, max_depth, evaluations, total_error)
            + adaptive_helper(f, c, b, tol_half, right, depth + 1, max_depth, evaluations, total_error)
    }
    
    let (whole, evals) = simpson_step(&f, a, b);
    let mut evaluations = evals;
    
    let value = adaptive_helper(&f, a, b, tol, whole, 0, max_depth, &mut evaluations, &mut total_error);
    
    IntegrationResult {
        value,
        error_estimate: total_error,
        evaluations,
        converged: total_error < tol,
    }
}

/// Romberg integration using Richardson extrapolation
/// 
/// Achieves high accuracy by combining trapezoidal rule estimates.
pub fn romberg<F>(f: F, a: f64, b: f64, max_order: usize, tol: f64) -> IntegrationResult
where
    F: Fn(f64) -> f64,
{
    let mut r = vec![vec![0.0; max_order + 1]; max_order + 1];
    let mut evaluations = 0;
    
    // Trapezoidal rule with n=1
    r[0][0] = (b - a) * (f(a) + f(b)) / 2.0;
    evaluations += 2;
    
    let mut n = 1usize;
    
    for i in 1..=max_order {
        n *= 2;
        let h = (b - a) / n as f64;
        
        // Composite trapezoidal with 2^i intervals
        let mut sum = 0.0;
        for j in 1..n {
            if j % 2 == 1 {
                sum += f(a + j as f64 * h);
                evaluations += 1;
            }
        }
        r[i][0] = r[i - 1][0] / 2.0 + h * sum;
        
        // Richardson extrapolation
        for k in 1..=i {
            let factor = (4.0_f64).powi(k as i32);
            r[i][k] = (factor * r[i][k - 1] - r[i - 1][k - 1]) / (factor - 1.0);
        }
        
        // Check convergence
        if i > 1 {
            let error = (r[i][i] - r[i - 1][i - 1]).abs();
            if error < tol {
                return IntegrationResult {
                    value: r[i][i],
                    error_estimate: error,
                    evaluations,
                    converged: true,
                };
            }
        }
    }
    
    let error = (r[max_order][max_order] - r[max_order - 1][max_order - 1]).abs();
    IntegrationResult {
        value: r[max_order][max_order],
        error_estimate: error,
        evaluations,
        converged: error < tol,
    }
}

/// Clenshaw-Curtis quadrature using Chebyshev points
/// 
/// Excellent for smooth periodic functions.
pub fn clenshaw_curtis<F>(f: F, a: f64, b: f64, n: usize) -> f64
where
    F: Fn(f64) -> f64,
{
    if n == 0 {
        return (b - a) * f((a + b) / 2.0);
    }
    
    let half_len = (b - a) / 2.0;
    let mid = (a + b) / 2.0;
    
    // Chebyshev-Gauss-Lobatto points: x_k = cos(k*π/n) for k = 0..n
    // These are the extrema of T_n(x)
    let mut fx = vec![0.0; n + 1];
    for k in 0..=n {
        let theta = PI * k as f64 / n as f64;
        let x = mid + half_len * theta.cos();
        fx[k] = f(x);
    }
    
    // Compute Chebyshev coefficients using DCT-I
    // c_j = (2/n) * Σ'' f_k * cos(jkπ/n)
    // where '' means first and last terms are halved
    let mut c = vec![0.0; n + 1];
    for j in 0..=n {
        let mut sum = 0.0;
        for k in 0..=n {
            let weight = if k == 0 || k == n { 0.5 } else { 1.0 };
            sum += weight * fx[k] * (PI * j as f64 * k as f64 / n as f64).cos();
        }
        c[j] = 2.0 * sum / n as f64;
    }
    // First and last coefficients need halving
    c[0] /= 2.0;
    c[n] /= 2.0;
    
    // Integrate: ∫_{-1}^{1} f(x)dx ≈ Σ c_j * ∫_{-1}^{1} T_j(x)dx
    // ∫_{-1}^{1} T_0(x)dx = 2
    // ∫_{-1}^{1} T_j(x)dx = 0 for odd j
    // ∫_{-1}^{1} T_j(x)dx = 2/(1-j²) for even j > 0
    let mut integral = 2.0 * c[0];  // T_0 contribution
    for j in (2..=n).step_by(2) {
        integral += 2.0 * c[j] / (1.0 - (j * j) as f64);
    }
    
    // Scale by half-length for the linear transformation [a,b] -> [-1,1]
    half_len * integral
}

/// Gauss-Kronrod G7-K15 adaptive quadrature
/// 
/// Industry standard adaptive integration with error estimation.
/// Uses 7-point Gauss rule embedded in 15-point Kronrod rule.
/// 
/// # Arguments
/// * `f` - Function to integrate
/// * `a` - Lower bound
/// * `b` - Upper bound  
/// * `tol` - Absolute error tolerance
/// * `max_depth` - Maximum recursion depth
/// 
/// # Returns
/// `(integral, error_estimate)`
pub fn gauss_kronrod<F>(f: F, a: f64, b: f64, tol: f64, max_depth: usize) -> (f64, f64)
where
    F: Fn(f64) -> f64,
{
    // G7-K15 nodes (in [0,1])
    let xgk: [f64; 8] = [
        0.991455371120813,
        0.949107912342759,
        0.864864423359769,
        0.741531185599394,
        0.586087235467691,
        0.405845151377397,
        0.207784955007898,
        0.0,
    ];
    
    // Weights for 15-point Kronrod rule
    let wgk: [f64; 8] = [
        0.022935322010529,
        0.063092092629979,
        0.104790010322250,
        0.140653259715525,
        0.169004726639267,
        0.190350578064785,
        0.204432940075298,
        0.209482141084728,
    ];
    
    // Weights for 7-point Gauss rule (at odd indices of Kronrod)
    let wg: [f64; 4] = [
        0.129484966168870,
        0.279705391489277,
        0.381830050505119,
        0.417959183673469,
    ];
    
    gauss_kronrod_recursive(&f, a, b, tol, max_depth, &xgk, &wgk, &wg)
}

fn gauss_kronrod_recursive<F>(
    f: &F, a: f64, b: f64, tol: f64, depth: usize,
    xgk: &[f64; 8], wgk: &[f64; 8], wg: &[f64; 4]
) -> (f64, f64)
where
    F: Fn(f64) -> f64,
{
    let center = 0.5 * (a + b);
    let half_length = 0.5 * (b - a);
    
    // Evaluate at center
    let f_center = f(center);
    
    // 15-point Kronrod and 7-point Gauss sums
    let mut result_kronrod = f_center * wgk[7];
    let mut result_gauss = f_center * wg[3];
    
    // Symmetric evaluation
    for i in 0..7 {
        let abscissa = half_length * xgk[i];
        let fval1 = f(center - abscissa);
        let fval2 = f(center + abscissa);
        let fsum = fval1 + fval2;
        
        result_kronrod += wgk[i] * fsum;
        
        // Add to Gauss sum (only odd indices: 1, 3, 5 -> i=1,3,5)
        if i % 2 == 1 {
            result_gauss += wg[i / 2] * fsum;
        }
    }
    
    result_kronrod *= half_length;
    result_gauss *= half_length;
    
    let error = (result_kronrod - result_gauss).abs();
    
    // If converged or max depth reached, return
    if error < tol || depth == 0 {
        return (result_kronrod, error);
    }
    
    // Subdivide
    let mid = center;
    let (left_int, left_err) = gauss_kronrod_recursive(f, a, mid, tol / 2.0, depth - 1, xgk, wgk, wg);
    let (right_int, right_err) = gauss_kronrod_recursive(f, mid, b, tol / 2.0, depth - 1, xgk, wgk, wg);
    
    (left_int + right_int, left_err + right_err)
}

// ============================================================================
