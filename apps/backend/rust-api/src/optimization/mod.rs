//! Structural Optimization Module
//!
//! Advanced optimization engines for structural design:
//! - Fully Stressed Design (FSD)
//! - Mathematical programming methods
//! - Discrete section optimization
//! - Multi-objective optimization

pub mod fsd_engine;

pub use fsd_engine::{
    check_member, check_member_rc, rc_beam_database, rc_column_database, Constraint, DesignCheck,
    FSDConfig, FSDEngine, FSDResult, IterationHistory, MaterialType, MemberEnvelopeSummary,
    MemberForces, MemberGeometry, MemberType, Objective, RCDesignCheck, RcSection,
};
