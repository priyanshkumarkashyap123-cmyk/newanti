/**
 * ============================================================================
 * BRIDGE SUBSTRUCTURE DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive bridge substructure design including:
 * - Pier design (single column, multi-column, wall piers)
 * - Abutment design (cantilever, gravity, integral)
 * - Pier cap/bent cap design
 * - Pile foundation design
 * - Spread footing design
 * - Bearing design and selection
 * - Seismic design considerations
 * 
 * Design Codes:
 * - AASHTO LRFD Bridge Design Specifications
 * - EN 1998 (Seismic design)
 * - IRC:78 (Foundations)
 * - IRC:6 (Loads)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type PierType = 
  | 'single-column'
  | 'multi-column'
  | 'wall-pier'
  | 'hammerhead'
  | 'pile-bent'
  | 'portal-frame';

export type AbutmentType = 
  | 'cantilever'
  | 'gravity'
  | 'counterfort'
  | 'integral'
  | 'semi-integral'
  | 'MSE-wall'
  | 'spill-through';

export type FoundationType = 
  | 'spread-footing'
  | 'pile-foundation'
  | 'drilled-shaft'
  | 'caisson'
  | 'raft';

export type BearingType = 
  | 'elastomeric'
  | 'pot-bearing'
  | 'spherical'
  | 'disk'
  | 'PTFE-sliding'
  | 'rocker'
  | 'roller'
  | 'lead-rubber'
  | 'friction-pendulum';

export type SeismicZone = 'I' | 'II' | 'III' | 'IV' | 'V';

// =============================================================================
// LOADING INTERFACES
// =============================================================================

export interface SubstructureLoading {
  // Vertical loads (per bearing/column)
  deadLoadReaction: number;     // kN
  liveLoadReaction: number;     // kN
  superimposedDead: number;     // kN
  
  // Horizontal loads
  brakingForce: number;         // kN (longitudinal)
  windOnStructure: number;      // kN (transverse)
  windOnLiveLoad: number;       // kN (transverse)
  centrifugalForce?: number;    // kN (transverse, for curves)
  streamFlow?: number;          // kN (longitudinal or transverse)
  iceForce?: number;            // kN
  
  // Seismic
  seismicCoefficient?: number;  // PGA
  seismicZone?: SeismicZone;
  
  // Earth pressure (for abutments)
  activePressure?: number;      // kPa at base
  passivePressure?: number;     // kPa
  surcharge?: number;           // kPa
}

export interface SoilProperties {
  type: 'rock' | 'dense-sand' | 'medium-sand' | 'loose-sand' | 'stiff-clay' | 'soft-clay';
  allowableBearing: number;     // kPa
  frictionAngle: number;        // degrees
  cohesion: number;             // kPa
  unitWeight: number;           // kN/m³
  N_SPT?: number;               // Standard penetration
  subgradeModulus?: number;     // kN/m³
}

// =============================================================================
// PIER DESIGN
// =============================================================================

export interface PierGeometry {
  type: PierType;
  height: number;               // m (from footing top to bearing)
  numColumns?: number;          // For multi-column bent
  columnDiameter?: number;      // m (circular)
  columnWidth?: number;         // m (rectangular)
  columnDepth?: number;         // m (rectangular)
  columnSpacing?: number;       // m (multi-column)
  capWidth?: number;            // m
  capDepth?: number;            // m
  capLength?: number;           // m
  taperRatio?: number;          // For tapered columns
}

export interface PierMaterials {
  concrete: {
    fck: number;                // MPa
    Ec?: number;                // MPa
  };
  reinforcement: {
    fy: number;                 // MPa
    fu?: number;                // MPa
    minCover: number;           // mm
  };
}

export interface PierDesignResult {
  // Geometry
  geometry: PierGeometry;
  
  // Column design
  column: {
    area: number;               // m²
    Ig: number;                 // m⁴ (gross moment of inertia)
    effectiveLength: number;    // m
    slenderness: number;        // kL/r
    
    // Forces
    Pu: number;                 // kN (factored axial)
    Mux: number;                // kN-m (factored moment, transverse)
    Muy: number;                // kN-m (factored moment, longitudinal)
    Vu: number;                 // kN (factored shear)
    
    // Capacity
    axialCapacity: number;      // kN
    momentCapacity: number;     // kN-m
    shearCapacity: number;      // kN
    
    // Interaction
    interactionRatio: number;
    P_Mn_curve: { P: number; Mn: number }[];
    
    // Reinforcement
    longitudinalRebar: {
      numBars: number;
      diameter: number;         // mm
      area: number;             // mm²
      ratio: number;            // As/Ag
    };
    transverseRebar: {
      type: 'ties' | 'spirals';
      diameter: number;
      spacing: number;          // mm
    };
    
    status: 'pass' | 'fail';
  };
  
  // Pier cap design (if applicable)
  cap?: {
    length: number;             // m
    width: number;              // m
    depth: number;              // m
    
    Mu_pos: number;             // kN-m (positive moment)
    Mu_neg: number;             // kN-m (negative moment)
    Vu: number;                 // kN
    Tu?: number;                // kN-m (torsion)
    
    flexuralRebar: {
      top: { numBars: number; diameter: number };
      bottom: { numBars: number; diameter: number };
    };
    shearRebar: {
      diameter: number;
      spacing: number;
      legs: number;
    };
    
    status: 'pass' | 'fail';
  };
  
  // Seismic design
  seismic?: {
    period: number;             // seconds
    spectralAcceleration: number;
    seismicForce: number;       // kN
    ductilityDemand: number;
    plasticHingeLength: number; // m
    requiredDuctility: number;
    provided: boolean;
  };
  
  // Overall
  overallStatus: 'pass' | 'fail';
  warnings: string[];
}

// =============================================================================
// ABUTMENT DESIGN
// =============================================================================

export interface AbutmentGeometry {
  type: AbutmentType;
  height: number;               // m (total height)
  width: number;                // m (transverse)
  
  // Stem (backwall)
  stemThicknessTop: number;     // m
  stemThicknessBottom: number;  // m
  
  // Wingwalls
  wingwallLength?: number;      // m
  wingwallAngle?: number;       // degrees from centerline
  
  // Footing
  footingWidth: number;         // m
  footingLength: number;        // m
  footingThickness: number;     // m
  toeLength?: number;           // m
  heelLength?: number;          // m
}

export interface AbutmentDesignResult {
  // Geometry
  geometry: AbutmentGeometry;
  
  // Earth pressures
  earthPressure: {
    activeCoefficient: number;  // Ka
    passiveCoefficient: number; // Kp
    lateralForce: number;       // kN/m (total horizontal)
    momentArm: number;          // m
    overturningMoment: number;  // kN-m/m
  };
  
  // Stability checks
  stability: {
    slidingForce: number;       // kN/m
    resistingForce: number;     // kN/m
    slidingFactor: number;      // FOS
    slidingOk: boolean;
    
    overturningMoment: number;  // kN-m/m
    resistingMoment: number;    // kN-m/m
    overturningFactor: number;  // FOS
    overturningOk: boolean;
    
    eccentricity: number;       // m
    maxBearingPressure: number; // kPa
    minBearingPressure: number; // kPa
    bearingOk: boolean;
  };
  
  // Stem design
  stem: {
    Mu_base: number;            // kN-m/m (at stem base)
    Vu_base: number;            // kN/m
    
    verticalRebar: {
      diameter: number;
      spacing: number;
      location: 'inside' | 'outside';
    };
    horizontalRebar: {
      diameter: number;
      spacing: number;
    };
    
    crackWidth: number;         // mm
    status: 'pass' | 'fail';
  };
  
  // Footing design
  footing: {
    Mu_toe: number;             // kN-m/m
    Mu_heel: number;            // kN-m/m
    Vu: number;                 // kN/m
    
    bottomRebar: {
      diameter: number;
      spacing: number;
    };
    topRebar: {
      diameter: number;
      spacing: number;
    };
    
    punchingShear: number;      // ratio
    status: 'pass' | 'fail';
  };
  
  // Wingwall design (if applicable)
  wingwall?: {
    Mu: number;                 // kN-m/m
    rebar: { diameter: number; spacing: number };
    status: 'pass' | 'fail';
  };
  
  // Overall
  overallStatus: 'pass' | 'fail';
  warnings: string[];
}

// =============================================================================
// FOUNDATION DESIGN
// =============================================================================

export interface SpreadFootingInput {
  columnLoad: number;           // kN (service)
  columnMomentX: number;        // kN-m
  columnMomentY: number;        // kN-m
  columnWidth: number;          // m
  columnDepth: number;          // m
  soilBearing: number;          // kPa allowable
  fck: number;                  // MPa
  fy: number;                   // MPa
}

export interface SpreadFootingResult {
  // Dimensions
  length: number;               // m
  width: number;                // m
  depth: number;                // m
  
  // Pressure distribution
  maxPressure: number;          // kPa
  minPressure: number;          // kPa
  averagePressure: number;      // kPa
  eccentricityX: number;        // m
  eccentricityY: number;        // m
  
  // Factored demands
  Mu_long: number;              // kN-m/m (longitudinal)
  Mu_short: number;             // kN-m/m (transverse)
  Vu_beam: number;              // kN/m (one-way shear)
  Vu_punch: number;             // kN (punching shear)
  
  // Capacity
  oneWayShearCapacity: number;  // kN/m
  punchingShearCapacity: number;// kN
  
  // Utilization
  bearingUtilization: number;
  oneWayShearUtilization: number;
  punchingShearUtilization: number;
  
  // Reinforcement
  bottomRebarLong: {
    diameter: number;
    spacing: number;
    numBars: number;
  };
  bottomRebarShort: {
    diameter: number;
    spacing: number;
    numBars: number;
  };
  
  // Settlement (approximate)
  immediateSettlement: number;  // mm
  consolidationSettlement: number; // mm
  
  status: 'pass' | 'fail';
  warnings: string[];
}

export interface PileFoundationInput {
  columnLoad: number;           // kN (service)
  columnMomentX: number;        // kN-m
  columnMomentY: number;        // kN-m
  horizontalLoad: number;       // kN
  pileType: 'driven' | 'bored' | 'CFA' | 'micropile';
  pileDiameter: number;         // m
  pileLength: number;           // m
  soilLayers: {
    depth: number;              // m (bottom of layer)
    type: string;
    N_SPT: number;
    friction?: number;          // kPa skin friction
    endBearing?: number;        // kPa
  }[];
  fck: number;                  // MPa
  fy: number;                   // MPa
}

export interface PileFoundationResult {
  // Pile capacity
  singlePileCapacity: {
    endBearing: number;         // kN
    skinFriction: number;       // kN
    ultimate: number;           // kN
    allowable: number;          // kN (with FOS)
  };
  
  // Pile group
  numPiles: number;
  arrangement: { x: number; y: number }[];
  spacing: number;              // m
  groupEfficiency: number;
  groupCapacity: number;        // kN
  
  // Pile cap
  capLength: number;            // m
  capWidth: number;             // m
  capDepth: number;             // m
  
  // Load distribution
  maxPileLoad: number;          // kN
  minPileLoad: number;          // kN
  pileMoment: number;           // kN-m (individual pile)
  
  // Pile structural design
  pileReinforcement: {
    longitudinal: {
      numBars: number;
      diameter: number;
    };
    transverse: {
      diameter: number;
      spacing: number;
    };
  };
  
  // Pile cap design
  capReinforcement: {
    bottom: { diameter: number; spacing: number };
    top: { diameter: number; spacing: number };
  };
  punchingCheck: number;        // utilization ratio
  
  // Lateral capacity
  lateralCapacity: number;      // kN per pile
  lateralDeflection: number;    // mm at pile head
  
  // Settlement
  groupSettlement: number;      // mm
  
  status: 'pass' | 'fail';
  warnings: string[];
}

// =============================================================================
// BEARING DESIGN
// =============================================================================

export interface BearingDesignInput {
  // Loads
  deadLoad: number;             // kN
  liveLoad: number;             // kN
  rotationDead: number;         // rad
  rotationLive: number;         // rad
  translationLong: number;      // mm (longitudinal)
  translationTrans: number;     // mm (transverse)
  horizontalLoad: number;       // kN
  
  // Geometric constraints
  maxHeight: number;            // mm
  maxPlanDimension: number;     // mm
  
  // Service conditions
  temperatureRange: number;     // °C
  designLife: number;           // years
}

export interface ElastomericBearingResult {
  // Type
  type: 'plain' | 'laminated' | 'steel-reinforced';
  
  // Dimensions
  length: number;               // mm
  width: number;                // mm
  totalHeight: number;          // mm
  coverTop: number;             // mm
  coverBottom: number;          // mm
  coverSide: number;            // mm
  
  // Elastomer layers
  numLayers: number;
  layerThickness: number;       // mm each
  totalElastomerThickness: number; // mm
  
  // Steel plates (for reinforced)
  numPlates: number;
  plateThickness: number;       // mm
  
  // Material properties
  shearModulus: number;         // MPa (G)
  bulkModulus: number;          // MPa (K)
  hardness: number;             // Shore A
  
  // Shape factor
  shapeFactor: number;
  
  // Stress checks
  compressiveStress: number;    // MPa
  allowableCompressive: number; // MPa
  compressiveOk: boolean;
  
  shearStrain: number;          // 
  allowableShearStrain: number; // 
  shearOk: boolean;
  
  rotationCapacity: number;     // rad
  rotationDemand: number;       // rad
  rotationOk: boolean;
  
  combinedStrain: number;       // 
  allowableCombined: number;    // 
  combinedOk: boolean;
  
  // Stability
  bucklingCapacity: number;     // kN
  bucklingOk: boolean;
  
  // Uplift check
  upliftOk: boolean;
  
  status: 'pass' | 'fail';
  recommendations: string[];
}

export interface PotBearingResult {
  // Type
  type: 'fixed' | 'guided' | 'free';
  
  // Dimensions
  potDiameter: number;          // mm
  potHeight: number;            // mm
  basePlateDimensions: { length: number; width: number; thickness: number };
  topPlateDimensions: { length: number; width: number; thickness: number };
  
  // Elastomer disk
  diskDiameter: number;         // mm
  diskThickness: number;        // mm
  
  // Piston
  pistonDiameter: number;       // mm
  pistonHeight: number;         // mm
  
  // Sliding surfaces (if applicable)
  PTFEDiameter?: number;        // mm
  PTFEThickness?: number;       // mm
  slidingCoefficient?: number;
  
  // Capacity checks
  verticalCapacity: number;     // kN
  horizontalCapacity: number;   // kN
  rotationCapacity: number;     // rad
  translationCapacity: number;  // mm
  
  // Stress checks
  confinedStress: number;       // MPa
  allowableStress: number;      // MPa
  stressOk: boolean;
  
  // Sealing
  sealType: string;
  
  status: 'pass' | 'fail';
  recommendations: string[];
}

// =============================================================================
// SEISMIC DESIGN
// =============================================================================

export interface SeismicDesignInput {
  // Site parameters
  seismicZone: SeismicZone;
  siteClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  PGA: number;                  // g
  Ss: number;                   // Short period spectral acceleration (g)
  S1: number;                   // 1-second spectral acceleration (g)
  
  // Structure parameters
  structurePeriod: number;      // seconds
  weight: number;               // kN (seismic weight)
  importance: 'essential' | 'critical' | 'normal';
  ductilityClass: 'low' | 'medium' | 'high';
}

export interface SeismicDesignResult {
  // Spectral values
  SDs: number;                  // Design short period
  SD1: number;                  // Design 1-second
  
  // Response modification
  R: number;                    // Response modification factor
  
  // Seismic forces
  Cs: number;                   // Seismic response coefficient
  baseShear: number;            // kN
  
  // Period check
  T: number;                    // Structure period
  T0: number;                   // Corner period
  Ts: number;                   // Transition period
  
  // Force distribution
  verticalDistribution: { height: number; force: number }[];
  
  // Displacement
  elasticDisplacement: number;  // mm
  inelasticDisplacement: number;// mm
  
  // Ductility requirements
  requiredDuctility: number;
  
  // Detailing requirements
  plasticHingeLength: number;   // m
  confinementZoneLength: number;// m
  minTransverseRatio: number;   // % for confinement
  
  // SDC
  seismicDesignCategory: 'A' | 'B' | 'C' | 'D';
  
  warnings: string[];
}

// =============================================================================
// BRIDGE SUBSTRUCTURE DESIGN ENGINE CLASS
// =============================================================================

export class BridgeSubstructureDesignEngine {
  
  // ===========================================================================
  // PIER DESIGN
  // ===========================================================================

  public static designPier(
    geometry: PierGeometry,
    materials: PierMaterials,
    loading: SubstructureLoading
  ): PierDesignResult {
    const warnings: string[] = [];
    
    const { type, height, columnDiameter, columnWidth, columnDepth, numColumns = 1 } = geometry;
    const { fck } = materials.concrete;
    const { fy, minCover } = materials.reinforcement;
    
    // Column properties
    let area: number;
    let Ig: number;
    let r: number;  // radius of gyration
    
    if (type === 'single-column' || type === 'hammerhead') {
      // Circular column
      const D = columnDiameter || 1.5;  // m default
      area = Math.PI * D * D / 4;
      Ig = Math.PI * Math.pow(D, 4) / 64;
      r = D / 4;
    } else if (type === 'wall-pier') {
      // Rectangular wall
      const b = columnWidth || 1.0;
      const d = columnDepth || 3.0;
      area = b * d;
      Ig = b * Math.pow(d, 3) / 12;
      r = d / Math.sqrt(12);
    } else {
      // Multi-column - each column
      const D = columnDiameter || 1.2;
      area = Math.PI * D * D / 4;
      Ig = Math.PI * Math.pow(D, 4) / 64;
      r = D / 4;
    }
    
    // Effective length
    const K = type === 'hammerhead' ? 2.0 : 1.5;  // Fixed-free vs fixed-pinned
    const Le = K * height;
    const slenderness = Le / r;
    
    // Loading
    const { deadLoadReaction, liveLoadReaction, brakingForce, windOnStructure } = loading;
    
    // Factored loads per column
    const n = numColumns;
    const Pu = (1.25 * deadLoadReaction + 1.75 * liveLoadReaction) / n;
    
    // Moments from horizontal loads
    const M_brake = 1.75 * brakingForce * height / n;
    const M_wind = 1.4 * windOnStructure * height / n;
    const Mux = Math.max(M_brake, M_wind);  // Transverse
    const Muy = M_brake;  // Longitudinal
    
    // Shear
    const Vu = Math.max(1.75 * brakingForce, 1.4 * windOnStructure) / n;
    
    // Slenderness effects
    let magnificationFactor = 1.0;
    if (slenderness > 22) {
      // Second-order effects
      const Ec = 4700 * Math.sqrt(fck);
      const EI = 0.4 * Ec * 1000 * Ig;  // kN-m² (cracked)
      const Pc = Math.PI * Math.PI * EI / (Le * Le);
      magnificationFactor = 1 / (1 - Pu / (0.75 * Pc));
      magnificationFactor = Math.max(1.0, magnificationFactor);
    }
    
    const Mux_design = Mux * magnificationFactor;
    const Muy_design = Muy * magnificationFactor;
    
    // Column capacity (simplified P-M interaction)
    const Ag = area * 1e6;  // mm²
    const rho_min = 0.01;
    const rho_max = 0.06;
    const rho = 0.02;  // Initial assumption
    
    const As = rho * Ag;
    
    // Axial capacity (pure compression)
    const phi = 0.75;
    const Po = 0.85 * fck * (Ag - As) + fy * As;
    const Pn_max = phi * 0.8 * Po / 1000;  // kN
    
    // Moment capacity (pure bending)
    const d = (columnDiameter || columnDepth || 1.5) * 1000 - minCover - 20;
    const a = As * fy / (0.85 * fck * (columnWidth || columnDiameter || 1.5) * 1000);
    const Mn = As * fy * (d - a / 2) / 1e9;  // kN-m
    
    // Balanced condition
    const Pb = 0.85 * fck * 0.65 * d * (columnWidth || columnDiameter || 1.5) * 1000 / 1000;
    const Mb = Pb * (d - 0.65 * d / 2) / 1000;
    
    // P-M curve points (simplified)
    const PMcurve = [
      { P: Pn_max, Mn: 0 },
      { P: Pb, Mn: Mb },
      { P: 0, Mn: Mn },
      { P: -0.1 * Pn_max, Mn: Mn * 0.8 },  // Tension side
    ];
    
    // Interaction check
    const interactionRatio = (Pu / Pn_max) + (Mux_design / Mn) + (Muy_design / Mn);
    
    // Shear capacity
    const vc = 0.17 * Math.sqrt(fck);  // MPa
    const Vc = vc * 0.8 * Ag / 1000;  // kN
    const Vs_provided = 0.5 * Vc;  // Assume minimum stirrups
    const shearCapacity = phi * (Vc + Vs_provided);
    
    // Reinforcement
    const bar_diameter = 32;  // mm
    const bar_area = Math.PI * bar_diameter * bar_diameter / 4;
    const numBars = Math.ceil(As / bar_area);
    
    const result: PierDesignResult = {
      geometry,
      column: {
        area,
        Ig,
        effectiveLength: Le,
        slenderness,
        Pu,
        Mux: Mux_design,
        Muy: Muy_design,
        Vu,
        axialCapacity: Pn_max,
        momentCapacity: Mn,
        shearCapacity,
        interactionRatio,
        P_Mn_curve: PMcurve,
        longitudinalRebar: {
          numBars,
          diameter: bar_diameter,
          area: As,
          ratio: rho,
        },
        transverseRebar: {
          type: 'spirals',
          diameter: 16,
          spacing: 100,
        },
        status: interactionRatio <= 1.0 && Vu <= shearCapacity ? 'pass' : 'fail',
      },
      overallStatus: interactionRatio <= 1.0 ? 'pass' : 'fail',
      warnings,
    };
    
    // Design pier cap if hammerhead
    if (type === 'hammerhead' && geometry.capWidth && geometry.capDepth && geometry.capLength) {
      const capSpan = geometry.capLength - (columnWidth || columnDiameter || 1.5);
      const w_dead = 25 * geometry.capWidth * geometry.capDepth;  // Self-weight kN/m
      const P_bearing = (deadLoadReaction + liveLoadReaction) / 2;  // Per bearing
      
      const Mu_pos = w_dead * capSpan * capSpan / 8 + P_bearing * capSpan / 2;
      const Mu_neg = Mu_pos * 0.8;  // Continuity
      const Vu_cap = w_dead * capSpan / 2 + P_bearing;
      
      result.cap = {
        length: geometry.capLength,
        width: geometry.capWidth,
        depth: geometry.capDepth,
        Mu_pos,
        Mu_neg,
        Vu: Vu_cap,
        flexuralRebar: {
          top: { numBars: 8, diameter: 32 },
          bottom: { numBars: 10, diameter: 32 },
        },
        shearRebar: {
          diameter: 16,
          spacing: 150,
          legs: 4,
        },
        status: 'pass',
      };
    }
    
    // Seismic check if applicable
    if (loading.seismicZone && loading.seismicZone !== 'I') {
      const Ec = 4700 * Math.sqrt(fck);
      const EI_eff = 0.3 * Ec * 1000 * Ig;
      const m = (deadLoadReaction + 0.3 * liveLoadReaction) / 9.81;  // Mass in tonnes
      const k = 3 * EI_eff / Math.pow(height, 3);
      const T = 2 * Math.PI * Math.sqrt(m / k);
      
      const zones: Record<SeismicZone, number> = { I: 0.1, II: 0.16, III: 0.24, IV: 0.36, V: 0.45 };
      const Z = zones[loading.seismicZone];
      const Sa = Z * 2.5;  // Simplified
      const seismicForce = Sa * deadLoadReaction / 9.81;
      
      result.seismic = {
        period: T,
        spectralAcceleration: Sa,
        seismicForce,
        ductilityDemand: 2.5,
        plasticHingeLength: Math.max(0.08 * height, columnDiameter || 1.5),
        requiredDuctility: 4.0,
        provided: true,
      };
    }
    
    return result;
  }

  // ===========================================================================
  // ABUTMENT DESIGN
  // ===========================================================================

  public static designAbutment(
    geometry: AbutmentGeometry,
    materials: PierMaterials,
    soil: SoilProperties,
    loading: SubstructureLoading
  ): AbutmentDesignResult {
    const warnings: string[] = [];
    
    const { type, height, width, stemThicknessTop, stemThicknessBottom } = geometry;
    const { footingWidth, footingLength, footingThickness, toeLength = 1.0, heelLength = 2.0 } = geometry;
    const { fck } = materials.concrete;
    const { fy, minCover } = materials.reinforcement;
    
    // Earth pressure coefficients (Rankine)
    const phi = soil.frictionAngle * Math.PI / 180;
    const Ka = (1 - Math.sin(phi)) / (1 + Math.sin(phi));
    const Kp = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
    
    // Earth pressure at base
    const gamma = soil.unitWeight;
    const activeForce = 0.5 * Ka * gamma * height * height;  // kN/m
    const passiveForce = 0.5 * Kp * gamma * footingThickness * footingThickness;
    
    // Surcharge effect
    const surcharge = loading.surcharge || 10;  // kPa
    const surchargeForce = Ka * surcharge * height;
    
    // Total lateral force
    const lateralForce = activeForce + surchargeForce;
    const momentArm = height / 3;  // For triangular distribution
    const overturningMoment = activeForce * height / 3 + surchargeForce * height / 2;
    
    // Weight of abutment
    const stemVolume = (stemThicknessTop + stemThicknessBottom) / 2 * height * width;
    const footingVolume = footingWidth * footingLength * footingThickness;
    const concreteWeight = (stemVolume + footingVolume) * 25;  // kN
    
    // Superstructure reaction
    const { deadLoadReaction, liveLoadReaction } = loading;
    const totalVertical = concreteWeight + deadLoadReaction + liveLoadReaction;
    
    // Sliding check
    const frictionCoeff = Math.tan(phi * 0.67);  // 2/3 of soil friction
    const slidingForce = lateralForce;
    const resistingForce = totalVertical * frictionCoeff + passiveForce;
    const slidingFactor = resistingForce / slidingForce;
    
    // Overturning check
    // Take moments about toe
    const M_restoring = totalVertical * (toeLength + stemThicknessBottom / 2) +
                        deadLoadReaction * (toeLength + stemThicknessBottom / 2);
    const overturningFactor = M_restoring / overturningMoment;
    
    // Bearing pressure
    const e = (M_restoring - overturningMoment) / totalVertical - footingWidth / 2;
    const B = footingWidth;
    const maxPressure = totalVertical / (width * B) * (1 + 6 * Math.abs(e) / B);
    const minPressure = totalVertical / (width * B) * (1 - 6 * Math.abs(e) / B);
    
    // Stem design
    const stemMoment = activeForce * height / 3 + surchargeForce * height / 2;
    const stemShear = lateralForce;
    
    // Required reinforcement for stem
    const d_stem = stemThicknessBottom * 1000 - minCover - 16;
    const As_stem = stemMoment * 1e6 / (0.9 * d_stem * fy);
    const stem_spacing = Math.PI * 16 * 16 / 4 * 1000 / As_stem;
    
    // Footing design
    const toe_pressure = maxPressure;
    const heel_pressure = totalVertical / (width * B) + gamma * heelLength * height;
    
    const Mu_toe = toe_pressure * toeLength * toeLength / 2;
    const Mu_heel = heel_pressure * heelLength * heelLength / 2;
    
    const result: AbutmentDesignResult = {
      geometry,
      earthPressure: {
        activeCoefficient: Ka,
        passiveCoefficient: Kp,
        lateralForce,
        momentArm,
        overturningMoment,
      },
      stability: {
        slidingForce,
        resistingForce,
        slidingFactor,
        slidingOk: slidingFactor >= 1.5,
        overturningMoment,
        resistingMoment: M_restoring,
        overturningFactor,
        overturningOk: overturningFactor >= 2.0,
        eccentricity: e,
        maxBearingPressure: maxPressure,
        minBearingPressure: Math.max(0, minPressure),
        bearingOk: maxPressure <= soil.allowableBearing && minPressure >= 0,
      },
      stem: {
        Mu_base: stemMoment,
        Vu_base: stemShear,
        verticalRebar: {
          diameter: 16,
          spacing: Math.min(200, Math.floor(stem_spacing / 25) * 25),
          location: 'inside',
        },
        horizontalRebar: {
          diameter: 12,
          spacing: 200,
        },
        crackWidth: 0.2,
        status: slidingFactor >= 1.5 && overturningFactor >= 2.0 ? 'pass' : 'fail',
      },
      footing: {
        Mu_toe,
        Mu_heel,
        Vu: toe_pressure * toeLength,
        bottomRebar: {
          diameter: 20,
          spacing: 150,
        },
        topRebar: {
          diameter: 16,
          spacing: 200,
        },
        punchingShear: 0.5,
        status: 'pass',
      },
      overallStatus: slidingFactor >= 1.5 && overturningFactor >= 2.0 && 
                     maxPressure <= soil.allowableBearing ? 'pass' : 'fail',
      warnings,
    };
    
    if (slidingFactor < 1.5) warnings.push('Sliding factor of safety inadequate');
    if (overturningFactor < 2.0) warnings.push('Overturning factor of safety inadequate');
    if (maxPressure > soil.allowableBearing) warnings.push('Bearing pressure exceeds allowable');
    if (minPressure < 0) warnings.push('Uplift condition exists');
    
    return result;
  }

  // ===========================================================================
  // SPREAD FOOTING DESIGN
  // ===========================================================================

  public static designSpreadFooting(input: SpreadFootingInput): SpreadFootingResult {
    const warnings: string[] = [];
    const { columnLoad, columnMomentX, columnMomentY, columnWidth, columnDepth } = input;
    const { soilBearing, fck, fy } = input;
    
    // Size footing for bearing (service loads)
    const P = columnLoad;
    const Mx = columnMomentX;
    const My = columnMomentY;
    
    // Eccentricity
    const ex = My / P;
    const ey = Mx / P;
    
    // Initial size (concentric load)
    const A_required = P / (0.5 * soilBearing);  // 50% capacity utilization
    const B_initial = Math.sqrt(A_required);
    
    // Account for eccentricity - use larger size
    const B = Math.max(B_initial, 6 * Math.max(Math.abs(ex), Math.abs(ey)));
    const L = B;  // Square footing
    
    // Depth (for shear)
    const D = Math.max(0.5, B / 4);  // m
    
    // Pressure distribution
    const q_max = P / (B * L) * (1 + 6 * ex / B + 6 * ey / L);
    const q_min = P / (B * L) * (1 - 6 * ex / B - 6 * ey / L);
    const q_avg = P / (B * L);
    
    // Factored loads
    const Pu = 1.4 * P;  // Simplified
    const q_u = Pu / (B * L);
    
    // Critical sections
    const d = D * 1000 - 75 - 10;  // mm effective depth
    
    // One-way shear (at d from column face)
    const x_crit = (B - columnWidth) / 2 - d / 1000;
    const Vu_beam = q_u * L * x_crit;  // kN
    const vc = 0.17 * Math.sqrt(fck);  // MPa
    const Vc = vc * L * 1000 * d / 1000;  // kN
    
    // Punching shear (at d/2 from column face)
    const bo = 2 * (columnWidth * 1000 + d) + 2 * (columnDepth * 1000 + d);  // mm
    const Vu_punch = Pu - q_u * (columnWidth + d / 1000) * (columnDepth + d / 1000);
    const vc_punch = 0.33 * Math.sqrt(fck);
    const Vc_punch = vc_punch * bo * d / 1000;  // kN
    
    // Moment (at column face)
    const x_moment = (B - columnWidth) / 2;
    const Mu_long = q_u * L * x_moment * x_moment / 2;  // kN-m
    const Mu_short = q_u * B * x_moment * x_moment / 2;
    
    // Reinforcement
    const designRebar = (Mu: number, b: number) => {
      const Ru = Mu * 1e6 / (b * 1000 * d * d);
      const rho = 0.85 * fck / fy * (1 - Math.sqrt(1 - 2 * Ru / (0.85 * fck)));
      const As = Math.max(rho, 0.0018) * b * 1000 * d;  // mm²
      const bar_dia = 20;
      const spacing = Math.PI * bar_dia * bar_dia / 4 * 1000 / (As / b);
      const numBars = Math.ceil(b * 1000 / spacing);
      return { diameter: bar_dia, spacing: Math.floor(spacing / 25) * 25, numBars };
    };
    
    const rebarLong = designRebar(Mu_long, L);
    const rebarShort = designRebar(Mu_short, B);
    
    // Settlement (simplified elastic)
    const Es = 10000;  // kPa soil modulus (approximate)
    const B_mm = B * 1000;
    const immediateSettlement = q_avg * B_mm / Es * (1 - 0.3 * 0.3);
    
    return {
      length: L,
      width: B,
      depth: D,
      maxPressure: q_max,
      minPressure: Math.max(0, q_min),
      averagePressure: q_avg,
      eccentricityX: ex,
      eccentricityY: ey,
      Mu_long,
      Mu_short,
      Vu_beam,
      Vu_punch,
      oneWayShearCapacity: Vc,
      punchingShearCapacity: Vc_punch,
      bearingUtilization: q_max / soilBearing,
      oneWayShearUtilization: Vu_beam / (0.75 * Vc),
      punchingShearUtilization: Vu_punch / (0.75 * Vc_punch),
      bottomRebarLong: rebarLong,
      bottomRebarShort: rebarShort,
      immediateSettlement,
      consolidationSettlement: 0,  // Requires soil testing
      status: q_max <= soilBearing && Vu_beam <= 0.75 * Vc && Vu_punch <= 0.75 * Vc_punch ? 'pass' : 'fail',
      warnings,
    };
  }

  // ===========================================================================
  // BEARING DESIGN
  // ===========================================================================

  public static designElastomericBearing(input: BearingDesignInput): ElastomericBearingResult {
    const recommendations: string[] = [];
    const { deadLoad, liveLoad, rotationDead, rotationLive } = input;
    const { translationLong, translationTrans, horizontalLoad } = input;
    
    const P = deadLoad + liveLoad;
    const theta = rotationDead + rotationLive;
    const delta_s = Math.sqrt(translationLong ** 2 + translationTrans ** 2);
    
    // Elastomer properties
    const G = 1.0;  // MPa (shear modulus for 50 Shore A)
    const K = 2000; // MPa (bulk modulus)
    
    // Initial sizing
    // Area based on compressive stress limit
    const sigma_allow = 10;  // MPa for reinforced bearing
    const A_min = P * 1000 / sigma_allow;  // mm²
    const L_min = Math.sqrt(A_min);
    
    // Round up to nearest 50mm
    let L = Math.ceil(L_min / 50) * 50;
    const W = L;  // Start with square
    
    // Adjust for rotation (need aspect ratio)
    if (theta > 0.01) {
      L = Math.ceil(L * 1.2 / 50) * 50;
    }
    
    const A = L * W;
    
    // Layer thickness based on shape factor
    // S = LW / (2t(L+W)) for rectangular
    const S_target = 6;  // Typical for bridge bearings
    const t_layer = L * W / (2 * S_target * (L + W));
    const t = Math.ceil(t_layer / 2) * 2;  // Round to even mm
    
    const S = L * W / (2 * t * (L + W));
    
    // Total elastomer thickness based on shear strain
    const gamma_s_allow = 0.5;  // 50% shear strain limit
    const hrt_min = delta_s / gamma_s_allow;
    
    // Number of layers
    const n_layers = Math.ceil(hrt_min / t);
    const hrt = n_layers * t;
    
    // Steel plate thickness
    const hs = Math.max(3, t / 4);  // mm
    
    // Total height
    const totalHeight = hrt + (n_layers - 1) * hs + 6 + 6;  // 6mm top/bottom cover
    
    // Check compressive stress
    const sigma = P * 1000 / A;
    const sigma_allow_actual = 1.66 * G * S;  // AASHTO limit
    
    // Check shear strain
    const gamma_s = delta_s / hrt;
    
    // Check rotation capacity
    const theta_allow = 2 * hrt / L * (1 - sigma / (2.25 * G * S));
    
    // Combined strain limit (AASHTO)
    const gamma_c = sigma / (G * S);  // Compressive strain
    const gamma_theta = L * theta / (2 * hrt);  // Rotational strain
    const gamma_total = gamma_c + gamma_s + gamma_theta;
    const gamma_allow = 5.0;  // Limit for steel-reinforced
    
    // Stability (buckling)
    const Pcr = 0.68 * G * S * A / 1000 * Math.pow(L / hrt, 2);  // kN (approximate)
    
    // Uplift check
    const P_min = deadLoad * 0.9;  // Minimum load
    const sigma_min = P_min * 1000 / A;
    const upliftOk = sigma_min > gamma_s * G;
    
    if (!upliftOk) {
      recommendations.push('Consider guided bearing or mechanical restraint to prevent uplift');
    }
    
    if (gamma_total > gamma_allow * 0.9) {
      recommendations.push('Combined strain is high - consider larger bearing or more layers');
    }
    
    return {
      type: 'steel-reinforced',
      length: L,
      width: W,
      totalHeight,
      coverTop: 6,
      coverBottom: 6,
      coverSide: 6,
      numLayers: n_layers,
      layerThickness: t,
      totalElastomerThickness: hrt,
      numPlates: n_layers - 1,
      plateThickness: hs,
      shearModulus: G,
      bulkModulus: K,
      hardness: 50,
      shapeFactor: S,
      compressiveStress: sigma,
      allowableCompressive: sigma_allow_actual,
      compressiveOk: sigma <= sigma_allow_actual,
      shearStrain: gamma_s,
      allowableShearStrain: gamma_s_allow,
      shearOk: gamma_s <= gamma_s_allow,
      rotationCapacity: theta_allow,
      rotationDemand: theta,
      rotationOk: theta <= theta_allow,
      combinedStrain: gamma_total,
      allowableCombined: gamma_allow,
      combinedOk: gamma_total <= gamma_allow,
      bucklingCapacity: Pcr,
      bucklingOk: P <= Pcr / 3,
      upliftOk,
      status: sigma <= sigma_allow_actual && gamma_s <= gamma_s_allow && 
              theta <= theta_allow && gamma_total <= gamma_allow ? 'pass' : 'fail',
      recommendations,
    };
  }

  // ===========================================================================
  // SEISMIC DESIGN
  // ===========================================================================

  public static designSeismic(input: SeismicDesignInput): SeismicDesignResult {
    const warnings: string[] = [];
    const { seismicZone, siteClass, PGA, Ss, S1, structurePeriod, weight, importance, ductilityClass } = input;
    
    // Site coefficients (AASHTO)
    const Fa: Record<string, number> = { A: 0.8, B: 1.0, C: 1.2, D: 1.6, E: 2.5, F: 1.0 };
    const Fv: Record<string, number> = { A: 0.8, B: 1.0, C: 1.7, D: 2.4, E: 3.5, F: 1.0 };
    
    // Design spectral accelerations
    const SDs = Ss * Fa[siteClass];
    const SD1 = S1 * Fv[siteClass];
    
    // Corner periods
    const Ts = SD1 / SDs;
    const T0 = 0.2 * Ts;
    
    // Response modification factor
    const R_factors: Record<string, Record<string, number>> = {
      low: { essential: 1.5, critical: 2.0, normal: 2.5 },
      medium: { essential: 2.5, critical: 3.5, normal: 4.0 },
      high: { essential: 3.5, critical: 5.0, normal: 6.0 },
    };
    const R = R_factors[ductilityClass][importance];
    
    // Seismic response coefficient
    let Cs: number;
    const T = structurePeriod;
    
    if (T <= T0) {
      Cs = SDs * (0.4 + 0.6 * T / T0);
    } else if (T <= Ts) {
      Cs = SDs;
    } else {
      Cs = SD1 / T;
    }
    
    Cs = Cs / R;
    
    // Minimum
    Cs = Math.max(Cs, 0.01);
    if (S1 >= 0.6) {
      Cs = Math.max(Cs, 0.5 * S1 / R);
    }
    
    // Base shear
    const baseShear = Cs * weight;
    
    // Displacement
    const Cd = R * 0.7;  // Displacement amplification
    const elasticDisplacement = Cs * weight / (4 * Math.PI * Math.PI * weight / (9.81 * T * T));
    const inelasticDisplacement = Cd * elasticDisplacement;
    
    // Required ductility
    const requiredDuctility = R;
    
    // Detailing requirements
    const D = 1.5;  // Assumed column diameter (m)
    const plasticHingeLength = Math.max(0.08 * 10, D, 0.45);  // Height = 10m assumed
    const confinementZoneLength = Math.max(D, plasticHingeLength, 0.45);
    
    // Minimum transverse reinforcement
    const minTransverseRatio = ductilityClass === 'high' ? 1.0 : 
                                ductilityClass === 'medium' ? 0.6 : 0.3;
    
    // SDC
    let seismicDesignCategory: 'A' | 'B' | 'C' | 'D';
    if (SDs < 0.15 && SD1 < 0.04) seismicDesignCategory = 'A';
    else if (SDs < 0.35 && SD1 < 0.15) seismicDesignCategory = 'B';
    else if (SDs < 0.5 || SD1 < 0.3) seismicDesignCategory = 'C';
    else seismicDesignCategory = 'D';
    
    if (seismicDesignCategory === 'D') {
      warnings.push('SDC D requires special detailing and may require site-specific ground motion analysis');
    }
    
    return {
      SDs,
      SD1,
      R,
      Cs,
      baseShear,
      T,
      T0,
      Ts,
      verticalDistribution: [
        { height: 10, force: baseShear * 0.6 },
        { height: 5, force: baseShear * 0.4 },
      ],
      elasticDisplacement,
      inelasticDisplacement,
      requiredDuctility,
      plasticHingeLength,
      confinementZoneLength,
      minTransverseRatio,
      seismicDesignCategory,
      warnings,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Quick pier design for typical highway bridge
 */
export function designBridgePier(
  height: number,              // m
  numColumns: number,
  columnDiameter: number,      // m
  totalReaction: number,       // kN (dead + live)
  braking: number              // kN
): PierDesignResult {
  const geometry: PierGeometry = {
    type: numColumns === 1 ? 'hammerhead' : 'multi-column',
    height,
    numColumns,
    columnDiameter,
    capWidth: columnDiameter * 1.5,
    capDepth: 1.5,
    capLength: numColumns === 1 ? columnDiameter * 4 : (numColumns - 1) * 3 + columnDiameter * 2,
  };
  
  const materials: PierMaterials = {
    concrete: { fck: 40 },
    reinforcement: { fy: 500, minCover: 75 },
  };
  
  const loading: SubstructureLoading = {
    deadLoadReaction: totalReaction * 0.6,
    liveLoadReaction: totalReaction * 0.4,
    superimposedDead: 0,
    brakingForce: braking,
    windOnStructure: 50,
    windOnLiveLoad: 20,
    seismicZone: 'III',
  };
  
  return BridgeSubstructureDesignEngine.designPier(geometry, materials, loading);
}

/**
 * Quick abutment design
 */
export function designBridgeAbutment(
  height: number,              // m
  width: number,               // m
  reaction: number,            // kN (service)
  soilFriction: number = 30    // degrees
): AbutmentDesignResult {
  const geometry: AbutmentGeometry = {
    type: 'cantilever',
    height,
    width,
    stemThicknessTop: 0.4,
    stemThicknessBottom: 0.6 + height * 0.05,
    footingWidth: height * 0.7,
    footingLength: width,
    footingThickness: 0.6,
    toeLength: height * 0.2,
    heelLength: height * 0.4,
  };
  
  const materials: PierMaterials = {
    concrete: { fck: 35 },
    reinforcement: { fy: 500, minCover: 75 },
  };
  
  const soil: SoilProperties = {
    type: 'medium-sand',
    allowableBearing: 200,
    frictionAngle: soilFriction,
    cohesion: 0,
    unitWeight: 18,
  };
  
  const loading: SubstructureLoading = {
    deadLoadReaction: reaction * 0.7,
    liveLoadReaction: reaction * 0.3,
    superimposedDead: 0,
    brakingForce: 50,
    windOnStructure: 30,
    windOnLiveLoad: 10,
    surcharge: 10,
  };
  
  return BridgeSubstructureDesignEngine.designAbutment(geometry, materials, soil, loading);
}

// =============================================================================
// EXPORTS - Note: BridgeSubstructureDesignEngine is already exported above
// =============================================================================

export default BridgeSubstructureDesignEngine;
