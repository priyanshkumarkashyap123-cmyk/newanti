//! Beam Design Module
//! 
//! Comprehensive beam design including steel, concrete, and composite beams
//! with support for various loading and boundary conditions.

use std::f64::consts::PI;

/// Beam material type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BeamMaterial {
    Steel,
    Concrete,
    Timber,
    Composite,
    Prestressed,
}

/// Support type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BeamSupport {
    SimpleSimple,
    FixedFixed,
    FixedPinned,
    Cantilever,
    Continuous,
    Propped,
}

/// Steel beam section type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SteelSectionType {
    WideFlange,
    Channel,
    Angle,
    Tube,
    Pipe,
    BuiltUp,
    Castellated,
    PlateGirder,
}

/// Steel beam
#[derive(Debug, Clone)]
pub struct SteelBeam {
    pub section_type: SteelSectionType,
    pub depth: f64,             // mm
    pub flange_width: f64,      // mm
    pub flange_thickness: f64,  // mm
    pub web_thickness: f64,     // mm
    pub span: f64,              // m
    pub fy: f64,                // MPa
    pub fu: f64,                // MPa
    pub e: f64,                 // MPa
    pub unbraced_length: f64,   // m
    pub cb: f64,                // Moment gradient factor
    pub support: BeamSupport,
}

/// Concrete beam
#[derive(Debug, Clone)]
pub struct ConcreteBeam {
    pub width: f64,             // mm
    pub depth: f64,             // mm
    pub span: f64,              // m
    pub fc: f64,                // MPa
    pub fy: f64,                // MPa
    pub cover: f64,             // mm
    pub support: BeamSupport,
    pub reinforcement: Option<BeamReinforcement>,
}

/// Beam reinforcement
#[derive(Debug, Clone)]
pub struct BeamReinforcement {
    pub top_bars: usize,
    pub top_diameter: f64,      // mm
    pub bot_bars: usize,
    pub bot_diameter: f64,      // mm
    pub stirrup_diameter: f64,  // mm
    pub stirrup_spacing: f64,   // mm
}

/// Composite beam (steel + concrete deck)
#[derive(Debug, Clone)]
pub struct CompositeBeam {
    pub steel_beam: SteelBeam,
    pub slab_thickness: f64,    // mm
    pub slab_effective_width: f64, // mm
    pub deck_height: f64,       // mm (metal deck ribs)
    pub concrete_fc: f64,       // MPa
    pub shear_studs: ShearStuds,
    pub composite_action: f64,  // 0-1 (partial composite)
}

/// Shear stud configuration
#[derive(Debug, Clone)]
pub struct ShearStuds {
    pub diameter: f64,          // mm
    pub height: f64,            // mm
    pub strength: f64,          // MPa
    pub spacing: f64,           // mm
    pub rows: usize,
}

/// Beam analysis results
#[derive(Debug, Clone)]
pub struct BeamAnalysis {
    pub max_moment: f64,        // kN·m
    pub max_shear: f64,         // kN
    pub max_deflection: f64,    // mm
    pub reactions: (f64, f64),  // kN (left, right)
    pub moment_diagram: Vec<(f64, f64)>, // (x, M)
    pub shear_diagram: Vec<(f64, f64)>,  // (x, V)
}

/// Steel beam capacity
#[derive(Debug, Clone)]
pub struct SteelBeamCapacity {
    pub mn: f64,                // kN·m - nominal moment
    pub phi_mn: f64,            // kN·m - design moment
    pub vn: f64,                // kN - nominal shear
    pub phi_vn: f64,            // kN - design shear
    pub lateral_torsional: LTBResult,
    pub local_buckling: LocalBuckling,
    pub deflection_limit: f64,  // mm
}

/// Lateral-torsional buckling result
#[derive(Debug, Clone)]
pub struct LTBResult {
    pub lp: f64,                // m - plastic limit
    pub lr: f64,                // m - inelastic limit
    pub lb: f64,                // m - unbraced length
    pub mn_ltb: f64,            // kN·m - LTB capacity
    pub classification: LTBClass,
}

/// LTB classification
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LTBClass {
    Plastic,
    Inelastic,
    Elastic,
}

/// Local buckling classification
#[derive(Debug, Clone)]
pub struct LocalBuckling {
    pub flange_ratio: f64,
    pub web_ratio: f64,
    pub flange_class: SlendernessClass,
    pub web_class: SlendernessClass,
}

/// Slenderness classification
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SlendernessClass {
    Compact,
    Noncompact,
    Slender,
}

/// Concrete beam capacity
#[derive(Debug, Clone)]
pub struct ConcreteBeamCapacity {
    pub mn: f64,                // kN·m
    pub phi_mn: f64,            // kN·m
    pub vc: f64,                // kN - concrete shear
    pub vs: f64,                // kN - stirrup shear
    pub phi_vn: f64,            // kN - total design shear
    pub rho: f64,               // reinforcement ratio
    pub rho_balanced: f64,
    pub tension_controlled: bool,
}

impl SteelBeam {
    /// Create W-shape beam
    pub fn w_shape(depth: f64, bf: f64, tf: f64, tw: f64, span: f64) -> Self {
        SteelBeam {
            section_type: SteelSectionType::WideFlange,
            depth,
            flange_width: bf,
            flange_thickness: tf,
            web_thickness: tw,
            span,
            fy: 345.0,
            fu: 450.0,
            e: 200000.0,
            unbraced_length: span,
            cb: 1.0,
            support: BeamSupport::SimpleSimple,
        }
    }

    /// Create plate girder
    pub fn plate_girder(depth: f64, bf: f64, tf: f64, tw: f64, span: f64) -> Self {
        SteelBeam {
            section_type: SteelSectionType::PlateGirder,
            depth,
            flange_width: bf,
            flange_thickness: tf,
            web_thickness: tw,
            span,
            fy: 345.0,
            fu: 450.0,
            e: 200000.0,
            unbraced_length: span,
            cb: 1.0,
            support: BeamSupport::SimpleSimple,
        }
    }

    /// Section properties
    pub fn section_properties(&self) -> SteelSectionProps {
        let d = self.depth;
        let bf = self.flange_width;
        let tf = self.flange_thickness;
        let tw = self.web_thickness;
        
        // Area
        let area = 2.0 * bf * tf + (d - 2.0 * tf) * tw;
        
        // Moment of inertia (strong axis)
        let ix = bf * d.powi(3) / 12.0 - 
                (bf - tw) * (d - 2.0 * tf).powi(3) / 12.0;
        
        // Moment of inertia (weak axis)  
        let iy = 2.0 * tf * bf.powi(3) / 12.0 + 
                (d - 2.0 * tf) * tw.powi(3) / 12.0;
        
        // Section modulus
        let sx = ix / (d / 2.0);
        let sy = iy / (bf / 2.0);
        
        // Plastic modulus
        let zx = bf * tf * (d - tf) + tw * (d - 2.0 * tf).powi(2) / 4.0;
        
        // Radius of gyration
        let rx = (ix / area).sqrt();
        let ry = (iy / area).sqrt();
        
        // Warping constant (approximate)
        let cw = iy * (d - tf).powi(2) / 4.0;
        
        // Torsional constant
        let j = (2.0 * bf * tf.powi(3) + (d - 2.0 * tf) * tw.powi(3)) / 3.0;
        
        SteelSectionProps {
            area,
            ix,
            iy,
            sx,
            sy,
            zx,
            rx,
            ry,
            cw,
            j,
        }
    }

    /// Calculate capacity
    pub fn capacity(&self) -> SteelBeamCapacity {
        let props = self.section_properties();
        
        // Local buckling check
        let local = self.check_local_buckling();
        
        // Lateral-torsional buckling
        let ltb = self.check_ltb(&props);
        
        // Moment capacity
        let mp = self.fy * props.zx / 1e6; // kN·m
        let mn = mp.min(ltb.mn_ltb);
        
        // Reduce for local buckling if needed
        let mn = match (&local.flange_class, &local.web_class) {
            (SlendernessClass::Slender, _) | (_, SlendernessClass::Slender) => mn * 0.7,
            (SlendernessClass::Noncompact, _) | (_, SlendernessClass::Noncompact) => {
                let my = self.fy * props.sx / 1e6;
                my + (mp - my) * 0.7
            }
            _ => mn,
        };
        
        // Shear capacity
        let h = self.depth - 2.0 * self.flange_thickness;
        let aw = h * self.web_thickness;
        let cv = 1.0; // Assuming adequate web
        let vn = 0.6 * self.fy * aw * cv / 1000.0;
        
        // Deflection limit
        let deflection_limit = self.span * 1000.0 / 360.0;
        
        SteelBeamCapacity {
            mn,
            phi_mn: 0.9 * mn,
            vn,
            phi_vn: 0.9 * vn,
            lateral_torsional: ltb,
            local_buckling: local,
            deflection_limit,
        }
    }

    /// Check local buckling
    fn check_local_buckling(&self) -> LocalBuckling {
        let bf = self.flange_width;
        let tf = self.flange_thickness;
        let tw = self.web_thickness;
        let h = self.depth - 2.0 * tf;
        let fy = self.fy;
        let e = self.e;
        
        // Flange slenderness
        let lambda_f = bf / (2.0 * tf);
        let lambda_pf = 0.38 * (e / fy).sqrt();
        let lambda_rf = 1.0 * (e / fy).sqrt();
        
        let flange_class = if lambda_f <= lambda_pf {
            SlendernessClass::Compact
        } else if lambda_f <= lambda_rf {
            SlendernessClass::Noncompact
        } else {
            SlendernessClass::Slender
        };
        
        // Web slenderness
        let lambda_w = h / tw;
        let lambda_pw = 3.76 * (e / fy).sqrt();
        let lambda_rw = 5.70 * (e / fy).sqrt();
        
        let web_class = if lambda_w <= lambda_pw {
            SlendernessClass::Compact
        } else if lambda_w <= lambda_rw {
            SlendernessClass::Noncompact
        } else {
            SlendernessClass::Slender
        };
        
        LocalBuckling {
            flange_ratio: lambda_f,
            web_ratio: lambda_w,
            flange_class,
            web_class,
        }
    }

    /// Check lateral-torsional buckling
    fn check_ltb(&self, props: &SteelSectionProps) -> LTBResult {
        let e = self.e;
        let fy = self.fy;
        let lb = self.unbraced_length * 1000.0; // mm
        let cb = self.cb;
        
        // Limiting lengths
        let ry = props.ry;
        let lp = 1.76 * ry * (e / fy).sqrt();
        
        let rts = ((props.iy * props.cw).sqrt() / props.sx).sqrt();
        let c = 1.0; // For doubly symmetric
        let ho = self.depth - self.flange_thickness;
        let lr = 1.95 * rts * (e / (0.7 * fy)) * 
                ((props.j * c / (props.sx * ho)).powi(2) + 
                 6.76 * (0.7 * fy / e).powi(2)).sqrt().sqrt();
        
        // Plastic moment
        let mp = fy * props.zx / 1e6;
        
        // LTB capacity
        let (mn_ltb, classification) = if lb <= lp {
            (mp, LTBClass::Plastic)
        } else if lb <= lr {
            let mn = cb * (mp - (mp - 0.7 * fy * props.sx / 1e6) * 
                    (lb - lp) / (lr - lp));
            (mn.min(mp), LTBClass::Inelastic)
        } else {
            let fcr = cb * PI.powi(2) * e / (lb / rts).powi(2) * 
                     (1.0 + 0.078 * props.j * c / (props.sx * ho) * (lb / rts).powi(2)).sqrt();
            let mn = fcr * props.sx / 1e6;
            (mn.min(mp), LTBClass::Elastic)
        };
        
        LTBResult {
            lp: lp / 1000.0,
            lr: lr / 1000.0,
            lb: lb / 1000.0,
            mn_ltb,
            classification,
        }
    }

    /// Analyze under uniform load
    pub fn analyze_uniform(&self, w: f64) -> BeamAnalysis {
        let l = self.span;
        
        let (max_moment, max_shear, reactions) = match self.support {
            BeamSupport::SimpleSimple => {
                let m = w * l.powi(2) / 8.0;
                let v = w * l / 2.0;
                let r = w * l / 2.0;
                (m, v, (r, r))
            }
            BeamSupport::FixedFixed => {
                let m = w * l.powi(2) / 12.0;
                let v = w * l / 2.0;
                let r = w * l / 2.0;
                (m, v, (r, r))
            }
            BeamSupport::Cantilever => {
                let m = w * l.powi(2) / 2.0;
                let v = w * l;
                (m, v, (v, 0.0))
            }
            _ => {
                let m = w * l.powi(2) / 8.0;
                let v = w * l / 2.0;
                (m, v, (v, v))
            }
        };
        
        // Deflection
        let props = self.section_properties();
        let delta = match self.support {
            BeamSupport::SimpleSimple => {
                5.0 * w * (l * 1000.0).powi(4) / (384.0 * self.e * props.ix)
            }
            BeamSupport::FixedFixed => {
                w * (l * 1000.0).powi(4) / (384.0 * self.e * props.ix)
            }
            BeamSupport::Cantilever => {
                w * (l * 1000.0).powi(4) / (8.0 * self.e * props.ix)
            }
            _ => 5.0 * w * (l * 1000.0).powi(4) / (384.0 * self.e * props.ix),
        };
        
        // Diagrams
        let n = 20;
        let dx = l / n as f64;
        let mut moment_diagram = Vec::new();
        let mut shear_diagram = Vec::new();
        
        for i in 0..=n {
            let x = i as f64 * dx;
            let (m, v) = match self.support {
                BeamSupport::SimpleSimple => {
                    let v = reactions.0 - w * x;
                    let m = reactions.0 * x - w * x.powi(2) / 2.0;
                    (m, v)
                }
                BeamSupport::Cantilever => {
                    let v = w * (l - x);
                    let m = -w * (l - x).powi(2) / 2.0;
                    (m.abs(), v)
                }
                _ => {
                    let v = reactions.0 - w * x;
                    let m = reactions.0 * x - w * x.powi(2) / 2.0;
                    (m, v)
                }
            };
            moment_diagram.push((x, m));
            shear_diagram.push((x, v));
        }
        
        BeamAnalysis {
            max_moment,
            max_shear,
            max_deflection: delta,
            reactions,
            moment_diagram,
            shear_diagram,
        }
    }

    /// Analyze under point load
    pub fn analyze_point(&self, p: f64, a: f64) -> BeamAnalysis {
        let l = self.span;
        let b = l - a;
        
        let (max_moment, max_shear, reactions) = match self.support {
            BeamSupport::SimpleSimple => {
                let ra = p * b / l;
                let rb = p * a / l;
                let m = ra * a;
                (m, ra.max(rb), (ra, rb))
            }
            BeamSupport::Cantilever => {
                let m = p * a;
                (m, p, (p, 0.0))
            }
            _ => {
                let ra = p * b / l;
                let rb = p * a / l;
                let m = ra * a;
                (m, ra.max(rb), (ra, rb))
            }
        };
        
        // Deflection at load point
        let props = self.section_properties();
        let delta = match self.support {
            BeamSupport::SimpleSimple => {
                p * 1000.0 * a * 1000.0 * b * 1000.0 * 
                (a * 1000.0 + 2.0 * b * 1000.0) *
                (3.0 * a * 1000.0 * (a * 1000.0 + 2.0 * b * 1000.0)).sqrt() /
                (27.0 * self.e * props.ix * l * 1000.0)
            }
            BeamSupport::Cantilever => {
                p * 1000.0 * (a * 1000.0).powi(2) * (3.0 * l * 1000.0 - a * 1000.0) /
                (6.0 * self.e * props.ix)
            }
            _ => {
                p * 1000.0 * (l * 1000.0).powi(3) / (48.0 * self.e * props.ix)
            }
        };
        
        // Diagrams
        let n = 20;
        let dx = l / n as f64;
        let mut moment_diagram = Vec::new();
        let mut shear_diagram = Vec::new();
        
        for i in 0..=n {
            let x = i as f64 * dx;
            let (m, v) = if x <= a {
                (reactions.0 * x, reactions.0)
            } else {
                (reactions.0 * x - p * (x - a), reactions.0 - p)
            };
            moment_diagram.push((x, m));
            shear_diagram.push((x, v));
        }
        
        BeamAnalysis {
            max_moment,
            max_shear,
            max_deflection: delta,
            reactions,
            moment_diagram,
            shear_diagram,
        }
    }
}

/// Steel section properties
#[derive(Debug, Clone)]
pub struct SteelSectionProps {
    pub area: f64,              // mm²
    pub ix: f64,                // mm⁴
    pub iy: f64,                // mm⁴
    pub sx: f64,                // mm³
    pub sy: f64,                // mm³
    pub zx: f64,                // mm³
    pub rx: f64,                // mm
    pub ry: f64,                // mm
    pub cw: f64,                // mm⁶
    pub j: f64,                 // mm⁴
}

impl ConcreteBeam {
    /// Create concrete beam
    pub fn new(width: f64, depth: f64, span: f64) -> Self {
        ConcreteBeam {
            width,
            depth,
            span,
            fc: 25.0,
            fy: 420.0,
            cover: 40.0,
            support: BeamSupport::SimpleSimple,
            reinforcement: None,
        }
    }

    /// Add reinforcement
    pub fn with_reinforcement(&mut self, reinf: BeamReinforcement) -> &mut Self {
        self.reinforcement = Some(reinf);
        self
    }

    /// Effective depth
    pub fn effective_depth(&self) -> f64 {
        self.depth - self.cover - 10.0 // Approximate
    }

    /// Calculate capacity
    pub fn capacity(&self) -> ConcreteBeamCapacity {
        let b = self.width;
        let d = self.effective_depth();
        let fc = self.fc;
        let fy = self.fy;
        
        // Reinforcement area
        let as_prov = match &self.reinforcement {
            Some(r) => {
                let top = r.top_bars as f64 * PI * (r.top_diameter / 2.0).powi(2);
                let bot = r.bot_bars as f64 * PI * (r.bot_diameter / 2.0).powi(2);
                (top, bot)
            }
            None => (0.0, 0.0),
        };
        
        // Flexural capacity (positive moment)
        let rho = as_prov.1 / (b * d);
        let rho_balanced = 0.85 * fc / fy * 0.003 / (0.003 + fy / 200000.0) * 0.85;
        
        let a = as_prov.1 * fy / (0.85 * fc * b);
        let phi = if rho < 0.75 * rho_balanced { 0.9 } else { 0.65 };
        
        let mn = as_prov.1 * fy * (d - a / 2.0) / 1e6;
        let phi_mn = phi * mn;
        
        // Shear capacity
        let vc = 0.17 * fc.sqrt() * b * d / 1000.0;
        
        let vs = match &self.reinforcement {
            Some(r) if r.stirrup_spacing > 0.0 => {
                let av = 2.0 * PI * (r.stirrup_diameter / 2.0).powi(2);
                av * fy * d / (r.stirrup_spacing * 1000.0)
            }
            _ => 0.0,
        };
        
        let phi_vn = 0.75 * (vc + vs);
        
        ConcreteBeamCapacity {
            mn,
            phi_mn,
            vc,
            vs,
            phi_vn,
            rho,
            rho_balanced,
            tension_controlled: rho < 0.75 * rho_balanced,
        }
    }

    /// Design reinforcement for given moment
    pub fn design_for_moment(&self, mu: f64) -> BeamReinforcement {
        let b = self.width;
        let d = self.effective_depth();
        let fc = self.fc;
        let fy = self.fy;
        
        // Required steel
        let rn = mu * 1e6 / (0.9 * b * d.powi(2));
        let rho = 0.85 * fc / fy * (1.0 - (1.0 - 2.0 * rn / (0.85 * fc)).sqrt().max(0.0));
        let rho = rho.max(0.0033); // Minimum
        
        let as_req = rho * b * d;
        
        // Select bars
        let bar_dia: f64 = if as_req > 2000.0 { 25.0 } 
                     else if as_req > 1000.0 { 20.0 } 
                     else { 16.0 };
        let bar_area = PI * (bar_dia / 2.0).powi(2);
        let num_bars = (as_req / bar_area).ceil() as usize;
        
        // Minimum top steel
        let top_bars = 2.max(num_bars / 4);
        let top_dia = 12.0;
        
        // Stirrups
        let stirrup_dia: f64 = 10.0;
        let vs_max = 0.33 * fc.sqrt() * b * d / 1000.0;
        let spacing = if vs_max > 0.0 {
            let av = 2.0 * PI * (stirrup_dia / 2.0).powi(2);
            (av * fy * d / (vs_max * 1000.0)).min(d / 2.0).min(600.0)
        } else {
            d / 2.0
        };
        
        BeamReinforcement {
            top_bars,
            top_diameter: top_dia,
            bot_bars: num_bars,
            bot_diameter: bar_dia,
            stirrup_diameter: stirrup_dia,
            stirrup_spacing: spacing,
        }
    }

    /// Analyze under uniform load
    pub fn analyze_uniform(&self, w: f64) -> BeamAnalysis {
        let l = self.span;
        
        let (max_moment, max_shear, reactions) = match self.support {
            BeamSupport::SimpleSimple => {
                let m = w * l.powi(2) / 8.0;
                let v = w * l / 2.0;
                (m, v, (v, v))
            }
            BeamSupport::FixedFixed => {
                let m = w * l.powi(2) / 12.0;
                let v = w * l / 2.0;
                (m, v, (v, v))
            }
            BeamSupport::Cantilever => {
                let m = w * l.powi(2) / 2.0;
                let v = w * l;
                (m, v, (v, 0.0))
            }
            _ => {
                let m = w * l.powi(2) / 8.0;
                let v = w * l / 2.0;
                (m, v, (v, v))
            }
        };
        
        // Gross moment of inertia
        let ig = self.width * self.depth.powi(3) / 12.0;
        let ec = 4700.0 * self.fc.sqrt();
        
        let delta = 5.0 * w * (l * 1000.0).powi(4) / (384.0 * ec * ig);
        
        // Simplified diagrams
        let n = 20;
        let dx = l / n as f64;
        let moment_diagram: Vec<_> = (0..=n)
            .map(|i| {
                let x = i as f64 * dx;
                let m = reactions.0 * x - w * x.powi(2) / 2.0;
                (x, m)
            })
            .collect();
        
        let shear_diagram: Vec<_> = (0..=n)
            .map(|i| {
                let x = i as f64 * dx;
                let v = reactions.0 - w * x;
                (x, v)
            })
            .collect();
        
        BeamAnalysis {
            max_moment,
            max_shear,
            max_deflection: delta,
            reactions,
            moment_diagram,
            shear_diagram,
        }
    }
}

impl CompositeBeam {
    /// Create composite beam
    pub fn new(steel: SteelBeam, slab_t: f64, deck_h: f64) -> Self {
        let beff = (steel.span * 1000.0 / 4.0).min(3000.0);
        
        CompositeBeam {
            steel_beam: steel,
            slab_thickness: slab_t,
            slab_effective_width: beff,
            deck_height: deck_h,
            concrete_fc: 25.0,
            shear_studs: ShearStuds {
                diameter: 19.0,
                height: 100.0,
                strength: 450.0,
                spacing: 300.0,
                rows: 1,
            },
            composite_action: 1.0,
        }
    }

    /// Composite section properties
    pub fn composite_properties(&self) -> CompositeSectionProps {
        let steel = self.steel_beam.section_properties();
        let n = 200000.0 / (4700.0 * self.concrete_fc.sqrt()); // Modular ratio
        
        // Transformed concrete width
        let bt = self.slab_effective_width / n;
        let tc = self.slab_thickness - self.deck_height;
        
        // Areas
        let ac = bt * tc;
        let at = steel.area + ac;
        
        // Centroid from bottom
        let yc = self.steel_beam.depth + self.deck_height + tc / 2.0;
        let ys = self.steel_beam.depth / 2.0;
        let y_bar = (steel.area * ys + ac * yc) / at;
        
        // Composite moment of inertia
        let ic = bt * tc.powi(3) / 12.0;
        let d_s = y_bar - ys;
        let d_c = yc - y_bar;
        
        let i_comp = steel.ix + steel.area * d_s.powi(2) + 
                    ic + ac * d_c.powi(2);
        
        // Section moduli
        let s_bot = i_comp / y_bar;
        let s_top = i_comp / (self.steel_beam.depth + self.slab_thickness - y_bar);
        
        CompositeSectionProps {
            area: at,
            ix: i_comp,
            y_bar,
            s_bot,
            s_top,
            modular_ratio: n,
        }
    }

    /// Stud capacity
    pub fn stud_capacity(&self) -> f64 {
        let fc = self.concrete_fc;
        let ec = 4700.0 * fc.sqrt();
        let d = self.shear_studs.diameter;
        let _h = self.shear_studs.height;
        let fu = self.shear_studs.strength;
        
        let asa = PI * (d / 2.0).powi(2);
        
        // ACI capacity
        let qn1 = 0.5 * asa * (fc * ec).sqrt();
        let qn2 = asa * fu;
        
        qn1.min(qn2) / 1000.0 // kN
    }

    /// Composite moment capacity
    pub fn capacity(&self) -> f64 {
        let _props = self.composite_properties();
        let steel_props = self.steel_beam.section_properties();
        
        // Full composite action
        let tc = self.slab_thickness - self.deck_height;
        let cf = 0.85 * self.concrete_fc * self.slab_effective_width * tc;
        let ts = self.steel_beam.fy * steel_props.area;
        
        let compression = cf.min(ts) / 1000.0; // kN
        
        // Plastic neutral axis
        let (_a, _y_pna) = if compression * 1000.0 >= ts {
            // PNA in concrete
            let a = ts / (0.85 * self.concrete_fc * self.slab_effective_width);
            (a, self.steel_beam.depth + self.deck_height + a / 2.0)
        } else {
            // PNA in steel
            let d = self.steel_beam.depth;
            (tc, d / 2.0)
        };
        
        // Lever arm
        let d_steel = self.steel_beam.depth / 2.0;
        let d_conc = self.steel_beam.depth + self.deck_height + tc / 2.0;
        let lever = d_conc - d_steel;
        
        // Moment capacity
        0.9 * compression * lever / 1000.0 // kN·m
    }
}

/// Composite section properties
#[derive(Debug, Clone)]
pub struct CompositeSectionProps {
    pub area: f64,
    pub ix: f64,
    pub y_bar: f64,
    pub s_bot: f64,
    pub s_top: f64,
    pub modular_ratio: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steel_beam_creation() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        assert_eq!(beam.depth, 400.0);
    }

    #[test]
    fn test_section_properties() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let props = beam.section_properties();
        
        assert!(props.area > 0.0);
        assert!(props.ix > props.iy);
        assert!(props.zx > props.sx);
    }

    #[test]
    fn test_steel_capacity() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let cap = beam.capacity();
        
        assert!(cap.phi_mn > 0.0);
        assert!(cap.phi_vn > 0.0);
    }

    #[test]
    fn test_ltb_check() {
        let mut beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        beam.unbraced_length = 2.0;
        let cap = beam.capacity();
        
        assert!(cap.lateral_torsional.lp > 0.0);
        assert!(cap.lateral_torsional.lr > cap.lateral_torsional.lp);
    }

    #[test]
    fn test_local_buckling() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let cap = beam.capacity();
        
        assert!(cap.local_buckling.flange_ratio > 0.0);
        assert!(cap.local_buckling.web_ratio > 0.0);
    }

    #[test]
    fn test_steel_analysis_uniform() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let analysis = beam.analyze_uniform(20.0);
        
        assert!(analysis.max_moment > 0.0);
        assert!(analysis.max_shear > 0.0);
        assert_eq!(analysis.reactions.0, analysis.reactions.1);
    }

    #[test]
    fn test_steel_analysis_point() {
        let beam = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let analysis = beam.analyze_point(100.0, 4.0);
        
        assert!(analysis.max_moment > 0.0);
        assert!((analysis.reactions.0 + analysis.reactions.1 - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_concrete_beam_creation() {
        let beam = ConcreteBeam::new(300.0, 500.0, 6.0);
        assert_eq!(beam.width, 300.0);
        assert_eq!(beam.depth, 500.0);
    }

    #[test]
    fn test_concrete_design() {
        let beam = ConcreteBeam::new(300.0, 500.0, 6.0);
        let reinf = beam.design_for_moment(150.0);
        
        assert!(reinf.bot_bars >= 2);
        assert!(reinf.stirrup_spacing > 0.0);
    }

    #[test]
    fn test_concrete_capacity() {
        let mut beam = ConcreteBeam::new(300.0, 500.0, 6.0);
        let reinf = beam.design_for_moment(150.0);
        beam.with_reinforcement(reinf);
        
        let cap = beam.capacity();
        assert!(cap.phi_mn >= 150.0);
        assert!(cap.tension_controlled);
    }

    #[test]
    fn test_composite_beam() {
        let steel = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let comp = CompositeBeam::new(steel, 150.0, 50.0);
        
        let props = comp.composite_properties();
        assert!(props.ix > comp.steel_beam.section_properties().ix);
    }

    #[test]
    fn test_composite_capacity() {
        let steel = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let comp = CompositeBeam::new(steel, 150.0, 50.0);
        
        let cap = comp.capacity();
        let steel_cap = comp.steel_beam.capacity();
        
        assert!(cap > steel_cap.phi_mn);
    }

    #[test]
    fn test_stud_capacity() {
        let steel = SteelBeam::w_shape(400.0, 200.0, 16.0, 10.0, 8.0);
        let comp = CompositeBeam::new(steel, 150.0, 50.0);
        
        let qn = comp.stud_capacity();
        assert!(qn > 50.0);
    }
}
