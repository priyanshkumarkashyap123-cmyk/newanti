//! IS 875 (Parts 1-5) — Design Loads
//!
//! Implements:
//! - Pressure coefficients for rectangular buildings (Cpe/Cpi)
//! - Wind force per storey with height-based pressure variation
//! - Basic wind speed, design pressure, terrain factors
//! - Live load values and reduction factors

use serde::{Deserialize, Serialize};

// ── Terrain Categories ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum TerrainCategory {
    Category1, // Open sea coast
    Category2, // Open terrain with few obstructions
    Category3, // Suburban / industrial
    Category4, // City centre
}

impl TerrainCategory {
    /// Base k2 factor at 10m height
    pub fn k2_base(&self) -> f64 {
        match self {
            Self::Category1 => 1.05,
            Self::Category2 => 1.00,
            Self::Category3 => 0.91,
            Self::Category4 => 0.80,
        }
    }
}

// ── k2 Terrain Factor (Table 2) ──

/// Terrain and height factor k2 per IS 875 Part 3 Table 2
pub fn terrain_factor_k2(terrain: TerrainCategory, height_m: f64) -> f64 {
    let h = height_m.max(0.0);

    // IS 875-3 Table 2 simplified power law: Vz/Vb = k2 = α × (z/z_ref)^p
    // where z_ref = 10m and α/p depend on terrain category
    let (alpha, p) = match terrain {
        TerrainCategory::Category1 => (1.05, 0.14),
        TerrainCategory::Category2 => (1.00, 0.17),
        TerrainCategory::Category3 => (0.91, 0.20),
        TerrainCategory::Category4 => (0.80, 0.24),
    };

    if h <= 10.0 {
        alpha
    } else {
        alpha * (h / 10.0).powf(p)
    }
}

// ── Wind Pressure ──

/// Design wind speed Vz = Vb × k1 × k2 × k3
pub fn design_wind_speed(vb: f64, k1: f64, k2: f64, k3: f64) -> f64 {
    vb * k1 * k2 * k3
}

/// Design wind pressure pz = 0.6 × Vz² (N/m²)
pub fn design_wind_pressure(vz: f64) -> f64 {
    0.6 * vz * vz
}

// ── Pressure Coefficients (Rectangular Buildings) ──

/// External and internal pressure coefficients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressureCoefficients {
    pub cpe_windward: f64,
    pub cpe_leeward: f64,
    pub cpe_side: f64,
    pub cpe_roof: f64,
    pub cpi_positive: f64,
    pub cpi_negative: f64,
    pub net_pressure_max: f64,   // Cpe windward + Cpi negative (suction inside)
    pub net_pressure_min: f64,   // Cpe leeward + Cpi positive (pressure inside)
}

/// Get pressure coefficients for rectangular buildings per IS 875 Part 3 Table 4/5
///
/// h/w: height to width ratio of building
/// opening_ratio: ratio of openings on wind face (0 = closed, >0.2 = dominant opening)
pub fn pressure_coefficients_rectangular(h_by_w: f64, opening_ratio: f64) -> PressureCoefficients {
    // External pressure coefficients (Table 4)
    let cpe_windward = 0.7;

    let cpe_leeward = if h_by_w <= 0.5 {
        -0.25
    } else if h_by_w <= 1.0 {
        -0.25 - 0.25 * (h_by_w - 0.5) / 0.5
    } else if h_by_w <= 2.0 {
        -0.50 - 0.10 * (h_by_w - 1.0)
    } else {
        -0.60
    };

    let cpe_side = -0.7;

    let cpe_roof = if h_by_w <= 0.5 {
        -0.8
    } else if h_by_w <= 1.5 {
        -0.8 - 0.2 * (h_by_w - 0.5)
    } else {
        -1.0
    };

    // Internal pressure coefficients (Cl. 6.2.3.2)
    let (cpi_positive, cpi_negative) = if opening_ratio < 0.05 {
        (0.2, -0.2) // Enclosed building
    } else if opening_ratio < 0.20 {
        (0.5, -0.5) // Partially enclosed
    } else {
        (0.7, -0.7) // Dominant opening
    };

    let net_max = cpe_windward - cpi_negative; // +0.7 - (-0.2) = 0.9
    let net_min = cpe_leeward - cpi_positive;  // Suction + internal pressure

    PressureCoefficients {
        cpe_windward,
        cpe_leeward,
        cpe_side,
        cpe_roof,
        cpi_positive,
        cpi_negative,
        net_pressure_max: (net_max * 1000.0).round() / 1000.0,
        net_pressure_min: (net_min * 1000.0).round() / 1000.0,
    }
}

// ── Wind Force Per Storey ──

/// Wind force at a storey
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreyWindForce {
    pub storey: usize,
    pub height_m: f64,
    pub mid_height_m: f64,
    pub pz_n_per_m2: f64,
    pub force_kn: f64,
}

/// Generate wind force per storey with height-based pressure variation
///
/// For each storey, pressure is evaluated at mid-height of the band
/// Force = Cf × tributary_width × storey_height × pz(mid)
pub fn wind_force_per_storey(
    vb: f64,
    storey_heights: &[f64],       // Height of each storey (m)
    tributary_width: f64,          // Building width perpendicular to wind (m)
    terrain: TerrainCategory,
    cf: f64,                       // Force coefficient (net Cp)
    k1: f64,                       // Risk coefficient (typically 1.0)
    k3: f64,                       // Topography factor (typically 1.0)
) -> Vec<StoreyWindForce> {
    let mut forces = Vec::with_capacity(storey_heights.len());
    let mut cumulative_height = 0.0;

    for (i, &sh) in storey_heights.iter().enumerate() {
        cumulative_height += sh;
        let mid_h = cumulative_height - sh / 2.0;

        let k2 = terrain_factor_k2(terrain, mid_h);
        let vz = design_wind_speed(vb, k1, k2, k3);
        let pz = design_wind_pressure(vz);

        let force = cf * tributary_width * sh * pz / 1000.0; // kN

        forces.push(StoreyWindForce {
            storey: i + 1,
            height_m: cumulative_height,
            mid_height_m: mid_h,
            pz_n_per_m2: (pz * 100.0).round() / 100.0,
            force_kn: (force * 100.0).round() / 100.0,
        });
    }

    forces
}

// ── Live Loads (IS 875 Part 2) ──

/// Get live load for occupancy type (kN/m²)
pub fn live_load(occupancy: &str) -> f64 {
    match occupancy {
        "residential" => 2.0,
        "office" => 2.5,
        "shop" | "retail" => 4.0,
        "assembly_fixed" => 4.0,
        "assembly_no_fixed" => 5.0,
        "school" | "classroom" => 3.0,
        "hospital" => 3.0,
        "library_reading" => 3.0,
        "library_stack" => 6.0,
        "warehouse_light" => 5.0,
        "warehouse_heavy" => 10.0,
        "garage_light" => 2.5,
        "garage_heavy" => 5.0,
        "factory_light" => 3.5,
        "factory_heavy" => 5.0,
        "staircase" => 5.0,
        "balcony" => 3.0,
        "roof_access" => 1.5,
        "roof_no_access" => 0.75,
        _ => 3.0,
    }
}

/// Live load reduction factor per IS 875-2 Cl. 3.2.1
/// For tributary area > 50 m²
pub fn live_load_reduction(tributary_area: f64, num_floors: usize) -> f64 {
    // Area reduction
    let area_factor = if tributary_area <= 50.0 {
        1.0
    } else {
        (0.5 + 5.0 / tributary_area.sqrt()).min(1.0)
    };

    // Floor reduction (for columns/walls)
    let floor_factor = match num_floors {
        0..=1 => 1.0,
        2 => 0.90,
        3 => 0.80,
        4 => 0.70,
        _ => 0.60,
    };

    area_factor * floor_factor
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pressure_coefficients() {
        let pc = pressure_coefficients_rectangular(1.0, 0.0);
        assert!((pc.cpe_windward - 0.7).abs() < 0.01);
        assert!((pc.net_pressure_max - 0.9).abs() < 0.01);
    }

    #[test]
    fn test_wind_per_storey() {
        let forces = wind_force_per_storey(
            44.0, &[3.0; 5], 8.0, TerrainCategory::Category2, 0.8, 1.0, 1.0,
        );
        assert_eq!(forces.len(), 5);
        let total: f64 = forces.iter().map(|f| f.force_kn).sum();
        assert!(total > 10.0, "Total wind force should be > 10 kN, got {total}");
    }

    #[test]
    fn test_live_load() {
        assert!((live_load("office") - 2.5).abs() < 0.01);
        assert!((live_load("warehouse_heavy") - 10.0).abs() < 0.01);
    }
}
