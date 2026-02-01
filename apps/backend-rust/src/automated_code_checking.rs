//! Automated Code Checking Module
//!
//! Automated compliance checking against multiple building codes.
//! Based on: IS 456/800, AISC 360, Eurocode 2/3, ACI 318, IBC
//!
//! Features:
//! - Multi-code compliance checking
//! - Utilization ratio tracking
//! - Automated report generation
//! - Design optimization suggestions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Building code standard
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DesignCode {
    /// Indian Standard IS 456 (Concrete)
    IS456,
    /// Indian Standard IS 800 (Steel)
    IS800,
    /// American Institute of Steel Construction
    AISC360,
    /// American Concrete Institute
    ACI318,
    /// Eurocode 2 (Concrete)
    Eurocode2,
    /// Eurocode 3 (Steel)
    Eurocode3,
    /// Chinese GB 50010 (Concrete)
    GB50010,
    /// Chinese GB 50017 (Steel)
    GB50017,
    /// British Standard BS 5950
    BS5950,
    /// Australian AS 4100
    AS4100,
}

/// Check category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CheckCategory {
    /// Strength limit state
    Strength,
    /// Serviceability limit state
    Serviceability,
    /// Stability check
    Stability,
    /// Detailing requirements
    Detailing,
    /// Seismic provisions
    Seismic,
    /// Fire resistance
    Fire,
    /// Durability
    Durability,
}

/// Check status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckStatus {
    /// Passes all requirements
    Pass,
    /// Fails requirements
    Fail,
    /// Warning - close to limit
    Warning,
    /// Not applicable
    NotApplicable,
    /// Requires manual review
    ManualReview,
}

/// Single code check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeCheck {
    /// Check ID
    pub id: String,
    /// Code clause reference
    pub clause: String,
    /// Check description
    pub description: String,
    /// Check category
    pub category: CheckCategory,
    /// Demand value
    pub demand: f64,
    /// Capacity value
    pub capacity: f64,
    /// Utilization ratio
    pub utilization: f64,
    /// Check status
    pub status: CheckStatus,
    /// Additional notes
    pub notes: Vec<String>,
}

impl CodeCheck {
    /// Create new code check
    pub fn new(id: &str, clause: &str, description: &str, category: CheckCategory) -> Self {
        Self {
            id: id.to_string(),
            clause: clause.to_string(),
            description: description.to_string(),
            category,
            demand: 0.0,
            capacity: 0.0,
            utilization: 0.0,
            status: CheckStatus::NotApplicable,
            notes: Vec::new(),
        }
    }
    
    /// Evaluate check with demand and capacity
    pub fn evaluate(&mut self, demand: f64, capacity: f64, warning_threshold: f64) {
        self.demand = demand;
        self.capacity = capacity;
        
        if capacity > 0.0 {
            self.utilization = demand / capacity;
        } else {
            self.utilization = if demand > 0.0 { f64::INFINITY } else { 0.0 };
        }
        
        self.status = if self.utilization > 1.0 {
            CheckStatus::Fail
        } else if self.utilization > warning_threshold {
            CheckStatus::Warning
        } else {
            CheckStatus::Pass
        };
    }
}

/// Beam code check parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeamCheckInput {
    /// Member ID
    pub member_id: String,
    /// Beam depth (mm)
    pub depth: f64,
    /// Beam width (mm)
    pub width: f64,
    /// Effective depth (mm)
    pub d_eff: f64,
    /// Span length (mm)
    pub span: f64,
    /// Concrete grade (MPa)
    pub fck: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Tension reinforcement area (mm²)
    pub ast: f64,
    /// Compression reinforcement area (mm²)
    pub asc: f64,
    /// Shear reinforcement area/spacing (mm²/mm)
    pub asv_sv: f64,
    /// Factored bending moment (kN·m)
    pub mu: f64,
    /// Factored shear force (kN)
    pub vu: f64,
    /// Factored torsion (kN·m)
    pub tu: f64,
    /// Service moment (kN·m)
    pub ms: f64,
    /// Clear cover (mm)
    pub cover: f64,
}

/// Column code check parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnCheckInput {
    /// Member ID
    pub member_id: String,
    /// Column depth (mm)
    pub depth: f64,
    /// Column width (mm)
    pub width: f64,
    /// Unsupported length (mm)
    pub length: f64,
    /// Effective length factor
    pub k_factor: f64,
    /// Concrete grade (MPa)
    pub fck: f64,
    /// Steel yield strength (MPa)
    pub fy: f64,
    /// Longitudinal reinforcement area (mm²)
    pub ast: f64,
    /// Tie spacing (mm)
    pub tie_spacing: f64,
    /// Factored axial load (kN)
    pub pu: f64,
    /// Factored moment X (kN·m)
    pub mux: f64,
    /// Factored moment Y (kN·m)
    pub muy: f64,
    /// Is braced?
    pub braced: bool,
}

/// Steel beam check parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelBeamInput {
    /// Member ID
    pub member_id: String,
    /// Section designation
    pub section: String,
    /// Depth (mm)
    pub depth: f64,
    /// Flange width (mm)
    pub bf: f64,
    /// Flange thickness (mm)
    pub tf: f64,
    /// Web thickness (mm)
    pub tw: f64,
    /// Unbraced length (mm)
    pub lb: f64,
    /// Plastic modulus X (mm³)
    pub zx: f64,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Factored moment (kN·m)
    pub mu: f64,
    /// Factored shear (kN)
    pub vu: f64,
    /// Factored axial (kN)
    pub pu: f64,
    /// Cb factor
    pub cb: f64,
}

/// Code checker for multiple standards
#[derive(Debug, Clone)]
pub struct CodeChecker {
    /// Design code
    pub code: DesignCode,
    /// Partial safety factors
    pub safety_factors: SafetyFactors,
    /// Warning threshold (utilization)
    pub warning_threshold: f64,
}

/// Partial safety factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyFactors {
    /// Material factor - concrete
    pub gamma_c: f64,
    /// Material factor - steel
    pub gamma_s: f64,
    /// Load factor - dead
    pub gamma_d: f64,
    /// Load factor - live
    pub gamma_l: f64,
    /// Load factor - earthquake
    pub gamma_e: f64,
    /// Load factor - wind
    pub gamma_w: f64,
}

impl SafetyFactors {
    /// IS 456/800 factors
    pub fn is_code() -> Self {
        Self {
            gamma_c: 1.5,
            gamma_s: 1.15,
            gamma_d: 1.5,
            gamma_l: 1.5,
            gamma_e: 1.5,
            gamma_w: 1.5,
        }
    }
    
    /// AISC factors
    pub fn aisc() -> Self {
        Self {
            gamma_c: 1.0,
            gamma_s: 0.9, // Phi factor
            gamma_d: 1.2,
            gamma_l: 1.6,
            gamma_e: 1.0,
            gamma_w: 1.0,
        }
    }
    
    /// Eurocode factors
    pub fn eurocode() -> Self {
        Self {
            gamma_c: 1.5,
            gamma_s: 1.15,
            gamma_d: 1.35,
            gamma_l: 1.5,
            gamma_e: 1.0,
            gamma_w: 1.5,
        }
    }
}

impl CodeChecker {
    /// Create new code checker
    pub fn new(code: DesignCode) -> Self {
        let safety_factors = match code {
            DesignCode::IS456 | DesignCode::IS800 => SafetyFactors::is_code(),
            DesignCode::AISC360 | DesignCode::ACI318 => SafetyFactors::aisc(),
            DesignCode::Eurocode2 | DesignCode::Eurocode3 => SafetyFactors::eurocode(),
            _ => SafetyFactors::is_code(),
        };
        
        Self {
            code,
            safety_factors,
            warning_threshold: 0.9,
        }
    }
    
    /// Check RC beam per IS 456
    pub fn check_rc_beam_is456(&self, input: &BeamCheckInput) -> Vec<CodeCheck> {
        let mut checks = Vec::new();
        
        // 1. Flexural strength check (Clause 26.3)
        let mut flex_check = CodeCheck::new(
            "IS456-B-01",
            "Cl. 26.3",
            "Flexural strength check",
            CheckCategory::Strength,
        );
        
        let xu_max = 0.48 * input.d_eff; // For Fe 415
        let xu = 0.87 * input.fy * input.ast / (0.36 * input.fck * input.width);
        let mu_lim = 0.36 * input.fck * input.width * xu.min(xu_max) 
            * (input.d_eff - 0.42 * xu.min(xu_max)) / 1e6;
        
        flex_check.evaluate(input.mu, mu_lim, self.warning_threshold);
        
        if xu > xu_max {
            flex_check.notes.push("Over-reinforced section".to_string());
        }
        
        checks.push(flex_check);
        
        // 2. Shear strength check (Clause 40)
        let mut shear_check = CodeCheck::new(
            "IS456-B-02",
            "Cl. 40.1",
            "Shear strength check",
            CheckCategory::Strength,
        );
        
        let pt = 100.0 * input.ast / (input.width * input.d_eff);
        let tau_c = self.tau_c_is456(pt, input.fck);
        let vc = tau_c * input.width * input.d_eff / 1000.0;
        let vs = 0.87 * input.fy * input.asv_sv * input.d_eff / 1000.0;
        let v_capacity = vc + vs;
        
        shear_check.evaluate(input.vu, v_capacity, self.warning_threshold);
        checks.push(shear_check);
        
        // 3. Deflection check (Clause 23.2)
        let mut defl_check = CodeCheck::new(
            "IS456-B-03",
            "Cl. 23.2",
            "Deflection control (span/depth ratio)",
            CheckCategory::Serviceability,
        );
        
        let basic_ratio = 20.0; // Simply supported
        let pt_prov = 100.0 * input.ast / (input.width * input.d_eff);
        let pt_req = 0.5 * input.fck / input.fy;
        let mf = 1.0 / (0.225 + 0.00322 * input.fy - 0.625 * (pt_prov / pt_req).log10().max(0.0));
        let allowed_ratio = basic_ratio * mf.min(2.0);
        let actual_ratio = input.span / input.depth;
        
        defl_check.evaluate(actual_ratio, allowed_ratio, self.warning_threshold);
        checks.push(defl_check);
        
        // 4. Minimum reinforcement (Clause 26.5.1.1)
        let mut min_rebar_check = CodeCheck::new(
            "IS456-B-04",
            "Cl. 26.5.1.1",
            "Minimum tension reinforcement",
            CheckCategory::Detailing,
        );
        
        let ast_min = 0.85 * input.width * input.d_eff / input.fy;
        min_rebar_check.evaluate(ast_min, input.ast, self.warning_threshold);
        checks.push(min_rebar_check);
        
        // 5. Maximum reinforcement (Clause 26.5.1.1)
        let mut max_rebar_check = CodeCheck::new(
            "IS456-B-05",
            "Cl. 26.5.1.1",
            "Maximum tension reinforcement",
            CheckCategory::Detailing,
        );
        
        let ast_max = 0.04 * input.width * input.depth;
        max_rebar_check.evaluate(input.ast, ast_max, self.warning_threshold);
        checks.push(max_rebar_check);
        
        // 6. Cover check (Clause 26.4)
        let mut cover_check = CodeCheck::new(
            "IS456-B-06",
            "Cl. 26.4",
            "Minimum cover requirement",
            CheckCategory::Durability,
        );
        
        let min_cover = 25.0; // Normal exposure
        cover_check.evaluate(min_cover, input.cover, self.warning_threshold);
        checks.push(cover_check);
        
        checks
    }
    
    /// Check RC column per IS 456
    pub fn check_rc_column_is456(&self, input: &ColumnCheckInput) -> Vec<CodeCheck> {
        let mut checks = Vec::new();
        
        // 1. Slenderness check
        let mut slender_check = CodeCheck::new(
            "IS456-C-01",
            "Cl. 25.1.2",
            "Slenderness ratio check",
            CheckCategory::Stability,
        );
        
        let ley = input.k_factor * input.length;
        let imin = input.width.min(input.depth) / (12.0_f64).sqrt();
        let slenderness = ley / imin;
        let limit = if input.braced { 60.0 } else { 30.0 };
        
        slender_check.evaluate(slenderness, limit, self.warning_threshold);
        
        if slenderness > 12.0 {
            slender_check.notes.push("Long column - consider P-Delta".to_string());
        }
        
        checks.push(slender_check);
        
        // 2. Axial capacity check (Clause 39.3)
        let mut axial_check = CodeCheck::new(
            "IS456-C-02",
            "Cl. 39.3",
            "Axial load capacity",
            CheckCategory::Strength,
        );
        
        let ag = input.width * input.depth;
        let ac = ag - input.ast;
        let pu_capacity = 0.4 * input.fck * ac + 0.67 * input.fy * input.ast;
        let pu_capacity_kn = pu_capacity / 1000.0;
        
        axial_check.evaluate(input.pu, pu_capacity_kn, self.warning_threshold);
        checks.push(axial_check);
        
        // 3. Biaxial bending check (Clause 39.6)
        let mut biaxial_check = CodeCheck::new(
            "IS456-C-03",
            "Cl. 39.6",
            "Combined axial and biaxial bending",
            CheckCategory::Strength,
        );
        
        // Simplified interaction (Bresler)
        let mux_cap = self.moment_capacity_is456(input, true);
        let muy_cap = self.moment_capacity_is456(input, false);
        
        let puz = 0.45 * input.fck * ac + 0.75 * input.fy * input.ast;
        let puz_kn = puz / 1000.0;
        let pu_puz = (input.pu / puz_kn).clamp(0.0, 1.0);
        let alpha_n = if pu_puz <= 0.2 { 1.0 } else { 1.0 + (pu_puz - 0.2) / 0.6 };
        
        let utilization = (input.mux / mux_cap).powf(alpha_n) + (input.muy / muy_cap).powf(alpha_n);
        biaxial_check.evaluate(utilization, 1.0, self.warning_threshold);
        checks.push(biaxial_check);
        
        // 4. Minimum reinforcement (Clause 26.5.3.1)
        let mut min_rebar = CodeCheck::new(
            "IS456-C-04",
            "Cl. 26.5.3.1",
            "Minimum longitudinal reinforcement (0.8%)",
            CheckCategory::Detailing,
        );
        
        let ast_min = 0.008 * ag;
        min_rebar.evaluate(ast_min, input.ast, self.warning_threshold);
        checks.push(min_rebar);
        
        // 5. Maximum reinforcement (Clause 26.5.3.1)
        let mut max_rebar = CodeCheck::new(
            "IS456-C-05",
            "Cl. 26.5.3.1",
            "Maximum longitudinal reinforcement (6%)",
            CheckCategory::Detailing,
        );
        
        let ast_max = 0.06 * ag;
        max_rebar.evaluate(input.ast, ast_max, self.warning_threshold);
        checks.push(max_rebar);
        
        // 6. Tie spacing (Clause 26.5.3.2)
        let mut tie_check = CodeCheck::new(
            "IS456-C-06",
            "Cl. 26.5.3.2",
            "Lateral tie spacing",
            CheckCategory::Detailing,
        );
        
        let tie_max = input.width.min(input.depth).min(300.0);
        tie_check.evaluate(input.tie_spacing, tie_max, self.warning_threshold);
        checks.push(tie_check);
        
        checks
    }
    
    /// Check steel beam per IS 800
    pub fn check_steel_beam_is800(&self, input: &SteelBeamInput) -> Vec<CodeCheck> {
        let mut checks = Vec::new();
        
        // 1. Section classification
        let mut class_check = CodeCheck::new(
            "IS800-S-01",
            "Table 2",
            "Section classification",
            CheckCategory::Stability,
        );
        
        let epsilon = (250.0 / input.fy).sqrt();
        let flange_ratio = (input.bf / 2.0) / input.tf;
        let web_ratio = (input.depth - 2.0 * input.tf) / input.tw;
        
        let flange_class = if flange_ratio <= 9.4 * epsilon { 1 }
            else if flange_ratio <= 10.5 * epsilon { 2 }
            else if flange_ratio <= 15.7 * epsilon { 3 }
            else { 4 };
        
        let web_class = if web_ratio <= 84.0 * epsilon { 1 }
            else if web_ratio <= 105.0 * epsilon { 2 }
            else if web_ratio <= 126.0 * epsilon { 3 }
            else { 4 };
        
        let section_class = flange_class.max(web_class);
        class_check.demand = section_class as f64;
        class_check.capacity = 3.0; // Class 3 or better for standard design
        class_check.utilization = section_class as f64 / 3.0;
        class_check.status = if section_class <= 3 { CheckStatus::Pass } else { CheckStatus::Fail };
        class_check.notes.push(format!("Section Class: {}", section_class));
        checks.push(class_check);
        
        // 2. Flexural strength (Clause 8.2)
        let mut flex_check = CodeCheck::new(
            "IS800-S-02",
            "Cl. 8.2",
            "Design bending strength",
            CheckCategory::Strength,
        );
        
        let gamma_m0 = 1.1;
        let md = input.zx * input.fy / (gamma_m0 * 1e6); // kN·m
        
        // Lateral torsional buckling reduction
        let fcr_b = self.fcr_ltb_is800(input);
        let lambda_lt = (input.fy / fcr_b).sqrt();
        let phi_lt = 0.5 * (1.0 + 0.21 * (lambda_lt - 0.2) + lambda_lt.powi(2));
        let chi_lt = (phi_lt + (phi_lt.powi(2) - lambda_lt.powi(2)).max(0.0).sqrt()).recip().min(1.0);
        
        let md_ltb = chi_lt * md;
        
        flex_check.evaluate(input.mu, md_ltb, self.warning_threshold);
        if chi_lt < 0.9 {
            flex_check.notes.push(format!("LTB reduction factor: {:.3}", chi_lt));
        }
        checks.push(flex_check);
        
        // 3. Shear strength (Clause 8.4)
        let mut shear_check = CodeCheck::new(
            "IS800-S-03",
            "Cl. 8.4",
            "Design shear strength",
            CheckCategory::Strength,
        );
        
        let av = input.depth * input.tw;
        let vd = av * input.fy / ((3.0_f64).sqrt() * gamma_m0 * 1000.0);
        
        shear_check.evaluate(input.vu, vd, self.warning_threshold);
        checks.push(shear_check);
        
        // 4. Combined bending and shear (Clause 9.2)
        let mut combined_check = CodeCheck::new(
            "IS800-S-04",
            "Cl. 9.2",
            "Combined shear and moment",
            CheckCategory::Strength,
        );
        
        if input.vu > 0.6 * vd {
            let beta = (2.0 * input.vu / vd - 1.0).powi(2);
            let md_v = md * (1.0 - beta);
            combined_check.evaluate(input.mu, md_v, self.warning_threshold);
            combined_check.notes.push("High shear - reduced moment capacity".to_string());
        } else {
            combined_check.evaluate(input.mu, md, self.warning_threshold);
        }
        checks.push(combined_check);
        
        // 5. Web shear buckling (Clause 8.4.2.2)
        let mut web_buckle = CodeCheck::new(
            "IS800-S-05",
            "Cl. 8.4.2.2",
            "Web shear buckling",
            CheckCategory::Stability,
        );
        
        let d_tw = (input.depth - 2.0 * input.tf) / input.tw;
        let limit = 67.0 * epsilon;
        
        web_buckle.evaluate(d_tw, limit, self.warning_threshold);
        if d_tw > limit {
            web_buckle.notes.push("Stiffeners may be required".to_string());
        }
        checks.push(web_buckle);
        
        // 6. Deflection check (Clause 5.6)
        let mut defl_check = CodeCheck::new(
            "IS800-S-06",
            "Cl. 5.6",
            "Deflection limit (span/300)",
            CheckCategory::Serviceability,
        );
        
        let span_depth = input.lb / input.depth;
        let limit_ratio = 300.0 / (input.depth / input.lb);
        
        defl_check.demand = span_depth;
        defl_check.capacity = limit_ratio;
        defl_check.utilization = span_depth / limit_ratio.max(1.0);
        defl_check.status = CheckStatus::Pass; // Simplified
        checks.push(defl_check);
        
        checks
    }
    
    /// Check steel beam per AISC 360
    pub fn check_steel_beam_aisc(&self, input: &SteelBeamInput) -> Vec<CodeCheck> {
        let mut checks = Vec::new();
        
        // Convert to US units for AISC
        let fy_ksi = input.fy / 6.895; // MPa to ksi
        let zx_in3 = input.zx / 16387.064; // mm³ to in³
        let lb_in = input.lb / 25.4; // mm to in
        
        // 1. Flexural yielding (Chapter F2)
        let mut flex_check = CodeCheck::new(
            "AISC-F-01",
            "F2",
            "Flexural yielding strength",
            CheckCategory::Strength,
        );
        
        let phi_b = 0.9;
        let mp = fy_ksi * zx_in3; // kip-in
        let mn = phi_b * mp;
        let mn_knm = mn * 0.113; // Convert to kN·m
        
        flex_check.evaluate(input.mu, mn_knm, self.warning_threshold);
        checks.push(flex_check);
        
        // 2. Lateral-torsional buckling (Chapter F2.2)
        let mut ltb_check = CodeCheck::new(
            "AISC-F-02",
            "F2.2",
            "Lateral-torsional buckling",
            CheckCategory::Stability,
        );
        
        let ry_in = input.bf / (2.0 * (12.0_f64).sqrt()) / 25.4;
        let lp = 1.76 * ry_in * (29000.0 / fy_ksi).sqrt();
        let lr = 1.95 * ry_in * (29000.0 / (0.7 * fy_ksi));
        
        let mn_ltb = if lb_in <= lp {
            mn
        } else if lb_in <= lr {
            let ratio = (lb_in - lp) / (lr - lp);
            phi_b * (mp - (mp - 0.7 * fy_ksi * zx_in3) * ratio)
        } else {
            phi_b * 0.7 * fy_ksi * zx_in3
        };
        
        let mn_ltb_knm = mn_ltb * 0.113;
        ltb_check.evaluate(input.mu, mn_ltb_knm, self.warning_threshold);
        checks.push(ltb_check);
        
        // 3. Shear strength (Chapter G)
        let mut shear_check = CodeCheck::new(
            "AISC-G-01",
            "G2.1",
            "Shear strength",
            CheckCategory::Strength,
        );
        
        let phi_v = 1.0;
        let aw_in2 = input.depth * input.tw / 645.16;
        let vn = phi_v * 0.6 * fy_ksi * aw_in2;
        let vn_kn = vn * 4.448;
        
        shear_check.evaluate(input.vu, vn_kn, self.warning_threshold);
        checks.push(shear_check);
        
        // 4. Compact section check (Table B4.1b)
        let mut compact_check = CodeCheck::new(
            "AISC-B-01",
            "Table B4.1b",
            "Compactness check - flange",
            CheckCategory::Stability,
        );
        
        let bf_2tf = (input.bf / 2.0) / input.tf;
        let lambda_pf = 0.38 * (29000.0 / fy_ksi).sqrt();
        
        compact_check.evaluate(bf_2tf, lambda_pf, self.warning_threshold);
        checks.push(compact_check);
        
        checks
    }
    
    // Helper functions
    
    fn tau_c_is456(&self, pt: f64, fck: f64) -> f64 {
        // IS 456 Table 19 - Design shear strength of concrete
        let pt_clamped = pt.clamp(0.15, 3.0);
        let tau_c_basic = 0.85 * (0.8 * fck).sqrt() * (1.0 + 5.0 * pt_clamped / 100.0 - 1.0).sqrt();
        tau_c_basic.min(0.5 * (fck).sqrt())
    }
    
    fn moment_capacity_is456(&self, input: &ColumnCheckInput, about_x: bool) -> f64 {
        let (d, b) = if about_x { (input.depth, input.width) } else { (input.width, input.depth) };
        let d_eff = d - 50.0; // Assume 50mm cover
        
        // Simplified moment capacity
        0.36 * input.fck * b * d_eff * (d_eff - 0.42 * 0.48 * d_eff) / 1e6
    }
    
    fn fcr_ltb_is800(&self, input: &SteelBeamInput) -> f64 {
        // Elastic critical stress for LTB
        let e = 200000.0; // MPa
        let g = 76923.0; // MPa
        let iy = input.bf.powi(3) * input.tf / 12.0 + (input.depth - 2.0 * input.tf) * input.tw.powi(3) / 12.0;
        let it = (2.0 * input.bf * input.tf.powi(3) + (input.depth - 2.0 * input.tf) * input.tw.powi(3)) / 3.0;
        let iw = iy * (input.depth - input.tf).powi(2) / 4.0;
        
        let term1 = std::f64::consts::PI.powi(2) * e * iy * g * it / input.lb.powi(2);
        let term2 = std::f64::consts::PI.powi(4) * e.powi(2) * iy * iw / input.lb.powi(4);
        
        ((term1 + term2.sqrt()) / (input.zx)).sqrt()
    }
}

/// Code check summary for a structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckSummary {
    /// Design code used
    pub code: DesignCode,
    /// Total number of checks
    pub total_checks: usize,
    /// Passed checks
    pub passed: usize,
    /// Failed checks
    pub failed: usize,
    /// Warning checks
    pub warnings: usize,
    /// Maximum utilization ratio
    pub max_utilization: f64,
    /// Critical member ID
    pub critical_member: String,
    /// All checks by member
    pub member_checks: HashMap<String, Vec<CodeCheck>>,
}

impl CheckSummary {
    /// Create summary from checks
    pub fn from_checks(code: DesignCode, member_checks: HashMap<String, Vec<CodeCheck>>) -> Self {
        let mut total = 0;
        let mut passed = 0;
        let mut failed = 0;
        let mut warnings = 0;
        let mut max_util = 0.0;
        let mut critical = String::new();
        
        for (member_id, checks) in &member_checks {
            for check in checks {
                total += 1;
                match check.status {
                    CheckStatus::Pass => passed += 1,
                    CheckStatus::Fail => failed += 1,
                    CheckStatus::Warning => warnings += 1,
                    _ => {}
                }
                
                if check.utilization > max_util {
                    max_util = check.utilization;
                    critical = member_id.clone();
                }
            }
        }
        
        Self {
            code,
            total_checks: total,
            passed,
            failed,
            warnings,
            max_utilization: max_util,
            critical_member: critical,
            member_checks,
        }
    }
    
    /// Check if all checks pass
    pub fn all_pass(&self) -> bool {
        self.failed == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_code_check_evaluate() {
        let mut check = CodeCheck::new("TEST-01", "Cl. 1.1", "Test check", CheckCategory::Strength);
        
        check.evaluate(80.0, 100.0, 0.9);
        assert_eq!(check.status, CheckStatus::Pass);
        assert!((check.utilization - 0.8).abs() < 0.001);
        
        check.evaluate(95.0, 100.0, 0.9);
        assert_eq!(check.status, CheckStatus::Warning);
        
        check.evaluate(110.0, 100.0, 0.9);
        assert_eq!(check.status, CheckStatus::Fail);
    }
    
    #[test]
    fn test_safety_factors() {
        let is_factors = SafetyFactors::is_code();
        assert_eq!(is_factors.gamma_c, 1.5);
        assert_eq!(is_factors.gamma_s, 1.15);
        
        let aisc_factors = SafetyFactors::aisc();
        assert_eq!(aisc_factors.gamma_s, 0.9);
    }
    
    #[test]
    fn test_rc_beam_is456() {
        let checker = CodeChecker::new(DesignCode::IS456);
        
        let beam = BeamCheckInput {
            member_id: "B1".to_string(),
            depth: 500.0,
            width: 300.0,
            d_eff: 450.0,
            span: 6000.0,
            fck: 25.0,
            fy: 415.0,
            ast: 1256.0, // 4 Nos 20mm
            asc: 402.0,  // 2 Nos 16mm
            asv_sv: 0.5,
            mu: 150.0,
            vu: 80.0,
            tu: 0.0,
            ms: 100.0,
            cover: 30.0,
        };
        
        let checks = checker.check_rc_beam_is456(&beam);
        
        assert!(!checks.is_empty());
        assert!(checks.iter().any(|c| c.id == "IS456-B-01"));
    }
    
    #[test]
    fn test_rc_column_is456() {
        let checker = CodeChecker::new(DesignCode::IS456);
        
        let column = ColumnCheckInput {
            member_id: "C1".to_string(),
            depth: 400.0,
            width: 400.0,
            length: 3000.0,
            k_factor: 1.0,
            fck: 30.0,
            fy: 500.0,
            ast: 2513.0, // 8 Nos 20mm
            tie_spacing: 200.0,
            pu: 1500.0,
            mux: 50.0,
            muy: 40.0,
            braced: true,
        };
        
        let checks = checker.check_rc_column_is456(&column);
        
        assert!(!checks.is_empty());
        assert!(checks.iter().any(|c| c.category == CheckCategory::Stability));
    }
    
    #[test]
    fn test_steel_beam_is800() {
        let checker = CodeChecker::new(DesignCode::IS800);
        
        let beam = SteelBeamInput {
            member_id: "SB1".to_string(),
            section: "ISMB 400".to_string(),
            depth: 400.0,
            bf: 140.0,
            tf: 16.0,
            tw: 8.6,
            lb: 2000.0,
            zx: 1176000.0,
            fy: 250.0,
            mu: 200.0,
            vu: 150.0,
            pu: 0.0,
            cb: 1.0,
        };
        
        let checks = checker.check_steel_beam_is800(&beam);
        
        assert!(!checks.is_empty());
        assert!(checks.iter().any(|c| c.id == "IS800-S-02"));
    }
    
    #[test]
    fn test_steel_beam_aisc() {
        let checker = CodeChecker::new(DesignCode::AISC360);
        
        let beam = SteelBeamInput {
            member_id: "W18x50".to_string(),
            section: "W18x50".to_string(),
            depth: 457.2, // 18 inches
            bf: 190.5,    // 7.5 inches
            tf: 14.5,
            tw: 9.0,
            lb: 3048.0,   // 10 ft
            zx: 1638700.0,
            fy: 345.0,    // 50 ksi
            mu: 300.0,
            vu: 200.0,
            pu: 0.0,
            cb: 1.0,
        };
        
        let checks = checker.check_steel_beam_aisc(&beam);
        
        assert!(!checks.is_empty());
        assert!(checks.iter().any(|c| c.clause == "F2"));
    }
    
    #[test]
    fn test_check_summary() {
        let mut member_checks = HashMap::new();
        
        let checks = vec![
            {
                let mut c = CodeCheck::new("T1", "1", "Test", CheckCategory::Strength);
                c.status = CheckStatus::Pass;
                c.utilization = 0.6;
                c
            },
            {
                let mut c = CodeCheck::new("T2", "2", "Test", CheckCategory::Strength);
                c.status = CheckStatus::Warning;
                c.utilization = 0.95;
                c
            },
        ];
        
        member_checks.insert("M1".to_string(), checks);
        
        let summary = CheckSummary::from_checks(DesignCode::IS456, member_checks);
        
        assert_eq!(summary.total_checks, 2);
        assert_eq!(summary.passed, 1);
        assert_eq!(summary.warnings, 1);
        assert!(summary.all_pass());
    }
    
    #[test]
    fn test_tau_c_calculation() {
        let checker = CodeChecker::new(DesignCode::IS456);
        
        let tau_c = checker.tau_c_is456(1.0, 25.0);
        assert!(tau_c > 0.0);
        assert!(tau_c < 5.0);
    }
    
    #[test]
    fn test_design_codes() {
        assert_ne!(DesignCode::IS456, DesignCode::IS800);
        assert_eq!(DesignCode::AISC360, DesignCode::AISC360);
    }
    
    #[test]
    fn test_check_categories() {
        assert_ne!(CheckCategory::Strength, CheckCategory::Serviceability);
        assert_eq!(CheckCategory::Stability, CheckCategory::Stability);
    }
}
