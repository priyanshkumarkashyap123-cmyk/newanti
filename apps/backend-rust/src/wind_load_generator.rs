//! # Wind Load Generator Module
//! 
//! Automatic wind load generation per international codes:
//! - **ASCE 7-22** - American Society of Civil Engineers
//! - **IS 875 Part 3** - Indian Standard Wind Loads
//! - **EN 1991-1-4** - Eurocode 1 Wind Actions
//! - **AS/NZS 1170.2** - Australian/NZ Wind Actions
//! 
//! This is CRITICAL for US and international markets.

use serde::{Deserialize, Serialize};

// ============================================================================
// ASCE 7-22 WIND LOADS
// ============================================================================

/// ASCE 7-22 Risk Category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AscRiskCategory {
    /// Low hazard to human life (I)
    I,
    /// Standard occupancy (II)
    II,
    /// Substantial hazard (III)
    III,
    /// Essential facilities (IV)
    IV,
}

impl AscRiskCategory {
    /// Importance factor (Table 1.5-2)
    pub fn importance_factor(&self) -> f64 {
        match self {
            Self::I => 1.00,
            Self::II => 1.00,
            Self::III => 1.15,
            Self::IV => 1.15,
        }
    }
}

/// ASCE 7-22 Exposure Category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AscExposure {
    /// Urban centers (B)
    B,
    /// Suburban/wooded areas (C)
    C,
    /// Flat open terrain (D)
    D,
}

impl AscExposure {
    /// Surface roughness parameters (Table 26.11-1)
    pub fn roughness_params(&self) -> (f64, f64, f64) {
        // (alpha, zg, z_min)
        match self {
            Self::B => (7.0, 365.76, 9.14),   // 1200 ft, 30 ft
            Self::C => (9.5, 274.32, 4.57),   // 900 ft, 15 ft
            Self::D => (11.5, 213.36, 2.13),  // 700 ft, 7 ft
        }
    }
    
    /// Terrain exposure constants (Table 26.11-1)
    pub fn terrain_constants(&self) -> (f64, f64) {
        // (c, l)
        match self {
            Self::B => (0.30, 97.54),   // 320 ft
            Self::C => (0.20, 152.4),   // 500 ft
            Self::D => (0.15, 213.36),  // 700 ft
        }
    }
}

/// Enclosure classification
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum EnclosureClass {
    /// Enclosed building
    Enclosed,
    /// Partially enclosed
    PartiallyEnclosed,
    /// Partially open
    PartiallyOpen,
    /// Open building
    Open,
}

impl EnclosureClass {
    /// Internal pressure coefficient (Table 26.13-1)
    pub fn gcp_i(&self) -> (f64, f64) {
        // (positive, negative)
        match self {
            Self::Enclosed => (0.18, -0.18),
            Self::PartiallyEnclosed => (0.55, -0.55),
            Self::PartiallyOpen => (0.0, 0.0),
            Self::Open => (0.0, 0.0),
        }
    }
}

/// Building type for MWFRS
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum BuildingType {
    /// Low-rise (h ≤ 60 ft and h ≤ L)
    LowRise,
    /// Buildings of all heights
    AllHeights,
    /// Open buildings
    OpenBuildings,
}

/// ASCE 7-22 Wind Load Calculator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asce7WindLoad {
    /// Basic wind speed V (m/s)
    pub v_basic: f64,
    /// Risk category
    pub risk_category: AscRiskCategory,
    /// Exposure category
    pub exposure: AscExposure,
    /// Enclosure classification
    pub enclosure: EnclosureClass,
    /// Building type
    pub building_type: BuildingType,
    /// Mean roof height (m)
    pub h: f64,
    /// Building length parallel to wind (m)
    pub l: f64,
    /// Building width perpendicular to wind (m)
    pub b: f64,
    /// Directionality factor Kd (default 0.85)
    pub kd: f64,
    /// Topographic factor Kzt (default 1.0)
    pub kzt: f64,
    /// Ground elevation factor Ke (default 1.0)
    pub ke: f64,
}

impl Asce7WindLoad {
    /// Create new wind load calculator with defaults
    pub fn new(v_basic: f64, h: f64, l: f64, b: f64) -> Self {
        Self {
            v_basic,
            risk_category: AscRiskCategory::II,
            exposure: AscExposure::C,
            enclosure: EnclosureClass::Enclosed,
            building_type: BuildingType::AllHeights,
            h, l, b,
            kd: 0.85,
            kzt: 1.0,
            ke: 1.0,
        }
    }
    
    /// Set risk category
    pub fn with_risk(mut self, risk: AscRiskCategory) -> Self {
        self.risk_category = risk;
        self
    }
    
    /// Set exposure
    pub fn with_exposure(mut self, exp: AscExposure) -> Self {
        self.exposure = exp;
        self
    }
    
    /// Set enclosure
    pub fn with_enclosure(mut self, enc: EnclosureClass) -> Self {
        self.enclosure = enc;
        self
    }
    
    /// Velocity pressure exposure coefficient Kz (Eq. 26.10-1)
    pub fn kz(&self, z: f64) -> f64 {
        let (alpha, zg, z_min) = self.exposure.roughness_params();
        let z_eff = z.max(z_min);
        
        2.01 * (z_eff / zg).powf(2.0 / alpha)
    }
    
    /// Velocity pressure qz (Pa) (Eq. 26.10-1)
    pub fn qz(&self, z: f64) -> f64 {
        let kz = self.kz(z);
        
        // qz = 0.613 * Kz * Kzt * Kd * Ke * V² (SI units)
        0.613 * kz * self.kzt * self.kd * self.ke * self.v_basic.powi(2)
    }
    
    /// Velocity pressure at mean roof height qh (Pa)
    pub fn qh(&self) -> f64 {
        self.qz(self.h)
    }
    
    /// Gust effect factor G (Section 26.11)
    pub fn gust_factor(&self) -> f64 {
        // Simplified: rigid structures
        if self.is_flexible() {
            self.flexible_gust_factor()
        } else {
            0.85  // Rigid structure default
        }
    }
    
    /// Check if structure is flexible (f < 1 Hz or h/L > 4)
    fn is_flexible(&self) -> bool {
        self.h / self.l.min(self.b) > 4.0
    }
    
    /// Flexible structure gust factor (Eq. 26.11-10)
    fn flexible_gust_factor(&self) -> f64 {
        let (c, _l_scale) = self.exposure.terrain_constants();
        let iz_bar = c * (10.0 / self.h).powf(1.0 / 6.0);  // Turbulence intensity
        
        let g_q = 3.4;  // Peak factor
        let g_v = 3.4;
        let _g_r = (2.0 * (3600.0 * 1.0_f64).ln()).sqrt() + 
                   0.577 / (2.0 * (3600.0 * 1.0_f64).ln()).sqrt();
        
        // Simplified Q factor
        let _b_plus_h = (self.b + self.h) / 2.0;
        let q = (1.0 / (1.0 + 0.63 * ((self.b + self.h) / _l_scale).powf(0.63))).sqrt();
        
        // Background response
        let g_f = 0.925 * (
            (1.0 + 1.7 * g_q * iz_bar * q) /
            (1.0 + 1.7 * g_v * iz_bar)
        );
        
        g_f.max(0.85)
    }
    
    /// External pressure coefficient Cp for walls (Figure 27.3-1)
    pub fn cp_wall(&self, surface: WallSurface) -> f64 {
        let l_b = self.l / self.b;
        
        match surface {
            WallSurface::Windward => 0.8,
            WallSurface::Leeward => {
                // ASCE 7-22 Figure 27.3-1: L/B=0-1: -0.5, L/B=2: -0.3, L/B≥4: -0.2
                if l_b <= 1.0 { -0.5 }
                else if l_b <= 2.0 { -0.5 + 0.2 * (l_b - 1.0) }
                else if l_b >= 4.0 { -0.2 }
                else { -0.3 + 0.1 * (l_b - 2.0) / 2.0 }
            }
            WallSurface::SideWall => -0.7,
        }
    }
    
    /// External pressure coefficient Cp for roofs (Figure 27.3-1)
    pub fn cp_roof(&self, slope: f64, zone: RoofZone) -> f64 {
        let theta = slope.to_degrees();
        
        match zone {
            RoofZone::Windward => {
                if theta < 10.0 { -0.7 }
                else if theta < 15.0 { -0.5 }
                else if theta < 20.0 { -0.3 }
                else if theta < 30.0 { 0.0 }
                else if theta < 45.0 { 0.2 }
                else { 0.3 }
            }
            RoofZone::Leeward => {
                -0.6  // Simplified
            }
        }
    }
    
    /// Design wind pressure p for MWFRS (Pa) (Eq. 27.3-1)
    pub fn design_pressure_mwfrs(&self, z: f64, surface: WallSurface) -> (f64, f64) {
        let q = self.qz(z);
        let qh = self.qh();
        let g = self.gust_factor();
        let cp = self.cp_wall(surface);
        let (gcp_i_pos, gcp_i_neg) = self.enclosure.gcp_i();
        
        // Use qz for windward, qh for leeward and side
        let q_ext = match surface {
            WallSurface::Windward => q,
            _ => qh,
        };
        
        // p = q*G*Cp - qi*(GCpi) (Eq. 27.3-1)
        let p_pos = q_ext * g * cp - qh * gcp_i_neg;  // Internal suction
        let p_neg = q_ext * g * cp - qh * gcp_i_pos;  // Internal pressure
        
        (p_pos, p_neg)
    }
    
    /// Design wind pressure for C&C (Pa)
    pub fn design_pressure_cc(&self, zone: CCZone, area: f64) -> (f64, f64) {
        let qh = self.qh();
        let (gcp_i_pos, gcp_i_neg) = self.enclosure.gcp_i();
        
        // GCp for C&C (simplified)
        let (gcp_pos, gcp_neg) = match zone {
            CCZone::Zone1 => (0.7, -0.9),
            CCZone::Zone2 => (0.7, -1.1),
            CCZone::Zone3 => (0.7, -1.4),
            CCZone::Zone4 => (0.8, -1.1),
            CCZone::Zone5 => (0.8, -1.4),
        };
        
        // Area effect factor (simplified)
        let area_factor = if area < 1.0 { 1.0 }
                         else if area > 50.0 { 0.9 }
                         else { 1.0 - 0.1 * (area - 1.0) / 49.0 };
        
        let p_pos = qh * (gcp_pos * area_factor - gcp_i_neg);
        let p_neg = qh * (gcp_neg * area_factor - gcp_i_pos);
        
        (p_pos, p_neg)
    }
    
    /// Generate wall pressures at multiple heights
    pub fn wall_pressure_profile(&self, n_levels: usize) -> Vec<WindPressureResult> {
        let mut results = Vec::with_capacity(n_levels);
        
        for i in 0..n_levels {
            let z = (i as f64 + 0.5) * self.h / n_levels as f64;
            
            for surface in [WallSurface::Windward, WallSurface::Leeward, WallSurface::SideWall] {
                let (p_max, p_min) = self.design_pressure_mwfrs(z, surface);
                
                results.push(WindPressureResult {
                    height: z,
                    surface: surface.to_string(),
                    pressure_positive: p_max,
                    pressure_negative: p_min,
                    qz: self.qz(z),
                    kz: self.kz(z),
                });
            }
        }
        
        results
    }
    
    /// Generate base shear and overturning moment
    pub fn base_reactions(&self) -> WindBaseReactions {
        let n_levels = 10;
        let dh = self.h / n_levels as f64;
        
        let mut base_shear = 0.0;
        let mut overturning = 0.0;
        
        for i in 0..n_levels {
            let z = (i as f64 + 0.5) * dh;
            let (p_windward, _) = self.design_pressure_mwfrs(z, WallSurface::Windward);
            let (p_leeward, _) = self.design_pressure_mwfrs(z, WallSurface::Leeward);
            
            // Net pressure on windward face
            let p_net = p_windward - p_leeward;
            
            // Force on this level
            let force = p_net * self.b * dh;
            base_shear += force;
            overturning += force * z;
        }
        
        WindBaseReactions {
            base_shear,
            overturning_moment: overturning,
            qh: self.qh(),
            gust_factor: self.gust_factor(),
        }
    }
}

/// Wall surface type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum WallSurface {
    Windward,
    Leeward,
    SideWall,
}

impl WallSurface {
    fn to_string(&self) -> String {
        match self {
            Self::Windward => "Windward".to_string(),
            Self::Leeward => "Leeward".to_string(),
            Self::SideWall => "Side Wall".to_string(),
        }
    }
}

/// Roof zone
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum RoofZone {
    Windward,
    Leeward,
}

/// C&C zone
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum CCZone {
    Zone1,  // Interior
    Zone2,  // End zone
    Zone3,  // Corner
    Zone4,  // Edge
    Zone5,  // Ridge/hip
}

/// Wind pressure result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindPressureResult {
    pub height: f64,
    pub surface: String,
    pub pressure_positive: f64,
    pub pressure_negative: f64,
    pub qz: f64,
    pub kz: f64,
}

/// Wind base reactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindBaseReactions {
    pub base_shear: f64,
    pub overturning_moment: f64,
    pub qh: f64,
    pub gust_factor: f64,
}

// ============================================================================
// IS 875 PART 3 WIND LOADS
// ============================================================================

/// IS 875 Part 3 Wind Load Calculator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Is875WindLoad {
    /// Basic wind speed Vb (m/s) from Figure 1
    pub vb: f64,
    /// Risk coefficient k1 (Table 1)
    pub k1: f64,
    /// Terrain category (1-4)
    pub terrain_category: u8,
    /// Building height (m)
    pub h: f64,
    /// Building width (m)
    pub b: f64,
    /// Building depth (m)
    pub d: f64,
    /// Topography factor k3 (default 1.0)
    pub k3: f64,
    /// Importance factor k4 (cyclonic region)
    pub k4: f64,
}

impl Is875WindLoad {
    /// Create new IS 875 calculator
    pub fn new(vb: f64, h: f64, b: f64, d: f64) -> Self {
        Self {
            vb,
            k1: 1.0,  // 50 year return period
            terrain_category: 2,
            h, b, d,
            k3: 1.0,
            k4: 1.0,
        }
    }
    
    /// Set terrain category (1-4)
    pub fn with_terrain(mut self, cat: u8) -> Self {
        self.terrain_category = cat.max(1).min(4);
        self
    }
    
    /// Terrain and height factor k2 (Table 2)
    pub fn k2(&self, z: f64) -> f64 {
        let z = z.max(10.0);  // Minimum 10m
        
        match self.terrain_category {
            1 => {
                // Category 1: Exposed open terrain
                if z <= 10.0 { 1.05 }
                else if z <= 15.0 { 1.09 }
                else if z <= 20.0 { 1.12 }
                else if z <= 30.0 { 1.17 }
                else if z <= 50.0 { 1.24 }
                else { 1.24 * (z / 50.0).powf(0.07) }
            }
            2 => {
                // Category 2: Open terrain with scattered obstructions
                if z <= 10.0 { 1.00 }
                else if z <= 15.0 { 1.05 }
                else if z <= 20.0 { 1.08 }
                else if z <= 30.0 { 1.12 }
                else if z <= 50.0 { 1.18 }
                else { 1.18 * (z / 50.0).powf(0.08) }
            }
            3 => {
                // Category 3: Built-up areas
                if z <= 10.0 { 0.91 }
                else if z <= 15.0 { 0.97 }
                else if z <= 20.0 { 1.01 }
                else if z <= 30.0 { 1.06 }
                else if z <= 50.0 { 1.12 }
                else { 1.12 * (z / 50.0).powf(0.10) }
            }
            _ => {
                // Category 4: Built-up with tall buildings
                if z <= 10.0 { 0.80 }
                else if z <= 15.0 { 0.80 }
                else if z <= 20.0 { 0.88 }
                else if z <= 30.0 { 0.95 }
                else if z <= 50.0 { 1.03 }
                else { 1.03 * (z / 50.0).powf(0.12) }
            }
        }
    }
    
    /// Design wind speed Vz (m/s) (Clause 5.3)
    pub fn vz(&self, z: f64) -> f64 {
        self.vb * self.k1 * self.k2(z) * self.k3 * self.k4
    }
    
    /// Design wind pressure pz (Pa) (Clause 5.4)
    pub fn pz(&self, z: f64) -> f64 {
        let vz = self.vz(z);
        0.6 * vz.powi(2)
    }
    
    /// Pressure at height h
    pub fn pd(&self) -> f64 {
        self.pz(self.h)
    }
    
    /// External pressure coefficient Cpe for walls (Table 4)
    pub fn cpe_wall(&self, surface: Is875Surface, _angle: f64) -> f64 {
        let _h_b = self.h / self.b;
        let h_w = self.h / self.d;
        
        match surface {
            Is875Surface::Windward => 0.8,
            Is875Surface::Leeward => {
                if h_w <= 0.5 { -0.2 }
                else if h_w <= 1.0 { -0.25 }
                else if h_w <= 2.0 { -0.3 }
                else { -0.3 }
            }
            Is875Surface::SideWall => -0.5,
        }
    }
    
    /// Internal pressure coefficient Cpi (Table 5)
    pub fn cpi(&self, opening_ratio: f64) -> f64 {
        if opening_ratio < 5.0 { 0.0 }
        else if opening_ratio < 20.0 { 0.5 }
        else { 0.7 }
    }
    
    /// Wind force on building (Clause 6.3)
    pub fn wind_force(&self) -> f64 {
        let pd = self.pd();
        let cf = 1.3;  // Force coefficient (approximate)
        let ae = self.b * self.h;  // Effective area
        
        cf * ae * pd
    }
}

/// IS 875 surface type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Is875Surface {
    Windward,
    Leeward,
    SideWall,
}

// ============================================================================
// EUROCODE 1 WIND ACTIONS (EN 1991-1-4)
// ============================================================================

/// Eurocode 1 Wind Calculator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Eurocode1Wind {
    /// Fundamental basic wind velocity vb,0 (m/s)
    pub vb0: f64,
    /// Directional factor cdir (default 1.0)
    pub cdir: f64,
    /// Season factor cseason (default 1.0)
    pub cseason: f64,
    /// Terrain category (0-IV)
    pub terrain_category: EcTerrainCategory,
    /// Building height (m)
    pub h: f64,
    /// Building width (m)
    pub b: f64,
    /// Building depth (m)
    pub d: f64,
    /// Orography factor co (default 1.0)
    pub co: f64,
}

/// EC1 Terrain Category
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum EcTerrainCategory {
    /// Sea or coastal area
    Zero,
    /// Lakes or area with negligible vegetation
    I,
    /// Agricultural land
    II,
    /// Suburban or industrial
    III,
    /// Urban (>15% buildings > 15m)
    IV,
}

impl EcTerrainCategory {
    /// Roughness length z0 (m) and minimum height zmin (m)
    pub fn roughness_params(&self) -> (f64, f64) {
        match self {
            Self::Zero => (0.003, 1.0),
            Self::I => (0.01, 1.0),
            Self::II => (0.05, 2.0),
            Self::III => (0.3, 5.0),
            Self::IV => (1.0, 10.0),
        }
    }
}

impl Eurocode1Wind {
    /// Create new EC1 wind calculator
    pub fn new(vb0: f64, h: f64, b: f64, d: f64) -> Self {
        Self {
            vb0,
            cdir: 1.0,
            cseason: 1.0,
            terrain_category: EcTerrainCategory::II,
            h, b, d,
            co: 1.0,
        }
    }
    
    /// Basic wind velocity vb (m/s) (Eq. 4.1)
    pub fn vb(&self) -> f64 {
        self.cdir * self.cseason * self.vb0
    }
    
    /// Roughness factor cr (Eq. 4.4)
    pub fn cr(&self, z: f64) -> f64 {
        let (z0, zmin) = self.terrain_category.roughness_params();
        let z0_ii = 0.05;  // Reference roughness
        let kr = 0.19 * (z0 / z0_ii).powf(0.07);  // Terrain factor
        
        let z_eff = z.max(zmin);
        kr * (z_eff / z0).ln()
    }
    
    /// Mean wind velocity vm (m/s) (Eq. 4.3)
    pub fn vm(&self, z: f64) -> f64 {
        self.cr(z) * self.co * self.vb()
    }
    
    /// Turbulence intensity Iv (Eq. 4.7)
    pub fn iv(&self, z: f64) -> f64 {
        let (z0, zmin) = self.terrain_category.roughness_params();
        let ki = 1.0;  // Turbulence factor
        let z_eff = z.max(zmin);
        
        ki / (self.co * (z_eff / z0).ln())
    }
    
    /// Peak velocity pressure qp (Pa) (Eq. 4.8)
    pub fn qp(&self, z: f64) -> f64 {
        let vm = self.vm(z);
        let iv = self.iv(z);
        let rho = 1.25;  // Air density kg/m³
        
        0.5 * rho * vm.powi(2) * (1.0 + 7.0 * iv)
    }
    
    /// Structural factor cscd (Clause 6.2)
    pub fn cscd(&self) -> f64 {
        // Simplified for most buildings
        if self.h < 15.0 {
            1.0
        } else {
            let (_z0, _) = self.terrain_category.roughness_params();
            let iv = self.iv(self.h);
            let b_coeff = 1.0 / (1.0 + 0.9 * ((self.b + self.h) / 300.0).powf(0.63));
            
            let cs = (1.0 + 7.0 * iv * b_coeff.sqrt()) / (1.0 + 7.0 * iv);
            let cd = 1.0;  // Simplified
            
            cs * cd
        }
    }
    
    /// External pressure coefficient cpe (Table 7.1)
    pub fn cpe(&self, surface: EcSurface, area: f64) -> f64 {
        // Interpolate between cpe,1 (1m²) and cpe,10 (10m²)
        let log_a = area.max(1.0).min(10.0).log10();
        
        let (cpe_1, cpe_10) = match surface {
            EcSurface::ZoneD => (1.0, 0.8),
            EcSurface::ZoneE => (-0.7, -0.5),
            EcSurface::ZoneA => (-1.4, -1.2),
            EcSurface::ZoneB => (-1.1, -0.8),
            EcSurface::ZoneC => (-0.5, -0.5),
        };
        
        cpe_10 + (cpe_1 - cpe_10) * (1.0 - log_a)
    }
    
    /// Wind force on surfaces (Eq. 5.3)
    pub fn wind_force(&self, cs_cd: f64, a_ref: f64, cf: f64) -> f64 {
        let qp = self.qp(self.h);
        cs_cd * cf * qp * a_ref
    }
}

/// EC1 surface zones
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum EcSurface {
    ZoneD,  // Windward wall
    ZoneE,  // Leeward wall
    ZoneA,  // Edge zone
    ZoneB,  // Middle zone
    ZoneC,  // Central zone
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_asce7_qz() {
        let wind = Asce7WindLoad::new(50.0, 20.0, 30.0, 15.0);
        
        let qh = wind.qh();
        // qz = 0.613 * Kz * Kzt * Kd * Ke * V²
        // At 20m, Exposure C: Kz ≈ 1.13
        // qh = 0.613 * 1.13 * 1.0 * 0.85 * 1.0 * 50² ≈ 1472 Pa
        assert!(qh > 1000.0 && qh < 2000.0, "qh = {}", qh);
    }
    
    #[test]
    fn test_asce7_kz() {
        let wind = Asce7WindLoad::new(50.0, 20.0, 30.0, 15.0);
        
        // Kz should increase with height
        let kz_10 = wind.kz(10.0);
        let kz_20 = wind.kz(20.0);
        let kz_50 = wind.kz(50.0);
        
        assert!(kz_20 > kz_10);
        assert!(kz_50 > kz_20);
        
        // For Exposure C at 10m, Kz ≈ 1.0
        assert!((kz_10 - 1.0).abs() < 0.15);
    }
    
    #[test]
    fn test_asce7_wall_coefficients() {
        let wind = Asce7WindLoad::new(45.0, 15.0, 20.0, 10.0);
        
        let cp_windward = wind.cp_wall(WallSurface::Windward);
        let cp_leeward = wind.cp_wall(WallSurface::Leeward);
        let cp_side = wind.cp_wall(WallSurface::SideWall);
        
        assert!((cp_windward - 0.8).abs() < 0.01);
        assert!(cp_leeward < 0.0);
        assert!((cp_side - (-0.7)).abs() < 0.01);
    }
    
    #[test]
    fn test_asce7_base_reactions() {
        let wind = Asce7WindLoad::new(50.0, 30.0, 40.0, 20.0);
        
        let reactions = wind.base_reactions();
        
        // Base shear should be positive
        assert!(reactions.base_shear > 0.0);
        
        // Overturning moment should be positive
        assert!(reactions.overturning_moment > 0.0);
        
        // Moment arm should be reasonable (h/2 to 2h/3)
        let effective_height = reactions.overturning_moment / reactions.base_shear;
        assert!(effective_height > 10.0 && effective_height < 25.0);
    }
    
    #[test]
    fn test_asce7_exposure_categories() {
        // Same building, different exposures
        let mut wind_b = Asce7WindLoad::new(50.0, 20.0, 30.0, 15.0)
            .with_exposure(AscExposure::B);
        let mut wind_c = Asce7WindLoad::new(50.0, 20.0, 30.0, 15.0)
            .with_exposure(AscExposure::C);
        let mut wind_d = Asce7WindLoad::new(50.0, 20.0, 30.0, 15.0)
            .with_exposure(AscExposure::D);
        
        // D > C > B for same height
        let qh_b = wind_b.qh();
        let qh_c = wind_c.qh();
        let qh_d = wind_d.qh();
        
        assert!(qh_d > qh_c);
        assert!(qh_c > qh_b);
    }
    
    #[test]
    fn test_is875_basic() {
        let wind = Is875WindLoad::new(44.0, 15.0, 10.0, 8.0);
        
        let pd = wind.pd();
        // Vz = 44 * 1.0 * k2(15m) * 1.0 * 1.0
        // k2 for category 2 at 15m ≈ 1.05
        // pd = 0.6 * (44 * 1.05)² ≈ 1280 Pa
        assert!(pd > 1000.0 && pd < 1600.0);
    }
    
    #[test]
    fn test_is875_terrain_effect() {
        // Higher terrain category = lower wind speed
        let wind_1 = Is875WindLoad::new(44.0, 20.0, 10.0, 10.0).with_terrain(1);
        let wind_4 = Is875WindLoad::new(44.0, 20.0, 10.0, 10.0).with_terrain(4);
        
        assert!(wind_1.pd() > wind_4.pd());
    }
    
    #[test]
    fn test_eurocode1_basic() {
        let wind = Eurocode1Wind::new(26.0, 20.0, 15.0, 10.0);
        
        let vb = wind.vb();
        assert!((vb - 26.0).abs() < 0.01);
        
        let qp = wind.qp(20.0);
        // qp should be in reasonable range for 26 m/s
        assert!(qp > 500.0 && qp < 2000.0);
    }
    
    #[test]
    fn test_eurocode1_terrain() {
        let mut wind_ii = Eurocode1Wind::new(26.0, 20.0, 15.0, 10.0);
        wind_ii.terrain_category = EcTerrainCategory::II;
        
        let mut wind_iv = Eurocode1Wind::new(26.0, 20.0, 15.0, 10.0);
        wind_iv.terrain_category = EcTerrainCategory::IV;
        
        // Urban terrain (IV) should have lower peak pressure
        assert!(wind_ii.qp(20.0) > wind_iv.qp(20.0));
    }
    
    #[test]
    fn test_eurocode1_cpe() {
        let wind = Eurocode1Wind::new(26.0, 20.0, 15.0, 10.0);
        
        // Windward (Zone D) should be positive
        let cpe_d = wind.cpe(EcSurface::ZoneD, 10.0);
        assert!(cpe_d > 0.0);
        
        // Leeward (Zone E) should be negative
        let cpe_e = wind.cpe(EcSurface::ZoneE, 10.0);
        assert!(cpe_e < 0.0);
    }
    
    #[test]
    fn test_asce7_risk_categories() {
        let risk_i = AscRiskCategory::I;
        let risk_iv = AscRiskCategory::IV;
        
        assert!((risk_i.importance_factor() - 1.0).abs() < 0.01);
        assert!(risk_iv.importance_factor() > risk_i.importance_factor());
    }
    
    #[test]
    fn test_enclosure_gcp_i() {
        let enclosed = EnclosureClass::Enclosed;
        let partial = EnclosureClass::PartiallyEnclosed;
        
        let (pos_enc, neg_enc) = enclosed.gcp_i();
        let (pos_part, neg_part) = partial.gcp_i();
        
        // Partially enclosed has higher GCpi magnitude
        assert!(pos_part.abs() > pos_enc.abs());
        assert!(neg_part.abs() > neg_enc.abs());
    }
}
