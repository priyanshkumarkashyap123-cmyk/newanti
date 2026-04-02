//! Kernel density estimation for unknown probability distributions.

use std::f64::consts::PI;
use crate::special_functions::standard_normal_pdf;

/// Kernel density estimator for unknown distributions
/// Industry standard: OpenTURNS, SciPy
#[derive(Debug, Clone)]
pub struct KernelDensityEstimate {
    pub samples: Vec<f64>,
    pub bandwidth: f64,
    pub kernel: KernelType,
}

#[derive(Debug, Clone, Copy)]
pub enum KernelType {
    Gaussian,
    Epanechnikov,
    Triangular,
    Uniform,
}

impl KernelDensityEstimate {
    pub fn new(samples: Vec<f64>) -> Self {
        let n = samples.len() as f64;
        
        // Silverman's rule of thumb for bandwidth
        let std = sample_std(&samples);
        let iqr = interquartile_range(&samples);
        let bandwidth = 0.9 * std.min(iqr / 1.34) * n.powf(-0.2);

        KernelDensityEstimate {
            samples,
            bandwidth,
            kernel: KernelType::Gaussian,
        }
    }

    pub fn with_bandwidth(mut self, h: f64) -> Self {
        self.bandwidth = h;
        self
    }

    pub fn with_kernel(mut self, kernel: KernelType) -> Self {
        self.kernel = kernel;
        self
    }

    /// Evaluate PDF at point x
    pub fn pdf(&self, x: f64) -> f64 {
        let n = self.samples.len() as f64;
        let h = self.bandwidth;

        let sum: f64 = self.samples.iter()
            .map(|&xi| self.kernel_function((x - xi) / h))
            .sum();

        sum / (n * h)
    }

    /// Evaluate CDF at point x
    pub fn cdf(&self, x: f64) -> f64 {
        let n = self.samples.len() as f64;
        let h = self.bandwidth;

        let sum: f64 = self.samples.iter()
            .map(|&xi| self.kernel_cdf((x - xi) / h))
            .sum();

        sum / n
    }

    fn kernel_function(&self, u: f64) -> f64 {
        match self.kernel {
            KernelType::Gaussian => {
                (-0.5 * u * u).exp() / (2.0 * PI).sqrt()
            }
            KernelType::Epanechnikov => {
                if u.abs() <= 1.0 { 0.75 * (1.0 - u * u) }
                else { 0.0 }
            }
            KernelType::Triangular => {
                if u.abs() <= 1.0 { 1.0 - u.abs() }
                else { 0.0 }
            }
            KernelType::Uniform => {
                if u.abs() <= 1.0 { 0.5 }
                else { 0.0 }
            }
        }
    }

    fn kernel_cdf(&self, u: f64) -> f64 {
        match self.kernel {
            KernelType::Gaussian => {
                standard_normal_cdf(u)
            }
            KernelType::Epanechnikov => {
                if u < -1.0 { 0.0 }
                else if u > 1.0 { 1.0 }
                else { 0.5 + 0.75 * u - 0.25 * u.powi(3) }
            }
            KernelType::Triangular => {
                if u < -1.0 { 0.0 }
                else if u < 0.0 { 0.5 * (1.0 + u).powi(2) }
                else if u < 1.0 { 1.0 - 0.5 * (1.0 - u).powi(2) }
                else { 1.0 }
            }
            KernelType::Uniform => {
                if u < -1.0 { 0.0 }
                else if u > 1.0 { 1.0 }
                else { 0.5 * (u + 1.0) }
            }
        }
    }

    /// Generate random sample
    pub fn sample(&self, rng_state: &mut u64) -> f64 {
        let n = self.samples.len();
        let idx = (lcg_random(rng_state) * n as f64) as usize;
        let base = self.samples[idx.min(n - 1)];
        
        base + self.bandwidth * box_muller_normal(rng_state)
    }
}
