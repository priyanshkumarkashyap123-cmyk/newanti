//! Copula models for dependency modeling in probability theory.

use std::f64::consts::PI;
use crate::special_functions::{gamma as gamma_func, standard_normal_cdf};

/// Copula types for dependency modeling
/// Industry standard: OpenTURNS, UQLab, R copula package
#[derive(Debug, Clone)]
pub enum Copula {
    /// Gaussian copula with correlation matrix
    Gaussian { correlation: Vec<Vec<f64>>, cholesky: Vec<Vec<f64>> },
    /// Clayton copula (lower tail dependence)
    Clayton { theta: f64 },
    /// Frank copula (symmetric, no tail dependence)
    Frank { theta: f64 },
    /// Gumbel copula (upper tail dependence)
    Gumbel { theta: f64 },
    /// Student-t copula (symmetric tail dependence)
    StudentT { correlation: Vec<Vec<f64>>, nu: f64 },
}

impl Copula {
    /// Create Gaussian copula
    pub fn gaussian(correlation: Vec<Vec<f64>>) -> Self {
        let n = correlation.len();
        let mut cholesky: Vec<Vec<f64>> = vec![vec![0.0; n]; n];

        // Cholesky decomposition
        for i in 0..n {
            for j in 0..=i {
                let mut sum: f64 = 0.0;
                if i == j {
                    for k in 0..j {
                        let v: f64 = cholesky[j][k];
                        sum += v * v;
                    }
                    cholesky[i][j] = (correlation[i][j] - sum).max(1e-10).sqrt();
                } else {
                    for k in 0..j {
                        sum += cholesky[i][k] * cholesky[j][k];
                    }
                    let denom: f64 = cholesky[j][j];
                    cholesky[i][j] = (correlation[i][j] - sum) / denom.max(1e-10);
                }
            }
        }

        Copula::Gaussian { correlation, cholesky }
    }

    /// Create Clayton copula
    pub fn clayton(theta: f64) -> Self {
        assert!(theta > 0.0, "Clayton theta must be > 0");
        Copula::Clayton { theta }
    }

    /// Create Frank copula
    pub fn frank(theta: f64) -> Self {
        assert!(theta != 0.0, "Frank theta must be non-zero");
        Copula::Frank { theta }
    }

    /// Create Gumbel copula
    pub fn gumbel(theta: f64) -> Self {
        assert!(theta >= 1.0, "Gumbel theta must be >= 1");
        Copula::Gumbel { theta }
    }

    /// Sample from copula (returns uniform marginals)
    pub fn sample(&self, n_samples: usize, rng_state: &mut u64) -> Vec<Vec<f64>> {
        match self {
            Copula::Gaussian { cholesky, .. } => {
                self.sample_gaussian(n_samples, cholesky, rng_state)
            }
            Copula::Clayton { theta } => {
                self.sample_clayton(n_samples, *theta, rng_state)
            }
            Copula::Frank { theta } => {
                self.sample_frank(n_samples, *theta, rng_state)
            }
            Copula::Gumbel { theta } => {
                self.sample_gumbel(n_samples, *theta, rng_state)
            }
            Copula::StudentT { correlation, nu } => {
                self.sample_student_t(n_samples, correlation, *nu, rng_state)
            }
        }
    }

    fn sample_gaussian(&self, n: usize, cholesky: &[Vec<f64>], rng_state: &mut u64) -> Vec<Vec<f64>> {
        let dim = cholesky.len();
        let mut samples = Vec::new();

        for _ in 0..n {
            // Generate independent standard normals
            let z: Vec<f64> = (0..dim).map(|_| box_muller_normal(rng_state)).collect();

            // Apply Cholesky
            let mut y = vec![0.0; dim];
            for i in 0..dim {
                for j in 0..=i {
                    y[i] += cholesky[i][j] * z[j];
                }
            }

            // Transform to uniform
            let u: Vec<f64> = y.iter().map(|&yi| standard_normal_cdf(yi)).collect();
            samples.push(u);
        }

        samples
    }

    fn sample_clayton(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        // Bivariate Clayton sampling using conditional method
        let mut samples = Vec::new();

        for _ in 0..n {
            let u1 = lcg_random(rng_state);
            let v = lcg_random(rng_state);

            // Conditional u2 | u1
            let u2 = u1 * (v.powf(-theta / (1.0 + theta)) - 1.0 + u1.powf(theta))
                .powf(-1.0 / theta);

            samples.push(vec![u1, u2.clamp(0.0, 1.0)]);
        }

        samples
    }

    fn sample_frank(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        let mut samples = Vec::new();

        for _ in 0..n {
            let u1 = lcg_random(rng_state);
            let v = lcg_random(rng_state);

            // Conditional u2 | u1
            let a = 1.0 - (-theta).exp();
            let b = (-theta * u1).exp();
            let u2 = -((1.0 - a / (a * v / b + (1.0 - v))).ln()) / theta;

            samples.push(vec![u1, u2.clamp(0.0, 1.0)]);
        }

        samples
    }

    fn sample_gumbel(&self, n: usize, theta: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        // Using Marshall-Olkin algorithm
        let mut samples = Vec::new();

        for _ in 0..n {
            // Generate gamma(1/theta, 1)
            let s = gamma_sample(1.0 / theta, rng_state);

            let e1 = -lcg_random(rng_state).ln();
            let e2 = -lcg_random(rng_state).ln();

            let u1 = (-( e1 / s).powf(theta)).exp();
            let u2 = (-(e2 / s).powf(theta)).exp();

            samples.push(vec![u1, u2]);
        }

        samples
    }

    fn sample_student_t(&self, n: usize, corr: &[Vec<f64>], nu: f64, rng_state: &mut u64) -> Vec<Vec<f64>> {
        let dim = corr.len();
        
        // Cholesky of correlation
        let mut chol: Vec<Vec<f64>> = vec![vec![0.0; dim]; dim];
        for i in 0..dim {
            for j in 0..=i {
                let mut sum: f64 = 0.0;
                if i == j {
                    for k in 0..j { 
                        let v: f64 = chol[j][k];
                        sum += v * v; 
                    }
                    chol[i][j] = (corr[i][j] - sum).max(1e-10).sqrt();
                } else {
                    for k in 0..j { sum += chol[i][k] * chol[j][k]; }
                    let denom: f64 = chol[j][j];
                    chol[i][j] = (corr[i][j] - sum) / denom.max(1e-10);
                }
            }
        }

        let mut samples = Vec::new();

        for _ in 0..n {
            // Chi-squared sample
            let chi2 = gamma_sample(nu / 2.0, rng_state) * 2.0;
            let s = (chi2 / nu).sqrt();

            // Standard normal vector
            let z: Vec<f64> = (0..dim).map(|_| box_muller_normal(rng_state)).collect();

            // Correlated normal
            let mut y = vec![0.0; dim];
            for i in 0..dim {
                for j in 0..=i {
                    y[i] += chol[i][j] * z[j];
                }
            }

            // T-distributed
            let t: Vec<f64> = y.iter().map(|&yi| yi / s).collect();

            // To uniform using t-CDF
            let u: Vec<f64> = t.iter().map(|&ti| student_t_cdf(ti, nu)).collect();
            samples.push(u);
        }

        samples
    }

    /// Copula CDF (for bivariate)
    pub fn cdf(&self, u: &[f64]) -> f64 {
        match self {
            Copula::Clayton { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                (u[0].powf(-*theta) + u[1].powf(-*theta) - 1.0).max(0.0).powf(-1.0 / theta)
            }
            Copula::Frank { theta } => {
                let a = (-*theta).exp() - 1.0;
                let num = ((-theta * u[0]).exp() - 1.0) * ((-theta * u[1]).exp() - 1.0);
                -(1.0 + num / a).ln() / theta
            }
            Copula::Gumbel { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let t = ((-u[0].ln()).powf(*theta) + (-u[1].ln()).powf(*theta)).powf(1.0 / theta);
                (-t).exp()
            }
            _ => {
                // Numerical for Gaussian and Student-t
                0.0 // Placeholder
            }
        }
    }

    /// Copula density (for bivariate)
    pub fn pdf(&self, u: &[f64]) -> f64 {
        match self {
            Copula::Clayton { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let sum = u[0].powf(-*theta) + u[1].powf(-*theta) - 1.0;
                (1.0 + theta) * (u[0] * u[1]).powf(-theta - 1.0) * sum.powf(-2.0 - 1.0 / theta)
            }
            Copula::Frank { theta } => {
                let a = theta * (1.0 - (-*theta).exp());
                let num = a * (-theta * (u[0] + u[1])).exp();
                let den = ((-*theta).exp() - 1.0 + ((-theta * u[0]).exp() - 1.0) 
                    * ((-theta * u[1]).exp() - 1.0)).powi(2);
                num / den
            }
            Copula::Gumbel { theta } => {
                if u[0] <= 0.0 || u[1] <= 0.0 { return 0.0; }
                let t1 = (-u[0].ln()).powf(*theta);
                let t2 = (-u[1].ln()).powf(*theta);
                let t = (t1 + t2).powf(1.0 / theta);
                let c = (-t).exp();
                let factor = c / (u[0] * u[1]) * (t1 / (-u[0].ln()) * t2 / (-u[1].ln()))
                    * (t1 + t2).powf(2.0 / theta - 2.0) * (theta - 1.0 + t);
                factor
            }
            _ => 1.0,
        }
    }
}
