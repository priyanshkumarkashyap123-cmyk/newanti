/**
 * ============================================================================
 * OFFSHORE EXTENSIONS - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds missing offshore wind features:
 * - Fatigue damage accumulation
 * - Morison hydrodynamic loading
 * - Natural frequency checks (1P/3P)
 * - ULS/SLS alignment with DNV/IEC
 * 
 * @version 1.0.0
 */

// ============================================================================
// FATIGUE DAMAGE ACCUMULATION
// ============================================================================

export interface FatigueResult {
  damage: number;              // Palmgren-Miner cumulative damage D
  designLife: number;          // years
  fatigueLife: number;         // years (at D=1)
  status: 'PASS' | 'FAIL';
  criticalLocation: string;
  SNCurve: string;
  clause: string;
}

export interface StressRange {
  range: number;               // MPa
  cycles: number;              // Number of cycles at this range
}

/**
 * S-N Curve parameters (DNV-GL RP-C203)
 */
const SN_CURVES: Record<string, { m1: number; m2: number; logA1: number; logA2: number; Nc: number }> = {
  'B1': { m1: 4.0, m2: 5.0, logA1: 15.117, logA2: 17.146, Nc: 1e7 },
  'C':  { m1: 3.0, m2: 5.0, logA1: 12.592, logA2: 16.320, Nc: 1e7 },
  'C1': { m1: 3.0, m2: 5.0, logA1: 12.449, logA2: 16.081, Nc: 1e7 },
  'C2': { m1: 3.0, m2: 5.0, logA1: 12.301, logA2: 15.835, Nc: 1e7 },
  'D':  { m1: 3.0, m2: 5.0, logA1: 12.164, logA2: 15.606, Nc: 1e7 },
  'E':  { m1: 3.0, m2: 5.0, logA1: 12.010, logA2: 15.350, Nc: 1e7 },
  'F':  { m1: 3.0, m2: 5.0, logA1: 11.855, logA2: 15.091, Nc: 1e7 },
  'F1': { m1: 3.0, m2: 5.0, logA1: 11.699, logA2: 14.832, Nc: 1e7 },
  'F3': { m1: 3.0, m2: 5.0, logA1: 11.546, logA2: 14.576, Nc: 1e7 },
  'G':  { m1: 3.0, m2: 5.0, logA1: 11.398, logA2: 14.330, Nc: 1e7 },
  'W1': { m1: 3.0, m2: 5.0, logA1: 11.261, logA2: 14.101, Nc: 1e7 },
  'W2': { m1: 3.0, m2: 5.0, logA1: 11.107, logA2: 13.845, Nc: 1e7 },
  'W3': { m1: 3.0, m2: 5.0, logA1: 10.970, logA2: 13.617, Nc: 1e7 },
  'T':  { m1: 3.0, m2: 5.0, logA1: 12.164, logA2: 15.606, Nc: 1e7 }, // For tubular joints
};

export function calculateFatigueDamage(
  stressRanges: StressRange[],
  snCurve: keyof typeof SN_CURVES,
  designLife: number,         // years
  options?: {
    SCF?: number;             // Stress concentration factor (default 1.0)
    thicknessCorrection?: number; // For t > 25mm
    meanStressCorrection?: boolean;
    DFF?: number;             // Design fatigue factor (default 3.0 for monopiles)
  }
): FatigueResult {
  const curve = SN_CURVES[snCurve] || SN_CURVES['D'];
  const { m1, logA1, m2, logA2, Nc } = curve;
  const SCF = options?.SCF || 1.0;
  const DFF = options?.DFF || 3.0;
  const thickCorr = options?.thicknessCorrection || 1.0;

  let totalDamage = 0;

  for (const { range, cycles } of stressRanges) {
    // Apply SCF and thickness correction
    const S = range * SCF * thickCorr;

    // Determine which part of S-N curve to use
    const Sc = Math.pow(10, (logA1 - Math.log10(Nc)) / m1);
    
    let N: number;
    if (S > Sc) {
      // High stress range (slope m1)
      N = Math.pow(10, logA1 - m1 * Math.log10(S));
    } else {
      // Low stress range (slope m2)
      N = Math.pow(10, logA2 - m2 * Math.log10(S));
    }

    // Miner's rule damage contribution
    totalDamage += cycles / N;
  }

  // Apply design fatigue factor
  const effectiveDamage = totalDamage * DFF;

  // Fatigue life
  const fatigueLife = designLife / effectiveDamage;

  return {
    damage: Math.round(effectiveDamage * 10000) / 10000,
    designLife,
    fatigueLife: Math.round(fatigueLife * 10) / 10,
    status: effectiveDamage <= 1.0 ? 'PASS' : 'FAIL',
    criticalLocation: 'Mudline (typical for monopiles)',
    SNCurve: snCurve,
    clause: 'DNV-GL RP-C203, IEC 61400-3-1',
  };
}

/**
 * Rainflow counting placeholder for stress history
 */
export function rainflowCount(stressHistory: number[]): StressRange[] {
  // Simplified rainflow counting (4-point algorithm)
  const ranges: Map<number, number> = new Map();
  
  // Find peaks and valleys
  const extrema: number[] = [];
  for (let i = 1; i < stressHistory.length - 1; i++) {
    const prev = stressHistory[i - 1];
    const curr = stressHistory[i];
    const next = stressHistory[i + 1];
    
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      extrema.push(curr);
    }
  }

  // Count ranges (simplified - just adjacent differences)
  for (let i = 0; i < extrema.length - 1; i++) {
    const range = Math.abs(extrema[i + 1] - extrema[i]);
    const binned = Math.round(range / 5) * 5; // Bin to 5 MPa increments
    ranges.set(binned, (ranges.get(binned) || 0) + 0.5); // Half cycles
  }

  return Array.from(ranges.entries()).map(([range, cycles]) => ({ range, cycles }));
}

// ============================================================================
// MORISON HYDRODYNAMIC LOADING
// ============================================================================

export interface MorisonResult {
  inlineForce: number;         // kN/m (distributed)
  dragForce: number;           // kN/m
  inertiaForce: number;        // kN/m
  maxTotalForce: number;       // kN (total on member)
  maxMoment: number;           // kNm (at mudline)
  clause: string;
}

export function calculateMorisonForce(
  member: {
    diameter: number;          // m
    length: number;            // m (submerged)
  },
  wave: {
    H: number;                 // m - wave height
    T: number;                 // s - wave period
    d: number;                 // m - water depth
  },
  current: {
    velocity: number;          // m/s - surface current
    profile: 'uniform' | 'power_law';
  },
  coefficients?: {
    Cd?: number;               // Drag coefficient (default 1.0)
    Cm?: number;               // Inertia coefficient (default 2.0)
  },
  rho: number = 1025          // kg/m³ - seawater density
): MorisonResult {
  const { diameter: D, length: L } = member;
  const { H, T, d } = wave;
  const { velocity: Uc, profile } = current;
  const Cd = coefficients?.Cd || 1.0;
  const Cm = coefficients?.Cm || 2.0;

  // Wave properties (linear wave theory)
  const omega = (2 * Math.PI) / T;
  const k = omega * omega / 9.81; // Deep water approximation
  const lambda = (2 * Math.PI) / k;

  // Maximum horizontal velocity and acceleration at surface
  const u_max = (Math.PI * H) / T;
  const a_max = (2 * Math.PI * Math.PI * H) / (T * T);

  // Drag and inertia forces per unit length (at surface)
  const A = (Math.PI * D * D) / 4;
  
  // Combined wave + current velocity
  const u_total = u_max + Uc;

  // Drag force (per unit length)
  const F_drag = 0.5 * rho * Cd * D * u_total * Math.abs(u_total) / 1000; // kN/m

  // Inertia force (per unit length)
  const F_inertia = rho * Cm * A * a_max / 1000; // kN/m

  // Total inline force (approximate - drag and inertia not in phase)
  // Use Morrison's formula with phase combination
  const F_inline = Math.sqrt(F_drag * F_drag + F_inertia * F_inertia);

  // Integrate over depth (simplified - assume linear decay)
  const F_total = F_inline * L * 0.7; // 70% of surface value average

  // Moment at mudline (centroid at ~0.6L from bottom for wave loading)
  const M_mudline = F_total * 0.6 * L;

  return {
    inlineForce: Math.round(F_inline * 100) / 100,
    dragForce: Math.round(F_drag * 100) / 100,
    inertiaForce: Math.round(F_inertia * 100) / 100,
    maxTotalForce: Math.round(F_total * 10) / 10,
    maxMoment: Math.round(M_mudline * 10) / 10,
    clause: 'DNV-GL RP-C205, Morison et al. (1950)',
  };
}

// ============================================================================
// NATURAL FREQUENCY CHECKS (1P/3P)
// ============================================================================

export interface NaturalFrequencyResult {
  f1: number;                  // First natural frequency (Hz)
  f1P: number;                 // 1P frequency (rotor rotation)
  f3P: number;                 // 3P frequency (blade passing)
  softStiff: 'soft-soft' | 'soft-stiff' | 'stiff-stiff';
  separation1P: number;        // % separation from 1P
  separation3P: number;        // % separation from 3P
  status: 'PASS' | 'FAIL' | 'MARGINAL';
  clause: string;
}

export function checkNaturalFrequency(
  turbine: {
    ratedRPM: number;          // Rotor rated speed (rpm)
    minRPM: number;            // Cut-in rotor speed (rpm)
    maxRPM: number;            // Maximum rotor speed (rpm)
    blades: number;            // Number of blades (typically 3)
  },
  structure: {
    f1: number;                // First natural frequency (Hz)
  },
  margin: number = 0.10       // Required separation margin (default 10%)
): NaturalFrequencyResult {
  const { ratedRPM, minRPM, maxRPM, blades } = turbine;
  const { f1 } = structure;

  // Operating frequency ranges
  const f1P_min = minRPM / 60;
  const f1P_max = maxRPM / 60;
  const f1P_rated = ratedRPM / 60;

  const f3P_min = blades * f1P_min;
  const f3P_max = blades * f1P_max;
  const f3P_rated = blades * f1P_rated;

  // Soft-stiff classification
  let softStiff: 'soft-soft' | 'soft-stiff' | 'stiff-stiff';
  if (f1 < f1P_min * (1 - margin)) {
    softStiff = 'soft-soft';
  } else if (f1 > f3P_max * (1 + margin)) {
    softStiff = 'stiff-stiff';
  } else {
    softStiff = 'soft-stiff';
  }

  // Separation from critical frequencies
  const separation1P = Math.min(
    Math.abs(f1 - f1P_min) / f1P_min,
    Math.abs(f1 - f1P_max) / f1P_max
  );
  const separation3P = Math.min(
    Math.abs(f1 - f3P_min) / f3P_min,
    Math.abs(f1 - f3P_max) / f3P_max
  );

  // Check if within exclusion zones
  const in1PZone = f1 >= f1P_min * (1 - margin) && f1 <= f1P_max * (1 + margin);
  const in3PZone = f1 >= f3P_min * (1 - margin) && f1 <= f3P_max * (1 + margin);

  let status: 'PASS' | 'FAIL' | 'MARGINAL';
  if (in1PZone || in3PZone) {
    status = 'FAIL';
  } else if (separation1P < margin * 1.5 || separation3P < margin * 1.5) {
    status = 'MARGINAL';
  } else {
    status = 'PASS';
  }

  return {
    f1: Math.round(f1 * 1000) / 1000,
    f1P: Math.round(f1P_rated * 1000) / 1000,
    f3P: Math.round(f3P_rated * 1000) / 1000,
    softStiff,
    separation1P: Math.round(separation1P * 1000) / 10,
    separation3P: Math.round(separation3P * 1000) / 10,
    status,
    clause: 'IEC 61400-3-1, DNV-GL ST-0126',
  };
}

// ============================================================================
// ULS/SLS LOAD COMBINATIONS
// ============================================================================

export interface OffshoreLoadCombination {
  name: string;
  type: 'ULS' | 'SLS' | 'FLS' | 'ALS';
  factors: {
    permanent: number;
    variable: number;
    environmental: number;
    accidental?: number;
  };
  description: string;
}

export const DNV_LOAD_COMBINATIONS: OffshoreLoadCombination[] = [
  // ULS combinations
  {
    name: 'ULS-a',
    type: 'ULS',
    factors: { permanent: 1.25, variable: 1.25, environmental: 0.7 },
    description: 'Permanent and variable loads dominate',
  },
  {
    name: 'ULS-b',
    type: 'ULS',
    factors: { permanent: 1.0, variable: 1.0, environmental: 1.35 },
    description: 'Environmental loads dominate',
  },
  // SLS combinations
  {
    name: 'SLS-char',
    type: 'SLS',
    factors: { permanent: 1.0, variable: 1.0, environmental: 1.0 },
    description: 'Characteristic serviceability limit state',
  },
  // FLS combinations
  {
    name: 'FLS',
    type: 'FLS',
    factors: { permanent: 1.0, variable: 1.0, environmental: 1.0 },
    description: 'Fatigue limit state with DFF applied separately',
  },
  // ALS combinations
  {
    name: 'ALS',
    type: 'ALS',
    factors: { permanent: 1.0, variable: 1.0, environmental: 1.0, accidental: 1.0 },
    description: 'Accidental limit state (ship collision, dropped object)',
  },
];

export function getOffshoreLoadCombinations(
  code: 'DNV' | 'IEC' | 'API' = 'DNV'
): OffshoreLoadCombination[] {
  // All major codes use similar approach; return DNV as baseline
  return DNV_LOAD_COMBINATIONS;
}
