// ============================================================================
// CONTACT MECHANICS - Hertzian Contact, Friction, Impact
// Surface Interactions, Penalty Methods, Lagrange Multipliers
// ============================================================================

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

// ============================================================================
// CONTACT GEOMETRY
// ============================================================================

/// Contact surface geometry type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContactGeometry {
    /// Sphere on flat
    SphereFlat { radius: f64 },
    /// Sphere on sphere
    SphereSphere { r1: f64, r2: f64 },
    /// Cylinder on flat
    CylinderFlat { radius: f64, length: f64 },
    /// Cylinder on cylinder (parallel)
    CylinderCylinderParallel { r1: f64, r2: f64, length: f64 },
    /// Cylinder on cylinder (crossed)
    CylinderCylinderCrossed { r1: f64, r2: f64 },
    /// Cone on flat
    ConeFlat { half_angle: f64 },
    /// General ellipsoid
    EllipsoidFlat { a: f64, b: f64, c: f64 },
}

impl ContactGeometry {
    /// Equivalent radius for Hertzian contact
    pub fn equivalent_radius(&self) -> f64 {
        match self {
            ContactGeometry::SphereFlat { radius } => *radius,
            ContactGeometry::SphereSphere { r1, r2 } => r1 * r2 / (r1 + r2),
            ContactGeometry::CylinderFlat { radius, .. } => *radius,
            ContactGeometry::CylinderCylinderParallel { r1, r2, .. } => r1 * r2 / (r1 + r2),
            ContactGeometry::CylinderCylinderCrossed { r1, r2 } => (*r1 * *r2).sqrt(),
            ContactGeometry::ConeFlat { half_angle } => half_angle.tan() * 1000.0, // Characteristic length
            ContactGeometry::EllipsoidFlat { a, b, .. } => (*a * *b).sqrt(),
        }
    }
}

// ============================================================================
// MATERIAL PROPERTIES
// ============================================================================

/// Contact material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactMaterial {
    /// Young's modulus (MPa)
    pub e: f64,
    /// Poisson's ratio
    pub nu: f64,
    /// Hardness (MPa) - optional
    pub hardness: Option<f64>,
    /// Yield strength (MPa)
    pub sigma_y: f64,
}

impl ContactMaterial {
    pub fn new(e: f64, nu: f64, sigma_y: f64) -> Self {
        Self {
            e,
            nu,
            hardness: None,
            sigma_y,
        }
    }
    
    /// Steel typical properties
    pub fn steel() -> Self {
        Self {
            e: 200000.0,
            nu: 0.3,
            hardness: Some(2000.0),
            sigma_y: 250.0,
        }
    }
    
    /// Aluminum typical properties
    pub fn aluminum() -> Self {
        Self {
            e: 70000.0,
            nu: 0.33,
            hardness: Some(500.0),
            sigma_y: 100.0,
        }
    }
    
    /// Rubber typical properties
    pub fn rubber() -> Self {
        Self {
            e: 10.0,
            nu: 0.49,
            hardness: Some(10.0),
            sigma_y: 5.0,
        }
    }
}

// ============================================================================
// HERTZIAN CONTACT
// ============================================================================

/// Hertzian contact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HertzianContact {
    pub geometry: ContactGeometry,
    pub material1: ContactMaterial,
    pub material2: ContactMaterial,
    pub normal_force: f64, // N
}

impl HertzianContact {
    pub fn new(
        geometry: ContactGeometry,
        material1: ContactMaterial,
        material2: ContactMaterial,
        normal_force: f64,
    ) -> Self {
        Self {
            geometry,
            material1,
            material2,
            normal_force,
        }
    }
    
    /// Combined elastic modulus
    pub fn combined_modulus(&self) -> f64 {
        let e1_star = self.material1.e / (1.0 - self.material1.nu.powi(2));
        let e2_star = self.material2.e / (1.0 - self.material2.nu.powi(2));
        
        1.0 / (1.0 / e1_star + 1.0 / e2_star)
    }
    
    /// Sphere-on-flat contact radius
    pub fn contact_radius(&self) -> f64 {
        let r = self.geometry.equivalent_radius();
        let e_star = self.combined_modulus();
        
        (3.0 * self.normal_force * r / (4.0 * e_star)).powf(1.0 / 3.0)
    }
    
    /// Maximum contact pressure (Hertz)
    pub fn max_pressure(&self) -> f64 {
        let a = self.contact_radius();
        
        if a > 1e-10 {
            3.0 * self.normal_force / (2.0 * PI * a.powi(2))
        } else {
            0.0
        }
    }
    
    /// Contact area
    pub fn contact_area(&self) -> f64 {
        let a = self.contact_radius();
        PI * a.powi(2)
    }
    
    /// Approach (mutual indentation depth)
    pub fn approach(&self) -> f64 {
        let r = self.geometry.equivalent_radius();
        let e_star = self.combined_modulus();
        
        (9.0 * self.normal_force.powi(2) / (16.0 * r * e_star.powi(2))).powf(1.0 / 3.0)
    }
    
    /// Contact stiffness (N/mm)
    pub fn contact_stiffness(&self) -> f64 {
        let _r = self.geometry.equivalent_radius();
        let e_star = self.combined_modulus();
        let a = self.contact_radius();
        
        2.0 * e_star * a
    }
    
    /// Maximum shear stress (occurs at depth ~0.48a)
    pub fn max_shear_stress(&self) -> f64 {
        let p0 = self.max_pressure();
        0.31 * p0
    }
    
    /// Depth of maximum shear stress
    pub fn depth_max_shear(&self) -> f64 {
        let a = self.contact_radius();
        0.48 * a
    }
    
    /// Check for plastic deformation
    pub fn is_elastic(&self) -> bool {
        let p0 = self.max_pressure();
        let sigma_y = self.material1.sigma_y.min(self.material2.sigma_y);
        
        // Onset of yielding at p0 ≈ 1.6σy
        p0 < 1.6 * sigma_y
    }
    
    /// Plastic load limit
    pub fn plastic_load_limit(&self) -> f64 {
        let r = self.geometry.equivalent_radius();
        let e_star = self.combined_modulus();
        let sigma_y = self.material1.sigma_y.min(self.material2.sigma_y);
        
        // P_y = π³R²σ_y³/(6E*²)
        PI.powi(3) * r.powi(2) * (1.6 * sigma_y).powi(3) / (6.0 * e_star.powi(2))
    }
    
    /// Stress distribution at depth z (normalized)
    pub fn stress_at_depth(&self, z_over_a: f64) -> (f64, f64, f64) {
        let p0 = self.max_pressure();
        let z = z_over_a;
        
        // Simplified Johnson formulas
        let sz = -p0 * (1.0 / (1.0 + z.powi(2))).sqrt();
        let sr = -p0 * (1.0 - z * (z.powi(2) + 1.0).sqrt().atan() / ((z.powi(2) + 1.0).sqrt()));
        let st = sr; // Axisymmetric
        
        (sr, st, sz)
    }
}

/// Line contact (cylinder on flat)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineContact {
    pub radius: f64,
    pub length: f64,
    pub material1: ContactMaterial,
    pub material2: ContactMaterial,
    pub force_per_length: f64, // N/mm
}

impl LineContact {
    pub fn new(
        radius: f64,
        length: f64,
        material1: ContactMaterial,
        material2: ContactMaterial,
        total_force: f64,
    ) -> Self {
        Self {
            radius,
            length,
            material1,
            material2,
            force_per_length: total_force / length,
        }
    }
    
    /// Combined modulus
    pub fn combined_modulus(&self) -> f64 {
        let e1_star = self.material1.e / (1.0 - self.material1.nu.powi(2));
        let e2_star = self.material2.e / (1.0 - self.material2.nu.powi(2));
        
        1.0 / (1.0 / e1_star + 1.0 / e2_star)
    }
    
    /// Contact half-width
    pub fn half_width(&self) -> f64 {
        let e_star = self.combined_modulus();
        
        (4.0 * self.force_per_length * self.radius / (PI * e_star)).sqrt()
    }
    
    /// Maximum pressure
    pub fn max_pressure(&self) -> f64 {
        let b = self.half_width();
        
        2.0 * self.force_per_length / (PI * b)
    }
    
    /// Approach
    pub fn approach(&self) -> f64 {
        let e_star = self.combined_modulus();
        let w = self.force_per_length;
        let r = self.radius;
        
        // Approximate formula
        w / (PI * e_star) * (2.0 * (e_star * r / w).ln() + 1.0)
    }
}

// ============================================================================
// FRICTION MODELS
// ============================================================================

/// Friction model types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrictionModel {
    /// Coulomb friction
    Coulomb { mu_s: f64, mu_k: f64 },
    /// Regularized Coulomb
    RegularizedCoulomb { mu: f64, v_reg: f64 },
    /// Stribeck friction
    Stribeck { mu_s: f64, mu_k: f64, mu_visc: f64, v_s: f64 },
    /// Exponential decay
    ExponentialDecay { mu_s: f64, mu_k: f64, decay_rate: f64 },
}

impl FrictionModel {
    /// Friction coefficient at given velocity
    pub fn coefficient(&self, velocity: f64) -> f64 {
        let v = velocity.abs();
        
        match self {
            FrictionModel::Coulomb { mu_s, mu_k } => {
                if v < 1e-6 { *mu_s } else { *mu_k }
            }
            FrictionModel::RegularizedCoulomb { mu, v_reg } => {
                mu * (v / (v + v_reg))
            }
            FrictionModel::Stribeck { mu_s, mu_k, mu_visc, v_s } => {
                mu_k + (mu_s - mu_k) * (-v / v_s).exp() + mu_visc * v
            }
            FrictionModel::ExponentialDecay { mu_s, mu_k, decay_rate } => {
                mu_k + (mu_s - mu_k) * (-decay_rate * v).exp()
            }
        }
    }
    
    /// Friction force
    pub fn friction_force(&self, normal_force: f64, velocity: f64) -> f64 {
        let mu = self.coefficient(velocity);
        let sign = if velocity >= 0.0 { -1.0 } else { 1.0 };
        
        sign * mu * normal_force
    }
}

/// Contact friction analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactFriction {
    pub hertz: HertzianContact,
    pub friction: FrictionModel,
    pub tangent_load: f64, // N
}

impl ContactFriction {
    pub fn new(hertz: HertzianContact, friction: FrictionModel, tangent_load: f64) -> Self {
        Self { hertz, friction, tangent_load }
    }
    
    /// Check for gross sliding
    pub fn is_sliding(&self, velocity: f64) -> bool {
        let mu = self.friction.coefficient(velocity);
        let friction_capacity = mu * self.hertz.normal_force;
        
        self.tangent_load.abs() >= friction_capacity
    }
    
    /// Stick zone radius (partial slip)
    pub fn stick_radius(&self) -> f64 {
        let a = self.hertz.contact_radius();
        
        if let FrictionModel::Coulomb { mu_s, .. } = self.friction {
            let q_max = mu_s * self.hertz.normal_force;
            
            if self.tangent_load.abs() < q_max {
                a * (1.0 - (self.tangent_load.abs() / q_max)).powf(1.0 / 3.0)
            } else {
                0.0
            }
        } else {
            a * 0.5 // Simplified
        }
    }
    
    /// Energy dissipation per cycle
    pub fn energy_dissipation_per_cycle(&self, displacement_amplitude: f64) -> f64 {
        if let FrictionModel::Coulomb { mu_s, .. } = self.friction {
            let q = self.tangent_load;
            let q_max = mu_s * self.hertz.normal_force;
            
            if q.abs() < q_max {
                // Partial slip regime (Mindlin)
                let a = self.hertz.contact_radius();
                let g = self.hertz.material1.e / (2.0 * (1.0 + self.hertz.material1.nu));
                
                9.0 * PI * mu_s * mu_s * self.hertz.normal_force.powi(2) / (10.0 * g * a)
                    * (1.0 - (1.0 - q.abs() / q_max).powf(5.0 / 3.0))
            } else {
                // Full sliding
                4.0 * mu_s * self.hertz.normal_force * displacement_amplitude
            }
        } else {
            0.0
        }
    }
}

// ============================================================================
// IMPACT
// ============================================================================

/// Impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactAnalysis {
    pub geometry: ContactGeometry,
    pub material1: ContactMaterial,
    pub material2: ContactMaterial,
    pub mass1: f64,      // kg
    pub mass2: f64,      // kg
    pub velocity1: f64,  // m/s
    pub velocity2: f64,  // m/s
    pub restitution: f64, // Coefficient of restitution
}

impl ImpactAnalysis {
    pub fn sphere_on_flat(
        radius: f64,
        material1: ContactMaterial,
        material2: ContactMaterial,
        mass: f64,
        impact_velocity: f64,
        restitution: f64,
    ) -> Self {
        Self {
            geometry: ContactGeometry::SphereFlat { radius },
            material1,
            material2,
            mass1: mass,
            mass2: f64::INFINITY,
            velocity1: impact_velocity,
            velocity2: 0.0,
            restitution,
        }
    }
    
    /// Effective mass
    pub fn effective_mass(&self) -> f64 {
        if self.mass2.is_infinite() {
            self.mass1
        } else {
            self.mass1 * self.mass2 / (self.mass1 + self.mass2)
        }
    }
    
    /// Relative approach velocity
    pub fn relative_velocity(&self) -> f64 {
        self.velocity1 - self.velocity2
    }
    
    /// Combined modulus
    fn combined_modulus(&self) -> f64 {
        let e1_star = self.material1.e * 1e6 / (1.0 - self.material1.nu.powi(2)); // N/m²
        let e2_star = self.material2.e * 1e6 / (1.0 - self.material2.nu.powi(2));
        
        1.0 / (1.0 / e1_star + 1.0 / e2_star)
    }
    
    /// Maximum force during elastic impact (Hertz)
    pub fn max_force_elastic(&self) -> f64 {
        let r = self.geometry.equivalent_radius() / 1000.0; // m
        let e_star = self.combined_modulus(); // N/m²
        let m = self.effective_mass(); // kg
        let v = self.relative_velocity().abs(); // m/s
        
        // F_max = (5/4) * (4/3 * E* * sqrt(R))^(2/5) * m^(3/5) * v^(6/5)
        let k_n = 4.0 / 3.0 * e_star * r.sqrt();
        
        (1.25 * m.powf(0.6) * k_n.powf(0.4) * v.powf(1.2)) / 1000.0 // Convert to kN
    }
    
    /// Maximum indentation during impact
    pub fn max_indentation(&self) -> f64 {
        let r = self.geometry.equivalent_radius() / 1000.0;
        let e_star = self.combined_modulus();
        let m = self.effective_mass();
        let v = self.relative_velocity().abs();
        
        // δ_max = (5 * m * v² / (4 * E* * sqrt(R)))^(2/5)
        (5.0 * m * v.powi(2) / (4.0 * e_star * r.sqrt())).powf(0.4) * 1000.0 // mm
    }
    
    /// Contact duration
    pub fn contact_duration(&self) -> f64 {
        let r = self.geometry.equivalent_radius() / 1000.0;
        let e_star = self.combined_modulus();
        let m = self.effective_mass();
        let v = self.relative_velocity().abs();
        
        if v < 1e-6 {
            return 0.0;
        }
        
        // t_c ≈ 2.94 * (m² / (R * E*²))^(1/5) * v^(-1/5)
        2.94 * (m.powi(2) / (r * e_star.powi(2))).powf(0.2) * v.powf(-0.2) * 1000.0 // ms
    }
    
    /// Rebound velocity
    pub fn rebound_velocity(&self) -> f64 {
        self.restitution * self.relative_velocity().abs()
    }
    
    /// Energy absorbed
    pub fn energy_absorbed(&self) -> f64 {
        let m = self.effective_mass();
        let v = self.relative_velocity().abs();
        
        0.5 * m * v.powi(2) * (1.0 - self.restitution.powi(2))
    }
}

// ============================================================================
// PENALTY METHOD
// ============================================================================

/// Penalty contact formulation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PenaltyContact {
    /// Normal penalty stiffness (N/mm)
    pub kn: f64,
    /// Tangential penalty stiffness (N/mm)
    pub kt: f64,
    /// Friction coefficient
    pub mu: f64,
    /// Gap tolerance
    pub gap_tolerance: f64,
}

impl PenaltyContact {
    pub fn new(kn: f64, kt: f64, mu: f64) -> Self {
        Self {
            kn,
            kt,
            mu,
            gap_tolerance: 0.001,
        }
    }
    
    /// Estimate penalty from material properties
    pub fn from_material(e: f64, h_min: f64, scale: f64) -> Self {
        let kn = scale * e / h_min;
        Self::new(kn, kn, 0.3)
    }
    
    /// Normal force from gap
    pub fn normal_force(&self, gap: f64) -> f64 {
        if gap < -self.gap_tolerance {
            -self.kn * gap
        } else {
            0.0
        }
    }
    
    /// Tangential force (stick)
    pub fn tangent_force_stick(&self, slip: f64) -> f64 {
        self.kt * slip
    }
    
    /// Tangential force with friction
    pub fn tangent_force(&self, slip: f64, normal_force: f64) -> f64 {
        let f_stick = self.kt * slip.abs();
        let f_limit = self.mu * normal_force;
        
        let f = f_stick.min(f_limit);
        if slip >= 0.0 { f } else { -f }
    }
    
    /// Contact status
    pub fn is_in_contact(&self, gap: f64) -> bool {
        gap < -self.gap_tolerance
    }
}

// ============================================================================
// LAGRANGE MULTIPLIER
// ============================================================================

/// Lagrange multiplier contact
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LagrangeContact {
    /// Contact points
    pub points: Vec<ContactPoint>,
    /// Augmentation parameter
    pub augmentation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactPoint {
    pub node_id: usize,
    pub gap: f64,
    pub lambda_n: f64, // Normal multiplier
    pub lambda_t: f64, // Tangential multiplier
    pub slip: f64,
}

impl LagrangeContact {
    pub fn new(augmentation: f64) -> Self {
        Self {
            points: Vec::new(),
            augmentation,
        }
    }
    
    pub fn add_point(&mut self, node_id: usize, gap: f64, slip: f64) {
        self.points.push(ContactPoint {
            node_id,
            gap,
            lambda_n: 0.0,
            lambda_t: 0.0,
            slip,
        });
    }
    
    /// Update multipliers (Uzawa algorithm)
    pub fn update_multipliers(&mut self, mu: f64) {
        for point in &mut self.points {
            // Normal contact
            let lambda_n_trial = point.lambda_n + self.augmentation * point.gap;
            point.lambda_n = lambda_n_trial.max(0.0);
            
            // Friction
            let lambda_t_trial = point.lambda_t + self.augmentation * point.slip;
            let friction_limit = mu * point.lambda_n;
            
            point.lambda_t = if lambda_t_trial.abs() <= friction_limit {
                lambda_t_trial
            } else {
                friction_limit * lambda_t_trial.signum()
            };
        }
    }
    
    /// Total contact force
    pub fn total_normal_force(&self) -> f64 {
        self.points.iter().map(|p| p.lambda_n).sum()
    }
}

// ============================================================================
// WEAR MODELS
// ============================================================================

/// Archard wear model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchardWear {
    /// Wear coefficient (dimensionless)
    pub k: f64,
    /// Hardness (MPa)
    pub hardness: f64,
    /// Accumulated wear depth (mm)
    pub wear_depth: f64,
}

impl ArchardWear {
    pub fn new(k: f64, hardness: f64) -> Self {
        Self {
            k,
            hardness,
            wear_depth: 0.0,
        }
    }
    
    /// Typical wear coefficient for steel on steel
    pub fn steel_on_steel() -> Self {
        Self::new(1e-4, 2000.0)
    }
    
    /// Wear rate (mm per mm sliding)
    pub fn wear_rate(&self, pressure: f64) -> f64 {
        self.k * pressure / self.hardness
    }
    
    /// Update wear for sliding distance
    pub fn update(&mut self, pressure: f64, sliding_distance: f64) {
        let rate = self.wear_rate(pressure);
        self.wear_depth += rate * sliding_distance;
    }
    
    /// Volume worn per unit sliding distance
    pub fn wear_volume_rate(&self, pressure: f64, area: f64) -> f64 {
        self.k * pressure * area / self.hardness
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hertzian_sphere() {
        let mat = ContactMaterial::steel();
        let hertz = HertzianContact::new(
            ContactGeometry::SphereFlat { radius: 10.0 },
            mat.clone(),
            mat,
            1000.0,
        );
        
        let a = hertz.contact_radius();
        assert!(a > 0.0 && a < 10.0);
        
        let p0 = hertz.max_pressure();
        assert!(p0 > 0.0);
    }

    #[test]
    fn test_contact_stiffness() {
        let mat = ContactMaterial::steel();
        let hertz = HertzianContact::new(
            ContactGeometry::SphereFlat { radius: 10.0 },
            mat.clone(),
            mat,
            1000.0,
        );
        
        let k = hertz.contact_stiffness();
        assert!(k > 0.0);
    }

    #[test]
    fn test_elastic_limit() {
        let mat = ContactMaterial::steel();
        let hertz = HertzianContact::new(
            ContactGeometry::SphereFlat { radius: 50.0 }, // Larger radius
            mat.clone(),
            mat,
            10.0, // Very small load
        );
        
        assert!(hertz.is_elastic());
    }

    #[test]
    fn test_line_contact() {
        let mat = ContactMaterial::steel();
        let line = LineContact::new(20.0, 100.0, mat.clone(), mat, 10000.0);
        
        let b = line.half_width();
        assert!(b > 0.0);
        
        let p0 = line.max_pressure();
        assert!(p0 > 0.0);
    }

    #[test]
    fn test_coulomb_friction() {
        let friction = FrictionModel::Coulomb { mu_s: 0.5, mu_k: 0.3 };
        
        let mu_static = friction.coefficient(0.0);
        let mu_dynamic = friction.coefficient(1.0);
        
        assert!((mu_static - 0.5).abs() < 0.01);
        assert!((mu_dynamic - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_stribeck_friction() {
        let friction = FrictionModel::Stribeck {
            mu_s: 0.5,
            mu_k: 0.3,
            mu_visc: 0.01,
            v_s: 0.1,
        };
        
        let mu_zero = friction.coefficient(0.0);
        assert!((mu_zero - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_impact() {
        let mat = ContactMaterial::steel();
        let impact = ImpactAnalysis::sphere_on_flat(
            10.0, // mm
            mat.clone(),
            mat,
            0.1,  // kg
            5.0,  // m/s
            0.9,
        );
        
        let f_max = impact.max_force_elastic();
        assert!(f_max > 0.0);
        
        let t_c = impact.contact_duration();
        assert!(t_c > 0.0);
    }

    #[test]
    fn test_penalty_contact() {
        let penalty = PenaltyContact::new(1e6, 1e5, 0.3);
        
        let fn_penetrating = penalty.normal_force(-0.01);
        let fn_gap = penalty.normal_force(0.1);
        
        assert!(fn_penetrating > 0.0);
        assert!((fn_gap - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_archard_wear() {
        let mut wear = ArchardWear::steel_on_steel();
        
        wear.update(100.0, 1000.0);
        
        assert!(wear.wear_depth > 0.0);
    }

    #[test]
    fn test_material_properties() {
        let steel = ContactMaterial::steel();
        let rubber = ContactMaterial::rubber();
        
        assert!(steel.e > rubber.e);
        assert!(rubber.nu > steel.nu);
    }

    #[test]
    fn test_combined_modulus() {
        let steel = ContactMaterial::steel();
        let hertz = HertzianContact::new(
            ContactGeometry::SphereSphere { r1: 10.0, r2: 20.0 },
            steel.clone(),
            steel,
            1000.0,
        );
        
        let e_star = hertz.combined_modulus();
        assert!(e_star > 0.0 && e_star < 400000.0);
    }
}
