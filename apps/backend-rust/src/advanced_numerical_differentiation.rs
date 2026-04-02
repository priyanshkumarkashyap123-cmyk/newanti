//! Numerical differentiation algorithms extracted from advanced numerical methods.

use std::f64::consts::PI;

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
