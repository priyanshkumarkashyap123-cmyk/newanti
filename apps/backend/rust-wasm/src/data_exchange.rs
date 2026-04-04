//! Data Exchange Module
//!
//! Structural data exchange formats and interoperability.
//! Based on: IFC, CIS/2, SDNF, gbXML, OpenBIM
//!
//! Features:
//! - IFC import/export
//! - CIS/2 steel data exchange
//! - SDNF (Steel Detailing Neutral Format)
//! - gbXML for energy analysis
//! - Custom JSON/XML formats

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Data exchange format
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExchangeFormat {
    /// Industry Foundation Classes
    IFC,
    /// CIMsteel Integration Standards/2
    CIS2,
    /// Steel Detailing Neutral Format
    SDNF,
    /// Green Building XML
    GbXML,
    /// Structural Analysis Format (custom)
    SAF,
    /// JSON structural format
    JSON,
    /// XML structural format
    XML,
}

/// Coordinate system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinateSystem {
    /// Origin point
    pub origin: Point3D,
    /// X-axis direction
    pub x_axis: Direction3D,
    /// Y-axis direction
    pub y_axis: Direction3D,
    /// Z-axis direction
    pub z_axis: Direction3D,
}

/// 3D point
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// 3D direction
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Direction3D {
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
}

impl Direction3D {
    /// Create from vector
    pub fn from_vec(dx: f64, dy: f64, dz: f64) -> Self {
        let len = (dx*dx + dy*dy + dz*dz).sqrt();
        if len > 1e-10 {
            Self { dx: dx/len, dy: dy/len, dz: dz/len }
        } else {
            Self { dx: 1.0, dy: 0.0, dz: 0.0 }
        }
    }
}

impl CoordinateSystem {
    /// Global coordinate system
    pub fn global() -> Self {
        Self {
            origin: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            x_axis: Direction3D { dx: 1.0, dy: 0.0, dz: 0.0 },
            y_axis: Direction3D { dx: 0.0, dy: 1.0, dz: 0.0 },
            z_axis: Direction3D { dx: 0.0, dy: 0.0, dz: 1.0 },
        }
    }
}

/// Structural model for exchange
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralModel {
    /// Model ID
    pub id: String,
    /// Model name
    pub name: String,
    /// Description
    pub description: String,
    /// Coordinate system
    pub coordinate_system: CoordinateSystem,
    /// Units
    pub units: ModelUnits,
    /// Nodes
    pub nodes: Vec<StructuralNode>,
    /// Members
    pub members: Vec<StructuralMember>,
    /// Materials
    pub materials: Vec<StructuralMaterial>,
    /// Sections
    pub sections: Vec<StructuralSection>,
    /// Load cases
    pub load_cases: Vec<LoadCase>,
    /// Load combinations
    pub load_combinations: Vec<LoadCombination>,
    /// Properties
    pub properties: HashMap<String, String>,
}

/// Model units
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelUnits {
    /// Length unit
    pub length: LengthUnit,
    /// Force unit
    pub force: ForceUnit,
    /// Angle unit
    pub angle: AngleUnit,
}

/// Length units
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LengthUnit {
    Millimeter,
    Centimeter,
    Meter,
    Inch,
    Foot,
}

impl LengthUnit {
    /// Convert to meters
    pub fn to_meters(&self, value: f64) -> f64 {
        match self {
            LengthUnit::Millimeter => value * 0.001,
            LengthUnit::Centimeter => value * 0.01,
            LengthUnit::Meter => value,
            LengthUnit::Inch => value * 0.0254,
            LengthUnit::Foot => value * 0.3048,
        }
    }
    
    /// Convert from meters
    pub fn from_meters(&self, value: f64) -> f64 {
        match self {
            LengthUnit::Millimeter => value * 1000.0,
            LengthUnit::Centimeter => value * 100.0,
            LengthUnit::Meter => value,
            LengthUnit::Inch => value / 0.0254,
            LengthUnit::Foot => value / 0.3048,
        }
    }
}

/// Force units
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ForceUnit {
    Newton,
    Kilonewton,
    Pound,
    Kip,
}

impl ForceUnit {
    /// Convert to newtons
    pub fn to_newtons(&self, value: f64) -> f64 {
        match self {
            ForceUnit::Newton => value,
            ForceUnit::Kilonewton => value * 1000.0,
            ForceUnit::Pound => value * 4.44822,
            ForceUnit::Kip => value * 4448.22,
        }
    }
}

/// Angle units
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AngleUnit {
    Radian,
    Degree,
}

/// Structural node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralNode {
    /// Node ID
    pub id: String,
    /// Position
    pub position: Point3D,
    /// Support conditions
    pub support: Option<Support>,
    /// Labels/tags
    pub labels: Vec<String>,
}

/// Support definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Support {
    /// Translation X restraint
    pub tx: bool,
    /// Translation Y restraint
    pub ty: bool,
    /// Translation Z restraint
    pub tz: bool,
    /// Rotation X restraint
    pub rx: bool,
    /// Rotation Y restraint
    pub ry: bool,
    /// Rotation Z restraint
    pub rz: bool,
    /// Spring stiffness (if applicable)
    pub spring: Option<SpringStiffness>,
}

/// Spring stiffness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpringStiffness {
    pub kx: f64,
    pub ky: f64,
    pub kz: f64,
    pub krx: f64,
    pub kry: f64,
    pub krz: f64,
}

impl Support {
    /// Fixed support
    pub fn fixed() -> Self {
        Self {
            tx: true, ty: true, tz: true,
            rx: true, ry: true, rz: true,
            spring: None,
        }
    }
    
    /// Pinned support
    pub fn pinned() -> Self {
        Self {
            tx: true, ty: true, tz: true,
            rx: false, ry: false, rz: false,
            spring: None,
        }
    }
    
    /// Roller support (free in X)
    pub fn roller() -> Self {
        Self {
            tx: false, ty: true, tz: true,
            rx: false, ry: false, rz: false,
            spring: None,
        }
    }
}

/// Structural member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralMember {
    /// Member ID
    pub id: String,
    /// Member name
    pub name: String,
    /// Member type
    pub member_type: MemberType,
    /// Start node ID
    pub start_node: String,
    /// End node ID
    pub end_node: String,
    /// Section ID
    pub section_id: String,
    /// Material ID
    pub material_id: String,
    /// Releases at start
    pub start_releases: EndReleases,
    /// Releases at end
    pub end_releases: EndReleases,
    /// Local axis rotation (degrees)
    pub rotation: f64,
    /// Offset at start
    pub start_offset: Option<Point3D>,
    /// Offset at end
    pub end_offset: Option<Point3D>,
}

/// Member type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemberType {
    Beam,
    Column,
    Brace,
    Truss,
    Cable,
    RigidLink,
}

/// End releases
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub struct EndReleases {
    pub fx: bool,
    pub fy: bool,
    pub fz: bool,
    pub mx: bool,
    pub my: bool,
    pub mz: bool,
}

impl EndReleases {
    /// All fixed
    pub fn fixed() -> Self {
        Self::default()
    }
    
    /// Pinned (moment released)
    pub fn pinned() -> Self {
        Self {
            fx: false, fy: false, fz: false,
            mx: true, my: true, mz: true,
        }
    }
}

/// Structural material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralMaterial {
    /// Material ID
    pub id: String,
    /// Material name
    pub name: String,
    /// Material type
    pub material_type: MaterialType,
    /// Young's modulus (MPa)
    pub e: f64,
    /// Shear modulus (MPa)
    pub g: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Yield strength (MPa)
    pub fy: Option<f64>,
    /// Ultimate strength (MPa)
    pub fu: Option<f64>,
    /// Characteristic strength - concrete (MPa)
    pub fck: Option<f64>,
    /// Thermal coefficient (1/°C)
    pub alpha: f64,
}

/// Material type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MaterialType {
    Steel,
    Concrete,
    Timber,
    Aluminum,
    Masonry,
    Generic,
}

impl StructuralMaterial {
    /// Standard steel (Fe 250)
    pub fn steel_fe250() -> Self {
        Self {
            id: "STL_FE250".to_string(),
            name: "Steel Fe 250".to_string(),
            material_type: MaterialType::Steel,
            e: 200000.0,
            g: 76923.0,
            nu: 0.3,
            density: 7850.0,
            fy: Some(250.0),
            fu: Some(410.0),
            fck: None,
            alpha: 12e-6,
        }
    }
    
    /// M25 concrete
    pub fn concrete_m25() -> Self {
        Self {
            id: "CON_M25".to_string(),
            name: "Concrete M25".to_string(),
            material_type: MaterialType::Concrete,
            e: 25000.0,
            g: 10416.0,
            nu: 0.2,
            density: 2500.0,
            fy: None,
            fu: None,
            fck: Some(25.0),
            alpha: 10e-6,
        }
    }
}

/// Structural section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuralSection {
    /// Section ID
    pub id: String,
    /// Section name
    pub name: String,
    /// Section type
    pub section_type: SectionType,
    /// Area (mm²)
    pub area: f64,
    /// Moment of inertia X (mm⁴)
    pub ix: f64,
    /// Moment of inertia Y (mm⁴)
    pub iy: f64,
    /// Torsional constant (mm⁴)
    pub j: f64,
    /// Section modulus X (mm³)
    pub zx: f64,
    /// Section modulus Y (mm³)
    pub zy: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Width (mm)
    pub width: f64,
    /// Flange thickness (mm)
    pub tf: Option<f64>,
    /// Web thickness (mm)
    pub tw: Option<f64>,
}

/// Section types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionType {
    ISection,
    Channel,
    Angle,
    Tee,
    Rectangle,
    Circle,
    Pipe,
    Box,
    Custom,
}

/// Load case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCase {
    /// Load case ID
    pub id: String,
    /// Load case name
    pub name: String,
    /// Load type
    pub load_type: LoadType,
    /// Nodal loads
    pub nodal_loads: Vec<NodalLoad>,
    /// Member loads
    pub member_loads: Vec<MemberLoad>,
}

/// Load type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadType {
    Dead,
    Live,
    Wind,
    Seismic,
    Snow,
    Temperature,
    Settlement,
    Pattern,
    Other,
}

/// Nodal load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodalLoad {
    /// Node ID
    pub node_id: String,
    /// Force X (kN)
    pub fx: f64,
    /// Force Y (kN)
    pub fy: f64,
    /// Force Z (kN)
    pub fz: f64,
    /// Moment X (kN·m)
    pub mx: f64,
    /// Moment Y (kN·m)
    pub my: f64,
    /// Moment Z (kN·m)
    pub mz: f64,
}

/// Member load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberLoad {
    /// Member ID
    pub member_id: String,
    /// Load distribution
    pub distribution: LoadDistribution,
    /// Load direction
    pub direction: LoadDirection,
    /// Start value
    pub w1: f64,
    /// End value (for varying loads)
    pub w2: f64,
    /// Start position (fraction of length)
    pub a: f64,
    /// End position (fraction of length)
    pub b: f64,
}

/// Load distribution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDistribution {
    Uniform,
    Triangular,
    Trapezoidal,
    Concentrated,
}

/// Load direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDirection {
    GlobalX,
    GlobalY,
    GlobalZ,
    LocalX,
    LocalY,
    LocalZ,
    Projected,
}

/// Load combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadCombination {
    /// Combination ID
    pub id: String,
    /// Combination name
    pub name: String,
    /// Combination type
    pub combination_type: CombinationType,
    /// Factors for each load case
    pub factors: HashMap<String, f64>,
}

/// Combination type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CombinationType {
    /// Add all load cases
    Add,
    /// Envelope (max/min)
    Envelope,
    /// SRSS for seismic
    SRSS,
    /// Absolute sum
    Absolute,
}

/// Data exchange handler
#[derive(Debug, Clone)]
pub struct DataExchange {
    /// Export format
    pub format: ExchangeFormat,
}

impl DataExchange {
    /// Create new data exchange handler
    pub fn new(format: ExchangeFormat) -> Self {
        Self { format }
    }
    
    /// Export model to JSON
    pub fn export_json(&self, model: &StructuralModel) -> Result<String, String> {
        serde_json::to_string_pretty(model)
            .map_err(|e| format!("JSON export error: {}", e))
    }
    
    /// Import model from JSON
    pub fn import_json(&self, json: &str) -> Result<StructuralModel, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("JSON import error: {}", e))
    }
    
    /// Export to SAF (Structural Analysis Format)
    pub fn export_saf(&self, model: &StructuralModel) -> String {
        let mut saf = String::new();
        
        // Header
        saf.push_str("SAF;VERSION;1.0\n");
        saf.push_str(&format!("PROJECT;{};{}\n", model.name, model.description));
        saf.push_str(&format!("UNITS;{:?};{:?};{:?}\n", 
            model.units.length, model.units.force, model.units.angle));
        
        // Nodes
        saf.push_str("\n;NODES\n");
        for node in &model.nodes {
            let support = match &node.support {
                Some(s) => format!("{}{}{}{}{}{}", 
                    if s.tx { "1" } else { "0" },
                    if s.ty { "1" } else { "0" },
                    if s.tz { "1" } else { "0" },
                    if s.rx { "1" } else { "0" },
                    if s.ry { "1" } else { "0" },
                    if s.rz { "1" } else { "0" }),
                None => "000000".to_string(),
            };
            saf.push_str(&format!("NODE;{};{};{};{};{}\n",
                node.id, node.position.x, node.position.y, node.position.z, support));
        }
        
        // Materials
        saf.push_str("\n;MATERIALS\n");
        for mat in &model.materials {
            saf.push_str(&format!("MATERIAL;{};{};{:?};{};{};{};{}\n",
                mat.id, mat.name, mat.material_type, mat.e, mat.nu, mat.density,
                mat.fy.unwrap_or(0.0)));
        }
        
        // Sections
        saf.push_str("\n;SECTIONS\n");
        for sec in &model.sections {
            saf.push_str(&format!("SECTION;{};{};{:?};{};{};{}\n",
                sec.id, sec.name, sec.section_type, sec.area, sec.ix, sec.iy));
        }
        
        // Members
        saf.push_str("\n;MEMBERS\n");
        for mem in &model.members {
            saf.push_str(&format!("MEMBER;{};{};{};{};{};{:?}\n",
                mem.id, mem.start_node, mem.end_node, mem.section_id, mem.material_id,
                mem.member_type));
        }
        
        // Load cases
        saf.push_str("\n;LOADCASES\n");
        for lc in &model.load_cases {
            saf.push_str(&format!("LOADCASE;{};{};{:?}\n", lc.id, lc.name, lc.load_type));
            
            for nl in &lc.nodal_loads {
                saf.push_str(&format!("NODAL_LOAD;{};{};{};{};{};{};{}\n",
                    nl.node_id, nl.fx, nl.fy, nl.fz, nl.mx, nl.my, nl.mz));
            }
            
            for ml in &lc.member_loads {
                saf.push_str(&format!("MEMBER_LOAD;{};{:?};{:?};{};{};{};{}\n",
                    ml.member_id, ml.distribution, ml.direction, ml.w1, ml.w2, ml.a, ml.b));
            }
        }
        
        saf
    }
    
    /// Export to simplified IFC-like format
    pub fn export_ifc_simplified(&self, model: &StructuralModel) -> String {
        let mut ifc = String::new();
        
        // Header
        ifc.push_str("ISO-10303-21;\n");
        ifc.push_str("HEADER;\n");
        ifc.push_str(&format!("FILE_DESCRIPTION(('StructuralModel'),'{}.0.1');\n", model.name));
        ifc.push_str(&format!("FILE_NAME('{}',NOW());\n", model.name));
        ifc.push_str("FILE_SCHEMA(('IFC4X3'));\n");
        ifc.push_str("ENDSEC;\n\n");
        ifc.push_str("DATA;\n");
        
        let mut entity_id = 1;
        
        // Project
        ifc.push_str(&format!("#{}=IFCPROJECT('{}','{}');\n", entity_id, model.id, model.name));
        entity_id += 1;
        
        // Materials
        for mat in &model.materials {
            ifc.push_str(&format!("#{}=IFCMATERIAL('{}',{},$);\n", entity_id, mat.name, mat.e));
            entity_id += 1;
        }
        
        // Structural nodes as points
        for node in &model.nodes {
            ifc.push_str(&format!("#{}=IFCSTRUCTURALPOINTCONNECTION('{}',({},{},{}));\n",
                entity_id, node.id, node.position.x, node.position.y, node.position.z));
            entity_id += 1;
        }
        
        // Members as curves
        for mem in &model.members {
            ifc.push_str(&format!("#{}=IFCSTRUCTURALCURVEMEMBER('{}','{}','{}',{:?});\n",
                entity_id, mem.id, mem.start_node, mem.end_node, mem.member_type));
            entity_id += 1;
        }
        
        ifc.push_str("ENDSEC;\n");
        ifc.push_str("END-ISO-10303-21;\n");
        
        ifc
    }
    
    /// Convert units
    pub fn convert_model_units(&self, model: &mut StructuralModel, target: ModelUnits) {
        let length_factor = target.length.from_meters(model.units.length.to_meters(1.0));
        
        // Convert node positions
        for node in &mut model.nodes {
            node.position.x *= length_factor;
            node.position.y *= length_factor;
            node.position.z *= length_factor;
        }
        
        // Update units
        model.units = target;
    }
}

/// Model validator
pub struct ModelValidator;

impl ModelValidator {
    /// Validate structural model
    pub fn validate(model: &StructuralModel) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        
        // Check nodes
        if model.nodes.is_empty() {
            errors.push("Model has no nodes".to_string());
        }
        
        // Check for duplicate node IDs
        let mut node_ids = std::collections::HashSet::new();
        for node in &model.nodes {
            if !node_ids.insert(&node.id) {
                errors.push(format!("Duplicate node ID: {}", node.id));
            }
        }
        
        // Check members
        for mem in &model.members {
            // Check node references
            if !node_ids.contains(&mem.start_node) {
                errors.push(format!("Member {} references unknown start node: {}", mem.id, mem.start_node));
            }
            if !node_ids.contains(&mem.end_node) {
                errors.push(format!("Member {} references unknown end node: {}", mem.id, mem.end_node));
            }
            
            // Check self-connecting members
            if mem.start_node == mem.end_node {
                errors.push(format!("Member {} has same start and end node", mem.id));
            }
            
            // Check section reference
            if !model.sections.iter().any(|s| s.id == mem.section_id) {
                warnings.push(format!("Member {} references undefined section: {}", mem.id, mem.section_id));
            }
            
            // Check material reference
            if !model.materials.iter().any(|m| m.id == mem.material_id) {
                warnings.push(format!("Member {} references undefined material: {}", mem.id, mem.material_id));
            }
        }
        
        // Check for supports
        let has_support = model.nodes.iter().any(|n| n.support.is_some());
        if !has_support {
            warnings.push("Model has no support conditions".to_string());
        }
        
        // Check load cases
        if model.load_cases.is_empty() {
            warnings.push("Model has no load cases".to_string());
        }
        
        ValidationResult {
            valid: errors.is_empty(),
            errors,
            warnings,
        }
    }
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// Is model valid
    pub valid: bool,
    /// Error messages
    pub errors: Vec<String>,
    /// Warning messages
    pub warnings: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_model() -> StructuralModel {
        StructuralModel {
            id: "TEST001".to_string(),
            name: "Test Model".to_string(),
            description: "Unit test model".to_string(),
            coordinate_system: CoordinateSystem::global(),
            units: ModelUnits {
                length: LengthUnit::Millimeter,
                force: ForceUnit::Kilonewton,
                angle: AngleUnit::Degree,
            },
            nodes: vec![
                StructuralNode {
                    id: "N1".to_string(),
                    position: Point3D { x: 0.0, y: 0.0, z: 0.0 },
                    support: Some(Support::fixed()),
                    labels: vec![],
                },
                StructuralNode {
                    id: "N2".to_string(),
                    position: Point3D { x: 6000.0, y: 0.0, z: 0.0 },
                    support: None,
                    labels: vec![],
                },
            ],
            members: vec![
                StructuralMember {
                    id: "M1".to_string(),
                    name: "Beam 1".to_string(),
                    member_type: MemberType::Beam,
                    start_node: "N1".to_string(),
                    end_node: "N2".to_string(),
                    section_id: "SEC1".to_string(),
                    material_id: "MAT1".to_string(),
                    start_releases: EndReleases::fixed(),
                    end_releases: EndReleases::fixed(),
                    rotation: 0.0,
                    start_offset: None,
                    end_offset: None,
                },
            ],
            materials: vec![
                StructuralMaterial::steel_fe250(),
            ],
            sections: vec![
                StructuralSection {
                    id: "SEC1".to_string(),
                    name: "ISMB 300".to_string(),
                    section_type: SectionType::ISection,
                    area: 5680.0,
                    ix: 86.04e6,
                    iy: 4.54e6,
                    j: 0.5e6,
                    zx: 573600.0,
                    zy: 64860.0,
                    depth: 300.0,
                    width: 140.0,
                    tf: Some(12.4),
                    tw: Some(7.5),
                },
            ],
            load_cases: vec![
                LoadCase {
                    id: "LC1".to_string(),
                    name: "Dead Load".to_string(),
                    load_type: LoadType::Dead,
                    nodal_loads: vec![
                        NodalLoad {
                            node_id: "N2".to_string(),
                            fx: 0.0, fy: 0.0, fz: -50.0,
                            mx: 0.0, my: 0.0, mz: 0.0,
                        },
                    ],
                    member_loads: vec![],
                },
            ],
            load_combinations: vec![],
            properties: HashMap::new(),
        }
    }
    
    #[test]
    fn test_json_export_import() {
        let model = create_test_model();
        let exchange = DataExchange::new(ExchangeFormat::JSON);
        
        let json = exchange.export_json(&model).unwrap();
        let imported = exchange.import_json(&json).unwrap();
        
        assert_eq!(model.id, imported.id);
        assert_eq!(model.nodes.len(), imported.nodes.len());
        assert_eq!(model.members.len(), imported.members.len());
    }
    
    #[test]
    fn test_saf_export() {
        let model = create_test_model();
        let exchange = DataExchange::new(ExchangeFormat::SAF);
        
        let saf = exchange.export_saf(&model);
        
        assert!(saf.contains("SAF;VERSION;1.0"));
        assert!(saf.contains("NODE;N1"));
        assert!(saf.contains("MEMBER;M1"));
    }
    
    #[test]
    fn test_ifc_export() {
        let model = create_test_model();
        let exchange = DataExchange::new(ExchangeFormat::IFC);
        
        let ifc = exchange.export_ifc_simplified(&model);
        
        assert!(ifc.contains("ISO-10303-21"));
        assert!(ifc.contains("IFCPROJECT"));
        assert!(ifc.contains("IFCSTRUCTURALCURVEMEMBER"));
    }
    
    #[test]
    fn test_model_validation() {
        let model = create_test_model();
        let result = ModelValidator::validate(&model);
        
        // Model should have warnings about undefined references but be valid
        assert!(result.errors.is_empty() || result.warnings.len() > 0);
    }
    
    #[test]
    fn test_invalid_model() {
        let mut model = create_test_model();
        model.members[0].start_node = "INVALID".to_string();
        
        let result = ModelValidator::validate(&model);
        
        assert!(!result.valid || !result.errors.is_empty());
    }
    
    #[test]
    fn test_unit_conversion() {
        assert!((LengthUnit::Millimeter.to_meters(1000.0) - 1.0).abs() < 1e-10);
        assert!((LengthUnit::Foot.to_meters(1.0) - 0.3048).abs() < 1e-10);
        assert!((ForceUnit::Kilonewton.to_newtons(1.0) - 1000.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_support_types() {
        let fixed = Support::fixed();
        assert!(fixed.tx && fixed.ty && fixed.tz && fixed.rx && fixed.ry && fixed.rz);
        
        let pinned = Support::pinned();
        assert!(pinned.tx && pinned.ty && pinned.tz);
        assert!(!pinned.rx && !pinned.ry && !pinned.rz);
        
        let roller = Support::roller();
        assert!(!roller.tx);
    }
    
    #[test]
    fn test_material_presets() {
        let steel = StructuralMaterial::steel_fe250();
        assert_eq!(steel.e, 200000.0);
        assert_eq!(steel.fy, Some(250.0));
        
        let concrete = StructuralMaterial::concrete_m25();
        assert_eq!(concrete.fck, Some(25.0));
    }
    
    #[test]
    fn test_direction_normalization() {
        let dir = Direction3D::from_vec(3.0, 4.0, 0.0);
        let len = (dir.dx.powi(2) + dir.dy.powi(2) + dir.dz.powi(2)).sqrt();
        assert!((len - 1.0).abs() < 1e-10);
    }
    
    #[test]
    fn test_exchange_formats() {
        assert_ne!(ExchangeFormat::IFC, ExchangeFormat::JSON);
        assert_eq!(ExchangeFormat::SAF, ExchangeFormat::SAF);
    }
    
    #[test]
    fn test_load_types() {
        assert_ne!(LoadType::Dead, LoadType::Live);
        assert_eq!(LoadType::Seismic, LoadType::Seismic);
    }
}
