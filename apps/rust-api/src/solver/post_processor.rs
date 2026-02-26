//! Post-Processor: SFD, BMD, Stress Contours, Deflection Diagrams
//!
//! Industrial-grade result post-processing like STAAD.Pro:
//! - Shear Force Diagrams (SFD) with intermediate points
//! - Bending Moment Diagrams (BMD) with parabolic interpolation
//! - Axial Force Diagrams (AFD)
//! - Deflection curves with cubic interpolation
//! - Von Mises stress computation
//! - Member stress distribution (top/bottom fiber)
//! - Unity check / utilization ratios
//! - Result table generation for reports

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Number of interpolation points per member for diagrams
const DEFAULT_STATIONS: usize = 21;

/// Point along a member for diagram plotting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagramPoint {
    /// Position along member (0.0 = start, 1.0 = end)
    pub position: f64,
    /// Absolute distance from start (mm or m)
    pub distance: f64,
    /// Value at this point
    pub value: f64,
}

/// Force diagram for a single member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberDiagram {
    pub member_id: String,
    pub member_length: f64,
    pub start_node: String,
    pub end_node: String,
    pub axial_force: Vec<DiagramPoint>,
    pub shear_y: Vec<DiagramPoint>,
    pub shear_z: Vec<DiagramPoint>,
    pub torsion: Vec<DiagramPoint>,
    pub moment_y: Vec<DiagramPoint>,
    pub moment_z: Vec<DiagramPoint>,
    pub deflection_y: Vec<DiagramPoint>,
    pub deflection_z: Vec<DiagramPoint>,
    /// Peak values summary
    pub peaks: MemberPeaks,
}

/// Peak (extreme) values for a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberPeaks {
    pub max_axial: f64,
    pub min_axial: f64,
    pub max_shear_y: f64,
    pub min_shear_y: f64,
    pub max_shear_z: f64,
    pub min_shear_z: f64,
    pub max_moment_y: f64,
    pub min_moment_y: f64,
    pub max_moment_z: f64,
    pub min_moment_z: f64,
    pub max_torsion: f64,
    pub max_deflection_y: f64,
    pub max_deflection_z: f64,
    /// Position of max moment (for design)
    pub max_moment_position: f64,
    /// Position of max deflection
    pub max_deflection_position: f64,
}

/// Stress results at a cross-section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressPoint {
    pub position: f64,
    pub distance: f64,
    pub axial_stress: f64,
    pub bending_stress_top: f64,
    pub bending_stress_bottom: f64,
    pub shear_stress: f64,
    pub von_mises_top: f64,
    pub von_mises_bottom: f64,
    pub combined_stress_top: f64,
    pub combined_stress_bottom: f64,
}

/// Stress distribution along a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberStress {
    pub member_id: String,
    pub points: Vec<StressPoint>,
    pub max_von_mises: f64,
    pub max_stress_position: f64,
    pub utilization: f64,
}

/// Member end forces (input to post-processor)
#[derive(Debug, Clone)]
pub struct MemberEndForces {
    pub member_id: String,
    pub start_node: String,
    pub end_node: String,
    pub length: f64,
    /// [fx, fy, fz, mx, my, mz] at start
    pub forces_start: [f64; 6],
    /// [fx, fy, fz, mx, my, mz] at end
    pub forces_end: [f64; 6],
    /// [dx, dy, dz, rx, ry, rz] at start
    pub displacements_start: [f64; 6],
    /// [dx, dy, dz, rx, ry, rz] at end
    pub displacements_end: [f64; 6],
}

/// Distributed load on a member (for diagram calculation)
#[derive(Debug, Clone)]
pub struct MemberDistLoad {
    pub member_id: String,
    pub wy: f64, // N/mm in local Y
    pub wz: f64, // N/mm in local Z
}

/// Section properties needed for stress computation
#[derive(Debug, Clone)]
pub struct SectionProps {
    pub area: f64,           // mm²
    pub ix: f64,             // mm⁴ (moment of inertia about strong axis)
    pub iy: f64,             // mm⁴ (moment of inertia about weak axis)
    pub sx_top: f64,         // mm³ (section modulus, top fiber)
    pub sx_bottom: f64,      // mm³ (section modulus, bottom fiber)
    pub sy: f64,             // mm³
    pub depth: f64,          // mm (total depth)
    pub web_thickness: f64,  // mm
    pub fy: f64,             // N/mm² (yield strength)
}

/// Post-Processor Engine
pub struct PostProcessor {
    pub num_stations: usize,
}

impl PostProcessor {
    pub fn new() -> Self {
        Self {
            num_stations: DEFAULT_STATIONS,
        }
    }

    pub fn with_stations(stations: usize) -> Self {
        Self {
            num_stations: stations.max(3),
        }
    }

    /// Generate complete force diagram for a member
    pub fn member_diagram(
        &self,
        forces: &MemberEndForces,
        dist_load: Option<&MemberDistLoad>,
    ) -> MemberDiagram {
        let l = forces.length;
        let n = self.num_stations;

        let mut axial = Vec::with_capacity(n);
        let mut shear_y = Vec::with_capacity(n);
        let mut shear_z = Vec::with_capacity(n);
        let mut torsion = Vec::with_capacity(n);
        let mut moment_y = Vec::with_capacity(n);
        let mut moment_z = Vec::with_capacity(n);
        let mut defl_y = Vec::with_capacity(n);
        let mut defl_z = Vec::with_capacity(n);

        let wy = dist_load.map(|dl| dl.wy).unwrap_or(0.0);
        let wz = dist_load.map(|dl| dl.wz).unwrap_or(0.0);

        // End forces (in local coordinates)
        let fx_s = forces.forces_start[0];
        let vy_s = forces.forces_start[1];
        let vz_s = forces.forces_start[2];
        let mx_s = forces.forces_start[3];
        let my_s = forces.forces_start[4];
        let mz_s = forces.forces_start[5];

        let mx_e = forces.forces_end[3];

        // Start/end displacements for deflection interpolation
        let dy_s = forces.displacements_start[1];
        let dz_s = forces.displacements_start[2];
        let ry_s = forces.displacements_start[4];
        let rz_s = forces.displacements_start[5];
        let dy_e = forces.displacements_end[1];
        let dz_e = forces.displacements_end[2];

        for i in 0..n {
            let xi = i as f64 / (n - 1) as f64;
            let x = xi * l;

            // --- Axial force (constant for no distributed axial load) ---
            let af = -fx_s; // Convention: tension positive
            axial.push(DiagramPoint { position: xi, distance: x, value: af });

            // --- Shear Force (V = V_start - w*x) ---
            let vy = -vy_s + wy * x;
            let vz_val = -vz_s + wz * x;
            shear_y.push(DiagramPoint { position: xi, distance: x, value: vy });
            shear_z.push(DiagramPoint { position: xi, distance: x, value: vz_val });

            // --- Torsion (linear interpolation) ---
            let tor = mx_s + (mx_e - mx_s) * xi;
            torsion.push(DiagramPoint { position: xi, distance: x, value: tor });

            // --- Bending Moment (M = M_start + V_start*x - w*x²/2) ---
            let mz_val = mz_s + vy_s * x - wy * x * x / 2.0;
            let my_val = my_s + vz_s * x - wz * x * x / 2.0;
            moment_y.push(DiagramPoint { position: xi, distance: x, value: my_val });
            moment_z.push(DiagramPoint { position: xi, distance: x, value: mz_val });

            // --- Deflection (cubic Hermite interpolation) ---
            let t = xi;
            let t2 = t * t;
            let t3 = t2 * t;

            // Hermite basis functions
            let h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
            let h10 = t3 - 2.0 * t2 + t;
            let h01 = -2.0 * t3 + 3.0 * t2;
            let h11 = t3 - t2;

            let def_y = h00 * dy_s + h10 * l * rz_s + h01 * dy_e + h11 * l * 0.0;
            let def_z = h00 * dz_s + h10 * l * (-ry_s) + h01 * dz_e + h11 * l * 0.0;

            defl_y.push(DiagramPoint { position: xi, distance: x, value: def_y });
            defl_z.push(DiagramPoint { position: xi, distance: x, value: def_z });
        }

        // Compute peaks
        let peaks = self.compute_peaks(&axial, &shear_y, &shear_z, &moment_y, &moment_z, &torsion, &defl_y, &defl_z);

        MemberDiagram {
            member_id: forces.member_id.clone(),
            member_length: l,
            start_node: forces.start_node.clone(),
            end_node: forces.end_node.clone(),
            axial_force: axial,
            shear_y,
            shear_z,
            torsion,
            moment_y,
            moment_z,
            deflection_y: defl_y,
            deflection_z: defl_z,
            peaks,
        }
    }

    /// Compute stress distribution along a member
    pub fn member_stress(
        &self,
        diagram: &MemberDiagram,
        section: &SectionProps,
    ) -> MemberStress {
        let n = diagram.moment_z.len();
        let mut points = Vec::with_capacity(n);
        let mut max_vm = 0.0_f64;
        let mut max_pos = 0.0;

        for i in 0..n {
            let xi = diagram.moment_z[i].position;
            let dist = diagram.moment_z[i].distance;

            // Axial stress
            let axial_stress = if section.area > 0.0 {
                diagram.axial_force[i].value / section.area
            } else {
                0.0
            };

            // Bending stress (top and bottom fibers)
            let bending_top = if section.sx_top > 0.0 {
                diagram.moment_z[i].value / section.sx_top
            } else {
                0.0
            };
            let bending_bottom = if section.sx_bottom > 0.0 {
                -diagram.moment_z[i].value / section.sx_bottom
            } else {
                0.0
            };

            // Shear stress (average, V*Q/(I*b) approximation)
            let shear_stress = if section.area > 0.0 && section.web_thickness > 0.0 {
                1.5 * diagram.shear_y[i].value / (section.depth * section.web_thickness)
            } else if section.area > 0.0 {
                diagram.shear_y[i].value / section.area
            } else {
                0.0
            };

            // Combined stress (top and bottom)
            let combined_top = axial_stress + bending_top;
            let combined_bottom = axial_stress + bending_bottom;

            // Von Mises stress
            let vm_top = (combined_top * combined_top + 3.0 * shear_stress * shear_stress).sqrt();
            let vm_bottom = (combined_bottom * combined_bottom + 3.0 * shear_stress * shear_stress).sqrt();

            let vm_max = vm_top.max(vm_bottom);
            if vm_max > max_vm {
                max_vm = vm_max;
                max_pos = xi;
            }

            points.push(StressPoint {
                position: xi,
                distance: dist,
                axial_stress,
                bending_stress_top: bending_top,
                bending_stress_bottom: bending_bottom,
                shear_stress,
                von_mises_top: vm_top,
                von_mises_bottom: vm_bottom,
                combined_stress_top: combined_top,
                combined_stress_bottom: combined_bottom,
            });
        }

        let utilization = if section.fy > 0.0 { max_vm / section.fy } else { 0.0 };

        MemberStress {
            member_id: diagram.member_id.clone(),
            points,
            max_von_mises: max_vm,
            max_stress_position: max_pos,
            utilization,
        }
    }

    /// Generate diagrams for all members in parallel
    pub fn process_all_members(
        &self,
        all_forces: &[MemberEndForces],
        dist_loads: &HashMap<String, MemberDistLoad>,
    ) -> Vec<MemberDiagram> {
        all_forces.iter().map(|forces| {
            let dl = dist_loads.get(&forces.member_id);
            self.member_diagram(forces, dl)
        }).collect()
    }

    /// Generate stress for all members
    pub fn stress_all_members(
        &self,
        diagrams: &[MemberDiagram],
        sections: &HashMap<String, SectionProps>,
        default_section: &SectionProps,
    ) -> Vec<MemberStress> {
        diagrams.iter().map(|diag| {
            let section = sections.get(&diag.member_id).unwrap_or(default_section);
            self.member_stress(diag, section)
        }).collect()
    }

    /// Find members exceeding utilization threshold
    pub fn find_critical_members(
        stresses: &[MemberStress],
        threshold: f64,
    ) -> Vec<(String, f64)> {
        let mut critical: Vec<(String, f64)> = stresses.iter()
            .filter(|s| s.utilization > threshold)
            .map(|s| (s.member_id.clone(), s.utilization))
            .collect();
        critical.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        critical
    }

    /// Generate tabular output (like STAAD print member forces)
    pub fn generate_force_table(
        &self,
        diagrams: &[MemberDiagram],
    ) -> Vec<ForceTableRow> {
        let mut rows = Vec::new();
        for diag in diagrams {
            // Start
            rows.push(ForceTableRow {
                member_id: diag.member_id.clone(),
                position: 0.0,
                distance: 0.0,
                axial: diag.axial_force.first().map(|p| p.value).unwrap_or(0.0),
                shear_y: diag.shear_y.first().map(|p| p.value).unwrap_or(0.0),
                shear_z: diag.shear_z.first().map(|p| p.value).unwrap_or(0.0),
                torsion: diag.torsion.first().map(|p| p.value).unwrap_or(0.0),
                moment_y: diag.moment_y.first().map(|p| p.value).unwrap_or(0.0),
                moment_z: diag.moment_z.first().map(|p| p.value).unwrap_or(0.0),
            });
            // Mid
            let mid_idx = diag.axial_force.len() / 2;
            rows.push(ForceTableRow {
                member_id: diag.member_id.clone(),
                position: 0.5,
                distance: diag.member_length / 2.0,
                axial: diag.axial_force.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
                shear_y: diag.shear_y.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
                shear_z: diag.shear_z.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
                torsion: diag.torsion.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
                moment_y: diag.moment_y.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
                moment_z: diag.moment_z.get(mid_idx).map(|p| p.value).unwrap_or(0.0),
            });
            // End
            rows.push(ForceTableRow {
                member_id: diag.member_id.clone(),
                position: 1.0,
                distance: diag.member_length,
                axial: diag.axial_force.last().map(|p| p.value).unwrap_or(0.0),
                shear_y: diag.shear_y.last().map(|p| p.value).unwrap_or(0.0),
                shear_z: diag.shear_z.last().map(|p| p.value).unwrap_or(0.0),
                torsion: diag.torsion.last().map(|p| p.value).unwrap_or(0.0),
                moment_y: diag.moment_y.last().map(|p| p.value).unwrap_or(0.0),
                moment_z: diag.moment_z.last().map(|p| p.value).unwrap_or(0.0),
            });
        }
        rows
    }

    fn compute_peaks(
        &self,
        axial: &[DiagramPoint],
        shear_y: &[DiagramPoint],
        shear_z: &[DiagramPoint],
        moment_y: &[DiagramPoint],
        moment_z: &[DiagramPoint],
        torsion: &[DiagramPoint],
        defl_y: &[DiagramPoint],
        defl_z: &[DiagramPoint],
    ) -> MemberPeaks {
        let find_max = |pts: &[DiagramPoint]| -> f64 {
            pts.iter().map(|p| p.value).fold(f64::NEG_INFINITY, f64::max)
        };
        let find_min = |pts: &[DiagramPoint]| -> f64 {
            pts.iter().map(|p| p.value).fold(f64::INFINITY, f64::min)
        };
        let find_abs_max_pos = |pts: &[DiagramPoint]| -> f64 {
            pts.iter()
                .max_by(|a, b| a.value.abs().partial_cmp(&b.value.abs()).unwrap_or(std::cmp::Ordering::Equal))
                .map(|p| p.position)
                .unwrap_or(0.0)
        };

        MemberPeaks {
            max_axial: find_max(axial),
            min_axial: find_min(axial),
            max_shear_y: find_max(shear_y),
            min_shear_y: find_min(shear_y),
            max_shear_z: find_max(shear_z),
            min_shear_z: find_min(shear_z),
            max_moment_y: find_max(moment_y),
            min_moment_y: find_min(moment_y),
            max_moment_z: find_max(moment_z),
            min_moment_z: find_min(moment_z),
            max_torsion: find_max(torsion).abs().max(find_min(torsion).abs()),
            max_deflection_y: find_max(defl_y).abs().max(find_min(defl_y).abs()),
            max_deflection_z: find_max(defl_z).abs().max(find_min(defl_z).abs()),
            max_moment_position: find_abs_max_pos(moment_z),
            max_deflection_position: find_abs_max_pos(defl_y),
        }
    }
}

/// Tabular force output row
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForceTableRow {
    pub member_id: String,
    pub position: f64,
    pub distance: f64,
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub torsion: f64,
    pub moment_y: f64,
    pub moment_z: f64,
}

impl Default for PostProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cantilever_diagrams() {
        let pp = PostProcessor::new();

        // Cantilever beam with point load at free end
        let p = 10000.0; // 10 kN
        let l = 3000.0;  // 3 m
        let forces = MemberEndForces {
            member_id: "M1".into(),
            start_node: "N1".into(),
            end_node: "N2".into(),
            length: l,
            forces_start: [0.0, p, 0.0, 0.0, 0.0, -p * l], // Fixed end reactions
            forces_end: [0.0, -p, 0.0, 0.0, 0.0, 0.0],
            displacements_start: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            displacements_end: [0.0, -5.0, 0.0, 0.0, 0.0, 0.001],
        };

        let diagram = pp.member_diagram(&forces, None);

        // Shear should be constant = P
        assert!((diagram.shear_y[0].value - (-p)).abs() < 1.0);
        // Moment at start should be P*L
        assert!((diagram.moment_z[0].value - (-p * l)).abs() < 100.0);
        // Moment at end should be ~0
        let last = diagram.moment_z.last().unwrap();
        assert!(last.value.abs() < 100.0);

        // Peaks
        assert!(diagram.peaks.max_moment_z.abs() > 0.0 || diagram.peaks.min_moment_z.abs() > 0.0);
    }

    #[test]
    fn test_stress_computation() {
        let pp = PostProcessor::new();
        let forces = MemberEndForces {
            member_id: "M1".into(),
            start_node: "N1".into(),
            end_node: "N2".into(),
            length: 5000.0,
            forces_start: [100000.0, 50000.0, 0.0, 0.0, 0.0, -125000000.0],
            forces_end: [-100000.0, -50000.0, 0.0, 0.0, 0.0, 125000000.0],
            displacements_start: [0.0; 6],
            displacements_end: [0.5, -10.0, 0.0, 0.0, 0.0, 0.002],
        };

        let diagram = pp.member_diagram(&forces, None);

        let section = SectionProps {
            area: 8530.0,          // ISMB 400
            ix: 20458.4e4,
            iy: 622.1e4,
            sx_top: 1022.9e3,
            sx_bottom: 1022.9e3,
            sy: 155.5e3,
            depth: 400.0,
            web_thickness: 8.9,
            fy: 250.0,
        };

        let stress = pp.member_stress(&diagram, &section);
        assert!(stress.max_von_mises > 0.0);
        assert!(stress.utilization > 0.0);
    }
}
