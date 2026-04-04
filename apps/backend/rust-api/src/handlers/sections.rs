//! Section database handlers

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::ApiResult;
use crate::AppState;

/// Standard steel sections database (in-memory for speed)
#[derive(Debug, Clone, Serialize)]
pub struct SteelSection {
    pub id: String,
    #[serde(rename = "designation")]
    pub name: String,
    pub standard: String,     // is, aisc, en, bs
    pub section_type: String, // W, ISMB, ISMC, etc.
    #[serde(rename = "depth")]
    pub d: f64, // Depth (mm)
    #[serde(rename = "width")]
    pub bf: f64, // Flange width (mm)
    pub tf: f64,              // Flange thickness (mm)
    pub tw: f64,              // Web thickness (mm)
    #[serde(rename = "area")]
    pub a: f64, // Area (mm²)
    pub ix: f64,              // Moment of inertia X (mm⁴)
    pub iy: f64,              // Moment of inertia Y (mm⁴)
    #[serde(rename = "zx")]
    pub sx: f64, // Section modulus X (mm³)
    #[serde(rename = "zy")]
    pub sy: f64, // Section modulus Y (mm³)
    pub rx: f64,              // Radius of gyration X (mm)
    pub ry: f64,              // Radius of gyration Y (mm)
    pub weight: f64,          // Weight per meter (kg/m)
}

/// Get standard steel sections database
fn get_section_database() -> Vec<SteelSection> {
    vec![
        // ISMB Sections (Indian Standard Medium Weight Beams)
        SteelSection {
            id: "ISMB100".into(),
            name: "ISMB 100".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 100.0,
            bf: 75.0,
            tf: 7.2,
            tw: 4.0,
            a: 1140.0,
            ix: 2570000.0,
            iy: 262000.0,
            sx: 51400.0,
            sy: 6980.0,
            rx: 47.5,
            ry: 15.2,
            weight: 8.9,
        },
        SteelSection {
            id: "ISMB150".into(),
            name: "ISMB 150".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 150.0,
            bf: 80.0,
            tf: 7.6,
            tw: 4.8,
            a: 1650.0,
            ix: 7260000.0,
            iy: 350000.0,
            sx: 96800.0,
            sy: 8750.0,
            rx: 66.3,
            ry: 14.6,
            weight: 13.0,
        },
        SteelSection {
            id: "ISMB200".into(),
            name: "ISMB 200".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 200.0,
            bf: 100.0,
            tf: 10.8,
            tw: 5.7,
            a: 3230.0,
            ix: 22900000.0,
            iy: 1500000.0,
            sx: 229000.0,
            sy: 30000.0,
            rx: 84.2,
            ry: 21.5,
            weight: 25.4,
        },
        SteelSection {
            id: "ISMB250".into(),
            name: "ISMB 250".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 250.0,
            bf: 125.0,
            tf: 12.5,
            tw: 6.9,
            a: 4621.0,
            ix: 51300000.0,
            iy: 3340000.0,
            sx: 410000.0,
            sy: 53400.0,
            rx: 105.0,
            ry: 26.9,
            weight: 36.3,
        },
        SteelSection {
            id: "ISMB300".into(),
            name: "ISMB 300".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 300.0,
            bf: 140.0,
            tf: 12.4,
            tw: 7.5,
            a: 5626.0,
            ix: 79900000.0,
            iy: 4530000.0,
            sx: 533000.0,
            sy: 64700.0,
            rx: 119.0,
            ry: 28.4,
            weight: 44.2,
        },
        SteelSection {
            id: "ISMB350".into(),
            name: "ISMB 350".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 350.0,
            bf: 140.0,
            tf: 14.2,
            tw: 8.1,
            a: 6670.0,
            ix: 136300000.0,
            iy: 5380000.0,
            sx: 779000.0,
            sy: 76900.0,
            rx: 143.0,
            ry: 28.4,
            weight: 52.4,
        },
        SteelSection {
            id: "ISMB400".into(),
            name: "ISMB 400".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 400.0,
            bf: 140.0,
            tf: 16.0,
            tw: 8.9,
            a: 7850.0,
            ix: 204600000.0,
            iy: 6220000.0,
            sx: 1023000.0,
            sy: 88900.0,
            rx: 161.0,
            ry: 28.1,
            weight: 61.6,
        },
        SteelSection {
            id: "ISMB450".into(),
            name: "ISMB 450".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 450.0,
            bf: 150.0,
            tf: 17.4,
            tw: 9.4,
            a: 9226.0,
            ix: 303900000.0,
            iy: 8340000.0,
            sx: 1351000.0,
            sy: 111000.0,
            rx: 182.0,
            ry: 30.1,
            weight: 72.4,
        },
        SteelSection {
            id: "ISMB500".into(),
            name: "ISMB 500".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 500.0,
            bf: 180.0,
            tf: 17.2,
            tw: 10.2,
            a: 11074.0,
            ix: 452180000.0,
            iy: 13700000.0,
            sx: 1809000.0,
            sy: 152000.0,
            rx: 202.0,
            ry: 35.2,
            weight: 86.9,
        },
        SteelSection {
            id: "ISMB600".into(),
            name: "ISMB 600".into(),
            standard: "is".into(),
            section_type: "ISMB".into(),
            d: 600.0,
            bf: 210.0,
            tf: 20.8,
            tw: 12.0,
            a: 15600.0,
            ix: 918120000.0,
            iy: 26600000.0,
            sx: 3060000.0,
            sy: 253000.0,
            rx: 243.0,
            ry: 41.3,
            weight: 122.6,
        },
        // W Shapes (AISC Wide Flange)
        SteelSection {
            id: "W14x22".into(),
            name: "W14×22".into(),
            standard: "aisc".into(),
            section_type: "W".into(),
            d: 350.0,
            bf: 127.0,
            tf: 8.5,
            tw: 5.8,
            a: 4180.0,
            ix: 82800000.0,
            iy: 4390000.0,
            sx: 473000.0,
            sy: 69100.0,
            rx: 141.0,
            ry: 32.5,
            weight: 32.7,
        },
        SteelSection {
            id: "W14x30".into(),
            name: "W14×30".into(),
            standard: "aisc".into(),
            section_type: "W".into(),
            d: 353.0,
            bf: 171.0,
            tf: 9.8,
            tw: 6.9,
            a: 5680.0,
            ix: 123000000.0,
            iy: 12100000.0,
            sx: 697000.0,
            sy: 141000.0,
            rx: 147.0,
            ry: 46.2,
            weight: 44.5,
        },
        SteelSection {
            id: "W18x35".into(),
            name: "W18×35".into(),
            standard: "aisc".into(),
            section_type: "W".into(),
            d: 450.0,
            bf: 152.0,
            tf: 10.8,
            tw: 7.6,
            a: 6650.0,
            ix: 231000000.0,
            iy: 8330000.0,
            sx: 1027000.0,
            sy: 109000.0,
            rx: 186.0,
            ry: 35.4,
            weight: 52.2,
        },
        SteelSection {
            id: "W21x44".into(),
            name: "W21×44".into(),
            standard: "aisc".into(),
            section_type: "W".into(),
            d: 525.0,
            bf: 165.0,
            tf: 11.4,
            tw: 8.9,
            a: 8390.0,
            ix: 351000000.0,
            iy: 11000000.0,
            sx: 1337000.0,
            sy: 133000.0,
            rx: 204.0,
            ry: 36.2,
            weight: 65.5,
        },
        SteelSection {
            id: "W24x55".into(),
            name: "W24×55".into(),
            standard: "aisc".into(),
            section_type: "W".into(),
            d: 600.0,
            bf: 178.0,
            tf: 12.8,
            tw: 10.0,
            a: 10500.0,
            ix: 562000000.0,
            iy: 15200000.0,
            sx: 1873000.0,
            sy: 170000.0,
            rx: 231.0,
            ry: 38.1,
            weight: 81.9,
        },
        // HSS (Hollow Structural Sections)
        SteelSection {
            id: "HSS6x6x0.5".into(),
            name: "HSS 6×6×½".into(),
            standard: "aisc".into(),
            section_type: "HSS".into(),
            d: 152.0,
            bf: 152.0,
            tf: 12.7,
            tw: 12.7,
            a: 6840.0,
            ix: 23000000.0,
            iy: 23000000.0,
            sx: 302000.0,
            sy: 302000.0,
            rx: 58.0,
            ry: 58.0,
            weight: 53.7,
        },
        SteelSection {
            id: "HSS8x8x0.5".into(),
            name: "HSS 8×8×½".into(),
            standard: "aisc".into(),
            section_type: "HSS".into(),
            d: 203.0,
            bf: 203.0,
            tf: 12.7,
            tw: 12.7,
            a: 9290.0,
            ix: 57700000.0,
            iy: 57700000.0,
            sx: 568000.0,
            sy: 568000.0,
            rx: 78.8,
            ry: 78.8,
            weight: 72.9,
        },
        // ISMC Sections (Indian Standard Medium Channels)
        SteelSection {
            id: "ISMC100".into(),
            name: "ISMC 100".into(),
            standard: "is".into(),
            section_type: "ISMC".into(),
            d: 100.0,
            bf: 50.0,
            tf: 7.5,
            tw: 4.7,
            a: 1170.0,
            ix: 1870000.0,
            iy: 260000.0,
            sx: 37400.0,
            sy: 10400.0,
            rx: 40.0,
            ry: 14.9,
            weight: 9.2,
        },
        SteelSection {
            id: "ISMC150".into(),
            name: "ISMC 150".into(),
            standard: "is".into(),
            section_type: "ISMC".into(),
            d: 150.0,
            bf: 75.0,
            tf: 9.0,
            tw: 5.4,
            a: 2170.0,
            ix: 7790000.0,
            iy: 1030000.0,
            sx: 104000.0,
            sy: 27400.0,
            rx: 59.9,
            ry: 21.8,
            weight: 17.0,
        },
        SteelSection {
            id: "ISMC200".into(),
            name: "ISMC 200".into(),
            standard: "is".into(),
            section_type: "ISMC".into(),
            d: 200.0,
            bf: 75.0,
            tf: 11.4,
            tw: 6.1,
            a: 2830.0,
            ix: 18200000.0,
            iy: 1410000.0,
            sx: 182000.0,
            sy: 37600.0,
            rx: 80.2,
            ry: 22.3,
            weight: 22.2,
        },
        SteelSection {
            id: "ISMC250".into(),
            name: "ISMC 250".into(),
            standard: "is".into(),
            section_type: "ISMC".into(),
            d: 250.0,
            bf: 80.0,
            tf: 14.1,
            tw: 7.1,
            a: 3870.0,
            ix: 38100000.0,
            iy: 2020000.0,
            sx: 305000.0,
            sy: 50400.0,
            rx: 99.2,
            ry: 22.8,
            weight: 30.4,
        },
        SteelSection {
            id: "ISMC300".into(),
            name: "ISMC 300".into(),
            standard: "is".into(),
            section_type: "ISMC".into(),
            d: 300.0,
            bf: 90.0,
            tf: 13.6,
            tw: 7.6,
            a: 4640.0,
            ix: 63600000.0,
            iy: 3100000.0,
            sx: 424000.0,
            sy: 68800.0,
            rx: 117.0,
            ry: 25.8,
            weight: 36.3,
        },
    ]
}

#[derive(Debug, Serialize)]
pub struct SectionListResponse {
    pub success: bool,
    pub sections: Vec<SteelSection>,
    pub count: usize,
}

#[derive(Debug, Deserialize)]
pub struct ListSectionsParams {
    pub standard: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQueryParams {
    pub q: Option<String>,
    pub section_type: Option<String>,
}

/// GET /api/sections - List all sections (optionally filtered by ?standard=is|aisc|en|bs)
pub async fn list_sections(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<ListSectionsParams>,
) -> ApiResult<Json<SectionListResponse>> {
    let mut sections = get_section_database();
    if let Some(ref std_filter) = params.standard {
        sections.retain(|s| s.standard.eq_ignore_ascii_case(std_filter));
    }
    let count = sections.len();

    Ok(Json(SectionListResponse {
        success: true,
        sections,
        count,
    }))
}

/// GET /api/sections/search?q=...&section_type=... - Search sections via query params
pub async fn search_sections_get(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<SearchQueryParams>,
) -> ApiResult<Json<SectionListResponse>> {
    let sections = get_section_database();

    let filtered: Vec<SteelSection> = sections
        .into_iter()
        .filter(|s| {
            if let Some(ref q) = params.q {
                let q_lower = q.to_lowercase();
                if !s.id.to_lowercase().contains(&q_lower)
                    && !s.name.to_lowercase().contains(&q_lower)
                    && !s.section_type.to_lowercase().contains(&q_lower)
                {
                    return false;
                }
            }
            if let Some(ref st) = params.section_type {
                if !s.section_type.eq_ignore_ascii_case(st) {
                    return false;
                }
            }
            true
        })
        .collect();

    let count = filtered.len();

    Ok(Json(SectionListResponse {
        success: true,
        sections: filtered,
        count,
    }))
}

/// GET /api/sections/:id - Get section by ID
pub async fn get_section(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let sections = get_section_database();

    let section = sections
        .iter()
        .find(|s| s.id.to_lowercase() == id.to_lowercase())
        .cloned();

    match section {
        Some(s) => Ok(Json(serde_json::json!({
            "success": true,
            "section": s
        }))),
        None => Ok(Json(serde_json::json!({
            "success": false,
            "error": format!("Section '{}' not found", id)
        }))),
    }
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub query: Option<String>,
    pub section_type: Option<String>,
    pub min_depth: Option<f64>,
    pub max_depth: Option<f64>,
    pub min_area: Option<f64>,
}

/// POST /api/sections/search - Search sections
pub async fn search_sections(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SearchRequest>,
) -> ApiResult<Json<SectionListResponse>> {
    let sections = get_section_database();

    let filtered: Vec<SteelSection> = sections
        .into_iter()
        .filter(|s| {
            // Filter by query (name or ID)
            if let Some(ref q) = req.query {
                let q_lower = q.to_lowercase();
                if !s.id.to_lowercase().contains(&q_lower)
                    && !s.name.to_lowercase().contains(&q_lower)
                {
                    return false;
                }
            }
            // Filter by section type
            if let Some(ref st) = req.section_type {
                if !s.section_type.eq_ignore_ascii_case(st) {
                    return false;
                }
            }
            // Filter by depth range
            if let Some(min_d) = req.min_depth {
                if s.d < min_d {
                    return false;
                }
            }
            if let Some(max_d) = req.max_depth {
                if s.d > max_d {
                    return false;
                }
            }
            // Filter by minimum area
            if let Some(min_a) = req.min_area {
                if s.a < min_a {
                    return false;
                }
            }
            true
        })
        .collect();

    let count = filtered.len();

    Ok(Json(SectionListResponse {
        success: true,
        sections: filtered,
        count,
    }))
}
