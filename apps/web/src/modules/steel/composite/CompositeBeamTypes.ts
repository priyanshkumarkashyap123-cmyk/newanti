/**
 * Composite Beam Design Type Definitions
 * Per AISC 360-22 Chapter I
 * 
 * Steel-concrete composite beam design including:
 * - Composite flexural strength
 * - Shear connector (stud) design
 * - Partial composite action
 * - Effective slab width
 */

import { SteelGrade, WShapeProperties, CalculationStep } from '../beams/SteelBeamTypes';

// Re-export common types using `export type` for isolatedModules
export type { SteelGrade, WShapeProperties, CalculationStep };

/**
 * Composite action level
 */
export enum CompositeLevel {
  FULL = 'FULL',           // 100% composite
  PARTIAL_75 = 'PARTIAL_75', // 75% composite
  PARTIAL_50 = 'PARTIAL_50', // 50% composite
  PARTIAL_25 = 'PARTIAL_25', // 25% composite
  MINIMUM = 'MINIMUM',     // 25% minimum per AISC
}

/**
 * Deck orientation
 */
export enum DeckOrientation {
  PERPENDICULAR = 'PERPENDICULAR', // Ribs perpendicular to beam
  PARALLEL = 'PARALLEL',           // Ribs parallel to beam
}

/**
 * Deck profile types
 */
export enum DeckProfile {
  FLAT_SLAB = 'FLAT_SLAB',       // No deck (solid slab)
  DECK_1_5 = 'DECK_1_5',         // 1.5" deck
  DECK_2_0 = 'DECK_2_0',         // 2" deck
  DECK_3_0 = 'DECK_3_0',         // 3" deck
}

/**
 * Stud reduction factors by deck type
 * Per AISC 360-22 I8.2a
 */
export const STUD_REDUCTION_FACTORS = {
  [DeckProfile.FLAT_SLAB]: {
    [DeckOrientation.PERPENDICULAR]: 1.0,
    [DeckOrientation.PARALLEL]: 1.0,
  },
  [DeckProfile.DECK_1_5]: {
    [DeckOrientation.PERPENDICULAR]: { Rg: 1.0, Rp: 0.75 },
    [DeckOrientation.PARALLEL]: { Rg: 1.0, Rp: 0.6 },
  },
  [DeckProfile.DECK_2_0]: {
    [DeckOrientation.PERPENDICULAR]: { Rg: 1.0, Rp: 0.75 },
    [DeckOrientation.PARALLEL]: { Rg: 0.85, Rp: 0.6 },
  },
  [DeckProfile.DECK_3_0]: {
    [DeckOrientation.PERPENDICULAR]: { Rg: 1.0, Rp: 0.75 },
    [DeckOrientation.PARALLEL]: { Rg: 0.7, Rp: 0.6 },
  },
};

/**
 * Concrete properties
 */
export interface ConcreteProperties {
  fc: number;        // Compressive strength, ksi
  wc?: number;       // Unit weight, pcf (default 145 for NW, 115 for LW)
  isLightweight: boolean;
}

/**
 * Slab properties
 */
export interface SlabProperties {
  tc: number;           // Total slab thickness, in
  hr: number;           // Deck rib height, in (0 for flat slab)
  wr: number;           // Average rib width, in (for formed deck)
  deckOrientation: DeckOrientation;
  deckProfile: DeckProfile;
}

/**
 * Stud properties
 */
export interface StudProperties {
  d: number;            // Stud diameter, in (typically 0.75)
  Hs: number;           // Stud height after welding, in
  Fu: number;           // Stud tensile strength, ksi (typically 65)
  Asc: number;          // Stud cross-sectional area, in²
}

/**
 * Composite beam geometry
 */
export interface CompositeGeometry {
  L: number;            // Span length, ft
  tributaryWidth: number; // Tributary width, ft
  leftEdgeDist: number;   // Distance to left slab edge, ft
  rightEdgeDist: number;  // Distance to right slab edge, ft
  beamSpacing: number;    // Beam spacing (center-to-center), ft
}

/**
 * Composite beam input
 */
export interface CompositeBeamInput {
  // Steel section
  section: WShapeProperties;
  
  // Steel material
  steelMaterial: {
    grade: SteelGrade;
    Fy: number;   // ksi
    Fu: number;   // ksi
    E?: number;   // ksi (default 29000)
  };
  
  // Concrete properties
  concrete: ConcreteProperties;
  
  // Slab properties
  slab: SlabProperties;
  
  // Stud properties
  stud: StudProperties;
  
  // Geometry
  geometry: CompositeGeometry;
  
  // Applied loads
  loads: {
    Mu: number;    // Required flexural strength, kip-ft
    wD: number;    // Dead load, klf
    wL: number;    // Live load, klf
    wConst?: number; // Construction load, klf
  };
  
  // Design options
  designMethod: 'LRFD' | 'ASD';
  compositeLevel?: CompositeLevel;
  checkConstruction?: boolean;  // Check non-composite during construction
  checkDeflection?: boolean;
}

/**
 * Effective width result
 */
export interface EffectiveWidthResult {
  beff: number;          // Effective width, in
  beff_left: number;     // Left side effective width, in
  beff_right: number;    // Right side effective width, in
  governingLimit: 'span' | 'spacing' | 'edge';
}

/**
 * Stud strength result
 */
export interface StudStrengthResult {
  Qn: number;            // Nominal stud strength, kips
  Rg: number;            // Group factor
  Rp: number;            // Position factor
  qn_concrete: number;   // Concrete breakout strength, kips
  qn_stud: number;       // Stud shear strength, kips
}

/**
 * Composite section properties
 */
export interface CompositeSectionProperties {
  Ac: number;            // Effective concrete area, in²
  Ycon: number;          // Distance from steel bottom to concrete centroid, in
  Y1: number;            // PNA location (from steel bottom), in
  Y2: number;            // PNA location for full composite, in
  a: number;             // Depth of concrete compression block, in
  Itr: number;           // Transformed moment of inertia, in⁴
  Sbot: number;          // Section modulus at bottom, in³
  Stop: number;          // Section modulus at top of steel, in³
}

/**
 * Composite flexural strength result
 */
export interface CompositeFlexuralResult {
  Mn: number;            // Nominal moment strength, kip-ft
  phi_Mn: number;        // Design strength (LRFD), kip-ft
  Mn_omega: number;      // Allowable strength (ASD), kip-ft
  Mu: number;            // Required strength, kip-ft
  ratio: number;
  isAdequate: boolean;
  
  // Composite action
  compositeRatio: number;  // Actual composite ratio (%)
  C: number;             // Compressive force, kips
  T: number;             // Tensile force, kips
  
  // Section properties
  sectionProps: CompositeSectionProperties;
}

/**
 * Shear connector design result
 */
export interface ShearConnectorResult {
  Qn: number;            // Nominal stud strength, kips
  nStudsRequired: number;  // Number of studs required (per half span)
  nStudsProvided: number;  // Number of studs provided
  maxSpacing: number;    // Maximum stud spacing, in
  minSpacing: number;    // Minimum stud spacing, in
  isAdequate: boolean;
  
  // Forces
  V_prime: number;       // Horizontal shear, kips
  sum_Qn: number;        // Total available stud strength, kips
}

/**
 * Deflection result
 */
export interface CompositeDeflectionResult {
  delta_const: number;     // Construction deflection, in
  delta_DL: number;        // Dead load deflection (composite), in
  delta_LL: number;        // Live load deflection, in
  delta_total: number;     // Total deflection, in
  L_delta_LL: number;      // L/delta for live load
  L_delta_total: number;   // L/delta for total
  isAdequate: boolean;
}

/**
 * Complete composite beam result
 */
export interface CompositeBeamResult {
  isAdequate: boolean;
  section: string;
  
  effectiveWidth: EffectiveWidthResult;
  flexure: CompositeFlexuralResult;
  shearConnectors: ShearConnectorResult;
  deflection?: CompositeDeflectionResult;
  
  capacityRatios: {
    flexure: number;
    studs: number;
    governing: number;
  };
  
  calculations: CalculationStep[];
  codeReference: string;
}

/**
 * Resistance factors for composite design
 */
export const COMPOSITE_RESISTANCE_FACTORS = {
  phi_b: 0.90,     // Flexure (LRFD)
  omega_b: 1.67,   // Flexure (ASD)
  phi_v: 0.75,     // Shear connectors (LRFD)
  omega_v: 2.00,   // Shear connectors (ASD)
};

/**
 * Standard stud sizes
 */
export const STANDARD_STUDS: Record<string, StudProperties> = {
  '3/4x3': { d: 0.75, Hs: 3.0, Fu: 65, Asc: 0.4418 },
  '3/4x4': { d: 0.75, Hs: 4.0, Fu: 65, Asc: 0.4418 },
  '3/4x5': { d: 0.75, Hs: 5.0, Fu: 65, Asc: 0.4418 },
  '3/4x6': { d: 0.75, Hs: 6.0, Fu: 65, Asc: 0.4418 },
  '7/8x4': { d: 0.875, Hs: 4.0, Fu: 65, Asc: 0.6013 },
  '7/8x5': { d: 0.875, Hs: 5.0, Fu: 65, Asc: 0.6013 },
};

/**
 * Minimum composite ratios
 * Per AISC 360-22 I3.2d
 */
export const MINIMUM_COMPOSITE_RATIO = 0.25;  // 25% minimum

/**
 * Concrete modular ratios
 */
export function calculateModularRatio(fc: number, Es: number = 29000): number {
  // Ec = 57000√fc (psi) = 57√fc (ksi) for normal weight
  const Ec = 57 * Math.sqrt(fc * 1000) / 1000; // ksi
  return Es / Ec;
}
