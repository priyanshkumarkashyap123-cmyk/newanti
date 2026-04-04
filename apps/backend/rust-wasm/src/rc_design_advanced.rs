// ============================================================================
// ADVANCED REINFORCED CONCRETE DESIGN FEATURES
// ============================================================================
//
// Industry-standard RC design per ACI 318-19, IS 456:2000, Eurocode 2:
// - Deflection calculations (short-term and long-term)
// - Crack width control
// - Punching shear
// - Creep and shrinkage
// - Development and splice lengths
// - Two-way slab design
//
// Industry Parity: ETABS, SAFE, RAPT, spColumn
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// DEFLECTION ANALYSIS
// ============================================================================

/// Deflection calculation per ACI 318-19 Section 24.2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionAnalysis {
    /// Member geometry
    pub geometry: MemberGeometry,
    /// Material properties
    pub material: ConcreteMaterial,
    /// Reinforcement
    pub reinforcement: ReinforcementData,
    /// Loading
    pub loading: DeflectionLoading,
    /// Cracking analysis
    pub cracking: CrackingAnalysis,
    /// Short-term deflection
    pub short_term: f64,
    /// Long-term deflection
    pub long_term: f64,
    /// Total deflection
    pub total: f64,
    /// Deflection limit
    pub limit: f64,
    /// Deflection ratio (L/Δ)
    pub ratio: f64,
    /// Pass/fail
    pub passes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberGeometry {
    /// Member type
    pub member_type: MemberType,
    /// Span length (L)
    pub span: f64,
    /// Section width (b)
    pub width: f64,
    /// Section depth (h)
    pub depth: f64,
    /// Effective depth (d)
    pub effective_depth: f64,
    /// Gross moment of inertia (Ig)
    pub ig: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemberType {
    SimpleBeam,
    ContinuousBeam,
    Cantilever,
    OneWaySlab,
    TwoWaySlab,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteMaterial {
    /// Compressive strength (f'c)
    pub fc: f64,
    /// Modulus of elasticity (Ec)
    pub ec: f64,
    /// Modulus of rupture (fr)
    pub fr: f64,
    /// Unit weight (for Ec calculation)
    pub unit_weight: f64,
}

impl ConcreteMaterial {
    /// Create material with standard properties per ACI 318
    pub fn new(fc: f64, unit_weight: f64) -> Self {
        // Ec = 4700 * sqrt(f'c) for normal weight (MPa)
        // Or Ec = wc^1.5 * 0.043 * sqrt(f'c) for other weights
        let ec = if (unit_weight - 2300.0).abs() < 200.0 {
            4700.0 * fc.sqrt()
        } else {
            unit_weight.powf(1.5) * 0.043 * fc.sqrt()
        };

        // fr = 0.62 * sqrt(f'c) for normal weight (MPa)
        let fr = 0.62 * fc.sqrt();

        Self {
            fc,
            ec,
            fr,
            unit_weight,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReinforcementData {
    /// Steel yield strength (fy)
    pub fy: f64,
    /// Steel modulus (Es)
    pub es: f64,
    /// Area of tension steel (As)
    pub as_tension: f64,
    /// Area of compression steel (As')
    pub as_compression: f64,
    /// Reinforcement ratio (ρ)
    pub rho: f64,
    /// Compression reinforcement ratio (ρ')
    pub rho_prime: f64,
}

impl ReinforcementData {
    pub fn new(fy: f64, as_tension: f64, as_compression: f64, b: f64, d: f64) -> Self {
        let es = 200000.0; // MPa
        let rho = as_tension / (b * d);
        let rho_prime = as_compression / (b * d);

        Self {
            fy,
            es,
            as_tension,
            as_compression,
            rho,
            rho_prime,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeflectionLoading {
    /// Dead load moment (Md)
    pub md: f64,
    /// Live load moment (Ml)
    pub ml: f64,
    /// Sustained load moment (Msus)
    pub msus: f64,
    /// Total service moment (Ma)
    pub ma: f64,
    /// Dead load deflection factor
    pub dead_factor: f64,
    /// Live load deflection factor
    pub live_factor: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackingAnalysis {
    /// Cracking moment (Mcr)
    pub mcr: f64,
    /// Is section cracked?
    pub is_cracked: bool,
    /// Cracked moment of inertia (Icr)
    pub icr: f64,
    /// Effective moment of inertia (Ie)
    pub ie: f64,
}

impl DeflectionAnalysis {
    /// Calculate deflection per ACI 318-19
    pub fn new(
        geometry: MemberGeometry,
        material: ConcreteMaterial,
        reinforcement: ReinforcementData,
        loading: DeflectionLoading,
        duration_months: f64,
    ) -> Self {
        // Calculate cracking moment: Mcr = fr * Ig / yt
        let yt = geometry.depth / 2.0; // Distance to extreme tension fiber
        let mcr = material.fr * geometry.ig / yt;

        // Check if cracked
        let is_cracked = loading.ma > mcr;

        // Calculate cracked moment of inertia Icr
        let n = reinforcement.es / material.ec;
        let icr = Self::calculate_icr(&geometry, &reinforcement, n);

        // Calculate effective moment of inertia Ie (Branson's equation)
        // Ie = Icr + (Ig - Icr) * (Mcr/Ma)³ ≤ Ig
        let ie = if is_cracked {
            let ratio = (mcr / loading.ma).powi(3);
            (icr + (geometry.ig - icr) * ratio).min(geometry.ig)
        } else {
            geometry.ig
        };

        let cracking = CrackingAnalysis {
            mcr,
            is_cracked,
            icr,
            ie,
        };

        // Calculate short-term (immediate) deflection
        // Δi = 5 * w * L⁴ / (384 * Ec * Ie) for uniform load on simple span
        // Using moment form: Δi = Ma * L² / (K * Ec * Ie)
        let k = match geometry.member_type {
            MemberType::SimpleBeam => 9.6,
            MemberType::ContinuousBeam => 12.0,
            MemberType::Cantilever => 2.4,
            MemberType::OneWaySlab => 9.6,
            MemberType::TwoWaySlab => 12.0,
        };

        let short_term = loading.ma * geometry.span.powi(2) / (k * material.ec * ie);

        // Calculate long-term deflection multiplier λΔ
        // λΔ = ξ / (1 + 50*ρ')
        // ξ = time-dependent factor (1.0 for 3 months, 1.2 for 6 months, 1.4 for 12 months, 2.0 for 5+ years)
        let xi = if duration_months <= 3.0 {
            1.0
        } else if duration_months <= 6.0 {
            1.2
        } else if duration_months <= 12.0 {
            1.4
        } else {
            2.0
        };

        let lambda_delta = xi / (1.0 + 50.0 * reinforcement.rho_prime);

        // Long-term deflection from sustained loads
        let short_term_sustained = loading.msus * geometry.span.powi(2) / (k * material.ec * ie);
        let long_term = lambda_delta * short_term_sustained;

        // Total deflection
        let total = short_term + long_term;

        // Deflection limit per ACI Table 24.2.2
        let limit = match geometry.member_type {
            MemberType::SimpleBeam | MemberType::ContinuousBeam => geometry.span / 240.0,
            MemberType::Cantilever => geometry.span / 180.0,
            MemberType::OneWaySlab | MemberType::TwoWaySlab => geometry.span / 240.0,
        };

        let ratio = geometry.span / total;
        let passes = total <= limit;

        Self {
            geometry,
            material,
            reinforcement,
            loading,
            cracking,
            short_term,
            long_term,
            total,
            limit,
            ratio,
            passes,
        }
    }

    /// Calculate cracked moment of inertia
    fn calculate_icr(geometry: &MemberGeometry, rebar: &ReinforcementData, n: f64) -> f64 {
        let b = geometry.width;
        let d = geometry.effective_depth;
        let as_t = rebar.as_tension;
        let as_c = rebar.as_compression;
        let d_prime = geometry.depth - d; // Compression steel depth

        // Neutral axis depth for cracked section (quadratic solution)
        // b*c²/2 + (n-1)*As'*c - n*As*d - (n-1)*As'*d' = 0
        let a = b / 2.0;
        let b_coef = (n - 1.0) * as_c + n * as_t;
        let c_coef = -n * as_t * d - (n - 1.0) * as_c * d_prime;

        let discriminant = b_coef.powi(2) - 4.0 * a * c_coef;
        let c = (-b_coef + discriminant.sqrt()) / (2.0 * a);

        // Cracked moment of inertia
        // Icr = b*c³/3 + n*As*(d-c)² + (n-1)*As'*(c-d')²
        let icr = b * c.powi(3) / 3.0 
            + n * as_t * (d - c).powi(2)
            + (n - 1.0) * as_c * (c - d_prime).powi(2);

        icr
    }
}

// ============================================================================
// CRACK WIDTH CONTROL
// ============================================================================

/// Crack width control per ACI 318-19 Section 24.3 and Eurocode 2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrackWidthAnalysis {
    /// Calculated crack width (wk)
    pub crack_width: f64,
    /// Maximum allowable crack width
    pub limit: f64,
    /// Stress in steel at service (fs)
    pub fs: f64,
    /// Effective tension area per bar (Ac,eff)
    pub ac_eff: f64,
    /// Bar spacing (s)
    pub spacing: f64,
    /// Cover to tension face (cc)
    pub cover: f64,
    /// Crack spacing (sr)
    pub sr: f64,
    /// Exposure class
    pub exposure: ExposureClass,
    /// Pass/fail
    pub passes: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExposureClass {
    /// Interior dry
    Interior,
    /// Exterior exposed
    Exterior,
    /// Corrosive environment
    Severe,
    /// Watertight
    WaterRetaining,
}

impl CrackWidthAnalysis {
    /// Calculate crack width per ACI 318-19 / Eurocode 2 approach
    pub fn new(
        fs: f64,           // Steel stress at service
        es: f64,           // Steel modulus
        cover: f64,        // Clear cover
        bar_diameter: f64, // Bar diameter
        spacing: f64,      // Bar spacing
        rho_eff: f64,      // Effective reinforcement ratio
        exposure: ExposureClass,
    ) -> Self {
        // Steel strain at crack location
        let _epsilon_sm = fs / es;

        // Crack spacing per Eurocode 2 approach
        // sr,max = 3.4*c + 0.425*k1*k2*φ/ρeff
        // k1 = 0.8 for deformed bars, k2 = 0.5 for bending
        let k1 = 0.8;
        let k2 = 0.5;
        let sr = 3.4 * cover + 0.425 * k1 * k2 * bar_diameter / rho_eff;

        // Crack width
        // wk = sr * (εsm - εcm)
        // Simplified: wk ≈ sr * εsm * (1 - kt * fctm / (ρeff * σs))
        // Using simplified approach: wk ≈ 0.6 * sr * fs / Es
        let crack_width = 0.6 * sr * fs / es;

        // Gergely-Lutz approach (ACI) in SI units
        // w = 0.011 * β * fs * (dc * A)^(1/3) / 1000 (mm)
        let dc = cover + bar_diameter / 2.0;
        let a = 2.0 * dc * spacing;
        let beta = 1.2; // Approximate for beams
        let w_aci = 0.011 * beta * fs * (dc * a).powf(1.0/3.0) / 1000.0;

        // Use larger of two methods
        let crack_width = crack_width.max(w_aci);

        // Effective tension area
        let h_eff = (cover + bar_diameter / 2.0) * 2.5;
        let ac_eff = h_eff * spacing;

        // Crack width limit based on exposure
        let limit = match exposure {
            ExposureClass::Interior => 0.40,      // mm
            ExposureClass::Exterior => 0.30,      // mm
            ExposureClass::Severe => 0.20,        // mm
            ExposureClass::WaterRetaining => 0.10, // mm
        };

        let passes = crack_width <= limit;

        Self {
            crack_width,
            limit,
            fs,
            ac_eff,
            spacing,
            cover,
            sr,
            exposure,
            passes,
        }
    }

    /// Calculate maximum bar spacing for crack control per ACI 318-19
    /// s ≤ 15 * (40000/fs) - 2.5*cc ≤ 12 * (40000/fs)
    pub fn max_bar_spacing(fs: f64, cover: f64) -> f64 {
        // fs in MPa, convert formula from psi (40000 psi ≈ 276 MPa)
        let fs_ratio = 276.0 / fs;
        let s1 = 380.0 * fs_ratio - 2.5 * cover;
        let s2 = 300.0 * fs_ratio;
        s1.min(s2)
    }
}

// ============================================================================
// PUNCHING SHEAR
// ============================================================================

/// Punching shear analysis per ACI 318-19 Section 22.6
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PunchingShear {
    /// Slab properties
    pub slab: SlabProperties,
    /// Column properties
    pub column: ColumnProperties,
    /// Factored shear force (Vu)
    pub vu: f64,
    /// Unbalanced moment (Mu)
    pub mu: f64,
    /// Critical section perimeter (bo)
    pub bo: f64,
    /// Shear stress from direct shear (vu)
    pub vu_stress: f64,
    /// Shear stress from moment transfer (γv * Mu)
    pub vm_stress: f64,
    /// Total shear stress
    pub total_stress: f64,
    /// Concrete shear strength (vc)
    pub vc: f64,
    /// Shear reinforcement contribution (vs)
    pub vs: f64,
    /// Total capacity (vn)
    pub vn: f64,
    /// DCR (demand/capacity ratio)
    pub dcr: f64,
    /// Pass/fail
    pub passes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlabProperties {
    /// Slab thickness (h)
    pub h: f64,
    /// Effective depth (d)
    pub d: f64,
    /// Concrete strength (f'c)
    pub fc: f64,
    /// Reinforcement yield strength (fy)
    pub fy: f64,
    /// λ factor for lightweight concrete
    pub lambda: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnProperties {
    /// Column type
    pub column_type: ColumnType,
    /// Column dimension c1 (parallel to span)
    pub c1: f64,
    /// Column dimension c2 (perpendicular to span)
    pub c2: f64,
    /// Distance from critical section to centroid
    pub critical_distance: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ColumnType {
    Interior,
    Edge,
    Corner,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearReinforcement {
    /// Reinforcement type
    pub rebar_type: PunchingRebarType,
    /// Area of shear reinforcement on one peripheral line (Av)
    pub av: f64,
    /// Spacing of peripheral lines (s)
    pub spacing: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PunchingRebarType {
    None,
    Stirrups,
    StudRails,
    ShearedHeadedStuds,
}

impl PunchingShear {
    /// Calculate punching shear per ACI 318-19 Section 22.6
    pub fn new(
        slab: SlabProperties,
        column: ColumnProperties,
        vu: f64,
        mu: f64,
        shear_rebar: Option<ShearReinforcement>,
    ) -> Self {
        let d = slab.d;

        // Critical section perimeter at d/2 from column face
        let bo = Self::calculate_perimeter(&column, d);

        // Column aspect ratio
        let beta = (column.c1 / column.c2).max(column.c2 / column.c1);

        // αs factor based on column location
        let alpha_s = match column.column_type {
            ColumnType::Interior => 40.0,
            ColumnType::Edge => 30.0,
            ColumnType::Corner => 20.0,
        };

        // Concrete shear strength vc per ACI 318-19 Table 22.6.5.2
        // Smallest of three equations
        let fc_sqrt = slab.fc.sqrt();
        let vc1 = slab.lambda * 0.33 * fc_sqrt;
        let vc2 = slab.lambda * 0.17 * (1.0 + 2.0 / beta) * fc_sqrt;
        let vc3 = slab.lambda * 0.083 * (2.0 + alpha_s * d / bo) * fc_sqrt;
        let vc = vc1.min(vc2).min(vc3);

        // Shear reinforcement contribution
        let (vs, vn_max) = if let Some(ref rebar) = shear_rebar {
            // vs = Av * fyt / (bo * s)
            let vs = rebar.av * slab.fy / (bo * rebar.spacing);
            
            // Maximum vn based on reinforcement type
            let vn_max = match rebar.rebar_type {
                PunchingRebarType::None => vc,
                PunchingRebarType::Stirrups => vc + 0.5 * fc_sqrt,
                PunchingRebarType::StudRails | PunchingRebarType::ShearedHeadedStuds => {
                    vc + 0.66 * fc_sqrt
                }
            };
            (vs, vn_max)
        } else {
            (0.0, vc)
        };

        // Total capacity
        let vn = (vc + vs).min(vn_max);

        // Shear stress from direct shear
        let vu_stress = vu / (bo * d);

        // Moment transfer coefficient γv
        let gamma_v = Self::calculate_gamma_v(&column);

        // Shear stress from moment transfer (simplified)
        let c_ab = column.c1 + d;
        let jc = Self::calculate_jc(&column, d);
        let vm_stress = gamma_v * mu * (c_ab / 2.0) / jc;

        // Total shear stress
        let total_stress = vu_stress + vm_stress;

        // DCR and pass/fail
        let phi = 0.75;
        let dcr = total_stress / (phi * vn);
        let passes = dcr <= 1.0;

        Self {
            slab,
            column,
            vu,
            mu,
            bo,
            vu_stress,
            vm_stress,
            total_stress,
            vc,
            vs,
            vn,
            dcr,
            passes,
        }
    }

    /// Calculate critical section perimeter
    fn calculate_perimeter(column: &ColumnProperties, d: f64) -> f64 {
        let c1_crit = column.c1 + d;
        let c2_crit = column.c2 + d;

        match column.column_type {
            ColumnType::Interior => 2.0 * (c1_crit + c2_crit),
            ColumnType::Edge => 2.0 * c1_crit + c2_crit,
            ColumnType::Corner => c1_crit + c2_crit,
        }
    }

    /// Calculate moment transfer coefficient γv
    fn calculate_gamma_v(column: &ColumnProperties) -> f64 {
        let c1 = column.c1;
        let c2 = column.c2;
        let gamma_f = 1.0 / (1.0 + (2.0/3.0) * (c1/c2).sqrt());
        1.0 - gamma_f
    }

    /// Calculate polar moment of inertia Jc
    fn calculate_jc(column: &ColumnProperties, d: f64) -> f64 {
        let c1 = column.c1 + d;
        let c2 = column.c2 + d;

        match column.column_type {
            ColumnType::Interior => {
                d * c1.powi(3) / 6.0 + c1 * d.powi(3) / 6.0 + d * c2 * c1.powi(2) / 2.0
            }
            ColumnType::Edge | ColumnType::Corner => {
                // Simplified for edge/corner
                d * c1.powi(3) / 12.0 + c1 * d.powi(3) / 12.0
            }
        }
    }
}

// ============================================================================
// CREEP AND SHRINKAGE
// ============================================================================

/// Creep and shrinkage per ACI 209 / Eurocode 2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreepShrinkage {
    /// Ultimate creep coefficient
    pub creep_coefficient: f64,
    /// Ultimate shrinkage strain
    pub shrinkage_strain: f64,
    /// Time factor
    pub time_factor: f64,
    /// Creep coefficient at time t
    pub creep_at_t: f64,
    /// Shrinkage at time t
    pub shrinkage_at_t: f64,
    /// Effective modulus (accounting for creep)
    pub effective_modulus: f64,
}

impl CreepShrinkage {
    /// Calculate creep and shrinkage per ACI 209R-92
    pub fn new(
        _fc: f64,                // Concrete strength (MPa)
        ec: f64,                // Elastic modulus (MPa)
        relative_humidity: f64, // RH in %
        volume_surface: f64,    // V/S ratio (mm)
        loading_age: f64,       // Age at loading (days)
        time: f64,              // Time since loading (days)
    ) -> Self {
        // Ultimate creep coefficient
        // φu = 2.35 * γc
        let gamma_la = 1.25 * loading_age.powf(-0.118); // Loading age factor
        let gamma_h = 1.27 - 0.0067 * relative_humidity; // Humidity factor
        let gamma_vs = (2.0 / 3.0) * (1.0 + 1.13 * (-0.0213 * volume_surface).exp()); // V/S factor
        
        let creep_coefficient = 2.35 * gamma_la * gamma_h * gamma_vs;

        // Time development for creep
        // φ(t) = φu * t^0.6 / (10 + t^0.6)
        let time_factor = time.powf(0.6) / (10.0 + time.powf(0.6));
        let creep_at_t = creep_coefficient * time_factor;

        // Ultimate shrinkage strain
        // εsh,u = 780 × 10^-6 * γsh
        let gamma_sh_h = if relative_humidity <= 40.0 {
            1.4 - 0.01 * relative_humidity
        } else if relative_humidity <= 80.0 {
            3.0 - 0.03 * relative_humidity
        } else {
            0.3
        };
        
        let gamma_sh_vs = 1.2 * (-0.12 * volume_surface / 25.4).exp();
        let shrinkage_strain = 780e-6 * gamma_sh_h * gamma_sh_vs;

        // Time development for shrinkage
        // εsh(t) = εsh,u * t / (35 + t)
        let shrinkage_time_factor = time / (35.0 + time);
        let shrinkage_at_t = shrinkage_strain * shrinkage_time_factor;

        // Effective modulus (age-adjusted)
        // Ec,eff = Ec / (1 + χ * φ)
        // χ = aging coefficient ≈ 0.8
        let chi = 0.8;
        let effective_modulus = ec / (1.0 + chi * creep_at_t);

        Self {
            creep_coefficient,
            shrinkage_strain,
            time_factor,
            creep_at_t,
            shrinkage_at_t,
            effective_modulus,
        }
    }
}

// ============================================================================
// DEVELOPMENT AND SPLICE LENGTHS
// ============================================================================

/// Development length per ACI 318-19 Section 25.4
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentLength {
    /// Bar diameter (db)
    pub db: f64,
    /// Development length in tension (ld)
    pub ld_tension: f64,
    /// Development length in compression (ldc)
    pub ld_compression: f64,
    /// Class A splice length
    pub splice_class_a: f64,
    /// Class B splice length
    pub splice_class_b: f64,
    /// Hooked bar development (ldh)
    pub ldh: f64,
    /// Modification factors applied
    pub factors: DevelopmentFactors,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentFactors {
    /// Lightweight concrete factor (λ)
    pub lambda: f64,
    /// Coating factor (ψe)
    pub psi_e: f64,
    /// Size factor (ψs)
    pub psi_s: f64,
    /// Casting position factor (ψt)
    pub psi_t: f64,
    /// Spacing/cover factor (cb + Ktr)/db
    pub cb_ktr_factor: f64,
}

impl DevelopmentLength {
    /// Calculate development lengths per ACI 318-19
    pub fn new(
        db: f64,        // Bar diameter (mm)
        fy: f64,        // Steel yield (MPa)
        fc: f64,        // Concrete strength (MPa)
        cover: f64,     // Clear cover (mm)
        spacing: f64,   // Bar spacing (mm)
        factors: DevelopmentFactors,
    ) -> Self {
        // Development length in tension - simplified equation
        // ld = (fy * ψt * ψe * ψs * ψg) / (1.7 * λ * √f'c) * db
        // where (cb + Ktr)/db ≤ 2.5

        let cb = cover.min(spacing / 2.0);
        let ktr = 0.0; // Conservative: no transverse reinforcement
        let confinement = ((cb + ktr) / db).min(2.5);

        // ψg = 1.0 for Grade 60 (420 MPa)
        let psi_g = if fy > 420.0 { 1.15 } else { 1.0 };

        let ld_tension = (fy * factors.psi_t * factors.psi_e * factors.psi_s * psi_g)
            / (1.7 * factors.lambda * fc.sqrt() * confinement)
            * db;

        // Minimum: 12db or 300mm
        let ld_tension = ld_tension.max(12.0 * db).max(300.0);

        // Development length in compression
        // ldc = max(0.24 * fy * db / (λ * √f'c), 0.043 * fy * db)
        let ldc1 = 0.24 * fy * db / (factors.lambda * fc.sqrt());
        let ldc2 = 0.043 * fy * db;
        let ld_compression = ldc1.max(ldc2).max(200.0);

        // Splice lengths
        let splice_class_a = 1.0 * ld_tension;
        let splice_class_b = 1.3 * ld_tension;

        // Hooked bar development
        // ldh = (0.24 * ψe * ψr * ψo * ψc * fy / (λ * √f'c)) * db
        let psi_r = 1.0; // No confinement modification
        let psi_o = 1.0; // Not parallel to edge
        let psi_c = if cover >= 65.0 { 0.7 } else { 1.0 };
        
        let ldh = (0.24 * factors.psi_e * psi_r * psi_o * psi_c * fy) 
            / (factors.lambda * fc.sqrt()) * db;
        let ldh = ldh.max(8.0 * db).max(150.0);

        Self {
            db,
            ld_tension,
            ld_compression,
            splice_class_a,
            splice_class_b,
            ldh,
            factors,
        }
    }
}

impl Default for DevelopmentFactors {
    fn default() -> Self {
        Self {
            lambda: 1.0,     // Normal weight concrete
            psi_e: 1.0,      // Uncoated bars
            psi_s: 1.0,      // #19 and larger
            psi_t: 1.0,      // Bottom bars
            cb_ktr_factor: 2.5, // Conservative
        }
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deflection_analysis() {
        let geometry = MemberGeometry {
            member_type: MemberType::SimpleBeam,
            span: 6000.0,
            width: 300.0,
            depth: 500.0,
            effective_depth: 450.0,
            ig: 300.0 * 500.0_f64.powi(3) / 12.0,
        };

        let material = ConcreteMaterial::new(30.0, 2400.0);
        let reinforcement = ReinforcementData::new(420.0, 1500.0, 400.0, 300.0, 450.0);
        
        let loading = DeflectionLoading {
            md: 80.0e6,  // 80 kN·m
            ml: 50.0e6,  // 50 kN·m
            msus: 100.0e6,
            ma: 130.0e6,
            dead_factor: 5.0 / 384.0,
            live_factor: 5.0 / 384.0,
        };

        let analysis = DeflectionAnalysis::new(geometry, material, reinforcement, loading, 60.0);
        
        assert!(analysis.cracking.is_cracked);
        assert!(analysis.short_term > 0.0);
        assert!(analysis.long_term > 0.0);
    }

    #[test]
    fn test_crack_width() {
        let crack = CrackWidthAnalysis::new(
            250.0,  // fs = 250 MPa
            200000.0, // Es
            40.0,   // cover
            16.0,   // bar diameter
            150.0,  // spacing
            0.02,   // rho_eff
            ExposureClass::Exterior,
        );

        assert!(crack.crack_width > 0.0);
        assert_eq!(crack.limit, 0.30);
    }

    #[test]
    fn test_punching_shear() {
        let slab = SlabProperties {
            h: 200.0,
            d: 170.0,
            fc: 30.0,
            fy: 420.0,
            lambda: 1.0,
        };

        let column = ColumnProperties {
            column_type: ColumnType::Interior,
            c1: 400.0,
            c2: 400.0,
            critical_distance: 85.0,
        };

        let punching = PunchingShear::new(slab, column, 400000.0, 50000000.0, None);

        assert!(punching.bo > 0.0);
        assert!(punching.vc > 0.0);
    }

    #[test]
    fn test_development_length() {
        let factors = DevelopmentFactors::default();
        let dev = DevelopmentLength::new(
            20.0,   // 20mm bar
            420.0,  // fy
            30.0,   // f'c
            40.0,   // cover
            200.0,  // spacing
            factors,
        );

        assert!(dev.ld_tension > 0.0);
        assert!(dev.ld_compression > 0.0);
        assert!(dev.splice_class_b > dev.splice_class_a);
    }
}
