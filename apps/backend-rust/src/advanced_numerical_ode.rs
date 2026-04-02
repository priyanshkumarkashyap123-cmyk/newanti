//! ODE solver algorithms extracted from advanced numerical methods.

use crate::numerics::OdeResult;
use std::f64::consts::PI;

// ============================================================================
// ODE SOLVERS
// ============================================================================

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
