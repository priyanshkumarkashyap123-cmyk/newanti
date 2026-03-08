//! Design Code Check Handlers
//!
//! REST endpoints exposing IS 456, IS 800, IS 1893, IS 875, and serviceability
//! checks via the Rust design_codes module. These replace the Python FastAPI
//! endpoints in routers/is_code_checks.py.

use axum::Json;
use serde::{Deserialize, Serialize};

use crate::design_codes::{is_456, is_800, is_1893, is_875, serviceability};
use crate::error::{ApiError, ApiResult};

// ── IS 456 ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
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
            req.b, req.d, req.d_prime, req.fck, req.fy, req.ast, req.asc,
        )
    } else {
        is_456::flexural_capacity_singly(req.b, req.d, req.fck, req.fy, req.ast)
    };
    let xu = (0.87 * req.fy * req.ast) / (0.36 * req.fck * req.b);
    Ok(Json(FlexuralCapacityResp {
        mu_knm: mu,
        xu_max_mm: xu_max,
        section_type: if xu > xu_max { "over-reinforced".into() } else { "under-reinforced".into() },
    }))
}

#[derive(Deserialize)]
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
fn default_asv() -> f64 { 100.0 }

pub async fn shear_design(
    Json(req): Json<ShearDesignReq>,
) -> ApiResult<Json<is_456::ShearCheckResult>> {
    let result = is_456::design_shear(
        req.vu_kn, req.b, req.d, req.fck, req.fy_stirrup, req.pt, req.asv,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
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
fn default_50() -> f64 { 50.0 }

pub async fn biaxial_column(
    Json(req): Json<BiaxialColumnReq>,
) -> ApiResult<Json<is_456::BiaxialColumnResult>> {
    let result = is_456::check_column_biaxial(
        req.b, req.d, req.fck, req.fy,
        req.pu_kn, req.mux_knm, req.muy_knm,
        req.ast_total, req.d_dash, req.leff_x, req.leff_y,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
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

pub async fn deflection_check_is456(
    Json(req): Json<DeflectionCheckIs456Req>,
) -> ApiResult<Json<is_456::DeflectionCheckResult>> {
    let result = is_456::check_deflection(
        req.span_mm, req.effective_depth, &req.support,
        req.pt, req.pc, req.fy, req.actual_ast, req.required_ast,
    );
    Ok(Json(result))
}

// ── IS 800 ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
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
}
fn default_one_usize() -> usize { 1 }

pub async fn bolt_bearing(
    Json(req): Json<BoltBearingReq>,
) -> ApiResult<Json<is_800::BoltBearingResult>> {
    match is_800::design_bolt_bearing(
        req.bolt_dia, &req.grade, req.plate_fu, req.plate_thk,
        req.n_bolts, req.n_shear_planes, req.edge_dist, req.pitch,
    ) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Deserialize)]
pub struct BoltHsfgReq {
    pub bolt_dia: f64,
    pub grade: String,
    pub n_bolts: usize,
    pub n_effective_interfaces: usize,
    pub mu_f: f64,
    #[serde(default = "default_one_f64")]
    pub kh: f64,
}
fn default_one_f64() -> f64 { 1.0 }

pub async fn bolt_hsfg(
    Json(req): Json<BoltHsfgReq>,
) -> ApiResult<Json<is_800::BoltHsfgResult>> {
    match is_800::design_bolt_hsfg(
        req.bolt_dia, &req.grade, req.n_bolts,
        req.n_effective_interfaces, req.mu_f, req.kh,
    ) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Deserialize)]
pub struct FilletWeldReq {
    pub weld_size: f64,
    pub weld_length: f64,
    pub weld_fu: f64,
    pub load_kn: f64,
    #[serde(default = "default_weld_type")]
    pub weld_type: String,
}

fn default_weld_type() -> String { "shop".to_string() }

pub async fn fillet_weld(
    Json(req): Json<FilletWeldReq>,
) -> ApiResult<Json<is_800::WeldResult>> {
    let result = is_800::design_fillet_weld(
        req.weld_size, req.weld_length, req.weld_fu, req.load_kn, &req.weld_type,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
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
}

pub async fn auto_select(
    Json(req): Json<AutoSelectReq>,
) -> ApiResult<Json<is_800::AutoSelectResult>> {
    let result = is_800::auto_select_section(
        req.fy, req.pu_kn, req.mux_knm, req.muy_knm,
        req.vu_kn, req.lx_mm, req.ly_mm,
    );
    Ok(Json(result))
}

// ── IS 1893 ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct BaseShearReq {
    pub zone: String,
    pub soil: String,
    pub importance: f64,
    pub response_reduction: f64,
    pub period: f64,
    pub seismic_weight_kn: f64,
}

pub async fn base_shear(
    Json(req): Json<BaseShearReq>,
) -> ApiResult<Json<is_1893::BaseShearResult>> {
    let zone = parse_zone(&req.zone)?;
    let soil = parse_soil(&req.soil)?;
    let result = is_1893::calculate_base_shear(
        req.seismic_weight_kn, req.period,
        zone, soil, req.importance, req.response_reduction,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct EqForcesReq {
    pub zone: String,
    pub soil: String,
    pub importance: f64,
    pub response_reduction: f64,
    pub building_type: String,
    pub base_dimension: f64,
    #[serde(default = "default_x_dir")]
    pub direction: String,
    pub node_weights: Vec<is_1893::NodeWeight>,
}
fn default_x_dir() -> String { "x".into() }

pub async fn eq_forces(
    Json(req): Json<EqForcesReq>,
) -> ApiResult<Json<is_1893::EqForceResult>> {
    let zone = parse_zone(&req.zone)?;
    let soil = parse_soil(&req.soil)?;
    let result = is_1893::generate_equivalent_lateral_forces(
        &req.node_weights, zone, soil,
        req.importance, req.response_reduction,
        &req.building_type, req.base_dimension, &req.direction,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct DriftCheckReq {
    pub storey_height_mm: f64,
    pub elastic_drift_mm: f64,
    pub response_reduction: f64,
    #[serde(default = "default_storey_1")]
    pub storey_number: usize,
}
fn default_storey_1() -> usize { 1 }

pub async fn drift_check(
    Json(req): Json<DriftCheckReq>,
) -> ApiResult<Json<is_1893::DriftCheckResult>> {
    let result = is_1893::check_storey_drift(
        req.storey_height_mm, req.elastic_drift_mm,
        req.response_reduction, req.storey_number,
    );
    Ok(Json(result))
}

fn parse_zone(s: &str) -> Result<is_1893::SeismicZone, ApiError> {
    match s {
        "II" | "2" => Ok(is_1893::SeismicZone::II),
        "III" | "3" => Ok(is_1893::SeismicZone::III),
        "IV" | "4" => Ok(is_1893::SeismicZone::IV),
        "V" | "5" => Ok(is_1893::SeismicZone::V),
        _ => Err(ApiError::BadRequest(format!("Invalid zone: {s}"))),
    }
}

fn parse_soil(s: &str) -> Result<is_1893::SoilType, ApiError> {
    match s.to_lowercase().as_str() {
        "hard" | "rock" => Ok(is_1893::SoilType::Hard),
        "medium" => Ok(is_1893::SoilType::Medium),
        "soft" => Ok(is_1893::SoilType::Soft),
        _ => Err(ApiError::BadRequest(format!("Invalid soil: {s}"))),
    }
}

// ── IS 875 ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct WindPerStoreyReq {
    pub vb: f64,
    pub storey_heights: Vec<f64>,
    pub tributary_width: f64,
    pub terrain: String,
    #[serde(default = "default_cf")]
    pub cf: f64,
    #[serde(default = "default_one_f64_2")]
    pub k1: f64,
    #[serde(default = "default_one_f64_2")]
    pub k3: f64,
}
fn default_cf() -> f64 { 1.3 }
fn default_one_f64_2() -> f64 { 1.0 }

pub async fn wind_per_storey(
    Json(req): Json<WindPerStoreyReq>,
) -> ApiResult<Json<Vec<is_875::StoreyWindForce>>> {
    let terrain = parse_terrain(&req.terrain)?;
    let result = is_875::wind_force_per_storey(
        req.vb, &req.storey_heights, req.tributary_width,
        terrain, req.cf, req.k1, req.k3,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct PressureCoeffReq {
    pub h_by_w: f64,
    pub opening_ratio: f64,
}

pub async fn pressure_coefficients(
    Json(req): Json<PressureCoeffReq>,
) -> ApiResult<Json<is_875::PressureCoefficients>> {
    let result = is_875::pressure_coefficients_rectangular(
        req.h_by_w, req.opening_ratio,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct LiveLoadReq {
    pub occupancy: String,
}

#[derive(Serialize)]
pub struct LiveLoadResp {
    pub occupancy: String,
    pub live_load_kN_m2: f64,
}

pub async fn live_load(
    Json(req): Json<LiveLoadReq>,
) -> ApiResult<Json<LiveLoadResp>> {
    let ll = is_875::live_load(&req.occupancy);
    Ok(Json(LiveLoadResp {
        occupancy: req.occupancy,
        live_load_kN_m2: ll,
    }))
}

#[derive(Deserialize)]
pub struct LiveLoadReductionReq {
    pub tributary_area: f64,
    pub num_floors: usize,
}

#[derive(Serialize)]
pub struct LiveLoadReductionResp {
    pub reduction_factor: f64,
}

pub async fn live_load_reduction(
    Json(req): Json<LiveLoadReductionReq>,
) -> ApiResult<Json<LiveLoadReductionResp>> {
    let rf = is_875::live_load_reduction(req.tributary_area, req.num_floors);
    Ok(Json(LiveLoadReductionResp {
        reduction_factor: rf,
    }))
}

fn parse_terrain(s: &str) -> Result<is_875::TerrainCategory, ApiError> {
    match s {
        "1" | "open" => Ok(is_875::TerrainCategory::Category1),
        "2" | "suburban" => Ok(is_875::TerrainCategory::Category2),
        "3" | "urban" => Ok(is_875::TerrainCategory::Category3),
        "4" | "dense" => Ok(is_875::TerrainCategory::Category4),
        _ => Err(ApiError::BadRequest(format!("Invalid terrain: {s}"))),
    }
}

// ── Serviceability ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
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
fn default_beam() -> String { "beam".into() }
fn default_live() -> String { "live".into() }
fn default_ss() -> String { "simply_supported".into() }

pub async fn deflection_check(
    Json(req): Json<DeflectionCheckReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::check_deflection(
        &req.material, req.span_mm, req.actual_deflection_mm,
        &req.member_type, &req.load_type, &req.support_condition,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct VibrationCheckReq {
    pub frequency_hz: f64,
    #[serde(default = "default_office")]
    pub occupancy: String,
}
fn default_office() -> String { "office".into() }

pub async fn vibration_check(
    Json(req): Json<VibrationCheckReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::check_floor_vibration(
        req.frequency_hz, &req.occupancy,
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
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
fn default_moderate() -> String { "moderate".into() }

pub async fn crack_width(
    Json(req): Json<CrackWidthReq>,
) -> ApiResult<Json<serviceability::ServiceabilityResult>> {
    let result = serviceability::estimate_crack_width(
        req.b, req.d, req.big_d, req.cover,
        req.bar_dia, req.bar_spacing, req.fs, &req.exposure,
    );
    Ok(Json(result))
}
