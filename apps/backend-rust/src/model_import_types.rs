use serde::{Deserialize, Serialize};

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