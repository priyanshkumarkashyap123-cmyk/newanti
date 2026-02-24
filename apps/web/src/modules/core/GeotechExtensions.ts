/**
 * ============================================================================
 * GEOTECHNICAL EXTENSIONS - PHASE 1 ENHANCEMENTS
 * ============================================================================
 * 
 * Adds missing geotech features:
 * - Mononobe-Okabe seismic earth pressure
 * - Negative skin friction
 * - Settlement checks (shallow foundations)
 * - Liquefaction triggering (placeholder)
 * 
 * @version 1.0.0
 */

// ============================================================================
// SEISMIC EARTH PRESSURE (MONONOBE-OKABE)
// ============================================================================

export interface SeismicEarthPressureResult {
  Kae: number;               // Active seismic coefficient
  Kpe: number;               // Passive seismic coefficient
  Pae: number;               // Active seismic thrust (kN/m)
  Ppe: number;               // Passive seismic thrust (kN/m)
  dynamicIncrement: number;  // ΔPae = Pae - Pa (kN/m)
  pointOfApplication: number; // Height from base (m)
  clause: string;
}

export function calculateMononobeOkabe(
  wall: {
    height: number;          // m
    backfillSlope: number;   // degrees (β)
    wallInclination: number; // degrees from vertical (α), positive = leaning into backfill
  },
  soil: {
    phi: number;             // degrees - friction angle
    gamma: number;           // kN/m³ - unit weight
    delta: number;           // degrees - wall friction angle
  },
  seismic: {
    kh: number;              // Horizontal seismic coefficient
    kv: number;              // Vertical seismic coefficient (upward positive)
  }
): SeismicEarthPressureResult {
  const { height: H, backfillSlope: beta, wallInclination: alpha } = wall;
  const { phi, gamma, delta } = soil;
  const { kh, kv } = seismic;

  // Convert to radians
  const phiRad = (phi * Math.PI) / 180;
  const betaRad = (beta * Math.PI) / 180;
  const alphaRad = (alpha * Math.PI) / 180;
  const deltaRad = (delta * Math.PI) / 180;

  // Seismic angle
  const theta = Math.atan(kh / (1 - kv));

  // Active seismic coefficient (Mononobe-Okabe)
  const cos2PhiMinusTheta = Math.pow(Math.cos(phiRad - theta - alphaRad), 2);
  const cosThetaCos2Alpha = Math.cos(theta) * Math.pow(Math.cos(alphaRad), 2);
  const sinPhiDelta = Math.sin(phiRad + deltaRad);
  const sinPhiBeta = Math.sin(phiRad - theta - betaRad);
  const cosAlphaDelta = Math.cos(alphaRad + deltaRad + theta);
  const cosAlphaBeta = Math.cos(alphaRad - betaRad);

  const sqrtTerm = Math.sqrt((sinPhiDelta * sinPhiBeta) / (cosAlphaDelta * cosAlphaBeta));
  const denominator = cosThetaCos2Alpha * cosAlphaDelta * Math.pow(1 + sqrtTerm, 2);

  const Kae = cos2PhiMinusTheta / denominator;

  // Passive coefficient (simplified - conservative)
  const Kpe = 2.0; // Conservative for seismic

  // Static active coefficient for comparison
  const Ka_static = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);

  // Total seismic thrust
  const Pae = 0.5 * Kae * gamma * H * H * (1 - kv);
  const Pa_static = 0.5 * Ka_static * gamma * H * H;
  const deltaP = Pae - Pa_static;

  // Passive thrust
  const Ppe = 0.5 * Kpe * gamma * H * H * (1 - kv);

  // Point of application (IS 1893 recommendation)
  // Static component at H/3, dynamic increment at 2H/3
  const pointOfApplication = (Pa_static * H / 3 + deltaP * 2 * H / 3) / Pae;

  return {
    Kae: Math.round(Kae * 1000) / 1000,
    Kpe: Math.round(Kpe * 1000) / 1000,
    Pae: Math.round(Pae * 100) / 100,
    Ppe: Math.round(Ppe * 100) / 100,
    dynamicIncrement: Math.round(deltaP * 100) / 100,
    pointOfApplication: Math.round(pointOfApplication * 100) / 100,
    clause: 'IS 1893:2016 Cl. 8.1, Mononobe-Okabe (1929)',
  };
}

// ============================================================================
// NEGATIVE SKIN FRICTION (DOWNDRAG)
// ============================================================================

export interface NegativeSkinFrictionResult {
  Qnf: number;               // Downdrag force (kN)
  neutralPlaneDepth: number; // Depth of neutral plane (m)
  affectedLength: number;    // Length of pile in settling zone (m)
  reducedCapacity: number;   // Pile capacity after downdrag (kN)
  clause: string;
}

export function calculateNegativeSkinFriction(
  pile: {
    diameter: number;        // m
    length: number;          // m
  },
  settlingLayer: {
    thickness: number;       // m
    gamma: number;           // kN/m³
    settlement: number;      // mm - relative settlement triggering NSF
  },
  soil: {
    phi: number;             // degrees - for cohesionless
    cu?: number;             // kPa - for cohesive
    beta?: number;           // β factor for cohesionless (default 0.25-0.30)
    alpha?: number;          // α factor for cohesive (default 0.3-0.5)
  },
  pileCapacity: number       // kN - original capacity
): NegativeSkinFrictionResult {
  const { diameter: D, length: L } = pile;
  const { thickness, gamma, settlement } = settlingLayer;
  const { phi, cu, beta = 0.25, alpha = 0.3 } = soil;

  // Affected length (where NSF develops)
  const affectedLength = Math.min(thickness, L * 0.7); // Typically upper 70%

  // Neutral plane (simplified - at bottom of settling layer)
  const neutralPlaneDepth = affectedLength;

  // Calculate downdrag force
  let Qnf: number;
  const perimeter = Math.PI * D;

  if (cu && cu > 0) {
    // Cohesive soil: Qnf = α * cu * perimeter * Ln
    Qnf = alpha * cu * perimeter * affectedLength;
  } else {
    // Cohesionless: Qnf = β * σ'v_avg * perimeter * Ln
    const sigma_v_avg = gamma * (affectedLength / 2); // Average effective stress
    Qnf = beta * sigma_v_avg * perimeter * affectedLength;
  }

  // Reduced capacity
  const reducedCapacity = Math.max(0, pileCapacity - Qnf);

  return {
    Qnf: Math.round(Qnf * 10) / 10,
    neutralPlaneDepth: Math.round(neutralPlaneDepth * 100) / 100,
    affectedLength: Math.round(affectedLength * 100) / 100,
    reducedCapacity: Math.round(reducedCapacity * 10) / 10,
    clause: 'IS 2911 Part 1 Sec 2, Fellenius (1972)',
  };
}

// ============================================================================
// SETTLEMENT CHECKS (SHALLOW FOUNDATIONS)
// ============================================================================

export interface SettlementResult {
  immediateSettlement: number;   // mm
  consolidationSettlement: number; // mm
  secondarySettlement: number;   // mm (creep)
  totalSettlement: number;       // mm
  allowableSettlement: number;   // mm
  differentialLimit: number;     // L/ratio
  status: 'PASS' | 'FAIL';
  clause: string;
}

export function calculateSettlement(
  foundation: {
    width: number;           // m (B)
    length: number;          // m (L)
    depth: number;           // m (Df)
    pressure: number;        // kPa (net bearing pressure)
  },
  soil: {
    type: 'sand' | 'clay' | 'mixed';
    E: number;               // kPa - modulus of elasticity
    Cc?: number;             // Compression index (clay)
    Cr?: number;             // Recompression index (clay)
    e0?: number;             // Initial void ratio (clay)
    Cv?: number;             // Coefficient of consolidation (m²/year)
    gamma: number;           // kN/m³
  },
  layerThickness: number,    // m - thickness of compressible layer
  buildingType: 'isolated' | 'frame' | 'mat' = 'frame'
): SettlementResult {
  const { width: B, length: L, depth: Df, pressure: q } = foundation;
  const { type, E, Cc = 0.3, Cr = 0.05, e0 = 0.8, gamma } = soil;

  // Immediate (elastic) settlement
  // Using Boussinesq influence factor
  const m = L / B;
  const If = 0.88; // Influence factor for L/B ≈ 1-2
  const mu = 0.3;  // Poisson's ratio
  const immediateSettlement = (q * B * (1 - mu * mu) * If / E) * 1000; // mm

  // Consolidation settlement (clay)
  let consolidationSettlement = 0;
  if (type === 'clay' && Cc) {
    // Using 1D consolidation
    const sigma0 = gamma * (Df + layerThickness / 2); // Initial stress at mid-layer
    const deltaSigma = q; // Stress increase (simplified)
    
    if (sigma0 > 0) {
      const Sc = (Cc * layerThickness / (1 + e0)) * 
        Math.log10((sigma0 + deltaSigma) / sigma0);
      consolidationSettlement = Sc * 1000; // mm
    }
  }

  // Secondary settlement (creep) - typically 10-20% of consolidation
  const secondarySettlement = consolidationSettlement * 0.15;

  // Total settlement
  const totalSettlement = immediateSettlement + consolidationSettlement + secondarySettlement;

  // Allowable settlement (IS 1904)
  const allowableLimits: Record<string, number> = {
    isolated: 50,
    frame: 40,
    mat: 75,
  };
  const allowableSettlement = allowableLimits[buildingType];

  // Differential settlement limit (L/ratio)
  const differentialLimits: Record<string, number> = {
    isolated: 300,
    frame: 500,
    mat: 300,
  };
  const differentialLimit = differentialLimits[buildingType];

  return {
    immediateSettlement: Math.round(immediateSettlement * 10) / 10,
    consolidationSettlement: Math.round(consolidationSettlement * 10) / 10,
    secondarySettlement: Math.round(secondarySettlement * 10) / 10,
    totalSettlement: Math.round(totalSettlement * 10) / 10,
    allowableSettlement,
    differentialLimit,
    status: totalSettlement <= allowableSettlement ? 'PASS' : 'FAIL',
    clause: 'IS 1904:1986, Terzaghi & Peck',
  };
}

// ============================================================================
// LIQUEFACTION TRIGGERING (PLACEHOLDER)
// ============================================================================

export interface LiquefactionResult {
  CSR: number;               // Cyclic stress ratio
  CRR: number;               // Cyclic resistance ratio
  factorOfSafety: number;
  status: 'LIQUEFIABLE' | 'NON-LIQUEFIABLE' | 'MARGINAL';
  postLiquefactionSettlement?: number; // mm
  clause: string;
  note: string;
}

/**
 * Simplified liquefaction assessment based on SPT N-value
 * Uses Idriss-Boulanger (2008) procedure
 */
export function assessLiquefaction(
  site: {
    depth: number;           // m - depth of layer being assessed
    totalStress: number;     // kPa - total vertical stress
    effectiveStress: number; // kPa - effective vertical stress
    waterTableDepth: number; // m
  },
  soil: {
    N60: number;             // SPT N-value corrected for energy
    fines: number;           // % fines content
    D50?: number;            // mm - mean grain size
  },
  earthquake: {
    Mw: number;              // Moment magnitude
    amax: number;            // Peak ground acceleration (g)
  }
): LiquefactionResult {
  const { depth, totalStress, effectiveStress, waterTableDepth } = site;
  const { N60, fines } = soil;
  const { Mw, amax } = earthquake;

  // Check if below water table
  if (depth < waterTableDepth) {
    return {
      CSR: 0,
      CRR: 999,
      factorOfSafety: 999,
      status: 'NON-LIQUEFIABLE',
      clause: 'Idriss & Boulanger (2008)',
      note: 'Layer above water table - not susceptible',
    };
  }

  // Stress reduction factor rd (Seed & Idriss)
  const rd = 1 - 0.00765 * depth;

  // Cyclic Stress Ratio
  const CSR = 0.65 * (amax / 1) * (totalStress / effectiveStress) * rd;

  // Magnitude scaling factor
  const MSF = Math.pow(10, 2.24) / Math.pow(Mw, 2.56);

  // Clean sand equivalent N-value
  const deltaN = fines <= 5 ? 0 : fines <= 35 ? (fines - 5) * 0.2 : 6;
  const N1_60cs = N60 + deltaN;

  // Cyclic Resistance Ratio (simplified)
  let CRR: number;
  if (N1_60cs < 30) {
    CRR = (1 / (34 - N1_60cs)) + (N1_60cs / 135) + (50 / Math.pow(10 * N1_60cs - 45, 2)) - (1 / 200);
    CRR = Math.max(0.05, CRR);
  } else {
    CRR = 2.0; // Too dense to liquefy
  }

  // Adjust for magnitude
  const CRR_Mw = CRR * MSF;

  // Factor of safety
  const FS = CRR_Mw / CSR;

  // Status
  let status: 'LIQUEFIABLE' | 'NON-LIQUEFIABLE' | 'MARGINAL';
  if (FS < 1.0) {
    status = 'LIQUEFIABLE';
  } else if (FS < 1.2) {
    status = 'MARGINAL';
  } else {
    status = 'NON-LIQUEFIABLE';
  }

  return {
    CSR: Math.round(CSR * 1000) / 1000,
    CRR: Math.round(CRR_Mw * 1000) / 1000,
    factorOfSafety: Math.round(FS * 100) / 100,
    status,
    clause: 'Idriss & Boulanger (2008), NCEER (1997)',
    note: 'Simplified SPT-based method. Site-specific study recommended for critical structures.',
  };
}
