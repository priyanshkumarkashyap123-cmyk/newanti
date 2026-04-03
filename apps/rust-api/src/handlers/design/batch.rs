use axum::extract::State;
use axum::Json;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::design_codes::{
    bearing_capacity, earth_pressure, is_1893, is_456, is_800, is_875, liquefaction,
    pile_capacity, retaining_wall, seismic_earth_pressure, serviceability, settlement,
    slope_stability, spt_correlations,
};
use crate::error::{ApiError, ApiResult};
use crate::AppState;

use super::is456::{
    BiaxialColumnReq, DeflectionCheckIs456Req, FlexuralCapacityReq, FlexuralCapacityResp,
    ShearDesignReq,
};
use super::is800_aisc::{
    AutoSelectReq, BoltBearingReq, BoltHsfgReq, FilletWeldReq,
};
use super::geotech::{
    BearingCapacityStripReq, ConsolidationSettlementReq, InfiniteSlopeReq, LiquefactionReq,
    PileAxialCapacityReq, RankineEarthPressureReq, RetainingWallStabilityReq,
    SeismicEarthPressureReq, SptCorrelationReq,
};
use super::is1893_875::{
    BaseShearReq, DriftCheckReq, EqForcesReq, LiveLoadReductionReq, LiveLoadReq,
    LiveLoadReductionResp, LiveLoadResp, PressureCoeffReq, WindPerStoreyReq,
};
use super::serviceability::{CrackWidthReq, DeflectionCheckReq, VibrationCheckReq};

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

pub async fn batch_design(
    State(_state): State<Arc<AppState>>,
    Json(input): Json<BatchDesignRequest>,
) -> ApiResult<Json<BatchDesignResponse>> {
    if input.checks.is_empty() {
        return Err(ApiError::BadRequest("No design checks provided".into()));
    }
    if input.checks.len() > 500 {
        return Err(ApiError::BadRequest(
            "Maximum 500 design checks per batch".into(),
        ));
    }

    let start = std::time::Instant::now();

    let mut results_with_idx: Vec<(usize, DesignCheckResult)> = input
        .checks
        .par_iter()
        .enumerate()
        .map(|(idx, check_input)| (idx, process_design_check(check_input)))
        .collect();

    results_with_idx.sort_by_key(|(idx, _)| *idx);
    let results: Vec<DesignCheckResult> = results_with_idx
        .into_iter()
        .map(|(_, result)| result)
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

fn to_json<T: Serialize>(val: &T) -> Result<Value, String> {
    serde_json::to_value(val).map_err(|e| format!("serialization error: {e}"))
}

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
        _ => {}
    }
    Ok(())
}

fn process_design_check(input: &DesignCheckInput) -> DesignCheckResult {
    let start = std::time::Instant::now();

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
            let version = super::is800_aisc::parse_is800_version(req.code_version.as_deref());
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
            let version = super::is800_aisc::parse_is800_version(req.code_version.as_deref());
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
            let version = super::is800_aisc::parse_is800_version(req.code_version.as_deref());
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
            let version = super::is800_aisc::parse_is800_version(req.code_version.as_deref());
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
        DesignCheckType::BaseShear { req } => match (super::parse_zone(&req.zone), super::parse_soil(&req.soil)) {
            (Ok(zone), Ok(soil)) => {
            let version = super::is1893_875::parse_is1893_version(req.code_version.as_deref());
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
            (Err(e), _) | (_, Err(e)) => ("base_shear".to_string(), Err(format!("{:?}", e))),
        },
        DesignCheckType::EqForces { req } => match (super::parse_zone(&req.zone), super::parse_soil(&req.soil)) {
            (Ok(zone), Ok(soil)) => {
            let version = super::is1893_875::parse_is1893_version(req.code_version.as_deref());
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
            let version = super::is1893_875::parse_is1893_version(req.code_version.as_deref());
            let result = is_1893::check_storey_drift_with_version(
                req.storey_height_mm,
                req.elastic_drift_mm,
                req.response_reduction,
                req.storey_number,
                version,
            );
            ("drift_check".to_string(), to_json(&result))
        }
        DesignCheckType::WindPerStorey { req } => match super::is1893_875::parse_terrain(&req.terrain) {
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
            let resp = LiveLoadReductionResp { reduction_factor: rf };
            ("live_load_reduction".to_string(), to_json(&resp))
        }
        DesignCheckType::SptCorrelation { req } => {
            let input = spt_correlations::SptCorrelationInput {
                n60: req.n60,
                fines_percent: Some(req.fines_percent),
                groundwater_depth_m: Some(req.groundwater_depth_m),
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
                ru: Some(req.ru),
                required_fs: Some(req.required_fs),
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
                safety_factor: Some(req.safety_factor),
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
                required_fs_overturning: Some(req.required_fs_overturning),
                required_fs_sliding: Some(req.required_fs_sliding),
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
                required_max_settlement_mm: Some(req.required_max_settlement_mm),
            };
            match settlement::check_consolidation_settlement(&input) {
                Ok(result) => ("consolidation_settlement".to_string(), to_json(&result)),
                Err(e) => ("consolidation_settlement".to_string(), Err(e)),
            }
        }
        DesignCheckType::LiquefactionScreening { req } => {
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
                safety_factor: Some(req.safety_factor),
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
                surcharge_kpa: Some(req.surcharge_kpa),
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
                kv: Some(req.kv),
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
