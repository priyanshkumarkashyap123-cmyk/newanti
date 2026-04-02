//! CAD Export Module - DXF Format façade.
//!
//! DXF entities, writer, and structural export logic are factored into
//! specialized modules while preserving API compatibility.

pub use crate::cad_dxf_types::*;
pub use crate::cad_dxf_writer::*;
pub use crate::cad_structural_exporter::*;

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

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
