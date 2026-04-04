//! Optimization algorithms extracted from advanced numerical methods.

use crate::numerics::OptimizationResult;
use std::f64::consts::PI;

// ============================================================================
// 1D OPTIMIZATION
// ============================================================================

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
