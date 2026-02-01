//! Incremental Dynamic Analysis (IDA) Module
//!
//! Performance-based earthquake engineering assessment method.
//! Essential for collapse fragility and seismic performance evaluation.
//!
//! ## Standards
//! - FEMA P-58 Seismic Performance Assessment
//! - FEMA P-695 Quantification of Building Seismic Performance Factors
//! - ASCE 41-17 Seismic Evaluation and Retrofit
//! - ATC-63 Methodology
//!
//! ## Methods
//! - Single-record IDA curves
//! - Multi-record IDA (16th/50th/84th percentiles)
//! - Collapse fragility fitting
//! - Capacity point identification

use serde::{Deserialize, Serialize};
use crate::special_functions::*;


fn standard_normal_inverse(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// INTENSITY MEASURES
// ============================================================================

/// Intensity Measure (IM) types for IDA
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum IntensityMeasure {
    /// Peak Ground Acceleration (g)
    PGA,
    /// Spectral Acceleration at fundamental period Sa(T1) (g)
    SaT1,
    /// Spectral Acceleration at 0.2*T1 (g)
    Sa02T1,
    /// Spectral Acceleration at 2*T1 (g)
    Sa2T1,
    /// Average spectral acceleration (geometric mean)
    SaAvg,
    /// Spectral displacement at T1 (m)
    SdT1,
}

impl IntensityMeasure {
    pub fn name(&self) -> &'static str {
        match self {
            IntensityMeasure::PGA => "PGA",
            IntensityMeasure::SaT1 => "Sa(T1)",
            IntensityMeasure::Sa02T1 => "Sa(0.2T1)",
            IntensityMeasure::Sa2T1 => "Sa(2T1)",
            IntensityMeasure::SaAvg => "Sa,avg",
            IntensityMeasure::SdT1 => "Sd(T1)",
        }
    }

    pub fn unit(&self) -> &'static str {
        match self {
            IntensityMeasure::SdT1 => "m",
            _ => "g",
        }
    }
}

// ============================================================================
// ENGINEERING DEMAND PARAMETERS
// ============================================================================

/// Engineering Demand Parameter (EDP) types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DemandParameter {
    /// Maximum interstory drift ratio
    MaxIDR,
    /// Interstory drift at specific story
    IDRStory(usize),
    /// Roof drift ratio
    RoofDrift,
    /// Peak floor acceleration (g)
    PFA,
    /// Peak floor velocity (m/s)
    PFV,
    /// Residual drift ratio
    ResidualDrift,
    /// Base shear coefficient
    BaseShearCoeff,
    /// Plastic hinge rotation (rad)
    PlasticRotation,
}

impl DemandParameter {
    pub fn name(&self) -> String {
        match self {
            DemandParameter::MaxIDR => "Max IDR".to_string(),
            DemandParameter::IDRStory(s) => format!("IDR Story {}", s),
            DemandParameter::RoofDrift => "Roof Drift".to_string(),
            DemandParameter::PFA => "PFA".to_string(),
            DemandParameter::PFV => "PFV".to_string(),
            DemandParameter::ResidualDrift => "Residual Drift".to_string(),
            DemandParameter::BaseShearCoeff => "Base Shear Coeff".to_string(),
            DemandParameter::PlasticRotation => "Plastic Rotation".to_string(),
        }
    }
}

// ============================================================================
// IDA SINGLE RECORD ANALYSIS
// ============================================================================

/// Single IDA curve point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IDAPoint {
    /// Intensity measure value
    pub im: f64,
    /// Demand parameter value
    pub edp: f64,
    /// Converged (true) or collapse (false)
    pub converged: bool,
    /// Analysis time (seconds)
    pub analysis_time: f64,
}

/// Single-record IDA curve
#[derive(Debug, Clone)]
pub struct SingleRecordIDA {
    /// Ground motion record ID
    pub record_id: String,
    /// Intensity measure type
    pub im_type: IntensityMeasure,
    /// Demand parameter type
    pub edp_type: DemandParameter,
    /// IDA curve points
    pub points: Vec<IDAPoint>,
    /// Collapse IM value (if identified)
    pub im_collapse: Option<f64>,
    /// Collapse criterion
    pub collapse_criterion: CollapseCriterion,
}

/// Collapse identification criterion
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CollapseCriterion {
    /// Numerical non-convergence
    NonConvergence,
    /// EDP exceeds threshold
    EDPThreshold(f64),
    /// Slope < threshold (flatline)
    SlopeThreshold(f64),
    /// Dynamic instability (negative tangent stiffness)
    DynamicInstability,
}

impl SingleRecordIDA {
    pub fn new(record_id: &str, im_type: IntensityMeasure, edp_type: DemandParameter) -> Self {
        SingleRecordIDA {
            record_id: record_id.to_string(),
            im_type,
            edp_type,
            points: Vec::new(),
            im_collapse: None,
            collapse_criterion: CollapseCriterion::NonConvergence,
        }
    }

    /// Add analysis result point
    pub fn add_point(&mut self, im: f64, edp: f64, converged: bool, analysis_time: f64) {
        self.points.push(IDAPoint {
            im,
            edp,
            converged,
            analysis_time,
        });

        // Sort by IM
        self.points.sort_by(|a, b| a.im.partial_cmp(&b.im).unwrap());
    }

    /// Run IDA with hunt-and-fill algorithm
    pub fn hunt_and_fill<F>(
        &mut self,
        analyze: F,
        im_initial: f64,
        im_max: f64,
        n_target_points: usize,
    )
    where
        F: Fn(f64) -> Option<(f64, f64)>, // im -> Some((edp, time)) or None
    {
        // Hunt phase: find collapse IM
        let mut im_current = im_initial;
        let mut im_step = im_initial;
        let mut found_collapse = false;

        while im_current <= im_max && !found_collapse {
            if let Some((edp, time)) = analyze(im_current) {
                self.add_point(im_current, edp, true, time);

                // Check collapse criteria
                if self.check_collapse(im_current, edp) {
                    found_collapse = true;
                    self.im_collapse = Some(im_current);
                } else {
                    im_current += im_step;
                    im_step *= 1.5;  // Accelerate hunting
                }
            } else {
                self.add_point(im_current, f64::INFINITY, false, 0.0);
                self.im_collapse = Some(im_current);
                found_collapse = true;
            }
        }

        // Fill phase: add intermediate points
        let im_collapse = self.im_collapse.unwrap_or(im_max);

        let mut ims_to_analyze = Vec::new();
        for i in 1..n_target_points {
            let im = im_initial + (im_collapse - im_initial) * i as f64 / n_target_points as f64;
            
            // Check if we already have a point near this IM
            let exists = self.points.iter().any(|p| (p.im - im).abs() < 0.05 * im);
            if !exists {
                ims_to_analyze.push(im);
            }
        }

        for im in ims_to_analyze {
            if let Some((edp, time)) = analyze(im) {
                self.add_point(im, edp, true, time);
            }
        }
    }

    fn check_collapse(&self, im: f64, edp: f64) -> bool {
        match self.collapse_criterion {
            CollapseCriterion::EDPThreshold(threshold) => edp > threshold,
            CollapseCriterion::SlopeThreshold(min_slope) => {
                if self.points.len() >= 2 {
                    let prev = &self.points[self.points.len() - 2];
                    let slope = (edp - prev.edp) / (im - prev.im).max(1e-10);
                    slope > 1.0 / min_slope  // Very steep = unstable
                } else {
                    false
                }
            }
            CollapseCriterion::NonConvergence => false,  // Handled externally
            CollapseCriterion::DynamicInstability => edp > 0.10,  // 10% drift default
        }
    }

    /// Interpolate EDP at given IM
    pub fn interpolate_edp(&self, im: f64) -> Option<f64> {
        if self.points.is_empty() {
            return None;
        }

        // Find bracketing points
        let mut lower = None;
        let mut upper = None;

        for point in &self.points {
            if point.im <= im {
                lower = Some(point);
            }
            if point.im >= im && upper.is_none() {
                upper = Some(point);
            }
        }

        match (lower, upper) {
            (Some(l), Some(u)) if l.im != u.im => {
                // Linear interpolation
                let t = (im - l.im) / (u.im - l.im);
                Some(l.edp + t * (u.edp - l.edp))
            }
            (Some(l), _) => Some(l.edp),
            (_, Some(u)) => Some(u.edp),
            _ => None,
        }
    }

    /// Get IM at specified EDP (inverse interpolation)
    pub fn im_at_edp(&self, edp_target: f64) -> Option<f64> {
        for i in 1..self.points.len() {
            let p0 = &self.points[i - 1];
            let p1 = &self.points[i];

            if (p0.edp <= edp_target && p1.edp >= edp_target) ||
               (p0.edp >= edp_target && p1.edp <= edp_target) {
                let t = (edp_target - p0.edp) / (p1.edp - p0.edp);
                return Some(p0.im + t * (p1.im - p0.im));
            }
        }

        None
    }
}

// ============================================================================
// MULTI-RECORD IDA (STATISTICAL)
// ============================================================================

/// Multi-record IDA analysis
#[derive(Debug, Clone)]
pub struct MultiRecordIDA {
    /// Individual IDA curves
    pub curves: Vec<SingleRecordIDA>,
    /// Summary statistics
    pub statistics: IDAStatistics,
    /// Fragility fit result
    pub fragility: Option<FragilityFit>,
}

/// IDA summary statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IDAStatistics {
    /// Median (50th percentile) collapse IM
    pub im_collapse_median: f64,
    /// 16th percentile collapse IM
    pub im_collapse_16: f64,
    /// 84th percentile collapse IM
    pub im_collapse_84: f64,
    /// Dispersion (β = 0.5 * ln(84th/16th))
    pub dispersion: f64,
    /// Record-to-record variability
    pub beta_rtr: f64,
    /// Collapse margin ratio
    pub cmr: f64,
    /// MCE-level spectral acceleration
    pub sa_mce: f64,
}

impl MultiRecordIDA {
    pub fn new() -> Self {
        MultiRecordIDA {
            curves: Vec::new(),
            statistics: IDAStatistics {
                im_collapse_median: 0.0,
                im_collapse_16: 0.0,
                im_collapse_84: 0.0,
                dispersion: 0.0,
                beta_rtr: 0.0,
                cmr: 0.0,
                sa_mce: 0.0,
            },
            fragility: None,
        }
    }

    pub fn add_curve(&mut self, curve: SingleRecordIDA) {
        self.curves.push(curve);
    }

    /// Compute statistics from IDA curves
    pub fn compute_statistics(&mut self, sa_mce: f64) {
        if self.curves.is_empty() {
            return;
        }

        // Collect collapse IM values
        let mut collapse_ims: Vec<f64> = self.curves.iter()
            .filter_map(|c| c.im_collapse)
            .collect();

        if collapse_ims.is_empty() {
            return;
        }

        collapse_ims.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let n = collapse_ims.len();

        // Percentiles
        self.statistics.im_collapse_16 = self.percentile(&collapse_ims, 0.16);
        self.statistics.im_collapse_median = self.percentile(&collapse_ims, 0.50);
        self.statistics.im_collapse_84 = self.percentile(&collapse_ims, 0.84);

        // Dispersion (lognormal)
        self.statistics.dispersion = 0.5 * (
            self.statistics.im_collapse_84 / self.statistics.im_collapse_16
        ).ln();

        // Record-to-record variability
        let ln_values: Vec<f64> = collapse_ims.iter().map(|&x| x.ln()).collect();
        let mean_ln = ln_values.iter().sum::<f64>() / n as f64;
        let var_ln = ln_values.iter()
            .map(|&x| (x - mean_ln).powi(2))
            .sum::<f64>() / (n - 1).max(1) as f64;
        self.statistics.beta_rtr = var_ln.sqrt();

        // Collapse Margin Ratio
        self.statistics.sa_mce = sa_mce;
        self.statistics.cmr = self.statistics.im_collapse_median / sa_mce;
    }

    fn percentile(&self, sorted: &[f64], p: f64) -> f64 {
        if sorted.is_empty() {
            return 0.0;
        }
        
        let idx = (p * (sorted.len() - 1) as f64) as usize;
        let frac = p * (sorted.len() - 1) as f64 - idx as f64;

        if idx + 1 < sorted.len() {
            sorted[idx] + frac * (sorted[idx + 1] - sorted[idx])
        } else {
            sorted[idx]
        }
    }

    /// Fit collapse fragility curve
    pub fn fit_fragility(&mut self) {
        let collapse_ims: Vec<f64> = self.curves.iter()
            .filter_map(|c| c.im_collapse)
            .collect();

        if collapse_ims.len() < 3 {
            return;
        }

        // Maximum likelihood estimation for lognormal
        let ln_ims: Vec<f64> = collapse_ims.iter().map(|&x| x.ln()).collect();
        let n = ln_ims.len() as f64;

        let mu = ln_ims.iter().sum::<f64>() / n;
        let sigma = (ln_ims.iter().map(|&x| (x - mu).powi(2)).sum::<f64>() / (n - 1.0)).sqrt();

        let median = mu.exp();
        let dispersion = sigma;

        self.fragility = Some(FragilityFit {
            median,
            dispersion,
            distribution: FragilityDistribution::Lognormal,
            im_type: self.curves.first()
                .map(|c| c.im_type)
                .unwrap_or(IntensityMeasure::SaT1),
        });
    }

    /// Get interpolated EDP percentiles at given IM
    pub fn edp_percentiles(&self, im: f64) -> (f64, f64, f64) {
        let edps: Vec<f64> = self.curves.iter()
            .filter_map(|c| c.interpolate_edp(im))
            .collect();

        if edps.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let mut sorted = edps.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let p16 = self.percentile(&sorted, 0.16);
        let p50 = self.percentile(&sorted, 0.50);
        let p84 = self.percentile(&sorted, 0.84);

        (p16, p50, p84)
    }
}

impl Default for MultiRecordIDA {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// FRAGILITY FITTING
// ============================================================================

/// Fragility distribution type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FragilityDistribution {
    Lognormal,
    Weibull,
    Normal,
}

/// Fitted fragility curve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FragilityFit {
    /// Median capacity (θ)
    pub median: f64,
    /// Total dispersion (β)
    pub dispersion: f64,
    /// Distribution type
    pub distribution: FragilityDistribution,
    /// Intensity measure type
    pub im_type: IntensityMeasure,
}

impl FragilityFit {
    /// Probability of exceeding damage state at given IM
    pub fn probability_of_exceedance(&self, im: f64) -> f64 {
        if im <= 0.0 {
            return 0.0;
        }

        match self.distribution {
            FragilityDistribution::Lognormal => {
                let z = (im / self.median).ln() / self.dispersion;
                standard_normal_cdf(z)
            }
            FragilityDistribution::Normal => {
                let z = (im - self.median) / (self.median * self.dispersion);
                standard_normal_cdf(z)
            }
            FragilityDistribution::Weibull => {
                let k = 1.0 / self.dispersion;  // Shape parameter
                let lambda = self.median;       // Scale parameter
                1.0 - (-(im / lambda).powf(k)).exp()
            }
        }
    }

    /// IM at specified probability
    pub fn im_at_probability(&self, prob: f64) -> f64 {
        match self.distribution {
            FragilityDistribution::Lognormal => {
                let z = standard_normal_inverse(prob);
                self.median * (z * self.dispersion).exp()
            }
            FragilityDistribution::Normal => {
                let z = standard_normal_inverse(prob);
                self.median * (1.0 + z * self.dispersion)
            }
            FragilityDistribution::Weibull => {
                let k = 1.0 / self.dispersion;
                self.median * (-((1.0 - prob).ln())).powf(1.0 / k)
            }
        }
    }
}

// ============================================================================
// FEMA P-695 COLLAPSE ASSESSMENT
// ============================================================================

/// FEMA P-695 collapse assessment
#[derive(Debug, Clone)]
pub struct FEMAP695Assessment {
    /// Multi-record IDA results
    pub ida_results: MultiRecordIDA,
    /// Design spectral acceleration
    pub smt: f64,
    /// MCE-level spectral acceleration
    pub sa_mce: f64,
    /// Spectral shape factor (SSF)
    pub ssf: f64,
    /// Total system uncertainty (βTOT)
    pub beta_total: f64,
    /// Adjusted collapse margin ratio (ACMR)
    pub acmr: f64,
    /// Acceptable ACMR (from Table 7-3)
    pub acmr_acceptable: f64,
    /// Pass/fail result
    pub passes: bool,
}

impl FEMAP695Assessment {
    pub fn new(ida: MultiRecordIDA, smt: f64, sa_mce: f64) -> Self {
        FEMAP695Assessment {
            ida_results: ida,
            smt,
            sa_mce,
            ssf: 1.0,
            beta_total: 0.0,
            acmr: 0.0,
            acmr_acceptable: 0.0,
            passes: false,
        }
    }

    /// Compute SSF (Spectral Shape Factor) per FEMA P-695 Table 7-1
    pub fn compute_ssf(&mut self, period: f64, _period_ratio: f64, ductility: f64) {
        // Simplified SSF calculation
        // SSF = exp(β1 * (ε(μ) - ε(T)))
        // where ε values are from regression analysis

        let mu = ductility.max(1.0);
        
        // Approximate SSF for SDC D
        let ssf_base = match period {
            t if t <= 0.5 => 1.05,
            t if t <= 1.0 => 1.10,
            t if t <= 2.0 => 1.15,
            _ => 1.20,
        };

        // Adjust for ductility
        let ssf_mu = if mu > 2.0 {
            ssf_base * (1.0 + 0.05 * (mu - 2.0).min(4.0))
        } else {
            ssf_base
        };

        self.ssf = ssf_mu.min(1.50);
    }

    /// Compute total system uncertainty per Table 7-2
    pub fn compute_beta_total(
        &mut self,
        beta_rtr: f64,      // Record-to-record (from IDA)
        beta_dr: f64,       // Design requirements (0.10-0.50)
        beta_td: f64,       // Test data (0.10-0.50)
        beta_mdl: f64,      // Modeling (0.10-0.50)
    ) {
        // SRSS combination
        self.beta_total = (beta_rtr.powi(2) + beta_dr.powi(2) 
            + beta_td.powi(2) + beta_mdl.powi(2)).sqrt();

        // Cap per FEMA P-695
        self.beta_total = self.beta_total.max(0.40).min(0.95);
    }

    /// Perform collapse assessment
    pub fn assess(&mut self) {
        // Compute CMR
        let cmr = self.ida_results.statistics.im_collapse_median / self.smt;

        // Adjusted CMR
        self.acmr = self.ssf * cmr;

        // Acceptable ACMR from Table 7-3 (interpolated)
        // For 10% collapse probability and given β_total
        self.acmr_acceptable = self.get_acceptable_acmr(0.10, self.beta_total);

        // Check pass/fail
        self.passes = self.acmr >= self.acmr_acceptable;
    }

    /// Get acceptable ACMR from FEMA P-695 Table 7-3
    fn get_acceptable_acmr(&self, _collapse_prob: f64, beta: f64) -> f64 {
        // Interpolation of Table 7-3 for 10% collapse probability
        let beta_values = [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
        let acmr_values = [1.56, 1.66, 1.77, 1.88, 2.01, 2.14, 2.28, 2.43, 2.59];

        // Linear interpolation
        for i in 0..(beta_values.len() - 1) {
            if beta >= beta_values[i] && beta <= beta_values[i + 1] {
                let t = (beta - beta_values[i]) / (beta_values[i + 1] - beta_values[i]);
                return acmr_values[i] + t * (acmr_values[i + 1] - acmr_values[i]);
            }
        }

        // Extrapolate if outside range
        if beta < beta_values[0] {
            acmr_values[0]
        } else {
            acmr_values[acmr_values.len() - 1]
        }
    }
}

// ============================================================================
// STRIPE ANALYSIS (Alternative to IDA)
// ============================================================================

/// Stripe analysis for fragility assessment
#[derive(Debug, Clone)]
pub struct StripeAnalysis {
    /// IM levels analyzed
    pub im_levels: Vec<f64>,
    /// Number of analyses per stripe
    pub n_per_stripe: usize,
    /// Results: collapse fraction at each IM
    pub collapse_fractions: Vec<f64>,
    /// Fitted fragility
    pub fragility: Option<FragilityFit>,
}

impl StripeAnalysis {
    pub fn new(im_levels: Vec<f64>, n_per_stripe: usize) -> Self {
        StripeAnalysis {
            im_levels,
            n_per_stripe,
            collapse_fractions: Vec::new(),
            fragility: None,
        }
    }

    /// Add stripe result (number of collapses out of n_per_stripe)
    pub fn add_stripe_result(&mut self, im: f64, n_collapse: usize) {
        let idx = self.im_levels.iter().position(|&x| (x - im).abs() < 1e-6);
        
        if let Some(i) = idx {
            if self.collapse_fractions.len() <= i {
                self.collapse_fractions.resize(i + 1, 0.0);
            }
            self.collapse_fractions[i] = n_collapse as f64 / self.n_per_stripe as f64;
        }
    }

    /// Fit fragility using maximum likelihood
    pub fn fit_fragility(&mut self, im_type: IntensityMeasure) {
        if self.collapse_fractions.len() < 2 {
            return;
        }

        // Maximum likelihood for lognormal fragility
        // Use grid search for simplicity
        let mut best_ll = f64::NEG_INFINITY;
        let mut best_median = 1.0;
        let mut best_beta = 0.3;

        for median in (1..100).map(|i| i as f64 * 0.05) {
            for beta in (1..50).map(|i| i as f64 * 0.02 + 0.1) {
                let ll = self.log_likelihood(median, beta);
                if ll > best_ll {
                    best_ll = ll;
                    best_median = median;
                    best_beta = beta;
                }
            }
        }

        self.fragility = Some(FragilityFit {
            median: best_median,
            dispersion: best_beta,
            distribution: FragilityDistribution::Lognormal,
            im_type,
        });
    }

    fn log_likelihood(&self, median: f64, beta: f64) -> f64 {
        let mut ll = 0.0;

        for (i, &im) in self.im_levels.iter().enumerate() {
            if i >= self.collapse_fractions.len() {
                continue;
            }

            let p = lognormal_cdf(im, median, beta);
            let n = self.n_per_stripe as f64;
            let k = (self.collapse_fractions[i] * n).round();

            // Binomial log-likelihood
            ll += k * p.max(1e-10).ln() + (n - k) * (1.0 - p).max(1e-10).ln();
        }

        ll
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


fn lognormal_cdf(x: f64, median: f64, beta: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    let z = (x / median).ln() / beta;
    standard_normal_cdf(z)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_record_ida() {
        let mut ida = SingleRecordIDA::new(
            "GM001",
            IntensityMeasure::SaT1,
            DemandParameter::MaxIDR,
        );

        ida.add_point(0.1, 0.005, true, 10.0);
        ida.add_point(0.2, 0.012, true, 12.0);
        ida.add_point(0.3, 0.025, true, 15.0);
        ida.add_point(0.4, 0.045, true, 18.0);
        ida.add_point(0.5, 0.080, true, 20.0);
        ida.add_point(0.6, f64::INFINITY, false, 0.0);

        ida.im_collapse = Some(0.6);

        // Test interpolation
        let edp = ida.interpolate_edp(0.25);
        assert!(edp.is_some());
        assert!(edp.unwrap() > 0.012 && edp.unwrap() < 0.025);
    }

    #[test]
    fn test_fragility_fit() {
        let fragility = FragilityFit {
            median: 1.0,
            dispersion: 0.4,
            distribution: FragilityDistribution::Lognormal,
            im_type: IntensityMeasure::SaT1,
        };

        // At median, probability should be 50%
        let p_median = fragility.probability_of_exceedance(1.0);
        assert!((p_median - 0.5).abs() < 0.01);

        // IM at 50% should be median
        let im_50 = fragility.im_at_probability(0.5);
        assert!((im_50 - 1.0).abs() < 0.01);
    }
}
