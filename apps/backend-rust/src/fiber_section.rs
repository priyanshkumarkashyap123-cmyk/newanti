//! Fiber Section Analysis Module
//! 
//! Distributed plasticity modeling using fiber sections:
//! - Fiber discretization of cross-sections
//! - Nonlinear material stress-strain
//! - Section moment-curvature analysis
//! - Axial-moment interaction (P-M)
//! - Biaxial bending (P-Mx-My)
//! - Concrete confinement models

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Fiber section analyzer
#[derive(Debug, Clone)]
pub struct FiberSection {
    /// Section name
    pub name: String,
    /// Fibers in section
    pub fibers: Vec<Fiber>,
    /// Section dimensions
    pub dimensions: SectionDimensions,
    /// Neutral axis depth (updated during analysis)
    pub neutral_axis: f64,
    /// Current curvature
    pub curvature: f64,
    /// Current axial strain at centroid
    pub axial_strain: f64,
}

/// Individual fiber
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fiber {
    /// Material type
    pub material: FiberMaterial,
    /// Area (m²)
    pub area: f64,
    /// Y-coordinate from centroid (m)
    pub y: f64,
    /// Z-coordinate from centroid (m)
    pub z: f64,
    /// Current strain
    pub strain: f64,
    /// Current stress (MPa)
    pub stress: f64,
}

/// Fiber material types
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FiberMaterial {
    /// Unconfined concrete
    ConcreteUnconfined,
    /// Confined concrete
    ConcreteConfined,
    /// Reinforcing steel
    ReinforcingSteel,
    /// Prestressing steel
    PrestressingSteel,
    /// Structural steel
    StructuralSteel,
}

/// Section dimensions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionDimensions {
    /// Width (m)
    pub width: f64,
    /// Height (m)
    pub height: f64,
    /// Section type
    pub section_type: SectionType,
    /// Cover to reinforcement (m)
    pub cover: f64,
}

/// Section type
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SectionType {
    Rectangular,
    Circular,
    TShaped,
    IBeam,
    BoxSection,
}

/// Material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcreteMaterial {
    /// Compressive strength (MPa)
    pub fc: f64,
    /// Strain at peak stress
    pub eps_c0: f64,
    /// Ultimate strain (unconfined)
    pub eps_cu: f64,
    /// Elastic modulus (MPa)
    pub ec: f64,
    /// Tensile strength (MPa)
    pub ft: f64,
    /// Confinement ratio (fcc/fc)
    pub confinement_ratio: f64,
}

impl ConcreteMaterial {
    /// Create unconfined concrete
    pub fn unconfined(fc: f64) -> Self {
        let ec = 4700.0 * fc.sqrt(); // ACI approximation
        let ft = 0.62 * fc.sqrt();
        
        Self {
            fc,
            eps_c0: 0.002,
            eps_cu: 0.003,
            ec,
            ft,
            confinement_ratio: 1.0,
        }
    }
    
    /// Create confined concrete (Mander model)
    pub fn confined(fc: f64, fl: f64) -> Self {
        // fl = lateral confining pressure
        let mut mat = Self::unconfined(fc);
        
        // Mander confinement model
        let fcc = fc * (-1.254 + 2.254 * (1.0 + 7.94 * fl / fc).sqrt() - 2.0 * fl / fc);
        mat.confinement_ratio = fcc / fc;
        
        // Enhanced strain capacity
        mat.eps_c0 = 0.002 * (1.0 + 5.0 * (mat.confinement_ratio - 1.0));
        mat.eps_cu = 0.004 + 0.25 * fl / fc;
        
        mat
    }
    
    /// Stress-strain (Mander model)
    pub fn stress(&self, strain: f64) -> f64 {
        if strain >= 0.0 {
            // Tension (simplified)
            if strain < self.ft / self.ec {
                strain * self.ec
            } else {
                0.0 // Cracked
            }
        } else {
            // Compression
            let eps = -strain;
            let fcc = self.fc * self.confinement_ratio;
            let eps_cc = self.eps_c0;
            
            if eps > self.eps_cu * self.confinement_ratio {
                return 0.0; // Crushed
            }
            
            let x = eps / eps_cc;
            let esec = fcc / eps_cc;
            let r = self.ec / (self.ec - esec);
            
            -fcc * x * r / (r - 1.0 + x.powf(r))
        }
    }
    
    /// Tangent modulus
    pub fn tangent(&self, strain: f64) -> f64 {
        let delta = 1e-6;
        let s1 = self.stress(strain - delta);
        let s2 = self.stress(strain + delta);
        (s2 - s1) / (2.0 * delta)
    }
}

/// Steel material
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteelMaterial {
    /// Yield strength (MPa)
    pub fy: f64,
    /// Ultimate strength (MPa)
    pub fu: f64,
    /// Elastic modulus (MPa)
    pub es: f64,
    /// Strain hardening modulus (MPa)
    pub esh: f64,
    /// Yield strain
    pub eps_y: f64,
    /// Strain at hardening onset
    pub eps_sh: f64,
    /// Ultimate strain
    pub eps_u: f64,
}

impl SteelMaterial {
    /// Create reinforcing steel (Grade 60)
    pub fn rebar(fy: f64) -> Self {
        let es = 200000.0;
        let eps_y = fy / es;
        
        Self {
            fy,
            fu: 1.25 * fy,
            es,
            esh: 0.02 * es,
            eps_y,
            eps_sh: 0.01,
            eps_u: 0.10,
        }
    }
    
    /// Create prestressing steel
    pub fn prestressing(fpu: f64) -> Self {
        let es = 195000.0;
        
        Self {
            fy: 0.85 * fpu,
            fu: fpu,
            es,
            esh: 0.01 * es,
            eps_y: 0.85 * fpu / es,
            eps_sh: 0.007,
            eps_u: 0.05,
        }
    }
    
    /// Create structural steel
    pub fn structural(fy: f64) -> Self {
        let es = 200000.0;
        
        Self {
            fy,
            fu: 1.1 * fy,
            es,
            esh: 0.015 * es,
            eps_y: fy / es,
            eps_sh: 0.015,
            eps_u: 0.20,
        }
    }
    
    /// Stress-strain (bilinear with hardening)
    pub fn stress(&self, strain: f64) -> f64 {
        let eps = strain.abs();
        let sign = strain.signum();
        
        if eps <= self.eps_y {
            // Elastic
            sign * eps * self.es
        } else if eps <= self.eps_sh {
            // Yield plateau
            sign * self.fy
        } else if eps <= self.eps_u {
            // Strain hardening
            let hardening = self.esh * (eps - self.eps_sh);
            sign * (self.fy + hardening).min(self.fu)
        } else {
            // Fracture
            0.0
        }
    }
    
    /// Tangent modulus
    pub fn tangent(&self, strain: f64) -> f64 {
        let eps = strain.abs();
        
        if eps <= self.eps_y {
            self.es
        } else if eps <= self.eps_sh {
            0.0
        } else if eps <= self.eps_u {
            self.esh
        } else {
            0.0
        }
    }
}

impl FiberSection {
    /// Create new fiber section
    pub fn new(name: &str, dimensions: SectionDimensions) -> Self {
        Self {
            name: name.to_string(),
            fibers: Vec::new(),
            dimensions,
            neutral_axis: 0.0,
            curvature: 0.0,
            axial_strain: 0.0,
        }
    }
    
    /// Create rectangular RC section
    pub fn rectangular_rc(width: f64, height: f64, cover: f64, 
                          _fc: f64, _fy: f64, rebar_areas: &[(f64, f64, f64)]) -> Self {
        let dims = SectionDimensions {
            width,
            height,
            section_type: SectionType::Rectangular,
            cover,
        };
        
        let mut section = Self::new("Rectangular RC", dims);
        
        // Discretize concrete
        let n_y = 20;
        let n_z = 10;
        let dy = height / n_y as f64;
        let dz = width / n_z as f64;
        
        for iy in 0..n_y {
            for iz in 0..n_z {
                let y = -height / 2.0 + (iy as f64 + 0.5) * dy;
                let z = -width / 2.0 + (iz as f64 + 0.5) * dz;
                
                // Check if confined (inside stirrups)
                let is_confined = y.abs() < (height / 2.0 - cover) && 
                                  z.abs() < (width / 2.0 - cover);
                
                section.fibers.push(Fiber {
                    material: if is_confined { 
                        FiberMaterial::ConcreteConfined 
                    } else { 
                        FiberMaterial::ConcreteUnconfined 
                    },
                    area: dy * dz,
                    y,
                    z,
                    strain: 0.0,
                    stress: 0.0,
                });
            }
        }
        
        // Add reinforcing bars
        for (area, y, z) in rebar_areas {
            section.fibers.push(Fiber {
                material: FiberMaterial::ReinforcingSteel,
                area: *area,
                y: *y,
                z: *z,
                strain: 0.0,
                stress: 0.0,
            });
        }
        
        section
    }
    
    /// Create circular RC section
    pub fn circular_rc(diameter: f64, cover: f64, _fc: f64, _fy: f64, 
                       n_bars: usize, bar_area: f64) -> Self {
        let dims = SectionDimensions {
            width: diameter,
            height: diameter,
            section_type: SectionType::Circular,
            cover,
        };
        
        let mut section = Self::new("Circular RC", dims);
        let radius = diameter / 2.0;
        
        // Discretize concrete using polar coordinates
        let n_r = 10;
        let n_theta = 16;
        
        for ir in 0..n_r {
            let r_inner = ir as f64 / n_r as f64 * radius;
            let r_outer = (ir + 1) as f64 / n_r as f64 * radius;
            let r_mid = (r_inner + r_outer) / 2.0;
            
            for it in 0..n_theta {
                let theta = 2.0 * PI * it as f64 / n_theta as f64;
                let y = r_mid * theta.sin();
                let z = r_mid * theta.cos();
                
                let area = PI * (r_outer * r_outer - r_inner * r_inner) / n_theta as f64;
                
                let is_confined = r_mid < radius - cover;
                
                section.fibers.push(Fiber {
                    material: if is_confined {
                        FiberMaterial::ConcreteConfined
                    } else {
                        FiberMaterial::ConcreteUnconfined
                    },
                    area,
                    y,
                    z,
                    strain: 0.0,
                    stress: 0.0,
                });
            }
        }
        
        // Add reinforcing bars around perimeter
        let bar_radius = radius - cover;
        for i in 0..n_bars {
            let theta = 2.0 * PI * i as f64 / n_bars as f64;
            section.fibers.push(Fiber {
                material: FiberMaterial::ReinforcingSteel,
                area: bar_area,
                y: bar_radius * theta.sin(),
                z: bar_radius * theta.cos(),
                strain: 0.0,
                stress: 0.0,
            });
        }
        
        section
    }
    
    /// Update fiber strains from curvature and axial strain
    pub fn update_strains(&mut self, axial_strain: f64, curvature_y: f64, curvature_z: f64) {
        self.axial_strain = axial_strain;
        self.curvature = (curvature_y * curvature_y + curvature_z * curvature_z).sqrt();
        
        for fiber in &mut self.fibers {
            // Plane sections remain plane
            fiber.strain = axial_strain - curvature_y * fiber.y - curvature_z * fiber.z;
        }
    }
    
    /// Calculate section forces
    pub fn calculate_forces(&mut self, concrete: &ConcreteMaterial, steel: &SteelMaterial) -> SectionForces {
        let mut n = 0.0;  // Axial force
        let mut my = 0.0; // Moment about y-axis
        let mut mz = 0.0; // Moment about z-axis
        
        for fiber in &mut self.fibers {
            // Get stress from material model
            fiber.stress = match fiber.material {
                FiberMaterial::ConcreteUnconfined | FiberMaterial::ConcreteConfined => {
                    concrete.stress(fiber.strain)
                },
                FiberMaterial::ReinforcingSteel | FiberMaterial::StructuralSteel => {
                    steel.stress(fiber.strain)
                },
                FiberMaterial::PrestressingSteel => {
                    steel.stress(fiber.strain)
                },
            };
            
            let force = fiber.stress * fiber.area * 1000.0; // kN
            
            n += force;
            my += force * fiber.y;
            mz += force * fiber.z;
        }
        
        SectionForces { n, my, mz }
    }
    
    /// Calculate section stiffness
    pub fn calculate_stiffness(&self, concrete: &ConcreteMaterial, steel: &SteelMaterial) -> SectionStiffness {
        let mut ea = 0.0;   // Axial stiffness
        let mut ei_yy = 0.0; // Flexural about y
        let mut ei_zz = 0.0; // Flexural about z
        let mut ei_yz = 0.0; // Coupling term
        
        for fiber in &self.fibers {
            let e = match fiber.material {
                FiberMaterial::ConcreteUnconfined | FiberMaterial::ConcreteConfined => {
                    concrete.tangent(fiber.strain)
                },
                _ => steel.tangent(fiber.strain),
            };
            
            let e_mpa = e.abs(); // Use absolute for stiffness
            let a = fiber.area;
            
            ea += e_mpa * a;
            ei_yy += e_mpa * a * fiber.y * fiber.y;
            ei_zz += e_mpa * a * fiber.z * fiber.z;
            ei_yz += e_mpa * a * fiber.y * fiber.z;
        }
        
        SectionStiffness {
            ea: ea * 1000.0, // kN
            ei_yy: ei_yy * 1000.0, // kN·m²
            ei_zz: ei_zz * 1000.0,
            ei_yz: ei_yz * 1000.0,
        }
    }
    
    /// Moment-curvature analysis
    pub fn moment_curvature(&mut self, axial_load: f64, concrete: &ConcreteMaterial, 
                            steel: &SteelMaterial) -> MomentCurvatureResult {
        let mut curvatures = Vec::new();
        let mut moments = Vec::new();
        let mut yield_curvature = 0.0;
        let mut yield_moment = 0.0;
        let mut ultimate_curvature = 0.0;
        let mut ultimate_moment = 0.0;
        let mut found_yield = false;
        
        // Target axial strain for equilibrium
        let target_n = axial_load;
        
        // Incrementally increase curvature
        let max_curvature = 0.3; // 1/m
        let n_steps = 100;
        
        for i in 0..n_steps {
            let kappa = (i + 1) as f64 / n_steps as f64 * max_curvature;
            
            // Find axial strain for equilibrium
            let mut eps_a = -0.001; // Initial guess
            for _ in 0..20 {
                self.update_strains(eps_a, kappa, 0.0);
                let forces = self.calculate_forces(concrete, steel);
                
                let error = forces.n - target_n;
                if error.abs() < 0.1 {
                    break;
                }
                
                // Newton update
                let stiff = self.calculate_stiffness(concrete, steel);
                eps_a -= error / stiff.ea.max(1.0);
            }
            
            self.update_strains(eps_a, kappa, 0.0);
            let forces = self.calculate_forces(concrete, steel);
            
            // Check for failure
            let max_concrete_strain = self.fibers.iter()
                .filter(|f| matches!(f.material, FiberMaterial::ConcreteUnconfined | FiberMaterial::ConcreteConfined))
                .map(|f| f.strain)
                .fold(0.0, f64::min);
            
            let max_steel_strain = self.fibers.iter()
                .filter(|f| matches!(f.material, FiberMaterial::ReinforcingSteel))
                .map(|f| f.strain.abs())
                .fold(0.0, f64::max);
            
            if max_concrete_strain < -concrete.eps_cu || max_steel_strain > steel.eps_u {
                // Section has failed
                break;
            }
            
            curvatures.push(kappa);
            moments.push(forces.my.abs());
            
            // Check for yield
            if !found_yield && max_steel_strain >= steel.eps_y {
                yield_curvature = kappa;
                yield_moment = forces.my.abs();
                found_yield = true;
            }
            
            ultimate_curvature = kappa;
            ultimate_moment = forces.my.abs();
        }
        
        MomentCurvatureResult {
            curvatures,
            moments,
            yield_curvature,
            yield_moment,
            ultimate_curvature,
            ultimate_moment,
            ductility: if yield_curvature > 0.0 { 
                ultimate_curvature / yield_curvature 
            } else { 
                1.0 
            },
        }
    }
    
    /// P-M interaction diagram
    pub fn pm_interaction(&mut self, concrete: &ConcreteMaterial, steel: &SteelMaterial) -> PMInteraction {
        let mut points = Vec::new();
        
        // Pure compression
        let n_max = self.fibers.iter()
            .map(|f| match f.material {
                FiberMaterial::ConcreteUnconfined | FiberMaterial::ConcreteConfined => {
                    -0.85 * concrete.fc * f.area * 1000.0
                },
                _ => -steel.fy * f.area * 1000.0,
            })
            .sum::<f64>();
        
        points.push((n_max, 0.0));
        
        // Vary neutral axis depth
        let h = self.dimensions.height;
        let n_points = 20;
        
        for i in 1..=n_points {
            let c = i as f64 / n_points as f64 * h * 2.0; // Neutral axis depth
            
            // Extreme compression fiber strain
            let eps_c = -0.003;
            let _kappa = -eps_c / c;
            
            // Find strains
            for fiber in &mut self.fibers {
                let d = h / 2.0 - fiber.y; // Depth from compression face
                fiber.strain = eps_c * (1.0 - d / c);
            }
            
            let forces = self.calculate_forces(concrete, steel);
            points.push((forces.n, forces.my.abs()));
        }
        
        // Pure tension
        let n_min = self.fibers.iter()
            .filter(|f| matches!(f.material, FiberMaterial::ReinforcingSteel))
            .map(|f| steel.fy * f.area * 1000.0)
            .sum::<f64>();
        
        points.push((n_min, 0.0));
        
        // Find balanced point
        let balanced_idx = points.len() / 2;
        let balanced = if balanced_idx < points.len() {
            points[balanced_idx]
        } else {
            (0.0, 0.0)
        };
        
        let m_max = points.iter().map(|(_, m)| *m).fold(0.0, f64::max);
        
        PMInteraction {
            points,
            n_max,
            n_min,
            m_max,
            balanced_n: balanced.0,
            balanced_m: balanced.1,
        }
    }
}

/// Section forces
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SectionForces {
    /// Axial force (kN)
    pub n: f64,
    /// Moment about y-axis (kN·m)
    pub my: f64,
    /// Moment about z-axis (kN·m)
    pub mz: f64,
}

/// Section stiffness
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SectionStiffness {
    /// Axial stiffness (kN)
    pub ea: f64,
    /// Flexural stiffness y-y (kN·m²)
    pub ei_yy: f64,
    /// Flexural stiffness z-z (kN·m²)
    pub ei_zz: f64,
    /// Coupling stiffness (kN·m²)
    pub ei_yz: f64,
}

/// Moment-curvature result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MomentCurvatureResult {
    /// Curvature values (1/m)
    pub curvatures: Vec<f64>,
    /// Moment values (kN·m)
    pub moments: Vec<f64>,
    /// Yield curvature
    pub yield_curvature: f64,
    /// Yield moment
    pub yield_moment: f64,
    /// Ultimate curvature
    pub ultimate_curvature: f64,
    /// Ultimate moment
    pub ultimate_moment: f64,
    /// Curvature ductility
    pub ductility: f64,
}

/// P-M interaction diagram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PMInteraction {
    /// Interaction points (N, M)
    pub points: Vec<(f64, f64)>,
    /// Maximum compression
    pub n_max: f64,
    /// Maximum tension
    pub n_min: f64,
    /// Maximum moment
    pub m_max: f64,
    /// Balanced axial load
    pub balanced_n: f64,
    /// Balanced moment
    pub balanced_m: f64,
}

impl PMInteraction {
    /// Check if point is inside interaction surface
    pub fn check_capacity(&self, n: f64, m: f64) -> bool {
        // Simplified check using linear interpolation
        for i in 0..self.points.len() - 1 {
            let (n1, m1) = self.points[i];
            let (n2, m2) = self.points[i + 1];
            
            if (n >= n1 && n <= n2) || (n >= n2 && n <= n1) {
                if n2 != n1 {
                    let t = (n - n1) / (n2 - n1);
                    let m_limit = m1 + t * (m2 - m1);
                    if m.abs() <= m_limit {
                        return true;
                    }
                }
            }
        }
        
        false
    }
    
    /// Calculate utilization ratio
    pub fn utilization(&self, n: f64, m: f64) -> f64 {
        // Find corresponding point on interaction curve
        for i in 0..self.points.len() - 1 {
            let (n1, m1) = self.points[i];
            let (n2, m2) = self.points[i + 1];
            
            if (n >= n1 && n <= n2) || (n >= n2 && n <= n1) {
                if n2 != n1 {
                    let t = (n - n1) / (n2 - n1);
                    let m_limit = m1 + t * (m2 - m1);
                    if m_limit > 0.0 {
                        return m.abs() / m_limit;
                    }
                }
            }
        }
        
        1.0 // Default to fully utilized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_concrete_material_unconfined() {
        let concrete = ConcreteMaterial::unconfined(30.0);
        
        assert!((concrete.fc - 30.0).abs() < 0.1);
        assert!(concrete.ec > 20000.0);
    }
    
    #[test]
    fn test_concrete_material_confined() {
        let concrete = ConcreteMaterial::confined(30.0, 5.0);
        
        assert!(concrete.confinement_ratio > 1.0);
        assert!(concrete.eps_cu > 0.003);
    }
    
    #[test]
    fn test_concrete_stress_compression() {
        let concrete = ConcreteMaterial::unconfined(30.0);
        
        let stress = concrete.stress(-0.002);
        assert!(stress < 0.0); // Compression is negative
        assert!(stress.abs() > 25.0); // Near peak stress
    }
    
    #[test]
    fn test_concrete_stress_tension() {
        let concrete = ConcreteMaterial::unconfined(30.0);
        
        let stress = concrete.stress(0.0001);
        assert!(stress >= 0.0);
    }
    
    #[test]
    fn test_steel_material_rebar() {
        let steel = SteelMaterial::rebar(500.0);
        
        assert_eq!(steel.fy, 500.0);
        assert_eq!(steel.es, 200000.0);
    }
    
    #[test]
    fn test_steel_stress_elastic() {
        let steel = SteelMaterial::rebar(500.0);
        
        let stress = steel.stress(0.001);
        assert!((stress - 200.0).abs() < 1.0);
    }
    
    #[test]
    fn test_steel_stress_yield() {
        let steel = SteelMaterial::rebar(500.0);
        
        let stress = steel.stress(0.01);
        assert!((stress - 500.0).abs() < 1.0);
    }
    
    #[test]
    fn test_rectangular_section() {
        let section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0, 
            &[(0.0005, 0.25, 0.0), (0.0005, -0.25, 0.0)]
        );
        
        assert!(!section.fibers.is_empty());
    }
    
    #[test]
    fn test_circular_section() {
        let section = FiberSection::circular_rc(0.5, 0.04, 30.0, 500.0, 8, 0.0005);
        
        assert!(!section.fibers.is_empty());
        assert!(section.fibers.iter().any(|f| f.material == FiberMaterial::ReinforcingSteel));
    }
    
    #[test]
    fn test_update_strains() {
        let mut section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0,
            &[(0.0005, 0.25, 0.0)]
        );
        
        section.update_strains(-0.001, 0.01, 0.0);
        
        assert!(section.axial_strain < 0.0);
        assert!(section.curvature > 0.0);
    }
    
    #[test]
    fn test_calculate_forces() {
        let mut section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0,
            &[(0.0005, 0.25, 0.0), (0.0005, -0.25, 0.0)]
        );
        
        let concrete = ConcreteMaterial::unconfined(30.0);
        let steel = SteelMaterial::rebar(500.0);
        
        section.update_strains(-0.001, 0.0, 0.0);
        let forces = section.calculate_forces(&concrete, &steel);
        
        assert!(forces.n != 0.0);
    }
    
    #[test]
    fn test_calculate_stiffness() {
        let mut section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0,
            &[(0.0005, 0.25, 0.0)]
        );
        
        let concrete = ConcreteMaterial::unconfined(30.0);
        let steel = SteelMaterial::rebar(500.0);
        
        section.update_strains(0.0, 0.0, 0.0);
        let stiff = section.calculate_stiffness(&concrete, &steel);
        
        assert!(stiff.ea > 0.0);
        assert!(stiff.ei_yy > 0.0);
    }
    
    #[test]
    fn test_moment_curvature() {
        let mut section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0,
            &[(0.001, 0.25, 0.0), (0.001, -0.25, 0.0)]
        );
        
        let concrete = ConcreteMaterial::unconfined(30.0);
        let steel = SteelMaterial::rebar(500.0);
        
        let result = section.moment_curvature(0.0, &concrete, &steel);
        
        assert!(!result.curvatures.is_empty());
        assert!(result.ultimate_moment > 0.0);
        assert!(result.ductility >= 1.0);
    }
    
    #[test]
    fn test_pm_interaction() {
        let mut section = FiberSection::rectangular_rc(
            0.4, 0.6, 0.04, 30.0, 500.0,
            &[(0.001, 0.25, 0.0), (0.001, -0.25, 0.0)]
        );
        
        let concrete = ConcreteMaterial::unconfined(30.0);
        let steel = SteelMaterial::rebar(500.0);
        
        let pm = section.pm_interaction(&concrete, &steel);
        
        assert!(!pm.points.is_empty());
        assert!(pm.m_max > 0.0);
    }
    
    #[test]
    fn test_pm_capacity_check() {
        let pm = PMInteraction {
            points: vec![(-1000.0, 0.0), (-500.0, 200.0), (0.0, 300.0), (500.0, 200.0), (1000.0, 0.0)],
            n_max: -1000.0,
            n_min: 1000.0,
            m_max: 300.0,
            balanced_n: 0.0,
            balanced_m: 300.0,
        };
        
        assert!(pm.check_capacity(0.0, 200.0));
        assert!(!pm.check_capacity(0.0, 400.0));
    }
    
    #[test]
    fn test_pm_utilization() {
        let pm = PMInteraction {
            points: vec![(-1000.0, 0.0), (0.0, 300.0), (1000.0, 0.0)],
            n_max: -1000.0,
            n_min: 1000.0,
            m_max: 300.0,
            balanced_n: 0.0,
            balanced_m: 300.0,
        };
        
        let util = pm.utilization(0.0, 150.0);
        assert!((util - 0.5).abs() < 0.1);
    }
    
    #[test]
    fn test_fiber_material_types() {
        assert_ne!(FiberMaterial::ConcreteUnconfined, FiberMaterial::ConcreteConfined);
        assert_ne!(FiberMaterial::ReinforcingSteel, FiberMaterial::PrestressingSteel);
    }
    
    #[test]
    fn test_section_types() {
        assert_ne!(SectionType::Rectangular, SectionType::Circular);
    }
}
