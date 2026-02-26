// ============================================================================
// CODE CHECKING ENGINE - Phase 23
// Multi-code compliance checking for structural design
// Standards: Eurocode, ACI, AISC, IS codes, BS, AS, CSA
// ============================================================================

#![allow(non_camel_case_types)]  // Industry-standard code designations like CSA_A23_3

use serde::{Deserialize, Serialize};

// ============================================================================
// DESIGN CODES
// ============================================================================

/// Supported design codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DesignCode {
    // Concrete
    Eurocode2,
    ACI318,
    IS456,
    BS8110,
    AS3600,
    CSA_A23_3,
    
    // Steel
    Eurocode3,
    AISC360,
    IS800,
    BS5950,
    AS4100,
    CSA_S16,
    
    // Timber
    Eurocode5,
    NDS,
    CSA_O86,
    AS1720,
    
    // Foundations
    Eurocode7,
    ACI336,
    IS1904,
    
    // Seismic
    Eurocode8,
    ASCE7,
    IS1893,
    NZS1170,
    
    // General loads
    Eurocode1,
    ASCE7Loads,
    IS875,
}

impl DesignCode {
    /// Code name string
    pub fn name(&self) -> &str {
        match self {
            DesignCode::Eurocode2 => "EN 1992-1-1 (Eurocode 2)",
            DesignCode::ACI318 => "ACI 318-19",
            DesignCode::IS456 => "IS 456:2000",
            DesignCode::BS8110 => "BS 8110:1997",
            DesignCode::AS3600 => "AS 3600:2018",
            DesignCode::CSA_A23_3 => "CSA A23.3:2019",
            
            DesignCode::Eurocode3 => "EN 1993-1-1 (Eurocode 3)",
            DesignCode::AISC360 => "AISC 360-22",
            DesignCode::IS800 => "IS 800:2007",
            DesignCode::BS5950 => "BS 5950:2000",
            DesignCode::AS4100 => "AS 4100:2020",
            DesignCode::CSA_S16 => "CSA S16:2019",
            
            DesignCode::Eurocode5 => "EN 1995-1-1 (Eurocode 5)",
            DesignCode::NDS => "NDS 2024",
            DesignCode::CSA_O86 => "CSA O86:2019",
            DesignCode::AS1720 => "AS 1720.1:2010",
            
            DesignCode::Eurocode7 => "EN 1997-1 (Eurocode 7)",
            DesignCode::ACI336 => "ACI 336.3R",
            DesignCode::IS1904 => "IS 1904:1986",
            
            DesignCode::Eurocode8 => "EN 1998-1 (Eurocode 8)",
            DesignCode::ASCE7 => "ASCE 7-22",
            DesignCode::IS1893 => "IS 1893:2016",
            DesignCode::NZS1170 => "NZS 1170.5:2004",
            
            DesignCode::Eurocode1 => "EN 1991 (Eurocode 1)",
            DesignCode::ASCE7Loads => "ASCE 7-22 (Loads)",
            DesignCode::IS875 => "IS 875",
        }
    }
    
    /// Material type for code
    pub fn material(&self) -> &str {
        match self {
            DesignCode::Eurocode2 | DesignCode::ACI318 | 
            DesignCode::IS456 | DesignCode::BS8110 |
            DesignCode::AS3600 | DesignCode::CSA_A23_3 => "concrete",
            
            DesignCode::Eurocode3 | DesignCode::AISC360 |
            DesignCode::IS800 | DesignCode::BS5950 |
            DesignCode::AS4100 | DesignCode::CSA_S16 => "steel",
            
            DesignCode::Eurocode5 | DesignCode::NDS |
            DesignCode::CSA_O86 | DesignCode::AS1720 => "timber",
            
            _ => "general",
        }
    }
    
    /// Get default safety factors
    pub fn safety_factors(&self) -> SafetyFactors {
        match self {
            DesignCode::Eurocode2 => SafetyFactors {
                gamma_c: 1.5,
                gamma_s: 1.15,
                gamma_g: 1.35,
                gamma_q: 1.5,
                psi_0: 0.7,
                psi_1: 0.5,
                psi_2: 0.3,
            },
            DesignCode::ACI318 => SafetyFactors {
                gamma_c: 1.0, // Uses phi factors
                gamma_s: 1.0,
                gamma_g: 1.2,
                gamma_q: 1.6,
                psi_0: 1.0,
                psi_1: 0.5,
                psi_2: 0.2,
            },
            DesignCode::IS456 => SafetyFactors {
                gamma_c: 1.5,
                gamma_s: 1.15,
                gamma_g: 1.5,
                gamma_q: 1.5,
                psi_0: 0.8,
                psi_1: 0.6,
                psi_2: 0.4,
            },
            _ => SafetyFactors::default(),
        }
    }
}

/// Safety factors per code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyFactors {
    /// Concrete partial factor
    pub gamma_c: f64,
    /// Steel partial factor
    pub gamma_s: f64,
    /// Permanent load factor
    pub gamma_g: f64,
    /// Variable load factor
    pub gamma_q: f64,
    /// Combination factor 0
    pub psi_0: f64,
    /// Combination factor 1
    pub psi_1: f64,
    /// Combination factor 2
    pub psi_2: f64,
}

impl Default for SafetyFactors {
    fn default() -> Self {
        Self {
            gamma_c: 1.5,
            gamma_s: 1.15,
            gamma_g: 1.4,
            gamma_q: 1.6,
            psi_0: 0.7,
            psi_1: 0.5,
            psi_2: 0.3,
        }
    }
}

// ============================================================================
// CHECK RESULTS
// ============================================================================

/// Check status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CheckStatus {
    Pass,
    Fail,
    Warning,
    NotApplicable,
    NotChecked,
}

/// Individual code check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    /// Check name
    pub name: String,
    /// Check clause/section
    pub clause: String,
    /// Status
    pub status: CheckStatus,
    /// Utilization ratio
    pub utilization: f64,
    /// Demand value
    pub demand: f64,
    /// Capacity value
    pub capacity: f64,
    /// Unit for values
    pub unit: String,
    /// Notes/warnings
    pub notes: Vec<String>,
}

impl CheckResult {
    pub fn new(name: &str, clause: &str) -> Self {
        Self {
            name: name.to_string(),
            clause: clause.to_string(),
            status: CheckStatus::NotChecked,
            utilization: 0.0,
            demand: 0.0,
            capacity: 0.0,
            unit: String::new(),
            notes: Vec::new(),
        }
    }
    
    /// Set pass result
    pub fn pass(mut self, demand: f64, capacity: f64, unit: &str) -> Self {
        self.demand = demand;
        self.capacity = capacity;
        self.unit = unit.to_string();
        self.utilization = if capacity > 0.0 { demand / capacity } else { 0.0 };
        self.status = CheckStatus::Pass;
        self
    }
    
    /// Set fail result
    pub fn fail(mut self, demand: f64, capacity: f64, unit: &str) -> Self {
        self.demand = demand;
        self.capacity = capacity;
        self.unit = unit.to_string();
        self.utilization = if capacity > 0.0 { demand / capacity } else { f64::MAX };
        self.status = CheckStatus::Fail;
        self
    }
    
    /// Check demand vs capacity
    pub fn check(mut self, demand: f64, capacity: f64, unit: &str) -> Self {
        self.demand = demand;
        self.capacity = capacity;
        self.unit = unit.to_string();
        self.utilization = if capacity > 0.0 { demand / capacity } else { f64::MAX };
        
        self.status = if self.utilization <= 1.0 {
            if self.utilization > 0.95 {
                CheckStatus::Warning
            } else {
                CheckStatus::Pass
            }
        } else {
            CheckStatus::Fail
        };
        
        self
    }
    
    /// Add note
    pub fn with_note(mut self, note: &str) -> Self {
        self.notes.push(note.to_string());
        self
    }
}

// ============================================================================
// ELEMENT CHECKS
// ============================================================================

/// Element type for checking
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ElementType {
    Beam,
    Column,
    Slab,
    Wall,
    Foundation,
    Connection,
}

/// Element check results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementCheckResults {
    /// Element ID
    pub element_id: String,
    /// Element type
    pub element_type: ElementType,
    /// Design code used
    pub code: DesignCode,
    /// Individual checks
    pub checks: Vec<CheckResult>,
    /// Overall status
    pub overall_status: CheckStatus,
    /// Maximum utilization
    pub max_utilization: f64,
    /// Critical check name
    pub critical_check: String,
}

impl ElementCheckResults {
    pub fn new(element_id: &str, element_type: ElementType, code: DesignCode) -> Self {
        Self {
            element_id: element_id.to_string(),
            element_type,
            code,
            checks: Vec::new(),
            overall_status: CheckStatus::NotChecked,
            max_utilization: 0.0,
            critical_check: String::new(),
        }
    }
    
    /// Add check result
    pub fn add_check(&mut self, result: CheckResult) {
        if result.utilization > self.max_utilization {
            self.max_utilization = result.utilization;
            self.critical_check = result.name.clone();
        }
        
        // Update overall status
        match result.status {
            CheckStatus::Fail => self.overall_status = CheckStatus::Fail,
            CheckStatus::Warning if self.overall_status != CheckStatus::Fail => {
                self.overall_status = CheckStatus::Warning;
            }
            CheckStatus::Pass if self.overall_status == CheckStatus::NotChecked => {
                self.overall_status = CheckStatus::Pass;
            }
            _ => {}
        }
        
        self.checks.push(result);
    }
    
    /// Count passed checks
    pub fn passed_count(&self) -> usize {
        self.checks.iter()
            .filter(|c| c.status == CheckStatus::Pass)
            .count()
    }
    
    /// Count failed checks
    pub fn failed_count(&self) -> usize {
        self.checks.iter()
            .filter(|c| c.status == CheckStatus::Fail)
            .count()
    }
    
    /// Get failed checks
    pub fn failed_checks(&self) -> Vec<&CheckResult> {
        self.checks.iter()
            .filter(|c| c.status == CheckStatus::Fail)
            .collect()
    }
}

// ============================================================================
// CONCRETE BEAM CHECKER
// ============================================================================

/// Concrete beam data for checking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteBeamData {
    /// Beam width (mm)
    pub width: f64,
    /// Beam depth (mm)
    pub depth: f64,
    /// Effective depth (mm)
    pub d_eff: f64,
    /// Concrete strength (MPa)
    pub fck: f64,
    /// Rebar yield strength (MPa)
    pub fyk: f64,
    /// Tension steel area (mm²)
    pub as_tension: f64,
    /// Compression steel area (mm²)
    pub as_compression: f64,
    /// Shear steel area (mm²/mm)
    pub asv_s: f64,
    /// Clear cover (mm)
    pub cover: f64,
    /// Beam span (m)
    pub span: f64,
}

/// Concrete beam checker
pub struct ConcreteBeamChecker {
    code: DesignCode,
    factors: SafetyFactors,
}

impl ConcreteBeamChecker {
    pub fn new(code: DesignCode) -> Self {
        Self {
            factors: code.safety_factors(),
            code,
        }
    }
    
    /// Design material strengths
    fn design_strengths(&self, data: &ConcreteBeamData) -> (f64, f64) {
        match self.code {
            DesignCode::ACI318 => (0.85 * data.fck, data.fyk),
            _ => (data.fck / self.factors.gamma_c, data.fyk / self.factors.gamma_s),
        }
    }
    
    /// Check flexural capacity
    pub fn check_flexure(
        &self,
        data: &ConcreteBeamData,
        mu: f64, // Design moment (kNm)
    ) -> CheckResult {
        let (_fcd, fyd) = self.design_strengths(data);
        
        // Calculate moment capacity (simplified rectangular stress block)
        let lever_arm = 0.9 * data.d_eff;
        let mn = data.as_tension * fyd * lever_arm / 1e6; // kNm
        
        let phi = match self.code {
            DesignCode::ACI318 => 0.9,
            _ => 1.0, // Material factors already applied
        };
        
        let capacity = phi * mn;
        
        let clause = match self.code {
            DesignCode::Eurocode2 => "6.1",
            DesignCode::ACI318 => "22.2",
            DesignCode::IS456 => "38.1",
            _ => "-",
        };
        
        CheckResult::new("Flexural Strength", clause)
            .check(mu, capacity, "kNm")
    }
    
    /// Check shear capacity
    pub fn check_shear(
        &self,
        data: &ConcreteBeamData,
        vu: f64, // Design shear (kN)
    ) -> CheckResult {
        let (_fcd, fyd) = self.design_strengths(data);
        
        // Concrete shear contribution
        let rho = data.as_tension / (data.width * data.d_eff);
        let k = (1.0 + (200.0 / data.d_eff).sqrt()).min(2.0);
        
        let vc = match self.code {
            DesignCode::Eurocode2 => {
                let vrd_c = 0.12 * k * (100.0 * rho * data.fck).powf(1.0/3.0);
                vrd_c * data.width * data.d_eff / 1000.0
            }
            DesignCode::ACI318 => {
                let vc_nominal = 0.17 * data.fck.sqrt() * data.width * data.d_eff / 1000.0;
                0.75 * vc_nominal
            }
            _ => {
                0.8 * data.fck.sqrt() * data.width * data.d_eff / 1000.0
            }
        };
        
        // Steel shear contribution
        let vs = data.asv_s * fyd * data.d_eff / 1000.0;
        
        let vn = vc + vs;
        
        let clause = match self.code {
            DesignCode::Eurocode2 => "6.2",
            DesignCode::ACI318 => "22.5",
            DesignCode::IS456 => "40",
            _ => "-",
        };
        
        CheckResult::new("Shear Strength", clause)
            .check(vu, vn, "kN")
    }
    
    /// Check minimum reinforcement
    pub fn check_min_reinforcement(&self, data: &ConcreteBeamData) -> CheckResult {
        let as_min = match self.code {
            DesignCode::Eurocode2 => {
                let fctm = 0.3 * data.fck.powf(2.0/3.0);
                0.26 * fctm / data.fyk * data.width * data.d_eff
            }
            DesignCode::ACI318 => {
                let min1 = 0.25 * data.fck.sqrt() / data.fyk * data.width * data.d_eff;
                let min2 = 1.4 / data.fyk * data.width * data.d_eff;
                min1.max(min2)
            }
            DesignCode::IS456 => {
                0.85 / data.fyk * data.width * data.d_eff
            }
            _ => {
                0.002 * data.width * data.d_eff
            }
        };
        
        let clause = match self.code {
            DesignCode::Eurocode2 => "9.2.1.1",
            DesignCode::ACI318 => "9.6.1.2",
            DesignCode::IS456 => "26.5.1",
            _ => "-",
        };
        
        CheckResult::new("Minimum Reinforcement", clause)
            .check(as_min, data.as_tension, "mm²")
    }
    
    /// Check maximum reinforcement
    pub fn check_max_reinforcement(&self, data: &ConcreteBeamData) -> CheckResult {
        let rho_max = match self.code {
            DesignCode::Eurocode2 => 0.04,
            DesignCode::ACI318 => 0.025,
            DesignCode::IS456 => 0.04,
            _ => 0.04,
        };
        
        let as_max = rho_max * data.width * data.depth;
        let as_total = data.as_tension + data.as_compression;
        
        let clause = match self.code {
            DesignCode::Eurocode2 => "9.2.1.1",
            DesignCode::ACI318 => "18.6.3",
            DesignCode::IS456 => "26.5.1",
            _ => "-",
        };
        
        CheckResult::new("Maximum Reinforcement", clause)
            .check(as_total, as_max, "mm²")
    }
    
    /// Check deflection (span/depth)
    pub fn check_deflection(&self, data: &ConcreteBeamData) -> CheckResult {
        let l_d_actual = data.span * 1000.0 / data.d_eff;
        
        let l_d_limit = match self.code {
            DesignCode::Eurocode2 => {
                let rho = data.as_tension / (data.width * data.d_eff);
                let rho_0 = (data.fck).sqrt() / 1000.0;
                
                if rho <= rho_0 {
                    11.0 + 1.5 * (data.fck).sqrt() * rho_0 / rho
                } else {
                    11.0 + 1.5 * (data.fck).sqrt() * rho_0 / (rho - rho_0) + 1.0/12.0 * (data.fck).sqrt() * (rho_0 / rho).sqrt()
                }.min(35.0)
            }
            DesignCode::ACI318 => {
                // Table 9.3.1.1
                20.0 // Simply supported
            }
            DesignCode::IS456 => {
                // Basic span/depth ratio
                20.0
            }
            _ => 20.0,
        };
        
        let clause = match self.code {
            DesignCode::Eurocode2 => "7.4.2",
            DesignCode::ACI318 => "9.3.1",
            DesignCode::IS456 => "23.2",
            _ => "-",
        };
        
        CheckResult::new("Deflection (Span/Depth)", clause)
            .check(l_d_actual, l_d_limit, "-")
    }
    
    /// Run all beam checks
    pub fn check_beam(
        &self,
        element_id: &str,
        data: &ConcreteBeamData,
        mu: f64,
        vu: f64,
    ) -> ElementCheckResults {
        let mut results = ElementCheckResults::new(element_id, ElementType::Beam, self.code);
        
        results.add_check(self.check_flexure(data, mu));
        results.add_check(self.check_shear(data, vu));
        results.add_check(self.check_min_reinforcement(data));
        results.add_check(self.check_max_reinforcement(data));
        results.add_check(self.check_deflection(data));
        
        results
    }
}

// ============================================================================
// STEEL BEAM CHECKER
// ============================================================================

/// Steel beam section data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelBeamData {
    /// Section name
    pub section: String,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Ultimate strength (MPa)
    pub fu: f64,
    /// Area (mm²)
    pub area: f64,
    /// Plastic section modulus Zx (mm³)
    pub zx: f64,
    /// Elastic section modulus Sx (mm³)
    pub sx: f64,
    /// Moment of inertia Ix (mm⁴)
    pub ix: f64,
    /// Radius of gyration ry (mm)
    pub ry: f64,
    /// Flange width (mm)
    pub bf: f64,
    /// Flange thickness (mm)
    pub tf: f64,
    /// Web thickness (mm)
    pub tw: f64,
    /// Web height (mm)
    pub hw: f64,
    /// Unbraced length (mm)
    pub lb: f64,
}

/// Steel beam checker
pub struct SteelBeamChecker {
    code: DesignCode,
}

impl SteelBeamChecker {
    pub fn new(code: DesignCode) -> Self {
        Self { code }
    }
    
    /// Check flexural capacity
    pub fn check_flexure(&self, data: &SteelBeamData, mu: f64) -> CheckResult {
        let mn = match self.code {
            DesignCode::AISC360 => {
                // AISC F2 - Doubly symmetric compact I-shapes
                let mp = data.fy * data.zx / 1e6; // kNm
                let phi = 0.9;
                
                // Check lateral-torsional buckling
                let lp = 1.76 * data.ry * (200000.0 / data.fy).sqrt();
                
                if data.lb <= lp {
                    phi * mp
                } else {
                    // Simplified - full capacity for this check
                    phi * mp * 0.9
                }
            }
            DesignCode::Eurocode3 => {
                let wpl = data.zx;
                let gamma_m0 = 1.0;
                let mc_rd = wpl * data.fy / gamma_m0 / 1e6;
                
                // LTB reduction (simplified)
                let chi_lt = 0.9;
                chi_lt * mc_rd
            }
            _ => {
                0.9 * data.fy * data.zx / 1e6
            }
        };
        
        let clause = match self.code {
            DesignCode::AISC360 => "F2",
            DesignCode::Eurocode3 => "6.2.5",
            _ => "-",
        };
        
        CheckResult::new("Flexural Strength", clause)
            .check(mu, mn, "kNm")
    }
    
    /// Check shear capacity
    pub fn check_shear(&self, data: &SteelBeamData, vu: f64) -> CheckResult {
        let vn = match self.code {
            DesignCode::AISC360 => {
                let aw = data.hw * data.tw;
                let cv1 = 1.0; // Assume compact web
                let phi = 1.0;
                
                phi * 0.6 * data.fy * aw * cv1 / 1000.0
            }
            DesignCode::Eurocode3 => {
                let av = data.hw * data.tw;
                let gamma_m0 = 1.0;
                
                av * data.fy / (3.0_f64.sqrt() * gamma_m0) / 1000.0
            }
            _ => {
                0.6 * data.fy * data.hw * data.tw / 1000.0
            }
        };
        
        let clause = match self.code {
            DesignCode::AISC360 => "G2",
            DesignCode::Eurocode3 => "6.2.6",
            _ => "-",
        };
        
        CheckResult::new("Shear Strength", clause)
            .check(vu, vn, "kN")
    }
    
    /// Check flange compactness
    pub fn check_flange_compactness(&self, data: &SteelBeamData) -> CheckResult {
        let lambda = data.bf / (2.0 * data.tf);
        
        let lambda_limit = match self.code {
            DesignCode::AISC360 => 0.38 * (200000.0 / data.fy).sqrt(),
            DesignCode::Eurocode3 => 9.0 * (235.0 / data.fy).sqrt(),
            _ => 10.0,
        };
        
        let clause = match self.code {
            DesignCode::AISC360 => "Table B4.1b",
            DesignCode::Eurocode3 => "Table 5.2",
            _ => "-",
        };
        
        CheckResult::new("Flange Compactness", clause)
            .check(lambda, lambda_limit, "-")
    }
    
    /// Check web compactness
    pub fn check_web_compactness(&self, data: &SteelBeamData) -> CheckResult {
        let lambda = data.hw / data.tw;
        
        let lambda_limit = match self.code {
            DesignCode::AISC360 => 3.76 * (200000.0 / data.fy).sqrt(),
            DesignCode::Eurocode3 => 72.0 * (235.0 / data.fy).sqrt(),
            _ => 100.0,
        };
        
        let clause = match self.code {
            DesignCode::AISC360 => "Table B4.1b",
            DesignCode::Eurocode3 => "Table 5.2",
            _ => "-",
        };
        
        CheckResult::new("Web Compactness", clause)
            .check(lambda, lambda_limit, "-")
    }
    
    /// Run all beam checks
    pub fn check_beam(
        &self,
        element_id: &str,
        data: &SteelBeamData,
        mu: f64,
        vu: f64,
    ) -> ElementCheckResults {
        let mut results = ElementCheckResults::new(element_id, ElementType::Beam, self.code);
        
        results.add_check(self.check_flexure(data, mu));
        results.add_check(self.check_shear(data, vu));
        results.add_check(self.check_flange_compactness(data));
        results.add_check(self.check_web_compactness(data));
        
        results
    }
}

// ============================================================================
// MODEL CHECKER
// ============================================================================

/// Full model check results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCheckResults {
    /// Model name
    pub model_name: String,
    /// Design code
    pub code: DesignCode,
    /// Element results
    pub elements: Vec<ElementCheckResults>,
    /// Total elements checked
    pub total_elements: usize,
    /// Passed elements
    pub passed_elements: usize,
    /// Failed elements
    pub failed_elements: usize,
    /// Warning elements
    pub warning_elements: usize,
}

impl ModelCheckResults {
    pub fn new(model_name: &str, code: DesignCode) -> Self {
        Self {
            model_name: model_name.to_string(),
            code,
            elements: Vec::new(),
            total_elements: 0,
            passed_elements: 0,
            failed_elements: 0,
            warning_elements: 0,
        }
    }
    
    /// Add element result
    pub fn add_element(&mut self, result: ElementCheckResults) {
        self.total_elements += 1;
        
        match result.overall_status {
            CheckStatus::Pass => self.passed_elements += 1,
            CheckStatus::Fail => self.failed_elements += 1,
            CheckStatus::Warning => self.warning_elements += 1,
            _ => {}
        }
        
        self.elements.push(result);
    }
    
    /// Overall pass rate (%)
    pub fn pass_rate(&self) -> f64 {
        if self.total_elements > 0 {
            self.passed_elements as f64 / self.total_elements as f64 * 100.0
        } else {
            0.0
        }
    }
    
    /// Get failed elements
    pub fn failed(&self) -> Vec<&ElementCheckResults> {
        self.elements.iter()
            .filter(|e| e.overall_status == CheckStatus::Fail)
            .collect()
    }
    
    /// Maximum utilization in model
    pub fn max_utilization(&self) -> (f64, &str) {
        let mut max_util = 0.0;
        let mut max_elem = "";
        
        for elem in &self.elements {
            if elem.max_utilization > max_util {
                max_util = elem.max_utilization;
                max_elem = &elem.element_id;
            }
        }
        
        (max_util, max_elem)
    }
    
    /// Summary report
    pub fn summary(&self) -> String {
        let (max_util, max_elem) = self.max_utilization();
        
        format!(
            "Model: {}\nCode: {}\nElements: {} total, {} passed, {} failed, {} warnings\nPass Rate: {:.1}%\nMax Utilization: {:.1}% at {}",
            self.model_name,
            self.code.name(),
            self.total_elements,
            self.passed_elements,
            self.failed_elements,
            self.warning_elements,
            self.pass_rate(),
            max_util * 100.0,
            max_elem
        )
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_design_code_info() {
        let code = DesignCode::Eurocode2;
        assert_eq!(code.name(), "EN 1992-1-1 (Eurocode 2)");
        assert_eq!(code.material(), "concrete");
    }

    #[test]
    fn test_safety_factors() {
        let factors = DesignCode::Eurocode2.safety_factors();
        assert!((factors.gamma_c - 1.5).abs() < 0.01);
        assert!((factors.gamma_s - 1.15).abs() < 0.01);
    }

    #[test]
    fn test_check_result_pass() {
        let result = CheckResult::new("Test Check", "1.1")
            .check(50.0, 100.0, "kN");
        
        assert_eq!(result.status, CheckStatus::Pass);
        assert!((result.utilization - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_check_result_fail() {
        let result = CheckResult::new("Test Check", "1.1")
            .check(120.0, 100.0, "kN");
        
        assert_eq!(result.status, CheckStatus::Fail);
        assert!(result.utilization > 1.0);
    }

    #[test]
    fn test_concrete_beam_check() {
        let data = ConcreteBeamData {
            width: 300.0,
            depth: 600.0,
            d_eff: 540.0,
            fck: 30.0,
            fyk: 500.0,
            as_tension: 1570.0, // 2T32
            as_compression: 402.0, // 2T16
            asv_s: 0.5, // Stirrups
            cover: 40.0,
            span: 6.0,
        };
        
        let checker = ConcreteBeamChecker::new(DesignCode::Eurocode2);
        let results = checker.check_beam("B1", &data, 200.0, 150.0);
        
        assert!(results.checks.len() >= 4);
    }

    #[test]
    fn test_steel_beam_check() {
        let data = SteelBeamData {
            section: "W310x97".to_string(),
            fy: 345.0,
            fu: 450.0,
            area: 12300.0,
            zx: 1.44e6,
            sx: 1.28e6,
            ix: 2.22e8,
            ry: 49.0,
            bf: 254.0,
            tf: 15.4,
            tw: 9.9,
            hw: 277.0,
            lb: 3000.0,
        };
        
        let checker = SteelBeamChecker::new(DesignCode::AISC360);
        let results = checker.check_beam("SB1", &data, 300.0, 200.0);
        
        assert!(results.checks.len() >= 4);
    }

    #[test]
    fn test_element_check_results() {
        let mut results = ElementCheckResults::new("E1", ElementType::Beam, DesignCode::Eurocode2);
        
        results.add_check(CheckResult::new("Check 1", "1.1").check(50.0, 100.0, "kN"));
        results.add_check(CheckResult::new("Check 2", "1.2").check(80.0, 100.0, "kN"));
        
        assert_eq!(results.passed_count(), 2);
        assert_eq!(results.failed_count(), 0);
        assert!((results.max_utilization - 0.8).abs() < 0.01);
    }

    #[test]
    fn test_model_check_results() {
        let mut model = ModelCheckResults::new("Test Model", DesignCode::Eurocode2);
        
        let mut elem1 = ElementCheckResults::new("E1", ElementType::Beam, DesignCode::Eurocode2);
        elem1.overall_status = CheckStatus::Pass;
        
        let mut elem2 = ElementCheckResults::new("E2", ElementType::Beam, DesignCode::Eurocode2);
        elem2.overall_status = CheckStatus::Fail;
        
        model.add_element(elem1);
        model.add_element(elem2);
        
        assert_eq!(model.total_elements, 2);
        assert_eq!(model.passed_elements, 1);
        assert_eq!(model.failed_elements, 1);
        assert!((model.pass_rate() - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_min_reinforcement_ec2() {
        let data = ConcreteBeamData {
            width: 300.0,
            depth: 600.0,
            d_eff: 540.0,
            fck: 30.0,
            fyk: 500.0,
            as_tension: 200.0, // Deliberately low
            as_compression: 0.0,
            asv_s: 0.0,
            cover: 40.0,
            span: 6.0,
        };
        
        let checker = ConcreteBeamChecker::new(DesignCode::Eurocode2);
        let result = checker.check_min_reinforcement(&data);
        
        assert_eq!(result.status, CheckStatus::Fail);
    }

    #[test]
    fn test_deflection_check() {
        let data = ConcreteBeamData {
            width: 300.0,
            depth: 600.0,
            d_eff: 540.0,
            fck: 30.0,
            fyk: 500.0,
            as_tension: 1570.0,
            as_compression: 402.0,
            asv_s: 0.5,
            cover: 40.0,
            span: 6.0,
        };
        
        let checker = ConcreteBeamChecker::new(DesignCode::Eurocode2);
        let result = checker.check_deflection(&data);
        
        assert_eq!(result.status, CheckStatus::Pass);
    }
}
