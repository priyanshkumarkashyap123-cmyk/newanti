//! API layer for model import operations.

use crate::model_import::{ImportFormat, ImportedModel};
use crate::model_import_ifc::IfcParser;
use crate::model_import_staad::StaadParser;

/// Import a model from file content.
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
            serde_json::from_str(content).map_err(|e| format!("JSON parse error: {}", e))
        }
        _ => Err("Unsupported format".to_string()),
    }
}

/// Auto-detect file format from content.
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
