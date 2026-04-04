//! Polynomial evaluation and interpolation algorithms extracted from advanced numerical methods.

use std::f64::consts::PI;

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
