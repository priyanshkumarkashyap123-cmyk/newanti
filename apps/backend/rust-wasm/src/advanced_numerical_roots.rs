//! Root-finding algorithms extracted from advanced numerical methods.

use crate::numerics::RootResult;

// ============================================================================
// ROOT FINDING METHODS
// ============================================================================

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
