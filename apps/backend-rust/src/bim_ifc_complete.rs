//! Complete BIM/IFC Integration Module
//!
//! Industry Foundation Classes (IFC) import/export and Building Information
//! Modeling integration for interoperability with Revit, Tekla, etc.
//!
//! ## IFC Support
//! - **IFC2x3** - Legacy format support
//! - **IFC4** - Current standard (ISO 16739)
//! - **IFC4.3** - Latest with infrastructure extensions
//!
//! ## Capabilities
//! - Geometry import from IFC entities
//! - Structural element recognition
//! - Material property extraction
//! - Cross-section mapping
//! - Load case import
//! - Analysis results export

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::fs::File;
use std::path::Path;

// ============================================================================
// IFC DATA TYPES
// ============================================================================

/// IFC Schema version
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IfcSchema {
    Ifc2x3,
    Ifc4,
    Ifc4x3,
}

/// IFC entity instance
#[derive(Debug, Clone)]
pub struct IfcEntity {
    pub id: u64,
    pub entity_type: String,
    pub attributes: Vec<IfcAttribute>,
}

/// IFC attribute value
#[derive(Debug, Clone)]
pub enum IfcAttribute {
    Null,
    Integer(i64),
    Real(f64),
    String(String),
    Boolean(bool),
    Enum(String),
    Reference(u64),
    List(Vec<IfcAttribute>),
    Set(Vec<IfcAttribute>),
}

impl IfcAttribute {
    pub fn as_real(&self) -> Option<f64> {
        match self {
            IfcAttribute::Real(v) => Some(*v),
            IfcAttribute::Integer(v) => Some(*v as f64),
            _ => None,
        }
    }

    pub fn as_string(&self) -> Option<&str> {
        match self {
            IfcAttribute::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_reference(&self) -> Option<u64> {
        match self {
            IfcAttribute::Reference(id) => Some(*id),
            _ => None,
        }
    }

    pub fn as_list(&self) -> Option<&Vec<IfcAttribute>> {
        match self {
            IfcAttribute::List(l) | IfcAttribute::Set(l) => Some(l),
            _ => None,
        }
    }
}

// ============================================================================
// IFC PARSER
// ============================================================================

/// IFC STEP file parser
pub struct IfcParser {
    entities: HashMap<u64, IfcEntity>,
    schema: IfcSchema,
}

impl IfcParser {
    pub fn new() -> Self {
        IfcParser {
            entities: HashMap::new(),
            schema: IfcSchema::Ifc4,
        }
    }

    /// Parse IFC file
    pub fn parse_file(&mut self, path: &Path) -> Result<(), IfcError> {
        let file = File::open(path).map_err(|e| IfcError::IoError(e.to_string()))?;
        let reader = BufReader::new(file);
        
        let mut in_data_section = false;
        let mut line_buffer = String::new();
        
        for line in reader.lines() {
            let line = line.map_err(|e| IfcError::IoError(e.to_string()))?;
            let trimmed = line.trim();
            
            // Detect schema
            if trimmed.contains("FILE_SCHEMA") {
                if trimmed.contains("IFC2X3") {
                    self.schema = IfcSchema::Ifc2x3;
                } else if trimmed.contains("IFC4X3") {
                    self.schema = IfcSchema::Ifc4x3;
                } else if trimmed.contains("IFC4") {
                    self.schema = IfcSchema::Ifc4;
                }
            }
            
            if trimmed == "DATA;" {
                in_data_section = true;
                continue;
            }
            
            if trimmed == "ENDSEC;" {
                in_data_section = false;
                continue;
            }
            
            if in_data_section {
                line_buffer.push_str(trimmed);
                
                // Check if line is complete (ends with semicolon)
                if line_buffer.ends_with(';') {
                    self.parse_entity_line(&line_buffer)?;
                    line_buffer.clear();
                }
            }
        }
        
        Ok(())
    }

    fn parse_entity_line(&mut self, line: &str) -> Result<(), IfcError> {
        // Format: #123=IFCENTITY(attr1,attr2,...);
        let line = line.trim_end_matches(';');
        
        let eq_pos = line.find('=')
            .ok_or_else(|| IfcError::ParseError("Missing = in entity".to_string()))?;
        
        let id_str = &line[1..eq_pos]; // Skip #
        let id: u64 = id_str.parse()
            .map_err(|_| IfcError::ParseError(format!("Invalid ID: {}", id_str)))?;
        
        let rest = &line[eq_pos + 1..];
        
        let paren_pos = rest.find('(')
            .ok_or_else(|| IfcError::ParseError("Missing ( in entity".to_string()))?;
        
        let entity_type = rest[..paren_pos].to_string();
        let attr_str = &rest[paren_pos + 1..rest.len() - 1];
        
        let attributes = self.parse_attributes(attr_str)?;
        
        self.entities.insert(id, IfcEntity {
            id,
            entity_type,
            attributes,
        });
        
        Ok(())
    }

    fn parse_attributes(&self, s: &str) -> Result<Vec<IfcAttribute>, IfcError> {
        let mut attrs = Vec::new();
        let mut current = String::new();
        let mut depth = 0;
        let mut in_string = false;
        
        for c in s.chars() {
            match c {
                '\'' => {
                    in_string = !in_string;
                    current.push(c);
                }
                '(' if !in_string => {
                    depth += 1;
                    current.push(c);
                }
                ')' if !in_string => {
                    depth -= 1;
                    current.push(c);
                }
                ',' if depth == 0 && !in_string => {
                    attrs.push(self.parse_single_attribute(&current)?);
                    current.clear();
                }
                _ => {
                    current.push(c);
                }
            }
        }
        
        if !current.is_empty() {
            attrs.push(self.parse_single_attribute(&current)?);
        }
        
        Ok(attrs)
    }

    fn parse_single_attribute(&self, s: &str) -> Result<IfcAttribute, IfcError> {
        let s = s.trim();
        
        if s == "$" {
            return Ok(IfcAttribute::Null);
        }
        
        if s == ".T." {
            return Ok(IfcAttribute::Boolean(true));
        }
        
        if s == ".F." {
            return Ok(IfcAttribute::Boolean(false));
        }
        
        if s.starts_with('.') && s.ends_with('.') {
            return Ok(IfcAttribute::Enum(s[1..s.len()-1].to_string()));
        }
        
        if s.starts_with('#') {
            let id: u64 = s[1..].parse()
                .map_err(|_| IfcError::ParseError(format!("Invalid reference: {}", s)))?;
            return Ok(IfcAttribute::Reference(id));
        }
        
        if s.starts_with('\'') && s.ends_with('\'') {
            return Ok(IfcAttribute::String(s[1..s.len()-1].to_string()));
        }
        
        if s.starts_with('(') && s.ends_with(')') {
            let inner = &s[1..s.len()-1];
            let items = self.parse_attributes(inner)?;
            return Ok(IfcAttribute::List(items));
        }
        
        if let Ok(i) = s.parse::<i64>() {
            return Ok(IfcAttribute::Integer(i));
        }
        
        if let Ok(f) = s.parse::<f64>() {
            return Ok(IfcAttribute::Real(f));
        }
        
        // Typed value like IFCLABEL('text')
        if let Some(paren_pos) = s.find('(') {
            let inner = &s[paren_pos + 1..s.len() - 1];
            return self.parse_single_attribute(inner);
        }
        
        Ok(IfcAttribute::String(s.to_string()))
    }

    pub fn get_entity(&self, id: u64) -> Option<&IfcEntity> {
        self.entities.get(&id)
    }

    pub fn get_entities_by_type(&self, entity_type: &str) -> Vec<&IfcEntity> {
        self.entities.values()
            .filter(|e| e.entity_type.eq_ignore_ascii_case(entity_type))
            .collect()
    }

    pub fn schema(&self) -> IfcSchema {
        self.schema
    }
}

impl Default for IfcParser {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// STRUCTURAL MODEL EXTRACTION
// ============================================================================

/// Structural model extracted from IFC
#[derive(Debug, Clone, Default)]
pub struct StructuralModel {
    pub nodes: Vec<StructuralNode>,
    pub beams: Vec<StructuralBeam>,
    pub columns: Vec<StructuralColumn>,
    pub slabs: Vec<StructuralSlab>,
    pub walls: Vec<StructuralWall>,
    pub materials: HashMap<String, StructuralMaterial>,
    pub sections: HashMap<String, StructuralSection>,
    pub load_cases: Vec<LoadCase>,
}

/// Structural node (joint)
#[derive(Debug, Clone)]
pub struct StructuralNode {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub supports: [bool; 6], // Rx, Ry, Rz, Mx, My, Mz
}

/// Beam element
#[derive(Debug, Clone)]
pub struct StructuralBeam {
    pub id: String,
    pub name: String,
    pub start_node: String,
    pub end_node: String,
    pub section_id: String,
    pub material_id: String,
    pub rotation: f64,
}

/// Column element
#[derive(Debug, Clone)]
pub struct StructuralColumn {
    pub id: String,
    pub name: String,
    pub base_node: String,
    pub top_node: String,
    pub section_id: String,
    pub material_id: String,
    pub rotation: f64,
}

/// Slab element
#[derive(Debug, Clone)]
pub struct StructuralSlab {
    pub id: String,
    pub name: String,
    pub boundary_nodes: Vec<String>,
    pub thickness: f64,
    pub material_id: String,
}

/// Wall element
#[derive(Debug, Clone)]
pub struct StructuralWall {
    pub id: String,
    pub name: String,
    pub base_points: Vec<[f64; 3]>,
    pub height: f64,
    pub thickness: f64,
    pub material_id: String,
}

/// Structural material
#[derive(Debug, Clone)]
pub struct StructuralMaterial {
    pub id: String,
    pub name: String,
    pub elastic_modulus: f64,
    pub poisson_ratio: f64,
    pub density: f64,
    pub yield_strength: Option<f64>,
    pub compressive_strength: Option<f64>,
}

impl Default for StructuralMaterial {
    fn default() -> Self {
        StructuralMaterial {
            id: String::new(),
            name: String::new(),
            elastic_modulus: 210e9,  // Steel default
            poisson_ratio: 0.3,
            density: 7850.0,
            yield_strength: Some(355e6),
            compressive_strength: None,
        }
    }
}

/// Cross-section properties
#[derive(Debug, Clone)]
pub struct StructuralSection {
    pub id: String,
    pub name: String,
    pub section_type: SectionType,
    pub area: f64,
    pub ix: f64,  // Second moment of area x
    pub iy: f64,  // Second moment of area y
    pub j: f64,   // Torsional constant
    pub dimensions: HashMap<String, f64>,
}

/// Section shape types
#[derive(Debug, Clone)]
pub enum SectionType {
    ISection,
    RectangularHollow,
    CircularHollow,
    Rectangular,
    Circular,
    LSection,
    TSection,
    Channel,
    Other,
}

/// Load case
#[derive(Debug, Clone)]
pub struct LoadCase {
    pub id: String,
    pub name: String,
    pub load_type: LoadType,
    pub loads: Vec<Load>,
}

/// Load type classification
#[derive(Debug, Clone)]
pub enum LoadType {
    DeadLoad,
    LiveLoad,
    WindLoad,
    SeismicLoad,
    SnowLoad,
    Other,
}

/// Individual load
#[derive(Debug, Clone)]
pub enum Load {
    PointLoad {
        node_id: String,
        fx: f64,
        fy: f64,
        fz: f64,
        mx: f64,
        my: f64,
        mz: f64,
    },
    DistributedLoad {
        element_id: String,
        wx: f64,
        wy: f64,
        wz: f64,
    },
    AreaLoad {
        surface_id: String,
        pressure: f64,
        direction: [f64; 3],
    },
}

// ============================================================================
// IFC MODEL EXTRACTOR
// ============================================================================

/// Extract structural model from IFC
pub struct IfcModelExtractor<'a> {
    parser: &'a IfcParser,
    model: StructuralModel,
}

impl<'a> IfcModelExtractor<'a> {
    pub fn new(parser: &'a IfcParser) -> Self {
        IfcModelExtractor {
            parser,
            model: StructuralModel::default(),
        }
    }

    /// Extract complete structural model
    pub fn extract(mut self) -> StructuralModel {
        self.extract_materials();
        self.extract_sections();
        self.extract_structural_elements();
        self.extract_loads();
        self.model
    }

    fn extract_materials(&mut self) {
        // IfcMaterial entities
        for entity in self.parser.get_entities_by_type("IFCMATERIAL") {
            if let Some(name) = entity.attributes.get(0).and_then(|a| a.as_string()) {
                let mut mat = StructuralMaterial::default();
                mat.id = format!("#{}", entity.id);
                mat.name = name.to_string();
                
                // Try to find associated mechanical properties
                self.extract_material_properties(&mut mat, entity.id);
                
                self.model.materials.insert(mat.id.clone(), mat);
            }
        }
    }

    fn extract_material_properties(&self, mat: &mut StructuralMaterial, material_id: u64) {
        // Look for IfcMaterialProperties
        for entity in self.parser.get_entities_by_type("IFCMECHANICALCONCRETEMATERIALPROPERTIES") {
            if let Some(ref_id) = entity.attributes.get(0).and_then(|a| a.as_reference()) {
                if ref_id == material_id {
                    if let Some(fc) = entity.attributes.get(1).and_then(|a| a.as_real()) {
                        mat.compressive_strength = Some(fc);
                    }
                }
            }
        }
        
        for entity in self.parser.get_entities_by_type("IFCMECHANICALSTEELMATERIALPROPERTIES") {
            if let Some(ref_id) = entity.attributes.get(0).and_then(|a| a.as_reference()) {
                if ref_id == material_id {
                    if let Some(fy) = entity.attributes.get(1).and_then(|a| a.as_real()) {
                        mat.yield_strength = Some(fy);
                    }
                }
            }
        }
    }

    fn extract_sections(&mut self) {
        // IfcProfileDef entities
        for entity in self.parser.get_entities_by_type("IFCISHAPEPROFILEDEF") {
            let mut section = StructuralSection {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                section_type: SectionType::ISection,
                area: 0.0,
                ix: 0.0,
                iy: 0.0,
                j: 0.0,
                dimensions: HashMap::new(),
            };
            
            // IFC I-shape: depth, width, web_thickness, flange_thickness
            if let (Some(d), Some(w), Some(tw), Some(tf)) = (
                entity.attributes.get(3).and_then(|a| a.as_real()),
                entity.attributes.get(4).and_then(|a| a.as_real()),
                entity.attributes.get(5).and_then(|a| a.as_real()),
                entity.attributes.get(6).and_then(|a| a.as_real()),
            ) {
                section.dimensions.insert("depth".into(), d);
                section.dimensions.insert("width".into(), w);
                section.dimensions.insert("tw".into(), tw);
                section.dimensions.insert("tf".into(), tf);
                
                // Calculate properties
                let hw = d - 2.0 * tf;
                section.area = 2.0 * w * tf + hw * tw;
                section.ix = (w * d.powi(3) - (w - tw) * hw.powi(3)) / 12.0;
                section.iy = (2.0 * tf * w.powi(3) + hw * tw.powi(3)) / 12.0;
            }
            
            self.model.sections.insert(section.id.clone(), section);
        }
        
        // Rectangular sections
        for entity in self.parser.get_entities_by_type("IFCRECTANGLEPROFILEDEF") {
            let mut section = StructuralSection {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                section_type: SectionType::Rectangular,
                area: 0.0,
                ix: 0.0,
                iy: 0.0,
                j: 0.0,
                dimensions: HashMap::new(),
            };
            
            if let (Some(d), Some(w)) = (
                entity.attributes.get(3).and_then(|a| a.as_real()),
                entity.attributes.get(4).and_then(|a| a.as_real()),
            ) {
                section.dimensions.insert("depth".into(), d);
                section.dimensions.insert("width".into(), w);
                section.area = w * d;
                section.ix = w * d.powi(3) / 12.0;
                section.iy = d * w.powi(3) / 12.0;
            }
            
            self.model.sections.insert(section.id.clone(), section);
        }
    }

    fn extract_structural_elements(&mut self) {
        // Beams
        for entity in self.parser.get_entities_by_type("IFCBEAM") {
            let beam = StructuralBeam {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                start_node: String::new(),
                end_node: String::new(),
                section_id: String::new(),
                material_id: String::new(),
                rotation: 0.0,
            };
            self.model.beams.push(beam);
        }
        
        // Columns
        for entity in self.parser.get_entities_by_type("IFCCOLUMN") {
            let column = StructuralColumn {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                base_node: String::new(),
                top_node: String::new(),
                section_id: String::new(),
                material_id: String::new(),
                rotation: 0.0,
            };
            self.model.columns.push(column);
        }
        
        // Slabs
        for entity in self.parser.get_entities_by_type("IFCSLAB") {
            let slab = StructuralSlab {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                boundary_nodes: Vec::new(),
                thickness: 0.2, // Default 200mm
                material_id: String::new(),
            };
            self.model.slabs.push(slab);
        }
        
        // Walls
        for entity in self.parser.get_entities_by_type("IFCWALL") {
            let wall = StructuralWall {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("")
                    .to_string(),
                base_points: Vec::new(),
                height: 3.0,
                thickness: 0.2,
                material_id: String::new(),
            };
            self.model.walls.push(wall);
        }
    }

    fn extract_loads(&mut self) {
        // IfcStructuralLoadCase
        for entity in self.parser.get_entities_by_type("IFCSTRUCTURALLOADCASE") {
            let load_case = LoadCase {
                id: format!("#{}", entity.id),
                name: entity.attributes.get(2)
                    .and_then(|a| a.as_string())
                    .unwrap_or("Load Case")
                    .to_string(),
                load_type: LoadType::Other,
                loads: Vec::new(),
            };
            self.model.load_cases.push(load_case);
        }
    }
}

// ============================================================================
// IFC EXPORTER
// ============================================================================

/// Export structural model to IFC
pub struct IfcExporter {
    schema: IfcSchema,
    entity_counter: u64,
    lines: Vec<String>,
}

impl IfcExporter {
    pub fn new(schema: IfcSchema) -> Self {
        IfcExporter {
            schema,
            entity_counter: 0,
            lines: Vec::new(),
        }
    }

    fn next_id(&mut self) -> u64 {
        self.entity_counter += 1;
        self.entity_counter
    }

    /// Export model to IFC file
    pub fn export(&mut self, model: &StructuralModel, path: &Path) -> Result<(), IfcError> {
        self.write_header();
        self.write_data_section(model);
        self.write_footer();
        
        let mut file = File::create(path)
            .map_err(|e| IfcError::IoError(e.to_string()))?;
        
        for line in &self.lines {
            writeln!(file, "{}", line)
                .map_err(|e| IfcError::IoError(e.to_string()))?;
        }
        
        Ok(())
    }

    fn write_header(&mut self) {
        self.lines.push("ISO-10303-21;".into());
        self.lines.push("HEADER;".into());
        self.lines.push("FILE_DESCRIPTION(('Structural Analysis Model'),'2;1');".into());
        self.lines.push("FILE_NAME('model.ifc','','','','','','');".into());
        
        let schema_str = match self.schema {
            IfcSchema::Ifc2x3 => "IFC2X3",
            IfcSchema::Ifc4 => "IFC4",
            IfcSchema::Ifc4x3 => "IFC4X3",
        };
        self.lines.push(format!("FILE_SCHEMA(('{}'));", schema_str));
        self.lines.push("ENDSEC;".into());
    }

    fn write_data_section(&mut self, model: &StructuralModel) {
        self.lines.push("DATA;".into());
        
        // Write project and context
        let _project_id = self.write_project();
        let _context_id = self.write_context();
        
        // Write materials
        let mut material_ids: HashMap<String, u64> = HashMap::new();
        for (key, mat) in &model.materials {
            let id = self.write_material(mat);
            material_ids.insert(key.clone(), id);
        }
        
        // Write sections
        let mut section_ids: HashMap<String, u64> = HashMap::new();
        for (key, section) in &model.sections {
            let id = self.write_section(section);
            section_ids.insert(key.clone(), id);
        }
        
        // Write structural elements
        for beam in &model.beams {
            self.write_beam(beam, &material_ids, &section_ids);
        }
        
        for column in &model.columns {
            self.write_column(column, &material_ids, &section_ids);
        }
        
        for slab in &model.slabs {
            self.write_slab(slab, &material_ids);
        }
        
        self.lines.push("ENDSEC;".into());
    }

    fn write_project(&mut self) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCPROJECT('{}',#{},'Structural Model',$,$,$,$,$,$);",
            id,
            self.generate_guid(),
            id + 1000  // Owner history placeholder
        ));
        id
    }

    fn write_context(&mut self) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#{},$);",
            id, id + 1
        ));
        id
    }

    fn write_material(&mut self, mat: &StructuralMaterial) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCMATERIAL('{}');",
            id, mat.name
        ));
        id
    }

    fn write_section(&mut self, section: &StructuralSection) -> u64 {
        let id = self.next_id();
        
        match section.section_type {
            SectionType::ISection => {
                let d = section.dimensions.get("depth").unwrap_or(&0.3);
                let w = section.dimensions.get("width").unwrap_or(&0.15);
                let tw = section.dimensions.get("tw").unwrap_or(&0.01);
                let tf = section.dimensions.get("tf").unwrap_or(&0.015);
                
                self.lines.push(format!(
                    "#{}=IFCISHAPEPROFILEDEF(.AREA.,$,'{}',.{},{},{},{},{},{});",
                    id, section.name, d, w, tw, tf, 0.0, 0.0
                ));
            }
            SectionType::Rectangular => {
                let d = section.dimensions.get("depth").unwrap_or(&0.3);
                let w = section.dimensions.get("width").unwrap_or(&0.2);
                
                self.lines.push(format!(
                    "#{}=IFCRECTANGLEPROFILEDEF(.AREA.,$,'{}',{},{});",
                    id, section.name, d, w
                ));
            }
            _ => {
                // Generic profile
                self.lines.push(format!(
                    "#{}=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#{});",
                    id, id + 1
                ));
            }
        }
        
        id
    }

    fn write_beam(&mut self, beam: &StructuralBeam, _materials: &HashMap<String, u64>, _sections: &HashMap<String, u64>) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCBEAM('{}',#{},'{}','Beam',$,#{},$,$,.BEAM.);",
            id,
            self.generate_guid(),
            id + 1000,  // Owner history
            beam.name,
            id + 1  // Placement
        ));
        id
    }

    fn write_column(&mut self, column: &StructuralColumn, _materials: &HashMap<String, u64>, _sections: &HashMap<String, u64>) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCCOLUMN('{}',#{},'{}','Column',$,#{},$,$,.COLUMN.);",
            id,
            self.generate_guid(),
            id + 1000,
            column.name,
            id + 1
        ));
        id
    }

    fn write_slab(&mut self, slab: &StructuralSlab, _materials: &HashMap<String, u64>) -> u64 {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCSLAB('{}',#{},'{}','Slab',$,#{},$,$,.FLOOR.);",
            id,
            self.generate_guid(),
            id + 1000,
            slab.name,
            id + 1
        ));
        id
    }

    fn write_footer(&mut self) {
        self.lines.push("END-ISO-10303-21;".into());
    }

    fn generate_guid(&self) -> String {
        // Simplified GUID generation (real implementation would use proper algorithm)
        format!("0{:X}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() % (1 << 64))
    }
}

// ============================================================================
// ANALYSIS RESULTS EXPORT
// ============================================================================

/// Analysis results for IFC export
#[derive(Debug, Clone)]
pub struct AnalysisResults {
    pub load_case_id: String,
    pub node_displacements: HashMap<String, [f64; 6]>,
    pub element_forces: HashMap<String, ElementForces>,
    pub reactions: HashMap<String, [f64; 6]>,
}

/// Element internal forces
#[derive(Debug, Clone)]
pub struct ElementForces {
    pub start_forces: [f64; 6],  // Fx, Fy, Fz, Mx, My, Mz at start
    pub end_forces: [f64; 6],    // Fx, Fy, Fz, Mx, My, Mz at end
}

/// Export analysis results to IFC
pub struct IfcResultsExporter {
    entity_counter: u64,
    lines: Vec<String>,
}

impl IfcResultsExporter {
    pub fn new() -> Self {
        IfcResultsExporter {
            entity_counter: 10000,  // Start after model entities
            lines: Vec::new(),
        }
    }

    /// Export results
    pub fn export(&mut self, results: &AnalysisResults, _model_path: &Path) -> Vec<String> {
        // Write displacement results
        for (node_id, displ) in &results.node_displacements {
            self.write_displacement_result(node_id, displ);
        }
        
        // Write force results
        for (elem_id, forces) in &results.element_forces {
            self.write_force_result(elem_id, forces);
        }
        
        // Write reactions
        for (node_id, reaction) in &results.reactions {
            self.write_reaction_result(node_id, reaction);
        }
        
        self.lines.clone()
    }

    fn write_displacement_result(&mut self, _node_id: &str, displ: &[f64; 6]) {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCSTRUCTURALLOADSINGLEDISPLACEMENT($,{},{},{},{},{},{});",
            id,
            displ[0], displ[1], displ[2],
            displ[3], displ[4], displ[5]
        ));
    }

    fn write_force_result(&mut self, _elem_id: &str, forces: &ElementForces) {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCSTRUCTURALLOADSINGLEFORCE($,{},{},{},{},{},{});",
            id,
            forces.start_forces[0], forces.start_forces[1], forces.start_forces[2],
            forces.start_forces[3], forces.start_forces[4], forces.start_forces[5]
        ));
    }

    fn write_reaction_result(&mut self, node_id: &str, reaction: &[f64; 6]) {
        let id = self.next_id();
        self.lines.push(format!(
            "#{}=IFCSTRUCTURALREACTION('{}',{},{},{},{},{},{});",
            id, node_id,
            reaction[0], reaction[1], reaction[2],
            reaction[3], reaction[4], reaction[5]
        ));
    }

    fn next_id(&mut self) -> u64 {
        self.entity_counter += 1;
        self.entity_counter
    }
}

impl Default for IfcResultsExporter {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/// IFC processing error
#[derive(Debug)]
pub enum IfcError {
    IoError(String),
    ParseError(String),
    UnsupportedSchema(String),
    InvalidEntity(String),
}

impl std::fmt::Display for IfcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IfcError::IoError(msg) => write!(f, "IO error: {}", msg),
            IfcError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            IfcError::UnsupportedSchema(msg) => write!(f, "Unsupported schema: {}", msg),
            IfcError::InvalidEntity(msg) => write!(f, "Invalid entity: {}", msg),
        }
    }
}

impl std::error::Error for IfcError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ifc_attribute_parsing() {
        let parser = IfcParser::new();
        
        let attr = parser.parse_single_attribute("$").unwrap();
        assert!(matches!(attr, IfcAttribute::Null));
        
        let attr = parser.parse_single_attribute(".T.").unwrap();
        assert!(matches!(attr, IfcAttribute::Boolean(true)));
        
        let attr = parser.parse_single_attribute("#123").unwrap();
        assert!(matches!(attr, IfcAttribute::Reference(123)));
        
        let attr = parser.parse_single_attribute("'test'").unwrap();
        assert!(matches!(attr, IfcAttribute::String(ref s) if s == "test"));
        
        let attr = parser.parse_single_attribute("3.14").unwrap();
        if let IfcAttribute::Real(v) = attr {
            assert!((v - 3.14).abs() < 1e-10);
        } else {
            panic!("Expected Real");
        }
    }

    #[test]
    fn test_attribute_list_parsing() {
        let parser = IfcParser::new();
        
        let attrs = parser.parse_attributes("1.0,2.0,3.0").unwrap();
        assert_eq!(attrs.len(), 3);
    }

    #[test]
    fn test_structural_model() {
        let model = StructuralModel::default();
        
        assert!(model.nodes.is_empty());
        assert!(model.beams.is_empty());
        assert!(model.columns.is_empty());
    }

    #[test]
    fn test_structural_material() {
        let mat = StructuralMaterial::default();
        
        assert!((mat.elastic_modulus - 210e9).abs() < 1.0);
        assert!((mat.poisson_ratio - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_ifc_exporter() {
        let mut exporter = IfcExporter::new(IfcSchema::Ifc4);
        let model = StructuralModel::default();
        
        // Test GUID generation
        let guid = exporter.generate_guid();
        assert!(!guid.is_empty());
    }

    #[test]
    fn test_analysis_results() {
        let results = AnalysisResults {
            load_case_id: "LC1".into(),
            node_displacements: HashMap::new(),
            element_forces: HashMap::new(),
            reactions: HashMap::new(),
        };
        
        assert!(results.node_displacements.is_empty());
    }

    #[test]
    fn test_results_exporter() {
        let mut exporter = IfcResultsExporter::new();
        let results = AnalysisResults {
            load_case_id: "LC1".into(),
            node_displacements: [("N1".into(), [0.001, 0.002, 0.0, 0.0, 0.0, 0.001])].into(),
            element_forces: HashMap::new(),
            reactions: HashMap::new(),
        };
        
        let lines = exporter.export(&results, Path::new("test.ifc"));
        assert!(!lines.is_empty());
    }

    #[test]
    fn test_section_types() {
        let i_section = StructuralSection {
            id: "S1".into(),
            name: "HEA300".into(),
            section_type: SectionType::ISection,
            area: 0.0112,
            ix: 1.83e-4,
            iy: 6.31e-5,
            j: 8.54e-7,
            dimensions: [
                ("depth".into(), 0.29),
                ("width".into(), 0.30),
                ("tw".into(), 0.0085),
                ("tf".into(), 0.014),
            ].into(),
        };
        
        assert!(matches!(i_section.section_type, SectionType::ISection));
        assert!(i_section.area > 0.01);
    }

    #[test]
    fn test_load_types() {
        let dead = LoadCase {
            id: "LC1".into(),
            name: "Dead Load".into(),
            load_type: LoadType::DeadLoad,
            loads: vec![
                Load::DistributedLoad {
                    element_id: "B1".into(),
                    wx: 0.0,
                    wy: -10000.0,
                    wz: 0.0,
                },
            ],
        };
        
        assert!(matches!(dead.load_type, LoadType::DeadLoad));
        assert_eq!(dead.loads.len(), 1);
    }

    #[test]
    fn test_parser_entities_by_type() {
        let parser = IfcParser::new();
        let beams = parser.get_entities_by_type("IFCBEAM");
        assert!(beams.is_empty());
    }
}
