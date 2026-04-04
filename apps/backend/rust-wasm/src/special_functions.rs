//! Special Mathematical Functions Facade
//!
//! Re-exports split special-function families while preserving the original API.

pub use crate::special_functions_bessel::*;
pub use crate::special_functions_elliptic::*;
pub use crate::special_functions_error::*;
pub use crate::special_functions_gamma::*;
pub use crate::special_functions_misc::*;
pub use crate::special_functions_statistics::*;

#[cfg(test)]
#[path = "special_functions_tests.rs"]
mod special_functions_tests;
