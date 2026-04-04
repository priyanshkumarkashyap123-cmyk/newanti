// ============================================================================
// DXF WRITER
// ============================================================================

use crate::cad_dxf_types::*;

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

