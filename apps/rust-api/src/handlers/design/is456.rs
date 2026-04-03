use axum::Json;
use serde::{Deserialize, Serialize};
use crate::design_codes::is_456;
use crate::error::ApiResult;

#[derive(Debug, Clone, Deserialize)]
pub struct FlexuralCapacityReq {
    pub b: f64,
    pub d: f64,
    pub fck: f64,
    pub fy: f64,
    pub ast: f64,
    #[serde(default)]
    pub asc: f64,
    #[serde(default)]
    pub d_prime: f64,
}

#[derive(Serialize)]
pub struct FlexuralCapacityResp {
    pub mu_knm: f64,
    pub xu_max_mm: f64,
    pub section_type: String,
}

pub async fn flexural_capacity(
    Json(req): Json<FlexuralCapacityReq>,
) -> ApiResult<Json<FlexuralCapacityResp>> {
    let xu_max = is_456::xu_max_ratio(req.fy) * req.d;
    let mu = if req.asc > 0.0 && req.d_prime > 0.0 {
        is_456::flexural_capacity_doubly(
            req.b,
            req.d,
            req.d_prime,
            req.fck,
            req.fy,
            req.ast,
            req.asc,
        )
    } else {
        is_456::flexural_capacity_singly(req.b, req.d, req.fck, req.fy, req.ast)
    };
    let xu = (0.87 * req.fy * req.ast) / (0.36 * req.fck * req.b);
    Ok(Json(FlexuralCapacityResp {
        mu_knm: mu,
        xu_max_mm: xu_max,
        section_type: if xu > xu_max {
            "over-reinforced".into()
        } else {
            "under-reinforced".into()
        },
    }))
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShearDesignReq {
    pub b: f64,
    pub d: f64,
    pub fck: f64,
    pub fy_stirrup: f64,
    pub vu_kn: f64,
    pub pt: f64,
    #[serde(default = "default_asv")]
    pub asv: f64,
}
fn default_asv() -> f64 {
    100.0
}

pub async fn shear_design(
    Json(req): Json<ShearDesignReq>,
) -> ApiResult<Json<is_456::ShearCheckResult>> {
    let result = is_456::design_shear(
        req.vu_kn,
        req.b,
        req.d,
        req.fck,
        req.fy_stirrup,
        req.pt,
        req.asv,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct BiaxialColumnReq {
    pub b: f64,
    pub d: f64,
    pub fck: f64,
    pub fy: f64,
    pub ast_total: f64,
    pub pu_kn: f64,
    pub mux_knm: f64,
    pub muy_knm: f64,
    #[serde(default = "default_50")]
    pub d_dash: f64,
    #[serde(default)]
    pub leff_x: f64,
    #[serde(default)]
    pub leff_y: f64,
}
#[allow(dead_code)]
fn default_50() -> f64 {
    50.0
}

#[allow(dead_code)]
pub async fn biaxial_column(
    Json(req): Json<BiaxialColumnReq>,
) -> ApiResult<Json<is_456::BiaxialColumnResult>> {
    let result = is_456::check_column_biaxial(
        req.b,
        req.d,
        req.fck,
        req.fy,
        req.pu_kn,
        req.mux_knm,
        req.muy_knm,
        req.ast_total,
        req.d_dash,
        req.leff_x,
        req.leff_y,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct DeflectionCheckIs456Req {
    pub span_mm: f64,
    pub effective_depth: f64,
    pub support: String,
    pub pt: f64,
    pub pc: f64,
    pub fy: f64,
    pub actual_ast: f64,
    pub required_ast: f64,
}

#[allow(dead_code)]
pub async fn deflection_check_is456(
    Json(req): Json<DeflectionCheckIs456Req>,
) -> ApiResult<Json<is_456::DeflectionCheckResult>> {
    let result = is_456::check_deflection(
        req.span_mm,
        req.effective_depth,
        &req.support,
        req.pt,
        req.pc,
        req.fy,
        req.actual_ast,
        req.required_ast,
    );
    Ok(Json(result))
}

// ── IS 456 Torsion Design (Cl. 41.1–41.4) ───────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct TorsionDesignReq {
    pub b_mm: f64,
    pub d_mm: f64,
    pub d_prime_mm: f64,
    pub fck_mpa: f64,
    pub fy_mpa: f64,
    pub tu_knm: f64,
    pub mu_knm: f64,
    pub vu_kn: f64,
    #[serde(default)]
    pub asv_mm2: f64,
    #[serde(default)]
    pub pt_percent: f64,
}

pub async fn torsion_design(
    Json(req): Json<TorsionDesignReq>,
) -> ApiResult<Json<is_456::TorsionDesignResult>> {
    let result = is_456::design_torsion(
        req.tu_knm,
        req.vu_kn,
        req.mu_knm,
        req.b_mm,
        req.d_mm,
        req.d_prime_mm,
        req.fck_mpa,
        req.fy_mpa,
        req.asv_mm2,
        req.pt_percent,
    );
    Ok(Json(result))
}
