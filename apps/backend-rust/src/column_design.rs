//! Column Design Module
//! 
//! Comprehensive column design for steel, concrete, and composite columns
//! including slenderness effects, biaxial bending, and code checks.

use std::f64::consts::PI;

/// Column material type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ColumnMaterial {
    Steel,
    Concrete,
    Composite,
    Timber,
}

/// Column end condition
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EndCondition {
    PinnedPinned,       // K = 1.0
    FixedFixed,         // K = 0.5
    FixedPinned,        // K = 0.7
    FixedFree,          // K = 2.0
    PartiallyFixed,     // K = 0.8
}

impl EndCondition {
    /// Effective length factor
    pub fn k_factor(&self) -> f64 {
        match self {
            EndCondition::PinnedPinned => 1.0,
            EndCondition::FixedFixed => 0.5,
            EndCondition::FixedPinned => 0.7,
            EndCondition::FixedFree => 2.0,
            EndCondition::PartiallyFixed => 0.8,
        }
    }
}

/// Steel column
#[derive(Debug, Clone)]
pub struct SteelColumn {
    pub section_type: SteelSectionType,
    pub depth: f64,             // mm
    pub width: f64,             // mm
    pub flange_thickness: f64,  // mm
    pub web_thickness: f64,     // mm
    pub length: f64,            // m
    pub fy: f64,                // MPa
    pub e: f64,                 // MPa
    pub end_x: EndCondition,
    pub end_y: EndCondition,
    pub unbraced_x: f64,        // m
    pub unbraced_y: f64,        // m
}

/// Steel section type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SteelSectionType {
    WideFlange,
    Tube,
    Pipe,
    BuiltUp,
    Angle,
    Channel,
}

/// Concrete column
#[derive(Debug, Clone)]
pub struct ConcreteColumn {
    pub width: f64,             // mm (b)
    pub depth: f64,             // mm (h)
    pub length: f64,            // m
    pub fc: f64,                // MPa
    pub fy: f64,                // MPa
    pub cover: f64,             // mm
    pub end_condition: EndCondition,
    pub braced: bool,           // Braced vs unbraced frame
    pub reinforcement: Option<ColumnReinforcement>,
}

/// Column reinforcement
#[derive(Debug, Clone)]
pub struct ColumnReinforcement {
    pub main_bars: usize,
    pub main_diameter: f64,     // mm
    pub tie_diameter: f64,      // mm
    pub tie_spacing: f64,       // mm
}

/// Composite column (concrete-filled tube)
#[derive(Debug, Clone)]
pub struct CompositeColumn {
    pub outer_diameter: f64,    // mm (for circular)
    pub outer_width: f64,       // mm (for rectangular)
    pub outer_depth: f64,       // mm
    pub tube_thickness: f64,    // mm
    pub length: f64,            // m
    pub steel_fy: f64,          // MPa
    pub concrete_fc: f64,       // MPa
    pub column_type: CompositeType,
    pub end_condition: EndCondition,
}

/// Composite column type
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CompositeType {
    CircularCFT,        // Circular concrete-filled tube
    RectangularCFT,     // Rectangular concrete-filled tube
    EncasedWide,        // Steel W-shape encased in concrete
}

/// Steel column capacity results
#[derive(Debug, Clone)]
pub struct SteelColumnCapacity {
    pub pn: f64,                // kN - nominal axial
    pub phi_pn: f64,            // kN - design axial
    pub mn_x: f64,              // kN·m - nominal moment X
    pub mn_y: f64,              // kN·m - nominal moment Y
    pub slenderness_x: f64,
    pub slenderness_y: f64,
    pub governing_axis: char,
    pub classification: ColumnClass,
    pub interaction_check: Option<InteractionCheck>,
}

/// Column classification
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ColumnClass {
    Short,
    Intermediate,
    Slender,
}

/// P-M interaction check
#[derive(Debug, Clone)]
pub struct InteractionCheck {
    pub pu: f64,                // kN - applied axial
    pub mu_x: f64,              // kN·m - applied moment X
    pub mu_y: f64,              // kN·m - applied moment Y
    pub ratio: f64,             // Interaction ratio
    pub adequate: bool,
}

/// Concrete column capacity
#[derive(Debug, Clone)]
pub struct ConcreteColumnCapacity {
    pub pn_max: f64,            // kN - max axial (pure compression)
    pub phi_pn_max: f64,        // kN - design max axial
    pub pn_balanced: f64,       // kN - balanced point
    pub mn_balanced: f64,       // kN·m - moment at balanced
    pub mn_0: f64,              // kN·m - pure bending capacity
    pub slenderness_ratio: f64,
    pub magnification_factor: f64,
    pub pc: f64,                // kN - Euler buckling load for moment magnification
    pub cm: f64,                // Cm factor for moment magnification
    pub is_slender: bool,       // Whether column is slender
    pub pm_diagram: Vec<(f64, f64)>, // P-M interaction points
}

impl SteelColumn {
    /// Create W-shape column
    pub fn w_shape(depth: f64, width: f64, tf: f64, tw: f64, length: f64) -> Self {
        SteelColumn {
            section_type: SteelSectionType::WideFlange,
            depth,
            width,
            flange_thickness: tf,
            web_thickness: tw,
            length,
            fy: 345.0,
            e: 200000.0,
            end_x: EndCondition::PinnedPinned,
            end_y: EndCondition::PinnedPinned,
            unbraced_x: length,
            unbraced_y: length,
        }
    }

    /// Create HSS (tube) column
    pub fn hss(width: f64, depth: f64, thickness: f64, length: f64) -> Self {
        SteelColumn {
            section_type: SteelSectionType::Tube,
            depth,
            width,
            flange_thickness: thickness,
            web_thickness: thickness,
            length,
            fy: 345.0,
            e: 200000.0,
            end_x: EndCondition::PinnedPinned,
            end_y: EndCondition::PinnedPinned,
            unbraced_x: length,
            unbraced_y: length,
        }
    }

    /// Create pipe column
    pub fn pipe(diameter: f64, thickness: f64, length: f64) -> Self {
        SteelColumn {
            section_type: SteelSectionType::Pipe,
            depth: diameter,
            width: diameter,
            flange_thickness: thickness,
            web_thickness: thickness,
            length,
            fy: 290.0,
            e: 200000.0,
            end_x: EndCondition::PinnedPinned,
            end_y: EndCondition::PinnedPinned,
            unbraced_x: length,
            unbraced_y: length,
        }
    }

    /// Section properties
    pub fn section_properties(&self) -> SteelSectionProps {
        match self.section_type {
            SteelSectionType::WideFlange => self.w_shape_properties(),
            SteelSectionType::Tube => self.tube_properties(),
            SteelSectionType::Pipe => self.pipe_properties(),
            _ => self.w_shape_properties(),
        }
    }

    fn w_shape_properties(&self) -> SteelSectionProps {
        let d = self.depth;
        let bf = self.width;
        let tf = self.flange_thickness;
        let tw = self.web_thickness;

        let area = 2.0 * bf * tf + (d - 2.0 * tf) * tw;
        let ix = bf * d.powi(3) / 12.0 - (bf - tw) * (d - 2.0 * tf).powi(3) / 12.0;
        let iy = 2.0 * tf * bf.powi(3) / 12.0 + (d - 2.0 * tf) * tw.powi(3) / 12.0;
        let rx = (ix / area).sqrt();
        let ry = (iy / area).sqrt();
        let zx = bf * tf * (d - tf) + tw * (d - 2.0 * tf).powi(2) / 4.0;
        let zy = 2.0 * tf * bf.powi(2) / 4.0 + (d - 2.0 * tf) * tw.powi(2) / 4.0;

        SteelSectionProps { area, ix, iy, rx, ry, zx, zy }
    }

    fn tube_properties(&self) -> SteelSectionProps {
        let b = self.width;
        let h = self.depth;
        let t = self.flange_thickness;

        let bi = b - 2.0 * t;
        let hi = h - 2.0 * t;

        let area = b * h - bi * hi;
        let ix = (b * h.powi(3) - bi * hi.powi(3)) / 12.0;
        let iy = (h * b.powi(3) - hi * bi.powi(3)) / 12.0;
        let rx = (ix / area).sqrt();
        let ry = (iy / area).sqrt();
        let zx = (b * h.powi(2) - bi * hi.powi(2)) / 4.0;
        let zy = (h * b.powi(2) - hi * bi.powi(2)) / 4.0;

        SteelSectionProps { area, ix, iy, rx, ry, zx, zy }
    }

    fn pipe_properties(&self) -> SteelSectionProps {
        let d = self.depth;
        let t = self.flange_thickness;
        let di = d - 2.0 * t;

        let area = PI / 4.0 * (d.powi(2) - di.powi(2));
        let i = PI / 64.0 * (d.powi(4) - di.powi(4));
        let r = (i / area).sqrt();
        let z = PI / 32.0 * (d.powi(3) - di.powi(3));

        SteelSectionProps {
            area,
            ix: i,
            iy: i,
            rx: r,
            ry: r,
            zx: z,
            zy: z,
        }
    }

    /// Calculate axial capacity per AISC 360
    pub fn capacity(&self) -> SteelColumnCapacity {
        let props = self.section_properties();
        let fy = self.fy;
        let e = self.e;

        // Effective lengths
        let kx = self.end_x.k_factor();
        let ky = self.end_y.k_factor();
        let lx = self.unbraced_x * 1000.0; // mm
        let ly = self.unbraced_y * 1000.0;

        // Slenderness ratios
        let kl_rx = kx * lx / props.rx;
        let kl_ry = ky * ly / props.ry;
        let kl_r = kl_rx.max(kl_ry);

        // Governing axis
        let governing = if kl_rx >= kl_ry { 'X' } else { 'Y' };

        // Euler buckling stress
        let fe = PI.powi(2) * e / kl_r.powi(2);

        // Critical stress (AISC E3)
        let fcr = if kl_r <= 4.71 * (e / fy).sqrt() {
            fy * (0.658_f64.powf(fy / fe))
        } else {
            0.877 * fe
        };

        // Nominal axial capacity
        let pn = fcr * props.area / 1000.0; // kN

        // Classification
        let classification = if kl_r <= 25.0 {
            ColumnClass::Short
        } else if kl_r <= 4.71 * (e / fy).sqrt() {
            ColumnClass::Intermediate
        } else {
            ColumnClass::Slender
        };

        // Moment capacity (plastic)
        let mn_x = fy * props.zx / 1e6;
        let mn_y = fy * props.zy / 1e6;

        SteelColumnCapacity {
            pn,
            phi_pn: 0.9 * pn,
            mn_x: 0.9 * mn_x,
            mn_y: 0.9 * mn_y,
            slenderness_x: kl_rx,
            slenderness_y: kl_ry,
            governing_axis: governing,
            classification,
            interaction_check: None,
        }
    }

    /// Check P-M interaction (AISC H1)
    pub fn check_interaction(&self, pu: f64, mu_x: f64, mu_y: f64) -> InteractionCheck {
        let cap = self.capacity();

        let pr = pu / cap.phi_pn;
        let mrx = mu_x / cap.mn_x;
        let mry = mu_y / cap.mn_y;

        // AISC H1-1
        let ratio = if pr >= 0.2 {
            pr + 8.0 / 9.0 * (mrx + mry)
        } else {
            pr / 2.0 + mrx + mry
        };

        InteractionCheck {
            pu,
            mu_x,
            mu_y,
            ratio,
            adequate: ratio <= 1.0,
        }
    }
}

/// Steel section properties
#[derive(Debug, Clone)]
pub struct SteelSectionProps {
    pub area: f64,      // mm²
    pub ix: f64,        // mm⁴
    pub iy: f64,        // mm⁴
    pub rx: f64,        // mm
    pub ry: f64,        // mm
    pub zx: f64,        // mm³
    pub zy: f64,        // mm³
}

impl ConcreteColumn {
    /// Create rectangular column
    pub fn rectangular(width: f64, depth: f64, length: f64) -> Self {
        ConcreteColumn {
            width,
            depth,
            length,
            fc: 30.0,
            fy: 420.0,
            cover: 40.0,
            end_condition: EndCondition::PinnedPinned,
            braced: true,
            reinforcement: None,
        }
    }

    /// Create square column
    pub fn square(size: f64, length: f64) -> Self {
        Self::rectangular(size, size, length)
    }

    /// Add reinforcement
    pub fn with_reinforcement(&mut self, reinf: ColumnReinforcement) -> &mut Self {
        self.reinforcement = Some(reinf);
        self
    }

    /// Gross area
    pub fn gross_area(&self) -> f64 {
        self.width * self.depth
    }

    /// Steel area
    pub fn steel_area(&self) -> f64 {
        match &self.reinforcement {
            Some(r) => r.main_bars as f64 * PI * (r.main_diameter / 2.0).powi(2),
            None => 0.0,
        }
    }

    /// Reinforcement ratio
    pub fn rho(&self) -> f64 {
        let gross = self.gross_area();
        if gross < 1e-10 { return 0.0; }
        self.steel_area() / gross
    }

    /// Slenderness ratio
    pub fn slenderness_ratio(&self) -> f64 {
        let k = self.end_condition.k_factor();
        let min_dim = self.depth.min(self.width);
        if min_dim < 1e-10 { return f64::INFINITY; }
        let r = min_dim / 12.0_f64.sqrt();
        k * self.length * 1000.0 / r
    }

    /// Calculate capacity per ACI 318
    pub fn capacity(&self) -> ConcreteColumnCapacity {
        let ag = self.gross_area();
        let ast = self.steel_area();
        let fc = self.fc;
        let fy = self.fy;

        // Maximum axial capacity (ACI 22.4.2)
        // alpha = 0.80 for tied columns, 0.85 for spiral columns
        // Default to tied column (conservative)
        let alpha = 0.80;
        let pn_max = alpha * (0.85 * fc * (ag - ast) + fy * ast) / 1000.0;

        // Slenderness effects
        let kl_r = self.slenderness_ratio();
        // ACI 318-19 6.2.5: For braced frames, slenderness may be neglected when
        // kLu/r <= 34 - 12(M1/M2), with upper limit of 40
        // For unbraced frames, the limit is 22
        let slenderness_limit = if self.braced { 34.0 } else { 22.0 };
        let slender = kl_r > slenderness_limit;

        // Moment magnification per ACI 318-19 6.6.4
        // Cm = 0.6 + 0.4*(M1/M2) >= 0.4 for braced; 1.0 for unbraced
        let cm = if self.braced { 0.6 } else { 1.0 };
        // EI_eff = 0.4 * Ec * Ig / (1 + beta_dns)
        // Ec = 4700 * sqrt(f'c) per ACI 19.2.2.1
        let ec = 4700.0 * fc.sqrt(); // MPa
        // Ig must be about the WEAK axis (same axis as slenderness check)
        // Weak axis: min dimension is the bending dimension
        let h_min = self.width.min(self.depth);
        let h_max = self.width.max(self.depth);
        let ig = h_max * h_min.powi(3) / 12.0; // mm^4 — weak-axis Ig
        let beta_dns = 0.6; // Ratio of sustained to total load (Table 6.6.4.4.4)
        let ei_eff = 0.4 * ec * ig / (1.0 + beta_dns); // N·mm²
        let pc = PI.powi(2) * ei_eff /
                 (self.end_condition.k_factor() * self.length * 1000.0).powi(2) / 1000.0; // kN

        // ACI 318-19 6.6.4.5.2: delta = Cm / (1 - Pu/(0.75*Pc)) >= 1.0
        // Store Pc and Cm for recomputation in check() with actual Pu
        // Use Pn_max as conservative estimate for Pu when actual Pu not available
        let pu_estimate = pn_max * 0.65; // phi * Pn_max as Pu estimate
        let delta = if slender {
            let denom = 1.0 - pu_estimate / (0.75 * pc);
            if denom <= 0.0 {
                // Column is unstable - flag with large magnification
                10.0_f64.min(cm / 0.05) // Cap at practical limit
            } else {
                (cm / denom).max(1.0)
            }
        } else {
            1.0
        };

        // P-M interaction points
        let pm_diagram = self.generate_pm_diagram();

        // Balanced condition
        // Effective depth: d = h - cover - tie_dia - main_bar/2
        let (tie_dia, main_dia) = match &self.reinforcement {
            Some(r) => (r.tie_diameter, r.main_diameter),
            None => (10.0, 20.0), // Default assumptions
        };
        let d = self.depth - self.cover - tie_dia - main_dia / 2.0;
        let d_prime = self.cover + tie_dia + main_dia / 2.0;
        let cb = 0.003 * d / (0.003 + fy / 200000.0);
        // ACI 318-19 22.2.2.4.3: beta1 varies with f'c
        let beta1 = if fc <= 28.0 {
            0.85
        } else {
            (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65)
        };
        let ab = beta1 * cb;
        
        // Balanced axial force
        let cc_b = 0.85 * fc * ab * self.width; // Concrete compression
        let eps_s_prime_b = 0.003 * (cb - d_prime) / cb;
        let fs_prime_b = (eps_s_prime_b * 200000.0).min(fy).max(-fy);
        // Only subtract displaced concrete (0.85*f'c) when compression steel is within stress block
        let cs_b = if d_prime < ab {
            ast / 2.0 * (fs_prime_b - 0.85 * fc)
        } else {
            ast / 2.0 * fs_prime_b
        };
        let ts_b = ast / 2.0 * fy; // Tension steel at yield
        let pn_balanced = (cc_b + cs_b - ts_b) / 1000.0;
        
        // Balanced moment - sum moments of ALL internal forces about centroid
        // Sign of cs_b already captures force direction; do NOT use .abs()
        let h = self.depth;
        let mn_balanced = (cc_b * (h / 2.0 - ab / 2.0) 
                         + cs_b * (h / 2.0 - d_prime) 
                         + ts_b * (d - h / 2.0)) / 1e6;

        // Pure bending: Mn = ρ·fy·b·d²·(1 - 0.59·ρ·fy/f'c)
        let rho = self.rho();
        let mn_0 = rho * fy * d.powi(2) * self.width * (1.0 - 0.59 * rho * fy / fc) / 1e6;

        ConcreteColumnCapacity {
            pn_max,
            phi_pn_max: 0.65 * pn_max,
            pn_balanced,
            mn_balanced,
            mn_0,
            slenderness_ratio: kl_r,
            magnification_factor: delta,
            pc,
            cm,
            is_slender: slender,
            pm_diagram,
        }
    }

    /// Generate P-M interaction diagram
    fn generate_pm_diagram(&self) -> Vec<(f64, f64)> {
        let ag = self.gross_area();
        let ast = self.steel_area();
        let fc = self.fc;
        let fy = self.fy;
        let b = self.width;
        let h = self.depth;
        // Effective depth: d = h - cover - tie_dia - main_bar/2
        let (tie_dia, main_dia) = match &self.reinforcement {
            Some(r) => (r.tie_diameter, r.main_diameter),
            None => (10.0, 20.0),
        };
        let d = h - self.cover - tie_dia - main_dia / 2.0;
        let d_prime = self.cover + tie_dia + main_dia / 2.0;

        let mut points = Vec::new();

        // Point 1: Pure compression
        let p0 = 0.85 * fc * (ag - ast) + fy * ast;
        points.push((p0 / 1000.0, 0.0));

        // ACI 318-19 22.2.2.4.3: beta1 varies with f'c
        let beta1 = if fc <= 28.0 {
            0.85
        } else {
            (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65)
        };

        // Points along interaction curve - extended range for complete diagram
        // c from 2.0h down to 0.05h to capture full compression through tension range
        let c_values: Vec<f64> = vec![
            2.0 * h, 1.5 * h, 1.2 * h, 1.0 * h, 0.9 * h, 0.8 * h,
            0.7 * h, 0.6 * h, 0.5 * h, 0.4 * h, 0.35 * h, 0.3 * h,
            0.25 * h, 0.2 * h, 0.15 * h, 0.1 * h, 0.05 * h,
        ];
        for c in c_values {
            if c < 1.0 { continue; }
            let a = (beta1 * c).min(h);

            let eps_s = 0.003 * (d - c) / c;
            let eps_s_prime = 0.003 * (c - d_prime) / c;

            let fs = (eps_s * 200000.0).min(fy).max(-fy);
            let fs_prime = (eps_s_prime * 200000.0).min(fy).max(-fy);

            let cc = 0.85 * fc * a * b;
            // Only subtract displaced concrete when compression steel is within stress block
            let cs = if d_prime < a {
                ast / 2.0 * (fs_prime - 0.85 * fc)
            } else {
                ast / 2.0 * fs_prime
            };
            let ts = ast / 2.0 * fs;

            let pn = (cc + cs - ts) / 1000.0;
            let mn = (cc * (h / 2.0 - a / 2.0) + cs * (h / 2.0 - d_prime) + ts * (d - h / 2.0)) / 1e6;

            points.push((pn, mn.abs()));
        }

        // Point: Pure bending (approximate)
        let rho = self.rho().max(0.01);
        let mn = rho * fy * b * d.powi(2) * (1.0 - 0.59 * rho * fy / fc) / 1e6;
        points.push((0.0, mn));

        // Tension points
        points.push((-ast * fy / 1000.0, 0.0));

        points
    }

    /// Design reinforcement for given loads
    pub fn design_reinforcement(&self, pu: f64, mu: f64) -> ColumnReinforcement {
        let ag = self.gross_area();
        let fc = self.fc;
        let fy = self.fy;

        // Estimate required steel ratio
        let pn_target = pu / 0.65;
        let _mn_target = mu / 0.65;

        // Simplified design equation
        let ast_req = (pn_target * 1000.0 - 0.85 * fc * 0.8 * ag) / (fy - 0.85 * fc);
        let ast_req = ast_req.max(0.01 * ag).min(0.08 * ag);

        // Select bars
        let bar_dia: f64 = if ast_req > 8000.0 { 32.0 }
                    else if ast_req > 4000.0 { 25.0 }
                    else { 20.0 };
        let bar_area = PI * (bar_dia / 2.0).powi(2);
        let num_bars = ((ast_req / bar_area).ceil() as usize).max(4);
        let num_bars = if num_bars % 2 != 0 { num_bars + 1 } else { num_bars };

        // Ties
        let tie_dia: f64 = if bar_dia >= 32.0 { 12.0 } else { 10.0 };
        let tie_spacing = (16.0 * bar_dia).min(48.0 * tie_dia).min(self.width.min(self.depth));

        ColumnReinforcement {
            main_bars: num_bars,
            main_diameter: bar_dia,
            tie_diameter: tie_dia,
            tie_spacing,
        }
    }

    /// Check column adequacy
    pub fn check(&self, pu: f64, mu_x: f64, mu_y: f64) -> ColumnCheck {
        let cap = self.capacity();

        // Recompute moment magnification with ACTUAL Pu per ACI 6.6.4.5.2
        let delta = if cap.is_slender {
            let denom = 1.0 - pu / (0.75 * cap.pc);
            if denom <= 0.0 {
                10.0_f64.min(cap.cm / 0.05) // Unstable — cap at practical limit
            } else {
                (cap.cm / denom).max(1.0)
            }
        } else {
            1.0
        };

        // Magnified moment using actual-Pu-based delta
        let mu_x_mag = mu_x * delta;
        let mu_y_mag = mu_y * delta;

        // Biaxial bending (Bresler load contour method)
        let mn_x = cap.mn_0 * self.depth / self.width.max(self.depth);
        let mn_y = cap.mn_0 * self.width / self.width.max(self.depth);

        let axial_ratio = pu / cap.phi_pn_max;

        // Phi transitions: 0.65 (compression-controlled) to 0.90 (tension-controlled)
        // At balanced point and above: phi = 0.65 for tied columns
        // Below balanced point toward pure bending: phi transitions to 0.90
        let phi_m = if pu >= cap.pn_balanced * 0.65 {
            0.65 // Compression-controlled
        } else {
            // Linear interpolation between 0.65 at balanced and 0.90 at pure bending
            let ratio = pu / (cap.pn_balanced * 0.65).max(1.0);
            0.90 - (0.90 - 0.65) * ratio
        };

        let moment_ratio = if axial_ratio > 0.1 {
            // Bresler load contour method
            ((mu_x_mag / (phi_m * mn_x)).powf(1.5) +
             (mu_y_mag / (phi_m * mn_y)).powf(1.5)).powf(1.0 / 1.5)
        } else {
            mu_x_mag / (phi_m * mn_x) + mu_y_mag / (phi_m * mn_y)
        };

        // Both axial AND moment checks must pass
        // Axial: Pu must not exceed phi*Pn_max
        // Moment: Bresler interaction ratio must not exceed 1.0
        let total_ratio = axial_ratio.max(moment_ratio);

        ColumnCheck {
            axial_ratio,
            moment_ratio,
            total_ratio,
            adequate: axial_ratio <= 1.0 && moment_ratio <= 1.0,
            magnified_mu_x: mu_x_mag,
            magnified_mu_y: mu_y_mag,
        }
    }
}

/// Column check results
#[derive(Debug, Clone)]
pub struct ColumnCheck {
    pub axial_ratio: f64,
    pub moment_ratio: f64,
    pub total_ratio: f64,
    pub adequate: bool,
    pub magnified_mu_x: f64,
    pub magnified_mu_y: f64,
}

impl CompositeColumn {
    /// Create circular CFT
    pub fn circular_cft(diameter: f64, thickness: f64, length: f64) -> Self {
        CompositeColumn {
            outer_diameter: diameter,
            outer_width: diameter,
            outer_depth: diameter,
            tube_thickness: thickness,
            length,
            steel_fy: 345.0,
            concrete_fc: 40.0,
            column_type: CompositeType::CircularCFT,
            end_condition: EndCondition::PinnedPinned,
        }
    }

    /// Create rectangular CFT
    pub fn rectangular_cft(width: f64, depth: f64, thickness: f64, length: f64) -> Self {
        CompositeColumn {
            outer_diameter: width.max(depth),
            outer_width: width,
            outer_depth: depth,
            tube_thickness: thickness,
            length,
            steel_fy: 345.0,
            concrete_fc: 40.0,
            column_type: CompositeType::RectangularCFT,
            end_condition: EndCondition::PinnedPinned,
        }
    }

    /// Steel area
    pub fn steel_area(&self) -> f64 {
        match self.column_type {
            CompositeType::CircularCFT => {
                let d = self.outer_diameter;
                let t = self.tube_thickness;
                PI / 4.0 * (d.powi(2) - (d - 2.0 * t).powi(2))
            }
            CompositeType::RectangularCFT => {
                let b = self.outer_width;
                let h = self.outer_depth;
                let t = self.tube_thickness;
                b * h - (b - 2.0 * t) * (h - 2.0 * t)
            }
            _ => 0.0,
        }
    }

    /// Concrete area
    pub fn concrete_area(&self) -> f64 {
        match self.column_type {
            CompositeType::CircularCFT => {
                let di = self.outer_diameter - 2.0 * self.tube_thickness;
                PI / 4.0 * di.powi(2)
            }
            CompositeType::RectangularCFT => {
                let bi = self.outer_width - 2.0 * self.tube_thickness;
                let hi = self.outer_depth - 2.0 * self.tube_thickness;
                bi * hi
            }
            _ => 0.0,
        }
    }

    /// Calculate capacity per AISC I2
    pub fn capacity(&self) -> CompositeColumnCapacity {
        let as_ = self.steel_area();
        let ac = self.concrete_area();
        let fy = self.steel_fy;
        let fc = self.concrete_fc;
        let ec = 4700.0 * fc.sqrt();

        // Effective stiffness
        let c1 = 0.25 + 3.0 * (as_ / (as_ + ac)).min(0.7);
        let _c3 = if matches!(self.column_type, CompositeType::CircularCFT) { 0.9 } else { 0.85 };

        // Section stiffness
        let (is, ic) = match self.column_type {
            CompositeType::CircularCFT => {
                let d = self.outer_diameter;
                let t = self.tube_thickness;
                let di = d - 2.0 * t;
                let is = PI / 64.0 * (d.powi(4) - di.powi(4));
                let ic = PI / 64.0 * di.powi(4);
                (is, ic)
            }
            CompositeType::RectangularCFT => {
                let b = self.outer_width;
                let h = self.outer_depth;
                let t = self.tube_thickness;
                let bi = b - 2.0 * t;
                let hi = h - 2.0 * t;
                let is = (b * h.powi(3) - bi * hi.powi(3)) / 12.0;
                let ic = bi * hi.powi(3) / 12.0;
                (is, ic)
            }
            _ => (0.0, 0.0),
        };

        let ei_eff = 200000.0 * is + c1 * ec * ic;

        // Euler buckling
        let k = self.end_condition.k_factor();
        let l = self.length * 1000.0;
        let pe = PI.powi(2) * ei_eff / (k * l).powi(2);

        // Squash load
        let c2 = if matches!(self.column_type, CompositeType::CircularCFT) { 0.95 } else { 0.85 };
        let pp = fy * as_ + c2 * fc * ac;

        // Nominal capacity
        let pno = pp;
        let pn = if pno / pe <= 2.25 {
            pno * (0.658_f64.powf(pno / pe))
        } else {
            0.877 * pe
        };

        // Radius of gyration
        let r = (is / as_).sqrt();
        let slenderness = k * l / r;

        CompositeColumnCapacity {
            pn: pn / 1000.0,
            phi_pn: 0.75 * pn / 1000.0,
            squash_load: pno / 1000.0,
            euler_load: pe / 1000.0,
            slenderness,
            steel_contribution: fy * as_ / pno,
        }
    }
}

/// Composite column capacity
#[derive(Debug, Clone)]
pub struct CompositeColumnCapacity {
    pub pn: f64,                // kN
    pub phi_pn: f64,            // kN
    pub squash_load: f64,       // kN
    pub euler_load: f64,        // kN
    pub slenderness: f64,
    pub steel_contribution: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steel_column_w_shape() {
        let col = SteelColumn::w_shape(300.0, 300.0, 15.0, 10.0, 4.0);
        let cap = col.capacity();

        assert!(cap.pn > 0.0);
        assert!(cap.phi_pn < cap.pn);
        assert!(cap.slenderness_x > 0.0);
    }

    #[test]
    fn test_steel_column_hss() {
        let col = SteelColumn::hss(200.0, 200.0, 10.0, 3.5);
        let cap = col.capacity();

        assert!(cap.pn > 0.0);
        assert_eq!(cap.slenderness_x, cap.slenderness_y);
    }

    #[test]
    fn test_steel_column_pipe() {
        let col = SteelColumn::pipe(300.0, 12.0, 4.0);
        let cap = col.capacity();

        assert!(cap.pn > 0.0);
        assert_eq!(cap.governing_axis, 'X'); // Equal axes
    }

    #[test]
    fn test_steel_interaction() {
        let col = SteelColumn::w_shape(300.0, 300.0, 15.0, 10.0, 4.0);
        let check = col.check_interaction(1000.0, 50.0, 30.0);

        assert!(check.ratio > 0.0);
    }

    #[test]
    fn test_end_conditions() {
        assert_eq!(EndCondition::FixedFixed.k_factor(), 0.5);
        assert_eq!(EndCondition::PinnedPinned.k_factor(), 1.0);
        assert_eq!(EndCondition::FixedFree.k_factor(), 2.0);
    }

    #[test]
    fn test_concrete_column_creation() {
        let col = ConcreteColumn::rectangular(400.0, 500.0, 3.5);
        assert_eq!(col.width, 400.0);
        assert_eq!(col.depth, 500.0);
    }

    #[test]
    fn test_concrete_column_square() {
        let col = ConcreteColumn::square(400.0, 3.5);
        assert_eq!(col.width, col.depth);
    }

    #[test]
    fn test_concrete_column_capacity() {
        let mut col = ConcreteColumn::rectangular(400.0, 500.0, 3.5);
        col.with_reinforcement(ColumnReinforcement {
            main_bars: 8,
            main_diameter: 25.0,
            tie_diameter: 10.0,
            tie_spacing: 300.0,
        });

        let cap = col.capacity();

        assert!(cap.pn_max > 0.0);
        assert!(cap.phi_pn_max < cap.pn_max);
        assert!(!cap.pm_diagram.is_empty());
    }

    #[test]
    fn test_concrete_slenderness() {
        let col = ConcreteColumn::rectangular(300.0, 300.0, 5.0);
        let kl_r = col.slenderness_ratio();

        assert!(kl_r > 0.0);
    }

    #[test]
    fn test_concrete_design() {
        let col = ConcreteColumn::rectangular(400.0, 500.0, 3.5);
        let reinf = col.design_reinforcement(2000.0, 100.0);

        assert!(reinf.main_bars >= 4);
        assert!(reinf.main_bars % 2 == 0);
    }

    #[test]
    fn test_concrete_check() {
        let mut col = ConcreteColumn::rectangular(400.0, 500.0, 3.5);
        col.with_reinforcement(ColumnReinforcement {
            main_bars: 8,
            main_diameter: 25.0,
            tie_diameter: 10.0,
            tie_spacing: 300.0,
        });

        let check = col.check(1000.0, 50.0, 30.0);
        assert!(check.total_ratio > 0.0);
    }

    #[test]
    fn test_composite_circular_cft() {
        let col = CompositeColumn::circular_cft(400.0, 12.0, 4.0);
        let cap = col.capacity();

        assert!(cap.pn > 0.0);
        assert!(cap.steel_contribution < 1.0);
    }

    #[test]
    fn test_composite_rectangular_cft() {
        let col = CompositeColumn::rectangular_cft(350.0, 350.0, 10.0, 4.0);
        let cap = col.capacity();

        assert!(cap.pn > 0.0);
        assert!(cap.squash_load > cap.pn);
    }

    #[test]
    fn test_composite_areas() {
        let col = CompositeColumn::circular_cft(400.0, 12.0, 4.0);

        assert!(col.steel_area() > 0.0);
        assert!(col.concrete_area() > col.steel_area());
    }

    #[test]
    fn test_pm_diagram() {
        let mut col = ConcreteColumn::rectangular(400.0, 500.0, 3.5);
        col.with_reinforcement(ColumnReinforcement {
            main_bars: 8,
            main_diameter: 25.0,
            tie_diameter: 10.0,
            tie_spacing: 300.0,
        });

        let cap = col.capacity();

        assert!(cap.pm_diagram.len() >= 10);
        // First point should be pure compression
        assert!(cap.pm_diagram[0].0 > 0.0);
        assert!(cap.pm_diagram[0].1.abs() < 1.0);
    }
}
