# Requirements Document

## Introduction
- Feature summary:
- Why this is needed:
- In scope:
- Out of scope:

## Engineering Context (Mandatory)
- **Design codes in scope (exact edition):**
  - IS 456:2000
  - IS 800:2007
  - IS 1893:2016
  - IS 875 (Part applicable)
  - ACI 318 / AISC 360 / EC2 / EC3 (if applicable)
- **Unit system (SI only):**
  - Force: kN
  - Moment: kN·m
  - Stress: MPa (N/mm²)
  - Length: mm or m (explicitly state where each is used)
- **Sign conventions used:**
  - Axial: tension (+), compression (−)
  - Moment (concrete): sagging (+), hogging (−)
  - Moment (steel): sagging (+), hogging (−)
  - Shear: beam right-hand convention
- **Variable naming with units (examples):**
  - `vu_kn`, `mu_knm`, `stress_mpa`, `depth_mm`, `span_m`

## Glossary
- Define project-specific terms used in this spec.

## Functional Requirements

### Requirement 1: {Title}
**User Story:** As a {role}, I want {capability}, so that {value}.  

#### Acceptance Criteria
1. WHEN {trigger}, THEN the system SHALL {behavior}.
2. IF {condition}, THEN the system SHALL {handling/fallback}.
3. THE system SHALL output values with explicit SI units and preserve required signs.
4. THE system SHALL include code-clause citation in message/result where applicable (e.g., `IS 456 Cl. 40.1`).

### Requirement 2: {Title}
**User Story:** As a {role}, I want {capability}, so that {value}.  

#### Acceptance Criteria
1. WHEN {trigger}, THEN the system SHALL {behavior}.
2. IF {condition}, THEN the system SHALL {handling/fallback}.

(Repeat as needed)

## Non-Functional Requirements
- Accuracy tolerance (e.g., ≤ 1% vs reference/hand calc)
- Performance target (runtime/size limits)
- Reliability/availability constraints
- UX requirements for loading/error states

## Structural Safety & Compliance Requirements (Mandatory)
- Partial safety factors used (exact values; no approximation)
- Table references for interpolation/lookups
- Clause references for each governing check
- Pass/fail convention:
  - `utilization = demand / capacity`
  - Pass if `utilization <= 1.0`

## Validation Requirements (Mandatory)
- At least one textbook/hand-calculation benchmark example with expected result
- Regression expectations for unchanged behavior
- Edge cases list (invalid inputs, boundary values, sign flips)

## Regression/Preservation Requirements
- Explicitly list behavior that must remain unchanged after implementation.
