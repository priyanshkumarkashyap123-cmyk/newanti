# Engineering Backlog (Priority-Ordered)

## P0 (immediate)
- Ship regression harness and first 3 canonical cases per domain (structural, seismic, steel, RC, geotech, offshore).
- Add clause coverage maps for steel (IS 800/AISC 360), RC (IS 456), seismic (IS 1893/ASCE 7/EN 1998): implemented vs TODO.
- Enforce unit consistency and tolerance guards in core engines and API inputs.
- Wire CI jobs: typecheck, lint, regression smoke; block merges on failures.
- Add advisory disclaimer in UI/reports differentiating “decision support” from “stamped”.

## P1 (near-term)
- Expand regression suite to 10 cases/domain; publish dashboard of pass/fail with deltas.
- Implement missing seismic features: accidental torsion, vertical EQ, P-Δ, diaphragm flexibility, irregularity flags, R/Ω0/Cd coherence.
- Steel: lateral–torsional buckling, stability curves, serviceability; connection limit states (bolt/weld/prying/block shear/base plate). 
- RC: deflection/creep checks, punching shear, development length, crack width; detailing per exposure classes.
- Geotech: liquefaction/lateral spreading placeholders; Mononobe-Okabe seismic pressures; pile negative skin friction; settlement checks.
- Offshore: align with DNV-GL/IEC ULS/SLS; add fatigue pipeline; hydrodynamics (Morison) validation; natural frequency checks.
- Security: role-based access, rate limits, audit logs for calc requests.

## P2 (mid-term)
- Visualization/reporting: envelopes, interaction diagrams, clause-cited reports, IFC/CSV exports with versioned metadata.
- Model import and clash/consistency checks; unit-aware viewers.
- Performance: worker/offloading for heavy solvers; caching for spectra/material libraries.
- AI guardrails: clause citation, confidence tagging, block unvalidated domains.

## P3 (later)
- Composite/timber modules; advanced SSI; probabilistic/reliability checks.
- Integration with stamping/review workflow and e-signatures.

## Process hygiene
- Definition of Done includes: clause citation, unit checks, regression entry, docs update.
- Each PR must update coverage matrix and regression status when relevant.
