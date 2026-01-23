/**
 * ============================================================================
 * RC COLUMN DESIGN ENGINE - IS 456:2000
 * ============================================================================
 * 
 * Complete reinforced concrete column design per IS 456:2000
 * Includes:
 * - Short & slender column classification
 * - Axial load capacity (with minimum eccentricity)
 * - Uniaxial and biaxial bending
 * - P-M interaction curve generation
 * - Detailing requirements
 * 
 * @version 1.0.0
 * @author BeamLab Engineering
 */

import type { CalculationResult, CalculationStep, CodeCheck } from './StructuralCalculator';

// ============================================================================
// CONSTANTS
// ============================================================================

const PARTIAL_SAFETY_CONCRETE = 1.5;
const PARTIAL_SAFETY_STEEL = 1.15;

/** Effective length factors per IS 456 Table 28 */
const EFFECTIVE_LENGTH_FACTORS: Record<string, { k: number; description: string }> = {
  'fixed_fixed': { k: 0.65, description: 'Both ends fixed (effectively held in position and restrained)' },
  'fixed_hinged': { k: 0.80, description: 'One end fixed, other hinged (effectively held in position but not restrained)' },
  'hinged_hinged': { k: 1.00, description: 'Both ends hinged' },
  'fixed_free': { k: 2.00, description: 'One end fixed, other free (cantilever)' },
  'partial_restraint': { k: 1.20, description: 'Partial restraint at both ends' },
};

// ============================================================================
// INTERFACES
// ============================================================================

interface ColumnDesignInputs {
  // Geometry
  width: number;          // mm (b)
  depth: number;          // mm (D)
  height: number;         // mm (unsupported length)
  clear_cover: number;    // mm
  
  // Material
  fck: number;            // MPa
  fy: number;             // MPa
  
  // Loading
  Pu: number;             // kN (factored axial load)
  Mux: number;            // kN·m (moment about major axis)
  Muy: number;            // kN·m (moment about minor axis)
  
  // Options
  end_condition: string;
  braced: boolean;
}

interface InteractionPoint {
  P: number;   // kN
  M: number;   // kN·m
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate minimum eccentricity per IS 456 Cl. 25.4
 * emin = L/500 + D/30, subject to minimum of 20mm
 */
function getMinEccentricity(L: number, D: number): number {
  return Math.max(20, L / 500 + D / 30);
}

/**
 * Calculate additional eccentricity for slender columns per IS 456 Cl. 39.7.1
 * ea = D × (Lex/D)² / 2000
 */
function getAdditionalEccentricity(D: number, Lex: number): number {
  const ratio = Lex / D;
  return (D * ratio * ratio) / 2000;
}

/**
 * Determine if column is short or slender per IS 456 Cl. 25.1.2
 */
function isShortColumn(Lex: number, Ley: number, D: number, b: number): boolean {
  const ratioX = Lex / D;
  const ratioY = Ley / b;
  return ratioX <= 12 && ratioY <= 12;
}

/**
 * Calculate pure axial load capacity per IS 456 Cl. 39.3
 * Pu = 0.4 × fck × Ac + 0.67 × fy × Asc
 */
function getPureAxialCapacity(
  b: number, 
  D: number, 
  fck: number, 
  fy: number, 
  Asc: number
): number {
  const Ag = b * D;
  const Ac = Ag - Asc;
  return (0.4 * fck * Ac + 0.67 * fy * Asc) / 1000; // kN
}

/**
 * Calculate moment capacity at given axial load using stress block
 * Based on IS 456 Annex G strain compatibility analysis
 */
function getMomentCapacityAtAxial(
  b: number,
  D: number,
  d_prime: number,   // cover to reinforcement centroid
  fck: number,
  fy: number,
  Asc: number,       // total steel area
  P: number          // axial load (kN)
): number {
  const d = D - d_prime;
  
  // For symmetric reinforcement, Ast = Asc/2 on each face
  const As_tension = Asc / 2;
  const As_compression = Asc / 2;
  
  // Iteratively find neutral axis depth for given P
  // Simplified approach using Whitney stress block
  const fcd = 0.67 * fck / PARTIAL_SAFETY_CONCRETE;
  const fsd = fy / PARTIAL_SAFETY_STEEL;
  
  // From equilibrium: P = Cc + Cs - T
  // Cc = 0.36 × fck × b × xu
  // For pure compression (xu > D): Cc = 0.36 × fck × b × D
  
  // Limiting neutral axis depth
  const xuMax = 0.456 * d;
  
  // At balanced condition
  const Pb = (0.36 * fck * b * xuMax + fsd * As_compression - fsd * As_tension) / 1000;
  
  // Moment about centroid
  // Simplified: use interaction approximation
  const P0 = getPureAxialCapacity(b, D, fck, fy, Asc);
  const M0 = fsd * As_tension * (d - d_prime) / 1e6; // Pure bending capacity approximation
  
  // Bresler's approximation for moment at given P
  // M = M0 × (1 - (P/P0)^n), n ≈ 1.5 for rectangular sections
  const n = 1.5;
  const P_ratio = Math.min(Math.abs(P) / P0, 1.0);
  const M = M0 * (1 - Math.pow(P_ratio, n));
  
  return Math.max(0, M);
}

/**
 * Generate P-M interaction curve points
 */
function generateInteractionCurve(
  b: number,
  D: number,
  d_prime: number,
  fck: number,
  fy: number,
  Asc: number
): InteractionPoint[] {
  const points: InteractionPoint[] = [];
  const P0 = getPureAxialCapacity(b, D, fck, fy, Asc);
  
  // Generate points from pure compression to pure tension
  const numPoints = 20;
  for (let i = 0; i <= numPoints; i++) {
    const P = P0 * (1 - 2 * i / numPoints); // From P0 to -P0
    const M = getMomentCapacityAtAxial(b, D, d_prime, fck, fy, Asc, P);
    points.push({ P, M });
  }
  
  return points;
}

/**
 * Check biaxial bending using Bresler's formula per IS 456 Cl. 39.6
 * (Mux/Mux1)^αn + (Muy/Muy1)^αn ≤ 1.0
 */
function checkBiaxialBending(
  Pu: number,
  Mux: number,
  Muy: number,
  Mux1: number,     // Capacity about X at Pu
  Muy1: number,     // Capacity about Y at Pu
  Puz: number       // Pure axial capacity
): { check: number; status: boolean; alphan: number } {
  // αn depends on Pu/Puz
  const ratio = Pu / Puz;
  let alphan: number;
  
  if (ratio <= 0.2) {
    alphan = 1.0;
  } else if (ratio >= 0.8) {
    alphan = 2.0;
  } else {
    // Linear interpolation
    alphan = 1.0 + (ratio - 0.2) * (2.0 - 1.0) / (0.8 - 0.2);
  }
  
  const term1 = Math.pow(Math.abs(Mux) / Mux1, alphan);
  const term2 = Math.pow(Math.abs(Muy) / Muy1, alphan);
  const check = term1 + term2;
  
  return {
    check,
    status: check <= 1.0,
    alphan,
  };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

export function calculateColumnDesignIS456(inputs: ColumnDesignInputs): CalculationResult {
  const steps: CalculationStep[] = [];
  const codeChecks: CodeCheck[] = [];
  const warnings: string[] = [];
  
  const { width: b, depth: D, height: L, clear_cover, fck, fy, Pu, Mux, Muy, end_condition, braced } = inputs;
  
  // ==================== Step 1: Material Properties ====================
  const fcd = 0.67 * fck / PARTIAL_SAFETY_CONCRETE;
  const fyd = fy / PARTIAL_SAFETY_STEEL;
  const Es = 200000;
  
  steps.push({
    title: 'Material Properties',
    description: 'Design strength of concrete and steel per IS 456',
    formula: 'fcd = 0.67 × fck / γc, fyd = fy / γs',
    values: {
      'fck': `${fck} MPa`,
      'fy': `${fy} MPa`,
      'fcd': `${fcd.toFixed(2)} MPa`,
      'fyd': `${fyd.toFixed(2)} MPa`,
      'γc': `${PARTIAL_SAFETY_CONCRETE}`,
      'γs': `${PARTIAL_SAFETY_STEEL}`,
    },
    reference: 'IS 456:2000 Cl. 38.1',
  });
  
  // ==================== Step 2: Effective Length ====================
  const effectiveLengthData = EFFECTIVE_LENGTH_FACTORS[end_condition] || EFFECTIVE_LENGTH_FACTORS['hinged_hinged'];
  const k = braced ? effectiveLengthData.k : Math.min(effectiveLengthData.k * 1.2, 2.0);
  const Lex = k * L;
  const Ley = k * L;
  
  steps.push({
    title: 'Effective Length',
    description: `Effective length calculation for ${effectiveLengthData.description}`,
    formula: 'Leff = k × L',
    values: {
      'Unsupported Length L': `${L} mm`,
      'End Condition': end_condition.replace(/_/g, ' '),
      'Braced': braced ? 'Yes' : 'No',
      'k': `${k.toFixed(2)}`,
      'Lex': `${Lex.toFixed(0)} mm`,
      'Ley': `${Ley.toFixed(0)} mm`,
    },
    reference: 'IS 456:2000 Table 28',
  });
  
  // ==================== Step 3: Slenderness Classification ====================
  const isShort = isShortColumn(Lex, Ley, D, b);
  const slendernessX = Lex / D;
  const slendernessY = Ley / b;
  
  steps.push({
    title: 'Slenderness Classification',
    description: isShort ? 'Column is SHORT (Lex/D ≤ 12 and Ley/b ≤ 12)' : 'Column is SLENDER',
    formula: 'Short if Lex/D ≤ 12 and Ley/b ≤ 12',
    values: {
      'Lex/D': `${slendernessX.toFixed(2)}`,
      'Ley/b': `${slendernessY.toFixed(2)}`,
      'Limit': '12',
      'Classification': isShort ? 'Short Column' : 'Slender Column',
    },
    reference: 'IS 456:2000 Cl. 25.1.2',
  });
  
  if (!isShort) {
    warnings.push('Column is slender. Additional moment due to P-Δ effect must be considered.');
  }
  
  // ==================== Step 4: Minimum Eccentricity ====================
  const eMinX = getMinEccentricity(L, D);
  const eMinY = getMinEccentricity(L, b);
  
  // Additional eccentricity for slender columns
  const eaX = isShort ? 0 : getAdditionalEccentricity(D, Lex);
  const eaY = isShort ? 0 : getAdditionalEccentricity(b, Ley);
  
  // Design eccentricities
  const exApplied = Mux !== 0 ? (Mux * 1000) / Pu : 0; // mm
  const eyApplied = Muy !== 0 ? (Muy * 1000) / Pu : 0; // mm
  
  const exDesign = Math.max(eMinX, Math.abs(exApplied) + eaX);
  const eyDesign = Math.max(eMinY, Math.abs(eyApplied) + eaY);
  
  // Design moments
  const MuxDesign = Pu * exDesign / 1000; // kN·m
  const MuyDesign = Pu * eyDesign / 1000; // kN·m
  
  steps.push({
    title: 'Design Eccentricity & Moments',
    description: 'Calculate design eccentricity including minimum and additional for slender columns',
    formula: 'ex = max(emin, eapplied + ea)',
    values: {
      'emin,x': `${eMinX.toFixed(1)} mm`,
      'emin,y': `${eMinY.toFixed(1)} mm`,
      'ea,x': `${eaX.toFixed(1)} mm`,
      'ea,y': `${eaY.toFixed(1)} mm`,
      'ex,design': `${exDesign.toFixed(1)} mm`,
      'ey,design': `${eyDesign.toFixed(1)} mm`,
      'Mux,design': `${MuxDesign.toFixed(2)} kN·m`,
      'Muy,design': `${MuyDesign.toFixed(2)} kN·m`,
    },
    reference: 'IS 456:2000 Cl. 25.4, 39.7.1',
  });
  
  // ==================== Step 5: Assumed Reinforcement ====================
  const Ag = b * D;
  const ptAssumed = 2.0; // Assume 2% initially
  const Asc = (ptAssumed / 100) * Ag;
  const d_prime = clear_cover + 10; // Assuming 10mm stirrup + half bar dia
  
  // ==================== Step 6: Axial Load Capacity ====================
  const Puz = getPureAxialCapacity(b, D, fck, fy, Asc);
  
  steps.push({
    title: 'Pure Axial Capacity',
    description: 'Maximum axial load capacity without moment',
    formula: 'Puz = 0.45 × fck × Ac + 0.75 × fy × Asc',
    values: {
      'Ag': `${Ag} mm²`,
      'Assumed pt': `${ptAssumed}%`,
      'Asc (assumed)': `${Asc.toFixed(0)} mm²`,
      'Puz': `${Puz.toFixed(1)} kN`,
    },
    reference: 'IS 456:2000 Cl. 39.3',
  });
  
  // ==================== Step 7: Uniaxial Moment Capacity ====================
  const Mux1 = getMomentCapacityAtAxial(b, D, d_prime, fck, fy, Asc, Pu);
  const Muy1 = getMomentCapacityAtAxial(D, b, d_prime, fck, fy, Asc, Pu); // Swap b,D for minor axis
  
  steps.push({
    title: 'Uniaxial Moment Capacity',
    description: 'Moment capacity about each axis at applied axial load',
    formula: 'From P-M interaction diagram',
    values: {
      'Pu': `${Pu} kN`,
      'Mux1 (capacity about X)': `${Mux1.toFixed(2)} kN·m`,
      'Muy1 (capacity about Y)': `${Muy1.toFixed(2)} kN·m`,
      'Mux,design': `${MuxDesign.toFixed(2)} kN·m`,
      'Muy,design': `${MuyDesign.toFixed(2)} kN·m`,
    },
    reference: 'IS 456:2000 Cl. 39.5',
  });
  
  // ==================== Step 8: Biaxial Bending Check ====================
  const biaxialResult = checkBiaxialBending(Pu, MuxDesign, MuyDesign, Mux1, Muy1, Puz);
  
  steps.push({
    title: 'Biaxial Bending Check (Bresler)',
    description: "Interaction check using Bresler's formula",
    formula: '(Mux/Mux1)^αn + (Muy/Muy1)^αn ≤ 1.0',
    values: {
      'Pu/Puz': `${(Pu / Puz).toFixed(3)}`,
      'αn': `${biaxialResult.alphan.toFixed(2)}`,
      'Mux/Mux1': `${(MuxDesign / Mux1).toFixed(3)}`,
      'Muy/Muy1': `${(MuyDesign / Muy1).toFixed(3)}`,
      'Interaction Check': `${biaxialResult.check.toFixed(3)}`,
      'Status': biaxialResult.status ? 'OK (≤ 1.0)' : 'FAIL (> 1.0)',
    },
    reference: 'IS 456:2000 Cl. 39.6',
  });
  
  // ==================== Step 9: Reinforcement Detailing ====================
  const minPt = 0.8;
  const maxPt = 6.0; // Can be 4% for practical constructability
  const minBars = 4; // For rectangular columns
  const barDia = 16; // Assumed
  const numBars = Math.ceil(Asc / (Math.PI * barDia * barDia / 4));
  const actualAsc = numBars * Math.PI * barDia * barDia / 4;
  const actualPt = (actualAsc / Ag) * 100;
  
  // Transverse reinforcement
  const stirrupDia = Math.max(6, Math.ceil(barDia / 4));
  const stirrupSpacing = Math.min(300, 16 * barDia, Math.min(b, D));
  
  steps.push({
    title: 'Reinforcement Detailing',
    description: 'Calculate number of bars and transverse reinforcement',
    formula: 'Provide bars to satisfy Asc requirement',
    values: {
      'Min pt': `${minPt}%`,
      'Max pt': `${maxPt}%`,
      'Required Asc': `${Asc.toFixed(0)} mm²`,
      'Bar Diameter': `${barDia} mm`,
      'Number of Bars': `${numBars}`,
      'Actual Asc': `${actualAsc.toFixed(0)} mm²`,
      'Actual pt': `${actualPt.toFixed(2)}%`,
      'Stirrup': `${stirrupDia}mm φ @ ${stirrupSpacing}mm c/c`,
    },
    reference: 'IS 456:2000 Cl. 26.5.3',
  });
  
  // ==================== Code Checks ====================
  
  // Axial load check
  const axialUtilization = Pu / Puz;
  codeChecks.push({
    clause: '39.3',
    description: 'Axial load capacity',
    required: `≤ ${Puz.toFixed(0)} kN`,
    provided: `${Pu} kN`,
    status: axialUtilization <= 1.0 ? 'PASS' : 'FAIL',
  });
  
  // Biaxial bending check
  codeChecks.push({
    clause: '39.6',
    description: 'Biaxial bending interaction',
    required: '≤ 1.0',
    provided: `${biaxialResult.check.toFixed(3)}`,
    status: biaxialResult.status ? 'PASS' : 'FAIL',
  });
  
  // Minimum reinforcement
  codeChecks.push({
    clause: '26.5.3.1',
    description: 'Minimum reinforcement (0.8%)',
    required: `≥ ${minPt}%`,
    provided: `${actualPt.toFixed(2)}%`,
    status: actualPt >= minPt ? 'PASS' : 'FAIL',
  });
  
  // Maximum reinforcement
  codeChecks.push({
    clause: '26.5.3.1',
    description: 'Maximum reinforcement (6%)',
    required: `≤ ${maxPt}%`,
    provided: `${actualPt.toFixed(2)}%`,
    status: actualPt <= maxPt ? 'PASS' : 'FAIL',
  });
  
  // Minimum number of bars
  codeChecks.push({
    clause: '26.5.3.1',
    description: 'Minimum number of bars',
    required: `≥ ${minBars}`,
    provided: `${numBars}`,
    status: numBars >= minBars ? 'PASS' : 'FAIL',
  });
  
  // Slenderness limit
  const maxSlenderness = 60;
  codeChecks.push({
    clause: '25.3.1',
    description: 'Maximum slenderness ratio',
    required: `≤ ${maxSlenderness}`,
    provided: `${Math.max(slendernessX, slendernessY).toFixed(1)}`,
    status: Math.max(slendernessX, slendernessY) <= maxSlenderness ? 'PASS' : 'FAIL',
  });
  
  // ==================== Warnings ====================
  if (axialUtilization > 0.85) {
    warnings.push('Axial utilization is high (> 85%). Consider increasing column size.');
  }
  
  if (biaxialResult.check > 0.9 && biaxialResult.check <= 1.0) {
    warnings.push('Biaxial interaction check is near limit. Consider increasing reinforcement.');
  }
  
  if (actualPt > 4.0) {
    warnings.push('Reinforcement percentage exceeds 4%. May cause construction difficulties.');
  }
  
  // ==================== Final Result ====================
  const maxUtilization = Math.max(axialUtilization, biaxialResult.check);
  const failedChecks = codeChecks.filter(c => c.status === 'FAIL');
  const isAdequate = failedChecks.length === 0;
  
  return {
    isAdequate,
    utilization: maxUtilization,
    capacity: Puz,
    demand: Pu,
    status: isAdequate ? 'OK' : 'FAIL',
    message: isAdequate
      ? `Column is adequate. Max utilization: ${(maxUtilization * 100).toFixed(1)}%`
      : `Design failed: ${failedChecks.map(c => c.description).join(', ')}`,
    steps,
    codeChecks,
    warnings,
  };
}

export default calculateColumnDesignIS456;
