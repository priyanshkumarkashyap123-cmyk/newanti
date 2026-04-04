/**
 * contracts/units.ts — Canonical unit and sign conventions for BeamLab.
 *
 * ALL structural calculations in the frontend use SI units exclusively.
 * This file is the single source of truth for unit families, sign
 * conventions, and conversion helpers at the frontend → API boundary.
 *
 * Downstream consumers:
 *   - Zustand store (modelTypes.ts, model.ts)
 *   - API Zod validation (validation.ts)
 *   - Rust solver (mod.rs, elements.rs)  — note: Rust uses N/mm²/mm⁴ internally
 *   - Python solver (dsm_3d_frame.py)    — note: Python uses Pa/m⁴ internally
 */

// ─── Unit Families ──────────────────────────────────────────────────────────

/** Frontend canonical unit family — all payloads leaving the store use this. */
export const UNIT_FAMILY = {
  force: 'kN',
  moment: 'kN·m',
  stress: 'N/mm²',      // == MPa
  length_span: 'm',     // spans, heights, coordinates
  length_section: 'mm', // section dimensions (depth, width, thickness)
  area: 'm²',           // cross-section area in payload (store uses m²)
  area_section: 'mm²',  // section area when talking to Rust (elements.rs)
  moi: 'm⁴',            // moment of inertia in payload
  moi_section: 'mm⁴',   // moment of inertia when talking to Rust
  modulus: 'kN/m²',     // E, G in frontend payload
  density: 'kg/m³',
  pressure: 'kN/m²',    // floor loads, soil pressure
  temperature: '°C',
  angle: 'deg',
  displacement: 'm',
  rotation: 'rad',
} as const;

// ─── Sign Conventions ───────────────────────────────────────────────────────

/**
 * Structural sign conventions (right-hand rule, beam convention).
 *
 * | Quantity        | Positive (+)                    | Negative (−)                  |
 * |-----------------|---------------------------------|-------------------------------|
 * | Axial force     | Tension                         | Compression                   |
 * | Moment (conc.)  | Sagging, tension at bottom      | Hogging, tension at top       |
 * | Moment (steel)  | Sagging, comp. at bottom flange | Hogging, comp. at top flange  |
 * | Shear           | Per right-hand rule              | Opposite                      |
 * | Displacement    | Along positive axis direction    | Against                       |
 *
 * Rule: use absolute values for capacity checks.  Keep signs only when
 * needed for reinforcement placement, moment-gradient Cb, or P–M
 * interaction diagrams.
 */
export const SIGN = {
  TENSION: +1,
  COMPRESSION: -1,
  SAGGING: +1,
  HOGGING: -1,
  GRAVITY_Y: -1,         // gravity acts in −Y direction
} as const;

// ─── Partial Safety Factors (immutable) ─────────────────────────────────────

/** IS 456:2000 partial safety factors */
export const IS456 = {
  GAMMA_C: 1.50,         // Concrete (Cl. 36.4.2)
  GAMMA_S: 1.15,         // Steel reinforcement (Cl. 36.4.2)
} as const;

/** IS 800:2007 partial safety factors */
export const IS800 = {
  GAMMA_M0: 1.10,        // Yielding / instability (Table 5)
  GAMMA_M1: 1.25,        // Ultimate stress / fracture (Table 5)
  GAMMA_MB: 1.25,        // Bolted connections (Table 5)
  GAMMA_MW_SHOP: 1.25,   // Fillet welds — shop (Cl. 10.5.7)
  GAMMA_MW_FIELD: 1.50,  // Fillet welds — field (Cl. 10.5.7)
  GAMMA_MF: 1.10,        // HSFG slip (Cl. 10.4.3)
} as const;

/** ACI 318-19 strength reduction factors */
export const ACI318 = {
  PHI_FLEXURE: 0.90,
  PHI_SHEAR: 0.75,
  PHI_COMPRESSION_TIED: 0.65,
  PHI_COMPRESSION_SPIRAL: 0.75,
} as const;

/** Eurocode 2 & 3 partial safety factors */
export const EC2 = {
  GAMMA_C: 1.50,         // Concrete
  GAMMA_S: 1.15,         // Reinforcing steel
} as const;

export const EC3 = {
  GAMMA_M0: 1.00,        // Cross-section resistance
  GAMMA_M1: 1.10,        // Member instability
  GAMMA_M2: 1.25,        // Fracture / bolts / welds
} as const;

// ─── Conversion Helpers ─────────────────────────────────────────────────────

/** Convert kN/m² → N/mm² (MPa).  Used at API boundary before sending to Rust. */
export function kNm2_to_MPa(val: number): number {
  return val * 1e-3;
}

/** Convert N/mm² (MPa) → kN/m².  Used when ingesting Rust results. */
export function mpa_to_kNm2(val: number): number {
  return val * 1e3;
}

/** Convert m² → mm².  Section area for Rust ingestion. */
export function m2_to_mm2(val: number): number {
  return val * 1e6;
}

/** Convert mm² → m².  Section area from Rust result. */
export function mm2_to_m2(val: number): number {
  return val * 1e-6;
}

/** Convert m⁴ → mm⁴.  Moment of inertia for Rust ingestion. */
export function m4_to_mm4(val: number): number {
  return val * 1e12;
}

/** Convert mm⁴ → m⁴.  Moment of inertia from Rust result. */
export function mm4_to_m4(val: number): number {
  return val * 1e-12;
}

/** Convert m³ → mm³.  Section modulus for Rust ingestion. */
export function m3_to_mm3(val: number): number {
  return val * 1e9;
}

/** Convert mm³ → m³.  Section modulus from Rust result. */
export function mm3_to_m3(val: number): number {
  return val * 1e-9;
}

/** Derive shear modulus G = E / (2(1+ν)).  Never hardcode E/2.6. */
export function deriveG(E: number, nu: number): number {
  return E / (2.0 * (1.0 + nu));
}
