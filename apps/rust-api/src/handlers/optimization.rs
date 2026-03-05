//! Structural Optimization Handlers
//!
//! REST endpoints for FSD (Fully Stressed Design) optimization
//! and related optimization algorithms

use axum::Json;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::{ApiError, ApiResult};
use crate::optimization::{
    FSDEngine, FSDConfig, FSDResult,
    Objective, Constraint,
    MemberForces, MemberGeometry, MemberType,
    DesignCheck, check_member,
};

// ══════════════════════════════════════════════════════════════════════════
// FSD OPTIMIZATION ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

/// Request for FSD optimization
#[derive(Deserialize)]
pub struct FSDOptimizationRequest {
    /// Initial section assignments (member_id -> section_name)
    pub initial_sections: HashMap<String, String>,
    
    /// Member geometries
    pub geometries: Vec<MemberGeometry>,
    
    /// Member forces for all load combinations
    pub member_forces: Vec<MemberForces>,
    
    /// Optimization configuration
    #[serde(default)]
    pub config: FSDConfigRequest,
}

/// FSD configuration for API
#[derive(Deserialize, Serialize)]
#[serde(default)]
pub struct FSDConfigRequest {
    pub objective: String,  // "weight", "cost", "balanced"
    pub target_ur: f64,
    pub max_ur: f64,
    pub max_iterations: usize,
    pub convergence_tolerance: f64,
    pub fy: f64,
    pub group_by_type: bool,
    pub max_unique_sections: Option<usize>,
}

impl Default for FSDConfigRequest {
    fn default() -> Self {
        Self {
            objective: "weight".to_string(),
            target_ur: 0.85,
            max_ur: 1.0,
            max_iterations: 20,
            convergence_tolerance: 0.5,
            fy: 250.0,
            group_by_type: true,
            max_unique_sections: Some(8),
        }
    }
}

/// Main FSD optimization endpoint
///
/// POST /api/optimization/fsd
///
/// Mathematical Framework:
/// - Objective: min W(x) = Σ(ρᵢ Aᵢ Lᵢ)
/// - Constraints: UR ≤ 1.0, Δ ≤ Δ_allow
/// - Variables: Discrete section sizes from IS catalog
///
/// Algorithm:
/// 1. Start with initial sections
/// 2. Analyze structure → get forces
/// 3. Check capacity → get UR
/// 4. Resize: UR > 1.0 → upsize, UR < 0.8 → downsize
/// 5. Iterate until convergence
pub async fn fsd_optimize(
    Json(req): Json<FSDOptimizationRequest>,
) -> ApiResult<Json<FSDResult>> {
    // Parse objective
    let objective = match req.config.objective.as_str() {
        "weight" => Objective::MinimizeWeight,
        "cost" => Objective::MinimizeCost,
        "balanced" => Objective::Balanced,
        "max_ur" => Objective::MinimizeMaxUtilization,
        _ => Objective::MinimizeWeight,
    };
    
    // Build FSD configuration
    let config = FSDConfig {
        objective,
        constraints: vec![
            Constraint::Strength { ur_max: req.config.max_ur },
            Constraint::Deflection { limit_ratio: 300.0 },
        ],
        target_ur: req.config.target_ur,
        max_ur: req.config.max_ur,
        max_iterations: req.config.max_iterations,
        convergence_tolerance: req.config.convergence_tolerance,
        material_density: 7.85e-6,
        material_cost: Some(1.2),
        fy: req.config.fy,
        group_by_type: req.config.group_by_type,
        max_unique_sections: req.config.max_unique_sections,
    };
    
    // Create FSD engine
    let engine = FSDEngine::new(config);
    
    // Create analysis callback
    // In a real implementation, this would call the structural analysis solver
    // For now, we use the provided forces directly
    let member_forces = req.member_forces;
    let fy = req.config.fy;
    
    let analyze_fn = |sections: &HashMap<String, String>| -> Vec<DesignCheck> {
        let mut checks = Vec::new();
        
        for forces in &member_forces {
            if let Some(geom) = req.geometries.iter().find(|g| g.member_id == forces.member_id) {
                let section_name = sections.get(&forces.member_id)
                    .cloned()
                    .unwrap_or_else(|| "ISMB 200".to_string());
                
                let check = check_member(forces, geom, &section_name, fy);
                checks.push(check);
            }
        }
        
        checks
    };
    
    // Run optimization
    let result = engine.optimize(&req.initial_sections, &req.geometries, analyze_fn);
    
    Ok(Json(result))
}

// ══════════════════════════════════════════════════════════════════════════
// SINGLE MEMBER CHECK ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

/// Request for single member check
#[derive(Deserialize)]
pub struct MemberCheckRequest {
    pub forces: MemberForces,
    pub geometry: MemberGeometry,
    pub section_name: String,
    #[serde(default = "default_fy")]
    pub fy: f64,
}

fn default_fy() -> f64 { 250.0 }

/// Single member design check
///
/// POST /api/optimization/check-member
///
/// Performs comprehensive design check:
/// - Flexure: M/Md ≤ 1.0
/// - Shear: V/Vd ≤ 1.0
/// - Compression: P/Pd ≤ 1.0 (with buckling)
pub async fn check_member_endpoint(
    Json(req): Json<MemberCheckRequest>,
) -> ApiResult<Json<DesignCheck>> {
    let check = check_member(&req.forces, &req.geometry, &req.section_name, req.fy);
    Ok(Json(check))
}

// ══════════════════════════════════════════════════════════════════════════
// SECTION AUTO-SELECT ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

/// Lightweight auto-select (single member, single-shot)
#[derive(Deserialize)]
pub struct AutoSelectRequest {
    pub member_forces: Vec<MemberForces>,
    pub geometry: MemberGeometry,
    #[serde(default = "default_fy")]
    pub fy: f64,
    #[serde(default = "default_target_ur")]
    pub target_ur: f64,
}

fn default_target_ur() -> f64 { 0.85 }

#[derive(Serialize)]
pub struct AutoSelectResponse {
    pub selected_section: String,
    pub utilization_ratio: f64,
    pub weight_kg_per_m: f64,
    pub checks_by_combo: Vec<DesignCheck>,
    pub message: String,
}

/// Auto-select optimal section for single member
///
/// POST /api/optimization/auto-select
///
/// Finds lightest section that satisfies all load combinations
pub async fn auto_select_section(
    Json(req): Json<AutoSelectRequest>,
) -> ApiResult<Json<AutoSelectResponse>> {
    use crate::design_codes::is_800::ismb_database;
    
    let database = ismb_database();
    let mut best_section = None;
    let mut best_checks = Vec::new();
    let mut best_weight = f64::MAX;
    
    // Try each section from lightest to heaviest
    for section in &database {
        let mut max_ur: f64 = 0.0;
        let mut checks = Vec::new();
        
        // Check all load combinations
        for forces in &req.member_forces {
            let check = check_member(forces, &req.geometry, &section.name, req.fy);
            max_ur = max_ur.max(check.utilization_ratio);
            checks.push(check);
        }
        
        // If all combos pass and UR is good, this is our section
        if max_ur <= 1.0 && max_ur >= req.target_ur * 0.8 && section.weight < best_weight {
            best_section = Some(section.name.clone());
            best_checks = checks;
            best_weight = section.weight;
        }
    }
    
    match best_section {
        Some(section_name) => {
            let max_ur = best_checks.iter()
                .map(|c| c.utilization_ratio)
                .fold(0.0, f64::max);
            
            Ok(Json(AutoSelectResponse {
                selected_section: section_name.clone(),
                utilization_ratio: max_ur,
                weight_kg_per_m: best_weight,
                checks_by_combo: best_checks,
                message: format!("Selected {} with UR = {:.3}", section_name, max_ur),
            }))
        }
        None => {
            Err(ApiError::BadRequest(
                "No adequate section found in database".to_string()
            ))
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════
// QUICK OPTIMIZATION ENDPOINT (Simplified FSD)
// ══════════════════════════════════════════════════════════════════════════

/// Quick optimization request (no full analysis callback needed)
#[derive(Deserialize)]
pub struct QuickOptimizeRequest {
    pub members: Vec<QuickMember>,
    #[serde(default = "default_fy")]
    pub fy: f64,
    #[serde(default = "default_target_ur")]
    pub target_ur: f64,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct QuickMember {
    pub id: String,
    pub current_section: String,
    pub length_mm: f64,
    pub forces: Vec<MemberForces>,
    pub geometry: MemberGeometry,
}

#[derive(Serialize)]
pub struct QuickOptimizeResponse {
    pub members: Vec<QuickMemberResult>,
    pub total_weight_before: f64,
    pub total_weight_after: f64,
    pub weight_savings_pct: f64,
    pub success: bool,
}

#[derive(Serialize)]
pub struct QuickMemberResult {
    pub id: String,
    pub original_section: String,
    pub optimal_section: String,
    pub max_ur: f64,
    pub changed: bool,
}

/// Quick member-by-member optimization (no global iteration)
///
/// POST /api/optimization/quick
///
/// Optimizes each member independently (no stiffness redistribution)
pub async fn quick_optimize(
    Json(req): Json<QuickOptimizeRequest>,
) -> ApiResult<Json<QuickOptimizeResponse>> {
    use crate::design_codes::is_800::ismb_database;
    
    let database = ismb_database();
    let mut results = Vec::new();
    let mut total_weight_before = 0.0;
    let mut total_weight_after = 0.0;
    
    for member in &req.members {
        let length_m = member.length_mm / 1000.0;
        
        // Find current section weight
        let current_weight = database.iter()
            .find(|s| s.name == member.current_section)
            .map(|s| s.weight)
            .unwrap_or(0.0);
        
        total_weight_before += current_weight * length_m;
        
        // Find optimal section for this member
        let mut best_section = member.current_section.clone();
        let mut best_weight = current_weight;
        let mut best_ur: f64 = 0.0;
        
        for section in &database {
            let mut max_ur: f64 = 0.0;
            let mut all_pass = true;
            
            for forces in &member.forces {
                let check = check_member(forces, &member.geometry, &section.name, req.fy);
                max_ur = max_ur.max(check.utilization_ratio);
                if check.utilization_ratio > 1.0 {
                    all_pass = false;
                    break;
                }
            }
            
            if all_pass && max_ur >= req.target_ur * 0.8 && section.weight < best_weight {
                best_section = section.name.clone();
                best_weight = section.weight;
                best_ur = max_ur;
            }
        }
        
        total_weight_after += best_weight * length_m;
        
        results.push(QuickMemberResult {
            id: member.id.clone(),
            original_section: member.current_section.clone(),
            optimal_section: best_section.clone(),
            max_ur: best_ur,
            changed: best_section != member.current_section,
        });
    }
    
    let weight_savings_pct = if total_weight_before > 0.0 {
        ((total_weight_before - total_weight_after) / total_weight_before) * 100.0
    } else {
        0.0
    };
    
    Ok(Json(QuickOptimizeResponse {
        members: results,
        total_weight_before,
        total_weight_after,
        weight_savings_pct,
        success: true,
    }))
}

// ══════════════════════════════════════════════════════════════════════════
// OPTIMIZATION INFO ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

#[derive(Serialize)]
pub struct OptimizationInfo {
    pub available_objectives: Vec<String>,
    pub available_constraints: Vec<String>,
    pub section_database_size: usize,
    pub default_config: FSDConfigRequest,
    pub algorithms: Vec<AlgorithmInfo>,
}

#[derive(Serialize)]
pub struct AlgorithmInfo {
    pub name: String,
    pub description: String,
    pub best_for: String,
    pub complexity: String,
}

/// Get optimization capabilities
///
/// GET /api/optimization/info
pub async fn optimization_info() -> ApiResult<Json<OptimizationInfo>> {
    use crate::design_codes::is_800::ismb_database;
    
    let db = ismb_database();
    
    Ok(Json(OptimizationInfo {
        available_objectives: vec![
            "weight".to_string(),
            "cost".to_string(),
            "balanced".to_string(),
            "max_ur".to_string(),
        ],
        available_constraints: vec![
            "strength".to_string(),
            "deflection".to_string(),
            "buckling".to_string(),
            "fabrication".to_string(),
        ],
        section_database_size: db.len(),
        default_config: FSDConfigRequest::default(),
        algorithms: vec![
            AlgorithmInfo {
                name: "FSD".to_string(),
                description: "Fully Stressed Design - iterative section resizing based on utilization ratios".to_string(),
                best_for: "Discrete section optimization with stiffness redistribution".to_string(),
                complexity: "O(n × m × k) where n=members, m=iterations, k=load combos".to_string(),
            },
            AlgorithmInfo {
                name: "Quick".to_string(),
                description: "Single-pass member-by-member optimization (no iteration)".to_string(),
                best_for: "Fast approximation without stiffness redistribution".to_string(),
                complexity: "O(n × k) where n=members, k=load combos".to_string(),
            },
            AlgorithmInfo {
                name: "AutoSelect".to_string(),
                description: "Single member optimal section selection".to_string(),
                best_for: "Individual member design".to_string(),
                complexity: "O(s × k) where s=sections in catalog, k=load combos".to_string(),
            },
        ],
    }))
}
