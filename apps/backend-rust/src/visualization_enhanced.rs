//! Visualization Enhancement Module
//! 
//! Advanced visualization capabilities for structural analysis results
//! including animations, interactive features, and export formats.

use std::f64::consts::PI;

/// Animation keyframe
#[derive(Debug, Clone)]
pub struct Keyframe<T: Clone> {
    pub time: f64,
    pub value: T,
    pub easing: EasingFunction,
}

/// Easing functions for animations
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EasingFunction {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Bounce,
    Elastic,
}

impl EasingFunction {
    pub fn apply(&self, t: f64) -> f64 {
        let t = t.clamp(0.0, 1.0);
        match self {
            EasingFunction::Linear => t,
            EasingFunction::EaseIn => t * t,
            EasingFunction::EaseOut => 1.0 - (1.0 - t).powi(2),
            EasingFunction::EaseInOut => {
                if t < 0.5 { 2.0 * t * t }
                else { 1.0 - (-2.0 * t + 2.0).powi(2) / 2.0 }
            }
            EasingFunction::Bounce => {
                let n1 = 7.5625;
                let d1 = 2.75;
                if t < 1.0 / d1 {
                    n1 * t * t
                } else if t < 2.0 / d1 {
                    let t = t - 1.5 / d1;
                    n1 * t * t + 0.75
                } else if t < 2.5 / d1 {
                    let t = t - 2.25 / d1;
                    n1 * t * t + 0.9375
                } else {
                    let t = t - 2.625 / d1;
                    n1 * t * t + 0.984375
                }
            }
            EasingFunction::Elastic => {
                if t == 0.0 || t == 1.0 { t }
                else {
                    let c4 = (2.0 * PI) / 3.0;
                    2.0_f64.powf(-10.0 * t) * ((t * 10.0 - 0.75) * c4).sin() + 1.0
                }
            }
        }
    }
}

/// Animation timeline
#[derive(Debug, Clone)]
pub struct Timeline {
    pub duration: f64,
    pub current_time: f64,
    pub loop_mode: LoopMode,
    pub playing: bool,
    pub speed: f64,
}

/// Animation loop mode
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LoopMode {
    Once,
    Loop,
    PingPong,
}

impl Timeline {
    pub fn new(duration: f64) -> Self {
        Timeline {
            duration,
            current_time: 0.0,
            loop_mode: LoopMode::Once,
            playing: false,
            speed: 1.0,
        }
    }

    pub fn update(&mut self, delta: f64) {
        if !self.playing { return; }

        self.current_time += delta * self.speed;

        match self.loop_mode {
            LoopMode::Once => {
                if self.current_time >= self.duration {
                    self.current_time = self.duration;
                    self.playing = false;
                }
            }
            LoopMode::Loop => {
                while self.current_time >= self.duration {
                    self.current_time -= self.duration;
                }
            }
            LoopMode::PingPong => {
                let cycle = (self.current_time / self.duration).floor() as i32;
                let phase = self.current_time % self.duration;
                self.current_time = if cycle % 2 == 0 { phase } else { self.duration - phase };
            }
        }
    }

    pub fn progress(&self) -> f64 {
        self.current_time / self.duration
    }

    pub fn play(&mut self) { self.playing = true; }
    pub fn pause(&mut self) { self.playing = false; }
    pub fn stop(&mut self) { self.playing = false; self.current_time = 0.0; }
    pub fn seek(&mut self, time: f64) { self.current_time = time.clamp(0.0, self.duration); }
}

/// Deformation animation
#[derive(Debug, Clone)]
pub struct DeformationAnimation {
    pub timeline: Timeline,
    pub scale_keyframes: Vec<Keyframe<f64>>,
    pub mode_shape_index: usize,
}

impl DeformationAnimation {
    pub fn new(duration: f64) -> Self {
        DeformationAnimation {
            timeline: Timeline::new(duration),
            scale_keyframes: vec![
                Keyframe { time: 0.0, value: 0.0, easing: EasingFunction::EaseInOut },
                Keyframe { time: 0.5, value: 1.0, easing: EasingFunction::EaseInOut },
                Keyframe { time: 1.0, value: 0.0, easing: EasingFunction::EaseInOut },
            ],
            mode_shape_index: 0,
        }
    }

    /// Harmonic oscillation animation
    pub fn harmonic(duration: f64, frequency: f64) -> Self {
        let mut anim = DeformationAnimation::new(duration);
        anim.scale_keyframes.clear();

        let steps = (frequency * duration * 10.0) as usize;
        for i in 0..=steps {
            let t = i as f64 / steps as f64;
            let value = (2.0 * PI * frequency * t * duration).sin();
            anim.scale_keyframes.push(Keyframe {
                time: t,
                value,
                easing: EasingFunction::Linear,
            });
        }
        anim
    }

    pub fn current_scale(&self) -> f64 {
        let t = self.timeline.progress();
        interpolate_keyframes(&self.scale_keyframes, t)
    }
}

fn interpolate_keyframes(keyframes: &[Keyframe<f64>], t: f64) -> f64 {
    if keyframes.is_empty() { return 0.0; }
    if keyframes.len() == 1 { return keyframes[0].value; }

    // Find surrounding keyframes
    let mut prev = &keyframes[0];
    let mut next = &keyframes[keyframes.len() - 1];

    for i in 0..keyframes.len() - 1 {
        if t >= keyframes[i].time && t <= keyframes[i + 1].time {
            prev = &keyframes[i];
            next = &keyframes[i + 1];
            break;
        }
    }

    if (next.time - prev.time).abs() < 1e-10 {
        return prev.value;
    }

    let local_t = (t - prev.time) / (next.time - prev.time);
    let eased_t = next.easing.apply(local_t);
    prev.value + (next.value - prev.value) * eased_t
}

/// Stress result display options
#[derive(Debug, Clone)]
pub struct StressDisplayOptions {
    pub component: StressComponent,
    pub averaging: ResultAveraging,
    pub show_vectors: bool,
    pub show_contour: bool,
    pub legend_visible: bool,
    pub legend_position: LegendPosition,
    pub decimal_places: usize,
}

/// Stress component to display
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StressComponent {
    VonMises,
    SigmaX,
    SigmaY,
    SigmaZ,
    TauXY,
    TauYZ,
    TauXZ,
    Principal1,
    Principal2,
    Principal3,
    Tresca,
    MaxShear,
}

/// Result averaging method
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ResultAveraging {
    None,           // Element values
    Nodal,          // Average at nodes
    Derived,        // Derived quantities
}

/// Legend position
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LegendPosition {
    Left,
    Right,
    Top,
    Bottom,
}

impl Default for StressDisplayOptions {
    fn default() -> Self {
        StressDisplayOptions {
            component: StressComponent::VonMises,
            averaging: ResultAveraging::Nodal,
            show_vectors: false,
            show_contour: true,
            legend_visible: true,
            legend_position: LegendPosition::Right,
            decimal_places: 2,
        }
    }
}

/// Interactive legend with color scale
#[derive(Debug, Clone)]
pub struct ColorLegend {
    pub title: String,
    pub min_value: f64,
    pub max_value: f64,
    pub num_divisions: usize,
    pub unit: String,
    pub colormap_name: String,
    pub position: LegendPosition,
    pub width: f64,
    pub height: f64,
}

impl ColorLegend {
    pub fn new(title: &str, min: f64, max: f64, unit: &str) -> Self {
        ColorLegend {
            title: title.to_string(),
            min_value: min,
            max_value: max,
            num_divisions: 10,
            unit: unit.to_string(),
            colormap_name: "Rainbow".to_string(),
            position: LegendPosition::Right,
            width: 30.0,
            height: 200.0,
        }
    }

    pub fn divisions(&self) -> Vec<(f64, f64)> {
        let mut divs = Vec::new();
        let range = self.max_value - self.min_value;

        for i in 0..=self.num_divisions {
            let t = i as f64 / self.num_divisions as f64;
            let value = self.min_value + t * range;
            divs.push((t, value));
        }
        divs
    }

    pub fn format_value(&self, value: f64, decimals: usize) -> String {
        if value.abs() >= 1e6 {
            format!("{:.prec$e} {}", value, self.unit, prec = decimals)
        } else if value.abs() >= 1e3 {
            format!("{:.prec$} {}", value / 1e3, "k".to_string() + &self.unit, prec = decimals)
        } else {
            format!("{:.prec$} {}", value, self.unit, prec = decimals)
        }
    }
}

/// Vector field visualization
#[derive(Debug, Clone)]
pub struct VectorField {
    pub positions: Vec<[f64; 3]>,
    pub vectors: Vec<[f64; 3]>,
    pub magnitudes: Vec<f64>,
    pub scale_factor: f64,
    pub arrow_style: ArrowStyle,
    pub color_by_magnitude: bool,
}

/// Arrow display style
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArrowStyle {
    Line,
    Arrow,
    Cone,
    Cylinder,
}

impl VectorField {
    pub fn new() -> Self {
        VectorField {
            positions: Vec::new(),
            vectors: Vec::new(),
            magnitudes: Vec::new(),
            scale_factor: 1.0,
            arrow_style: ArrowStyle::Arrow,
            color_by_magnitude: true,
        }
    }

    pub fn add_vector(&mut self, position: [f64; 3], vector: [f64; 3]) {
        let mag = (vector[0].powi(2) + vector[1].powi(2) + vector[2].powi(2)).sqrt();
        self.positions.push(position);
        self.vectors.push(vector);
        self.magnitudes.push(mag);
    }

    pub fn max_magnitude(&self) -> f64 {
        self.magnitudes.iter().cloned().fold(0.0, f64::max)
    }

    pub fn auto_scale(&mut self, target_length: f64) {
        let max_mag = self.max_magnitude();
        if max_mag > 1e-10 {
            self.scale_factor = target_length / max_mag;
        }
    }
}

impl Default for VectorField {
    fn default() -> Self {
        VectorField::new()
    }
}

/// Section cut visualization
#[derive(Debug, Clone)]
pub struct SectionCut {
    pub plane: CutPlane,
    pub position: f64,
    pub visible: bool,
    pub show_fill: bool,
    pub show_outline: bool,
    pub cap_enabled: bool,
}

/// Cut plane orientation
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CutPlane {
    XY,
    YZ,
    XZ,
    Custom { normal: [f64; 3], point: [f64; 3] },
}

impl SectionCut {
    pub fn new(plane: CutPlane, position: f64) -> Self {
        SectionCut {
            plane,
            position,
            visible: true,
            show_fill: true,
            show_outline: true,
            cap_enabled: true,
        }
    }

    pub fn plane_equation(&self) -> [f64; 4] {
        match self.plane {
            CutPlane::XY => [0.0, 0.0, 1.0, -self.position],
            CutPlane::YZ => [1.0, 0.0, 0.0, -self.position],
            CutPlane::XZ => [0.0, 1.0, 0.0, -self.position],
            CutPlane::Custom { normal, point } => {
                let d = -(normal[0] * point[0] + normal[1] * point[1] + normal[2] * point[2]);
                [normal[0], normal[1], normal[2], d]
            }
        }
    }
}

/// Export formats
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ExportFormat {
    PNG,
    SVG,
    PDF,
    WebGL,
    GLTF,
    OBJ,
    STL,
}

/// Export configuration
#[derive(Debug, Clone)]
pub struct ExportConfig {
    pub format: ExportFormat,
    pub width: u32,
    pub height: u32,
    pub quality: f64,
    pub include_legend: bool,
    pub include_annotations: bool,
    pub background_color: [f64; 4],
    pub transparent_background: bool,
}

impl Default for ExportConfig {
    fn default() -> Self {
        ExportConfig {
            format: ExportFormat::PNG,
            width: 1920,
            height: 1080,
            quality: 0.95,
            include_legend: true,
            include_annotations: true,
            background_color: [1.0, 1.0, 1.0, 1.0],
            transparent_background: false,
        }
    }
}

/// Annotation types
#[derive(Debug, Clone)]
pub struct Annotation {
    pub annotation_type: AnnotationType,
    pub position: [f64; 3],
    pub text: String,
    pub visible: bool,
    pub font_size: f64,
}

/// Annotation type
#[derive(Debug, Clone)]
pub enum AnnotationType {
    Text,
    Dimension { start: [f64; 3], end: [f64; 3] },
    Leader { target: [f64; 3] },
    NodeLabel { node_id: usize },
    ElementLabel { element_id: usize },
}

impl Annotation {
    pub fn text(position: [f64; 3], text: &str) -> Self {
        Annotation {
            annotation_type: AnnotationType::Text,
            position,
            text: text.to_string(),
            visible: true,
            font_size: 12.0,
        }
    }

    pub fn dimension(start: [f64; 3], end: [f64; 3]) -> Self {
        let mid = [
            (start[0] + end[0]) / 2.0,
            (start[1] + end[1]) / 2.0,
            (start[2] + end[2]) / 2.0,
        ];
        let length = ((end[0] - start[0]).powi(2) +
                      (end[1] - start[1]).powi(2) +
                      (end[2] - start[2]).powi(2)).sqrt();

        Annotation {
            annotation_type: AnnotationType::Dimension { start, end },
            position: mid,
            text: format!("{:.2}", length),
            visible: true,
            font_size: 10.0,
        }
    }

    pub fn node_label(node_id: usize, position: [f64; 3]) -> Self {
        Annotation {
            annotation_type: AnnotationType::NodeLabel { node_id },
            position,
            text: format!("N{}", node_id),
            visible: true,
            font_size: 8.0,
        }
    }
}

/// Grid display options
#[derive(Debug, Clone)]
pub struct GridOptions {
    pub visible: bool,
    pub major_spacing: f64,
    pub minor_divisions: usize,
    pub major_color: [f64; 4],
    pub minor_color: [f64; 4],
    pub plane: CutPlane,
    pub extent: f64,
}

impl Default for GridOptions {
    fn default() -> Self {
        GridOptions {
            visible: true,
            major_spacing: 1.0,
            minor_divisions: 5,
            major_color: [0.3, 0.3, 0.3, 1.0],
            minor_color: [0.7, 0.7, 0.7, 0.5],
            plane: CutPlane::XZ,
            extent: 10.0,
        }
    }
}

/// Render settings
#[derive(Debug, Clone)]
pub struct RenderSettings {
    pub wireframe_mode: bool,
    pub show_edges: bool,
    pub edge_color: [f64; 4],
    pub antialiasing: bool,
    pub shadows: bool,
    pub ambient_occlusion: bool,
    pub line_width: f64,
    pub point_size: f64,
}

impl Default for RenderSettings {
    fn default() -> Self {
        RenderSettings {
            wireframe_mode: false,
            show_edges: false,
            edge_color: [0.0, 0.0, 0.0, 1.0],
            antialiasing: true,
            shadows: true,
            ambient_occlusion: false,
            line_width: 1.0,
            point_size: 3.0,
        }
    }
}

/// Light source
#[derive(Debug, Clone)]
pub struct Light {
    pub light_type: LightType,
    pub color: [f64; 3],
    pub intensity: f64,
    pub position: [f64; 3],
    pub direction: [f64; 3],
    pub enabled: bool,
}

/// Light type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LightType {
    Directional,
    Point,
    Spot { angle: f64, falloff: f64 },
    Ambient,
}

impl Light {
    pub fn directional(direction: [f64; 3], color: [f64; 3], intensity: f64) -> Self {
        Light {
            light_type: LightType::Directional,
            color,
            intensity,
            position: [0.0, 0.0, 0.0],
            direction,
            enabled: true,
        }
    }

    pub fn point(position: [f64; 3], color: [f64; 3], intensity: f64) -> Self {
        Light {
            light_type: LightType::Point,
            color,
            intensity,
            position,
            direction: [0.0, -1.0, 0.0],
            enabled: true,
        }
    }

    pub fn ambient(color: [f64; 3], intensity: f64) -> Self {
        Light {
            light_type: LightType::Ambient,
            color,
            intensity,
            position: [0.0, 0.0, 0.0],
            direction: [0.0, 0.0, 0.0],
            enabled: true,
        }
    }
}

/// View preset
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ViewPreset {
    Front,
    Back,
    Left,
    Right,
    Top,
    Bottom,
    Isometric,
    IsometricReverse,
}

impl ViewPreset {
    pub fn camera_position(&self, distance: f64) -> [f64; 3] {
        match self {
            ViewPreset::Front => [0.0, 0.0, distance],
            ViewPreset::Back => [0.0, 0.0, -distance],
            ViewPreset::Left => [-distance, 0.0, 0.0],
            ViewPreset::Right => [distance, 0.0, 0.0],
            ViewPreset::Top => [0.0, distance, 0.0],
            ViewPreset::Bottom => [0.0, -distance, 0.0],
            ViewPreset::Isometric => {
                let d = distance / 3.0_f64.sqrt();
                [d, d, d]
            }
            ViewPreset::IsometricReverse => {
                let d = distance / 3.0_f64.sqrt();
                [-d, d, -d]
            }
        }
    }
}

/// Picking/selection result
#[derive(Debug, Clone)]
pub struct PickResult {
    pub hit: bool,
    pub node_id: Option<usize>,
    pub element_id: Option<usize>,
    pub face_id: Option<usize>,
    pub point: [f64; 3],
    pub normal: [f64; 3],
    pub distance: f64,
}

impl PickResult {
    pub fn miss() -> Self {
        PickResult {
            hit: false,
            node_id: None,
            element_id: None,
            face_id: None,
            point: [0.0, 0.0, 0.0],
            normal: [0.0, 0.0, 0.0],
            distance: f64::INFINITY,
        }
    }
}

/// Selection state
#[derive(Debug, Clone)]
pub struct Selection {
    pub nodes: Vec<usize>,
    pub elements: Vec<usize>,
    pub faces: Vec<(usize, usize)>, // (element_id, face_id)
    pub mode: SelectionMode,
}

/// Selection mode
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SelectionMode {
    Single,
    Multiple,
    Box,
    Polygon,
}

impl Selection {
    pub fn new() -> Self {
        Selection {
            nodes: Vec::new(),
            elements: Vec::new(),
            faces: Vec::new(),
            mode: SelectionMode::Single,
        }
    }

    pub fn clear(&mut self) {
        self.nodes.clear();
        self.elements.clear();
        self.faces.clear();
    }

    pub fn toggle_node(&mut self, node_id: usize) {
        if let Some(pos) = self.nodes.iter().position(|&n| n == node_id) {
            self.nodes.remove(pos);
        } else {
            if self.mode == SelectionMode::Single {
                self.nodes.clear();
            }
            self.nodes.push(node_id);
        }
    }

    pub fn toggle_element(&mut self, element_id: usize) {
        if let Some(pos) = self.elements.iter().position(|&e| e == element_id) {
            self.elements.remove(pos);
        } else {
            if self.mode == SelectionMode::Single {
                self.elements.clear();
            }
            self.elements.push(element_id);
        }
    }
}

impl Default for Selection {
    fn default() -> Self {
        Selection::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_easing_functions() {
        let linear = EasingFunction::Linear.apply(0.5);
        assert!((linear - 0.5).abs() < 1e-10);

        let ease_in = EasingFunction::EaseIn.apply(0.5);
        assert!(ease_in < 0.5); // Slower at start

        let ease_out = EasingFunction::EaseOut.apply(0.5);
        assert!(ease_out > 0.5); // Faster at start
    }

    #[test]
    fn test_easing_boundaries() {
        for easing in [
            EasingFunction::Linear,
            EasingFunction::EaseIn,
            EasingFunction::EaseOut,
            EasingFunction::EaseInOut,
        ] {
            assert!((easing.apply(0.0) - 0.0).abs() < 1e-10);
            assert!((easing.apply(1.0) - 1.0).abs() < 1e-10);
        }
    }

    #[test]
    fn test_timeline() {
        let mut timeline = Timeline::new(1.0);
        timeline.play();
        timeline.update(0.5);
        assert!((timeline.progress() - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_timeline_loop() {
        let mut timeline = Timeline::new(1.0);
        timeline.loop_mode = LoopMode::Loop;
        timeline.play();
        timeline.update(1.5);
        assert!((timeline.progress() - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_deformation_animation() {
        let anim = DeformationAnimation::new(2.0);
        assert!(!anim.scale_keyframes.is_empty());
    }

    #[test]
    fn test_harmonic_animation() {
        let anim = DeformationAnimation::harmonic(2.0, 1.0);
        assert!(anim.scale_keyframes.len() > 10);
    }

    #[test]
    fn test_color_legend() {
        let legend = ColorLegend::new("Stress", 0.0, 100.0, "MPa");
        let divs = legend.divisions();
        assert_eq!(divs.len(), 11); // 0 to 10 inclusive
    }

    #[test]
    fn test_legend_format() {
        let legend = ColorLegend::new("Stress", 0.0, 1e6, "Pa");
        let formatted = legend.format_value(1e6, 2);
        assert!(formatted.contains("e") || formatted.contains("k"));
    }

    #[test]
    fn test_vector_field() {
        let mut field = VectorField::new();
        field.add_vector([0.0, 0.0, 0.0], [1.0, 0.0, 0.0]);
        field.add_vector([1.0, 0.0, 0.0], [0.0, 1.0, 0.0]);
        assert_eq!(field.positions.len(), 2);
        assert!((field.max_magnitude() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_vector_field_auto_scale() {
        let mut field = VectorField::new();
        field.add_vector([0.0, 0.0, 0.0], [10.0, 0.0, 0.0]);
        field.auto_scale(1.0);
        assert!((field.scale_factor - 0.1).abs() < 1e-10);
    }

    #[test]
    fn test_section_cut() {
        let cut = SectionCut::new(CutPlane::XY, 5.0);
        let eq = cut.plane_equation();
        assert!((eq[2] - 1.0).abs() < 1e-10);
        assert!((eq[3] + 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_annotation() {
        let ann = Annotation::text([0.0, 0.0, 0.0], "Test");
        assert_eq!(ann.text, "Test");
    }

    #[test]
    fn test_annotation_dimension() {
        let ann = Annotation::dimension([0.0, 0.0, 0.0], [10.0, 0.0, 0.0]);
        assert!(ann.text.contains("10"));
    }

    #[test]
    fn test_view_preset() {
        let pos = ViewPreset::Front.camera_position(10.0);
        assert!((pos[2] - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_view_preset_isometric() {
        let pos = ViewPreset::Isometric.camera_position(10.0);
        assert!(pos[0] > 0.0 && pos[1] > 0.0 && pos[2] > 0.0);
    }

    #[test]
    fn test_selection() {
        let mut sel = Selection::new();
        sel.toggle_node(1);
        assert_eq!(sel.nodes.len(), 1);
        sel.toggle_node(1);
        assert_eq!(sel.nodes.len(), 0);
    }

    #[test]
    fn test_selection_single_mode() {
        let mut sel = Selection::new();
        sel.mode = SelectionMode::Single;
        sel.toggle_node(1);
        sel.toggle_node(2);
        assert_eq!(sel.nodes.len(), 1);
        assert_eq!(sel.nodes[0], 2);
    }

    #[test]
    fn test_light() {
        let light = Light::directional([0.0, -1.0, 0.0], [1.0, 1.0, 1.0], 1.0);
        assert!(light.enabled);
    }

    #[test]
    fn test_pick_result() {
        let miss = PickResult::miss();
        assert!(!miss.hit);
        assert!(miss.distance.is_infinite());
    }

    #[test]
    fn test_export_config() {
        let config = ExportConfig::default();
        assert_eq!(config.width, 1920);
        assert_eq!(config.height, 1080);
    }

    #[test]
    fn test_render_settings() {
        let settings = RenderSettings::default();
        assert!(!settings.wireframe_mode);
        assert!(settings.antialiasing);
    }

    #[test]
    fn test_grid_options() {
        let grid = GridOptions::default();
        assert!(grid.visible);
        assert_eq!(grid.minor_divisions, 5);
    }
}
