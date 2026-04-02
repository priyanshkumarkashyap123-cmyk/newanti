//! Industry Complete Parity Module
//!
//! Thin façade over the parity submodules.

mod supernodal_cholesky;
mod fiber_section;
mod plastic_hinge;
mod hex20_element;
mod catenary_element;
mod model_validation;
mod load_combinations;

pub use supernodal_cholesky::{CholeskyError, ReorderingMethod, Supernode, SupernodalCholesky};
pub use fiber_section::{Fiber, FiberMaterial, FiberMaterialType, FiberSection, MomentCurvaturePoint, PMInteractionDiagram, PMPoint, PhiFactors, StrainState};
pub use plastic_hinge::{AcceptanceCriteria, HingeBackbone, HingeState, PerformanceLevel, PlasticHinge, PlasticHingeType};
pub use hex20_element::{Hex20Element, IntegrationScheme};
pub use catenary_element::{CableShape, CatenaryElement};
pub use load_combinations::{CombinationType, DesignCode, LoadCase, LoadCombination, LoadCombinationGenerator, LoadType};
pub use model_validation::{ModelValidator, Severity, ValidationCategory, ValidationMessage, ValidationOutcome, ValidationReport};

