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

