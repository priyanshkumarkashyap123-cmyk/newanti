//! Comprehensive Structural Design Code Implementations
//!
//! **INDIAN STANDARDS:**
//! - IS 456:2000 — Plain and Reinforced Concrete (Limit State Method)
//! - IS 800:2007 — General Construction in Steel (LSM)
//! - IS 1893:2016 — Earthquake Resistant Design
//! - IS 875 (Parts 1-5) — Design Loads
//!
//! **INTERNATIONAL DESIGN CODES:**
//! - AISC 360-22 — US Steel Design (LRFD)
//! - Eurocode 3 (EN 1993-1-1) — European Steel Design
//! - ACI 318-19 — US Reinforced Concrete Design
//! - Eurocode 2 (EN 1992-1-1) — European Reinforced Concrete Design
//! - NDS 2018 — US Timber Design
//!
//! **GENERAL:**
//! - Serviceability checks (deflection, vibration, crack width, drift)
//!
//! All calculations use mathematically rigorous formulations with numerical
//! stability guards. Supports FSD (Fully Stressed Design) optimization.

pub mod is_456;
pub mod is_800;
pub mod is_1893;
pub mod is_875;
pub mod serviceability;
pub mod ductile_detailing;
pub mod base_plate;
pub mod composite_beam;

// International Design Codes
pub mod aisc_360;
pub mod eurocode3;
pub mod aci_318;
pub mod eurocode2;
pub mod nds_2018;
