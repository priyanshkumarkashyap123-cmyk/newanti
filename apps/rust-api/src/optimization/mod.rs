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
    MemberForces, MemberGeometry, MemberType,
    DesignCheck, IterationHistory,
    check_member,
};
