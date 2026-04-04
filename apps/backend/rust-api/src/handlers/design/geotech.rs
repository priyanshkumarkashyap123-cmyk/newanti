use axum::Json;
use serde::Deserialize;
use crate::design_codes::{
    bearing_capacity, earth_pressure, liquefaction, pile_capacity, retaining_wall,
    seismic_earth_pressure, settlement, slope_stability, spt_correlations,
};
use crate::error::ApiResult;

// ── SPT Correlation ──
#[derive(Debug, Clone, Deserialize)]
pub struct SptCorrelationReq {
    pub n60: f64,
    pub fines_percent: f64,
    pub groundwater_depth_m: f64,
}

pub async fn spt_correlation(
    Json(req): Json<SptCorrelationReq>,
) -> ApiResult<Json<spt_correlations::SptCorrelationResult>> {
    let input = spt_correlations::SptCorrelationInput {
        n60: req.n60,
        fines_percent: Some(req.fines_percent),
        groundwater_depth_m: Some(req.groundwater_depth_m),
    };
    spt_correlations::correlate_sandy_soil(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Infinite Slope ──
#[derive(Debug, Clone, Deserialize)]
pub struct InfiniteSlopeReq {
    pub slope_angle_deg: f64,
    pub friction_angle_deg: f64,
    pub cohesion_kpa: f64,
    pub unit_weight_kn_m3: f64,
    pub depth_m: f64,
    #[serde(default)]
    pub ru: f64,
    #[serde(default = "default_fs")]
    pub required_fs: f64,
}
fn default_fs() -> f64 {
    1.5
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
        ru: Some(req.ru),
        required_fs: Some(req.required_fs),
    };
    slope_stability::check_infinite_slope(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Bearing Capacity (Terzaghi Strip) ──
#[derive(Debug, Clone, Deserialize)]
pub struct BearingCapacityStripReq {
    pub cohesion_kpa: f64,
    pub friction_angle_deg: f64,
    pub unit_weight_kn_m3: f64,
    pub footing_width_m: f64,
    pub embedment_depth_m: f64,
    pub applied_pressure_kpa: f64,
    #[serde(default = "default_bc_sf")]
    pub safety_factor: f64,
}
fn default_bc_sf() -> f64 {
    3.0
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
        safety_factor: Some(req.safety_factor),
    };
    bearing_capacity::check_terzaghi_strip(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Retaining Wall Stability ──
#[derive(Debug, Clone, Deserialize)]
pub struct RetainingWallStabilityReq {
    pub wall_height_m: f64,
    pub backfill_unit_weight_kn_m3: f64,
    pub backfill_friction_angle_deg: f64,
    pub surcharge_kpa: f64,
    pub base_width_m: f64,
    pub total_vertical_load_kn_per_m: f64,
    pub stabilizing_moment_knm_per_m: f64,
    pub base_friction_coeff: f64,
    pub allowable_bearing_kpa: f64,
    #[serde(default = "default_fs_ot")]
    pub required_fs_overturning: f64,
    #[serde(default = "default_fs_sliding")]
    pub required_fs_sliding: f64,
}
fn default_fs_ot() -> f64 {
    1.5
}
fn default_fs_sliding() -> f64 {
    1.5
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
        required_fs_overturning: Some(req.required_fs_overturning),
        required_fs_sliding: Some(req.required_fs_sliding),
    };
    retaining_wall::check_retaining_wall(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Consolidation Settlement ──
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
    pub required_max_settlement_mm: f64,
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
        required_max_settlement_mm: Some(req.required_max_settlement_mm),
    };
    settlement::check_consolidation_settlement(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Liquefaction Screening ──
#[derive(Debug, Clone, Deserialize)]
pub struct LiquefactionReq {
    pub magnitude_mw: f64,
    pub pga_g: f64,
    pub depth_m: f64,
    pub total_stress_kpa: f64,
    pub effective_stress_kpa: f64,
    pub n1_60cs: f64,
    #[serde(default)]
    pub rd: f64,
    #[serde(default = "default_liq_fs")]
    pub required_fs: f64,
}
fn default_liq_fs() -> f64 {
    1.0
}

pub async fn liquefaction_screening(
    Json(req): Json<LiquefactionReq>,
) -> ApiResult<Json<liquefaction::LiquefactionResult>> {
    let input = liquefaction::LiquefactionInput {
        magnitude_mw: Some(req.magnitude_mw),
        pga_g: req.pga_g,
        depth_m: req.depth_m,
        total_stress_kpa: req.total_stress_kpa,
        effective_stress_kpa: req.effective_stress_kpa,
        n1_60cs: req.n1_60cs,
        rd: Some(req.rd),
        required_fs: Some(req.required_fs),
    };
    liquefaction::check_liquefaction(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Pile Axial Capacity ──
#[derive(Debug, Clone, Deserialize)]
pub struct PileAxialCapacityReq {
    pub diameter_m: f64,
    pub length_m: f64,
    pub unit_skin_friction_kpa: f64,
    pub unit_end_bearing_kpa: f64,
    pub applied_load_kn: f64,
    #[serde(default = "default_pile_sf")]
    pub safety_factor: f64,
}
fn default_pile_sf() -> f64 {
    2.5
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
        safety_factor: Some(req.safety_factor),
    };
    pile_capacity::check_pile_axial_capacity(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Rankine Earth Pressure ──
#[derive(Debug, Clone, Deserialize)]
pub struct RankineEarthPressureReq {
    pub friction_angle_deg: f64,
    pub unit_weight_kn_m3: f64,
    pub retained_height_m: f64,
    #[serde(default)]
    pub surcharge_kpa: f64,
}

pub async fn rankine_earth_pressure(
    Json(req): Json<RankineEarthPressureReq>,
) -> ApiResult<Json<earth_pressure::RankineEarthPressureResult>> {
    let input = earth_pressure::RankineEarthPressureInput {
        friction_angle_deg: req.friction_angle_deg,
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        retained_height_m: req.retained_height_m,
        surcharge_kpa: Some(req.surcharge_kpa),
    };
    earth_pressure::compute_rankine_earth_pressure(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}

// ── Seismic Earth Pressure ──
#[derive(Debug, Clone, Deserialize)]
pub struct SeismicEarthPressureReq {
    pub unit_weight_kn_m3: f64,
    pub retained_height_m: f64,
    pub kh: f64,
    #[serde(default)]
    pub kv: f64,
    pub static_active_thrust_kn_per_m: f64,
}

pub async fn seismic_earth_pressure(
    Json(req): Json<SeismicEarthPressureReq>,
) -> ApiResult<Json<seismic_earth_pressure::SeismicEarthPressureResult>> {
    let input = seismic_earth_pressure::SeismicEarthPressureInput {
        unit_weight_kn_m3: req.unit_weight_kn_m3,
        retained_height_m: req.retained_height_m,
        kh: req.kh,
        kv: Some(req.kv),
        static_active_thrust_kn_per_m: req.static_active_thrust_kn_per_m,
    };
    seismic_earth_pressure::check_seismic_earth_pressure(&input)
        .map(Json)
        .map_err(|e| crate::error::ApiError::BadRequest(e))
}
