/**
 * design_codes.rs - Indian Standard Design Code Calculations
 * 
 * Implements structural design formulas from:
 * - IS 456:2000 - Plain and Reinforced Concrete
 * - IS 800:2007 - General Construction in Steel
 * - IS 1893:2016 - Earthquake Resistant Design
 * - IS 875 - Design Loads
 * 
 * All calculations follow Limit State Method (LSM)
 */

use serde::{Deserialize, Serialize};

// ============================================
// IS 456:2000 - RCC DESIGN
// ============================================

pub mod is_456 {
    use super::*;
    
    /// Concrete grades per IS 456
    #[derive(Serialize, Deserialize, Debug, Clone, Copy)]
    pub enum ConcreteGrade {
        M15, M20, M25, M30, M35, M40, M45, M50, M55, M60, M65, M70, M75, M80
    }
    
    impl ConcreteGrade {
        /// Characteristic compressive strength (fck) in N/mm²
        pub fn fck(&self) -> f64 {
            match self {
                Self::M15 => 15.0, Self::M20 => 20.0, Self::M25 => 25.0,
                Self::M30 => 30.0, Self::M35 => 35.0, Self::M40 => 40.0,
                Self::M45 => 45.0, Self::M50 => 50.0, Self::M55 => 55.0,
                Self::M60 => 60.0, Self::M65 => 65.0, Self::M70 => 70.0,
                Self::M75 => 75.0, Self::M80 => 80.0,
            }
        }
        
        /// Modulus of elasticity (Ec) per Cl. 6.2.3.1
        pub fn elastic_modulus(&self) -> f64 {
            5000.0 * self.fck().sqrt() // N/mm²
        }
    }
    
    /// Steel grades per IS 1786
    #[derive(Serialize, Deserialize, Debug, Clone, Copy)]
    pub enum SteelGrade {
        Fe250, Fe415, Fe500, Fe500D, Fe550, Fe550D
    }
    
    impl SteelGrade {
        /// Characteristic yield strength (fy) in N/mm²
        pub fn fy(&self) -> f64 {
            match self {
                Self::Fe250 => 250.0, Self::Fe415 => 415.0,
                Self::Fe500 => 500.0, Self::Fe500D => 500.0,
                Self::Fe550 => 550.0, Self::Fe550D => 550.0,
            }
        }
    }
    
    /// Singly reinforced beam capacity (Cl. 38.1)
    /// Returns ultimate moment capacity Mu in kN-m
    pub fn flexural_capacity_singly(
        b: f64,     // Width (mm)
        d: f64,     // Effective depth (mm)
        fck: f64,   // Concrete strength (N/mm²)
        fy: f64,    // Steel yield strength (N/mm²)
        ast: f64,   // Area of tension steel (mm²)
    ) -> f64 {
        // Design constants
        let _gamma_c = 1.5;  // Partial safety factor for concrete
        let _gamma_s = 1.15; // Partial safety factor for steel
        
        // Neutral axis depth
        // IS 456: 0.87*fy already includes gamma_s (0.87 ≈ 1/1.15)
        // 0.36*fck already includes gamma_c in the stress block
        let xu = (0.87 * fy * ast) / (0.36 * fck * b);
        
        // Check if section is under-reinforced
        // xu_max/d depends on steel grade per IS 456 Table E
        let xu_max_ratio = if fy <= 300.0 { 0.53 }      // Fe250
                           else if fy <= 415.0 { 0.48 }  // Fe415
                           else { 0.46 };                  // Fe500
        let xu_max = xu_max_ratio * d;
        
        let xu_limited = xu.min(xu_max);
        
        // Lever arm
        let z = d - 0.42 * xu_limited;
        
        // Ultimate moment (kN-m)
        // 0.87*fy already includes γs, do NOT divide by γs again
        0.87 * fy * ast * z / 1e6
    }
    
    /// Doubly reinforced beam capacity
    pub fn flexural_capacity_doubly(
        b: f64,     // Width (mm)
        d: f64,     // Effective depth (mm)
        d_prime: f64, // Compression steel cover (mm)
        fck: f64,   // Concrete strength (N/mm²)
        fy: f64,    // Steel yield strength (N/mm²)
        _ast: f64,   // Area of tension steel (mm²)
        asc: f64,   // Area of compression steel (mm²)
    ) -> f64 {
        // Moment from balanced section
        // xu_max/d depends on steel grade per IS 456 Table E
        let xu_max_ratio = if fy <= 300.0 { 0.53 } else if fy <= 415.0 { 0.48 } else { 0.46 };
        let xu_max = xu_max_ratio * d;
        let mu_lim = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max) / 1e6;
        
        // Additional moment from compression steel
        let fsc = 0.87 * fy;  // Simplified
        let mu2 = asc * fsc * (d - d_prime) / 1e6;
        
        mu_lim + mu2
    }
    
    /// Shear capacity (Cl. 40.2)
    /// Returns permissible shear stress τc in N/mm² per IS 456 Table 19
    pub fn shear_stress_permissible(fck: f64, pt: f64) -> f64 {
        // IS 456 Table 19: τc values for concrete grade M20 (scale for other grades)
        // pt(%)   τc (N/mm²) for M20
        // 0.15    0.28
        // 0.25    0.36
        // 0.50    0.48
        // 0.75    0.56
        // 1.00    0.62
        // 1.50    0.72
        // 2.00    0.79
        // 2.50    0.82
        // 3.00    0.82
        let pt_clamped = pt.max(0.15).min(3.0);
        
        // Reference interpolation from IS 456 Table 19 for M20 concrete (kept for verification)
        let _tau_c_m20 = if pt_clamped <= 0.25 {
            0.28 + (0.36 - 0.28) * (pt_clamped - 0.15) / 0.10
        } else if pt_clamped <= 0.50 {
            0.36 + (0.48 - 0.36) * (pt_clamped - 0.25) / 0.25
        } else if pt_clamped <= 0.75 {
            0.48 + (0.56 - 0.48) * (pt_clamped - 0.50) / 0.25
        } else if pt_clamped <= 1.00 {
            0.56 + (0.62 - 0.56) * (pt_clamped - 0.75) / 0.25
        } else if pt_clamped <= 1.50 {
            0.62 + (0.72 - 0.62) * (pt_clamped - 1.00) / 0.50
        } else if pt_clamped <= 2.00 {
            0.72 + (0.79 - 0.72) * (pt_clamped - 1.50) / 0.50
        } else if pt_clamped <= 2.50 {
            0.79 + (0.82 - 0.79) * (pt_clamped - 2.00) / 0.50
        } else {
            0.82
        };
        
        // Scale for concrete grade using SP-16 derivation formula (exact basis of IS 456 Table 19)
        // τc = 0.85 × √(0.8fck) × (√(1+5β) − 1) / (6β)
        // where β = max(0.8fck / (6.89 × pt), 1.0)
        let beta = (0.8 * fck / (6.89 * pt_clamped)).max(1.0);
        let tau_c = 0.85 * (0.8 * fck).sqrt() * ((1.0 + 5.0 * beta).sqrt() - 1.0) / (6.0 * beta);
        let tau_c_max = 0.63 * fck.sqrt(); // Maximum shear stress (Table 20)
        
        tau_c.min(tau_c_max).max(0.0)
    }
    
    /// Design shear reinforcement (Cl. 40.4)
    /// Returns required stirrup spacing in mm
    pub fn shear_reinforcement_spacing(
        vu: f64,    // Design shear force (kN)
        b: f64,     // Width (mm)
        d: f64,     // Effective depth (mm)
        fck: f64,   // Concrete strength (N/mm²)
        fy: f64,    // Stirrup yield strength (N/mm²)
        pt: f64,    // Tension steel percentage
        asv: f64,   // Area of stirrup legs (mm²)
    ) -> f64 {
        let tau_v = vu * 1000.0 / (b * d);  // N/mm²
        let tau_c = shear_stress_permissible(fck, pt);
        
        let vus = (tau_v - tau_c) * b * d;  // Shear to be resisted by stirrups
        
        if vus <= 0.0 {
            // Minimum spacing
            return (0.75 * d).min(300.0);
        }
        
        // Sv = 0.87 * fy * Asv * d / Vus
        let sv = 0.87 * fy * asv * d / vus;
        
        sv.min(0.75 * d).min(300.0)
    }
    
    /// Development length (Cl. 26.2.1)
    pub fn development_length(
        phi: f64,   // Bar diameter (mm)
        fy: f64,    // Steel yield strength (N/mm²)
        fck: f64,   // Concrete strength (N/mm²)
    ) -> f64 {
        // Bond stress (Table 26.2.1.1) - base values × 1.6 for deformed bars
        let tau_bd = if fck <= 15.0 {
            1.0 * 1.6  // M15
        } else if fck <= 20.0 {
            1.2 * 1.6  // M20
        } else if fck <= 25.0 {
            1.4 * 1.6  // M25
        } else if fck <= 30.0 {
            1.5 * 1.6  // M30
        } else if fck <= 35.0 {
            1.7 * 1.6  // M35
        } else {
            1.9 * 1.6  // M40 and above
        };
        
        // Ld = ψ * σs / (4 * τbd)
        let sigma_s = 0.87 * fy;
        phi * sigma_s / (4.0 * tau_bd)
    }
    
    /// Deflection limit (Cl. 23.2)
    pub fn span_to_depth_ratio(
        span_type: &str,
        _pt: f64,    // Tension steel percentage
        _fs: f64,    // Service stress in steel
    ) -> f64 {
        let basic_ratio = match span_type {
            "cantilever" => 7.0,
            "simply_supported" => 20.0,
            "continuous" => 26.0,
            _ => 20.0,
        };
        
        // Modification factors
        let mf_tension = 1.0;  // Simplified
        let mf_compression = 1.0;
        
        basic_ratio * mf_tension * mf_compression
    }
}

// ============================================
// IS 800:2007 - STEEL DESIGN
// ============================================

pub mod is_800 {
    use super::*;
    
    /// Steel section type
    #[derive(Serialize, Deserialize, Debug, Clone)]
    #[allow(non_snake_case)]
    pub struct SteelSection {
        pub designation: String,
        pub A: f64,      // Area (mm²)
        pub Ixx: f64,    // Moment of inertia XX (mm⁴)
        pub Iyy: f64,    // Moment of inertia YY (mm⁴)
        pub Zxx: f64,    // Section modulus XX (mm³)
        pub Zyy: f64,    // Section modulus YY (mm³)
        pub rxx: f64,    // Radius of gyration XX (mm)
        pub ryy: f64,    // Radius of gyration YY (mm)
        pub D: f64,      // Depth (mm)
        pub B: f64,      // Flange width (mm)
        pub tf: f64,     // Flange thickness (mm)
        pub tw: f64,     // Web thickness (mm)
    }
    
    /// Plastic moment capacity (Cl. 8.2.1.2)
    pub fn plastic_moment_capacity(section: &SteelSection, fy: f64) -> f64 {
        let gamma_m0 = 1.10;  // Partial safety factor
        
        // Plastic section modulus (approximate)
        let zpxx = 1.15 * section.Zxx;  // For I-sections
        
        // Md = βb * Zp * fy / γm0
        let beta_b = 1.0;  // Class 1 section
        
        beta_b * zpxx * fy / (gamma_m0 * 1e6)  // kN-m
    }
    
    /// Shear capacity (Cl. 8.4)
    pub fn shear_capacity(section: &SteelSection, fy: f64) -> f64 {
        let gamma_m0 = 1.10;
        
        // Shear area for I-section
        let av = section.D * section.tw;
        
        // Vd = Av * fyw / (√3 * γm0)
        let fyw = fy;  // Web yield strength
        
        av * fyw / (3.0_f64.sqrt() * gamma_m0 * 1000.0)  // kN
    }
    
    /// Axial compression capacity (Cl. 7.1.2)
    #[allow(non_snake_case)]
    pub fn compression_capacity(
        section: &SteelSection, 
        fy: f64, 
        E: f64,
        l_eff_xx: f64,  // Effective length XX (mm)
        l_eff_yy: f64,  // Effective length YY (mm)
    ) -> f64 {
        let gamma_m0 = 1.10;
        
        // Slenderness ratios
        let lambda_xx = l_eff_xx / section.rxx;
        let lambda_yy = l_eff_yy / section.ryy;
        let lambda = lambda_xx.max(lambda_yy);
        
        // Non-dimensional slenderness
        let lambda_e = (lambda / std::f64::consts::PI) * (fy / E).sqrt();
        
        // Imperfection factor (buckling curve b for rolled sections)
        let alpha = 0.34;
        
        // Stress reduction factor
        let phi = 0.5 * (1.0 + alpha * (lambda_e - 0.2) + lambda_e.powi(2));
        let chi = (phi + (phi.powi(2) - lambda_e.powi(2)).sqrt()).recip();
        let chi = chi.min(1.0);
        
        // Design strength
        let fcd = chi * fy / gamma_m0;
        
        section.A * fcd / 1000.0  // kN
    }
    
    /// Tension capacity (Cl. 6.2)
    pub fn tension_capacity(section: &SteelSection, fy: f64, fu: f64) -> f64 {
        let gamma_m0 = 1.10;
        let gamma_m1 = 1.25;
        
        // Yielding of gross section
        let tdg = section.A * fy / (gamma_m0 * 1000.0);
        
        // Rupture of net section (assuming 15% reduction for holes)
        let an = 0.85 * section.A;
        let tdn = 0.9 * an * fu / (gamma_m1 * 1000.0);
        
        tdg.min(tdn)  // kN
    }
    
    /// Combined axial and bending check (Cl. 9.3.1)
    pub fn interaction_ratio(
        p: f64,     // Axial force (kN)
        mxx: f64,   // Moment XX (kN-m)
        myy: f64,   // Moment YY (kN-m)
        nd: f64,    // Axial capacity (kN)
        mdxx: f64,  // Moment capacity XX (kN-m)
        mdyy: f64,  // Moment capacity YY (kN-m)
    ) -> f64 {
        // Linear interaction
        (p / nd) + (mxx / mdxx) + (myy / mdyy)
    }
}

// ============================================
// IS 1893:2016 - SEISMIC DESIGN
// ============================================

pub mod is_1893 {
    use super::*;
    
    /// Seismic zones per IS 1893
    #[derive(Serialize, Deserialize, Debug, Clone, Copy)]
    pub enum SeismicZone {
        II, III, IV, V
    }
    
    impl SeismicZone {
        /// Zone factor (Z) per Table 3
        pub fn z_factor(&self) -> f64 {
            match self {
                Self::II => 0.10,
                Self::III => 0.16,
                Self::IV => 0.24,
                Self::V => 0.36,
            }
        }
    }
    
    /// Soil types per IS 1893
    #[derive(Serialize, Deserialize, Debug, Clone, Copy)]
    pub enum SoilType {
        I,   // Rock or hard soil
        II,  // Medium soil
        III, // Soft soil
    }
    
    /// Design horizontal acceleration coefficient (Cl. 6.4.2)
    /// Ah = (Z/2) * (I/R) * (Sa/g)
    pub fn design_horizontal_coefficient(
        zone: SeismicZone,
        importance_factor: f64,  // I (Table 8)
        response_reduction: f64, // R (Table 9)
        sa_g: f64,               // Spectral acceleration coefficient
    ) -> f64 {
        let z = zone.z_factor();
        (z / 2.0) * (importance_factor / response_reduction) * sa_g
    }
    
    /// Spectral acceleration coefficient (Sa/g) per Cl. 6.4.2
    pub fn spectral_acceleration(
        t: f64,          // Natural period (s)
        soil_type: SoilType,
        damping: f64,    // Damping ratio (e.g., 0.05 for 5%)
    ) -> f64 {
        // Damping factor per IS 1893:2016 Table 3
        // Values: 0% -> 3.20, 2% -> 1.40, 5% -> 1.00, 7% -> 0.90, 10% -> 0.80, 15% -> 0.70, 20% -> 0.60, 25% -> 0.55, 30% -> 0.50
        let damping_pct = damping * 100.0;
        let eta = if damping_pct <= 0.0 { 3.20 }
                  else if damping_pct <= 2.0 { 3.20 - (3.20 - 1.40) * damping_pct / 2.0 }
                  else if damping_pct <= 5.0 { 1.40 - (1.40 - 1.00) * (damping_pct - 2.0) / 3.0 }
                  else if damping_pct <= 7.0 { 1.00 - (1.00 - 0.90) * (damping_pct - 5.0) / 2.0 }
                  else if damping_pct <= 10.0 { 0.90 - (0.90 - 0.80) * (damping_pct - 7.0) / 3.0 }
                  else if damping_pct <= 15.0 { 0.80 - (0.80 - 0.70) * (damping_pct - 10.0) / 5.0 }
                  else if damping_pct <= 20.0 { 0.70 - (0.70 - 0.60) * (damping_pct - 15.0) / 5.0 }
                  else if damping_pct <= 25.0 { 0.60 - (0.60 - 0.55) * (damping_pct - 20.0) / 5.0 }
                  else { (0.55 - (0.55 - 0.50) * (damping_pct - 25.0) / 5.0).max(0.50) };
        
        let sa_g = match soil_type {
            SoilType::I => {
                if t <= 0.10 { 1.0 + 15.0 * t }
                else if t <= 0.40 { 2.5 }
                else if t <= 4.0 { 1.0 / t }
                else { 0.25 }
            },
            SoilType::II => {
                if t <= 0.10 { 1.0 + 15.0 * t }
                else if t <= 0.55 { 2.5 }
                else if t <= 4.0 { 1.36 / t }
                else { 0.34 }
            },
            SoilType::III => {
                if t <= 0.10 { 1.0 + 15.0 * t }
                else if t <= 0.67 { 2.5 }
                else if t <= 4.0 { 1.67 / t }
                else { 0.42 }
            },
        };
        
        sa_g * eta
    }
    
    /// Design base shear (Cl. 7.6.1)
    /// VB = Ah * W
    pub fn base_shear(ah: f64, seismic_weight: f64) -> f64 {
        ah * seismic_weight
    }
    
    /// Vertical distribution of base shear (Cl. 7.6.3)
    /// Qi = VB * (Wi * hi²) / Σ(Wj * hj²)
    pub fn vertical_distribution(
        base_shear: f64,
        floor_weights: &[f64],  // Wi
        floor_heights: &[f64],  // hi from base
    ) -> Vec<f64> {
        let sum_wi_hi2: f64 = floor_weights.iter()
            .zip(floor_heights.iter())
            .map(|(w, h)| w * h * h)
            .sum();
        
        if sum_wi_hi2.abs() < 1e-20 {
            return vec![0.0; floor_weights.len()];
        }
        
        floor_weights.iter()
            .zip(floor_heights.iter())
            .map(|(w, h)| base_shear * w * h * h / sum_wi_hi2)
            .collect()
    }
    
    /// Approximate natural period for moment-resisting frames (Cl. 7.6.2)
    pub fn natural_period_frame(height: f64, frame_type: &str) -> f64 {
        match frame_type {
            "steel_moment_frame" => 0.085 * height.powf(0.75),
            "rc_moment_frame" => 0.075 * height.powf(0.75),
            "rc_shear_wall" => 0.075 * height.powf(0.75) * 0.75,
            // IS 1893 Cl. 7.6.2: T = 0.09*h/sqrt(d) where d = base dimension along
            // direction of vibration. Without base dimension info, use height as 
            // conservative estimate (gives longer period = lower Sa/g)
            "masonry" => 0.09 * height / height.sqrt(),
            _ => 0.075 * height.powf(0.75),
        }
    }
    
    /// Response reduction factor R for different systems (Table 9)
    pub fn response_reduction_factor(system_type: &str) -> f64 {
        match system_type {
            "smrf_special" => 5.0,
            "smrf_ordinary" => 3.0,
            "braced_concentric" => 4.0,
            "braced_eccentric" => 5.0,
            "shear_wall_coupled" => 4.0,
            "shear_wall_uncoupled" => 3.0,
            "dual_system" => 5.0,
            _ => 3.0,
        }
    }
}

// ============================================
// IS 875 - DESIGN LOADS
// ============================================

pub mod is_875 {
    #[allow(unused_imports)]
    use super::*;
    
    /// Wind speed zones per IS 875-3
    pub fn basic_wind_speed(zone: u8) -> f64 {
        match zone {
            1 => 33.0,  // m/s
            2 => 39.0,
            3 => 44.0,
            4 => 47.0,
            5 => 50.0,
            6 => 55.0,
            _ => 44.0,
        }
    }
    
    /// Design wind speed (Cl. 5.3)
    /// Vz = Vb * k1 * k2 * k3 * k4
    pub fn design_wind_speed(
        vb: f64,    // Basic wind speed (m/s)
        k1: f64,    // Risk coefficient (Table 1)
        k2: f64,    // Terrain & height factor
        k3: f64,    // Topography factor
        k4: f64,    // Importance factor (cyclone)
    ) -> f64 {
        vb * k1 * k2 * k3 * k4
    }
    
    /// Design wind pressure (Cl. 5.4)
    /// pz = 0.6 * Vz²
    pub fn design_wind_pressure(vz: f64) -> f64 {
        0.6 * vz * vz  // N/m²
    }
    
    /// Wind force on structure
    /// F = Cf * Ae * pz
    pub fn wind_force(
        cf: f64,    // Force coefficient
        ae: f64,    // Effective area (m²)
        pz: f64,    // Wind pressure (N/m²)
    ) -> f64 {
        cf * ae * pz  // N
    }
    
    /// Terrain category factor k2 (Table 2)
    pub fn terrain_factor(category: u8, height: f64) -> f64 {
        // Simplified - full table has more height intervals
        let base = match category {
            1 => 1.05,  // Category 1 (sea coast)
            2 => 1.00,  // Category 2 (open terrain)
            3 => 0.91,  // Category 3 (suburban)
            4 => 0.80,  // Category 4 (city center)
            _ => 1.00,
        };
        
        // Height adjustment (simplified)
        let height_factor = if height <= 10.0 {
            1.0
        } else if height <= 50.0 {
            1.0 + 0.1 * (height - 10.0) / 40.0
        } else {
            1.15 * (height / 50.0).powf(0.1)
        };
        
        base * height_factor
    }
}

// ============================================
// AISC 360-16 - STEEL DESIGN (LRFD)
// ============================================

pub mod aisc360 {
    use super::*;
    use std::f64::consts::PI;

    #[derive(Serialize, Deserialize, Debug, Clone)]
    pub struct AISCSection {
        pub area: f64,    // in²
        pub d: f64,       // depth (in)
        pub bf: f64,      // flange width (in)
        pub tw: f64,      // web thickness (in)
        pub tf: f64,      // flange thickness (in)
        pub rx: f64,      // radius of gyration x (in)
        pub ry: f64,      // radius of gyration y (in)
        pub zx: f64,      // plastic modulus x (in³)
        pub zy: f64,      // plastic modulus y (in³)
        pub sx: f64,      // elastic modulus x (in³)
        pub sy: f64,      // elastic modulus y (in³)
        pub j: f64,       // torsional constant (in⁴)
        pub cw: f64,      // warping constant (in⁶)
    }

    /// LRFD Resistance Factors
    const PHI_T: f64 = 0.90; // Tension
    const PHI_C: f64 = 0.90; // Compression
    const PHI_B: f64 = 0.90; // Flexure
    #[allow(dead_code)]
    const PHI_V: f64 = 0.90; // Shear

    /// Tension Capacity (phiPn) - Yielding (Chapter D)
    pub fn tension_yielding(ag: f64, fy: f64) -> f64 {
        PHI_T * fy * ag
    }

    /// Compression Capacity (phiPn) - Flexural Buckling (Chapter E)
    #[allow(non_snake_case)]
    pub fn compression_capacity(
        section: &AISCSection, 
        fy: f64, 
        E: f64, 
        lc_x: f64, // Effective length x (in)
        lc_y: f64  // Effective length y (in)
    ) -> f64 {
        // E3. Flexural Buckling
        let slenderness_x = lc_x / section.rx;
        let slenderness_y = lc_y / section.ry;
        let lc_r = slenderness_x.max(slenderness_y);

        let fe = (PI.powi(2) * E) / lc_r.powi(2);

        let fcr = if lc_r <= 4.71 * (E / fy).sqrt() {
            // Inelastic buckling
            (0.658f64.powf(fy / fe)) * fy
        } else {
            // Elastic buckling
            0.877 * fe
        };

        PHI_C * fcr * section.area
    }

    /// Flexural Capacity (phiMn) - Major Axis (Chapter F)
    /// Assumes Compact Doubly Symmetric I-Shape
    #[allow(non_snake_case)]
    pub fn flexural_capacity_major(
        section: &AISCSection,
        fy: f64,
        E: f64,
        lb: f64, // Unbraced length (in)
        cb: f64
    ) -> f64 {
        // F2. Yielding (Plastic Moment)
        let mp = fy * section.zx;
        
        // Lateral-Torsional Buckling (LTB)
        // Limiting lengths Lp and Lr
        let _rts = (section.ry.sqrt() * section.cw.sqrt()).sqrt() / 0.8; // Approx if rts not given? 
        // Accurate rts formula: sqrt(sqrt(Iy*Cw)/Sx) ? No, rts^2 = sqrt(IyCw)/Sx is approx
        // Let's use simplified rts approx if not passed: rts approx 1.25 Ry roughly for W-shapes.
        // Actually we can compute rts from properties if we had I_y and Cw.
        // rts = sqrt( sqrt(Iy * Cw) / Sx )
        // Using property struct directly.
        // But Section struct above has Cw. So use it.
        // Note: Iy = Ay * ry^2 ... we have ry.
        let iy = section.area * section.ry.powi(2); // very rough approx if Ay not separate? Ah, ry is for whole section.
        let rts_sq = (iy * section.cw).sqrt() / section.sx;
        let rts = rts_sq.sqrt(); 

        let lp = 1.76 * section.ry * (E / fy).sqrt();
        
        let h0 = section.d - section.tf; // dist between flange centroids approx
        let j = section.j;
        let sx = section.sx;
        
        // Lr formula (F2-6)
        let c = 1.0; // For doubly symmetric I-shape
        let term1 = 1.95 * rts * (E / (0.7 * fy));
        let term2 = (j * c) / (sx * h0);
        let term3 = (j * c / (sx * h0)).powi(2) + 6.76 * (0.7 * fy / E).powi(2);
        let lr = term1 * (term2 + term3.sqrt()).sqrt();

        let mn = if lb <= lp {
            // Zone 1: Plastic yielding
            mp
        } else if lb > lr {
            // Zone 3: Elastic LTB
            let fcr = (cb * PI.powi(2) * E) / (lb / rts).powi(2) * 
                     (1.0 + 0.078 * (j * c / (sx * h0)) * (lb / rts).powi(2)).sqrt();
            fcr * sx
        } else {
            // Zone 2: Inelastic LTB
            // Mn = Cb * [Mp - (Mp - 0.7FySx)((Lb-Lp)/(Lr-Lp))] <= Mp
            let factor = (lb - lp) / (lr - lp);
            let m_residual = 0.7 * fy * sx;
            cb * (mp - (mp - m_residual) * factor)
        };

        let mn_final = mn.min(mp);
        PHI_B * mn_final
    }
}

// ============================================
// WASM BINDINGS
// ============================================

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn calculate_beam_capacity(
    b: f64, d: f64, fck: f64, fy: f64, ast: f64
) -> f64 {
    is_456::flexural_capacity_singly(b, d, fck, fy, ast)
}

#[wasm_bindgen]
pub fn calculate_seismic_base_shear(
    zone: u8,
    importance: f64,
    r_factor: f64,
    period: f64,
    soil: u8,
    weight: f64,
) -> f64 {
    let zone_enum = match zone {
        2 => is_1893::SeismicZone::II,
        3 => is_1893::SeismicZone::III,
        4 => is_1893::SeismicZone::IV,
        5 => is_1893::SeismicZone::V,
        _ => is_1893::SeismicZone::III,
    };
    
    let soil_enum = match soil {
        1 => is_1893::SoilType::I,
        2 => is_1893::SoilType::II,
        3 => is_1893::SoilType::III,
        _ => is_1893::SoilType::II,
    };
    
    let sa_g = is_1893::spectral_acceleration(period, soil_enum, 0.05);
    let ah = is_1893::design_horizontal_coefficient(zone_enum, importance, r_factor, sa_g);
    is_1893::base_shear(ah, weight)
}

#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn calculate_aisc_capacity(
    d: f64, bf: f64, tw: f64, tf: f64, 
    rx: f64, ry: f64, zx: f64, zy: f64, sx: f64, sy: f64,
    j: f64, cw: f64, ag: f64,
    fy: f64, E: f64,
    lb: f64, lc_x: f64, lc_y: f64, cb: f64
) -> JsValue {
    let section = aisc360::AISCSection {
        d, bf, tw, tf, rx, ry, zx, zy, sx, sy, j, cw, area: ag
    };
    
    let pn_comp = aisc360::compression_capacity(&section, fy, E, lc_x, lc_y);
    let mn_flex = aisc360::flexural_capacity_major(&section, fy, E, lb, cb);
    let pn_tens = aisc360::tension_yielding(ag, fy);
    
    // Return Object { Pn_c, Mn, Pn_t }
    let result = serde_json::json!({
        "Pn_compression": pn_comp,
        "Mn_major": mn_flex,
        "Pn_tension": pn_tens
    });
    
    serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
}
