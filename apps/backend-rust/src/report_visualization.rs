// ============================================================================
// ENGINEERING REPORT GENERATION
// ============================================================================
//
// P2 REQUIREMENT: Visualization and Report Enhancements
//
// Features:
// - Clause-cited calculation reports
// - Envelope diagrams (BMD, SFD, deflection)
// - Interaction diagrams (P-M, biaxial)
// - Utilization summaries with code references
// - Multi-code comparison reports
//
// Industry Standard: ETABS, SAP2000, STAAD.Pro reports
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// CALCULATION REPORT FRAMEWORK
// ============================================================================

/// Comprehensive calculation report with clause citations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationReport {
    /// Report metadata
    pub metadata: ReportMetadata,
    /// Project information
    pub project: ProjectInfo,
    /// Design code used
    pub design_code: DesignCodeInfo,
    /// Calculation sections
    pub sections: Vec<ReportSection>,
    /// Summary of results
    pub summary: ResultSummary,
    /// Disclaimer
    pub disclaimer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportMetadata {
    pub report_id: String,
    pub title: String,
    pub prepared_by: String,
    pub checked_by: String,
    pub approved_by: String,
    pub revision: String,
    pub date: String,
    pub software_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub number: String,
    pub client: String,
    pub location: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignCodeInfo {
    pub primary_code: String,
    pub code_year: String,
    pub supplementary_codes: Vec<String>,
    pub special_provisions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSection {
    pub id: String,
    pub title: String,
    pub content: SectionContent,
    pub clause_citations: Vec<ClauseCitation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SectionContent {
    Text(String),
    Calculation(CalculationBlock),
    Table(TableData),
    Diagram(DiagramData),
    Image { src: String, caption: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationBlock {
    pub description: String,
    pub inputs: Vec<CalculationInput>,
    pub steps: Vec<CalculationStep>,
    pub result: CalculationResult,
    pub code_clause: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationInput {
    pub symbol: String,
    pub description: String,
    pub value: f64,
    pub unit: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationStep {
    pub step_number: u32,
    pub description: String,
    pub equation: String,
    pub substitution: String,
    pub result: f64,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationResult {
    pub description: String,
    pub value: f64,
    pub unit: String,
    pub limit: Option<f64>,
    pub utilization: Option<f64>,
    pub status: CheckStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CheckStatus {
    Pass,
    Fail,
    Warning,
    NotApplicable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClauseCitation {
    pub code: String,
    pub clause: String,
    pub description: String,
    pub page: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableData {
    pub title: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub footer: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramData {
    pub diagram_type: DiagramType,
    pub title: String,
    pub data: DiagramPoints,
    pub annotations: Vec<DiagramAnnotation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagramType {
    BendingMomentDiagram,
    ShearForceDiagram,
    AxialForceDiagram,
    DeflectionDiagram,
    InteractionDiagram,
    EnvelopeDiagram,
    StressDistribution,
    StrainProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramPoints {
    pub x: Vec<f64>,
    pub y: Vec<f64>,
    /// For envelope diagrams (max/min)
    pub y_max: Option<Vec<f64>>,
    pub y_min: Option<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramAnnotation {
    pub x: f64,
    pub y: f64,
    pub text: String,
    pub annotation_type: AnnotationType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnnotationType {
    MaxValue,
    MinValue,
    Support,
    Load,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultSummary {
    pub overall_status: CheckStatus,
    pub critical_items: Vec<CriticalItem>,
    pub utilization_summary: UtilizationSummary,
    pub warnings: Vec<String>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalItem {
    pub member_id: String,
    pub check_type: String,
    pub utilization: f64,
    pub code_clause: String,
    pub governing_case: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UtilizationSummary {
    pub max_utilization: f64,
    pub max_member: String,
    pub average_utilization: f64,
    pub members_over_90_percent: usize,
    pub members_over_100_percent: usize,
    pub total_members: usize,
}

// ============================================================================
// ENVELOPE DIAGRAM GENERATOR
// ============================================================================

/// Generates envelope diagrams for structural analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvelopeDiagramGenerator {
    pub member_id: String,
    pub length: f64,
    pub num_points: usize,
    pub load_cases: Vec<LoadCaseResults>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCaseResults {
    pub case_name: String,
    pub case_type: LoadCaseType,
    pub factor: f64,
    pub moments: Vec<f64>,
    pub shears: Vec<f64>,
    pub axials: Vec<f64>,
    pub deflections: Vec<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadCaseType {
    Dead,
    Live,
    Wind,
    Seismic,
    Snow,
    Temperature,
    Combination,
}

impl EnvelopeDiagramGenerator {
    /// Create new envelope generator
    pub fn new(member_id: &str, length: f64, num_points: usize) -> Self {
        Self {
            member_id: member_id.to_string(),
            length,
            num_points,
            load_cases: Vec::new(),
        }
    }

    /// Add load case results
    pub fn add_load_case(&mut self, results: LoadCaseResults) {
        self.load_cases.push(results);
    }

    /// Generate bending moment envelope
    pub fn moment_envelope(&self) -> DiagramData {
        let x: Vec<f64> = (0..self.num_points)
            .map(|i| i as f64 * self.length / (self.num_points - 1) as f64)
            .collect();

        let mut y_max = vec![f64::MIN; self.num_points];
        let mut y_min = vec![f64::MAX; self.num_points];

        for case in &self.load_cases {
            for i in 0..self.num_points.min(case.moments.len()) {
                let m = case.moments[i] * case.factor;
                y_max[i] = y_max[i].max(m);
                y_min[i] = y_min[i].min(m);
            }
        }

        // Find critical points for annotations
        let max_idx = y_max.iter().enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap_or(0);

        let min_idx = y_min.iter().enumerate()
            .min_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap_or(0);

        let annotations = vec![
            DiagramAnnotation {
                x: x[max_idx],
                y: y_max[max_idx],
                text: format!("M_max = {:.2} kN·m", y_max[max_idx]),
                annotation_type: AnnotationType::MaxValue,
            },
            DiagramAnnotation {
                x: x[min_idx],
                y: y_min[min_idx],
                text: format!("M_min = {:.2} kN·m", y_min[min_idx]),
                annotation_type: AnnotationType::MinValue,
            },
        ];

        DiagramData {
            diagram_type: DiagramType::EnvelopeDiagram,
            title: format!("Bending Moment Envelope - {}", self.member_id),
            data: DiagramPoints {
                x,
                y: y_max.clone(),
                y_max: Some(y_max),
                y_min: Some(y_min),
            },
            annotations,
        }
    }

    /// Generate shear force envelope
    pub fn shear_envelope(&self) -> DiagramData {
        let x: Vec<f64> = (0..self.num_points)
            .map(|i| i as f64 * self.length / (self.num_points - 1) as f64)
            .collect();

        let mut y_max = vec![f64::MIN; self.num_points];
        let mut y_min = vec![f64::MAX; self.num_points];

        for case in &self.load_cases {
            for i in 0..self.num_points.min(case.shears.len()) {
                let v = case.shears[i] * case.factor;
                y_max[i] = y_max[i].max(v);
                y_min[i] = y_min[i].min(v);
            }
        }

        DiagramData {
            diagram_type: DiagramType::ShearForceDiagram,
            title: format!("Shear Force Envelope - {}", self.member_id),
            data: DiagramPoints {
                x,
                y: y_max.clone(),
                y_max: Some(y_max),
                y_min: Some(y_min),
            },
            annotations: vec![],
        }
    }

    /// Generate deflection envelope
    pub fn deflection_envelope(&self) -> DiagramData {
        let x: Vec<f64> = (0..self.num_points)
            .map(|i| i as f64 * self.length / (self.num_points - 1) as f64)
            .collect();

        let mut y_max = vec![f64::MIN; self.num_points];
        let mut y_min = vec![f64::MAX; self.num_points];

        for case in &self.load_cases {
            for i in 0..self.num_points.min(case.deflections.len()) {
                let d = case.deflections[i] * case.factor;
                y_max[i] = y_max[i].max(d);
                y_min[i] = y_min[i].min(d);
            }
        }

        // Find max deflection
        let max_idx = y_max.iter().enumerate()
            .max_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(i, _)| i)
            .unwrap_or(0);

        let annotations = vec![
            DiagramAnnotation {
                x: x[max_idx],
                y: y_max[max_idx],
                text: format!("δ_max = {:.2} mm", y_max[max_idx]),
                annotation_type: AnnotationType::MaxValue,
            },
        ];

        DiagramData {
            diagram_type: DiagramType::DeflectionDiagram,
            title: format!("Deflection Envelope - {}", self.member_id),
            data: DiagramPoints {
                x,
                y: y_max.clone(),
                y_max: Some(y_max),
                y_min: Some(y_min),
            },
            annotations,
        }
    }
}

// ============================================================================
// P-M INTERACTION DIAGRAM
// ============================================================================

/// P-M Interaction diagram generator for column design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteractionDiagramGenerator {
    pub section_name: String,
    pub concrete_fc: f64,
    pub steel_fy: f64,
    pub section: SectionGeometry,
    pub reinforcement: Vec<RebarLayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionGeometry {
    pub width: f64,
    pub depth: f64,
    pub cover: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebarLayer {
    pub area: f64,
    pub distance_from_top: f64,
}

impl InteractionDiagramGenerator {
    /// Generate P-M interaction curve
    pub fn generate_interaction_curve(&self, num_points: usize) -> Vec<(f64, f64)> {
        let mut points = Vec::new();
        let b = self.section.width;
        let h = self.section.depth;
        let d = h - self.section.cover;
        let fc = self.concrete_fc;
        let fy = self.steel_fy;

        // Total steel area
        let as_total: f64 = self.reinforcement.iter().map(|r| r.area).sum();
        let as_prime: f64 = self.reinforcement.iter()
            .filter(|r| r.distance_from_top <= h / 2.0)
            .map(|r| r.area)
            .sum();
        let _as_tension = as_total - as_prime;

        // Point 0: Pure compression (P0)
        let p0 = 0.85 * fc * b * h + fy * as_total;
        points.push((p0, 0.0));

        // Points along the curve varying neutral axis depth
        let c_values: Vec<f64> = (1..=num_points)
            .map(|i| i as f64 * 2.0 * h / num_points as f64)
            .collect();

        for c in &c_values {
            if *c <= 0.0 {
                continue;
            }

            // Concrete compression force
            let a = 0.85 * c;
            let a_eff = a.min(h);
            let cc = 0.85 * fc * b * a_eff;

            // Steel forces
            let epsilon_cu = 0.003;
            let es = 200000.0; // MPa

            let mut cs = 0.0; // Compression steel
            let mut ts = 0.0; // Tension steel

            for layer in &self.reinforcement {
                let dist = layer.distance_from_top;
                let strain = epsilon_cu * (c - dist) / c;
                let stress = (strain * es).min(fy).max(-fy);
                
                if stress > 0.0 {
                    cs += stress * layer.area;
                } else {
                    ts += stress.abs() * layer.area;
                }
            }

            // Equilibrium
            let p = cc + cs - ts;
            
            // Moment about centroid
            let m = cc * (h / 2.0 - a_eff / 2.0) 
                + cs * (h / 2.0 - self.section.cover)
                + ts * (d - h / 2.0);

            if p >= -0.1 * p0 && m >= 0.0 {
                points.push((p, m));
            }
        }

        // Point: Pure tension
        let pt = -fy * as_total;
        points.push((pt, 0.0));

        // Sort by P for proper curve
        points.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        points
    }

    /// Generate biaxial interaction surface
    pub fn generate_biaxial_surface(&self, num_points: usize) -> BiaxialSurface {
        let mut surface = BiaxialSurface {
            p: Vec::new(),
            mx: Vec::new(),
            my: Vec::new(),
        };

        let pm_curve = self.generate_interaction_curve(num_points);

        // Generate surface by rotating the curve
        let num_angles = 12;
        for angle_idx in 0..num_angles {
            let theta = (angle_idx as f64 / num_angles as f64) * 2.0 * std::f64::consts::PI;
            
            for (p, m) in &pm_curve {
                surface.p.push(*p);
                surface.mx.push(m * theta.cos());
                surface.my.push(m * theta.sin());
            }
        }

        surface
    }

    /// Check if load point is within capacity
    pub fn check_capacity(&self, p: f64, mx: f64, my: f64) -> CapacityCheck {
        let pm_curve = self.generate_interaction_curve(50);
        let m_resultant = (mx * mx + my * my).sqrt();

        // Find capacity at this axial load
        let mut m_capacity = 0.0;
        for i in 0..pm_curve.len() - 1 {
            let (p1, m1) = pm_curve[i];
            let (p2, m2) = pm_curve[i + 1];

            if (p >= p2 && p <= p1) || (p >= p1 && p <= p2) {
                if (p2 - p1).abs() > 1e-10 {
                    let t = (p - p1) / (p2 - p1);
                    m_capacity = m1 + t * (m2 - m1);
                    break;
                }
            }
        }

        let utilization = if m_capacity > 0.0 {
            m_resultant / m_capacity
        } else {
            f64::INFINITY
        };

        CapacityCheck {
            utilization,
            status: if utilization <= 1.0 { CheckStatus::Pass } else { CheckStatus::Fail },
            m_capacity,
            m_demand: m_resultant,
            p_demand: p,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiaxialSurface {
    pub p: Vec<f64>,
    pub mx: Vec<f64>,
    pub my: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityCheck {
    pub utilization: f64,
    pub status: CheckStatus,
    pub m_capacity: f64,
    pub m_demand: f64,
    pub p_demand: f64,
}

// ============================================================================
// REPORT BUILDER
// ============================================================================

/// Builder for creating calculation reports
pub struct ReportBuilder {
    report: CalculationReport,
}

impl ReportBuilder {
    /// Create new report builder
    pub fn new(title: &str) -> Self {
        Self {
            report: CalculationReport {
                metadata: ReportMetadata {
                    report_id: uuid_simple(),
                    title: title.to_string(),
                    prepared_by: String::new(),
                    checked_by: String::new(),
                    approved_by: String::new(),
                    revision: "0".to_string(),
                    date: current_date(),
                    software_version: env!("CARGO_PKG_VERSION").to_string(),
                },
                project: ProjectInfo {
                    name: String::new(),
                    number: String::new(),
                    client: String::new(),
                    location: String::new(),
                    description: String::new(),
                },
                design_code: DesignCodeInfo {
                    primary_code: String::new(),
                    code_year: String::new(),
                    supplementary_codes: Vec::new(),
                    special_provisions: Vec::new(),
                },
                sections: Vec::new(),
                summary: ResultSummary {
                    overall_status: CheckStatus::Pass,
                    critical_items: Vec::new(),
                    utilization_summary: UtilizationSummary {
                        max_utilization: 0.0,
                        max_member: String::new(),
                        average_utilization: 0.0,
                        members_over_90_percent: 0,
                        members_over_100_percent: 0,
                        total_members: 0,
                    },
                    warnings: Vec::new(),
                    recommendations: Vec::new(),
                },
                disclaimer: default_disclaimer(),
            },
        }
    }

    /// Set project info
    pub fn project(mut self, name: &str, number: &str, client: &str) -> Self {
        self.report.project.name = name.to_string();
        self.report.project.number = number.to_string();
        self.report.project.client = client.to_string();
        self
    }

    /// Set design code
    pub fn design_code(mut self, code: &str, year: &str) -> Self {
        self.report.design_code.primary_code = code.to_string();
        self.report.design_code.code_year = year.to_string();
        self
    }

    /// Set prepared by
    pub fn prepared_by(mut self, engineer: &str) -> Self {
        self.report.metadata.prepared_by = engineer.to_string();
        self
    }

    /// Add calculation section
    pub fn add_calculation(
        mut self,
        title: &str,
        calc: CalculationBlock,
        citations: Vec<ClauseCitation>,
    ) -> Self {
        self.report.sections.push(ReportSection {
            id: format!("calc-{}", self.report.sections.len() + 1),
            title: title.to_string(),
            content: SectionContent::Calculation(calc),
            clause_citations: citations,
        });
        self
    }

    /// Add diagram section
    pub fn add_diagram(mut self, diagram: DiagramData) -> Self {
        self.report.sections.push(ReportSection {
            id: format!("diag-{}", self.report.sections.len() + 1),
            title: diagram.title.clone(),
            content: SectionContent::Diagram(diagram),
            clause_citations: Vec::new(),
        });
        self
    }

    /// Add table section
    pub fn add_table(mut self, table: TableData) -> Self {
        self.report.sections.push(ReportSection {
            id: format!("table-{}", self.report.sections.len() + 1),
            title: table.title.clone(),
            content: SectionContent::Table(table),
            clause_citations: Vec::new(),
        });
        self
    }

    /// Set summary
    pub fn summary(mut self, summary: ResultSummary) -> Self {
        self.report.summary = summary;
        self
    }

    /// Build the report
    pub fn build(self) -> CalculationReport {
        self.report
    }
}

fn uuid_simple() -> String {
    // Simple UUID-like string
    format!("RPT-{:08X}", rand_u32())
}

fn rand_u32() -> u32 {
    // Simple pseudo-random for ID generation
    static mut SEED: u32 = 12345;
    unsafe {
        SEED = SEED.wrapping_mul(1103515245).wrapping_add(12345);
        SEED
    }
}

fn current_date() -> String {
    // Static date for reproducibility
    "2025-01-31".to_string()
}

fn default_disclaimer() -> String {
    r#"ENGINEERING DISCLAIMER

This report is generated by automated structural analysis software. While every effort 
has been made to ensure accuracy, the results should be verified by a qualified 
professional engineer before use in actual construction.

The software is provided "as is" without warranty of any kind. Users are responsible 
for verifying that all inputs are correct and that the analysis methods are appropriate 
for their specific application.

All designs must be reviewed and sealed by a licensed professional engineer in the 
jurisdiction where the structure will be built.

Code references and clause citations are provided for guidance and should be verified 
against the current edition of the applicable code."#.to_string()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_envelope_diagram_generation() {
        let mut gen = EnvelopeDiagramGenerator::new("B1", 6.0, 21);
        
        gen.add_load_case(LoadCaseResults {
            case_name: "Dead".to_string(),
            case_type: LoadCaseType::Dead,
            factor: 1.4,
            moments: (0..21).map(|i| -(i as f64 - 10.0).powi(2) * 5.0).collect(),
            shears: (0..21).map(|i| (i as f64 - 10.0) * 3.0).collect(),
            axials: vec![0.0; 21],
            deflections: (0..21).map(|i| (i as f64 - 10.0).powi(2) * -0.5).collect(),
        });

        let moment_env = gen.moment_envelope();
        assert_eq!(moment_env.data.x.len(), 21);
        assert!(moment_env.data.y_max.is_some());
        assert!(moment_env.data.y_min.is_some());
    }

    #[test]
    fn test_interaction_diagram() {
        let gen = InteractionDiagramGenerator {
            section_name: "400x400".to_string(),
            concrete_fc: 30.0,
            steel_fy: 500.0,
            section: SectionGeometry {
                width: 400.0,
                depth: 400.0,
                cover: 40.0,
            },
            reinforcement: vec![
                RebarLayer { area: 804.0, distance_from_top: 40.0 },
                RebarLayer { area: 804.0, distance_from_top: 360.0 },
            ],
        };

        let curve = gen.generate_interaction_curve(50);
        assert!(!curve.is_empty());
        
        // Pure compression should be positive
        assert!(curve[0].0 > 0.0);
    }

    #[test]
    fn test_report_builder() {
        let report = ReportBuilder::new("Beam Design Calculation")
            .project("Test Project", "P001", "Test Client")
            .design_code("IS 456", "2000")
            .prepared_by("Test Engineer")
            .build();

        assert_eq!(report.project.name, "Test Project");
        assert_eq!(report.design_code.primary_code, "IS 456");
    }
}
