mod solver;
pub mod renderer;
pub mod ai_architect;

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen;



#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn solve_structure_wasm(nodes_val: JsValue, elements_val: JsValue) -> JsValue {
    // Deserialize inputs
    let nodes: Vec<solver::Node> = match serde_wasm_bindgen::from_value(nodes_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing nodes: {}", e)),
    };
    
    let elements: Vec<solver::Element> = match serde_wasm_bindgen::from_value(elements_val) {
        Ok(v) => v,
        Err(e) => return JsValue::from_str(&format!("Error parsing elements: {}", e)),
    };

    // Solve
    match solver::analyze(nodes, elements) {
        Ok(result) => {
             match serde_wasm_bindgen::to_value(&result) {
                 Ok(val) => val,
                 Err(e) => JsValue::from_str(&format!("Error serializing result: {}", e)),
             }
        },
        Err(e) => {
            // Return error object
            let err_res = solver::AnalysisResult {
                displacements: std::collections::HashMap::new(),
                success: false,
                error: Some(e),
            };
            serde_wasm_bindgen::to_value(&err_res).unwrap_or(JsValue::from_str("Error"))
        }
    }
}
