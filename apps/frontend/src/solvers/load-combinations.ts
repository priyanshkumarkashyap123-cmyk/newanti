/**
 * Load Combinations Engine
 *
 * Implements load combinations per:
 *   - IS 456:2000 (Reinforced Concrete — Table 18, Clause 36.4)
 *   - IS 800:2007 (Steel Structures — Table 4, Clause 3.5.1)
 *   - IS 875 (Part 1-5) load definitions
 *
 * This module generates factored load combinations and computes
 * envelope forces (max/min at each member end) across all combinations.
 *
 * Load Types (IS 875 classification):
 *   DL = Dead Load (self-weight + permanent loads)
 *   LL = Live/Imposed Load (IS 875 Part 2)
 *   WL = Wind Load (IS 875 Part 3)
 *   EQ = Earthquake Load (IS 1893)
 *
 * @module load-combinations
 */

// ============================================
// TYPES
// ============================================

/** Standard load case types per Indian Standards */
export type LoadCaseType = 'DL' | 'LL' | 'WL' | 'EQ' | 'TL' | 'SL';

/** A single load case with its type and unfactored results */
export interface LoadCaseResult {
  /** Load case identifier */
  id: string;
  /** Load case name (e.g., "Dead Load", "Live Load Floor") */
  name: string;
  /** Classification per IS 875 */
  type: LoadCaseType;
  /** Unfactored member forces from analysis */
  memberForces: MemberForceEnvelope[];
  /** Unfactored nodal displacements */
  displacements?: Float64Array;
  /** Unfactored reactions */
  reactions?: Float64Array;
}

/** Validation result for load case inputs */
export interface LoadCaseValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Member force values at one end (or max across member) */
export interface MemberForceValues {
  axial: number;
  shear: number;
  moment: number;
  shearZ?: number;
  momentY?: number;
  torsion?: number;
}

/** Member forces for envelope computation */
export interface MemberForceEnvelope {
  id: string;
  start: MemberForceValues;
  end: MemberForceValues;
  maxDeflectionY?: number;
  maxDeflectionZ?: number;
}

/** A single load combination definition */
export interface LoadCombination {
  /** Combination name (e.g., "1.5DL + 1.5LL") */
  name: string;
  /** Code reference (e.g., "IS 456 Table 18, Comb 1") */
  codeRef: string;
  /** Limit state type */
  limitState: 'ULS' | 'SLS';
  /** Load factors: key = LoadCaseType, value = factor */
  factors: Partial<Record<LoadCaseType, number>>;
}

/** Envelope result for a single member across all combinations */
export interface MemberEnvelopeResult {
  id: string;
  /** Maximum values (worst tensile/positive) */
  max: MemberForceValues;
  /** Minimum values (worst compressive/negative) */
  min: MemberForceValues;
  /** Governing combination name for max moment */
  governingCombo: string;
  /** Maximum deflection across all combinations */
  maxDeflectionY?: number;
  maxDeflectionZ?: number;
}

/** Station-wise envelope across all load combinations (for section-wise design) */
export interface StationEnvelope {
  /** Station distance from start (m) */
  x: number;
  /** Station ratio (0.0 – 1.0) */
  x_ratio: number;
  /** Governing moment at this station (kN·m, signed: + sagging, − hogging) */
  mu_knm: number;
  /** Governing shear at this station (kN, absolute) */
  vu_kn: number;
  /** Name of the combo governing moment at this station */
  governing_combo_m: string;
  /** Name of the combo governing shear at this station */
  governing_combo_v: string;
}

/** Complete envelope result */
export interface EnvelopeResult {
  /** Per-member envelope */
  members: MemberEnvelopeResult[];
  /** All combination results (for detailed review) */
  combinationResults: {
    combo: LoadCombination;
    memberForces: MemberForceEnvelope[];
  }[];
  /** Summary statistics */
  summary: {
    maxAxialTension: { value: number; memberId: string; combo: string };
    maxAxialCompression: { value: number; memberId: string; combo: string };
    maxShear: { value: number; memberId: string; combo: string };
    maxMoment: { value: number; memberId: string; combo: string };
    maxDeflection: { value: number; memberId: string; combo: string };
  };
}

// ============================================
// IS 456:2000 LOAD COMBINATIONS (CONCRETE)
// ============================================

/**
 * IS 456:2000 Table 18 — Load Combinations for Limit State of Collapse
 *
 * Clause 36.4.1: The structure shall be designed for the following combinations:
 * 1. 1.5 DL + 1.5 LL
 * 2. 1.2 DL + 1.2 LL + 1.2 WL (or EQ)
 * 3. 1.5 DL + 1.5 WL (or EQ)
 * 4. 0.9 DL + 1.5 WL (or EQ)  — overturning check
 *
 * Clause 43.1: Limit State of Serviceability
 * 1. 1.0 DL + 1.0 LL
 * 2. 1.0 DL + 1.0 WL
 * 3. 1.0 DL + 0.8 LL + 0.8 WL
 */
export function getIS456Combinations(
  hasWind: boolean = false,
  hasEarthquake: boolean = false,
): LoadCombination[] {
  const combos: LoadCombination[] = [];

  // ULS Combinations
  combos.push({
    name: '1.5DL + 1.5LL',
    codeRef: 'IS 456 Cl. 36.4.1 (a)',
    limitState: 'ULS',
    factors: { DL: 1.5, LL: 1.5 },
  });

  if (hasWind) {
    combos.push(
      {
        name: '1.2DL + 1.2LL + 1.2WL',
        codeRef: 'IS 456 Cl. 36.4.1 (b)',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, WL: 1.2 },
      },
      {
        name: '1.2DL + 1.2LL - 1.2WL',
        codeRef: 'IS 456 Cl. 36.4.1 (b) reverse',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, WL: -1.2 },
      },
      {
        name: '1.5DL + 1.5WL',
        codeRef: 'IS 456 Cl. 36.4.1 (c)',
        limitState: 'ULS',
        factors: { DL: 1.5, WL: 1.5 },
      },
      {
        name: '0.9DL + 1.5WL',
        codeRef: 'IS 456 Cl. 36.4.1 (d)',
        limitState: 'ULS',
        factors: { DL: 0.9, WL: 1.5 },
      },
      {
        name: '0.9DL - 1.5WL',
        codeRef: 'IS 456 Cl. 36.4.1 (d) reverse',
        limitState: 'ULS',
        factors: { DL: 0.9, WL: -1.5 },
      },
    );
  }

  if (hasEarthquake) {
    combos.push(
      {
        name: '1.2DL + 1.2LL + 1.2EQ',
        codeRef: 'IS 456 Cl. 36.4.1 (b)',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, EQ: 1.2 },
      },
      {
        name: '1.2DL + 1.2LL - 1.2EQ',
        codeRef: 'IS 456 Cl. 36.4.1 (b) reverse',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, EQ: -1.2 },
      },
      {
        name: '1.5DL + 1.5EQ',
        codeRef: 'IS 456 Cl. 36.4.1 (c)',
        limitState: 'ULS',
        factors: { DL: 1.5, EQ: 1.5 },
      },
      {
        name: '0.9DL + 1.5EQ',
        codeRef: 'IS 456 Cl. 36.4.1 (d)',
        limitState: 'ULS',
        factors: { DL: 0.9, EQ: 1.5 },
      },
      {
        name: '0.9DL - 1.5EQ',
        codeRef: 'IS 456 Cl. 36.4.1 (d) reverse',
        limitState: 'ULS',
        factors: { DL: 0.9, EQ: -1.5 },
      },
    );
  }

  // SLS Combinations
  combos.push({
    name: '1.0DL + 1.0LL (SLS)',
    codeRef: 'IS 456 Cl. 43.1',
    limitState: 'SLS',
    factors: { DL: 1.0, LL: 1.0 },
  });

  if (hasWind) {
    combos.push(
      {
        name: '1.0DL + 1.0WL (SLS)',
        codeRef: 'IS 456 Cl. 43.1',
        limitState: 'SLS',
        factors: { DL: 1.0, WL: 1.0 },
      },
      {
        name: '1.0DL + 0.8LL + 0.8WL (SLS)',
        codeRef: 'IS 456 Cl. 43.1',
        limitState: 'SLS',
        factors: { DL: 1.0, LL: 0.8, WL: 0.8 },
      },
    );
  }

  return combos;
}

// ============================================
// IS 800:2007 LOAD COMBINATIONS (STEEL)
// ============================================

/**
 * IS 800:2007 Table 4 — Load Combinations for Limit State Design
 *
 * Clause 3.5.1: Combinations for strength (ULS)
 * Clause 3.5.2: Combinations for serviceability (SLS)
 *
 * Partial safety factors per Table 4:
 *   DL: γf = 1.5 (unfavorable) or 0.9 (favorable)
 *   LL: γf = 1.5 (leading) or 1.05 (accompanying)
 *   WL/EQ: γf = 1.5 (leading) or varies
 */
export function getIS800Combinations(
  hasWind: boolean = false,
  hasEarthquake: boolean = false,
): LoadCombination[] {
  const combos: LoadCombination[] = [];

  // ULS Combinations (IS 800 Table 4)
  combos.push({
    name: '1.5DL + 1.5LL',
    codeRef: 'IS 800 Table 4, Comb 1',
    limitState: 'ULS',
    factors: { DL: 1.5, LL: 1.5 },
  });

  if (hasWind) {
    combos.push(
      {
        name: '1.2DL + 1.2LL + 1.2WL',
        codeRef: 'IS 800 Table 4, Comb 2',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, WL: 1.2 },
      },
      {
        name: '1.5DL + 1.5WL',
        codeRef: 'IS 800 Table 4, Comb 3',
        limitState: 'ULS',
        factors: { DL: 1.5, WL: 1.5 },
      },
      {
        name: '0.9DL + 1.5WL',
        codeRef: 'IS 800 Table 4, Comb 4',
        limitState: 'ULS',
        factors: { DL: 0.9, WL: 1.5 },
      },
      {
        name: '1.2DL + 1.2LL - 1.2WL',
        codeRef: 'IS 800 Table 4, Comb 2 (reverse wind)',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, WL: -1.2 },
      },
    );
  }

  if (hasEarthquake) {
    combos.push(
      {
        name: '1.2DL + 1.2LL + 1.2EQ',
        codeRef: 'IS 800 Table 4, Comb 5',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, EQ: 1.2 },
      },
      {
        name: '1.5DL + 1.5EQ',
        codeRef: 'IS 800 Table 4, Comb 6',
        limitState: 'ULS',
        factors: { DL: 1.5, EQ: 1.5 },
      },
      {
        name: '0.9DL + 1.5EQ',
        codeRef: 'IS 800 Table 4, Comb 7',
        limitState: 'ULS',
        factors: { DL: 0.9, EQ: 1.5 },
      },
      {
        name: '1.2DL + 1.2LL - 1.2EQ',
        codeRef: 'IS 800 Table 4, Comb 5 (reverse EQ)',
        limitState: 'ULS',
        factors: { DL: 1.2, LL: 1.2, EQ: -1.2 },
      },
    );
  }

  // SLS Combinations (IS 800 Cl. 3.5.2)
  combos.push({
    name: '1.0DL + 1.0LL (SLS)',
    codeRef: 'IS 800 Cl. 3.5.2',
    limitState: 'SLS',
    factors: { DL: 1.0, LL: 1.0 },
  });

  if (hasWind) {
    combos.push({
      name: '1.0DL + 0.8LL + 0.8WL (SLS)',
      codeRef: 'IS 800 Cl. 3.5.2',
      limitState: 'SLS',
      factors: { DL: 1.0, LL: 0.8, WL: 0.8 },
    });
  }

  return combos;
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate load cases before applying combinations.
 *
 * Checks:
 *   1. At least one DL case exists (required by all codes)
 *   2. Load case types match valid LoadCaseType values
 *   3. Member force arrays are consistent across cases
 *   4. No NaN/Infinity values in forces
 *   5. WL and EQ are not combined simultaneously (IS 875 Part 5)
 */
export function validateLoadCases(
  loadCases: LoadCaseResult[],
  combos: LoadCombination[],
): LoadCaseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (loadCases.length === 0) {
    errors.push('No load cases provided.');
    return { valid: false, errors, warnings };
  }

  // Check for required DL case
  const hasDL = loadCases.some((lc) => lc.type === 'DL');
  if (!hasDL) {
    errors.push('No Dead Load (DL) case found. At least one DL case is required.');
  }

  // Check for valid types
  const validTypes: Set<string> = new Set(['DL', 'LL', 'WL', 'EQ', 'TL', 'SL']);
  for (const lc of loadCases) {
    if (!validTypes.has(lc.type)) {
      errors.push(`Load case "${lc.name}" (${lc.id}) has unknown type "${lc.type}".`);
    }
  }

  // Check member consistency
  const baseMemberIds = loadCases[0]?.memberForces.map((mf) => mf.id) ?? [];
  for (let i = 1; i < loadCases.length; i++) {
    const lc = loadCases[i]!;
    if (lc.memberForces.length !== baseMemberIds.length) {
      errors.push(
        `Load case "${lc.name}" has ${lc.memberForces.length} members ` +
        `but DL case has ${baseMemberIds.length}.`
      );
    }
  }

  // Check for NaN/Infinity
  for (const lc of loadCases) {
    for (const mf of lc.memberForces) {
      const vals = [
        mf.start.axial, mf.start.shear, mf.start.moment,
        mf.end.axial, mf.end.shear, mf.end.moment,
      ];
      for (const v of vals) {
        if (!isFinite(v)) {
          errors.push(`Load case "${lc.name}", member ${mf.id}: non-finite force value detected.`);
          break;
        }
      }
    }
  }

  // Check combo factor types match available load cases
  const availableTypes = new Set(loadCases.map((lc) => lc.type));
  for (const combo of combos) {
    const hasComboWL = (combo.factors.WL ?? 0) !== 0;
    const hasComboEQ = (combo.factors.EQ ?? 0) !== 0;
    if (hasComboWL && hasComboEQ) {
      errors.push(
        `Combination "${combo.name}" includes both WL and EQ. ` +
        'Per IS 1893 Cl. 6.3.2, wind and earthquake shall not act simultaneously.'
      );
    }

    for (const factorType of Object.keys(combo.factors)) {
      if (factorType !== 'DL' && !availableTypes.has(factorType as LoadCaseType)) {
        warnings.push(
          `Combination "${combo.name}" requires ${factorType} but no ${factorType} load case exists. ` +
          `This combination will have zero contribution for ${factorType}.`
        );
      }
    }
  }

  // WL + EQ simultaneous warning
  const hasWL = availableTypes.has('WL');
  const hasEQ = availableTypes.has('EQ');
  if (hasWL && hasEQ) {
    warnings.push(
      'Both WL and EQ load cases present. Per IS 875 Part 5 Cl. 6.3.2.2, ' +
      'wind and earthquake shall not be combined simultaneously.'
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================
// COMBINATION CALCULATOR
// ============================================

/**
 * Apply load factors to combine results from individual load cases.
 *
 * For each member, the factored force = Σ (γ_i × F_i)
 * where γ_i is the partial safety factor and F_i is the unfactored force.
 *
 * @param loadCases  Array of analyzed load case results
 * @param combo      Load combination definition with factors
 * @returns Array of factored member forces
 */
export function applyCombination(
  loadCases: LoadCaseResult[],
  combo: LoadCombination,
): MemberForceEnvelope[] {
  // Build lookup: loadCaseType → results[]
  const casesByType = new Map<LoadCaseType, LoadCaseResult[]>();
  for (const lc of loadCases) {
    const arr = casesByType.get(lc.type) ?? [];
    arr.push(lc);
    casesByType.set(lc.type, arr);
  }

  // Get all unique member IDs from first load case
  const firstCase = loadCases[0];
  if (!firstCase) return [];

  const memberIds = firstCase.memberForces.map((mf) => mf.id);

  return memberIds.map((memberId) => {
    const combined: MemberForceEnvelope = {
      id: memberId,
      start: { axial: 0, shear: 0, moment: 0, shearZ: 0, momentY: 0, torsion: 0 },
      end: { axial: 0, shear: 0, moment: 0, shearZ: 0, momentY: 0, torsion: 0 },
      maxDeflectionY: 0,
      maxDeflectionZ: 0,
    };

    for (const [lcType, factor] of Object.entries(combo.factors)) {
      if (factor === 0) continue;
      const cases = casesByType.get(lcType as LoadCaseType);
      if (!cases) continue;

      for (const lc of cases) {
        const mf = lc.memberForces.find((f) => f.id === memberId);
        if (!mf) continue;

        combined.start.axial += factor * (mf.start.axial ?? 0);
        combined.start.shear += factor * (mf.start.shear ?? 0);
        combined.start.moment += factor * (mf.start.moment ?? 0);
        combined.start.shearZ = (combined.start.shearZ ?? 0) + factor * (mf.start.shearZ ?? 0);
        combined.start.momentY = (combined.start.momentY ?? 0) + factor * (mf.start.momentY ?? 0);
        combined.start.torsion = (combined.start.torsion ?? 0) + factor * (mf.start.torsion ?? 0);

        combined.end.axial += factor * (mf.end.axial ?? 0);
        combined.end.shear += factor * (mf.end.shear ?? 0);
        combined.end.moment += factor * (mf.end.moment ?? 0);
        combined.end.shearZ = (combined.end.shearZ ?? 0) + factor * (mf.end.shearZ ?? 0);
        combined.end.momentY = (combined.end.momentY ?? 0) + factor * (mf.end.momentY ?? 0);
        combined.end.torsion = (combined.end.torsion ?? 0) + factor * (mf.end.torsion ?? 0);

        combined.maxDeflectionY = (combined.maxDeflectionY ?? 0) +
          Math.abs(factor) * (mf.maxDeflectionY ?? 0);
        combined.maxDeflectionZ = (combined.maxDeflectionZ ?? 0) +
          Math.abs(factor) * (mf.maxDeflectionZ ?? 0);
      }
    }

    return combined;
  });
}

// ============================================
// ENVELOPE COMPUTATION
// ============================================

/**
 * Compute force envelopes across all load combinations.
 *
 * For each member and each force component, finds the maximum and minimum
 * factored values across all combinations. This is the standard approach
 * for design — each component is designed for its worst-case factored value.
 *
 * @param loadCases  Array of analyzed load case results
 * @param combos     Array of load combination definitions
 * @returns EnvelopeResult with per-member max/min and governing combinations
 */
export function computeEnvelope(
  loadCases: LoadCaseResult[],
  combos: LoadCombination[],
): EnvelopeResult {
  const combinationResults: EnvelopeResult['combinationResults'] = [];

  // Apply all combinations
  for (const combo of combos) {
    const memberForces = applyCombination(loadCases, combo);
    combinationResults.push({ combo, memberForces });
  }

  // Build envelopes
  const firstResult = combinationResults[0]?.memberForces;
  if (!firstResult) {
    return {
      members: [],
      combinationResults,
      summary: {
        maxAxialTension: { value: 0, memberId: '', combo: '' },
        maxAxialCompression: { value: 0, memberId: '', combo: '' },
        maxShear: { value: 0, memberId: '', combo: '' },
        maxMoment: { value: 0, memberId: '', combo: '' },
        maxDeflection: { value: 0, memberId: '', combo: '' },
      },
    };
  }

  const memberEnvelopes: MemberEnvelopeResult[] = firstResult.map((mf) => ({
    id: mf.id,
    max: { axial: -Infinity, shear: -Infinity, moment: -Infinity,
           shearZ: -Infinity, momentY: -Infinity, torsion: -Infinity },
    min: { axial: Infinity, shear: Infinity, moment: Infinity,
           shearZ: Infinity, momentY: Infinity, torsion: Infinity },
    governingCombo: '',
    maxDeflectionY: 0,
    maxDeflectionZ: 0,
  }));

  // Summary trackers
  const summary = {
    maxAxialTension: { value: 0, memberId: '', combo: '' },
    maxAxialCompression: { value: 0, memberId: '', combo: '' },
    maxShear: { value: 0, memberId: '', combo: '' },
    maxMoment: { value: 0, memberId: '', combo: '' },
    maxDeflection: { value: 0, memberId: '', combo: '' },
  };

  for (const { combo, memberForces } of combinationResults) {
    for (let m = 0; m < memberForces.length; m++) {
      const mf = memberForces[m];
      const env = memberEnvelopes[m];
      if (!mf || !env) continue;

      // Update max/min per component, considering both start and end
      const updateEnv = (envV: MemberForceValues, fv: MemberForceValues) => {
        if (fv.axial > envV.axial) envV.axial = fv.axial;
        if (fv.shear > envV.shear) envV.shear = fv.shear;
        if (fv.moment > envV.moment) envV.moment = fv.moment;
        if ((fv.shearZ ?? 0) > (envV.shearZ ?? -Infinity)) envV.shearZ = fv.shearZ;
        if ((fv.momentY ?? 0) > (envV.momentY ?? -Infinity)) envV.momentY = fv.momentY;
        if ((fv.torsion ?? 0) > (envV.torsion ?? -Infinity)) envV.torsion = fv.torsion;
      };
      const updateMin = (envV: MemberForceValues, fv: MemberForceValues) => {
        if (fv.axial < envV.axial) envV.axial = fv.axial;
        if (fv.shear < envV.shear) envV.shear = fv.shear;
        if (fv.moment < envV.moment) envV.moment = fv.moment;
        if ((fv.shearZ ?? 0) < (envV.shearZ ?? Infinity)) envV.shearZ = fv.shearZ;
        if ((fv.momentY ?? 0) < (envV.momentY ?? Infinity)) envV.momentY = fv.momentY;
        if ((fv.torsion ?? 0) < (envV.torsion ?? Infinity)) envV.torsion = fv.torsion;
      };

      updateEnv(env.max, mf.start);
      updateEnv(env.max, mf.end);
      updateMin(env.min, mf.start);
      updateMin(env.min, mf.end);

      // Governing combo tracks max absolute moment
      const maxAbsMoment = Math.max(
        Math.abs(mf.start.moment),
        Math.abs(mf.end.moment),
      );
      const currentGovMoment = Math.max(
        Math.abs(env.max.moment),
        Math.abs(env.min.moment),
      );
      if (maxAbsMoment >= currentGovMoment) {
        env.governingCombo = combo.name;
      }

      // Deflection envelope
      const deflY = mf.maxDeflectionY ?? 0;
      const deflZ = mf.maxDeflectionZ ?? 0;
      if (deflY > (env.maxDeflectionY ?? 0)) env.maxDeflectionY = deflY;
      if (deflZ > (env.maxDeflectionZ ?? 0)) env.maxDeflectionZ = deflZ;

      // Update overall summary
      const maxAxStart = mf.start.axial;
      const maxAxEnd = mf.end.axial;
      if (maxAxStart > summary.maxAxialTension.value) {
        summary.maxAxialTension = { value: maxAxStart, memberId: mf.id, combo: combo.name };
      }
      if (maxAxEnd > summary.maxAxialTension.value) {
        summary.maxAxialTension = { value: maxAxEnd, memberId: mf.id, combo: combo.name };
      }
      if (maxAxStart < summary.maxAxialCompression.value) {
        summary.maxAxialCompression = { value: maxAxStart, memberId: mf.id, combo: combo.name };
      }
      if (maxAxEnd < summary.maxAxialCompression.value) {
        summary.maxAxialCompression = { value: maxAxEnd, memberId: mf.id, combo: combo.name };
      }

      const maxShear = Math.max(Math.abs(mf.start.shear), Math.abs(mf.end.shear));
      if (maxShear > summary.maxShear.value) {
        summary.maxShear = { value: maxShear, memberId: mf.id, combo: combo.name };
      }

      if (maxAbsMoment > summary.maxMoment.value) {
        summary.maxMoment = { value: maxAbsMoment, memberId: mf.id, combo: combo.name };
      }

      const maxDefl = Math.max(deflY, deflZ);
      if (maxDefl > summary.maxDeflection.value) {
        summary.maxDeflection = { value: maxDefl, memberId: mf.id, combo: combo.name };
      }
    }
  }

  return { members: memberEnvelopes, combinationResults, summary };
}
