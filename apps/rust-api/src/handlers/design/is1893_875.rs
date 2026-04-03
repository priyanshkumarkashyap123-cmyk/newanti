use axum::Json;
use serde::Deserialize;
use crate::design_codes::{is_1893, is_875};
use crate::error::{ApiError, ApiResult};

pub(crate) fn parse_zone(s: &str) -> Result<is_1893::SeismicZone, ApiError> {
    super::parse_zone(s)
}

pub(crate) fn parse_soil(s: &str) -> Result<is_1893::SoilType, ApiError> {
    super::parse_soil(s)
}

pub(crate) fn parse_is1893_version(code_version: Option<&str>) -> is_1893::IS1893Version {
    match code_version {
        Some("is1893_2025_sandbox") | Some("IS1893_2025_SANDBOX") => is_1893::IS1893Version::V2025Sandbox,
        _ => is_1893::IS1893Version::V2016,
    }
}

pub(crate) fn parse_terrain(s: &str) -> Result<is_875::TerrainCategory, ApiError> {
    match s {
        "1" | "open" => Ok(is_875::TerrainCategory::Category1),
        "2" | "suburban" => Ok(is_875::TerrainCategory::Category2),
        "3" | "urban" => Ok(is_875::TerrainCategory::Category3),
        "4" | "dense" => Ok(is_875::TerrainCategory::Category4),
        _ => Err(ApiError::BadRequest(format!("Invalid terrain: {s}"))),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct BaseShearReq {
    pub zone: String,
    pub soil: String,
    pub importance: f64,
    pub response_reduction: f64,
    pub period: f64,
    pub seismic_weight_kn: f64,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn base_shear(Json(req): Json<BaseShearReq>) -> ApiResult<Json<is_1893::BaseShearResult>> {
    let zone = parse_zone(&req.zone)?;
    let soil = parse_soil(&req.soil)?;
    let version = parse_is1893_version(req.code_version.as_deref());
    let result = is_1893::calculate_base_shear_with_version(
        req.seismic_weight_kn,
        req.period,
        zone,
        soil,
        req.importance,
        req.response_reduction,
        version,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct EqForcesReq {
    pub node_weights: Vec<is_1893::NodeWeight>,
    pub zone: String,
    pub soil: String,
    pub importance: f64,
    pub response_reduction: f64,
    pub building_type: String,
    pub base_dimension: f64,
    pub direction: String,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn eq_forces(
    Json(req): Json<EqForcesReq>,
) -> ApiResult<Json<is_1893::EqForceResult>> {
    let zone = parse_zone(&req.zone)?;
    let soil = parse_soil(&req.soil)?;
    let version = parse_is1893_version(req.code_version.as_deref());
    let result = is_1893::generate_equivalent_lateral_forces_with_version(
        &req.node_weights,
        zone,
        soil,
        req.importance,
        req.response_reduction,
        &req.building_type,
        req.base_dimension,
        &req.direction,
        version,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct DriftCheckReq {
    pub storey_height_mm: f64,
    pub elastic_drift_mm: f64,
    pub response_reduction: f64,
    pub storey_number: usize,
    #[serde(default)]
    pub code_version: Option<String>,
}

pub async fn drift_check(
    Json(req): Json<DriftCheckReq>,
) -> ApiResult<Json<is_1893::DriftCheckResult>> {
    let version = parse_is1893_version(req.code_version.as_deref());
    let result = is_1893::check_storey_drift_with_version(
        req.storey_height_mm,
        req.elastic_drift_mm,
        req.response_reduction,
        req.storey_number,
        version,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct WindPerStoreyReq {
    pub vb: f64,
    pub storey_heights: Vec<f64>,
    pub tributary_width: f64,
    pub terrain: String,
    #[serde(default = "default_cf")]
    pub cf: f64,
    #[serde(default = "default_k1")]
    pub k1: f64,
    #[serde(default = "default_k3")]
    pub k3: f64,
}
fn default_cf() -> f64 {
    1.0
}
fn default_k1() -> f64 {
    1.0
}
fn default_k3() -> f64 {
    1.0
}

pub async fn wind_per_storey(
    Json(req): Json<WindPerStoreyReq>,
) -> ApiResult<Json<Vec<is_875::StoreyWindForce>>> {
    let terrain = parse_terrain(&req.terrain)?;
    let result = is_875::wind_force_per_storey(
        req.vb,
        &req.storey_heights,
        req.tributary_width,
        terrain,
        req.cf,
        req.k1,
        req.k3,
    );
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct PressureCoeffReq {
    pub h_by_w: f64,
    pub opening_ratio: f64,
}

pub async fn pressure_coefficients(
    Json(req): Json<PressureCoeffReq>,
) -> ApiResult<Json<is_875::PressureCoefficients>> {
    Ok(Json(is_875::pressure_coefficients_rectangular(
        req.h_by_w,
        req.opening_ratio,
    )))
}

#[derive(Debug, Clone, Deserialize)]
pub struct LiveLoadReq {
    pub occupancy: String,
}

#[derive(Debug, serde::Serialize)]
pub struct LiveLoadResp {
    pub occupancy: String,
    #[serde(rename = "live_load_kN_m2")]
    pub live_load_k_n_m2: f64,
}

pub async fn live_load(Json(req): Json<LiveLoadReq>) -> ApiResult<Json<LiveLoadResp>> {
    let ll = is_875::live_load(&req.occupancy);
    Ok(Json(LiveLoadResp {
        occupancy: req.occupancy.clone(),
        live_load_k_n_m2: ll,
    }))
}

#[derive(Debug, Clone, Deserialize)]
pub struct LiveLoadReductionReq {
    pub tributary_area: f64,
    pub num_floors: usize,
}

#[derive(Debug, serde::Serialize)]
pub struct LiveLoadReductionResp {
    pub reduction_factor: f64,
}

pub async fn live_load_reduction(
    Json(req): Json<LiveLoadReductionReq>,
) -> ApiResult<Json<LiveLoadReductionResp>> {
    let rf = is_875::live_load_reduction(req.tributary_area, req.num_floors);
    Ok(Json(LiveLoadReductionResp { reduction_factor: rf }))
}
