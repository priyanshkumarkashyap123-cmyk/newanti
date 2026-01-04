use wgpu;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Renderer {
    surface: wgpu::Surface<'static>,
    device: wgpu::Device,
    queue: wgpu::Queue,
    config: wgpu::SurfaceConfiguration,
}

#[wasm_bindgen]
impl Renderer {
    pub async fn new(canvas: web_sys::HtmlCanvasElement) -> Result<Renderer, JsValue> {
        let instance = wgpu::Instance::default();
        
        // Note: For newer wgpu versions on WASM, create_surface calls might differ.
        // Assuming implicit conversion or SurfaceTarget if available.
        // Based on error message, create_surface exists.
        // We clone canvas to satisfy potential ownership/lifetime needs if wrapping.
        
        let surface = instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
             .map_err(|e| e.to_string())?;
        
        let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        }).await.ok_or("Failed to find an appropriate adapter")?;

        // Use default limits instead of downlevel_webgl2_defaults to avoid
        // requesting unsupported limits like maxInterStageShaderComponents
        // The default() method provides conservative limits that work across all browsers
        let (device, queue) = adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("BeamLab WGPU Device"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
            },
            None,
        ).await.map_err(|e| e.to_string())?;

        let width = canvas.width();
        let height = canvas.height();
        
        let surface_caps = surface.get_capabilities(&adapter);
        let surface_format = surface_caps.formats.iter()
            .copied()
            .find(|f: &wgpu::TextureFormat| f.is_srgb())
            .unwrap_or(surface_caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: surface_format,
            width,
            height,
            present_mode: surface_caps.present_modes[0],
            alpha_mode: surface_caps.alpha_modes[0],
            view_formats: vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        Ok(Renderer {
            surface,
            device,
            queue,
            config,
        })
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width > 0 && height > 0 {
            self.config.width = width;
            self.config.height = height;
            self.surface.configure(&self.device, &self.config);
        }
    }

    pub fn render(&mut self) -> Result<(), JsValue> {
        let output = self.surface.get_current_texture().map_err(|e| e.to_string())?;
        let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());
        
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Render Encoder"),
        });

        {
            let _render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.1,
                            g: 0.2,
                            b: 0.3,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                occlusion_query_set: None,
                timestamp_writes: None,
            });
        }

        self.queue.submit(std::iter::once(encoder.finish()));
        output.present();

        Ok(())
    }
}
