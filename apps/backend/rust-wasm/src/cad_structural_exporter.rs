// ============================================================================
// STRUCTURAL MODEL EXPORTER
// ============================================================================

use std::collections::HashMap;
use std::f64::consts::PI;

use crate::cad_dxf_types::*;

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

