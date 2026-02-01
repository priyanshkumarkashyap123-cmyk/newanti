//! Construction Materials Module
//! 
//! Comprehensive material property database and models:
//! - Concrete (normal, high-strength, lightweight, UHPC)
//! - Steel (structural, reinforcing, prestressing)
//! - Timber (softwood, hardwood, engineered)
//! - Masonry (clay, concrete, AAC)
//! - Aluminum alloys
//! - FRP composites

use serde::{Deserialize, Serialize};
use std::f64::consts::E;

/// Material database manager
#[derive(Debug, Clone)]
pub struct MaterialDatabase {
    /// Concrete materials
    pub concretes: Vec<ConcreteGrade>,
    /// Steel materials
    pub steels: Vec<SteelGrade>,
    /// Timber materials
    pub timbers: Vec<TimberGrade>,
    /// Masonry materials
    pub masonry: Vec<MasonryType>,
    /// Aluminum alloys
    pub aluminum: Vec<AluminumAlloy>,
    /// FRP materials
    pub frp: Vec<FRPMaterial>,
}

impl MaterialDatabase {
    /// Create database with standard materials
    pub fn standard() -> Self {
        let mut db = Self {
            concretes: Vec::new(),
            steels: Vec::new(),
            timbers: Vec::new(),
            masonry: Vec::new(),
            aluminum: Vec::new(),
            frp: Vec::new(),
        };
        
        db.load_standard_materials();
        db
    }
    
    /// Load standard materials
    fn load_standard_materials(&mut self) {
        // Standard concrete grades
        for fc in [20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0, 60.0, 70.0, 80.0] {
            self.concretes.push(ConcreteGrade::new(fc));
        }
        
        // Standard steel grades
        self.steels.push(SteelGrade::structural("S235", 235.0));
        self.steels.push(SteelGrade::structural("S275", 275.0));
        self.steels.push(SteelGrade::structural("S355", 355.0));
        self.steels.push(SteelGrade::structural("S460", 460.0));
        self.steels.push(SteelGrade::rebar("Grade 40", 276.0));
        self.steels.push(SteelGrade::rebar("Grade 60", 414.0));
        self.steels.push(SteelGrade::rebar("B500B", 500.0));
        self.steels.push(SteelGrade::prestressing("Y1770", 1770.0));
        self.steels.push(SteelGrade::prestressing("Y1860", 1860.0));
        
        // Standard timber grades
        self.timbers.push(TimberGrade::softwood("C16", 16.0));
        self.timbers.push(TimberGrade::softwood("C24", 24.0));
        self.timbers.push(TimberGrade::softwood("C30", 30.0));
        self.timbers.push(TimberGrade::hardwood("D30", 30.0));
        self.timbers.push(TimberGrade::hardwood("D50", 50.0));
        self.timbers.push(TimberGrade::glulam("GL24h", 24.0));
        self.timbers.push(TimberGrade::glulam("GL32h", 32.0));
        
        // Standard masonry
        self.masonry.push(MasonryType::clay_brick(10.0));
        self.masonry.push(MasonryType::concrete_block(7.5));
        self.masonry.push(MasonryType::aac_block(4.0));
        
        // Aluminum alloys
        self.aluminum.push(AluminumAlloy::alloy_6061_t6());
        self.aluminum.push(AluminumAlloy::alloy_6063_t6());
        
        // FRP materials
        self.frp.push(FRPMaterial::gfrp_rebar());
        self.frp.push(FRPMaterial::cfrp_strip());
    }
    
    /// Get concrete by strength
    pub fn get_concrete(&self, fc: f64) -> Option<&ConcreteGrade> {
        self.concretes.iter().find(|c| (c.fc - fc).abs() < 0.5)
    }
    
    /// Get steel by name
    pub fn get_steel(&self, name: &str) -> Option<&SteelGrade> {
        self.steels.iter().find(|s| s.name == name)
    }
    
    /// Get timber by name
    pub fn get_timber(&self, name: &str) -> Option<&TimberGrade> {
        self.timbers.iter().find(|t| t.name == name)
    }
}

/// Concrete grade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteGrade {
    /// Name (e.g., "C30/37")
    pub name: String,
    /// Cylinder strength (MPa)
    pub fc: f64,
    /// Cube strength (MPa)
    pub fcu: f64,
    /// Mean compressive strength (MPa)
    pub fcm: f64,
    /// Tensile strength (MPa)
    pub fct: f64,
    /// Elastic modulus (MPa)
    pub ecm: f64,
    /// Strain at peak stress
    pub eps_c1: f64,
    /// Ultimate strain
    pub eps_cu1: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Concrete type
    pub concrete_type: ConcreteType,
    /// Exposure class
    pub exposure: ExposureClass,
}

/// Concrete type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ConcreteType {
    Normal,
    HighStrength,
    Lightweight,
    UHPC,
    SelfCompacting,
    FibreReinforced,
}

/// Exposure class per EN 206
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ExposureClass {
    X0,
    XC1, XC2, XC3, XC4,
    XD1, XD2, XD3,
    XS1, XS2, XS3,
    XF1, XF2, XF3, XF4,
    XA1, XA2, XA3,
}

impl ConcreteGrade {
    /// Create new concrete grade
    pub fn new(fc: f64) -> Self {
        let fcu = fc / 0.8; // Approximate cube strength
        let fcm = fc + 8.0; // Mean strength
        
        // Tensile strength (Eurocode)
        let fct = if fc <= 50.0 {
            0.30 * fc.powf(2.0 / 3.0)
        } else {
            2.12 * (1.0 + fcm / 10.0).ln()
        };
        
        // Elastic modulus (Eurocode)
        let ecm = 22000.0 * (fcm / 10.0).powf(0.3);
        
        // Strain values
        let (eps_c1, eps_cu1) = if fc <= 50.0 {
            (0.0022, 0.0035)
        } else {
            let eps_c1 = 0.0022 + 0.001 * ((fc - 50.0) / 50.0).min(1.0);
            let eps_cu1 = 0.0026 + 0.035 * ((90.0 - fc) / 100.0).powf(4.0);
            (eps_c1, eps_cu1.max(0.0026))
        };
        
        let concrete_type = if fc >= 90.0 {
            ConcreteType::UHPC
        } else if fc >= 55.0 {
            ConcreteType::HighStrength
        } else {
            ConcreteType::Normal
        };
        
        let name = format!("C{}/{}", fc as i32, (fc / 0.8) as i32);
        
        Self {
            name,
            fc,
            fcu,
            fcm,
            fct,
            ecm,
            eps_c1,
            eps_cu1,
            density: 2400.0,
            concrete_type,
            exposure: ExposureClass::XC1,
        }
    }
    
    /// Create lightweight concrete
    pub fn lightweight(fc: f64, density: f64) -> Self {
        let mut concrete = Self::new(fc);
        concrete.density = density;
        concrete.concrete_type = ConcreteType::Lightweight;
        
        // Reduce modulus for lightweight
        let eta_e = (density / 2200.0).min(1.0);
        concrete.ecm *= eta_e;
        
        concrete
    }
    
    /// Create UHPC
    pub fn uhpc(fc: f64) -> Self {
        let mut concrete = Self::new(fc);
        concrete.concrete_type = ConcreteType::UHPC;
        
        // UHPC has enhanced properties
        concrete.fct = 0.6 * fc.powf(0.5); // Higher tensile
        concrete.eps_cu1 = 0.004; // Higher ultimate strain
        
        concrete
    }
    
    /// Stress-strain (parabola-rectangle per EC2)
    pub fn stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            // Tension (simplified)
            if strain < self.fct / self.ecm {
                strain * self.ecm
            } else {
                0.0
            }
        } else {
            let eps = -strain;
            if eps <= self.eps_c1 {
                // Parabolic part
                let k = 1.05 * self.ecm * self.eps_c1 / self.fcm;
                let eta = eps / self.eps_c1;
                -self.fcm * (k * eta - eta * eta) / (1.0 + (k - 2.0) * eta)
            } else if eps <= self.eps_cu1 {
                // Constant part (simplified)
                -self.fcm
            } else {
                0.0
            }
        }
    }
    
    /// Design compressive strength
    pub fn fcd(&self, gamma_c: f64) -> f64 {
        0.85 * self.fc / gamma_c
    }
    
    /// Creep coefficient (simplified)
    pub fn creep_coefficient(&self, t: f64, t0: f64, h0: f64, rh: f64) -> f64 {
        // Simplified EC2 creep model
        let beta_fcm = 16.8 / self.fcm.sqrt();
        let phi_rh = 1.0 + (1.0 - rh / 100.0) / (0.1 * h0.powf(1.0 / 3.0));
        let beta_t0 = 1.0 / (0.1 + t0.powf(0.2));
        
        let phi_0 = phi_rh * beta_fcm * beta_t0;
        
        // Time development
        let beta_h = 1.5 * (1.0 + (0.012 * rh).powf(18.0)) * h0 + 250.0;
        let beta_c = ((t - t0) / (beta_h + t - t0)).powf(0.3);
        
        phi_0 * beta_c
    }
    
    /// Shrinkage strain (simplified)
    pub fn shrinkage_strain(&self, t: f64, ts: f64, h0: f64, rh: f64) -> f64 {
        // Drying shrinkage
        let eps_cd_0 = 0.85 * ((220.0 + 110.0 * 1.0) * (-0.04 * self.fcm.powf(0.5)).exp()) * 1e-6;
        let beta_rh = 1.55 * (1.0 - (rh / 100.0).powf(3.0));
        let eps_cd_inf = eps_cd_0 * beta_rh;
        
        let kh = match h0 as i32 {
            0..=100 => 1.0,
            101..=200 => 0.85,
            201..=300 => 0.75,
            _ => 0.70,
        };
        
        let beta_ds = (t - ts) / ((t - ts) + 0.04 * h0.powf(3.0).sqrt());
        
        eps_cd_inf * kh * beta_ds
    }
}

/// Steel grade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelGrade {
    /// Name
    pub name: String,
    /// Yield strength (MPa)
    pub fy: f64,
    /// Ultimate strength (MPa)
    pub fu: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Strain hardening modulus (MPa)
    pub esh: f64,
    /// Yield strain
    pub eps_y: f64,
    /// Ultimate strain
    pub eps_u: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Steel type
    pub steel_type: SteelType,
    /// Weldability
    pub weldable: bool,
}

/// Steel type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SteelType {
    Structural,
    Rebar,
    Prestressing,
    ColdFormed,
    Stainless,
}

impl SteelGrade {
    /// Create structural steel
    pub fn structural(name: &str, fy: f64) -> Self {
        Self {
            name: name.to_string(),
            fy,
            fu: fy * 1.25,
            e: 210000.0,
            esh: 2100.0,
            eps_y: fy / 210000.0,
            eps_u: 0.15,
            density: 7850.0,
            nu: 0.3,
            steel_type: SteelType::Structural,
            weldable: true,
        }
    }
    
    /// Create reinforcing steel
    pub fn rebar(name: &str, fy: f64) -> Self {
        Self {
            name: name.to_string(),
            fy,
            fu: fy * 1.15,
            e: 200000.0,
            esh: 2000.0,
            eps_y: fy / 200000.0,
            eps_u: 0.10,
            density: 7850.0,
            nu: 0.3,
            steel_type: SteelType::Rebar,
            weldable: true,
        }
    }
    
    /// Create prestressing steel
    pub fn prestressing(name: &str, fpu: f64) -> Self {
        Self {
            name: name.to_string(),
            fy: 0.85 * fpu,
            fu: fpu,
            e: 195000.0,
            esh: 1950.0,
            eps_y: 0.01,
            eps_u: 0.035,
            density: 7850.0,
            nu: 0.3,
            steel_type: SteelType::Prestressing,
            weldable: false,
        }
    }
    
    /// Stress-strain (bilinear with hardening)
    pub fn stress(&self, strain: f64) -> f64 {
        let eps = strain.abs();
        let sign = strain.signum();
        
        if eps <= self.eps_y {
            sign * eps * self.e
        } else if eps <= self.eps_u {
            sign * (self.fy + self.esh * (eps - self.eps_y))
        } else {
            0.0 // Fracture
        }
    }
    
    /// Design yield strength
    pub fn fyd(&self, gamma_m: f64) -> f64 {
        self.fy / gamma_m
    }
    
    /// Relaxation loss (prestressing)
    pub fn relaxation_loss(&self, sigma_pi: f64, t: f64) -> f64 {
        if self.steel_type != SteelType::Prestressing {
            return 0.0;
        }
        
        let mu = sigma_pi / self.fu;
        let rho_1000 = 2.5; // Class 2 relaxation
        
        // EC2 relaxation formula
        let factor = 0.66 * rho_1000 * (t / 1000.0).powf(0.75 * (1.0 - mu)) * 
                     E.powf(9.1 * mu) * 1e-5;
        
        sigma_pi * factor
    }
}

/// Timber grade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimberGrade {
    /// Name
    pub name: String,
    /// Bending strength (MPa)
    pub fm_k: f64,
    /// Tension parallel (MPa)
    pub ft_0_k: f64,
    /// Tension perpendicular (MPa)
    pub ft_90_k: f64,
    /// Compression parallel (MPa)
    pub fc_0_k: f64,
    /// Compression perpendicular (MPa)
    pub fc_90_k: f64,
    /// Shear strength (MPa)
    pub fv_k: f64,
    /// Elastic modulus parallel (MPa)
    pub e_0_mean: f64,
    /// Elastic modulus 5th percentile (MPa)
    pub e_0_05: f64,
    /// Shear modulus (MPa)
    pub g_mean: f64,
    /// Density (kg/m³)
    pub rho_k: f64,
    /// Mean density (kg/m³)
    pub rho_mean: f64,
    /// Timber type
    pub timber_type: TimberType,
    /// Service class
    pub service_class: ServiceClass,
}

/// Timber type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TimberType {
    SolidSoftwood,
    SolidHardwood,
    Glulam,
    LVL,
    CLT,
    Plywood,
}

/// Service class per EC5
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ServiceClass {
    SC1, // Indoor, heated
    SC2, // Covered, unheated
    SC3, // Exposed
}

impl TimberGrade {
    /// Create softwood grade
    pub fn softwood(name: &str, fm_k: f64) -> Self {
        // Properties based on EN 338
        let class_factor = fm_k / 24.0;
        
        Self {
            name: name.to_string(),
            fm_k,
            ft_0_k: 0.6 * fm_k,
            ft_90_k: 0.4,
            fc_0_k: 0.8 * fm_k + 4.0,
            fc_90_k: 2.5,
            fv_k: 4.0,
            e_0_mean: (7000.0 + 500.0 * fm_k).min(12000.0),
            e_0_05: (5600.0 + 400.0 * fm_k).min(9600.0),
            g_mean: 630.0,
            rho_k: 320.0 + 10.0 * class_factor,
            rho_mean: 400.0 + 12.0 * class_factor,
            timber_type: TimberType::SolidSoftwood,
            service_class: ServiceClass::SC1,
        }
    }
    
    /// Create hardwood grade
    pub fn hardwood(name: &str, fm_k: f64) -> Self {
        Self {
            name: name.to_string(),
            fm_k,
            ft_0_k: 0.6 * fm_k,
            ft_90_k: 0.6,
            fc_0_k: 0.75 * fm_k + 6.0,
            fc_90_k: 5.0,
            fv_k: 4.0,
            e_0_mean: 10000.0 + 200.0 * fm_k,
            e_0_05: 8000.0 + 160.0 * fm_k,
            g_mean: 750.0,
            rho_k: 500.0 + 5.0 * fm_k,
            rho_mean: 600.0 + 6.0 * fm_k,
            timber_type: TimberType::SolidHardwood,
            service_class: ServiceClass::SC1,
        }
    }
    
    /// Create glulam grade
    pub fn glulam(name: &str, fm_k: f64) -> Self {
        Self {
            name: name.to_string(),
            fm_k,
            ft_0_k: 0.65 * fm_k,
            ft_90_k: 0.5,
            fc_0_k: 0.8 * fm_k + 6.0,
            fc_90_k: 3.0,
            fv_k: 3.5,
            e_0_mean: (9400.0 + 350.0 * fm_k).min(14500.0),
            e_0_05: (7800.0 + 280.0 * fm_k).min(12000.0),
            g_mean: 720.0,
            rho_k: 380.0,
            rho_mean: 430.0,
            timber_type: TimberType::Glulam,
            service_class: ServiceClass::SC1,
        }
    }
    
    /// Get modification factor kmod
    pub fn kmod(&self, load_duration: LoadDuration) -> f64 {
        match (self.service_class, load_duration) {
            (ServiceClass::SC1, LoadDuration::Permanent) => 0.60,
            (ServiceClass::SC1, LoadDuration::LongTerm) => 0.70,
            (ServiceClass::SC1, LoadDuration::MediumTerm) => 0.80,
            (ServiceClass::SC1, LoadDuration::ShortTerm) => 0.90,
            (ServiceClass::SC1, LoadDuration::Instantaneous) => 1.10,
            (ServiceClass::SC2, LoadDuration::Permanent) => 0.60,
            (ServiceClass::SC2, LoadDuration::LongTerm) => 0.70,
            (ServiceClass::SC2, LoadDuration::MediumTerm) => 0.80,
            (ServiceClass::SC2, LoadDuration::ShortTerm) => 0.90,
            (ServiceClass::SC2, LoadDuration::Instantaneous) => 1.10,
            (ServiceClass::SC3, LoadDuration::Permanent) => 0.50,
            (ServiceClass::SC3, LoadDuration::LongTerm) => 0.55,
            (ServiceClass::SC3, LoadDuration::MediumTerm) => 0.65,
            (ServiceClass::SC3, LoadDuration::ShortTerm) => 0.70,
            (ServiceClass::SC3, LoadDuration::Instantaneous) => 0.90,
        }
    }
    
    /// Get deformation factor kdef
    pub fn kdef(&self) -> f64 {
        match (self.timber_type, self.service_class) {
            (TimberType::SolidSoftwood | TimberType::SolidHardwood, ServiceClass::SC1) => 0.60,
            (TimberType::SolidSoftwood | TimberType::SolidHardwood, ServiceClass::SC2) => 0.80,
            (TimberType::SolidSoftwood | TimberType::SolidHardwood, ServiceClass::SC3) => 2.00,
            (TimberType::Glulam | TimberType::LVL, ServiceClass::SC1) => 0.60,
            (TimberType::Glulam | TimberType::LVL, ServiceClass::SC2) => 0.80,
            (TimberType::Glulam | TimberType::LVL, ServiceClass::SC3) => 2.00,
            _ => 0.80,
        }
    }
    
    /// Design strength
    pub fn design_strength(&self, fk: f64, load_duration: LoadDuration, gamma_m: f64) -> f64 {
        self.kmod(load_duration) * fk / gamma_m
    }
}

/// Load duration class
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadDuration {
    Permanent,
    LongTerm,
    MediumTerm,
    ShortTerm,
    Instantaneous,
}

/// Masonry type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasonryType {
    /// Name
    pub name: String,
    /// Unit compressive strength (MPa)
    pub fb: f64,
    /// Mortar compressive strength (MPa)
    pub fm: f64,
    /// Masonry compressive strength (MPa)
    pub fk: f64,
    /// Flexural strength parallel (MPa)
    pub fxk1: f64,
    /// Flexural strength perpendicular (MPa)
    pub fxk2: f64,
    /// Shear strength (MPa)
    pub fvk0: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Shear modulus (MPa)
    pub g: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Unit type
    pub unit_type: MasonryUnitType,
}

/// Masonry unit type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum MasonryUnitType {
    ClayBrick,
    ConcreteBlock,
    AACBlock,
    CalciumSilicate,
    Stone,
}

impl MasonryType {
    /// Create clay brick masonry
    pub fn clay_brick(fb: f64) -> Self {
        let fm: f64 = 5.0; // M5 mortar
        let k: f64 = 0.55;
        let alpha: f64 = 0.7;
        let beta: f64 = 0.3;
        let fk = k * fb.powf(alpha) * fm.powf(beta);
        
        Self {
            name: format!("Clay fb={}", fb),
            fb,
            fm,
            fk,
            fxk1: 0.1,
            fxk2: 0.4,
            fvk0: 0.3,
            e: 1000.0 * fk,
            g: 400.0 * fk,
            density: 1800.0,
            unit_type: MasonryUnitType::ClayBrick,
        }
    }
    
    /// Create concrete block masonry
    pub fn concrete_block(fb: f64) -> Self {
        let fm: f64 = 5.0;
        let k: f64 = 0.55;
        let fk = k * fb.powf(0.65) * fm.powf(0.25);
        
        Self {
            name: format!("Concrete fb={}", fb),
            fb,
            fm,
            fk,
            fxk1: 0.05,
            fxk2: 0.2,
            fvk0: 0.2,
            e: 1000.0 * fk,
            g: 400.0 * fk,
            density: 2000.0,
            unit_type: MasonryUnitType::ConcreteBlock,
        }
    }
    
    /// Create AAC block masonry
    pub fn aac_block(fb: f64) -> Self {
        let fm = 2.5; // Thin layer mortar
        let fk = 0.80 * fb.powf(0.85);
        
        Self {
            name: format!("AAC fb={}", fb),
            fb,
            fm,
            fk,
            fxk1: 0.05,
            fxk2: 0.15,
            fvk0: 0.15,
            e: 500.0 * fk,
            g: 200.0 * fk,
            density: 600.0,
            unit_type: MasonryUnitType::AACBlock,
        }
    }
    
    /// Design compressive strength
    pub fn fd(&self, gamma_m: f64) -> f64 {
        self.fk / gamma_m
    }
}

/// Aluminum alloy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AluminumAlloy {
    /// Designation
    pub name: String,
    /// 0.2% proof stress (MPa)
    pub f0: f64,
    /// Ultimate strength (MPa)
    pub fu: f64,
    /// Elastic modulus (MPa)
    pub e: f64,
    /// Shear modulus (MPa)
    pub g: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Thermal expansion (1/°C)
    pub alpha: f64,
    /// Alloy series
    pub series: AluminumSeries,
    /// Temper
    pub temper: String,
}

/// Aluminum series
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AluminumSeries {
    Series1000, // Pure aluminum
    Series3000, // Al-Mn
    Series5000, // Al-Mg
    Series6000, // Al-Mg-Si
    Series7000, // Al-Zn
}

impl AluminumAlloy {
    /// 6061-T6 alloy
    pub fn alloy_6061_t6() -> Self {
        Self {
            name: "6061-T6".to_string(),
            f0: 240.0,
            fu: 290.0,
            e: 70000.0,
            g: 26000.0,
            density: 2700.0,
            alpha: 23.0e-6,
            series: AluminumSeries::Series6000,
            temper: "T6".to_string(),
        }
    }
    
    /// 6063-T6 alloy
    pub fn alloy_6063_t6() -> Self {
        Self {
            name: "6063-T6".to_string(),
            f0: 160.0,
            fu: 195.0,
            e: 70000.0,
            g: 26000.0,
            density: 2700.0,
            alpha: 23.0e-6,
            series: AluminumSeries::Series6000,
            temper: "T6".to_string(),
        }
    }
    
    /// Buckling class
    pub fn buckling_class(&self) -> &str {
        match self.series {
            AluminumSeries::Series6000 => "A",
            AluminumSeries::Series5000 => "A",
            AluminumSeries::Series7000 => "B",
            _ => "B",
        }
    }
    
    /// HAZ softening factor
    pub fn haz_factor(&self) -> f64 {
        match self.series {
            AluminumSeries::Series6000 => 0.65,
            AluminumSeries::Series5000 => 0.80,
            AluminumSeries::Series7000 => 0.60,
            _ => 0.70,
        }
    }
}

/// FRP material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FRPMaterial {
    /// Name
    pub name: String,
    /// Tensile strength (MPa)
    pub ffu: f64,
    /// Design tensile strength (MPa)
    pub ffd: f64,
    /// Elastic modulus (MPa)
    pub ef: f64,
    /// Ultimate strain
    pub eps_fu: f64,
    /// Density (kg/m³)
    pub density: f64,
    /// Fiber type
    pub fiber_type: FiberType,
    /// Environmental reduction factor
    pub ce: f64,
}

/// Fiber type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FiberType {
    Glass,
    Carbon,
    Aramid,
    Basalt,
}

impl FRPMaterial {
    /// GFRP rebar
    pub fn gfrp_rebar() -> Self {
        Self {
            name: "GFRP Rebar".to_string(),
            ffu: 800.0,
            ffd: 500.0,
            ef: 50000.0,
            eps_fu: 0.016,
            density: 2100.0,
            fiber_type: FiberType::Glass,
            ce: 0.80,
        }
    }
    
    /// CFRP strip
    pub fn cfrp_strip() -> Self {
        Self {
            name: "CFRP Strip".to_string(),
            ffu: 2800.0,
            ffd: 1900.0,
            ef: 165000.0,
            eps_fu: 0.017,
            density: 1600.0,
            fiber_type: FiberType::Carbon,
            ce: 0.95,
        }
    }
    
    /// Design tensile strain
    pub fn eps_fd(&self) -> f64 {
        self.ffd / self.ef
    }
    
    /// Creep rupture limit
    pub fn creep_limit(&self) -> f64 {
        match self.fiber_type {
            FiberType::Carbon => 0.55 * self.ffu,
            FiberType::Glass => 0.20 * self.ffu,
            FiberType::Aramid => 0.30 * self.ffu,
            FiberType::Basalt => 0.25 * self.ffu,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_material_database() {
        let db = MaterialDatabase::standard();
        
        assert!(!db.concretes.is_empty());
        assert!(!db.steels.is_empty());
        assert!(!db.timbers.is_empty());
    }
    
    #[test]
    fn test_concrete_grade() {
        let concrete = ConcreteGrade::new(30.0);
        
        assert_eq!(concrete.fc, 30.0);
        assert!(concrete.ecm > 25000.0);
        assert!(concrete.fct > 2.0);
    }
    
    #[test]
    fn test_concrete_stress() {
        let concrete = ConcreteGrade::new(30.0);
        
        let stress = concrete.stress(-0.002);
        assert!(stress < 0.0);
        assert!(stress.abs() > 25.0);
    }
    
    #[test]
    fn test_concrete_creep() {
        let concrete = ConcreteGrade::new(30.0);
        
        let phi = concrete.creep_coefficient(365.0, 28.0, 200.0, 70.0);
        assert!(phi > 0.0 && phi < 5.0);
    }
    
    #[test]
    fn test_steel_structural() {
        let steel = SteelGrade::structural("S355", 355.0);
        
        assert_eq!(steel.fy, 355.0);
        assert_eq!(steel.e, 210000.0);
    }
    
    #[test]
    fn test_steel_stress() {
        let steel = SteelGrade::rebar("B500", 500.0);
        
        let elastic = steel.stress(0.001);
        assert!((elastic - 200.0).abs() < 1.0);
        
        let yield_stress = steel.stress(0.01);
        assert!(yield_stress >= 500.0);
    }
    
    #[test]
    fn test_timber_softwood() {
        let timber = TimberGrade::softwood("C24", 24.0);
        
        assert_eq!(timber.fm_k, 24.0);
        assert!(timber.e_0_mean > 10000.0);
    }
    
    #[test]
    fn test_timber_kmod() {
        let timber = TimberGrade::softwood("C24", 24.0);
        
        let kmod = timber.kmod(LoadDuration::Permanent);
        assert!((kmod - 0.6).abs() < 0.01);
    }
    
    #[test]
    fn test_masonry_clay() {
        let masonry = MasonryType::clay_brick(10.0);
        
        assert!(masonry.fk > 0.0);
        assert!(masonry.e > 0.0);
    }
    
    #[test]
    fn test_aluminum_6061() {
        let al = AluminumAlloy::alloy_6061_t6();
        
        assert_eq!(al.f0, 240.0);
        assert_eq!(al.e, 70000.0);
    }
    
    #[test]
    fn test_frp_gfrp() {
        let gfrp = FRPMaterial::gfrp_rebar();
        
        assert!(gfrp.ffu > gfrp.ffd);
        assert_eq!(gfrp.fiber_type, FiberType::Glass);
    }
    
    #[test]
    fn test_frp_cfrp() {
        let cfrp = FRPMaterial::cfrp_strip();
        
        assert!(cfrp.ef > 150000.0);
        assert_eq!(cfrp.fiber_type, FiberType::Carbon);
    }
    
    #[test]
    fn test_get_concrete() {
        let db = MaterialDatabase::standard();
        
        let c30 = db.get_concrete(30.0);
        assert!(c30.is_some());
    }
    
    #[test]
    fn test_get_steel() {
        let db = MaterialDatabase::standard();
        
        let s355 = db.get_steel("S355");
        assert!(s355.is_some());
    }
    
    #[test]
    fn test_lightweight_concrete() {
        let lwc = ConcreteGrade::lightweight(30.0, 1800.0);
        
        assert_eq!(lwc.concrete_type, ConcreteType::Lightweight);
        assert!(lwc.ecm < ConcreteGrade::new(30.0).ecm);
    }
    
    #[test]
    fn test_uhpc() {
        let uhpc = ConcreteGrade::uhpc(120.0);
        
        assert_eq!(uhpc.concrete_type, ConcreteType::UHPC);
    }
    
    #[test]
    fn test_exposure_classes() {
        assert_ne!(ExposureClass::XC1, ExposureClass::XD1);
    }
    
    #[test]
    fn test_load_durations() {
        assert_ne!(LoadDuration::Permanent, LoadDuration::ShortTerm);
    }
}
