//! # Load Combination Engine
//! 
//! Automatic load combination generation per major design codes:
//! - **IS 456:2000** - Indian Standard for RCC
//! - **IS 800:2007** - Indian Standard for Steel  
//! - **IS 875** - Design Loads
//! - **ASCE 7-22** - American Load Combinations
//! - **Eurocode 0** - European Load Combinations
//! 
//! ## Features
//! - Automatic combination generation from load cases
//! - Ultimate and Serviceability limit states
//! - Envelope calculation (max/min across combinations)
//! - Factored load vector generation
//! - WASM-compatible

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// LOAD TYPES AND CASES
// ============================================================================

/// Standard load types recognized across all codes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LoadType {
    /// Dead load (self-weight, permanent)
    Dead,
    /// Superimposed dead load (finishes, partitions)
    SuperDead,
    /// Live load (occupancy, movable)
    Live,
    /// Roof live load
    RoofLive,
    /// Wind load (positive direction)
    WindX,
    /// Wind load (negative direction)  
    WindXNeg,
    /// Wind load Y direction
    WindY,
    /// Wind load Y negative
    WindYNeg,
    /// Seismic load X direction
    SeismicX,
    /// Seismic load X negative
    SeismicXNeg,
    /// Seismic load Y direction
    SeismicY,
    /// Seismic load Y negative
    SeismicYNeg,
    /// Snow load
    Snow,
    /// Rain load
    Rain,
    /// Temperature increase
    TempIncrease,
    /// Temperature decrease
    TempDecrease,
    /// Earth pressure (active)
    EarthPressure,
    /// Fluid pressure (hydrostatic)
    FluidPressure,
    /// Prestress
    Prestress,
    /// Impact/Dynamic
    Impact,
    /// Crane load
    Crane,
    /// Settlement
    Settlement,
    /// User-defined
    User(u32),
}

/// Individual load case definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCase {
    /// Unique identifier
    pub id: String,
    /// Descriptive name
    pub name: String,
    /// Load type category
    pub load_type: LoadType,
    /// Optional description
    pub description: Option<String>,
    /// Reference to nodal loads (indices)
    pub nodal_load_ids: Vec<usize>,
    /// Reference to member loads (indices)
    pub member_load_ids: Vec<usize>,
}

impl LoadCase {
    /// Create a new load case
    pub fn new(id: &str, name: &str, load_type: LoadType) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            load_type,
            description: None,
            nodal_load_ids: Vec::new(),
            member_load_ids: Vec::new(),
        }
    }
    
    /// Add description
    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
}

// ============================================================================
// LIMIT STATES
// ============================================================================

/// Limit state type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LimitState {
    /// Ultimate Limit State (strength)
    Ultimate,
    /// Serviceability Limit State (deflection, vibration)
    Serviceability,
    /// Fatigue limit state
    Fatigue,
    /// Fire limit state
    Fire,
    /// Accidental limit state
    Accidental,
}

/// Design code for combination generation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DesignCode {
    /// Indian Standard IS 456/800/1893
    Indian,
    /// ASCE 7 (American)
    ASCE7,
    /// Eurocode 0/1
    Eurocode,
    /// British Standard
    BS,
    /// Australian Standard AS
    Australian,
    /// Custom factors
    Custom,
}

// ============================================================================
// LOAD COMBINATION
// ============================================================================

/// A single load combination with factors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombination {
    /// Unique identifier
    pub id: String,
    /// Descriptive name (e.g., "1.5DL + 1.5LL")
    pub name: String,
    /// Limit state category
    pub limit_state: LimitState,
    /// Design code reference
    pub code: DesignCode,
    /// Load factors: load_case_id -> factor
    pub factors: HashMap<String, f64>,
    /// Whether this combination is active
    pub active: bool,
    /// Notes/reference clause
    pub notes: Option<String>,
}

impl LoadCombination {
    /// Create a new combination
    pub fn new(id: &str, name: &str, limit_state: LimitState, code: DesignCode) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            limit_state,
            code,
            factors: HashMap::new(),
            active: true,
            notes: None,
        }
    }
    
    /// Add a load factor
    pub fn add_factor(mut self, load_case_id: &str, factor: f64) -> Self {
        self.factors.insert(load_case_id.to_string(), factor);
        self
    }
    
    /// Add multiple factors
    pub fn add_factors(mut self, factors: &[(&str, f64)]) -> Self {
        for (id, factor) in factors {
            self.factors.insert(id.to_string(), *factor);
        }
        self
    }
    
    /// Add notes/reference
    pub fn with_notes(mut self, notes: &str) -> Self {
        self.notes = Some(notes.to_string());
        self
    }
    
    /// Set active status
    pub fn set_active(mut self, active: bool) -> Self {
        self.active = active;
        self
    }
}

// ============================================================================
// INDIAN STANDARD COMBINATIONS (IS 456/800/875/1893)
// ============================================================================

/// Generate IS 456:2000 load combinations for RCC structures
/// Reference: Table 18 - Load Combinations
pub fn generate_is456_combinations(load_cases: &[LoadCase]) -> Vec<LoadCombination> {
    let mut combinations = Vec::new();
    
    // Find load case IDs by type
    let dl_id = find_load_case_id(load_cases, LoadType::Dead);
    let ll_id = find_load_case_id(load_cases, LoadType::Live);
    let wx_id = find_load_case_id(load_cases, LoadType::WindX);
    let wxn_id = find_load_case_id(load_cases, LoadType::WindXNeg);
    let wy_id = find_load_case_id(load_cases, LoadType::WindY);
    let wyn_id = find_load_case_id(load_cases, LoadType::WindYNeg);
    let ex_id = find_load_case_id(load_cases, LoadType::SeismicX);
    let exn_id = find_load_case_id(load_cases, LoadType::SeismicXNeg);
    let ey_id = find_load_case_id(load_cases, LoadType::SeismicY);
    let eyn_id = find_load_case_id(load_cases, LoadType::SeismicYNeg);
    
    let mut combo_num = 1;
    
    // === ULTIMATE LIMIT STATE ===
    
    // ULS 1: 1.5(DL + LL)
    if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
        combinations.push(
            LoadCombination::new(&format!("ULS{}", combo_num), "1.5DL + 1.5LL", LimitState::Ultimate, DesignCode::Indian)
                .add_factors(&[(dl, 1.5), (ll, 1.5)])
                .with_notes("IS 456 Table 18")
        );
        combo_num += 1;
    }
    
    // ULS 2: 1.5(DL + WL)
    for wind_id in [&wx_id, &wxn_id, &wy_id, &wyn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("1.5DL + 1.5{}", get_load_name(wind_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.5), (wind_id, 1.5)])
                    .with_notes("IS 456 Table 18")
            );
            combo_num += 1;
        }
    }
    
    // ULS 3: 1.2(DL + LL + WL)
    for wind_id in [&wx_id, &wxn_id, &wy_id, &wyn_id].iter().filter_map(|x| x.as_ref()) {
        if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("1.2DL + 1.2LL + 1.2{}", get_load_name(wind_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.2), (ll, 1.2), (wind_id, 1.2)])
                    .with_notes("IS 456 Table 18")
            );
            combo_num += 1;
        }
    }
    
    // ULS 4: 1.5(DL + EL)
    for eq_id in [&ex_id, &exn_id, &ey_id, &eyn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("1.5DL + 1.5{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.5), (eq_id, 1.5)])
                    .with_notes("IS 456 + IS 1893")
            );
            combo_num += 1;
        }
    }
    
    // ULS 5: 1.2(DL + LL + EL) - Per IS 1893
    for eq_id in [&ex_id, &exn_id, &ey_id, &eyn_id].iter().filter_map(|x| x.as_ref()) {
        if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("1.2DL + 1.2LL + 1.2{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.2), (ll, 1.2), (eq_id, 1.2)])
                    .with_notes("IS 1893:2016 Cl. 6.3.2")
            );
            combo_num += 1;
        }
    }
    
    // ULS 6: 0.9DL + 1.5EL (Uplift/Overturning check)
    for eq_id in [&ex_id, &exn_id, &ey_id, &eyn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("0.9DL + 1.5{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 0.9), (eq_id, 1.5)])
                    .with_notes("IS 1893:2016 Cl. 6.3.2 (Overturning)")
            );
            combo_num += 1;
        }
    }
    
    // ULS 7: 0.9DL + 1.5WL (Uplift check for wind)
    for wind_id in [&wx_id, &wxn_id, &wy_id, &wyn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("ULS{}", combo_num), &format!("0.9DL + 1.5{}", get_load_name(wind_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 0.9), (wind_id, 1.5)])
                    .with_notes("IS 875-3 (Uplift)")
            );
            combo_num += 1;
        }
    }
    
    // === SERVICEABILITY LIMIT STATE ===
    
    let mut sls_num = 1;
    
    // SLS 1: 1.0DL + 1.0LL
    if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
        combinations.push(
            LoadCombination::new(&format!("SLS{}", sls_num), "1.0DL + 1.0LL", LimitState::Serviceability, DesignCode::Indian)
                .add_factors(&[(dl, 1.0), (ll, 1.0)])
                .with_notes("Deflection check")
        );
        sls_num += 1;
    }
    
    // SLS 2: 1.0DL + 0.8LL (Long-term deflection)
    if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
        combinations.push(
            LoadCombination::new(&format!("SLS{}", sls_num), "1.0DL + 0.8LL", LimitState::Serviceability, DesignCode::Indian)
                .add_factors(&[(dl, 1.0), (ll, 0.8)])
                .with_notes("Long-term deflection")
        );
        sls_num += 1;
    }
    
    // SLS 3: 1.0DL + 1.0WL
    for wind_id in [&wx_id, &wxn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("SLS{}", sls_num), &format!("1.0DL + 1.0{}", get_load_name(wind_id)), LimitState::Serviceability, DesignCode::Indian)
                    .add_factors(&[(dl, 1.0), (wind_id, 1.0)])
                    .with_notes("Drift check")
            );
            sls_num += 1;
        }
    }
    
    combinations
}

/// Generate IS 800:2007 load combinations for Steel structures
pub fn generate_is800_combinations(load_cases: &[LoadCase]) -> Vec<LoadCombination> {
    let mut combinations = Vec::new();
    
    let dl_id = find_load_case_id(load_cases, LoadType::Dead);
    let ll_id = find_load_case_id(load_cases, LoadType::Live);
    let wx_id = find_load_case_id(load_cases, LoadType::WindX);
    let wxn_id = find_load_case_id(load_cases, LoadType::WindXNeg);
    let ex_id = find_load_case_id(load_cases, LoadType::SeismicX);
    let exn_id = find_load_case_id(load_cases, LoadType::SeismicXNeg);
    let crane_id = find_load_case_id(load_cases, LoadType::Crane);
    
    let mut combo_num = 1;
    
    // IS 800:2007 Table 4 - Load factors
    
    // 1.5DL + 1.5LL (Leading = LL)
    if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
        combinations.push(
            LoadCombination::new(&format!("IS800-{}", combo_num), "1.5DL + 1.5LL", LimitState::Ultimate, DesignCode::Indian)
                .add_factors(&[(dl, 1.5), (ll, 1.5)])
                .with_notes("IS 800:2007 Table 4")
        );
        combo_num += 1;
    }
    
    // 1.5DL + 1.5WL
    for wind_id in [&wx_id, &wxn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), &format!("1.5DL + 1.5{}", get_load_name(wind_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.5), (wind_id, 1.5)])
                    .with_notes("IS 800:2007 Table 4")
            );
            combo_num += 1;
        }
    }
    
    // 1.2DL + 1.2LL + 1.2WL
    for wind_id in [&wx_id, &wxn_id].iter().filter_map(|x| x.as_ref()) {
        if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), &format!("1.2DL + 1.2LL + 1.2{}", get_load_name(wind_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.2), (ll, 1.2), (wind_id, 1.2)])
                    .with_notes("IS 800:2007 Table 4")
            );
            combo_num += 1;
        }
    }
    
    // 1.5DL + 1.5EL (Seismic)
    for eq_id in [&ex_id, &exn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), &format!("1.5DL + 1.5{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.5), (eq_id, 1.5)])
                    .with_notes("IS 800:2007 + IS 1893")
            );
            combo_num += 1;
        }
    }
    
    // 1.2DL + 0.5LL + 1.2EL (with reduced live load)
    for eq_id in [&ex_id, &exn_id].iter().filter_map(|x| x.as_ref()) {
        if let (Some(dl), Some(ll)) = (&dl_id, &ll_id) {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), &format!("1.2DL + 0.5LL + 1.2{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.2), (ll, 0.5), (eq_id, 1.2)])
                    .with_notes("IS 800:2007 + IS 1893")
            );
            combo_num += 1;
        }
    }
    
    // 0.9DL + 1.5EL (Stability)
    for eq_id in [&ex_id, &exn_id].iter().filter_map(|x| x.as_ref()) {
        if let Some(dl) = &dl_id {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), &format!("0.9DL + 1.5{}", get_load_name(eq_id)), LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 0.9), (eq_id, 1.5)])
                    .with_notes("IS 800:2007 Table 4 (Stability)")
            );
            combo_num += 1;
        }
    }
    
    // Crane combinations if present
    if let (Some(dl), Some(crane)) = (&dl_id, &crane_id) {
        combinations.push(
            LoadCombination::new(&format!("IS800-{}", combo_num), "1.5DL + 1.5CL", LimitState::Ultimate, DesignCode::Indian)
                .add_factors(&[(dl, 1.5), (crane, 1.5)])
                .with_notes("IS 800:2007 Crane load")
        );
        combo_num += 1;
        
        if let Some(ll) = &ll_id {
            combinations.push(
                LoadCombination::new(&format!("IS800-{}", combo_num), "1.2DL + 1.2LL + 1.2CL", LimitState::Ultimate, DesignCode::Indian)
                    .add_factors(&[(dl, 1.2), (ll, 1.2), (crane, 1.2)])
                    .with_notes("IS 800:2007 Crane + Live")
            );
        }
    }
    
    combinations
}

// ============================================================================
// ASCE 7-22 COMBINATIONS (AMERICAN)
// ============================================================================

/// Generate ASCE 7-22 load combinations
/// Reference: ASCE 7-22 Chapter 2
pub fn generate_asce7_combinations(load_cases: &[LoadCase]) -> Vec<LoadCombination> {
    let mut combinations = Vec::new();
    
    let d_id = find_load_case_id(load_cases, LoadType::Dead);
    let l_id = find_load_case_id(load_cases, LoadType::Live);
    let lr_id = find_load_case_id(load_cases, LoadType::RoofLive);
    let s_id = find_load_case_id(load_cases, LoadType::Snow);
    let _r_id = find_load_case_id(load_cases, LoadType::Rain);
    let w_id = find_load_case_id(load_cases, LoadType::WindX);
    let e_id = find_load_case_id(load_cases, LoadType::SeismicX);
    
    let mut combo_num = 1;
    
    // LRFD Combinations (Section 2.3.1)
    
    // Combo 1: 1.4D
    if let Some(d) = &d_id {
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "1.4D", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&[(d, 1.4)])
                .with_notes("ASCE 7-22 Eq. 2.3.1-1")
        );
        combo_num += 1;
    }
    
    // Combo 2: 1.2D + 1.6L + 0.5(Lr or S or R)
    if let (Some(d), Some(l)) = (&d_id, &l_id) {
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.6L", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&[(d, 1.2), (l, 1.6)])
                .with_notes("ASCE 7-22 Eq. 2.3.1-2")
        );
        combo_num += 1;
        
        if let Some(lr) = &lr_id {
            combinations.push(
                LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.6L + 0.5Lr", LimitState::Ultimate, DesignCode::ASCE7)
                    .add_factors(&[(d, 1.2), (l, 1.6), (lr, 0.5)])
                    .with_notes("ASCE 7-22 Eq. 2.3.1-2")
            );
            combo_num += 1;
        }
        
        if let Some(s) = &s_id {
            combinations.push(
                LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.6L + 0.5S", LimitState::Ultimate, DesignCode::ASCE7)
                    .add_factors(&[(d, 1.2), (l, 1.6), (s, 0.5)])
                    .with_notes("ASCE 7-22 Eq. 2.3.1-2")
            );
            combo_num += 1;
        }
    }
    
    // Combo 3: 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
    if let Some(d) = &d_id {
        if let Some(lr) = &lr_id {
            if let Some(l) = &l_id {
                combinations.push(
                    LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.6Lr + 1.0L", LimitState::Ultimate, DesignCode::ASCE7)
                        .add_factors(&[(d, 1.2), (lr, 1.6), (l, 1.0)])
                        .with_notes("ASCE 7-22 Eq. 2.3.1-3")
                );
                combo_num += 1;
            }
        }
        
        if let Some(s) = &s_id {
            if let Some(l) = &l_id {
                combinations.push(
                    LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.6S + 1.0L", LimitState::Ultimate, DesignCode::ASCE7)
                        .add_factors(&[(d, 1.2), (s, 1.6), (l, 1.0)])
                        .with_notes("ASCE 7-22 Eq. 2.3.1-3")
                );
                combo_num += 1;
            }
        }
    }
    
    // Combo 4: 1.2D + 1.0W + L + 0.5(Lr or S or R)
    if let (Some(d), Some(w)) = (&d_id, &w_id) {
        let mut factors: Vec<(&str, f64)> = vec![(d, 1.2), (w, 1.0)];
        if let Some(l) = &l_id {
            factors.push((l, 1.0));
        }
        
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.0W + L", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&factors)
                .with_notes("ASCE 7-22 Eq. 2.3.1-4")
        );
        combo_num += 1;
        
        if let Some(s) = &s_id {
            factors.push((s, 0.5));
            combinations.push(
                LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.0W + L + 0.5S", LimitState::Ultimate, DesignCode::ASCE7)
                    .add_factors(&factors)
                    .with_notes("ASCE 7-22 Eq. 2.3.1-4")
            );
            combo_num += 1;
        }
    }
    
    // Combo 5: 1.2D + 1.0E + L + 0.2S
    if let (Some(d), Some(e)) = (&d_id, &e_id) {
        let mut factors: Vec<(&str, f64)> = vec![(d, 1.2), (e, 1.0)];
        if let Some(l) = &l_id {
            factors.push((l, 1.0));
        }
        
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.0E + L", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&factors)
                .with_notes("ASCE 7-22 Eq. 2.3.1-5")
        );
        combo_num += 1;
        
        if let Some(s) = &s_id {
            factors.push((s, 0.2));
            combinations.push(
                LoadCombination::new(&format!("ASCE-{}", combo_num), "1.2D + 1.0E + L + 0.2S", LimitState::Ultimate, DesignCode::ASCE7)
                    .add_factors(&factors)
                    .with_notes("ASCE 7-22 Eq. 2.3.1-5")
            );
            combo_num += 1;
        }
    }
    
    // Combo 6: 0.9D + 1.0W
    if let (Some(d), Some(w)) = (&d_id, &w_id) {
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "0.9D + 1.0W", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&[(d, 0.9), (w, 1.0)])
                .with_notes("ASCE 7-22 Eq. 2.3.1-6 (Uplift)")
        );
        combo_num += 1;
    }
    
    // Combo 7: 0.9D + 1.0E
    if let (Some(d), Some(e)) = (&d_id, &e_id) {
        combinations.push(
            LoadCombination::new(&format!("ASCE-{}", combo_num), "0.9D + 1.0E", LimitState::Ultimate, DesignCode::ASCE7)
                .add_factors(&[(d, 0.9), (e, 1.0)])
                .with_notes("ASCE 7-22 Eq. 2.3.1-7 (Uplift)")
        );
        combo_num += 1;
    }
    
    // === ASD Combinations (Section 2.4.1) ===
    
    // ASD 1: D
    if let Some(d) = &d_id {
        combinations.push(
            LoadCombination::new(&format!("ASD-{}", 1), "D", LimitState::Serviceability, DesignCode::ASCE7)
                .add_factors(&[(d, 1.0)])
                .with_notes("ASCE 7-22 Eq. 2.4.1-1")
        );
    }
    
    // ASD 2: D + L
    if let (Some(d), Some(l)) = (&d_id, &l_id) {
        combinations.push(
            LoadCombination::new(&format!("ASD-{}", 2), "D + L", LimitState::Serviceability, DesignCode::ASCE7)
                .add_factors(&[(d, 1.0), (l, 1.0)])
                .with_notes("ASCE 7-22 Eq. 2.4.1-2")
        );
    }
    
    // ASD 5: D + 0.6W
    if let (Some(d), Some(w)) = (&d_id, &w_id) {
        combinations.push(
            LoadCombination::new(&format!("ASD-{}", 5), "D + 0.6W", LimitState::Serviceability, DesignCode::ASCE7)
                .add_factors(&[(d, 1.0), (w, 0.6)])
                .with_notes("ASCE 7-22 Eq. 2.4.1-5")
        );
    }
    
    // ASD 6: D + 0.7E
    if let (Some(d), Some(e)) = (&d_id, &e_id) {
        combinations.push(
            LoadCombination::new(&format!("ASD-{}", 6), "D + 0.7E", LimitState::Serviceability, DesignCode::ASCE7)
                .add_factors(&[(d, 1.0), (e, 0.7)])
                .with_notes("ASCE 7-22 Eq. 2.4.1-6")
        );
    }
    
    combinations
}

// ============================================================================
// EUROCODE COMBINATIONS (EN 1990)
// ============================================================================

/// Generate Eurocode load combinations
/// Reference: EN 1990:2002 Section 6.4
pub fn generate_eurocode_combinations(load_cases: &[LoadCase]) -> Vec<LoadCombination> {
    let mut combinations = Vec::new();
    
    let g_id = find_load_case_id(load_cases, LoadType::Dead);
    let q_id = find_load_case_id(load_cases, LoadType::Live);
    let w_id = find_load_case_id(load_cases, LoadType::WindX);
    let s_id = find_load_case_id(load_cases, LoadType::Snow);
    let e_id = find_load_case_id(load_cases, LoadType::SeismicX);
    
    // Partial factors (Table A1.2(B) for buildings)
    let gamma_g_sup = 1.35;  // Dead load unfavorable
    let gamma_g_inf = 1.0;   // Dead load favorable
    let gamma_q = 1.5;       // Variable load
    let psi_0_q = 0.7;       // Combination factor for imposed load
    let psi_0_w = 0.6;       // Combination factor for wind
    let _psi_0_s = 0.5;       // Combination factor for snow
    let psi_2_q = 0.3;       // Quasi-permanent factor
    
    let mut combo_num = 1;
    
    // === ULS: STR/GEO (Eq. 6.10) ===
    
    // 1.35G + 1.5Q (leading)
    if let (Some(g), Some(q)) = (&g_id, &q_id) {
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "1.35G + 1.5Q", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&[(g, gamma_g_sup), (q, gamma_q)])
                .with_notes("EN 1990 Eq. 6.10")
        );
        combo_num += 1;
    }
    
    // 1.35G + 1.5W (leading) + 0.7*1.5Q
    if let (Some(g), Some(w)) = (&g_id, &w_id) {
        let mut factors: Vec<(&str, f64)> = vec![(g, gamma_g_sup), (w, gamma_q)];
        if let Some(q) = &q_id {
            factors.push((q, gamma_q * psi_0_q));
        }
        
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "1.35G + 1.5W + 1.05Q", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&factors)
                .with_notes("EN 1990 Eq. 6.10 (Wind leading)")
        );
        combo_num += 1;
    }
    
    // 1.35G + 1.5Q (leading) + 0.6*1.5W
    if let (Some(g), Some(q), Some(w)) = (&g_id, &q_id, &w_id) {
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "1.35G + 1.5Q + 0.9W", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&[(g, gamma_g_sup), (q, gamma_q), (w, gamma_q * psi_0_w)])
                .with_notes("EN 1990 Eq. 6.10 (Live leading)")
        );
        combo_num += 1;
    }
    
    // Snow combinations
    if let (Some(g), Some(s)) = (&g_id, &s_id) {
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "1.35G + 1.5S", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&[(g, gamma_g_sup), (s, gamma_q)])
                .with_notes("EN 1990 Eq. 6.10 (Snow leading)")
        );
        combo_num += 1;
    }
    
    // 1.0G + 1.5W (Uplift)
    if let (Some(g), Some(w)) = (&g_id, &w_id) {
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "1.0G + 1.5W", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&[(g, gamma_g_inf), (w, gamma_q)])
                .with_notes("EN 1990 Eq. 6.10 (Uplift)")
        );
        combo_num += 1;
    }
    
    // === ULS: Seismic (EN 1998) ===
    
    // G + ψ2*Q + E
    if let (Some(g), Some(e)) = (&g_id, &e_id) {
        let mut factors: Vec<(&str, f64)> = vec![(g, 1.0), (e, 1.0)];
        if let Some(q) = &q_id {
            factors.push((q, psi_2_q));
        }
        
        combinations.push(
            LoadCombination::new(&format!("EC-{}", combo_num), "G + 0.3Q + E", LimitState::Ultimate, DesignCode::Eurocode)
                .add_factors(&factors)
                .with_notes("EN 1998-1 Eq. 3.17")
        );
        combo_num += 1;
    }
    
    // === SLS: Characteristic (Eq. 6.14) ===
    
    if let (Some(g), Some(q)) = (&g_id, &q_id) {
        combinations.push(
            LoadCombination::new(&format!("SLS-{}", 1), "G + Q", LimitState::Serviceability, DesignCode::Eurocode)
                .add_factors(&[(g, 1.0), (q, 1.0)])
                .with_notes("EN 1990 Eq. 6.14b (Characteristic)")
        );
    }
    
    // === SLS: Quasi-permanent (Eq. 6.16) ===
    
    if let (Some(g), Some(q)) = (&g_id, &q_id) {
        combinations.push(
            LoadCombination::new(&format!("SLS-{}", 2), "G + 0.3Q", LimitState::Serviceability, DesignCode::Eurocode)
                .add_factors(&[(g, 1.0), (q, psi_2_q)])
                .with_notes("EN 1990 Eq. 6.16b (Quasi-permanent)")
        );
    }
    
    combinations
}

// ============================================================================
// ENVELOPE AND RESULTS
// ============================================================================

/// Results for a single combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinationResult {
    pub combination_id: String,
    pub combination_name: String,
    pub limit_state: LimitState,
    /// Factored nodal displacements: node_id -> [dx, dy, dz, rx, ry, rz]
    pub displacements: HashMap<String, Vec<f64>>,
    /// Factored reactions: node_id -> [Fx, Fy, Fz, Mx, My, Mz]
    pub reactions: HashMap<String, Vec<f64>>,
    /// Factored member forces: member_id -> MemberEnvelopeForces
    pub member_forces: HashMap<String, Vec<f64>>,
}

/// Envelope results across all combinations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeResult {
    /// Maximum values per node: node_id -> [max_dx, max_dy, ...] with combo_id
    pub max_displacements: HashMap<String, (Vec<f64>, Vec<String>)>,
    /// Minimum values per node
    pub min_displacements: HashMap<String, (Vec<f64>, Vec<String>)>,
    /// Maximum reactions
    pub max_reactions: HashMap<String, (Vec<f64>, Vec<String>)>,
    /// Minimum reactions  
    pub min_reactions: HashMap<String, (Vec<f64>, Vec<String>)>,
    /// Maximum member forces (per station)
    pub max_member_forces: HashMap<String, (Vec<f64>, Vec<String>)>,
    /// Minimum member forces
    pub min_member_forces: HashMap<String, (Vec<f64>, Vec<String>)>,
}

impl EnvelopeResult {
    /// Create a new empty envelope
    pub fn new() -> Self {
        Self {
            max_displacements: HashMap::new(),
            min_displacements: HashMap::new(),
            max_reactions: HashMap::new(),
            min_reactions: HashMap::new(),
            max_member_forces: HashMap::new(),
            min_member_forces: HashMap::new(),
        }
    }
    
    /// Update envelope with a new combination result
    pub fn update(&mut self, result: &CombinationResult) {
        // Update displacement envelope
        for (node_id, disp) in &result.displacements {
            // Max
            let (max_vals, max_combos) = self.max_displacements
                .entry(node_id.clone())
                .or_insert_with(|| (vec![f64::NEG_INFINITY; disp.len()], vec![String::new(); disp.len()]));
            
            for (i, &val) in disp.iter().enumerate() {
                if val > max_vals[i] {
                    max_vals[i] = val;
                    max_combos[i] = result.combination_id.clone();
                }
            }
            
            // Min
            let (min_vals, min_combos) = self.min_displacements
                .entry(node_id.clone())
                .or_insert_with(|| (vec![f64::INFINITY; disp.len()], vec![String::new(); disp.len()]));
            
            for (i, &val) in disp.iter().enumerate() {
                if val < min_vals[i] {
                    min_vals[i] = val;
                    min_combos[i] = result.combination_id.clone();
                }
            }
        }
        
        // Similar for reactions and member forces...
        for (node_id, react) in &result.reactions {
            let (max_vals, max_combos) = self.max_reactions
                .entry(node_id.clone())
                .or_insert_with(|| (vec![f64::NEG_INFINITY; react.len()], vec![String::new(); react.len()]));
            
            for (i, &val) in react.iter().enumerate() {
                if val > max_vals[i] {
                    max_vals[i] = val;
                    max_combos[i] = result.combination_id.clone();
                }
            }
            
            let (min_vals, min_combos) = self.min_reactions
                .entry(node_id.clone())
                .or_insert_with(|| (vec![f64::INFINITY; react.len()], vec![String::new(); react.len()]));
            
            for (i, &val) in react.iter().enumerate() {
                if val < min_vals[i] {
                    min_vals[i] = val;
                    min_combos[i] = result.combination_id.clone();
                }
            }
        }
    }
}

impl Default for EnvelopeResult {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// LOAD COMBINATION ENGINE
// ============================================================================

/// Main load combination engine
pub struct LoadCombinationEngine {
    /// Defined load cases
    pub load_cases: Vec<LoadCase>,
    /// Generated combinations
    pub combinations: Vec<LoadCombination>,
    /// Design code
    pub code: DesignCode,
}

impl LoadCombinationEngine {
    /// Create a new engine
    pub fn new(code: DesignCode) -> Self {
        Self {
            load_cases: Vec::new(),
            combinations: Vec::new(),
            code,
        }
    }
    
    /// Add a load case
    pub fn add_load_case(&mut self, load_case: LoadCase) {
        self.load_cases.push(load_case);
    }
    
    /// Generate all combinations based on code
    pub fn generate_combinations(&mut self) {
        self.combinations = match self.code {
            DesignCode::Indian => {
                let mut combos = generate_is456_combinations(&self.load_cases);
                combos.extend(generate_is800_combinations(&self.load_cases));
                combos
            }
            DesignCode::ASCE7 => generate_asce7_combinations(&self.load_cases),
            DesignCode::Eurocode => generate_eurocode_combinations(&self.load_cases),
            _ => generate_is456_combinations(&self.load_cases),
        };
    }
    
    /// Add a custom combination
    pub fn add_combination(&mut self, combo: LoadCombination) {
        self.combinations.push(combo);
    }
    
    /// Get all active combinations
    pub fn get_active_combinations(&self) -> Vec<&LoadCombination> {
        self.combinations.iter().filter(|c| c.active).collect()
    }
    
    /// Get combinations by limit state
    pub fn get_by_limit_state(&self, limit_state: LimitState) -> Vec<&LoadCombination> {
        self.combinations.iter()
            .filter(|c| c.active && c.limit_state == limit_state)
            .collect()
    }
    
    /// Calculate factored load vector for a combination
    pub fn calculate_factored_loads(
        &self,
        combo: &LoadCombination,
        load_case_vectors: &HashMap<String, Vec<f64>>,
    ) -> Vec<f64> {
        // Get the size from first load case
        let size = load_case_vectors.values().next().map(|v| v.len()).unwrap_or(0);
        let mut result = vec![0.0; size];
        
        for (case_id, factor) in &combo.factors {
            if let Some(loads) = load_case_vectors.get(case_id) {
                for (i, &load) in loads.iter().enumerate() {
                    result[i] += factor * load;
                }
            }
        }
        
        result
    }
    
    /// Get total number of combinations
    pub fn count(&self) -> usize {
        self.combinations.len()
    }
    
    /// List all combination names
    pub fn list_combinations(&self) -> Vec<(&str, &str)> {
        self.combinations.iter()
            .map(|c| (c.id.as_str(), c.name.as_str()))
            .collect()
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn find_load_case_id(load_cases: &[LoadCase], load_type: LoadType) -> Option<String> {
    load_cases.iter()
        .find(|lc| lc.load_type == load_type)
        .map(|lc| lc.id.clone())
}

fn get_load_name(id: &str) -> &str {
    // Extract short name from ID
    if id.contains("WX") || id.contains("Wind") { "WX" }
    else if id.contains("WY") { "WY" }
    else if id.contains("EX") || id.contains("Seismic") { "EX" }
    else if id.contains("EY") { "EY" }
    else { id }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_sample_load_cases() -> Vec<LoadCase> {
        vec![
            LoadCase::new("DL", "Dead Load", LoadType::Dead),
            LoadCase::new("LL", "Live Load", LoadType::Live),
            LoadCase::new("WX", "Wind +X", LoadType::WindX),
            LoadCase::new("WXN", "Wind -X", LoadType::WindXNeg),
            LoadCase::new("EX", "Seismic +X", LoadType::SeismicX),
            LoadCase::new("EXN", "Seismic -X", LoadType::SeismicXNeg),
        ]
    }
    
    #[test]
    fn test_is456_combinations() {
        let load_cases = create_sample_load_cases();
        let combos = generate_is456_combinations(&load_cases);
        
        println!("IS 456 Combinations: {}", combos.len());
        for combo in &combos {
            println!("  {}: {} ({:?})", combo.id, combo.name, combo.limit_state);
        }
        
        assert!(combos.len() >= 10, "Should generate at least 10 combinations");
        
        // Check that 1.5DL + 1.5LL exists
        let has_basic = combos.iter().any(|c| {
            c.factors.get("DL") == Some(&1.5) && c.factors.get("LL") == Some(&1.5)
        });
        assert!(has_basic, "Should have 1.5DL + 1.5LL combination");
    }
    
    #[test]
    fn test_is800_combinations() {
        let load_cases = create_sample_load_cases();
        let combos = generate_is800_combinations(&load_cases);
        
        println!("IS 800 Combinations: {}", combos.len());
        assert!(combos.len() >= 8, "Should generate at least 8 combinations");
    }
    
    #[test]
    fn test_asce7_combinations() {
        let load_cases = create_sample_load_cases();
        let combos = generate_asce7_combinations(&load_cases);
        
        println!("ASCE 7 Combinations: {}", combos.len());
        for combo in &combos {
            println!("  {}: {} - {:?}", combo.id, combo.name, combo.notes);
        }
        
        assert!(combos.len() >= 7, "Should generate ASCE 7 LRFD combinations");
    }
    
    #[test]
    fn test_eurocode_combinations() {
        let load_cases = create_sample_load_cases();
        let combos = generate_eurocode_combinations(&load_cases);
        
        println!("Eurocode Combinations: {}", combos.len());
        for combo in &combos {
            println!("  {}: {}", combo.id, combo.name);
        }
        
        assert!(combos.len() >= 5, "Should generate Eurocode combinations");
    }
    
    #[test]
    fn test_combination_engine() {
        let mut engine = LoadCombinationEngine::new(DesignCode::Indian);
        
        engine.add_load_case(LoadCase::new("DL", "Dead Load", LoadType::Dead));
        engine.add_load_case(LoadCase::new("LL", "Live Load", LoadType::Live));
        engine.add_load_case(LoadCase::new("WX", "Wind +X", LoadType::WindX));
        engine.add_load_case(LoadCase::new("EX", "Seismic +X", LoadType::SeismicX));
        
        engine.generate_combinations();
        
        println!("Total combinations: {}", engine.count());
        
        let uls_combos = engine.get_by_limit_state(LimitState::Ultimate);
        let sls_combos = engine.get_by_limit_state(LimitState::Serviceability);
        
        println!("ULS combinations: {}", uls_combos.len());
        println!("SLS combinations: {}", sls_combos.len());
        
        assert!(engine.count() > 10, "Should generate many combinations");
    }
    
    #[test]
    fn test_factored_loads() {
        let mut engine = LoadCombinationEngine::new(DesignCode::Indian);
        engine.add_load_case(LoadCase::new("DL", "Dead Load", LoadType::Dead));
        engine.add_load_case(LoadCase::new("LL", "Live Load", LoadType::Live));
        engine.generate_combinations();
        
        // Sample load vectors (10 DOF)
        let mut load_vectors = HashMap::new();
        load_vectors.insert("DL".to_string(), vec![0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0]);
        load_vectors.insert("LL".to_string(), vec![0.0, -5.0, 0.0, 0.0, -8.0, 0.0, 0.0, -5.0, 0.0, 0.0]);
        
        // Get 1.5DL + 1.5LL combination
        let combo = engine.combinations.iter().find(|c| c.name.contains("1.5DL + 1.5LL")).unwrap();
        
        let factored = engine.calculate_factored_loads(combo, &load_vectors);
        
        // Expected: 1.5 * (-10) + 1.5 * (-5) = -22.5 at DOF 1
        assert!((factored[1] - (-22.5)).abs() < 0.001);
        
        println!("Factored loads for {}: {:?}", combo.name, factored);
    }
    
    #[test]
    fn test_envelope_calculation() {
        let mut envelope = EnvelopeResult::new();
        
        // Simulate two combination results
        let result1 = CombinationResult {
            combination_id: "ULS1".to_string(),
            combination_name: "1.5DL + 1.5LL".to_string(),
            limit_state: LimitState::Ultimate,
            displacements: {
                let mut m = HashMap::new();
                m.insert("N1".to_string(), vec![0.001, -0.005, 0.0]);
                m
            },
            reactions: HashMap::new(),
            member_forces: HashMap::new(),
        };
        
        let result2 = CombinationResult {
            combination_id: "ULS2".to_string(),
            combination_name: "1.5DL + 1.5WX".to_string(),
            limit_state: LimitState::Ultimate,
            displacements: {
                let mut m = HashMap::new();
                m.insert("N1".to_string(), vec![0.003, -0.002, 0.0]);
                m
            },
            reactions: HashMap::new(),
            member_forces: HashMap::new(),
        };
        
        envelope.update(&result1);
        envelope.update(&result2);
        
        let (max_disp, max_combos) = envelope.max_displacements.get("N1").unwrap();
        
        // Max dx should be 0.003 from ULS2
        assert!((max_disp[0] - 0.003).abs() < 0.0001);
        assert_eq!(max_combos[0], "ULS2");
        
        // Max dy (most negative) should be -0.002 from ULS2 (less negative = "max")
        // But for displacement, we track actual max, so -0.002 > -0.005
        assert!((max_disp[1] - (-0.002)).abs() < 0.0001);
        
        println!("Envelope max: {:?}", max_disp);
        println!("Controlling combos: {:?}", max_combos);
    }
}
