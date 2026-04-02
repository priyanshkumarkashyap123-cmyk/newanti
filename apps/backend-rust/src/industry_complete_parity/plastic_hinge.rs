use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HingeCheckResult {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlasticHinge {
    pub hinge_type: PlasticHingeType,
    pub backbone: HingeBackbone,
    pub acceptance_criteria: AcceptanceCriteria,
    pub current_state: HingeState,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum PlasticHingeType {
    Moment,
    PMM,
    Shear,
    Axial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HingeBackbone {
    pub point_a: (f64, f64),
    pub point_b: (f64, f64),
    pub point_c: (f64, f64),
    pub point_d: (f64, f64),
    pub point_e: (f64, f64),
    pub my: f64,
    pub theta_y: f64,
}

impl HingeBackbone {
    /// Plastic hinge backbone per ASCE 41-23 / FEMA 356 style component modeling.
    pub fn backbone_check_result(&self, theta: f64) -> HingeCheckResult {
        let moment = self.get_moment(theta);
        let utilization = if self.my.abs() > f64::EPSILON { moment.abs() / self.my.abs() } else { f64::INFINITY };
        let passed = theta <= self.theta_y * 10.0;
        HingeCheckResult {
            passed,
            utilization,
            message: if passed {
                format!("Hinge response within expected range; θ = {:.4}, M = {:.3}", theta, moment)
            } else {
                format!("Hinge rotation exceeds expected range; θ = {:.4}, M = {:.3}", theta, moment)
            },
            clause: "ASCE 41-23 / FEMA 356 hinge backbone idealization".to_string(),
        }
    }

    pub fn asce41_rc_beam(
        b: f64,
        h: f64,
        d: f64,
        rho: f64,
        rho_prime: f64,
        fc: f64,
        fy: f64,
        v_col_vu: f64,
        shear_controlled: bool,
    ) -> Self {
        let rho_bal = 0.85 * 0.85 * fc / fy * 600.0 / (600.0 + fy);
        let conforming = v_col_vu >= 0.75;

        let (a, b_param, c) = if shear_controlled {
            (0.0, 0.02, 0.2)
        } else if conforming {
            let ratio = (rho - rho_prime) / rho_bal;
            if ratio <= 0.0 {
                (0.025, 0.05, 0.2)
            } else if ratio <= 0.5 {
                (0.02, 0.04, 0.2)
            } else {
                (0.015, 0.03, 0.2)
            }
        } else {
            let ratio = (rho - rho_prime) / rho_bal;
            if ratio <= 0.0 {
                (0.02, 0.03, 0.2)
            } else if ratio <= 0.5 {
                (0.015, 0.02, 0.2)
            } else {
                (0.01, 0.015, 0.2)
            }
        };

        let as_tension = rho * b * d;
        let my = as_tension * fy * (d - 0.5 * as_tension * fy / (0.85 * fc * b));
        let lp = 0.5 * d;
        let e = 4700.0 * fc.sqrt();
        let i = b * h.powi(3) / 12.0;
        let theta_y = if e > f64::EPSILON && i > f64::EPSILON { my * lp / (e * i) } else { 0.0 };

        Self {
            point_a: (0.0, 0.0),
            point_b: (1.0, 1.0),
            point_c: (1.0 + a / theta_y, 1.0),
            point_d: (1.0 + a / theta_y, c),
            point_e: (1.0 + b_param / theta_y, c),
            my,
            theta_y,
        }
    }

    pub fn asce41_steel_beam(section: &str, fy: f64, zx: f64, lb_ry: f64) -> Self {
        let my = fy * zx;
        let (theta_y, a, b_param, c) = match section {
            "compact" => {
                let limiting_lb = 2500.0 / fy.sqrt();
                if lb_ry < limiting_lb {
                    (0.01, 9.0, 11.0, 0.6)
                } else {
                    (0.01, 4.0, 6.0, 0.2)
                }
            }
            "noncompact" => (0.01, 2.0, 3.0, 0.2),
            _ => (0.01, 1.0, 1.5, 0.2),
        };

        Self {
            point_a: (0.0, 0.0),
            point_b: (1.0, 1.0),
            point_c: (1.0 + a, 1.0),
            point_d: (1.0 + a + 0.001, c),
            point_e: (1.0 + b_param, c),
            my,
            theta_y,
        }
    }

    pub fn get_moment(&self, theta: f64) -> f64 {
        let theta_norm = if self.theta_y.abs() > f64::EPSILON { theta / self.theta_y } else { 0.0 };
        let m_norm = if theta_norm <= self.point_b.0 {
            theta_norm * self.point_b.1 / self.point_b.0
        } else if theta_norm <= self.point_c.0 {
            self.point_b.1 + (theta_norm - self.point_b.0) * (self.point_c.1 - self.point_b.1) / (self.point_c.0 - self.point_b.0)
        } else if theta_norm <= self.point_d.0 {
            self.point_c.1 + (theta_norm - self.point_c.0) * (self.point_d.1 - self.point_c.1) / (self.point_d.0 - self.point_c.0)
        } else if theta_norm <= self.point_e.0 {
            self.point_d.1
        } else {
            0.0
        };
        m_norm * self.my
    }

    pub fn get_stiffness(&self, theta: f64) -> f64 {
        let theta_norm = if self.theta_y.abs() > f64::EPSILON { theta / self.theta_y } else { 0.0 };
        let base_stiffness = if self.theta_y.abs() > f64::EPSILON { self.my / self.theta_y } else { 0.0 };
        if theta_norm <= self.point_b.0 {
            base_stiffness
        } else if theta_norm <= self.point_c.0 {
            base_stiffness * 0.02
        } else if theta_norm <= self.point_d.0 {
            -base_stiffness * 0.1
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriteria {
    pub io: f64,
    pub ls: f64,
    pub cp: f64,
}

impl AcceptanceCriteria {
    pub fn asce41_rc_beam(backbone: &HingeBackbone) -> Self {
        let theta_y = backbone.theta_y;
        Self {
            io: theta_y * 1.0,
            ls: theta_y * (0.5 * (backbone.point_c.0 + backbone.point_b.0)),
            cp: theta_y * backbone.point_c.0,
        }
    }

    pub fn check_performance(&self, theta: f64) -> PerformanceLevel {
        if theta <= self.io {
            PerformanceLevel::ImmediateOccupancy
        } else if theta <= self.ls {
            PerformanceLevel::LifeSafety
        } else if theta <= self.cp {
            PerformanceLevel::CollapsePrevention
        } else {
            PerformanceLevel::Collapse
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum PerformanceLevel {
    ImmediateOccupancy,
    LifeSafety,
    CollapsePrevention,
    Collapse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HingeState {
    pub rotation: f64,
    pub moment: f64,
    pub is_yielded: bool,
    pub max_rotation: f64,
    pub performance: PerformanceLevel,
}

impl Default for HingeState {
    fn default() -> Self {
        Self {
            rotation: 0.0,
            moment: 0.0,
            is_yielded: false,
            max_rotation: 0.0,
            performance: PerformanceLevel::ImmediateOccupancy,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steel_backbone_returns_nonnegative_moment() {
        let bb = HingeBackbone::asce41_steel_beam("compact", 250.0, 8.0e6, 50.0);
        let m = bb.get_moment(0.01);
        assert!(m >= 0.0);
    }

    #[test]
    fn backbone_check_flags_large_rotation() {
        let bb = HingeBackbone::asce41_steel_beam("compact", 250.0, 8.0e6, 50.0);
        let out = bb.backbone_check_result(0.2);
        assert!(!out.passed);
    }

    #[test]
    fn acceptance_criteria_progression() {
        let bb = HingeBackbone::asce41_steel_beam("compact", 250.0, 8.0e6, 50.0);
        let ac = AcceptanceCriteria::asce41_rc_beam(&bb);
        let perf = ac.check_performance(ac.io * 0.5);
        assert_eq!(perf, PerformanceLevel::ImmediateOccupancy);
    }
}
