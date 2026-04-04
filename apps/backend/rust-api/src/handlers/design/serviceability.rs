use axum::Json;
use serde::Deserialize;
use crate::design_codes::serviceability;
use crate::error::ApiResult;

#[derive(Debug, Clone, Deserialize)]
pub struct DeflectionCheckReq {
    pub material: String,
    pub span_mm: f64,
    pub actual_deflection_mm: f64,
    #[serde(default = "default_beam")]
    pub member_type: String,
    #[serde(default = "default_live")]
    pub load_type: String,
    #[serde(default = "default_ss")]
    pub support_condition: String,
}
fn default_beam() -> String {
    "beam".into()
}
fn default_live() -> String {
    "live".into()
}
fn default_ss() -> String {
    "simply_supported".into()
}

pub async fn deflection_check(
    Json(req): Json<DeflectionCheckReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::check_deflection(
        &req.material,
        req.span_mm,
        req.actual_deflection_mm,
        &req.member_type,
        &req.load_type,
        &req.support_condition,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct VibrationCheckReq {
    pub frequency_hz: f64,
    #[serde(default = "default_office")]
    pub occupancy: String,
}
fn default_office() -> String {
    "office".into()
}

pub async fn vibration_check(
    Json(req): Json<VibrationCheckReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::check_floor_vibration(req.frequency_hz, &req.occupancy);
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct CrackWidthReq {
    pub b: f64,
    pub d: f64,
    pub big_d: f64,
    pub cover: f64,
    pub bar_dia: f64,
    pub bar_spacing: f64,
    pub fs: f64,
    #[serde(default = "default_moderate")]
    pub exposure: String,
}
fn default_moderate() -> String {
    "moderate".into()
}

pub async fn crack_width(
    Json(req): Json<CrackWidthReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::estimate_crack_width(
        req.b,
        req.d,
        req.big_d,
        req.cover,
        req.bar_dia,
        req.bar_spacing,
        req.fs,
        &req.exposure,
    );
    Ok(Json(result))
}
