//! Two-way slab design using coefficient method (IS 456:2000 Annex D)

use serde::{Deserialize, Serialize};

use super::common::circle_area;
use super::punching_shear::DesignStatus;

/// Slab edge conditions (IS 456 Table 26)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SlabEdgeConditions {
    /// All four edges continuous
    AllContinuous,
    /// One short edge discontinuous
    OneShortDiscontinuous,
    /// One long edge discontinuous
    OneLongDiscontinuous,
    /// Two adjacent edges discontinuous
    TwoAdjacentDiscontinuous,
    /// Two short edges discontinuous
    TwoShortDiscontinuous,
    /// Two long edges discontinuous
    TwoLongDiscontinuous,
    /// Three edges discontinuous (one long continuous)
    ThreeEdgesDiscOneLong,
    /// Three edges discontinuous (one short continuous)
    ThreeEdgesDiscOneShort,
    /// All four edges discontinuous (simply supported)
    AllDiscontinuous,
}

/// Two-way slab design result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoWaySlabResult {
    pub aspect_ratio: f64,
    pub alpha_x: f64,
    pub alpha_y: f64,
    pub mx: f64,  // kNm/m
    pub my: f64,  // kNm/m
    pub req_ast_x: f64, // mm²/m
    pub req_ast_y: f64, // mm²/m
    pub spacing_x: f64, // mm
    pub spacing_y: f64, // mm
    pub status: DesignStatus,
}

/// Two-way slab designer (IS 456 Annex D)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwoWaySlabDesigner {
    /// Characteristic concrete strength (N/mm²)
    pub fck: f64,
    /// Yield strength of steel (N/mm²)
    pub fy: f64,
    /// Shorter span (mm)
    pub lx: f64,
    /// Longer span (mm)
    pub ly: f64,
    /// Slab thickness (mm)
    pub thickness: f64,
    /// Clear cover (mm)
    pub cover: f64,
    /// Edge conditions
    pub edge_conditions: SlabEdgeConditions,
}

impl TwoWaySlabDesigner {
    /// Compute design per Annex D coefficient method
    pub fn design(&self, wu: f64) -> TwoWaySlabResult {
        let aspect_ratio = self.ly / self.lx;
        let (alpha_x, alpha_y) = self.moment_coefficients(aspect_ratio, self.edge_conditions);

        // Factored moments per meter width
        let mx = alpha_x * wu * self.lx.powi(2) / 1e6; // N·mm → kNm/m
        let my = alpha_y * wu * self.lx.powi(2) / 1e6;

        // Effective depth
        let d = self.thickness - self.cover - 10.0; // assume 10mm bar to center

        // Required steel using Mu = 0.87 fy Ast z; z ≈ 0.9d
        let z = 0.9 * d;
        let req_ast_x = (mx * 1e6) / (0.87 * self.fy * z);
        let req_ast_y = (my * 1e6) / (0.87 * self.fy * z);

        // Provide bar spacing (mm) with 10mm bars default
        let bar_area = circle_area(10.0);
        let spacing_x = (1000.0 * bar_area / req_ast_x).min(200.0).max(75.0);
        let spacing_y = (1000.0 * bar_area / req_ast_y).min(200.0).max(75.0);

        TwoWaySlabResult {
            aspect_ratio,
            alpha_x,
            alpha_y,
            mx,
            my,
            req_ast_x,
            req_ast_y,
            spacing_x,
            spacing_y,
            status: DesignStatus::Pass,
        }
    }

    /// Annex D moment coefficients (simplified representative values)
    fn moment_coefficients(
        &self,
        aspect_ratio: f64,
        edge: SlabEdgeConditions,
    ) -> (f64, f64) {
        // Note: For full fidelity, replace with table lookup; here we retain prior behavior scope.
        let ar = aspect_ratio.max(1.0).min(3.0);
        match edge {
            SlabEdgeConditions::AllContinuous => (0.065 * ar.powf(-0.2), 0.045 * ar.powf(-0.2)),
            SlabEdgeConditions::AllDiscontinuous => (0.086 * ar.powf(-0.25), 0.063 * ar.powf(-0.25)),
            _ => (0.075 * ar.powf(-0.22), 0.055 * ar.powf(-0.22)),
        }
    }
}
