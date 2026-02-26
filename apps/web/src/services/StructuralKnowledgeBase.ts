/**
 * StructuralKnowledgeBase.ts
 * 
 * Comprehensive structural engineering knowledge for AI reasoning:
 * - Design formulas
 * - Code provisions
 * - Best practices
 * - Material properties
 * - Section properties
 */

// ============================================
// MATERIAL PROPERTIES
// ============================================

export const MATERIAL_PROPERTIES = {
  steel: {
    E: 200000, // MPa - Elastic modulus
    G: 77000,  // MPa - Shear modulus
    fy: {      // Yield strength by grade (MPa)
      'E250': 250,
      'E300': 300,
      'E350': 350,
      'E410': 410,
      'E450': 450,
    },
    density: 7850, // kg/m³
    poisson: 0.3,
    thermalExpansion: 12e-6, // per °C
  },
  concrete: {
    grades: { // Characteristic strength fck (MPa)
      'M20': 20,
      'M25': 25,
      'M30': 30,
      'M35': 35,
      'M40': 40,
      'M50': 50,
      'M60': 60,
    },
    E: (fck: number) => 5000 * Math.sqrt(fck), // MPa
    density: 2500, // kg/m³
    poisson: 0.2,
  },
  rebar: {
    Fe415: { fy: 415, Es: 200000 },
    Fe500: { fy: 500, Es: 200000 },
    Fe550: { fy: 550, Es: 200000 },
  },
};

// ============================================
// INDIAN STANDARD STEEL SECTIONS
// ============================================

export const INDIAN_SECTIONS = {
  ISMB: {
    // I-beam sections: depth, width, tw, tf, A, Ix, Iy, Zx, Zy, rx, ry
    '100': { d: 100, b: 75, tw: 4.0, tf: 7.2, A: 14.6, Ix: 257, Iy: 41 },
    '150': { d: 150, b: 80, tw: 4.8, tf: 7.6, A: 19.4, Ix: 726, Iy: 53 },
    '200': { d: 200, b: 100, tw: 5.7, tf: 10.8, A: 32.3, Ix: 2235, Iy: 150 },
    '250': { d: 250, b: 125, tw: 6.9, tf: 12.5, A: 47.6, Ix: 5131, Iy: 334 },
    '300': { d: 300, b: 140, tw: 7.7, tf: 13.1, A: 58.9, Ix: 8603, Iy: 454 },
    '350': { d: 350, b: 140, tw: 8.1, tf: 14.2, A: 66.7, Ix: 13158, Iy: 538 },
    '400': { d: 400, b: 140, tw: 8.9, tf: 16.0, A: 78.5, Ix: 20458, Iy: 622 },
    '450': { d: 450, b: 150, tw: 9.4, tf: 17.4, A: 92.3, Ix: 30390, Iy: 834 },
    '500': { d: 500, b: 180, tw: 10.2, tf: 17.2, A: 110.7, Ix: 45218, Iy: 1370 },
    '550': { d: 550, b: 190, tw: 11.2, tf: 19.3, A: 132.1, Ix: 64893, Iy: 1833 },
    '600': { d: 600, b: 210, tw: 12.0, tf: 20.8, A: 156.2, Ix: 91800, Iy: 2650 },
  },
  ISMC: {
    // Channel sections
    '100': { d: 100, b: 50, tw: 5.0, tf: 7.7, A: 11.7, Ix: 192, Iy: 26 },
    '150': { d: 150, b: 75, tw: 5.7, tf: 9.0, A: 21.0, Ix: 788, Iy: 103 },
    '200': { d: 200, b: 75, tw: 6.2, tf: 11.4, A: 28.2, Ix: 1830, Iy: 141 },
    '250': { d: 250, b: 80, tw: 7.2, tf: 14.1, A: 39.7, Ix: 3816, Iy: 211 },
    '300': { d: 300, b: 90, tw: 7.8, tf: 13.6, A: 46.3, Ix: 6362, Iy: 310 },
    '400': { d: 400, b: 100, tw: 8.8, tf: 15.3, A: 63.8, Ix: 15082, Iy: 504 },
  },
  ISA: {
    // Angle sections (equal leg)
    '50x50x5': { A: 4.79, Ix: 11.1, Iy: 11.1 },
    '65x65x6': { A: 7.44, Ix: 28.5, Iy: 28.5 },
    '75x75x8': { A: 11.38, Ix: 59.2, Iy: 59.2 },
    '90x90x10': { A: 17.02, Ix: 127, Iy: 127 },
    '100x100x10': { A: 19.03, Ix: 177, Iy: 177 },
    '100x100x12': { A: 22.59, Ix: 207, Iy: 207 },
    '150x150x12': { A: 34.59, Ix: 737, Iy: 737 },
    '200x200x16': { A: 61.78, Ix: 2340, Iy: 2340 },
  },
};

// ============================================
// DESIGN FORMULAS
// ============================================

export const DESIGN_FORMULAS = {
  beam: {
    maxMomentUDL: (w: number, L: number) => (w * L * L) / 8,
    maxMomentPointLoad: (P: number, L: number, a?: number) => 
      a ? (P * a * (L - a)) / L : (P * L) / 4,
    maxDeflectionUDL: (w: number, L: number, E: number, I: number) => 
      (5 * w * Math.pow(L, 4)) / (384 * E * I),
    maxDeflectionPointLoad: (P: number, L: number, E: number, I: number) => 
      (P * Math.pow(L, 3)) / (48 * E * I),
    sectionModulus: (M: number, sigma: number) => M / sigma,
  },
  column: {
    eulerCriticalLoad: (E: number, I: number, K: number, L: number) => 
      (Math.PI * Math.PI * E * I) / Math.pow(K * L, 2),
    slendernessRatio: (K: number, L: number, r: number) => (K * L) / r,
    effectiveLengthFactors: {
      'fixed-fixed': 0.5,
      'fixed-pinned': 0.7,
      'pinned-pinned': 1.0,
      'fixed-free': 2.0,
      'sway-frame': 1.2, // Approximate for unbraced frames
    },
  },
  connection: {
    boltCapacity: (fu: number, A: number, n: number) => n * 0.78 * fu * A,
    weldCapacity: (fu: number, t: number, L: number) => 0.707 * t * L * 0.5 * fu,
    bearingCapacity: (fu: number, d: number, t: number) => 2.5 * d * t * fu,
  },
};

// ============================================
// CODE PROVISIONS
// ============================================

export const CODE_PROVISIONS = {
  IS_800_2007: {
    partialSafetyFactors: {
      gammaM0: 1.10, // Yielding/buckling
      gammaM1: 1.25, // Ultimate stress
      gammaM2: 1.25, // Rupture
    },
    deflectionLimits: {
      beam_gravity: 'L/300',
      beam_total: 'L/250',
      cantilever_gravity: 'L/150',
      cantilever_total: 'L/120',
      crane_girder: 'L/500',
      purlin: 'L/150',
    },
    slendernessLimits: {
      compression: 180,
      tension: 400,
      reversal: 180,
    },
  },
  IS_456_2000: {
    partialSafetyFactors: {
      concrete: 1.5,
      steel: 1.15,
    },
    coverRequirements: {
      moderate: 30, // mm
      severe: 45,
      very_severe: 50,
      extreme: 75,
    },
    minReinforcement: {
      beam_tension: 0.85 / 415, // As,min = 0.85*bd/fy
      column: 0.008, // 0.8%
      slab: 0.0012, // for HYSD bars
    },
  },
  IS_1893_2016: {
    zones: {
      II: 0.10,
      III: 0.16,
      IV: 0.24,
      V: 0.36,
    },
    importanceFactor: {
      residential: 1.0,
      school: 1.25,
      hospital: 1.5,
      emergency: 1.5,
    },
    responsReductionFactor: {
      SMRF: 5.0, // Special moment resisting frame
      OMRF: 3.0, // Ordinary moment resisting frame
      braced: 4.0,
      shearWall: 4.0,
    },
    soilTypes: {
      I: { S: 1.0, desc: 'Rock or hard soil' },
      II: { S: 1.0, desc: 'Medium soil' },
      III: { S: 1.0, desc: 'Soft soil' },
    },
  },
  AISC_360_16: {
    phiFactors: {
      tension: 0.90,
      compression: 0.90,
      flexure: 0.90,
      shear: 1.00,
      bearing: 0.75,
    },
    deflectionLimits: {
      floor_live: 'L/360',
      floor_total: 'L/240',
      roof_live: 'L/240',
      roof_total: 'L/180',
    },
  },
};

// ============================================
// LOAD GUIDELINES
// ============================================

export const LOAD_GUIDELINES = {
  deadLoads: { // kN/m²
    steelFloorDeck: 2.0,
    concreteSlabPer100mm: 2.5,
    steelFraming: 0.5,
    ceiling: 0.3,
    services: 0.5,
    partitions: 1.0,
    roofSheeting: 0.15,
    waterproofing: 0.2,
  },
  liveLoads: { // kN/m² as per IS 875 Part 2
    residential: 2.0,
    office: 2.5,
    corridors: 4.0,
    retail: 4.0,
    parking: 5.0,
    industrial_light: 5.0,
    industrial_heavy: 10.0,
    storage: 12.0,
    assembly: 5.0,
    roof_accessible: 1.5,
    roof_inaccessible: 0.75,
  },
  loadCombinations: {
    IS_875_2015: [
      '1.5 DL + 1.5 LL',
      '1.2 DL + 1.2 LL + 1.2 WL',
      '1.5 DL + 1.5 WL',
      '0.9 DL + 1.5 WL',
      '1.2 DL + 1.2 LL + 1.2 EQ',
      '1.5 DL + 1.5 EQ',
      '0.9 DL + 1.5 EQ',
    ],
    ASCE_7_22: [
      '1.4D',
      '1.2D + 1.6L + 0.5(Lr or S or R)',
      '1.2D + 1.6(Lr or S or R) + (L or 0.5W)',
      '1.2D + 1.0W + L + 0.5(Lr or S or R)',
      '1.2D + 1.0E + L + 0.2S',
      '0.9D + 1.0W',
      '0.9D + 1.0E',
    ],
  },
};

// ============================================
// STRUCTURAL ENGINEERING CONCEPTS
// ============================================

export const ENGINEERING_CONCEPTS = {
  momentOfInertia: {
    definition: 'Second moment of area - resistance to bending',
    formula: 'I = ∫ y² dA',
    rectangular: 'I = bh³/12 about centroid',
    circular: 'I = πd⁴/64',
    parallelAxis: 'I = Ic + Ad²',
    units: 'mm⁴ or cm⁴',
  },
  sectionModulus: {
    definition: 'Ratio of moment of inertia to distance from neutral axis',
    elastic: 'S = I/c where c is distance to extreme fiber',
    plastic: 'Z = sum of first moments of area about plastic neutral axis',
    relationship: 'Shape factor = Z/S (1.5 for rectangular, 1.7 for I-beam)',
  },
  buckling: {
    euler: 'Pcr = π²EI/(KL)²',
    slenderness: 'λ = KL/r',
    effectiveLength: 'Depends on end conditions: K = 0.5 to 2.0',
    inelastic: 'Use column curves (AISC, IS 800) for intermediate slenderness',
  },
  deflection: {
    simplySupported_UDL: 'δ = 5wL⁴/384EI',
    simplySupported_point: 'δ = PL³/48EI',
    cantilever_UDL: 'δ = wL⁴/8EI',
    cantilever_point: 'δ = PL³/3EI',
    importance: 'Serviceability limit state - comfort and function',
  },
  pDelta: {
    definition: 'Second-order effects from axial load and displacement',
    significance: 'Important for tall buildings and slender columns',
    amplification: 'B₂ = 1/(1 - ΣP/Pe) where Pe is story buckling load',
    when: 'Required when B₂ > 1.1 or drift > 1.5%',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getSectionProperties(sectionName: string) {
  // Parse section name like "ISMB 300" or "ISMB300"
  const match = sectionName.match(/^(ISMB|ISMC|ISA)\s*(\d+)/i);
  if (!match) return null;
  
  const type = match[1].toUpperCase() as keyof typeof INDIAN_SECTIONS;
  const size = match[2];
  
  if (INDIAN_SECTIONS[type] && INDIAN_SECTIONS[type][size as keyof typeof INDIAN_SECTIONS[typeof type]]) {
    return INDIAN_SECTIONS[type][size as keyof typeof INDIAN_SECTIONS[typeof type]];
  }
  
  return null;
}

export function calculateBendingCapacity(section: string, fy: number = 250): number {
  const props = getSectionProperties(section);
  if (!props || !('d' in props)) return 0;
  
  // Plastic moment capacity (approximate)
  const Zp = (props as any).Ix / ((props as any).d / 2) * 1.12; // Shape factor ~1.12 for I-beams
  return (Zp * fy) / 1.10; // kN·m with γM0 = 1.10
}

export function checkDeflection(
  deflection: number,
  span: number,
  type: 'beam' | 'cantilever' = 'beam'
): { ratio: string; limit: string; pass: boolean } {
  const limits = CODE_PROVISIONS.IS_800_2007.deflectionLimits;
  const limitStr = type === 'cantilever' ? limits.cantilever_gravity : limits.beam_gravity;
  const limitValue = span * 1000 / parseInt(limitStr.split('/')[1]);
  
  return {
    ratio: `L/${Math.round(span * 1000 / deflection)}`,
    limit: limitStr,
    pass: deflection <= limitValue,
  };
}

export default {
  MATERIAL_PROPERTIES,
  INDIAN_SECTIONS,
  DESIGN_FORMULAS,
  CODE_PROVISIONS,
  LOAD_GUIDELINES,
  ENGINEERING_CONCEPTS,
  getSectionProperties,
  calculateBendingCapacity,
  checkDeflection,
};
