//! Advanced Numerical Methods Module
//!
//! Production-grade numerical algorithms for structural analysis:
//! - Root finding (Newton-Raphson, Brent, Bisection, Secant, Ridders)
//! - Numerical integration (Gauss-Legendre, Gauss-Lobatto, adaptive Simpson)
//! - Numerical differentiation (central, Richardson extrapolation)
//! - Polynomial operations (Horner, Chebyshev, Lagrange interpolation)
//! - Optimization (Golden section, Brent's method, gradient descent)
//!
//! Matches capabilities of MATLAB, NumPy/SciPy, and Mathematica

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::numerics::RootResult;
pub use crate::advanced_numerical_roots::*;
pub use crate::advanced_numerical_integration::*;
pub use crate::advanced_numerical_differentiation::*;
pub use crate::advanced_numerical_polynomials::*;
pub use crate::advanced_numerical_optimization::*;
pub use crate::advanced_numerical_ode::*;

// Re-exports enable facades and modular organization by domain.

/// Newton-Raphson method for finding roots
/// 
/// Uses f(x) and f'(x) for quadratic convergence.
/// Best for smooth functions with good initial guess.
/// 
/// # Arguments
/// * `f` - Function to find root of
/// * `df` - Derivative of function
/// * `x0` - Initial guess
/// * `tol` - Convergence tolerance
/// * `max_iter` - Maximum iterations
pub fn newton_raphson<F, DF>(f: F, df: DF, x0: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
    DF: Fn(f64) -> f64,
{
    let mut x = x0;
    let mut converged = false;
    let mut iterations = 0;
    let mut fx = f(x);
    let mut error = f64::MAX;
    
    for i in 0..max_iter {
        iterations = i + 1;
        let dfx = df(x);
        
        // Avoid division by zero
        if dfx.abs() < 1e-15 {
            break;
        }
        
        let x_new = x - fx / dfx;
        error = (x_new - x).abs();
        
        x = x_new;
        fx = f(x);
        
        if error < tol && fx.abs() < tol {
            converged = true;
            break;
        }
    }
    
    RootResult {
        root: x,
        converged,
        iterations,
        function_value: fx,
        error_estimate: error,
    }
}

/// Newton-Raphson with numerical derivative
pub fn newton_raphson_numerical<F>(f: F, x0: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let df = |x: f64| {
        let h = 1e-8 * (1.0 + x.abs());
        (f(x + h) - f(x - h)) / (2.0 * h)
    };
    newton_raphson(&f, df, x0, tol, max_iter)
}

/// Newton-Raphson with backtracking line search
/// 
/// More robust than standard Newton-Raphson; uses Armijo backtracking
/// to ensure sufficient decrease in |f(x)|, preventing divergence.
/// 
/// # Arguments
/// * `f` - Function to find root of
/// * `df` - Derivative of f
/// * `x0` - Initial guess
/// * `tol` - Tolerance for convergence
/// * `max_iter` - Maximum iterations
/// 
/// # Returns
/// `RootResult` with root and convergence info
pub fn newton_raphson_linesearch<F, DF>(f: F, df: DF, x0: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
    DF: Fn(f64) -> f64,
{
    let mut x = x0;
    let mut converged = false;
    let mut iterations = 0;
    let mut fx = f(x);
    let mut error = f64::MAX;
    
    // Armijo parameters
    const C: f64 = 1e-4;      // Sufficient decrease parameter
    const RHO: f64 = 0.5;     // Backtracking factor
    const ALPHA_MIN: f64 = 1e-10;  // Minimum step size
    
    for i in 0..max_iter {
        iterations = i + 1;
        let dfx = df(x);
        
        // Avoid division by zero
        if dfx.abs() < 1e-15 {
            break;
        }
        
        // Newton direction
        let p = -fx / dfx;
        
        // Backtracking line search (Armijo condition)
        let mut alpha = 1.0;
        let fx_abs = fx.abs();
        
        loop {
            let x_new = x + alpha * p;
            let fx_new = f(x_new);
            
            // Armijo condition: |f(x + αp)| ≤ |f(x)| - c*α*|f(x)|
            // Simplified for root finding to: |f(x_new)| ≤ |f(x)| * (1 - c*α)
            if fx_new.abs() <= fx_abs * (1.0 - C * alpha) || alpha < ALPHA_MIN {
                x = x_new;
                error = (alpha * p).abs();
                fx = fx_new;
                break;
            }
            
            alpha *= RHO;
        }
        
        if error < tol && fx.abs() < tol {
            converged = true;
            break;
        }
    }
    
    RootResult {
        root: x,
        converged,
        iterations,
        function_value: fx,
        error_estimate: error,
    }
}

/// Bisection method - guaranteed convergence for bracketed roots
/// 
/// Robust but slower (linear convergence).
/// Requires initial bracket [a, b] where f(a) and f(b) have opposite signs.
pub fn bisection<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let mut fa = f(a);
    let fb = f(b);
    
    // Check bracket validity
    if fa * fb > 0.0 {
        return RootResult {
            root: f64::NAN,
            converged: false,
            iterations: 0,
            function_value: f64::NAN,
            error_estimate: f64::MAX,
        };
    }
    
    let mut iterations = 0;
    let mut c = a;
    let mut fc = fa;
    
    for i in 0..max_iter {
        iterations = i + 1;
        c = (a + b) / 2.0;
        fc = f(c);
        
        if fc.abs() < tol || (b - a) / 2.0 < tol {
            return RootResult {
                root: c,
                converged: true,
                iterations,
                function_value: fc,
                error_estimate: (b - a) / 2.0,
            };
        }
        
        if fc * fa < 0.0 {
            b = c;
            let _ = fc;
        } else {
            a = c;
            fa = fc;
        }
    }
    
    RootResult {
        root: c,
        converged: false,
        iterations,
        function_value: fc,
        error_estimate: (b - a) / 2.0,
    }
}

/// Secant method - Newton-like without requiring derivative
/// 
/// Superlinear convergence (order ~1.618).
/// Needs two initial points.
pub fn secant<F>(f: F, x0: f64, x1: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let mut x_prev = x0;
    let mut x_curr = x1;
    let mut f_prev = f(x_prev);
    let mut f_curr = f(x_curr);
    let mut iterations = 0;
    let mut error = f64::MAX;
    
    for i in 0..max_iter {
        iterations = i + 1;
        
        let denom = f_curr - f_prev;
        if denom.abs() < 1e-15 {
            break;
        }
        
        let x_new = x_curr - f_curr * (x_curr - x_prev) / denom;
        error = (x_new - x_curr).abs();
        
        x_prev = x_curr;
        f_prev = f_curr;
        x_curr = x_new;
        f_curr = f(x_curr);
        
        if error < tol && f_curr.abs() < tol {
            return RootResult {
                root: x_curr,
                converged: true,
                iterations,
                function_value: f_curr,
                error_estimate: error,
            };
        }
    }
    
    RootResult {
        root: x_curr,
        converged: false,
        iterations,
        function_value: f_curr,
        error_estimate: error,
    }
}

/// Brent's method - combines bisection, secant, and inverse quadratic interpolation
/// 
/// Guaranteed convergence with superlinear speed.
/// Industry standard for robust root finding.
pub fn brent<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let mut fa = f(a);
    let mut fb = f(b);
    
    // Check that root is bracketed (f(a) and f(b) have opposite signs)
    if fa * fb > 0.0 {
        return RootResult {
            root: f64::NAN,
            converged: false,
            iterations: 0,
            function_value: f64::NAN,
            error_estimate: f64::INFINITY,
        };
    }
    
    // c is the previous best guess (contrapoint)
    let mut c = a;
    let mut fc = fa;
    let mut d = b - a;
    let mut e = d;
    let mut iterations = 0;
    
    for i in 0..max_iter {
        iterations = i + 1;
        
        // If |f(c)| < |f(b)|, swap b and c so b is best guess
        if fc.abs() < fb.abs() {
            a = b;
            b = c;
            c = a;
            fa = fb;
            fb = fc;
            fc = fa;
        }
        
        let tol1 = 2.0 * f64::EPSILON * b.abs() + 0.5 * tol;
        let xm = 0.5 * (c - b);
        
        // Convergence check
        if xm.abs() <= tol1 || fb.abs() < 1e-15 {
            return RootResult {
                root: b,
                converged: true,
                iterations,
                function_value: fb,
                error_estimate: xm.abs(),
            };
        }
        
        // Try inverse quadratic interpolation or secant
        let mut use_bisection = true;
        
        if e.abs() >= tol1 && fa.abs() > fb.abs() {
            let s: f64;
            if (a - c).abs() < 1e-15 {
                // Secant step
                s = fb / fa;
                let p = 2.0 * xm * s;
                let q = 1.0 - s;
                if p.abs() < (0.5 * q * e).abs() && p.abs() < (3.0 * xm * q - (tol1 * q).abs()).abs() {
                    e = d;
                    d = p / q;
                    use_bisection = false;
                }
            } else {
                // Inverse quadratic interpolation
                let q = fa / fc;
                let r = fb / fc;
                let s = fb / fa;
                let p = s * (2.0 * xm * q * (q - r) - (b - a) * (r - 1.0));
                let q = (q - 1.0) * (r - 1.0) * (s - 1.0);
                
                if p.abs() < (0.5 * q * e).abs() {
                    e = d;
                    d = p / q;
                    use_bisection = false;
                }
            }
        }
        
        if use_bisection {
            d = xm;
            e = d;
        }
        
        a = b;
        fa = fb;
        
        if d.abs() > tol1 {
            b += d;
        } else {
            b += if xm >= 0.0 { tol1 } else { -tol1 };
        }
        
        fb = f(b);
        
        if (fb > 0.0 && fc > 0.0) || (fb < 0.0 && fc < 0.0) {
            c = a;
            fc = fa;
            e = b - a;
            d = e;
        }
    }
    
    RootResult {
        root: b,
        converged: false,
        iterations,
        function_value: fb,
        error_estimate: (c - b).abs(),
    }
}

/// Ridders' method - higher order bracketing method
/// 
/// Quadratic convergence for bracketed roots.
/// More accurate than bisection, simpler than Brent.
pub fn ridders<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let mut fa = f(a);
    let mut fb = f(b);
    let mut iterations = 0;
    
    if fa * fb > 0.0 {
        return RootResult {
            root: f64::NAN,
            converged: false,
            iterations: 0,
            function_value: f64::NAN,
            error_estimate: f64::MAX,
        };
    }
    
    let mut x_old = f64::MAX;
    
    for i in 0..max_iter {
        iterations = i + 1;
        
        let c = 0.5 * (a + b);
        let fc = f(c);
        
        let s = (fc * fc - fa * fb).sqrt();
        if s.abs() < 1e-15 {
            return RootResult {
                root: c,
                converged: true,
                iterations,
                function_value: fc,
                error_estimate: (b - a) / 2.0,
            };
        }
        
        let sign = if fa - fb < 0.0 { -1.0 } else { 1.0 };
        let x_new = c + (c - a) * sign * fc / s;
        let fx_new = f(x_new);
        
        if (x_new - x_old).abs() < tol {
            return RootResult {
                root: x_new,
                converged: true,
                iterations,
                function_value: fx_new,
                error_estimate: (x_new - x_old).abs(),
            };
        }
        
        x_old = x_new;
        
        // Update bracket
        if fc * fx_new < 0.0 {
            a = c;
            fa = fc;
            b = x_new;
            fb = fx_new;
        } else if fa * fx_new < 0.0 {
            b = x_new;
            fb = fx_new;
        } else {
            a = x_new;
            fa = fx_new;
        }
        
        if (b - a).abs() < tol {
            return RootResult {
                root: 0.5 * (a + b),
                converged: true,
                iterations,
                function_value: f(0.5 * (a + b)),
                error_estimate: (b - a) / 2.0,
            };
        }
    }
    
    RootResult {
        root: 0.5 * (a + b),
        converged: false,
        iterations,
        function_value: f(0.5 * (a + b)),
        error_estimate: (b - a) / 2.0,
    }
}

/// Illinois method - modified regula falsi with faster convergence
pub fn illinois<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> RootResult
where
    F: Fn(f64) -> f64,
{
    let mut fa = f(a);
    let mut fb = f(b);
    let mut iterations = 0;
    let mut side = 0i32; // Track which side was updated last
    
    if fa * fb > 0.0 {
        return RootResult {
            root: f64::NAN,
            converged: false,
            iterations: 0,
            function_value: f64::NAN,
            error_estimate: f64::MAX,
        };
    }
    
    for i in 0..max_iter {
        iterations = i + 1;
        
        let c = (a * fb - b * fa) / (fb - fa);
        let fc = f(c);
        
        if fc.abs() < tol || (b - a).abs() < tol {
            return RootResult {
                root: c,
                converged: true,
                iterations,
                function_value: fc,
                error_estimate: (b - a).abs(),
            };
        }
        
        if fc * fb < 0.0 {
            a = b;
            fa = fb;
            side = -1;
        } else {
            if side == 1 {
                fa *= 0.5; // Illinois modification
            }
            side = 1;
        }
        
        b = c;
        fb = fc;
    }
    
    RootResult {
        root: b,
        converged: false,
        iterations,
        function_value: fb,
        error_estimate: (b - a).abs(),
    }
}

// ============================================================================
// NUMERICAL INTEGRATION (QUADRATURE)
// ============================================================================

/// Result of numerical integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationResult {
    pub value: f64,
    pub error_estimate: f64,
    pub evaluations: usize,
    pub converged: bool,
}

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
// NUMERICAL DIFFERENTIATION
// ============================================================================

/// Central difference derivative
pub fn central_difference<F>(f: F, x: f64, h: f64) -> f64
where
    F: Fn(f64) -> f64,
{
    (f(x + h) - f(x - h)) / (2.0 * h)
}

/// Second derivative using central difference
pub fn central_difference_2nd<F>(f: F, x: f64, h: f64) -> f64
where
    F: Fn(f64) -> f64,
{
    (f(x + h) - 2.0 * f(x) + f(x - h)) / (h * h)
}

/// Richardson extrapolation for high-accuracy derivatives
/// 
/// Achieves O(h^(2*order)) accuracy.
pub fn richardson_derivative<F>(f: F, x: f64, h: f64, order: usize) -> f64
where
    F: Fn(f64) -> f64,
{
    let mut d = vec![vec![0.0; order + 1]; order + 1];
    
    let mut hi = h;
    for i in 0..=order {
        d[i][0] = central_difference(&f, x, hi);
        hi /= 2.0;
    }
    
    for k in 1..=order {
        let factor = (4.0_f64).powi(k as i32);
        for i in k..=order {
            d[i][k] = (factor * d[i][k - 1] - d[i - 1][k - 1]) / (factor - 1.0);
        }
    }
    
    d[order][order]
}

/// Gradient of multivariate function using central differences
pub fn gradient<F>(f: F, x: &[f64], h: f64) -> Vec<f64>
where
    F: Fn(&[f64]) -> f64,
{
    let n = x.len();
    let mut grad = vec![0.0; n];
    let mut x_plus = x.to_vec();
    let mut x_minus = x.to_vec();
    
    for i in 0..n {
        x_plus[i] = x[i] + h;
        x_minus[i] = x[i] - h;
        
        grad[i] = (f(&x_plus) - f(&x_minus)) / (2.0 * h);
        
        x_plus[i] = x[i];
        x_minus[i] = x[i];
    }
    
    grad
}

/// Hessian matrix of multivariate function
pub fn hessian<F>(f: F, x: &[f64], h: f64) -> Vec<Vec<f64>>
where
    F: Fn(&[f64]) -> f64,
{
    let n = x.len();
    let mut hess = vec![vec![0.0; n]; n];
    
    let f0 = f(x);
    let mut x_mod = x.to_vec();
    
    for i in 0..n {
        // Diagonal
        x_mod[i] = x[i] + h;
        let f_plus = f(&x_mod);
        x_mod[i] = x[i] - h;
        let f_minus = f(&x_mod);
        x_mod[i] = x[i];
        
        hess[i][i] = (f_plus - 2.0 * f0 + f_minus) / (h * h);
        
        // Off-diagonal (symmetric)
        for j in (i + 1)..n {
            x_mod[i] = x[i] + h;
            x_mod[j] = x[j] + h;
            let f_pp = f(&x_mod);
            
            x_mod[i] = x[i] + h;
            x_mod[j] = x[j] - h;
            let f_pm = f(&x_mod);
            
            x_mod[i] = x[i] - h;
            x_mod[j] = x[j] + h;
            let f_mp = f(&x_mod);
            
            x_mod[i] = x[i] - h;
            x_mod[j] = x[j] - h;
            let f_mm = f(&x_mod);
            
            x_mod[i] = x[i];
            x_mod[j] = x[j];
            
            let mixed = (f_pp - f_pm - f_mp + f_mm) / (4.0 * h * h);
            hess[i][j] = mixed;
            hess[j][i] = mixed;
        }
    }
    
    hess
}

/// Jacobian matrix of vector-valued function
pub fn jacobian<F>(f: F, x: &[f64], h: f64) -> Vec<Vec<f64>>
where
    F: Fn(&[f64]) -> Vec<f64>,
{
    let n = x.len();
    let f0 = f(x);
    let m = f0.len();
    
    let mut jac = vec![vec![0.0; n]; m];
    let mut x_plus = x.to_vec();
    let mut x_minus = x.to_vec();
    
    for j in 0..n {
        x_plus[j] = x[j] + h;
        x_minus[j] = x[j] - h;
        
        let f_plus = f(&x_plus);
        let f_minus = f(&x_minus);
        
        for i in 0..m {
            jac[i][j] = (f_plus[i] - f_minus[i]) / (2.0 * h);
        }
        
        x_plus[j] = x[j];
        x_minus[j] = x[j];
    }
    
    jac
}

// ============================================================================
// POLYNOMIAL OPERATIONS
// ============================================================================

/// Evaluate polynomial using Horner's method
/// 
/// coeffs = [a0, a1, a2, ..., an] for p(x) = a0 + a1*x + a2*x^2 + ... + an*x^n
pub fn horner_eval(coeffs: &[f64], x: f64) -> f64 {
    if coeffs.is_empty() {
        return 0.0;
    }
    
    let mut result = coeffs[coeffs.len() - 1];
    for i in (0..coeffs.len() - 1).rev() {
        result = result * x + coeffs[i];
    }
    result
}

/// Evaluate polynomial and its derivative using Horner's method
pub fn horner_eval_deriv(coeffs: &[f64], x: f64) -> (f64, f64) {
    if coeffs.is_empty() {
        return (0.0, 0.0);
    }
    
    let n = coeffs.len();
    let mut p = coeffs[n - 1];
    let mut dp = 0.0;
    
    for i in (0..n - 1).rev() {
        dp = dp * x + p;
        p = p * x + coeffs[i];
    }
    
    (p, dp)
}

/// Chebyshev polynomial T_n(x) evaluation
pub fn chebyshev_t(n: usize, x: f64) -> f64 {
    if n == 0 {
        return 1.0;
    }
    if n == 1 {
        return x;
    }
    
    let mut t_prev = 1.0;
    let mut t_curr = x;
    
    for _ in 2..=n {
        let t_next = 2.0 * x * t_curr - t_prev;
        t_prev = t_curr;
        t_curr = t_next;
    }
    
    t_curr
}

/// Chebyshev polynomial of second kind U_n(x)
pub fn chebyshev_u(n: usize, x: f64) -> f64 {
    if n == 0 {
        return 1.0;
    }
    if n == 1 {
        return 2.0 * x;
    }
    
    let mut u_prev = 1.0;
    let mut u_curr = 2.0 * x;
    
    for _ in 2..=n {
        let u_next = 2.0 * x * u_curr - u_prev;
        u_prev = u_curr;
        u_curr = u_next;
    }
    
    u_curr
}

/// Lagrange interpolation
pub fn lagrange_interpolate(points: &[(f64, f64)], x: f64) -> f64 {
    let n = points.len();
    let mut result = 0.0;
    
    for i in 0..n {
        let mut li = 1.0;
        for j in 0..n {
            if i != j {
                li *= (x - points[j].0) / (points[i].0 - points[j].0);
            }
        }
        result += points[i].1 * li;
    }
    
    result
}

/// Barycentric Lagrange interpolation (numerically stable)
pub fn barycentric_interpolate(x_nodes: &[f64], y_values: &[f64], x: f64) -> f64 {
    let n = x_nodes.len();
    assert_eq!(n, y_values.len());
    
    // Compute barycentric weights
    let mut weights = vec![1.0; n];
    for j in 0..n {
        for k in 0..n {
            if j != k {
                weights[j] /= x_nodes[j] - x_nodes[k];
            }
        }
    }
    
    // Check if x is a node
    for i in 0..n {
        if (x - x_nodes[i]).abs() < 1e-15 {
            return y_values[i];
        }
    }
    
    // Barycentric formula
    let mut num = 0.0;
    let mut den = 0.0;
    
    for j in 0..n {
        let temp = weights[j] / (x - x_nodes[j]);
        num += temp * y_values[j];
        den += temp;
    }
    
    num / den
}

/// Natural cubic spline interpolation
/// 
/// Constructs a cubic spline with second derivative = 0 at endpoints (natural boundary).
/// Returns spline coefficients that can be used with `cubic_spline_eval`.
/// 
/// # Arguments
/// * `x` - x coordinates (must be sorted in ascending order)
/// * `y` - y values at x coordinates
/// 
/// # Returns
/// Vector of (a, b, c, d) coefficients for each segment:
/// S_i(x) = a_i + b_i*(x-x_i) + c_i*(x-x_i)^2 + d_i*(x-x_i)^3
pub fn cubic_spline_coefficients(x: &[f64], y: &[f64]) -> Vec<(f64, f64, f64, f64)> {
    let n = x.len();
    assert!(n >= 2, "Need at least 2 points for spline");
    assert_eq!(n, y.len());
    
    if n == 2 {
        // Linear interpolation for 2 points
        let slope = (y[1] - y[0]) / (x[1] - x[0]);
        return vec![(y[0], slope, 0.0, 0.0)];
    }
    
    let m = n - 1;  // Number of segments
    
    // Compute h_i = x_{i+1} - x_i
    let h: Vec<f64> = (0..m).map(|i| x[i + 1] - x[i]).collect();
    
    // Set up tridiagonal system for c coefficients (second derivatives / 2)
    // Natural spline: c[0] = c[n-1] = 0
    let mut c = vec![0.0; n];
    
    // Build tridiagonal system: only n-2 interior unknowns
    if n > 2 {
        let interior = n - 2;
        let mut diag = vec![0.0; interior];
        let mut upper = vec![0.0; interior - 1];
        let mut lower = vec![0.0; interior - 1];
        let mut rhs = vec![0.0; interior];
        
        for i in 0..interior {
            let idx = i + 1;  // Index in original arrays
            diag[i] = 2.0 * (h[idx - 1] + h[idx]);
            rhs[i] = 3.0 * ((y[idx + 1] - y[idx]) / h[idx] - (y[idx] - y[idx - 1]) / h[idx - 1]);
            
            if i < interior - 1 {
                upper[i] = h[idx];
                lower[i] = h[idx];
            }
        }
        
        // Solve tridiagonal system (Thomas algorithm)
        let mut c_prime = vec![0.0; interior];
        let mut d_prime = vec![0.0; interior];
        
        c_prime[0] = if interior > 1 { upper[0] / diag[0] } else { 0.0 };
        d_prime[0] = rhs[0] / diag[0];
        
        for i in 1..interior {
            let denom = diag[i] - lower[i - 1] * c_prime[i - 1];
            if i < interior - 1 {
                c_prime[i] = upper[i] / denom;
            }
            d_prime[i] = (rhs[i] - lower[i - 1] * d_prime[i - 1]) / denom;
        }
        
        // Back substitution
        c[n - 2] = d_prime[interior - 1];
        for i in (0..interior - 1).rev() {
            c[i + 1] = d_prime[i] - c_prime[i] * c[i + 2];
        }
    }
    
    // Compute a, b, d coefficients for each segment
    let mut coeffs = Vec::with_capacity(m);
    for i in 0..m {
        let a = y[i];
        let b = (y[i + 1] - y[i]) / h[i] - h[i] * (2.0 * c[i] + c[i + 1]) / 3.0;
        let d = (c[i + 1] - c[i]) / (3.0 * h[i]);
        coeffs.push((a, b, c[i], d));
    }
    
    coeffs
}

/// Evaluate cubic spline at a point
/// 
/// # Arguments
/// * `x` - Original x coordinates
/// * `coeffs` - Spline coefficients from `cubic_spline_coefficients`
/// * `t` - Point to evaluate
pub fn cubic_spline_eval(x: &[f64], coeffs: &[(f64, f64, f64, f64)], t: f64) -> f64 {
    // Find the right interval
    let n = x.len();
    
    // Clamp to valid range
    if t <= x[0] {
        return coeffs[0].0;  // Return first y value
    }
    if t >= x[n - 1] {
        let last = coeffs.len() - 1;
        let dx = x[n - 1] - x[n - 2];
        let (a, b, c, d) = coeffs[last];
        return a + b * dx + c * dx * dx + d * dx * dx * dx;
    }
    
    // Binary search for interval
    let mut lo = 0;
    let mut hi = n - 1;
    while hi - lo > 1 {
        let mid = (lo + hi) / 2;
        if x[mid] > t {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    
    let dx = t - x[lo];
    let (a, b, c, d) = coeffs[lo];
    a + b * dx + c * dx * dx + d * dx * dx * dx
}

/// Divided differences for Newton interpolation
pub fn divided_differences(points: &[(f64, f64)]) -> Vec<f64> {
    let n = points.len();
    let mut dd = vec![0.0; n];
    
    // Initialize with y values
    for i in 0..n {
        dd[i] = points[i].1;
    }
    
    // Compute divided differences
    for j in 1..n {
        for i in (j..n).rev() {
            dd[i] = (dd[i] - dd[i - 1]) / (points[i].0 - points[i - j].0);
        }
    }
    
    dd
}

/// Newton interpolation using divided differences
pub fn newton_interpolate(points: &[(f64, f64)], x: f64) -> f64 {
    let dd = divided_differences(points);
    let n = points.len();
    
    let mut result = dd[n - 1];
    for i in (0..n - 1).rev() {
        result = result * (x - points[i].0) + dd[i];
    }
    
    result
}

// ============================================================================
// 1D OPTIMIZATION
// ============================================================================

/// Result of optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub x: f64,
    pub fx: f64,
    pub iterations: usize,
    pub converged: bool,
}

/// Golden section search for minimum
/// 
/// Finds minimum in [a, b] without requiring derivatives.
pub fn golden_section_min<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> OptimizationResult
where
    F: Fn(f64) -> f64,
{
    let phi = (1.0 + 5.0_f64.sqrt()) / 2.0;
    let resphi = 2.0 - phi;
    
    let mut x1 = a + resphi * (b - a);
    let mut x2 = b - resphi * (b - a);
    let mut f1 = f(x1);
    let mut f2 = f(x2);
    let mut iterations = 0;
    
    while (b - a).abs() > tol && iterations < max_iter {
        iterations += 1;
        
        if f1 < f2 {
            b = x2;
            x2 = x1;
            f2 = f1;
            x1 = a + resphi * (b - a);
            f1 = f(x1);
        } else {
            a = x1;
            x1 = x2;
            f1 = f2;
            x2 = b - resphi * (b - a);
            f2 = f(x2);
        }
    }
    
    let x = (a + b) / 2.0;
    OptimizationResult {
        x,
        fx: f(x),
        iterations,
        converged: (b - a).abs() <= tol,
    }
}

/// Brent's method for 1D minimization
/// 
/// Combines golden section with parabolic interpolation.
pub fn brent_minimize<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> OptimizationResult
where
    F: Fn(f64) -> f64,
{
    let golden = 0.381966011250105; // (3 - sqrt(5)) / 2
    
    let mut x = a + golden * (b - a);
    let mut w = x;
    let mut v = x;
    let mut fx = f(x);
    let mut fw = fx;
    let mut fv = fx;
    
    let mut d: f64 = 0.0;
    let mut e: f64 = 0.0;
    let mut iterations = 0;
    
    while iterations < max_iter {
        iterations += 1;
        
        let mid = 0.5 * (a + b);
        let tol1 = tol * x.abs() + 1e-10;
        let tol2 = 2.0 * tol1;
        
        // Check convergence
        if (x - mid).abs() <= tol2 - 0.5 * (b - a) {
            return OptimizationResult {
                x,
                fx,
                iterations,
                converged: true,
            };
        }
        
        let mut use_golden = true;
        
        // Try parabolic interpolation
        if e.abs() > tol1 {
            let r = (x - w) * (fx - fv);
            let mut q = (x - v) * (fx - fw);
            let mut p = (x - v) * q - (x - w) * r;
            q = 2.0 * (q - r);
            
            if q > 0.0 {
                p = -p;
            } else {
                q = -q;
            }
            
            let r = e;
            e = d;
            
            if p.abs() < (0.5 * q * r).abs() && p > q * (a - x) && p < q * (b - x) {
                d = p / q;
                let u = x + d;
                if (u - a) < tol2 || (b - u) < tol2 {
                    d = if mid >= x { tol1 } else { -tol1 };
                }
                use_golden = false;
            }
        }
        
        if use_golden {
            e = if x >= mid { a - x } else { b - x };
            d = golden * e;
        }
        
        let u = if d.abs() >= tol1 {
            x + d
        } else {
            x + if d >= 0.0 { tol1 } else { -tol1 }
        };
        
        let fu = f(u);
        
        if fu <= fx {
            if u >= x {
                a = x;
            } else {
                b = x;
            }
            v = w;
            fv = fw;
            w = x;
            fw = fx;
            x = u;
            fx = fu;
        } else {
            if u < x {
                a = u;
            } else {
                b = u;
            }
            
            if fu <= fw || (w - x).abs() < 1e-15 {
                v = w;
                fv = fw;
                w = u;
                fw = fu;
            } else if fu <= fv || (v - x).abs() < 1e-15 || (v - w).abs() < 1e-15 {
                v = u;
                fv = fu;
            }
        }
    }
    
    OptimizationResult {
        x,
        fx,
        iterations,
        converged: false,
    }
}

// ============================================================================
// MULTIDIMENSIONAL OPTIMIZATION
// ============================================================================

/// Gradient descent with line search
pub fn gradient_descent<F, G>(
    f: F,
    grad: G,
    x0: &[f64],
    tol: f64,
    max_iter: usize,
) -> (Vec<f64>, f64, usize, bool)
where
    F: Fn(&[f64]) -> f64,
    G: Fn(&[f64]) -> Vec<f64>,
{
    let _n = x0.len();
    let mut x = x0.to_vec();
    let mut fx = f(&x);
    
    for iter in 0..max_iter {
        let g = grad(&x);
        let gnorm: f64 = g.iter().map(|&gi| gi * gi).sum::<f64>().sqrt();
        
        if gnorm < tol {
            return (x, fx, iter, true);
        }
        
        // Backtracking line search
        let mut alpha = 1.0;
        let c = 1e-4;
        let rho = 0.5;
        
        loop {
            let x_new: Vec<f64> = x.iter().zip(g.iter()).map(|(&xi, &gi)| xi - alpha * gi).collect();
            let fx_new = f(&x_new);
            
            if fx_new <= fx - c * alpha * gnorm * gnorm {
                x = x_new;
                fx = fx_new;
                break;
            }
            
            alpha *= rho;
            if alpha < 1e-16 {
                break;
            }
        }
    }
    
    (x, fx, max_iter, false)
}

/// BFGS quasi-Newton optimization
pub fn bfgs<F, G>(
    f: F,
    grad: G,
    x0: &[f64],
    tol: f64,
    max_iter: usize,
) -> (Vec<f64>, f64, usize, bool)
where
    F: Fn(&[f64]) -> f64,
    G: Fn(&[f64]) -> Vec<f64>,
{
    let n = x0.len();
    let mut x = x0.to_vec();
    let mut fx = f(&x);
    let mut g = grad(&x);
    
    // Initial Hessian approximation (identity)
    let mut h = vec![vec![0.0; n]; n];
    for i in 0..n {
        h[i][i] = 1.0;
    }
    
    for iter in 0..max_iter {
        let gnorm: f64 = g.iter().map(|&gi| gi * gi).sum::<f64>().sqrt();
        
        if gnorm < tol {
            return (x, fx, iter, true);
        }
        
        // Search direction: p = -H * g
        let mut p = vec![0.0; n];
        for i in 0..n {
            for j in 0..n {
                p[i] -= h[i][j] * g[j];
            }
        }
        
        // Line search
        let mut alpha = 1.0;
        let c1 = 1e-4;
        let rho = 0.5;
        
        let x_new: Vec<f64>;
        let fx_new: f64;
        
        loop {
            let x_try: Vec<f64> = x.iter().zip(p.iter()).map(|(&xi, &pi)| xi + alpha * pi).collect();
            let fx_try = f(&x_try);
            
            let pg: f64 = p.iter().zip(g.iter()).map(|(pi, gi)| pi * gi).sum();
            
            if fx_try <= fx + c1 * alpha * pg {
                x_new = x_try;
                fx_new = fx_try;
                break;
            }
            
            alpha *= rho;
            if alpha < 1e-16 {
                return (x, fx, iter, false);
            }
        }
        
        let g_new = grad(&x_new);
        
        // BFGS update
        let s: Vec<f64> = x_new.iter().zip(x.iter()).map(|(xn, xo)| xn - xo).collect();
        let y: Vec<f64> = g_new.iter().zip(g.iter()).map(|(gn, go)| gn - go).collect();
        
        let ys: f64 = y.iter().zip(s.iter()).map(|(yi, si)| yi * si).sum();
        
        if ys.abs() > 1e-10 {
            // H_new = (I - rho*s*y') * H * (I - rho*y*s') + rho*s*s'
            let rho_bfgs = 1.0 / ys;
            
            // Compute H*y
            let mut hy = vec![0.0; n];
            for i in 0..n {
                for j in 0..n {
                    hy[i] += h[i][j] * y[j];
                }
            }
            
            // y'*H*y
            let yhy: f64 = y.iter().zip(hy.iter()).map(|(yi, hyi)| yi * hyi).sum();
            
            // Update H
            for i in 0..n {
                for j in 0..n {
                    h[i][j] = h[i][j]
                        - rho_bfgs * (s[i] * hy[j] + hy[i] * s[j])
                        + rho_bfgs * rho_bfgs * yhy * s[i] * s[j]
                        + rho_bfgs * s[i] * s[j];
                }
            }
        }
        
        x = x_new;
        fx = fx_new;
        g = g_new;
    }
    
    (x, fx, max_iter, false)
}

// ============================================================================
// ODE SOLVERS
// ============================================================================

/// Result of ODE integration
#[derive(Debug, Clone)]
pub struct OdeResult {
    /// Time points
    pub t: Vec<f64>,
    /// Solution values at each time point (vector for systems)
    pub y: Vec<Vec<f64>>,
    /// Number of function evaluations
    pub evaluations: usize,
    /// Number of rejected steps (for adaptive methods)
    pub rejected_steps: usize,
}

/// Classical 4th-order Runge-Kutta (RK4) with fixed step
/// 
/// Solves dy/dt = f(t, y) from t0 to tf.
/// 
/// # Arguments
/// * `f` - The ODE function f(t, y) -> dy/dt
/// * `y0` - Initial condition (vector for systems)
/// * `t0` - Initial time
/// * `tf` - Final time  
/// * `n_steps` - Number of steps
/// 
/// # Returns
/// `OdeResult` with time points and solution values
pub fn rk4<F>(f: F, y0: &[f64], t0: f64, tf: f64, n_steps: usize) -> OdeResult
where
    F: Fn(f64, &[f64]) -> Vec<f64>,
{
    let n = y0.len();
    let n_steps = if n_steps == 0 { 1 } else { n_steps };
    let h = (tf - t0) / n_steps as f64;
    
    let mut t_out = Vec::with_capacity(n_steps + 1);
    let mut y_out = Vec::with_capacity(n_steps + 1);
    
    let mut t = t0;
    let mut y = y0.to_vec();
    
    t_out.push(t);
    y_out.push(y.clone());
    
    let mut evaluations = 0;
    
    for _ in 0..n_steps {
        let k1 = f(t, &y);
        evaluations += 1;
        
        let y_temp: Vec<f64> = y.iter().zip(k1.iter())
            .map(|(&yi, &k1i)| yi + 0.5 * h * k1i).collect();
        let k2 = f(t + 0.5 * h, &y_temp);
        evaluations += 1;
        
        let y_temp: Vec<f64> = y.iter().zip(k2.iter())
            .map(|(&yi, &k2i)| yi + 0.5 * h * k2i).collect();
        let k3 = f(t + 0.5 * h, &y_temp);
        evaluations += 1;
        
        let y_temp: Vec<f64> = y.iter().zip(k3.iter())
            .map(|(&yi, &k3i)| yi + h * k3i).collect();
        let k4 = f(t + h, &y_temp);
        evaluations += 1;
        
        // Update y
        for i in 0..n {
            y[i] += h * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]) / 6.0;
        }
        t += h;
        
        t_out.push(t);
        y_out.push(y.clone());
    }
    
    OdeResult {
        t: t_out,
        y: y_out,
        evaluations,
        rejected_steps: 0,
    }
}

/// Dormand-Prince RK45 adaptive ODE solver
/// 
/// Industry-standard adaptive 5th order method with 4th order error estimate.
/// Automatically adjusts step size to meet error tolerance.
/// 
/// # Arguments
/// * `f` - The ODE function f(t, y) -> dy/dt
/// * `y0` - Initial condition
/// * `t0` - Initial time
/// * `tf` - Final time
/// * `rtol` - Relative tolerance
/// * `atol` - Absolute tolerance
/// 
/// # Returns
/// `OdeResult` with solution at adaptive time points
pub fn rk45<F>(f: F, y0: &[f64], t0: f64, tf: f64, rtol: f64, atol: f64) -> OdeResult
where
    F: Fn(f64, &[f64]) -> Vec<f64>,
{
    let n = y0.len();
    
    // Dormand-Prince coefficients
    let a21 = 1.0 / 5.0;
    let a31 = 3.0 / 40.0;
    let a32 = 9.0 / 40.0;
    let a41 = 44.0 / 45.0;
    let a42 = -56.0 / 15.0;
    let a43 = 32.0 / 9.0;
    let a51 = 19372.0 / 6561.0;
    let a52 = -25360.0 / 2187.0;
    let a53 = 64448.0 / 6561.0;
    let a54 = -212.0 / 729.0;
    let a61 = 9017.0 / 3168.0;
    let a62 = -355.0 / 33.0;
    let a63 = 46732.0 / 5247.0;
    let a64 = 49.0 / 176.0;
    let a65 = -5103.0 / 18656.0;
    let a71 = 35.0 / 384.0;
    let a73 = 500.0 / 1113.0;
    let a74 = 125.0 / 192.0;
    let a75 = -2187.0 / 6784.0;
    let a76 = 11.0 / 84.0;
    
    // 5th order weights (used for solution)
    let b1 = 35.0 / 384.0;
    let b3 = 500.0 / 1113.0;
    let b4 = 125.0 / 192.0;
    let b5 = -2187.0 / 6784.0;
    let b6 = 11.0 / 84.0;
    
    // Error coefficients (difference between 4th and 5th order)
    let e1 = 71.0 / 57600.0;
    let e3 = -71.0 / 16695.0;
    let e4 = 71.0 / 1920.0;
    let e5 = -17253.0 / 339200.0;
    let e6 = 22.0 / 525.0;
    let e7 = -1.0 / 40.0;
    
    let mut t_out = vec![t0];
    let mut y_out = vec![y0.to_vec()];
    
    let mut t = t0;
    let mut y = y0.to_vec();
    
    // Initial step size estimate
    let mut h = 0.001 * (tf - t0);
    let h_min = 1e-12 * (tf - t0);
    let h_max = 0.1 * (tf - t0);
    
    let mut evaluations = 0;
    let mut rejected_steps = 0;
    
    while t < tf {
        // Don't overshoot
        if t + h > tf {
            h = tf - t;
        }
        
        // Compute stages
        let k1 = f(t, &y);
        evaluations += 1;
        
        let y2: Vec<f64> = y.iter().zip(k1.iter())
            .map(|(&yi, &k1i)| yi + h * a21 * k1i).collect();
        let k2 = f(t + h / 5.0, &y2);
        evaluations += 1;
        
        let y3: Vec<f64> = (0..n).map(|i| y[i] + h * (a31 * k1[i] + a32 * k2[i])).collect();
        let k3 = f(t + 3.0 * h / 10.0, &y3);
        evaluations += 1;
        
        let y4: Vec<f64> = (0..n).map(|i| y[i] + h * (a41 * k1[i] + a42 * k2[i] + a43 * k3[i])).collect();
        let k4 = f(t + 4.0 * h / 5.0, &y4);
        evaluations += 1;
        
        let y5: Vec<f64> = (0..n).map(|i| y[i] + h * (a51 * k1[i] + a52 * k2[i] + a53 * k3[i] + a54 * k4[i])).collect();
        let k5 = f(t + 8.0 * h / 9.0, &y5);
        evaluations += 1;
        
        let y6: Vec<f64> = (0..n).map(|i| y[i] + h * (a61 * k1[i] + a62 * k2[i] + a63 * k3[i] + a64 * k4[i] + a65 * k5[i])).collect();
        let k6 = f(t + h, &y6);
        evaluations += 1;
        
        let y7: Vec<f64> = (0..n).map(|i| y[i] + h * (a71 * k1[i] + a73 * k3[i] + a74 * k4[i] + a75 * k5[i] + a76 * k6[i])).collect();
        let k7 = f(t + h, &y7);
        evaluations += 1;
        
        // 5th order solution
        let y_new: Vec<f64> = (0..n).map(|i| {
            y[i] + h * (b1 * k1[i] + b3 * k3[i] + b4 * k4[i] + b5 * k5[i] + b6 * k6[i])
        }).collect();
        
        // Error estimate
        let err: f64 = (0..n).map(|i| {
            let ei = h * (e1 * k1[i] + e3 * k3[i] + e4 * k4[i] + e5 * k5[i] + e6 * k6[i] + e7 * k7[i]);
            let scale = atol + rtol * y_new[i].abs().max(y[i].abs());
            (ei / scale).powi(2)
        }).sum::<f64>().sqrt() / (n as f64).sqrt();
        
        if err <= 1.0 {
            // Accept step
            t += h;
            y = y_new;
            t_out.push(t);
            y_out.push(y.clone());
        } else {
            rejected_steps += 1;
        }
        
        // Step size adjustment (PI controller)
        let factor = if err > 0.0 {
            0.9 * (1.0 / err).powf(0.2)
        } else {
            5.0
        };
        h *= factor.clamp(0.2, 5.0);
        h = h.clamp(h_min, h_max);
        
        // Safety check
        if t + h == t {
            break;  // Step too small
        }
    }
    
    OdeResult {
        t: t_out,
        y: y_out,
        evaluations,
        rejected_steps,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_newton_raphson() {
        // Find root of x^2 - 2 = 0 (sqrt(2))
        let f = |x: f64| x * x - 2.0;
        let df = |x: f64| 2.0 * x;
        
        let result = newton_raphson(f, df, 1.0, 1e-12, 100);
        
        assert!(result.converged);
        assert!((result.root - 2.0_f64.sqrt()).abs() < 1e-10);
    }
    
    #[test]
    fn test_newton_raphson_numerical() {
        let f = |x: f64| x.exp() - 2.0;
        let result = newton_raphson_numerical(f, 1.0, 1e-10, 100);
        
        assert!(result.converged);
        assert!((result.root - 2.0_f64.ln()).abs() < 1e-8);
    }

    #[test]
    fn test_newton_raphson_linesearch() {
        // Standard test: x^2 - 2 = 0
        let f = |x: f64| x * x - 2.0;
        let df = |x: f64| 2.0 * x;
        let result = newton_raphson_linesearch(f, df, 1.0, 1e-12, 100);
        assert!(result.converged);
        assert!((result.root - 2.0_f64.sqrt()).abs() < 1e-10);
        
        // Test with difficult function: x^3 starting far from root
        // Standard Newton might oscillate but line search should stabilize
        let f2 = |x: f64| x * x * x - 1.0;
        let df2 = |x: f64| 3.0 * x * x;
        let result2 = newton_raphson_linesearch(f2, df2, 10.0, 1e-10, 100);
        assert!(result2.converged, "Should converge even from far initial guess");
        assert!((result2.root - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_bisection() {
        // Root of x^3 - x - 2 = 0
        let f = |x: f64| x * x * x - x - 2.0;
        
        let result = bisection(f, 1.0, 2.0, 1e-10, 100);
        
        assert!(result.converged);
        assert!(result.function_value.abs() < 1e-9);
    }

    #[test]
    fn test_secant() {
        let f = |x: f64| x * x - 3.0;
        let result = secant(f, 1.0, 2.0, 1e-10, 100);
        
        assert!(result.converged);
        assert!((result.root - 3.0_f64.sqrt()).abs() < 1e-8);
    }

    #[test]
    fn test_brent_root() {
        let f = |x: f64| x * x * x - 2.0 * x - 5.0;
        let result = brent(f, 2.0, 3.0, 1e-10, 100);
        
        assert!(result.converged);
        // Check root is close to known value (x ≈ 2.0945514815)
        let known_root = 2.0945514815423265;
        assert!((result.root - known_root).abs() < 1e-6, 
            "Root error: got {}, expected {}", result.root, known_root);
    }

    #[test]
    fn test_ridders() {
        let f = |x: f64| (x - 1.0).exp() - 2.0;
        let result = ridders(f, 0.0, 2.0, 1e-10, 100);
        
        assert!(result.converged);
        assert!((result.root - (1.0 + 2.0_f64.ln())).abs() < 1e-8);
    }
    
    #[test]
    fn test_illinois() {
        let f = |x: f64| x.sin() - 0.5;
        let result = illinois(f, 0.0, 1.0, 1e-10, 100);
        
        assert!(result.converged);
        assert!((result.root - (0.5_f64).asin()).abs() < 1e-8);
    }

    #[test]
    fn test_gauss_legendre() {
        let gl = GaussLegendre::new(5);
        
        // ∫_{-1}^{1} x^4 dx = 2/5
        let result = gl.integrate(|x| x.powi(4), -1.0, 1.0);
        assert!((result - 0.4).abs() < 1e-6);
        
        // ∫_0^1 e^x dx = e - 1
        let result = gl.integrate(|x| x.exp(), 0.0, 1.0);
        assert!((result - (1.0_f64.exp() - 1.0)).abs() < 1e-6);
    }

    #[test]
    fn test_gauss_lobatto() {
        let gll = GaussLobatto::new(5);
        
        // ∫_0^π sin(x) dx = 2
        let result = gll.integrate(|x| x.sin(), 0.0, PI);
        assert!((result - 2.0).abs() < 1e-4);
    }

    #[test]
    fn test_adaptive_simpson() {
        // ∫_0^1 x^2 dx = 1/3
        let result = adaptive_simpson(|x| x * x, 0.0, 1.0, 1e-10, 20);
        assert!(result.converged);
        assert!((result.value - 1.0 / 3.0).abs() < 1e-10);
    }

    #[test]
    fn test_romberg() {
        // ∫_0^π sin(x) dx = 2
        let result = romberg(|x| x.sin(), 0.0, PI, 10, 1e-10);
        assert!(result.converged);
        assert!((result.value - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_clenshaw_curtis() {
        // ∫_{-1}^{1} cos(x) dx = 2*sin(1) ≈ 1.6829
        let result = clenshaw_curtis(|x| x.cos(), -1.0, 1.0, 16);
        let expected = 2.0 * 1.0_f64.sin();
        assert!((result - expected).abs() < 1e-10, 
                "Clenshaw-Curtis: got {}, expected {}", result, expected);
    }

    #[test]
    fn test_gauss_kronrod() {
        // Test 1: ∫_0^1 x^2 dx = 1/3
        let (result, error) = gauss_kronrod(|x| x * x, 0.0, 1.0, 1e-10, 10);
        assert!((result - 1.0/3.0).abs() < 1e-10, 
                "Gauss-Kronrod x^2: got {}, expected {}", result, 1.0/3.0);
        
        // Test 2: ∫_0^π sin(x) dx = 2
        let (result, _) = gauss_kronrod(|x| x.sin(), 0.0, std::f64::consts::PI, 1e-10, 10);
        assert!((result - 2.0).abs() < 1e-10, 
                "Gauss-Kronrod sin: got {}, expected 2.0", result);
        
        // Test 3: ∫_0^1 exp(x) dx = e - 1
        let (result, _) = gauss_kronrod(|x| x.exp(), 0.0, 1.0, 1e-10, 10);
        let expected = std::f64::consts::E - 1.0;
        assert!((result - expected).abs() < 1e-10, 
                "Gauss-Kronrod exp: got {}, expected {}", result, expected);
        
        // Test 4: Oscillatory function requiring adaptation
        // ∫_0^2π sin(10x) dx = 0
        let (result, _) = gauss_kronrod(|x| (10.0 * x).sin(), 0.0, 2.0 * std::f64::consts::PI, 1e-8, 15);
        assert!(result.abs() < 1e-8, 
                "Gauss-Kronrod oscillatory: got {}, expected 0", result);
    }

    #[test]
    fn test_central_difference() {
        // d/dx(x^3) at x=2 should be 12
        let result = central_difference(|x| x.powi(3), 2.0, 1e-5);
        assert!((result - 12.0).abs() < 1e-6);
    }

    #[test]
    fn test_richardson_derivative() {
        // d/dx(sin(x)) at x=0 should be 1
        let result = richardson_derivative(|x| x.sin(), 0.0, 0.1, 4);
        assert!((result - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_gradient() {
        // f(x,y) = x^2 + y^2, grad = [2x, 2y]
        let f = |x: &[f64]| x[0] * x[0] + x[1] * x[1];
        let g = gradient(f, &[3.0, 4.0], 1e-6);
        
        assert!((g[0] - 6.0).abs() < 1e-4);
        assert!((g[1] - 8.0).abs() < 1e-4);
    }

    #[test]
    fn test_hessian() {
        // f(x,y) = x^2 + 2*x*y + 3*y^2
        // H = [[2, 2], [2, 6]]
        let f = |x: &[f64]| x[0] * x[0] + 2.0 * x[0] * x[1] + 3.0 * x[1] * x[1];
        let h = hessian(f, &[1.0, 1.0], 1e-5);
        
        assert!((h[0][0] - 2.0).abs() < 1e-4);
        assert!((h[0][1] - 2.0).abs() < 1e-4);
        assert!((h[1][0] - 2.0).abs() < 1e-4);
        assert!((h[1][1] - 6.0).abs() < 1e-4);
    }

    #[test]
    fn test_horner() {
        // p(x) = 2 + 3x + 4x^2 at x=2 = 2 + 6 + 16 = 24
        let coeffs = [2.0, 3.0, 4.0];
        let result = horner_eval(&coeffs, 2.0);
        assert!((result - 24.0).abs() < 1e-10);
    }

    #[test]
    fn test_chebyshev() {
        // T_0 = 1, T_1 = x, T_2 = 2x^2 - 1
        assert!((chebyshev_t(0, 0.5) - 1.0).abs() < 1e-10);
        assert!((chebyshev_t(1, 0.5) - 0.5).abs() < 1e-10);
        assert!((chebyshev_t(2, 0.5) - (-0.5)).abs() < 1e-10);
    }

    #[test]
    fn test_lagrange() {
        let points = [(0.0, 0.0), (1.0, 1.0), (2.0, 4.0)];
        
        // Should interpolate x^2
        assert!((lagrange_interpolate(&points, 0.5) - 0.25).abs() < 1e-10);
        assert!((lagrange_interpolate(&points, 1.5) - 2.25).abs() < 1e-10);
    }

    #[test]
    fn test_cubic_spline() {
        // Test with sin(x) data
        let x: Vec<f64> = (0..=10).map(|i| i as f64 * 0.5).collect();
        let y: Vec<f64> = x.iter().map(|&xi| xi.sin()).collect();
        
        let coeffs = cubic_spline_coefficients(&x, &y);
        
        // Test at data points (should be exact)
        for i in 0..x.len() {
            let interp = cubic_spline_eval(&x, &coeffs, x[i]);
            assert!((interp - y[i]).abs() < 1e-10,
                "Spline at x={} should equal y={}, got {}", x[i], y[i], interp);
        }
        
        // Test between points (should be close to sin)
        let test_points = [0.25, 1.75, 3.33, 4.5];
        for &t in &test_points {
            let interp = cubic_spline_eval(&x, &coeffs, t);
            let exact = t.sin();
            assert!((interp - exact).abs() < 0.01,
                "Spline at t={} should be close to sin(t)={}, got {}", t, exact, interp);
        }
        
        // Test with simple quadratic: y = x^2
        // Natural cubic spline may not be exactly quadratic due to boundary conditions
        let x2: Vec<f64> = vec![0.0, 1.0, 2.0, 3.0, 4.0];
        let y2: Vec<f64> = x2.iter().map(|&xi| xi * xi).collect();
        let coeffs2 = cubic_spline_coefficients(&x2, &y2);
        
        // Should be close but not necessarily exact due to natural boundary conditions
        let spline_val = cubic_spline_eval(&x2, &coeffs2, 1.5);
        assert!((spline_val - 2.25).abs() < 0.1,
            "Spline at 1.5 should be close to 2.25, got {}", spline_val);
        
        let spline_val2 = cubic_spline_eval(&x2, &coeffs2, 2.5);
        assert!((spline_val2 - 6.25).abs() < 0.1,
            "Spline at 2.5 should be close to 6.25, got {}", spline_val2);
    }

    #[test]
    fn test_barycentric() {
        let x_nodes = [0.0, 1.0, 2.0];
        let y_values = [1.0, 2.0, 5.0]; // 1 + x^2 at x=0,1,2
        
        let result = barycentric_interpolate(&x_nodes, &y_values, 1.5);
        assert!((result - 3.25).abs() < 1e-10);
    }

    #[test]
    fn test_newton_interpolate() {
        let points = [(0.0, 1.0), (1.0, 0.0), (2.0, 1.0)];
        
        // Should interpolate 1 - 2x + x^2 = (x-1)^2
        assert!((newton_interpolate(&points, 0.5) - 0.25).abs() < 1e-10);
    }

    #[test]
    fn test_golden_section() {
        // Minimize x^2, minimum at x=0
        let result = golden_section_min(|x| x * x, -1.0, 2.0, 1e-8, 100);
        assert!(result.converged);
        assert!(result.x.abs() < 1e-6);
    }

    #[test]
    fn test_brent_minimize() {
        // Minimize (x-3)^2, minimum at x=3
        let result = brent_minimize(|x| (x - 3.0).powi(2), 0.0, 5.0, 1e-8, 100);
        assert!(result.converged);
        assert!((result.x - 3.0).abs() < 1e-6);
    }

    #[test]
    fn test_gradient_descent() {
        // Minimize x^2 + y^2
        let f = |x: &[f64]| x[0] * x[0] + x[1] * x[1];
        let grad = |x: &[f64]| vec![2.0 * x[0], 2.0 * x[1]];
        
        let (x_min, _, _, converged) = gradient_descent(f, grad, &[5.0, 5.0], 1e-6, 1000);
        
        assert!(converged);
        assert!(x_min[0].abs() < 1e-4);
        assert!(x_min[1].abs() < 1e-4);
    }

    #[test]
    fn test_bfgs() {
        // Minimize Rosenbrock: (1-x)^2 + 100(y-x^2)^2
        let f = |x: &[f64]| (1.0 - x[0]).powi(2) + 100.0 * (x[1] - x[0] * x[0]).powi(2);
        let grad = |x: &[f64]| {
            vec![
                -2.0 * (1.0 - x[0]) - 400.0 * x[0] * (x[1] - x[0] * x[0]),
                200.0 * (x[1] - x[0] * x[0]),
            ]
        };
        
        let (x_min, _, _, converged) = bfgs(f, grad, &[0.0, 0.0], 1e-6, 500);
        
        assert!(converged);
        assert!((x_min[0] - 1.0).abs() < 1e-3);
        assert!((x_min[1] - 1.0).abs() < 1e-3);
    }

    #[test]
    fn test_rk4() {
        // Test with dy/dt = -y, y(0) = 1 => y(t) = exp(-t)
        let f = |_t: f64, y: &[f64]| vec![-y[0]];
        let result = rk4(f, &[1.0], 0.0, 2.0, 100);
        
        // Check final value: exp(-2) ≈ 0.1353
        let y_final = result.y.last().unwrap()[0];
        assert!((y_final - (-2.0_f64).exp()).abs() < 1e-6,
            "RK4 y(2) should be exp(-2)≈0.1353, got {}", y_final);
        
        // Check solution at intermediate point
        let mid_idx = result.y.len() / 2;
        let y_mid = result.y[mid_idx][0];
        let t_mid = result.t[mid_idx];
        assert!((y_mid - (-t_mid).exp()).abs() < 1e-6,
            "RK4 y({}) should be {}, got {}", t_mid, (-t_mid).exp(), y_mid);
    }

    #[test]
    fn test_rk4_system() {
        // Test harmonic oscillator: x'' = -x
        // Convert to system: y1' = y2, y2' = -y1
        // y1(0) = 1, y2(0) = 0 => y1(t) = cos(t), y2(t) = -sin(t)
        let f = |_t: f64, y: &[f64]| vec![y[1], -y[0]];
        let result = rk4(f, &[1.0, 0.0], 0.0, std::f64::consts::PI, 200);
        
        // At t=π: y1 = cos(π) = -1, y2 = -sin(π) = 0
        let y_final = &result.y.last().unwrap();
        assert!((y_final[0] - (-1.0)).abs() < 1e-4,
            "Harmonic oscillator x(π) should be -1, got {}", y_final[0]);
        assert!(y_final[1].abs() < 1e-4,
            "Harmonic oscillator x'(π) should be 0, got {}", y_final[1]);
    }

    #[test]
    fn test_rk45_adaptive() {
        // Test with dy/dt = -y, y(0) = 1
        let f = |_t: f64, y: &[f64]| vec![-y[0]];
        let result = rk45(f, &[1.0], 0.0, 5.0, 1e-6, 1e-8);
        
        // Check final value: exp(-5) ≈ 0.00674
        let y_final = result.y.last().unwrap()[0];
        let expected = (-5.0_f64).exp();
        assert!((y_final - expected).abs() < 1e-5,
            "RK45 y(5) should be exp(-5)≈{}, got {}", expected, y_final);
        
        // Check that adaptive stepping used fewer steps than fixed
        assert!(result.t.len() < 100,
            "Adaptive method should use fewer steps than 100 fixed steps, used {}", result.t.len());
    }
    
    #[test]
    fn test_jacobian() {
        // f(x) = [x1^2 + x2, x1 * x2]
        // J = [[2*x1, 1], [x2, x1]]
        let f = |x: &[f64]| vec![x[0] * x[0] + x[1], x[0] * x[1]];
        let j = jacobian(f, &[2.0, 3.0], 1e-6);
        
        assert!((j[0][0] - 4.0).abs() < 1e-4); // 2*x1 = 4
        assert!((j[0][1] - 1.0).abs() < 1e-4); // 1
        assert!((j[1][0] - 3.0).abs() < 1e-4); // x2 = 3
        assert!((j[1][1] - 2.0).abs() < 1e-4); // x1 = 2
    }
}
