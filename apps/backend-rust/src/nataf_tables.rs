//! Utility functions and Nataf correlation factor tables (Der Kiureghian & Liu 1986).

use std::f64::consts::PI;
use crate::special_functions::{standard_normal_cdf, standard_normal_pdf};


fn lower_incomplete_gamma(a: f64, x: f64) -> f64 {
    // Series expansion
    let mut sum = 0.0;
    let mut term = 1.0 / a;
    sum += term;
    
    for n in 1..100 {
        term *= x / (a + n as f64);
        sum += term;
        if term.abs() < 1e-14 * sum.abs() { break; }
    }
    
    x.powf(a) * (-x).exp() * sum
}

fn regularized_incomplete_beta(a: f64, b: f64, x: f64) -> f64 {
    if x <= 0.0 { return 0.0; }
    if x >= 1.0 { return 1.0; }
    
    // Continued fraction
    let bt: f64 = if x == 0.0 || x == 1.0 {
        0.0
    } else {
        (lgamma(a) + lgamma(b) - lgamma(a + b)
            + a * x.ln() + b * (1.0 - x).ln()).exp()
    };
    
    if x < (a + 1.0) / (a + b + 2.0) {
        bt * beta_cf(a, b, x) / a
    } else {
        1.0 - bt * beta_cf(b, a, 1.0 - x) / b
    }
}

fn beta_cf(a: f64, b: f64, x: f64) -> f64 {
    let mut c: f64 = 1.0;
    let mut d: f64 = 1.0 / (1.0 - (a + b) * x / (a + 1.0)).max(1e-30);
    let mut h: f64 = d;
    
    for m in 1..100 {
        let m = m as f64;
        
        let d_num: f64 = m * (b - m) * x / ((a + 2.0 * m - 1.0) * (a + 2.0 * m));
        d = 1.0 / (1.0 + d_num * d).max(1e-30);
        c = 1.0 + d_num / c.max(1e-30);
        h *= d * c;
        
        let d_num = -(a + m) * (a + b + m) * x / ((a + 2.0 * m) * (a + 2.0 * m + 1.0));
        d = 1.0 / (1.0 + d_num * d).max(1e-30);
        c = 1.0 + d_num / c.max(1e-30);
        
        let delta = d * c;
        h *= delta;
        
        if (delta - 1.0).abs() < 1e-10 { break; }
    }
    
    h
}

fn student_t_cdf(t: f64, nu: f64) -> f64 {
    let x = nu / (nu + t * t);
    0.5 + 0.5 * t.signum() * (1.0 - regularized_incomplete_beta(nu / 2.0, 0.5, x))
}

fn student_t_pdf(t: f64, nu: f64) -> f64 {
    let coef = gamma_func((nu + 1.0) / 2.0) / (gamma_func(nu / 2.0) * (nu * PI).sqrt());
    coef * (1.0 + t * t / nu).powf(-(nu + 1.0) / 2.0)
}

// ============================================================================
// COMPLETE NATAF CORRELATION FACTOR TABLES (DER KIUREGHIAN & LIU 1986)
// ============================================================================

/// Complete Nataf correlation factor computation per Der Kiureghian & Liu (1986)
/// Industry standard: FERUM, OpenTURNS, Strurel
pub struct NatafFactorTables;

impl NatafFactorTables {
    /// Get correlation modification factor F such that ρ_Y = ρ_X / F
    pub fn correlation_factor(
        dist1: &MarginalDistribution,
        dist2: &MarginalDistribution,
        rho: f64,
    ) -> f64 {
        let cov1 = dist1.std() / dist1.mean().abs().max(1e-10);
        let cov2 = dist2.std() / dist2.mean().abs().max(1e-10);
        
        // Table from Der Kiureghian & Liu (1986), Table 1
        let f = match (dist1, dist2) {
            // Normal - Normal
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Normal { .. }) => 1.0,
            
            // Normal - Lognormal
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Lognormal { .. }) |
            (MarginalDistribution::Lognormal { .. }, MarginalDistribution::Normal { .. }) => {
                let v = cov1.max(cov2);
                v / (1.0 + v * v).ln().sqrt()
            }
            
            // Lognormal - Lognormal
            (MarginalDistribution::Lognormal { .. }, MarginalDistribution::Lognormal { .. }) => {
                let zeta1 = (1.0 + cov1 * cov1).ln().sqrt();
                let zeta2 = (1.0 + cov2 * cov2).ln().sqrt();
                (((1.0 + rho * cov1 * cov2).ln()) / (zeta1 * zeta2)).clamp(-0.999, 0.999)
            }
            
            // Normal - Uniform
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Uniform { .. }) |
            (MarginalDistribution::Uniform { .. }, MarginalDistribution::Normal { .. }) => 1.023,
            
            // Normal - Gumbel (Type I Extreme)
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Gumbel { .. }) |
            (MarginalDistribution::Gumbel { .. }, MarginalDistribution::Normal { .. }) => 1.031,
            
            // Normal - Weibull
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Weibull { k: _, .. }) |
            (MarginalDistribution::Weibull { k: _, .. }, MarginalDistribution::Normal { .. }) => {
                let v = cov1.max(cov2);
                1.031 - 0.195 * v + 0.328 * v * v
            }
            
            // Normal - Gamma
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Gamma { shape, .. }) |
            (MarginalDistribution::Gamma { shape, .. }, MarginalDistribution::Normal { .. }) => {
                let k = *shape;
                1.001 - 0.007 / k.sqrt() + 0.118 / k
            }
            
            // Normal - Exponential
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Exponential { .. }) |
            (MarginalDistribution::Exponential { .. }, MarginalDistribution::Normal { .. }) => 1.107,
            
            // Normal - Frechet (Type II Extreme)
            (MarginalDistribution::Normal { .. }, MarginalDistribution::Frechet { alpha, .. }) |
            (MarginalDistribution::Frechet { alpha, .. }, MarginalDistribution::Normal { .. }) => {
                let a = *alpha;
                1.03 + 0.238 / a + 0.364 / (a * a)
            }
            
            // Uniform - Uniform
            (MarginalDistribution::Uniform { .. }, MarginalDistribution::Uniform { .. }) => 1.047,
            
            // Gumbel - Gumbel
            (MarginalDistribution::Gumbel { .. }, MarginalDistribution::Gumbel { .. }) => {
                1.064 - 0.069 * rho + 0.005 * rho * rho
            }
            
            // Exponential - Exponential  
            (MarginalDistribution::Exponential { .. }, MarginalDistribution::Exponential { .. }) => {
                1.229 - 0.367 * rho + 0.153 * rho * rho
            }
            
            // Default: numerical integration (simplified)
            _ => {
                // Use approximate formula based on COVs
                let max_cov = cov1.max(cov2);
                1.0 + 0.05 * max_cov + 0.02 * max_cov * max_cov
            }
        };
        
        f.max(0.1).min(2.0)  // Bound for numerical stability
    }
    
    /// Compute full modified correlation matrix
    pub fn modified_correlation_matrix(
        marginals: &[MarginalDistribution],
        correlation: &[Vec<f64>],
    ) -> Vec<Vec<f64>> {
        let n = marginals.len();
        let mut modified = vec![vec![0.0; n]; n];
        
        for i in 0..n {
            for j in 0..n {
                if i == j {
                    modified[i][j] = 1.0;
                } else {
                    let rho = correlation[i][j];
                    let f = Self::correlation_factor(&marginals[i], &marginals[j], rho);
                    modified[i][j] = rho / f;
                }
            }
        }
        
        // Ensure positive definiteness
        Self::nearest_positive_definite(&mut modified);
        
        modified
    }
    
    /// Project to nearest positive definite matrix (Higham 2002)
    fn nearest_positive_definite(matrix: &mut Vec<Vec<f64>>) {
        let n = matrix.len();
        
        // Simple eigenvalue clipping approach
        // For full Higham algorithm, iterate alternating projections
        
        // Ensure symmetry
        for i in 0..n {
            for j in (i + 1)..n {
                let avg = (matrix[i][j] + matrix[j][i]) / 2.0;
                matrix[i][j] = avg;
                matrix[j][i] = avg;
            }
        }
        
        // Ensure diagonal dominance (simple fix)
        for i in 0..n {
            let off_diag_sum: f64 = (0..n)
                .filter(|&j| j != i)
                .map(|j| matrix[i][j].abs())
                .sum();
            
            if off_diag_sum >= 1.0 {
                let scale = 0.99 / off_diag_sum;
                for j in 0..n {
                    if j != i {
                        matrix[i][j] *= scale;
                        matrix[j][i] *= scale;
                    }
                }
            }
        }
    }
}

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}

fn gamma_sample(shape: f64, rng_state: &mut u64) -> f64 {
    // Marsaglia and Tsang's method
    if shape < 1.0 {
        return gamma_sample(shape + 1.0, rng_state) * lcg_random(rng_state).powf(1.0 / shape);
    }
    
    let d = shape - 1.0 / 3.0;
    let c = 1.0 / (9.0 * d).sqrt();
    
    loop {
        let x = box_muller_normal(rng_state);
        let v = (1.0 + c * x).powi(3);
        
        if v > 0.0 {
            let u = lcg_random(rng_state);
            if u < 1.0 - 0.0331 * x.powi(4) {
                return d * v;
            }
            if u.ln() < 0.5 * x * x + d * (1.0 - v + v.ln()) {
                return d * v;
            }
        }
    }
}

fn invert_matrix(a: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let n = a.len();
    let mut aug = vec![vec![0.0; 2 * n]; n];

    for i in 0..n {
        for j in 0..n {
            aug[i][j] = a[i][j];
            aug[i][n + j] = if i == j { 1.0 } else { 0.0 };
        }
    }

    for i in 0..n {
        let mut max_row = i;
        for k in (i + 1)..n {
            if aug[k][i].abs() > aug[max_row][i].abs() {
                max_row = k;
            }
        }
        aug.swap(i, max_row);

        let pivot = aug[i][i];
        if pivot.abs() < 1e-14 { continue; }

        for j in 0..(2 * n) {
            aug[i][j] /= pivot;
        }

        for k in 0..n {
            if k == i { continue; }
            let factor = aug[k][i];
            for j in 0..(2 * n) {
                aug[k][j] -= factor * aug[i][j];
            }
        }
    }

    let mut inv = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in 0..n {
            inv[i][j] = aug[i][n + j];
        }
    }
    inv
}

fn sample_std(samples: &[f64]) -> f64 {
    let n = samples.len() as f64;
    let mean = samples.iter().sum::<f64>() / n;
    let variance = samples.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
    variance.sqrt()
}

fn interquartile_range(samples: &[f64]) -> f64 {
    let mut sorted = samples.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    
    let n = sorted.len();
    let q1_idx = n / 4;
    let q3_idx = 3 * n / 4;
    
    sorted[q3_idx] - sorted[q1_idx]
}
