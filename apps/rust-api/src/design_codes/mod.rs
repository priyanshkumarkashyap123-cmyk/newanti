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

#![allow(dead_code)]
#![allow(unused_imports)]

pub mod base_plate;
pub mod bearing_capacity;
pub mod composite_beam;
pub mod ductile_detailing;
pub mod earth_pressure;
pub mod is_1893;
pub mod is_456;
pub mod is_800;
pub mod is_875;
pub mod liquefaction;
pub mod pile_capacity;
pub mod retaining_wall;
pub mod seismic_earth_pressure;
pub mod serviceability;
pub mod settlement;
pub mod slope_stability;
pub mod spt_correlations;

// Section-Wise Design Engine
pub mod section_wise;

// International Design Codes
pub mod aci_318;
pub mod aisc_360;
pub mod eurocode2;
pub mod eurocode3;
pub mod nds_2018;

// Coral & Coal Structural Applications
// TODO: Re-enable these modules when source files are added.
// pub mod coral_materials;
// pub mod coral_foundation;
// pub mod coral_aggregate_concrete;
// pub mod coal_materials;
// pub mod coal_pillar_design;
// pub mod coal_storage;
// pub mod mine_seal_design;
