/**
 * ============================================================================
 * SEISMIC ANALYSIS EXTENSIONS - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds missing seismic features for industry parity:
 * - Accidental torsion
 * - Vertical earthquake component
 * - P-Delta stability analysis
 * - Irregularity detection
 * - Diaphragm flexibility considerations
 * - Enhanced modal combination (CQC/SRSS)
 * 
 * @version 1.0.0
 */

// ============================================================================
// ACCIDENTAL TORSION
// ============================================================================

export interface AccidentalTorsionResult {
  story: number;
  eccentricityX: number;    // 5% of plan dimension
  eccentricityY: number;
  torsionalMomentX: number; // kNm
  torsionalMomentY: number;
  amplificationFactor: number;  // Ax per ASCE 7 Eq. 12.8-14
}

export function calculateAccidentalTorsion(
  storyForces: { story: number; Fx: number; Fy: number; height: number }[],
  planDimensions: { Lx: number; Ly: number },
  centerOfMass: { x: number; y: number }[],
  centerOfRigidity: { x: number; y: number }[],
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'IS1893'
): AccidentalTorsionResult[] {
  const results: AccidentalTorsionResult[] = [];
  
  // Accidental eccentricity = 5% of plan dimension (all codes)
  const eax = 0.05 * planDimensions.Lx;
  const eay = 0.05 * planDimensions.Ly;

  for (let i = 0; i < storyForces.length; i++) {
    const force = storyForces[i];
    
    // Inherent eccentricity
    const inherentEx = Math.abs((centerOfMass[i]?.x || 0) - (centerOfRigidity[i]?.x || 0));
    const inherentEy = Math.abs((centerOfMass[i]?.y || 0) - (centerOfRigidity[i]?.y || 0));
    
    // Total design eccentricity (add accidental to inherent)
    const totalEx = inherentEx + eax;
    const totalEy = inherentEy + eay;
    
    // Torsional moment
    const Mtx = force.Fy * totalEx;
    const Mty = force.Fx * totalEy;
    
    // Amplification factor Ax (ASCE 7 Eq. 12.8-14)
    // Ax = (δmax / 1.2 * δavg)² ≤ 3.0
    // Simplified: use 1.0 unless torsional irregularity exists
    let Ax = 1.0;
    if (inherentEx > 0.1 * planDimensions.Lx || inherentEy > 0.1 * planDimensions.Ly) {
      Ax = Math.min(1.5, 3.0); // Conservative amplification for irregular
    }

    results.push({
      story: force.story,
      eccentricityX: totalEx,
      eccentricityY: totalEy,
      torsionalMomentX: Mtx * Ax,
      torsionalMomentY: Mty * Ax,
      amplificationFactor: Ax,
    });
  }

  return results;
}

// ============================================================================
// VERTICAL EARTHQUAKE COMPONENT
// ============================================================================

export interface VerticalSeismicResult {
  Av: number;           // Vertical seismic coefficient
  Fv: number;           // Vertical force (kN)
  appliedTo: string;    // Where to apply
  clause: string;
}

export function calculateVerticalSeismic(
  seismicWeight: number,  // kN
  SDS: number,            // Design spectral acceleration (g)
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'ASCE7'
): VerticalSeismicResult {
  let Av: number;
  let clause: string;

  switch (code) {
    case 'ASCE7':
      // ASCE 7-22 Section 12.4.2.2
      // Ev = ±0.2 SDS D
      Av = 0.2 * SDS;
      clause = 'ASCE 7-22 Eq. 12.4-4';
      break;
    
    case 'IS1893':
      // IS 1893:2016 Clause 6.4.6
      // Av = (2/3) * Ah for vertical acceleration
      Av = (2 / 3) * SDS * 0.4; // Simplified
      clause = 'IS 1893:2016 Cl. 6.4.6';
      break;
    
    case 'EN1998':
      // EN 1998-1 Clause 4.3.3.5.2
      // avg = 0.9 * ag * S (for Type 1 spectrum)
      Av = 0.9 * SDS * 0.4;
      clause = 'EN 1998-1 Cl. 4.3.3.5.2';
      break;
    
    default:
      Av = 0.2 * SDS;
      clause = 'Default (0.2 SDS)';
  }

  return {
    Av,
    Fv: Av * seismicWeight,
    appliedTo: 'Horizontal cantilevers, prestressed elements, and where required by code',
    clause,
  };
}

// ============================================================================
// P-DELTA STABILITY ANALYSIS
// ============================================================================

export interface PDeltaResult {
  story: number;
  theta: number;          // Stability coefficient
  thetaMax: number;       // Maximum allowed
  amplificationFactor: number;  // 1 / (1 - theta)
  status: 'pass' | 'fail' | 'warning';
  requiresSecondOrder: boolean;
}

export function calculatePDeltaEffects(
  storyData: {
    story: number;
    Px: number;     // Total gravity load above (kN)
    Vx: number;     // Story shear (kN)
    delta: number;  // Story drift (mm)
    hsx: number;    // Story height (mm)
    Cd: number;     // Deflection amplification factor
  }[],
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'ASCE7'
): PDeltaResult[] {
  const results: PDeltaResult[] = [];

  for (const story of storyData) {
    // Stability coefficient θ = (Px * Δ * Ie) / (Vx * hsx * Cd)
    // Per ASCE 7-22 Eq. 12.8-16
    const theta = (story.Px * story.delta) / (story.Vx * story.hsx * story.Cd);
    
    // Maximum allowed (ASCE 7 Eq. 12.8-17)
    // θmax = 0.5 / (β * Cd) ≤ 0.25, where β ≈ 1.0
    const thetaMax = Math.min(0.5 / story.Cd, 0.25);
    
    // P-Delta amplification factor
    const amplification = theta < 1 ? 1 / (1 - theta) : Infinity;
    
    // Status determination
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    let requiresSecondOrder = false;
    
    if (theta > thetaMax) {
      status = 'fail';
      requiresSecondOrder = true;
    } else if (theta > 0.10) {
      status = 'warning';
      requiresSecondOrder = true;
    }

    results.push({
      story: story.story,
      theta: Math.round(theta * 10000) / 10000,
      thetaMax,
      amplificationFactor: Math.round(amplification * 1000) / 1000,
      status,
      requiresSecondOrder,
    });
  }

  return results;
}

// ============================================================================
// IRREGULARITY DETECTION
// ============================================================================

export type IrregularityType = 
  | 'torsional' 
  | 'extreme_torsional'
  | 'reentrant_corner'
  | 'diaphragm_discontinuity'
  | 'out_of_plane_offset'
  | 'nonparallel_system'
  | 'stiffness_soft_story'
  | 'stiffness_extreme_soft'
  | 'weight_mass'
  | 'vertical_geometry'
  | 'in_plane_discontinuity'
  | 'weak_story';

export interface IrregularityCheck {
  type: IrregularityType;
  detected: boolean;
  ratio: number;
  limit: number;
  clause: string;
  consequence: string;
}

export function detectIrregularities(
  buildingData: {
    planDimensions: { Lx: number; Ly: number };
    reentrantDepths?: { x: number; y: number };  // Depth of reentrant corners
    storyStiffness: number[];     // kN/m per story
    storyMass: number[];          // tonnes per story
    storyHeight: number[];        // m per story
    floorAreas: number[];         // m² per story
    maxDriftAtCorner?: number[];  // mm
    avgDrift?: number[];          // mm
  },
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'ASCE7'
): IrregularityCheck[] {
  const checks: IrregularityCheck[] = [];
  const n = buildingData.storyStiffness.length;

  // ----- HORIZONTAL IRREGULARITIES -----

  // 1a. Torsional Irregularity (ASCE 7 Table 12.3-1, Type 1a)
  if (buildingData.maxDriftAtCorner && buildingData.avgDrift) {
    for (let i = 0; i < n; i++) {
      const ratio = buildingData.maxDriftAtCorner[i] / (buildingData.avgDrift[i] || 1);
      if (ratio > 1.2) {
        checks.push({
          type: ratio > 1.4 ? 'extreme_torsional' : 'torsional',
          detected: true,
          ratio,
          limit: ratio > 1.4 ? 1.4 : 1.2,
          clause: 'ASCE 7 Table 12.3-1 Type 1a/1b',
          consequence: ratio > 1.4 
            ? 'Extreme torsional irregularity - requires 3D dynamic analysis'
            : 'Torsional irregularity - requires accidental torsion amplification',
        });
        break;
      }
    }
  }

  // 2. Reentrant Corner (ASCE 7 Table 12.3-1, Type 2)
  if (buildingData.reentrantDepths) {
    const ratioX = buildingData.reentrantDepths.x / buildingData.planDimensions.Lx;
    const ratioY = buildingData.reentrantDepths.y / buildingData.planDimensions.Ly;
    if (ratioX > 0.15 || ratioY > 0.15) {
      checks.push({
        type: 'reentrant_corner',
        detected: true,
        ratio: Math.max(ratioX, ratioY),
        limit: 0.15,
        clause: 'ASCE 7 Table 12.3-1 Type 2',
        consequence: 'Reentrant corner irregularity - requires collector elements and diaphragm design',
      });
    }
  }

  // ----- VERTICAL IRREGULARITIES -----

  // 1a. Stiffness - Soft Story (ASCE 7 Table 12.3-2, Type 1a)
  for (let i = 0; i < n - 1; i++) {
    const ratio = buildingData.storyStiffness[i] / buildingData.storyStiffness[i + 1];
    if (ratio < 0.70) {
      checks.push({
        type: ratio < 0.60 ? 'stiffness_extreme_soft' : 'stiffness_soft_story',
        detected: true,
        ratio,
        limit: ratio < 0.60 ? 0.60 : 0.70,
        clause: 'ASCE 7 Table 12.3-2 Type 1a/1b',
        consequence: ratio < 0.60
          ? 'Extreme soft story - prohibited in SDC D-F'
          : 'Soft story irregularity - ELF prohibited in SDC D-F',
      });
      break;
    }
  }

  // 2. Weight (Mass) Irregularity (Type 2)
  for (let i = 0; i < n - 1; i++) {
    const ratioAbove = buildingData.storyMass[i] / buildingData.storyMass[i + 1];
    const ratioBelow = i > 0 ? buildingData.storyMass[i] / buildingData.storyMass[i - 1] : 1;
    if (ratioAbove > 1.5 || ratioBelow > 1.5) {
      checks.push({
        type: 'weight_mass',
        detected: true,
        ratio: Math.max(ratioAbove, ratioBelow),
        limit: 1.5,
        clause: 'ASCE 7 Table 12.3-2 Type 2',
        consequence: 'Mass irregularity - affects vertical force distribution',
      });
      break;
    }
  }

  // 3. Vertical Geometric Irregularity (Type 3)
  for (let i = 0; i < n - 1; i++) {
    const widthRatio = buildingData.floorAreas[i] / buildingData.floorAreas[i + 1];
    if (widthRatio > 1.3) {
      checks.push({
        type: 'vertical_geometry',
        detected: true,
        ratio: widthRatio,
        limit: 1.3,
        clause: 'ASCE 7 Table 12.3-2 Type 3',
        consequence: 'Vertical geometric irregularity - requires setback analysis',
      });
      break;
    }
  }

  // 5a. Weak Story (Type 5a)
  for (let i = 0; i < n - 1; i++) {
    // Simplified: strength proportional to stiffness
    const strengthRatio = buildingData.storyStiffness[i] / buildingData.storyStiffness[i + 1];
    if (strengthRatio < 0.80) {
      checks.push({
        type: 'weak_story',
        detected: true,
        ratio: strengthRatio,
        limit: 0.80,
        clause: 'ASCE 7 Table 12.3-2 Type 5a',
        consequence: strengthRatio < 0.65
          ? 'Extreme weak story - prohibited in SDC D-F'
          : 'Weak story irregularity - may require strengthening',
      });
      break;
    }
  }

  return checks;
}

// ============================================================================
// MODAL COMBINATION METHODS
// ============================================================================

export interface ModalCombinationResult {
  method: 'SRSS' | 'CQC';
  combinedValue: number;
  modeContributions: { mode: number; value: number; weight: number }[];
}

/**
 * Square Root of Sum of Squares (SRSS) combination
 */
export function combineSRSS(modalValues: number[]): ModalCombinationResult {
  const sumOfSquares = modalValues.reduce((sum, v) => sum + v * v, 0);
  const combined = Math.sqrt(sumOfSquares);
  
  return {
    method: 'SRSS',
    combinedValue: combined,
    modeContributions: modalValues.map((v, i) => ({
      mode: i + 1,
      value: v,
      weight: (v * v) / sumOfSquares,
    })),
  };
}

/**
 * Complete Quadratic Combination (CQC) for closely-spaced modes
 * Uses correlation coefficient ρij
 */
export function combineCQC(
  modalValues: number[],
  periods: number[],
  damping: number = 0.05
): ModalCombinationResult {
  const n = modalValues.length;
  let sum = 0;
  const contributions: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Correlation coefficient (Der Kiureghian, 1981)
      const betaij = periods[j] / periods[i];
      const rho = (8 * damping * damping * Math.pow(betaij, 1.5)) /
        ((1 - betaij * betaij) * (1 - betaij * betaij) + 
         4 * damping * damping * betaij * (1 + betaij) * (1 + betaij));
      
      sum += modalValues[i] * modalValues[j] * (i === j ? 1 : rho);
      contributions[i] += modalValues[i] * modalValues[j] * (i === j ? 1 : rho);
    }
  }

  const combined = Math.sqrt(sum);

  return {
    method: 'CQC',
    combinedValue: combined,
    modeContributions: modalValues.map((v, i) => ({
      mode: i + 1,
      value: v,
      weight: contributions[i] / sum,
    })),
  };
}

// ============================================================================
// DIAPHRAGM FLEXIBILITY
// ============================================================================

export interface DiaphragmFlexibilityResult {
  classification: 'rigid' | 'semi-rigid' | 'flexible';
  ratio: number;          // δdiaphragm / δstory
  clause: string;
  analysisImplication: string;
}

export function checkDiaphragmFlexibility(
  diaphragmDeflection: number,  // mm - max in-plane deflection of diaphragm
  storyDrift: number,           // mm - average story drift
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'ASCE7'
): DiaphragmFlexibilityResult {
  const ratio = diaphragmDeflection / storyDrift;
  
  let classification: 'rigid' | 'semi-rigid' | 'flexible';
  let analysisImplication: string;

  if (ratio <= 0.5) {
    classification = 'rigid';
    analysisImplication = 'Forces distributed based on relative stiffness';
  } else if (ratio <= 2.0) {
    classification = 'semi-rigid';
    analysisImplication = 'Requires explicit diaphragm modeling in analysis';
  } else {
    classification = 'flexible';
    analysisImplication = 'Forces distributed based on tributary area; envelope required';
  }

  return {
    classification,
    ratio: Math.round(ratio * 100) / 100,
    clause: code === 'ASCE7' ? 'ASCE 7-22 Cl. 12.3.1' : 'IS 1893:2016 Cl. 7.3.2',
    analysisImplication,
  };
}

// ============================================================================
// R / Ω0 / Cd COHERENCE CHECK
// ============================================================================

export interface SystemCoherenceResult {
  R: number;
  Omega0: number;
  Cd: number;
  isValid: boolean;
  systemName: string;
  heightLimit: number | null;  // meters, null = no limit
  sdcRestrictions: string[];
}

const ASCE7_SEISMIC_SYSTEMS: Record<string, SystemCoherenceResult> = {
  'moment_frame_special': {
    R: 8, Omega0: 3, Cd: 5.5, isValid: true,
    systemName: 'Special Moment Frame',
    heightLimit: null,
    sdcRestrictions: [],
  },
  'moment_frame_intermediate': {
    R: 5, Omega0: 3, Cd: 4.5, isValid: true,
    systemName: 'Intermediate Moment Frame',
    heightLimit: null,
    sdcRestrictions: ['Not permitted in SDC D, E, F for buildings > 10m'],
  },
  'moment_frame_ordinary': {
    R: 3.5, Omega0: 3, Cd: 3, isValid: true,
    systemName: 'Ordinary Moment Frame',
    heightLimit: null,
    sdcRestrictions: ['Not permitted in SDC D, E, F'],
  },
  'braced_frame_special': {
    R: 6, Omega0: 2, Cd: 5, isValid: true,
    systemName: 'Special Concentrically Braced Frame',
    heightLimit: 48,
    sdcRestrictions: [],
  },
  'braced_frame_ordinary': {
    R: 3.25, Omega0: 2, Cd: 3.25, isValid: true,
    systemName: 'Ordinary Concentrically Braced Frame',
    heightLimit: 10,
    sdcRestrictions: ['Limited height in SDC D, E, F'],
  },
  'shear_wall_special': {
    R: 5, Omega0: 2.5, Cd: 5, isValid: true,
    systemName: 'Special Reinforced Concrete Shear Wall',
    heightLimit: null,
    sdcRestrictions: [],
  },
  'shear_wall_ordinary': {
    R: 4, Omega0: 2.5, Cd: 4, isValid: true,
    systemName: 'Ordinary Reinforced Concrete Shear Wall',
    heightLimit: null,
    sdcRestrictions: ['Not permitted in SDC D, E, F'],
  },
  'dual_system': {
    R: 7, Omega0: 2.5, Cd: 5.5, isValid: true,
    systemName: 'Special Moment Frame + Special Shear Wall',
    heightLimit: null,
    sdcRestrictions: [],
  },
  'flat_slab': {
    R: 3, Omega0: 2.5, Cd: 2.5, isValid: true,
    systemName: 'Flat Slab System',
    heightLimit: 10,
    sdcRestrictions: ['Limited to SDC A, B only'],
  },
};

export function getSystemCoherence(
  system: string,
  code: 'IS1893' | 'ASCE7' | 'EN1998' = 'ASCE7'
): SystemCoherenceResult {
  const systemData = ASCE7_SEISMIC_SYSTEMS[system];
  if (systemData) {
    return systemData;
  }
  
  // Default fallback
  return {
    R: 3, Omega0: 2.5, Cd: 3, isValid: false,
    systemName: 'Unknown System',
    heightLimit: 10,
    sdcRestrictions: ['System not recognized - verify manually'],
  };
}
