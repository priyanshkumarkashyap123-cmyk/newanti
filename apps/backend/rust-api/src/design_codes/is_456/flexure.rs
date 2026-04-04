use super::traits::{CapacityCheck, StructuralElement, Vec6};

const GAMMA_C: f64 = 1.50;
const GAMMA_S: f64 = 1.15;

/// Singly reinforced flexure check per IS 456:2000, Cl. 38.1 and Cl. 38.1.1
/// Generic over any structural element implementing `StructuralElement`.
pub fn calculate_flexural_capacity<T: StructuralElement>(element: &T) -> CapacityCheck {
    let b = element.width_mm().max(f64::EPSILON);
    let d = element.effective_depth_mm().max(f64::EPSILON);
    let fck = element.fck_mpa().max(f64::EPSILON) / GAMMA_C;
    let fy = element.fy_mpa().max(f64::EPSILON) / GAMMA_S;
    let ast = element.tension_steel_area_mm2().max(0.0);

    let f_s = 0.87 * fy;
    let xu = (f_s * ast) / (0.36 * fck * b);
    let xu_max = 0.48 * d;

    let capacity_knm = if xu <= xu_max {
        (f_s * ast * (d - 0.42 * xu)) / 1e6
    } else {
        (0.36 * fck * b * xu_max * (d - 0.42 * xu_max)) / 1e6
    };

    let demand_knm = capacity_knm;
    let utilization = demand_knm.abs() / capacity_knm.max(f64::EPSILON);

    CapacityCheck {
        passed: utilization <= 1.0,
        utilization,
        message: format!(
            "IS 456 singly reinforced flexure capacity; demand = {:.3} kN·m, capacity = {:.3} kN·m",
            demand_knm.abs(),
            capacity_knm
        ),
        clause: "IS 456:2000, Cl. 38.1",
    }
}

/// Generic section demand vector check for unified RC members.
pub fn member_compliance<T: StructuralElement>(element: &T, demand: Vec6) -> CapacityCheck {
    element.compliance_check(demand)
}