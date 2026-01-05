//! Structural design code check handlers (IS 456, AISC, Eurocode)

use axum::{
    extract::State,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::{ApiError, ApiResult};
use crate::AppState;

/// Concrete design input (IS 456)
#[derive(Debug, Deserialize)]
pub struct ConcreteDesignInput {
    // Section properties
    pub b: f64,      // Width (mm)
    pub d: f64,      // Effective depth (mm)
    pub d_prime: f64, // Cover to compression steel (mm)
    
    // Material properties
    pub fck: f64,    // Characteristic compressive strength (N/mm²)
    pub fy: f64,     // Yield strength of steel (N/mm²)
    
    // Forces (from analysis)
    pub mu: f64,     // Ultimate moment (kN-m)
    pub vu: f64,     // Ultimate shear (kN)
    pub pu: Option<f64>, // Axial load if any (kN)
}

/// IS 456 concrete design result
#[derive(Debug, Serialize)]
pub struct ConcreteDesignResult {
    pub success: bool,
    pub code: String,
    
    // Flexure design
    pub ast_required: f64,      // Required tension steel (mm²)
    pub ast_min: f64,           // Minimum steel (mm²)
    pub ast_max: f64,           // Maximum steel (mm²)
    pub ast_provided: f64,      // Suggested steel (mm²)
    pub bar_suggestion: String, // e.g., "4-16φ + 2-12φ"
    pub depth_ok: bool,         // Is section depth adequate?
    
    // Shear design
    pub tau_v: f64,             // Nominal shear stress (N/mm²)
    pub tau_c: f64,             // Design shear strength (N/mm²)
    pub shear_ok: bool,
    pub stirrup_suggestion: String, // e.g., "8φ @ 150 c/c"
    
    // Utilization
    pub flexure_ratio: f64,     // Mu/Mu_capacity
    pub shear_ratio: f64,       // Vu/Vu_capacity
}

/// POST /api/design/is456 - IS 456 concrete design check
pub async fn design_is456(
    State(_state): State<Arc<AppState>>,
    Json(input): Json<ConcreteDesignInput>,
) -> ApiResult<Json<ConcreteDesignResult>> {
    // IS 456:2000 Concrete Design Check
    
    let b = input.b;
    let d = input.d;
    let fck = input.fck;
    let fy = input.fy;
    let mu = input.mu * 1e6; // Convert kN-m to N-mm
    let vu = input.vu * 1000.0; // Convert kN to N
    
    // Material factors
    let gamma_m_concrete = 1.5;
    let gamma_m_steel = 1.15;
    
    // Design constants (IS 456 Cl. 38.1)
    let xu_max_by_d = if fy <= 250.0 {
        0.53
    } else if fy <= 415.0 {
        0.48
    } else {
        0.46
    };
    
    // Calculate limiting moment (Mu,lim)
    let xu_max = xu_max_by_d * d;
    let mu_lim = 0.36 * fck * b * xu_max * (d - 0.416 * xu_max);
    
    let depth_ok = mu <= mu_lim;
    
    // Calculate required steel area
    let ast_required = if mu <= mu_lim {
        // Singly reinforced
        let fcd = 0.446 * fck;
        let fsd = 0.87 * fy;
        
        // Using quadratic formula from IS 456
        let r = mu / (b * d * d * fcd);
        let pt = (1.0 - (1.0 - 4.2 * r).sqrt()) / 2.1 * (fck / fy) * 100.0;
        pt * b * d / 100.0
    } else {
        // Doubly reinforced (return maximum for singly as approximation)
        mu / (0.87 * fy * 0.9 * d)
    };
    
    // Minimum and maximum steel (IS 456 Cl. 26.5.1.1)
    let ast_min = 0.85 * b * d / fy;
    let ast_max = 0.04 * b * d;
    
    let ast_provided = ast_required.max(ast_min);
    
    // Bar suggestion
    let bar_suggestion = suggest_reinforcement(ast_provided);
    
    // Shear design (IS 456 Cl. 40)
    let tau_v = vu / (b * d);
    
    // Design shear strength of concrete (IS 456 Table 19)
    let pt = ast_provided * 100.0 / (b * d);
    let tau_c = calculate_tau_c(fck, pt);
    
    let shear_ok = tau_v <= 0.5 * fck.sqrt();
    
    // Stirrup suggestion
    let stirrup_suggestion = if tau_v <= tau_c {
        "Minimum stirrups: 8φ @ 300 c/c".to_string()
    } else {
        let vus = (tau_v - tau_c) * b * d;
        let sv = 0.87 * 415.0 * 2.0 * 50.26 * d / vus; // 8mm 2-legged
        format!("8φ @ {} c/c", (sv.min(300.0) / 25.0).floor() * 25.0)
    };
    
    Ok(Json(ConcreteDesignResult {
        success: true,
        code: "IS 456:2000".to_string(),
        ast_required,
        ast_min,
        ast_max,
        ast_provided,
        bar_suggestion,
        depth_ok,
        tau_v,
        tau_c,
        shear_ok,
        stirrup_suggestion,
        flexure_ratio: mu / mu_lim,
        shear_ratio: tau_v / (0.5 * fck.sqrt()),
    }))
}

fn calculate_tau_c(fck: f64, pt: f64) -> f64 {
    // IS 456 Table 19 - Design shear strength of concrete
    let pt = pt.min(3.0);
    let beta = 0.8 * fck / (6.89 * pt).max(1.0);
    let tau_c = 0.85 * (0.8 * fck).sqrt() * (1.0 + 5.0 * beta).sqrt() - 1.0 / (6.0 * beta);
    tau_c.max(0.0)
}

fn suggest_reinforcement(area: f64) -> String {
    // Suggest practical bar arrangement
    let area_16 = 201.0; // 16mm bar
    let area_20 = 314.0; // 20mm bar
    let area_25 = 491.0; // 25mm bar
    
    if area <= 4.0 * area_16 {
        let n = (area / area_16).ceil() as i32;
        format!("{}-16φ", n)
    } else if area <= 4.0 * area_20 {
        let n = (area / area_20).ceil() as i32;
        format!("{}-20φ", n)
    } else {
        let n = (area / area_25).ceil() as i32;
        format!("{}-25φ", n)
    }
}

/// Steel design input (AISC)
#[derive(Debug, Deserialize)]
pub struct SteelDesignInput {
    // Section properties
    pub section_id: String,  // e.g., "W14x30"
    pub length: f64,         // Unbraced length (mm)
    pub k: f64,              // Effective length factor
    
    // Material properties
    pub fy: f64,             // Yield strength (N/mm² or MPa)
    pub e: f64,              // Elastic modulus (N/mm²)
    
    // Forces (from analysis)
    pub pu: f64,             // Factored axial load (kN)
    pub mu_x: f64,           // Factored moment X (kN-m)
    pub mu_y: f64,           // Factored moment Y (kN-m)
    pub vu: f64,             // Factored shear (kN)
}

/// AISC steel design result
#[derive(Debug, Serialize)]
pub struct SteelDesignResult {
    pub success: bool,
    pub code: String,
    
    // Axial capacity
    pub pn: f64,             // Nominal axial strength (kN)
    pub phi_pn: f64,         // Design axial strength (kN)
    pub slenderness: f64,    // KL/r
    
    // Flexural capacity
    pub mn_x: f64,           // Nominal moment X (kN-m)
    pub mn_y: f64,           // Nominal moment Y (kN-m)
    pub phi_mn_x: f64,       // Design moment X (kN-m)
    pub phi_mn_y: f64,       // Design moment Y (kN-m)
    
    // Shear capacity
    pub vn: f64,             // Nominal shear (kN)
    pub phi_vn: f64,         // Design shear (kN)
    
    // Interaction check (H1-1a or H1-1b)
    pub interaction_ratio: f64,
    pub interaction_equation: String,
    pub design_ok: bool,
}

/// POST /api/design/aisc - AISC 360 steel design check
pub async fn design_aisc(
    State(_state): State<Arc<AppState>>,
    Json(input): Json<SteelDesignInput>,
) -> ApiResult<Json<SteelDesignResult>> {
    // Get section properties (simplified - in production, use database)
    let (a, ix, iy, sx, sy, rx, ry) = get_section_properties(&input.section_id)?;
    
    let fy = input.fy;
    let e = input.e;
    let l = input.length;
    let k = input.k;
    
    // Slenderness ratio
    let kl_rx = k * l / rx;
    let kl_ry = k * l / ry;
    let slenderness = kl_rx.max(kl_ry);
    
    // Column capacity (AISC E3)
    let fe = std::f64::consts::PI.powi(2) * e / slenderness.powi(2);
    let fcr = if slenderness <= 4.71 * (e / fy).sqrt() {
        fy * 0.658_f64.powf(fy / fe)
    } else {
        0.877 * fe
    };
    
    let pn = fcr * a / 1000.0; // kN
    let phi_pn = 0.9 * pn;     // φ = 0.9 for compression
    
    // Flexural capacity (AISC F2 - assuming compact section)
    let mp_x = fy * sx * 1.5 / 1e6; // Plastic moment (kN-m)
    let mp_y = fy * sy * 1.5 / 1e6;
    let mn_x = mp_x;  // For compact sections, Mn = Mp
    let mn_y = mp_y;
    let phi_mn_x = 0.9 * mn_x;
    let phi_mn_y = 0.9 * mn_y;
    
    // Shear capacity (AISC G2)
    let aw = a * 0.6;  // Approximate web area
    let vn = 0.6 * fy * aw / 1000.0;
    let phi_vn = 1.0 * vn; // φv = 1.0 for shear
    
    // Interaction check (AISC H1)
    let pu = input.pu;
    let mu_x = input.mu_x;
    let mu_y = input.mu_y;
    
    let pr_pc = pu / phi_pn;
    
    let (interaction_ratio, equation) = if pr_pc >= 0.2 {
        // Equation H1-1a
        let ratio = pr_pc + 8.0 / 9.0 * (mu_x / phi_mn_x + mu_y / phi_mn_y);
        (ratio, "H1-1a".to_string())
    } else {
        // Equation H1-1b
        let ratio = pr_pc / 2.0 + (mu_x / phi_mn_x + mu_y / phi_mn_y);
        (ratio, "H1-1b".to_string())
    };
    
    Ok(Json(SteelDesignResult {
        success: true,
        code: "AISC 360-22".to_string(),
        pn,
        phi_pn,
        slenderness,
        mn_x,
        mn_y,
        phi_mn_x,
        phi_mn_y,
        vn,
        phi_vn,
        interaction_ratio,
        interaction_equation: equation,
        design_ok: interaction_ratio <= 1.0,
    }))
}

fn get_section_properties(section_id: &str) -> Result<(f64, f64, f64, f64, f64, f64, f64), ApiError> {
    // Simplified section database
    match section_id.to_uppercase().as_str() {
        "W14X30" => Ok((5680.0, 123e6, 12.1e6, 697e3, 141e3, 147.0, 46.2)),
        "W14X22" => Ok((4180.0, 82.8e6, 4.39e6, 473e3, 69.1e3, 141.0, 32.5)),
        "W18X35" => Ok((6650.0, 231e6, 8.33e6, 1027e3, 109e3, 186.0, 35.4)),
        "W21X44" => Ok((8390.0, 351e6, 11e6, 1337e3, 133e3, 204.0, 36.2)),
        "ISMB300" => Ok((5626.0, 79.9e6, 4.53e6, 533e3, 64.7e3, 119.0, 28.4)),
        "ISMB400" => Ok((7850.0, 205e6, 6.22e6, 1023e3, 88.9e3, 161.0, 28.1)),
        _ => Err(ApiError::BadRequest(format!("Unknown section: {}", section_id))),
    }
}

/// Eurocode design input
#[derive(Debug, Deserialize)]
pub struct EurocodeDesignInput {
    pub element_type: String,  // "beam", "column", "slab"
    pub material: String,      // "steel", "concrete"
    
    // Geometry
    pub length: f64,
    pub section: EurocodeSection,
    
    // Material
    pub fyk: Option<f64>,      // Steel yield (MPa)
    pub fck: Option<f64>,      // Concrete characteristic (MPa)
    
    // Forces
    pub ned: f64,              // Axial force (kN)
    pub med: f64,              // Bending moment (kN-m)
    pub ved: f64,              // Shear force (kN)
}

#[derive(Debug, Deserialize)]
pub struct EurocodeSection {
    pub b: f64,
    pub h: f64,
    pub tf: Option<f64>,
    pub tw: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct EurocodeDesignResult {
    pub success: bool,
    pub code: String,
    
    // Resistance
    pub nrd: f64,              // Axial resistance (kN)
    pub mrd: f64,              // Moment resistance (kN-m)
    pub vrd: f64,              // Shear resistance (kN)
    
    // Utilization ratios
    pub axial_ratio: f64,
    pub moment_ratio: f64,
    pub shear_ratio: f64,
    pub combined_ratio: f64,
    
    pub design_ok: bool,
}

/// POST /api/design/eurocode - Eurocode design check
pub async fn design_eurocode(
    State(_state): State<Arc<AppState>>,
    Json(input): Json<EurocodeDesignInput>,
) -> ApiResult<Json<EurocodeDesignResult>> {
    let b = input.section.b;
    let h = input.section.h;
    let area = b * h;
    
    let (nrd, mrd, vrd) = match input.material.as_str() {
        "steel" => {
            let fyk = input.fyk.unwrap_or(355.0);
            let gamma_m = 1.0;
            let fyd = fyk / gamma_m;
            
            let nrd = fyd * area / 1000.0;
            let wpl = b * h * h / 4.0;  // Plastic section modulus (rectangular)
            let mrd = fyd * wpl / 1e6;
            let vrd = fyd / 3.0_f64.sqrt() * 0.9 * area / 1000.0;
            
            (nrd, mrd, vrd)
        }
        "concrete" => {
            let fck = input.fck.unwrap_or(30.0);
            let fcd = 0.85 * fck / 1.5;
            let fyk = input.fyk.unwrap_or(500.0);
            
            let nrd = fcd * area / 1000.0;
            let d = h * 0.9;  // Effective depth
            let z = 0.9 * d;
            let mrd = 0.167 * fcd * b * d * d / 1e6;  // Singly reinforced limit
            let vrd = 0.18 / 1.5 * (100.0 * 0.01 * fck).powf(1.0/3.0) * b * d / 1000.0;
            
            (nrd, mrd, vrd)
        }
        _ => {
            return Err(ApiError::BadRequest("Material must be 'steel' or 'concrete'".into()));
        }
    };
    
    let axial_ratio = (input.ned / nrd).abs();
    let moment_ratio = (input.med / mrd).abs();
    let shear_ratio = (input.ved / vrd).abs();
    
    // Combined check (simplified)
    let combined_ratio = axial_ratio + moment_ratio;
    
    Ok(Json(EurocodeDesignResult {
        success: true,
        code: "EN 1992/1993".to_string(),
        nrd,
        mrd,
        vrd,
        axial_ratio,
        moment_ratio,
        shear_ratio,
        combined_ratio,
        design_ok: combined_ratio <= 1.0 && shear_ratio <= 1.0,
    }))
}
