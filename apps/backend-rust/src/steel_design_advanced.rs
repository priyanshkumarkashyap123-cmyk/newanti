// ============================================================================
// ADVANCED STEEL DESIGN FEATURES
// ============================================================================
//
// Industry-standard steel design per AISC 360-22, IS 800:2007:
// - Lateral-Torsional Buckling (LTB)
// - Stability curves (column buckling)
// - Connection limit states (bolt shear, bearing, block shear)
// - Web local buckling (WLB)
// - Flange local buckling (FLB)
// - Shear capacity
//
// Industry Parity: ETABS, SAP2000, STAAD.Pro, RISA
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// LATERAL-TORSIONAL BUCKLING (LTB)
// ============================================================================

/// Lateral-torsional buckling parameters per AISC 360-22 Chapter F
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LateralTorsionalBuckling {
    /// Section properties
    pub section: SteelSection,
    /// Material properties
    pub material: SteelMaterial,
    /// Unbraced length (Lb)
    pub lb: f64,
    /// Modification factor for non-uniform moment (Cb)
    pub cb: f64,
    /// Limiting unbraced length for plastic behavior (Lp)
    pub lp: f64,
    /// Limiting unbraced length for inelastic LTB (Lr)
    pub lr: f64,
    /// Nominal flexural strength (Mn)
    pub mn: f64,
    /// LTB regime
    pub regime: LtbRegime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelSection {
    /// Section name (e.g., "W16x40")
    pub name: String,
    /// Total depth (d)
    pub d: f64,
    /// Flange width (bf)
    pub bf: f64,
    /// Flange thickness (tf)
    pub tf: f64,
    /// Web thickness (tw)
    pub tw: f64,
    /// Section modulus about major axis (Sx)
    pub sx: f64,
    /// Plastic section modulus about major axis (Zx)
    pub zx: f64,
    /// Moment of inertia about major axis (Ix)
    pub ix: f64,
    /// Moment of inertia about minor axis (Iy)
    pub iy: f64,
    /// Radius of gyration about minor axis (ry)
    pub ry: f64,
    /// Warping constant (Cw)
    pub cw: f64,
    /// Torsional constant (J)
    pub j: f64,
    /// Effective radius of gyration for LTB (rts)
    pub rts: f64,
    /// Distance from centroid to extreme fiber compression (c)
    pub c: f64,
    /// Web depth clear of fillets (ho)
    pub ho: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMaterial {
    /// Yield stress (Fy)
    pub fy: f64,
    /// Ultimate tensile stress (Fu)
    pub fu: f64,
    /// Modulus of elasticity (E)
    pub e: f64,
    /// Shear modulus (G)
    pub g: f64,
}

impl Default for SteelMaterial {
    fn default() -> Self {
        Self {
            fy: 345.0,  // MPa (Grade 50)
            fu: 450.0,  // MPa
            e: 200000.0, // MPa
            g: 77200.0,  // MPa
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LtbRegime {
    /// Lb ≤ Lp: Full plastic capacity
    Plastic,
    /// Lp < Lb ≤ Lr: Inelastic LTB
    Inelastic,
    /// Lb > Lr: Elastic LTB
    Elastic,
}

impl LateralTorsionalBuckling {
    /// Create LTB analysis for I-shaped sections per AISC 360-22 F2
    pub fn new(section: SteelSection, material: SteelMaterial, lb: f64, cb: f64) -> Self {
        let cb = cb.max(1.0).min(3.0);
        
        // Calculate Lp per Eq. F2-5
        // Lp = 1.76 * ry * sqrt(E/Fy)
        let lp = 1.76 * section.ry * (material.e / material.fy).sqrt();

        // Calculate Lr per Eq. F2-6
        // Lr = 1.95 * rts * (E/(0.7*Fy)) * sqrt(J*c/(Sx*ho) + sqrt((J*c/(Sx*ho))^2 + 6.76*(0.7*Fy/E)^2))
        let jc_sxho = (section.j * section.c) / (section.sx * section.ho);
        let fy_e_ratio = 0.7 * material.fy / material.e;
        let lr = 1.95 * section.rts * (material.e / (0.7 * material.fy)) 
            * (jc_sxho + (jc_sxho.powi(2) + 6.76 * fy_e_ratio.powi(2)).sqrt()).sqrt();

        // Determine regime and calculate Mn
        let (regime, mn) = Self::calculate_mn(
            &section, &material, lb, cb, lp, lr
        );

        Self {
            section,
            material,
            lb,
            cb,
            lp,
            lr,
            mn,
            regime,
        }
    }

    /// Calculate nominal flexural strength Mn
    fn calculate_mn(
        section: &SteelSection,
        material: &SteelMaterial,
        lb: f64,
        cb: f64,
        lp: f64,
        lr: f64,
    ) -> (LtbRegime, f64) {
        let mp = material.fy * section.zx;
        let mr = 0.7 * material.fy * section.sx;

        if lb <= lp {
            // Plastic regime: Mn = Mp
            (LtbRegime::Plastic, mp)
        } else if lb <= lr {
            // Inelastic LTB: Mn = Cb * (Mp - (Mp - 0.7*Fy*Sx) * (Lb-Lp)/(Lr-Lp)) ≤ Mp
            let mn = cb * (mp - (mp - mr) * (lb - lp) / (lr - lp));
            (LtbRegime::Inelastic, mn.min(mp))
        } else {
            // Elastic LTB: Mn = Fcr * Sx ≤ Mp
            // Fcr = (Cb*π²*E/(Lb/rts)²) * sqrt(1 + 0.078*(J*c/(Sx*ho))*(Lb/rts)²)
            let lb_rts = lb / section.rts;
            let jc_sxho = (section.j * section.c) / (section.sx * section.ho);
            let fcr = (cb * PI.powi(2) * material.e / lb_rts.powi(2))
                * (1.0 + 0.078 * jc_sxho * lb_rts.powi(2)).sqrt();
            let mn = fcr * section.sx;
            (LtbRegime::Elastic, mn.min(mp))
        }
    }

    /// Calculate Cb for non-uniform moment diagrams
    /// Per AISC 360-22 Eq. F1-1
    pub fn calculate_cb(mmax: f64, ma: f64, mb: f64, mc: f64) -> f64 {
        let mmax = mmax.abs();
        let ma = ma.abs();
        let mb = mb.abs();
        let mc = mc.abs();

        if mmax == 0.0 {
            return 1.0;
        }

        // Cb = 12.5*Mmax / (2.5*Mmax + 3*MA + 4*MB + 3*MC)
        let cb = 12.5 * mmax / (2.5 * mmax + 3.0 * ma + 4.0 * mb + 3.0 * mc);
        cb.max(1.0).min(3.0)
    }

    /// Get design strength φMn (LRFD)
    pub fn design_strength_lrfd(&self) -> f64 {
        0.90 * self.mn
    }

    /// Get allowable strength Mn/Ω (ASD)
    pub fn allowable_strength_asd(&self) -> f64 {
        self.mn / 1.67
    }
}

// ============================================================================
// COLUMN STABILITY (AISC Chapter E)
// ============================================================================

/// Column buckling analysis per AISC 360-22 Chapter E
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnBuckling {
    /// Section area (Ag)
    pub ag: f64,
    /// Radius of gyration about buckling axis (r)
    pub r: f64,
    /// Effective length factor (K)
    pub k: f64,
    /// Unbraced length (L)
    pub l: f64,
    /// Slenderness ratio (KL/r)
    pub slenderness: f64,
    /// Critical buckling stress (Fcr)
    pub fcr: f64,
    /// Nominal compressive strength (Pn)
    pub pn: f64,
    /// Material properties
    pub material: SteelMaterial,
    /// Buckling mode
    pub mode: BucklingMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BucklingMode {
    /// Inelastic buckling (KL/r ≤ 4.71√(E/Fy))
    Inelastic,
    /// Elastic buckling (KL/r > 4.71√(E/Fy))
    Elastic,
    /// Slender elements - local buckling controls
    LocalBuckling,
}

impl ColumnBuckling {
    /// Create column buckling analysis per AISC 360-22 E3
    pub fn new(ag: f64, r: f64, k: f64, l: f64, material: SteelMaterial) -> Self {
        let slenderness = k * l / r;
        
        // Limiting slenderness
        let limit = 4.71 * (material.e / material.fy).sqrt();
        
        // Elastic buckling stress Fe
        let fe = PI.powi(2) * material.e / slenderness.powi(2);
        
        // Critical stress Fcr
        let (mode, fcr) = if slenderness <= limit {
            // Inelastic buckling: Fcr = (0.658^(Fy/Fe)) * Fy
            let fcr = (0.658_f64.powf(material.fy / fe)) * material.fy;
            (BucklingMode::Inelastic, fcr)
        } else {
            // Elastic buckling: Fcr = 0.877 * Fe
            let fcr = 0.877 * fe;
            (BucklingMode::Elastic, fcr)
        };
        
        let pn = fcr * ag;

        Self {
            ag,
            r,
            k,
            l,
            slenderness,
            fcr,
            pn,
            material,
            mode,
        }
    }

    /// Get design strength φPn (LRFD)
    pub fn design_strength_lrfd(&self) -> f64 {
        0.90 * self.pn
    }

    /// Get allowable strength Pn/Ω (ASD)
    pub fn allowable_strength_asd(&self) -> f64 {
        self.pn / 1.67
    }

    /// Calculate effective length factor K based on end conditions
    pub fn effective_length_factor(
        top_restraint: EndRestraint,
        bottom_restraint: EndRestraint,
        sway_condition: SwayCondition,
    ) -> f64 {
        match sway_condition {
            SwayCondition::Braced => {
                match (top_restraint, bottom_restraint) {
                    (EndRestraint::Fixed, EndRestraint::Fixed) => 0.65,
                    (EndRestraint::Fixed, EndRestraint::Pinned) |
                    (EndRestraint::Pinned, EndRestraint::Fixed) => 0.80,
                    (EndRestraint::Pinned, EndRestraint::Pinned) => 1.00,
                    (EndRestraint::Fixed, EndRestraint::Free) |
                    (EndRestraint::Free, EndRestraint::Fixed) => 2.10,
                    _ => 1.00,
                }
            }
            SwayCondition::Unbraced => {
                match (top_restraint, bottom_restraint) {
                    (EndRestraint::Fixed, EndRestraint::Fixed) => 1.20,
                    (EndRestraint::Fixed, EndRestraint::Pinned) |
                    (EndRestraint::Pinned, EndRestraint::Fixed) => 2.00,
                    (EndRestraint::Pinned, EndRestraint::Pinned) => f64::INFINITY,
                    (EndRestraint::Fixed, EndRestraint::Free) |
                    (EndRestraint::Free, EndRestraint::Fixed) => 2.10,
                    _ => 2.00,
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EndRestraint {
    Fixed,
    Pinned,
    Free,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SwayCondition {
    Braced,
    Unbraced,
}

// ============================================================================
// CONNECTION LIMIT STATES
// ============================================================================

/// Bolted connection analysis per AISC 360-22 Chapter J
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltedConnection {
    /// Bolt properties
    pub bolt: BoltProperties,
    /// Number of bolts
    pub num_bolts: usize,
    /// Number of shear planes
    pub shear_planes: usize,
    /// Connection type
    pub connection_type: ConnectionType,
    /// Plate properties for bearing check
    pub plate: PlateProperties,
    /// Limit state capacities
    pub capacities: ConnectionCapacities,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoltProperties {
    /// Bolt diameter
    pub diameter: f64,
    /// Bolt area (nominal)
    pub ab: f64,
    /// Nominal shear stress (Fnv)
    pub fnv: f64,
    /// Nominal tensile stress (Fnt)
    pub fnt: f64,
    /// Minimum tensile strength (Fu) for pretension calculation
    pub fu: f64,
    /// Bolt grade (A325, A490, etc.)
    pub grade: String,
    /// Thread condition
    pub threads_excluded: bool,
}

impl BoltProperties {
    /// Create A325 bolt
    pub fn a325(diameter: f64, threads_excluded: bool) -> Self {
        let ab = PI * diameter.powi(2) / 4.0;
        // AISC 360-22 Table J3.2: Group A Fnv = 68 ksi (X) / 54 ksi (N)
        let fnv = if threads_excluded { 469.0 } else { 372.0 }; // MPa
        Self {
            diameter,
            ab,
            fnv,
            fnt: 620.0, // MPa (90 ksi)
            fu: 827.0,  // MPa (120 ksi) min tensile strength
            grade: "A325".to_string(),
            threads_excluded,
        }
    }

    /// Create A490 bolt
    pub fn a490(diameter: f64, threads_excluded: bool) -> Self {
        let ab = PI * diameter.powi(2) / 4.0;
        // AISC 360-22 Table J3.2: Group B Fnv = 84 ksi (X) / 68 ksi (N)
        let fnv = if threads_excluded { 579.0 } else { 469.0 }; // MPa
        Self {
            diameter,
            ab,
            fnv,
            fnt: 780.0, // MPa (113 ksi)
            fu: 1034.0, // MPa (150 ksi) min tensile strength
            grade: "A490".to_string(),
            threads_excluded,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateProperties {
    /// Plate thickness
    pub thickness: f64,
    /// Plate ultimate stress (Fu)
    pub fu: f64,
    /// Plate yield stress (Fy)
    pub fy: f64,
    /// Clear edge distance (Lc)
    pub lc: f64,
    /// Bolt spacing
    pub spacing: f64,
    /// Deformation at bolt hole considered
    pub deformation_considered: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectionType {
    BearingType,
    SlipCritical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionCapacities {
    /// Bolt shear capacity (Rn)
    pub bolt_shear: f64,
    /// Bearing capacity at bolt holes (Rn)
    pub bearing: f64,
    /// Tearout capacity (Rn)
    pub tearout: f64,
    /// Block shear capacity (Rn)
    pub block_shear: Option<f64>,
    /// Slip resistance (Rn) for slip-critical
    pub slip: Option<f64>,
    /// Governing limit state
    pub governing: String,
    /// Connection capacity (min of all)
    pub capacity: f64,
}

impl BoltedConnection {
    /// Calculate bolted connection capacity
    pub fn new(
        bolt: BoltProperties,
        num_bolts: usize,
        shear_planes: usize,
        connection_type: ConnectionType,
        plate: PlateProperties,
    ) -> Self {
        // Bolt shear capacity per AISC J3.6
        // Rn = Fnv * Ab * n_shear_planes
        let bolt_shear = bolt.fnv * bolt.ab * shear_planes as f64 * num_bolts as f64;

        // Bearing capacity per AISC J3.10
        // Rn = 1.2*Lc*t*Fu ≤ 2.4*d*t*Fu (deformation considered)
        // Rn = 1.5*Lc*t*Fu ≤ 3.0*d*t*Fu (deformation not considered)
        let (lc_factor, max_factor) = if plate.deformation_considered {
            (1.2, 2.4)
        } else {
            (1.5, 3.0)
        };
        let bearing = (lc_factor * plate.lc * plate.thickness * plate.fu)
            .min(max_factor * bolt.diameter * plate.thickness * plate.fu)
            * num_bolts as f64;

        // Tearout capacity
        let tearout = lc_factor * plate.lc * plate.thickness * plate.fu * num_bolts as f64;

        // Slip resistance for slip-critical connections
        let slip = if connection_type == ConnectionType::SlipCritical {
            // Rn = μ * hsc * Du * Tb * ns
            // Using μ = 0.35 (Class A), hsc = 1.0, Du = 1.13
            let mu = 0.35;
            let hsc = 1.0;
            let du = 1.13;
            // Minimum bolt pretension from AISC Table J3.1
            // Tb = 0.7 * Fu * Ats; Ats ≈ 0.75*Ab for standard hex bolts (ISO 898)
            let ats = 0.75 * bolt.ab; // tensile stress area ≈ 75% of nominal body area
            let tb = 0.7 * bolt.fu * ats;
            Some(mu * hsc * du * tb * shear_planes as f64 * num_bolts as f64)
        } else {
            None
        };

        // Determine governing limit state
        let mut min_capacity = bolt_shear;
        let mut governing = "Bolt Shear".to_string();

        if bearing < min_capacity {
            min_capacity = bearing;
            governing = "Bearing".to_string();
        }
        if tearout < min_capacity {
            min_capacity = tearout;
            governing = "Tearout".to_string();
        }
        if let Some(s) = slip {
            if s < min_capacity {
                min_capacity = s;
                governing = "Slip".to_string();
            }
        }

        let capacities = ConnectionCapacities {
            bolt_shear,
            bearing,
            tearout,
            block_shear: None, // Requires specific geometry
            slip,
            governing,
            capacity: min_capacity,
        };

        Self {
            bolt,
            num_bolts,
            shear_planes,
            connection_type,
            plate,
            capacities,
        }
    }

    /// Calculate block shear capacity per AISC J4.3
    pub fn calculate_block_shear(
        &mut self,
        agv: f64,   // Gross area subject to shear
        anv: f64,   // Net area subject to shear
        ant: f64,   // Net area subject to tension
        ubs: f64,   // Block shear reduction factor (1.0 or 0.5)
        fu: f64,
        fy: f64,
    ) {
        // Rn = 0.6*Fu*Anv + Ubs*Fu*Ant ≤ 0.6*Fy*Agv + Ubs*Fu*Ant
        let rn1 = 0.6 * fu * anv + ubs * fu * ant;
        let rn2 = 0.6 * fy * agv + ubs * fu * ant;
        let rn = rn1.min(rn2);

        self.capacities.block_shear = Some(rn);

        // Update governing if block shear is lower
        if rn < self.capacities.capacity {
            self.capacities.capacity = rn;
            self.capacities.governing = "Block Shear".to_string();
        }
    }

    /// Get design strength φRn (LRFD)
    pub fn design_strength_lrfd(&self) -> f64 {
        // φ = 0.75 for bolt shear, bearing, tearout, block shear
        // φ = 1.0 for slip (serviceability check per J3.8)
        // Must compare φRn for EACH limit state and take the minimum
        let mut min_phi_rn = 0.75 * self.capacities.bolt_shear;
        min_phi_rn = min_phi_rn.min(0.75 * self.capacities.bearing);
        min_phi_rn = min_phi_rn.min(0.75 * self.capacities.tearout);
        if let Some(bs) = self.capacities.block_shear {
            min_phi_rn = min_phi_rn.min(0.75 * bs);
        }
        if let Some(slip) = self.capacities.slip {
            min_phi_rn = min_phi_rn.min(1.00 * slip);
        }
        min_phi_rn
    }
}

// ============================================================================
// LOCAL BUCKLING (FLB/WLB)
// ============================================================================

/// Local buckling check per AISC 360-22 Table B4.1b
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBuckling {
    /// Section compactness
    pub compactness: SectionCompactness,
    /// Flange slenderness (b/t)
    pub flange_slenderness: f64,
    /// Web slenderness (h/tw)
    pub web_slenderness: f64,
    /// Limiting slenderness for compact flange (λpf)
    pub lambda_pf: f64,
    /// Limiting slenderness for noncompact flange (λrf)
    pub lambda_rf: f64,
    /// Limiting slenderness for compact web (λpw)
    pub lambda_pw: f64,
    /// Limiting slenderness for noncompact web (λrw)
    pub lambda_rw: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SectionCompactness {
    Compact,
    Noncompact,
    Slender,
}

impl LocalBuckling {
    /// Check section compactness for I-shaped sections in flexure
    pub fn check_i_section(
        bf: f64,    // Flange width
        tf: f64,    // Flange thickness
        h: f64,     // Web depth (clear between flanges)
        tw: f64,    // Web thickness
        fy: f64,    // Yield stress
        e: f64,     // Elastic modulus
    ) -> Self {
        let flange_slenderness = bf / (2.0 * tf);
        let web_slenderness = h / tw;

        // Limiting slenderness ratios per AISC Table B4.1b
        let lambda_pf = 0.38 * (e / fy).sqrt();
        let lambda_rf = 1.0 * (e / fy).sqrt();
        let lambda_pw = 3.76 * (e / fy).sqrt();
        let lambda_rw = 5.70 * (e / fy).sqrt();

        // Determine compactness
        let flange_compact = flange_slenderness <= lambda_pf;
        let flange_noncompact = flange_slenderness <= lambda_rf;
        let web_compact = web_slenderness <= lambda_pw;
        let web_noncompact = web_slenderness <= lambda_rw;

        let compactness = if flange_compact && web_compact {
            SectionCompactness::Compact
        } else if flange_noncompact && web_noncompact {
            SectionCompactness::Noncompact
        } else {
            SectionCompactness::Slender
        };

        Self {
            compactness,
            flange_slenderness,
            web_slenderness,
            lambda_pf,
            lambda_rf,
            lambda_pw,
            lambda_rw,
        }
    }

    /// Calculate FLB reduction factor for noncompact flanges
    pub fn flb_reduction(&self, mp: f64, fy: f64, sx: f64) -> f64 {
        if self.flange_slenderness <= self.lambda_pf {
            1.0 // No reduction for compact
        } else if self.flange_slenderness <= self.lambda_rf {
            // Linear interpolation
            let ratio = (self.flange_slenderness - self.lambda_pf) 
                / (self.lambda_rf - self.lambda_pf);
            1.0 - ratio * (1.0 - 0.7 * fy * sx / mp)
        } else {
            // Slender - elastic buckling
            let kc = (4.0 / (self.web_slenderness).sqrt()).clamp(0.35, 0.76);
            0.9 * 200000.0 * kc * sx / (mp * self.flange_slenderness.powi(2))
        }
    }
}

// ============================================================================
// SHEAR CAPACITY
// ============================================================================

/// Shear capacity per AISC 360-22 Chapter G
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShearCapacity {
    /// Web area (Aw = d * tw)
    pub aw: f64,
    /// Web slenderness (h/tw)
    pub web_slenderness: f64,
    /// Web shear coefficient (Cv1 or Cv2)
    pub cv: f64,
    /// Nominal shear strength (Vn)
    pub vn: f64,
    /// Shear regime
    pub regime: ShearRegime,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShearRegime {
    /// No reduction: Cv = 1.0
    Yielding,
    /// Inelastic buckling
    InelasticBuckling,
    /// Elastic buckling
    ElasticBuckling,
}

impl ShearCapacity {
    /// Calculate shear capacity per AISC G2.1
    pub fn new(d: f64, tw: f64, h: f64, fy: f64, e: f64, kv: f64) -> Self {
        let aw = d * tw;
        let web_slenderness = h / tw;

        // Limiting slenderness
        let limit1 = 1.10 * (kv * e / fy).sqrt();
        let limit2 = 1.37 * (kv * e / fy).sqrt();

        let (regime, cv) = if web_slenderness <= limit1 {
            (ShearRegime::Yielding, 1.0)
        } else if web_slenderness <= limit2 {
            let cv = limit1 / web_slenderness;
            (ShearRegime::InelasticBuckling, cv)
        } else {
            let cv = 1.51 * kv * e / (web_slenderness.powi(2) * fy);
            (ShearRegime::ElasticBuckling, cv)
        };

        // Vn = 0.6 * Fy * Aw * Cv
        let vn = 0.6 * fy * aw * cv;

        Self {
            aw,
            web_slenderness,
            cv,
            vn,
            regime,
        }
    }

    /// Get design strength φVn (LRFD)
    pub fn design_strength_lrfd(&self) -> f64 {
        // AISC G2.1(a): φ=1.0 only for rolled I-shapes with h/tw ≤ 2.24√(E/Fy)
        // G2.1(b): φ=0.90 for all other cases
        // Use web_slenderness threshold as proxy for rolled I-shape condition
        let fy_assumed = 345.0_f64; // Typical grade; conservative when Fy is higher
        let limit = 2.24 * (200000.0 / fy_assumed).sqrt();
        let phi = if self.web_slenderness <= limit { 1.0 } else { 0.90 };
        phi * self.vn
    }

    /// Get allowable strength Vn/Ω (ASD)
    pub fn allowable_strength_asd(&self) -> f64 {
        // AISC G2.1(a): Ω=1.50 for rolled I-shapes with h/tw ≤ 2.24√(E/Fy)
        // G2.1(b): Ω=1.67 otherwise
        let fy_assumed = 345.0_f64;
        let limit = 2.24 * (200000.0 / fy_assumed).sqrt();
        let omega = if self.web_slenderness <= limit { 1.50 } else { 1.67 };
        self.vn / omega
    }
}

// ============================================================================
// COMBINED FORCES INTERACTION
// ============================================================================

/// Combined axial and flexure interaction per AISC H1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedInteraction {
    /// Axial demand Pr
    pub pr: f64,
    /// Axial capacity Pc
    pub pc: f64,
    /// Major axis moment demand Mrx
    pub mrx: f64,
    /// Major axis moment capacity Mcx
    pub mcx: f64,
    /// Minor axis moment demand Mry
    pub mry: f64,
    /// Minor axis moment capacity Mcy
    pub mcy: f64,
    /// Interaction ratio
    pub interaction_ratio: f64,
    /// Governing equation
    pub governing_equation: String,
}

impl CombinedInteraction {
    /// Check AISC H1-1 interaction equations
    pub fn check(
        pr: f64, pc: f64,
        mrx: f64, mcx: f64,
        mry: f64, mcy: f64,
    ) -> Self {
        let pr_pc = pr / pc;
        let mrx_mcx = mrx / mcx;
        let mry_mcy = mry / mcy;

        let (interaction_ratio, governing_equation) = if pr_pc >= 0.2 {
            // Eq. H1-1a: Pr/Pc + (8/9)*(Mrx/Mcx + Mry/Mcy) ≤ 1.0
            let ratio = pr_pc + (8.0 / 9.0) * (mrx_mcx + mry_mcy);
            (ratio, "H1-1a".to_string())
        } else {
            // Eq. H1-1b: Pr/(2*Pc) + (Mrx/Mcx + Mry/Mcy) ≤ 1.0
            let ratio = pr_pc / 2.0 + mrx_mcx + mry_mcy;
            (ratio, "H1-1b".to_string())
        };

        Self {
            pr,
            pc,
            mrx,
            mcx,
            mry,
            mcy,
            interaction_ratio,
            governing_equation,
        }
    }

    /// Check if member passes
    pub fn passes(&self) -> bool {
        self.interaction_ratio <= 1.0
    }

    /// Get DCR (Demand/Capacity Ratio)
    pub fn dcr(&self) -> f64 {
        self.interaction_ratio
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_section() -> SteelSection {
        // W16x40 approximate properties
        SteelSection {
            name: "W16x40".to_string(),
            d: 406.0,      // mm
            bf: 178.0,     // mm
            tf: 12.7,      // mm
            tw: 7.7,       // mm
            sx: 963e3,     // mm³
            zx: 1070e3,    // mm³
            ix: 195e6,     // mm⁴
            iy: 15.4e6,    // mm⁴
            ry: 44.4,      // mm
            cw: 523e9,     // mm⁶
            j: 275e3,      // mm⁴
            rts: 51.0,     // mm
            c: 1.0,
            ho: 380.0,     // mm
        }
    }

    #[test]
    fn test_ltb_plastic() {
        let section = sample_section();
        let material = SteelMaterial::default();
        let lb = 1000.0; // Very short unbraced length
        
        let ltb = LateralTorsionalBuckling::new(section, material, lb, 1.0);
        assert_eq!(ltb.regime, LtbRegime::Plastic);
    }

    #[test]
    fn test_column_buckling() {
        let ag = 7680.0; // mm² (W8x31)
        let r = 50.0;    // mm
        let k = 1.0;
        let l = 3000.0;  // mm
        let material = SteelMaterial::default();

        let column = ColumnBuckling::new(ag, r, k, l, material);
        
        // KL/r = 60, should be inelastic for Fy=345
        assert_eq!(column.mode, BucklingMode::Inelastic);
        assert!(column.pn > 0.0);
    }

    #[test]
    fn test_bolt_capacity() {
        let bolt = BoltProperties::a325(20.0, false); // 20mm A325-N
        let plate = PlateProperties {
            thickness: 12.0,
            fu: 400.0,
            fy: 250.0,
            lc: 30.0,
            spacing: 60.0,
            deformation_considered: true,
        };

        let connection = BoltedConnection::new(
            bolt,
            4,  // 4 bolts
            1,  // single shear
            ConnectionType::BearingType,
            plate,
        );

        assert!(connection.capacities.bolt_shear > 0.0);
        assert!(connection.capacities.bearing > 0.0);
    }

    #[test]
    fn test_interaction() {
        let check = CombinedInteraction::check(
            500.0, 2000.0,  // Pr/Pc = 0.25
            100.0, 400.0,   // Mrx/Mcx = 0.25
            50.0, 200.0,    // Mry/Mcy = 0.25
        );

        // Using H1-1a: 0.25 + 8/9 * (0.25 + 0.25) = 0.25 + 0.444 = 0.694
        assert!(check.passes());
        assert_eq!(check.governing_equation, "H1-1a");
    }

    #[test]
    fn test_shear_capacity() {
        let shear = ShearCapacity::new(
            406.0,   // d
            7.7,     // tw
            380.0,   // h
            345.0,   // Fy
            200000.0, // E
            5.34,    // kv for unstiffened web
        );

        assert!(shear.vn > 0.0);
    }
}
