// Precast Concrete Design Module
// Comprehensive design for precast/prestressed concrete elements

use std::f64::consts::PI;

/// Precast element types
#[derive(Debug, Clone)]
pub enum PrecastElement {
    HollowCoreSlabs(HollowCoreSlab),
    DoubleT(DoubleTBeam),
    InvertedT(InvertedTGirder),
    Spandrel(SpandrelBeam),
    Column(PrecastColumn),
    Wall(PrecastWall),
    Beam(PrecastBeam),
    StadiumRiser(StadiumRiser),
}

/// Hollow core slab
#[derive(Debug, Clone)]
pub struct HollowCoreSlab {
    pub width: f64,          // mm
    pub depth: f64,          // mm
    pub length: f64,         // mm
    pub void_diameter: f64,  // mm
    pub num_voids: usize,
    pub web_width: f64,      // mm
    pub prestress_strands: Vec<StrandConfig>,
    pub concrete_grade: ConcreteGrade,
    pub topping_thickness: f64, // mm
}

/// Double-T beam
#[derive(Debug, Clone)]
pub struct DoubleTBeam {
    pub width: f64,          // mm (overall)
    pub depth: f64,          // mm
    pub flange_thickness: f64, // mm
    pub stem_width: f64,     // mm
    pub stem_spacing: f64,   // mm (center to center)
    pub length: f64,         // mm
    pub prestress_strands: Vec<StrandConfig>,
    pub concrete_grade: ConcreteGrade,
}

/// Inverted-T girder
#[derive(Debug, Clone)]
pub struct InvertedTGirder {
    pub width: f64,          // mm (ledge to ledge)
    pub depth: f64,          // mm
    pub web_width: f64,      // mm
    pub ledge_depth: f64,    // mm
    pub ledge_projection: f64, // mm each side
    pub length: f64,         // mm
    pub prestress_strands: Vec<StrandConfig>,
    pub mild_steel: MildSteelConfig,
    pub concrete_grade: ConcreteGrade,
}

/// Spandrel beam
#[derive(Debug, Clone)]
pub struct SpandrelBeam {
    pub width: f64,          // mm
    pub depth: f64,          // mm
    pub length: f64,         // mm
    pub eccentricity: f64,   // mm (load from CG)
    pub concrete_grade: ConcreteGrade,
    pub prestress_strands: Vec<StrandConfig>,
    pub corbels: Vec<CorbelConfig>,
}

/// Precast column
#[derive(Debug, Clone)]
pub struct PrecastColumn {
    pub width: f64,          // mm
    pub depth: f64,          // mm
    pub height: f64,         // mm
    pub concrete_grade: ConcreteGrade,
    pub main_bars: RebarConfig,
    pub ties: TieConfig,
    pub splice_type: SpliceType,
}

/// Precast wall panel
#[derive(Debug, Clone)]
pub struct PrecastWall {
    pub width: f64,          // mm
    pub height: f64,         // mm
    pub thickness: f64,      // mm
    pub panel_type: WallPanelType,
    pub concrete_grade: ConcreteGrade,
    pub vertical_rebar: RebarConfig,
    pub horizontal_rebar: RebarConfig,
    pub insulation_thickness: f64, // mm for sandwich panels
}

/// Precast beam (rectangular or L-shaped)
#[derive(Debug, Clone)]
pub struct PrecastBeam {
    pub width: f64,          // mm
    pub depth: f64,          // mm
    pub length: f64,         // mm
    pub beam_type: PrecastBeamType,
    pub prestress_strands: Vec<StrandConfig>,
    pub mild_steel: MildSteelConfig,
    pub concrete_grade: ConcreteGrade,
    pub dapped_end: Option<DappedEnd>,
}

/// Stadium riser
#[derive(Debug, Clone)]
pub struct StadiumRiser {
    pub tread_width: f64,    // mm
    pub riser_height: f64,   // mm
    pub length: f64,         // mm
    pub num_treads: usize,
    pub concrete_grade: ConcreteGrade,
    pub prestress_strands: Vec<StrandConfig>,
}

/// Strand configuration
#[derive(Debug, Clone)]
pub struct StrandConfig {
    pub diameter: f64,       // mm
    pub area: f64,           // mm²
    pub position_x: f64,     // mm from centroid
    pub position_y: f64,     // mm from bottom
    pub initial_stress: f64, // MPa
    pub strand_type: StrandType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StrandType {
    Grade270LowRelax,
    Grade250,
    StressRelieved,
}

/// Concrete grade
#[derive(Debug, Clone)]
pub struct ConcreteGrade {
    pub fci: f64,            // MPa (release)
    pub fc: f64,             // MPa (28-day)
    pub ec: f64,             // MPa (modulus)
    pub fr: f64,             // MPa (rupture)
    pub density: f64,        // kg/m³
}

/// Mild steel configuration
#[derive(Debug, Clone)]
pub struct MildSteelConfig {
    pub top_bars: RebarConfig,
    pub bottom_bars: RebarConfig,
    pub stirrups: StirrupConfig,
}

/// Rebar configuration
#[derive(Debug, Clone)]
pub struct RebarConfig {
    pub diameter: f64,       // mm
    pub num_bars: usize,
    pub spacing: f64,        // mm (if distributed)
    pub grade: f64,          // MPa
    pub cover: f64,          // mm
}

/// Tie/stirrup configuration
#[derive(Debug, Clone)]
pub struct TieConfig {
    pub diameter: f64,       // mm
    pub spacing: f64,        // mm
    pub num_legs: usize,
}

#[derive(Debug, Clone)]
pub struct StirrupConfig {
    pub diameter: f64,       // mm
    pub spacing: f64,        // mm
    pub num_legs: usize,
}

/// Corbel configuration
#[derive(Debug, Clone)]
pub struct CorbelConfig {
    pub position: f64,       // mm from end
    pub width: f64,          // mm
    pub projection: f64,     // mm
    pub depth: f64,          // mm
}

/// Splice types for columns
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SpliceType {
    MechanicalCoupler,
    Dowel,
    Grouted,
    WeldedPlate,
}

/// Wall panel types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WallPanelType {
    Solid,
    Hollowcore,
    Sandwich,
    Architectural,
}

/// Precast beam types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PrecastBeamType {
    Rectangular,
    LShaped,
    InvertedT,
}

/// Dapped end configuration
#[derive(Debug, Clone)]
pub struct DappedEnd {
    pub dap_length: f64,     // mm
    pub dap_depth: f64,      // mm
    pub bearing_width: f64,  // mm
}

/// Section properties
#[derive(Debug, Clone)]
pub struct SectionProperties {
    pub area: f64,           // mm²
    pub moment_of_inertia: f64, // mm⁴
    pub centroid_y: f64,     // mm from bottom
    pub section_modulus_top: f64, // mm³
    pub section_modulus_bot: f64, // mm³
    pub radius_gyration: f64, // mm
    pub kern_top: f64,       // mm
    pub kern_bot: f64,       // mm
}

/// Prestress analysis results
#[derive(Debug, Clone)]
pub struct PrestressAnalysis {
    pub initial_prestress: f64,     // kN
    pub effective_prestress: f64,   // kN
    pub eccentricity: f64,          // mm
    pub losses: PrestressLosses,
    pub stresses: StressResults,
}

/// Prestress losses
#[derive(Debug, Clone)]
pub struct PrestressLosses {
    pub elastic_shortening: f64,    // MPa
    pub creep: f64,                 // MPa
    pub shrinkage: f64,             // MPa
    pub relaxation: f64,            // MPa
    pub total: f64,                 // MPa
    pub total_percentage: f64,      // %
}

/// Stress results at critical sections
#[derive(Debug, Clone)]
pub struct StressResults {
    pub top_transfer: f64,          // MPa
    pub bottom_transfer: f64,       // MPa
    pub top_service: f64,           // MPa
    pub bottom_service: f64,        // MPa
    pub allowable_tension: f64,     // MPa
    pub allowable_compression: f64, // MPa
}

/// Flexural design results
#[derive(Debug, Clone)]
pub struct FlexuralDesign {
    pub nominal_moment: f64,        // kN·m
    pub design_moment: f64,         // kN·m (φMn)
    pub required_moment: f64,       // kN·m
    pub neutral_axis: f64,          // mm
    pub strain_ps: f64,             // strain in prestress
    pub fps: f64,                   // MPa (stress in strand)
    pub utilization: f64,           // ratio
}

/// Shear design results
#[derive(Debug, Clone)]
pub struct ShearDesign {
    pub vc: f64,                    // kN
    pub vcw: f64,                   // kN (web-shear)
    pub vci: f64,                   // kN (flexure-shear)
    pub vs: f64,                    // kN (stirrup contribution)
    pub vn: f64,                    // kN (nominal)
    pub required_stirrups: f64,     // mm²/mm
}

/// Connection design results
#[derive(Debug, Clone)]
pub struct ConnectionDesign {
    pub connection_type: ConnectionType,
    pub capacity: f64,              // kN
    pub demand: f64,                // kN
    pub embedment: f64,             // mm
    pub weld_size: Option<f64>,     // mm
    pub bolt_size: Option<f64>,     // mm
    pub num_bolts: Option<usize>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConnectionType {
    BearingWithDowel,
    WeldedEmbed,
    BoltedConnection,
    GroutedPocket,
    CorbelandBearing,
}

impl HollowCoreSlab {
    /// Create standard hollow core slab
    pub fn new(depth: f64, length: f64) -> Self {
        let (void_dia, num_voids) = match depth as i32 {
            150..=199 => (100.0, 5),
            200..=249 => (140.0, 5),
            250..=299 => (180.0, 5),
            300..=399 => (220.0, 6),
            _ => (250.0, 6),
        };
        
        HollowCoreSlab {
            width: 1200.0,
            depth,
            length,
            void_diameter: void_dia,
            num_voids,
            web_width: (1200.0 - num_voids as f64 * void_dia) / (num_voids + 1) as f64,
            prestress_strands: Vec::new(),
            concrete_grade: ConcreteGrade::c45(),
            topping_thickness: 0.0,
        }
    }

    /// Add prestress strands
    pub fn add_strands(&mut self, num_strands: usize, diameter: f64, cover: f64) {
        let strand_area = PI * (diameter / 2.0).powi(2);
        let spacing = self.width / (num_strands + 1) as f64;
        
        for i in 0..num_strands {
            self.prestress_strands.push(StrandConfig {
                diameter,
                area: strand_area,
                position_x: (i + 1) as f64 * spacing - self.width / 2.0,
                position_y: cover + diameter / 2.0,
                initial_stress: 0.75 * 1860.0, // 75% of fpu
                strand_type: StrandType::Grade270LowRelax,
            });
        }
    }

    /// Calculate section properties
    pub fn section_properties(&self) -> SectionProperties {
        // Gross area
        let void_area = PI * (self.void_diameter / 2.0).powi(2) * self.num_voids as f64;
        let gross_area = self.width * self.depth - void_area;
        
        // Centroid (symmetric section)
        let centroid = self.depth / 2.0;
        
        // Moment of inertia
        let i_gross = self.width * self.depth.powi(3) / 12.0;
        let i_voids = self.num_voids as f64 * PI * (self.void_diameter / 2.0).powi(4) / 4.0;
        let i_net = i_gross - i_voids;
        
        let s_top = i_net / (self.depth - centroid);
        let s_bot = i_net / centroid;
        
        SectionProperties {
            area: gross_area,
            moment_of_inertia: i_net,
            centroid_y: centroid,
            section_modulus_top: s_top,
            section_modulus_bot: s_bot,
            radius_gyration: (i_net / gross_area).sqrt(),
            kern_top: s_bot / gross_area,
            kern_bot: s_top / gross_area,
        }
    }

    /// Analyze prestress forces and losses
    pub fn prestress_analysis(&self, span: f64) -> PrestressAnalysis {
        let props = self.section_properties();
        
        // Initial prestress force
        let initial_force: f64 = self.prestress_strands.iter()
            .map(|s| s.area * s.initial_stress / 1000.0)
            .sum();
        
        // Average eccentricity
        let total_area: f64 = self.prestress_strands.iter().map(|s| s.area).sum();
        let moment_area: f64 = self.prestress_strands.iter()
            .map(|s| s.area * (props.centroid_y - s.position_y))
            .sum();
        let eccentricity = if total_area > 0.0 { moment_area / total_area } else { 0.0 };
        
        // Calculate losses
        let losses = self.calculate_losses(&props, initial_force, eccentricity);
        
        // Effective prestress
        let effective_force = initial_force * (1.0 - losses.total_percentage / 100.0);
        
        // Calculate stresses
        let stresses = self.calculate_stresses(&props, effective_force, eccentricity, span);
        
        PrestressAnalysis {
            initial_prestress: initial_force,
            effective_prestress: effective_force,
            eccentricity,
            losses,
            stresses,
        }
    }

    /// Calculate prestress losses
    fn calculate_losses(&self, props: &SectionProperties, pi: f64, e: f64) -> PrestressLosses {
        let eci = 4700.0 * self.concrete_grade.fci.sqrt();
        let ec = self.concrete_grade.ec;
        let eps = 190000.0; // MPa
        
        // Total strand area
        let total_strand_area: f64 = self.prestress_strands.iter().map(|s| s.area).sum();
        if total_strand_area <= 0.0 {
            return PrestressLosses {
                elastic_shortening: 0.0,
                creep: 0.0,
                shrinkage: 0.0,
                relaxation: 0.0,
                total: 0.0,
                total_percentage: 0.0,
            };
        }
        
        // Elastic shortening
        let fcgp = pi * 1000.0 / props.area + pi * 1000.0 * e.powi(2) / props.moment_of_inertia;
        let elastic = eps / eci * fcgp.max(0.0).min(50.0);
        
        // Creep (approximate)
        let cu = 2.0; // Ultimate creep coefficient
        let fcds = fcgp * 0.85; // Service stress
        let creep = (eps / ec * cu * fcds).max(0.0).min(150.0);
        
        // Shrinkage
        let epsilon_sh = 0.0005; // Shrinkage strain
        let shrinkage = epsilon_sh * eps;
        
        // Relaxation
        let fpi = pi * 1000.0 / total_strand_area;
        let ratio = fpi / 1860.0;
        let relaxation = if ratio > 0.55 { 
            fpi * (ratio - 0.55).min(0.2) * 0.05 
        } else { 
            0.0 
        };
        
        let total = elastic + creep + shrinkage + relaxation;
        let total_percentage = (total / fpi * 100.0).max(0.0).min(25.0); // Cap at 25%
        
        PrestressLosses {
            elastic_shortening: elastic,
            creep,
            shrinkage,
            relaxation,
            total,
            total_percentage,
        }
    }

    /// Calculate stresses at transfer and service
    fn calculate_stresses(&self, props: &SectionProperties, pe: f64, e: f64, span: f64) -> StressResults {
        // Self-weight moment (density kg/m³ → unit weight kN/m³)
        let unit_weight = self.concrete_grade.density * 9.81 / 1000.0; // kN/m³
        let w = unit_weight * props.area / 1e6; // kN/m
        let mg = w * span.powi(2) / 8.0 * 1e6; // N·mm
        
        // At transfer (convert kN to N for consistent stress: N/mm² = MPa)
        let pi = pe / 0.82 * 1000.0; // N (approximate initial before losses)
        let top_transfer = -pi / props.area + pi * e / props.section_modulus_top 
                          - mg / props.section_modulus_top;
        let bottom_transfer = -pi / props.area - pi * e / props.section_modulus_bot 
                             + mg / props.section_modulus_bot;
        
        // At service (including live load)
        let live_load = 5.0; // kN/m² typical
        let ml = live_load * self.width / 1000.0 * span.powi(2) / 8.0 * 1e6;
        
        let pe_n = pe * 1000.0; // Convert kN to N
        let top_service = -pe_n / props.area + pe_n * e / props.section_modulus_top 
                         - (mg + ml) / props.section_modulus_top;
        let bottom_service = -pe_n / props.area - pe_n * e / props.section_modulus_bot 
                            + (mg + ml) / props.section_modulus_bot;
        
        StressResults {
            top_transfer,
            bottom_transfer,
            top_service,
            bottom_service,
            allowable_tension: 0.5 * self.concrete_grade.fci.sqrt(),
            allowable_compression: 0.6 * self.concrete_grade.fci,
        }
    }

    /// Design flexural capacity
    pub fn flexural_design(&self, mu: f64, _span: f64) -> FlexuralDesign {
        let _props = self.section_properties();
        // Effective depth = total depth - distance from bottom to strand centroid
        let d = self.prestress_strands.first()
            .map(|s| self.depth - s.position_y)
            .unwrap_or(self.depth * 0.9);
        
        // Strand properties
        let aps: f64 = self.prestress_strands.iter().map(|s| s.area).sum();
        let fpu = 1860.0; // MPa
        
        // Beta1 factor (ACI 318)
        let beta1 = (0.85 - 0.05 * (self.concrete_grade.fc - 28.0) / 7.0).max(0.65).min(0.85);
        
        // Stress in strand at nominal (ACI 318 §20.3.2.3.1)
        let gamma_p = 0.28; // Low-relaxation
        let rho_p = aps / (self.width * d);
        let fps = fpu * (1.0 - gamma_p / beta1 * rho_p * fpu / self.concrete_grade.fc);
        
        // Neutral axis
        let a = aps * fps / (0.85 * self.concrete_grade.fc * self.width);
        let c = a / beta1;
        
        // Nominal moment
        let mn = aps * fps * (d - a / 2.0) / 1e6; // kN·m
        
        // Strain in prestress
        let eps_cu = 0.003;
        let strain_ps = eps_cu * (d - c) / c;
        
        FlexuralDesign {
            nominal_moment: mn,
            design_moment: 0.9 * mn,
            required_moment: mu,
            neutral_axis: c,
            strain_ps,
            fps,
            utilization: mu / (0.9 * mn),
        }
    }

    /// Design for shear
    pub fn shear_design(&self, vu: f64, mu: f64) -> ShearDesign {
        let props = self.section_properties();
        let d = self.depth * 0.9;
        let bw = self.web_width * (self.num_voids + 1) as f64;
        
        let fc = self.concrete_grade.fc;
        let fpc = self.prestress_analysis(10.0).effective_prestress * 1000.0 / props.area;
        
        // Web-shear cracking
        let vcw = (0.29 * fc.sqrt() + 0.3 * fpc) * bw * d / 1000.0;
        
        // Flexure-shear cracking
        let mcr = props.section_modulus_bot * (0.5 * fc.sqrt() + fpc) / 1e6;
        let vci = 0.05 * fc.sqrt() * bw * d / 1000.0 + 
                 vu * mcr / mu.max(0.001);
        
        let vc = vcw.min(vci);
        
        ShearDesign {
            vc,
            vcw,
            vci,
            vs: 0.0, // No stirrups in hollow core typically
            vn: vc,
            required_stirrups: 0.0,
        }
    }
}

impl DoubleTBeam {
    /// Create standard double-T beam
    pub fn new(width: f64, depth: f64, length: f64) -> Self {
        DoubleTBeam {
            width,
            depth,
            flange_thickness: depth * 0.15,
            stem_width: width * 0.08,
            stem_spacing: width * 0.5,
            length,
            prestress_strands: Vec::new(),
            concrete_grade: ConcreteGrade::c50(),
        }
    }

    /// Add strands to stems
    pub fn add_strands(&mut self, strands_per_stem: usize, diameter: f64, cover: f64) {
        let strand_area = PI * (diameter / 2.0).powi(2);
        let layers = (strands_per_stem as f64 / 2.0).ceil() as usize;
        
        // Left stem
        for layer in 0..layers {
            let y = cover + diameter * 0.5 + layer as f64 * 50.0;
            let x = -self.stem_spacing / 2.0;
            
            self.prestress_strands.push(StrandConfig {
                diameter,
                area: strand_area,
                position_x: x,
                position_y: y,
                initial_stress: 0.75 * 1860.0,
                strand_type: StrandType::Grade270LowRelax,
            });
        }
        
        // Right stem
        for layer in 0..layers {
            let y = cover + diameter * 0.5 + layer as f64 * 50.0;
            let x = self.stem_spacing / 2.0;
            
            self.prestress_strands.push(StrandConfig {
                diameter,
                area: strand_area,
                position_x: x,
                position_y: y,
                initial_stress: 0.75 * 1860.0,
                strand_type: StrandType::Grade270LowRelax,
            });
        }
    }

    /// Calculate section properties
    pub fn section_properties(&self) -> SectionProperties {
        // Flange
        let a_flange = self.width * self.flange_thickness;
        let y_flange = self.depth - self.flange_thickness / 2.0;
        
        // Stems
        let stem_depth = self.depth - self.flange_thickness;
        let a_stems = 2.0 * self.stem_width * stem_depth;
        let y_stems = stem_depth / 2.0;
        
        let total_area = a_flange + a_stems;
        let centroid = (a_flange * y_flange + a_stems * y_stems) / total_area;
        
        // Moment of inertia
        let i_flange = self.width * self.flange_thickness.powi(3) / 12.0 + 
                      a_flange * (y_flange - centroid).powi(2);
        let i_stems = 2.0 * (self.stem_width * stem_depth.powi(3) / 12.0 + 
                     a_stems / 2.0 * (y_stems - centroid).powi(2));
        let i_total = i_flange + i_stems;
        
        SectionProperties {
            area: total_area,
            moment_of_inertia: i_total,
            centroid_y: centroid,
            section_modulus_top: i_total / (self.depth - centroid),
            section_modulus_bot: i_total / centroid,
            radius_gyration: (i_total / total_area).sqrt(),
            kern_top: i_total / (total_area * (self.depth - centroid)),
            kern_bot: i_total / (total_area * centroid),
        }
    }
}

impl PrecastColumn {
    /// Create precast column
    pub fn new(width: f64, depth: f64, height: f64) -> Self {
        PrecastColumn {
            width,
            depth,
            height,
            concrete_grade: ConcreteGrade::c40(),
            main_bars: RebarConfig {
                diameter: 25.0,
                num_bars: 8,
                spacing: 0.0,
                grade: 500.0,
                cover: 40.0,
            },
            ties: TieConfig {
                diameter: 10.0,
                spacing: 150.0,
                num_legs: 4,
            },
            splice_type: SpliceType::MechanicalCoupler,
        }
    }

    /// Calculate axial capacity
    pub fn axial_capacity(&self) -> f64 {
        let ag = self.width * self.depth;
        let ast = self.main_bars.num_bars as f64 * PI * (self.main_bars.diameter / 2.0).powi(2);
        
        let phi = 0.65; // Tied column
        let pn_max = 0.80 * phi * (0.85 * self.concrete_grade.fc * (ag - ast) + 
                                   self.main_bars.grade * ast);
        pn_max / 1000.0 // kN
    }

    /// Calculate P-M interaction point
    pub fn pm_interaction(&self, pu: f64) -> f64 {
        let _ag = self.width * self.depth;
        let d = self.depth - self.main_bars.cover - self.main_bars.diameter / 2.0;
        let ast = self.main_bars.num_bars as f64 / 2.0 * PI * (self.main_bars.diameter / 2.0).powi(2);
        
        let fc = self.concrete_grade.fc;
        let fy = self.main_bars.grade;
        
        // Balanced condition
        let cb = 0.003 / (0.003 + fy / 200000.0) * d;
        let beta1 = (0.85 - 0.05 * (fc - 28.0) / 7.0).max(0.65).min(0.85);
        let ab = beta1 * cb;
        
        let cc = 0.85 * fc * ab * self.width;
        let d_prime = self.main_bars.cover + self.main_bars.diameter / 2.0;
        let cs = ast * (fy - 0.85 * fc);
        let ts = ast * fy;
        
        let pb = cc + cs - ts;
        let mb = cc * (d - ab / 2.0) + cs * (d - d_prime);
        
        // Linearly interpolate based on axial load
        let po = self.axial_capacity() * 1000.0;
        if pu >= pb {
            mb * (1.0 - (pu - pb) / (po - pb)) / 1e6
        } else {
            mb / 1e6
        }
    }
}

impl PrecastWall {
    /// Create precast wall panel
    pub fn new(width: f64, height: f64, thickness: f64, panel_type: WallPanelType) -> Self {
        let insulation = match panel_type {
            WallPanelType::Sandwich => 75.0,
            _ => 0.0,
        };
        
        PrecastWall {
            width,
            height,
            thickness,
            panel_type,
            concrete_grade: ConcreteGrade::c35(),
            vertical_rebar: RebarConfig {
                diameter: 12.0,
                num_bars: ((width / 300.0) as usize).max(4),
                spacing: 300.0,
                grade: 500.0,
                cover: 25.0,
            },
            horizontal_rebar: RebarConfig {
                diameter: 10.0,
                num_bars: ((height / 300.0) as usize).max(4),
                spacing: 300.0,
                grade: 500.0,
                cover: 25.0,
            },
            insulation_thickness: insulation,
        }
    }

    /// Calculate out-of-plane bending capacity
    pub fn bending_capacity(&self) -> f64 {
        let effective_thickness = match self.panel_type {
            WallPanelType::Sandwich => (self.thickness - self.insulation_thickness) / 2.0,
            _ => self.thickness,
        };
        
        let d = effective_thickness - self.horizontal_rebar.cover - self.horizontal_rebar.diameter / 2.0;
        let as_per_m = PI * (self.horizontal_rebar.diameter / 2.0).powi(2) * 
                      (1000.0 / self.horizontal_rebar.spacing);
        
        let a = as_per_m * self.horizontal_rebar.grade / 
               (0.85 * self.concrete_grade.fc * 1000.0);
        
        0.9 * as_per_m * self.horizontal_rebar.grade * (d - a / 2.0) / 1e6 // kN·m per m
    }

    /// Calculate in-plane shear capacity
    pub fn shear_capacity(&self) -> f64 {
        let effective_thickness = match self.panel_type {
            WallPanelType::Sandwich => self.thickness - self.insulation_thickness,
            _ => self.thickness,
        };
        
        let vc = 0.17 * self.concrete_grade.fc.sqrt() * effective_thickness * self.height / 1000.0;
        
        let av = PI * (self.vertical_rebar.diameter / 2.0).powi(2); // Per-bar area
        let vs = av * self.vertical_rebar.grade * 0.8 * self.height / 
                (self.vertical_rebar.spacing * 1000.0);
        
        vc + vs // kN
    }
}

impl ConcreteGrade {
    pub fn c35() -> Self {
        ConcreteGrade {
            fci: 25.0,
            fc: 35.0,
            ec: 4700.0 * 35.0_f64.sqrt(),
            fr: 0.62 * 35.0_f64.sqrt(),
            density: 2400.0,
        }
    }
    
    pub fn c40() -> Self {
        ConcreteGrade {
            fci: 30.0,
            fc: 40.0,
            ec: 4700.0 * 40.0_f64.sqrt(),
            fr: 0.62 * 40.0_f64.sqrt(),
            density: 2400.0,
        }
    }
    
    pub fn c45() -> Self {
        ConcreteGrade {
            fci: 35.0,
            fc: 45.0,
            ec: 4700.0 * 45.0_f64.sqrt(),
            fr: 0.62 * 45.0_f64.sqrt(),
            density: 2400.0,
        }
    }
    
    pub fn c50() -> Self {
        ConcreteGrade {
            fci: 40.0,
            fc: 50.0,
            ec: 4700.0 * 50.0_f64.sqrt(),
            fr: 0.62 * 50.0_f64.sqrt(),
            density: 2400.0,
        }
    }
    
    pub fn custom(fci: f64, fc: f64) -> Self {
        ConcreteGrade {
            fci,
            fc,
            ec: 4700.0 * fc.sqrt(),
            fr: 0.62 * fc.sqrt(),
            density: 2400.0,
        }
    }
}

/// Connection design for precast
pub struct ConnectionDesigner;

impl ConnectionDesigner {
    /// Design bearing pad
    pub fn bearing_pad(reaction: f64, width: f64, length: f64) -> BearingPadDesign {
        let area = width * length;
        let stress = reaction * 1000.0 / area; // N/mm²
        
        // Elastomeric bearing pad limits
        let allowable_stress = 5.5; // MPa for unreinforced
        
        BearingPadDesign {
            width,
            length,
            required_area: reaction * 1000.0 / allowable_stress,
            provided_area: area,
            bearing_stress: stress,
            is_adequate: stress <= allowable_stress,
        }
    }

    /// Design weld for embed plate
    pub fn embed_weld(tension: f64, shear: f64, plate_thickness: f64) -> WeldDesign {
        let resultant = (tension.powi(2) + shear.powi(2)).sqrt();
        
        // E70 electrode, fillet weld
        let fillet_strength = 0.6 * 482.0; // MPa
        let throat = plate_thickness * 0.707;
        
        let required_length = resultant * 1000.0 / (fillet_strength * throat);
        
        WeldDesign {
            weld_type: "Fillet".to_string(),
            size: plate_thickness,
            required_length,
            electrode: "E70".to_string(),
            capacity: fillet_strength * throat * required_length * 1.2 / 1000.0,
        }
    }

    /// Design grouted connection
    pub fn grouted_connection(bar_diameter: f64, embedment: f64, fc: f64) -> GroutedConnectionDesign {
        let bar_area = PI * (bar_diameter / 2.0).powi(2);
        let fy = 500.0; // MPa
        
        // Development length
        let psi_t = 1.0;
        let psi_e = 1.0;
        let lambda = 1.0;
        let ld = (fy * psi_t * psi_e / (2.1 * lambda * fc.sqrt())) * bar_diameter;
        
        // Pullout capacity
        let pullout = 0.9 * 4.0 * fc.sqrt() * PI * bar_diameter * embedment / 1000.0;
        
        // Yield capacity
        let yield_cap = bar_area * fy / 1000.0;
        
        GroutedConnectionDesign {
            bar_diameter,
            embedment,
            development_length: ld,
            pullout_capacity: pullout,
            yield_capacity: yield_cap,
            is_adequate: embedment >= ld && pullout >= yield_cap,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BearingPadDesign {
    pub width: f64,
    pub length: f64,
    pub required_area: f64,
    pub provided_area: f64,
    pub bearing_stress: f64,
    pub is_adequate: bool,
}

#[derive(Debug, Clone)]
pub struct WeldDesign {
    pub weld_type: String,
    pub size: f64,
    pub required_length: f64,
    pub electrode: String,
    pub capacity: f64,
}

#[derive(Debug, Clone)]
pub struct GroutedConnectionDesign {
    pub bar_diameter: f64,
    pub embedment: f64,
    pub development_length: f64,
    pub pullout_capacity: f64,
    pub yield_capacity: f64,
    pub is_adequate: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hollow_core_creation() {
        let slab = HollowCoreSlab::new(200.0, 8000.0);
        assert_eq!(slab.depth, 200.0);
        assert_eq!(slab.width, 1200.0);
    }
    
    #[test]
    fn test_hollow_core_strands() {
        let mut slab = HollowCoreSlab::new(200.0, 8000.0);
        slab.add_strands(5, 12.7, 35.0);
        assert_eq!(slab.prestress_strands.len(), 5);
    }
    
    #[test]
    fn test_hollow_core_section() {
        let slab = HollowCoreSlab::new(200.0, 8000.0);
        let props = slab.section_properties();
        
        assert!(props.area > 0.0);
        assert!(props.moment_of_inertia > 0.0);
        assert!((props.centroid_y - 100.0).abs() < 1.0); // Symmetric section
    }
    
    #[test]
    fn test_prestress_analysis() {
        let mut slab = HollowCoreSlab::new(200.0, 8000.0);
        slab.add_strands(5, 12.7, 35.0);
        
        let analysis = slab.prestress_analysis(8.0);
        
        assert!(analysis.initial_prestress > 0.0);
        assert!(analysis.losses.total > 0.0);
        assert!(analysis.losses.total_percentage < 30.0); // Typical limit
    }
    
    #[test]
    fn test_flexural_design() {
        let mut slab = HollowCoreSlab::new(200.0, 8000.0);
        slab.add_strands(5, 12.7, 35.0);
        
        let design = slab.flexural_design(50.0, 8.0);
        
        assert!(design.nominal_moment > 0.0);
        assert!(design.design_moment > design.required_moment);
    }
    
    #[test]
    fn test_shear_design() {
        let mut slab = HollowCoreSlab::new(200.0, 8000.0);
        slab.add_strands(5, 12.7, 35.0);
        
        let design = slab.shear_design(30.0, 50.0);
        
        assert!(design.vc > 0.0);
        assert!(design.vcw > 0.0);
        assert!(design.vci > 0.0);
    }
    
    #[test]
    fn test_double_t_creation() {
        let dt = DoubleTBeam::new(3000.0, 800.0, 15000.0);
        assert_eq!(dt.width, 3000.0);
        assert_eq!(dt.depth, 800.0);
    }
    
    #[test]
    fn test_double_t_strands() {
        let mut dt = DoubleTBeam::new(3000.0, 800.0, 15000.0);
        dt.add_strands(6, 12.7, 50.0);
        assert!(!dt.prestress_strands.is_empty());
    }
    
    #[test]
    fn test_double_t_section() {
        let dt = DoubleTBeam::new(3000.0, 800.0, 15000.0);
        let props = dt.section_properties();
        
        assert!(props.area > 0.0);
        assert!(props.centroid_y > dt.depth / 2.0); // Centroid above midheight due to flange
    }
    
    #[test]
    fn test_precast_column() {
        let column = PrecastColumn::new(500.0, 500.0, 3500.0);
        let capacity = column.axial_capacity();
        
        assert!(capacity > 0.0);
    }
    
    #[test]
    fn test_column_pm_interaction() {
        let column = PrecastColumn::new(500.0, 500.0, 3500.0);
        let moment = column.pm_interaction(2000.0);
        
        assert!(moment > 0.0);
    }
    
    #[test]
    fn test_precast_wall() {
        let wall = PrecastWall::new(3000.0, 3000.0, 200.0, WallPanelType::Solid);
        
        let bending = wall.bending_capacity();
        let shear = wall.shear_capacity();
        
        assert!(bending > 0.0);
        assert!(shear > 0.0);
    }
    
    #[test]
    fn test_sandwich_wall() {
        let wall = PrecastWall::new(3000.0, 3000.0, 250.0, WallPanelType::Sandwich);
        assert_eq!(wall.insulation_thickness, 75.0);
    }
    
    #[test]
    fn test_concrete_grades() {
        let c35 = ConcreteGrade::c35();
        let c50 = ConcreteGrade::c50();
        
        assert!(c50.fc > c35.fc);
        assert!(c50.ec > c35.ec);
    }
    
    #[test]
    fn test_bearing_pad() {
        let design = ConnectionDesigner::bearing_pad(100.0, 150.0, 200.0);
        
        assert!(design.provided_area > 0.0);
        assert!(design.bearing_stress > 0.0);
    }
    
    #[test]
    fn test_embed_weld() {
        let design = ConnectionDesigner::embed_weld(50.0, 30.0, 12.0);
        
        assert!(design.required_length > 0.0);
        assert_eq!(design.electrode, "E70");
    }
    
    #[test]
    fn test_grouted_connection() {
        let design = ConnectionDesigner::grouted_connection(20.0, 400.0, 40.0);
        
        assert!(design.development_length > 0.0);
        assert!(design.pullout_capacity > 0.0);
    }
}
