//! # Report Generation Module
//! 
//! Professional engineering report generation matching STAAD.Pro output quality.
//! 
//! ## Output Formats
//! - **HTML** - Interactive with charts and collapsible sections
//! - **PDF** - Print-ready via HTML conversion
//! - **CSV/Excel** - Tabular data export
//! - **JSON** - API-friendly structured data
//! 
//! ## Report Types
//! - Analysis Summary Report
//! - Design Check Report
//! - Load Case Summary
//! - Reaction Report
//! - Displacement Report
//! - Member Force Report
//! - Section Property Report

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// REPORT DATA STRUCTURES
// ============================================================================

/// Report header information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportHeader {
    /// Project name
    pub project_name: String,
    /// Project number
    pub project_number: String,
    /// Client name
    pub client: String,
    /// Engineer name
    pub engineer: String,
    /// Checker name
    pub checker: String,
    /// Date
    pub date: String,
    /// Revision number
    pub revision: String,
    /// Company name
    pub company: String,
    /// Company logo (base64 or URL)
    pub logo: Option<String>,
}

impl Default for ReportHeader {
    fn default() -> Self {
        Self {
            project_name: "Untitled Project".to_string(),
            project_number: "".to_string(),
            client: "".to_string(),
            engineer: "".to_string(),
            checker: "".to_string(),
            date: chrono_date(),
            revision: "0".to_string(),
            company: "".to_string(),
            logo: None,
        }
    }
}

fn chrono_date() -> String {
    // Simplified date - in production use chrono crate
    "2024-01-15".to_string()
}

/// Node data for reports
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub support_type: Option<String>,
}

/// Member data for reports
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberData {
    pub id: usize,
    pub start_node: usize,
    pub end_node: usize,
    pub section: String,
    pub material: String,
    pub length: f64,
}

/// Load case definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCaseData {
    pub id: usize,
    pub name: String,
    pub load_type: String,
    pub factor: f64,
}

/// Reaction data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReactionData {
    pub node_id: usize,
    pub load_case: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
}

/// Displacement data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplacementData {
    pub node_id: usize,
    pub load_case: String,
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
    pub rx: f64,
    pub ry: f64,
    pub rz: f64,
}

/// Member force data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberForceData {
    pub member_id: usize,
    pub load_case: String,
    pub position: f64, // 0.0-1.0 along member
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub moment_y: f64,
    pub moment_z: f64,
    pub torsion: f64,
}

/// Design check result for reports
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCheckData {
    pub member_id: usize,
    pub check_type: String,
    pub demand: f64,
    pub capacity: f64,
    pub ratio: f64,
    pub status: String,
    pub governing_case: String,
    pub clause: String,
}

// ============================================================================
// REPORT SECTIONS
// ============================================================================

/// Report section type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReportSection {
    /// Model geometry summary
    GeometrySummary {
        node_count: usize,
        member_count: usize,
        support_count: usize,
        nodes: Vec<NodeData>,
        members: Vec<MemberData>,
    },
    /// Load cases and combinations
    LoadSummary {
        load_cases: Vec<LoadCaseData>,
        combinations: Vec<(String, Vec<(String, f64)>)>,
    },
    /// Support reactions
    Reactions {
        data: Vec<ReactionData>,
        max_reactions: HashMap<String, f64>,
    },
    /// Node displacements
    Displacements {
        data: Vec<DisplacementData>,
        max_displacements: HashMap<String, f64>,
    },
    /// Member forces
    MemberForces {
        data: Vec<MemberForceData>,
        envelope: Option<Vec<MemberForceData>>,
    },
    /// Design check results
    DesignChecks {
        code: String,
        checks: Vec<DesignCheckData>,
        summary: DesignSummaryStats,
    },
    /// Modal analysis results
    ModalAnalysis {
        modes: Vec<ModeData>,
        total_mass: f64,
        participation: Vec<f64>,
    },
    /// Custom text section
    TextSection {
        title: String,
        content: String,
    },
    /// Table section
    TableSection {
        title: String,
        headers: Vec<String>,
        rows: Vec<Vec<String>>,
    },
}

/// Mode data for modal analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModeData {
    pub mode_number: usize,
    pub frequency: f64,
    pub period: f64,
    pub participation_x: f64,
    pub participation_y: f64,
    pub participation_z: f64,
}

/// Design summary statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DesignSummaryStats {
    pub total_members: usize,
    pub passed: usize,
    pub failed: usize,
    pub max_ratio: f64,
    pub critical_member: usize,
    pub avg_ratio: f64,
}

// ============================================================================
// REPORT BUILDER
// ============================================================================

/// Report format
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ReportFormat {
    Html,
    Pdf,
    Csv,
    Json,
    Markdown,
}

/// Report builder
pub struct ReportBuilder {
    header: ReportHeader,
    sections: Vec<ReportSection>,
    format: ReportFormat,
}

impl ReportBuilder {
    pub fn new() -> Self {
        Self {
            header: ReportHeader::default(),
            sections: Vec::new(),
            format: ReportFormat::Html,
        }
    }
    
    pub fn with_header(mut self, header: ReportHeader) -> Self {
        self.header = header;
        self
    }
    
    pub fn with_format(mut self, format: ReportFormat) -> Self {
        self.format = format;
        self
    }
    
    pub fn add_section(mut self, section: ReportSection) -> Self {
        self.sections.push(section);
        self
    }
    
    /// Generate the report
    pub fn generate(&self) -> String {
        match self.format {
            ReportFormat::Html => self.generate_html(),
            ReportFormat::Markdown => self.generate_markdown(),
            ReportFormat::Json => self.generate_json(),
            ReportFormat::Csv => self.generate_csv(),
            ReportFormat::Pdf => self.generate_html(), // PDF via HTML
        }
    }
    
    /// Generate HTML report
    fn generate_html(&self) -> String {
        let mut html = String::new();
        
        // HTML header
        html.push_str(&format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{} - Structural Analysis Report</title>
    <style>
        :root {{
            --primary: #2563eb;
            --success: #16a34a;
            --danger: #dc2626;
            --warning: #d97706;
            --gray: #6b7280;
        }}
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }}
        h1 {{ color: var(--primary); border-bottom: 3px solid var(--primary); padding-bottom: 0.5rem; margin-bottom: 1rem; }}
        h2 {{ color: #374151; margin: 2rem 0 1rem; border-left: 4px solid var(--primary); padding-left: 1rem; }}
        h3 {{ color: #4b5563; margin: 1.5rem 0 0.5rem; }}
        table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 0.5rem; text-align: left; }}
        th {{ background: #f3f4f6; font-weight: 600; }}
        tr:nth-child(even) {{ background: #f9fafb; }}
        tr:hover {{ background: #eff6ff; }}
        .header-info {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; padding: 1rem; background: #f9fafb; border-radius: 8px; }}
        .header-info div {{ display: flex; flex-direction: column; }}
        .header-info label {{ font-size: 0.75rem; color: var(--gray); text-transform: uppercase; }}
        .header-info span {{ font-weight: 500; }}
        .status-pass {{ color: var(--success); font-weight: 600; }}
        .status-fail {{ color: var(--danger); font-weight: 600; }}
        .status-warning {{ color: var(--warning); font-weight: 600; }}
        .ratio-bar {{ width: 100px; height: 20px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }}
        .ratio-fill {{ height: 100%; transition: width 0.3s; }}
        .ratio-ok {{ background: var(--success); }}
        .ratio-warn {{ background: var(--warning); }}
        .ratio-fail {{ background: var(--danger); }}
        .summary-card {{ display: inline-block; padding: 1rem; margin: 0.5rem; background: #f9fafb; border-radius: 8px; text-align: center; min-width: 120px; }}
        .summary-card .value {{ font-size: 2rem; font-weight: bold; color: var(--primary); }}
        .summary-card .label {{ font-size: 0.8rem; color: var(--gray); }}
        .collapsible {{ cursor: pointer; user-select: none; }}
        .collapsible::before {{ content: '▶ '; }}
        .collapsible.active::before {{ content: '▼ '; }}
        .content {{ display: none; overflow: hidden; }}
        .content.show {{ display: block; }}
        @media print {{
            body {{ padding: 0; }}
            .content {{ display: block !important; }}
        }}
    </style>
</head>
<body>
"#, self.header.project_name));
        
        // Report title and header
        html.push_str(&format!(r#"
    <h1>{}</h1>
    <div class="header-info">
        <div><label>Project No.</label><span>{}</span></div>
        <div><label>Client</label><span>{}</span></div>
        <div><label>Engineer</label><span>{}</span></div>
        <div><label>Checker</label><span>{}</span></div>
        <div><label>Date</label><span>{}</span></div>
        <div><label>Revision</label><span>{}</span></div>
    </div>
"#, 
            self.header.project_name,
            self.header.project_number,
            self.header.client,
            self.header.engineer,
            self.header.checker,
            self.header.date,
            self.header.revision
        ));
        
        // Generate sections
        for (i, section) in self.sections.iter().enumerate() {
            html.push_str(&self.section_to_html(section, i));
        }
        
        // Footer with JavaScript for collapsibles
        html.push_str(r#"
    <script>
        document.querySelectorAll('.collapsible').forEach(item => {
            item.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                content.classList.toggle('show');
            });
        });
    </script>
</body>
</html>
"#);
        
        html
    }
    
    /// Convert section to HTML
    fn section_to_html(&self, section: &ReportSection, _index: usize) -> String {
        match section {
            ReportSection::GeometrySummary { node_count, member_count, support_count, nodes, members } => {
                let mut html = format!(r#"
    <h2 class="collapsible">1. Model Geometry Summary</h2>
    <div class="content show">
        <div class="summary-card"><div class="value">{}</div><div class="label">Nodes</div></div>
        <div class="summary-card"><div class="value">{}</div><div class="label">Members</div></div>
        <div class="summary-card"><div class="value">{}</div><div class="label">Supports</div></div>
        
        <h3>Node Coordinates</h3>
        <table>
            <tr><th>Node</th><th>X (m)</th><th>Y (m)</th><th>Z (m)</th><th>Support</th></tr>
"#, node_count, member_count, support_count);
                
                for node in nodes.iter().take(50) {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{:.3}</td><td>{:.3}</td><td>{:.3}</td><td>{}</td></tr>\n",
                        node.id, node.x, node.y, node.z,
                        node.support_type.as_deref().unwrap_or("-")
                    ));
                }
                if nodes.len() > 50 {
                    html.push_str(&format!("<tr><td colspan='5'>... and {} more nodes</td></tr>\n", nodes.len() - 50));
                }
                
                html.push_str("</table>\n<h3>Member Connectivity</h3>\n<table>\n<tr><th>Member</th><th>Start</th><th>End</th><th>Section</th><th>Length (m)</th></tr>\n");
                
                for mem in members.iter().take(50) {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{:.3}</td></tr>\n",
                        mem.id, mem.start_node, mem.end_node, mem.section, mem.length
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::Reactions { data, max_reactions } => {
                let mut html = String::from(r#"
    <h2 class="collapsible">Support Reactions</h2>
    <div class="content show">
        <h3>Maximum Reactions</h3>
        <table>
            <tr><th>Component</th><th>Maximum Value</th></tr>
"#);
                
                for (comp, val) in max_reactions {
                    html.push_str(&format!("<tr><td>{}</td><td>{:.2}</td></tr>\n", comp, val));
                }
                
                html.push_str("</table>\n<h3>Detailed Reactions</h3>\n<table>\n<tr><th>Node</th><th>Load Case</th><th>Fx (kN)</th><th>Fy (kN)</th><th>Fz (kN)</th><th>Mx (kN-m)</th><th>My (kN-m)</th><th>Mz (kN-m)</th></tr>\n");
                
                for r in data.iter().take(100) {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td></tr>\n",
                        r.node_id, r.load_case, r.fx, r.fy, r.fz, r.mx, r.my, r.mz
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::Displacements { data, max_displacements } => {
                let mut html = String::from(r#"
    <h2 class="collapsible">Node Displacements</h2>
    <div class="content">
        <h3>Maximum Displacements</h3>
        <table>
            <tr><th>Component</th><th>Maximum Value</th></tr>
"#);
                
                for (comp, val) in max_displacements {
                    html.push_str(&format!("<tr><td>{}</td><td>{:.4}</td></tr>\n", comp, val));
                }
                
                html.push_str("</table>\n<h3>Detailed Displacements</h3>\n<table>\n<tr><th>Node</th><th>Load Case</th><th>dx (mm)</th><th>dy (mm)</th><th>dz (mm)</th><th>rx (rad)</th><th>ry (rad)</th><th>rz (rad)</th></tr>\n");
                
                for d in data.iter().take(100) {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{:.4}</td><td>{:.4}</td><td>{:.4}</td><td>{:.6}</td><td>{:.6}</td><td>{:.6}</td></tr>\n",
                        d.node_id, d.load_case, d.dx * 1000.0, d.dy * 1000.0, d.dz * 1000.0, d.rx, d.ry, d.rz
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::MemberForces { data, envelope: _ } => {
                let mut html = String::from(r#"
    <h2 class="collapsible">Member Forces</h2>
    <div class="content">
        <table>
            <tr><th>Member</th><th>Load Case</th><th>Position</th><th>Axial (kN)</th><th>Shear Y (kN)</th><th>Shear Z (kN)</th><th>Moment Y (kN-m)</th><th>Moment Z (kN-m)</th><th>Torsion (kN-m)</th></tr>
"#);
                
                for f in data.iter().take(200) {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td></tr>\n",
                        f.member_id, f.load_case, f.position, f.axial, f.shear_y, f.shear_z, f.moment_y, f.moment_z, f.torsion
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::DesignChecks { code, checks, summary } => {
                let mut html = format!(r#"
    <h2 class="collapsible">Design Checks - {}</h2>
    <div class="content show">
        <h3>Summary</h3>
        <div class="summary-card"><div class="value">{}</div><div class="label">Total Members</div></div>
        <div class="summary-card"><div class="value status-pass">{}</div><div class="label">Passed</div></div>
        <div class="summary-card"><div class="value status-fail">{}</div><div class="label">Failed</div></div>
        <div class="summary-card"><div class="value">{:.2}%</div><div class="label">Pass Rate</div></div>
        <div class="summary-card"><div class="value">{:.3}</div><div class="label">Max Ratio</div></div>
        
        <h3>Detailed Checks</h3>
        <table>
            <tr><th>Member</th><th>Check Type</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th>Status</th><th>Governing Case</th><th>Clause</th></tr>
"#, code, summary.total_members, summary.passed, summary.failed, 
    (summary.passed as f64 / summary.total_members.max(1) as f64) * 100.0, summary.max_ratio);
                
                for c in checks {
                    let status_class = match c.status.as_str() {
                        "Pass" => "status-pass",
                        "Fail" => "status-fail",
                        _ => "status-warning",
                    };
                    
                    let bar_class = if c.ratio <= 0.8 {
                        "ratio-ok"
                    } else if c.ratio <= 1.0 {
                        "ratio-warn"
                    } else {
                        "ratio-fail"
                    };
                    
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{:.2}</td><td>{:.2}</td><td><div class='ratio-bar'><div class='ratio-fill {}' style='width: {}%;'></div></div>{:.3}</td><td class='{}'>{}</td><td>{}</td><td>{}</td></tr>\n",
                        c.member_id, c.check_type, c.demand, c.capacity,
                        bar_class, (c.ratio * 100.0).min(100.0), c.ratio,
                        status_class, c.status, c.governing_case, c.clause
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::ModalAnalysis { modes, total_mass, participation: _ } => {
                let mut html = format!(r#"
    <h2 class="collapsible">Modal Analysis Results</h2>
    <div class="content">
        <p>Total Mass: {:.2} kg</p>
        <table>
            <tr><th>Mode</th><th>Frequency (Hz)</th><th>Period (s)</th><th>Mass Part. X (%)</th><th>Mass Part. Y (%)</th><th>Mass Part. Z (%)</th></tr>
"#, total_mass);
                
                for m in modes {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{:.3}</td><td>{:.4}</td><td>{:.2}</td><td>{:.2}</td><td>{:.2}</td></tr>\n",
                        m.mode_number, m.frequency, m.period, 
                        m.participation_x * 100.0, m.participation_y * 100.0, m.participation_z * 100.0
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::TextSection { title, content } => {
                format!("<h2>{}</h2>\n<div class='content show'><p>{}</p></div>\n", title, content)
            }
            
            ReportSection::TableSection { title, headers, rows } => {
                let mut html = format!("<h2>{}</h2>\n<div class='content'>\n<table>\n<tr>", title);
                for h in headers {
                    html.push_str(&format!("<th>{}</th>", h));
                }
                html.push_str("</tr>\n");
                
                for row in rows {
                    html.push_str("<tr>");
                    for cell in row {
                        html.push_str(&format!("<td>{}</td>", cell));
                    }
                    html.push_str("</tr>\n");
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
            
            ReportSection::LoadSummary { load_cases, combinations } => {
                let mut html = String::from(r#"
    <h2 class="collapsible">Load Cases and Combinations</h2>
    <div class="content">
        <h3>Load Cases</h3>
        <table>
            <tr><th>ID</th><th>Name</th><th>Type</th><th>Factor</th></tr>
"#);
                
                for lc in load_cases {
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td><td>{}</td><td>{:.2}</td></tr>\n",
                        lc.id, lc.name, lc.load_type, lc.factor
                    ));
                }
                
                html.push_str("</table>\n<h3>Load Combinations</h3>\n<table>\n<tr><th>Combination</th><th>Components</th></tr>\n");
                
                for (name, factors) in combinations {
                    let components: Vec<String> = factors.iter()
                        .map(|(lc, f)| format!("{:.2}×{}", f, lc))
                        .collect();
                    html.push_str(&format!(
                        "<tr><td>{}</td><td>{}</td></tr>\n",
                        name, components.join(" + ")
                    ));
                }
                
                html.push_str("</table>\n</div>\n");
                html
            }
        }
    }
    
    /// Generate Markdown report
    fn generate_markdown(&self) -> String {
        let mut md = String::new();
        
        md.push_str(&format!("# {}\n\n", self.header.project_name));
        md.push_str("## Project Information\n\n");
        md.push_str(&format!("| Field | Value |\n|-------|-------|\n"));
        md.push_str(&format!("| Project No. | {} |\n", self.header.project_number));
        md.push_str(&format!("| Client | {} |\n", self.header.client));
        md.push_str(&format!("| Engineer | {} |\n", self.header.engineer));
        md.push_str(&format!("| Date | {} |\n", self.header.date));
        md.push_str(&format!("| Revision | {} |\n\n", self.header.revision));
        
        for section in &self.sections {
            md.push_str(&self.section_to_markdown(section));
        }
        
        md
    }
    
    fn section_to_markdown(&self, section: &ReportSection) -> String {
        match section {
            ReportSection::GeometrySummary { node_count, member_count, support_count, .. } => {
                format!(
                    "## Model Summary\n\n- Nodes: {}\n- Members: {}\n- Supports: {}\n\n",
                    node_count, member_count, support_count
                )
            }
            ReportSection::DesignChecks { code, checks, summary } => {
                let mut md = format!("## Design Checks - {}\n\n", code);
                md.push_str(&format!("**Summary:** {} passed, {} failed, Max ratio: {:.3}\n\n", 
                    summary.passed, summary.failed, summary.max_ratio));
                
                md.push_str("| Member | Check | Ratio | Status |\n|--------|-------|-------|--------|\n");
                for c in checks.iter().take(20) {
                    md.push_str(&format!("| {} | {} | {:.3} | {} |\n", 
                        c.member_id, c.check_type, c.ratio, c.status));
                }
                md.push_str("\n");
                md
            }
            _ => String::new(),
        }
    }
    
    /// Generate JSON report
    fn generate_json(&self) -> String {
        #[derive(Serialize)]
        struct JsonReport<'a> {
            header: &'a ReportHeader,
            sections: &'a Vec<ReportSection>,
        }
        
        let report = JsonReport {
            header: &self.header,
            sections: &self.sections,
        };
        
        serde_json::to_string_pretty(&report).unwrap_or_default()
    }
    
    /// Generate CSV report (design checks only)
    fn generate_csv(&self) -> String {
        let mut csv = String::new();
        
        for section in &self.sections {
            if let ReportSection::DesignChecks { checks, .. } = section {
                csv.push_str("Member,Check Type,Demand,Capacity,Ratio,Status,Governing Case,Clause\n");
                for c in checks {
                    csv.push_str(&format!(
                        "{},{},{:.4},{:.4},{:.4},{},{},{}\n",
                        c.member_id, c.check_type, c.demand, c.capacity, 
                        c.ratio, c.status, c.governing_case, c.clause
                    ));
                }
            }
        }
        
        csv
    }
}

impl Default for ReportBuilder {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// QUICK REPORT GENERATORS
// ============================================================================

/// Generate a quick analysis summary report
pub fn generate_analysis_summary(
    project_name: &str,
    nodes: Vec<NodeData>,
    members: Vec<MemberData>,
    reactions: Vec<ReactionData>,
    displacements: Vec<DisplacementData>,
) -> String {
    let node_count = nodes.len();
    let member_count = members.len();
    let support_count = nodes.iter().filter(|n| n.support_type.is_some()).count();
    
    // Calculate max reactions
    let mut max_reactions = HashMap::new();
    for r in &reactions {
        let update = |map: &mut HashMap<String, f64>, key: &str, val: f64| {
            let entry = map.entry(key.to_string()).or_insert(0.0);
            if val.abs() > entry.abs() {
                *entry = val;
            }
        };
        update(&mut max_reactions, "Fx (kN)", r.fx);
        update(&mut max_reactions, "Fy (kN)", r.fy);
        update(&mut max_reactions, "Fz (kN)", r.fz);
        update(&mut max_reactions, "Mx (kN-m)", r.mx);
        update(&mut max_reactions, "My (kN-m)", r.my);
        update(&mut max_reactions, "Mz (kN-m)", r.mz);
    }
    
    // Calculate max displacements
    let mut max_displacements = HashMap::new();
    for d in &displacements {
        let update = |map: &mut HashMap<String, f64>, key: &str, val: f64| {
            let entry = map.entry(key.to_string()).or_insert(0.0);
            if val.abs() > entry.abs() {
                *entry = val;
            }
        };
        update(&mut max_displacements, "dx (mm)", d.dx * 1000.0);
        update(&mut max_displacements, "dy (mm)", d.dy * 1000.0);
        update(&mut max_displacements, "dz (mm)", d.dz * 1000.0);
    }
    
    ReportBuilder::new()
        .with_header(ReportHeader {
            project_name: project_name.to_string(),
            ..Default::default()
        })
        .add_section(ReportSection::GeometrySummary {
            node_count,
            member_count,
            support_count,
            nodes,
            members,
        })
        .add_section(ReportSection::Reactions {
            data: reactions,
            max_reactions,
        })
        .add_section(ReportSection::Displacements {
            data: displacements,
            max_displacements,
        })
        .generate()
}

/// Generate a design check report
pub fn generate_design_report(
    project_name: &str,
    code: &str,
    checks: Vec<DesignCheckData>,
) -> String {
    let total = checks.len();
    let passed = checks.iter().filter(|c| c.status == "Pass").count();
    let failed = total - passed;
    let max_ratio = checks.iter().map(|c| c.ratio).fold(0.0, f64::max);
    let avg_ratio = checks.iter().map(|c| c.ratio).sum::<f64>() / total.max(1) as f64;
    let critical = checks.iter()
        .max_by(|a, b| a.ratio.partial_cmp(&b.ratio).unwrap())
        .map(|c| c.member_id)
        .unwrap_or(0);
    
    let summary = DesignSummaryStats {
        total_members: total,
        passed,
        failed,
        max_ratio,
        critical_member: critical,
        avg_ratio,
    };
    
    ReportBuilder::new()
        .with_header(ReportHeader {
            project_name: project_name.to_string(),
            ..Default::default()
        })
        .add_section(ReportSection::DesignChecks {
            code: code.to_string(),
            checks,
            summary,
        })
        .generate()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_report_header() {
        let header = ReportHeader::default();
        assert!(!header.project_name.is_empty());
        assert!(!header.date.is_empty());
    }
    
    #[test]
    fn test_geometry_section_html() {
        let nodes = vec![
            NodeData { id: 1, x: 0.0, y: 0.0, z: 0.0, support_type: Some("Fixed".to_string()) },
            NodeData { id: 2, x: 5.0, y: 0.0, z: 0.0, support_type: None },
            NodeData { id: 3, x: 5.0, y: 3.0, z: 0.0, support_type: None },
        ];
        
        let members = vec![
            MemberData { id: 1, start_node: 1, end_node: 2, section: "ISMB 400".to_string(), material: "Fe 250".to_string(), length: 5.0 },
            MemberData { id: 2, start_node: 2, end_node: 3, section: "ISMB 300".to_string(), material: "Fe 250".to_string(), length: 3.0 },
        ];
        
        let html = ReportBuilder::new()
            .add_section(ReportSection::GeometrySummary {
                node_count: 3,
                member_count: 2,
                support_count: 1,
                nodes,
                members,
            })
            .generate();
        
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("Model Geometry Summary"));
        assert!(html.contains("ISMB 400"));
    }
    
    #[test]
    fn test_design_checks_section() {
        let checks = vec![
            DesignCheckData {
                member_id: 1,
                check_type: "Tension".to_string(),
                demand: 400.0,
                capacity: 800.0,
                ratio: 0.5,
                status: "Pass".to_string(),
                governing_case: "LC1".to_string(),
                clause: "IS 800 Cl. 6.2".to_string(),
            },
            DesignCheckData {
                member_id: 2,
                check_type: "Compression".to_string(),
                demand: 600.0,
                capacity: 500.0,
                ratio: 1.2,
                status: "Fail".to_string(),
                governing_case: "LC2".to_string(),
                clause: "IS 800 Cl. 7.1".to_string(),
            },
        ];
        
        let html = generate_design_report("Test Project", "IS 800:2007", checks);
        
        assert!(html.contains("Design Checks"));
        assert!(html.contains("IS 800:2007"));
        assert!(html.contains("status-pass"));
        assert!(html.contains("status-fail"));
    }
    
    #[test]
    fn test_analysis_summary_report() {
        let nodes = vec![
            NodeData { id: 1, x: 0.0, y: 0.0, z: 0.0, support_type: Some("Fixed".to_string()) },
            NodeData { id: 2, x: 6.0, y: 0.0, z: 0.0, support_type: Some("Fixed".to_string()) },
            NodeData { id: 3, x: 3.0, y: 4.0, z: 0.0, support_type: None },
        ];
        
        let members = vec![
            MemberData { id: 1, start_node: 1, end_node: 3, section: "ISA 100x100x10".to_string(), material: "Fe 250".to_string(), length: 5.0 },
            MemberData { id: 2, start_node: 2, end_node: 3, section: "ISA 100x100x10".to_string(), material: "Fe 250".to_string(), length: 5.0 },
        ];
        
        let reactions = vec![
            ReactionData { node_id: 1, load_case: "DL".to_string(), fx: -10.0, fy: 50.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
            ReactionData { node_id: 2, load_case: "DL".to_string(), fx: 10.0, fy: 50.0, fz: 0.0, mx: 0.0, my: 0.0, mz: 0.0 },
        ];
        
        let displacements = vec![
            DisplacementData { node_id: 3, load_case: "DL".to_string(), dx: 0.0, dy: -0.005, dz: 0.0, rx: 0.0, ry: 0.0, rz: 0.0 },
        ];
        
        let html = generate_analysis_summary("Truss Analysis", nodes, members, reactions, displacements);
        
        assert!(html.contains("Truss Analysis"));
        assert!(html.contains("Support Reactions"));
        assert!(html.contains("Node Displacements"));
    }
    
    #[test]
    fn test_json_report() {
        let builder = ReportBuilder::new()
            .with_format(ReportFormat::Json)
            .with_header(ReportHeader {
                project_name: "Test".to_string(),
                ..Default::default()
            });
        
        let json = builder.generate();
        
        assert!(json.contains("\"project_name\":"));
        assert!(json.contains("\"sections\":"));
    }
    
    #[test]
    fn test_csv_report() {
        let checks = vec![
            DesignCheckData {
                member_id: 1,
                check_type: "Tension".to_string(),
                demand: 400.0,
                capacity: 800.0,
                ratio: 0.5,
                status: "Pass".to_string(),
                governing_case: "LC1".to_string(),
                clause: "Cl. 6.2".to_string(),
            },
        ];
        
        let builder = ReportBuilder::new()
            .with_format(ReportFormat::Csv)
            .add_section(ReportSection::DesignChecks {
                code: "IS 800".to_string(),
                checks,
                summary: DesignSummaryStats::default(),
            });
        
        let csv = builder.generate();
        
        assert!(csv.contains("Member,Check Type,Demand,Capacity"));
        assert!(csv.contains("1,Tension,400.0000,800.0000"));
    }
    
    #[test]
    fn test_markdown_report() {
        let builder = ReportBuilder::new()
            .with_format(ReportFormat::Markdown)
            .with_header(ReportHeader {
                project_name: "MD Test".to_string(),
                client: "Test Client".to_string(),
                ..Default::default()
            });
        
        let md = builder.generate();
        
        assert!(md.contains("# MD Test"));
        assert!(md.contains("| Client | Test Client |"));
    }
    
    #[test]
    fn test_modal_analysis_section() {
        let modes = vec![
            ModeData { mode_number: 1, frequency: 2.5, period: 0.4, participation_x: 0.75, participation_y: 0.05, participation_z: 0.0 },
            ModeData { mode_number: 2, frequency: 3.8, period: 0.26, participation_x: 0.10, participation_y: 0.70, participation_z: 0.0 },
            ModeData { mode_number: 3, frequency: 5.2, period: 0.19, participation_x: 0.05, participation_y: 0.15, participation_z: 0.0 },
        ];
        
        let html = ReportBuilder::new()
            .add_section(ReportSection::ModalAnalysis {
                modes,
                total_mass: 100000.0,
                participation: vec![0.75, 0.70, 0.0],
            })
            .generate();
        
        assert!(html.contains("Modal Analysis"));
        assert!(html.contains("100000.00 kg"));
        assert!(html.contains("2.500")); // Frequency
    }
    
    #[test]
    fn test_load_summary_section() {
        let load_cases = vec![
            LoadCaseData { id: 1, name: "Dead Load".to_string(), load_type: "Dead".to_string(), factor: 1.0 },
            LoadCaseData { id: 2, name: "Live Load".to_string(), load_type: "Live".to_string(), factor: 1.0 },
            LoadCaseData { id: 3, name: "EQ X".to_string(), load_type: "Seismic".to_string(), factor: 1.0 },
        ];
        
        let combinations = vec![
            ("1.5DL + 1.5LL".to_string(), vec![
                ("Dead Load".to_string(), 1.5),
                ("Live Load".to_string(), 1.5),
            ]),
            ("1.2DL + 1.2LL + 1.2EQX".to_string(), vec![
                ("Dead Load".to_string(), 1.2),
                ("Live Load".to_string(), 1.2),
                ("EQ X".to_string(), 1.2),
            ]),
        ];
        
        let html = ReportBuilder::new()
            .add_section(ReportSection::LoadSummary {
                load_cases,
                combinations,
            })
            .generate();
        
        assert!(html.contains("Load Cases and Combinations"));
        assert!(html.contains("Dead Load"));
        assert!(html.contains("1.50×Dead Load"));
    }
    
    #[test]
    fn test_design_summary_stats() {
        let stats = DesignSummaryStats {
            total_members: 100,
            passed: 95,
            failed: 5,
            max_ratio: 1.15,
            critical_member: 42,
            avg_ratio: 0.65,
        };
        
        assert_eq!(stats.total_members, stats.passed + stats.failed);
        assert!(stats.max_ratio > 1.0);
    }
}
