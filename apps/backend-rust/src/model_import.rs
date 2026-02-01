//! Model Import Module - STAAD.Pro and IFC file parsers
//! 
//! Enables migration from existing structural analysis software
//! Supports: STAAD .std files, IFC 2x3/4, and generic JSON format

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};

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

/// Import warning (non-fatal)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportWarning {
    pub code: String,
    pub message: String,
    pub line: Option<usize>,
    pub element_id: Option<String>,
}

/// Import error (fatal for element)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportError {
    pub code: String,
    pub message: String,
    pub line: Option<usize>,
    pub element_id: Option<String>,
}

// ============================================================================
// STAAD.Pro TEXT FILE PARSER
// ============================================================================

/// STAAD.Pro text input file parser
pub struct StaadParser {
    units: UnitSystem,
    nodes: HashMap<usize, ImportedNode>,
    elements: Vec<ImportedElement>,
    materials: Vec<ImportedMaterial>,
    sections: Vec<ImportedSection>,
    supports: Vec<ImportedSupport>,
    load_cases: Vec<ImportedLoadCase>,
    combinations: Vec<ImportedLoadCombination>,
    warnings: Vec<ImportWarning>,
    errors: Vec<ImportError>,
    current_load_case: Option<usize>,
    line_number: usize,
}

impl StaadParser {
    pub fn new() -> Self {
        Self {
            units: UnitSystem::default(),
            nodes: HashMap::new(),
            elements: Vec::new(),
            materials: Vec::new(),
            sections: Vec::new(),
            supports: Vec::new(),
            load_cases: Vec::new(),
            combinations: Vec::new(),
            warnings: Vec::new(),
            errors: Vec::new(),
            current_load_case: None,
            line_number: 0,
        }
    }

    /// Parse STAAD text input
    pub fn parse<R: Read>(&mut self, reader: R) -> Result<ImportedModel, String> {
        let buf_reader = BufReader::new(reader);
        
        for line in buf_reader.lines() {
            self.line_number += 1;
            if let Ok(content) = line {
                self.parse_line(&content);
            }
        }
        
        Ok(self.build_model())
    }

    fn parse_line(&mut self, line: &str) {
        let line = line.trim();
        if line.is_empty() || line.starts_with('*') || line.starts_with(';') {
            return; // Skip comments and empty lines
        }

        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.is_empty() {
            return;
        }

        // Handle multi-word commands first
        if tokens[0] == "MEMBER" && tokens.len() > 1 {
            if tokens[1] == "PROPERTY" {
                self.parse_member_property(line);
                return;
            } else if tokens[1] == "LOAD" {
                self.parse_member_load(line);
                return;
            }
        }
        
        if tokens[0] == "JOINT" && tokens.len() > 1 && tokens[1] == "LOAD" {
            self.parse_joint_load(line);
            return;
        }
        
        if tokens[0] == "LOAD" && tokens.len() > 1 && tokens[1] == "COMBINATION" {
            self.parse_load_combination(line);
            return;
        }

        match tokens[0] {
            "STAAD" => self.parse_staad_header(&tokens),
            "UNIT" => self.parse_units(&tokens),
            "JOINT" => self.parse_joint_coordinates(line),
            "MEMBER" => self.parse_member_incidences(line),
            "ELEMENT" => self.parse_element_incidences(line),
            "DEFINE" => self.parse_define(&tokens),
            "CONSTANTS" => self.parse_constants(line),
            "SUPPORTS" => self.parse_supports(line),
            "LOAD" => self.parse_load_case(&tokens, line),
            "SELFWEIGHT" => self.parse_selfweight(&tokens),
            "PERFORM" | "ANALYSIS" | "PRINT" | "FINISH" => {
                // Commands we acknowledge but don't process
            }
            _ => {
                // Try to parse as continuation of previous command
                self.parse_continuation(line);
            }
        }
    }

    fn parse_staad_header(&mut self, tokens: &[&str]) {
        // STAAD SPACE / STAAD PLANE / STAAD FLOOR
        if tokens.len() > 1 {
            match tokens[1] {
                "SPACE" => { /* 3D analysis */ }
                "PLANE" => { /* 2D frame analysis */ }
                "FLOOR" => { /* Floor analysis */ }
                _ => {}
            }
        }
    }

    fn parse_units(&mut self, tokens: &[&str]) {
        // UNIT METER KN / UNIT FT KIP / etc.
        for token in tokens.iter().skip(1) {
            match *token {
                "METER" | "MET" | "M" => self.units.length = LengthUnit::Meter,
                "MM" | "MILLIMETER" => self.units.length = LengthUnit::Millimeter,
                "CM" | "CENTIMETER" => self.units.length = LengthUnit::Centimeter,
                "FT" | "FEET" | "FOOT" => self.units.length = LengthUnit::Feet,
                "IN" | "INCH" => self.units.length = LengthUnit::Inch,
                "KN" | "KILONEWTON" => self.units.force = ForceUnit::KiloNewton,
                "N" | "NEWTON" => self.units.force = ForceUnit::Newton,
                "KIP" => self.units.force = ForceUnit::Kip,
                "LB" | "POUND" => self.units.force = ForceUnit::Pound,
                "KG" | "KILOGRAM" => self.units.force = ForceUnit::Kilogram,
                _ => {}
            }
        }
    }

    fn parse_joint_coordinates(&mut self, line: &str) {
        // JOINT COORDINATES
        // 1 0 0 0; 2 5 0 0; 3 10 0 0
        // or: 1 0 0 0  2 5 0 0  3 10 0 0
        
        let parts: Vec<&str> = line.split(|c| c == ';' || c == '\t')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().starts_with("JOINT"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 4 {
                if let (Ok(id), Ok(x), Ok(y), Ok(z)) = (
                    tokens[0].parse::<usize>(),
                    tokens[1].parse::<f64>(),
                    tokens[2].parse::<f64>(),
                    tokens[3].parse::<f64>(),
                ) {
                    let x_conv = self.convert_length(x);
                    let y_conv = self.convert_length(y);
                    let z_conv = self.convert_length(z);
                    
                    self.nodes.insert(id, ImportedNode {
                        id,
                        original_id: tokens[0].to_string(),
                        x: x_conv,
                        y: y_conv,
                        z: z_conv,
                    });
                }
            }
        }
    }

    fn parse_member_incidences(&mut self, line: &str) {
        // MEMBER INCIDENCES
        // 1 1 2; 2 2 3; 3 3 4
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().contains("MEMBER") && !s.to_uppercase().contains("INCIDENCE"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 3 {
                if let (Ok(id), Ok(n1), Ok(n2)) = (
                    tokens[0].parse::<usize>(),
                    tokens[1].parse::<usize>(),
                    tokens[2].parse::<usize>(),
                ) {
                    self.elements.push(ImportedElement {
                        id,
                        original_id: tokens[0].to_string(),
                        element_type: ImportedElementType::Beam,
                        node_ids: vec![n1, n2],
                        material_id: None,
                        section_id: None,
                        releases: None,
                        orientation_angle: 0.0,
                    });
                }
            }
        }
    }

    fn parse_element_incidences(&mut self, line: &str) {
        // ELEMENT INCIDENCES SHELL
        // 1 1 2 5 4; 2 2 3 6 5
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty() && !s.to_uppercase().contains("ELEMENT") && !s.to_uppercase().contains("INCIDENCE"))
            .collect();

        for part in parts {
            let tokens: Vec<&str> = part.split_whitespace().collect();
            if tokens.len() >= 4 {
                if let Ok(_id) = tokens[0].parse::<usize>() {
                    let node_ids: Vec<usize> = tokens[1..]
                        .iter()
                        .filter_map(|t| t.parse().ok())
                        .collect();
                    
                    let element_type = match node_ids.len() {
                        3 => ImportedElementType::Plate3,
                        4 => ImportedElementType::Plate4,
                        8 => ImportedElementType::Solid8,
                        _ => ImportedElementType::Plate4,
                    };
                    
                    self.elements.push(ImportedElement {
                        id: self.elements.len() + 1,
                        original_id: tokens[0].to_string(),
                        element_type,
                        node_ids,
                        material_id: None,
                        section_id: None,
                        releases: None,
                        orientation_angle: 0.0,
                    });
                }
            }
        }
    }

    fn parse_define(&mut self, tokens: &[&str]) {
        // DEFINE MATERIAL START
        if tokens.len() > 1 && tokens[1] == "MATERIAL" {
            // Material definition starts
        }
    }

    fn parse_constants(&mut self, line: &str) {
        // CONSTANTS
        // E 2.1E11 ALL
        // POISSON 0.3 ALL
        // DENSITY 7850 ALL
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.len() >= 3 {
            let value: f64 = tokens[1].parse().unwrap_or(0.0);
            
            // Create or update default material
            if self.materials.is_empty() {
                self.materials.push(ImportedMaterial {
                    id: 1,
                    name: "STEEL".to_string(),
                    material_type: MaterialType::Steel,
                    e: 2.1e11,
                    nu: 0.3,
                    density: 7850.0,
                    fy: Some(250e6),
                    fu: Some(410e6),
                    fck: None,
                    alpha: 12e-6,
                });
            }
            
            match tokens[0] {
                "E" => self.materials[0].e = value,
                "POISSON" => self.materials[0].nu = value,
                "DENSITY" => self.materials[0].density = value,
                _ => {}
            }
        }
    }

    fn parse_member_property(&mut self, line: &str) {
        // MEMBER PROPERTY AMERICAN
        // 1 TO 10 TABLE ST W12X26
        // 11 12 PRIS YD 0.5 ZD 0.3
        
        let upper = line.to_uppercase();
        
        if upper.contains("TABLE") {
            // Standard section
            if let Some(idx) = upper.find("TABLE") {
                let section_part = &upper[idx..];
                let tokens: Vec<&str> = section_part.split_whitespace().collect();
                if tokens.len() >= 3 {
                    let section_name = format!("{} {}", tokens[1], tokens[2]);
                    self.add_section(&section_name);
                }
            }
        } else if upper.contains("PRIS") {
            // Prismatic section
            self.parse_prismatic_section(&upper);
        }
    }

    fn parse_prismatic_section(&mut self, line: &str) {
        // PRIS YD 0.5 ZD 0.3  or  PRIS AX 0.01 IX 0.001 IY 0.0005 IZ 0.0005
        let tokens: Vec<&str> = line.split_whitespace().collect();
        
        let mut area = 0.01;
        let mut ixx = 0.001;
        let mut iyy = 0.0005;
        let mut izz = 0.0005;
        let mut depth = 0.5;
        let mut width = 0.3;
        
        let mut i = 0;
        while i < tokens.len() - 1 {
            match tokens[i] {
                "AX" => area = tokens[i + 1].parse().unwrap_or(area),
                "IX" => ixx = tokens[i + 1].parse().unwrap_or(ixx),
                "IY" => iyy = tokens[i + 1].parse().unwrap_or(iyy),
                "IZ" => izz = tokens[i + 1].parse().unwrap_or(izz),
                "YD" => depth = tokens[i + 1].parse().unwrap_or(depth),
                "ZD" => width = tokens[i + 1].parse().unwrap_or(width),
                _ => {}
            }
            i += 1;
        }
        
        self.sections.push(ImportedSection {
            id: self.sections.len() + 1,
            name: format!("PRIS_{}", self.sections.len() + 1),
            section_type: SectionType::Rectangle,
            area: self.convert_area(area),
            ixx: self.convert_inertia(ixx),
            iyy: self.convert_inertia(iyy),
            izz: self.convert_inertia(izz),
            j: self.convert_inertia(ixx + iyy),
            depth: Some(self.convert_length(depth)),
            width: Some(self.convert_length(width)),
            tw: None,
            tf: None,
        });
    }

    fn add_section(&mut self, name: &str) {
        // Lookup standard section from database
        let (area, ixx, iyy, depth, width) = self.lookup_section(name);
        
        self.sections.push(ImportedSection {
            id: self.sections.len() + 1,
            name: name.to_string(),
            section_type: if name.contains('W') || name.contains("ISMB") {
                SectionType::ISection
            } else if name.contains('C') || name.contains("ISMC") {
                SectionType::Channel
            } else {
                SectionType::Custom
            },
            area,
            ixx,
            iyy,
            izz: iyy,
            j: ixx + iyy,
            depth: Some(depth),
            width: Some(width),
            tw: None,
            tf: None,
        });
    }

    fn lookup_section(&self, name: &str) -> (f64, f64, f64, f64, f64) {
        // Common section database (area m², Ixx m⁴, Iyy m⁴, depth m, width m)
        match name.trim() {
            "ST W12X26" | "W12X26" => (4.94e-3, 1.04e-4, 1.70e-5, 0.310, 0.165),
            "ST W14X30" | "W14X30" => (5.68e-3, 1.58e-4, 2.15e-5, 0.352, 0.171),
            "ST W16X36" | "W16X36" => (6.84e-3, 2.48e-4, 2.45e-5, 0.406, 0.178),
            "ST W18X50" | "W18X50" => (9.48e-3, 4.00e-4, 3.37e-5, 0.457, 0.190),
            "ST W21X62" | "W21X62" => (1.18e-2, 5.54e-4, 4.12e-5, 0.533, 0.210),
            "ISMB 300" => (5.87e-3, 8.60e-5, 4.54e-6, 0.300, 0.140),
            "ISMB 400" => (7.84e-3, 2.04e-4, 6.22e-6, 0.400, 0.140),
            "ISMB 500" => (1.10e-2, 4.52e-4, 1.37e-5, 0.500, 0.180),
            _ => (1.0e-2, 1.0e-4, 1.0e-5, 0.300, 0.150), // Default
        }
    }

    fn parse_supports(&mut self, line: &str) {
        // SUPPORTS
        // 1 4 FIXED
        // 2 3 PINNED
        // 5 FIXED BUT MZ
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if tokens.len() < 2 {
            return;
        }
        
        // Find support type
        let is_fixed = upper.contains("FIXED");
        let is_pinned = upper.contains("PINNED");
        let has_but = upper.contains("BUT");
        
        // Parse node IDs (before FIXED/PINNED keyword)
        let mut node_ids: Vec<usize> = Vec::new();
        for token in &tokens {
            if let Ok(id) = token.parse::<usize>() {
                node_ids.push(id);
            } else if *token == "FIXED" || *token == "PINNED" || *token == "BUT" {
                break;
            } else if *token == "TO" {
                // Handle range: 1 TO 5
                continue;
            }
        }
        
        // Parse releases after BUT
        let mut releases = [false; 6]; // FX, FY, FZ, MX, MY, MZ
        if has_but {
            if upper.contains("FX") { releases[0] = true; }
            if upper.contains("FY") { releases[1] = true; }
            if upper.contains("FZ") { releases[2] = true; }
            if upper.contains("MX") { releases[3] = true; }
            if upper.contains("MY") { releases[4] = true; }
            if upper.contains("MZ") { releases[5] = true; }
        }
        
        // Create supports
        for node_id in node_ids {
            let (fx, fy, fz, mx, my, mz) = if is_fixed {
                (!releases[0], !releases[1], !releases[2], 
                 !releases[3], !releases[4], !releases[5])
            } else if is_pinned {
                (true, true, true, false, false, false)
            } else {
                (true, true, true, true, true, true)
            };
            
            self.supports.push(ImportedSupport {
                node_id,
                fx, fy, fz, mx, my, mz,
                spring_stiffness: None,
            });
        }
    }

    fn parse_load_case(&mut self, tokens: &[&str], line: &str) {
        // LOAD 1 DEAD LOAD
        // LOAD 2 LIVE LOAD
        
        if tokens.len() >= 2 {
            if let Ok(id) = tokens[1].parse::<usize>() {
                let name = if tokens.len() > 2 {
                    tokens[2..].join(" ")
                } else {
                    format!("LOAD {}", id)
                };
                
                let load_type = if line.to_uppercase().contains("DEAD") {
                    LoadCaseType::Dead
                } else if line.to_uppercase().contains("LIVE") {
                    LoadCaseType::Live
                } else if line.to_uppercase().contains("WIND") {
                    LoadCaseType::Wind
                } else if line.to_uppercase().contains("SEISMIC") || line.to_uppercase().contains("EQ") {
                    LoadCaseType::Seismic
                } else {
                    LoadCaseType::Other
                };
                
                self.load_cases.push(ImportedLoadCase {
                    id,
                    name,
                    load_type,
                    loads: Vec::new(),
                });
                self.current_load_case = Some(self.load_cases.len() - 1);
            }
        }
    }

    fn parse_member_load(&mut self, line: &str) {
        // MEMBER LOAD
        // 1 TO 10 UNI GY -25
        // 5 CON GY -50 2.5
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if let Some(lc_idx) = self.current_load_case {
            // Find load type position
            let uni_pos = tokens.iter().position(|&t| t == "UNI" || t == "UNIFORM");
            let con_pos = tokens.iter().position(|&t| t == "CON" || t == "CONCENTRATED");
            
            // Parse member IDs (before load type)
            let end_pos = uni_pos.or(con_pos).unwrap_or(tokens.len());
            let mut member_ids: Vec<usize> = Vec::new();
            let mut i = 0;
            while i < end_pos {
                if tokens[i] == "MEMBER" || tokens[i] == "LOAD" {
                    i += 1;
                    continue;
                }
                if let Ok(id) = tokens[i].parse::<usize>() {
                    member_ids.push(id);
                    // Handle TO ranges
                    if i + 2 < end_pos && tokens[i + 1] == "TO" {
                        if let Ok(end_id) = tokens[i + 2].parse::<usize>() {
                            for mid in (id + 1)..=end_id {
                                member_ids.push(mid);
                            }
                            i += 2;
                        }
                    }
                }
                i += 1;
            }
            
            // Parse load values
            if let Some(pos) = uni_pos {
                // UNI GY -25
                if pos + 2 < tokens.len() {
                    let direction = tokens[pos + 1];
                    let value: f64 = tokens[pos + 2].parse().unwrap_or(0.0);
                    let value_conv = self.convert_force_per_length(value);
                    
                    let (wx, wy, wz) = match direction {
                        "GX" => (value_conv, 0.0, 0.0),
                        "GY" => (0.0, value_conv, 0.0),
                        "GZ" => (0.0, 0.0, value_conv),
                        "X" => (value_conv, 0.0, 0.0),
                        "Y" => (0.0, value_conv, 0.0),
                        "Z" => (0.0, 0.0, value_conv),
                        _ => (0.0, value_conv, 0.0),
                    };
                    
                    for member_id in &member_ids {
                        self.load_cases[lc_idx].loads.push(ImportedLoad::MemberUniform {
                            element_id: *member_id,
                            wx, wy, wz,
                            direction: if direction.starts_with('G') { 
                                LoadDirection::Global 
                            } else { 
                                LoadDirection::Local 
                            },
                        });
                    }
                }
            }
            
            if let Some(pos) = con_pos {
                // CON GY -50 2.5
                if pos + 3 < tokens.len() {
                    let direction = tokens[pos + 1];
                    let value: f64 = tokens[pos + 2].parse().unwrap_or(0.0);
                    let distance: f64 = tokens[pos + 3].parse().unwrap_or(0.0);
                    let value_conv = self.convert_force(value);
                    let dist_conv = self.convert_length(distance);
                    
                    let (fx, fy, fz) = match direction {
                        "GX" | "X" => (value_conv, 0.0, 0.0),
                        "GY" | "Y" => (0.0, value_conv, 0.0),
                        "GZ" | "Z" => (0.0, 0.0, value_conv),
                        _ => (0.0, value_conv, 0.0),
                    };
                    
                    for member_id in &member_ids {
                        self.load_cases[lc_idx].loads.push(ImportedLoad::MemberPoint {
                            element_id: *member_id,
                            distance: dist_conv,
                            fx, fy, fz,
                            direction: LoadDirection::Global,
                        });
                    }
                }
            }
        }
    }

    fn parse_joint_load(&mut self, line: &str) {
        // JOINT LOAD
        // 5 FY -100 MZ 50
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        if let Some(lc_idx) = self.current_load_case {
            let mut node_ids: Vec<usize> = Vec::new();
            let mut fx = 0.0;
            let mut fy = 0.0;
            let mut fz = 0.0;
            let mut mx = 0.0;
            let mut my = 0.0;
            let mut mz = 0.0;
            
            let mut i = 0;
            while i < tokens.len() {
                if tokens[i] == "JOINT" || tokens[i] == "LOAD" {
                    i += 1;
                    continue;
                }
                
                if let Ok(id) = tokens[i].parse::<usize>() {
                    node_ids.push(id);
                } else if i + 1 < tokens.len() {
                    let val: f64 = tokens[i + 1].parse().unwrap_or(0.0);
                    match tokens[i] {
                        "FX" => fx = self.convert_force(val),
                        "FY" => fy = self.convert_force(val),
                        "FZ" => fz = self.convert_force(val),
                        "MX" => mx = self.convert_moment(val),
                        "MY" => my = self.convert_moment(val),
                        "MZ" => mz = self.convert_moment(val),
                        _ => {}
                    }
                    i += 1;
                }
                i += 1;
            }
            
            for node_id in node_ids {
                self.load_cases[lc_idx].loads.push(ImportedLoad::NodalForce {
                    node_id,
                    fx, fy, fz, mx, my, mz,
                });
            }
        }
    }

    fn parse_selfweight(&mut self, tokens: &[&str]) {
        // SELFWEIGHT Y -1
        
        if let Some(lc_idx) = self.current_load_case {
            let mut factor_x = 0.0;
            let mut factor_y = 0.0;
            let mut factor_z = 0.0;
            
            if tokens.len() >= 3 {
                let factor: f64 = tokens[2].parse().unwrap_or(-1.0);
                match tokens[1] {
                    "X" => factor_x = factor,
                    "Y" => factor_y = factor,
                    "Z" => factor_z = factor,
                    _ => factor_y = -1.0,
                }
            } else {
                factor_y = -1.0;
            }
            
            self.load_cases[lc_idx].loads.push(ImportedLoad::SelfWeight {
                factor_x, factor_y, factor_z,
            });
        }
    }

    fn parse_load_combination(&mut self, line: &str) {
        // LOAD COMBINATION 10
        // 1 1.5 2 1.5 3 0.9
        
        let upper = line.to_uppercase();
        let tokens: Vec<&str> = upper.split_whitespace().collect();
        
        // Find combination ID
        if let Some(pos) = tokens.iter().position(|&t| t == "COMBINATION") {
            if pos + 1 < tokens.len() {
                if let Ok(id) = tokens[pos + 1].parse::<usize>() {
                    self.combinations.push(ImportedLoadCombination {
                        id,
                        name: format!("COMBINATION {}", id),
                        combination_type: CombinationType::Linear,
                        factors: Vec::new(),
                    });
                }
            }
        }
    }

    fn parse_continuation(&mut self, line: &str) {
        // Parse continuation lines (e.g., joint coordinates, combination factors)
        // Handle semicolon-separated entries like "1 0 0 0; 2 5 0 0; 3 10 0 0"
        let upper = line.to_uppercase();
        let _tokens: Vec<&str> = upper.split_whitespace().collect();
        
        // Handle section table assignments: "1 TABLE ST W12X26" or "1 TO 10 TABLE ST W12X26"
        if upper.contains("TABLE") {
            if let Some(idx) = upper.find("TABLE") {
                let section_part = &upper[idx..];
                let section_tokens: Vec<&str> = section_part.split_whitespace().collect();
                if section_tokens.len() >= 3 {
                    let section_name = format!("{} {}", section_tokens[1], section_tokens[2]);
                    self.add_section(&section_name);
                }
            }
            return;
        }
        
        // Handle prismatic sections: "1 PRIS YD 0.5 ZD 0.3"
        if upper.contains("PRIS") {
            self.parse_prismatic_section(&upper);
            return;
        }
        
        // Handle supports: "1 FIXED" or "3 PINNED" or "5 FIXED BUT MZ"
        if upper.contains("FIXED") || upper.contains("PINNED") {
            self.parse_supports(line);
            return;
        }
        
        // Handle joint loads: "2 FY -100" or "5 FX 10 FY -50 MZ 25"
        // But NOT if it contains FIXED/PINNED (those are support definitions)
        if (upper.contains("FX") || upper.contains("FY") || upper.contains("FZ") 
            || upper.contains("MX") || upper.contains("MY") || upper.contains("MZ"))
            && !upper.contains("FIXED") && !upper.contains("PINNED") {
            self.parse_joint_load(line);
            return;
        }
        
        // Handle member loads: "1 UNI GY -20" or "1 2 UNI GY -10"
        if upper.contains("UNI") || upper.contains("CON") || upper.contains("TRAP") 
            || upper.contains("CMOM") || upper.contains("PMOM") {
            self.parse_member_load(line);
            return;
        }
        
        let parts: Vec<&str> = line.split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        
        for part in parts {
            let part_tokens: Vec<&str> = part.split_whitespace().collect();
            
            // Try to parse as joint coordinates
            if part_tokens.len() >= 4 {
                if let (Ok(id), Ok(x), Ok(y), Ok(z)) = (
                    part_tokens[0].parse::<usize>(),
                    part_tokens[1].parse::<f64>(),
                    part_tokens[2].parse::<f64>(),
                    part_tokens[3].parse::<f64>(),
                ) {
                    let x_conv = self.convert_length(x);
                    let y_conv = self.convert_length(y);
                    let z_conv = self.convert_length(z);
                    
                    self.nodes.insert(id, ImportedNode {
                        id,
                        original_id: part_tokens[0].to_string(),
                        x: x_conv,
                        y: y_conv,
                        z: z_conv,
                    });
                    continue;
                }
            }
            
            // Try to parse as member incidences
            if part_tokens.len() >= 3 {
                if let (Ok(id), Ok(n1), Ok(n2)) = (
                    part_tokens[0].parse::<usize>(),
                    part_tokens[1].parse::<usize>(),
                    part_tokens[2].parse::<usize>(),
                ) {
                    // Only add if it looks like member incidence (all integers)
                    // and not already existing
                    if !self.elements.iter().any(|e| e.id == id) {
                        self.elements.push(ImportedElement {
                            id,
                            original_id: part_tokens[0].to_string(),
                            element_type: ImportedElementType::Beam,
                            node_ids: vec![n1, n2],
                            material_id: None,
                            section_id: None,
                            releases: None,
                            orientation_angle: 0.0,
                        });
                        continue;
                    }
                }
            }
            
            // Try to parse as combination factors
            if !self.combinations.is_empty() {
                let comb_idx = self.combinations.len() - 1;
                let mut i = 0;
                while i + 1 < part_tokens.len() {
                    if let (Ok(lc_id), Ok(factor)) = (
                        part_tokens[i].parse::<usize>(),
                        part_tokens[i + 1].parse::<f64>(),
                    ) {
                        self.combinations[comb_idx].factors.push((lc_id, factor));
                    }
                    i += 2;
                }
            }
        }
    }

    // Unit conversion functions
    fn convert_length(&self, value: f64) -> f64 {
        match self.units.length {
            LengthUnit::Meter => value,
            LengthUnit::Millimeter => value / 1000.0,
            LengthUnit::Centimeter => value / 100.0,
            LengthUnit::Feet => value * 0.3048,
            LengthUnit::Inch => value * 0.0254,
        }
    }

    fn convert_area(&self, value: f64) -> f64 {
        let factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1e-6,
            LengthUnit::Centimeter => 1e-4,
            LengthUnit::Feet => 0.3048 * 0.3048,
            LengthUnit::Inch => 0.0254 * 0.0254,
        };
        value * factor
    }

    fn convert_inertia(&self, value: f64) -> f64 {
        let factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1e-12,
            LengthUnit::Centimeter => 1e-8,
            LengthUnit::Feet => 0.3048_f64.powi(4),
            LengthUnit::Inch => 0.0254_f64.powi(4),
        };
        value * factor
    }

    fn convert_force(&self, value: f64) -> f64 {
        match self.units.force {
            ForceUnit::Newton => value,
            ForceUnit::KiloNewton => value * 1000.0,
            ForceUnit::MegaNewton => value * 1e6,
            ForceUnit::Kilogram => value * 9.81,
            ForceUnit::Pound => value * 4.448,
            ForceUnit::Kip => value * 4448.0,
        }
    }

    fn convert_force_per_length(&self, value: f64) -> f64 {
        let force = self.convert_force(value);
        let length_factor = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 1000.0,
            LengthUnit::Centimeter => 100.0,
            LengthUnit::Feet => 1.0 / 0.3048,
            LengthUnit::Inch => 1.0 / 0.0254,
        };
        force * length_factor
    }

    fn convert_moment(&self, value: f64) -> f64 {
        let force = self.convert_force(value);
        let length = match self.units.length {
            LengthUnit::Meter => 1.0,
            LengthUnit::Millimeter => 0.001,
            LengthUnit::Centimeter => 0.01,
            LengthUnit::Feet => 0.3048,
            LengthUnit::Inch => 0.0254,
        };
        force * length
    }

    fn build_model(&self) -> ImportedModel {
        let mut nodes: Vec<ImportedNode> = self.nodes.values().cloned().collect();
        nodes.sort_by_key(|n| n.id);
        
        ImportedModel {
            name: "STAAD Import".to_string(),
            source_format: ImportFormat::StaadTxt,
            units: UnitSystem::default(), // Converted to SI
            nodes,
            elements: self.elements.clone(),
            materials: self.materials.clone(),
            sections: self.sections.clone(),
            supports: self.supports.clone(),
            load_cases: self.load_cases.clone(),
            load_combinations: self.combinations.clone(),
            warnings: self.warnings.clone(),
            errors: self.errors.clone(),
        }
    }
}

// ============================================================================
// IFC IMPORT PARSER
// ============================================================================

/// IFC file parser for structural models
pub struct IfcParser {
    nodes: Vec<ImportedNode>,
    elements: Vec<ImportedElement>,
    materials: Vec<ImportedMaterial>,
    sections: Vec<ImportedSection>,
    warnings: Vec<ImportWarning>,
    errors: Vec<ImportError>,
    entity_map: HashMap<u64, IfcEntity>,
}

#[derive(Debug, Clone)]
enum IfcEntity {
    CartesianPoint { x: f64, y: f64, z: f64 },
    StructuralPointConnection { node_id: usize, point_ref: u64 },
    StructuralCurveMember { element_id: usize, start_ref: u64, end_ref: u64 },
    StructuralSurfaceMember { element_id: usize, node_refs: Vec<u64> },
    Material { name: String },
    ProfileDef { name: String, area: f64, ixx: f64, iyy: f64 },
}

impl IfcParser {
    pub fn new() -> Self {
        Self {
            nodes: Vec::new(),
            elements: Vec::new(),
            materials: Vec::new(),
            sections: Vec::new(),
            warnings: Vec::new(),
            errors: Vec::new(),
            entity_map: HashMap::new(),
        }
    }

    /// Parse IFC file content
    pub fn parse<R: Read>(&mut self, reader: R) -> Result<ImportedModel, String> {
        let buf_reader = BufReader::new(reader);
        
        // First pass: parse all entities
        for line in buf_reader.lines() {
            if let Ok(content) = line {
                self.parse_ifc_line(&content);
            }
        }
        
        // Second pass: resolve references
        self.resolve_references();
        
        Ok(self.build_model())
    }

    fn parse_ifc_line(&mut self, line: &str) {
        let line = line.trim();
        
        // Skip non-entity lines
        if !line.starts_with('#') {
            return;
        }
        
        // Parse entity ID
        let eq_pos = match line.find('=') {
            Some(pos) => pos,
            None => return,
        };
        
        let id_str = &line[1..eq_pos].trim();
        let entity_id: u64 = match id_str.parse() {
            Ok(id) => id,
            Err(_) => return,
        };
        
        let entity_part = &line[eq_pos + 1..].trim();
        
        // Parse entity type
        if entity_part.starts_with("IFCCARTESIANPOINT") {
            self.parse_cartesian_point(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALPOINTCONNECTION") {
            self.parse_structural_point(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALCURVEMEMBER") {
            self.parse_curve_member(entity_id, entity_part);
        } else if entity_part.starts_with("IFCSTRUCTURALSURFACEMEMBER") {
            self.parse_surface_member(entity_id, entity_part);
        } else if entity_part.starts_with("IFCMATERIAL") {
            self.parse_material(entity_id, entity_part);
        } else if entity_part.starts_with("IFCISHAPEPROFILEDEF") 
               || entity_part.starts_with("IFCRECTANGLEPROFILEDEF")
               || entity_part.starts_with("IFCCIRCLEPROFILEDEF") {
            self.parse_profile_def(entity_id, entity_part);
        }
    }

    fn parse_cartesian_point(&mut self, id: u64, content: &str) {
        // IFCCARTESIANPOINT((0.,0.,0.));
        if let Some(start) = content.find("((") {
            if let Some(end) = content.find("))") {
                let coords_str = &content[start + 2..end];
                let coords: Vec<f64> = coords_str
                    .split(',')
                    .filter_map(|s| s.trim().trim_end_matches('.').parse().ok())
                    .collect();
                
                if coords.len() >= 3 {
                    self.entity_map.insert(id, IfcEntity::CartesianPoint {
                        x: coords[0],
                        y: coords[1],
                        z: coords[2],
                    });
                }
            }
        }
    }

    fn parse_structural_point(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALPOINTCONNECTION('guid',#owner,$,'name',$,#placement,#representation);
        if let Some(ref_match) = content.find("#") {
            let ref_str: String = content[ref_match + 1..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            
            if let Ok(point_ref) = ref_str.parse::<u64>() {
                let node_id = self.nodes.len() + 1;
                self.entity_map.insert(id, IfcEntity::StructuralPointConnection {
                    node_id,
                    point_ref,
                });
            }
        }
    }

    fn parse_curve_member(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALCURVEMEMBER(...,#start_connection,#end_connection,...);
        let refs: Vec<u64> = content
            .split('#')
            .skip(1)
            .filter_map(|s| {
                let num: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
                num.parse().ok()
            })
            .collect();
        
        if refs.len() >= 2 {
            let element_id = self.elements.len() + 1;
            self.entity_map.insert(id, IfcEntity::StructuralCurveMember {
                element_id,
                start_ref: refs[0],
                end_ref: refs[1],
            });
        }
    }

    fn parse_surface_member(&mut self, id: u64, content: &str) {
        // IFCSTRUCTURALSURFACEMEMBER(...);
        let refs: Vec<u64> = content
            .split('#')
            .skip(1)
            .filter_map(|s| {
                let num: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
                num.parse().ok()
            })
            .collect();
        
        if refs.len() >= 3 {
            let element_id = self.elements.len() + 1;
            self.entity_map.insert(id, IfcEntity::StructuralSurfaceMember {
                element_id,
                node_refs: refs,
            });
        }
    }

    fn parse_material(&mut self, id: u64, content: &str) {
        // IFCMATERIAL('Steel');
        if let Some(start) = content.find('\'') {
            if let Some(end) = content[start + 1..].find('\'') {
                let name = content[start + 1..start + 1 + end].to_string();
                self.entity_map.insert(id, IfcEntity::Material { name });
            }
        }
    }

    fn parse_profile_def(&mut self, id: u64, content: &str) {
        // IFCISHAPEPROFILEDEF(.AREA.,$,'IPE300',#position,0.15,0.30,0.0071,0.0107,$,$);
        let values: Vec<&str> = content.split(',').collect();
        
        let mut name = "Profile".to_string();
        let mut area = 0.01;
        let mut ixx = 1e-4;
        let mut iyy = 1e-5;
        
        for (i, val) in values.iter().enumerate() {
            if val.contains('\'') {
                let stripped = val.trim().trim_matches('\'');
                if !stripped.is_empty() && stripped != "$" {
                    name = stripped.to_string();
                }
            } else if i >= 4 {
                if let Ok(num) = val.trim().parse::<f64>() {
                    match i {
                        4 => { /* width */ }
                        5 => { /* depth */ }
                        6 => area = num,
                        7 => ixx = num,
                        8 => iyy = num,
                        _ => {}
                    }
                }
            }
        }
        
        self.entity_map.insert(id, IfcEntity::ProfileDef { name, area, ixx, iyy });
    }

    fn resolve_references(&mut self) {
        // Build node map from cartesian points
        let mut point_to_node: HashMap<u64, usize> = HashMap::new();
        let mut node_id = 1;
        
        for (id, entity) in &self.entity_map {
            if let IfcEntity::CartesianPoint { x, y, z } = entity {
                self.nodes.push(ImportedNode {
                    id: node_id,
                    original_id: format!("#{}", id),
                    x: *x,
                    y: *y,
                    z: *z,
                });
                point_to_node.insert(*id, node_id);
                node_id += 1;
            }
        }
        
        // Resolve structural point connections
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (id, entity) in entities {
            if let IfcEntity::StructuralPointConnection { point_ref, .. } = entity {
                if let Some(&node_id) = point_to_node.get(&point_ref) {
                    point_to_node.insert(id, node_id);
                }
            }
        }
        
        // Build elements from curve members
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::StructuralCurveMember { element_id, start_ref, end_ref } = entity {
                let start_node = point_to_node.get(&start_ref).copied().unwrap_or(1);
                let end_node = point_to_node.get(&end_ref).copied().unwrap_or(2);
                
                self.elements.push(ImportedElement {
                    id: element_id,
                    original_id: format!("M{}", element_id),
                    element_type: ImportedElementType::Beam,
                    node_ids: vec![start_node, end_node],
                    material_id: Some(1),
                    section_id: Some(1),
                    releases: None,
                    orientation_angle: 0.0,
                });
            }
        }
        
        // Build materials
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::Material { name } = entity {
                let (e, fy, fck) = if name.to_uppercase().contains("STEEL") {
                    (210e9, Some(355e6), None)
                } else if name.to_uppercase().contains("CONCRETE") {
                    (30e9, None, Some(30e6))
                } else {
                    (200e9, Some(250e6), None)
                };
                
                self.materials.push(ImportedMaterial {
                    id: self.materials.len() + 1,
                    name,
                    material_type: MaterialType::Steel,
                    e,
                    nu: 0.3,
                    density: 7850.0,
                    fy,
                    fu: fy.map(|f| f * 1.2),
                    fck,
                    alpha: 12e-6,
                });
            }
        }
        
        // Default material if none found
        if self.materials.is_empty() {
            self.materials.push(ImportedMaterial {
                id: 1,
                name: "Steel".to_string(),
                material_type: MaterialType::Steel,
                e: 210e9,
                nu: 0.3,
                density: 7850.0,
                fy: Some(355e6),
                fu: Some(470e6),
                fck: None,
                alpha: 12e-6,
            });
        }
        
        // Build sections
        let entities: Vec<(u64, IfcEntity)> = self.entity_map.iter()
            .map(|(k, v)| (*k, v.clone()))
            .collect();
            
        for (_id, entity) in entities {
            if let IfcEntity::ProfileDef { name, area, ixx, iyy } = entity {
                self.sections.push(ImportedSection {
                    id: self.sections.len() + 1,
                    name,
                    section_type: SectionType::ISection,
                    area,
                    ixx,
                    iyy,
                    izz: iyy,
                    j: ixx + iyy,
                    depth: None,
                    width: None,
                    tw: None,
                    tf: None,
                });
            }
        }
        
        // Default section if none found
        if self.sections.is_empty() {
            self.sections.push(ImportedSection {
                id: 1,
                name: "Default".to_string(),
                section_type: SectionType::ISection,
                area: 0.01,
                ixx: 1e-4,
                iyy: 1e-5,
                izz: 1e-5,
                j: 1.1e-4,
                depth: Some(0.3),
                width: Some(0.15),
                tw: Some(0.007),
                tf: Some(0.011),
            });
        }
    }

    fn build_model(&self) -> ImportedModel {
        ImportedModel {
            name: "IFC Import".to_string(),
            source_format: ImportFormat::Ifc2x3,
            units: UnitSystem::default(),
            nodes: self.nodes.clone(),
            elements: self.elements.clone(),
            materials: self.materials.clone(),
            sections: self.sections.clone(),
            supports: Vec::new(),
            load_cases: Vec::new(),
            load_combinations: Vec::new(),
            warnings: self.warnings.clone(),
            errors: self.errors.clone(),
        }
    }
}

// ============================================================================
// MODEL IMPORT API
// ============================================================================

/// Import a model from file content
pub fn import_model(content: &str, format: ImportFormat) -> Result<ImportedModel, String> {
    match format {
        ImportFormat::StaadTxt | ImportFormat::StaadStd => {
            let mut parser = StaadParser::new();
            parser.parse(content.as_bytes())
        }
        ImportFormat::Ifc2x3 | ImportFormat::Ifc4 => {
            let mut parser = IfcParser::new();
            parser.parse(content.as_bytes())
        }
        ImportFormat::JsonGeneric => {
            serde_json::from_str(content)
                .map_err(|e| format!("JSON parse error: {}", e))
        }
        _ => Err("Unsupported format".to_string()),
    }
}

/// Auto-detect file format from content
pub fn detect_format(content: &str) -> ImportFormat {
    let upper = content.to_uppercase();
    
    if upper.contains("STAAD") {
        ImportFormat::StaadTxt
    } else if upper.contains("ISO-10303") || upper.contains("IFC2X3") || upper.contains("IFC4") {
        ImportFormat::Ifc2x3
    } else if content.trim().starts_with('{') {
        ImportFormat::JsonGeneric
    } else {
        ImportFormat::StaadTxt // Default
    }
}

/// Validate imported model
pub fn validate_model(model: &ImportedModel) -> Vec<ImportWarning> {
    let mut warnings = Vec::new();
    
    // Check for orphan nodes
    let mut used_nodes: std::collections::HashSet<usize> = std::collections::HashSet::new();
    for element in &model.elements {
        for node_id in &element.node_ids {
            used_nodes.insert(*node_id);
        }
    }
    
    for node in &model.nodes {
        if !used_nodes.contains(&node.id) {
            warnings.push(ImportWarning {
                code: "W001".to_string(),
                message: format!("Node {} is not connected to any element", node.id),
                line: None,
                element_id: Some(node.original_id.clone()),
            });
        }
    }
    
    // Check for unsupported nodes
    let supported_nodes: std::collections::HashSet<usize> = model.supports
        .iter()
        .map(|s| s.node_id)
        .collect();
    
    if supported_nodes.is_empty() {
        warnings.push(ImportWarning {
            code: "W002".to_string(),
            message: "No supports defined - model may be unstable".to_string(),
            line: None,
            element_id: None,
        });
    }
    
    // Check for zero-length elements
    for element in &model.elements {
        if element.node_ids.len() >= 2 {
            let n1 = element.node_ids[0];
            let n2 = element.node_ids[1];
            
            if let (Some(node1), Some(node2)) = (
                model.nodes.iter().find(|n| n.id == n1),
                model.nodes.iter().find(|n| n.id == n2),
            ) {
                let dx = node2.x - node1.x;
                let dy = node2.y - node1.y;
                let dz = node2.z - node1.z;
                let length = (dx * dx + dy * dy + dz * dz).sqrt();
                
                if length < 1e-6 {
                    warnings.push(ImportWarning {
                        code: "W003".to_string(),
                        message: format!("Element {} has zero or near-zero length", element.id),
                        line: None,
                        element_id: Some(element.original_id.clone()),
                    });
                }
            }
        }
    }
    
    warnings
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
        let mut parser = StaadParser::new();
        parser.units.length = LengthUnit::Feet;
        parser.units.force = ForceUnit::Kip;
        
        // 10 feet = 3.048 meters
        assert!((parser.convert_length(10.0) - 3.048).abs() < 0.001);
        
        // 1 kip = 4448 N
        assert!((parser.convert_force(1.0) - 4448.0).abs() < 1.0);
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
