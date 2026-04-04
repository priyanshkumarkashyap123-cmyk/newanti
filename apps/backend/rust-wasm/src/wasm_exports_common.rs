use serde::{de::DeserializeOwned, Serialize};
use wasm_bindgen::JsValue;

pub fn parse_required<T: DeserializeOwned>(value: JsValue, label: &str) -> Result<T, JsValue> {
    serde_wasm_bindgen::from_value(value)
        .map_err(|e| JsValue::from_str(&format!("Error parsing {}: {}", label, e)))
}

pub fn parse_or_default<T: DeserializeOwned + Default>(value: JsValue) -> T {
    serde_wasm_bindgen::from_value(value).unwrap_or_default()
}

pub fn parse_with_warn_or_default<T: DeserializeOwned + Default>(value: JsValue, label: &str) -> T {
    match serde_wasm_bindgen::from_value(value) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::warn_1(
                &format!("Warning: Failed to parse {} (using empty/default): {}", label, e).into(),
            );
            T::default()
        }
    }
}

pub fn serialize_or_js_error<T: Serialize>(value: &T, context: &str) -> JsValue {
    serde_wasm_bindgen::to_value(value)
        .unwrap_or_else(|e| JsValue::from_str(&format!("Serialization error ({}): {}", context, e)))
}

pub fn default_if_zero_usize(value: usize, fallback: usize) -> usize {
    if value == 0 { fallback } else { value }
}

pub fn default_if_zero_f64(value: f64, fallback: f64) -> f64 {
    if value == 0.0 { fallback } else { value }
}

pub fn sanitize_f64(value: f64) -> f64 {
    if value.is_nan() || value.is_infinite() {
        0.0
    } else {
        value
    }
}

pub fn sanitize_analysis_result_3d(result: &mut crate::solver_3d::AnalysisResult3D) {
    for (_, disp) in result.displacements.iter_mut() {
        for val in disp.iter_mut() {
            *val = sanitize_f64(*val);
        }
    }

    for (_, react) in result.reactions.iter_mut() {
        for val in react.iter_mut() {
            *val = sanitize_f64(*val);
        }
    }

    for (_, forces) in result.member_forces.iter_mut() {
        for val in forces.forces_i.iter_mut() {
            *val = sanitize_f64(*val);
        }
        for val in forces.forces_j.iter_mut() {
            *val = sanitize_f64(*val);
        }

        forces.max_shear_y = sanitize_f64(forces.max_shear_y);
        forces.max_shear_z = sanitize_f64(forces.max_shear_z);
        forces.max_moment_y = sanitize_f64(forces.max_moment_y);
        forces.max_moment_z = sanitize_f64(forces.max_moment_z);
        forces.max_axial = sanitize_f64(forces.max_axial);
        forces.max_torsion = sanitize_f64(forces.max_torsion);
    }
}
