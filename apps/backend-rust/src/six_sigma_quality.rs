//! Six Sigma & Quality Engineering Methods
//!
//! Industry-standard quality control and design for Six Sigma.
//! Critical gap vs Minitab, JMP, SigmaXL.
//!
//! ## Industry Gap Analysis
//!
//! | Feature | Minitab | JMP | SigmaXL | This Module |
//! |---------|---------|-----|---------|-------------|
//! | Process Capability (Cp, Cpk) | ✓ | ✓ | ✓ | ✓ |
//! | Tolerance Analysis | ✓ | ✓ | ✗ | ✓ |
//! | Gage R&R | ✓ | ✓ | ✓ | ✓ |
//! | Control Charts | ✓ | ✓ | ✓ | ✓ |
//! | DoE (Full Factorial) | ✓ | ✓ | ✓ | ✓ |
//! | FMEA | ✗ | ✓ | ✗ | ✓ |

use serde::Serialize;
use std::f64::consts::PI;
use crate::special_functions::*;


fn standard_normal_inverse_cdf(p: f64) -> f64 {
    2.0_f64.sqrt() * crate::special_functions::erfinv(2.0 * p - 1.0)
}

// ============================================================================
// PROCESS CAPABILITY ANALYSIS
// ============================================================================

/// Process capability indices
/// Industry standard: Minitab, ISO 22514, AIAG
#[derive(Debug, Clone, Serialize)]
pub struct ProcessCapability {
    /// Process mean
    pub mean: f64,
    /// Process standard deviation
    pub std_dev: f64,
    /// Upper specification limit
    pub usl: Option<f64>,
    /// Lower specification limit
    pub lsl: Option<f64>,
    /// Target value
    pub target: Option<f64>,
    
    // Capability indices
    /// Cp: Potential capability (spread)
    pub cp: Option<f64>,
    /// Cpk: Actual capability (accounts for centering)
    pub cpk: Option<f64>,
    /// Cpm: Taguchi capability (accounts for target)
    pub cpm: Option<f64>,
    /// Pp: Process performance
    pub pp: Option<f64>,
    /// Ppk: Process performance (centered)
    pub ppk: Option<f64>,
    
    // PPM estimates
    /// Parts per million below LSL
    pub ppm_below_lsl: f64,
    /// Parts per million above USL
    pub ppm_above_usl: f64,
    /// Total PPM out of spec
    pub ppm_total: f64,
    
    /// Sigma level (Z score)
    pub sigma_level: f64,
}

impl ProcessCapability {
    pub fn new(data: &[f64], usl: Option<f64>, lsl: Option<f64>, target: Option<f64>) -> Self {
        let n = data.len() as f64;
        
        // Calculate mean
        let mean = data.iter().sum::<f64>() / n;
        
        // Calculate standard deviation (sample, n-1)
        let variance = data.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (n - 1.0);
        let std_dev = variance.sqrt();

        let mut cap = ProcessCapability {
            mean,
            std_dev,
            usl,
            lsl,
            target,
            cp: None,
            cpk: None,
            cpm: None,
            pp: None,
            ppk: None,
            ppm_below_lsl: 0.0,
            ppm_above_usl: 0.0,
            ppm_total: 0.0,
            sigma_level: 0.0,
        };

        cap.calculate_indices();
        cap
    }

    /// Calculate all capability indices
    fn calculate_indices(&mut self) {
        let sigma = self.std_dev;

        // Cp: Potential capability
        if let (Some(usl), Some(lsl)) = (self.usl, self.lsl) {
            self.cp = Some((usl - lsl) / (6.0 * sigma));
        }

        // Cpk: Actual capability (considers centering)
        let cpu = self.usl.map(|u| (u - self.mean) / (3.0 * sigma));
        let cpl = self.lsl.map(|l| (self.mean - l) / (3.0 * sigma));
        
        self.cpk = match (cpu, cpl) {
            (Some(u), Some(l)) => Some(u.min(l)),
            (Some(u), None) => Some(u),
            (None, Some(l)) => Some(l),
            _ => None,
        };

        // Cpm: Taguchi capability (accounts for target)
        if let (Some(usl), Some(lsl), Some(target)) = (self.usl, self.lsl, self.target) {
            let tau_sq = sigma * sigma + (self.mean - target).powi(2);
            self.cpm = Some((usl - lsl) / (6.0 * tau_sq.sqrt()));
        }

        // Pp/Ppk (using overall variance - same as Cp/Cpk for single sample)
        self.pp = self.cp;
        self.ppk = self.cpk;

        // PPM calculations
        if let Some(lsl) = self.lsl {
            let z_lsl = (lsl - self.mean) / sigma;
            self.ppm_below_lsl = standard_normal_cdf(z_lsl) * 1_000_000.0;
        }

        if let Some(usl) = self.usl {
            let z_usl = (usl - self.mean) / sigma;
            self.ppm_above_usl = (1.0 - standard_normal_cdf(z_usl)) * 1_000_000.0;
        }

        self.ppm_total = self.ppm_below_lsl + self.ppm_above_usl;

        // Sigma level
        if self.ppm_total > 0.0 {
            // Z = -Φ^(-1)(PPM/1e6)
            let defect_rate = self.ppm_total / 1_000_000.0;
            self.sigma_level = -standard_normal_inverse_cdf(defect_rate / 2.0);
        } else {
            self.sigma_level = 6.0; // Perfect quality
        }
    }

    /// Capability with subgroups (for Pp/Ppk distinction)
    pub fn with_subgroups(data: &[Vec<f64>], usl: Option<f64>, lsl: Option<f64>) -> Self {
        // Flatten data
        let all_data: Vec<f64> = data.iter().flatten().cloned().collect();
        let n_total = all_data.len() as f64;
        
        let mean = all_data.iter().sum::<f64>() / n_total;
        
        // Within-group variance (for Cp)
        let mut within_var = 0.0;
        let mut df = 0.0;
        
        for group in data {
            let group_mean = group.iter().sum::<f64>() / group.len() as f64;
            for &x in group {
                within_var += (x - group_mean).powi(2);
            }
            df += (group.len() - 1) as f64;
        }
        let sigma_within = (within_var / df).sqrt();

        // Overall variance (for Pp)
        let sigma_overall = (all_data.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() 
            / (n_total - 1.0)).sqrt();

        let mut cap = ProcessCapability {
            mean,
            std_dev: sigma_within,
            usl,
            lsl,
            target: None,
            cp: None,
            cpk: None,
            cpm: None,
            pp: None,
            ppk: None,
            ppm_below_lsl: 0.0,
            ppm_above_usl: 0.0,
            ppm_total: 0.0,
            sigma_level: 0.0,
        };

        // Cp/Cpk with within-group sigma
        if let (Some(usl), Some(lsl)) = (usl, lsl) {
            cap.cp = Some((usl - lsl) / (6.0 * sigma_within));
        }

        let cpu = usl.map(|u| (u - mean) / (3.0 * sigma_within));
        let cpl = lsl.map(|l| (mean - l) / (3.0 * sigma_within));
        cap.cpk = match (cpu, cpl) {
            (Some(u), Some(l)) => Some(u.min(l)),
            (Some(u), None) => Some(u),
            (None, Some(l)) => Some(l),
            _ => None,
        };

        // Pp/Ppk with overall sigma
        if let (Some(usl), Some(lsl)) = (usl, lsl) {
            cap.pp = Some((usl - lsl) / (6.0 * sigma_overall));
        }

        let ppu = usl.map(|u| (u - mean) / (3.0 * sigma_overall));
        let ppl = lsl.map(|l| (mean - l) / (3.0 * sigma_overall));
        cap.ppk = match (ppu, ppl) {
            (Some(u), Some(l)) => Some(u.min(l)),
            (Some(u), None) => Some(u),
            (None, Some(l)) => Some(l),
            _ => None,
        };

        cap
    }
}

// ============================================================================
// TOLERANCE ANALYSIS
// ============================================================================

/// Statistical tolerance analysis
/// Industry standard: Minitab, CETOL, 3DCS
#[derive(Debug, Clone)]
pub struct ToleranceAnalysis {
    /// Component dimensions with tolerances
    pub components: Vec<ToleranceComponent>,
    /// Assembly method
    pub method: AssemblyMethod,
    /// Results
    pub nominal_assembly: f64,
    pub worst_case_min: f64,
    pub worst_case_max: f64,
    pub rss_std_dev: f64,
    pub rss_min: f64,
    pub rss_max: f64,
    pub six_sigma_min: f64,
    pub six_sigma_max: f64,
}

#[derive(Debug, Clone)]
pub struct ToleranceComponent {
    pub name: String,
    pub nominal: f64,
    pub tolerance_plus: f64,
    pub tolerance_minus: f64,
    pub distribution: ToleranceDistribution,
    pub sensitivity: f64,  // dY/dX coefficient
}

#[derive(Debug, Clone, Copy)]
pub enum ToleranceDistribution {
    /// Normal: σ = tolerance/3 (99.7% coverage)
    Normal,
    /// Uniform (worst case)
    Uniform,
    /// Triangular (manufacturing)
    Triangular,
    /// Truncated normal (inspection)
    TruncatedNormal,
}

#[derive(Debug, Clone, Copy)]
pub enum AssemblyMethod {
    /// Linear stack: Y = Σ a_i * X_i
    Linear,
    /// Gap/Clearance: Y = X_1 - X_2
    Gap,
    /// Custom (uses sensitivity coefficients)
    Custom,
}

impl ToleranceAnalysis {
    pub fn new(components: Vec<ToleranceComponent>, method: AssemblyMethod) -> Self {
        let mut ta = ToleranceAnalysis {
            components,
            method,
            nominal_assembly: 0.0,
            worst_case_min: 0.0,
            worst_case_max: 0.0,
            rss_std_dev: 0.0,
            rss_min: 0.0,
            rss_max: 0.0,
            six_sigma_min: 0.0,
            six_sigma_max: 0.0,
        };
        ta.analyze();
        ta
    }

    fn analyze(&mut self) {
        // Nominal assembly
        self.nominal_assembly = self.components.iter()
            .map(|c| c.sensitivity * c.nominal)
            .sum();

        // Worst case analysis
        let mut wc_min = self.nominal_assembly;
        let mut wc_max = self.nominal_assembly;

        for comp in &self.components {
            if comp.sensitivity >= 0.0 {
                wc_min += comp.sensitivity * (-comp.tolerance_minus.abs());
                wc_max += comp.sensitivity * comp.tolerance_plus.abs();
            } else {
                wc_min += comp.sensitivity * comp.tolerance_plus.abs();
                wc_max += comp.sensitivity * (-comp.tolerance_minus.abs());
            }
        }

        self.worst_case_min = wc_min;
        self.worst_case_max = wc_max;

        // RSS analysis
        let variance: f64 = self.components.iter()
            .map(|c| {
                let sigma = c.component_std_dev();
                (c.sensitivity * sigma).powi(2)
            })
            .sum();

        self.rss_std_dev = variance.sqrt();

        // 3-sigma limits
        self.rss_min = self.nominal_assembly - 3.0 * self.rss_std_dev;
        self.rss_max = self.nominal_assembly + 3.0 * self.rss_std_dev;

        // 6-sigma limits
        self.six_sigma_min = self.nominal_assembly - 6.0 * self.rss_std_dev;
        self.six_sigma_max = self.nominal_assembly + 6.0 * self.rss_std_dev;
    }

    /// Monte Carlo tolerance simulation
    pub fn monte_carlo(&self, n_simulations: usize) -> ToleranceMCResult {
        let mut rng_state = 42u64;
        let mut results = Vec::with_capacity(n_simulations);

        for _ in 0..n_simulations {
            let assembly: f64 = self.components.iter()
                .map(|c| {
                    let dim = c.sample(&mut rng_state);
                    c.sensitivity * dim
                })
                .sum();
            results.push(assembly);
        }

        // Statistics
        let mean = results.iter().sum::<f64>() / n_simulations as f64;
        let variance = results.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() 
            / (n_simulations - 1) as f64;
        let std_dev = variance.sqrt();

        let mut sorted = results.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        ToleranceMCResult {
            mean,
            std_dev,
            min: sorted[0],
            max: sorted[n_simulations - 1],
            percentile_0_135: sorted[(0.00135 * n_simulations as f64) as usize],
            percentile_99_865: sorted[(0.99865 * n_simulations as f64) as usize],
            results,
        }
    }
}

impl ToleranceComponent {
    fn component_std_dev(&self) -> f64 {
        let half_tol = (self.tolerance_plus + self.tolerance_minus.abs()) / 2.0;
        
        match self.distribution {
            ToleranceDistribution::Normal => half_tol / 3.0,
            ToleranceDistribution::Uniform => half_tol / 3.0_f64.sqrt(),
            ToleranceDistribution::Triangular => half_tol / 6.0_f64.sqrt(),
            ToleranceDistribution::TruncatedNormal => half_tol / 3.0 * 0.95,
        }
    }

    fn sample(&self, rng_state: &mut u64) -> f64 {
        let half_tol = (self.tolerance_plus + self.tolerance_minus.abs()) / 2.0;
        
        match self.distribution {
            ToleranceDistribution::Normal => {
                let z = box_muller_normal(rng_state);
                self.nominal + z * half_tol / 3.0
            }
            ToleranceDistribution::Uniform => {
                let u = lcg_random(rng_state) * 2.0 - 1.0;
                self.nominal + u * half_tol
            }
            ToleranceDistribution::Triangular => {
                let u1 = lcg_random(rng_state);
                let u2 = lcg_random(rng_state);
                self.nominal + (u1 + u2 - 1.0) * half_tol
            }
            ToleranceDistribution::TruncatedNormal => {
                loop {
                    let z = box_muller_normal(rng_state);
                    if z.abs() <= 3.0 {
                        return self.nominal + z * half_tol / 3.0;
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct ToleranceMCResult {
    pub mean: f64,
    pub std_dev: f64,
    pub min: f64,
    pub max: f64,
    pub percentile_0_135: f64,
    pub percentile_99_865: f64,
    pub results: Vec<f64>,
}

// ============================================================================
// GAGE R&R ANALYSIS
// ============================================================================

/// Gage R&R (Measurement System Analysis)
/// Industry standard: AIAG MSA Manual, Minitab
#[derive(Debug, Clone)]
pub struct GageRR {
    /// Measurements: [operator][part][replicate]
    pub measurements: Vec<Vec<Vec<f64>>>,
    /// Number of operators
    pub n_operators: usize,
    /// Number of parts
    pub n_parts: usize,
    /// Number of replicates
    pub n_replicates: usize,
    
    // Results
    /// Repeatability variance (equipment variation)
    pub repeatability: f64,
    /// Reproducibility variance (operator variation)
    pub reproducibility: f64,
    /// Operator x Part interaction
    pub interaction: f64,
    /// Part-to-part variance
    pub part_variation: f64,
    /// Total Gage R&R
    pub total_grr: f64,
    /// Total variation
    pub total_variation: f64,
    /// %GRR
    pub percent_grr: f64,
    /// %PV (Part Variation)
    pub percent_pv: f64,
    /// Number of distinct categories (ndc)
    pub ndc: f64,
}

impl GageRR {
    pub fn new(measurements: Vec<Vec<Vec<f64>>>) -> Self {
        let n_operators = measurements.len();
        let n_parts = measurements[0].len();
        let n_replicates = measurements[0][0].len();

        let mut grr = GageRR {
            measurements,
            n_operators,
            n_parts,
            n_replicates,
            repeatability: 0.0,
            reproducibility: 0.0,
            interaction: 0.0,
            part_variation: 0.0,
            total_grr: 0.0,
            total_variation: 0.0,
            percent_grr: 0.0,
            percent_pv: 0.0,
            ndc: 0.0,
        };
        
        grr.analyze_anova();
        grr
    }

    fn analyze_anova(&mut self) {
        let o = self.n_operators as f64;
        let p = self.n_parts as f64;
        let r = self.n_replicates as f64;
        let n = o * p * r;

        // Grand mean
        let grand_mean: f64 = self.measurements.iter()
            .flat_map(|op| op.iter().flat_map(|part| part.iter()))
            .sum::<f64>() / n;

        // Operator means
        let op_means: Vec<f64> = self.measurements.iter()
            .map(|op| {
                op.iter().flat_map(|part| part.iter()).sum::<f64>() / (p * r)
            })
            .collect();

        // Part means
        let part_means: Vec<f64> = (0..self.n_parts)
            .map(|j| {
                self.measurements.iter()
                    .flat_map(|op| op[j].iter())
                    .sum::<f64>() / (o * r)
            })
            .collect();

        // Cell means (operator x part)
        let cell_means: Vec<Vec<f64>> = self.measurements.iter()
            .map(|op| {
                op.iter().map(|part| part.iter().sum::<f64>() / r).collect()
            })
            .collect();

        // Sum of squares
        // SS_operator
        let ss_op: f64 = op_means.iter()
            .map(|&m| p * r * (m - grand_mean).powi(2))
            .sum();

        // SS_part
        let ss_part: f64 = part_means.iter()
            .map(|&m| o * r * (m - grand_mean).powi(2))
            .sum();

        // SS_interaction (operator x part)
        let mut ss_int = 0.0;
        for i in 0..self.n_operators {
            for j in 0..self.n_parts {
                let cell_effect = cell_means[i][j] - op_means[i] - part_means[j] + grand_mean;
                ss_int += r * cell_effect.powi(2);
            }
        }

        // SS_error (repeatability)
        let mut ss_error = 0.0;
        for i in 0..self.n_operators {
            for j in 0..self.n_parts {
                for k in 0..self.n_replicates {
                    ss_error += (self.measurements[i][j][k] - cell_means[i][j]).powi(2);
                }
            }
        }

        // Degrees of freedom
        let df_op = o - 1.0;
        let df_part = p - 1.0;
        let df_int = (o - 1.0) * (p - 1.0);
        let df_error = o * p * (r - 1.0);

        // Mean squares
        let ms_op = ss_op / df_op;
        let ms_part = ss_part / df_part;
        let ms_int = ss_int / df_int;
        let ms_error = ss_error / df_error;

        // Variance components
        self.repeatability = ms_error;
        
        // Interaction (can be negative, set to 0)
        let var_int = ((ms_int - ms_error) / r).max(0.0);
        self.interaction = var_int;

        // Reproducibility = operator + operator x part interaction
        let var_op = ((ms_op - ms_int) / (p * r)).max(0.0);
        self.reproducibility = var_op + var_int;

        // Part variation
        self.part_variation = ((ms_part - ms_int) / (o * r)).max(0.0);

        // Total GRR
        self.total_grr = self.repeatability + self.reproducibility;
        
        // Total variation
        self.total_variation = self.total_grr + self.part_variation;

        // Percentages (using study variation = 6*sigma)
        let sigma_grr = self.total_grr.sqrt();
        let sigma_pv = self.part_variation.sqrt();
        let sigma_tv = self.total_variation.sqrt();

        self.percent_grr = 100.0 * sigma_grr / sigma_tv;
        self.percent_pv = 100.0 * sigma_pv / sigma_tv;

        // Number of distinct categories
        self.ndc = (1.41 * sigma_pv / sigma_grr).floor().max(1.0);
    }

    /// Acceptability based on AIAG guidelines
    pub fn acceptability(&self) -> GageAcceptability {
        if self.percent_grr < 10.0 {
            GageAcceptability::Acceptable
        } else if self.percent_grr < 30.0 {
            GageAcceptability::Marginal
        } else {
            GageAcceptability::Unacceptable
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GageAcceptability {
    Acceptable,    // %GRR < 10%
    Marginal,      // 10% ≤ %GRR < 30%
    Unacceptable,  // %GRR ≥ 30%
}

// ============================================================================
// CONTROL CHARTS
// ============================================================================

/// Statistical Process Control Charts
/// Industry standard: Minitab, AIAG SPC Manual
#[derive(Debug, Clone)]
pub struct ControlChart {
    pub chart_type: ControlChartType,
    pub subgroups: Vec<Vec<f64>>,
    pub center_line: f64,
    pub upper_control_limit: f64,
    pub lower_control_limit: f64,
    pub plotted_values: Vec<f64>,
    pub out_of_control: Vec<usize>,
    pub run_rules_violations: Vec<(usize, String)>,
}

#[derive(Debug, Clone, Copy)]
pub enum ControlChartType {
    /// X-bar chart (subgroup means)
    XBar,
    /// R chart (subgroup ranges)
    Range,
    /// S chart (subgroup std dev)
    StdDev,
    /// Individual values (I chart)
    Individual,
    /// Moving range
    MovingRange,
    /// p-chart (proportion defective)
    P { n: usize },
    /// np-chart (count defective)
    NP { n: usize },
    /// c-chart (defects per unit)
    C,
    /// u-chart (defects per unit, variable sample size)
    U,
}

impl ControlChart {
    pub fn new(subgroups: Vec<Vec<f64>>, chart_type: ControlChartType) -> Self {
        let mut chart = ControlChart {
            chart_type,
            subgroups: subgroups.clone(),
            center_line: 0.0,
            upper_control_limit: 0.0,
            lower_control_limit: 0.0,
            plotted_values: Vec::new(),
            out_of_control: Vec::new(),
            run_rules_violations: Vec::new(),
        };
        
        chart.calculate_limits();
        chart.check_control();
        chart.apply_run_rules();
        
        chart
    }

    fn calculate_limits(&mut self) {
        match self.chart_type {
            ControlChartType::XBar => self.calculate_xbar_limits(),
            ControlChartType::Range => self.calculate_r_limits(),
            ControlChartType::StdDev => self.calculate_s_limits(),
            ControlChartType::Individual => self.calculate_i_limits(),
            ControlChartType::MovingRange => self.calculate_mr_limits(),
            ControlChartType::P { n } => self.calculate_p_limits(n),
            ControlChartType::NP { n } => self.calculate_np_limits(n),
            ControlChartType::C => self.calculate_c_limits(),
            ControlChartType::U => self.calculate_u_limits(),
        }
    }

    fn calculate_xbar_limits(&mut self) {
        let n = self.subgroups[0].len();
        let a2 = self.get_a2(n);
        
        // Subgroup means
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg.iter().sum::<f64>() / sg.len() as f64)
            .collect();
        
        // Subgroup ranges
        let ranges: Vec<f64> = self.subgroups.iter()
            .map(|sg| {
                let max = sg.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                let min = sg.iter().cloned().fold(f64::INFINITY, f64::min);
                max - min
            })
            .collect();

        let x_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;
        let r_bar = ranges.iter().sum::<f64>() / ranges.len() as f64;

        self.center_line = x_bar;
        self.upper_control_limit = x_bar + a2 * r_bar;
        self.lower_control_limit = x_bar - a2 * r_bar;
    }

    fn calculate_r_limits(&mut self) {
        let n = self.subgroups[0].len();
        let d3 = self.get_d3(n);
        let d4 = self.get_d4(n);

        self.plotted_values = self.subgroups.iter()
            .map(|sg| {
                let max = sg.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                let min = sg.iter().cloned().fold(f64::INFINITY, f64::min);
                max - min
            })
            .collect();

        let r_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;

        self.center_line = r_bar;
        self.upper_control_limit = d4 * r_bar;
        self.lower_control_limit = d3 * r_bar;
    }

    fn calculate_s_limits(&mut self) {
        let n = self.subgroups[0].len();
        let b3 = self.get_b3(n);
        let b4 = self.get_b4(n);

        self.plotted_values = self.subgroups.iter()
            .map(|sg| {
                let mean = sg.iter().sum::<f64>() / sg.len() as f64;
                let var = sg.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / (sg.len() - 1) as f64;
                var.sqrt()
            })
            .collect();

        let s_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;

        self.center_line = s_bar;
        self.upper_control_limit = b4 * s_bar;
        self.lower_control_limit = b3 * s_bar;
    }

    fn calculate_i_limits(&mut self) {
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg[0])
            .collect();

        // Moving ranges
        let mr: Vec<f64> = self.plotted_values.windows(2)
            .map(|w| (w[1] - w[0]).abs())
            .collect();

        let x_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;
        let mr_bar = mr.iter().sum::<f64>() / mr.len() as f64;

        self.center_line = x_bar;
        self.upper_control_limit = x_bar + 2.66 * mr_bar;
        self.lower_control_limit = x_bar - 2.66 * mr_bar;
    }

    fn calculate_mr_limits(&mut self) {
        let values: Vec<f64> = self.subgroups.iter()
            .map(|sg| sg[0])
            .collect();

        self.plotted_values = values.windows(2)
            .map(|w| (w[1] - w[0]).abs())
            .collect();

        let mr_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;

        self.center_line = mr_bar;
        self.upper_control_limit = 3.267 * mr_bar;
        self.lower_control_limit = 0.0;
    }

    fn calculate_p_limits(&mut self, n: usize) {
        // Subgroups contain count of defectives
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg[0] / n as f64)
            .collect();

        let p_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;

        self.center_line = p_bar;
        let sigma = (p_bar * (1.0 - p_bar) / n as f64).sqrt();
        self.upper_control_limit = (p_bar + 3.0 * sigma).min(1.0);
        self.lower_control_limit = (p_bar - 3.0 * sigma).max(0.0);
    }

    fn calculate_np_limits(&mut self, n: usize) {
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg[0])
            .collect();

        let np_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;
        let p_bar = np_bar / n as f64;

        self.center_line = np_bar;
        let sigma = (np_bar * (1.0 - p_bar)).sqrt();
        self.upper_control_limit = np_bar + 3.0 * sigma;
        self.lower_control_limit = (np_bar - 3.0 * sigma).max(0.0);
    }

    fn calculate_c_limits(&mut self) {
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg[0])
            .collect();

        let c_bar = self.plotted_values.iter().sum::<f64>() / self.plotted_values.len() as f64;

        self.center_line = c_bar;
        self.upper_control_limit = c_bar + 3.0 * c_bar.sqrt();
        self.lower_control_limit = (c_bar - 3.0 * c_bar.sqrt()).max(0.0);
    }

    fn calculate_u_limits(&mut self) {
        // Assume subgroup has [count, size]
        self.plotted_values = self.subgroups.iter()
            .map(|sg| sg[0] / sg[1])
            .collect();

        let total_count: f64 = self.subgroups.iter().map(|sg| sg[0]).sum();
        let total_n: f64 = self.subgroups.iter().map(|sg| sg[1]).sum();
        let u_bar = total_count / total_n;

        self.center_line = u_bar;
        // Use average n for limits
        let avg_n = total_n / self.subgroups.len() as f64;
        self.upper_control_limit = u_bar + 3.0 * (u_bar / avg_n).sqrt();
        self.lower_control_limit = (u_bar - 3.0 * (u_bar / avg_n).sqrt()).max(0.0);
    }

    fn check_control(&mut self) {
        self.out_of_control = self.plotted_values.iter().enumerate()
            .filter(|(_, &val)| val > self.upper_control_limit || val < self.lower_control_limit)
            .map(|(i, _)| i)
            .collect();
    }

    fn apply_run_rules(&mut self) {
        self.run_rules_violations.clear();
        
        // Rule 1: Point beyond 3σ (already in out_of_control)
        for &i in &self.out_of_control {
            self.run_rules_violations.push((i, "Rule 1: Beyond 3σ".to_string()));
        }

        // Rule 2: 9 points in a row on same side of center
        self.check_run(9, "Rule 2: 9 points same side");

        // Rule 3: 6 points steadily increasing or decreasing
        self.check_trend(6, "Rule 3: 6 point trend");

        // Rule 4: 14 points alternating up and down
        self.check_alternating(14, "Rule 4: 14 alternating");
    }

    fn check_run(&mut self, length: usize, rule_name: &str) {
        if self.plotted_values.len() < length { return; }
        
        let mut above_count = 0;
        let mut below_count = 0;
        
        for (i, &val) in self.plotted_values.iter().enumerate() {
            if val > self.center_line {
                above_count += 1;
                below_count = 0;
            } else if val < self.center_line {
                below_count += 1;
                above_count = 0;
            }

            if above_count >= length || below_count >= length {
                self.run_rules_violations.push((i, rule_name.to_string()));
            }
        }
    }

    fn check_trend(&mut self, length: usize, rule_name: &str) {
        if self.plotted_values.len() < length { return; }
        
        for i in (length - 1)..self.plotted_values.len() {
            let window = &self.plotted_values[(i + 1 - length)..=i];
            
            let increasing = window.windows(2).all(|w| w[1] > w[0]);
            let decreasing = window.windows(2).all(|w| w[1] < w[0]);
            
            if increasing || decreasing {
                self.run_rules_violations.push((i, rule_name.to_string()));
            }
        }
    }

    fn check_alternating(&mut self, length: usize, rule_name: &str) {
        if self.plotted_values.len() < length { return; }
        
        for i in (length - 1)..self.plotted_values.len() {
            let window = &self.plotted_values[(i + 1 - length)..=i];
            
            let alternating = window.windows(3).all(|w| {
                (w[1] > w[0] && w[1] > w[2]) || (w[1] < w[0] && w[1] < w[2])
            });
            
            if alternating {
                self.run_rules_violations.push((i, rule_name.to_string()));
            }
        }
    }

    // Control chart constants
    fn get_a2(&self, n: usize) -> f64 {
        match n {
            2 => 1.880, 3 => 1.023, 4 => 0.729, 5 => 0.577,
            6 => 0.483, 7 => 0.419, 8 => 0.373, 9 => 0.337, 10 => 0.308,
            _ => 3.0 / (n as f64).sqrt()
        }
    }

    fn get_d3(&self, n: usize) -> f64 {
        match n {
            2 => 0.0, 3 => 0.0, 4 => 0.0, 5 => 0.0,
            6 => 0.0, 7 => 0.076, 8 => 0.136, 9 => 0.184, 10 => 0.223,
            _ => 0.0
        }
    }

    fn get_d4(&self, n: usize) -> f64 {
        match n {
            2 => 3.267, 3 => 2.574, 4 => 2.282, 5 => 2.114,
            6 => 2.004, 7 => 1.924, 8 => 1.864, 9 => 1.816, 10 => 1.777,
            _ => 1.0 + 3.0 / (2.0 * n as f64 - 1.0).sqrt()
        }
    }

    fn get_b3(&self, n: usize) -> f64 {
        match n {
            2 => 0.0, 3 => 0.0, 4 => 0.0, 5 => 0.0,
            6 => 0.030, 7 => 0.118, 8 => 0.185, 9 => 0.239, 10 => 0.284,
            _ => 1.0 - 3.0 / (4.0 * n as f64 - 4.0).sqrt()
        }
    }

    fn get_b4(&self, n: usize) -> f64 {
        match n {
            2 => 3.267, 3 => 2.568, 4 => 2.266, 5 => 2.089,
            6 => 1.970, 7 => 1.882, 8 => 1.815, 9 => 1.761, 10 => 1.716,
            _ => 1.0 + 3.0 / (4.0 * n as f64 - 4.0).sqrt()
        }
    }
}

// ============================================================================
// DESIGN OF EXPERIMENTS (DOE)
// ============================================================================

/// Full Factorial Design
/// Industry standard: Minitab, JMP, Design-Expert
#[derive(Debug, Clone)]
pub struct FullFactorial {
    pub factors: Vec<Factor>,
    pub design_matrix: Vec<Vec<f64>>,
    pub n_runs: usize,
}

#[derive(Debug, Clone)]
pub struct Factor {
    pub name: String,
    pub levels: Vec<f64>,
}

impl FullFactorial {
    pub fn new(factors: Vec<Factor>) -> Self {
        let n_runs: usize = factors.iter().map(|f| f.levels.len()).product();
        
        let mut design = FullFactorial {
            factors,
            design_matrix: Vec::new(),
            n_runs,
        };
        
        design.generate();
        design
    }

    fn generate(&mut self) {
        self.design_matrix = Vec::with_capacity(self.n_runs);
        
        let n_factors = self.factors.len();
        let level_counts: Vec<usize> = self.factors.iter()
            .map(|f| f.levels.len())
            .collect();

        for run in 0..self.n_runs {
            let mut setting = Vec::with_capacity(n_factors);
            let mut temp = run;
            
            for (i, factor) in self.factors.iter().enumerate() {
                let level_idx = temp % level_counts[i];
                setting.push(factor.levels[level_idx]);
                temp /= level_counts[i];
            }
            
            self.design_matrix.push(setting);
        }
    }

    /// Analyze factorial experiment
    pub fn analyze(&self, responses: &[f64]) -> FactorialAnalysis {
        assert_eq!(responses.len(), self.n_runs);
        
        // Calculate main effects and interactions
        let n_factors = self.factors.len();
        let mut main_effects = Vec::new();

        for (f_idx, factor) in self.factors.iter().enumerate() {
            let n_levels = factor.levels.len();
            let mut level_means = vec![0.0; n_levels];
            let mut level_counts = vec![0usize; n_levels];

            for (run, &response) in responses.iter().enumerate() {
                let level_idx = factor.levels.iter()
                    .position(|&l| (l - self.design_matrix[run][f_idx]).abs() < 1e-10)
                    .unwrap();
                level_means[level_idx] += response;
                level_counts[level_idx] += 1;
            }

            for i in 0..n_levels {
                level_means[i] /= level_counts[i] as f64;
            }

            let effect = if n_levels == 2 {
                level_means[1] - level_means[0]
            } else {
                level_means.iter().max_by(|a, b| a.partial_cmp(b).unwrap()).unwrap()
                - level_means.iter().min_by(|a, b| a.partial_cmp(b).unwrap()).unwrap()
            };

            main_effects.push((factor.name.clone(), effect));
        }

        // Calculate two-factor interactions (for 2-level factors)
        let mut interactions = Vec::new();
        
        if self.factors.iter().all(|f| f.levels.len() == 2) {
            for i in 0..n_factors {
                for j in (i + 1)..n_factors {
                    let mut int_effect = 0.0;
                    let mut count = 0;

                    for (run, &response) in responses.iter().enumerate() {
                        let xi = if self.design_matrix[run][i] == self.factors[i].levels[0] { -1.0 } else { 1.0 };
                        let xj = if self.design_matrix[run][j] == self.factors[j].levels[0] { -1.0 } else { 1.0 };
                        int_effect += xi * xj * response;
                        count += 1;
                    }

                    int_effect /= count as f64;
                    interactions.push((
                        format!("{} x {}", self.factors[i].name, self.factors[j].name),
                        int_effect * 2.0  // Scale to match main effect
                    ));
                }
            }
        }

        FactorialAnalysis {
            main_effects,
            interactions,
            grand_mean: responses.iter().sum::<f64>() / responses.len() as f64,
        }
    }
}

#[derive(Debug, Clone)]
pub struct FactorialAnalysis {
    pub main_effects: Vec<(String, f64)>,
    pub interactions: Vec<(String, f64)>,
    pub grand_mean: f64,
}

// ============================================================================
// FMEA (FAILURE MODE AND EFFECTS ANALYSIS)
// ============================================================================

/// Failure Mode and Effects Analysis
/// Industry standard: AIAG FMEA Manual, SAE J1739
#[derive(Debug, Clone)]
pub struct FMEA {
    pub items: Vec<FMEAItem>,
}

#[derive(Debug, Clone)]
pub struct FMEAItem {
    pub function: String,
    pub failure_mode: String,
    pub effects: String,
    pub causes: String,
    pub current_controls: String,
    /// Severity (1-10)
    pub severity: u8,
    /// Occurrence (1-10)
    pub occurrence: u8,
    /// Detection (1-10)
    pub detection: u8,
    /// Risk Priority Number
    pub rpn: u16,
    /// Action Priority (AP) - new AIAG method
    pub action_priority: ActionPriority,
    pub recommended_actions: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ActionPriority {
    High,
    Medium,
    Low,
}

impl FMEA {
    pub fn new() -> Self {
        FMEA { items: Vec::new() }
    }

    pub fn add_item(
        &mut self,
        function: &str,
        failure_mode: &str,
        effects: &str,
        causes: &str,
        current_controls: &str,
        severity: u8,
        occurrence: u8,
        detection: u8,
        recommended_actions: &str,
    ) {
        let severity = severity.clamp(1, 10);
        let occurrence = occurrence.clamp(1, 10);
        let detection = detection.clamp(1, 10);

        let rpn = severity as u16 * occurrence as u16 * detection as u16;
        let action_priority = Self::calculate_ap(severity, occurrence, detection);

        self.items.push(FMEAItem {
            function: function.to_string(),
            failure_mode: failure_mode.to_string(),
            effects: effects.to_string(),
            causes: causes.to_string(),
            current_controls: current_controls.to_string(),
            severity,
            occurrence,
            detection,
            rpn,
            action_priority,
            recommended_actions: recommended_actions.to_string(),
        });
    }

    fn calculate_ap(severity: u8, occurrence: u8, detection: u8) -> ActionPriority {
        // AIAG-VDA FMEA Action Priority logic
        if severity >= 9 && occurrence >= 4 {
            return ActionPriority::High;
        }
        if severity >= 9 && occurrence >= 2 && detection >= 7 {
            return ActionPriority::High;
        }
        if severity >= 6 && occurrence >= 5 {
            return ActionPriority::High;
        }
        if severity >= 5 && occurrence >= 4 && detection >= 5 {
            return ActionPriority::Medium;
        }
        if severity >= 7 && occurrence >= 3 {
            return ActionPriority::Medium;
        }
        
        ActionPriority::Low
    }

    /// Get items sorted by RPN (highest first)
    pub fn sorted_by_rpn(&self) -> Vec<&FMEAItem> {
        let mut sorted: Vec<&FMEAItem> = self.items.iter().collect();
        sorted.sort_by(|a, b| b.rpn.cmp(&a.rpn));
        sorted
    }

    /// Get items by action priority
    pub fn high_priority_items(&self) -> Vec<&FMEAItem> {
        self.items.iter()
            .filter(|item| item.action_priority == ActionPriority::High)
            .collect()
    }

    /// Pareto analysis of failure modes
    pub fn pareto_analysis(&self) -> Vec<(&FMEAItem, f64)> {
        let total_rpn: u16 = self.items.iter().map(|i| i.rpn).sum();
        let sorted = self.sorted_by_rpn();
        
        let mut cumulative = 0.0;
        sorted.iter()
            .map(|&item| {
                cumulative += item.rpn as f64 / total_rpn as f64 * 100.0;
                (item, cumulative)
            })
            .collect()
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

fn lcg_random(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
    (*state as f64) / (u64::MAX as f64)
}

fn box_muller_normal(state: &mut u64) -> f64 {
    let u1 = lcg_random(state);
    let u2 = lcg_random(state);
    (-2.0 * u1.ln()).sqrt() * (2.0 * PI * u2).cos()
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_capability() {
        let data: Vec<f64> = (0..100).map(|i| 50.0 + (i as f64 * 0.1) % 2.0 - 1.0).collect();
        let cap = ProcessCapability::new(&data, Some(52.0), Some(48.0), Some(50.0));
        
        assert!(cap.cp.unwrap() > 0.0);
        assert!(cap.cpk.unwrap() > 0.0);
        assert!(cap.sigma_level > 0.0);
    }

    #[test]
    fn test_tolerance_analysis() {
        let components = vec![
            ToleranceComponent {
                name: "Part A".to_string(),
                nominal: 10.0,
                tolerance_plus: 0.1,
                tolerance_minus: 0.1,
                distribution: ToleranceDistribution::Normal,
                sensitivity: 1.0,
            },
            ToleranceComponent {
                name: "Part B".to_string(),
                nominal: 5.0,
                tolerance_plus: 0.05,
                tolerance_minus: 0.05,
                distribution: ToleranceDistribution::Normal,
                sensitivity: 1.0,
            },
        ];
        
        let ta = ToleranceAnalysis::new(components, AssemblyMethod::Linear);
        
        assert!((ta.nominal_assembly - 15.0).abs() < 0.001);
        assert!(ta.rss_std_dev > 0.0);
    }

    #[test]
    fn test_gage_rr() {
        // 2 operators, 3 parts, 2 replicates
        let measurements = vec![
            vec![vec![10.0, 10.1], vec![20.0, 20.1], vec![30.0, 30.1]],
            vec![vec![10.2, 10.1], vec![20.2, 20.0], vec![30.1, 30.0]],
        ];
        
        let grr = GageRR::new(measurements);
        
        assert!(grr.percent_grr > 0.0 && grr.percent_grr < 100.0);
    }

    #[test]
    fn test_control_chart() {
        // Generate subgroups with some variation within each subgroup
        let mut rng_state = 42u64;
        let subgroups: Vec<Vec<f64>> = (0..25)
            .map(|i| {
                let base = 10.0 + (i % 3) as f64 * 0.1;
                (0..5).map(|_| {
                    // Add small variation within subgroup
                    rng_state = rng_state.wrapping_mul(6364136223846793005).wrapping_add(1);
                    let u = (rng_state as f64) / (u64::MAX as f64);
                    base + (u - 0.5) * 0.2
                }).collect()
            })
            .collect();
        
        let chart = ControlChart::new(subgroups, ControlChartType::XBar);
        
        // With variation, UCL should be above center and LCL below
        assert!(chart.upper_control_limit > chart.center_line);
        assert!(chart.lower_control_limit < chart.center_line);
    }

    #[test]
    fn test_full_factorial() {
        let factors = vec![
            Factor { name: "A".to_string(), levels: vec![-1.0, 1.0] },
            Factor { name: "B".to_string(), levels: vec![-1.0, 1.0] },
        ];
        
        let design = FullFactorial::new(factors);
        
        assert_eq!(design.n_runs, 4);
        assert_eq!(design.design_matrix.len(), 4);
    }

    #[test]
    fn test_fmea() {
        let mut fmea = FMEA::new();
        
        fmea.add_item(
            "Bearing support",
            "Excessive wear",
            "Vibration, noise",
            "Poor lubrication",
            "Visual inspection",
            8, 4, 6,
            "Improve lubrication system"
        );
        
        assert_eq!(fmea.items.len(), 1);
        assert_eq!(fmea.items[0].rpn, 192);
    }
}
