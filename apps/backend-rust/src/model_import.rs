//! Model Import Module - STAAD.Pro and IFC file parsers
//! 
//! Enables migration from existing structural analysis software
//! Supports: STAAD .std files, IFC 2x3/4, and generic JSON format

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};

pub use crate::model_import_types::{ImportError, ImportWarning};
pub use crate::model_import_staad::StaadParser;
pub use crate::model_import_ifc::IfcParser;
pub use crate::model_import_api::{detect_format, import_model};
pub use crate::model_import_validate::validate_model;

// ============================================================================
// IMPORTED MODEL STRUCTURES
// ============================================================================

/// Complete imported structural model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedModel {
    pub name: String,
    pub source_format: ImportFormat,
    pub units: UnitSystem,
    pub nodes: Vec<ImportedNode>,
    pub elements: Vec<ImportedElement>,
    pub materials: Vec<ImportedMaterial>,
    pub sections: Vec<ImportedSection>,
    pub supports: Vec<ImportedSupport>,
    pub load_cases: Vec<ImportedLoadCase>,
    pub load_combinations: Vec<ImportedLoadCombination>,
    pub warnings: Vec<ImportWarning>,
    pub errors: Vec<ImportError>,
}

/// Source file format
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ImportFormat {
    StaadStd,      // STAAD.Pro .std file
    StaadTxt,      // STAAD.Pro text input
    Ifc2x3,        // IFC 2x3 format
    Ifc4,          // IFC 4 format
    JsonGeneric,   // Generic JSON format
    CsvNodes,      // CSV node list
    Sap2000,       // SAP2000 s2k file
    Etabs,         // ETABS e2k file
}

/// Unit system
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct UnitSystem {
    pub length: LengthUnit,
    pub force: ForceUnit,
    pub temperature: TempUnit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LengthUnit { Meter, Millimeter, Centimeter, Feet, Inch }

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ForceUnit { Newton, KiloNewton, MegaNewton, Kilogram, Pound, Kip }

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TempUnit { Celsius, Fahrenheit, Kelvin }

impl Default for UnitSystem {
    fn default() -> Self {
        Self {
            length: LengthUnit::Meter,
            force: ForceUnit::KiloNewton,
            temperature: TempUnit::Celsius,
        }
    }
}

/// Imported node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedNode {
    pub id: usize,
    pub original_id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Imported element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedElement {
    pub id: usize,
    pub original_id: String,
    pub element_type: ImportedElementType,
    pub node_ids: Vec<usize>,
    pub material_id: Option<usize>,
    pub section_id: Option<usize>,
    pub releases: Option<EndReleases>,
    pub orientation_angle: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ImportedElementType {
    Beam,
    Column,
    Truss,
    Cable,
    Plate3,
    Plate4,
    Shell3,
    Shell4,
    Solid4,
    Solid8,
    Spring,
    Link,
}

/// End releases (hinges)
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct EndReleases {
    pub fx_i: bool, pub fy_i: bool, pub fz_i: bool,
    pub mx_i: bool, pub my_i: bool, pub mz_i: bool,
    pub fx_j: bool, pub fy_j: bool, pub fz_j: bool,
    pub mx_j: bool, pub my_j: bool, pub mz_j: bool,
}

/// Imported material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedMaterial {
    pub id: usize,
    pub name: String,
    pub material_type: MaterialType,
    pub e: f64,           // Elastic modulus (Pa)
    pub nu: f64,          // Poisson's ratio
    pub density: f64,     // kg/m³
    pub fy: Option<f64>,  // Yield strength
    pub fu: Option<f64>,  // Ultimate strength
    pub fck: Option<f64>, // Concrete characteristic strength
    pub alpha: f64,       // Thermal expansion coefficient
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum MaterialType {
    Steel,
    Concrete,
    Aluminum,
    Timber,
    Custom,
}

/// Imported section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedSection {
    pub id: usize,
    pub name: String,
    pub section_type: SectionType,
    pub area: f64,
    pub ixx: f64,
    pub iyy: f64,
    pub izz: f64,
    pub j: f64,
    pub depth: Option<f64>,
    pub width: Option<f64>,
    pub tw: Option<f64>,
    pub tf: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum SectionType {
    ISection,
    Channel,
    Angle,
    Tube,
    Pipe,
    Rectangle,
    Circle,
    TSection,
    Custom,
}

/// Imported support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedSupport {
    pub node_id: usize,
    pub fx: bool,
    pub fy: bool,
    pub fz: bool,
    pub mx: bool,
    pub my: bool,
    pub mz: bool,
    pub spring_stiffness: Option<[f64; 6]>, // Spring supports
}

/// Imported load case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedLoadCase {
    pub id: usize,
    pub name: String,
    pub load_type: LoadCaseType,
    pub loads: Vec<ImportedLoad>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LoadCaseType {
    Dead,
    Live,
    Wind,
    Seismic,
    Snow,
    Temperature,
    Other,
}

/// Individual load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportedLoad {
    NodalForce {
        node_id: usize,
        fx: f64, fy: f64, fz: f64,
        mx: f64, my: f64, mz: f64,
    },
    MemberUniform {
        element_id: usize,
        wx: f64, wy: f64, wz: f64,
        direction: LoadDirection,
    },
    MemberPoint {
        element_id: usize,
        distance: f64,
        fx: f64, fy: f64, fz: f64,
        direction: LoadDirection,
    },
    MemberMoment {
        element_id: usize,
        distance: f64,
        mx: f64, my: f64, mz: f64,
    },
    AreaUniform {
        element_id: usize,
        pressure: f64,
        direction: LoadDirection,
    },
    SelfWeight {
        factor_x: f64,
        factor_y: f64,
        factor_z: f64,
    },
    Temperature {
        element_id: usize,
        delta_t: f64,
        gradient_y: Option<f64>,
        gradient_z: Option<f64>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LoadDirection {
    Global,
    Local,
    Projected,
}

/// Load combination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedLoadCombination {
    pub id: usize,
    pub name: String,
    pub combination_type: CombinationType,
    pub factors: Vec<(usize, f64)>, // (load_case_id, factor)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CombinationType {
    Linear,
    Envelope,
    AbsoluteSum,
    Srss,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_staad_parser_basic() {
        let input = r#"
STAAD SPACE
UNIT METER KN
JOINT COORDINATES
1 0 0 0; 2 5 0 0; 3 10 0 0
MEMBER INCIDENCES
1 1 2; 2 2 3
CONSTANTS
E 2.1E11 ALL
SUPPORTS
1 FIXED
3 PINNED
LOAD 1 DEAD LOAD
SELFWEIGHT Y -1
MEMBER LOAD
1 2 UNI GY -10
PERFORM ANALYSIS
FINISH
"#;
        
        let mut parser = StaadParser::new();
        let model = parser.parse(input.as_bytes()).unwrap();
        
        assert_eq!(model.nodes.len(), 3);
        assert_eq!(model.elements.len(), 2);
        assert_eq!(model.supports.len(), 2);
        assert_eq!(model.load_cases.len(), 1);
    }

    #[test]
    fn test_staad_parser_units() {
        let input = r#"
STAAD SPACE
UNIT FT KIP
JOINT COORDINATES
1 0 0 0; 2 10 0 0
"#;
        
        let mut parser = StaadParser::new();
        let model = parser.parse(input.as_bytes()).unwrap();
        
        // 10 feet = 3.048 meters
        let node2 = model.nodes.iter().find(|n| n.id == 2).unwrap();
        assert!((node2.x - 3.048).abs() < 0.001);
    }

    #[test]
    fn test_staad_parser_member_property() {
        let input = r#"
STAAD SPACE
UNIT METER KN
JOINT COORDINATES
1 0 0 0; 2 5 0 0
MEMBER INCIDENCES
1 1 2
MEMBER PROPERTY AMERICAN
1 TABLE ST W12X26
"#;
        
        let mut parser = StaadParser::new();
        let model = parser.parse(input.as_bytes()).unwrap();
        
        assert!(!model.sections.is_empty());
    }

    #[test]
    fn test_staad_parser_loads() {
        let input = r#"
STAAD SPACE
UNIT METER KN
JOINT COORDINATES
1 0 0 0; 2 5 0 0
MEMBER INCIDENCES
1 1 2
SUPPORTS
1 FIXED
LOAD 1 DEAD
JOINT LOAD
2 FY -100
LOAD 2 LIVE
MEMBER LOAD
1 UNI GY -20
"#;
        
        let mut parser = StaadParser::new();
        let model = parser.parse(input.as_bytes()).unwrap();
        
        assert_eq!(model.load_cases.len(), 2);
        
        // Check dead load has joint load
        let dead = &model.load_cases[0];
        assert!(dead.loads.iter().any(|l| matches!(l, ImportedLoad::NodalForce { .. })));
        
        // Check live load has member load
        let live = &model.load_cases[1];
        assert!(live.loads.iter().any(|l| matches!(l, ImportedLoad::MemberUniform { .. })));
    }

    #[test]
    fn test_ifc_parser_basic() {
        let input = r#"
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('IFC4'),'2;1');
FILE_NAME('test.ifc','2026-01-27');
ENDSEC;
DATA;
#1=IFCCARTESIANPOINT((0.,0.,0.));
#2=IFCCARTESIANPOINT((5000.,0.,0.));
#3=IFCCARTESIANPOINT((10000.,0.,0.));
#10=IFCMATERIAL('Steel S355');
ENDSEC;
END-ISO-10303-21;
"#;
        
        let mut parser = IfcParser::new();
        let model = parser.parse(input.as_bytes()).unwrap();
        
        assert_eq!(model.nodes.len(), 3);
        assert!(!model.materials.is_empty());
    }

    #[test]
    fn test_format_detection() {
        assert_eq!(detect_format("STAAD SPACE"), ImportFormat::StaadTxt);
        assert_eq!(detect_format("ISO-10303-21;"), ImportFormat::Ifc2x3);
        assert_eq!(detect_format("{\"nodes\": []}"), ImportFormat::JsonGeneric);
    }

    #[test]
    fn test_model_validation() {
        let model = ImportedModel {
            name: "Test".to_string(),
            source_format: ImportFormat::StaadTxt,
            units: UnitSystem::default(),
            nodes: vec![
                ImportedNode { id: 1, original_id: "1".to_string(), x: 0.0, y: 0.0, z: 0.0 },
                ImportedNode { id: 2, original_id: "2".to_string(), x: 5.0, y: 0.0, z: 0.0 },
                ImportedNode { id: 3, original_id: "3".to_string(), x: 10.0, y: 0.0, z: 0.0 },
            ],
            elements: vec![
                ImportedElement {
                    id: 1,
                    original_id: "1".to_string(),
                    element_type: ImportedElementType::Beam,
                    node_ids: vec![1, 2],
                    material_id: None,
                    section_id: None,
                    releases: None,
                    orientation_angle: 0.0,
                },
            ],
            materials: vec![],
            sections: vec![],
            supports: vec![],
            load_cases: vec![],
            load_combinations: vec![],
            warnings: vec![],
            errors: vec![],
        };
        
        let warnings = validate_model(&model);
        
        // Should warn about orphan node 3
        assert!(warnings.iter().any(|w| w.code == "W001" && w.message.contains("3")));
        
        // Should warn about no supports
        assert!(warnings.iter().any(|w| w.code == "W002"));
    }

    #[test]
    fn test_unit_conversion() {
        let staad = r#"
UNIT FT KIP
JOINT COORDINATES
1 10 0 0
"#;

        let mut parser = StaadParser::new();
        let model = parser
            .parse(staad.as_bytes())
            .expect("STAAD parse should succeed");

        // 10 feet = 3.048 meters after SI conversion in parser output.
        assert_eq!(model.nodes.len(), 1);
        assert!((model.nodes[0].x - 3.048).abs() < 0.001);
    }

    #[test]
    fn test_json_import() {
        let json = r#"{
            "name": "Test Model",
            "source_format": "JsonGeneric",
            "units": { "length": "Meter", "force": "KiloNewton", "temperature": "Celsius" },
            "nodes": [
                { "id": 1, "original_id": "1", "x": 0, "y": 0, "z": 0 },
                { "id": 2, "original_id": "2", "x": 5, "y": 0, "z": 0 }
            ],
            "elements": [],
            "materials": [],
            "sections": [],
            "supports": [],
            "load_cases": [],
            "load_combinations": [],
            "warnings": [],
            "errors": []
        }"#;
        
        let model = import_model(json, ImportFormat::JsonGeneric).unwrap();
        assert_eq!(model.nodes.len(), 2);
    }
}
