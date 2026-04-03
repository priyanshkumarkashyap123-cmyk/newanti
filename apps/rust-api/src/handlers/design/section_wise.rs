use axum::Json;
use serde::{Deserialize, Serialize};
use crate::design_codes::section_wise;
use crate::error::{ApiError, ApiResult};
use crate::solver::post_processor::{
    extract_design_demands, extract_envelope_demands, MemberDistLoad, MemberEndForces,
    PostProcessor,
};

// ── Section-wise RC Beam Design (IS 456) ──
#[derive(Debug, Clone, Deserialize)]
pub struct SectionWiseRCReq {
    pub b: f64,
    pub d: f64,
    #[serde(default = "default_cover")]
    pub cover: f64,
    pub fck: f64,
    pub fy: f64,
    pub span: f64,
    #[serde(default)]
    pub w_factored: f64,
    #[serde(default = "default_support")]
    pub support_condition: String,
    #[serde(default = "default_n_sections")]
    pub n_sections: usize,
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

pub async fn section_wise_rc(
    Json(req): Json<SectionWiseRCReq>,
) -> ApiResult<Json<section_wise::SectionWiseResult>> {
    let n = if req.n_sections < 3 { 11 } else { req.n_sections };

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

// ── Section-wise Steel Beam Design (IS 800 / AISC 360) ──
#[derive(Debug, Clone, Deserialize)]
pub struct SectionWiseSteelReq {
    pub fy: f64,
    #[serde(default = "default_steel_code")]
    pub design_code: String,
    #[serde(default)]
    pub section_name: String,
    #[serde(default)]
    pub section: Option<section_wise::SteelSectionInput>,
    pub unbraced_length: f64,
    pub span: f64,
    #[serde(default = "default_rolled")]
    pub is_rolled: bool,
    #[serde(default)]
    pub w_factored: f64,
    #[serde(default = "default_support")]
    pub support_condition: String,
    #[serde(default = "default_n_sections")]
    pub n_sections: usize,
    #[serde(default)]
    pub section_forces: Vec<[f64; 3]>,
}
fn default_steel_code() -> String {
    "is800".to_string()
}
fn default_rolled() -> bool {
    true
}

pub async fn section_wise_steel(
    Json(req): Json<SectionWiseSteelReq>,
) -> ApiResult<Json<section_wise::SteelSectionWiseResult>> {
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

    let code = match req.design_code.to_lowercase().as_str() {
        "aisc360" | "aisc" => section_wise::SteelDesignCode::Aisc360,
        _ => section_wise::SteelDesignCode::Is800,
    };

    let n = if req.n_sections < 3 { 11 } else { req.n_sections };
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
    match designer.design_member_sectionwise(&section, &demands, req.unbraced_length, req.is_rolled) {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ApiError::BadRequest(e)),
    }
}

// ── Section-wise from Analysis ──
#[derive(Debug, Clone, Deserialize)]
pub struct MemberForcesInput {
    pub member_id: String,
    pub start_node: String,
    pub end_node: String,
    pub length: f64,
    pub forces_start: [f64; 6],
    pub forces_end: [f64; 6],
    #[serde(default)]
    pub displacements_start: [f64; 6],
    #[serde(default)]
    pub displacements_end: [f64; 6],
    #[serde(default)]
    pub dist_load_wy: f64,
    #[serde(default)]
    pub dist_load_wz: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FromAnalysisReq {
    pub material: String,
    pub member_forces: Vec<MemberForcesInput>,
    #[serde(default)]
    pub b: f64,
    #[serde(default)]
    pub d: f64,
    #[serde(default = "default_cover")]
    pub cover: f64,
    #[serde(default)]
    pub fck: f64,
    #[serde(default)]
    pub fy: f64,
    #[serde(default)]
    pub section_name: String,
    #[serde(default)]
    pub section: Option<section_wise::SteelSectionInput>,
    #[serde(default)]
    pub steel_fy: f64,
    #[serde(default = "default_steel_code")]
    pub design_code: String,
    #[serde(default)]
    pub unbraced_length: f64,
    #[serde(default = "default_rolled")]
    pub is_rolled: bool,
}

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

pub async fn section_wise_from_analysis(
    Json(req): Json<FromAnalysisReq>,
) -> ApiResult<Json<FromAnalysisResult>> {
    if req.member_forces.is_empty() {
        return Err(ApiError::BadRequest("member_forces array is empty".into()));
    }

    let pp = PostProcessor::new();
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
            let dist_load = if mf.dist_load_wy.abs() > f64::EPSILON || mf.dist_load_wz.abs() > f64::EPSILON {
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

    let demands = if diagrams.len() == 1 {
        extract_design_demands(&diagrams[0])
    } else {
        extract_envelope_demands(&diagrams).map_err(ApiError::BadRequest)?
    };
    let demands_count = demands.len();

    match req.material.to_lowercase().as_str() {
        "rc" | "concrete" => {
            if req.b <= 0.0 || req.d <= 0.0 {
                return Err(ApiError::BadRequest("RC design requires b > 0 and d > 0".into()));
            }
            if req.fck <= 0.0 || req.fy <= 0.0 {
                return Err(ApiError::BadRequest("RC design requires fck > 0 and fy > 0".into()));
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
                    ApiError::BadRequest(format!("Unknown ISMB section: '{}'.", req.section_name))
                })?
            } else {
                return Err(ApiError::BadRequest(
                    "Steel design requires section_name or custom section".into(),
                ));
            };

            let fy = if req.steel_fy > 0.0 { req.steel_fy } else { 250.0 };
            let unbraced = if req.unbraced_length > 0.0 { req.unbraced_length } else { span_mm };

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
        _ => Err(ApiError::BadRequest(format!("Unknown material '{}'. Use 'rc' or 'steel'.", req.material))),
    }
}
