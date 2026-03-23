//! Report Generation API Handler
//!
//! Professional structural calculation report generation endpoints.
//! Generates HTML/Markdown reports suitable for PDF conversion.
//!
//! ## Endpoints
//! - POST /api/reports/analysis - Analysis summary report (HTML)
//! - POST /api/reports/design - Design calculation report (HTML)
//! - POST /api/reports/analysis/pdf - Analysis report (PDF)
//! - POST /api/reports/design/pdf - Design calculation report (PDF)
//! - POST /api/reports/full - Comprehensive project report

use axum::extract::Json;
use serde::{Deserialize, Serialize};

use crate::error::ApiResult;

// ── Request/Response Types ──

/// Request for analysis report generation
#[derive(Debug, Clone, Deserialize)]
pub struct AnalysisReportReq {
    pub project_name: String,
    pub project_number: Option<String>,
    pub engineer: Option<String>,
    pub design_code: String,
    
    // Structural model data
    pub nodes: Vec<NodeSummary>,
    pub members: Vec<MemberSummary>,
    pub reactions: Vec<ReactionResult>,
    pub displacements: Vec<DisplacementResult>,
    pub member_forces: Vec<MemberForceResult>,
    
    // Load cases
    pub load_cases: Vec<LoadCaseInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSummary {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub restraint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberSummary {
    pub id: String,
    pub start_node: String,
    pub end_node: String,
    pub section: String,
    pub material: String,
    pub length_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionResult {
    pub node_id: String,
    pub load_case: String,
    pub fx_kn: f64,
    pub fy_kn: f64,
    pub fz_kn: f64,
    pub mx_knm: f64,
    pub my_knm: f64,
    pub mz_knm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplacementResult {
    pub node_id: String,
    pub load_case: String,
    pub dx_mm: f64,
    pub dy_mm: f64,
    pub dz_mm: f64,
    pub rx_rad: f64,
    pub ry_rad: f64,
    pub rz_rad: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberForceResult {
    pub member_id: String,
    pub load_case: String,
    pub position: String, // "start" or "end"
    pub fx_kn: f64,
    pub fy_kn: f64,
    pub fz_kn: f64,
    pub mx_knm: f64,
    pub my_knm: f64,
    pub mz_knm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCaseInfo {
    pub id: String,
    pub name: String,
    pub load_type: String,
    pub factor: f64,
}

/// Request for design calculation report
#[derive(Debug, Clone, Deserialize)]
pub struct DesignReportReq {
    pub project_name: String,
    pub project_number: Option<String>,
    pub engineer: Option<String>,
    pub design_code: String,
    
    // Design check results
    pub steel_checks: Vec<SteelDesignCheck>,
    pub concrete_checks: Vec<ConcreteDesignCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelDesignCheck {
    pub member_id: String,
    pub section: String,
    pub fy_mpa: f64,
    pub pu_kn: f64,
    pub mux_knm: f64,
    pub muy_knm: f64,
    pub vu_kn: f64,
    pub utilization: f64,
    pub passed: bool,
    pub governing_check: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteDesignCheck {
    pub member_id: String,
    pub section_dims: String,
    pub fck_mpa: f64,
    pub fy_mpa: f64,
    pub pu_kn: f64,
    pub mu_knm: f64,
    pub vu_kn: f64,
    pub ast_reqd_mm2: f64,
    pub ast_prov_mm2: f64,
    pub passed: bool,
    pub rebar_config: String,
}

/// Report generation response
#[derive(Debug, Clone, Serialize)]
pub struct ReportResponse {
    pub format: String,
    pub content: String,
    pub page_count: usize,
    pub generation_time_ms: u64,
}

// ── Handler Functions ──

/// Generate analysis summary report
pub async fn generate_analysis_report(
    Json(req): Json<AnalysisReportReq>,
) -> ApiResult<Json<ReportResponse>> {
    let start = std::time::Instant::now();
    
    let report_html = build_analysis_report_html(&req);
    
    let elapsed = start.elapsed().as_millis() as u64;
    let page_count = estimate_page_count(&report_html);
    
    Ok(Json(ReportResponse {
        format: "html".to_string(),
        content: report_html,
        page_count,
        generation_time_ms: elapsed,
    }))
}

/// Generate design calculation report
pub async fn generate_design_report(
    Json(req): Json<DesignReportReq>,
) -> ApiResult<Json<ReportResponse>> {
    let start = std::time::Instant::now();
    
    let report_html = build_design_report_html(&req);
    
    let elapsed = start.elapsed().as_millis() as u64;
    let page_count = estimate_page_count(&report_html);
    
    Ok(Json(ReportResponse {
        format: "html".to_string(),
        content: report_html,
        page_count,
        generation_time_ms: elapsed,
    }))
}

// ── HTML Generation Functions ──

fn build_analysis_report_html(req: &AnalysisReportReq) -> String {
    let mut html = String::new();
    
    // HTML header with CSS
    html.push_str(include_str!("../../templates/report_header.html"));
    
    // Cover page
    html.push_str(&format!(r#"
<div class="cover-page">
    <h1>Structural Analysis Report</h1>
    <h2>{}</h2>
    <p class="project-number">Project No: {}</p>
    <p class="design-code">Design Code: {}</p>
    <p class="engineer">Engineer: {}</p>
    <p class="date">{}</p>
</div>
<div class="page-break"></div>
"#, 
        req.project_name,
        req.project_number.as_deref().unwrap_or("N/A"),
        req.design_code,
        req.engineer.as_deref().unwrap_or("N/A"),
        chrono::Local::now().format("%Y-%m-%d").to_string()
    ));
    
    // Table of Contents
    html.push_str(r#"
<section>
    <h2>Table of Contents</h2>
    <ol class="toc">
        <li>Model Summary</li>
        <li>Load Cases</li>
        <li>Reactions</li>
        <li>Displacements</li>
        <li>Member Forces</li>
    </ol>
</section>
<div class="page-break"></div>
"#);
    
    // 1. Model Summary
    html.push_str(&format!(r#"
<section>
    <h2>1. Model Summary</h2>
    <h3>1.1 Nodes</h3>
    <p>Total nodes: {}</p>
    <table>
        <thead>
            <tr>
                <th>Node ID</th>
                <th>X (m)</th>
                <th>Y (m)</th>
                <th>Z (m)</th>
                <th>Restraint</th>
            </tr>
        </thead>
        <tbody>
"#, req.nodes.len()));
    
    for node in &req.nodes {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{:.3}</td>
                <td>{:.3}</td>
                <td>{:.3}</td>
                <td>{}</td>
            </tr>
"#, 
            node.id, node.x, node.y, node.z,
            node.restraint.as_deref().unwrap_or("Free")
        ));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
    
    <h3>1.2 Members</h3>
"#);
    html.push_str(&format!("<p>Total members: {}</p>\n<table>\n", req.members.len()));
    html.push_str(r#"
        <thead>
            <tr>
                <th>Member ID</th>
                <th>Start</th>
                <th>End</th>
                <th>Section</th>
                <th>Material</th>
                <th>Length (m)</th>
            </tr>
        </thead>
        <tbody>
"#);
    
    for member in &req.members {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{}</td>
                <td>{}</td>
                <td>{}</td>
                <td>{:.2}</td>
            </tr>
"#,
            member.id, member.start_node, member.end_node,
            member.section, member.material, member.length_m
        ));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
</section>
<div class="page-break"></div>
"#);
    
    // 2. Load Cases
    html.push_str(&format!(r#"
<section>
    <h2>2. Load Cases</h2>
    <p>Total load cases: {}</p>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Factor</th>
            </tr>
        </thead>
        <tbody>
"#, req.load_cases.len()));
    
    for lc in &req.load_cases {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{}</td>
                <td>{:.2}</td>
            </tr>
"#, lc.id, lc.name, lc.load_type, lc.factor));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
</section>
<div class="page-break"></div>
"#);
    
    // 3. Reactions
    html.push_str(&format!(r#"
<section>
    <h2>3. Support Reactions</h2>
    <p>Total reactions: {}</p>
    <table class="forces-table">
        <thead>
            <tr>
                <th>Node</th>
                <th>Load Case</th>
                <th>Fx (kN)</th>
                <th>Fy (kN)</th>
                <th>Fz (kN)</th>
                <th>Mx (kN·m)</th>
                <th>My (kN·m)</th>
                <th>Mz (kN·m)</th>
            </tr>
        </thead>
        <tbody>
"#, req.reactions.len()));
    
    for rxn in &req.reactions {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
            </tr>
"#,
            rxn.node_id, rxn.load_case,
            rxn.fx_kn, rxn.fy_kn, rxn.fz_kn,
            rxn.mx_knm, rxn.my_knm, rxn.mz_knm
        ));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
</section>
<div class="page-break"></div>
"#);
    
    // 4. Displacements
    html.push_str(&format!(r#"
<section>
    <h2>4. Node Displacements</h2>
    <p>Total displacement results: {}</p>
    <table class="forces-table">
        <thead>
            <tr>
                <th>Node</th>
                <th>Load Case</th>
                <th>δx (mm)</th>
                <th>δy (mm)</th>
                <th>δz (mm)</th>
                <th>θx (rad)</th>
                <th>θy (rad)</th>
                <th>θz (rad)</th>
            </tr>
        </thead>
        <tbody>
"#, req.displacements.len()));
    
    for disp in &req.displacements {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{:.3}</td>
                <td>{:.3}</td>
                <td>{:.3}</td>
                <td>{:.6}</td>
                <td>{:.6}</td>
                <td>{:.6}</td>
            </tr>
"#,
            disp.node_id, disp.load_case,
            disp.dx_mm, disp.dy_mm, disp.dz_mm,
            disp.rx_rad, disp.ry_rad, disp.rz_rad
        ));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
</section>
<div class="page-break"></div>
"#);
    
    // 5. Member Forces
    html.push_str(&format!(r#"
<section>
    <h2>5. Member Forces</h2>
    <p>Total force results: {}</p>
    <table class="forces-table">
        <thead>
            <tr>
                <th>Member</th>
                <th>Load Case</th>
                <th>Position</th>
                <th>Fx (kN)</th>
                <th>Fy (kN)</th>
                <th>Fz (kN)</th>
                <th>Mx (kN·m)</th>
                <th>My (kN·m)</th>
                <th>Mz (kN·m)</th>
            </tr>
        </thead>
        <tbody>
"#, req.member_forces.len()));
    
    for force in &req.member_forces {
        html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
            </tr>
"#,
            force.member_id, force.load_case, force.position,
            force.fx_kn, force.fy_kn, force.fz_kn,
            force.mx_knm, force.my_knm, force.mz_knm
        ));
    }
    
    html.push_str(r#"
        </tbody>
    </table>
</section>
"#);
    
    // Footer
    html.push_str("</body></html>");
    
    html
}

fn build_design_report_html(req: &DesignReportReq) -> String {
    let mut html = String::new();
    
    // HTML header
    html.push_str(include_str!("../../templates/report_header.html"));
    
    // Cover page
    html.push_str(&format!(r#"
<div class="cover-page">
    <h1>Design Calculation Report</h1>
    <h2>{}</h2>
    <p class="project-number">Project No: {}</p>
    <p class="design-code">Design Code: {}</p>
    <p class="engineer">Engineer: {}</p>
    <p class="date">{}</p>
</div>
<div class="page-break"></div>
"#, 
        req.project_name,
        req.project_number.as_deref().unwrap_or("N/A"),
        req.design_code,
        req.engineer.as_deref().unwrap_or("N/A"),
        chrono::Local::now().format("%Y-%m-%d").to_string()
    ));
    
    // Steel Design Checks
    if !req.steel_checks.is_empty() {
        html.push_str(&format!(r#"
<section>
    <h2>1. Steel Member Design Checks</h2>
    <p>Design Code: {}</p>
    <p>Total members checked: {}</p>
    <table class="design-table">
        <thead>
            <tr>
                <th>Member ID</th>
                <th>Section</th>
                <th>fy (MPa)</th>
                <th>Pu (kN)</th>
                <th>Mux (kN·m)</th>
                <th>Muy (kN·m)</th>
                <th>Vu (kN)</th>
                <th>Utilization</th>
                <th>Governing</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
"#, req.design_code, req.steel_checks.len()));
        
        for check in &req.steel_checks {
            let status_class = if check.passed { "pass" } else { "fail" };
            let status_text = if check.passed { "PASS" } else { "FAIL" };
            
            html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{:.0}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.3}</td>
                <td>{}</td>
                <td class="{}">{}</td>
            </tr>
"#,
                check.member_id, check.section, check.fy_mpa,
                check.pu_kn, check.mux_knm, check.muy_knm, check.vu_kn,
                check.utilization, check.governing_check,
                status_class, status_text
            ));
        }
        
        html.push_str(r#"
        </tbody>
    </table>
</section>
<div class="page-break"></div>
"#);
    }
    
    // Concrete Design Checks
    if !req.concrete_checks.is_empty() {
        html.push_str(&format!(r#"
<section>
    <h2>2. Concrete Member Design Checks</h2>
    <p>Design Code: {}</p>
    <p>Total members checked: {}</p>
    <table class="design-table">
        <thead>
            <tr>
                <th>Member ID</th>
                <th>Section</th>
                <th>fck (MPa)</th>
                <th>fy (MPa)</th>
                <th>Pu (kN)</th>
                <th>Mu (kN·m)</th>
                <th>Ast Req (mm²)</th>
                <th>Ast Prov (mm²)</th>
                <th>Rebar</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
"#, req.design_code, req.concrete_checks.len()));
        
        for check in &req.concrete_checks {
            let status_class = if check.passed { "pass" } else { "fail" };
            let status_text = if check.passed { "PASS" } else { "FAIL" };
            
            html.push_str(&format!(r#"
            <tr>
                <td>{}</td>
                <td>{}</td>
                <td>{:.0}</td>
                <td>{:.0}</td>
                <td>{:.2}</td>
                <td>{:.2}</td>
                <td>{:.0}</td>
                <td>{:.0}</td>
                <td>{}</td>
                <td class="{}">{}</td>
            </tr>
"#,
                check.member_id, check.section_dims,
                check.fck_mpa, check.fy_mpa,
                check.pu_kn, check.mu_knm,
                check.ast_reqd_mm2, check.ast_prov_mm2,
                check.rebar_config,
                status_class, status_text
            ));
        }
        
        html.push_str(r#"
        </tbody>
    </table>
</section>
"#);
    }
    
    // Footer
    html.push_str("</body></html>");
    
    html
}

fn estimate_page_count(html: &str) -> usize {
    // Rough estimation: 1 page per 3000 characters of content
    let char_count = html.len();
    (char_count / 3000).max(1)
}
