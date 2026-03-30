//! Design Code Check Handlers
//!
//! REST endpoints exposing IS 456, IS 800, IS 1893, IS 875, and serviceability
//! checks via the Rust design_codes module. These replace the Python FastAPI
//! endpoints in routers/is_code_checks.py.

use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::design_codes::{
    aci_318, aisc_360, base_plate, composite_beam, ductile_detailing, eurocode2, eurocode3,
    nds_2018,
};
use crate::design_codes::{
    bearing_capacity, earth_pressure, is_1893, is_456, is_800, is_875, liquefaction, pile_capacity,
    retaining_wall, seismic_earth_pressure, serviceability, settlement, slope_stability,
    spt_correlations,
};
use crate::error::{ApiError, ApiResult};
use crate::AppState;
use axum::extract::State;
use std::sync::Arc;

// ── IS 456 ──────────────────────────────────────────────────────────────────

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
fn default_50() -> f64 {
    50.0
}

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

// ── IS 800 ──────────────────────────────────────────────────────────────────

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
fn default_one_usize() -> usize {
    1
}

fn parse_is800_version(s: Option<&str>) -> is_800::IS800Version {
    match s.unwrap_or("IS800_2007").to_lowercase().as_str() {
        "is800_2025_draft" | "2025" | "draft" | "is800draft" => is_800::IS800Version::V2025Draft,
        _ => is_800::IS800Version::V2007,
    }
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
fn default_one_f64() -> f64 {
    1.0
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

fn default_weld_type() -> String {
    "shop".to_string()
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

// ── IS 1893 ─────────────────────────────────────────────────────────────────

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

pub async fn base_shear(
    Json(req): Json<BaseShearReq>,
) -> ApiResult<Json<is_1893::BaseShearResult>> {
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
    pub zone: String,
    pub soil: String,
    pub importance: f64,
    pub response_reduction: f64,
    pub building_type: String,
    pub base_dimension: f64,
    #[serde(default = "default_x_dir")]
    pub direction: String,
    pub node_weights: Vec<is_1893::NodeWeight>,
    #[serde(default)]
    pub code_version: Option<String>,
}
fn default_x_dir() -> String {
    "x".into()
}

pub async fn eq_forces(Json(req): Json<EqForcesReq>) -> ApiResult<Json<is_1893::EqForceResult>> {
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
    #[serde(default = "default_storey_1")]
    pub storey_number: usize,
    #[serde(default)]
    pub code_version: Option<String>,
}
fn default_storey_1() -> usize {
    1
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

fn parse_is1893_version(s: Option<&str>) -> is_1893::IS1893Version {
    match s.unwrap_or("IS1893_2016").to_lowercase().as_str() {
        "is1893_2025_sandbox" | "2025" | "sandbox" | "draft" | "is1893sandbox" => {
            is_1893::IS1893Version::V2025Sandbox
        }
        _ => is_1893::IS1893Version::V2016,
    }
}

// ── IS 875 ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
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
fn default_cf() -> f64 {
    1.3
}
fn default_one_f64_2() -> f64 {
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
    let result = is_875::pressure_coefficients_rectangular(req.h_by_w, req.opening_ratio);
    Ok(Json(result))
}

#[derive(Debug, Clone, Deserialize)]
pub struct LiveLoadReq {
    pub occupancy: String,
}

#[derive(Serialize)]
pub struct LiveLoadResp {
    pub occupancy: String,
    #[serde(rename = "live_load_kN_m2")]
    pub live_load_k_n_m2: f64,
}

pub async fn live_load(Json(req): Json<LiveLoadReq>) -> ApiResult<Json<LiveLoadResp>> {
    let ll = is_875::live_load(&req.occupancy);
    Ok(Json(LiveLoadResp {
        occupancy: req.occupancy,
        live_load_k_n_m2: ll,
    }))
}

#[derive(Debug, Clone, Deserialize)]
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

// ── Geotechnical (SPT Correlations) ─────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct SptCorrelationReq {
    /// Corrected SPT blow count N60 (blows/300 mm)
    pub n60: f64,
    /// Fines content (%)
    #[serde(default)]
    pub fines_percent: Option<f64>,
    /// Groundwater depth below ground level (m)
    #[serde(default)]
    pub groundwater_depth_m: Option<f64>,
}

pub async fn spt_correlation(
    Json(req): Json<SptCorrelationReq>,
) -> ApiResult<Json<spt_correlations::SptCorrelationResult>> {
    let input = spt_correlations::SptCorrelationInput {
        n60: req.n60,
        fines_percent: req.fines_percent,
        groundwater_depth_m: req.groundwater_depth_m,
    };

    match spt_correlations::correlate_sandy_soil(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct InfiniteSlopeReq {
    /// Slope angle β (deg)
    pub slope_angle_deg: f64,
    /// Effective friction angle φ' (deg)
    pub friction_angle_deg: f64,
    /// Effective cohesion c' (kPa)
    pub cohesion_kpa: f64,
    /// Soil unit weight γ (kN/m³)
    pub unit_weight_kn_m3: f64,
    /// Failure plane depth z (m)
    pub depth_m: f64,
    /// Pore pressure ratio ru = u/(γ z cos²β)
    #[serde(default)]
    pub ru: Option<f64>,
    /// Required minimum FS (default 1.50)
    #[serde(default)]
    pub required_fs: Option<f64>,
}

pub async fn infinite_slope_stability(
    Json(req): Json<InfiniteSlopeReq>,
) -> ApiResult<Json<slope_stability::InfiniteSlopeResult>> {
    let input = slope_stability::InfiniteSlopeInput {
        slope_angle_deg: req.slope_angle_deg,
        friction_angle_deg: req.friction_angle_deg,
        cohesion_kpa: req.cohesion_kpa,
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        depth_m: req.depth_m,
        ru: req.ru,
        required_fs: req.required_fs,
    };

    match slope_stability::check_infinite_slope(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct BearingCapacityStripReq {
    pub cohesion_kpa: f64,
    pub friction_angle_deg: f64,
    pub unit_weight_kn_m3: f64,
    pub footing_width_m: f64,
    pub embedment_depth_m: f64,
    pub applied_pressure_kpa: f64,
    #[serde(default)]
    pub safety_factor: Option<f64>,
}

pub async fn bearing_capacity_strip(
    Json(req): Json<BearingCapacityStripReq>,
) -> ApiResult<Json<bearing_capacity::TerzaghiStripResult>> {
    let input = bearing_capacity::TerzaghiStripInput {
        cohesion_kpa: req.cohesion_kpa,
        friction_angle_deg: req.friction_angle_deg,
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        footing_width_m: req.footing_width_m,
        embedment_depth_m: req.embedment_depth_m,
        applied_pressure_kpa: req.applied_pressure_kpa,
        safety_factor: req.safety_factor,
    };

    match bearing_capacity::check_terzaghi_strip(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RetainingWallStabilityReq {
    pub wall_height_m: f64,
    pub backfill_unit_weight_kn_m3: f64,
    pub backfill_friction_angle_deg: f64,
    #[serde(default)]
    pub surcharge_kpa: f64,
    pub base_width_m: f64,
    pub total_vertical_load_kn_per_m: f64,
    pub stabilizing_moment_knm_per_m: f64,
    pub base_friction_coeff: f64,
    pub allowable_bearing_kpa: f64,
    #[serde(default)]
    pub required_fs_overturning: Option<f64>,
    #[serde(default)]
    pub required_fs_sliding: Option<f64>,
}

pub async fn retaining_wall_stability(
    Json(req): Json<RetainingWallStabilityReq>,
) -> ApiResult<Json<retaining_wall::RetainingWallResult>> {
    let input = retaining_wall::RetainingWallInput {
        wall_height_m: req.wall_height_m,
        backfill_unit_weight_kn_m3: req.backfill_unit_weight_kn_m3,
        backfill_friction_angle_deg: req.backfill_friction_angle_deg,
        surcharge_kpa: req.surcharge_kpa,
        base_width_m: req.base_width_m,
        total_vertical_load_kn_per_m: req.total_vertical_load_kn_per_m,
        stabilizing_moment_knm_per_m: req.stabilizing_moment_knm_per_m,
        base_friction_coeff: req.base_friction_coeff,
        allowable_bearing_kpa: req.allowable_bearing_kpa,
        required_fs_overturning: req.required_fs_overturning,
        required_fs_sliding: req.required_fs_sliding,
    };

    match retaining_wall::check_retaining_wall(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConsolidationSettlementReq {
    pub layer_thickness_m: f64,
    pub initial_void_ratio: f64,
    pub compression_index: f64,
    pub initial_effective_stress_kpa: f64,
    pub stress_increment_kpa: f64,
    pub drainage_path_m: f64,
    pub cv_m2_per_year: f64,
    pub time_years: f64,
    #[serde(default)]
    pub required_max_settlement_mm: Option<f64>,
}

pub async fn consolidation_settlement(
    Json(req): Json<ConsolidationSettlementReq>,
) -> ApiResult<Json<settlement::ConsolidationSettlementResult>> {
    let input = settlement::ConsolidationSettlementInput {
        layer_thickness_m: req.layer_thickness_m,
        initial_void_ratio: req.initial_void_ratio,
        compression_index: req.compression_index,
        initial_effective_stress_kpa: req.initial_effective_stress_kpa,
        stress_increment_kpa: req.stress_increment_kpa,
        drainage_path_m: req.drainage_path_m,
        cv_m2_per_year: req.cv_m2_per_year,
        time_years: req.time_years,
        required_max_settlement_mm: req.required_max_settlement_mm,
    };

    match settlement::check_consolidation_settlement(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct LiquefactionReq {
    #[serde(default)]
    pub magnitude_mw: Option<f64>,
    pub pga_g: f64,
    pub depth_m: f64,
    pub total_stress_kpa: f64,
    pub effective_stress_kpa: f64,
    pub n1_60cs: f64,
    #[serde(default)]
    pub rd: Option<f64>,
    #[serde(default)]
    pub required_fs: Option<f64>,
}

pub async fn liquefaction_screening(
    Json(req): Json<LiquefactionReq>,
) -> ApiResult<Json<liquefaction::LiquefactionResult>> {
    let input = liquefaction::LiquefactionInput {
        magnitude_mw: req.magnitude_mw,
        pga_g: req.pga_g,
        depth_m: req.depth_m,
        total_stress_kpa: req.total_stress_kpa,
        effective_stress_kpa: req.effective_stress_kpa,
        n1_60cs: req.n1_60cs,
        rd: req.rd,
        required_fs: req.required_fs,
    };

    match liquefaction::check_liquefaction(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PileAxialCapacityReq {
    pub diameter_m: f64,
    pub length_m: f64,
    pub unit_skin_friction_kpa: f64,
    pub unit_end_bearing_kpa: f64,
    pub applied_load_kn: f64,
    #[serde(default)]
    pub safety_factor: Option<f64>,
}

pub async fn pile_axial_capacity(
    Json(req): Json<PileAxialCapacityReq>,
) -> ApiResult<Json<pile_capacity::PileAxialCapacityResult>> {
    let input = pile_capacity::PileAxialCapacityInput {
        diameter_m: req.diameter_m,
        length_m: req.length_m,
        unit_skin_friction_kpa: req.unit_skin_friction_kpa,
        unit_end_bearing_kpa: req.unit_end_bearing_kpa,
        applied_load_kn: req.applied_load_kn,
        safety_factor: req.safety_factor,
    };

    match pile_capacity::check_pile_axial_capacity(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct RankineEarthPressureReq {
    pub friction_angle_deg: f64,
    pub unit_weight_kn_m3: f64,
    pub retained_height_m: f64,
    #[serde(default)]
    pub surcharge_kpa: Option<f64>,
}

pub async fn rankine_earth_pressure(
    Json(req): Json<RankineEarthPressureReq>,
) -> ApiResult<Json<earth_pressure::RankineEarthPressureResult>> {
    let input = earth_pressure::RankineEarthPressureInput {
        friction_angle_deg: req.friction_angle_deg,
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        retained_height_m: req.retained_height_m,
        surcharge_kpa: req.surcharge_kpa,
    };

    match earth_pressure::compute_rankine_earth_pressure(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SeismicEarthPressureReq {
    pub unit_weight_kn_m3: f64,
    pub retained_height_m: f64,
    pub kh: f64,
    #[serde(default)]
    pub kv: Option<f64>,
    pub static_active_thrust_kn_per_m: f64,
}

pub async fn seismic_earth_pressure(
    Json(req): Json<SeismicEarthPressureReq>,
) -> ApiResult<Json<seismic_earth_pressure::SeismicEarthPressureResult>> {
    let input = seismic_earth_pressure::SeismicEarthPressureInput {
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        retained_height_m: req.retained_height_m,
        kh: req.kh,
        kv: req.kv,
        static_active_thrust_kn_per_m: req.static_active_thrust_kn_per_m,
    };

    match seismic_earth_pressure::check_seismic_earth_pressure(&input) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
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

// ── SECTION-WISE BEAM DESIGN ────────────────────────────────────────────────
// Designs beams by checking capacity ≥ demand at every station along the span

use crate::design_codes::section_wise;

#[derive(Debug, Clone, Deserialize)]
pub struct SectionWiseRCReq {
    /// Beam width (mm)
    pub b: f64,
    /// Effective depth (mm)
    pub d: f64,
    /// Clear cover (mm)
    #[serde(default = "default_cover")]
    pub cover: f64,
    /// Concrete grade fck (N/mm²)
    pub fck: f64,
    /// Steel grade fy (N/mm²)
    pub fy: f64,
    /// Beam span (mm)
    pub span: f64,
    /// Factored UDL (kN/m) — used when section_forces is absent
    #[serde(default)]
    pub w_factored: f64,
    /// Support condition: "simple", "fixed_fixed", "propped", "cantilever"
    #[serde(default = "default_support")]
    pub support_condition: String,
    /// Number of stations (default 11)
    #[serde(default = "default_n_sections")]
    pub n_sections: usize,
    /// Custom force array: [(x_mm, Mu_knm, Vu_kn), ...]
    /// Overrides w_factored + support_condition when present
    #[serde(default)]
    pub section_forces: Vec<[f64; 3]>,
}

fn default_cover() -> f64 {
    50.0
}
fn default_support() -> String {
    "simple".to_string()
}
fn default_n_sections() -> usize {
    11
}

/// POST /api/design/section-wise/rc — Section-wise RC beam design per IS 456:2000
///
/// Checks capacity ≥ demand at every station along the beam span.
/// Returns section checks, curtailment schedule, rebar zones, and economy ratio.
///
/// Two input modes:
/// 1. **Auto-generated demands:** Provide `w_factored` + `support_condition` → generates
///    Mu(x), Vu(x) envelope automatically.
/// 2. **Custom forces:** Provide `section_forces` array → interpolates at n_sections stations.
pub async fn section_wise_rc(
    Json(req): Json<SectionWiseRCReq>,
) -> ApiResult<Json<section_wise::SectionWiseResult>> {
    // Generate demands
    let n = if req.n_sections < 3 {
        11
    } else {
        req.n_sections
    };

    let demands = if !req.section_forces.is_empty() {
        let forces: Vec<(f64, f64, f64)> = req
            .section_forces
            .iter()
            .map(|f| (f[0], f[1], f[2]))
            .collect();
        section_wise::generate_demands_from_forces(req.span, &forces, n)
    } else if req.w_factored > 0.0 {
        let condition = match req.support_condition.as_str() {
            "fixed_fixed" => section_wise::SupportCondition::FixedFixed,
            "propped" => section_wise::SupportCondition::Propped,
            "cantilever" => section_wise::SupportCondition::Cantilever,
            _ => section_wise::SupportCondition::Simple,
        };
        if condition == section_wise::SupportCondition::Simple {
            section_wise::generate_simply_supported_demands(req.span, req.w_factored, n)
        } else {
            section_wise::generate_continuous_beam_demands(req.span, req.w_factored, &condition, n)
        }
    } else {
        return Err(ApiError::BadRequest(
            "Provide either w_factored (kN/m) or section_forces array".into(),
        ));
    };

    let designer = section_wise::RCSectionWiseDesigner::new(req.fck, req.fy);
    match designer.design_member_sectionwise(req.b, req.d, req.cover, req.span, &demands) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

// ── SECTION-WISE STEEL BEAM DESIGN ──────────────────────────────────────────
// IS 800:2007 / AISC 360-22 section-wise steel beam design

#[derive(Debug, Clone, Deserialize)]
pub struct SectionWiseSteelReq {
    /// Yield strength fy (N/mm²)
    pub fy: f64,
    /// Design code: "is800" or "aisc360"
    #[serde(default = "default_steel_code")]
    pub design_code: String,
    /// ISMB section name from database (e.g. "ISMB300") — used when section is absent
    #[serde(default)]
    pub section_name: String,
    /// Custom section properties — overrides section_name when present
    #[serde(default)]
    pub section: Option<section_wise::SteelSectionInput>,
    /// Laterally unbraced length (mm)
    pub unbraced_length: f64,
    /// Beam span (mm)
    pub span: f64,
    /// True for hot-rolled sections (αLT = 0.21), false for welded (αLT = 0.49)
    #[serde(default = "default_rolled")]
    pub is_rolled: bool,
    /// Factored UDL (kN/m) — used when section_forces is absent
    #[serde(default)]
    pub w_factored: f64,
    /// Support condition: "simple", "fixed_fixed", "propped", "cantilever"
    #[serde(default = "default_support")]
    pub support_condition: String,
    /// Number of stations (default 11)
    #[serde(default = "default_n_sections")]
    pub n_sections: usize,
    /// Custom force array: [[x_mm, Mu_knm, Vu_kn], ...]
    #[serde(default)]
    pub section_forces: Vec<[f64; 3]>,
}

fn default_steel_code() -> String {
    "is800".to_string()
}
fn default_rolled() -> bool {
    true
}

/// POST /api/design/section-wise/steel — Section-wise steel beam design
///
/// Checks capacity ≥ demand at every station along the steel beam span.
/// Supports IS 800:2007 (Cl. 8.2, 8.4, 9.2) and AISC 360-22 (Chapter F, G).
///
/// Returns section checks with LTB, high-shear interaction, stiffener zones.
pub async fn section_wise_steel(
    Json(req): Json<SectionWiseSteelReq>,
) -> ApiResult<Json<section_wise::SteelSectionWiseResult>> {
    // Resolve section
    let section = if let Some(custom) = req.section {
        custom
    } else if !req.section_name.is_empty() {
        section_wise::lookup_ismb(&req.section_name).ok_or_else(|| {
            ApiError::BadRequest(format!(
                "Unknown ISMB section: '{}'. Use one of: ISMB100–ISMB600.",
                req.section_name
            ))
        })?
    } else {
        return Err(ApiError::BadRequest(
            "Provide either section_name (e.g. 'ISMB300') or custom section properties".into(),
        ));
    };

    // Resolve design code
    let code = match req.design_code.to_lowercase().as_str() {
        "aisc360" | "aisc" => section_wise::SteelDesignCode::Aisc360,
        _ => section_wise::SteelDesignCode::Is800,
    };

    // Generate demands
    let n = if req.n_sections < 3 {
        11
    } else {
        req.n_sections
    };
    let demands = if !req.section_forces.is_empty() {
        let forces: Vec<(f64, f64, f64)> = req
            .section_forces
            .iter()
            .map(|f| (f[0], f[1], f[2]))
            .collect();
        section_wise::generate_demands_from_forces(req.span, &forces, n)
    } else if req.w_factored > 0.0 {
        let condition = match req.support_condition.as_str() {
            "fixed_fixed" => section_wise::SupportCondition::FixedFixed,
            "propped" => section_wise::SupportCondition::Propped,
            "cantilever" => section_wise::SupportCondition::Cantilever,
            _ => section_wise::SupportCondition::Simple,
        };
        if condition == section_wise::SupportCondition::Simple {
            section_wise::generate_simply_supported_demands(req.span, req.w_factored, n)
        } else {
            section_wise::generate_continuous_beam_demands(req.span, req.w_factored, &condition, n)
        }
    } else {
        return Err(ApiError::BadRequest(
            "Provide either w_factored (kN/m) or section_forces array".into(),
        ));
    };

    let designer = section_wise::SteelSectionWiseDesigner::new(req.fy, code);
    match designer.design_member_sectionwise(&section, &demands, req.unbraced_length, req.is_rolled)
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

// ── SECTION-WISE DESIGN FROM ANALYSIS ──────────────────────────────────────
// Auto-extraction pipeline: analysis member forces → section-wise design

use crate::solver::post_processor::{
    extract_design_demands, extract_envelope_demands, MemberDistLoad, MemberEndForces,
    PostProcessor,
};

/// Member end forces input (matches Rust solver output format)
#[derive(Debug, Clone, Deserialize)]
pub struct MemberForcesInput {
    pub member_id: String,
    pub start_node: String,
    pub end_node: String,
    /// Member length (mm)
    pub length: f64,
    /// [fx, fy, fz, mx, my, mz] at start — in N and N·mm
    pub forces_start: [f64; 6],
    /// [fx, fy, fz, mx, my, mz] at end — in N and N·mm
    pub forces_end: [f64; 6],
    /// [dx, dy, dz, rx, ry, rz] at start
    #[serde(default)]
    pub displacements_start: [f64; 6],
    /// [dx, dy, dz, rx, ry, rz] at end
    #[serde(default)]
    pub displacements_end: [f64; 6],
    /// Distributed load wy (N/mm in local Y) — optional
    #[serde(default)]
    pub dist_load_wy: f64,
    /// Distributed load wz (N/mm in local Z) — optional
    #[serde(default)]
    pub dist_load_wz: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FromAnalysisReq {
    /// "rc" or "steel"
    pub material: String,
    /// Member forces from one or more load combinations.
    /// If multiple, envelope (max |M|, max |V| per station) is used.
    pub member_forces: Vec<MemberForcesInput>,
    // ── RC-specific (material = "rc") ──
    /// Beam width (mm)
    #[serde(default)]
    pub b: f64,
    /// Effective depth (mm)
    #[serde(default)]
    pub d: f64,
    /// Clear cover (mm)
    #[serde(default = "default_cover")]
    pub cover: f64,
    /// Concrete grade fck (N/mm²)
    #[serde(default)]
    pub fck: f64,
    /// Reinforcement yield strength fy (N/mm²)
    #[serde(default)]
    pub fy: f64,
    // ── Steel-specific (material = "steel") ──
    /// ISMB section name or custom section
    #[serde(default)]
    pub section_name: String,
    /// Custom steel section (overrides section_name)
    #[serde(default)]
    pub section: Option<section_wise::SteelSectionInput>,
    /// Yield strength for steel (N/mm²)
    #[serde(default)]
    pub steel_fy: f64,
    /// Design code: "is800" or "aisc360"
    #[serde(default = "default_steel_code")]
    pub design_code: String,
    /// Unbraced length (mm) — for LTB
    #[serde(default)]
    pub unbraced_length: f64,
    /// Hot-rolled flag
    #[serde(default = "default_rolled")]
    pub is_rolled: bool,
}

/// Combined design result — either RC or Steel
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "material", rename_all = "snake_case")]
pub enum FromAnalysisResult {
    Rc {
        demands_extracted: usize,
        member_id: String,
        span_mm: f64,
        result: section_wise::SectionWiseResult,
    },
    Steel {
        demands_extracted: usize,
        member_id: String,
        span_mm: f64,
        result: section_wise::SteelSectionWiseResult,
    },
}

/// POST /api/design/section-wise/from-analysis
///
/// Auto-extraction pipeline: takes raw member end forces from structural analysis,
/// runs them through the post-processor to generate SFD/BMD at 21 stations,
/// extracts design demands, and runs the section-wise designer.
///
/// Supports load combination envelope when multiple `member_forces` entries provided.
pub async fn section_wise_from_analysis(
    Json(req): Json<FromAnalysisReq>,
) -> ApiResult<Json<FromAnalysisResult>> {
    if req.member_forces.is_empty() {
        return Err(ApiError::BadRequest("member_forces array is empty".into()));
    }

    let pp = PostProcessor::new();

    // Build diagrams from member end forces
    let diagrams: Vec<_> = req
        .member_forces
        .iter()
        .map(|mf| {
            let end_forces = MemberEndForces {
                member_id: mf.member_id.clone(),
                start_node: mf.start_node.clone(),
                end_node: mf.end_node.clone(),
                length: mf.length,
                forces_start: mf.forces_start,
                forces_end: mf.forces_end,
                displacements_start: mf.displacements_start,
                displacements_end: mf.displacements_end,
            };
            let dist_load =
                if mf.dist_load_wy.abs() > f64::EPSILON || mf.dist_load_wz.abs() > f64::EPSILON {
                    Some(MemberDistLoad {
                        member_id: mf.member_id.clone(),
                        wy: mf.dist_load_wy,
                        wz: mf.dist_load_wz,
                    })
                } else {
                    None
                };
            pp.member_diagram(&end_forces, dist_load.as_ref())
        })
        .collect();

    let member_id = diagrams[0].member_id.clone();
    let span_mm = diagrams[0].member_length;

    // Extract demands (envelope if multiple combos)
    let demands = if diagrams.len() == 1 {
        extract_design_demands(&diagrams[0])
    } else {
        extract_envelope_demands(&diagrams).map_err(ApiError::BadRequest)?
    };

    let demands_count = demands.len();

    match req.material.to_lowercase().as_str() {
        "rc" | "concrete" => {
            if req.b <= 0.0 || req.d <= 0.0 {
                return Err(ApiError::BadRequest(
                    "RC design requires b > 0 and d > 0".into(),
                ));
            }
            if req.fck <= 0.0 || req.fy <= 0.0 {
                return Err(ApiError::BadRequest(
                    "RC design requires fck > 0 and fy > 0".into(),
                ));
            }

            let designer = section_wise::RCSectionWiseDesigner::new(req.fck, req.fy);
            match designer.design_member_sectionwise(req.b, req.d, req.cover, span_mm, &demands) {
                Ok(result) => Ok(Json(FromAnalysisResult::Rc {
                    demands_extracted: demands_count,
                    member_id,
                    span_mm,
                    result,
                })),
                Err(e) => Err(ApiError::BadRequest(e)),
            }
        }
        "steel" => {
            let section = if let Some(custom) = req.section {
                custom
            } else if !req.section_name.is_empty() {
                section_wise::lookup_ismb(&req.section_name).ok_or_else(|| {
                    ApiError::BadRequest(format!("Unknown ISMB section: '{}'", req.section_name))
                })?
            } else {
                return Err(ApiError::BadRequest(
                    "Steel design requires section_name or custom section".into(),
                ));
            };

            let fy = if req.steel_fy > 0.0 {
                req.steel_fy
            } else {
                250.0
            };
            let unbraced = if req.unbraced_length > 0.0 {
                req.unbraced_length
            } else {
                span_mm
            };

            let code = match req.design_code.to_lowercase().as_str() {
                "aisc360" | "aisc" => section_wise::SteelDesignCode::Aisc360,
                _ => section_wise::SteelDesignCode::Is800,
            };

            let designer = section_wise::SteelSectionWiseDesigner::new(fy, code);
            match designer.design_member_sectionwise(&section, &demands, unbraced, req.is_rolled) {
                Ok(result) => Ok(Json(FromAnalysisResult::Steel {
                    demands_extracted: demands_count,
                    member_id,
                    span_mm,
                    result,
                })),
                Err(e) => Err(ApiError::BadRequest(e)),
            }
        }
        _ => Err(ApiError::BadRequest(format!(
            "Unknown material '{}'. Use 'rc' or 'steel'.",
            req.material
        ))),
    }
}

// ── BATCH PROCESSING ────────────────────────────────────────────────────────
// Enterprise feature: Run multiple design checks in parallel for productivity

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DesignCheckType {
    FlexuralCapacity { req: FlexuralCapacityReq },
    ShearDesign { req: ShearDesignReq },
    BiaxialColumn { req: BiaxialColumnReq },
    DeflectionIs456 { req: DeflectionCheckIs456Req },
    BoltBearing { req: BoltBearingReq },
    BoltHsfg { req: BoltHsfgReq },
    FilletWeld { req: FilletWeldReq },
    AutoSelect { req: AutoSelectReq },
    BaseShear { req: BaseShearReq },
    EqForces { req: EqForcesReq },
    DriftCheck { req: DriftCheckReq },
    WindPerStorey { req: WindPerStoreyReq },
    PressureCoefficients { req: PressureCoeffReq },
    LiveLoad { req: LiveLoadReq },
    LiveLoadReduction { req: LiveLoadReductionReq },
    SptCorrelation { req: SptCorrelationReq },
    InfiniteSlope { req: InfiniteSlopeReq },
    BearingCapacityStrip { req: BearingCapacityStripReq },
    RetainingWallStability { req: RetainingWallStabilityReq },
    ConsolidationSettlement { req: ConsolidationSettlementReq },
    LiquefactionScreening { req: LiquefactionReq },
    PileAxialCapacity { req: PileAxialCapacityReq },
    RankineEarthPressure { req: RankineEarthPressureReq },
    SeismicEarthPressure { req: SeismicEarthPressureReq },
    Deflection { req: DeflectionCheckReq },
    Vibration { req: VibrationCheckReq },
    CrackWidth { req: CrackWidthReq },
}

#[derive(Debug, Serialize)]
pub struct DesignCheckResult {
    pub success: bool,
    pub design_id: String,
    pub check_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub duration_ms: f64,
}

#[derive(Deserialize)]
pub struct BatchDesignRequest {
    pub checks: Vec<DesignCheckInput>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DesignCheckInput {
    pub id: String,
    #[serde(flatten)]
    pub check: DesignCheckType,
}

#[derive(Serialize)]
pub struct BatchDesignResponse {
    pub success: bool,
    pub total_checks: usize,
    pub successful: usize,
    pub failed: usize,
    pub total_time_ms: f64,
    pub results: Vec<DesignCheckResult>,
}

/// POST /api/design/batch - Run multiple design checks in parallel
///
/// Enterprise productivity feature — batch process beam designs, column checks,
/// seismic forces, and more. Uses Rayon for CPU-bound parallelism.
///
/// Example:
/// ```json
/// {
///   "checks": [
///     {
///       "id": "beam-1",
///       "type": "flexural_capacity",
///       "req": { "b": 300, "d": 450, "fck": 30, "fy": 500, "ast": 2010 }
///     },
///     {
///       "id": "column-2",
///       "type": "biaxial_column",
///       "req": { "b": 400, "d": 600, "fck": 30, "fy": 500, "pu_kn": 1500, ... }
///     }
///   ]
/// }
/// ```
pub async fn batch_design(
    State(_state): State<Arc<AppState>>,
    Json(input): Json<BatchDesignRequest>,
) -> ApiResult<Json<BatchDesignResponse>> {
    use rayon::prelude::*;

    if input.checks.is_empty() {
        return Err(ApiError::BadRequest("No design checks provided".into()));
    }
    if input.checks.len() > 500 {
        return Err(ApiError::BadRequest(
            "Maximum 500 design checks per batch".into(),
        ));
    }

    let start = std::time::Instant::now();

    // Run all design checks in parallel using Rayon
    let results: Vec<DesignCheckResult> = input
        .checks
        .par_iter()
        .map(|check_input| process_design_check(check_input))
        .collect();

    let total_time = start.elapsed().as_secs_f64() * 1000.0;

    let successful = results.iter().filter(|r| r.success).count();
    let failed = results.len() - successful;

    Ok(Json(BatchDesignResponse {
        success: true,
        total_checks: input.checks.len(),
        successful,
        failed,
        total_time_ms: total_time,
        results,
    }))
}

/// Serialize a result to JSON Value, returning Err(String) on serialization failure.
fn to_json<T: Serialize>(val: &T) -> Result<Value, String> {
    serde_json::to_value(val).map_err(|e| format!("serialization error: {e}"))
}

/// Validate physical bounds on design check inputs.
/// Returns Ok(()) if valid, Err(message) describing the first violation.
fn validate_design_input(check: &DesignCheckType) -> Result<(), String> {
    match check {
        DesignCheckType::FlexuralCapacity { req } => {
            if req.b <= 0.0 {
                return Err("b must be > 0".into());
            }
            if req.d <= 0.0 {
                return Err("d must be > 0".into());
            }
            if req.fck < 15.0 || req.fck > 100.0 {
                return Err("fck must be 15–100 MPa".into());
            }
            if req.fy < 250.0 || req.fy > 600.0 {
                return Err("fy must be 250–600 MPa".into());
            }
            if req.ast < 0.0 {
                return Err("ast must be ≥ 0".into());
            }
        }
        DesignCheckType::ShearDesign { req } => {
            if req.b <= 0.0 {
                return Err("b must be > 0".into());
            }
            if req.d <= 0.0 {
                return Err("d must be > 0".into());
            }
            if req.fck < 15.0 || req.fck > 100.0 {
                return Err("fck must be 15–100 MPa".into());
            }
        }
        DesignCheckType::BiaxialColumn { req } => {
            if req.b <= 0.0 || req.d <= 0.0 {
                return Err("b and d must be > 0".into());
            }
            if req.fck < 15.0 || req.fck > 100.0 {
                return Err("fck must be 15–100 MPa".into());
            }
            if req.fy < 250.0 || req.fy > 600.0 {
                return Err("fy must be 250–600 MPa".into());
            }
        }
        DesignCheckType::DeflectionIs456 { req } => {
            if req.span_mm <= 0.0 {
                return Err("span_mm must be > 0".into());
            }
            if req.effective_depth <= 0.0 {
                return Err("effective_depth must be > 0".into());
            }
        }
        DesignCheckType::BoltBearing { req } => {
            if req.bolt_dia <= 0.0 {
                return Err("bolt_dia must be > 0".into());
            }
            if req.plate_thk <= 0.0 {
                return Err("plate_thk must be > 0".into());
            }
            if req.n_bolts == 0 {
                return Err("n_bolts must be > 0".into());
            }
        }
        DesignCheckType::BoltHsfg { req } => {
            if req.bolt_dia <= 0.0 {
                return Err("bolt_dia must be > 0".into());
            }
            if req.n_bolts == 0 {
                return Err("n_bolts must be > 0".into());
            }
        }
        DesignCheckType::FilletWeld { req } => {
            if req.weld_size <= 0.0 {
                return Err("weld_size must be > 0".into());
            }
            if req.weld_length <= 0.0 {
                return Err("weld_length must be > 0".into());
            }
        }
        DesignCheckType::BaseShear { req } => {
            if req.seismic_weight_kn <= 0.0 {
                return Err("seismic_weight_kn must be > 0".into());
            }
            if req.period <= 0.0 {
                return Err("period must be > 0".into());
            }
            if req.response_reduction <= 0.0 {
                return Err("response_reduction must be > 0".into());
            }
        }
        DesignCheckType::DriftCheck { req } => {
            if req.storey_height_mm <= 0.0 {
                return Err("storey_height_mm must be > 0".into());
            }
        }
        DesignCheckType::WindPerStorey { req } => {
            if req.vb <= 0.0 {
                return Err("vb (basic wind speed) must be > 0".into());
            }
            if req.tributary_width <= 0.0 {
                return Err("tributary_width must be > 0".into());
            }
        }
        DesignCheckType::Deflection { req } => {
            if req.span_mm <= 0.0 {
                return Err("span_mm must be > 0".into());
            }
        }
        DesignCheckType::SptCorrelation { req } => {
            if req.n60 <= 0.0 {
                return Err("n60 must be > 0".into());
            }
        }
        DesignCheckType::InfiniteSlope { req } => {
            if req.slope_angle_deg <= 0.0 || req.slope_angle_deg >= 89.0 {
                return Err("slope_angle_deg must be > 0 and < 89".into());
            }
            if req.friction_angle_deg <= 0.0 || req.friction_angle_deg >= 60.0 {
                return Err("friction_angle_deg must be > 0 and < 60".into());
            }
            if req.unit_weight_kn_m3 <= 0.0 {
                return Err("unit_weight_kn_m3 must be > 0".into());
            }
            if req.depth_m <= 0.0 {
                return Err("depth_m must be > 0".into());
            }
        }
        DesignCheckType::BearingCapacityStrip { req } => {
            if req.cohesion_kpa < 0.0 {
                return Err("cohesion_kpa must be >= 0".into());
            }
            if req.friction_angle_deg < 0.0 || req.friction_angle_deg > 50.0 {
                return Err("friction_angle_deg must be in [0, 50]".into());
            }
            if req.unit_weight_kn_m3 <= 0.0 {
                return Err("unit_weight_kn_m3 must be > 0".into());
            }
            if req.footing_width_m <= 0.0 {
                return Err("footing_width_m must be > 0".into());
            }
            if req.applied_pressure_kpa < 0.0 {
                return Err("applied_pressure_kpa must be >= 0".into());
            }
        }
        DesignCheckType::RetainingWallStability { req } => {
            if req.wall_height_m <= 0.0 {
                return Err("wall_height_m must be > 0".into());
            }
            if req.backfill_unit_weight_kn_m3 <= 0.0 {
                return Err("backfill_unit_weight_kn_m3 must be > 0".into());
            }
            if req.backfill_friction_angle_deg <= 0.0 || req.backfill_friction_angle_deg >= 50.0 {
                return Err("backfill_friction_angle_deg must be > 0 and < 50".into());
            }
            if req.base_width_m <= 0.0 {
                return Err("base_width_m must be > 0".into());
            }
            if req.total_vertical_load_kn_per_m <= 0.0 {
                return Err("total_vertical_load_kn_per_m must be > 0".into());
            }
            if req.allowable_bearing_kpa <= 0.0 {
                return Err("allowable_bearing_kpa must be > 0".into());
            }
        }
        DesignCheckType::ConsolidationSettlement { req } => {
            if req.layer_thickness_m <= 0.0 {
                return Err("layer_thickness_m must be > 0".into());
            }
            if req.initial_void_ratio <= 0.0 {
                return Err("initial_void_ratio must be > 0".into());
            }
            if req.compression_index <= 0.0 {
                return Err("compression_index must be > 0".into());
            }
            if req.initial_effective_stress_kpa <= 0.0 {
                return Err("initial_effective_stress_kpa must be > 0".into());
            }
            if req.stress_increment_kpa <= 0.0 {
                return Err("stress_increment_kpa must be > 0".into());
            }
            if req.drainage_path_m <= 0.0 {
                return Err("drainage_path_m must be > 0".into());
            }
            if req.cv_m2_per_year <= 0.0 {
                return Err("cv_m2_per_year must be > 0".into());
            }
        }
        DesignCheckType::LiquefactionScreening { req } => {
            if req.pga_g <= 0.0 || req.pga_g > 1.5 {
                return Err("pga_g must be > 0 and <= 1.5".into());
            }
            if req.depth_m <= 0.0 || req.depth_m > 30.0 {
                return Err("depth_m must be > 0 and <= 30".into());
            }
            if req.total_stress_kpa <= 0.0 {
                return Err("total_stress_kpa must be > 0".into());
            }
            if req.effective_stress_kpa <= 0.0 {
                return Err("effective_stress_kpa must be > 0".into());
            }
            if req.total_stress_kpa < req.effective_stress_kpa {
                return Err("total_stress_kpa must be >= effective_stress_kpa".into());
            }
            if req.n1_60cs <= 0.0 || req.n1_60cs > 50.0 {
                return Err("n1_60cs must be > 0 and <= 50".into());
            }
        }
        DesignCheckType::PileAxialCapacity { req } => {
            if req.diameter_m <= 0.0 {
                return Err("diameter_m must be > 0".into());
            }
            if req.length_m <= 0.0 {
                return Err("length_m must be > 0".into());
            }
            if req.unit_skin_friction_kpa <= 0.0 {
                return Err("unit_skin_friction_kpa must be > 0".into());
            }
            if req.unit_end_bearing_kpa <= 0.0 {
                return Err("unit_end_bearing_kpa must be > 0".into());
            }
            if req.applied_load_kn < 0.0 {
                return Err("applied_load_kn must be >= 0".into());
            }
        }
        DesignCheckType::RankineEarthPressure { req } => {
            if req.friction_angle_deg <= 0.0 || req.friction_angle_deg >= 50.0 {
                return Err("friction_angle_deg must be > 0 and < 50".into());
            }
            if req.unit_weight_kn_m3 <= 0.0 {
                return Err("unit_weight_kn_m3 must be > 0".into());
            }
            if req.retained_height_m <= 0.0 {
                return Err("retained_height_m must be > 0".into());
            }
        }
        DesignCheckType::SeismicEarthPressure { req } => {
            if req.unit_weight_kn_m3 <= 0.0 {
                return Err("unit_weight_kn_m3 must be > 0".into());
            }
            if req.retained_height_m <= 0.0 {
                return Err("retained_height_m must be > 0".into());
            }
            if req.kh < 0.0 || req.kh > 0.6 {
                return Err("kh must be in [0, 0.6]".into());
            }
            if req.static_active_thrust_kn_per_m < 0.0 {
                return Err("static_active_thrust_kn_per_m must be >= 0".into());
            }
        }
        DesignCheckType::CrackWidth { req } => {
            if req.b <= 0.0 || req.d <= 0.0 {
                return Err("b and d must be > 0".into());
            }
            if req.bar_dia <= 0.0 {
                return Err("bar_dia must be > 0".into());
            }
            if req.bar_spacing <= 0.0 {
                return Err("bar_spacing must be > 0".into());
            }
        }
        // Remaining checks: EqForces, PressureCoefficients, LiveLoad,
        // LiveLoadReduction, Vibration, AutoSelect — no strict bounds needed
        _ => {}
    }
    Ok(())
}

/// Process a single design check (called in parallel by Rayon)
fn process_design_check(input: &DesignCheckInput) -> DesignCheckResult {
    let start = std::time::Instant::now();

    // Validate physical bounds before running the calculation
    if let Err(msg) = validate_design_input(&input.check) {
        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
        return DesignCheckResult {
            success: false,
            design_id: input.id.clone(),
            check_type: "validation_error".to_string(),
            result: None,
            error: Some(msg),
            duration_ms,
        };
    }

    let (check_type, result) = match &input.check {
        DesignCheckType::FlexuralCapacity { req } => {
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
            let resp = FlexuralCapacityResp {
                mu_knm: mu,
                xu_max_mm: xu_max,
                section_type: if xu > xu_max {
                    "over-reinforced".into()
                } else {
                    "under-reinforced".into()
                },
            };
            ("flexural_capacity".to_string(), to_json(&resp))
        }
        DesignCheckType::ShearDesign { req } => {
            let result = is_456::design_shear(
                req.vu_kn,
                req.b,
                req.d,
                req.fck,
                req.fy_stirrup,
                req.pt,
                req.asv,
            );
            ("shear_design".to_string(), to_json(&result))
        }
        DesignCheckType::BiaxialColumn { req } => {
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
            ("biaxial_column".to_string(), to_json(&result))
        }
        DesignCheckType::DeflectionIs456 { req } => {
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
            ("deflection_is456".to_string(), to_json(&result))
        }
        DesignCheckType::BoltBearing { req } => {
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
                Ok(result) => ("bolt_bearing".to_string(), to_json(&result)),
                Err(e) => ("bolt_bearing".to_string(), Err(e)),
            }
        }
        DesignCheckType::BoltHsfg { req } => {
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
                Ok(result) => ("bolt_hsfg".to_string(), to_json(&result)),
                Err(e) => ("bolt_hsfg".to_string(), Err(e)),
            }
        }
        DesignCheckType::FilletWeld { req } => {
            let version = parse_is800_version(req.code_version.as_deref());
            let result = is_800::design_fillet_weld_with_version(
                req.weld_size,
                req.weld_length,
                req.weld_fu,
                req.load_kn,
                &req.weld_type,
                version,
            );
            ("fillet_weld".to_string(), to_json(&result))
        }
        DesignCheckType::AutoSelect { req } => {
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
            ("auto_select".to_string(), to_json(&result))
        }
        DesignCheckType::BaseShear { req } => match parse_zone(&req.zone) {
            Ok(zone) => match parse_soil(&req.soil) {
                Ok(soil) => {
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
                    ("base_shear".to_string(), to_json(&result))
                }
                Err(e) => ("base_shear".to_string(), Err(format!("{:?}", e))),
            },
            Err(e) => ("base_shear".to_string(), Err(format!("{:?}", e))),
        },
        DesignCheckType::EqForces { req } => match (parse_zone(&req.zone), parse_soil(&req.soil)) {
            (Ok(zone), Ok(soil)) => {
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
                ("eq_forces".to_string(), to_json(&result))
            }
            (Err(e), _) | (_, Err(e)) => ("eq_forces".to_string(), Err(format!("{:?}", e))),
        },
        DesignCheckType::DriftCheck { req } => {
            let version = parse_is1893_version(req.code_version.as_deref());
            let result = is_1893::check_storey_drift_with_version(
                req.storey_height_mm,
                req.elastic_drift_mm,
                req.response_reduction,
                req.storey_number,
                version,
            );
            ("drift_check".to_string(), to_json(&result))
        }
        DesignCheckType::WindPerStorey { req } => match parse_terrain(&req.terrain) {
            Ok(terrain) => {
                let result = is_875::wind_force_per_storey(
                    req.vb,
                    &req.storey_heights,
                    req.tributary_width,
                    terrain,
                    req.cf,
                    req.k1,
                    req.k3,
                );
                ("wind_per_storey".to_string(), to_json(&result))
            }
            Err(e) => ("wind_per_storey".to_string(), Err(format!("{:?}", e))),
        },
        DesignCheckType::PressureCoefficients { req } => {
            let result = is_875::pressure_coefficients_rectangular(req.h_by_w, req.opening_ratio);
            ("pressure_coefficients".to_string(), to_json(&result))
        }
        DesignCheckType::LiveLoad { req } => {
            let ll = is_875::live_load(&req.occupancy);
            let resp = LiveLoadResp {
                occupancy: req.occupancy.clone(),
                live_load_k_n_m2: ll,
            };
            ("live_load".to_string(), to_json(&resp))
        }
        DesignCheckType::LiveLoadReduction { req } => {
            let rf = is_875::live_load_reduction(req.tributary_area, req.num_floors);
            let resp = LiveLoadReductionResp {
                reduction_factor: rf,
            };
            ("live_load_reduction".to_string(), to_json(&resp))
        }
        DesignCheckType::SptCorrelation { req } => {
            let input = spt_correlations::SptCorrelationInput {
                n60: req.n60,
                fines_percent: req.fines_percent,
                groundwater_depth_m: req.groundwater_depth_m,
            };
            match spt_correlations::correlate_sandy_soil(&input) {
                Ok(result) => ("spt_correlation".to_string(), to_json(&result)),
                Err(e) => ("spt_correlation".to_string(), Err(e)),
            }
        }
        DesignCheckType::InfiniteSlope { req } => {
            let input = slope_stability::InfiniteSlopeInput {
                slope_angle_deg: req.slope_angle_deg,
                friction_angle_deg: req.friction_angle_deg,
                cohesion_kpa: req.cohesion_kpa,
                unit_weight_kn_m3: req.unit_weight_kn_m3,
                depth_m: req.depth_m,
                ru: req.ru,
                required_fs: req.required_fs,
            };
            match slope_stability::check_infinite_slope(&input) {
                Ok(result) => ("infinite_slope".to_string(), to_json(&result)),
                Err(e) => ("infinite_slope".to_string(), Err(e)),
            }
        }
        DesignCheckType::BearingCapacityStrip { req } => {
            let input = bearing_capacity::TerzaghiStripInput {
                cohesion_kpa: req.cohesion_kpa,
                friction_angle_deg: req.friction_angle_deg,
                unit_weight_kn_m3: req.unit_weight_kn_m3,
                footing_width_m: req.footing_width_m,
                embedment_depth_m: req.embedment_depth_m,
                applied_pressure_kpa: req.applied_pressure_kpa,
                safety_factor: req.safety_factor,
            };
            match bearing_capacity::check_terzaghi_strip(&input) {
                Ok(result) => ("bearing_capacity_strip".to_string(), to_json(&result)),
                Err(e) => ("bearing_capacity_strip".to_string(), Err(e)),
            }
        }
        DesignCheckType::RetainingWallStability { req } => {
            let input = retaining_wall::RetainingWallInput {
                wall_height_m: req.wall_height_m,
                backfill_unit_weight_kn_m3: req.backfill_unit_weight_kn_m3,
                backfill_friction_angle_deg: req.backfill_friction_angle_deg,
                surcharge_kpa: req.surcharge_kpa,
                base_width_m: req.base_width_m,
                total_vertical_load_kn_per_m: req.total_vertical_load_kn_per_m,
                stabilizing_moment_knm_per_m: req.stabilizing_moment_knm_per_m,
                base_friction_coeff: req.base_friction_coeff,
                allowable_bearing_kpa: req.allowable_bearing_kpa,
                required_fs_overturning: req.required_fs_overturning,
                required_fs_sliding: req.required_fs_sliding,
            };
            match retaining_wall::check_retaining_wall(&input) {
                Ok(result) => ("retaining_wall_stability".to_string(), to_json(&result)),
                Err(e) => ("retaining_wall_stability".to_string(), Err(e)),
            }
        }
        DesignCheckType::ConsolidationSettlement { req } => {
            let input = settlement::ConsolidationSettlementInput {
                layer_thickness_m: req.layer_thickness_m,
                initial_void_ratio: req.initial_void_ratio,
                compression_index: req.compression_index,
                initial_effective_stress_kpa: req.initial_effective_stress_kpa,
                stress_increment_kpa: req.stress_increment_kpa,
                drainage_path_m: req.drainage_path_m,
                cv_m2_per_year: req.cv_m2_per_year,
                time_years: req.time_years,
                required_max_settlement_mm: req.required_max_settlement_mm,
            };
            match settlement::check_consolidation_settlement(&input) {
                Ok(result) => ("consolidation_settlement".to_string(), to_json(&result)),
                Err(e) => ("consolidation_settlement".to_string(), Err(e)),
            }
        }
        DesignCheckType::LiquefactionScreening { req } => {
            let input = liquefaction::LiquefactionInput {
                magnitude_mw: req.magnitude_mw,
                pga_g: req.pga_g,
                depth_m: req.depth_m,
                total_stress_kpa: req.total_stress_kpa,
                effective_stress_kpa: req.effective_stress_kpa,
                n1_60cs: req.n1_60cs,
                rd: req.rd,
                required_fs: req.required_fs,
            };
            match liquefaction::check_liquefaction(&input) {
                Ok(result) => ("liquefaction_screening".to_string(), to_json(&result)),
                Err(e) => ("liquefaction_screening".to_string(), Err(e)),
            }
        }
        DesignCheckType::PileAxialCapacity { req } => {
            let input = pile_capacity::PileAxialCapacityInput {
                diameter_m: req.diameter_m,
                length_m: req.length_m,
                unit_skin_friction_kpa: req.unit_skin_friction_kpa,
                unit_end_bearing_kpa: req.unit_end_bearing_kpa,
                applied_load_kn: req.applied_load_kn,
                safety_factor: req.safety_factor,
            };
            match pile_capacity::check_pile_axial_capacity(&input) {
                Ok(result) => ("pile_axial_capacity".to_string(), to_json(&result)),
                Err(e) => ("pile_axial_capacity".to_string(), Err(e)),
            }
        }
        DesignCheckType::RankineEarthPressure { req } => {
            let input = earth_pressure::RankineEarthPressureInput {
                friction_angle_deg: req.friction_angle_deg,
                unit_weight_kn_m3: req.unit_weight_kn_m3,
                retained_height_m: req.retained_height_m,
                surcharge_kpa: req.surcharge_kpa,
            };
            match earth_pressure::compute_rankine_earth_pressure(&input) {
                Ok(result) => ("rankine_earth_pressure".to_string(), to_json(&result)),
                Err(e) => ("rankine_earth_pressure".to_string(), Err(e)),
            }
        }
        DesignCheckType::SeismicEarthPressure { req } => {
            let input = seismic_earth_pressure::SeismicEarthPressureInput {
                unit_weight_kn_m3: req.unit_weight_kn_m3,
                retained_height_m: req.retained_height_m,
                kh: req.kh,
                kv: req.kv,
                static_active_thrust_kn_per_m: req.static_active_thrust_kn_per_m,
            };
            match seismic_earth_pressure::check_seismic_earth_pressure(&input) {
                Ok(result) => ("seismic_earth_pressure".to_string(), to_json(&result)),
                Err(e) => ("seismic_earth_pressure".to_string(), Err(e)),
            }
        }
        DesignCheckType::Deflection { req } => {
            let result = serviceability::check_deflection(
                &req.material,
                req.span_mm,
                req.actual_deflection_mm,
                &req.member_type,
                &req.load_type,
                &req.support_condition,
            );
            ("deflection".to_string(), to_json(&result))
        }
        DesignCheckType::Vibration { req } => {
            let result = serviceability::check_floor_vibration(req.frequency_hz, &req.occupancy);
            ("vibration".to_string(), to_json(&result))
        }
        DesignCheckType::CrackWidth { req } => {
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
            ("crack_width".to_string(), to_json(&result))
        }
    };

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

    match result {
        Ok(value) => DesignCheckResult {
            success: true,
            design_id: input.id.clone(),
            check_type,
            result: Some(value),
            error: None,
            duration_ms,
        },
        Err(err) => DesignCheckResult {
            success: false,
            design_id: input.id.clone(),
            check_type,
            result: None,
            error: Some(err),
            duration_ms,
        },
    }
}

// ── Composite Beam Design ───────────────────────────────────────────────────

/// Request body for composite beam design, with optional version toggle.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CompositeBeamReq {
    #[serde(flatten)]
    pub params: composite_beam::CompositeBeamParams,
    #[serde(default)]
    pub version: Option<composite_beam::CompositeBeamVersion>,
}

/// Version‐aware composite beam design endpoint.
/// If no `version` provided, defaults to `VCurrent`.
pub async fn composite_beam_design(
    Json(req): Json<CompositeBeamReq>,
) -> ApiResult<Json<composite_beam::CompositeBeamResult>> {
    composite_beam::design_composite_beam_with_version(
        &req.params,
        req.version.unwrap_or(composite_beam::CompositeBeamVersion::VCurrent),
    )
    .map(Json)
    .map_err(|e| ApiError::BadRequest(e))
}
// ── Base Plate Design ───────────────────────────────────────────────────────

pub async fn base_plate_design(
    Json(req): Json<base_plate::BasePlateParams>,
) -> ApiResult<Json<base_plate::BasePlateResult>> {
    base_plate::design_base_plate(&req)
        .map(Json)
        .map_err(|e| ApiError::BadRequest(e))
}

// ── Ductile Detailing ───────────────────────────────────────────────────────

pub async fn ductile_detailing_check(
    Json(req): Json<ductile_detailing::DuctileDetailingParams>,
) -> ApiResult<Json<ductile_detailing::DuctileDetailingResult>> {
    ductile_detailing::check_ductile_detailing(&req)
        .map(Json)
        .map_err(|e| ApiError::BadRequest(e))
}

// ── AISC 360 Bending ───────────────────────────────────────────────────────

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

// ── Eurocode 3 ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC3BendingReq {
    pub section: eurocode3::EC3Section,
    pub params: eurocode3::EC3DesignParams,
    #[serde(default = "default_ec3_class")]
    pub section_class: String,
}

fn default_ec3_class() -> String {
    "Class1".to_string()
}

fn parse_ec3_class(s: &str) -> eurocode3::SectionClass {
    match s {
        "Class2" => eurocode3::SectionClass::Class2,
        "Class3" => eurocode3::SectionClass::Class3,
        "Class4" => eurocode3::SectionClass::Class4,
        _ => eurocode3::SectionClass::Class1,
    }
}

pub async fn ec3_bending(
    Json(req): Json<EC3BendingReq>,
) -> ApiResult<Json<eurocode3::EC3Capacity>> {
    let class = parse_ec3_class(&req.section_class);
    let cap = eurocode3::calculate_bending_capacity(&req.section, &req.params, class);
    Ok(Json(cap))
}

#[derive(Debug, Clone, Deserialize)]
pub struct EC3ShearReq {
    pub av_mm2: f64,
    pub fy_mpa: f64,
    pub ved_kn: f64,
}

pub async fn ec3_shear(
    Json(req): Json<EC3ShearReq>,
) -> ApiResult<Json<eurocode3::EC3ShearCapacity>> {
    Ok(Json(eurocode3::calculate_shear_capacity(
        req.av_mm2, req.fy_mpa, req.ved_kn,
    )))
}

pub async fn ec3_sections() -> ApiResult<Json<Vec<eurocode3::EC3Section>>> {
    Ok(Json(eurocode3::ec3_ipe_sections()))
}

// ── Eurocode 2 ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC2BendingReq {
    pub section: eurocode2::EC2Section,
    pub params: eurocode2::EC2DesignParams,
}

pub async fn ec2_bending(
    Json(req): Json<EC2BendingReq>,
) -> ApiResult<Json<eurocode2::EC2Capacity>> {
    let cap = eurocode2::calculate_bending_capacity(&req.section, &req.params);
    Ok(Json(cap))
}

#[derive(Debug, Clone, Deserialize)]
pub struct EC2ShearReq {
    pub ved_kn: f64,
    pub b_mm: f64,
    pub d_mm: f64,
    pub fck_mpa: f64,
    pub fyk_mpa: f64,
    pub rho_l: f64,
}

pub async fn ec2_shear(
    Json(req): Json<EC2ShearReq>,
) -> ApiResult<Json<eurocode2::EC2ShearCapacity>> {
    let vrd_c =
        eurocode2::calculate_shear_capacity_concrete(req.b_mm, req.d_mm, req.fck_mpa, req.rho_l);
    let result = eurocode2::design_shear_reinforcement(
        req.ved_kn,
        vrd_c,
        req.b_mm,
        req.d_mm,
        req.fck_mpa,
        req.fyk_mpa,
    );
    Ok(Json(result))
}

// ── ACI 318 ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AciBendingReq {
    pub section: aci_318::ACISection,
    pub params: aci_318::ACIDesignParams,
}

pub async fn aci_bending(Json(req): Json<AciBendingReq>) -> ApiResult<Json<aci_318::ACICapacity>> {
    let cap = aci_318::calculate_bending_capacity(&req.section, &req.params);
    Ok(Json(cap))
}

#[derive(Debug, Clone, Deserialize)]
pub struct AciShearReq {
    pub b_mm: f64,
    pub d_mm: f64,
    pub fc_mpa: f64,
    pub vu_kn: f64,
    pub fyt_mpa: f64,
}

pub async fn aci_shear(Json(req): Json<AciShearReq>) -> ApiResult<Json<aci_318::ACIShearCapacity>> {
    let vc = aci_318::calculate_shear_capacity_concrete(req.b_mm, req.d_mm, req.fc_mpa, 1.0);
    let result =
        aci_318::design_shear_stirrups(req.vu_kn, vc, req.b_mm, req.d_mm, req.fyt_mpa, req.fc_mpa);
    Ok(Json(result))
}

// ── NDS 2018 (Timber) ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct NdsBendingReq {
    pub section: nds_2018::NDSSection,
    pub params: nds_2018::NDSDesignParams,
}

pub async fn nds_bending(Json(req): Json<NdsBendingReq>) -> ApiResult<Json<nds_2018::NDSCapacity>> {
    let cap = nds_2018::calculate_adjusted_bending_value(&req.section, &req.params);
    Ok(Json(cap))
}

// ── IS 456 Torsion Design (Cl. 41.1–41.4) ──────────────────────────────────

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

// ── AISC 360 Compression (Ch. E) ───────────────────────────────────────────

pub async fn aisc_compression(
    Json(req): Json<aisc_360::AiscCompressionParams>,
) -> ApiResult<Json<aisc_360::AiscCompressionCapacity>> {
    let cap = aisc_360::calculate_compression_capacity(&req);
    Ok(Json(cap))
}

// ── AISC 360 Shear (Ch. G) ─────────────────────────────────────────────────

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

// ── AISC 360 Combined (Ch. H Eq. H1-1a/H1-1b) ─────────────────────────────

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

// ── ACI 318 Column P-M Interaction (§22.4) ──────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AciColumnReq {
    pub b_mm: f64,
    pub h_mm: f64,
    pub cover_mm: f64,
    pub fc_mpa: f64,
    pub fy_mpa: f64,
    pub as_total_mm2: f64,
    pub pu_kn: f64,
    pub mu_knm: f64,
}

pub async fn aci_column(
    Json(req): Json<AciColumnReq>,
) -> ApiResult<Json<aci_318::ACIColumnResult>> {
    let result = aci_318::check_column_aci(
        req.b_mm,
        req.h_mm,
        req.cover_mm,
        req.fc_mpa,
        req.fy_mpa,
        req.as_total_mm2,
        req.pu_kn,
        req.mu_knm,
    );
    Ok(Json(result))
}

// ── ACI 318 Development Length (§25.4.2.3) ──────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct AciDevLengthReq {
    pub db_mm: f64,
    pub fy_mpa: f64,
    pub fc_mpa: f64,
    #[serde(default)]
    pub is_top_bar: bool,
    #[serde(default)]
    pub is_epoxy_coated: bool,
}

pub async fn aci_development_length(
    Json(req): Json<AciDevLengthReq>,
) -> ApiResult<Json<aci_318::ACIDevLengthResult>> {
    let result = aci_318::development_length_aci(
        req.db_mm,
        req.fy_mpa,
        req.fc_mpa,
        req.is_top_bar,
        req.is_epoxy_coated,
    );
    Ok(Json(result))
}

// ── Eurocode 2 Crack Width (Cl. 7.3.4) ─────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC2CrackWidthReq {
    pub b_mm: f64,
    pub d_mm: f64,
    pub cover_mm: f64,
    pub as_mm2: f64,
    pub bar_dia_mm: f64,
    pub fck_mpa: f64,
    pub sigma_s_mpa: f64,
    #[serde(default = "default_wk_limit")]
    pub wk_limit_mm: f64,
    #[serde(default)]
    pub is_long_term: bool,
}

fn default_wk_limit() -> f64 {
    0.3
}

pub async fn ec2_crack_width(
    Json(req): Json<EC2CrackWidthReq>,
) -> ApiResult<Json<eurocode2::EC2CrackWidthResult>> {
    let result = eurocode2::check_crack_width(
        req.b_mm,
        req.d_mm,
        req.cover_mm,
        req.as_mm2,
        req.bar_dia_mm,
        req.fck_mpa,
        req.sigma_s_mpa,
        req.wk_limit_mm,
        req.is_long_term,
    );
    Ok(Json(result))
}

// ── Eurocode 2 Punching Shear (Cl. 6.4.3–6.4.4) ───────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC2PunchingReq {
    pub column_b_mm: f64,
    pub column_h_mm: f64,
    pub slab_d_mm: f64,
    pub fck_mpa: f64,
    pub rho_l: f64,
    pub ved_kn: f64,
    pub beta: f64,
}

pub async fn ec2_punching_shear(
    Json(req): Json<EC2PunchingReq>,
) -> ApiResult<Json<eurocode2::EC2PunchingShearResult>> {
    let result = eurocode2::check_punching_shear(
        req.column_b_mm,
        req.column_h_mm,
        req.slab_d_mm,
        req.fck_mpa,
        req.rho_l,
        req.ved_kn,
        req.beta,
    );
    Ok(Json(result))
}

// ── Eurocode 3 Column Buckling (Cl. 6.3.1.2) ───────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC3BucklingReq2 {
    pub area_mm2: f64,
    pub fy_mpa: f64,
    pub lcr_mm: f64,
    pub i_mm: f64,
    pub ned_kn: f64,
    #[serde(default = "default_buckling_curve")]
    pub curve: String,
}

fn default_buckling_curve() -> String {
    "b".to_string()
}

pub async fn ec3_column_buckling(
    Json(req): Json<EC3BucklingReq2>,
) -> ApiResult<Json<eurocode3::EC3BucklingResult>> {
    let curve_char = req.curve.chars().next().unwrap_or('b');
    let result = eurocode3::check_column_buckling(
        req.area_mm2,
        req.fy_mpa,
        req.lcr_mm,
        req.i_mm,
        req.ned_kn,
        curve_char,
    );
    Ok(Json(result))
}

// ── Eurocode 3 N+M Interaction (Cl. 6.3.3 Eq. 6.61) ───────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct EC3InteractionReq {
    pub ned_kn: f64,
    pub nb_rd_kn: f64,
    pub my_ed_knm: f64,
    pub my_rd_knm: f64,
    pub mz_ed_knm: f64,
    pub mz_rd_knm: f64,
    #[serde(default = "default_chi_lt")]
    pub chi_lt: f64,
}

fn default_chi_lt() -> f64 {
    1.0
}

pub async fn ec3_interaction(
    Json(req): Json<EC3InteractionReq>,
) -> ApiResult<Json<eurocode3::EC3InteractionResult>> {
    let result = eurocode3::check_interaction_ec3(
        req.ned_kn,
        req.nb_rd_kn,
        req.my_ed_knm,
        req.my_rd_knm,
        req.mz_ed_knm,
        req.mz_rd_knm,
        req.chi_lt,
    );
    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_design_processes_flexural_capacity_successfully() {
        let input = DesignCheckInput {
            id: "beam-1".to_string(),
            check: DesignCheckType::FlexuralCapacity {
                req: FlexuralCapacityReq {
                    b: 300.0,
                    d: 450.0,
                    fck: 30.0,
                    fy: 500.0,
                    ast: 2010.0,
                    asc: 0.0,
                    d_prime: 0.0,
                },
            },
        };

        let result = process_design_check(&input);

        assert!(result.success);
        assert_eq!(result.design_id, "beam-1");
        assert_eq!(result.check_type, "flexural_capacity");
        assert!(result.result.is_some());
        assert!(result.error.is_none());
    }

    #[test]
    fn batch_design_reports_invalid_zone_as_failure() {
        let input = DesignCheckInput {
            id: "seismic-err-1".to_string(),
            check: DesignCheckType::BaseShear {
                req: BaseShearReq {
                    zone: "INVALID".to_string(),
                    soil: "medium".to_string(),
                    importance: 1.0,
                    response_reduction: 5.0,
                    period: 0.5,
                    seismic_weight_kn: 10000.0,
                    code_version: None,
                },
            },
        };

        let result = process_design_check(&input);

        assert!(!result.success);
        assert_eq!(result.design_id, "seismic-err-1");
        assert_eq!(result.check_type, "base_shear");
        assert!(result.result.is_none());
        assert!(result.error.is_some());
    }

    #[test]
    fn batch_request_deserializes_snake_case_check_type() {
        let payload = serde_json::json!({
            "checks": [
                {
                    "id": "service-1",
                    "type": "deflection",
                    "req": {
                        "material": "concrete",
                        "span_mm": 5000.0,
                        "actual_deflection_mm": 12.0,
                        "member_type": "beam",
                        "load_type": "live",
                        "support_condition": "simply_supported"
                    }
                }
            ]
        });

        let req: BatchDesignRequest =
            serde_json::from_value(payload).expect("payload should deserialize");
        assert_eq!(req.checks.len(), 1);
        assert_eq!(req.checks[0].id, "service-1");
        match req.checks[0].check {
            DesignCheckType::Deflection { .. } => {}
            _ => panic!("expected deflection check type"),
        }
    }

    #[test]
    fn batch_design_base_shear_sandbox_returns_warning_metadata() {
        let input = DesignCheckInput {
            id: "seismic-sandbox-1".to_string(),
            check: DesignCheckType::BaseShear {
                req: BaseShearReq {
                    zone: "IV".to_string(),
                    soil: "medium".to_string(),
                    importance: 1.0,
                    response_reduction: 5.0,
                    period: 0.8,
                    seismic_weight_kn: 12000.0,
                    code_version: Some("is1893_2025_sandbox".to_string()),
                },
            },
        };

        let result = process_design_check(&input);
        assert!(result.success, "expected sandbox base shear to succeed");

        let payload = result.result.expect("expected serialized result payload");
        assert_eq!(
            payload.get("code_version").and_then(|v| v.as_str()),
            Some("IS1893_2025_SANDBOX")
        );
        assert!(payload
            .get("sandbox_warning")
            .and_then(|v| v.as_str())
            .is_some());
    }

    #[test]
    fn batch_request_deserializes_geotech_phase2_types() {
        let payload = serde_json::json!({
            "checks": [
                {
                    "id": "pile-1",
                    "type": "pile_axial_capacity",
                    "req": {
                        "diameter_m": 0.6,
                        "length_m": 18.0,
                        "unit_skin_friction_kpa": 65.0,
                        "unit_end_bearing_kpa": 2500.0,
                        "applied_load_kn": 2000.0,
                        "safety_factor": 2.5
                    }
                },
                {
                    "id": "ep-1",
                    "type": "rankine_earth_pressure",
                    "req": {
                        "friction_angle_deg": 30.0,
                        "unit_weight_kn_m3": 18.0,
                        "retained_height_m": 6.0,
                        "surcharge_kpa": 10.0
                    }
                },
                {
                    "id": "sep-1",
                    "type": "seismic_earth_pressure",
                    "req": {
                        "unit_weight_kn_m3": 18.0,
                        "retained_height_m": 6.0,
                        "kh": 0.15,
                        "kv": 0.05,
                        "static_active_thrust_kn_per_m": 120.0
                    }
                }
            ]
        });

        let req: BatchDesignRequest =
            serde_json::from_value(payload).expect("payload should deserialize");
        assert_eq!(req.checks.len(), 3);

        match &req.checks[0].check {
            DesignCheckType::PileAxialCapacity { .. } => {}
            _ => panic!("expected pile_axial_capacity check type"),
        }
        match &req.checks[1].check {
            DesignCheckType::RankineEarthPressure { .. } => {}
            _ => panic!("expected rankine_earth_pressure check type"),
        }
        match &req.checks[2].check {
            DesignCheckType::SeismicEarthPressure { .. } => {}
            _ => panic!("expected seismic_earth_pressure check type"),
        }
    }
}
