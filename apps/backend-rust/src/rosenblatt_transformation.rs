//! Rosenblatt transformation for general dependent variables.

use std::f64::consts::PI;
use crate::special_functions::{standard_normal_cdf, standard_normal_pdf};

pub trait ConditionalCDF: Send + Sync {
    fn cdf(&self, x: f64, conditioning: &[f64]) -> f64;
    fn inverse_cdf(&self, p: f64, conditioning: &[f64]) -> f64;
    fn clone_box(&self) -> Box<dyn ConditionalCDF>;
}

impl Clone for Box<dyn ConditionalCDF> {
    fn clone(&self) -> Self {
        self.clone_box()
    }
}

impl std::fmt::Debug for Box<dyn ConditionalCDF> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ConditionalCDF")
    }
}

/// Gaussian conditional CDF for multivariate normal
#[derive(Debug, Clone)]
pub struct GaussianConditionalCDF {
    pub index: usize,
    pub mean: Vec<f64>,
    pub covariance: Vec<Vec<f64>>,
}

impl ConditionalCDF for GaussianConditionalCDF {
    fn cdf(&self, x: f64, conditioning: &[f64]) -> f64 {
        let (cond_mean, cond_var) = self.compute_conditional_params(conditioning);
        let z = (x - cond_mean) / cond_var.sqrt();
        standard_normal_cdf(z)
    }

    fn inverse_cdf(&self, p: f64, conditioning: &[f64]) -> f64 {
        let (cond_mean, cond_var) = self.compute_conditional_params(conditioning);
        cond_mean + cond_var.sqrt() * standard_normal_inverse_cdf(p)
    }

    fn clone_box(&self) -> Box<dyn ConditionalCDF> {
        Box::new(self.clone())
    }
}

impl GaussianConditionalCDF {
    fn compute_conditional_params(&self, conditioning: &[f64]) -> (f64, f64) {
        let i = self.index;
        
        if conditioning.is_empty() {
            return (self.mean[i], self.covariance[i][i]);
        }

        let k = conditioning.len();
        
        // Σ_11: covariance of conditioning variables
        let mut sigma_11 = vec![vec![0.0; k]; k];
        for ii in 0..k {
            for jj in 0..k {
                sigma_11[ii][jj] = self.covariance[ii][jj];
            }
        }

        // Σ_12: covariance between target and conditioning
        let sigma_12: Vec<f64> = (0..k).map(|j| self.covariance[i][j]).collect();

        // Σ_22: variance of target
        let sigma_22 = self.covariance[i][i];

        // Inverse of Σ_11
        let sigma_11_inv = invert_matrix(&sigma_11);

        // Conditional mean: μ_i + Σ_12 * Σ_11^{-1} * (x_{1..k} - μ_{1..k})
        let mut cond_mean = self.mean[i];
        for j in 0..k {
            let mut term = 0.0;
            for l in 0..k {
                term += sigma_11_inv[j][l] * (conditioning[l] - self.mean[l]);
            }
            cond_mean += sigma_12[j] * term;
        }

        // Conditional variance: Σ_22 - Σ_12 * Σ_11^{-1} * Σ_21
        let mut var_reduction = 0.0;
        for j in 0..k {
            for l in 0..k {
                var_reduction += sigma_12[j] * sigma_11_inv[j][l] * sigma_12[l];
            }
        }
        let cond_var = (sigma_22 - var_reduction).max(1e-10);

        (cond_mean, cond_var)
    }
}

impl RosenblattTransformation {
    /// Create from multivariate normal
    pub fn from_gaussian(mean: Vec<f64>, covariance: Vec<Vec<f64>>) -> Self {
        let n = mean.len();
        
        let conditional_cdfs: Vec<Box<dyn ConditionalCDF>> = (0..n)
            .map(|i| {
                Box::new(GaussianConditionalCDF {
                    index: i,
                    mean: mean.clone(),
                    covariance: covariance.clone(),
                }) as Box<dyn ConditionalCDF>
            })
            .collect();

        RosenblattTransformation {
            dimension: n,
            conditional_cdfs,
        }
    }

    /// Transform X → U
    pub fn transform(&self, x: &[f64]) -> Vec<f64> {
        let mut u = Vec::with_capacity(self.dimension);

        for i in 0..self.dimension {
            let conditioning = &x[..i];
            let p = self.conditional_cdfs[i].cdf(x[i], conditioning);
            u.push(standard_normal_inverse_cdf(p));
        }

        u
    }

    /// Inverse transform U → X
    pub fn inverse_transform(&self, u: &[f64]) -> Vec<f64> {
        let mut x = Vec::with_capacity(self.dimension);

        for i in 0..self.dimension {
            let conditioning: Vec<f64> = x.clone();
            let p = standard_normal_cdf(u[i]);
            let xi = self.conditional_cdfs[i].inverse_cdf(p, &conditioning);
            x.push(xi);
        }

        x
    }
}
