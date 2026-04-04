use axum::Json;
use serde::Deserialize;

use crate::design_codes::{aisc_360, is_800};
use crate::error::{ApiError, ApiResult};

fn default_one_usize() -> usize {
    1
}

fn default_one_f64() -> f64 {
    1.0
}

fn default_weld_type() -> String {
    "shop".to_string()
}

pub(crate) fn parse_is800_version(s: Option<&str>) -> is_800::IS800Version {
    match s.unwrap_or("IS800_2007").to_lowercase().as_str() {
        "is800_2025_draft" | "2025" | "draft" | "is800draft" => is_800::IS800Version::V2025Draft,
        _ => is_800::IS800Version::V2007,
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct BoltBearingReq {
    pub bolt_dia: f64,
    pub grade: String,
    pub plate_fu: f64,
    pub plate_thk: f64,
    pub n_bolts: usize,
    #[serde(default = "default_one_usize")]
    pub n_shear_planes: usize,
    pub edge_dist: f64,
    pub pitch: f64,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn bolt_bearing(
    Json(req): Json<BoltBearingReq>,
) -> ApiResult<Json<is_800::BoltBearingResult>> {
    let version = parse_is800_version(req.code_version.as_deref());
    match is_800::design_bolt_bearing_with_version(
        req.bolt_dia,
        &req.grade,
        req.plate_fu,
        req.plate_thk,
        req.n_bolts,
        req.n_shear_planes,
        req.edge_dist,
        req.pitch,
        version,
    ) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct BoltHsfgReq {
    pub bolt_dia: f64,
    pub grade: String,
    pub n_bolts: usize,
    pub n_effective_interfaces: usize,
    pub mu_f: f64,
    #[serde(default = "default_one_f64")]
    pub kh: f64,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn bolt_hsfg(Json(req): Json<BoltHsfgReq>) -> ApiResult<Json<is_800::BoltHsfgResult>> {
    let version = parse_is800_version(req.code_version.as_deref());
    match is_800::design_bolt_hsfg_with_version(
        req.bolt_dia,
        &req.grade,
        req.n_bolts,
        req.n_effective_interfaces,
        req.mu_f,
        req.kh,
        version,
    ) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct FilletWeldReq {
    pub weld_size: f64,
    pub weld_length: f64,
    pub weld_fu: f64,
    pub load_kn: f64,
    #[serde(default = "default_weld_type")]
    pub weld_type: String,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn fillet_weld(Json(req): Json<FilletWeldReq>) -> ApiResult<Json<is_800::WeldResult>> {
    let version = parse_is800_version(req.code_version.as_deref());
    let result = is_800::design_fillet_weld_with_version(
        req.weld_size,
        req.weld_length,
        req.weld_fu,
        req.load_kn,
        &req.weld_type,
        version,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct AutoSelectReq {
    pub fy: f64,
    #[serde(default)]
    pub pu_kn: f64,
    pub mux_knm: f64,
    #[serde(default)]
    pub muy_knm: f64,
    pub vu_kn: f64,
    pub lx_mm: f64,
    pub ly_mm: f64,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn auto_select(
    Json(req): Json<AutoSelectReq>,
) -> ApiResult<Json<is_800::AutoSelectResult>> {
    let version = parse_is800_version(req.code_version.as_deref());
    let result = is_800::auto_select_section_with_version(
        req.fy,
        req.pu_kn,
        req.mux_knm,
        req.muy_knm,
        req.vu_kn,
        req.lx_mm,
        req.ly_mm,
        version,
    );
    Ok(Json(result))
}

// ── AISC 360 Steel Checks ────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AiscBendingReq {
    pub section: aisc_360::AiscSection,
    pub params: aisc_360::AiscDesignParams,
}

pub async fn aisc_bending(
    Json(req): Json<AiscBendingReq>,
) -> ApiResult<Json<aisc_360::AiscCapacity>> {
    let cap = aisc_360::calculate_bending_capacity(&req.section, &req.params);
    Ok(Json(cap))
}

pub async fn aisc_sections() -> ApiResult<Json<Vec<aisc_360::AiscSection>>> {
    Ok(Json(aisc_360::aisc_w_sections()))
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiscShearReq {
    pub d_mm: f64,
    pub tw_mm: f64,
    pub fy_mpa: f64,
    pub vu_kn: f64,
}

pub async fn aisc_shear(
    Json(req): Json<AiscShearReq>,
) -> ApiResult<Json<aisc_360::AiscShearCapacity>> {
    let cap = aisc_360::calculate_shear_capacity(req.d_mm, req.tw_mm, req.fy_mpa, req.vu_kn);
    Ok(Json(cap))
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiscInteractionReq {
    pub pu_kn: f64,
    pub phi_pn_kn: f64,
    pub mu_x_knm: f64,
    pub phi_mn_x_knm: f64,
    pub mu_y_knm: f64,
    pub phi_mn_y_knm: f64,
}

pub async fn aisc_interaction(
    Json(req): Json<AiscInteractionReq>,
) -> ApiResult<Json<aisc_360::AiscInteractionResult>> {
    let result = aisc_360::check_interaction_h1(
        req.pu_kn,
        req.phi_pn_kn,
        req.mu_x_knm,
        req.phi_mn_x_knm,
        req.mu_y_knm,
        req.phi_mn_y_knm,
    );
    Ok(Json(result))
}

pub async fn aisc_compression(
    Json(req): Json<aisc_360::AiscCompressionParams>,
) -> ApiResult<Json<aisc_360::AiscCompressionCapacity>> {
    let cap = aisc_360::calculate_compression_capacity(&req);
    Ok(Json(cap))
}
