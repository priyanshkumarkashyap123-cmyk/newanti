use std::collections::HashSet;

use crate::model_import::ImportedModel;
use crate::model_import_types::ImportWarning;

/// Validate imported model
pub fn validate_model(model: &ImportedModel) -> Vec<ImportWarning> {
    let mut warnings = Vec::new();

    // Check for orphan nodes
    let mut used_nodes: HashSet<usize> = HashSet::new();
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
    let supported_nodes: HashSet<usize> = model.supports.iter().map(|s| s.node_id).collect();

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