// ============================================================================
// ENHANCED DATA EXPORT (IFC/CSV)
// ============================================================================
//
// P2 REQUIREMENT: IFC/CSV Export with Versioned Metadata
//
// Features:
// - IFC 4.x export with structural elements
// - CSV export with full metadata
// - Version tracking and checksums
// - Multi-format support (JSON, XML optional)
// - Load case and result export
//
// Industry Standard: Revit, Tekla, SAP2000 export capabilities
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// EXPORT METADATA
// ============================================================================

/// Versioned export metadata for traceability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMetadata {
    /// Unique export ID
    pub export_id: String,
    /// Export timestamp (ISO 8601)
    pub timestamp: String,
    /// Software version
    pub software_version: String,
    /// Schema version
    pub schema_version: String,
    /// Project information
    pub project: ProjectMetadata,
    /// Export settings
    pub settings: ExportSettings,
    /// Content checksum (SHA-256)
    pub checksum: String,
    /// Source model info
    pub source_model: ModelInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub name: String,
    pub number: String,
    pub client: String,
    pub engineer: String,
    pub description: String,
    pub units: UnitSystem,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnitSystem {
    SI,         // kN, m, kPa
    MetricMM,   // N, mm, MPa  
    Imperial,   // kip, ft, ksi
    ImperialIn, // lb, in, psi
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSettings {
    pub format: ExportFormat,
    pub include_geometry: bool,
    pub include_loads: bool,
    pub include_results: bool,
    pub include_design_results: bool,
    pub coordinate_precision: u8,
    pub value_precision: u8,
    pub load_cases: Vec<String>,
    pub result_types: Vec<ResultType>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExportFormat {
    IFC4,
    CSV,
    JSON,
    XML,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResultType {
    Reactions,
    Displacements,
    MemberForces,
    Stresses,
    DesignRatios,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub model_id: String,
    pub model_name: String,
    pub analysis_type: String,
    pub node_count: usize,
    pub element_count: usize,
    pub load_case_count: usize,
    pub last_modified: String,
}

// ============================================================================
// IFC EXPORT
// ============================================================================

/// IFC 4 export builder
#[derive(Debug, Clone)]
pub struct IfcExporter {
    pub header: IfcHeader,
    pub project: IfcProject,
    pub entities: Vec<IfcEntity>,
    entity_id: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcHeader {
    pub file_description: String,
    pub file_name: String,
    pub file_schema: String,
    pub timestamp: String,
    pub author: String,
    pub organization: String,
    pub originating_system: String,
    pub authorization: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcProject {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub description: String,
    pub units: Vec<IfcUnit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcUnit {
    pub unit_type: String,
    pub name: String,
    pub dimensions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IfcEntity {
    StructuralCurveMember(IfcStructuralCurveMember),
    StructuralSurfaceMember(IfcStructuralSurfaceMember),
    StructuralPointConnection(IfcStructuralPointConnection),
    StructuralCurveAction(IfcStructuralCurveAction),
    StructuralPointAction(IfcStructuralPointAction),
    StructuralAnalysisModel(IfcStructuralAnalysisModel),
    StructuralResultGroup(IfcStructuralResultGroup),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralCurveMember {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub description: String,
    pub predefined_type: CurveMemberType,
    pub axis: IfcAxis2Placement3D,
    pub length: f64,
    pub cross_section: String,
    pub material: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CurveMemberType {
    RigidJointedMember,
    PinJointedMember,
    Cable,
    TensionMember,
    CompressionMember,
    UserDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralSurfaceMember {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub predefined_type: SurfaceMemberType,
    pub thickness: f64,
    pub material: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SurfaceMemberType {
    BendingElement,
    MembraneElement,
    ShellElement,
    UserDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralPointConnection {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub position: [f64; 3],
    pub applied_condition: Option<BoundaryCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundaryCondition {
    pub translation_x: BoundaryState,
    pub translation_y: BoundaryState,
    pub translation_z: BoundaryState,
    pub rotation_x: BoundaryState,
    pub rotation_y: BoundaryState,
    pub rotation_z: BoundaryState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BoundaryState {
    Free,
    Fixed,
    Spring(u64), // Reference to spring stiffness entity
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralCurveAction {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub load_case: String,
    pub projected_or_true: ProjectedOrTrue,
    pub values: Vec<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectedOrTrue {
    ProjectedLength,
    TrueLength,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralPointAction {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub load_case: String,
    pub components: [f64; 6], // Fx, Fy, Fz, Mx, My, Mz
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralAnalysisModel {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub predefined_type: AnalysisModelType,
    pub loading_type: LoadingType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnalysisModelType {
    Loading2D,
    Loading3D,
    NotDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadingType {
    Static,
    Dynamic,
    NotDefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcStructuralResultGroup {
    pub id: u64,
    pub global_id: String,
    pub name: String,
    pub result_type: ResultGroupType,
    pub load_case: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResultGroupType {
    LinearElastic,
    Nonlinear,
    Combination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfcAxis2Placement3D {
    pub location: [f64; 3],
    pub axis: [f64; 3],
    pub ref_direction: [f64; 3],
}

impl Default for IfcAxis2Placement3D {
    fn default() -> Self {
        Self {
            location: [0.0, 0.0, 0.0],
            axis: [0.0, 0.0, 1.0],
            ref_direction: [1.0, 0.0, 0.0],
        }
    }
}

impl IfcExporter {
    /// Create new IFC exporter
    pub fn new(project_name: &str, author: &str) -> Self {
        let global_id = generate_ifc_guid();
        
        Self {
            header: IfcHeader {
                file_description: "ViewDefinition [StructuralAnalysisView]".to_string(),
                file_name: format!("{}.ifc", project_name.replace(' ', "_")),
                file_schema: "IFC4".to_string(),
                timestamp: "2025-01-31T00:00:00".to_string(),
                author: author.to_string(),
                organization: String::new(),
                originating_system: format!("StructuralAnalysis v{}", env!("CARGO_PKG_VERSION")),
                authorization: String::new(),
            },
            project: IfcProject {
                id: 1,
                global_id,
                name: project_name.to_string(),
                description: String::new(),
                units: vec![
                    IfcUnit { unit_type: "LENGTHUNIT".to_string(), name: "METRE".to_string(), dimensions: "m".to_string() },
                    IfcUnit { unit_type: "FORCEUNIT".to_string(), name: "NEWTON".to_string(), dimensions: "N".to_string() },
                    IfcUnit { unit_type: "PLANEANGLEUNIT".to_string(), name: "RADIAN".to_string(), dimensions: "rad".to_string() },
                ],
            },
            entities: Vec::new(),
            entity_id: 100,
        }
    }

    fn next_id(&mut self) -> u64 {
        self.entity_id += 1;
        self.entity_id
    }

    /// Add a curve member (beam/column)
    pub fn add_curve_member(
        &mut self,
        name: &str,
        start: [f64; 3],
        end: [f64; 3],
        section: &str,
        material: &str,
        member_type: CurveMemberType,
    ) {
        let id = self.next_id();
        let length = ((end[0] - start[0]).powi(2) 
            + (end[1] - start[1]).powi(2) 
            + (end[2] - start[2]).powi(2)).sqrt();

        let axis = IfcAxis2Placement3D {
            location: start,
            axis: [
                (end[0] - start[0]) / length,
                (end[1] - start[1]) / length,
                (end[2] - start[2]) / length,
            ],
            ref_direction: [0.0, 0.0, 1.0],
        };

        self.entities.push(IfcEntity::StructuralCurveMember(IfcStructuralCurveMember {
            id,
            global_id: generate_ifc_guid(),
            name: name.to_string(),
            description: String::new(),
            predefined_type: member_type,
            axis,
            length,
            cross_section: section.to_string(),
            material: material.to_string(),
        }));
    }

    /// Add a support
    pub fn add_support(
        &mut self,
        name: &str,
        position: [f64; 3],
        condition: BoundaryCondition,
    ) {
        let id = self.next_id();
        self.entities.push(IfcEntity::StructuralPointConnection(IfcStructuralPointConnection {
            id,
            global_id: generate_ifc_guid(),
            name: name.to_string(),
            position,
            applied_condition: Some(condition),
        }));
    }

    /// Add point load
    pub fn add_point_load(
        &mut self,
        name: &str,
        load_case: &str,
        fx: f64, fy: f64, fz: f64,
        mx: f64, my: f64, mz: f64,
    ) {
        let id = self.next_id();
        self.entities.push(IfcEntity::StructuralPointAction(IfcStructuralPointAction {
            id,
            global_id: generate_ifc_guid(),
            name: name.to_string(),
            load_case: load_case.to_string(),
            components: [fx, fy, fz, mx, my, mz],
        }));
    }

    /// Export to IFC STEP format string
    pub fn to_step_string(&self) -> String {
        let mut output = String::new();

        // Header
        output.push_str("ISO-10303-21;\n");
        output.push_str("HEADER;\n");
        output.push_str(&format!("FILE_DESCRIPTION(('{}'), '2;1');\n", self.header.file_description));
        output.push_str(&format!("FILE_NAME('{}', '{}', ('{}'), ('{}'), '', '{}', '');\n",
            self.header.file_name,
            self.header.timestamp,
            self.header.author,
            self.header.organization,
            self.header.originating_system,
        ));
        output.push_str(&format!("FILE_SCHEMA(('{}'));\n", self.header.file_schema));
        output.push_str("ENDSEC;\n\n");

        // Data section
        output.push_str("DATA;\n");

        // Project
        output.push_str(&format!("#{}=IFCPROJECT('{}', $, '{}', '{}', $, $, $, $, $);\n",
            self.project.id,
            self.project.global_id,
            self.project.name,
            self.project.description,
        ));

        // Entities
        for entity in &self.entities {
            match entity {
                IfcEntity::StructuralCurveMember(m) => {
                    output.push_str(&format!("#{}=IFCSTRUCTURALCURVEMEMBER('{}', $, '{}', '{}', $, $, $, .{}.);\n",
                        m.id,
                        m.global_id,
                        m.name,
                        m.description,
                        format!("{:?}", m.predefined_type).to_uppercase(),
                    ));
                }
                IfcEntity::StructuralPointConnection(p) => {
                    output.push_str(&format!("#{}=IFCSTRUCTURALPOINTCONNECTION('{}', $, '{}', $, $, $, $);\n",
                        p.id,
                        p.global_id,
                        p.name,
                    ));
                }
                IfcEntity::StructuralPointAction(a) => {
                    output.push_str(&format!("#{}=IFCSTRUCTURALPOINTACTION('{}', $, '{}', $, $, $, $, .GLOBAL., $, $);\n",
                        a.id,
                        a.global_id,
                        a.name,
                    ));
                }
                _ => {}
            }
        }

        output.push_str("ENDSEC;\n");
        output.push_str("END-ISO-10303-21;\n");

        output
    }
}

/// Generate IFC-compatible GUID (22 character base64)
fn generate_ifc_guid() -> String {
    static mut COUNTER: u64 = 0;
    unsafe {
        COUNTER += 1;
        let val = COUNTER ^ 0x1234567890ABCDEF;
        format!("{:022X}", val)[..22].to_string()
    }
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/// CSV exporter with metadata headers
#[derive(Debug, Clone)]
pub struct CsvExporter {
    pub metadata: ExportMetadata,
    pub tables: Vec<CsvTable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvTable {
    pub name: String,
    pub description: String,
    pub headers: Vec<CsvHeader>,
    pub rows: Vec<Vec<CsvValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvHeader {
    pub name: String,
    pub data_type: CsvDataType,
    pub unit: Option<String>,
    pub description: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CsvDataType {
    Integer,
    Float,
    String,
    Boolean,
    Date,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CsvValue {
    Integer(i64),
    Float(f64),
    String(String),
    Boolean(bool),
    Null,
}

impl CsvExporter {
    /// Create new CSV exporter
    pub fn new(metadata: ExportMetadata) -> Self {
        Self {
            metadata,
            tables: Vec::new(),
        }
    }

    /// Add nodes table
    pub fn add_nodes(&mut self, nodes: &[NodeData]) {
        let headers = vec![
            CsvHeader { name: "ID".to_string(), data_type: CsvDataType::Integer, unit: None, description: "Node ID".to_string() },
            CsvHeader { name: "X".to_string(), data_type: CsvDataType::Float, unit: Some("m".to_string()), description: "X coordinate".to_string() },
            CsvHeader { name: "Y".to_string(), data_type: CsvDataType::Float, unit: Some("m".to_string()), description: "Y coordinate".to_string() },
            CsvHeader { name: "Z".to_string(), data_type: CsvDataType::Float, unit: Some("m".to_string()), description: "Z coordinate".to_string() },
            CsvHeader { name: "Support".to_string(), data_type: CsvDataType::String, unit: None, description: "Support type".to_string() },
        ];

        let rows: Vec<Vec<CsvValue>> = nodes.iter().map(|n| {
            vec![
                CsvValue::Integer(n.id as i64),
                CsvValue::Float(n.x),
                CsvValue::Float(n.y),
                CsvValue::Float(n.z),
                CsvValue::String(n.support.clone()),
            ]
        }).collect();

        self.tables.push(CsvTable {
            name: "Nodes".to_string(),
            description: "Node coordinates and supports".to_string(),
            headers,
            rows,
        });
    }

    /// Add elements table
    pub fn add_elements(&mut self, elements: &[ElementData]) {
        let headers = vec![
            CsvHeader { name: "ID".to_string(), data_type: CsvDataType::Integer, unit: None, description: "Element ID".to_string() },
            CsvHeader { name: "Type".to_string(), data_type: CsvDataType::String, unit: None, description: "Element type".to_string() },
            CsvHeader { name: "Node_I".to_string(), data_type: CsvDataType::Integer, unit: None, description: "Start node".to_string() },
            CsvHeader { name: "Node_J".to_string(), data_type: CsvDataType::Integer, unit: None, description: "End node".to_string() },
            CsvHeader { name: "Section".to_string(), data_type: CsvDataType::String, unit: None, description: "Cross-section".to_string() },
            CsvHeader { name: "Material".to_string(), data_type: CsvDataType::String, unit: None, description: "Material".to_string() },
        ];

        let rows: Vec<Vec<CsvValue>> = elements.iter().map(|e| {
            vec![
                CsvValue::Integer(e.id as i64),
                CsvValue::String(e.element_type.clone()),
                CsvValue::Integer(e.node_i as i64),
                CsvValue::Integer(e.node_j as i64),
                CsvValue::String(e.section.clone()),
                CsvValue::String(e.material.clone()),
            ]
        }).collect();

        self.tables.push(CsvTable {
            name: "Elements".to_string(),
            description: "Element connectivity and properties".to_string(),
            headers,
            rows,
        });
    }

    /// Add results table
    pub fn add_results(&mut self, results: &[ResultData]) {
        let headers = vec![
            CsvHeader { name: "Element_ID".to_string(), data_type: CsvDataType::Integer, unit: None, description: "Element ID".to_string() },
            CsvHeader { name: "Load_Case".to_string(), data_type: CsvDataType::String, unit: None, description: "Load case name".to_string() },
            CsvHeader { name: "Location".to_string(), data_type: CsvDataType::Float, unit: Some("m".to_string()), description: "Distance from start".to_string() },
            CsvHeader { name: "Axial".to_string(), data_type: CsvDataType::Float, unit: Some("kN".to_string()), description: "Axial force".to_string() },
            CsvHeader { name: "Shear_Y".to_string(), data_type: CsvDataType::Float, unit: Some("kN".to_string()), description: "Shear force Y".to_string() },
            CsvHeader { name: "Shear_Z".to_string(), data_type: CsvDataType::Float, unit: Some("kN".to_string()), description: "Shear force Z".to_string() },
            CsvHeader { name: "Moment_Y".to_string(), data_type: CsvDataType::Float, unit: Some("kN·m".to_string()), description: "Bending moment Y".to_string() },
            CsvHeader { name: "Moment_Z".to_string(), data_type: CsvDataType::Float, unit: Some("kN·m".to_string()), description: "Bending moment Z".to_string() },
            CsvHeader { name: "Torsion".to_string(), data_type: CsvDataType::Float, unit: Some("kN·m".to_string()), description: "Torsion".to_string() },
        ];

        let rows: Vec<Vec<CsvValue>> = results.iter().map(|r| {
            vec![
                CsvValue::Integer(r.element_id as i64),
                CsvValue::String(r.load_case.clone()),
                CsvValue::Float(r.location),
                CsvValue::Float(r.axial),
                CsvValue::Float(r.shear_y),
                CsvValue::Float(r.shear_z),
                CsvValue::Float(r.moment_y),
                CsvValue::Float(r.moment_z),
                CsvValue::Float(r.torsion),
            ]
        }).collect();

        self.tables.push(CsvTable {
            name: "Member_Forces".to_string(),
            description: "Member force results".to_string(),
            headers,
            rows,
        });
    }

    /// Export to CSV string
    pub fn to_csv_string(&self, table_name: &str) -> Option<String> {
        let table = self.tables.iter().find(|t| t.name == table_name)?;
        let mut output = String::new();

        // Metadata header comments
        output.push_str(&format!("# Export ID: {}\n", self.metadata.export_id));
        output.push_str(&format!("# Timestamp: {}\n", self.metadata.timestamp));
        output.push_str(&format!("# Schema Version: {}\n", self.metadata.schema_version));
        output.push_str(&format!("# Project: {}\n", self.metadata.project.name));
        output.push_str(&format!("# Checksum: {}\n", self.metadata.checksum));
        output.push_str("#\n");
        output.push_str(&format!("# Table: {}\n", table.name));
        output.push_str(&format!("# Description: {}\n", table.description));
        output.push_str("#\n");

        // Column header with units
        let header_line: Vec<String> = table.headers.iter().map(|h| {
            if let Some(unit) = &h.unit {
                format!("{} [{}]", h.name, unit)
            } else {
                h.name.clone()
            }
        }).collect();
        output.push_str(&header_line.join(","));
        output.push('\n');

        // Data rows
        for row in &table.rows {
            let values: Vec<String> = row.iter().map(|v| match v {
                CsvValue::Integer(i) => i.to_string(),
                CsvValue::Float(f) => format!("{:.6}", f),
                CsvValue::String(s) => format!("\"{}\"", s.replace('"', "\"\"")),
                CsvValue::Boolean(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
                CsvValue::Null => String::new(),
            }).collect();
            output.push_str(&values.join(","));
            output.push('\n');
        }

        Some(output)
    }

    /// Export all tables to a multi-sheet CSV bundle (as JSON manifest)
    pub fn to_bundle_manifest(&self) -> String {
        serde_json::to_string_pretty(&BundleManifest {
            metadata: self.metadata.clone(),
            tables: self.tables.iter().map(|t| TableManifestEntry {
                name: t.name.clone(),
                description: t.description.clone(),
                row_count: t.rows.len(),
                column_count: t.headers.len(),
            }).collect(),
        }).unwrap_or_default()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BundleManifest {
    metadata: ExportMetadata,
    tables: Vec<TableManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TableManifestEntry {
    name: String,
    description: String,
    row_count: usize,
    column_count: usize,
}

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeData {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub support: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementData {
    pub id: usize,
    pub element_type: String,
    pub node_i: usize,
    pub node_j: usize,
    pub section: String,
    pub material: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultData {
    pub element_id: usize,
    pub load_case: String,
    pub location: f64,
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub moment_y: f64,
    pub moment_z: f64,
    pub torsion: f64,
}

// ============================================================================
// CHECKSUM CALCULATION
// ============================================================================

/// Simple checksum for export verification
pub fn calculate_checksum(data: &str) -> String {
    // Simple hash for demonstration (production would use SHA-256)
    let mut hash: u64 = 0;
    for (i, byte) in data.bytes().enumerate() {
        hash = hash.wrapping_add(byte as u64 * (i as u64 + 1));
        hash = hash.rotate_left(7);
    }
    format!("{:016X}", hash)
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ifc_exporter() {
        let mut exporter = IfcExporter::new("Test Project", "Test Engineer");
        
        exporter.add_curve_member(
            "B1",
            [0.0, 0.0, 0.0],
            [6.0, 0.0, 0.0],
            "W310x38.7",
            "Steel A992",
            CurveMemberType::RigidJointedMember,
        );

        exporter.add_support(
            "S1",
            [0.0, 0.0, 0.0],
            BoundaryCondition {
                translation_x: BoundaryState::Fixed,
                translation_y: BoundaryState::Fixed,
                translation_z: BoundaryState::Fixed,
                rotation_x: BoundaryState::Free,
                rotation_y: BoundaryState::Free,
                rotation_z: BoundaryState::Free,
            },
        );

        let ifc_string = exporter.to_step_string();
        assert!(ifc_string.contains("ISO-10303-21"));
        assert!(ifc_string.contains("IFCPROJECT"));
        assert!(ifc_string.contains("IFCSTRUCTURALCURVEMEMBER"));
    }

    #[test]
    fn test_csv_exporter() {
        let metadata = ExportMetadata {
            export_id: "EXP-001".to_string(),
            timestamp: "2025-01-31T00:00:00Z".to_string(),
            software_version: "1.0.0".to_string(),
            schema_version: "1.0".to_string(),
            project: ProjectMetadata {
                name: "Test Project".to_string(),
                number: "P001".to_string(),
                client: "Test Client".to_string(),
                engineer: "Test Engineer".to_string(),
                description: "Test".to_string(),
                units: UnitSystem::SI,
            },
            settings: ExportSettings {
                format: ExportFormat::CSV,
                include_geometry: true,
                include_loads: true,
                include_results: true,
                include_design_results: true,
                coordinate_precision: 6,
                value_precision: 4,
                load_cases: vec!["Dead".to_string(), "Live".to_string()],
                result_types: vec![ResultType::MemberForces],
            },
            checksum: String::new(),
            source_model: ModelInfo {
                model_id: "M001".to_string(),
                model_name: "Test Model".to_string(),
                analysis_type: "Static".to_string(),
                node_count: 10,
                element_count: 9,
                load_case_count: 2,
                last_modified: "2025-01-31".to_string(),
            },
        };

        let mut exporter = CsvExporter::new(metadata);
        
        exporter.add_nodes(&[
            NodeData { id: 1, x: 0.0, y: 0.0, z: 0.0, support: "Fixed".to_string() },
            NodeData { id: 2, x: 6.0, y: 0.0, z: 0.0, support: "None".to_string() },
        ]);

        let csv = exporter.to_csv_string("Nodes").unwrap();
        assert!(csv.contains("# Export ID:"));
        assert!(csv.contains("X [m]"));
        assert!(csv.contains("0.000000"));
    }

    #[test]
    fn test_checksum() {
        let data = "test data for checksum";
        let checksum = calculate_checksum(data);
        assert_eq!(checksum.len(), 16);
        
        // Same data should produce same checksum
        let checksum2 = calculate_checksum(data);
        assert_eq!(checksum, checksum2);
    }
}
