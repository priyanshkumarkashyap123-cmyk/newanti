//! Slab Design Module
//! 
//! Comprehensive slab design including one-way slabs, two-way slabs,
//! flat plates, flat slabs with drop panels, and waffle slabs per ACI 318.

use std::f64::consts::PI;

/// Slab system type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SlabSystem {
    OneWay,
    TwoWayFlat,
    TwoWayBeams,
    FlatPlate,
    FlatSlab,      // With drop panels
    WaffleSlab,
    PostTensioned,
}

/// Support condition
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SupportCondition {
    Simple,
    Continuous,
    Cantilever,
    Fixed,
}

/// One-way slab
#[derive(Debug, Clone)]
pub struct OneWaySlab {
    pub span: f64,              // m - clear span
    pub width: f64,             // m - design strip width
    pub thickness: f64,         // mm
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub cover: f64,             // mm
    pub dead_load: f64,         // kPa (excluding self-weight)
    pub live_load: f64,         // kPa
    pub support: SupportCondition,
}

/// Two-way slab panel
#[derive(Debug, Clone)]
pub struct TwoWaySlab {
    pub span_long: f64,         // m - longer span
    pub span_short: f64,        // m - shorter span
    pub thickness: f64,         // mm
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub cover: f64,             // mm
    pub dead_load: f64,         // kPa
    pub live_load: f64,         // kPa
    pub edge_condition: EdgeCondition,
    pub has_beams: bool,
}

/// Edge condition for two-way slab
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EdgeCondition {
    AllEdgesContinuous,
    OneEdgeDiscontinuous,
    TwoAdjacentDiscontinuous,
    TwoOppositeDiscontinuous,
    ThreeEdgesDiscontinuous,
    AllEdgesDiscontinuous,
}

/// Flat plate/slab
#[derive(Debug, Clone)]
pub struct FlatSlab {
    pub span_x: f64,            // m
    pub span_y: f64,            // m
    pub thickness: f64,         // mm
    pub column_size: f64,       // mm (square column)
    pub drop_panel: Option<DropPanel>,
    pub column_capital: Option<ColumnCapital>,
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub dead_load: f64,         // kPa
    pub live_load: f64,         // kPa
}

/// Drop panel dimensions
#[derive(Debug, Clone)]
pub struct DropPanel {
    pub length: f64,            // mm
    pub width: f64,             // mm
    pub depth: f64,             // mm (additional to slab)
}

/// Column capital
#[derive(Debug, Clone)]
pub struct ColumnCapital {
    pub diameter: f64,          // mm
    pub depth: f64,             // mm
}

/// Waffle slab
#[derive(Debug, Clone)]
pub struct WaffleSlab {
    pub span: f64,              // m
    pub rib_spacing: f64,       // mm (c/c)
    pub rib_width: f64,         // mm
    pub rib_depth: f64,         // mm
    pub topping: f64,           // mm
    pub solid_head_size: f64,   // mm (at columns)
    pub concrete_fc: f64,       // MPa
    pub steel_fy: f64,          // MPa
    pub dead_load: f64,         // kPa
    pub live_load: f64,         // kPa
}

/// Slab analysis results
#[derive(Debug, Clone)]
pub struct SlabAnalysis {
    pub factored_load: f64,     // kPa
    pub max_positive_moment: f64, // kN·m/m
    pub max_negative_moment: f64, // kN·m/m
    pub max_shear: f64,         // kN/m
    pub deflection: f64,        // mm
    pub deflection_ratio: f64,  // span/deflection
}

/// Slab reinforcement
#[derive(Debug, Clone)]
pub struct SlabReinforcement {
    pub as_positive: f64,       // mm²/m
    pub as_negative: f64,       // mm²/m
    pub as_shrinkage: f64,      // mm²/m
    pub bar_size_main: f64,     // mm
    pub spacing_positive: f64,  // mm
    pub spacing_negative: f64,  // mm
    pub bar_size_dist: f64,     // mm
    pub spacing_dist: f64,      // mm
}

/// Punching shear check
#[derive(Debug, Clone)]
pub struct PunchingShearCheck {
    pub vu: f64,                // kN - factored shear
    pub vc: f64,                // kN - concrete capacity
    pub bo: f64,                // mm - critical perimeter
    pub d: f64,                 // mm - effective depth
    pub ratio: f64,             // demand/capacity
    pub adequate: bool,
    pub shear_reinforcement: Option<ShearReinforcement>,
}

/// Shear reinforcement
#[derive(Debug, Clone)]
pub struct ShearReinforcement {
    pub stud_rails: usize,      // Number of rails
    pub studs_per_rail: usize,
    pub stud_diameter: f64,     // mm
    pub spacing: f64,           // mm
}

/// Moment distribution for direct design
#[derive(Debug, Clone)]
pub struct MomentDistribution {
    pub total_static_moment: f64,  // kN·m
    pub negative_moment: f64,       // kN·m
    pub positive_moment: f64,       // kN·m
    pub column_strip_neg: f64,      // kN·m
    pub column_strip_pos: f64,      // kN·m
    pub middle_strip_neg: f64,      // kN·m
    pub middle_strip_pos: f64,      // kN·m
}

impl OneWaySlab {
    /// Create one-way slab
    pub fn new(span: f64, ll: f64) -> Self {
        let thickness = Self::minimum_thickness(span, SupportCondition::Continuous);
        
        OneWaySlab {
            span,
            width: 1.0,
            thickness,
            concrete_fc: 25.0,
            steel_fy: 420.0,
            cover: 20.0,
            dead_load: 1.5, // Finishes
            live_load: ll,
            support: SupportCondition::Continuous,
        }
    }

    /// Minimum thickness per ACI 318
    pub fn minimum_thickness(span: f64, support: SupportCondition) -> f64 {
        let span_mm = span * 1000.0;
        let factor = match support {
            SupportCondition::Simple => 20.0,
            SupportCondition::Continuous => 24.0,
            SupportCondition::Cantilever => 10.0,
            SupportCondition::Fixed => 28.0,
        };
        
        (span_mm / factor).max(100.0).ceil()
    }

    /// Self weight
    pub fn self_weight(&self) -> f64 {
        self.thickness / 1000.0 * 24.0 // kN/m³
    }

    /// Analyze slab
    pub fn analyze(&self) -> SlabAnalysis {
        let wu = 1.2 * (self.self_weight() + self.dead_load) + 1.6 * self.live_load;
        let l = self.span;
        
        // Moment coefficients (ACI)
        let (cm_pos, cm_neg) = match self.support {
            SupportCondition::Simple => (1.0 / 8.0, 0.0),
            SupportCondition::Continuous => (1.0 / 14.0, 1.0 / 10.0),
            SupportCondition::Cantilever => (0.0, 1.0 / 2.0),
            SupportCondition::Fixed => (1.0 / 16.0, 1.0 / 11.0), // ACI Table 6.5.2
        };
        
        let m_pos = cm_pos * wu * l.powi(2);
        let m_neg = cm_neg * wu * l.powi(2);
        
        // Shear (ACI Table 6.5.4: 1.15 factor at face of first interior support)
        let vu = match self.support {
            SupportCondition::Continuous | SupportCondition::Fixed => 1.15 * wu * l / 2.0,
            _ => wu * l / 2.0,
        };
        
        // Deflection (immediate) per ACI 24.2.3.5
        let ec = 4700.0 * self.concrete_fc.sqrt();
        let b_w = self.width * 1000.0;
        let i_g = b_w * self.thickness.powi(3) / 12.0; // mm⁴
        let fr = 0.62 * self.concrete_fc.sqrt(); // Modulus of rupture (MPa) ACI 19.2.3.1
        let yt = self.thickness / 2.0;
        let m_cr = fr * i_g / yt / 1e6; // kN·m (cracking moment)
        
        // Service load: kPa × 1m width = kN/m = N/mm
        let w_service = self.self_weight() + self.dead_load + self.live_load;
        let m_a = match self.support {
            SupportCondition::Simple => w_service * l.powi(2) / 8.0,
            SupportCondition::Cantilever => w_service * l.powi(2) / 2.0,
            SupportCondition::Continuous => w_service * l.powi(2) / 10.0,
            SupportCondition::Fixed => w_service * l.powi(2) / 12.0,
        };
        
        // Effective moment of inertia Ie (ACI 318-19 Eq. 24.2.3.5a)
        // Approximate Icr ≈ 0.35 Ig for lightly reinforced slabs
        let i_cr = 0.35 * i_g;
        let i_e = if m_a <= m_cr {
            i_g
        } else {
            let ratio = (2.0 / 3.0) * (m_cr / m_a);
            let ie = i_cr / (1.0 - ratio.powi(2) * (1.0 - i_cr / i_g));
            ie.min(i_g)
        };
        
        // Deflection varies by support condition
        let delta_coeff = match self.support {
            SupportCondition::Simple => 5.0 / 384.0,
            SupportCondition::Fixed => 1.0 / 384.0,
            SupportCondition::Cantilever => 1.0 / 8.0,
            SupportCondition::Continuous => 1.0 / 185.0,
        };
        let delta = delta_coeff * w_service * (l * 1000.0).powi(4) / (ec * i_e);
        
        SlabAnalysis {
            factored_load: wu,
            max_positive_moment: m_pos,
            max_negative_moment: m_neg,
            max_shear: vu,
            deflection: delta,
            deflection_ratio: if delta.abs() > 1e-10 { l * 1000.0 / delta } else { f64::MAX },
        }
    }

    /// Design reinforcement
    pub fn design(&self) -> SlabReinforcement {
        let analysis = self.analyze();
        let d = self.thickness - self.cover - 6.0; // Effective depth
        
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        let b = 1000.0; // mm per meter width
        
        // Positive moment steel
        let as_pos = self.required_steel(analysis.max_positive_moment, d, fc, fy);
        
        // Negative moment steel
        let as_neg = self.required_steel(analysis.max_negative_moment, d, fc, fy);
        
        // Minimum/shrinkage steel (ACI 7.6.1.1 - varies with fy)
        let as_min_ratio = if fy <= 350.0 {
            0.0020
        } else if fy <= 420.0 {
            0.0018
        } else {
            (0.0018 * 420.0 / fy).max(0.0014)
        };
        let as_min = as_min_ratio * b * self.thickness;
        
        let as_pos = as_pos.max(as_min);
        let as_neg = if as_neg > 0.0 { as_neg.max(as_min) } else { 0.0 };
        
        // Select bars
        let bar_main: f64 = 12.0;
        let bar_area = PI * (bar_main / 2.0).powi(2);
        
        // ACI 7.7.2.3: max spacing = min(3h, 450mm)
        let s_max = (3.0 * self.thickness).min(450.0);
        let spacing_pos = (bar_area / as_pos * 1000.0).min(s_max);
        let spacing_neg = if as_neg > 0.0 {
            (bar_area / as_neg * 1000.0).min(s_max)
        } else {
            300.0
        };
        
        // Distribution steel (perpendicular)
        let as_dist = as_min;
        let bar_dist: f64 = 10.0;
        let bar_area_dist = PI * (bar_dist / 2.0).powi(2);
        // ACI 24.4.3.3: max temp/shrinkage spacing = min(5h, 450mm)
        let spacing_dist = (bar_area_dist / as_dist * 1000.0).min(450.0).min(5.0 * self.thickness);
        
        SlabReinforcement {
            as_positive: as_pos,
            as_negative: as_neg,
            as_shrinkage: as_min,
            bar_size_main: bar_main,
            spacing_positive: spacing_pos,
            spacing_negative: spacing_neg,
            bar_size_dist: bar_dist,
            spacing_dist,
        }
    }

    /// Calculate required steel
    fn required_steel(&self, mu: f64, d: f64, fc: f64, fy: f64) -> f64 {
        if mu <= 0.0 {
            return 0.0;
        }
        
        let b = 1000.0;
        let mu_nmm = mu * 1e6; // Convert to N·mm
        
        // β1 per ACI 22.2.2.4.3
        let beta1 = if fc <= 28.0 { 0.85 } else { (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65) };
        // ρ_max for tension-controlled (εt ≥ 0.005) per ACI 9.3.3.1
        let rho_max = 0.85 * beta1 * fc / fy * (0.003 / (0.003 + 0.005));
        
        let rn = mu_nmm / (0.9 * b * d.powi(2));
        let rho = 0.85 * fc / fy * (1.0 - (1.0 - 2.0 * rn / (0.85 * fc)).sqrt().max(0.0));
        let rho = rho.min(rho_max); // Ensure tension-controlled (φ=0.9 valid)
        
        rho * b * d
    }
}

impl TwoWaySlab {
    /// Create two-way slab
    pub fn new(span_long: f64, span_short: f64, ll: f64) -> Self {
        let ratio = span_long / span_short;
        let thickness = Self::minimum_thickness(span_short, ratio);
        
        TwoWaySlab {
            span_long,
            span_short,
            thickness,
            concrete_fc: 25.0,
            steel_fy: 420.0,
            cover: 20.0,
            dead_load: 1.5,
            live_load: ll,
            edge_condition: EdgeCondition::AllEdgesContinuous,
            has_beams: false,
        }
    }

    /// Minimum thickness
    pub fn minimum_thickness(span_short: f64, _ratio: f64) -> f64 {
        let ln = span_short * 1000.0;
        
        // ACI 318 Table 8.3.1.1 - flat plates without drop panels
        // ln/33, min 125mm (ratio > 2 implies one-way action, not two-way)
        (ln / 33.0).max(125.0).ceil()
    }

    /// Self weight
    pub fn self_weight(&self) -> f64 {
        self.thickness / 1000.0 * 24.0
    }

    /// Aspect ratio
    pub fn aspect_ratio(&self) -> f64 {
        self.span_long / self.span_short
    }

    /// Analyze using coefficient method
    pub fn analyze(&self) -> SlabAnalysis {
        let wu = 1.2 * (self.self_weight() + self.dead_load) + 1.6 * self.live_load;
        let la = self.span_short;
        let lb = self.span_long;
        let m = lb / la;
        
        // Moment coefficients (depends on edge condition)
        let (ca_neg, ca_pos, cb_neg, cb_pos) = self.moment_coefficients(m);
        
        // Moments
        let ma_neg = ca_neg * wu * la.powi(2);
        let ma_pos = ca_pos * wu * la.powi(2);
        let mb_neg = cb_neg * wu * lb.powi(2);
        let mb_pos = cb_pos * wu * lb.powi(2);
        
        // Maximum values
        let m_pos = ma_pos.max(mb_pos);
        let m_neg = ma_neg.max(mb_neg);
        
        // Shear
        let vu = wu * la / 2.0;
        
        // Deflection
        let ec = 4700.0 * self.concrete_fc.sqrt();
        let i_g = 1000.0 * self.thickness.powi(3) / 12.0;
        // Service load: kPa × 1m strip = kN/m = N/mm (no division needed)
        let w_service = self.self_weight() + self.dead_load + self.live_load;
        
        // Two-way deflection: crossing-beam analogy
        // Short direction load share: m⁴/(1+m⁴) where m = lb/la
        let load_share = m.powi(4) / (1.0 + m.powi(4));
        let delta = 5.0 / 384.0 * w_service * load_share * (la * 1000.0).powi(4) / (ec * i_g);
        
        SlabAnalysis {
            factored_load: wu,
            max_positive_moment: m_pos,
            max_negative_moment: m_neg,
            max_shear: vu,
            deflection: delta,
            deflection_ratio: if delta.abs() > 1e-10 { la * 1000.0 / delta } else { f64::MAX },
        }
    }

    /// Moment coefficients based on edge condition
    fn moment_coefficients(&self, m: f64) -> (f64, f64, f64, f64) {
        // Simplified coefficients (ACI 318)
        let m = m.min(2.0);
        
        match self.edge_condition {
            EdgeCondition::AllEdgesContinuous => {
                let ca_neg = 0.033 + 0.005 * (m - 1.0);
                let ca_pos = 0.025 + 0.003 * (m - 1.0);
                let cb_neg = 0.033 / m.powi(2);
                let cb_pos = 0.025 / m.powi(2);
                (ca_neg, ca_pos, cb_neg, cb_pos)
            }
            EdgeCondition::AllEdgesDiscontinuous => {
                let ca_neg = 0.0;
                let ca_pos = 0.036 + 0.008 * (m - 1.0);
                let cb_neg = 0.0;
                let cb_pos = 0.036 / m.powi(2);
                (ca_neg, ca_pos, cb_neg, cb_pos)
            }
            _ => {
                // Default continuous
                let ca_neg = 0.045;
                let ca_pos = 0.027;
                let cb_neg = 0.045 / m.powi(2);
                let cb_pos = 0.027 / m.powi(2);
                (ca_neg, ca_pos, cb_neg, cb_pos)
            }
        }
    }

    /// Design reinforcement
    pub fn design(&self) -> (SlabReinforcement, SlabReinforcement) {
        let analysis = self.analyze();
        let d = self.thickness - self.cover - 6.0;
        
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        
        // Short direction
        let as_short_pos = self.required_steel(analysis.max_positive_moment, d, fc, fy);
        let as_short_neg = self.required_steel(analysis.max_negative_moment, d, fc, fy);
        
        // Long direction (reduced d)
        let d_long = d - 12.0;
        let as_long_pos = self.required_steel(analysis.max_positive_moment * 0.7, d_long, fc, fy);
        let as_long_neg = self.required_steel(analysis.max_negative_moment * 0.7, d_long, fc, fy);
        
        // ACI 8.6.1.1 - varies with fy
        let as_min_ratio = if fy <= 350.0 { 0.0020 }
            else if fy <= 420.0 { 0.0018 }
            else { (0.0018 * 420.0 / fy).max(0.0014) };
        let as_min = as_min_ratio * 1000.0 * self.thickness;
        
        let short_reinf = self.create_reinforcement(
            as_short_pos.max(as_min),
            as_short_neg.max(as_min),
            as_min,
        );
        
        let long_reinf = self.create_reinforcement(
            as_long_pos.max(as_min),
            as_long_neg.max(as_min),
            as_min,
        );
        
        (short_reinf, long_reinf)
    }

    /// Required steel calculation
    fn required_steel(&self, mu: f64, d: f64, fc: f64, fy: f64) -> f64 {
        if mu <= 0.0 {
            return 0.0;
        }
        
        let b = 1000.0;
        let mu_nmm = mu * 1e6;
        
        // β1 per ACI 22.2.2.4.3
        let beta1 = if fc <= 28.0 { 0.85 } else { (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65) };
        let rho_max = 0.85 * beta1 * fc / fy * (0.003 / (0.003 + 0.005));
        
        let rn = mu_nmm / (0.9 * b * d.powi(2));
        let rho = 0.85 * fc / fy * (1.0 - (1.0 - 2.0 * rn / (0.85 * fc)).sqrt().max(0.0));
        let rho = rho.min(rho_max); // Ensure tension-controlled
        
        rho * b * d
    }

    /// Create reinforcement struct
    fn create_reinforcement(&self, as_pos: f64, as_neg: f64, as_min: f64) -> SlabReinforcement {
        let bar_main: f64 = 12.0;
        let bar_area = PI * (bar_main / 2.0).powi(2);
        
        // ACI 8.7.2.2: max spacing = min(2h, 450mm)
        let s_max_2way = (2.0 * self.thickness).min(450.0);
        let spacing_pos = (bar_area / as_pos * 1000.0).min(s_max_2way);
        let spacing_neg = (bar_area / as_neg * 1000.0).min(s_max_2way);
        
        SlabReinforcement {
            as_positive: as_pos,
            as_negative: as_neg,
            as_shrinkage: as_min,
            bar_size_main: bar_main,
            spacing_positive: spacing_pos,
            spacing_negative: spacing_neg,
            bar_size_dist: 10.0,
            spacing_dist: 300.0,
        }
    }
}

impl FlatSlab {
    /// Create flat plate (no drop panels or capitals)
    pub fn flat_plate(span_x: f64, span_y: f64, ll: f64) -> Self {
        // ACI Table 8.3.1.1: ln/33 for flat plates, min 125mm
        let ln = span_x.max(span_y) * 1000.0 - 400.0; // Clear span (assuming 400mm column)
        let thickness = (ln / 33.0).max(125.0).ceil();
        
        FlatSlab {
            span_x,
            span_y,
            thickness,
            column_size: 400.0,
            drop_panel: None,
            column_capital: None,
            concrete_fc: 30.0,
            steel_fy: 420.0,
            dead_load: 2.0,
            live_load: ll,
        }
    }

    /// Create flat slab with drop panel
    pub fn with_drop_panel(span_x: f64, span_y: f64, ll: f64) -> Self {
        // ACI Table 8.3.1.1: ln/36 for flat slabs with drop panels, min 100mm
        let ln = span_x.max(span_y) * 1000.0 - 400.0; // Clear span (assuming 400mm column)
        let thickness = (ln / 36.0).max(100.0).ceil();
        
        let drop = DropPanel {
            length: (span_x * 1000.0 / 3.0).max(500.0),
            width: (span_y * 1000.0 / 3.0).max(500.0),
            depth: 100.0,
        };
        
        FlatSlab {
            span_x,
            span_y,
            thickness,
            column_size: 400.0,
            drop_panel: Some(drop),
            column_capital: None,
            concrete_fc: 30.0,
            steel_fy: 420.0,
            dead_load: 2.0,
            live_load: ll,
        }
    }

    /// Self weight
    pub fn self_weight(&self) -> f64 {
        let slab_wt = self.thickness / 1000.0 * 24.0;
        
        if let Some(ref drop) = self.drop_panel {
            let drop_area = drop.length * drop.width / 1e6;
            let total_area = self.span_x * self.span_y;
            let drop_wt = drop.depth / 1000.0 * 24.0 * drop_area / total_area;
            slab_wt + drop_wt
        } else {
            slab_wt
        }
    }

    /// Direct design method analysis
    pub fn analyze(&self) -> MomentDistribution {
        let wu = 1.2 * (self.self_weight() + self.dead_load) + 1.6 * self.live_load;
        let l1 = self.span_x;
        let l2 = self.span_y;
        
        // Clear spans
        let c = self.column_size / 1000.0;
        let ln = l1 - c;
        
        // Total static moment
        let mo = wu * l2 * ln.powi(2) / 8.0;
        
        // Distribution (interior span)
        let neg_fraction = 0.65;
        let pos_fraction = 0.35;
        
        let m_neg = neg_fraction * mo;
        let m_pos = pos_fraction * mo;
        
        // Column strip width
        let col_strip = 0.25 * l2.min(l1);
        let _mid_strip = l2 - 2.0 * col_strip;
        
        // Column strip takes higher percentage
        let col_strip_neg_pct = 0.75;
        let col_strip_pos_pct = 0.60;
        
        MomentDistribution {
            total_static_moment: mo,
            negative_moment: m_neg,
            positive_moment: m_pos,
            column_strip_neg: col_strip_neg_pct * m_neg,
            column_strip_pos: col_strip_pos_pct * m_pos,
            middle_strip_neg: (1.0 - col_strip_neg_pct) * m_neg,
            middle_strip_pos: (1.0 - col_strip_pos_pct) * m_pos,
        }
    }

    /// Check punching shear
    pub fn punching_shear(&self, column_load: f64) -> PunchingShearCheck {
        // Critical perimeter per ACI 22.6.4.1 (at d/2 from column face)
        let c = self.column_size;
        let (d, bo) = if let Some(ref drop) = self.drop_panel {
            // Enhanced depth within drop panel
            let d_drop = self.thickness + drop.depth - 40.0;
            // Critical section at d/2 from column face (within drop)
            let bo_col = 4.0 * (c + d_drop);
            // Also check at d/2 from drop panel edge (slab depth only)
            let d_slab = self.thickness - 40.0;
            let _bo_drop = 2.0 * (drop.length + d_slab) + 2.0 * (drop.width + d_slab);
            // Use column-face check (typically controls)
            (d_drop, bo_col)
        } else {
            let d = self.thickness - 40.0;
            (d, 4.0 * (c + d))
        };
        
        // Factored shear
        let wu = 1.2 * (self.self_weight() + self.dead_load) + 1.6 * self.live_load;
        let trib_area = self.span_x * self.span_y * 1e6 - (c + d).powi(2);
        let _vu = wu * trib_area / 1e6;
        
        // Concrete capacity
        let fc = self.concrete_fc;
        // ACI 22.6.5.2: beta_c = long side / short side of column (≥1.0)
        // For square columns beta=1.0; for rectangular, use column_size as short side
        let beta = 1.0_f64; // TODO: accept column_size_y for rectangular columns
        
        let vc1 = 0.33 * fc.sqrt();
        let vc2 = (0.17 + 0.33 / beta) * fc.sqrt();
        let alpha_s = 40.0; // Interior column
        // ACI 318M Eq. 22.6.5.2(c): 0.083(αs·d/bo + 2)√f'c
        let vc3 = 0.083 * (alpha_s * d / bo + 2.0) * fc.sqrt();
        
        let vc = vc1.min(vc2).min(vc3);
        let phi_vc = 0.75 * vc * bo * d / 1000.0; // kN
        
        let ratio = column_load / phi_vc;
        let adequate = ratio <= 1.0;
        
        // Shear reinforcement if needed
        let shear_reinf = if !adequate {
            Some(self.design_shear_studs(column_load, phi_vc, d))
        } else {
            None
        };
        
        PunchingShearCheck {
            vu: column_load,
            vc: phi_vc,
            bo,
            d,
            ratio,
            adequate,
            shear_reinforcement: shear_reinf,
        }
    }

    /// Design shear studs
    fn design_shear_studs(&self, vu: f64, vc: f64, d: f64) -> ShearReinforcement {
        let fc = self.concrete_fc;
        let _fyt = 420.0; // Stud yield strength
        
        // Required vs = vu/phi - vc
        let vs_required = vu / 0.75 - vc / 0.75;
        
        // Maximum vs
        let vs_max = 0.5 * fc.sqrt() * 4.0 * (self.column_size + d) * d / 1000.0;
        
        // Stud design
        let stud_dia: f64 = 12.0;
        let _stud_area = PI * (stud_dia / 2.0).powi(2);
        
        // Number of rails (typically 4 or 8)
        let num_rails = if vs_required > vs_max * 0.5 { 8 } else { 4 };
        
        // Spacing (maximum 0.5d at critical section)
        let spacing = (0.5 * d).min(100.0);
        
        // Studs per rail
        let num_studs = (1.5 * d / spacing).ceil() as usize + 2;
        
        ShearReinforcement {
            stud_rails: num_rails,
            studs_per_rail: num_studs,
            stud_diameter: stud_dia,
            spacing,
        }
    }
}

impl WaffleSlab {
    /// Create waffle slab
    pub fn new(span: f64, ll: f64) -> Self {
        // Standard module sizes
        let rib_spacing: f64 = 900.0; // mm
        let rib_width: f64 = 125.0;
        let rib_depth: f64 = match span {
            s if s < 8.0 => 300.0,
            s if s < 12.0 => 400.0,
            _ => 500.0,
        };
        
        // ACI 9.2.4.4: rib depth ≤ 3.5 × rib_width, clear spacing ≤ 750mm
        let rib_depth: f64 = rib_depth.min(3.5 * rib_width);
        let rib_spacing: f64 = rib_spacing.min(rib_width + 750.0); // Max clear spacing 750mm
        
        WaffleSlab {
            span,
            rib_spacing,
            rib_width,
            rib_depth,
            topping: 100.0,
            solid_head_size: span * 1000.0 / 5.0,
            concrete_fc: 30.0,
            steel_fy: 420.0,
            dead_load: 2.0,
            live_load: ll,
        }
    }

    /// Equivalent thickness for self-weight
    pub fn equivalent_thickness(&self) -> f64 {
        let void_width = self.rib_spacing - self.rib_width;
        // void_depth is the full rib depth (below the topping slab)
        let void_depth = self.rib_depth;
        let void_area = void_width * void_depth;
        // Total depth = rib_depth + topping
        let total_depth = self.rib_depth + self.topping;
        let gross_area = self.rib_spacing * total_depth;
        
        // Equivalent solid thickness = (gross - voids) / spacing
        (gross_area - void_area) / self.rib_spacing
    }

    /// Self weight
    pub fn self_weight(&self) -> f64 {
        self.equivalent_thickness() / 1000.0 * 24.0
    }

    /// Analyze waffle slab
    pub fn analyze(&self) -> SlabAnalysis {
        let wu = 1.2 * (self.self_weight() + self.dead_load) + 1.6 * self.live_load;
        let l = self.span;
        
        // Treat as two-way system
        let mo = wu * l * (l - self.solid_head_size / 1000.0).powi(2) / 8.0;
        
        let m_pos = 0.35 * mo;
        let m_neg = 0.65 * mo;
        
        // Per rib
        let ribs_per_meter = 1000.0 / self.rib_spacing;
        let m_pos_rib = m_pos / ribs_per_meter;
        let m_neg_rib = m_neg / ribs_per_meter;
        
        // Shear per rib
        let vu_rib = wu * l * self.rib_spacing / 1000.0 / 2.0;
        
        // Deflection
        let ec = 4700.0 * self.concrete_fc.sqrt();
        // T-section moment of inertia for the rib (flange = topping slab over rib_spacing)
        let bf = self.rib_spacing; // Effective flange width = rib spacing
        let bw = self.rib_width;
        let hf = self.topping;    // Flange thickness (topping)
        let hw = self.rib_depth;  // Web depth (below topping)
        let _h_total = hw + hf;    // Total depth
        // Centroid of T-section from bottom
        let a_flange = bf * hf;
        let a_web = bw * hw;
        let y_bar = (a_flange * (hw + hf / 2.0) + a_web * (hw / 2.0)) / (a_flange + a_web);
        // Parallel axis theorem
        let i_flange = bf * hf.powi(3) / 12.0 + a_flange * (hw + hf / 2.0 - y_bar).powi(2);
        let i_web = bw * hw.powi(3) / 12.0 + a_web * (hw / 2.0 - y_bar).powi(2);
        let i_rib = i_flange + i_web;
        // Service load per rib: kPa * rib_spacing(mm) / 1000 = kN/m per rib = N/mm per rib
        let w_service = (self.self_weight() + self.dead_load + self.live_load) * 
                       self.rib_spacing / 1000.0;
        
        let delta = 5.0 / 384.0 * w_service * (l * 1000.0).powi(4) / (ec * i_rib);
        
        SlabAnalysis {
            factored_load: wu,
            max_positive_moment: m_pos_rib,
            max_negative_moment: m_neg_rib,
            max_shear: vu_rib,
            deflection: delta,
            deflection_ratio: if delta.abs() > 1e-10 { l * 1000.0 / delta } else { f64::MAX },
        }
    }

    /// Design rib reinforcement
    pub fn design_ribs(&self) -> SlabReinforcement {
        let analysis = self.analyze();
        let d = self.rib_depth + self.topping - 40.0;
        let b = self.rib_width;
        
        // Positive moment - T-beam behavior
        // ACI 6.3.2.1: effective flange overhang per side = min(8hf, sw/2, ln/8)
        let sw = self.rib_spacing - self.rib_width; // clear spacing
        let overhang = (8.0 * self.topping).min(sw / 2.0).min(self.span * 1000.0 / 8.0);
        let flange_width = (b + 2.0 * overhang).min(self.rib_spacing);
        let as_pos = self.required_steel_t(analysis.max_positive_moment, d, flange_width);
        
        // Negative moment - rectangular
        let as_neg = self.required_steel_rect(analysis.max_negative_moment, d, b);
        
        // ACI Table 9.6.1.2: As_min = max(0.25√fc/fy, 1.4/fy) × bw × d
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        let as_min = (0.25 * fc.sqrt() / fy).max(1.4 / fy) * b * d;
        
        SlabReinforcement {
            as_positive: as_pos.max(as_min),
            as_negative: as_neg.max(as_min),
            as_shrinkage: 0.0018 * self.rib_spacing * self.topping,
            bar_size_main: 16.0,
            spacing_positive: 0.0, // N/A for ribs
            spacing_negative: 0.0,
            bar_size_dist: 10.0,
            spacing_dist: 300.0,
        }
    }

    /// Required steel for T-beam
    fn required_steel_t(&self, mu: f64, d: f64, bf: f64) -> f64 {
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        let phi = 0.9;
        
        // Check if neutral axis in flange (compare Mu with φMn_flange)
        let a_max = self.topping;
        let mn_flange = 0.85 * fc * bf * a_max * (d - a_max / 2.0) / 1e6;
        
        if mu <= phi * mn_flange {
            // Rectangular behavior (NA in flange)
            self.required_steel_rect(mu, d, bf)
        } else {
            // T-beam behavior (NA in web)
            // Flange contribution (nominal moment from overhanging flanges)
            let mf = 0.85 * fc * (bf - self.rib_width) * self.topping * 
                    (d - self.topping / 2.0) / 1e6;
            // Web moment: Mu_web = Mu - φ × Mf (factored flange contribution)
            let mw = mu - phi * mf;
            
            let asf = 0.85 * fc * (bf - self.rib_width) * self.topping / fy;
            let asw = self.required_steel_rect(mw, d, self.rib_width);
            
            asf + asw
        }
    }

    /// Required steel for rectangular section
    fn required_steel_rect(&self, mu: f64, d: f64, b: f64) -> f64 {
        if mu <= 0.0 {
            return 0.0;
        }
        
        let fc = self.concrete_fc;
        let fy = self.steel_fy;
        let mu_nmm = mu * 1e6;
        
        // β1 per ACI 22.2.2.4.3
        let beta1 = if fc <= 28.0 { 0.85 } else { (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65) };
        let rho_max = 0.85 * beta1 * fc / fy * (0.003 / (0.003 + 0.005));
        
        let rn = mu_nmm / (0.9 * b * d.powi(2));
        let rho = 0.85 * fc / fy * (1.0 - (1.0 - 2.0 * rn / (0.85 * fc)).sqrt().max(0.0));
        let rho = rho.min(rho_max); // Ensure tension-controlled
        
        rho * b * d
    }
}

/// Post-tensioned slab
#[derive(Debug, Clone)]
pub struct PostTensionedSlab {
    pub span: f64,              // m
    pub thickness: f64,         // mm
    pub tendon_profile: TendonProfile,
    pub prestress_force: f64,   // kN per tendon
    pub tendon_spacing: f64,    // mm
    pub concrete_fc: f64,       // MPa
    pub fci: f64,               // MPa at stressing
    pub dead_load: f64,         // kPa
    pub live_load: f64,         // kPa
}

/// Tendon profile type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TendonProfile {
    Parabolic,
    Harped,
    Straight,
}

impl PostTensionedSlab {
    /// Create PT slab
    pub fn new(span: f64, ll: f64) -> Self {
        let thickness = (span * 1000.0 / 45.0).max(150.0).ceil();
        
        PostTensionedSlab {
            span,
            thickness,
            tendon_profile: TendonProfile::Parabolic,
            prestress_force: 140.0, // kN per strand
            tendon_spacing: 1200.0,
            concrete_fc: 40.0,
            fci: 25.0,
            dead_load: 2.0,
            live_load: ll,
        }
    }

    /// Balance load
    pub fn balance_load(&self) -> f64 {
        // Drape (maximum eccentricity)
        let cover = 25.0;
        let e_max = self.thickness / 2.0 - cover;
        let e_min = -(self.thickness / 2.0 - cover);
        let drape = e_max - e_min;
        
        // Equivalent load per tendon
        let l = self.span * 1000.0;
        let wb = 8.0 * self.prestress_force * 0.85 * 1000.0 * drape / l.powi(2);
        
        // Per meter width
        // wb is N/mm per tendon, * 1000/spacing converts to N/mm per m width,
        // then / 1000 converts N/mm to kN/m = kPa
        if self.tendon_spacing > 0.0 { wb * 1000.0 / self.tendon_spacing } else { 0.0 }
    }

    /// Check stresses
    pub fn check_stresses(&self) -> (f64, f64, bool) {
        let area = 1000.0 * self.thickness; // per meter width, mm²
        let s = 1000.0 * self.thickness.powi(2) / 6.0; // mm³
        
        // Prestress force per m width (after ~15% losses per ACI 20.3.2.6)
        let p_eff = self.prestress_force * 0.85; // kN (effective after losses)
        // p_eff(kN) × 1e6 / spacing(mm) = N per m width  (kN→N ×1000, ×1000mm/spacing tendons/m)
        let p = if self.tendon_spacing > 0.0 { p_eff * 1e6 / self.tendon_spacing } else { 0.0 }; // N per m width
        let e = self.thickness / 2.0 - 25.0; // eccentricity in mm
        
        // Service stresses — use total moment (Method A: -P/A ± Pe/S ∓ M_ext/S)
        let sw = self.thickness / 1000.0 * 24.0; // Self-weight (kPa)
        let w = sw + self.dead_load + self.live_load;
        let m = w * self.span.powi(2) / 8.0 * 1e6;
        
        // f = -P/A ± Pe/S ∓ M/S (tendon below centroid: +Pe/S at top, sagging M: -M/S at top)
        let f_top = -p / area + p * e / s - m / s;
        let f_bot = -p / area - p * e / s + m / s;
        
        // Allowable
        let ft_allow = 0.5 * self.concrete_fc.sqrt();
        // ACI Table 24.5.4.1: 0.60fc' for total load (DL+LL)
        let fc_allow = 0.60 * self.concrete_fc;
        
        let ok = f_top > -fc_allow && f_top < ft_allow &&
                 f_bot > -fc_allow && f_bot < ft_allow;
        
        (f_top, f_bot, ok)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_one_way_slab_creation() {
        let slab = OneWaySlab::new(4.0, 3.0);
        assert!(slab.thickness >= 100.0);
    }

    #[test]
    fn test_one_way_analysis() {
        let slab = OneWaySlab::new(4.0, 3.0);
        let analysis = slab.analyze();
        
        assert!(analysis.factored_load > 0.0);
        assert!(analysis.max_positive_moment > 0.0);
    }

    #[test]
    fn test_one_way_design() {
        let slab = OneWaySlab::new(4.0, 3.0);
        let reinf = slab.design();
        
        assert!(reinf.as_positive > 0.0);
        assert!(reinf.spacing_positive > 0.0);
        // ACI 7.7.2.3: max spacing = min(3h, 450mm)
        let s_max = (3.0 * slab.thickness).min(450.0);
        assert!(reinf.spacing_positive <= s_max);
    }

    #[test]
    fn test_two_way_slab() {
        let slab = TwoWaySlab::new(6.0, 5.0, 4.0);
        
        assert!(slab.aspect_ratio() <= 2.0);
        assert!(slab.thickness >= 125.0);
    }

    #[test]
    fn test_two_way_analysis() {
        let slab = TwoWaySlab::new(6.0, 5.0, 4.0);
        let analysis = slab.analyze();
        
        assert!(analysis.max_positive_moment > 0.0);
        assert!(analysis.deflection_ratio > 100.0);
    }

    #[test]
    fn test_two_way_design() {
        let slab = TwoWaySlab::new(6.0, 5.0, 4.0);
        let (short, long) = slab.design();
        
        assert!(short.as_positive >= long.as_positive);
    }

    #[test]
    fn test_flat_plate() {
        let slab = FlatSlab::flat_plate(6.0, 6.0, 4.0);
        
        // ACI Table 8.3.1.1: ln/33, min 125mm
        assert!(slab.thickness >= 125.0);
        assert!(slab.drop_panel.is_none());
    }

    #[test]
    fn test_flat_slab_with_drop() {
        let slab = FlatSlab::with_drop_panel(7.0, 7.0, 5.0);
        
        assert!(slab.drop_panel.is_some());
    }

    #[test]
    fn test_direct_design() {
        let slab = FlatSlab::flat_plate(6.0, 6.0, 4.0);
        let moments = slab.analyze();
        
        assert!(moments.total_static_moment > 0.0);
        assert!(moments.negative_moment > moments.positive_moment);
        assert!(moments.column_strip_neg > moments.middle_strip_neg);
    }

    #[test]
    fn test_punching_shear() {
        let slab = FlatSlab::flat_plate(6.0, 6.0, 4.0);
        let check = slab.punching_shear(500.0);
        
        assert!(check.vc > 0.0);
        assert!(check.bo > 0.0);
    }

    #[test]
    fn test_waffle_slab() {
        let slab = WaffleSlab::new(10.0, 5.0);
        
        assert!(slab.rib_depth >= 300.0);
        assert!(slab.equivalent_thickness() < slab.rib_depth);
    }

    #[test]
    fn test_waffle_analysis() {
        let slab = WaffleSlab::new(10.0, 5.0);
        let analysis = slab.analyze();
        
        assert!(analysis.max_positive_moment > 0.0);
        assert!(analysis.max_shear > 0.0);
    }

    #[test]
    fn test_waffle_design() {
        let slab = WaffleSlab::new(10.0, 5.0);
        let reinf = slab.design_ribs();
        
        assert!(reinf.as_positive > 0.0);
        assert!(reinf.as_negative > 0.0);
    }

    #[test]
    fn test_pt_slab() {
        let slab = PostTensionedSlab::new(10.0, 4.0);
        
        assert!(slab.thickness >= 150.0);
        assert!(slab.balance_load() > 0.0);
    }

    #[test]
    fn test_pt_stresses() {
        let slab = PostTensionedSlab::new(8.0, 3.0);
        let (top, bot, _ok) = slab.check_stresses();
        
        assert!(top.is_finite());
        assert!(bot.is_finite());
    }

    #[test]
    fn test_minimum_thickness() {
        let t_simple = OneWaySlab::minimum_thickness(5.0, SupportCondition::Simple);
        let t_cont = OneWaySlab::minimum_thickness(5.0, SupportCondition::Continuous);
        
        assert!(t_simple > t_cont);
    }
}
