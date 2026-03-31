use nalgebra::{SMatrix, SVector};

pub type Vec6 = SVector<f64, 6>;
pub type Mat6 = SMatrix<f64, 6, 6>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemberKind {
    Beam,
    Column,
    Slab,
}

#[derive(Debug, Clone)]
pub struct CapacityCheck {
    pub passed: bool,
    pub utilization: f64,
    pub message: String,
    pub clause: &'static str,
}

pub trait StructuralElement {
    fn member_kind(&self) -> MemberKind;
    fn width_mm(&self) -> f64;
    fn effective_depth_mm(&self) -> f64;
    fn fy_mpa(&self) -> f64;
    fn fck_mpa(&self) -> f64;
    fn tension_steel_area_mm2(&self) -> f64;
    fn compression_steel_area_mm2(&self) -> f64;
    fn axial_capacity(&self) -> f64;
    fn flexural_capacity(&self) -> f64;
    fn calculate_shear_capacity(&self) -> f64;
    fn compliance_check(&self, demand: Vec6) -> CapacityCheck;
}

pub trait Element {
    fn id(&self) -> &str;
    fn kind(&self) -> MemberKind;
    fn area_mm2(&self) -> f64;
    fn inertia_mm4(&self) -> f64;
    fn elastic_matrix(&self) -> Mat6;
}

#[derive(Debug, Clone)]
pub struct RcMember {
    pub id: String,
    pub kind: MemberKind,
    pub area_mm2: f64,
    pub inertia_mm4: f64,
    pub fy_mpa: f64,
    pub fck_mpa: f64,
    pub depth_mm: f64,
    pub width_mm: f64,
    pub effective_depth_mm: f64,
    pub shear_links_area_mm2: f64,
    pub lever_arm_mm: f64,
}

impl StructuralElement for RcMember {
    fn member_kind(&self) -> MemberKind {
        self.kind
    }

    fn width_mm(&self) -> f64 {
        self.width_mm
    }

    fn effective_depth_mm(&self) -> f64 {
        self.effective_depth_mm
    }

    fn fy_mpa(&self) -> f64 {
        self.fy_mpa
    }

    fn fck_mpa(&self) -> f64 {
        self.fck_mpa
    }

    fn tension_steel_area_mm2(&self) -> f64 {
        self.area_mm2
    }

    fn compression_steel_area_mm2(&self) -> f64 {
        0.0
    }

    fn axial_capacity(&self) -> f64 {
        match self.kind {
            MemberKind::Beam | MemberKind::Slab => 0.0,
            MemberKind::Column => 0.4 * self.fck_mpa * self.area_mm2,
        }
    }

    fn flexural_capacity(&self) -> f64 {
        match self.kind {
            MemberKind::Beam => 0.87 * self.fy_mpa * self.area_mm2 * self.lever_arm_mm / 1e6,
            MemberKind::Column => 0.35 * self.fck_mpa * self.width_mm * self.depth_mm.powi(2) / 1e6,
            MemberKind::Slab => 0.138 * self.fck_mpa * self.width_mm * self.depth_mm.powi(2) / 1e6,
        }
    }

    fn calculate_shear_capacity(&self) -> f64 {
        crate::design_codes::is_456::shear::calculate_shear_capacity(self, 0.0, self.shear_links_area_mm2).vc_kn
    }

    fn compliance_check(&self, demand: Vec6) -> CapacityCheck {
        let axial = demand[0].abs();
        let moment = demand[4].abs().max(demand[5].abs());
        let shear = demand[1].abs().max(demand[2].abs());

        let axial_cap = self.axial_capacity().max(f64::EPSILON);
        let flex_cap = self.flexural_capacity().max(f64::EPSILON);
        let shear_cap = self.calculate_shear_capacity().max(f64::EPSILON);

        let util = (axial / axial_cap)
            .max(moment / flex_cap)
            .max(shear / shear_cap);

        CapacityCheck {
            passed: util <= 1.0,
            utilization: util,
            message: format!("IS 456 composite check for {:?}", self.kind),
            clause: "IS 456:2000",
        }
    }
}

impl Element for RcMember {
    fn id(&self) -> &str {
        &self.id
    }

    fn kind(&self) -> MemberKind {
        self.kind
    }

    fn area_mm2(&self) -> f64 {
        self.area_mm2
    }

    fn inertia_mm4(&self) -> f64 {
        self.inertia_mm4
    }

    fn elastic_matrix(&self) -> Mat6 {
        let l = self.depth_mm.max(1.0);
        let ea_over_l = self.fck_mpa * self.area_mm2 / l;
        let ei_over_l3 = self.fck_mpa * self.inertia_mm4 / l.powi(3);

        Mat6::from_row_slice(&[
            ea_over_l, 0.0, 0.0, -ea_over_l, 0.0, 0.0,
            0.0, 12.0 * ei_over_l3, 0.0, 0.0, -12.0 * ei_over_l3, 0.0,
            0.0, 0.0, 12.0 * ei_over_l3, 0.0, 0.0, -12.0 * ei_over_l3,
            -ea_over_l, 0.0, 0.0, ea_over_l, 0.0, 0.0,
            0.0, -12.0 * ei_over_l3, 0.0, 0.0, 12.0 * ei_over_l3, 0.0,
            0.0, 0.0, -12.0 * ei_over_l3, 0.0, 0.0, 12.0 * ei_over_l3,
        ])
    }
}

// Phase 0 plan notes:
// 1) Map incoming dependents before refactoring.
// 2) Audit coverage for top-10 monoliths before touching core logic.
// 3) Avoid creating a new utils/common sinkhole; extract by domain.
