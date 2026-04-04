//! Non-Gaussian Transformations
//!
//! Industry-standard probability transformations for structural reliability.
//! Critical gap vs OpenTURNS and FERUM.
//!
//! ## Industry Gap Analysis
//!
//! | Feature | OpenTURNS | UQLab | FERUM | This Module |
//! |---------|-----------|-------|-------|-------------|
//! | Nataf Transform | ✓ | ✓ | ✓ | ✓ |
//! | Rosenblatt Transform | ✓ | ✓ | ✓ | ✓ |
//! | Copulas (Gaussian) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Clayton) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Frank) | ✓ | ✓ | ✗ | ✓ |
//! | Copulas (Gumbel) | ✓ | ✓ | ✗ | ✓ |
//! | Kernel Density Est. | ✓ | ✓ | ✗ | ✓ |

pub use crate::nataf_transformation::*;
pub use crate::rosenblatt_transformation::*;
pub use crate::copulas::*;
pub use crate::kernel_density::*;
pub use crate::nataf_tables::*;

// Re-exports maintain API surface; core implementations are in focused submodules.

// ============================================================================
// NATAF TRANSFORMATION
// ============================================================================
