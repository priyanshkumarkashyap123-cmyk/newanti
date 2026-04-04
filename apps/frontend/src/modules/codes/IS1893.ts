/**
 * ============================================================================
 * IS 1893:2016 (Part 1) - EARTHQUAKE RESISTANT DESIGN
 * ============================================================================
 * 
 * Complete implementation of IS 1893:2016 for Seismic Design
 * 
 * Includes:
 * - Seismic zone factors and soil classification
 * - Design spectrum calculations
 * - Base shear calculation (Equivalent Static Method)
 * - Vertical distribution of base shear
 * - Torsional provisions
 * - Modal analysis parameters
 * - Drift limits and deflection criteria
 * 
 * @version 1.0.0
 * @reference IS 1893:2016 (Part 1) - Criteria for Earthquake Resistant Design of Structures
 */

import {
  DesignCode,
  CalculationStep,
  DiagramData,
  DiagramType,
  createCalculationStep,
  roundTo,
} from '../core/CalculationEngine';

// ============================================================================
// CONSTANTS FROM IS 1893:2016
// ============================================================================

/**
 * Seismic Zone Factors per IS 1893:2016 Table 3
 */
export const IS1893_ZONE_FACTORS: Record<string, { Z: number; description: string }> = {
  II: { Z: 0.10, description: 'Low Seismic Zone' },
  III: { Z: 0.16, description: 'Moderate Seismic Zone' },
  IV: { Z: 0.24, description: 'Severe Seismic Zone' },
  V: { Z: 0.36, description: 'Very Severe Seismic Zone' },
};

/**
 * Importance Factors per IS 1893:2016 Table 8
 */
export const IS1893_IMPORTANCE_FACTORS: Record<string, { I: number; description: string }> = {
  critical: { I: 1.5, description: 'Critical & Lifeline structures (hospitals, fire stations)' },
  important: { I: 1.2, description: 'Important structures (schools, assembly halls)' },
  ordinary: { I: 1.0, description: 'Ordinary buildings' },
};

/**
 * Response Reduction Factors per IS 1893:2016 Table 9
 */
export const IS1893_RESPONSE_REDUCTION_FACTORS: Record<string, { R: number; description: string }> = {
  // RC Frame Systems
  OMRF: { R: 3.0, description: 'Ordinary Moment Resisting Frame (RC)' },
  SMRF: { R: 5.0, description: 'Special Moment Resisting Frame (RC)' },
  
  // RC Shear Wall Systems
  SW_ordinary: { R: 3.0, description: 'Ordinary Shear Wall' },
  SW_ductile: { R: 4.0, description: 'Ductile Shear Wall' },
  
  // Dual Systems
  dual_OMRF: { R: 4.0, description: 'Dual System with OMRF + Shear Wall' },
  dual_SMRF: { R: 5.0, description: 'Dual System with SMRF + Shear Wall' },
  
  // Steel Frames
  steel_OMRF: { R: 3.0, description: 'Steel Ordinary Moment Frame' },
  steel_SMRF: { R: 5.0, description: 'Steel Special Moment Frame' },
  steel_OCBF: { R: 3.5, description: 'Steel Ordinary Concentric Braced Frame' },
  steel_SCBF: { R: 4.5, description: 'Steel Special Concentric Braced Frame' },
  steel_EBF: { R: 5.0, description: 'Steel Eccentrically Braced Frame' },
  
  // Masonry
  URM: { R: 1.5, description: 'Unreinforced Masonry (not permitted in Zone III-V)' },
  RM: { R: 3.0, description: 'Reinforced Masonry' },
};

/**
 * Soil Types per IS 1893:2016 Table 1
 */
export const IS1893_SOIL_TYPES: Record<string, { description: string; SPT_N: string }> = {
  I: { description: 'Rock or hard soil', SPT_N: 'N > 30' },
  II: { description: 'Medium/stiff soil', SPT_N: '10 ≤ N ≤ 30' },
  III: { description: 'Soft soil', SPT_N: 'N < 10' },
};

/**
 * Design spectrum coefficients per IS 1893:2016 Clause 6.4.2
 * Sa/g for different soil types and time periods
 */
export function getSaOverG(T: number, soilType: 'I' | 'II' | 'III'): number {
  // For 5% damping
  
  if (soilType === 'I') {
    // Type I (Rock/Hard Soil)
    if (T >= 0 && T <= 0.10) return 1 + 15 * T;
    if (T > 0.10 && T <= 0.40) return 2.50;
    if (T > 0.40 && T <= 4.00) return 1.00 / T;
    return 0.25;
  } else if (soilType === 'II') {
    // Type II (Medium Soil)
    if (T >= 0 && T <= 0.10) return 1 + 15 * T;
    if (T > 0.10 && T <= 0.55) return 2.50;
    if (T > 0.55 && T <= 4.00) return 1.36 / T;
    return 0.34;
  } else {
    // Type III (Soft Soil)
    if (T >= 0 && T <= 0.10) return 1 + 15 * T;
    if (T > 0.10 && T <= 0.67) return 2.50;
    if (T > 0.67 && T <= 4.00) return 1.67 / T;
    return 0.42;
  }
}

/**
 * Multiplying factors for damping other than 5% (Table 4)
 */
export const IS1893_DAMPING_FACTORS: Record<number, number> = {
  0: 3.20,
  2: 1.40,
  5: 1.00,
  7: 0.90,
  10: 0.80,
  15: 0.70,
  20: 0.60,
  25: 0.55,
  30: 0.50,
};

/**
 * Approximate fundamental time period formulas (Clause 7.6.2)
 */
export interface TimePeriodParams {
  h: number;          // Height of building, m
  d?: number;         // Base dimension in direction of shaking, m
  type: 'RC_frame' | 'steel_frame' | 'RC_SW' | 'masonry' | 'other';
}

export function getApproximateTimePeriod(params: TimePeriodParams): { T: number; formula: string } {
  const { h, d, type } = params;
  
  let T: number;
  let formula: string;
  
  switch (type) {
    case 'RC_frame':
      // RC MRF: Ta = 0.075 × h^0.75
      T = 0.075 * Math.pow(h, 0.75);
      formula = 'Ta = 0.075 × h^0.75';
      break;
      
    case 'steel_frame':
      // Steel MRF: Ta = 0.085 × h^0.75
      T = 0.085 * Math.pow(h, 0.75);
      formula = 'Ta = 0.085 × h^0.75';
      break;
      
    case 'RC_SW':
      if (!d) throw new Error('Base dimension d required for shear wall buildings');
      // RC Shear Wall: Ta = 0.09 × h / √d
      T = 0.09 * h / Math.sqrt(d);
      formula = 'Ta = 0.09 × h / √d';
      break;
      
    case 'masonry':
      if (!d) throw new Error('Base dimension d required for masonry buildings');
      // Masonry: Ta = 0.09 × h / √d
      T = 0.09 * h / Math.sqrt(d);
      formula = 'Ta = 0.09 × h / √d';
      break;
      
    default:
      // All other buildings: Ta = 0.09 × h / √d
      if (!d) throw new Error('Base dimension d required');
      T = 0.09 * h / Math.sqrt(d);
      formula = 'Ta = 0.09 × h / √d';
  }
  
  return { T: roundTo(T, 3), formula };
}

/**
 * Maximum allowable time period (Clause 7.6.2)
 * For modal analysis, actual T should not exceed 1.5 × Ta
 */
export function getMaxAllowableTimePeriod(Ta: number, analysisMethod: 'equivalent_static' | 'modal'): number {
  return analysisMethod === 'equivalent_static' ? Ta : 1.5 * Ta;
}

// ============================================================================
// SEISMIC WEIGHT CALCULATION
// ============================================================================

/**
 * Live load factor for seismic weight calculation (Table 10)
 */
export function getLiveLoadFactor(LL_intensity: number): number {
  // LL_intensity in kN/m²
  if (LL_intensity <= 3.0) return 0.25;
  if (LL_intensity > 3.0) return 0.50;
  return 0.25;
}

/**
 * Calculate seismic weight of a floor
 */
export interface FloorWeight {
  DL: number;        // Dead load, kN
  LL: number;        // Live load, kN
  LL_intensity: number; // Live load intensity, kN/m²
}

export function getSeismicWeight(floors: FloorWeight[]): { Wi: number[]; W: number } {
  const Wi: number[] = [];
  
  for (const floor of floors) {
    const llFactor = getLiveLoadFactor(floor.LL_intensity);
    const seismicWeight = floor.DL + llFactor * floor.LL;
    Wi.push(roundTo(seismicWeight, 2));
  }
  
  const W = Wi.reduce((sum, w) => sum + w, 0);
  
  return { Wi, W: roundTo(W, 2) };
}

// ============================================================================
// BASE SHEAR CALCULATION (Equivalent Static Method)
// ============================================================================

export interface SeismicInputIS1893 {
  // Building parameters
  height: number;              // Total height, m
  baseDimension?: number;      // Base dimension in direction of EQ, m
  buildingType: TimePeriodParams['type'];
  
  // Seismic parameters
  zone: keyof typeof IS1893_ZONE_FACTORS;
  importance: keyof typeof IS1893_IMPORTANCE_FACTORS;
  soilType: 'I' | 'II' | 'III';
  responseReductionSystem: keyof typeof IS1893_RESPONSE_REDUCTION_FACTORS;
  
  // Floor data
  floors: Array<{
    level: number;           // Floor level (1, 2, 3...)
    height: number;          // Height from base, m
    Wi: number;              // Seismic weight of floor, kN
  }>;
  
  // Options
  analysisMethod?: 'equivalent_static' | 'modal';
  dampingRatio?: number;      // Default 5%
  showDetailedCalc?: boolean;
}

export interface SeismicResultIS1893 {
  // Seismic coefficients
  Z: number;           // Zone factor
  I: number;           // Importance factor
  R: number;           // Response reduction factor
  Sa_g: number;        // Spectral acceleration coefficient
  Ah: number;          // Design horizontal seismic coefficient
  
  // Time period
  T: number;           // Fundamental time period, s
  timePeriodFormula: string;
  
  // Base shear
  W: number;           // Total seismic weight, kN
  VB: number;          // Design base shear, kN
  
  // Storey forces
  storeyForces: Array<{
    level: number;
    height: number;     // m
    Wi: number;         // kN
    Qi: number;         // Storey shear, kN
    Vi: number;         // Cumulative shear, kN
  }>;
  
  // Detailed calculations
  calculations: CalculationStep[];
  diagrams: DiagramData[];
}

/**
 * Calculate design seismic base shear per IS 1893:2016
 */
export function calculateBaseShearIS1893(input: SeismicInputIS1893): SeismicResultIS1893 {
  const calculations: CalculationStep[] = [];
  const diagrams: DiagramData[] = [];
  let stepNo = 1;
  
  const {
    height,
    baseDimension,
    buildingType,
    zone,
    importance,
    soilType,
    responseReductionSystem,
    floors,
    analysisMethod = 'equivalent_static',
    dampingRatio = 5,
  } = input;
  
  // ============================================================================
  // STEP 1: GET SEISMIC PARAMETERS
  // ============================================================================
  
  const Z = IS1893_ZONE_FACTORS[zone].Z;
  const I = IS1893_IMPORTANCE_FACTORS[importance].I;
  const R = IS1893_RESPONSE_REDUCTION_FACTORS[responseReductionSystem].R;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Seismic Zone and Design Parameters',
    description: 'Extract zone factor, importance factor, and response reduction factor',
    formula: 'Z, I, R from IS 1893:2016 Tables',
    values: {
      'Zone': { value: zone, description: IS1893_ZONE_FACTORS[zone].description },
      'Z': { value: Z, description: 'Zone Factor (Table 3)' },
      'I': { value: I, description: `${IS1893_IMPORTANCE_FACTORS[importance].description} (Table 8)` },
      'R': { value: R, description: `${IS1893_RESPONSE_REDUCTION_FACTORS[responseReductionSystem].description} (Table 9)` },
    },
    result: { value: 'Parameters Extracted', description: 'Proceed to time period calculation' },
    code: DesignCode.IS_1893,
    clause: '6.4.1',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 2: CALCULATE TIME PERIOD
  // ============================================================================
  
  const { T, formula: timePeriodFormula } = getApproximateTimePeriod({
    h: height,
    d: baseDimension,
    type: buildingType,
  });
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Approximate Fundamental Time Period',
    description: 'Calculate fundamental time period based on building type',
    formula: timePeriodFormula,
    values: {
      'h': { value: height, unit: 'm', description: 'Building height' },
      ...(baseDimension ? { 'd': { value: baseDimension, unit: 'm', description: 'Base dimension' } } : {}),
      'Building Type': { value: buildingType.replace('_', ' ') },
    },
    result: { value: T, unit: 's', description: 'Fundamental time period' },
    code: DesignCode.IS_1893,
    clause: '7.6.2',
    status: 'OK',
    notes: analysisMethod === 'modal' 
      ? [`For modal analysis, actual T should not exceed 1.5 × Ta = ${roundTo(1.5 * T, 3)} s`]
      : undefined,
  }));
  
  // ============================================================================
  // STEP 3: CALCULATE SPECTRAL ACCELERATION
  // ============================================================================
  
  const Sa_g = getSaOverG(T, soilType);
  
  // Damping correction if not 5%
  const dampingFactor = IS1893_DAMPING_FACTORS[dampingRatio] || 1.0;
  const Sa_g_corrected = Sa_g * dampingFactor;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Spectral Acceleration Coefficient',
    description: 'Determine Sa/g from response spectrum for the time period',
    formula: 'Sa/g from Clause 6.4.2 based on soil type and T',
    values: {
      'T': { value: T, unit: 's' },
      'Soil Type': { value: soilType, description: IS1893_SOIL_TYPES[soilType].description },
      'Sa/g (5% damping)': { value: roundTo(Sa_g, 3) },
      ...(dampingRatio !== 5 ? { 'Damping': { value: `${dampingRatio}%` } } : {}),
      ...(dampingRatio !== 5 ? { 'Damping Factor': { value: dampingFactor } } : {}),
    },
    result: { 
      value: roundTo(Sa_g_corrected, 3), 
      description: dampingRatio !== 5 ? 'Corrected Sa/g' : 'Spectral acceleration coefficient' 
    },
    code: DesignCode.IS_1893,
    clause: '6.4.2',
    figure: 'Fig 2',
    status: 'OK',
    diagram: {
      type: DiagramType.LOADING_DIAGRAM,
      title: 'Design Response Spectrum',
      data: {
        soilType,
        T,
        Sa_g: Sa_g_corrected,
        spectrumPoints: generateSpectrumPoints(soilType),
      },
    },
  }));
  
  // ============================================================================
  // STEP 4: CALCULATE DESIGN SEISMIC COEFFICIENT
  // ============================================================================
  
  // Ah = (Z × I × Sa/g) / (2 × R)
  const Ah = (Z * I * Sa_g_corrected) / (2 * R);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Horizontal Seismic Coefficient',
    description: 'Calculate design seismic coefficient Ah',
    formula: 'Ah = (Z × I × Sa/g) / (2 × R)',
    values: {
      'Z': { value: Z },
      'I': { value: I },
      'Sa/g': { value: roundTo(Sa_g_corrected, 3) },
      'R': { value: R },
    },
    result: { value: roundTo(Ah, 4), description: 'Design seismic coefficient' },
    code: DesignCode.IS_1893,
    clause: '6.4.2',
    status: 'OK',
    notes: [
      `Ah shall not be less than (Z × I) / (2 × R) × 0.5 = ${roundTo((Z * I) / (2 * R) * 0.5, 4)}`,
    ],
  }));
  
  // Check minimum Ah
  const Ah_min = (Z * I) / (2 * R) * 0.5;
  const Ah_final = Math.max(Ah, Ah_min);
  
  // ============================================================================
  // STEP 5: CALCULATE SEISMIC WEIGHT
  // ============================================================================
  
  const W = floors.reduce((sum, floor) => sum + floor.Wi, 0);
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Total Seismic Weight',
    description: 'Sum of seismic weights of all floors',
    formula: 'W = Σ Wi',
    values: {
      'Floor weights': { 
        value: floors.map(f => `W${f.level} = ${roundTo(f.Wi, 0)} kN`).join(', ') 
      },
    },
    result: { value: roundTo(W, 0), unit: 'kN', description: 'Total seismic weight' },
    code: DesignCode.IS_1893,
    clause: '7.4.2',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 6: CALCULATE BASE SHEAR
  // ============================================================================
  
  const VB = Ah_final * W;
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Design Base Shear',
    description: 'Calculate design seismic base shear',
    formula: 'VB = Ah × W',
    values: {
      'Ah': { value: roundTo(Ah_final, 4) },
      'W': { value: roundTo(W, 0), unit: 'kN' },
    },
    result: { value: roundTo(VB, 2), unit: 'kN', description: 'Design base shear' },
    code: DesignCode.IS_1893,
    clause: '7.6.1',
    status: 'OK',
  }));
  
  // ============================================================================
  // STEP 7: VERTICAL DISTRIBUTION OF BASE SHEAR
  // ============================================================================
  
  // Qi = VB × (Wi × hi²) / Σ(Wj × hj²)
  const sumWiHi2 = floors.reduce((sum, floor) => sum + floor.Wi * floor.height ** 2, 0);
  
  const storeyForces = floors.map((floor, index, arr) => {
    const Qi = VB * (floor.Wi * floor.height ** 2) / sumWiHi2;
    
    // Cumulative shear from top
    const Vi = arr
      .slice(index)
      .reduce((sum, f) => sum + VB * (f.Wi * f.height ** 2) / sumWiHi2, 0);
    
    return {
      level: floor.level,
      height: floor.height,
      Wi: floor.Wi,
      Qi: roundTo(Qi, 2),
      Vi: roundTo(Vi, 2),
    };
  });
  
  calculations.push(createCalculationStep({
    step: stepNo++,
    title: 'Vertical Distribution of Base Shear',
    description: 'Distribute base shear to floor levels',
    formula: 'Qi = VB × (Wi × hi²) / Σ(Wj × hj²)',
    values: {
      'VB': { value: roundTo(VB, 2), unit: 'kN' },
      'Σ(Wi×hi²)': { value: roundTo(sumWiHi2, 0), unit: 'kN-m²' },
    },
    result: { 
      value: storeyForces.map(f => `Q${f.level} = ${f.Qi} kN`).join(', '),
      description: 'Storey shear forces' 
    },
    code: DesignCode.IS_1893,
    clause: '7.6.3',
    status: 'OK',
    diagram: {
      type: DiagramType.LOADING_DIAGRAM,
      title: 'Vertical Distribution of Seismic Forces',
      data: {
        floors: storeyForces,
        VB,
      },
    },
  }));
  
  // Add shear force diagram
  diagrams.push({
    type: DiagramType.SHEAR_DIAGRAM,
    title: 'Storey Shear Distribution',
    data: {
      floors: storeyForces,
      VB,
    },
  });
  
  return {
    Z,
    I,
    R,
    Sa_g: Sa_g_corrected,
    Ah: Ah_final,
    T,
    timePeriodFormula,
    W,
    VB,
    storeyForces,
    calculations,
    diagrams,
  };
}

// ============================================================================
// DRIFT AND DEFLECTION LIMITS (Clause 7.11)
// ============================================================================

/**
 * Storey drift limits per IS 1893:2016 Clause 7.11.1
 */
export const IS1893_DRIFT_LIMITS: Record<string, number> = {
  // All buildings
  general: 0.004,  // 0.004 × storey height
};

/**
 * Calculate storey drift and check against limits
 */
export interface DriftCheckInput {
  storeyHeight: number;      // m
  elasticDrift: number;      // mm (from analysis)
  R: number;                 // Response reduction factor
  I: number;                 // Importance factor
}

export function checkStoreyDrift(input: DriftCheckInput): {
  inelasticDrift: number;
  driftRatio: number;
  allowableDrift: number;
  isOk: boolean;
} {
  const { storeyHeight, elasticDrift, R, I } = input;
  
  // Inelastic drift = R × elastic drift / I
  const inelasticDrift = R * elasticDrift / I;
  
  // Drift ratio
  const driftRatio = inelasticDrift / (storeyHeight * 1000);
  
  // Allowable drift
  const allowableDrift = IS1893_DRIFT_LIMITS.general * storeyHeight * 1000;
  
  return {
    inelasticDrift: roundTo(inelasticDrift, 2),
    driftRatio: roundTo(driftRatio, 5),
    allowableDrift: roundTo(allowableDrift, 2),
    isOk: inelasticDrift <= allowableDrift,
  };
}

// ============================================================================
// TORSIONAL PROVISIONS (Clause 7.8)
// ============================================================================

/**
 * Design eccentricity for torsion per IS 1893:2016 Clause 7.8.2
 */
export function getDesignEccentricity(
  esi: number,      // Static eccentricity, m
  bi: number        // Floor plan dimension perpendicular to direction of motion, m
): { edi1: number; edi2: number } {
  // edi = 1.5 × esi + 0.05 × bi (to be used when causes increase in shear)
  // or esi - 0.05 × bi (to be used when causes decrease in shear)
  
  const edi1 = 1.5 * esi + 0.05 * bi;
  const edi2 = esi - 0.05 * bi;
  
  return {
    edi1: roundTo(edi1, 3),
    edi2: roundTo(Math.abs(edi2), 3),
  };
}

/**
 * Check for torsional irregularity
 */
export function checkTorsionalIrregularity(
  deltaMax: number,   // Maximum storey drift at one end
  deltaAvg: number    // Average storey drift
): { ratio: number; isIrregular: boolean; isSeverelyIrregular: boolean } {
  const ratio = deltaMax / deltaAvg;
  
  return {
    ratio: roundTo(ratio, 3),
    isIrregular: ratio > 1.2,
    isSeverelyIrregular: ratio > 1.4,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate design spectrum points for diagram
 */
function generateSpectrumPoints(soilType: 'I' | 'II' | 'III'): { T: number; Sa_g: number }[] {
  const points: { T: number; Sa_g: number }[] = [];
  
  // Generate points at key locations
  const periods = [0, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.55, 0.6, 0.67, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0];
  
  for (const T of periods) {
    points.push({ T, Sa_g: roundTo(getSaOverG(T, soilType), 3) });
  }
  
  return points;
}

/**
 * Combined horizontal seismic forces (100% + 30% combination)
 * Per IS 1893:2016 Clause 6.3.4
 */
export function getCombinedHorizontalForces(
  Vx: number,       // Base shear in X direction, kN
  Vy: number        // Base shear in Y direction, kN
): { EQx_plus: number; EQx_minus: number; EQy_plus: number; EQy_minus: number } {
  // Combination 1: ±(ELx ± 0.3 × ELy)
  // Combination 2: ±(0.3 × ELx ± ELy)
  
  return {
    EQx_plus: roundTo(Vx + 0.3 * Vy, 2),
    EQx_minus: roundTo(Vx - 0.3 * Vy, 2),
    EQy_plus: roundTo(0.3 * Vx + Vy, 2),
    EQy_minus: roundTo(0.3 * Vx - Vy, 2),
  };
}

/**
 * Vertical seismic coefficient (Clause 6.4.6)
 */
export function getVerticalSeismicCoefficient(
  Ah: number,       // Horizontal seismic coefficient
  zone: keyof typeof IS1893_ZONE_FACTORS
): number {
  // Av = (2/3) × Ah for zone IV and V
  // Not required for zone II and III
  
  if (zone === 'IV' || zone === 'V') {
    return roundTo((2 / 3) * Ah, 4);
  }
  
  return 0;
}

// Export types
export type { CalculationStep, DiagramData };
