# Clause Coverage (Live Map)

_Last updated: 2026-01-30_

Tracks which provisions are implemented vs pending. Update alongside code changes and regression baselines.

## Steel (IS 800 / AISC 360)
- **Implemented (baseline)**
  - Axial tension/compression (overall) — needs buckling curve validation
  - Basic bending/shear checks (summary level)
- **Pending / high priority**
  - Lateral–torsional buckling (F2/AISC; Cl. 8/IS) with unbraced length & Cb
  - Slender elements & local buckling classification
  - Serviceability (deflection limits by occupancy)
  - Connection limit states: bolt shear/bearing, prying, block shear, weld sizing, base plates
  - Composite members (future)

## Concrete (IS 456)
- **Implemented (baseline)**
  - Flexural design (limit state) for beams/columns/slabs
- **Pending / high priority**
  - Shear (τv vs τc tables), punching for slabs/footings
  - Deflection (short-term + creep), crack width
  - Development length/anchorage, bar spacing/cover by exposure
  - Durability/cover tables, T-beam flange effectiveness

## Seismic (IS 1893 / ASCE 7 / EN 1998)
- **Implemented (baseline)**
  - Basic spectral parameters and base shear comparisons (simplified)
- **Pending / high priority**
  - Full Fa/Fv tables; EC site factors
  - Accidental torsion; diaphragm flexibility; vertical EQ component
  - P-Δ stability coefficient θ
  - R / Ω0 / Cd coherence and drift checks
  - Irregularity detection (plan/vertical) and mode count for RSA

## Load Combinations
- **Implemented (baseline)**
  - Generic combo handling
- **Pending / high priority**
  - Code-specific sets (ASCE/IBC, IS, EC) with ψ factors; uplift/wind/seismic envelopes

## Geotechnical
- **Implemented (baseline)**
  - Pile axial/lateral/group (core formulas)
- **Pending / high priority**
  - Liquefaction / lateral spreading
  - Negative skin friction
  - Settlement checks (shallow foundations)
  - Seismic earth pressure (Mononobe-Okabe)

## Offshore / Wind (DNV-GL/IEC)
- **Implemented (baseline)**
  - Monopile/Jacket design flow (Rust backend)
- **Pending / high priority**
  - ULS/SLS alignment with DNV-GL/IEC clauses
  - Fatigue (rainflow, damage accumulation)
  - Hydrodynamics (Morison) validation; natural frequency checks (1P/3P)

## Governance
- Every PR touching design/analysis must update this file and add/adjust regression cases with clause references.
