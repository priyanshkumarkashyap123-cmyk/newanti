//! Renderer stub - WebGPU rendering handled by Three.js in frontend
//! This module is a placeholder for future wgpu-based rendering.

use wasm_bindgen::prelude::*;

/// Placeholder renderer - actual rendering done in TypeScript/Three.js
#[wasm_bindgen]
pub struct Renderer {
    _width: u32,
    _height: u32,
}

#[wasm_bindgen]
impl Renderer {
    /// Create stub renderer
    #[wasm_bindgen(constructor)]
    pub fn new(_canvas: web_sys::HtmlCanvasElement) -> Result<Renderer, JsValue> {
        Ok(Renderer {
            _width: 800,
            _height: 600,
        })
    }

    /// Resize stub
    pub fn resize(&mut self, width: u32, height: u32) {
        self._width = width;
        self._height = height;
    }

    /// Render stub
    pub fn render(&mut self) -> Result<(), JsValue> {
        // Rendering handled by Three.js in frontend
        Ok(())
    }
}
