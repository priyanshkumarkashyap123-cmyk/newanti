//! # Static Loading Engine
//!
//! Comprehensive load application engine transferred from Python `analysis/load_engine.py`.
//!
//! ## Features
//! - Fixed-end action calculation for all load types
//! - Trapezoidal / triangular distributed loads
//! - Point loads and moments on members
//! - Temperature loads (uniform ΔT + gradient)
//! - Prestress loads with parabolic cable profile
//! - Floor / area load with yield-line panel distribution
//! - Self-weight generation
//! - Load case management & combination factoring
//!
//! ## Mathematical Basis
//! - Fixed-end forces from standard beam formulas
//! - Yield-line theory for two-way slab load distribution
//! - Thermal strain: ε = α·ΔT
//! - Prestress equivalence: w_eq = 8·P·e / L²

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// ENUMERATIONS
// ============================================================================

/// Load direction options
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LoadDirection {
    LocalX,
    LocalY,
    LocalZ,
    GlobalX,
    GlobalY,
    GlobalZ,
}

/// Floor load distribution method
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DistributionType {
    OneWay,
    TwoWayTriangular,
    TwoWayTrapezoidal,
}

// ============================================================================
// FIXED-END ACTION RESULT
// ============================================================================

/// Fixed-end forces and moments at beam ends
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FixedEndActions {
    /// Reaction force at start (kN)
    pub fy_start: f64,
    /// Reaction force at end (kN)
    pub fy_end: f64,
    /// Fixed-end moment at start (kN·m)
    pub mz_start: f64,
    /// Fixed-end moment at end (kN·m)
    pub mz_end: f64,
}

// ============================================================================
// LOAD TYPES
// ============================================================================

/// Nodal (point) load applied directly at a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodalLoad {
    pub id: String,
    pub node_id: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
    pub load_case: String,
}

/// Uniform distributed load on a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniformLoad {
    pub id: String,
    pub member_id: String,
    /// Intensity (kN/m)
    pub w: f64,
    pub direction: LoadDirection,
    /// Start position ratio 0..1
    pub start_pos: f64,
    /// End position ratio 0..1
    pub end_pos: f64,
    /// Project load based on member angle
    pub is_projected: bool,
    pub load_case: String,
}

/// Trapezoidal / triangular distributed load on member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrapezoidalLoad {
    pub id: String,
    pub member_id: String,
    /// Intensity at start (kN/m)
    pub w1: f64,
    /// Intensity at end (kN/m)
    pub w2: f64,
    pub direction: LoadDirection,
    pub start_pos: f64,
    pub end_pos: f64,
    pub is_projected: bool,
    pub load_case: String,
}

/// Point load at a specific location on a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointLoadOnMember {
    pub id: String,
    pub member_id: String,
    /// Load magnitude (kN)
    pub p: f64,
    /// Distance from start (ratio 0..1)
    pub a: f64,
    pub direction: LoadDirection,
    pub load_case: String,
}

/// Applied moment at a specific location on a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentOnMember {
    pub id: String,
    pub member_id: String,
    /// Moment magnitude (kN·m)
    pub m: f64,
    /// Distance from start (ratio 0..1)
    pub a: f64,
    pub load_case: String,
}

/// Temperature change load on a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemperatureLoad {
    pub id: String,
    pub member_id: String,
    /// Temperature change (°C)
    pub delta_t: f64,
    /// Thermal expansion coefficient (1/°C), default 12e-6
    pub alpha: f64,
    /// Temperature gradient across depth (°C) — optional
    pub gradient_t: Option<f64>,
    /// Section depth for gradient calculation (m) — optional
    pub section_depth: Option<f64>,
    pub load_case: String,
}

/// Prestress load with parabolic cable profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrestressLoad {
    pub id: String,
    pub member_id: String,
    /// Prestress force (kN)
    pub p: f64,
    /// Eccentricity at start (m, +ve below centroid)
    pub e_start: f64,
    /// Eccentricity at mid-span (m)
    pub e_mid: f64,
    /// Eccentricity at end (m)
    pub e_end: f64,
    pub load_case: String,
}

/// Floor / area load that distributes to beams
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorLoad {
    pub id: String,
    /// Load intensity (kN/m²)
    pub pressure: f64,
    /// Floor Y-coordinate
    pub y_level: f64,
    pub load_case: String,
}

// ============================================================================
// FIXED-END ACTION CALCULATIONS
// ============================================================================

/// Calculate FEA for a partial uniform load from `a` to `b` on span `length`
pub fn uniform_load_fea(w: f64, length: f64, start_pos: f64, end_pos: f64) -> FixedEndActions {
    let a = start_pos * length;
    let b = end_pos * length;
    let load_len = b - a;
    if load_len <= 0.0 || length <= 0.0 {
        return FixedEndActions::default();
    }
    let total = w * load_len;
    let c = (a + b) / 2.0; // centroid

    let r_end = total * c / length;
    let r_start = total - r_end;
    let m_start = -total * c * (length - c).powi(2) / length.powi(2);
    let m_end = total * c.powi(2) * (length - c) / length.powi(2);

    FixedEndActions {
        fy_start: r_start,
        fy_end: r_end,
        mz_start: m_start,
        mz_end: m_end,
    }
}

/// Calculate FEA for a trapezoidal load (w1 at start, w2 at end)
pub fn trapezoidal_load_fea(
    w1: f64,
    w2: f64,
    length: f64,
    start_pos: f64,
    end_pos: f64,
) -> FixedEndActions {
    let a = start_pos * length;
    let b = end_pos * length;
    let l = b - a;
    if l <= 0.0 || length <= 0.0 {
        return FixedEndActions::default();
    }

    // Decompose: trapezoidal = uniform(min) + triangular(diff)
    let w_min = w1.min(w2);
    let w_diff = (w2 - w1).abs();
    let triangle_toward_end = w2 > w1;

    let w_uniform = w_min * l;
    let c_uniform = (a + b) / 2.0;

    let w_triangle = 0.5 * w_diff * l;
    let c_triangle = if triangle_toward_end {
        a + 2.0 * l / 3.0
    } else {
        a + l / 3.0
    };

    let w_total = w_uniform + w_triangle;
    let c_total = if w_total > 1e-12 {
        (w_uniform * c_uniform + w_triangle * c_triangle) / w_total
    } else {
        c_uniform
    };

    let r_end = w_total * c_total / length;
    let r_start = w_total - r_end;
    let m_start = -w_total * c_total * (length - c_total).powi(2) / length.powi(2);
    let m_end = w_total * c_total.powi(2) * (length - c_total) / length.powi(2);

    FixedEndActions {
        fy_start: r_start,
        fy_end: r_end,
        mz_start: m_start,
        mz_end: m_end,
    }
}

/// Calculate FEA for a point load P at distance ratio `a_ratio` on span `length`
pub fn point_load_fea(p: f64, length: f64, a_ratio: f64) -> FixedEndActions {
    if length <= 0.0 {
        return FixedEndActions::default();
    }
    let a = a_ratio * length;
    let b = length - a;

    let r_start = p * b / length;
    let r_end = p * a / length;
    let m_start = -p * a * b.powi(2) / length.powi(2);
    let m_end = p * a.powi(2) * b / length.powi(2);

    FixedEndActions {
        fy_start: r_start,
        fy_end: r_end,
        mz_start: m_start,
        mz_end: m_end,
    }
}

/// Calculate FEA for an applied moment M at distance ratio `a_ratio`
pub fn moment_load_fea(m: f64, length: f64, a_ratio: f64) -> FixedEndActions {
    if length <= 0.0 {
        return FixedEndActions::default();
    }
    let a = a_ratio * length;
    let b = length - a;
    let l3 = length.powi(3);

    let v = 6.0 * m * a * b / l3;
    let m_start = m * b * (2.0 * a - b) / length.powi(2);
    let m_end = m * a * (2.0 * b - a) / length.powi(2);

    FixedEndActions {
        fy_start: v,
        fy_end: -v,
        mz_start: m_start,
        mz_end: m_end,
    }
}

// ============================================================================
// TEMPERATURE LOAD CALCULATIONS
// ============================================================================

/// Thermal strain: ε = α × ΔT
pub fn thermal_strain(alpha: f64, delta_t: f64) -> f64 {
    alpha * delta_t
}

/// Thermal axial force for a restrained member: F = E·A·α·ΔT
pub fn thermal_force(e_mod: f64, area: f64, alpha: f64, delta_t: f64) -> f64 {
    e_mod * area * alpha * delta_t
}

/// Moment due to temperature gradient: M = E·I·α·(ΔT_grad / h)
pub fn thermal_moment(
    e_mod: f64,
    inertia: f64,
    alpha: f64,
    gradient_t: f64,
    section_depth: f64,
) -> f64 {
    if section_depth <= 0.0 {
        return 0.0;
    }
    let curvature = alpha * gradient_t / section_depth;
    e_mod * inertia * curvature
}

// ============================================================================
// PRESTRESS EQUIVALENT LOADS
// ============================================================================

/// Prestress equivalent loads result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrestressEquivalent {
    /// Equivalent upward UDL (kN/m)
    pub equivalent_udl: f64,
    /// End moment at start (kN·m)
    pub moment_start: f64,
    /// End moment at end (kN·m)
    pub moment_end: f64,
    /// Applied prestress force (kN)
    pub prestress_force: f64,
}

/// Calculate equivalent loads for a parabolic prestress cable
///
/// For parabolic profile with sag `e`: UDL = 8·P·e / L²
pub fn prestress_equivalent(
    p: f64,
    e_start: f64,
    e_mid: f64,
    e_end: f64,
    length: f64,
) -> PrestressEquivalent {
    let e_straight_mid = (e_start + e_end) / 2.0;
    let sag = e_mid - e_straight_mid;
    let w_eq = if length > 0.0 {
        -8.0 * p * sag / length.powi(2)
    } else {
        0.0
    };
    PrestressEquivalent {
        equivalent_udl: w_eq,
        moment_start: -p * e_start,
        moment_end: -p * e_end,
        prestress_force: p,
    }
}

// ============================================================================
// FLOOR LOAD PANEL DISTRIBUTION
// ============================================================================

/// A detected floor panel
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorPanel {
    pub x_min: f64,
    pub x_max: f64,
    pub z_min: f64,
    pub z_max: f64,
    pub lx: f64,
    pub lz: f64,
    pub aspect_ratio: f64,
    pub area: f64,
}

/// Distributed member loads from floor load
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorMemberLoad {
    pub member_id: String,
    pub w1: f64,
    pub w2: f64,
    pub start_pos: f64,
    pub end_pos: f64,
    pub direction: LoadDirection,
    pub load_case: String,
}

/// Distribute a floor load to panel-edge beams using yield-line theory
///
/// - One-way slab (aspect ≥ 2): uniform load to shorter-span beams
/// - Two-way slab (aspect < 2): triangular on short edges, trapezoidal on long edges
pub fn distribute_floor_load(
    pressure: f64,
    panel: &FloorPanel,
    beam_ids: &FloorPanelBeams,
    load_case: &str,
) -> Vec<FloorMemberLoad> {
    let mut loads = Vec::new();
    let ratio = panel.aspect_ratio;

    if ratio >= 2.0 {
        // ── One-way distribution ──
        let (tributary, targets) = if panel.lx > panel.lz {
            (panel.lz / 2.0, [&beam_ids.bottom[..], &beam_ids.top[..]].concat())
        } else {
            (panel.lx / 2.0, [&beam_ids.left[..], &beam_ids.right[..]].concat())
        };
        let w = pressure * tributary;
        for mid in targets {
            loads.push(FloorMemberLoad {
                member_id: mid,
                w1: w,
                w2: w,
                start_pos: 0.0,
                end_pos: 1.0,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
        }
    } else {
        // ── Two-way distribution (yield line) ──
        let l_short = panel.lx.min(panel.lz);
        let l_long = panel.lx.max(panel.lz);
        let w_max = pressure * l_short / 2.0;
        let tri_ratio = if l_long > 0.0 { (l_short / 2.0) / l_long } else { 0.5 };

        // Determine which edges are short / long
        let (short_beams, long_beams) = if panel.lx <= panel.lz {
            (
                [&beam_ids.left[..], &beam_ids.right[..]].concat(),
                [&beam_ids.bottom[..], &beam_ids.top[..]].concat(),
            )
        } else {
            (
                [&beam_ids.bottom[..], &beam_ids.top[..]].concat(),
                [&beam_ids.left[..], &beam_ids.right[..]].concat(),
            )
        };

        // Short edges → triangular (0 → w_max → 0)
        for mid in &short_beams {
            loads.push(FloorMemberLoad {
                member_id: mid.clone(),
                w1: 0.0,
                w2: w_max,
                start_pos: 0.0,
                end_pos: 0.5,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
            loads.push(FloorMemberLoad {
                member_id: mid.clone(),
                w1: w_max,
                w2: 0.0,
                start_pos: 0.5,
                end_pos: 1.0,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
        }

        // Long edges → trapezoidal (0 → w_max | w_max | w_max → 0)
        for mid in &long_beams {
            loads.push(FloorMemberLoad {
                member_id: mid.clone(),
                w1: 0.0,
                w2: w_max,
                start_pos: 0.0,
                end_pos: tri_ratio,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
            loads.push(FloorMemberLoad {
                member_id: mid.clone(),
                w1: w_max,
                w2: w_max,
                start_pos: tri_ratio,
                end_pos: 1.0 - tri_ratio,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
            loads.push(FloorMemberLoad {
                member_id: mid.clone(),
                w1: w_max,
                w2: 0.0,
                start_pos: 1.0 - tri_ratio,
                end_pos: 1.0,
                direction: LoadDirection::GlobalY,
                load_case: load_case.into(),
            });
        }
    }
    loads
}

/// Beam IDs on each edge of a floor panel
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FloorPanelBeams {
    pub bottom: Vec<String>,
    pub top: Vec<String>,
    pub left: Vec<String>,
    pub right: Vec<String>,
}

// ============================================================================
// SELF-WEIGHT GENERATION
// ============================================================================

/// Member definition for self-weight calculation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberSelfWeight {
    pub id: String,
    /// Cross-sectional area (m²)
    pub area_m2: f64,
}

/// Generate self-weight uniform loads for all members
///
/// Returns a `Vec<UniformLoad>` with downward loads in DEAD case
pub fn create_self_weight_loads(
    members: &[MemberSelfWeight],
    density_kn_m3: f64,
) -> Vec<UniformLoad> {
    members
        .iter()
        .map(|m| {
            let w = -density_kn_m3 * m.area_m2; // negative = downward
            UniformLoad {
                id: format!("sw_{}", m.id),
                member_id: m.id.clone(),
                w,
                direction: LoadDirection::GlobalY,
                start_pos: 0.0,
                end_pos: 1.0,
                is_projected: false,
                load_case: "DEAD".into(),
            }
        })
        .collect()
}

// ============================================================================
// LOAD COMBINATION FACTORING
// ============================================================================

/// A factored nodal load (ready for solver)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactoredNodalLoad {
    pub node_id: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
}

/// Apply load combination factors to a set of nodal loads
///
/// Each entry in `case_loads` is keyed by load-case name.
/// `factors` maps case name → factor.
pub fn factor_nodal_loads(
    case_loads: &HashMap<String, Vec<NodalLoad>>,
    factors: &HashMap<String, f64>,
) -> Vec<FactoredNodalLoad> {
    let mut result: HashMap<String, FactoredNodalLoad> = HashMap::new();

    for (case_name, factor) in factors {
        if let Some(loads) = case_loads.get(case_name) {
            for nl in loads {
                let entry = result.entry(nl.node_id.clone()).or_insert(FactoredNodalLoad {
                    node_id: nl.node_id.clone(),
                    fx: 0.0,
                    fy: 0.0,
                    fz: 0.0,
                    mx: 0.0,
                    my: 0.0,
                    mz: 0.0,
                });
                entry.fx += nl.fx * factor;
                entry.fy += nl.fy * factor;
                entry.fz += nl.fz * factor;
                entry.mx += nl.mx * factor;
                entry.my += nl.my * factor;
                entry.mz += nl.mz * factor;
            }
        }
    }
    result.into_values().collect()
}

/// IS 456 default load combinations
pub fn default_combinations_is456() -> Vec<(String, HashMap<String, f64>)> {
    vec![
        (
            "1.5DL+1.5LL".into(),
            [("DEAD".into(), 1.5), ("LIVE".into(), 1.5)].into(),
        ),
        (
            "1.2DL+1.2LL+1.2WL".into(),
            [("DEAD".into(), 1.2), ("LIVE".into(), 1.2), ("WIND".into(), 1.2)].into(),
        ),
        (
            "0.9DL+1.5WL".into(),
            [("DEAD".into(), 0.9), ("WIND".into(), 1.5)].into(),
        ),
        (
            "1.5DL+1.5EQ".into(),
            [("DEAD".into(), 1.5), ("SEISMIC".into(), 1.5)].into(),
        ),
        (
            "DL+LL".into(),
            [("DEAD".into(), 1.0), ("LIVE".into(), 1.0)].into(),
        ),
    ]
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uniform_fea_full_span() {
        // UDL 10 kN/m on 6m span → total 60 kN, each reaction 30 kN
        let fea = uniform_load_fea(10.0, 6.0, 0.0, 1.0);
        assert!((fea.fy_start - 30.0).abs() < 0.1, "R_start = {}", fea.fy_start);
        assert!((fea.fy_end - 30.0).abs() < 0.1, "R_end = {}", fea.fy_end);
    }

    #[test]
    fn test_trapezoidal_fea_uniform() {
        // w1 = w2 = 10 → same as uniform
        let fea = trapezoidal_load_fea(10.0, 10.0, 6.0, 0.0, 1.0);
        assert!((fea.fy_start - 30.0).abs() < 0.5);
        assert!((fea.fy_end - 30.0).abs() < 0.5);
    }

    #[test]
    fn test_trapezoidal_fea_triangular() {
        // Triangular 0 → 20 kN/m on 6m → total 60 kN, centroid at 4m from start
        let fea = trapezoidal_load_fea(0.0, 20.0, 6.0, 0.0, 1.0);
        let total = fea.fy_start + fea.fy_end;
        assert!((total - 60.0).abs() < 0.5, "Total = {total}");
        // More load at end → Fy_end > Fy_start
        assert!(fea.fy_end > fea.fy_start, "end={} start={}", fea.fy_end, fea.fy_start);
    }

    #[test]
    fn test_point_load_fea_midspan() {
        let fea = point_load_fea(100.0, 6.0, 0.5);
        assert!((fea.fy_start - 50.0).abs() < 0.1);
        assert!((fea.fy_end - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_moment_load_fea() {
        let fea = moment_load_fea(50.0, 6.0, 0.5);
        // Shear should be symmetric but opposite
        assert!((fea.fy_start + fea.fy_end).abs() < 0.01);
    }

    #[test]
    fn test_thermal_strain() {
        let eps = thermal_strain(12e-6, 50.0);
        assert!((eps - 6e-4).abs() < 1e-6);
    }

    #[test]
    fn test_thermal_force() {
        // E=200e6 kN/m², A=0.01 m², α=12e-6, ΔT=50
        let f = thermal_force(200e6, 0.01, 12e-6, 50.0);
        // F = 200e6 * 0.01 * 12e-6 * 50 = 1200 kN
        assert!((f - 1200.0).abs() < 1.0, "F = {f}");
    }

    #[test]
    fn test_prestress_equivalent() {
        // P=1000 kN, straight cable, e=0.1m throughout
        let eq = prestress_equivalent(1000.0, 0.1, 0.2, 0.1, 10.0);
        // Sag = 0.2 - 0.1 = 0.1m, UDL = -8*1000*0.1/100 = -8 kN/m (upward)
        assert!((eq.equivalent_udl - (-8.0)).abs() < 0.1, "w_eq = {}", eq.equivalent_udl);
    }

    #[test]
    fn test_self_weight_loads() {
        let members = vec![
            MemberSelfWeight { id: "M1".into(), area_m2: 0.01 },
            MemberSelfWeight { id: "M2".into(), area_m2: 0.005 },
        ];
        let loads = create_self_weight_loads(&members, 78.5);
        assert_eq!(loads.len(), 2);
        assert!(loads[0].w < 0.0, "Should be downward");
        assert!((loads[0].w - (-78.5 * 0.01)).abs() < 0.001);
    }

    #[test]
    fn test_one_way_floor_distribution() {
        let panel = FloorPanel {
            x_min: 0.0,
            x_max: 8.0,
            z_min: 0.0,
            z_max: 3.0,
            lx: 8.0,
            lz: 3.0,
            aspect_ratio: 8.0 / 3.0,
            area: 24.0,
        };
        let beams = FloorPanelBeams {
            bottom: vec!["B1".into()],
            top: vec!["B2".into()],
            left: vec!["B3".into()],
            right: vec!["B4".into()],
        };
        let loads = distribute_floor_load(5.0, &panel, &beams, "LIVE");
        // One-way: Lx > Lz so load goes to bottom + top beams
        assert!(loads.len() == 2, "One-way should produce 2 loads, got {}", loads.len());
        // Tributary = Lz/2 = 1.5, w = 5.0 * 1.5 = 7.5
        assert!((loads[0].w1 - 7.5).abs() < 0.01);
    }

    #[test]
    fn test_two_way_floor_distribution() {
        let panel = FloorPanel {
            x_min: 0.0,
            x_max: 5.0,
            z_min: 0.0,
            z_max: 4.0,
            lx: 5.0,
            lz: 4.0,
            aspect_ratio: 5.0 / 4.0,
            area: 20.0,
        };
        let beams = FloorPanelBeams {
            bottom: vec!["B1".into()],
            top: vec!["B2".into()],
            left: vec!["B3".into()],
            right: vec!["B4".into()],
        };
        let loads = distribute_floor_load(5.0, &panel, &beams, "LIVE");
        // Two-way: short edges (left/right, 2 beams × 2 parts) + long edges (bottom/top, 2 beams × 3 parts) = 4+6=10
        assert!(loads.len() == 10, "Two-way should produce 10 loads, got {}", loads.len());
    }

    #[test]
    fn test_default_combinations() {
        let combos = default_combinations_is456();
        assert_eq!(combos.len(), 5);
        assert!(combos[0].1.contains_key("DEAD"));
    }
}
