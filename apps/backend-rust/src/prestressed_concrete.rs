// ============================================================================
// PRESTRESSED CONCRETE DESIGN MODULE (IS 1343:2012)
// Pre-tensioned and Post-tensioned Concrete Design
// ============================================================================

use serde::{Deserialize, Serialize};

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// Prestressing steel strand types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StrandType {
    /// 7-wire low relaxation strand
    LowRelaxation7Wire,
    /// 7-wire stress relieved strand
    StressRelieved7Wire,
    /// Compact strand
    CompactStrand,
    /// Plain wire
    PlainWire,
    /// Deformed wire
    DeformedWire,
    /// High strength bar
    HighStrengthBar,
}

impl StrandType {
    /// Ultimate tensile strength fpu (MPa)
    pub fn fpu(&self) -> f64 {
        match self {
            StrandType::LowRelaxation7Wire => 1860.0,
            StrandType::StressRelieved7Wire => 1725.0,
            StrandType::CompactStrand => 1860.0,
            StrandType::PlainWire => 1570.0,
            StrandType::DeformedWire => 1470.0,
            StrandType::HighStrengthBar => 1035.0,
        }
    }
    
    /// Yield strength fpy (MPa) - 0.1% proof stress
    pub fn fpy(&self) -> f64 {
        match self {
            StrandType::LowRelaxation7Wire => 0.90 * self.fpu(),
            StrandType::StressRelieved7Wire => 0.85 * self.fpu(),
            StrandType::CompactStrand => 0.90 * self.fpu(),
            StrandType::PlainWire => 0.85 * self.fpu(),
            StrandType::DeformedWire => 0.85 * self.fpu(),
            StrandType::HighStrengthBar => 0.80 * self.fpu(),
        }
    }
    
    /// Elastic modulus Ep (MPa)
    pub fn ep(&self) -> f64 {
        match self {
            StrandType::LowRelaxation7Wire => 195000.0,
            StrandType::StressRelieved7Wire => 195000.0,
            StrandType::CompactStrand => 195000.0,
            StrandType::PlainWire => 210000.0,
            StrandType::DeformedWire => 210000.0,
            StrandType::HighStrengthBar => 205000.0,
        }
    }
    
    /// Relaxation loss percentage at 1000 hours
    pub fn relaxation_1000h(&self, initial_stress_ratio: f64) -> f64 {
        match self {
            StrandType::LowRelaxation7Wire => {
                if initial_stress_ratio <= 0.7 {
                    2.5
                } else {
                    2.5 + 5.0 * (initial_stress_ratio - 0.7) / 0.1
                }
            }
            StrandType::StressRelieved7Wire => {
                if initial_stress_ratio <= 0.6 {
                    4.5
                } else {
                    4.5 + 8.0 * (initial_stress_ratio - 0.6) / 0.1
                }
            }
            _ => 5.0, // Default
        }
    }
}

/// Standard strand sizes
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum StrandSize {
    /// 9.53mm (3/8") strand
    Strand9_53,
    /// 11.11mm (7/16") strand
    Strand11_11,
    /// 12.70mm (1/2") strand
    Strand12_70,
    /// 15.24mm (0.6") strand  
    Strand15_24,
    /// Custom diameter
    Custom(f64),
}

impl StrandSize {
    /// Nominal diameter (mm)
    pub fn diameter(&self) -> f64 {
        match self {
            StrandSize::Strand9_53 => 9.53,
            StrandSize::Strand11_11 => 11.11,
            StrandSize::Strand12_70 => 12.70,
            StrandSize::Strand15_24 => 15.24,
            StrandSize::Custom(d) => *d,
        }
    }
    
    /// Cross-sectional area (mm²)
    pub fn area(&self) -> f64 {
        match self {
            StrandSize::Strand9_53 => 54.84,
            StrandSize::Strand11_11 => 74.19,
            StrandSize::Strand12_70 => 98.71,
            StrandSize::Strand15_24 => 140.0,
            StrandSize::Custom(d) => 0.785 * d * d,
        }
    }
}

/// Concrete grade for prestressed members
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PscConcreteGrade {
    M30, M35, M40, M45, M50, M55, M60, M65, M70, M75, M80,
    Custom(f64),
}

impl PscConcreteGrade {
    /// Characteristic compressive strength fck (MPa)
    pub fn fck(&self) -> f64 {
        match self {
            PscConcreteGrade::M30 => 30.0,
            PscConcreteGrade::M35 => 35.0,
            PscConcreteGrade::M40 => 40.0,
            PscConcreteGrade::M45 => 45.0,
            PscConcreteGrade::M50 => 50.0,
            PscConcreteGrade::M55 => 55.0,
            PscConcreteGrade::M60 => 60.0,
            PscConcreteGrade::M65 => 65.0,
            PscConcreteGrade::M70 => 70.0,
            PscConcreteGrade::M75 => 75.0,
            PscConcreteGrade::M80 => 80.0,
            PscConcreteGrade::Custom(f) => *f,
        }
    }
    
    /// Elastic modulus Ec (MPa) per IS 1343
    pub fn ec(&self) -> f64 {
        5000.0 * self.fck().sqrt()
    }
    
    /// Permissible compressive stress at transfer (MPa)
    pub fn fci_perm(&self, fci: f64) -> f64 {
        0.50 * fci // IS 1343 Clause 22.1.1
    }
    
    /// Permissible tensile stress at transfer (MPa)
    pub fn fti_perm(&self, fci: f64) -> f64 {
        0.5 * fci.sqrt() // Zone 1 (no cracking)
    }
    
    /// Permissible compressive stress at service (MPa)
    pub fn fc_perm(&self) -> f64 {
        0.41 * self.fck() // IS 1343 Clause 22.1.2
    }
    
    /// Permissible tensile stress at service (MPa)
    pub fn ft_perm(&self) -> f64 {
        0.0 // Zone 1 - no tension
    }
}

// ============================================================================
// TENDON GEOMETRY
// ============================================================================

/// Tendon profile types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TendonProfile {
    /// Straight tendon
    Straight,
    /// Single parabola
    Parabolic,
    /// Harped (draped) profile
    Harped,
    /// Continuous parabola with inflection points
    ContinuousParabolic,
}

/// Tendon geometry definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TendonGeometry {
    /// Profile type
    pub profile: TendonProfile,
    /// Eccentricity at left end (mm) - positive below centroid
    pub e_left: f64,
    /// Eccentricity at midspan (mm)
    pub e_mid: f64,
    /// Eccentricity at right end (mm)
    pub e_right: f64,
    /// Harping point location (fraction of span, 0-0.5)
    pub harp_point: f64,
    /// Span length (mm)
    pub span: f64,
}

impl TendonGeometry {
    /// Create straight tendon
    pub fn straight(e: f64, span: f64) -> Self {
        Self {
            profile: TendonProfile::Straight,
            e_left: e,
            e_mid: e,
            e_right: e,
            harp_point: 0.0,
            span,
        }
    }
    
    /// Create parabolic tendon
    pub fn parabolic(e_end: f64, e_mid: f64, span: f64) -> Self {
        Self {
            profile: TendonProfile::Parabolic,
            e_left: e_end,
            e_mid,
            e_right: e_end,
            harp_point: 0.0,
            span,
        }
    }
    
    /// Create harped tendon
    pub fn harped(e_end: f64, e_mid: f64, harp_point: f64, span: f64) -> Self {
        Self {
            profile: TendonProfile::Harped,
            e_left: e_end,
            e_mid,
            e_right: e_end,
            harp_point,
            span,
        }
    }
    
    /// Get eccentricity at any location x from left support
    pub fn eccentricity_at(&self, x: f64) -> f64 {
        let l = self.span;
        let ratio = x / l;
        
        match self.profile {
            TendonProfile::Straight => self.e_mid,
            TendonProfile::Parabolic => {
                // y = 4*e_max * x/L * (1 - x/L) for symmetric parabola
                let e_avg = (self.e_left + self.e_right) / 2.0;
                let sag = self.e_mid - e_avg;
                e_avg + 4.0 * sag * ratio * (1.0 - ratio)
            }
            TendonProfile::Harped => {
                let hp = self.harp_point;
                if ratio <= hp {
                    // Left linear segment
                    self.e_left + (self.e_mid - self.e_left) * ratio / hp
                } else if ratio >= (1.0 - hp) {
                    // Right linear segment
                    self.e_mid + (self.e_right - self.e_mid) * (ratio - (1.0 - hp)) / hp
                } else {
                    // Middle flat segment
                    self.e_mid
                }
            }
            TendonProfile::ContinuousParabolic => {
                // Continuous parabola with inflection points
                let e_avg = (self.e_left + self.e_right) / 2.0;
                let sag = self.e_mid - e_avg;
                e_avg + 4.0 * sag * ratio * (1.0 - ratio)
            }
        }
    }
    
    /// Get slope of tendon at location x (radians)
    pub fn slope_at(&self, x: f64) -> f64 {
        let l = self.span;
        let dx = l / 1000.0;
        let e1 = self.eccentricity_at((x - dx).max(0.0));
        let e2 = self.eccentricity_at((x + dx).min(l));
        (e2 - e1).atan2(2.0 * dx)
    }
    
    /// Get curvature at location x (1/mm)
    pub fn curvature_at(&self, _x: f64) -> f64 {
        match self.profile {
            TendonProfile::Straight | TendonProfile::Harped => 0.0,
            TendonProfile::Parabolic | TendonProfile::ContinuousParabolic => {
                // For parabola: 1/R = 8*sag/L²
                let e_avg = (self.e_left + self.e_right) / 2.0;
                let sag = (self.e_mid - e_avg).abs();
                8.0 * sag / (self.span * self.span)
            }
        }
    }
}

// ============================================================================
// PRESTRESS LOSSES (IS 1343 Clause 18)
// ============================================================================

/// Prestress loss calculator
#[derive(Debug, Clone)]
pub struct PrestressLossCalculator {
    /// Strand type
    pub strand_type: StrandType,
    /// Initial jacking stress (MPa)
    pub fp_jack: f64,
    /// Concrete grade at transfer
    pub fci: f64,
    /// Concrete grade at service
    pub fc: f64,
    /// Elastic modulus of concrete at transfer
    pub eci: f64,
    /// Elastic modulus of concrete at service
    pub ec: f64,
    /// Elastic modulus of prestressing steel
    pub ep: f64,
    /// Relative humidity (%)
    pub rh: f64,
    /// Age at transfer (days)
    pub age_transfer: u32,
    /// Age at loading (days)
    pub age_loading: u32,
}

impl PrestressLossCalculator {
    pub fn new(
        strand_type: StrandType,
        fp_jack: f64,
        concrete: PscConcreteGrade,
        fci: f64,
        rh: f64,
    ) -> Self {
        let fc = concrete.fck();
        let ec = concrete.ec();
        let eci = 5000.0 * fci.sqrt();
        let ep = strand_type.ep();
        
        Self {
            strand_type,
            fp_jack,
            fci,
            fc,
            eci,
            ec,
            ep,
            rh,
            age_transfer: 3,
            age_loading: 28,
        }
    }
    
    /// Friction loss for post-tensioning (IS 1343 Clause 18.5.2.1)
    pub fn friction_loss(&self, geometry: &TendonGeometry, mu: f64, k: f64) -> FrictionLossResult {
        let l = geometry.span / 1000.0; // Convert to meters
        
        // Total angle change (sum of intentional + wobble)
        let alpha = match geometry.profile {
            TendonProfile::Straight => 0.0,
            TendonProfile::Parabolic => {
                let sag = (geometry.e_mid - geometry.e_left).abs() / 1000.0;
                8.0 * sag / l // Approximate for parabola
            }
            TendonProfile::Harped => {
                let sag = (geometry.e_mid - geometry.e_left).abs() / 1000.0;
                2.0 * (sag / (geometry.harp_point * l)).atan()
            }
            _ => 0.0,
        };
        
        // Wobble coefficient per meter
        let wobble = k * l;
        
        // Total friction angle
        let theta = mu * alpha + wobble;
        
        // Loss at end
        let fp_end = self.fp_jack * (-theta).exp();
        let loss = self.fp_jack - fp_end;
        let loss_percent = loss / self.fp_jack * 100.0;
        
        FrictionLossResult {
            mu,
            k,
            alpha_rad: alpha,
            wobble_angle: wobble,
            total_angle: theta,
            stress_at_end: fp_end,
            loss,
            loss_percent,
        }
    }
    
    /// Anchorage slip loss (IS 1343 Clause 18.5.2.2)
    pub fn anchorage_slip_loss(&self, slip: f64, tendon_length: f64, friction_loss: f64) -> AnchorageSlipResult {
        // Slip in mm, length in mm
        let loss_strain = slip / tendon_length;
        let loss = self.ep * loss_strain;
        
        // Affected length: l_set = sqrt(Δs × Ep / p')
        // where p' = friction stress gradient per unit length (MPa/mm)
        let p_prime = if friction_loss > 0.0 && tendon_length > 0.0 {
            friction_loss / tendon_length // MPa/mm
        } else {
            0.001 // Small default to avoid division by zero
        };
        let affected_length = (slip * self.ep / p_prime).sqrt();
        
        AnchorageSlipResult {
            slip,
            tendon_length,
            loss_strain,
            loss,
            loss_percent: loss / self.fp_jack * 100.0,
            affected_length,
        }
    }
    
    /// Elastic shortening loss (IS 1343 Clause 18.5.2.3)
    pub fn elastic_shortening_loss(
        &self,
        fcp: f64, // Concrete stress at CG of tendons at transfer
        n_tendons: u32,
        sequential: bool,
    ) -> ElasticShorteningResult {
        let n = self.ep / self.eci;
        
        // For sequential tensioning, reduce by (n-1)/2n
        let factor = if sequential && n_tendons > 1 {
            (n_tendons as f64 - 1.0) / (2.0 * n_tendons as f64)
        } else {
            1.0
        };
        
        let loss = n * fcp * factor;
        
        ElasticShorteningResult {
            modular_ratio: n,
            concrete_stress: fcp,
            reduction_factor: factor,
            loss,
            loss_percent: loss / self.fp_jack * 100.0,
        }
    }
    
    /// Creep loss (IS 1343 Clause 18.5.2.4)
    pub fn creep_loss(&self, fcp: f64) -> CreepLossResult {
        // Ultimate creep coefficient per IS 1343 Table 7
        let phi = match self.age_loading {
            0..=7 => 2.2,
            8..=28 => 1.6,
            29..=365 => 1.1,
            _ => 1.1, // > 1 year
        };
        
        let n = self.ep / self.ec;
        let loss = n * phi * fcp;
        
        CreepLossResult {
            creep_coefficient: phi,
            modular_ratio: n,
            concrete_stress: fcp,
            loss,
            loss_percent: loss / self.fp_jack * 100.0,
        }
    }
    
    /// Shrinkage loss (IS 1343 Clause 18.5.2.5)
    pub fn shrinkage_loss(&self, _notional_size: f64) -> ShrinkageLossResult {
        // Notional size = 2*Ac/u (mm)
        
        // Ultimate shrinkage strain per IS 1343 Table 8
        let eps_sh = if self.rh > 80.0 {
            190e-6
        } else if self.rh > 50.0 {
            300e-6
        } else {
            420e-6
        };
        let loss = self.ep * eps_sh;
        
        ShrinkageLossResult {
            shrinkage_strain: eps_sh,
            loss,
            loss_percent: loss / self.fp_jack * 100.0,
        }
    }
    
    /// Relaxation loss (IS 1343 Clause 18.5.2.6)
    pub fn relaxation_loss(&self, fp_initial: f64) -> RelaxationLossResult {
        let ratio = fp_initial / self.strand_type.fpu();
        let relax_1000 = self.strand_type.relaxation_1000h(ratio);
        
        // Time factor for long-term (assume 50 years)
        let time_factor = 2.5; // Approximate for 50 years
        
        let relax_final = relax_1000 * time_factor;
        let loss = fp_initial * relax_final / 100.0;
        
        RelaxationLossResult {
            initial_stress_ratio: ratio,
            relaxation_1000h: relax_1000,
            time_factor,
            final_relaxation: relax_final,
            loss,
            loss_percent: loss / self.fp_jack * 100.0,
        }
    }
    
    /// Calculate total losses
    pub fn total_losses(
        &self,
        geometry: &TendonGeometry,
        fcp_transfer: f64,
        fcp_service: f64,
        notional_size: f64,
        mu: f64,
        k: f64,
        slip: f64,
        n_tendons: u32,
    ) -> TotalLossResult {
        // Immediate losses
        let friction = self.friction_loss(geometry, mu, k);
        let anchorage = self.anchorage_slip_loss(slip, geometry.span, friction.loss);
        let elastic = self.elastic_shortening_loss(fcp_transfer, n_tendons, true);
        
        let immediate_loss = friction.loss + anchorage.loss + elastic.loss;
        let fp_after_immediate = self.fp_jack - immediate_loss;
        
        // Time-dependent losses
        let creep = self.creep_loss(fcp_service);
        let shrinkage = self.shrinkage_loss(notional_size);
        let relaxation = self.relaxation_loss(fp_after_immediate);
        
        let time_dependent_loss = creep.loss + shrinkage.loss + relaxation.loss;
        
        let total_loss = immediate_loss + time_dependent_loss;
        let fp_effective = self.fp_jack - total_loss;
        
        TotalLossResult {
            friction,
            anchorage,
            elastic_shortening: elastic,
            creep,
            shrinkage,
            relaxation,
            immediate_loss,
            immediate_loss_percent: immediate_loss / self.fp_jack * 100.0,
            time_dependent_loss,
            time_dependent_loss_percent: time_dependent_loss / self.fp_jack * 100.0,
            total_loss,
            total_loss_percent: total_loss / self.fp_jack * 100.0,
            effective_stress: fp_effective,
        }
    }
}

// ============================================================================
// LOSS RESULT STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrictionLossResult {
    pub mu: f64,
    pub k: f64,
    pub alpha_rad: f64,
    pub wobble_angle: f64,
    pub total_angle: f64,
    pub stress_at_end: f64,
    pub loss: f64,
    pub loss_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorageSlipResult {
    pub slip: f64,
    pub tendon_length: f64,
    pub loss_strain: f64,
    pub loss: f64,
    pub loss_percent: f64,
    pub affected_length: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElasticShorteningResult {
    pub modular_ratio: f64,
    pub concrete_stress: f64,
    pub reduction_factor: f64,
    pub loss: f64,
    pub loss_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreepLossResult {
    pub creep_coefficient: f64,
    pub modular_ratio: f64,
    pub concrete_stress: f64,
    pub loss: f64,
    pub loss_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShrinkageLossResult {
    pub shrinkage_strain: f64,
    pub loss: f64,
    pub loss_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelaxationLossResult {
    pub initial_stress_ratio: f64,
    pub relaxation_1000h: f64,
    pub time_factor: f64,
    pub final_relaxation: f64,
    pub loss: f64,
    pub loss_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotalLossResult {
    pub friction: FrictionLossResult,
    pub anchorage: AnchorageSlipResult,
    pub elastic_shortening: ElasticShorteningResult,
    pub creep: CreepLossResult,
    pub shrinkage: ShrinkageLossResult,
    pub relaxation: RelaxationLossResult,
    pub immediate_loss: f64,
    pub immediate_loss_percent: f64,
    pub time_dependent_loss: f64,
    pub time_dependent_loss_percent: f64,
    pub total_loss: f64,
    pub total_loss_percent: f64,
    pub effective_stress: f64,
}

// ============================================================================
// SECTION DESIGN (IS 1343 Clause 22 & 23)
// ============================================================================

/// Prestressed section properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PscSectionProps {
    /// Section area (mm²)
    pub area: f64,
    /// Moment of inertia (mm⁴)
    pub i: f64,
    /// Distance from top to centroid (mm)
    pub yt: f64,
    /// Distance from bottom to centroid (mm)
    pub yb: f64,
    /// Section modulus (top) (mm³)
    pub zt: f64,
    /// Section modulus (bottom) (mm³)
    pub zb: f64,
    /// Kern distance (top) (mm)
    pub kt: f64,
    /// Kern distance (bottom) (mm)
    pub kb: f64,
    /// Perimeter (mm)
    pub perimeter: f64,
    /// Web width (mm) - for shear/capacity calculations
    pub bw: f64,
    /// Overall depth (mm)
    pub depth: f64,
}

impl PscSectionProps {
    /// Create rectangular section
    pub fn rectangular(b: f64, h: f64) -> Self {
        let area = b * h;
        let i = b * h.powi(3) / 12.0;
        let yt = h / 2.0;
        let yb = h / 2.0;
        let zt = i / yt;
        let zb = i / yb;
        let kt = i / (area * yb);
        let kb = i / (area * yt);
        let perimeter = 2.0 * (b + h);
        
        Self { area, i, yt, yb, zt, zb, kt, kb, perimeter, bw: b, depth: h }
    }
    
    /// Create I-section
    pub fn i_section(bf: f64, tf: f64, bw: f64, hw: f64) -> Self {
        let h = 2.0 * tf + hw;
        let area = 2.0 * bf * tf + bw * hw;
        
        // Centroid from bottom
        let y_bar = (bf * tf * (h - tf / 2.0) + bw * hw * (hw / 2.0 + tf) + bf * tf * tf / 2.0) / area;
        let yb = y_bar;
        let yt = h - y_bar;
        
        // Moment of inertia
        let i_top = bf * tf.powi(3) / 12.0 + bf * tf * (h - tf / 2.0 - y_bar).powi(2);
        let i_web = bw * hw.powi(3) / 12.0 + bw * hw * (hw / 2.0 + tf - y_bar).powi(2);
        let i_bot = bf * tf.powi(3) / 12.0 + bf * tf * (tf / 2.0 - y_bar).powi(2);
        let i = i_top + i_web + i_bot;
        
        let zt = i / yt;
        let zb = i / yb;
        let kt = i / (area * yb);
        let kb = i / (area * yt);
        let perimeter = 2.0 * bf + 4.0 * tf + 2.0 * hw + 2.0 * (bf - bw);
        
        Self { area, i, yt, yb, zt, zb, kt, kb, perimeter, bw, depth: h }
    }
    
    /// Create T-section
    pub fn t_section(bf: f64, tf: f64, bw: f64, d: f64) -> Self {
        let hw = d - tf;
        let area = bf * tf + bw * hw;
        
        // Centroid from bottom
        let y_bar = (bf * tf * (d - tf / 2.0) + bw * hw * hw / 2.0) / area;
        let yb = y_bar;
        let yt = d - y_bar;
        
        let i_flange = bf * tf.powi(3) / 12.0 + bf * tf * (d - tf / 2.0 - y_bar).powi(2);
        let i_web = bw * hw.powi(3) / 12.0 + bw * hw * (hw / 2.0 - y_bar).powi(2);
        let i = i_flange + i_web;
        
        let zt = i / yt;
        let zb = i / yb;
        let kt = i / (area * yb);
        let kb = i / (area * yt);
        let perimeter = bf + 2.0 * tf + 2.0 * hw + 2.0 * (bf - bw) / 2.0 + bw;
        
        Self { area, i, yt, yb, zt, zb, kt, kb, perimeter, bw, depth: d }
    }
    
    /// Notional size for creep/shrinkage (2*Ac/u)
    pub fn notional_size(&self) -> f64 {
        2.0 * self.area / self.perimeter
    }
}

/// Prestressed beam designer
#[derive(Debug, Clone)]
pub struct PscBeamDesigner {
    pub section: PscSectionProps,
    pub concrete: PscConcreteGrade,
    pub strand_type: StrandType,
    pub strand_size: StrandSize,
    pub n_strands: u32,
    pub geometry: TendonGeometry,
    pub fci: f64, // Concrete strength at transfer
}

impl PscBeamDesigner {
    pub fn new(
        section: PscSectionProps,
        concrete: PscConcreteGrade,
        strand_type: StrandType,
        strand_size: StrandSize,
        n_strands: u32,
        geometry: TendonGeometry,
        fci: f64,
    ) -> Self {
        Self {
            section,
            concrete,
            strand_type,
            strand_size,
            n_strands,
            geometry,
            fci,
        }
    }
    
    /// Total prestressing steel area
    pub fn aps(&self) -> f64 {
        self.n_strands as f64 * self.strand_size.area()
    }
    
    /// Check stresses at transfer
    pub fn check_transfer(&self, pe: f64, m_sw: f64) -> TransferCheckResult {
        let a = self.section.area;
        let e = self.geometry.e_mid;
        let zt = self.section.zt;
        let zb = self.section.zb;
        
        // Stresses at transfer
        // Top fiber: -P/A + P*e/Zt - Msw/Zt (tension negative)
        // Bottom fiber: -P/A - P*e/Zb + Msw/Zb
        
        let f_top = -pe / a + pe * e / zt - m_sw * 1e6 / zt;
        let f_bot = -pe / a - pe * e / zb + m_sw * 1e6 / zb;
        
        // Permissible stresses (positive magnitudes)
        let fc_perm = self.concrete.fci_perm(self.fci); // compression limit
        let ft_perm = self.concrete.fti_perm(self.fci);  // tension limit
        
        // Convention: negative = compression, positive = tension
        // Check: -fc_perm <= f <= ft_perm
        TransferCheckResult {
            stress_top: f_top,
            stress_bottom: f_bot,
            compression_limit: fc_perm,
            tension_limit: ft_perm,
            top_ok: f_top >= -fc_perm && f_top <= ft_perm,
            bottom_ok: f_bot >= -fc_perm && f_bot <= ft_perm,
            pass: f_top >= -fc_perm && f_top <= ft_perm && f_bot >= -fc_perm && f_bot <= ft_perm,
        }
    }
    
    /// Check stresses at service
    pub fn check_service(&self, pe: f64, m_total: f64) -> ServiceCheckResult {
        let a = self.section.area;
        let e = self.geometry.e_mid;
        let zt = self.section.zt;
        let zb = self.section.zb;
        
        // Stresses at service
        let f_top = -pe / a + pe * e / zt - m_total * 1e6 / zt;
        let f_bot = -pe / a - pe * e / zb + m_total * 1e6 / zb;
        
        // Permissible stresses (positive magnitudes)
        let fc_perm = self.concrete.fc_perm();
        let ft_perm = self.concrete.ft_perm();
        
        // Convention: negative = compression, positive = tension
        ServiceCheckResult {
            stress_top: f_top,
            stress_bottom: f_bot,
            compression_limit: fc_perm,
            tension_limit: ft_perm,
            top_ok: f_top >= -fc_perm && f_top <= ft_perm,
            bottom_ok: f_bot >= -fc_perm && f_bot <= ft_perm,
            pass: f_top >= -fc_perm && f_top <= ft_perm && f_bot >= -fc_perm && f_bot <= ft_perm,
        }
    }
    
    /// Calculate ultimate moment capacity (IS 1343 Clause 23)
    pub fn ultimate_moment_capacity(&self, pe: f64, dp: f64) -> UltimateMomentResult {
        let fck = self.concrete.fck();
        let fpu = self.strand_type.fpu();
        let aps = self.aps();
        let b = self.section.bw; // Use actual web width
        
        // Effective prestress as ratio of fpu
        let fpe = pe / aps;
        let fpe_ratio = fpe / fpu;
        
        // Ultimate stress in tendon (approximate per IS 1343)
        let fps = if fpe_ratio >= 0.5 {
            fpu * (1.0 - 0.5 * aps * fpu / (b * dp * 0.67 * fck))
        } else {
            fpe + (fpu - fpe) * 0.7
        };
        
        // Neutral axis depth: Aps * fps = 0.36 * fck * b * xu
        let xu = aps * fps / (0.36 * fck * b);
        
        // Depth of stress block
        let a = 0.42 * xu;
        
        // Check for over-reinforced section
        // For prestressing steel, xu_max/d is based on strain compatibility
        // Using 0.6d as conservative limit for prestressing steel
        let xu_max = 0.6 * dp;
        let is_over_reinforced = xu > xu_max;
        
        // Moment capacity: Mu = Aps * fps * (dp - 0.42*xu)
        let mn = aps * fps * (dp - 0.42 * xu) / 1e6;
        
        UltimateMomentResult {
            fps,
            stress_block_depth: a,
            neutral_axis_depth: xu,
            xu_max,
            is_over_reinforced,
            mn_nominal: mn,
            phi_mn: mn, // IS 1343 uses partial safety factors, no additional phi
        }
    }
    
    /// Calculate shear capacity (IS 1343 Clause 22.4)
    pub fn shear_capacity(&self, pe: f64, m: f64, v: f64, dp: f64) -> ShearCapacityResult {
        let fck = self.concrete.fck();
        let b = self.section.bw; // Use actual web width
        let d = dp;
        let d_overall = self.section.depth; // Overall depth D
        
        // Concrete stresses at centroid
        let fcp = pe / self.section.area + pe * self.geometry.e_mid / self.section.zb;
        let ft = 0.24 * fck.sqrt();
        let fpe = pe / self.aps();
        let fp = self.strand_type.fpu();
        
        // Uncracked shear capacity (Vco) - IS 1343 Clause 22.4.1
        // Uses overall depth D, not effective depth d
        let vco = 0.67 * b * d_overall * (ft.powi(2) + 0.8 * fcp * ft).sqrt() / 1000.0;
        
        // Decompression moment M0 - includes eccentricity
        // M0 = (P/A + P*e/Zb) * Zb = P*(Zb/A + e)
        let mo = (pe / self.section.area + pe * self.geometry.e_mid / self.section.zb) * self.section.zb / 1e6;
        
        // Cracked shear capacity (Vcr) - IS 1343 Clause 22.4.2
        // Vcr = (1 - 0.55*fpe/fp) * τc * b * d + M0 * V / M
        let tau_c = 0.25 * fck.sqrt();
        let fpe_fp_factor = 1.0 - 0.55 * fpe / fp;
        let vcr_base = fpe_fp_factor * tau_c * b * d / 1000.0;
        let vcr = if m > mo {
            vcr_base + mo * v / (m.max(0.001) * 1000.0)
        } else {
            vco // Use uncracked if moment < decompression
        };
        
        // Governing capacity - take minimum
        let vc = vco.min(vcr.max(vco * 0.5));
        
        // Maximum shear per IS 456 Table 20 (τc,max)
        let tau_c_max = if fck <= 15.0 { 2.5 }
            else if fck <= 20.0 { 2.8 }
            else if fck <= 25.0 { 3.1 }
            else if fck <= 30.0 { 3.5 }
            else if fck <= 35.0 { 3.7 }
            else if fck <= 40.0 { 4.0 }
            else { 4.0 };
        let vc_max = tau_c_max * b * d / 1000.0;
        
        ShearCapacityResult {
            vco,
            vcr,
            vc_governing: vc,
            vc_max,
            vu_applied: v,
            shear_ratio: if vc > 0.0 { v / vc } else { 1.0 },
            pass: v <= vc, // IS 1343 uses limit state design, no additional phi
        }
    }
}

// ============================================================================
// DESIGN CHECK RESULTS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferCheckResult {
    pub stress_top: f64,
    pub stress_bottom: f64,
    pub compression_limit: f64,
    pub tension_limit: f64,
    pub top_ok: bool,
    pub bottom_ok: bool,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCheckResult {
    pub stress_top: f64,
    pub stress_bottom: f64,
    pub compression_limit: f64,
    pub tension_limit: f64,
    pub top_ok: bool,
    pub bottom_ok: bool,
    pub pass: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UltimateMomentResult {
    pub fps: f64,
    pub stress_block_depth: f64,
    pub neutral_axis_depth: f64,
    pub xu_max: f64,
    pub is_over_reinforced: bool,
    pub mn_nominal: f64,
    pub phi_mn: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearCapacityResult {
    pub vco: f64,
    pub vcr: f64,
    pub vc_governing: f64,
    pub vc_max: f64,
    pub vu_applied: f64,
    pub shear_ratio: f64,
    pub pass: bool,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strand_properties() {
        let strand = StrandType::LowRelaxation7Wire;
        assert_eq!(strand.fpu(), 1860.0);
        assert!((strand.fpy() - 1674.0).abs() < 1.0);
        assert_eq!(strand.ep(), 195000.0);
    }

    #[test]
    fn test_strand_sizes() {
        assert!((StrandSize::Strand12_70.area() - 98.71).abs() < 0.1);
        assert!((StrandSize::Strand15_24.diameter() - 15.24).abs() < 0.1);
    }

    #[test]
    fn test_concrete_grade() {
        let grade = PscConcreteGrade::M50;
        assert_eq!(grade.fck(), 50.0);
        assert!((grade.ec() - 35355.0).abs() < 100.0);
        assert!((grade.fc_perm() - 20.5).abs() < 0.5);
    }

    #[test]
    fn test_tendon_geometry_straight() {
        let geom = TendonGeometry::straight(200.0, 10000.0);
        assert_eq!(geom.eccentricity_at(0.0), 200.0);
        assert_eq!(geom.eccentricity_at(5000.0), 200.0);
        assert_eq!(geom.eccentricity_at(10000.0), 200.0);
    }

    #[test]
    fn test_tendon_geometry_parabolic() {
        let geom = TendonGeometry::parabolic(-50.0, 200.0, 10000.0);
        
        // At ends
        assert!((geom.eccentricity_at(0.0) - (-50.0)).abs() < 1.0);
        
        // At midspan - maximum eccentricity
        assert!((geom.eccentricity_at(5000.0) - 200.0).abs() < 1.0);
        
        // At quarter point
        let e_quarter = geom.eccentricity_at(2500.0);
        assert!(e_quarter > -50.0 && e_quarter < 200.0);
    }

    #[test]
    fn test_friction_loss() {
        let calc = PrestressLossCalculator::new(
            StrandType::LowRelaxation7Wire,
            1400.0,
            PscConcreteGrade::M50,
            35.0,
            70.0,
        );
        
        let geom = TendonGeometry::parabolic(-50.0, 200.0, 20000.0);
        let result = calc.friction_loss(&geom, 0.20, 0.002);
        
        assert!(result.loss > 0.0);
        assert!(result.loss_percent < 15.0);
    }

    #[test]
    fn test_elastic_shortening_loss() {
        let calc = PrestressLossCalculator::new(
            StrandType::LowRelaxation7Wire,
            1400.0,
            PscConcreteGrade::M50,
            35.0,
            70.0,
        );
        
        let result = calc.elastic_shortening_loss(12.0, 6, true);
        
        assert!(result.loss > 0.0);
        assert!(result.modular_ratio > 5.0);
    }

    #[test]
    fn test_shrinkage_loss() {
        let calc = PrestressLossCalculator::new(
            StrandType::LowRelaxation7Wire,
            1400.0,
            PscConcreteGrade::M50,
            35.0,
            70.0,
        );
        
        let result = calc.shrinkage_loss(200.0);
        
        assert!(result.loss > 0.0);
        assert!(result.shrinkage_strain > 0.0);
    }

    #[test]
    fn test_total_losses() {
        let calc = PrestressLossCalculator::new(
            StrandType::LowRelaxation7Wire,
            1400.0,
            PscConcreteGrade::M50,
            35.0,
            70.0,
        );
        
        let geom = TendonGeometry::parabolic(-50.0, 200.0, 20000.0);
        let result = calc.total_losses(&geom, 12.0, 10.0, 200.0, 0.20, 0.002, 6.0, 12);
        
        assert!(result.total_loss > 0.0);
        // Typical total losses are 10-40% depending on conditions
        assert!(result.total_loss_percent > 5.0 && result.total_loss_percent < 50.0);
        assert!(result.effective_stress > 700.0);
    }

    #[test]
    fn test_section_props_rectangular() {
        let section = PscSectionProps::rectangular(300.0, 600.0);
        
        assert_eq!(section.area, 180000.0);
        assert_eq!(section.yt, 300.0);
        assert_eq!(section.yb, 300.0);
    }

    #[test]
    fn test_section_props_i_section() {
        let section = PscSectionProps::i_section(500.0, 100.0, 200.0, 600.0);
        
        assert!(section.area > 0.0);
        assert!(section.i > 0.0);
        assert!(section.zt > 0.0);
    }

    #[test]
    fn test_transfer_check() {
        let section = PscSectionProps::rectangular(300.0, 600.0);
        let geom = TendonGeometry::straight(200.0, 10000.0);
        
        let designer = PscBeamDesigner::new(
            section,
            PscConcreteGrade::M50,
            StrandType::LowRelaxation7Wire,
            StrandSize::Strand12_70,
            12,
            geom,
            35.0,
        );
        
        let pe = 1200.0 * 1000.0; // 1200 kN
        let m_sw = 50.0; // 50 kNm
        
        let result = designer.check_transfer(pe, m_sw);
        assert!(result.stress_top != 0.0 || result.stress_bottom != 0.0);
    }

    #[test]
    fn test_ultimate_moment() {
        let section = PscSectionProps::rectangular(300.0, 600.0);
        let geom = TendonGeometry::straight(200.0, 10000.0);
        
        let designer = PscBeamDesigner::new(
            section,
            PscConcreteGrade::M50,
            StrandType::LowRelaxation7Wire,
            StrandSize::Strand12_70,
            12,
            geom,
            35.0,
        );
        
        let pe = 1000.0 * 1000.0;
        let dp = 500.0;
        
        let result = designer.ultimate_moment_capacity(pe, dp);
        assert!(result.mn_nominal > 0.0);
        assert!(result.phi_mn < result.mn_nominal);
    }

    #[test]
    fn test_shear_capacity() {
        let section = PscSectionProps::rectangular(300.0, 600.0);
        let geom = TendonGeometry::straight(200.0, 10000.0);
        
        let designer = PscBeamDesigner::new(
            section,
            PscConcreteGrade::M50,
            StrandType::LowRelaxation7Wire,
            StrandSize::Strand12_70,
            12,
            geom,
            35.0,
        );
        
        let pe = 1000.0 * 1000.0;
        let result = designer.shear_capacity(pe, 200.0, 150.0, 500.0);
        
        assert!(result.vco > 0.0);
        assert!(result.vc_governing > 0.0);
    }
}
