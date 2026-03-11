//! Structural Optimization Module
//!
//! Advanced optimization engines for structural design:
//! - Fully Stressed Design (FSD)
//! - Mathematical programming methods
//! - Discrete section optimization
//! - Multi-objective optimization

pub mod fsd_engine;

pub use fsd_engine::{
    FSDEngine, FSDConfig, FSDResult,
    Objective, Constraint,
    MemberForces, MemberGeometry, MemberType, MaterialType,
    DesignCheck, IterationHistory, MemberEnvelopeSummary,
    RCDesignCheck, RcSection,
    check_member, check_member_rc,
    rc_beam_database, rc_column_database,
};
