//! CAD Export Module - DXF Format
//! 
//! Exports structural models to DXF format for CAD software integration
//! Supports AutoCAD, BricsCAD, LibreCAD, and other DXF-compatible software

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f64::consts::PI;

// ============================================================================
// DXF DOCUMENT STRUCTURE
// ============================================================================

/// DXF Document
#[derive(Debug, Clone, Default)]
pub struct DxfDocument {
    /// Header variables
    pub header: DxfHeader,
    /// Tables (layers, styles, etc.)
    pub tables: DxfTables,
    /// Blocks (for symbols)
    pub blocks: Vec<DxfBlock>,
    /// Entities
    pub entities: Vec<DxfEntity>,
}

/// DXF Header section
#[derive(Debug, Clone)]
pub struct DxfHeader {
    pub acadver: String,
    pub insbase: (f64, f64, f64),
    pub extmin: (f64, f64, f64),
    pub extmax: (f64, f64, f64),
    pub ltscale: f64,
    pub dimscale: f64,
    pub units: DxfUnits,
}

/// DXF Units
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DxfUnits {
    Unitless = 0,
    Inches = 1,
    Feet = 2,
    Miles = 3,
    Millimeters = 4,
    Centimeters = 5,
    Meters = 6,
    Kilometers = 7,
}

impl Default for DxfHeader {
    fn default() -> Self {
        Self {
            acadver: "AC1032".to_string(), // AutoCAD 2018
            insbase: (0.0, 0.0, 0.0),
            extmin: (0.0, 0.0, 0.0),
            extmax: (1000.0, 1000.0, 100.0),
            ltscale: 1.0,
            dimscale: 1.0,
            units: DxfUnits::Millimeters,
        }
    }
}

/// DXF Tables section
#[derive(Debug, Clone, Default)]
pub struct DxfTables {
    pub layers: Vec<DxfLayer>,
    pub line_types: Vec<DxfLineType>,
    pub text_styles: Vec<DxfTextStyle>,
    pub dim_styles: Vec<DxfDimStyle>,
}

/// DXF Layer
#[derive(Debug, Clone)]
pub struct DxfLayer {
    pub name: String,
    pub color: i16,
    pub line_type: String,
    pub frozen: bool,
    pub locked: bool,
}

impl DxfLayer {
    pub fn new(name: &str, color: i16) -> Self {
        Self {
            name: name.to_string(),
            color,
            line_type: "CONTINUOUS".to_string(),
            frozen: false,
            locked: false,
        }
    }
}

/// DXF Line Type
#[derive(Debug, Clone)]
pub struct DxfLineType {
    pub name: String,
    pub description: String,
    pub pattern: Vec<f64>,
}

impl DxfLineType {
    pub fn continuous() -> Self {
        Self {
            name: "CONTINUOUS".to_string(),
            description: "Solid line".to_string(),
            pattern: vec![],
        }
    }

    pub fn dashed() -> Self {
        Self {
            name: "DASHED".to_string(),
            description: "Dashed line".to_string(),
            pattern: vec![12.5, -6.25],
        }
    }

    pub fn center() -> Self {
        Self {
            name: "CENTER".to_string(),
            description: "Center line".to_string(),
            pattern: vec![31.25, -6.25, 6.25, -6.25],
        }
    }

    pub fn hidden() -> Self {
        Self {
            name: "HIDDEN".to_string(),
            description: "Hidden line".to_string(),
            pattern: vec![6.25, -3.125],
        }
    }
}

/// DXF Text Style
#[derive(Debug, Clone)]
pub struct DxfTextStyle {
    pub name: String,
    pub font: String,
    pub height: f64,
    pub width_factor: f64,
}

impl Default for DxfTextStyle {
    fn default() -> Self {
        Self {
            name: "STANDARD".to_string(),
            font: "txt".to_string(),
            height: 0.0,
            width_factor: 1.0,
        }
    }
}

/// DXF Dimension Style
#[derive(Debug, Clone)]
pub struct DxfDimStyle {
    pub name: String,
    pub dimscale: f64,
    pub dimasz: f64,    // Arrow size
    pub dimtxt: f64,    // Text height
    pub dimexe: f64,    // Extension line extension
    pub dimexo: f64,    // Extension line offset
    pub dimgap: f64,    // Gap from dimension line to text
}

impl Default for DxfDimStyle {
    fn default() -> Self {
        Self {
            name: "STANDARD".to_string(),
            dimscale: 1.0,
            dimasz: 2.5,
            dimtxt: 2.5,
            dimexe: 1.25,
            dimexo: 0.625,
            dimgap: 0.625,
        }
    }
}

/// DXF Block definition
#[derive(Debug, Clone)]
pub struct DxfBlock {
    pub name: String,
    pub base_point: (f64, f64, f64),
    pub entities: Vec<DxfEntity>,
}

// ============================================================================
// DXF ENTITIES
// ============================================================================

/// DXF Entity types
#[derive(Debug, Clone)]
pub enum DxfEntity {
    Line(DxfLine),
    Circle(DxfCircle),
    Arc(DxfArc),
    Polyline(DxfPolyline),
    LwPolyline(DxfLwPolyline),
    Text(DxfText),
    MText(DxfMText),
    Point(DxfPoint),
    Insert(DxfInsert),
    Dimension(DxfDimension),
    Hatch(DxfHatch),
    Solid(DxfSolid),
    Face3d(DxfFace3d),
    Mesh(DxfMesh),
}

/// Common entity properties
#[derive(Debug, Clone, Default)]
pub struct EntityProperties {
    pub layer: String,
    pub color: Option<i16>,
    pub line_type: Option<String>,
    pub line_weight: Option<i16>,
}

/// DXF Line
#[derive(Debug, Clone)]
pub struct DxfLine {
    pub props: EntityProperties,
    pub start: (f64, f64, f64),
    pub end: (f64, f64, f64),
}

/// DXF Circle
#[derive(Debug, Clone)]
pub struct DxfCircle {
    pub props: EntityProperties,
    pub center: (f64, f64, f64),
    pub radius: f64,
}

/// DXF Arc
#[derive(Debug, Clone)]
pub struct DxfArc {
    pub props: EntityProperties,
    pub center: (f64, f64, f64),
    pub radius: f64,
    pub start_angle: f64,
    pub end_angle: f64,
}

/// DXF Polyline (3D)
#[derive(Debug, Clone)]
pub struct DxfPolyline {
    pub props: EntityProperties,
    pub vertices: Vec<(f64, f64, f64)>,
    pub closed: bool,
}

/// DXF Lightweight Polyline (2D)
#[derive(Debug, Clone)]
pub struct DxfLwPolyline {
    pub props: EntityProperties,
    pub vertices: Vec<(f64, f64)>,
    pub bulges: Vec<f64>,
    pub closed: bool,
}

/// DXF Text
#[derive(Debug, Clone)]
pub struct DxfText {
    pub props: EntityProperties,
    pub position: (f64, f64, f64),
    pub height: f64,
    pub text: String,
    pub rotation: f64,
    pub style: String,
    pub horizontal_justify: i16,
    pub vertical_justify: i16,
}

/// DXF MText (multiline)
#[derive(Debug, Clone)]
pub struct DxfMText {
    pub props: EntityProperties,
    pub position: (f64, f64, f64),
    pub height: f64,
    pub width: f64,
    pub text: String,
    pub attachment: i16,
}

/// DXF Point
#[derive(Debug, Clone)]
pub struct DxfPoint {
    pub props: EntityProperties,
    pub position: (f64, f64, f64),
}

/// DXF Insert (block reference)
#[derive(Debug, Clone)]
pub struct DxfInsert {
    pub props: EntityProperties,
    pub block_name: String,
    pub position: (f64, f64, f64),
    pub scale: (f64, f64, f64),
    pub rotation: f64,
}

/// DXF Dimension
#[derive(Debug, Clone)]
pub struct DxfDimension {
    pub props: EntityProperties,
    pub dim_type: DimensionType,
    pub def_point: (f64, f64, f64),
    pub text_mid_point: (f64, f64, f64),
    pub def_point2: (f64, f64, f64),
    pub def_point3: (f64, f64, f64),
    pub text_override: Option<String>,
    pub style: String,
}

#[derive(Debug, Clone, Copy)]
pub enum DimensionType {
    Linear = 0,
    Aligned = 1,
    Angular = 2,
    Diameter = 3,
    Radius = 4,
    Angular3Point = 5,
    Ordinate = 6,
}

/// DXF Hatch
#[derive(Debug, Clone)]
pub struct DxfHatch {
    pub props: EntityProperties,
    pub pattern_name: String,
    pub solid: bool,
    pub boundary_paths: Vec<Vec<(f64, f64)>>,
    pub scale: f64,
    pub angle: f64,
}

/// DXF Solid (filled triangle/quad)
#[derive(Debug, Clone)]
pub struct DxfSolid {
    pub props: EntityProperties,
    pub points: [(f64, f64, f64); 4],
}

/// DXF 3D Face
#[derive(Debug, Clone)]
pub struct DxfFace3d {
    pub props: EntityProperties,
    pub vertices: [(f64, f64, f64); 4],
    pub edge_visibility: [bool; 4],
}

/// DXF Mesh
#[derive(Debug, Clone)]
pub struct DxfMesh {
    pub props: EntityProperties,
    pub vertices: Vec<(f64, f64, f64)>,
    pub faces: Vec<Vec<usize>>,
}

// ============================================================================
// DXF WRITER
// ============================================================================

impl DxfDocument {
    /// Create a new DXF document with standard structural layers
    pub fn new_structural() -> Self {
        let mut doc = Self::default();
        
        // Add standard structural layers
        doc.tables.layers = vec![
            DxfLayer::new("0", 7), // Default layer
            DxfLayer::new("STRUCTURE", 1),      // Red - structural elements
            DxfLayer::new("BEAMS", 5),          // Blue - beams
            DxfLayer::new("COLUMNS", 3),        // Green - columns
            DxfLayer::new("SLABS", 6),          // Magenta - slabs
            DxfLayer::new("WALLS", 4),          // Cyan - walls
            DxfLayer::new("FOUNDATIONS", 30),   // Orange - foundations
            DxfLayer::new("REINFORCEMENT", 1),  // Red - rebar
            DxfLayer::new("DIMENSIONS", 7),     // White - dimensions
            DxfLayer::new("TEXT", 7),           // White - text
            DxfLayer::new("NODES", 2),          // Yellow - nodes
            DxfLayer::new("SUPPORTS", 3),       // Green - supports
            DxfLayer::new("LOADS", 1),          // Red - loads
            DxfLayer::new("CENTERLINE", 4),     // Cyan - centerlines
        ];
        
        // Add line types
        doc.tables.line_types = vec![
            DxfLineType::continuous(),
            DxfLineType::dashed(),
            DxfLineType::center(),
            DxfLineType::hidden(),
        ];
        
        // Add text style
        doc.tables.text_styles = vec![DxfTextStyle::default()];
        
        // Add dimension style
        doc.tables.dim_styles = vec![DxfDimStyle::default()];
        
        doc
    }

    /// Write to DXF format string
    pub fn to_dxf(&self) -> String {
        let mut output = String::new();
        
        // Write header section
        self.write_header(&mut output);
        
        // Write tables section
        self.write_tables(&mut output);
        
        // Write blocks section
        self.write_blocks(&mut output);
        
        // Write entities section
        self.write_entities(&mut output);
        
        // Write EOF
        output.push_str("  0\nEOF\n");
        
        output
    }

    fn write_header(&self, output: &mut String) {
        output.push_str("  0\nSECTION\n  2\nHEADER\n");
        
        // ACADVER
        output.push_str(&format!("  9\n$ACADVER\n  1\n{}\n", self.header.acadver));
        
        // INSBASE
        output.push_str(&format!(
            "  9\n$INSBASE\n 10\n{}\n 20\n{}\n 30\n{}\n",
            self.header.insbase.0, self.header.insbase.1, self.header.insbase.2
        ));
        
        // EXTMIN
        output.push_str(&format!(
            "  9\n$EXTMIN\n 10\n{}\n 20\n{}\n 30\n{}\n",
            self.header.extmin.0, self.header.extmin.1, self.header.extmin.2
        ));
        
        // EXTMAX
        output.push_str(&format!(
            "  9\n$EXTMAX\n 10\n{}\n 20\n{}\n 30\n{}\n",
            self.header.extmax.0, self.header.extmax.1, self.header.extmax.2
        ));
        
        // LTSCALE
        output.push_str(&format!("  9\n$LTSCALE\n 40\n{}\n", self.header.ltscale));
        
        // DIMSCALE
        output.push_str(&format!("  9\n$DIMSCALE\n 40\n{}\n", self.header.dimscale));
        
        // INSUNITS
        output.push_str(&format!("  9\n$INSUNITS\n 70\n{}\n", self.header.units as i16));
        
        output.push_str("  0\nENDSEC\n");
    }

    fn write_tables(&self, output: &mut String) {
        output.push_str("  0\nSECTION\n  2\nTABLES\n");
        
        // Line type table
        output.push_str("  0\nTABLE\n  2\nLTYPE\n");
        output.push_str(&format!(" 70\n{}\n", self.tables.line_types.len()));
        
        for lt in &self.tables.line_types {
            output.push_str("  0\nLTYPE\n");
            output.push_str(&format!("  2\n{}\n", lt.name));
            output.push_str(" 70\n0\n");
            output.push_str(&format!("  3\n{}\n", lt.description));
            output.push_str(&format!(" 72\n65\n 73\n{}\n", lt.pattern.len()));
            
            let total: f64 = lt.pattern.iter().map(|x| x.abs()).sum();
            output.push_str(&format!(" 40\n{}\n", total));
            
            for &p in &lt.pattern {
                output.push_str(&format!(" 49\n{}\n", p));
            }
        }
        output.push_str("  0\nENDTAB\n");
        
        // Layer table
        output.push_str("  0\nTABLE\n  2\nLAYER\n");
        output.push_str(&format!(" 70\n{}\n", self.tables.layers.len()));
        
        for layer in &self.tables.layers {
            output.push_str("  0\nLAYER\n");
            output.push_str(&format!("  2\n{}\n", layer.name));
            
            let flags = if layer.frozen { 1 } else { 0 } + if layer.locked { 4 } else { 0 };
            output.push_str(&format!(" 70\n{}\n", flags));
            output.push_str(&format!(" 62\n{}\n", layer.color));
            output.push_str(&format!("  6\n{}\n", layer.line_type));
        }
        output.push_str("  0\nENDTAB\n");
        
        // Style table
        output.push_str("  0\nTABLE\n  2\nSTYLE\n");
        output.push_str(&format!(" 70\n{}\n", self.tables.text_styles.len()));
        
        for style in &self.tables.text_styles {
            output.push_str("  0\nSTYLE\n");
            output.push_str(&format!("  2\n{}\n", style.name));
            output.push_str(" 70\n0\n");
            output.push_str(&format!(" 40\n{}\n", style.height));
            output.push_str(&format!(" 41\n{}\n", style.width_factor));
            output.push_str(&format!("  3\n{}\n", style.font));
        }
        output.push_str("  0\nENDTAB\n");
        
        output.push_str("  0\nENDSEC\n");
    }

    fn write_blocks(&self, output: &mut String) {
        output.push_str("  0\nSECTION\n  2\nBLOCKS\n");
        
        // Model space and paper space blocks
        output.push_str("  0\nBLOCK\n  8\n0\n  2\n*MODEL_SPACE\n 70\n0\n");
        output.push_str(" 10\n0.0\n 20\n0.0\n 30\n0.0\n");
        output.push_str("  0\nENDBLK\n  8\n0\n");
        
        output.push_str("  0\nBLOCK\n  8\n0\n  2\n*PAPER_SPACE\n 70\n0\n");
        output.push_str(" 10\n0.0\n 20\n0.0\n 30\n0.0\n");
        output.push_str("  0\nENDBLK\n  8\n0\n");
        
        // Custom blocks
        for block in &self.blocks {
            output.push_str("  0\nBLOCK\n");
            output.push_str("  8\n0\n");
            output.push_str(&format!("  2\n{}\n", block.name));
            output.push_str(" 70\n0\n");
            output.push_str(&format!(
                " 10\n{}\n 20\n{}\n 30\n{}\n",
                block.base_point.0, block.base_point.1, block.base_point.2
            ));
            
            for entity in &block.entities {
                self.write_entity(output, entity);
            }
            
            output.push_str("  0\nENDBLK\n  8\n0\n");
        }
        
        output.push_str("  0\nENDSEC\n");
    }

    fn write_entities(&self, output: &mut String) {
        output.push_str("  0\nSECTION\n  2\nENTITIES\n");
        
        for entity in &self.entities {
            self.write_entity(output, entity);
        }
        
        output.push_str("  0\nENDSEC\n");
    }

    fn write_entity(&self, output: &mut String, entity: &DxfEntity) {
        match entity {
            DxfEntity::Line(line) => self.write_line(output, line),
            DxfEntity::Circle(circle) => self.write_circle(output, circle),
            DxfEntity::Arc(arc) => self.write_arc(output, arc),
            DxfEntity::Polyline(pl) => self.write_polyline(output, pl),
            DxfEntity::LwPolyline(lwpl) => self.write_lwpolyline(output, lwpl),
            DxfEntity::Text(text) => self.write_text(output, text),
            DxfEntity::MText(mtext) => self.write_mtext(output, mtext),
            DxfEntity::Point(point) => self.write_point(output, point),
            DxfEntity::Insert(insert) => self.write_insert(output, insert),
            DxfEntity::Dimension(dim) => self.write_dimension(output, dim),
            DxfEntity::Hatch(hatch) => self.write_hatch(output, hatch),
            DxfEntity::Solid(solid) => self.write_solid(output, solid),
            DxfEntity::Face3d(face) => self.write_face3d(output, face),
            DxfEntity::Mesh(mesh) => self.write_mesh(output, mesh),
        }
    }

    fn write_props(&self, output: &mut String, props: &EntityProperties) {
        output.push_str(&format!("  8\n{}\n", props.layer));
        if let Some(color) = props.color {
            output.push_str(&format!(" 62\n{}\n", color));
        }
        if let Some(ref lt) = props.line_type {
            output.push_str(&format!("  6\n{}\n", lt));
        }
    }

    fn write_line(&self, output: &mut String, line: &DxfLine) {
        output.push_str("  0\nLINE\n");
        self.write_props(output, &line.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            line.start.0, line.start.1, line.start.2
        ));
        output.push_str(&format!(
            " 11\n{}\n 21\n{}\n 31\n{}\n",
            line.end.0, line.end.1, line.end.2
        ));
    }

    fn write_circle(&self, output: &mut String, circle: &DxfCircle) {
        output.push_str("  0\nCIRCLE\n");
        self.write_props(output, &circle.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            circle.center.0, circle.center.1, circle.center.2
        ));
        output.push_str(&format!(" 40\n{}\n", circle.radius));
    }

    fn write_arc(&self, output: &mut String, arc: &DxfArc) {
        output.push_str("  0\nARC\n");
        self.write_props(output, &arc.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            arc.center.0, arc.center.1, arc.center.2
        ));
        output.push_str(&format!(" 40\n{}\n", arc.radius));
        output.push_str(&format!(" 50\n{}\n", arc.start_angle));
        output.push_str(&format!(" 51\n{}\n", arc.end_angle));
    }

    fn write_polyline(&self, output: &mut String, pl: &DxfPolyline) {
        output.push_str("  0\nPOLYLINE\n");
        self.write_props(output, &pl.props);
        output.push_str(" 66\n1\n");
        output.push_str(&format!(" 70\n{}\n", if pl.closed { 1 } else { 0 }));
        
        for v in &pl.vertices {
            output.push_str("  0\nVERTEX\n");
            output.push_str(&format!("  8\n{}\n", pl.props.layer));
            output.push_str(&format!(" 10\n{}\n 20\n{}\n 30\n{}\n", v.0, v.1, v.2));
        }
        
        output.push_str("  0\nSEQEND\n");
        output.push_str(&format!("  8\n{}\n", pl.props.layer));
    }

    fn write_lwpolyline(&self, output: &mut String, lwpl: &DxfLwPolyline) {
        output.push_str("  0\nLWPOLYLINE\n");
        self.write_props(output, &lwpl.props);
        output.push_str(&format!(" 90\n{}\n", lwpl.vertices.len()));
        output.push_str(&format!(" 70\n{}\n", if lwpl.closed { 1 } else { 0 }));
        
        for (i, v) in lwpl.vertices.iter().enumerate() {
            output.push_str(&format!(" 10\n{}\n 20\n{}\n", v.0, v.1));
            if i < lwpl.bulges.len() && lwpl.bulges[i].abs() > 1e-10 {
                output.push_str(&format!(" 42\n{}\n", lwpl.bulges[i]));
            }
        }
    }

    fn write_text(&self, output: &mut String, text: &DxfText) {
        output.push_str("  0\nTEXT\n");
        self.write_props(output, &text.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            text.position.0, text.position.1, text.position.2
        ));
        output.push_str(&format!(" 40\n{}\n", text.height));
        output.push_str(&format!("  1\n{}\n", text.text));
        if text.rotation.abs() > 1e-10 {
            output.push_str(&format!(" 50\n{}\n", text.rotation));
        }
        if text.horizontal_justify != 0 {
            output.push_str(&format!(" 72\n{}\n", text.horizontal_justify));
        }
        if text.vertical_justify != 0 {
            output.push_str(&format!(
                " 11\n{}\n 21\n{}\n 31\n{}\n",
                text.position.0, text.position.1, text.position.2
            ));
            output.push_str(&format!(" 73\n{}\n", text.vertical_justify));
        }
    }

    fn write_mtext(&self, output: &mut String, mtext: &DxfMText) {
        output.push_str("  0\nMTEXT\n");
        self.write_props(output, &mtext.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            mtext.position.0, mtext.position.1, mtext.position.2
        ));
        output.push_str(&format!(" 40\n{}\n", mtext.height));
        output.push_str(&format!(" 41\n{}\n", mtext.width));
        output.push_str(&format!(" 71\n{}\n", mtext.attachment));
        output.push_str(&format!("  1\n{}\n", mtext.text));
    }

    fn write_point(&self, output: &mut String, point: &DxfPoint) {
        output.push_str("  0\nPOINT\n");
        self.write_props(output, &point.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            point.position.0, point.position.1, point.position.2
        ));
    }

    fn write_insert(&self, output: &mut String, insert: &DxfInsert) {
        output.push_str("  0\nINSERT\n");
        self.write_props(output, &insert.props);
        output.push_str(&format!("  2\n{}\n", insert.block_name));
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            insert.position.0, insert.position.1, insert.position.2
        ));
        output.push_str(&format!(
            " 41\n{}\n 42\n{}\n 43\n{}\n",
            insert.scale.0, insert.scale.1, insert.scale.2
        ));
        if insert.rotation.abs() > 1e-10 {
            output.push_str(&format!(" 50\n{}\n", insert.rotation));
        }
    }

    fn write_dimension(&self, output: &mut String, dim: &DxfDimension) {
        output.push_str("  0\nDIMENSION\n");
        self.write_props(output, &dim.props);
        output.push_str(&format!("  3\n{}\n", dim.style));
        output.push_str(&format!(" 70\n{}\n", dim.dim_type as i16));
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            dim.def_point.0, dim.def_point.1, dim.def_point.2
        ));
        output.push_str(&format!(
            " 11\n{}\n 21\n{}\n 31\n{}\n",
            dim.text_mid_point.0, dim.text_mid_point.1, dim.text_mid_point.2
        ));
        output.push_str(&format!(
            " 13\n{}\n 23\n{}\n 33\n{}\n",
            dim.def_point2.0, dim.def_point2.1, dim.def_point2.2
        ));
        output.push_str(&format!(
            " 14\n{}\n 24\n{}\n 34\n{}\n",
            dim.def_point3.0, dim.def_point3.1, dim.def_point3.2
        ));
        if let Some(ref text) = dim.text_override {
            output.push_str(&format!("  1\n{}\n", text));
        }
    }

    fn write_hatch(&self, output: &mut String, hatch: &DxfHatch) {
        output.push_str("  0\nHATCH\n");
        self.write_props(output, &hatch.props);
        output.push_str(&format!("  2\n{}\n", hatch.pattern_name));
        output.push_str(&format!(" 70\n{}\n", if hatch.solid { 1 } else { 0 }));
        output.push_str(" 71\n0\n"); // Non-associative
        output.push_str(&format!(" 91\n{}\n", hatch.boundary_paths.len()));
        
        for path in &hatch.boundary_paths {
            output.push_str(" 92\n1\n"); // External boundary
            output.push_str(&format!(" 93\n{}\n", path.len()));
            for pt in path {
                output.push_str(&format!(" 10\n{}\n 20\n{}\n", pt.0, pt.1));
            }
        }
        
        if !hatch.solid {
            output.push_str(&format!(" 52\n{}\n", hatch.angle));
            output.push_str(&format!(" 41\n{}\n", hatch.scale));
        }
    }

    fn write_solid(&self, output: &mut String, solid: &DxfSolid) {
        output.push_str("  0\nSOLID\n");
        self.write_props(output, &solid.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            solid.points[0].0, solid.points[0].1, solid.points[0].2
        ));
        output.push_str(&format!(
            " 11\n{}\n 21\n{}\n 31\n{}\n",
            solid.points[1].0, solid.points[1].1, solid.points[1].2
        ));
        output.push_str(&format!(
            " 12\n{}\n 22\n{}\n 32\n{}\n",
            solid.points[2].0, solid.points[2].1, solid.points[2].2
        ));
        output.push_str(&format!(
            " 13\n{}\n 23\n{}\n 33\n{}\n",
            solid.points[3].0, solid.points[3].1, solid.points[3].2
        ));
    }

    fn write_face3d(&self, output: &mut String, face: &DxfFace3d) {
        output.push_str("  0\n3DFACE\n");
        self.write_props(output, &face.props);
        output.push_str(&format!(
            " 10\n{}\n 20\n{}\n 30\n{}\n",
            face.vertices[0].0, face.vertices[0].1, face.vertices[0].2
        ));
        output.push_str(&format!(
            " 11\n{}\n 21\n{}\n 31\n{}\n",
            face.vertices[1].0, face.vertices[1].1, face.vertices[1].2
        ));
        output.push_str(&format!(
            " 12\n{}\n 22\n{}\n 32\n{}\n",
            face.vertices[2].0, face.vertices[2].1, face.vertices[2].2
        ));
        output.push_str(&format!(
            " 13\n{}\n 23\n{}\n 33\n{}\n",
            face.vertices[3].0, face.vertices[3].1, face.vertices[3].2
        ));
    }

    fn write_mesh(&self, output: &mut String, mesh: &DxfMesh) {
        // Write mesh as individual 3D faces
        for face_indices in &mesh.faces {
            if face_indices.len() >= 3 {
                let v0 = mesh.vertices[face_indices[0]];
                let v1 = mesh.vertices[face_indices[1]];
                let v2 = mesh.vertices[face_indices[2]];
                let v3 = if face_indices.len() > 3 {
                    mesh.vertices[face_indices[3]]
                } else {
                    v2
                };
                
                let face = DxfFace3d {
                    props: mesh.props.clone(),
                    vertices: [v0, v1, v2, v3],
                    edge_visibility: [true, true, true, true],
                };
                self.write_face3d(output, &face);
            }
        }
    }
}

// ============================================================================
// STRUCTURAL MODEL EXPORTER
// ============================================================================

/// Structural model exporter to DXF
#[derive(Debug, Clone)]
pub struct StructuralDxfExporter {
    pub doc: DxfDocument,
    pub scale: f64,
    pub text_height: f64,
    pub show_node_labels: bool,
    pub show_member_labels: bool,
    pub show_dimensions: bool,
    pub show_supports: bool,
    pub show_loads: bool,
}

impl Default for StructuralDxfExporter {
    fn default() -> Self {
        Self {
            doc: DxfDocument::new_structural(),
            scale: 1.0,
            text_height: 250.0,
            show_node_labels: true,
            show_member_labels: true,
            show_dimensions: true,
            show_supports: true,
            show_loads: true,
        }
    }
}

/// Node for DXF export
#[derive(Debug, Clone)]
pub struct ExportNode {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub label: Option<String>,
}

/// Member for DXF export
#[derive(Debug, Clone)]
pub struct ExportMember {
    pub id: usize,
    pub start_node: usize,
    pub end_node: usize,
    pub section_name: String,
    pub member_type: MemberType,
}

/// Member type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MemberType {
    Beam,
    Column,
    Brace,
    Truss,
}

/// Support for DXF export
#[derive(Debug, Clone)]
pub struct ExportSupport {
    pub node_id: usize,
    pub dx: bool,
    pub dy: bool,
    pub dz: bool,
    pub rx: bool,
    pub ry: bool,
    pub rz: bool,
}

/// Load for DXF export
#[derive(Debug, Clone)]
pub struct ExportLoad {
    pub load_type: LoadType,
    pub magnitude: f64,
    pub direction: (f64, f64, f64),
    pub position: (f64, f64, f64),
    pub end_position: Option<(f64, f64, f64)>,
}

#[derive(Debug, Clone, Copy)]
pub enum LoadType {
    PointLoad,
    DistributedLoad,
    Moment,
}

impl StructuralDxfExporter {
    /// Create exporter with custom settings
    pub fn new(scale: f64, text_height: f64) -> Self {
        Self {
            scale,
            text_height,
            ..Default::default()
        }
    }

    /// Add nodes to the drawing
    pub fn add_nodes(&mut self, nodes: &[ExportNode]) {
        for node in nodes {
            let pos = (node.x * self.scale, node.y * self.scale, node.z * self.scale);
            
            // Draw node point
            self.doc.entities.push(DxfEntity::Point(DxfPoint {
                props: EntityProperties {
                    layer: "NODES".to_string(),
                    color: Some(2),
                    ..Default::default()
                },
                position: pos,
            }));
            
            // Draw node marker (small circle)
            self.doc.entities.push(DxfEntity::Circle(DxfCircle {
                props: EntityProperties {
                    layer: "NODES".to_string(),
                    color: Some(2),
                    ..Default::default()
                },
                center: pos,
                radius: self.text_height * 0.2,
            }));
            
            // Add node label
            if self.show_node_labels {
                let label = node.label.clone().unwrap_or_else(|| format!("N{}", node.id));
                self.doc.entities.push(DxfEntity::Text(DxfText {
                    props: EntityProperties {
                        layer: "TEXT".to_string(),
                        ..Default::default()
                    },
                    position: (pos.0 + self.text_height * 0.3, pos.1 + self.text_height * 0.3, pos.2),
                    height: self.text_height,
                    text: label,
                    rotation: 0.0,
                    style: "STANDARD".to_string(),
                    horizontal_justify: 0,
                    vertical_justify: 0,
                }));
            }
        }
    }

    /// Add members to the drawing
    pub fn add_members(&mut self, members: &[ExportMember], nodes: &HashMap<usize, ExportNode>) {
        for member in members {
            let start = nodes.get(&member.start_node);
            let end = nodes.get(&member.end_node);
            
            if let (Some(s), Some(e)) = (start, end) {
                let p1 = (s.x * self.scale, s.y * self.scale, s.z * self.scale);
                let p2 = (e.x * self.scale, e.y * self.scale, e.z * self.scale);
                
                // Determine layer based on member type
                let layer = match member.member_type {
                    MemberType::Beam => "BEAMS",
                    MemberType::Column => "COLUMNS",
                    MemberType::Brace | MemberType::Truss => "STRUCTURE",
                };
                
                // Draw member line
                self.doc.entities.push(DxfEntity::Line(DxfLine {
                    props: EntityProperties {
                        layer: layer.to_string(),
                        ..Default::default()
                    },
                    start: p1,
                    end: p2,
                }));
                
                // Add member label at midpoint
                if self.show_member_labels {
                    let mid = (
                        (p1.0 + p2.0) / 2.0,
                        (p1.1 + p2.1) / 2.0,
                        (p1.2 + p2.2) / 2.0,
                    );
                    
                    let label = format!("M{} ({})", member.id, member.section_name);
                    let angle = (p2.1 - p1.1).atan2(p2.0 - p1.0) * 180.0 / PI;
                    
                    self.doc.entities.push(DxfEntity::Text(DxfText {
                        props: EntityProperties {
                            layer: "TEXT".to_string(),
                            ..Default::default()
                        },
                        position: (mid.0, mid.1 + self.text_height * 0.5, mid.2),
                        height: self.text_height * 0.8,
                        text: label,
                        rotation: angle,
                        style: "STANDARD".to_string(),
                        horizontal_justify: 1, // Center
                        vertical_justify: 0,
                    }));
                }
            }
        }
    }

    /// Add supports to the drawing
    pub fn add_supports(&mut self, supports: &[ExportSupport], nodes: &HashMap<usize, ExportNode>) {
        if !self.show_supports {
            return;
        }
        
        for support in supports {
            if let Some(node) = nodes.get(&support.node_id) {
                let pos = (node.x * self.scale, node.y * self.scale, node.z * self.scale);
                
                // Determine support type
                let is_fixed = support.dx && support.dy && support.dz && 
                              support.rx && support.ry && support.rz;
                let is_pinned = support.dx && support.dy && support.dz && 
                              !support.rx && !support.ry && !support.rz;
                let is_roller = (support.dx || support.dy) && !support.dz;
                
                let size = self.text_height * 1.5;
                
                if is_fixed {
                    // Draw fixed support (filled rectangle)
                    self.draw_fixed_support(pos, size);
                } else if is_pinned {
                    // Draw pinned support (triangle)
                    self.draw_pinned_support(pos, size);
                } else if is_roller {
                    // Draw roller support (triangle with circles)
                    self.draw_roller_support(pos, size);
                } else {
                    // Draw generic support
                    self.draw_generic_support(pos, size, support);
                }
            }
        }
    }

    fn draw_fixed_support(&mut self, pos: (f64, f64, f64), size: f64) {
        // Rectangle below node
        let vertices = vec![
            (pos.0 - size, pos.1 - size),
            (pos.0 + size, pos.1 - size),
            (pos.0 + size, pos.1 - size * 0.3),
            (pos.0 - size, pos.1 - size * 0.3),
        ];
        
        self.doc.entities.push(DxfEntity::LwPolyline(DxfLwPolyline {
            props: EntityProperties {
                layer: "SUPPORTS".to_string(),
                color: Some(3),
                ..Default::default()
            },
            vertices,
            bulges: vec![],
            closed: true,
        }));
        
        // Hatch lines
        for i in 0..5 {
            let x = pos.0 - size + (i as f64) * size * 0.5;
            self.doc.entities.push(DxfEntity::Line(DxfLine {
                props: EntityProperties {
                    layer: "SUPPORTS".to_string(),
                    color: Some(3),
                    ..Default::default()
                },
                start: (x, pos.1 - size, 0.0),
                end: (x - size * 0.3, pos.1 - size * 1.3, 0.0),
            }));
        }
    }

    fn draw_pinned_support(&mut self, pos: (f64, f64, f64), size: f64) {
        // Triangle pointing up
        let vertices = vec![
            (pos.0, pos.1),
            (pos.0 - size, pos.1 - size),
            (pos.0 + size, pos.1 - size),
        ];
        
        self.doc.entities.push(DxfEntity::LwPolyline(DxfLwPolyline {
            props: EntityProperties {
                layer: "SUPPORTS".to_string(),
                color: Some(3),
                ..Default::default()
            },
            vertices,
            bulges: vec![],
            closed: true,
        }));
    }

    fn draw_roller_support(&mut self, pos: (f64, f64, f64), size: f64) {
        // Triangle
        self.draw_pinned_support(pos, size);
        
        // Circles below
        let circle_r = size * 0.15;
        for i in 0..3 {
            let cx = pos.0 - size * 0.5 + (i as f64) * size * 0.5;
            let cy = pos.1 - size - circle_r * 1.5;
            
            self.doc.entities.push(DxfEntity::Circle(DxfCircle {
                props: EntityProperties {
                    layer: "SUPPORTS".to_string(),
                    color: Some(3),
                    ..Default::default()
                },
                center: (cx, cy, 0.0),
                radius: circle_r,
            }));
        }
    }

    fn draw_generic_support(&mut self, pos: (f64, f64, f64), size: f64, support: &ExportSupport) {
        // Draw arrows for each restrained DOF
        let arrow_size = size * 0.5;
        
        if support.dx {
            self.draw_arrow(pos, (pos.0 - arrow_size, pos.1, pos.2), "SUPPORTS", 3);
        }
        if support.dy {
            self.draw_arrow(pos, (pos.0, pos.1 - arrow_size, pos.2), "SUPPORTS", 3);
        }
        if support.dz {
            self.draw_arrow(pos, (pos.0, pos.1, pos.2 - arrow_size), "SUPPORTS", 3);
        }
    }

    /// Add loads to the drawing
    pub fn add_loads(&mut self, loads: &[ExportLoad]) {
        if !self.show_loads {
            return;
        }
        
        for load in loads {
            match load.load_type {
                LoadType::PointLoad => {
                    self.draw_point_load(load);
                }
                LoadType::DistributedLoad => {
                    self.draw_distributed_load(load);
                }
                LoadType::Moment => {
                    self.draw_moment_load(load);
                }
            }
        }
    }

    fn draw_point_load(&mut self, load: &ExportLoad) {
        let pos = (
            load.position.0 * self.scale,
            load.position.1 * self.scale,
            load.position.2 * self.scale,
        );
        
        let arrow_length = self.text_height * 3.0;
        let end = (
            pos.0 + load.direction.0 * arrow_length,
            pos.1 + load.direction.1 * arrow_length,
            pos.2 + load.direction.2 * arrow_length,
        );
        
        self.draw_arrow(pos, end, "LOADS", 1);
        
        // Add load value
        self.doc.entities.push(DxfEntity::Text(DxfText {
            props: EntityProperties {
                layer: "LOADS".to_string(),
                color: Some(1),
                ..Default::default()
            },
            position: end,
            height: self.text_height * 0.8,
            text: format!("{:.1} kN", load.magnitude),
            rotation: 0.0,
            style: "STANDARD".to_string(),
            horizontal_justify: 0,
            vertical_justify: 0,
        }));
    }

    fn draw_distributed_load(&mut self, load: &ExportLoad) {
        if let Some(end_pos) = load.end_position {
            let p1 = (
                load.position.0 * self.scale,
                load.position.1 * self.scale,
                load.position.2 * self.scale,
            );
            let p2 = (
                end_pos.0 * self.scale,
                end_pos.1 * self.scale,
                end_pos.2 * self.scale,
            );
            
            // Draw multiple arrows along the member
            let num_arrows = 5;
            let arrow_length = self.text_height * 2.0;
            
            for i in 0..=num_arrows {
                let t = i as f64 / num_arrows as f64;
                let pos = (
                    p1.0 + t * (p2.0 - p1.0),
                    p1.1 + t * (p2.1 - p1.1),
                    p1.2 + t * (p2.2 - p1.2),
                );
                
                let end = (
                    pos.0 + load.direction.0 * arrow_length,
                    pos.1 + load.direction.1 * arrow_length,
                    pos.2 + load.direction.2 * arrow_length,
                );
                
                self.draw_arrow(pos, end, "LOADS", 1);
            }
            
            // Connect arrow tips
            let tip1 = (
                p1.0 + load.direction.0 * arrow_length,
                p1.1 + load.direction.1 * arrow_length,
                p1.2,
            );
            let tip2 = (
                p2.0 + load.direction.0 * arrow_length,
                p2.1 + load.direction.1 * arrow_length,
                p2.2,
            );
            
            self.doc.entities.push(DxfEntity::Line(DxfLine {
                props: EntityProperties {
                    layer: "LOADS".to_string(),
                    color: Some(1),
                    ..Default::default()
                },
                start: tip1,
                end: tip2,
            }));
            
            // Add load value at center
            let mid = (
                (tip1.0 + tip2.0) / 2.0,
                (tip1.1 + tip2.1) / 2.0,
                (tip1.2 + tip2.2) / 2.0,
            );
            
            self.doc.entities.push(DxfEntity::Text(DxfText {
                props: EntityProperties {
                    layer: "LOADS".to_string(),
                    color: Some(1),
                    ..Default::default()
                },
                position: mid,
                height: self.text_height * 0.8,
                text: format!("{:.1} kN/m", load.magnitude),
                rotation: 0.0,
                style: "STANDARD".to_string(),
                horizontal_justify: 1,
                vertical_justify: 0,
            }));
        }
    }

    fn draw_moment_load(&mut self, load: &ExportLoad) {
        let pos = (
            load.position.0 * self.scale,
            load.position.1 * self.scale,
            load.position.2 * self.scale,
        );
        
        // Draw arc with arrow
        let radius = self.text_height * 1.5;
        let start_angle = if load.magnitude > 0.0 { 30.0 } else { -150.0 };
        let end_angle = if load.magnitude > 0.0 { 150.0 } else { -30.0 };
        
        self.doc.entities.push(DxfEntity::Arc(DxfArc {
            props: EntityProperties {
                layer: "LOADS".to_string(),
                color: Some(1),
                ..Default::default()
            },
            center: pos,
            radius,
            start_angle,
            end_angle,
        }));
        
        // Add arrow head at arc end
        let end_rad = end_angle * PI / 180.0;
        let _arrow_pos = (
            pos.0 + radius * end_rad.cos(),
            pos.1 + radius * end_rad.sin(),
            pos.2,
        );
        
        // Add moment value
        self.doc.entities.push(DxfEntity::Text(DxfText {
            props: EntityProperties {
                layer: "LOADS".to_string(),
                color: Some(1),
                ..Default::default()
            },
            position: (pos.0, pos.1 + radius * 1.5, pos.2),
            height: self.text_height * 0.8,
            text: format!("{:.1} kNm", load.magnitude.abs()),
            rotation: 0.0,
            style: "STANDARD".to_string(),
            horizontal_justify: 1,
            vertical_justify: 0,
        }));
    }

    fn draw_arrow(&mut self, start: (f64, f64, f64), end: (f64, f64, f64), layer: &str, color: i16) {
        // Draw shaft
        self.doc.entities.push(DxfEntity::Line(DxfLine {
            props: EntityProperties {
                layer: layer.to_string(),
                color: Some(color),
                ..Default::default()
            },
            start,
            end,
        }));
        
        // Draw arrowhead
        let dx = end.0 - start.0;
        let dy = end.1 - start.1;
        let length = (dx * dx + dy * dy).sqrt();
        
        if length > 0.0 {
            let head_length = self.text_height * 0.3;
            let head_width = self.text_height * 0.15;
            
            let ux = dx / length;
            let uy = dy / length;
            
            // Perpendicular
            let px = -uy;
            let py = ux;
            
            let p1 = (
                end.0 - ux * head_length + px * head_width,
                end.1 - uy * head_length + py * head_width,
                end.2,
            );
            let p2 = (
                end.0 - ux * head_length - px * head_width,
                end.1 - uy * head_length - py * head_width,
                end.2,
            );
            
            self.doc.entities.push(DxfEntity::Line(DxfLine {
                props: EntityProperties {
                    layer: layer.to_string(),
                    color: Some(color),
                    ..Default::default()
                },
                start: end,
                end: p1,
            }));
            
            self.doc.entities.push(DxfEntity::Line(DxfLine {
                props: EntityProperties {
                    layer: layer.to_string(),
                    color: Some(color),
                    ..Default::default()
                },
                start: end,
                end: p2,
            }));
        }
    }

    /// Add dimensions between two nodes
    pub fn add_dimension(&mut self, p1: (f64, f64, f64), p2: (f64, f64, f64), offset: f64) {
        if !self.show_dimensions {
            return;
        }
        
        let p1_scaled = (p1.0 * self.scale, p1.1 * self.scale, p1.2 * self.scale);
        let p2_scaled = (p2.0 * self.scale, p2.1 * self.scale, p2.2 * self.scale);
        
        // Calculate dimension line position
        let dx = p2_scaled.0 - p1_scaled.0;
        let dy = p2_scaled.1 - p1_scaled.1;
        let length = (dx * dx + dy * dy).sqrt();
        
        // Perpendicular direction for offset
        let px = -dy / length * offset;
        let py = dx / length * offset;
        
        let def_point = (
            (p1_scaled.0 + p2_scaled.0) / 2.0 + px,
            (p1_scaled.1 + p2_scaled.1) / 2.0 + py,
            0.0,
        );
        
        let actual_length = ((p2.0 - p1.0).powi(2) + (p2.1 - p1.1).powi(2)).sqrt();
        
        self.doc.entities.push(DxfEntity::Dimension(DxfDimension {
            props: EntityProperties {
                layer: "DIMENSIONS".to_string(),
                ..Default::default()
            },
            dim_type: DimensionType::Aligned,
            def_point,
            text_mid_point: def_point,
            def_point2: p1_scaled,
            def_point3: p2_scaled,
            text_override: Some(format!("{:.0}", actual_length)),
            style: "STANDARD".to_string(),
        }));
    }

    /// Generate DXF string
    pub fn to_dxf(&self) -> String {
        self.doc.to_dxf()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dxf_document_creation() {
        let doc = DxfDocument::new_structural();
        assert!(!doc.tables.layers.is_empty());
        assert!(doc.tables.layers.iter().any(|l| l.name == "BEAMS"));
        assert!(doc.tables.layers.iter().any(|l| l.name == "COLUMNS"));
    }

    #[test]
    fn test_dxf_output() {
        let doc = DxfDocument::new_structural();
        let dxf = doc.to_dxf();
        
        assert!(dxf.contains("SECTION"));
        assert!(dxf.contains("HEADER"));
        assert!(dxf.contains("TABLES"));
        assert!(dxf.contains("ENTITIES"));
        assert!(dxf.contains("EOF"));
    }

    #[test]
    fn test_line_entity() {
        let mut doc = DxfDocument::default();
        
        doc.entities.push(DxfEntity::Line(DxfLine {
            props: EntityProperties {
                layer: "0".to_string(),
                ..Default::default()
            },
            start: (0.0, 0.0, 0.0),
            end: (100.0, 100.0, 0.0),
        }));
        
        let dxf = doc.to_dxf();
        assert!(dxf.contains("LINE"));
    }

    #[test]
    fn test_structural_exporter() {
        let mut exporter = StructuralDxfExporter::default();
        
        let nodes = vec![
            ExportNode { id: 1, x: 0.0, y: 0.0, z: 0.0, label: None },
            ExportNode { id: 2, x: 6000.0, y: 0.0, z: 0.0, label: None },
            ExportNode { id: 3, x: 6000.0, y: 0.0, z: 3000.0, label: None },
        ];
        
        exporter.add_nodes(&nodes);
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("NODES"));
    }

    #[test]
    fn test_structural_members() {
        let mut exporter = StructuralDxfExporter::default();
        
        let nodes = vec![
            ExportNode { id: 1, x: 0.0, y: 0.0, z: 0.0, label: None },
            ExportNode { id: 2, x: 6000.0, y: 0.0, z: 0.0, label: None },
        ];
        
        let node_map: HashMap<usize, ExportNode> = nodes.iter()
            .map(|n| (n.id, n.clone()))
            .collect();
        
        let members = vec![
            ExportMember {
                id: 1,
                start_node: 1,
                end_node: 2,
                section_name: "ISMB 300".to_string(),
                member_type: MemberType::Beam,
            },
        ];
        
        exporter.add_nodes(&nodes);
        exporter.add_members(&members, &node_map);
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("BEAMS"));
        assert!(dxf.contains("ISMB 300"));
    }

    #[test]
    fn test_supports() {
        let mut exporter = StructuralDxfExporter::default();
        
        let nodes = vec![
            ExportNode { id: 1, x: 0.0, y: 0.0, z: 0.0, label: None },
        ];
        
        let node_map: HashMap<usize, ExportNode> = nodes.iter()
            .map(|n| (n.id, n.clone()))
            .collect();
        
        let supports = vec![
            ExportSupport {
                node_id: 1,
                dx: true, dy: true, dz: true,
                rx: true, ry: true, rz: true,
            },
        ];
        
        exporter.add_nodes(&nodes);
        exporter.add_supports(&supports, &node_map);
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("SUPPORTS"));
    }

    #[test]
    fn test_loads() {
        let mut exporter = StructuralDxfExporter::default();
        
        let loads = vec![
            ExportLoad {
                load_type: LoadType::PointLoad,
                magnitude: 50.0,
                direction: (0.0, -1.0, 0.0),
                position: (3000.0, 0.0, 0.0),
                end_position: None,
            },
        ];
        
        exporter.add_loads(&loads);
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("LOADS"));
        assert!(dxf.contains("50.0 kN"));
    }

    #[test]
    fn test_complete_frame() {
        let mut exporter = StructuralDxfExporter::new(1.0, 200.0);
        
        // Simple portal frame
        let nodes = vec![
            ExportNode { id: 1, x: 0.0, y: 0.0, z: 0.0, label: Some("A".to_string()) },
            ExportNode { id: 2, x: 0.0, y: 0.0, z: 3000.0, label: Some("B".to_string()) },
            ExportNode { id: 3, x: 6000.0, y: 0.0, z: 3000.0, label: Some("C".to_string()) },
            ExportNode { id: 4, x: 6000.0, y: 0.0, z: 0.0, label: Some("D".to_string()) },
        ];
        
        let node_map: HashMap<usize, ExportNode> = nodes.iter()
            .map(|n| (n.id, n.clone()))
            .collect();
        
        let members = vec![
            ExportMember { id: 1, start_node: 1, end_node: 2, section_name: "ISMB 300".to_string(), member_type: MemberType::Column },
            ExportMember { id: 2, start_node: 2, end_node: 3, section_name: "ISMB 400".to_string(), member_type: MemberType::Beam },
            ExportMember { id: 3, start_node: 3, end_node: 4, section_name: "ISMB 300".to_string(), member_type: MemberType::Column },
        ];
        
        let supports = vec![
            ExportSupport { node_id: 1, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
            ExportSupport { node_id: 4, dx: true, dy: true, dz: true, rx: true, ry: true, rz: true },
        ];
        
        exporter.add_nodes(&nodes);
        exporter.add_members(&members, &node_map);
        exporter.add_supports(&supports, &node_map);
        
        let dxf = exporter.to_dxf();
        
        // Verify all sections present
        assert!(dxf.contains("HEADER"));
        assert!(dxf.contains("TABLES"));
        assert!(dxf.contains("BLOCKS"));
        assert!(dxf.contains("ENTITIES"));
        assert!(dxf.contains("EOF"));
        
        // Verify layers
        assert!(dxf.contains("BEAMS"));
        assert!(dxf.contains("COLUMNS"));
        assert!(dxf.contains("SUPPORTS"));
    }

    #[test]
    fn test_dimension() {
        let mut exporter = StructuralDxfExporter::default();
        
        exporter.add_dimension(
            (0.0, 0.0, 0.0),
            (6000.0, 0.0, 0.0),
            500.0,
        );
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("DIMENSION"));
        assert!(dxf.contains("6000"));
    }

    #[test]
    fn test_distributed_load() {
        let mut exporter = StructuralDxfExporter::default();
        
        let loads = vec![
            ExportLoad {
                load_type: LoadType::DistributedLoad,
                magnitude: 25.0,
                direction: (0.0, -1.0, 0.0),
                position: (0.0, 0.0, 3000.0),
                end_position: Some((6000.0, 0.0, 3000.0)),
            },
        ];
        
        exporter.add_loads(&loads);
        
        let dxf = exporter.to_dxf();
        assert!(dxf.contains("kN/m"));
    }
}
