/**
 * ============================================================================
 * BRIDGE SUPERSTRUCTURE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive bridge deck and girder design including:
 * - Composite steel-concrete deck design
 * - Plate girder design
 * - Box girder design
 * - Prestressed concrete girders
 * - Orthotropic steel decks
 * - Bridge deck slab analysis
 * - Diaphragm design
 * 
 * Design Codes:
 * - AASHTO LRFD Bridge Design Specifications
 * - EN 1994 (Composite structures)
 * - EN 1993-1-5 (Plated structures)
 * - IRC:112 (Concrete bridges)
 * - IRC:24 (Steel bridges)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  SteelMemberDesignEngine,
  designSteelBeam,
  SteelMemberDesignResult,
} from '../steel/SteelMemberDesignEngine';

import {
  findSection,
  getSteelGrade,
  type SteelDesignCode,
  type SteelGradeType,
  type SteelSection,
} from '../steel/SteelDesignConstants';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type BridgeType = 
  | 'slab'
  | 'T-beam'
  | 'box-girder'
  | 'I-girder'
  | 'steel-composite'
  | 'plate-girder'
  | 'orthotropic'
  | 'arch'
  | 'truss';

export type DeckType = 
  | 'RC-slab'
  | 'precast-slab'
  | 'composite-slab'
  | 'orthotropic-steel'
  | 'timber';

export type GirderType = 
  | 'steel-I'
  | 'steel-box'
  | 'steel-plate'
  | 'concrete-T'
  | 'concrete-box'
  | 'prestressed-I'
  | 'prestressed-box';

export type LoadingCode = 'AASHTO' | 'EN1991-2' | 'IRC' | 'AS5100';

// =============================================================================
// VEHICULAR LOADING DEFINITIONS
// =============================================================================

export interface VehicleLoad {
  name: string;
  axles: {
    position: number;       // m from front
    load: number;           // kN per axle
    spacing?: number;       // m transverse spacing between wheels
  }[];
  udl?: number;             // kN/m lane load
  dynamicFactor: number;    // Impact/dynamic allowance
}

export const VEHICLE_LOADS: Record<string, VehicleLoad> = {
  // AASHTO HL-93
  'HL-93': {
    name: 'AASHTO HL-93 Design Truck',
    axles: [
      { position: 0, load: 35, spacing: 1.8 },     // Front axle
      { position: 4.3, load: 145, spacing: 1.8 }, // Middle axle
      { position: 8.6, load: 145, spacing: 1.8 }, // Rear axle (4.3-9.0m variable)
    ],
    udl: 9.3,  // kN/m lane load
    dynamicFactor: 1.33,
  },
  'HL-93-Tandem': {
    name: 'AASHTO HL-93 Design Tandem',
    axles: [
      { position: 0, load: 110, spacing: 1.8 },
      { position: 1.2, load: 110, spacing: 1.8 },
    ],
    udl: 9.3,
    dynamicFactor: 1.33,
  },
  
  // Eurocode Load Model 1
  'LM1-TS': {
    name: 'EN 1991-2 LM1 Tandem System',
    axles: [
      { position: 0, load: 300, spacing: 2.0 },   // Alpha_Q * 300 kN
      { position: 1.2, load: 300, spacing: 2.0 },
    ],
    udl: 9.0,  // Alpha_q * 9 kN/m²
    dynamicFactor: 1.0,  // Included in alpha factors
  },
  
  // IRC Class AA Tracked
  'IRC-70R': {
    name: 'IRC Class 70R Wheeled',
    axles: [
      { position: 0, load: 80, spacing: 2.05 },
      { position: 1.37, load: 120, spacing: 2.05 },
      { position: 4.57, load: 120, spacing: 2.05 },
      { position: 5.94, load: 170, spacing: 2.05 },
      { position: 7.31, load: 170, spacing: 2.05 },
      { position: 8.68, load: 170, spacing: 2.05 },
      { position: 10.05, load: 170, spacing: 2.05 },
    ],
    udl: 5.0,  // Additional lane load
    dynamicFactor: 1.25,
  },
  'IRC-ClassA': {
    name: 'IRC Class A Loading',
    axles: [
      { position: 0, load: 27, spacing: 1.8 },
      { position: 1.1, load: 27, spacing: 1.8 },
      { position: 4.3, load: 114, spacing: 1.8 },
      { position: 7.5, load: 114, spacing: 1.8 },
      { position: 10.7, load: 68, spacing: 1.8 },
      { position: 13.9, load: 68, spacing: 1.8 },
      { position: 16.0, load: 68, spacing: 1.8 },
      { position: 18.1, load: 68, spacing: 1.8 },
    ],
    udl: 0,
    dynamicFactor: 1.18,
  },
};

// =============================================================================
// BRIDGE GEOMETRY
// =============================================================================

export interface BridgeGeometry {
  // Main dimensions
  span: number;                 // m
  numSpans?: number;            // For continuous bridges
  spanLengths?: number[];       // m for each span
  
  // Cross section
  deckWidth: number;            // m total
  carriageWidth: number;        // m roadway
  numLanes: number;
  footpathWidth?: number;       // m each side
  
  // Structural arrangement
  numGirders: number;
  girderSpacing: number;        // m
  overhang: number;             // m deck overhang beyond outer girder
  
  // Vertical geometry
  superelevation?: number;      // % for curves
  camber?: number;              // mm at midspan
  longitudinalGrade?: number;   // %
}

export interface BridgeMaterials {
  // Concrete
  fck: number;                  // MPa characteristic strength
  Ec?: number;                  // MPa modulus
  
  // Steel
  steelGrade: SteelGradeType;
  steelCode: SteelDesignCode;
  
  // Reinforcement
  fsy: number;                  // MPa yield strength
  
  // Shear connectors
  studDiameter?: number;        // mm
  studHeight?: number;          // mm
  studFu?: number;              // MPa ultimate strength
}

// =============================================================================
// DECK SLAB DESIGN
// =============================================================================

export interface DeckSlabInput {
  thickness: number;            // mm
  span: number;                 // mm (between girders)
  overhang: number;             // mm
  fck: number;                  // MPa
  fsy: number;                  // MPa
  cover: number;                // mm
  surfacing: number;            // kN/m² wearing surface
  barriers: number;             // kN/m barrier load
}

export interface DeckSlabResult {
  // Geometry
  effectiveDepth: number;       // mm
  
  // Moments (per m width)
  positiveTransverse: number;   // kN-m/m (between girders)
  negativeTransverse: number;   // kN-m/m (over girders)
  positiveOverhang: number;     // kN-m/m (cantilever)
  longitudinalMoment: number;   // kN-m/m (distribution)
  
  // Reinforcement
  bottomTransverse: {
    diameter: number;           // mm
    spacing: number;            // mm
    area: number;               // mm²/m
  };
  topTransverse: {
    diameter: number;
    spacing: number;
    area: number;
  };
  bottomLongitudinal: {
    diameter: number;
    spacing: number;
    area: number;
  };
  topLongitudinal: {
    diameter: number;
    spacing: number;
    area: number;
  };
  
  // Checks
  crackWidth: number;           // mm
  deflection: number;           // mm
  punchingShear: number;        // utilization ratio
  status: 'pass' | 'fail';
}

// =============================================================================
// COMPOSITE GIRDER DESIGN
// =============================================================================

export interface CompositeGirderInput {
  // Steel section
  steelSection: SteelSection | string;
  steelGrade: SteelGradeType;
  
  // Concrete slab
  slabWidth: number;            // mm effective width
  slabThickness: number;        // mm
  haunchHeight?: number;        // mm (optional haunch)
  fck: number;                  // MPa
  
  // Spans and loads
  span: number;                 // mm
  deadLoadSteel: number;        // kN/m (steel self-weight)
  deadLoadConcrete: number;     // kN/m (wet concrete)
  deadLoadSuperimposed: number; // kN/m (surfacing, barriers)
  liveLoad: number;             // kN/m maximum
  liveLoadMoment?: number;      // kN-m if known
  
  // Construction
  shored: boolean;              // Shored vs unshored construction
}

export interface CompositeGirderResult {
  // Section properties
  steelArea: number;            // mm²
  concreteArea: number;         // mm²
  transformedArea: number;      // mm² (long-term)
  
  // Neutral axis locations
  naSteel: number;              // mm from bottom (steel alone)
  naShortTerm: number;          // mm (n = Es/Ec)
  naLongTerm: number;           // mm (3n for creep)
  
  // Section moduli
  Sx_steel: number;             // mm³ (steel section)
  Sx_shortTerm_top: number;     // mm³ (top of steel)
  Sx_shortTerm_bot: number;     // mm³ (bottom of steel)
  Sx_longTerm_top: number;      // mm³
  Sx_longTerm_bot: number;      // mm³
  
  // Moments
  M_dc1: number;                // kN-m (steel + wet concrete)
  M_dc2: number;                // kN-m (superimposed dead)
  M_ll: number;                 // kN-m (live load)
  M_total: number;              // kN-m
  
  // Stresses (at critical locations)
  stresses: {
    topSteel: number;           // MPa
    bottomSteel: number;        // MPa
    topConcrete: number;        // MPa
  };
  
  // Capacity
  Mp_composite: number;         // kN-m plastic moment
  Mn_composite: number;         // kN-m nominal moment
  Md_composite: number;         // kN-m design moment capacity
  
  // Utilization
  momentUtilization: number;
  stressUtilization: number;
  status: 'pass' | 'fail';
  
  // PNA location
  pnaLocation: 'in-slab' | 'in-steel' | 'at-interface';
  pnaDepth: number;             // mm from top of slab
  
  // Ductility
  Dp: number;                   // mm (depth of PNA)
  Dt: number;                   // mm (total depth)
  ductilityRatio: number;       // Dp/Dt
  ductile: boolean;
}

export interface ShearConnectorResult {
  // Connector properties
  studDiameter: number;         // mm
  studHeight: number;           // mm
  studCapacity: number;         // kN per stud
  
  // Required connectors
  totalHorizontalShear: number; // kN
  numStudsRequired: number;
  numStudsProvided: number;
  
  // Spacing
  pitchAtEnds: number;          // mm (max shear region)
  pitchAtMiddle: number;        // mm (low shear region)
  transverseSpacing: number;    // mm (across flange)
  
  // Capacity
  interfaceCapacity: number;    // kN
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  // Fatigue
  fatigueRange: number;         // kN (load range per stud)
  fatigueLife: number;          // million cycles
}

// =============================================================================
// PLATE GIRDER DESIGN
// =============================================================================

export interface PlateGirderInput {
  // Dimensions
  span: number;                 // mm
  depth: number;                // mm overall
  
  // Web
  webThickness: number;         // mm
  webDepth: number;             // mm (clear between flanges)
  
  // Flanges
  topFlangeWidth: number;       // mm
  topFlangeThickness: number;   // mm
  bottomFlangeWidth: number;    // mm
  bottomFlangeThickness: number;// mm
  
  // Stiffeners
  webStiffeners: boolean;
  stiffenerSpacing?: number;    // mm
  
  // Material
  grade: SteelGradeType;
  
  // Loading
  Mu: number;                   // kN-m factored moment
  Vu: number;                   // kN factored shear
}

export interface PlateGirderResult {
  // Section properties
  area: number;                 // mm²
  Ix: number;                   // mm⁴
  Sx: number;                   // mm³
  Zx: number;                   // mm³ plastic
  
  // Section classification
  flangeClass: number;          // 1-4
  webClass: number;             // 1-4
  overallClass: number;
  
  // Bending capacity
  Mn: number;                   // kN-m nominal
  Md: number;                   // kN-m design
  momentUtilization: number;
  
  // Web buckling
  webSlenderness: number;
  webBucklingStress: number;    // MPa
  postBucklingAllowed: boolean;
  
  // Shear capacity
  Vn: number;                   // kN nominal shear
  Vd: number;                   // kN design shear
  shearUtilization: number;
  
  // Tension field action (if applicable)
  tensionFieldContribution: number; // kN
  
  // Moment-shear interaction
  combinedUtilization: number;
  
  // Stiffener design
  stiffeners?: {
    required: boolean;
    spacing: number;            // mm
    width: number;              // mm
    thickness: number;          // mm
    bearingStiffenerArea: number; // mm²
  };
  
  // LTB check
  ltbSlenderness: number;
  ltbReduction: number;
  
  // Results
  status: 'pass' | 'fail';
  warnings: string[];
}

// =============================================================================
// BOX GIRDER DESIGN
// =============================================================================

export interface BoxGirderInput {
  // Dimensions
  span: number;                 // mm
  width: number;                // mm external
  depth: number;                // mm external
  
  // Plates
  topFlangeThickness: number;   // mm
  bottomFlangeThickness: number;// mm
  webThickness: number;         // mm (each web)
  numWebs: number;              // Typically 2
  
  // Internal stiffening
  numDiaphragms: number;
  longitudinalStiffeners: boolean;
  
  // Material
  grade: SteelGradeType;
  
  // Loading
  Mu: number;                   // kN-m
  Vu: number;                   // kN
  Tu: number;                   // kN-m torsion
}

export interface BoxGirderResult {
  // Section properties
  area: number;                 // mm²
  Ix: number;                   // mm⁴
  Iy: number;                   // mm⁴
  J: number;                    // mm⁴ torsional constant
  Cw: number;                   // mm⁶ warping constant
  
  // Shear flow
  shearFlowMax: number;         // N/mm
  
  // Bending capacity
  Mn: number;                   // kN-m
  Md: number;                   // kN-m
  momentUtilization: number;
  
  // Shear capacity
  Vn: number;                   // kN
  Vd: number;                   // kN
  shearUtilization: number;
  
  // Torsion capacity
  Tn: number;                   // kN-m
  Td: number;                   // kN-m
  torsionUtilization: number;
  
  // Combined
  combinedUtilization: number;
  
  // Distortion
  distortionStress: number;     // MPa
  distortionOk: boolean;
  
  // Status
  status: 'pass' | 'fail';
  warnings: string[];
}

// =============================================================================
// COMPLETE BRIDGE DECK DESIGN RESULT
// =============================================================================

export interface BridgeDeckDesignResult {
  // Input summary
  geometry: BridgeGeometry;
  bridgeType: BridgeType;
  
  // Component results
  deckSlab?: DeckSlabResult;
  girders?: (CompositeGirderResult | PlateGirderResult | BoxGirderResult)[];
  shearConnectors?: ShearConnectorResult;
  
  // Load effects
  loadEffects: {
    deadLoadMoment: number;     // kN-m per girder
    liveLoadMoment: number;     // kN-m per girder
    totalMoment: number;        // kN-m per girder
    deadLoadShear: number;      // kN per girder
    liveLoadShear: number;      // kN per girder
    totalShear: number;         // kN per girder
    liveLoadReaction: number;   // kN per bearing
  };
  
  // Distribution factors
  distributionFactors: {
    momentInterior: number;
    momentExterior: number;
    shearInterior: number;
    shearExterior: number;
  };
  
  // Overall
  overallStatus: 'pass' | 'fail';
  criticalCheck: string;
  maxUtilization: number;
  
  // Quantities
  quantities: {
    steelWeight: number;        // tonnes
    concreteVolume: number;     // m³
    rebarWeight: number;        // tonnes
  };
  
  // Warnings
  warnings: string[];
  recommendations: string[];
}

// =============================================================================
// BRIDGE DECK DESIGN ENGINE CLASS
// =============================================================================

export class BridgeDeckDesignEngine {
  private geometry: BridgeGeometry;
  private materials: BridgeMaterials;
  private loadingCode: LoadingCode;

  constructor(
    geometry: BridgeGeometry,
    materials: BridgeMaterials,
    loadingCode: LoadingCode = 'AASHTO'
  ) {
    this.geometry = { ...geometry };
    this.materials = { ...materials };
    this.loadingCode = loadingCode;
  }

  // ===========================================================================
  // DECK SLAB DESIGN
  // ===========================================================================

  public designDeckSlab(input: DeckSlabInput): DeckSlabResult {
    const { thickness, span, overhang, fck, fsy, cover, surfacing, barriers } = input;
    
    // Effective depth
    const barDia = 16;  // mm assumed
    const effectiveDepth = thickness - cover - barDia / 2;
    
    // Load effects on 1m strip
    const selfWeight = thickness / 1000 * 25;  // kN/m² concrete
    const totalDead = selfWeight + surfacing;
    
    // Factored loads
    const gamma_d = 1.25;
    const gamma_l = 1.75;
    const wu_dead = totalDead * gamma_d;
    
    // Wheel load (AASHTO) - concentrated load
    const P_wheel = 72.5;  // kN (HL-93 wheel)
    const tire_width = 0.51;  // m
    const tire_length = 0.25; // m
    const E = Math.min(span / 1000, 2.0);  // Effective width for distribution
    const P_distributed = P_wheel * gamma_l * 1.33 / E;  // kN/m with impact
    
    // Transverse moments (between girders - continuous slab)
    const M_dead_pos = wu_dead * (span / 1000) * (span / 1000) / 10;  // kN-m/m positive
    const M_dead_neg = wu_dead * (span / 1000) * (span / 1000) / 10;  // kN-m/m negative
    
    // Live load moment (empirical - AASHTO method)
    const S = span / 1000;  // m
    const M_ll_pos = 26 + 6.6 * S;  // kN-m/m (approximate AASHTO formula)
    const M_ll_neg = M_ll_pos * 0.8;
    
    const positiveTransverse = M_dead_pos + M_ll_pos;
    const negativeTransverse = M_dead_neg + M_ll_neg;
    
    // Overhang moment (cantilever with barrier and wheel load)
    const M_overhang_dead = barriers * (overhang / 1000) + 
                            wu_dead * (overhang / 1000) * (overhang / 1000) / 2;
    const M_overhang_live = P_wheel * gamma_l * 1.33 * 0.3 / 1;  // Wheel near edge
    const positiveOverhang = M_overhang_dead + M_overhang_live;
    
    // Longitudinal moment (distribution reinforcement)
    const longitudinalMoment = positiveTransverse * 0.3;  // Distribution steel
    
    // Required reinforcement
    const designReinforcement = (M: number): { diameter: number; spacing: number; area: number } => {
      const Mu = M * 1e6;  // N-mm
      const b = 1000;      // mm width
      const d = effectiveDepth;
      
      // Required area (simplified rectangular beam formula)
      const Ru = Mu / (b * d * d);
      const rho = 0.85 * fck / fsy * (1 - Math.sqrt(1 - 2 * Ru / (0.85 * fck)));
      const As = Math.max(rho * b * d, 0.0012 * b * thickness);  // min 0.12%
      
      // Select bar size and spacing
      const diameter = As > 1200 ? 20 : As > 600 ? 16 : 12;
      const Ab = Math.PI * diameter * diameter / 4;
      const spacing = Math.min(Math.floor(Ab * 1000 / As / 25) * 25, 300);
      
      return {
        diameter,
        spacing,
        area: Ab * 1000 / spacing,
      };
    };
    
    const bottomTransverse = designReinforcement(positiveTransverse);
    const topTransverse = designReinforcement(negativeTransverse);
    const bottomLongitudinal = designReinforcement(longitudinalMoment);
    const topLongitudinal = {
      diameter: 12,
      spacing: 200,
      area: Math.PI * 144 / 4 * 1000 / 200,
    };
    
    // Crack width check (simplified)
    const sigma_s = positiveTransverse * 1e6 * (effectiveDepth) / 
                    (bottomTransverse.area * effectiveDepth * 0.9);
    const s_rm = 2 * cover + 0.1 * bottomTransverse.spacing;  // mm
    const epsilon_sm = sigma_s / 200000 - 0.4 * fck / fsy / 1.5;
    const crackWidth = s_rm * Math.max(epsilon_sm, 0.0005);
    
    // Deflection check (simplified)
    const E_c = 4700 * Math.sqrt(fck);
    const I_eff = 1000 * Math.pow(thickness, 3) / 12;
    const deflection = 5 * totalDead * Math.pow(span, 4) / (384 * E_c * I_eff) * 1e6;
    
    // Punching shear (simplified check)
    const b_0 = 4 * (tire_width * 1000 + effectiveDepth);  // Critical perimeter
    const V_u = P_wheel * gamma_l * 1.33;
    const v_c = 0.33 * Math.sqrt(fck);  // MPa
    const punchingShear = V_u * 1000 / (b_0 * effectiveDepth * v_c);
    
    return {
      effectiveDepth,
      positiveTransverse,
      negativeTransverse,
      positiveOverhang,
      longitudinalMoment,
      bottomTransverse,
      topTransverse,
      bottomLongitudinal,
      topLongitudinal,
      crackWidth,
      deflection,
      punchingShear,
      status: crackWidth < 0.3 && deflection < span / 250 && punchingShear < 1.0 ? 'pass' : 'fail',
    };
  }

  // ===========================================================================
  // COMPOSITE GIRDER DESIGN
  // ===========================================================================

  public designCompositeGirder(input: CompositeGirderInput): CompositeGirderResult {
    // Get steel section
    const section = typeof input.steelSection === 'string' 
      ? findSection(input.steelSection)!
      : input.steelSection;
    
    const grade = getSteelGrade(input.steelGrade);
    const fy = grade.fy;
    const Es = grade.E;
    
    // Concrete properties
    const { slabWidth, slabThickness, fck, span, haunchHeight = 0 } = input;
    const Ec = 4700 * Math.sqrt(fck);
    const n_short = Es / Ec;
    const n_long = 3 * n_short;  // For creep effects
    
    // Steel section properties
    const As = section.A;
    const d_steel = section.h;
    const Ix_steel = section.Ix;
    const y_steel_bot = d_steel / 2;  // NA from bottom for symmetric section
    
    // Transformed concrete areas
    const Ac_short = slabWidth * slabThickness / n_short;
    const Ac_long = slabWidth * slabThickness / n_long;
    
    // Composite section (short-term)
    const d_total = d_steel + haunchHeight + slabThickness;
    const y_conc = d_steel + haunchHeight + slabThickness / 2;  // Concrete centroid from steel bottom
    
    // Short-term composite NA
    const A_comp_short = As + Ac_short;
    const y_na_short = (As * y_steel_bot + Ac_short * y_conc) / A_comp_short;
    
    // Long-term composite NA
    const A_comp_long = As + Ac_long;
    const y_na_long = (As * y_steel_bot + Ac_long * y_conc) / A_comp_long;
    
    // Composite moment of inertia (short-term)
    const I_comp_short = Ix_steel + As * Math.pow(y_steel_bot - y_na_short, 2) +
                         slabWidth * Math.pow(slabThickness, 3) / (12 * n_short) +
                         Ac_short * Math.pow(y_conc - y_na_short, 2);
    
    // Long-term
    const I_comp_long = Ix_steel + As * Math.pow(y_steel_bot - y_na_long, 2) +
                        slabWidth * Math.pow(slabThickness, 3) / (12 * n_long) +
                        Ac_long * Math.pow(y_conc - y_na_long, 2);
    
    // Section moduli
    const Sx_steel = Ix_steel / y_steel_bot;
    const Sx_short_top = I_comp_short / (d_total - y_na_short);
    const Sx_short_bot = I_comp_short / y_na_short;
    const Sx_long_top = I_comp_long / (d_total - y_na_long);
    const Sx_long_bot = I_comp_long / y_na_long;
    
    // Loading
    const { deadLoadSteel, deadLoadConcrete, deadLoadSuperimposed, liveLoad } = input;
    const L = span / 1000;  // m
    
    // Moments (simple span)
    const M_dc1 = (deadLoadSteel + deadLoadConcrete) * L * L / 8;  // Steel section alone
    const M_dc2 = deadLoadSuperimposed * L * L / 8;  // Composite (long-term)
    const M_ll = input.liveLoadMoment || liveLoad * L * L / 8;  // Composite (short-term)
    
    // Factored moment
    const gamma_dc = 1.25;
    const gamma_dw = 1.5;
    const gamma_ll = 1.75;
    const M_u = gamma_dc * M_dc1 + gamma_dw * M_dc2 + gamma_ll * M_ll;
    
    // Stresses (for stress limits check)
    const stresses = {
      topSteel: 0,
      bottomSteel: 0,
      topConcrete: 0,
    };
    
    if (input.shored) {
      // All load on composite section
      stresses.bottomSteel = M_u * 1e6 / Sx_short_bot;
      stresses.topSteel = -M_u * 1e6 * (d_steel - y_na_short) / I_comp_short;
    } else {
      // Stage 1: Steel + wet concrete on steel alone
      const f_bot_1 = M_dc1 * 1e6 / Sx_steel;
      // Stage 2: SDL on long-term composite
      const f_bot_2 = M_dc2 * 1e6 / Sx_long_bot;
      // Stage 3: LL on short-term composite
      const f_bot_3 = M_ll * 1e6 / Sx_short_bot;
      
      stresses.bottomSteel = gamma_dc * f_bot_1 + gamma_dw * f_bot_2 + gamma_ll * f_bot_3;
      stresses.topSteel = -gamma_ll * M_ll * 1e6 * (d_steel - y_na_short) / I_comp_short;
      stresses.topConcrete = -gamma_ll * M_ll * 1e6 * (d_total - y_na_short) / I_comp_short / n_short;
    }
    
    // Plastic moment capacity
    // Locate PNA (plastic neutral axis)
    const C_conc = 0.85 * fck * slabWidth * slabThickness / 1000;  // kN (max concrete compression)
    const T_steel = As * fy / 1000;  // kN (steel yield)
    
    let pnaLocation: 'in-slab' | 'in-steel' | 'at-interface';
    let pnaDepth: number;
    let Mp: number;
    
    if (C_conc >= T_steel) {
      // PNA in slab
      pnaLocation = 'in-slab';
      const a = T_steel * 1000 / (0.85 * fck * slabWidth);
      pnaDepth = a;
      const lever_arm = d_steel / 2 + haunchHeight + slabThickness - a / 2;
      Mp = T_steel * lever_arm / 1000;  // kN-m
    } else {
      // PNA in steel section
      pnaLocation = 'in-steel';
      const P = (T_steel - C_conc) / 2;  // Force in steel below PNA
      const a_steel = P * 1000 / (section.b * fy);  // Approximate depth in steel
      pnaDepth = slabThickness + haunchHeight + a_steel;
      
      // Approximate plastic moment
      const Zx = section.Zpx;  // Steel plastic modulus
      const Mp_steel = Zx * fy / 1e6;
      const M_conc_contrib = C_conc * (d_steel / 2 + haunchHeight + slabThickness / 2) / 1000;
      Mp = Mp_steel + M_conc_contrib;
    }
    
    // Design moment capacity
    const phi = 0.9;  // LRFD resistance factor
    const Mn = Mp;
    const Md = phi * Mp;
    
    // Ductility check
    const Dp = pnaDepth;
    const Dt = d_total;
    const ductilityRatio = Dp / Dt;
    const ductile = ductilityRatio <= 0.42;  // AASHTO limit
    
    if (!ductile) {
      // Reduce capacity for non-ductile section
      // Mn = Mp * (1.07 - 0.7 * Dp/Dt)
    }
    
    return {
      steelArea: As,
      concreteArea: slabWidth * slabThickness,
      transformedArea: A_comp_short,
      naSteel: y_steel_bot,
      naShortTerm: y_na_short,
      naLongTerm: y_na_long,
      Sx_steel,
      Sx_shortTerm_top: Sx_short_top,
      Sx_shortTerm_bot: Sx_short_bot,
      Sx_longTerm_top: Sx_long_top,
      Sx_longTerm_bot: Sx_long_bot,
      M_dc1,
      M_dc2,
      M_ll,
      M_total: M_u,
      stresses,
      Mp_composite: Mp,
      Mn_composite: Mn,
      Md_composite: Md,
      momentUtilization: M_u / Md,
      stressUtilization: stresses.bottomSteel / fy,
      status: M_u <= Md && stresses.bottomSteel <= fy ? 'pass' : 'fail',
      pnaLocation,
      pnaDepth,
      Dp,
      Dt,
      ductilityRatio,
      ductile,
    };
  }

  // ===========================================================================
  // SHEAR CONNECTOR DESIGN
  // ===========================================================================

  public designShearConnectors(
    compositeResult: CompositeGirderResult,
    span: number,
    studDiameter: number = 22,
    studHeight: number = 125,
    studFu: number = 450
  ): ShearConnectorResult {
    
    // Total horizontal shear at interface
    // For composite action: V_h = min(0.85*f'c*Ac, As*Fy)
    const C_conc = compositeResult.concreteArea * this.materials.fck * 0.85 / 1e6;  // MN
    const T_steel = compositeResult.steelArea * getSteelGrade(this.materials.steelGrade).fy / 1e6;
    const V_h = Math.min(C_conc, T_steel) * 1000;  // kN
    
    // Stud capacity (AASHTO)
    const Asc = Math.PI * studDiameter * studDiameter / 4;  // mm²
    const Ec = 4700 * Math.sqrt(this.materials.fck);
    
    // Strength limit
    const Qn_strength = 0.5 * Asc * Math.sqrt(this.materials.fck * Ec) / 1000;  // kN
    const Qn_fu = Asc * studFu / 1000;  // kN
    const Qn = Math.min(Qn_strength, Qn_fu);
    
    // Resistance factor
    const phi_sc = 0.85;
    const Qr = phi_sc * Qn;
    
    // Number of studs required (per half span, per flange)
    const numStudsRequired = Math.ceil(V_h / Qr);
    
    // Provide with margin
    const numStudsProvided = Math.ceil(numStudsRequired * 1.1);
    
    // Spacing
    const halfSpan = span / 2;
    const avgSpacing = halfSpan / (numStudsProvided / 2);  // mm
    
    // Variable spacing (closer at ends)
    const pitchAtEnds = Math.max(avgSpacing * 0.6, 6 * studDiameter);
    const pitchAtMiddle = Math.min(avgSpacing * 1.4, 24 * studDiameter, 600);
    const transverseSpacing = Math.min(150, 4 * studDiameter);  // For double row
    
    // Capacity check
    const interfaceCapacity = numStudsProvided * Qr;
    const utilizationRatio = V_h / interfaceCapacity;
    
    // Fatigue check (simplified)
    // Fatigue load range for studs (AASHTO)
    const Zr = 238 - 29.5 * Math.log10(2e6);  // MPa for infinite life
    const fatigueCap = Zr * Asc / 1000;  // kN per stud
    
    // Assume live load shear is 40% of total
    const V_ll = 0.4 * V_h;
    const rangePerStud = V_ll / numStudsProvided;
    const fatigueLife = Math.pow(10, (238 - rangePerStud * 1000 / Asc) / 29.5) / 1e6;
    
    return {
      studDiameter,
      studHeight,
      studCapacity: Qr,
      totalHorizontalShear: V_h,
      numStudsRequired,
      numStudsProvided,
      pitchAtEnds,
      pitchAtMiddle,
      transverseSpacing,
      interfaceCapacity,
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'pass' : 'fail',
      fatigueRange: rangePerStud,
      fatigueLife,
    };
  }

  // ===========================================================================
  // PLATE GIRDER DESIGN
  // ===========================================================================

  public designPlateGirder(input: PlateGirderInput): PlateGirderResult {
    const {
      depth, webThickness, webDepth,
      topFlangeWidth, topFlangeThickness,
      bottomFlangeWidth, bottomFlangeThickness,
      grade, Mu, Vu, span, webStiffeners, stiffenerSpacing,
    } = input;
    
    const warnings: string[] = [];
    const steelGrade = getSteelGrade(grade);
    const fy = steelGrade.fy;
    const E = steelGrade.E;
    
    // Section properties
    const Af_top = topFlangeWidth * topFlangeThickness;
    const Af_bot = bottomFlangeWidth * bottomFlangeThickness;
    const Aw = webDepth * webThickness;
    const area = Af_top + Af_bot + Aw;
    
    // Centroid
    const y_bot = (Af_bot * bottomFlangeThickness / 2 +
                   Aw * (bottomFlangeThickness + webDepth / 2) +
                   Af_top * (bottomFlangeThickness + webDepth + topFlangeThickness / 2)) / area;
    
    // Moment of inertia
    const Ix = topFlangeWidth * Math.pow(topFlangeThickness, 3) / 12 +
               Af_top * Math.pow(depth - topFlangeThickness / 2 - y_bot, 2) +
               webThickness * Math.pow(webDepth, 3) / 12 +
               Aw * Math.pow(bottomFlangeThickness + webDepth / 2 - y_bot, 2) +
               bottomFlangeWidth * Math.pow(bottomFlangeThickness, 3) / 12 +
               Af_bot * Math.pow(bottomFlangeThickness / 2 - y_bot, 2);
    
    // Section moduli
    const Sx = Ix / Math.max(y_bot, depth - y_bot);
    
    // Plastic modulus (approximate)
    const Zx = Af_top * (depth - topFlangeThickness / 2 - y_bot) +
               Af_bot * (y_bot - bottomFlangeThickness / 2) +
               Aw * webDepth / 4;  // Simplified
    
    // Section classification
    const epsilon = Math.sqrt(235 / fy);
    
    // Flange slenderness
    const c_f = (Math.max(topFlangeWidth, bottomFlangeWidth) - webThickness) / 2;
    const t_f = Math.min(topFlangeThickness, bottomFlangeThickness);
    const lambda_f = c_f / t_f;
    
    let flangeClass: number;
    if (lambda_f <= 9 * epsilon) flangeClass = 1;
    else if (lambda_f <= 10 * epsilon) flangeClass = 2;
    else if (lambda_f <= 14 * epsilon) flangeClass = 3;
    else {
      flangeClass = 4;
      warnings.push('Compression flange is Class 4 - use effective section');
    }
    
    // Web slenderness
    const lambda_w = webDepth / webThickness;
    
    let webClass: number;
    if (lambda_w <= 72 * epsilon) webClass = 1;
    else if (lambda_w <= 83 * epsilon) webClass = 2;
    else if (lambda_w <= 124 * epsilon) webClass = 3;
    else {
      webClass = 4;
      warnings.push('Web is Class 4 - consider web buckling');
    }
    
    const overallClass = Math.max(flangeClass, webClass);
    
    // Bending capacity
    let Mn: number;
    if (overallClass <= 2) {
      Mn = Zx * fy / 1e6;  // kN-m (plastic)
    } else if (overallClass === 3) {
      Mn = Sx * fy / 1e6;  // kN-m (elastic)
    } else {
      // Class 4 - reduced effective section
      const kappa = 1.0 - 0.055 * (lambda_w / epsilon - 124) / 124;
      Mn = kappa * Sx * fy / 1e6;
    }
    
    const phi_b = 0.9;
    const Md = phi_b * Mn;
    const momentUtilization = Mu / Md;
    
    // Web buckling stress
    const k_sigma = 5.34;  // Pure shear
    const tau_cr = k_sigma * Math.PI * Math.PI * E / (12 * (1 - 0.3 * 0.3) * lambda_w * lambda_w);
    
    // Shear capacity
    let Vn: number;
    let tensionFieldContribution = 0;
    const postBucklingAllowed = webStiffeners && stiffenerSpacing !== undefined;
    
    if (lambda_w <= 1.1 * Math.sqrt(k_sigma * E / fy)) {
      // Yielding shear
      Vn = Aw * fy / (Math.sqrt(3) * 1000);
    } else {
      // Buckling shear
      const lambda_bar_w = 0.76 * Math.sqrt(fy / tau_cr);
      let chi_w: number;
      
      if (lambda_bar_w < 0.83) {
        chi_w = 1.0;
      } else if (lambda_bar_w < 1.08) {
        chi_w = 0.83 / lambda_bar_w;
      } else {
        chi_w = 1.37 / (0.7 + lambda_bar_w * lambda_bar_w);
      }
      
      Vn = chi_w * Aw * fy / (Math.sqrt(3) * 1000);
      
      // Tension field action (if stiffeners present)
      if (postBucklingAllowed && stiffenerSpacing) {
        const a = stiffenerSpacing;
        const sigma_t = fy * (1 - chi_w) * Math.sqrt(1 / (1 + Math.pow(a / webDepth, 2)));
        tensionFieldContribution = sigma_t * Aw / 1000 * 0.9;
        Vn += tensionFieldContribution;
      }
    }
    
    const phi_v = 0.9;
    const Vd = phi_v * Vn;
    const shearUtilization = Vu / Vd;
    
    // Moment-shear interaction
    let combinedUtilization = momentUtilization + shearUtilization * 0.5;
    if (momentUtilization > 0.5 && shearUtilization > 0.5) {
      combinedUtilization = Math.sqrt(momentUtilization ** 2 + shearUtilization ** 2);
    }
    
    // LTB check
    const Lb = span;
    const rts = Math.sqrt(Math.sqrt(Af_top * Ix / Sx));
    const ltbSlenderness = Lb / rts;
    const Lp = 1.76 * rts * Math.sqrt(E / fy);
    const Lr = 4.44 * rts * Math.sqrt(E / fy);
    
    let ltbReduction = 1.0;
    if (Lb > Lr) {
      const Fcr = 0.9 * E * Math.PI * Math.PI / (ltbSlenderness * ltbSlenderness);
      ltbReduction = Fcr / fy;
    } else if (Lb > Lp) {
      ltbReduction = 1 - 0.3 * (Lb - Lp) / (Lr - Lp);
    }
    
    // Stiffener design
    let stiffeners;
    if (webStiffeners && stiffenerSpacing) {
      const Is_min = 1.5 * Math.pow(webDepth, 3) * Math.pow(webThickness, 3) / 
                     (stiffenerSpacing * stiffenerSpacing);
      const ts = 10;  // mm stiffener thickness
      const bs = Math.cbrt(12 * Is_min / ts);
      
      stiffeners = {
        required: lambda_w > 72 * epsilon,
        spacing: stiffenerSpacing,
        width: Math.ceil(bs / 10) * 10,
        thickness: ts,
        bearingStiffenerArea: 0,  // Not calculated
      };
    }
    
    return {
      area,
      Ix,
      Sx,
      Zx,
      flangeClass,
      webClass,
      overallClass,
      Mn,
      Md,
      momentUtilization,
      webSlenderness: lambda_w,
      webBucklingStress: tau_cr,
      postBucklingAllowed,
      Vn,
      Vd,
      shearUtilization,
      tensionFieldContribution,
      combinedUtilization,
      stiffeners,
      ltbSlenderness,
      ltbReduction,
      status: combinedUtilization <= 1.0 ? 'pass' : 'fail',
      warnings,
    };
  }

  // ===========================================================================
  // BOX GIRDER DESIGN
  // ===========================================================================

  public designBoxGirder(input: BoxGirderInput): BoxGirderResult {
    const {
      width, depth,
      topFlangeThickness, bottomFlangeThickness, webThickness,
      numWebs, grade, Mu, Vu, Tu,
    } = input;
    
    const warnings: string[] = [];
    const steelGrade = getSteelGrade(grade);
    const fy = steelGrade.fy;
    
    // Section properties
    const Af_top = width * topFlangeThickness;
    const Af_bot = width * bottomFlangeThickness;
    const Aw = numWebs * (depth - topFlangeThickness - bottomFlangeThickness) * webThickness;
    const area = Af_top + Af_bot + Aw;
    
    // Clear dimensions
    const hw = depth - topFlangeThickness - bottomFlangeThickness;
    const bw = width - 2 * webThickness;
    
    // Moment of inertia
    const Ix = width * Math.pow(depth, 3) / 12 - bw * Math.pow(hw, 3) / 12;
    
    // About y-axis
    const Iy = topFlangeThickness * Math.pow(width, 3) / 12 +
               bottomFlangeThickness * Math.pow(width, 3) / 12 +
               2 * hw * Math.pow(webThickness, 3) / 12 +
               2 * hw * webThickness * Math.pow((width - webThickness) / 2, 2);
    
    // Torsional constant (closed section)
    const Am = (width - webThickness) * (depth - (topFlangeThickness + bottomFlangeThickness) / 2);
    const perimeter_sum = 2 * (width - webThickness) / ((topFlangeThickness + bottomFlangeThickness) / 2) +
                          2 * hw / webThickness;
    const J = 4 * Am * Am / perimeter_sum;
    
    // Warping constant (approximate for box)
    const Cw = 0;  // Negligible for closed box
    
    // Shear flow under shear
    const shearFlowMax = Vu * 1000 * depth / (2 * Ix) * (Af_top + Aw / 4);  // N/mm approximate
    
    // Bending capacity
    const Sx = 2 * Ix / depth;
    const Mn = Sx * fy / 1e6;
    const phi_b = 0.9;
    const Md = phi_b * Mn;
    const momentUtilization = Mu / Md;
    
    // Shear capacity (both webs)
    const Aw_total = numWebs * hw * webThickness;
    const Vn = Aw_total * fy / (Math.sqrt(3) * 1000);
    const phi_v = 0.9;
    const Vd = phi_v * Vn;
    const shearUtilization = Vu / Vd;
    
    // Torsion capacity
    const t_min = Math.min(topFlangeThickness, bottomFlangeThickness, webThickness);
    const Tn = 2 * Am * t_min * fy / (Math.sqrt(3) * 1e6);  // kN-m
    const phi_t = 0.9;
    const Td = phi_t * Tn;
    const torsionUtilization = Tu / Td;
    
    // Combined check
    const combinedUtilization = Math.sqrt(
      momentUtilization ** 2 + shearUtilization ** 2 + torsionUtilization ** 2
    );
    
    // Distortion check
    const distortionStress = Tu * 1e6 * width / (4 * J);  // Simplified
    const distortionOk = distortionStress < 0.1 * fy;
    
    if (!distortionOk) {
      warnings.push('High distortional stress - add intermediate diaphragms');
    }
    
    return {
      area,
      Ix,
      Iy,
      J,
      Cw,
      shearFlowMax,
      Mn,
      Md,
      momentUtilization,
      Vn,
      Vd,
      shearUtilization,
      Tn,
      Td,
      torsionUtilization,
      combinedUtilization,
      distortionStress,
      distortionOk,
      status: combinedUtilization <= 1.0 && distortionOk ? 'pass' : 'fail',
      warnings,
    };
  }

  // ===========================================================================
  // LIVE LOAD DISTRIBUTION
  // ===========================================================================

  public calculateDistributionFactors(): {
    momentInterior: number;
    momentExterior: number;
    shearInterior: number;
    shearExterior: number;
  } {
    const { span, numGirders, girderSpacing, deckWidth } = this.geometry;
    const S = girderSpacing;  // m
    const L = span;           // m
    const Nb = numGirders;
    
    // AASHTO LRFD Distribution factors (for concrete deck on steel/concrete girders)
    // Moment - Interior girder (single lane)
    const gm1_int = 0.06 + Math.pow(S / 4.27, 0.4) * Math.pow(S / L, 0.3);
    // Two or more lanes
    const gm2_int = 0.075 + Math.pow(S / 2.9, 0.6) * Math.pow(S / L, 0.2);
    
    // Moment - Exterior girder
    const e_moment = 0.77 + S / 2.8;  // Lever rule factor
    const gm_ext = e_moment * gm2_int;
    
    // Shear - Interior girder
    const gv1_int = 0.36 + S / 7.6;
    const gv2_int = 0.2 + S / 3.6 - Math.pow(S / 10.7, 2);
    
    // Shear - Exterior
    const e_shear = 0.6 + S / 3.0;
    const gv_ext = e_shear * gv2_int;
    
    return {
      momentInterior: Math.max(gm1_int, gm2_int),
      momentExterior: gm_ext,
      shearInterior: Math.max(gv1_int, gv2_int),
      shearExterior: gv_ext,
    };
  }

  // ===========================================================================
  // COMPLETE BRIDGE DECK DESIGN
  // ===========================================================================

  public design(bridgeType: BridgeType): BridgeDeckDesignResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Calculate distribution factors
    const distributionFactors = this.calculateDistributionFactors();
    
    // Calculate load effects
    const { span, numGirders, girderSpacing, deckWidth, numLanes } = this.geometry;
    const L = span / 1000;  // m
    
    // Dead load per girder (simplified)
    const deckArea = girderSpacing * span;
    const deckWeight = 0.25 * 25 * girderSpacing;  // 250mm slab
    const surfacing = 0.08 * 22 * girderSpacing;   // 80mm surfacing
    const girderWeight = 2.0;  // kN/m estimate for steel girder
    const deadLoadPerGirder = deckWeight + surfacing + girderWeight;
    
    // Live load (using distribution factors)
    const laneLoad = 9.3;  // kN/m (AASHTO)
    const truckMoment = 1.33 * (145 * L / 4 + 145 * L / 4 * 0.5 + 35 * 0);  // Approximate
    const laneMoment = laneLoad * L * L / 8;
    
    // Distributed to girder
    const liveLoadMoment = distributionFactors.momentInterior * (truckMoment + laneMoment);
    const deadLoadMoment = deadLoadPerGirder * L * L / 8;
    
    // Factored moments
    const totalMoment = 1.25 * deadLoadMoment + 1.75 * liveLoadMoment;
    
    // Shear
    const deadLoadShear = deadLoadPerGirder * L / 2;
    const liveLoadShear = distributionFactors.shearInterior * (145 + 145 + 35 + laneLoad * L) * 0.5;
    const totalShear = 1.25 * deadLoadShear + 1.75 * liveLoadShear;
    
    const loadEffects = {
      deadLoadMoment,
      liveLoadMoment,
      totalMoment,
      deadLoadShear,
      liveLoadShear,
      totalShear,
      liveLoadReaction: 1.75 * liveLoadShear,
    };
    
    // Design deck slab
    const deckSlabInput: DeckSlabInput = {
      thickness: 250,
      span: girderSpacing * 1000,
      overhang: this.geometry.overhang * 1000,
      fck: this.materials.fck,
      fsy: this.materials.fsy,
      cover: 50,
      surfacing: 1.8,
      barriers: 5,
    };
    const deckSlab = this.designDeckSlab(deckSlabInput);
    
    // Design girders based on bridge type
    const girders: (CompositeGirderResult | PlateGirderResult)[] = [];
    let shearConnectors: ShearConnectorResult | undefined;
    
    if (bridgeType === 'steel-composite' || bridgeType === 'plate-girder') {
      // Select/design steel girder
      // For L < 30m, use rolled sections; otherwise plate girder
      
      if (L < 30) {
        // Use standard section
        const requiredSx = totalMoment * 1e6 / (0.9 * getSteelGrade(this.materials.steelGrade).fy);
        
        // Find suitable section (simplified)
        const section = findSection('W920x449') || findSection('ISWB600');
        
        if (section) {
          const compositeInput: CompositeGirderInput = {
            steelSection: section,
            steelGrade: this.materials.steelGrade,
            slabWidth: Math.min(girderSpacing * 1000, L * 1000 / 4),
            slabThickness: 250,
            fck: this.materials.fck,
            span: span,
            deadLoadSteel: section.mass * 9.81 / 1000,
            deadLoadConcrete: deckWeight,
            deadLoadSuperimposed: surfacing,
            liveLoad: liveLoadMoment * 8 / (L * L),
            liveLoadMoment: liveLoadMoment,
            shored: false,
          };
          
          const compositeResult = this.designCompositeGirder(compositeInput);
          girders.push(compositeResult);
          
          shearConnectors = this.designShearConnectors(
            compositeResult,
            span,
            this.materials.studDiameter || 22,
            this.materials.studHeight || 125,
            this.materials.studFu || 450
          );
        }
      } else {
        // Plate girder design
        const requiredDepth = L * 1000 / 20;  // Span/depth ~ 20
        
        const plateGirderInput: PlateGirderInput = {
          span,
          depth: requiredDepth,
          webThickness: Math.max(12, requiredDepth / 150),
          webDepth: requiredDepth - 80,
          topFlangeWidth: 400,
          topFlangeThickness: 40,
          bottomFlangeWidth: 450,
          bottomFlangeThickness: 50,
          webStiffeners: true,
          stiffenerSpacing: 2000,
          grade: this.materials.steelGrade,
          Mu: totalMoment,
          Vu: totalShear,
        };
        
        const plateGirderResult = this.designPlateGirder(plateGirderInput);
        girders.push(plateGirderResult);
      }
    }
    
    // Determine critical element
    let criticalCheck = 'Moment';
    let maxUtilization = 0;
    
    if (deckSlab.status === 'fail') {
      warnings.push('Deck slab design inadequate');
    }
    
    for (const girder of girders) {
      if ('momentUtilization' in girder) {
        if (girder.momentUtilization > maxUtilization) {
          maxUtilization = girder.momentUtilization;
          criticalCheck = 'Girder moment';
        }
      }
    }
    
    if (shearConnectors && shearConnectors.utilizationRatio > maxUtilization) {
      maxUtilization = shearConnectors.utilizationRatio;
      criticalCheck = 'Shear connectors';
    }
    
    const overallStatus = maxUtilization <= 1.0 && deckSlab.status === 'pass' ? 'pass' : 'fail';
    
    // Quantities
    const steelWeight = girders.reduce((sum, g) => {
      if ('area' in g) {
        return sum + g.area * span / 1e6 * 7.85;  // tonnes
      }
      return sum + ('steelArea' in g ? g.steelArea : 0) * span / 1e6 * 7.85;
    }, 0) * numGirders;
    
    const concreteVolume = deckWidth * span / 1000 * 0.25;  // m³
    const rebarWeight = concreteVolume * 150 / 1000;  // 150 kg/m³ assumed
    
    // Recommendations
    if (maxUtilization > 0.95) {
      recommendations.push('Design is highly optimized - consider margin for construction tolerances');
    }
    if (maxUtilization < 0.7) {
      recommendations.push('Design can be optimized - consider reducing girder size');
    }
    
    return {
      geometry: this.geometry,
      bridgeType,
      deckSlab,
      girders: girders as any[],
      shearConnectors,
      loadEffects,
      distributionFactors,
      overallStatus,
      criticalCheck,
      maxUtilization,
      quantities: {
        steelWeight,
        concreteVolume,
        rebarWeight,
      },
      warnings,
      recommendations,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Quick design for standard highway bridge
 */
export function designHighwayBridge(
  span: number,              // m
  deckWidth: number,         // m
  numLanes: number,
  bridgeType: BridgeType = 'steel-composite'
): BridgeDeckDesignResult {
  
  const numGirders = numLanes + 2;  // Rule of thumb
  const girderSpacing = (deckWidth - 1.5) / (numGirders - 1);
  
  const geometry: BridgeGeometry = {
    span: span * 1000,
    deckWidth,
    carriageWidth: numLanes * 3.5,
    numLanes,
    numGirders,
    girderSpacing,
    overhang: 0.75,
  };
  
  const materials: BridgeMaterials = {
    fck: 40,
    steelGrade: 'A572-50',
    steelCode: 'AISC360',
    fsy: 500,
    studDiameter: 22,
    studHeight: 125,
    studFu: 450,
  };
  
  const engine = new BridgeDeckDesignEngine(geometry, materials, 'AASHTO');
  return engine.design(bridgeType);
}

// =============================================================================
// EXPORTS - Note: items are already exported with 'export const/class' above
// =============================================================================

export default BridgeDeckDesignEngine;
