use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

const GAMMA_C: f64 = 1.50;
const GAMMA_S: f64 = 1.15;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberSection {
    pub id: String,
    pub fibers: Vec<Fiber>,
    pub total_area: f64,
    pub centroid: (f64, f64),
    pub moments_of_inertia: (f64, f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fiber {
    pub y: f64,
    pub z: f64,
    pub area: f64,
    pub material: FiberMaterial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FiberMaterial {
    pub material_type: FiberMaterialType,
    pub fy: f64,
    pub fu: f64,
    pub e: f64,
    pub esh: f64,
    pub eps_y: f64,
    pub eps_u: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FiberMaterialType {
    Steel,
    Concrete,
    ConfinedConcrete,
    Rebar,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PMInteractionDiagram {
    pub points: Vec<PMPoint>,
    pub phi_pn_max: f64,
    pub phi_pn_tension: f64,
    pub phi_mn_pure_bending: f64,
    pub balanced_point: (f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PMPoint {
    pub phi_pn: f64,
    pub phi_mn: f64,
    pub c: f64,
    pub phi: f64,
    pub strain_state: StrainState,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum StrainState {
    Compression,
    TransitionCompression,
    Balanced,
    TransitionTension,
    Tension,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentCurvaturePoint {
    pub curvature: f64,
    pub moment: f64,
    pub neutral_axis: f64,
    pub axial_load: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhiFactors {
    pub compression: f64,
    pub tension: f64,
    pub shear: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlexureCheckResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
    pub design_moment_knm: f64,
    pub capacity_moment_knm: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AxialCheckResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
    pub design_axial_kn: f64,
    pub capacity_axial_kn: f64,
}

impl Default for PhiFactors {
    fn default() -> Self {
        Self { compression: 0.65, tension: 0.90, shear: 0.75 }
    }
}

impl FiberMaterial {
    pub fn concrete(fc: f64) -> Self {
        Self {
            material_type: FiberMaterialType::Concrete,
            fy: 0.0,
            fu: fc,
            e: 4700.0 * fc.sqrt(),
            esh: 0.0,
            eps_y: 0.002,
            eps_u: 0.003,
        }
    }

    pub fn rebar(fy: f64) -> Self {
        Self {
            material_type: FiberMaterialType::Rebar,
            fy,
            fu: 1.25 * fy,
            e: 200_000.0,
            esh: 2_000.0,
            eps_y: fy / 200_000.0,
            eps_u: 0.1,
        }
    }
}

impl FiberSection {
    /// Flexure capacity check per ACI 318-19 / fiber-strain compatibility.
    /// Clause reference is returned in the result for auditability.
    pub fn check_flexure_capacity(&self, design_moment_knm: f64, phi_factors: &PhiFactors) -> FlexureCheckResult {
        let interaction = self.compute_pm_interaction('x', phi_factors);
        let capacity_moment_knm = interaction.phi_mn_pure_bending / 1_000_000.0;
        let utilization = if capacity_moment_knm.abs() > f64::EPSILON {
            design_moment_knm.abs() / capacity_moment_knm.abs()
        } else {
            f64::INFINITY
        };
        let passed = utilization <= 1.0;
        FlexureCheckResult {
            passed,
            utilization,
            message: if passed {
                format!("Flexure OK per ACI 318-19; M_u = {:.3} kN·m <= φM_n = {:.3} kN·m", design_moment_knm, capacity_moment_knm)
            } else {
                format!("Flexure NG per ACI 318-19; M_u = {:.3} kN·m > φM_n = {:.3} kN·m", design_moment_knm, capacity_moment_knm)
            },
            clause: "ACI 318-19 strain compatibility flexure check".to_string(),
            design_moment_knm,
            capacity_moment_knm,
        }
    }

    /// Axial capacity check per ACI 318-19 compression-controlled section limit.
    pub fn check_axial_capacity(&self, design_axial_kn: f64, phi_factors: &PhiFactors) -> AxialCheckResult {
        let interaction = self.compute_pm_interaction('x', phi_factors);
        let capacity_axial_kn = interaction.phi_pn_max / 1_000.0;
        let utilization = if capacity_axial_kn.abs() > f64::EPSILON {
            design_axial_kn.abs() / capacity_axial_kn.abs()
        } else {
            f64::INFINITY
        };
        let passed = utilization <= 1.0;
        AxialCheckResult {
            passed,
            utilization,
            message: if passed {
                format!("Axial OK per ACI 318-19; P_u = {:.3} kN <= φP_n = {:.3} kN", design_axial_kn, capacity_axial_kn)
            } else {
                format!("Axial NG per ACI 318-19; P_u = {:.3} kN > φP_n = {:.3} kN", design_axial_kn, capacity_axial_kn)
            },
            clause: "ACI 318-19 axial compression interaction check".to_string(),
            design_axial_kn,
            capacity_axial_kn,
        }
    }

    pub fn rc_rectangular(
        b: f64,
        h: f64,
        cover: f64,
        fc: f64,
        fy: f64,
        bar_dia: f64,
        num_bars_top: usize,
        num_bars_bot: usize,
        num_side_bars: usize,
    ) -> Self {
        let mut fibers = Vec::new();
        let num_layers = 20;
        let layer_height = h / num_layers as f64;
        let concrete_mat = FiberMaterial {
            material_type: FiberMaterialType::Concrete,
            fy: 0.0,
            fu: fc,
            e: 4700.0 * fc.sqrt(),
            esh: 0.0,
            eps_y: 0.002,
            eps_u: 0.003,
        };

        for i in 0..num_layers {
            let y = -h / 2.0 + layer_height * (i as f64 + 0.5);
            fibers.push(Fiber { y, z: 0.0, area: b * layer_height, material: concrete_mat.clone() });
        }

        let bar_area = PI * bar_dia.powi(2) / 4.0;
        let rebar_mat = FiberMaterial {
            material_type: FiberMaterialType::Rebar,
            fy,
            fu: 1.25 * fy,
            e: 200_000.0,
            esh: 0.01 * 200_000.0,
            eps_y: fy / 200_000.0,
            eps_u: 0.1,
        };

        let d_top = -h / 2.0 + cover + bar_dia / 2.0;
        let d_bot = h / 2.0 - cover - bar_dia / 2.0;

        if num_bars_top > 0 {
            let spacing = if num_bars_top > 1 { (b - 2.0 * cover - bar_dia) / (num_bars_top - 1) as f64 } else { 0.0 };
            for i in 0..num_bars_top {
                let z = -b / 2.0 + cover + bar_dia / 2.0 + i as f64 * spacing;
                fibers.push(Fiber { y: d_top, z, area: bar_area, material: rebar_mat.clone() });
            }
        }

        if num_bars_bot > 0 {
            let spacing = if num_bars_bot > 1 { (b - 2.0 * cover - bar_dia) / (num_bars_bot - 1) as f64 } else { 0.0 };
            for i in 0..num_bars_bot {
                let z = -b / 2.0 + cover + bar_dia / 2.0 + i as f64 * spacing;
                fibers.push(Fiber { y: d_bot, z, area: bar_area, material: rebar_mat.clone() });
            }
        }

        if num_side_bars > 0 && num_side_bars >= 2 {
            let spacing = (d_bot - d_top) / (num_side_bars + 1) as f64;
            for side in 0..2 {
                let z = if side == 0 { -b / 2.0 + cover + bar_dia / 2.0 } else { b / 2.0 - cover - bar_dia / 2.0 };
                for i in 1..=num_side_bars {
                    let y = d_top + i as f64 * spacing;
                    fibers.push(Fiber { y, z, area: bar_area, material: rebar_mat.clone() });
                }
            }
        }

        if fibers.is_empty() {
            fibers.push(Fiber { y: 0.0, z: 0.0, area: 0.0, material: concrete_mat });
        }

        let total_area: f64 = fibers.iter().map(|f| f.area).sum();
        let cy: f64 = if total_area.abs() > f64::EPSILON { fibers.iter().map(|f| f.area * f.y).sum::<f64>() / total_area } else { 0.0 };
        let cz: f64 = if total_area.abs() > f64::EPSILON { fibers.iter().map(|f| f.area * f.z).sum::<f64>() / total_area } else { 0.0 };
        let iy: f64 = fibers.iter().map(|f| f.area * (f.z - cz).powi(2)).sum();
        let iz: f64 = fibers.iter().map(|f| f.area * (f.y - cy).powi(2)).sum();
        let iyz: f64 = fibers.iter().map(|f| f.area * (f.y - cy) * (f.z - cz)).sum();

        Self { id: "RC_RECT".to_string(), fibers, total_area, centroid: (cy, cz), moments_of_inertia: (iy, iz, iyz) }
    }

    pub fn compute_pm_interaction(&self, _axis: char, phi_factors: &PhiFactors) -> PMInteractionDiagram {
        let mut points = Vec::new();
        let y_max = self.fibers.iter().map(|f| f.y).fold(f64::NEG_INFINITY, f64::max);
        let y_min = self.fibers.iter().map(|f| f.y).fold(f64::INFINITY, f64::min);
        let h = y_max - y_min;
        let eps_cu = 0.003;
        let c_values: Vec<f64> = (0..=50).map(|i| if i == 0 { 0.001 * h } else if i == 50 { 100.0 * h } else { h * (i as f64 / 50.0) * 3.0 }).collect();

        for &c in &c_values {
            let (pn, mn, strain_state) = self.compute_capacity_at_c(c, eps_cu, y_max);
            let phi = match strain_state {
                StrainState::Compression => phi_factors.compression,
                StrainState::TransitionCompression => phi_factors.compression + (phi_factors.tension - phi_factors.compression) * 0.25,
                StrainState::Balanced => (phi_factors.compression + phi_factors.tension) / 2.0,
                StrainState::TransitionTension => phi_factors.compression + (phi_factors.tension - phi_factors.compression) * 0.75,
                StrainState::Tension => phi_factors.tension,
            };
            points.push(PMPoint { phi_pn: phi * pn, phi_mn: phi * mn, c, phi, strain_state });
        }

        let phi_pn_max = points.iter().map(|p| p.phi_pn).fold(f64::NEG_INFINITY, f64::max);
        let phi_pn_tension = points.iter().map(|p| p.phi_pn).fold(f64::INFINITY, f64::min);
        let phi_mn_pure_bending = points.iter().filter(|p| p.phi_pn.abs() < 0.05 * phi_pn_max.abs()).map(|p| p.phi_mn).fold(0.0, f64::max);
        let balanced_idx = points.iter().enumerate().max_by(|(_, a), (_, b)| a.phi_mn.partial_cmp(&b.phi_mn).unwrap_or(std::cmp::Ordering::Equal)).map(|(i, _)| i).unwrap_or(0);
        let balanced_point = (points[balanced_idx].phi_pn, points[balanced_idx].phi_mn);

        PMInteractionDiagram { points, phi_pn_max, phi_pn_tension, phi_mn_pure_bending, balanced_point }
    }

    fn compute_capacity_at_c(&self, c: f64, eps_cu: f64, y_top: f64) -> (f64, f64, StrainState) {
        let mut pn = 0.0;
        let mut mn = 0.0;
        let mut max_steel_strain: f64 = 0.0;
        for fiber in &self.fibers {
            let dist = y_top - fiber.y;
            let strain = if c > 1e-10 { eps_cu * (c - dist) / c } else { -0.1 };
            let stress = self.fiber_stress(fiber, strain);
            let force = stress * fiber.area;
            pn += force;
            mn += force * fiber.y;
            if matches!(fiber.material.material_type, FiberMaterialType::Rebar | FiberMaterialType::Steel) && strain.abs() > max_steel_strain.abs() { max_steel_strain = strain; }
        }
        let eps_y = 0.002;
        let strain_state = if max_steel_strain >= 0.005 { StrainState::Tension } else if max_steel_strain >= 0.002 { StrainState::TransitionTension } else if max_steel_strain >= eps_y { StrainState::Balanced } else if max_steel_strain >= 0.0 { StrainState::TransitionCompression } else { StrainState::Compression };
        (pn, mn.abs(), strain_state)
    }

    fn fiber_stress(&self, fiber: &Fiber, strain: f64) -> f64 {
        match fiber.material.material_type {
            FiberMaterialType::Concrete | FiberMaterialType::ConfinedConcrete => {
                if strain >= 0.0 { 0.0 } else {
                    let eps_0 = -0.002;
                    let fc = fiber.material.fu;
                    if strain >= eps_0 { fc * (2.0 * strain / eps_0 - (strain / eps_0).powi(2)) } else { fc * (1.0 - 0.15 * (strain - eps_0) / (0.003 - (-eps_0))) }
                }
            }
            FiberMaterialType::Steel | FiberMaterialType::Rebar => {
                let fy = fiber.material.fy;
                let e = fiber.material.e;
                let eps_y = fy / e;
                if strain.abs() <= eps_y { e * strain } else { let sign = strain.signum(); let plastic_strain = strain.abs() - eps_y; sign * (fy + fiber.material.esh * plastic_strain) }
            }
        }
    }

    /// Flexural steel area estimate per ACI 318-19 strength design.
    /// Returns required tension steel area in mm².
    pub fn required_tension_steel_area(&self, design_moment_knm: f64, fy: f64, jd_mm: f64) -> Result<f64, String> {
        if fy <= 0.0 || jd_mm <= 0.0 {
            return Err("fy and jd must be positive".to_string());
        }
        let mu_nmm = design_moment_knm * 1_000_000.0;
        let as_req = mu_nmm / (0.87 * fy * jd_mm);
        Ok(as_req.max(0.0))
    }

    pub fn moment_curvature(&self, axial_load: f64, num_points: usize) -> Vec<MomentCurvaturePoint> {
        let mut points = Vec::with_capacity(num_points);
        let y_max = self.fibers.iter().map(|f| f.y).fold(f64::NEG_INFINITY, f64::max);
        let y_min = self.fibers.iter().map(|f| f.y).fold(f64::INFINITY, f64::min);
        let h = y_max - y_min;
        let kappa_max = 0.1 / h;
        for i in 0..num_points {
            let kappa = kappa_max * i as f64 / (num_points - 1) as f64;
            let (moment, neutral_axis) = self.find_moment_at_curvature(kappa, axial_load, y_max, h);
            points.push(MomentCurvaturePoint { curvature: kappa, moment, neutral_axis, axial_load });
        }
        points
    }

    fn find_moment_at_curvature(&self, kappa: f64, target_p: f64, y_top: f64, h: f64) -> (f64, f64) {
        let mut c_low = 0.001 * h;
        let mut c_high = 10.0 * h;
        for _ in 0..50 {
            let c = (c_low + c_high) / 2.0;
            let eps_top = kappa * c;
            let mut p = 0.0;
            let mut m = 0.0;
            for fiber in &self.fibers {
                let dist = y_top - fiber.y;
                let strain = eps_top * (1.0 - dist / c);
                let stress = self.fiber_stress(fiber, strain);
                let force = stress * fiber.area;
                p += force;
                m += force * fiber.y;
            }
            if (p - target_p).abs() < 1e-6 * target_p.abs().max(1.0) { return (m.abs(), c); }
            if p > target_p { c_high = c; } else { c_low = c; }
        }
        (0.0, h / 2.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebar_material_has_expected_modulus() {
        let m = FiberMaterial::rebar(500.0);
        assert_eq!(m.e, 200_000.0);
        assert!(m.eps_y > 0.0);
    }

    #[test]
    fn required_steel_area_rejects_invalid_inputs() {
        let section = FiberSection::rc_rectangular(300.0, 500.0, 40.0, 30.0, 500.0, 16.0, 2, 2, 2);
        let res = section.required_tension_steel_area(120.0, 0.0, 250.0);
        assert!(res.is_err());
    }

    #[test]
    fn flexure_check_returns_clause_text() {
        let section = FiberSection::rc_rectangular(300.0, 500.0, 40.0, 30.0, 500.0, 16.0, 2, 2, 2);
        let out = section.check_flexure_capacity(50.0, &PhiFactors::default());
        assert!(out.clause.contains("ACI 318"));
    }
}
