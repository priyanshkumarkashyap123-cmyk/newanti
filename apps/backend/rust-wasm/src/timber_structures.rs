// ============================================================================
// TIMBER STRUCTURES MODULE
// EC5 / NDS design for timber members, connections, and composite systems
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// TIMBER SPECIES & GRADES
// ============================================================================

/// Timber strength class (European system)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StrengthClass {
    // Softwood
    C14,
    C16,
    C18,
    C20,
    C22,
    C24,
    C27,
    C30,
    C35,
    C40,
    C45,
    C50,
    // Hardwood
    D18,
    D24,
    D30,
    D35,
    D40,
    D50,
    D60,
    D70,
    // Glulam
    GL20h,
    GL24h,
    GL28h,
    GL32h,
    GL24c,
    GL28c,
    GL32c,
}

impl StrengthClass {
    /// Characteristic bending strength fm,k (MPa)
    pub fn bending_strength(&self) -> f64 {
        match self {
            StrengthClass::C14 => 14.0,
            StrengthClass::C16 => 16.0,
            StrengthClass::C18 => 18.0,
            StrengthClass::C20 => 20.0,
            StrengthClass::C22 => 22.0,
            StrengthClass::C24 => 24.0,
            StrengthClass::C27 => 27.0,
            StrengthClass::C30 => 30.0,
            StrengthClass::C35 => 35.0,
            StrengthClass::C40 => 40.0,
            StrengthClass::C45 => 45.0,
            StrengthClass::C50 => 50.0,
            StrengthClass::D18 => 18.0,
            StrengthClass::D24 => 24.0,
            StrengthClass::D30 => 30.0,
            StrengthClass::D35 => 35.0,
            StrengthClass::D40 => 40.0,
            StrengthClass::D50 => 50.0,
            StrengthClass::D60 => 60.0,
            StrengthClass::D70 => 70.0,
            StrengthClass::GL20h => 20.0,
            StrengthClass::GL24h => 24.0,
            StrengthClass::GL28h => 28.0,
            StrengthClass::GL32h => 32.0,
            StrengthClass::GL24c => 24.0,
            StrengthClass::GL28c => 28.0,
            StrengthClass::GL32c => 32.0,
        }
    }
    
    /// Characteristic tension parallel to grain ft,0,k (MPa)
    pub fn tension_parallel(&self) -> f64 {
        match self {
            StrengthClass::C14 => 8.0,
            StrengthClass::C16 => 10.0,
            StrengthClass::C18 => 11.0,
            StrengthClass::C20 => 12.0,
            StrengthClass::C22 => 13.0,
            StrengthClass::C24 => 14.5,
            StrengthClass::C27 => 16.5,
            StrengthClass::C30 => 18.0,
            StrengthClass::C35 => 21.0,
            StrengthClass::C40 => 24.0,
            StrengthClass::C45 => 27.0,
            StrengthClass::C50 => 30.0,
            StrengthClass::D18 => 11.0,
            StrengthClass::D24 => 14.0,
            StrengthClass::D30 => 18.0,
            StrengthClass::D35 => 21.0,
            StrengthClass::D40 => 24.0,
            StrengthClass::D50 => 30.0,
            StrengthClass::D60 => 36.0,
            StrengthClass::D70 => 42.0,
            _ => self.bending_strength() * 0.6, // Glulam approximation
        }
    }
    
    /// Characteristic compression parallel to grain fc,0,k (MPa)
    pub fn compression_parallel(&self) -> f64 {
        match self {
            StrengthClass::C14 => 16.0,
            StrengthClass::C16 => 17.0,
            StrengthClass::C18 => 18.0,
            StrengthClass::C20 => 19.0,
            StrengthClass::C22 => 20.0,
            StrengthClass::C24 => 21.0,
            StrengthClass::C27 => 22.0,
            StrengthClass::C30 => 23.0,
            StrengthClass::C35 => 25.0,
            StrengthClass::C40 => 26.0,
            StrengthClass::C45 => 27.0,
            StrengthClass::C50 => 29.0,
            StrengthClass::D18 => 18.0,
            StrengthClass::D24 => 21.0,
            StrengthClass::D30 => 23.0,
            StrengthClass::D35 => 25.0,
            StrengthClass::D40 => 26.0,
            StrengthClass::D50 => 29.0,
            StrengthClass::D60 => 32.0,
            StrengthClass::D70 => 34.0,
            StrengthClass::GL20h => 20.0,
            StrengthClass::GL24h => 24.0,
            StrengthClass::GL28h => 28.0,
            StrengthClass::GL32h => 32.0,
            StrengthClass::GL24c => 21.0,
            StrengthClass::GL28c => 24.0,
            StrengthClass::GL32c => 26.5,
        }
    }
    
    /// Characteristic shear strength fv,k (MPa)
    pub fn shear_strength(&self) -> f64 {
        match self {
            StrengthClass::C14 | StrengthClass::C16 | StrengthClass::C18 => 3.0,
            StrengthClass::C20 | StrengthClass::C22 | StrengthClass::C24 => 4.0,
            StrengthClass::C27 | StrengthClass::C30 | StrengthClass::C35 => 4.0,
            StrengthClass::C40 | StrengthClass::C45 | StrengthClass::C50 => 4.0,
            StrengthClass::D18 | StrengthClass::D24 => 3.4,
            StrengthClass::D30 | StrengthClass::D35 => 4.0,
            StrengthClass::D40 | StrengthClass::D50 => 4.5,
            StrengthClass::D60 | StrengthClass::D70 => 5.0,
            _ => 3.5, // Glulam
        }
    }
    
    /// Mean modulus of elasticity E0,mean (MPa)
    pub fn elastic_modulus(&self) -> f64 {
        match self {
            StrengthClass::C14 => 7000.0,
            StrengthClass::C16 => 8000.0,
            StrengthClass::C18 => 9000.0,
            StrengthClass::C20 => 9500.0,
            StrengthClass::C22 => 10000.0,
            StrengthClass::C24 => 11000.0,
            StrengthClass::C27 => 11500.0,
            StrengthClass::C30 => 12000.0,
            StrengthClass::C35 => 13000.0,
            StrengthClass::C40 => 14000.0,
            StrengthClass::C45 => 15000.0,
            StrengthClass::C50 => 16000.0,
            StrengthClass::D18 => 9500.0,
            StrengthClass::D24 => 10000.0,
            StrengthClass::D30 => 11000.0,
            StrengthClass::D35 => 12000.0,
            StrengthClass::D40 => 13000.0,
            StrengthClass::D50 => 14000.0,
            StrengthClass::D60 => 17000.0,
            StrengthClass::D70 => 20000.0,
            StrengthClass::GL20h | StrengthClass::GL24c => 10500.0,
            StrengthClass::GL24h | StrengthClass::GL28c => 11500.0,
            StrengthClass::GL28h | StrengthClass::GL32c => 12600.0,
            StrengthClass::GL32h => 14200.0,
        }
    }
    
    /// Characteristic density ρk (kg/m³)
    pub fn density(&self) -> f64 {
        match self {
            StrengthClass::C14 => 290.0,
            StrengthClass::C16 => 310.0,
            StrengthClass::C18 => 320.0,
            StrengthClass::C20 => 330.0,
            StrengthClass::C22 => 340.0,
            StrengthClass::C24 => 350.0,
            StrengthClass::C27 => 370.0,
            StrengthClass::C30 => 380.0,
            StrengthClass::C35 => 400.0,
            StrengthClass::C40 => 420.0,
            StrengthClass::C45 => 440.0,
            StrengthClass::C50 => 460.0,
            StrengthClass::D18 => 475.0,
            StrengthClass::D24 => 485.0,
            StrengthClass::D30 => 530.0,
            StrengthClass::D35 => 560.0,
            StrengthClass::D40 => 590.0,
            StrengthClass::D50 => 650.0,
            StrengthClass::D60 => 700.0,
            StrengthClass::D70 => 900.0,
            _ => 420.0, // Glulam typical
        }
    }
}

/// Service class (moisture condition)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServiceClass {
    /// SC1: Interior, heated (EMC < 12%)
    SC1,
    /// SC2: Covered, unheated (EMC < 20%)
    SC2,
    /// SC3: Exterior exposure (EMC > 20%)
    SC3,
}

impl ServiceClass {
    /// Deformation factor kdef
    pub fn kdef(&self, is_solid: bool) -> f64 {
        match (self, is_solid) {
            (ServiceClass::SC1, true) => 0.6,
            (ServiceClass::SC2, true) => 0.8,
            (ServiceClass::SC3, true) => 2.0,
            (ServiceClass::SC1, false) => 0.8,
            (ServiceClass::SC2, false) => 1.0,
            (ServiceClass::SC3, false) => 2.5,
        }
    }
}

/// Load duration class
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LoadDuration {
    Permanent,    // > 10 years
    LongTerm,     // 6 months - 10 years
    MediumTerm,   // 1 week - 6 months
    ShortTerm,    // < 1 week
    Instantaneous,
}

impl LoadDuration {
    /// Modification factor kmod
    pub fn kmod(&self, service_class: ServiceClass) -> f64 {
        match (self, service_class) {
            (LoadDuration::Permanent, ServiceClass::SC1) => 0.60,
            (LoadDuration::Permanent, ServiceClass::SC2) => 0.60,
            (LoadDuration::Permanent, ServiceClass::SC3) => 0.50,
            (LoadDuration::LongTerm, ServiceClass::SC1) => 0.70,
            (LoadDuration::LongTerm, ServiceClass::SC2) => 0.70,
            (LoadDuration::LongTerm, ServiceClass::SC3) => 0.55,
            (LoadDuration::MediumTerm, ServiceClass::SC1) => 0.80,
            (LoadDuration::MediumTerm, ServiceClass::SC2) => 0.80,
            (LoadDuration::MediumTerm, ServiceClass::SC3) => 0.65,
            (LoadDuration::ShortTerm, ServiceClass::SC1) => 0.90,
            (LoadDuration::ShortTerm, ServiceClass::SC2) => 0.90,
            (LoadDuration::ShortTerm, ServiceClass::SC3) => 0.70,
            (LoadDuration::Instantaneous, _) => 1.10,
        }
    }
}

// ============================================================================
// TIMBER MEMBER DESIGN
// ============================================================================

/// Timber beam design (EC5)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberBeam {
    /// Strength class
    pub strength_class: StrengthClass,
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Span (mm)
    pub span: f64,
    /// Service class
    pub service_class: ServiceClass,
    /// Load duration
    pub load_duration: LoadDuration,
}

impl TimberBeam {
    pub fn new(strength_class: StrengthClass, width: f64, depth: f64, span: f64) -> Self {
        Self {
            strength_class,
            width,
            depth,
            span,
            service_class: ServiceClass::SC1,
            load_duration: LoadDuration::MediumTerm,
        }
    }
    
    /// Section modulus (mm³)
    pub fn section_modulus(&self) -> f64 {
        self.width * self.depth.powi(2) / 6.0
    }
    
    /// Moment of inertia (mm⁴)
    pub fn moment_of_inertia(&self) -> f64 {
        self.width * self.depth.powi(3) / 12.0
    }
    
    /// Area (mm²)
    pub fn area(&self) -> f64 {
        self.width * self.depth
    }
    
    /// Design bending strength (MPa)
    pub fn design_bending_strength(&self) -> f64 {
        let fm_k = self.strength_class.bending_strength();
        let kmod = self.load_duration.kmod(self.service_class);
        let gamma_m = 1.3; // Material partial factor for solid timber
        let kh = self.size_factor();
        
        kmod * kh * fm_k / gamma_m
    }
    
    /// Size factor for bending (EC5 3.2)
    pub fn size_factor(&self) -> f64 {
        let h = self.depth;
        
        if h < 150.0 {
            (150.0 / h).powf(0.2).min(1.3)
        } else {
            1.0
        }
    }
    
    /// Bending capacity (kN·m)
    pub fn bending_capacity(&self) -> f64 {
        self.design_bending_strength() * self.section_modulus() / 1e6
    }
    
    /// Design shear strength (MPa)
    pub fn design_shear_strength(&self) -> f64 {
        let fv_k = self.strength_class.shear_strength();
        let kmod = self.load_duration.kmod(self.service_class);
        let gamma_m = 1.3;
        
        kmod * fv_k / gamma_m
    }
    
    /// Shear capacity (kN)
    pub fn shear_capacity(&self) -> f64 {
        // EC5 §6.1.7: τ_d = 1.5·V / (kcr·b·h) ≤ fv,d
        // → V ≤ (2/3) · fv,d · kcr · b · h
        let kcr = 0.67; // Crack factor
        let av = kcr * self.width * self.depth;
        
        (2.0 / 3.0) * self.design_shear_strength() * av / 1000.0
    }
    
    /// Check combined bending and shear
    pub fn utilization(&self, moment: f64, shear: f64) -> f64 {
        let bending_util = moment / self.bending_capacity();
        let shear_util = shear / self.shear_capacity();
        
        bending_util.max(shear_util)
    }
    
    /// Deflection under UDL (mm)
    pub fn deflection_udl(&self, load: f64) -> f64 {
        // load in kN/m, span in mm
        let e = self.strength_class.elastic_modulus();
        let i = self.moment_of_inertia();
        let w = load * 1e3 / 1e3; // N/mm
        let l = self.span;
        
        5.0 * w * l.powi(4) / (384.0 * e * i)
    }
    
    /// Lateral-torsional buckling factor kcrit
    pub fn kcrit(&self, effective_length: f64) -> f64 {
        let e005 = self.strength_class.elastic_modulus() * 0.67; // E0.05
        let g = e005 / 16.0; // Approximate shear modulus
        let b = self.width;
        let h = self.depth;
        
        // Relative slenderness
        let sigma_m_crit = PI.powi(2) * e005 * (b.powi(2) / (h * effective_length)).powi(2) / 
            (1.0 + PI.powi(2) * e005 / g * (b / effective_length).powi(2));
        
        let fm_k = self.strength_class.bending_strength();
        let lambda_rel = (fm_k / sigma_m_crit).sqrt();
        
        if lambda_rel <= 0.75 {
            1.0
        } else if lambda_rel <= 1.4 {
            1.56 - 0.75 * lambda_rel
        } else {
            1.0 / lambda_rel.powi(2)
        }
    }
}

// ============================================================================
// TIMBER COLUMN
// ============================================================================

/// Timber column design
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberColumn {
    /// Strength class
    pub strength_class: StrengthClass,
    /// Width (mm)
    pub width: f64,
    /// Depth (mm)
    pub depth: f64,
    /// Height/length (mm)
    pub height: f64,
    /// Effective length factor
    pub effective_length_factor: f64,
    /// Service class
    pub service_class: ServiceClass,
    /// Load duration
    pub load_duration: LoadDuration,
}

impl TimberColumn {
    pub fn new(strength_class: StrengthClass, width: f64, depth: f64, height: f64) -> Self {
        Self {
            strength_class,
            width,
            depth,
            height,
            effective_length_factor: 1.0,
            service_class: ServiceClass::SC1,
            load_duration: LoadDuration::MediumTerm,
        }
    }
    
    /// Slenderness ratio about y-axis
    pub fn slenderness_y(&self) -> f64 {
        let l_ef = self.height * self.effective_length_factor;
        let i_y = self.depth / 12.0_f64.sqrt();
        
        l_ef / i_y
    }
    
    /// Slenderness ratio about z-axis
    pub fn slenderness_z(&self) -> f64 {
        let l_ef = self.height * self.effective_length_factor;
        let i_z = self.width / 12.0_f64.sqrt();
        
        l_ef / i_z
    }
    
    /// Relative slenderness
    pub fn relative_slenderness(&self) -> f64 {
        let fc_0_k = self.strength_class.compression_parallel();
        let e005 = self.strength_class.elastic_modulus() * 0.67;
        let lambda = self.slenderness_y().max(self.slenderness_z());
        
        lambda / PI * (fc_0_k / e005).sqrt()
    }
    
    /// Instability factor kc
    pub fn instability_factor(&self) -> f64 {
        let lambda_rel = self.relative_slenderness();
        let beta_c = 0.2; // For solid timber
        
        let k = 0.5 * (1.0 + beta_c * (lambda_rel - 0.3) + lambda_rel.powi(2));
        
        1.0 / (k + (k.powi(2) - lambda_rel.powi(2)).sqrt())
    }
    
    /// Design compression strength (MPa)
    pub fn design_compression_strength(&self) -> f64 {
        let fc_0_k = self.strength_class.compression_parallel();
        let kmod = self.load_duration.kmod(self.service_class);
        let gamma_m = 1.3;
        
        kmod * fc_0_k / gamma_m
    }
    
    /// Axial capacity (kN)
    pub fn axial_capacity(&self) -> f64 {
        let area = self.width * self.depth;
        let kc = self.instability_factor();
        
        kc * self.design_compression_strength() * area / 1000.0
    }
}

// ============================================================================
// TIMBER CONNECTIONS
// ============================================================================

/// Dowel-type fastener
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FastenerType {
    Nail,
    Screw,
    Bolt,
    Dowel,
}

/// Timber connection with dowel-type fasteners
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberConnection {
    /// Fastener type
    pub fastener_type: FastenerType,
    /// Fastener diameter (mm)
    pub diameter: f64,
    /// Number of fasteners
    pub count: usize,
    /// Timber density (kg/m³)
    pub timber_density: f64,
    /// Fastener yield strength (MPa)
    pub fu: f64,
    /// Timber thickness member 1 (mm)
    pub t1: f64,
    /// Timber thickness member 2 (mm)
    pub t2: f64,
}

impl TimberConnection {
    pub fn new(fastener_type: FastenerType, diameter: f64, count: usize) -> Self {
        Self {
            fastener_type,
            diameter,
            count,
            timber_density: 350.0,
            fu: match fastener_type {
                FastenerType::Nail => 600.0,
                FastenerType::Screw => 800.0,
                FastenerType::Bolt | FastenerType::Dowel => 400.0,
            },
            t1: 100.0,
            t2: 100.0,
        }
    }
    
    /// Embedding strength (MPa) - parallel to grain
    pub fn embedding_strength(&self) -> f64 {
        let d = self.diameter;
        let rho = self.timber_density;
        
        match self.fastener_type {
            FastenerType::Nail | FastenerType::Screw if d <= 8.0 => {
                0.082 * rho * d.powf(-0.3)
            },
            _ => {
                0.082 * (1.0 - 0.01 * d) * rho
            }
        }
    }
    
    /// Fastener yield moment (N·mm)
    pub fn yield_moment(&self) -> f64 {
        let d = self.diameter;
        let fu = self.fu;
        
        // EC5 Eq. 8.14 / 8.30: My,Rk = 0.3 × fu × d^2.6 for all dowel-type fasteners
        0.3 * fu * d.powf(2.6)
    }
    
    /// Single shear capacity per fastener (N) - Johansen yield theory
    pub fn single_shear_capacity(&self) -> f64 {
        let fh = self.embedding_strength();
        let my = self.yield_moment();
        let d = self.diameter;
        let t1 = self.t1;
        let t2 = self.t2;
        
        // Simplified - mode III (two plastic hinges)
        let fv_rk = 1.05 * fh * t1 * d / (2.0 + (1.0 + 2.0 * my / (fh * d * t1.powi(2))).sqrt());
        
        // Alternative modes
        let mode_i = fh * t1 * d;
        let mode_ii = fh * t2 * d;
        
        fv_rk.min(mode_i).min(mode_ii)
    }
    
    /// Total connection capacity (kN)
    pub fn total_capacity(&self) -> f64 {
        let fv_rk = self.single_shear_capacity();
        let n_ef = self.effective_fastener_count();
        let gamma_m = 1.3;
        let kmod = 0.8; // Assumed medium term
        
        kmod * n_ef * fv_rk / (gamma_m * 1000.0)
    }
    
    /// Effective number of fasteners (row shear)
    pub fn effective_fastener_count(&self) -> f64 {
        // Simplified - assumes all in one row
        let n = self.count as f64;
        let a1 = 5.0 * self.diameter; // Assumed spacing
        let d = self.diameter;
        
        let n_ef = n.powf(0.9) * (a1 / (13.0 * d)).powf(0.25).min(1.0);
        
        n_ef.min(n)
    }
}

// ============================================================================
// TIMBER-CONCRETE COMPOSITE
// ============================================================================

/// Timber-concrete composite floor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberConcreteComposite {
    /// Timber beam width (mm)
    pub timber_width: f64,
    /// Timber beam depth (mm)
    pub timber_depth: f64,
    /// Timber strength class
    pub timber_class: StrengthClass,
    /// Concrete slab thickness (mm)
    pub concrete_thickness: f64,
    /// Concrete characteristic strength (MPa)
    pub fck: f64,
    /// Effective slab width (mm)
    pub slab_width: f64,
    /// Connector stiffness (kN/mm)
    pub connector_stiffness: f64,
    /// Connector spacing (mm)
    pub connector_spacing: f64,
    /// Span (mm)
    pub span: f64,
}

impl TimberConcreteComposite {
    pub fn new(timber_width: f64, timber_depth: f64, timber_class: StrengthClass) -> Self {
        Self {
            timber_width,
            timber_depth,
            timber_class,
            concrete_thickness: 80.0,
            fck: 25.0,
            slab_width: 1000.0,
            connector_stiffness: 10.0,
            connector_spacing: 200.0,
            span: 6000.0,
        }
    }
    
    /// Concrete elastic modulus (MPa)
    pub fn concrete_modulus(&self) -> f64 {
        22000.0 * (self.fck / 10.0).powf(0.3)
    }
    
    /// Modular ratio
    pub fn modular_ratio(&self) -> f64 {
        self.concrete_modulus() / self.timber_class.elastic_modulus()
    }
    
    /// Gamma factor for partial connection
    pub fn gamma_factor(&self) -> f64 {
        let e1 = self.concrete_modulus();
        let a1 = self.slab_width * self.concrete_thickness;
        let k = self.connector_stiffness * 1000.0; // N/mm
        let s = self.connector_spacing;
        let l = self.span;
        
        1.0 / (1.0 + PI.powi(2) * e1 * a1 / (k / s * l.powi(2)))
    }
    
    /// Effective bending stiffness (EI)ef (N·mm²)
    pub fn effective_stiffness(&self) -> f64 {
        let e1 = self.concrete_modulus();
        let e2 = self.timber_class.elastic_modulus();
        
        let a1 = self.slab_width * self.concrete_thickness;
        let i1 = self.slab_width * self.concrete_thickness.powi(3) / 12.0;
        
        let a2 = self.timber_width * self.timber_depth;
        let i2 = self.timber_width * self.timber_depth.powi(3) / 12.0;
        
        let gamma1 = self.gamma_factor();
        
        // Distance from centroids
        let h = self.concrete_thickness + self.timber_depth;
        let a = gamma1 * e1 * a1 * (h / 2.0);
        let b = e1 * a1 + e2 * a2;
        let y_na = a / b; // From timber centroid
        
        let a1_dist = h / 2.0 - y_na;
        let a2_dist = y_na;
        
        e1 * i1 + gamma1 * e1 * a1 * a1_dist.powi(2) +
            e2 * i2 + e2 * a2 * a2_dist.powi(2)
    }
    
    /// Maximum stress in concrete (MPa)
    pub fn concrete_stress(&self, moment: f64) -> f64 {
        let m = moment * 1e6; // N·mm
        let ei = self.effective_stiffness();
        let e1 = self.concrete_modulus();
        
        let gamma1 = self.gamma_factor();
        let a1 = self.slab_width * self.concrete_thickness;
        let a2 = self.timber_width * self.timber_depth;
        let h = self.concrete_thickness + self.timber_depth;
        
        let y_na = gamma1 * e1 * a1 * (h / 2.0) / (e1 * a1 + self.timber_class.elastic_modulus() * a2);
        
        // Stress at top of concrete
        let y_conc = h / 2.0 - y_na + self.concrete_thickness / 2.0;
        
        e1 * m * y_conc / ei
    }
    
    /// Maximum stress in timber (MPa)
    pub fn timber_stress(&self, moment: f64) -> f64 {
        let m = moment * 1e6;
        let ei = self.effective_stiffness();
        let e2 = self.timber_class.elastic_modulus();
        
        // Approximate bottom fiber stress
        let y_timber = self.timber_depth / 2.0;
        
        e2 * m * y_timber / ei
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strength_class() {
        let c24 = StrengthClass::C24;
        
        assert!((c24.bending_strength() - 24.0).abs() < 0.1);
        assert!(c24.elastic_modulus() > 10000.0);
    }

    #[test]
    fn test_kmod() {
        let kmod = LoadDuration::MediumTerm.kmod(ServiceClass::SC1);
        
        assert!((kmod - 0.8).abs() < 0.01);
    }

    #[test]
    fn test_timber_beam() {
        let beam = TimberBeam::new(StrengthClass::C24, 100.0, 200.0, 4000.0);
        
        assert!(beam.bending_capacity() > 5.0);
        assert!(beam.shear_capacity() > 20.0);
    }

    #[test]
    fn test_section_modulus() {
        let beam = TimberBeam::new(StrengthClass::C24, 100.0, 200.0, 4000.0);
        
        // W = bd²/6 = 100 * 200² / 6 = 666,667 mm³
        let w = beam.section_modulus();
        assert!((w - 666666.67).abs() < 1.0);
    }

    #[test]
    fn test_timber_column() {
        let col = TimberColumn::new(StrengthClass::C24, 150.0, 150.0, 3000.0);
        
        assert!(col.axial_capacity() > 50.0);
    }

    #[test]
    fn test_slenderness() {
        let col = TimberColumn::new(StrengthClass::C24, 150.0, 150.0, 3000.0);
        
        let lambda = col.slenderness_y();
        assert!(lambda > 50.0 && lambda < 100.0);
    }

    #[test]
    fn test_timber_connection() {
        let conn = TimberConnection::new(FastenerType::Bolt, 12.0, 4);
        
        assert!(conn.total_capacity() > 10.0);
    }

    #[test]
    fn test_embedding_strength() {
        let mut conn = TimberConnection::new(FastenerType::Bolt, 12.0, 4);
        conn.timber_density = 350.0;
        
        let fh = conn.embedding_strength();
        assert!(fh > 20.0 && fh < 40.0);
    }

    #[test]
    fn test_composite() {
        let comp = TimberConcreteComposite::new(200.0, 400.0, StrengthClass::GL24h);
        
        let gamma = comp.gamma_factor();
        assert!(gamma > 0.0 && gamma <= 1.0);
    }

    #[test]
    fn test_composite_stiffness() {
        let comp = TimberConcreteComposite::new(200.0, 400.0, StrengthClass::GL24h);
        
        let ei = comp.effective_stiffness();
        assert!(ei > 1e12);
    }

    #[test]
    fn test_hardwood_strength() {
        let d40 = StrengthClass::D40;
        let c24 = StrengthClass::C24;
        
        assert!(d40.bending_strength() > c24.bending_strength());
    }

    #[test]
    fn test_glulam() {
        let gl32 = StrengthClass::GL32h;
        
        assert!(gl32.bending_strength() >= 32.0);
        assert!(gl32.elastic_modulus() > 12000.0);
    }

    #[test]
    fn test_size_factor() {
        let small = TimberBeam::new(StrengthClass::C24, 100.0, 100.0, 3000.0);
        let large = TimberBeam::new(StrengthClass::C24, 100.0, 300.0, 3000.0);
        
        assert!(small.size_factor() > large.size_factor());
    }
}
