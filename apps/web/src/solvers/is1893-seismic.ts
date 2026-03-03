/**
 * IS 1893 (Part 1):2016 — Seismic Force Generation
 *
 * Criteria for Earthquake Resistant Design of Structures
 *
 * Implements:
 *   - Design Spectrum Sa/g (Clause 6.4.2, Table 3)
 *   - Design Horizontal Seismic Coefficient Ah (Clause 6.4.2)
 *   - Base Shear VB (Clause 7.6.1)
 *   - Vertical Distribution Qi (Clause 7.6.3)
 *   - Approximate Fundamental Period Ta (Clause 7.6.2)
 *   - Seismic Weight W (Clause 7.4)
 *   - Torsional Provisions (Clause 7.8)
 *   - Soft Storey Check (Clause 7.1)
 *
 * References:
 *   IS 1893 (Part 1):2016 Table 2 — Zone Factors
 *   IS 1893 (Part 1):2016 Table 7 — Response Reduction Factor R
 *   IS 1893 (Part 1):2016 Table 8 — Importance Factor I
 *   IS 1893 (Part 1):2016 Fig. 2/Table 3 — Design Response Spectra
 *
 * @module is1893-seismic
 */

// ============================================
// TYPES
// ============================================

/** IS 1893 Seismic Zone (Clause 6.4.2, Table 2) */
export type SeismicZone = 'II' | 'III' | 'IV' | 'V';

/** Soil Type per IS 1893 Table 1 / Clause 6.4.2 */
export type SoilType = 'I' | 'II' | 'III';
// I = Rock/Hard Soil (N>30), II = Medium Soil (10≤N≤30), III = Soft Soil (N<10)

/** Structural system type for response reduction factor R */
export type StructuralSystem =
  | 'OMRF_RC'         // Ordinary Moment-Resisting Frame (RC)
  | 'SMRF_RC'         // Special Moment-Resisting Frame (RC)
  | 'OMRF_STEEL'      // Ordinary MRF (Steel)
  | 'SMRF_STEEL'      // Special MRF (Steel)
  | 'BRACED_FRAME'    // Braced Frame
  | 'ECCENTRIC_BRACE' // Eccentrically Braced Frame
  | 'SHEAR_WALL'      // Building with Shear Walls
  | 'DUAL_SYSTEM'     // Dual System (MRF + Shear Wall)
  | 'LOAD_BEARING';   // Load-Bearing Masonry

/** Building importance class per IS 1893 Table 8 */
export type ImportanceClass = 'GENERAL' | 'IMPORTANT' | 'LIFELINE';

/** Storey data for vertical distribution */
export interface StoreyData {
  /** Storey number (1 = ground floor) */
  level: number;
  /** Height of storey from base (m) */
  height: number;
  /** Seismic weight of storey (kN) — includes DL + fraction of LL */
  weight: number;
}

/** Seismic parameters for analysis */
export interface SeismicParams {
  zone: SeismicZone;
  soilType: SoilType;
  structuralSystem: StructuralSystem;
  importanceClass: ImportanceClass;
  /** Override fundamental period (seconds). If omitted, computed from Ta formula */
  period?: number;
  /** Building height in meters (for Ta approximation) */
  buildingHeight?: number;
  /** Number of storeys (for Ta approximation) */
  numStoreys?: number;
  /** Frame type for Ta: 'RC', 'STEEL', or 'OTHER' */
  frameType?: 'RC' | 'STEEL' | 'OTHER';
  /** Plan dimension along direction of seismic force (m), for shear wall buildings */
  planDimension?: number;
}

/** Complete seismic force output */
export interface SeismicForceResult {
  /** Design horizontal seismic coefficient */
  Ah: number;
  /** Spectral acceleration coefficient Sa/g */
  Sa_g: number;
  /** Zone factor Z (fraction, not percentage) */
  Z: number;
  /** Importance factor I */
  I: number;
  /** Response reduction factor R */
  R: number;
  /** Fundamental period (seconds) */
  T: number;
  /** Total seismic weight W (kN) */
  W: number;
  /** Base shear VB (kN) */
  VB: number;
  /** Lateral forces at each storey (kN) */
  storeyForces: { level: number; height: number; Qi: number; Vi: number }[];
  /** Minimum Ah check (Clause 6.4.2) */
  Ah_min: number;
  /** Warnings */
  warnings: string[];
}

/** Soft storey check result */
export interface SoftStoreyResult {
  level: number;
  stiffness: number;
  stiffnessBelow: number;
  ratio: number;
  isSoft: boolean;
  isExtremelySoft: boolean;
}

// ============================================
// CONSTANTS — IS 1893:2016 Tables
// ============================================

/** Zone factors Z (Table 2) — as fraction */
const ZONE_FACTORS: Record<SeismicZone, number> = {
  'II': 0.10,
  'III': 0.16,
  'IV': 0.24,
  'V': 0.36,
};

/** Response Reduction Factor R (Table 7 — selected common systems) */
const R_FACTORS: Record<StructuralSystem, number> = {
  OMRF_RC: 3.0,
  SMRF_RC: 5.0,
  OMRF_STEEL: 3.0,
  SMRF_STEEL: 5.0,
  BRACED_FRAME: 4.0,
  ECCENTRIC_BRACE: 5.0,
  SHEAR_WALL: 4.0,
  DUAL_SYSTEM: 5.0,
  LOAD_BEARING: 1.5,
};

/** Importance Factor I (Table 8) */
const IMPORTANCE_FACTORS: Record<ImportanceClass, number> = {
  GENERAL: 1.0,
  IMPORTANT: 1.2,
  LIFELINE: 1.5,
};

// ============================================
// DESIGN SPECTRUM — IS 1893:2016 Clause 6.4.2
// ============================================

/**
 * Spectral acceleration coefficient Sa/g per IS 1893:2016 Table 3 / Fig. 2
 *
 * Soil Type I (Rock/Hard):
 *   T ≤ 0.10: 1 + 15T
 *   0.10 < T ≤ 0.40: 2.50
 *   0.40 < T ≤ 4.00: 1.00/T
 *   T > 4.00: 0.25
 *
 * Soil Type II (Medium):
 *   T ≤ 0.10: 1 + 15T
 *   0.10 < T ≤ 0.55: 2.50
 *   0.55 < T ≤ 4.00: 1.36/T
 *   T > 4.00: 0.34
 *
 * Soil Type III (Soft):
 *   T ≤ 0.10: 1 + 15T
 *   0.10 < T ≤ 0.67: 2.50
 *   0.67 < T ≤ 4.00: 1.67/T
 *   T > 4.00: 0.42
 */
export function getSpectralAcceleration(T: number, soilType: SoilType): number {
  if (T <= 0) return 2.5;

  switch (soilType) {
    case 'I': // Rock/Hard Soil
      if (T <= 0.10) return 1 + 15 * T;
      if (T <= 0.40) return 2.50;
      if (T <= 4.00) return 1.00 / T;
      return 0.25;

    case 'II': // Medium Soil
      if (T <= 0.10) return 1 + 15 * T;
      if (T <= 0.55) return 2.50;
      if (T <= 4.00) return 1.36 / T;
      return 0.34;

    case 'III': // Soft Soil
      if (T <= 0.10) return 1 + 15 * T;
      if (T <= 0.67) return 2.50;
      if (T <= 4.00) return 1.67 / T;
      return 0.42;
  }
}

// ============================================
// APPROXIMATE FUNDAMENTAL PERIOD
// ============================================

/**
 * Approximate fundamental natural period Ta per IS 1893:2016 Clause 7.6.2
 *
 * MRF without infill:
 *   RC: Ta = 0.075 × h^0.75
 *   Steel: Ta = 0.085 × h^0.75
 *
 * All other buildings:
 *   Ta = 0.09 × h / √d
 *   where d = plan dimension along the direction of force (m)
 *
 * @param h Building height in meters
 * @param frameType RC, STEEL, or OTHER
 * @param d Plan dimension along direction (m), for shear wall buildings
 */
export function getApproximatePeriod(
  h: number,
  frameType: 'RC' | 'STEEL' | 'OTHER' = 'RC',
  d?: number,
): number {
  if (h <= 0) return 0.1;

  switch (frameType) {
    case 'RC':
      return 0.075 * Math.pow(h, 0.75);
    case 'STEEL':
      return 0.085 * Math.pow(h, 0.75);
    case 'OTHER':
    default:
      if (d && d > 0) {
        return 0.09 * h / Math.sqrt(d);
      }
      // Fallback: treat as RC frame (conservative for stiff systems)
      return 0.075 * Math.pow(h, 0.75);
  }
}

// ============================================
// SEISMIC FORCE COMPUTATION — IS 1893:2016
// ============================================

/**
 * Compute Design Horizontal Seismic Coefficient Ah
 *
 * Ah = (Z/2) × (I/R) × (Sa/g)
 *
 * Minimum Ah per Clause 6.4.2:
 *   Zone II,III: Ah ≥ Z/2 × 0.35 / R  (Table 3 footnote)
 *   Zone IV,V:  Ah ≥ Z/2 × 0.50 / R  (approximately)
 *
 * Note: For regular buildings, Ah need not exceed (Z/2)×(Sa/g)
 */
export function computeAh(params: SeismicParams, T: number): {
  Ah: number; Z: number; I: number; R: number; Sa_g: number; Ah_min: number; warnings: string[];
} {
  const Z = ZONE_FACTORS[params.zone];
  const I = IMPORTANCE_FACTORS[params.importanceClass];
  const R = R_FACTORS[params.structuralSystem];
  const Sa_g = getSpectralAcceleration(T, params.soilType);

  const warnings: string[] = [];

  let Ah = (Z / 2) * (I / R) * Sa_g;

  // Minimum Ah (IS 1893:2016 footnotes to Table 3)
  // The code specifies Sa/g values capped by soil period, effectively giving minimum
  const Ah_min = (Z / 2) * (I / R) * 0.25; // At T=4s, Soil I gives Sa/g=0.25

  if (Ah < Ah_min) {
    warnings.push(`Ah=${Ah.toFixed(4)} increased to minimum ${Ah_min.toFixed(4)}`);
    Ah = Ah_min;
  }

  // Restriction: buildings in zones IV and V with certain structural systems
  if ((params.zone === 'IV' || params.zone === 'V') && params.structuralSystem === 'OMRF_RC') {
    warnings.push('Zone IV/V: OMRF not recommended. Use SMRF per IS 1893 Clause 7.1.');
  }

  if ((params.zone === 'IV' || params.zone === 'V') && params.structuralSystem === 'LOAD_BEARING') {
    warnings.push('Load-bearing masonry in Zone IV/V requires special provisions (IS 4326).');
  }

  return { Ah, Z, I, R, Sa_g, Ah_min, warnings };
}

/**
 * Compute Base Shear and Vertical Distribution
 *
 * VB = Ah × W (Clause 7.6.1)
 *
 * Qi = VB × (Wi × hi²) / Σ(Wj × hj²) (Clause 7.6.3)
 *
 * Storey Shear Vi = ΣQj (j=i to n)
 */
export function computeSeismicForces(
  params: SeismicParams,
  storeys: StoreyData[],
): SeismicForceResult {
  const warnings: string[] = [];

  // Sort storeys by height
  const sorted = [...storeys].sort((a, b) => a.height - b.height);

  // Total seismic weight
  const W = sorted.reduce((sum, s) => sum + s.weight, 0);
  if (W <= 0) {
    return {
      Ah: 0, Sa_g: 0, Z: 0, I: 0, R: 0, T: 0, W: 0, VB: 0,
      storeyForces: [], Ah_min: 0, warnings: ['Total seismic weight W ≤ 0'],
    };
  }

  // Fundamental period
  let T: number;
  if (params.period && params.period > 0) {
    T = params.period;
  } else if (params.buildingHeight && params.buildingHeight > 0) {
    T = getApproximatePeriod(
      params.buildingHeight,
      params.frameType ?? 'RC',
      params.planDimension,
    );
  } else {
    // Estimate height from max storey height
    const maxH = sorted.length > 0 ? sorted[sorted.length - 1]!.height : 10;
    T = getApproximatePeriod(maxH, params.frameType ?? 'RC', params.planDimension);
  }

  // Design horizontal seismic coefficient
  const { Ah, Z, I, R, Sa_g, Ah_min, warnings: ahWarnings } = computeAh(params, T);
  warnings.push(...ahWarnings);

  // Base shear (Clause 7.6.1)
  const VB = Ah * W;

  // Vertical distribution (Clause 7.6.3)
  const sumWiHi2 = sorted.reduce((sum, s) => sum + s.weight * s.height * s.height, 0);

  const storeyForces: { level: number; height: number; Qi: number; Vi: number }[] = [];

  if (sumWiHi2 > 0) {
    for (const s of sorted) {
      const Qi = VB * (s.weight * s.height * s.height) / sumWiHi2;
      storeyForces.push({ level: s.level, height: s.height, Qi, Vi: 0 });
    }
  }

  // Compute storey shears (Vi = sum of Qj from i to top)
  let Vi = 0;
  for (let i = storeyForces.length - 1; i >= 0; i--) {
    Vi += storeyForces[i]!.Qi;
    storeyForces[i]!.Vi = Vi;
  }

  // Check: base shear from distribution should equal VB
  if (storeyForces.length > 0) {
    const VB_check = storeyForces[0]!.Vi;
    if (Math.abs(VB_check - VB) > 0.01 * VB) {
      warnings.push(`Distribution error: ΣQi=${VB_check.toFixed(1)} ≠ VB=${VB.toFixed(1)}`);
    }
  }

  return {
    Ah, Sa_g, Z, I, R, T, W, VB,
    storeyForces,
    Ah_min,
    warnings,
  };
}

// ============================================
// TORSIONAL PROVISIONS — Clause 7.8
// ============================================

/**
 * Accidental eccentricity per IS 1893:2016 Clause 7.8.2.1
 *
 * Design eccentricity at floor i:
 *   edi = 1.5 × esi + 0.05 × bi (amplified)
 *   edi = esi − 0.05 × bi (reduced — more unfavourable)
 *
 * where esi = static eccentricity, bi = plan dimension perpendicular
 */
export function computeDesignEccentricity(
  esi: number, bi: number,
): { amplified: number; reduced: number } {
  return {
    amplified: 1.5 * esi + 0.05 * bi,
    reduced: esi - 0.05 * bi,
  };
}

// ============================================
// SOFT STOREY CHECK — Clause 7.1
// ============================================

/**
 * Soft storey irregularity check (Table 5 — Stiffness Irregularity)
 *
 * Soft: Ki < 0.7 × Ki+1
 * Extremely soft: Ki < 0.6 × Ki+1
 *
 * Also checks: Ki < 0.8 × average(Ki+1, Ki+2, Ki+3)
 *
 * @param storeyStiffnesses Array of lateral stiffness per storey (bottom to top)
 */
export function checkSoftStorey(
  storeyStiffnesses: number[],
): SoftStoreyResult[] {
  const results: SoftStoreyResult[] = [];

  for (let i = 0; i < storeyStiffnesses.length - 1; i++) {
    const Ki = storeyStiffnesses[i]!;
    const Ki1 = storeyStiffnesses[i + 1]!;
    const ratio = Ki1 > 0 ? Ki / Ki1 : Infinity;

    results.push({
      level: i + 1,
      stiffness: Ki,
      stiffnessBelow: Ki1,
      ratio,
      isSoft: ratio < 0.7,
      isExtremelySoft: ratio < 0.6,
    });
  }

  // Also check against average of 3 storeys above
  for (let i = 0; i < storeyStiffnesses.length - 3; i++) {
    const Ki = storeyStiffnesses[i]!;
    const avg = (storeyStiffnesses[i + 1]! + storeyStiffnesses[i + 2]! + storeyStiffnesses[i + 3]!) / 3;
    const ratio = avg > 0 ? Ki / avg : Infinity;
    if (ratio < 0.8) {
      const existing = results.find(r => r.level === i + 1);
      if (existing && !existing.isSoft) {
        existing.isSoft = true;
      }
    }
  }

  return results;
}

// ============================================
// SEISMIC WEIGHT COMPUTATION — Clause 7.4
// ============================================

/**
 * Seismic weight per IS 1893:2016 Clause 7.4
 *
 * Full DL + fraction of LL (Table 10):
 *   LL ≤ 3 kN/m²: 25% of LL
 *   LL > 3 kN/m²: 50% of LL
 *   Roof LL: 0% (or 25% if storage)
 *
 * @param DL Dead load per floor (kN)
 * @param LL Live load per floor (kN)
 * @param llIntensity Live load intensity (kN/m²)
 * @param isRoof Whether this is a roof level
 */
export function getSeismicWeight(
  DL: number, LL: number, llIntensity: number, isRoof: boolean = false,
): number {
  if (isRoof) return DL; // Roof LL = 0% (unless storage)

  const llFraction = llIntensity <= 3.0 ? 0.25 : 0.50;
  return DL + llFraction * LL;
}

// ============================================
// RESPONSE SPECTRUM DATA FOR PLOTTING
// ============================================

/**
 * Generate response spectrum data points for plotting
 * Returns array of {T, Sa_g} pairs from T=0 to T=5 seconds
 */
export function generateSpectrumData(
  soilType: SoilType, nPoints: number = 200,
): { T: number; Sa_g: number }[] {
  const data: { T: number; Sa_g: number }[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const T = (i / nPoints) * 5.0;
    data.push({ T, Sa_g: getSpectralAcceleration(T, soilType) });
  }
  return data;
}

/**
 * Generate design spectrum Ah values for a specific zone and building config
 */
export function generateDesignSpectrum(
  params: Omit<SeismicParams, 'period'>, nPoints: number = 200,
): { T: number; Ah: number; Sa_g: number }[] {
  const data: { T: number; Ah: number; Sa_g: number }[] = [];
  for (let i = 0; i <= nPoints; i++) {
    const T = (i / nPoints) * 5.0;
    const { Ah, Sa_g } = computeAh({ ...params, period: T } as SeismicParams, T);
    data.push({ T, Ah, Sa_g });
  }
  return data;
}

// ============================================
// COMBINED SEISMIC LOAD CASES
// ============================================

/**
 * Generate seismic load cases for structural analysis.
 * Returns equivalent static forces in both +X and +Y directions.
 *
 * Per IS 1893 Clause 6.3.2.1, seismic forces shall be applied in both
 * principal horizontal directions independently.
 *
 * 100% in one direction + 30% in orthogonal direction (Clause 6.3.2.2)
 */
export function generateSeismicLoadCases(
  paramsX: SeismicParams, storeysX: StoreyData[],
  paramsY: SeismicParams, storeysY: StoreyData[],
): {
  EQx: SeismicForceResult;
  EQy: SeismicForceResult;
  combinations: { label: string; factorX: number; factorY: number }[];
} {
  const EQx = computeSeismicForces(paramsX, storeysX);
  const EQy = computeSeismicForces(paramsY, storeysY);

  // Clause 6.3.2.2 — Bidirectional combinations
  const combinations = [
    { label: '+EQx + 0.3EQy', factorX: 1.0, factorY: 0.3 },
    { label: '+EQx - 0.3EQy', factorX: 1.0, factorY: -0.3 },
    { label: '-EQx + 0.3EQy', factorX: -1.0, factorY: 0.3 },
    { label: '-EQx - 0.3EQy', factorX: -1.0, factorY: -0.3 },
    { label: '0.3EQx + EQy', factorX: 0.3, factorY: 1.0 },
    { label: '0.3EQx - EQy', factorX: 0.3, factorY: -1.0 },
    { label: '-0.3EQx + EQy', factorX: -0.3, factorY: 1.0 },
    { label: '-0.3EQx - EQy', factorX: -0.3, factorY: -1.0 },
  ];

  return { EQx, EQy, combinations };
}

// ============================================
// VERTICAL SEISMIC COMPONENT — Clause 6.4.6
// ============================================

/**
 * Vertical seismic coefficient per IS 1893:2016 Clause 6.4.6
 *
 * For Zone IV and V, and for:
 *   - Spans > 15m
 *   - Cantilevers > 3m
 *   - Prestressed concrete
 *   - Structures resting on soft soil
 *
 * Av = (2/3) × Ah
 */
export function getVerticalSeismicCoefficient(Ah: number): number {
  return (2 / 3) * Ah;
}
