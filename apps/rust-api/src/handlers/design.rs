//! Design Code Check Handlers
//!
//! REST endpoints exposing IS 456, IS 800, IS 1893, IS 875, and serviceability
//! checks via the Rust design_codes module. These replace the Python FastAPI
//! endpoints in routers/is_code_checks.py.

use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::design_codes::{is_456, is_800, is_1893, is_875, serviceability};
use crate::error::{ApiError, ApiResult};
use axum::extract::State;
use std::sync::Arc;
use crate::AppState;

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
fn default_asv() -> f64 { 100.0 }

pub async fn shear_design(
    Json(req): Json<ShearDesignReq>,
) -> ApiResult<Json<is_456::ShearCheckResult>> {
    let result = is_456::design_shear(
        req.vu_kn, req.b, req.d, req.fck, req.fy_stirrup, req.pt, req.asv,
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
        req.span_mm, req.effective_depth, &req.support,
        req.pt, req.pc, req.fy, req.actual_ast, req.required_ast,
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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
            return Err(ApiError::BadRequest("Maximum 500 design checks per batch".into()));
        }

        let start = std::time::Instant::now();

        // Run all design checks in parallel using Rayon
        let results: Vec<DesignCheckResult> = input.checks
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

    /// Process a single design check (called in parallel by Rayon)
    fn process_design_check(input: &DesignCheckInput) -> DesignCheckResult {
        let start = std::time::Instant::now();

        let (check_type, result) = match &input.check {
            DesignCheckType::FlexuralCapacity { req } => {
                let xu_max = is_456::xu_max_ratio(req.fy) * req.d;
                let mu = if req.asc > 0.0 && req.d_prime > 0.0 {
                    is_456::flexural_capacity_doubly(
                        req.b, req.d, req.d_prime, req.fck, req.fy, req.ast, req.asc,
                    )
                } else {
                    is_456::flexural_capacity_singly(req.b, req.d, req.fck, req.fy, req.ast)
                };
                let xu = (0.87 * req.fy * req.ast) / (0.36 * req.fck * req.b);
                let resp = FlexuralCapacityResp {
                    mu_knm: mu,
                    xu_max_mm: xu_max,
                    section_type: if xu > xu_max { "over-reinforced".into() } else { "under-reinforced".into() },
                };
                ("flexural_capacity".to_string(), Ok(serde_json::to_value(&resp).unwrap()))
            },
            DesignCheckType::ShearDesign { req } => {
                let result = is_456::design_shear(
                    req.vu_kn, req.b, req.d, req.fck, req.fy_stirrup, req.pt, req.asv,
                );
                ("shear_design".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::BiaxialColumn { req } => {
                let result = is_456::check_column_biaxial(
                    req.b, req.d, req.fck, req.fy,
                    req.pu_kn, req.mux_knm, req.muy_knm,
                    req.ast_total, req.d_dash, req.leff_x, req.leff_y,
                );
                ("biaxial_column".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::DeflectionIs456 { req } => {
                let result = is_456::check_deflection(
                    req.span_mm, req.effective_depth, &req.support,
                    req.pt, req.pc, req.fy, req.actual_ast, req.required_ast,
                );
                ("deflection_is456".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::BoltBearing { req } => {
                match is_800::design_bolt_bearing(
                    req.bolt_dia, &req.grade, req.plate_fu, req.plate_thk,
                    req.n_bolts, req.n_shear_planes, req.edge_dist, req.pitch,
                ) {
                    Ok(result) => ("bolt_bearing".to_string(), Ok(serde_json::to_value(&result).unwrap())),
                    Err(e) => ("bolt_bearing".to_string(), Err(e)),
                }
            },
            DesignCheckType::BoltHsfg { req } => {
                match is_800::design_bolt_hsfg(
                    req.bolt_dia, &req.grade, req.n_bolts,
                    req.n_effective_interfaces, req.mu_f, req.kh,
                ) {
                    Ok(result) => ("bolt_hsfg".to_string(), Ok(serde_json::to_value(&result).unwrap())),
                    Err(e) => ("bolt_hsfg".to_string(), Err(e)),
                }
            },
            DesignCheckType::FilletWeld { req } => {
                let result = is_800::design_fillet_weld(
                    req.weld_size, req.weld_length, req.weld_fu, req.load_kn, &req.weld_type,
                );
                ("fillet_weld".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::AutoSelect { req } => {
                let result = is_800::auto_select_section(
                    req.fy, req.pu_kn, req.mux_knm, req.muy_knm,
                    req.vu_kn, req.lx_mm, req.ly_mm,
                );
                ("auto_select".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::BaseShear { req } => {
                match parse_zone(&req.zone) {
                    Ok(zone) => {
                        match parse_soil(&req.soil) {
                            Ok(soil) => {
                                let result = is_1893::calculate_base_shear(
                                    req.seismic_weight_kn, req.period,
                                    zone, soil, req.importance, req.response_reduction,
                                );
                                ("base_shear".to_string(), Ok(serde_json::to_value(&result).unwrap()))
                            }
                            Err(e) => ("base_shear".to_string(), Err(format!("{:?}", e))),
                        }
                    }
                    Err(e) => ("base_shear".to_string(), Err(format!("{:?}", e))),
                }
            },
            DesignCheckType::EqForces { req } => {
                match (parse_zone(&req.zone), parse_soil(&req.soil)) {
                    (Ok(zone), Ok(soil)) => {
                        let result = is_1893::generate_equivalent_lateral_forces(
                            &req.node_weights, zone, soil,
                            req.importance, req.response_reduction,
                            &req.building_type, req.base_dimension, &req.direction,
                        );
                        ("eq_forces".to_string(), Ok(serde_json::to_value(&result).unwrap()))
                    }
                    (Err(e), _) | (_, Err(e)) => ("eq_forces".to_string(), Err(format!("{:?}", e))),
                }
            },
            DesignCheckType::DriftCheck { req } => {
                let result = is_1893::check_storey_drift(
                    req.storey_height_mm, req.elastic_drift_mm,
                    req.response_reduction, req.storey_number,
                );
                ("drift_check".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::WindPerStorey { req } => {
                match parse_terrain(&req.terrain) {
                    Ok(terrain) => {
                        let result = is_875::wind_force_per_storey(
                            req.vb, &req.storey_heights, req.tributary_width,
                            terrain, req.cf, req.k1, req.k3,
                        );
                        ("wind_per_storey".to_string(), Ok(serde_json::to_value(&result).unwrap()))
                    }
                    Err(e) => ("wind_per_storey".to_string(), Err(format!("{:?}", e))),
                }
            },
            DesignCheckType::PressureCoefficients { req } => {
                let result = is_875::pressure_coefficients_rectangular(
                    req.h_by_w, req.opening_ratio,
                );
                ("pressure_coefficients".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::LiveLoad { req } => {
                let ll = is_875::live_load(&req.occupancy);
                let resp = LiveLoadResp {
                    occupancy: req.occupancy.clone(),
                    live_load_kN_m2: ll,
                };
                ("live_load".to_string(), Ok(serde_json::to_value(&resp).unwrap()))
            },
            DesignCheckType::LiveLoadReduction { req } => {
                let rf = is_875::live_load_reduction(req.tributary_area, req.num_floors);
                let resp = LiveLoadReductionResp {
                    reduction_factor: rf,
                };
                ("live_load_reduction".to_string(), Ok(serde_json::to_value(&resp).unwrap()))
            },
            DesignCheckType::Deflection { req } => {
                let result = serviceability::check_deflection(
                    &req.material, req.span_mm, req.actual_deflection_mm,
                    &req.member_type, &req.load_type, &req.support_condition,
                );
                ("deflection".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::Vibration { req } => {
                let result = serviceability::check_floor_vibration(
                    req.frequency_hz, &req.occupancy,
                );
                ("vibration".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
            DesignCheckType::CrackWidth { req } => {
                let result = serviceability::estimate_crack_width(
                    req.b, req.d, req.big_d, req.cover,
                    req.bar_dia, req.bar_spacing, req.fs, &req.exposure,
                );
                ("crack_width".to_string(), Ok(serde_json::to_value(&result).unwrap()))
            },
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

        let req: BatchDesignRequest = serde_json::from_value(payload).expect("payload should deserialize");
        assert_eq!(req.checks.len(), 1);
        assert_eq!(req.checks[0].id, "service-1");
        match req.checks[0].check {
            DesignCheckType::Deflection { .. } => {}
            _ => panic!("expected deflection check type"),
        }
    }
}
