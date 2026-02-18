# Capability & Coverage Matrix (BeamLab)

_Last updated: 2026-01-30_

This matrix captures current scope, implementation status, validation state, and immediate gaps to close for parity with industry-grade structural/civil engineering tools.

## Legend
- **Status**: ✅ Complete · ⚠️ Partial · 🚧 Early · ⏳ Planned
- **Validation**: Benchmarked against code examples or published references (Yes/No/Partial)
- **Next**: Short, actionable next steps

Clause-by-clause status lives in `docs/CLAUSE_COVERAGE.md` (update with every design/analysis PR).

Regression scaffold lives in `tests/regression` with fixtures and tolerance policy; wire to CI as part of Phase 0.

## Structural Analysis & Seismic
| Domain | Codes/Methods | Status | Validation | Gaps / Next |
| --- | --- | --- | --- | --- |
| 2D Frames/Trusses/Beams | Direct stiffness; AdvancedStructuralAnalysisEngine | ⚠️ | No | Add regression vs textbook examples; unit safeguards; modal/dynamic QA. |
| Dynamic / Modal RSA | AdvancedMatrixAnalysisEngine, DynamicAnalysisEngine | 🚧 | No | Add SRSS/CQC combos, damping models, higher-mode checks, irregularity flags. |
| Seismic (IS 1893 / ASCE 7 / EN 1998) | AdvancedSeismicAnalysisEngine; MultiCodeComparisonEngine | ⚠️ | No | Implement full spectra tables, accidental torsion, vertical EQ, P-Δ, R/Ω0/Cd consistency; regression vs code examples. |
| Load Combinations | AdvancedLoadCombinationEngine | ⚠️ | No | Enumerate code-specific combos (ASCE/IBC, IS, EC); verify factors/psi; add tests. |
| Nuclear (ASCE 4) | NuclearStructuresEngine | 🚧 | No | Validate spectra, SSI; add damping/soil profiles; benchmark vs ASCE 4 examples. |

## Steel / Concrete / Connections
| Domain | Codes | Status | Validation | Gaps / Next |
| Steel Member Design | IS 800, AISC 360 (per design.ts) | ⚠️ | No | Add LTB/stability, slenderness, serviceability; clause-by-clause coverage map; benchmarks. |
| Steel Connections | (types listed) | 🚧 | No | Add bolt/weld limit states, prying, block shear; code clause mapping; tests. |
| Concrete (IS 456) | Beams/Columns/Slabs (Python backend) | ⚠️ | No | Add shear/punching, deflection/long-term effects, detailing rules; regression vs SP 34/IS examples. |
| Foundations | Footing design API | 🚧 | No | Add bearing/settlement checks, punching, uplift/sliding; load combos; tests. |

## Geotechnical
| Domain | Status | Validation | Gaps / Next |
| Pile Foundations (axial/lateral/group) | ⚠️ | No | Add liquefaction/lateral spreading options, API exposure, benchmarks vs Reese/Matlock cases. |
| Retaining/Earth Pressure/Settlement | 🚧 | No | Document coverage; add Coulomb/Rankine variants, seismic earth pressure (Mononobe-Okabe), drainage checks. |

## Offshore / Wind
| Domain | Status | Validation | Gaps / Next |
| Monopile/Jacket/Floating | ⚠️ (Rust backend) | No | Align with DNV-GL/IEC; add fatigue, ULS/SLS envelopes, hydrodynamics; benchmark against reference problems. |

## Civil (Hydraulics/Transportation/Surveying)
| Domain | Status | Validation | Gaps / Next |
| Hydraulics/Hydrology, Transportation, Surveying tools | 🚧 | No | Clarify implemented calculators; add tests vs standard problems; units QA.

## AI & UX
| Area | Status | Validation | Gaps / Next |
| AI Knowledge/Responses | ⚠️ | No | Add guardrails to cite clauses; restrict to validated domains; confidence tagging. |
| IFC Export | ⚠️ | Partial | Validate geometry/units; add imports/clash checks; versioned exports. |

## Security & Governance
- Auth: Token stub present; **Need** role-based access, rate limits, audit logs.
- Reproducibility: **Need** run metadata (input hash, code version, results) stored per calculation.
- Disclaimers: **Need** advisory vs stamped outputs messaging in UI and reports.

## Immediate priorities (P0)
1) Publish validation baselines for: (a) AISC/IS steel member examples, (b) IS 456 RC beam/column/slab, (c) ASCE7/IS1893 spectra/base shear cases, (d) pile axial/lateral test cases, (e) DNV monopile benchmark.
2) Add clause coverage maps per code module (steel, RC, seismic) with implemented vs TODO.
3) Enforce units/tolerance checks in analysis and design APIs.
4) Add CI jobs to run regression baselines and fail on tolerance drift.
