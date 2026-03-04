//! Indian Standard Design Code Implementations
//!
//! Complete implementation of structural design calculations per:
//! - IS 456:2000 — Plain and Reinforced Concrete (Limit State Method)
//! - IS 800:2007 — General Construction in Steel (LSM)
//! - IS 1893:2016 — Earthquake Resistant Design
//! - IS 875 (Parts 1-5) — Design Loads
//! - Serviceability checks (deflection, vibration, crack width, drift)
//!
//! All math transferred from Python backend for production use.

pub mod is_456;
pub mod is_800;
pub mod is_1893;
pub mod is_875;
pub mod serviceability;
