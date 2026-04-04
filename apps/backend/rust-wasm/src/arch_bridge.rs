// Arch Bridge Analysis Module
// Comprehensive analysis for arch bridge structures

use std::f64::consts::PI;

/// Arch bridge structure
#[derive(Debug, Clone)]
pub struct ArchBridge {
    pub name: String,
    pub span: f64,           // m
    pub rise: f64,           // m
    pub arch_type: ArchType,
    pub deck_type: DeckSupportType,
    pub arch_section: ArchSection,
    pub deck_properties: ArchDeckProperties,
    pub hangers: Vec<Hanger>,
    pub spandrel_columns: Vec<SpandrelColumn>,
}

/// Types of arch bridges
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchType {
    TiedArch,        // Deck tied to arch ends
    TrueArch,        // Thrust transferred to abutments
    ThroughArch,     // Deck passes through arch
    DeckArch,        // Deck on top of arch
    HalfThrough,     // Partially through
}

/// Deck support mechanism
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DeckSupportType {
    Hangers,         // Suspended from arch
    SpandrelColumns, // Supported on columns
    FilledSpandrel,  // Solid fill
    Combination,     // Mixed system
}

/// Arch section properties
#[derive(Debug, Clone)]
pub struct ArchSection {
    pub section_type: ArchSectionType,
    pub area: f64,           // m²
    pub moment_of_inertia: f64, // m⁴
    pub crown_depth: f64,    // m
    pub springing_depth: f64, // m (at supports)
    pub e_modulus: f64,      // GPa
    pub material: ArchMaterial,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchSectionType {
    SolidRib,
    BoxSection,
    OpenSpandrel,
    TubularSteel,
    ConcreteBox,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchMaterial {
    Steel,
    ReinforcedConcrete,
    Masonry,
    Composite,
    Timber,
}

/// Deck properties
#[derive(Debug, Clone)]
pub struct ArchDeckProperties {
    pub width: f64,          // m
    pub depth: f64,          // m
    pub weight: f64,         // kN/m
    pub area: f64,           // m²
    pub moment_of_inertia: f64, // m⁴
    pub e_modulus: f64,      // GPa
}

/// Hanger element
#[derive(Debug, Clone)]
pub struct Hanger {
    pub id: usize,
    pub position: f64,       // m from left support
    pub length: f64,         // m
    pub area: f64,           // mm²
    pub e_modulus: f64,      // GPa
    pub inclination: f64,    // degrees from vertical
}

/// Spandrel column
#[derive(Debug, Clone)]
pub struct SpandrelColumn {
    pub id: usize,
    pub position: f64,       // m from left support
    pub height: f64,         // m
    pub area: f64,           // m²
    pub moment_of_inertia: f64, // m⁴
}

/// Arch geometry results
#[derive(Debug, Clone)]
pub struct ArchGeometry {
    pub arch_length: f64,         // m
    pub shape_coordinates: Vec<(f64, f64)>,
    pub rise_to_span_ratio: f64,
    pub crown_radius: f64,        // m
    pub springing_angle: f64,     // degrees
}

/// Arch internal forces
#[derive(Debug, Clone)]
pub struct ArchForces {
    pub position: f64,            // m from left
    pub axial_force: f64,         // kN (negative = compression)
    pub bending_moment: f64,      // kN·m
    pub shear_force: f64,         // kN
    pub thrust: f64,              // kN (horizontal)
}

/// Arch buckling analysis
#[derive(Debug, Clone)]
pub struct BucklingAnalysis {
    pub critical_load: f64,       // kN
    pub buckling_mode: BucklingMode,
    pub effective_length_factor: f64,
    pub slenderness: f64,
    pub safety_factor: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BucklingMode {
    InPlaneSway,
    InPlaneAsymmetric,
    OutOfPlane,
    Torsional,
}

/// Influence line results
#[derive(Debug, Clone)]
pub struct InfluenceLines {
    pub positions: Vec<f64>,
    pub thrust: Vec<f64>,
    pub moment_at_crown: Vec<f64>,
    pub moment_at_quarter: Vec<f64>,
    pub reaction: Vec<f64>,
}

impl ArchBridge {
    /// Create new arch bridge
    pub fn new(name: &str, span: f64, rise: f64, arch_type: ArchType) -> Self {
        let deck_type = match arch_type {
            ArchType::TiedArch | ArchType::ThroughArch => DeckSupportType::Hangers,
            ArchType::DeckArch => DeckSupportType::SpandrelColumns,
            _ => DeckSupportType::Combination,
        };
        
        ArchBridge {
            name: name.to_string(),
            span,
            rise,
            arch_type,
            deck_type,
            arch_section: ArchSection::default_steel(span),
            deck_properties: ArchDeckProperties::default(span),
            hangers: Vec::new(),
            spandrel_columns: Vec::new(),
        }
    }

    /// Parabolic arch ordinate: y = 4f * x * (L - x) / L²
    pub fn parabolic_ordinate(&self, x: f64) -> f64 {
        4.0 * self.rise * x * (self.span - x) / self.span.powi(2)
    }

    /// Circular arch ordinate
    pub fn circular_ordinate(&self, x: f64) -> f64 {
        // Radius from rise and span: R = L²/(8f) + f/2
        let r = self.span.powi(2) / (8.0 * self.rise) + self.rise / 2.0;
        let x_centered = x - self.span / 2.0;
        
        // y = √(R² - x_c²) - (R - f), center at (L/2, -(R-f))
        (r.powi(2) - x_centered.powi(2)).sqrt() - (r - self.rise)
    }

    /// Catenary arch ordinate
    pub fn catenary_ordinate(&self, x: f64) -> f64 {
        // Parameter for catenary
        let a = self.span.powi(2) / (8.0 * self.rise);
        let x_centered = x - self.span / 2.0;
        
        a * (1.0 - (x_centered / a).cosh()) + self.rise
    }

    /// Calculate arch geometry
    pub fn arch_geometry(&self, shape: ArchShape, num_points: usize) -> ArchGeometry {
        let dx = self.span / (num_points - 1) as f64;
        let mut coords = Vec::with_capacity(num_points);
        let mut length: f64 = 0.0;
        
        for i in 0..num_points {
            let x = i as f64 * dx;
            let y = match shape {
                ArchShape::Parabolic => self.parabolic_ordinate(x),
                ArchShape::Circular => self.circular_ordinate(x),
                ArchShape::Catenary => self.catenary_ordinate(x),
            };
            
            if i > 0 {
                let prev: &(f64, f64) = &coords[i - 1];
                length += ((x - prev.0).powi(2) + (y - prev.1).powi(2)).sqrt();
            }
            
            coords.push((x, y));
        }
        
        // Crown radius of curvature
        let crown_radius = self.span.powi(2) / (8.0 * self.rise);
        
        // Springing angle
        let slope_at_support = 4.0 * self.rise / self.span; // For parabola
        let springing_angle = slope_at_support.atan().to_degrees();
        
        ArchGeometry {
            arch_length: length,
            shape_coordinates: coords,
            rise_to_span_ratio: self.rise / self.span,
            crown_radius,
            springing_angle,
        }
    }

    /// Generate hangers for tied arch
    pub fn generate_hangers(&mut self, num_hangers: usize, spacing: f64) {
        self.hangers.clear();
        
        let start = (self.span - (num_hangers - 1) as f64 * spacing) / 2.0;
        
        for i in 0..num_hangers {
            let x = start + i as f64 * spacing;
            let arch_y = self.parabolic_ordinate(x);
            let deck_y = 0.0; // Deck at reference level
            
            self.hangers.push(Hanger {
                id: i,
                position: x,
                length: arch_y - deck_y,
                area: 3000.0, // mm²
                e_modulus: 200.0, // GPa
                inclination: 0.0, // Vertical
            });
        }
    }

    /// Generate spandrel columns for deck arch
    pub fn generate_spandrel_columns(&mut self, num_columns: usize) {
        self.spandrel_columns.clear();
        
        let spacing = self.span / (num_columns + 1) as f64;
        
        for i in 0..num_columns {
            let x = (i + 1) as f64 * spacing;
            let arch_y = self.parabolic_ordinate(x);
            let deck_y = self.rise + 2.0; // Deck above arch
            
            self.spandrel_columns.push(SpandrelColumn {
                id: i,
                position: x,
                height: deck_y - arch_y,
                area: 0.5, // m²
                moment_of_inertia: 0.02, // m⁴
            });
        }
    }

    /// Calculate horizontal thrust under uniform load
    pub fn horizontal_thrust(&self, w: f64) -> f64 {
        // For parabolic arch under uniform load: H = wL² / 8f
        w * self.span.powi(2) / (8.0 * self.rise)
    }

    /// Arch forces under uniform dead load
    pub fn dead_load_forces(&self, w: f64, num_points: usize) -> Vec<ArchForces> {
        let mut forces = Vec::with_capacity(num_points);
        let dx = self.span / (num_points - 1) as f64;
        let h = self.horizontal_thrust(w);
        
        for i in 0..num_points {
            let x = i as f64 * dx;
            let _y = self.parabolic_ordinate(x);
            
            // Slope at point
            let dy_dx = 4.0 * self.rise * (self.span - 2.0 * x) / self.span.powi(2);
            let angle = dy_dx.atan();
            
            // Axial force (compression)
            let n = -h / angle.cos();
            
            // For parabolic arch under uniform load, M = 0 (funicular)
            let m = 0.0;
            
            // Shear force
            let v = w * (self.span / 2.0 - x);
            
            forces.push(ArchForces {
                position: x,
                axial_force: n,
                bending_moment: m,
                shear_force: v,
                thrust: h,
            });
        }
        
        forces
    }

    /// Forces under concentrated load
    pub fn point_load_forces(&self, p: f64, load_position: f64) -> Vec<ArchForces> {
        let num_points = 21;
        let mut forces = Vec::with_capacity(num_points);
        let dx = self.span / (num_points - 1) as f64;
        
        let a = load_position;
        let b = self.span - a;
        
        // Three-hinged parabolic arch:
        // Crown hinge condition (M at L/2 = 0) gives:
        //   a ≤ L/2: H = Pa/(2f)
        //   a > L/2: H = Pb/(2f)
        let h = if a <= self.span / 2.0 {
            p * a / (2.0 * self.rise)
        } else {
            p * b / (2.0 * self.rise)
        };
        
        // Vertical reactions
        let ra = p * b / self.span;
        let _rb = p * a / self.span;
        
        for i in 0..num_points {
            let x = i as f64 * dx;
            let y = self.parabolic_ordinate(x);
            
            // Bending moment (arch not funicular for point load)
            let m_simple = if x <= a { ra * x } else { ra * x - p * (x - a) };
            let m = m_simple - h * y;
            
            // Shear
            let v = if x < a { ra } else { ra - p };
            
            // Slope
            let dy_dx = 4.0 * self.rise * (self.span - 2.0 * x) / self.span.powi(2);
            let angle = dy_dx.atan();
            
            // Axial force
            let n = -(h * angle.cos() + v * angle.sin());
            
            forces.push(ArchForces {
                position: x,
                axial_force: n,
                bending_moment: m,
                shear_force: v,
                thrust: h,
            });
        }
        
        forces
    }

    /// Calculate influence lines
    pub fn influence_lines(&self, num_points: usize) -> InfluenceLines {
        let dx = self.span / (num_points - 1) as f64;
        
        let mut positions = Vec::with_capacity(num_points);
        let mut thrust_il = Vec::with_capacity(num_points);
        let mut moment_crown_il = Vec::with_capacity(num_points);
        let mut moment_quarter_il = Vec::with_capacity(num_points);
        let mut reaction_il = Vec::with_capacity(num_points);
        
        for i in 0..num_points {
            let x = i as f64 * dx;
            positions.push(x);
            
            // Influence ordinate for unit load at position x
            let a = x;
            let b = self.span - x;
            
            // Thrust influence ordinate (three-hinged arch):
            //   a ≤ L/2: H = a/(2f)
            //   a > L/2: H = b/(2f)
            let h_inf = if a <= self.span / 2.0 {
                a / (2.0 * self.rise)
            } else {
                b / (2.0 * self.rise)
            };
            thrust_il.push(h_inf);
            
            // Moment at crown (x = L/2)
            // M0(L/2) = a/2 for a ≤ L/2; b/2 for a > L/2
            let y_crown = self.rise;
            let m_simple_crown = if x <= self.span / 2.0 {
                a / 2.0
            } else {
                b / 2.0
            };
            moment_crown_il.push(m_simple_crown - h_inf * y_crown);
            
            // Moment at quarter point (x = L/4)
            // M0(L/4) = 3a/4 for a ≤ L/4; b/4 for a > L/4
            let y_quarter = self.parabolic_ordinate(self.span / 4.0);
            let m_simple_quarter = if x <= self.span / 4.0 {
                3.0 * a / 4.0
            } else {
                b / 4.0
            };
            moment_quarter_il.push(m_simple_quarter - h_inf * y_quarter);
            
            // Reaction influence ordinate
            reaction_il.push(b / self.span);
        }
        
        InfluenceLines {
            positions,
            thrust: thrust_il,
            moment_at_crown: moment_crown_il,
            moment_at_quarter: moment_quarter_il,
            reaction: reaction_il,
        }
    }

    /// In-plane buckling analysis
    pub fn in_plane_buckling(&self) -> BucklingAnalysis {
        let l = self.arch_geometry(ArchShape::Parabolic, 51).arch_length;
        let ei = self.arch_section.e_modulus * 1e9 * self.arch_section.moment_of_inertia;
        
        // Effective length factor for arch
        let k = match self.arch_type {
            ArchType::TiedArch => 1.16,  // Two-hinged with tie
            ArchType::TrueArch => 1.04,  // Fixed arch
            _ => 1.20,
        };
        
        let le = k * l / 2.0;
        let pcr = PI.powi(2) * ei / le.powi(2);
        
        // Slenderness
        let r = (self.arch_section.moment_of_inertia / self.arch_section.area).sqrt();
        let slenderness = le / r;
        
        // Applied load (simplified)
        let w_dl = self.deck_properties.weight;
        let n_max = self.horizontal_thrust(w_dl) / (45.0_f64.to_radians().cos());
        
        BucklingAnalysis {
            critical_load: pcr / 1000.0, // kN
            buckling_mode: BucklingMode::InPlaneSway,
            effective_length_factor: k,
            slenderness,
            safety_factor: pcr / 1000.0 / n_max.abs(),
        }
    }

    /// Out-of-plane buckling analysis
    pub fn out_of_plane_buckling(&self) -> BucklingAnalysis {
        let l = self.span;
        
        // Lateral moment of inertia
        let iy = self.arch_section.moment_of_inertia * 1.2; // Approximate
        let ei = self.arch_section.e_modulus * 1e9 * iy;
        
        // Effective length for lateral buckling
        let k = 1.0; // Depends on bracing
        let le = k * l;
        
        let pcr = PI.powi(2) * ei / le.powi(2);
        
        let r = (iy / self.arch_section.area).sqrt();
        let slenderness = le / r;
        
        let w_dl = self.deck_properties.weight;
        let h = self.horizontal_thrust(w_dl);
        
        BucklingAnalysis {
            critical_load: pcr / 1000.0,
            buckling_mode: BucklingMode::OutOfPlane,
            effective_length_factor: k,
            slenderness,
            safety_factor: pcr / 1000.0 / h,
        }
    }

    /// Temperature effects
    pub fn temperature_effects(&self, delta_t: f64) -> TemperatureEffects {
        let alpha = match self.arch_section.material {
            ArchMaterial::Steel => 12e-6,
            ArchMaterial::ReinforcedConcrete => 10e-6,
            ArchMaterial::Masonry => 8e-6,
            _ => 11e-6,
        };
        
        let l = self.arch_geometry(ArchShape::Parabolic, 51).arch_length;
        let delta_l = alpha * delta_t * l;
        
        // Change in horizontal thrust
        let ea = self.arch_section.e_modulus * 1e9 * self.arch_section.area;
        let h_change = ea * delta_l / l / 1000.0; // kN
        
        // Resulting moment at crown
        let m_crown = h_change * self.rise;
        
        TemperatureEffects {
            temperature_change: delta_t,
            elongation: delta_l * 1000.0, // mm
            thrust_change: h_change,
            crown_moment: m_crown,
            crown_displacement: delta_l * 1000.0 * 0.5, // mm approximate
        }
    }

    /// Hanger force analysis
    pub fn hanger_forces(&self, w: f64) -> Vec<HangerForce> {
        let mut forces = Vec::with_capacity(self.hangers.len());
        let _h = self.horizontal_thrust(w);
        
        for hanger in &self.hangers {
            let x = hanger.position;
            
            // Tributary length
            let idx = self.hangers.iter().position(|h| h.id == hanger.id).unwrap();
            let trib_left = if idx > 0 {
                (x - self.hangers[idx - 1].position) / 2.0
            } else {
                x
            };
            let trib_right = if idx < self.hangers.len() - 1 {
                (self.hangers[idx + 1].position - x) / 2.0
            } else {
                self.span - x
            };
            let tributary = trib_left + trib_right;
            
            // Vertical load from deck
            let vertical = w * tributary;
            
            // Hanger tension (including inclination)
            let tension = vertical / hanger.inclination.to_radians().cos();
            
            // Hanger stress
            let stress = tension * 1000.0 / hanger.area;
            
            forces.push(HangerForce {
                hanger_id: hanger.id,
                position: x,
                vertical_load: vertical,
                tension,
                stress,
                elongation: stress / hanger.e_modulus / 1000.0 * hanger.length * 1000.0,
            });
        }
        
        forces
    }

    /// Tied arch tie force
    pub fn tie_force(&self, w: f64) -> TieForce {
        let h = self.horizontal_thrust(w);
        
        // Tie properties (assumed)
        let tie_area = self.span * 100.0; // mm² approximate
        let tie_e = 200.0; // GPa
        
        let stress = h * 1000.0 / tie_area;
        let elongation = stress / tie_e / 1000.0 * self.span * 1000.0;
        
        TieForce {
            horizontal_force: h,
            tie_stress: stress,
            tie_elongation: elongation,
        }
    }

    /// Natural frequency of arch
    pub fn natural_frequency(&self) -> ArchFrequencies {
        let m_total = self.deck_properties.weight * self.span / 9.81 * 1000.0; // kg
        let arch_mass = self.arch_section.area * 
            self.arch_geometry(ArchShape::Parabolic, 51).arch_length *
            match self.arch_section.material {
                ArchMaterial::Steel => 7850.0,
                ArchMaterial::ReinforcedConcrete => 2500.0,
                _ => 2400.0,
            };
        
        let total_mass = m_total + arch_mass;
        
        // Approximate stiffness
        let ei = self.arch_section.e_modulus * 1e9 * self.arch_section.moment_of_inertia;
        let k_vert = 384.0 * ei / (5.0 * self.span.powi(4)) * self.span; // N/m
        
        // First vertical frequency
        let f_v1 = 1.0 / (2.0 * PI) * (k_vert / total_mass).sqrt();
        
        // Antisymmetric (in-plane sway)
        let k_sway = 3.0 * ei / self.rise.powi(3);
        let f_sway = 1.0 / (2.0 * PI) * (k_sway / total_mass).sqrt();
        
        // Out-of-plane
        let iy = self.arch_section.moment_of_inertia * 1.5;
        let k_lat = 48.0 * self.arch_section.e_modulus * 1e9 * iy / self.span.powi(3);
        let f_lat = 1.0 / (2.0 * PI) * (k_lat / total_mass).sqrt();
        
        ArchFrequencies {
            first_vertical: f_v1,
            first_antisymmetric: f_sway,
            first_lateral: f_lat,
        }
    }

    /// Wind load effects
    pub fn wind_analysis(&self, wind_speed: f64) -> WindEffects {
        let q = 0.5 * 1.225 * wind_speed.powi(2); // Pa
        
        // Wind on arch rib
        let cd = 1.8; // Drag coefficient for box section
        let arch_width = (self.arch_section.area / 
            (self.arch_section.crown_depth + self.arch_section.springing_depth) * 2.0).sqrt();
        let arch_projected = arch_width * self.arch_geometry(ArchShape::Parabolic, 51).arch_length;
        let wind_arch = q * cd * arch_projected / 1000.0; // kN
        
        // Wind on deck
        let deck_projected = self.deck_properties.depth * self.span;
        let wind_deck = q * 1.5 * deck_projected / 1000.0; // kN
        
        // Wind on hangers
        let hanger_projected: f64 = self.hangers.iter()
            .map(|h| 0.1 * h.length) // Assume 0.1m diameter
            .sum();
        let wind_hangers = q * 1.2 * hanger_projected / 1000.0; // kN
        
        WindEffects {
            wind_pressure: q / 1000.0, // kPa
            arch_wind_load: wind_arch,
            deck_wind_load: wind_deck,
            hanger_wind_load: wind_hangers,
            total_wind_load: wind_arch + wind_deck + wind_hangers,
            overturning_moment: (wind_arch * self.rise / 2.0 + 
                               wind_deck * self.deck_properties.depth / 2.0),
        }
    }
}

/// Arch shape types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ArchShape {
    Parabolic,
    Circular,
    Catenary,
}

/// Temperature effects results
#[derive(Debug, Clone)]
pub struct TemperatureEffects {
    pub temperature_change: f64,
    pub elongation: f64,          // mm
    pub thrust_change: f64,       // kN
    pub crown_moment: f64,        // kN·m
    pub crown_displacement: f64,  // mm
}

/// Hanger force results
#[derive(Debug, Clone)]
pub struct HangerForce {
    pub hanger_id: usize,
    pub position: f64,
    pub vertical_load: f64,       // kN
    pub tension: f64,             // kN
    pub stress: f64,              // MPa
    pub elongation: f64,          // mm
}

/// Tie force results
#[derive(Debug, Clone)]
pub struct TieForce {
    pub horizontal_force: f64,    // kN
    pub tie_stress: f64,          // MPa
    pub tie_elongation: f64,      // mm
}

/// Arch natural frequencies
#[derive(Debug, Clone)]
pub struct ArchFrequencies {
    pub first_vertical: f64,
    pub first_antisymmetric: f64,
    pub first_lateral: f64,
}

/// Wind effects
#[derive(Debug, Clone)]
pub struct WindEffects {
    pub wind_pressure: f64,       // kPa
    pub arch_wind_load: f64,      // kN
    pub deck_wind_load: f64,      // kN
    pub hanger_wind_load: f64,    // kN
    pub total_wind_load: f64,     // kN
    pub overturning_moment: f64,  // kN·m
}

impl ArchSection {
    pub fn default_steel(span: f64) -> Self {
        // Size based on span
        let depth = span / 50.0; // L/50 at crown
        let width = depth * 0.8;
        let thickness = depth * 0.05;
        
        // Box section properties
        let area = 2.0 * (width * thickness + (depth - 2.0 * thickness) * thickness);
        let i = width * depth.powi(3) / 12.0 - 
               (width - 2.0 * thickness) * (depth - 2.0 * thickness).powi(3) / 12.0;
        
        ArchSection {
            section_type: ArchSectionType::BoxSection,
            area,
            moment_of_inertia: i,
            crown_depth: depth,
            springing_depth: depth * 1.5,
            e_modulus: 210.0,
            material: ArchMaterial::Steel,
        }
    }
    
    pub fn concrete_box(depth: f64, width: f64, thickness: f64) -> Self {
        let area = 2.0 * (width * thickness + (depth - 2.0 * thickness) * thickness);
        let i = width * depth.powi(3) / 12.0 - 
               (width - 2.0 * thickness) * (depth - 2.0 * thickness).powi(3) / 12.0;
        
        ArchSection {
            section_type: ArchSectionType::ConcreteBox,
            area,
            moment_of_inertia: i,
            crown_depth: depth,
            springing_depth: depth * 1.2,
            e_modulus: 35.0,
            material: ArchMaterial::ReinforcedConcrete,
        }
    }
}

impl ArchDeckProperties {
    pub fn default(span: f64) -> Self {
        ArchDeckProperties {
            width: 12.0,
            depth: span / 25.0,
            weight: 150.0, // kN/m
            area: 5.0,
            moment_of_inertia: 0.5,
            e_modulus: 35.0,
        }
    }
    
    pub fn steel_deck(width: f64, depth: f64) -> Self {
        ArchDeckProperties {
            width,
            depth,
            weight: 100.0,
            area: 0.3,
            moment_of_inertia: 0.2,
            e_modulus: 210.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_arch_creation() {
        let arch = ArchBridge::new("Test Arch", 200.0, 40.0, ArchType::TiedArch);
        assert_eq!(arch.span, 200.0);
        assert_eq!(arch.rise, 40.0);
    }
    
    #[test]
    fn test_parabolic_ordinate() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        
        // At supports
        assert!((arch.parabolic_ordinate(0.0)).abs() < 0.001);
        assert!((arch.parabolic_ordinate(100.0)).abs() < 0.001);
        
        // At crown
        assert!((arch.parabolic_ordinate(50.0) - 20.0).abs() < 0.001);
    }
    
    #[test]
    fn test_arch_geometry() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let geom = arch.arch_geometry(ArchShape::Parabolic, 51);
        
        assert!(geom.arch_length > arch.span);
        assert!((geom.rise_to_span_ratio - 0.2).abs() < 0.001);
    }
    
    #[test]
    fn test_horizontal_thrust() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let h = arch.horizontal_thrust(10.0);
        
        // H = wL² / 8f = 10 * 100² / (8 * 20) = 625 kN
        assert!((h - 625.0).abs() < 0.1);
    }
    
    #[test]
    fn test_dead_load_forces() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let forces = arch.dead_load_forces(10.0, 21);
        
        assert_eq!(forces.len(), 21);
        
        // For funicular arch, moment should be zero
        for f in &forces {
            assert!((f.bending_moment).abs() < 0.001);
            assert!(f.axial_force < 0.0); // Compression
        }
    }
    
    #[test]
    fn test_point_load_forces() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let forces = arch.point_load_forces(100.0, 50.0);
        
        assert!(!forces.is_empty());
        // Moments should not all be zero for point load
        assert!(forces.iter().any(|f| f.bending_moment.abs() > 0.01));
    }
    
    #[test]
    fn test_influence_lines() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let il = arch.influence_lines(21);
        
        assert_eq!(il.positions.len(), 21);
        assert_eq!(il.thrust.len(), 21);
    }
    
    #[test]
    fn test_buckling_analysis() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        let buckling = arch.in_plane_buckling();
        
        assert!(buckling.critical_load > 0.0);
        assert!(buckling.safety_factor > 0.0);
    }
    
    #[test]
    fn test_hangers() {
        let mut arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        arch.generate_hangers(10, 10.0);
        
        assert_eq!(arch.hangers.len(), 10);
    }
    
    #[test]
    fn test_hanger_forces() {
        let mut arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        arch.generate_hangers(10, 10.0);
        
        let forces = arch.hanger_forces(10.0);
        
        assert_eq!(forces.len(), 10);
        assert!(forces.iter().all(|f| f.tension > 0.0));
    }
    
    #[test]
    fn test_temperature_effects() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TrueArch);
        let temp = arch.temperature_effects(30.0);
        
        assert!(temp.elongation > 0.0);
        assert!(temp.thrust_change > 0.0);
    }
    
    #[test]
    fn test_natural_frequency() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        let freq = arch.natural_frequency();
        
        assert!(freq.first_vertical > 0.0);
        assert!(freq.first_lateral > 0.0);
    }
    
    #[test]
    fn test_wind_analysis() {
        let mut arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        arch.generate_hangers(10, 10.0);
        
        let wind = arch.wind_analysis(30.0);
        
        assert!(wind.wind_pressure > 0.0);
        assert!(wind.total_wind_load > 0.0);
    }
    
    #[test]
    fn test_tie_force() {
        let arch = ArchBridge::new("Test", 100.0, 20.0, ArchType::TiedArch);
        let tie = arch.tie_force(10.0);
        
        assert!((tie.horizontal_force - 625.0).abs() < 0.1);
    }
    
    #[test]
    fn test_arch_section() {
        let steel = ArchSection::default_steel(100.0);
        assert_eq!(steel.material, ArchMaterial::Steel);
        assert!(steel.area > 0.0);
        
        let concrete = ArchSection::concrete_box(2.0, 3.0, 0.3);
        assert_eq!(concrete.material, ArchMaterial::ReinforcedConcrete);
    }
}
