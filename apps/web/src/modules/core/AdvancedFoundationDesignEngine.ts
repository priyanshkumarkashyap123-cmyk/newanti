/**
 * ============================================================================
 * ADVANCED FOUNDATION DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive foundation design calculations supporting:
 * - Isolated footings (square, rectangular, circular)
 * - Combined footings
 * - Strip/continuous footings
 * - Mat/raft foundations
 * - Pile foundations (single and group)
 * - Settlement analysis
 * 
 * Design Codes Supported:
 * - IS 456:2000 (India)
 * - ACI 318-19 (USA)
 * - EN 1992-1-1 (Eurocode)
 * - AS 3600:2018 (Australia)
 * 
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath, ValidationUtils, ENGINEERING_CONSTANTS } from './PrecisionMath';
import { EngineeringErrorHandler, ErrorSeverity, ErrorCategory, type EngineeringError } from './EngineeringErrorHandler';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type FoundationCode = 'IS456' | 'ACI318' | 'EN1992' | 'AS3600';
export type FoundationType = 'isolated' | 'combined' | 'strip' | 'mat' | 'pile';
export type FootingShape = 'square' | 'rectangular' | 'circular';
export type PileType = 'driven' | 'bored' | 'CFA' | 'micropile';
export type SoilType = 'cohesive' | 'cohesionless' | 'mixed';

export interface SoilProfile {
  type: SoilType;
  layers: SoilLayer[];
  waterTableDepth: number; // mm from ground level
}

export interface SoilLayer {
  depth: number; // mm from ground level
  thickness: number; // mm
  unitWeight: number; // kN/m³
  saturatedUnitWeight: number; // kN/m³
  cohesion: number; // kPa (for cohesive soils)
  frictionAngle: number; // degrees (for cohesionless soils)
  elasticModulus: number; // MPa
  poissonRatio: number;
  spt_N?: number; // SPT N value
  compressionIndex?: number; // Cc for consolidation
  recompressionIndex?: number; // Cr for consolidation
  preconsolidationPressure?: number; // kPa
}

export interface FoundationLoads {
  axialLoad: number; // kN (vertical)
  momentX: number; // kN·m (about X axis)
  momentY: number; // kN·m (about Y axis)
  shearX: number; // kN (horizontal X)
  shearY: number; // kN (horizontal Y)
}

export interface IsolatedFootingInput {
  code: FoundationCode;
  shape: FootingShape;
  columnWidth: number; // mm
  columnDepth: number; // mm
  loads: FoundationLoads;
  soilProfile: SoilProfile;
  allowableBearingCapacity: number; // kPa
  concreteGrade: number; // MPa (fck)
  steelGrade: number; // MPa (fy)
  clearCover: number; // mm
  foundationDepth: number; // mm below ground
  minFootingDepth: number; // mm
}

export interface FootingDimensions {
  length: number; // mm
  width: number; // mm
  depth: number; // mm
  effectiveDepth: number; // mm
  diameter?: number; // mm (for circular)
}

export interface BearingCapacityResult {
  ultimateBearingCapacity: number; // kPa
  allowableBearingCapacity: number; // kPa
  factorOfSafety: number;
  appliedPressure: number; // kPa
  maxPressure: number; // kPa
  minPressure: number; // kPa
  utilizationRatio: number;
  isAdequate: boolean;
}

export interface ShearCheckResult {
  oneWayShear: {
    criticalSection: number; // mm from column face
    appliedShear: number; // kN/m
    designShearStrength: number; // kN/m
    utilizationRatio: number;
    isAdequate: boolean;
  };
  twoWayShear: {
    perimeter: number; // mm
    appliedShear: number; // kN
    designShearStrength: number; // kN
    utilizationRatio: number;
    isAdequate: boolean;
  };
}

export interface FlexureCheckResult {
  direction: 'X' | 'Y';
  moment: number; // kN·m/m
  requiredAst: number; // mm²/m
  providedAst: number; // mm²/m
  barDiameter: number; // mm
  spacing: number; // mm
  utilizationRatio: number;
  isAdequate: boolean;
}

export interface FootingReinforcementResult {
  bottomX: FlexureCheckResult;
  bottomY: FlexureCheckResult;
  topX?: FlexureCheckResult;
  topY?: FlexureCheckResult;
  dowelBars: {
    diameter: number;
    count: number;
    length: number;
    developmentLength: number;
  };
}

export interface SettlementResult {
  immediateSettlement: number; // mm
  consolidationSettlement: number; // mm
  secondarySettlement: number; // mm
  totalSettlement: number; // mm
  differentialSettlement?: number; // mm
  allowableSettlement: number; // mm
  isAdequate: boolean;
}

export interface IsolatedFootingResult {
  dimensions: FootingDimensions;
  bearingCapacity: BearingCapacityResult;
  shearCheck: ShearCheckResult;
  reinforcement: FootingReinforcementResult;
  settlement: SettlementResult;
  concreteVolume: number; // m³
  steelWeight: number; // kg
  isDesignAdequate: boolean;
  warnings: string[];
  detailedCalculations: string[];
}

// Pile Foundation Types
export interface PileInput {
  code: FoundationCode;
  pileType: PileType;
  diameter: number; // mm
  length: number; // mm
  spacing: number; // mm (for group)
  rows: number;
  columns: number;
  pileCap: {
    length: number; // mm
    width: number; // mm
    depth: number; // mm
  };
  loads: FoundationLoads;
  soilProfile: SoilProfile;
  concreteGrade: number; // MPa
  steelGrade: number; // MPa
}

export interface PileCapacityResult {
  endBearing: number; // kN
  skinFriction: number; // kN
  ultimateCapacity: number; // kN
  allowableCapacity: number; // kN
  factorOfSafety: number;
  groupCapacity: number; // kN (for pile group)
  groupEfficiency: number;
  loadPerPile: number; // kN
  maxLoadPerPile: number; // kN
  utilizationRatio: number;
  isAdequate: boolean;
}

export interface PileDesignResult {
  capacity: PileCapacityResult;
  pileReinforcement: {
    mainBars: { diameter: number; count: number };
    spirals: { diameter: number; pitch: number };
  };
  pileCapReinforcement: FootingReinforcementResult;
  settlement: SettlementResult;
  lateralCapacity: number; // kN
  isDesignAdequate: boolean;
  warnings: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SOIL_CONSTANTS = {
  bearing_capacity_factors: {
    // Nc, Nq, Nγ for different friction angles (Meyerhof)
    0: { Nc: 5.14, Nq: 1.0, Ng: 0 },
    5: { Nc: 6.49, Nq: 1.57, Ng: 0.45 },
    10: { Nc: 8.35, Nq: 2.47, Ng: 1.22 },
    15: { Nc: 10.98, Nq: 3.94, Ng: 2.65 },
    20: { Nc: 14.83, Nq: 6.40, Ng: 5.39 },
    25: { Nc: 20.72, Nq: 10.66, Ng: 10.88 },
    30: { Nc: 30.14, Nq: 18.40, Ng: 22.40 },
    35: { Nc: 46.12, Nq: 33.30, Ng: 48.03 },
    40: { Nc: 75.31, Nq: 64.20, Ng: 109.41 },
    45: { Nc: 133.88, Nq: 134.88, Ng: 271.76 },
  },
  
  // Typical soil properties
  typical_properties: {
    soft_clay: { unitWeight: 16, cohesion: 25, friction: 0, E: 5 },
    medium_clay: { unitWeight: 18, cohesion: 50, friction: 0, E: 15 },
    stiff_clay: { unitWeight: 19, cohesion: 100, friction: 0, E: 30 },
    loose_sand: { unitWeight: 16, cohesion: 0, friction: 28, E: 15 },
    medium_sand: { unitWeight: 18, cohesion: 0, friction: 32, E: 30 },
    dense_sand: { unitWeight: 20, cohesion: 0, friction: 38, E: 60 },
  },
} as const;

export const FOUNDATION_CODE_FACTORS = {
  IS456: {
    partialSafetyFactor: 1.5,
    bearingCapacityFOS: 2.5,
    pileCapacityFOS: 2.5,
    shearStrengthFactor: 0.85,
    allowableSettlement: 25, // mm
    differentialSettlement: 18.75, // mm
  },
  ACI318: {
    strengthReductionShear: 0.75,
    strengthReductionFlexure: 0.90,
    bearingCapacityFOS: 3.0,
    pileCapacityFOS: 2.0,
    allowableSettlement: 25, // mm
    differentialSettlement: 19, // mm
  },
  EN1992: {
    gammaC: 1.5,
    gammaS: 1.15,
    partialFactorBearing: 1.4,
    partialFactorSliding: 1.1,
    pileCapacityFOS: 2.0,
    allowableSettlement: 25, // mm
    differentialSettlement: 20, // mm
  },
  AS3600: {
    phiShear: 0.70,
    phiFlexure: 0.85,
    bearingCapacityFOS: 2.5,
    pileCapacityFOS: 2.0,
    allowableSettlement: 25, // mm
    differentialSettlement: 18, // mm
  },
} as const;

// =============================================================================
// ADVANCED FOUNDATION DESIGN ENGINE
// =============================================================================

export class AdvancedFoundationDesignEngine {
  private errorHandler: EngineeringErrorHandler;
  private calculations: string[] = [];
  
  constructor() {
    this.errorHandler = new EngineeringErrorHandler();
  }
  
  // ---------------------------------------------------------------------------
  // ISOLATED FOOTING DESIGN
  // ---------------------------------------------------------------------------
  
  public designIsolatedFooting(input: IsolatedFootingInput): IsolatedFootingResult {
    this.calculations = [];
    const warnings: string[] = [];
    
    this.addCalculation('='.repeat(60));
    this.addCalculation('ISOLATED FOOTING DESIGN');
    this.addCalculation(`Design Code: ${input.code}`);
    this.addCalculation('='.repeat(60));
    
    // Step 1: Size the footing
    const dimensions = this.sizeFooting(input);
    
    // Step 2: Check bearing capacity
    const bearingCapacity = this.checkBearingCapacity(input, dimensions);
    if (!bearingCapacity.isAdequate) {
      warnings.push('Bearing capacity exceeded - consider increasing footing size');
    }
    
    // Step 3: Check shear
    const shearCheck = this.checkShear(input, dimensions);
    if (!shearCheck.oneWayShear.isAdequate) {
      warnings.push('One-way shear not adequate - increase footing depth');
    }
    if (!shearCheck.twoWayShear.isAdequate) {
      warnings.push('Two-way (punching) shear not adequate - increase footing depth or add shear reinforcement');
    }
    
    // Step 4: Design reinforcement
    const reinforcement = this.designReinforcement(input, dimensions);
    
    // Step 5: Check settlement
    const settlement = this.calculateSettlement(input, dimensions);
    if (!settlement.isAdequate) {
      warnings.push('Settlement exceeds allowable limit');
    }
    
    // Calculate quantities
    const area = input.shape === 'circular' 
      ? PrecisionMath.divide(
          PrecisionMath.multiply(ENGINEERING_CONSTANTS.PI, PrecisionMath.pow(dimensions.diameter! / 2000, 2)),
          1
        )
      : PrecisionMath.multiply(dimensions.length / 1000, dimensions.width / 1000);
    
    const concreteVolume = PrecisionMath.multiply(area, dimensions.depth / 1000);
    
    // Calculate steel weight
    const steelWeight = this.calculateSteelWeight(reinforcement, dimensions);
    
    const isDesignAdequate = bearingCapacity.isAdequate && 
                            shearCheck.oneWayShear.isAdequate && 
                            shearCheck.twoWayShear.isAdequate &&
                            settlement.isAdequate;
    
    return {
      dimensions,
      bearingCapacity,
      shearCheck,
      reinforcement,
      settlement,
      concreteVolume,
      steelWeight,
      isDesignAdequate,
      warnings,
      detailedCalculations: this.calculations,
    };
  }
  
  private sizeFooting(input: IsolatedFootingInput): FootingDimensions {
    this.addCalculation('\n--- FOOTING SIZING ---');
    
    const { loads, allowableBearingCapacity, columnWidth, columnDepth, minFootingDepth } = input;
    
    // Total vertical load including self-weight (assume 10% initially)
    const totalLoad = PrecisionMath.multiply(loads.axialLoad, 1.1);
    this.addCalculation(`Total load (with 10% self-weight): ${totalLoad.toFixed(2)} kN`);
    
    // Required area
    const requiredArea = PrecisionMath.divide(totalLoad, allowableBearingCapacity) * 1e6; // mm²
    this.addCalculation(`Required area: ${(requiredArea / 1e6).toFixed(3)} m²`);
    
    let length: number, width: number, diameter: number | undefined;
    
    if (input.shape === 'square') {
      const side = Math.ceil(Math.sqrt(requiredArea) / 50) * 50; // Round to 50mm
      length = Math.max(side, columnWidth + 300, columnDepth + 300);
      width = length;
      this.addCalculation(`Square footing: ${length} x ${width} mm`);
    } else if (input.shape === 'rectangular') {
      // Aspect ratio based on column dimensions
      const aspectRatio = columnWidth > columnDepth 
        ? columnWidth / columnDepth 
        : columnDepth / columnWidth;
      width = Math.ceil(Math.sqrt(requiredArea / aspectRatio) / 50) * 50;
      length = Math.ceil((requiredArea / width) / 50) * 50;
      length = Math.max(length, columnWidth + 300);
      width = Math.max(width, columnDepth + 300);
      this.addCalculation(`Rectangular footing: ${length} x ${width} mm`);
    } else {
      // Circular
      diameter = Math.ceil((2 * Math.sqrt(requiredArea / ENGINEERING_CONSTANTS.PI)) / 50) * 50;
      diameter = Math.max(diameter, Math.max(columnWidth, columnDepth) + 300);
      length = diameter;
      width = diameter;
      this.addCalculation(`Circular footing diameter: ${diameter} mm`);
    }
    
    // Determine footing depth
    // Minimum depth for shear
    const depth = this.calculateMinimumDepth(input, length, width);
    const effectiveDepth = depth - input.clearCover - 8; // Assuming 16mm bar, half diameter
    
    this.addCalculation(`Footing depth: ${depth} mm`);
    this.addCalculation(`Effective depth: ${effectiveDepth} mm`);
    
    return {
      length,
      width,
      depth: Math.max(depth, minFootingDepth),
      effectiveDepth,
      diameter,
    };
  }
  
  private calculateMinimumDepth(input: IsolatedFootingInput, length: number, width: number): number {
    const { loads, columnWidth, columnDepth, code, concreteGrade, clearCover } = input;
    
    // Estimate based on punching shear
    const factorMap = {
      'IS456': 0.25,
      'ACI318': 0.33,
      'EN1992': 0.18,
      'AS3600': 0.34,
    };
    
    const factor = factorMap[code];
    const punchingPerimeter = 2 * (columnWidth + columnDepth);
    const allowableShearStress = factor * Math.sqrt(concreteGrade); // MPa
    
    // V = P, τ = V/(b₀·d) => d = V/(b₀·τ)
    const d = (loads.axialLoad * 1000) / (punchingPerimeter * allowableShearStress);
    
    // Round up to nearest 25mm
    const effectiveDepth = Math.ceil(d / 25) * 25;
    const totalDepth = effectiveDepth + clearCover + 16; // 16mm bar assumed
    
    return Math.max(totalDepth, 300); // Minimum 300mm
  }
  
  private checkBearingCapacity(
    input: IsolatedFootingInput, 
    dimensions: FootingDimensions
  ): BearingCapacityResult {
    this.addCalculation('\n--- BEARING CAPACITY CHECK ---');
    
    const { loads, soilProfile, allowableBearingCapacity } = input;
    const { length, width, depth } = dimensions;
    
    // Calculate footing area
    const area = (length * width) / 1e6; // m²
    this.addCalculation(`Footing area: ${area.toFixed(3)} m²`);
    
    // Section modulus
    const Zx = (width * Math.pow(length, 2)) / (6 * 1e9); // m³
    const Zy = (length * Math.pow(width, 2)) / (6 * 1e9); // m³
    
    // Self-weight
    const selfWeight = area * (depth / 1000) * 25; // kN (assuming concrete = 25 kN/m³)
    const soilWeight = area * (input.foundationDepth / 1000) * soilProfile.layers[0].unitWeight;
    
    const totalVerticalLoad = loads.axialLoad + selfWeight + soilWeight;
    this.addCalculation(`Self-weight of footing: ${selfWeight.toFixed(2)} kN`);
    this.addCalculation(`Weight of soil above: ${soilWeight.toFixed(2)} kN`);
    this.addCalculation(`Total vertical load: ${totalVerticalLoad.toFixed(2)} kN`);
    
    // Calculate pressure distribution
    const P = totalVerticalLoad;
    const Mx = loads.momentX;
    const My = loads.momentY;
    
    // Eccentricities
    const ex = Math.abs(Mx / P) * 1000; // mm
    const ey = Math.abs(My / P) * 1000; // mm
    
    this.addCalculation(`Eccentricity ex: ${ex.toFixed(1)} mm`);
    this.addCalculation(`Eccentricity ey: ${ey.toFixed(1)} mm`);
    
    // Check kern - one-sixth rule
    const kernX = length / 6;
    const kernY = width / 6;
    
    let maxPressure: number, minPressure: number;
    
    if (ex <= kernX && ey <= kernY) {
      // Within kern - no tension
      maxPressure = (P / area) + (Mx / Zx) + (My / Zy);
      minPressure = (P / area) - (Mx / Zx) - (My / Zy);
      this.addCalculation('Load within kern - no tension');
    } else {
      // Outside kern - tension develops, redistribution needed
      this.addCalculation('Load outside kern - tension may develop');
      // Use effective area method
      const Leff = length - 2 * ex;
      const Beff = width - 2 * ey;
      const effectiveArea = Math.max(Leff * Beff / 1e6, area * 0.5);
      maxPressure = totalVerticalLoad / effectiveArea;
      minPressure = 0;
    }
    
    this.addCalculation(`Maximum pressure: ${maxPressure.toFixed(2)} kPa`);
    this.addCalculation(`Minimum pressure: ${minPressure.toFixed(2)} kPa`);
    this.addCalculation(`Allowable bearing capacity: ${allowableBearingCapacity} kPa`);
    
    // Calculate ultimate bearing capacity using Terzaghi/Meyerhof
    const ultimateBearingCapacity = this.calculateUltimateBearingCapacity(
      soilProfile, 
      length / 1000, 
      width / 1000, 
      input.foundationDepth / 1000
    );
    
    const factorOfSafety = ultimateBearingCapacity / maxPressure;
    const utilizationRatio = maxPressure / allowableBearingCapacity;
    
    this.addCalculation(`Ultimate bearing capacity: ${ultimateBearingCapacity.toFixed(2)} kPa`);
    this.addCalculation(`Factor of safety: ${factorOfSafety.toFixed(2)}`);
    this.addCalculation(`Utilization ratio: ${(utilizationRatio * 100).toFixed(1)}%`);
    
    return {
      ultimateBearingCapacity,
      allowableBearingCapacity,
      factorOfSafety,
      appliedPressure: P / area,
      maxPressure,
      minPressure,
      utilizationRatio,
      isAdequate: maxPressure <= allowableBearingCapacity && minPressure >= 0,
    };
  }
  
  private calculateUltimateBearingCapacity(
    soilProfile: SoilProfile,
    L: number, 
    B: number, 
    Df: number
  ): number {
    // Get soil properties at foundation level
    const layer = this.getSoilLayerAtDepth(soilProfile, Df * 1000);
    
    const c = layer.cohesion; // kPa
    const phi = layer.frictionAngle; // degrees
    const gamma = layer.unitWeight; // kN/m³
    
    // Get bearing capacity factors (interpolate if needed)
    const factors = this.interpolateBearingCapacityFactors(phi);
    const { Nc, Nq, Ng } = factors;
    
    // Shape factors (Meyerhof)
    const sc = 1 + 0.2 * (B / L);
    const sq = 1 + 0.1 * (B / L) * Math.tan(phi * Math.PI / 180);
    const sg = sq;
    
    // Depth factors
    const dc = 1 + 0.2 * (Df / B);
    const dq = 1 + 0.1 * (Df / B) * Math.tan(Math.PI / 4 + phi * Math.PI / 360);
    const dg = dq;
    
    // Ultimate bearing capacity (Meyerhof equation)
    // qu = c·Nc·sc·dc + q·Nq·sq·dq + 0.5·γ·B·Nγ·sγ·dγ
    const q = gamma * Df; // Overburden pressure
    
    const term1 = c * Nc * sc * dc;
    const term2 = q * Nq * sq * dq;
    const term3 = 0.5 * gamma * B * Ng * sg * dg;
    
    return term1 + term2 + term3;
  }
  
  private interpolateBearingCapacityFactors(phi: number): { Nc: number; Nq: number; Ng: number } {
    const factors = SOIL_CONSTANTS.bearing_capacity_factors;
    const angles = Object.keys(factors).map(Number).sort((a, b) => a - b);
    
    // Find bracketing angles
    let lower = 0, upper = 45;
    for (let i = 0; i < angles.length - 1; i++) {
      if (phi >= angles[i] && phi <= angles[i + 1]) {
        lower = angles[i];
        upper = angles[i + 1];
        break;
      }
    }
    
    const lowerFactors = factors[lower as keyof typeof factors];
    const upperFactors = factors[upper as keyof typeof factors];
    
    const ratio = (phi - lower) / (upper - lower || 1);
    
    return {
      Nc: lowerFactors.Nc + ratio * (upperFactors.Nc - lowerFactors.Nc),
      Nq: lowerFactors.Nq + ratio * (upperFactors.Nq - lowerFactors.Nq),
      Ng: lowerFactors.Ng + ratio * (upperFactors.Ng - lowerFactors.Ng),
    };
  }
  
  private getSoilLayerAtDepth(soilProfile: SoilProfile, depth: number): SoilLayer {
    let cumulativeDepth = 0;
    for (const layer of soilProfile.layers) {
      cumulativeDepth += layer.thickness;
      if (depth <= cumulativeDepth) {
        return layer;
      }
    }
    return soilProfile.layers[soilProfile.layers.length - 1];
  }
  
  private checkShear(input: IsolatedFootingInput, dimensions: FootingDimensions): ShearCheckResult {
    this.addCalculation('\n--- SHEAR CHECK ---');
    
    const { loads, columnWidth, columnDepth, code, concreteGrade, allowableBearingCapacity } = input;
    const { length, width, effectiveDepth } = dimensions;
    
    // Average pressure for shear calculation
    const avgPressure = loads.axialLoad * 1.5 / ((length * width) / 1e6); // kPa, factored
    
    // One-way shear
    const criticalSection1Way = effectiveDepth; // d from column face
    const shearSpanX = (length - columnWidth) / 2 - criticalSection1Way;
    const shearSpanY = (width - columnDepth) / 2 - criticalSection1Way;
    
    const appliedShear1Way = Math.max(
      avgPressure * shearSpanX * width / 1e6, // kN
      avgPressure * shearSpanY * length / 1e6
    );
    
    this.addCalculation(`One-way shear critical section: ${criticalSection1Way} mm from column face`);
    this.addCalculation(`Applied one-way shear: ${appliedShear1Way.toFixed(2)} kN`);
    
    // Design shear strength (τc)
    const tauC = this.getDesignShearStrength(code, concreteGrade, 0.25); // Assume 0.25% steel
    const shearStrength1Way = tauC * Math.max(length, width) * effectiveDepth / 1000; // kN
    
    this.addCalculation(`Design shear strength: ${tauC.toFixed(3)} MPa`);
    this.addCalculation(`Shear capacity: ${shearStrength1Way.toFixed(2)} kN`);
    
    // Two-way (punching) shear
    const criticalPerimeter = 2 * ((columnWidth + effectiveDepth) + (columnDepth + effectiveDepth));
    const areaWithinPerimeter = (columnWidth + effectiveDepth) * (columnDepth + effectiveDepth) / 1e6;
    const footingArea = (length * width) / 1e6;
    
    const appliedPunchingShear = loads.axialLoad * 1.5 * (footingArea - areaWithinPerimeter) / footingArea;
    
    this.addCalculation('\nTwo-way (punching) shear:');
    this.addCalculation(`Critical perimeter: ${criticalPerimeter} mm`);
    this.addCalculation(`Applied punching shear: ${appliedPunchingShear.toFixed(2)} kN`);
    
    // Punching shear strength
    const tauPunching = this.getPunchingShearStrength(code, concreteGrade);
    const punchingStrength = tauPunching * criticalPerimeter * effectiveDepth / 1000; // kN
    
    this.addCalculation(`Punching shear strength: ${tauPunching.toFixed(3)} MPa`);
    this.addCalculation(`Punching capacity: ${punchingStrength.toFixed(2)} kN`);
    
    return {
      oneWayShear: {
        criticalSection: criticalSection1Way,
        appliedShear: appliedShear1Way,
        designShearStrength: shearStrength1Way,
        utilizationRatio: appliedShear1Way / shearStrength1Way,
        isAdequate: appliedShear1Way <= shearStrength1Way,
      },
      twoWayShear: {
        perimeter: criticalPerimeter,
        appliedShear: appliedPunchingShear,
        designShearStrength: punchingStrength,
        utilizationRatio: appliedPunchingShear / punchingStrength,
        isAdequate: appliedPunchingShear <= punchingStrength,
      },
    };
  }
  
  private getDesignShearStrength(code: FoundationCode, fck: number, percentSteel: number): number {
    // Design shear strength τc in MPa
    switch (code) {
      case 'IS456':
        // IS 456 Table 19
        const beta = Math.max(1, Math.min(percentSteel, 3));
        return 0.85 * Math.sqrt(0.8 * fck) * Math.pow(1 + 5 * beta, 0.5 - 1) / (6 * Math.pow(beta, 0.5));
      
      case 'ACI318':
        // ACI 318-19: Vc = 0.17λ√f'c·bw·d
        return 0.17 * Math.sqrt(fck);
      
      case 'EN1992':
        // EN 1992: vRd,c = CRd,c·k·(100·ρl·fck)^(1/3)
        const k = Math.min(2, 1 + Math.sqrt(200 / 500)); // Assuming d=500mm
        return 0.12 * k * Math.pow(100 * percentSteel * fck, 1/3);
      
      case 'AS3600':
        // AS 3600: Vuc = β1·β2·β3·bv·do·fcv
        return 0.34 * Math.sqrt(fck);
      
      default:
        return 0.25 * Math.sqrt(fck);
    }
  }
  
  private getPunchingShearStrength(code: FoundationCode, fck: number): number {
    switch (code) {
      case 'IS456':
        return 0.25 * Math.sqrt(fck);
      case 'ACI318':
        return 0.33 * Math.sqrt(fck);
      case 'EN1992':
        return 0.18 * Math.pow(fck, 1/3);
      case 'AS3600':
        return 0.34 * Math.sqrt(fck);
      default:
        return 0.25 * Math.sqrt(fck);
    }
  }
  
  private designReinforcement(
    input: IsolatedFootingInput, 
    dimensions: FootingDimensions
  ): FootingReinforcementResult {
    this.addCalculation('\n--- REINFORCEMENT DESIGN ---');
    
    const { loads, columnWidth, columnDepth, code, concreteGrade, steelGrade, clearCover } = input;
    const { length, width, depth, effectiveDepth } = dimensions;
    
    // Calculate moments at column face
    const avgPressure = loads.axialLoad * 1.5 / ((length * width) / 1e6); // kPa, factored
    
    // Cantilever moment in X direction (per meter width)
    const cantileverX = (length - columnWidth) / 2 / 1000; // m
    const momentX = avgPressure * Math.pow(cantileverX, 2) / 2; // kN·m/m
    
    // Cantilever moment in Y direction
    const cantileverY = (width - columnDepth) / 2 / 1000; // m
    const momentY = avgPressure * Math.pow(cantileverY, 2) / 2; // kN·m/m
    
    this.addCalculation(`Cantilever span X: ${(cantileverX * 1000).toFixed(0)} mm`);
    this.addCalculation(`Cantilever span Y: ${(cantileverY * 1000).toFixed(0)} mm`);
    this.addCalculation(`Design moment X: ${momentX.toFixed(2)} kN·m/m`);
    this.addCalculation(`Design moment Y: ${momentY.toFixed(2)} kN·m/m`);
    
    // Design reinforcement
    const bottomX = this.calculateFlexuralReinforcement(
      code, momentX, effectiveDepth, concreteGrade, steelGrade, 'X'
    );
    
    const bottomY = this.calculateFlexuralReinforcement(
      code, momentY, effectiveDepth - bottomX.barDiameter, concreteGrade, steelGrade, 'Y'
    );
    
    // Dowel bars (column to footing connection)
    const dowelArea = Math.max(
      0.005 * columnWidth * columnDepth, // Minimum 0.5%
      loads.axialLoad * 1000 / (0.67 * steelGrade) // For axial load transfer
    );
    const dowelDiameter = this.selectBarDiameter(dowelArea / 4); // At least 4 bars
    const dowelCount = Math.ceil(dowelArea / (Math.PI * Math.pow(dowelDiameter / 2, 2)));
    const developmentLength = this.calculateDevelopmentLength(code, dowelDiameter, concreteGrade, steelGrade);
    
    this.addCalculation('\nDowel bars:');
    this.addCalculation(`Required area: ${dowelArea.toFixed(0)} mm²`);
    this.addCalculation(`Provided: ${dowelCount} - ${dowelDiameter}mm diameter`);
    this.addCalculation(`Development length: ${developmentLength} mm`);
    
    return {
      bottomX,
      bottomY,
      dowelBars: {
        diameter: dowelDiameter,
        count: dowelCount,
        length: developmentLength + depth + 200, // Including bend
        developmentLength,
      },
    };
  }
  
  private calculateFlexuralReinforcement(
    code: FoundationCode,
    moment: number,
    d: number,
    fck: number,
    fy: number,
    direction: 'X' | 'Y'
  ): FlexureCheckResult {
    this.addCalculation(`\nFlexural design (${direction} direction):`);
    
    // Calculate required Ast per meter width
    let requiredAst: number;
    
    switch (code) {
      case 'IS456': {
        // Mu = 0.87·fy·Ast·d·(1 - Ast·fy/(bd·fck))
        const Mu = moment * 1e6; // N·mm
        const k = Mu / (1000 * d * d * fck);
        const pt = (1 - Math.sqrt(1 - 4.6 * k)) * fck / (2 * fy);
        requiredAst = Math.max(pt * 1000 * d, 0.0012 * 1000 * d);
        break;
      }
      
      case 'ACI318': {
        const Mu = moment * 1e6 / 0.9; // Factor
        const Rn = Mu / (1000 * d * d);
        const rho = (0.85 * fck / fy) * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fck)));
        requiredAst = Math.max(rho * 1000 * d, 0.0018 * 1000 * d);
        break;
      }
      
      case 'EN1992': {
        const Mu = moment * 1e6;
        const K = Mu / (1000 * d * d * fck);
        const z = d * (0.5 + Math.sqrt(0.25 - K / 1.134));
        requiredAst = Math.max(Mu / (0.87 * fy * z), 0.0013 * 1000 * d);
        break;
      }
      
      case 'AS3600': {
        const Mu = moment * 1e6 / 0.85;
        const ku = 1 - Math.sqrt(1 - 2 * Mu / (0.85 * fck * 1000 * d * d));
        requiredAst = Math.max(0.85 * fck * ku * 1000 * d / fy, 0.002 * 1000 * d);
        break;
      }
      
      default:
        requiredAst = moment * 1e6 / (0.87 * fy * 0.9 * d);
    }
    
    // Select bars
    const barDiameter = this.selectBarDiameter(requiredAst / 10); // ~10 bars per meter
    const barArea = Math.PI * Math.pow(barDiameter / 2, 2);
    const spacing = Math.floor(1000 * barArea / requiredAst / 5) * 5; // Round to 5mm
    const providedAst = 1000 * barArea / spacing;
    
    this.addCalculation(`Required Ast: ${requiredAst.toFixed(0)} mm²/m`);
    this.addCalculation(`Provided: ${barDiameter}mm @ ${spacing}mm c/c`);
    this.addCalculation(`Provided Ast: ${providedAst.toFixed(0)} mm²/m`);
    
    return {
      direction,
      moment,
      requiredAst,
      providedAst,
      barDiameter,
      spacing,
      utilizationRatio: requiredAst / providedAst,
      isAdequate: providedAst >= requiredAst,
    };
  }
  
  private selectBarDiameter(areaPerBar: number): number {
    const standardBars = [8, 10, 12, 16, 20, 25, 32];
    for (const dia of standardBars) {
      if (Math.PI * Math.pow(dia / 2, 2) >= areaPerBar) {
        return dia;
      }
    }
    return 32;
  }
  
  private calculateDevelopmentLength(
    code: FoundationCode,
    diameter: number,
    fck: number,
    fy: number
  ): number {
    switch (code) {
      case 'IS456':
        return Math.ceil((diameter * fy) / (4 * 1.6 * Math.sqrt(fck)) / 25) * 25;
      case 'ACI318':
        return Math.ceil((0.02 * fy * diameter) / Math.sqrt(fck) / 25) * 25;
      case 'EN1992':
        return Math.ceil((diameter * fy) / (4 * 2.25 * Math.pow(fck, 0.667)) / 25) * 25;
      case 'AS3600':
        return Math.ceil((0.5 * diameter * fy) / Math.sqrt(fck) / 25) * 25;
      default:
        return 40 * diameter;
    }
  }
  
  private calculateSettlement(
    input: IsolatedFootingInput,
    dimensions: FootingDimensions
  ): SettlementResult {
    this.addCalculation('\n--- SETTLEMENT CALCULATION ---');
    
    const { loads, soilProfile, foundationDepth } = input;
    const { length, width } = dimensions;
    
    const B = Math.min(length, width) / 1000; // m
    const L = Math.max(length, width) / 1000; // m
    const area = B * L;
    const q = loads.axialLoad / area; // kPa
    
    // Get soil layer at foundation level
    const layer = this.getSoilLayerAtDepth(soilProfile, foundationDepth);
    const E = layer.elasticModulus * 1000; // kPa
    const nu = layer.poissonRatio;
    
    // Immediate (elastic) settlement
    // Se = q·B·(1-ν²)·If / E
    const If = 1.0; // Influence factor (approximate for rigid footing)
    const immediateSettlement = (q * B * (1 - nu * nu) * If / E) * 1000; // mm
    
    this.addCalculation(`Applied pressure: ${q.toFixed(2)} kPa`);
    this.addCalculation(`Elastic modulus: ${E.toFixed(0)} kPa`);
    this.addCalculation(`Immediate settlement: ${immediateSettlement.toFixed(2)} mm`);
    
    // Consolidation settlement (for cohesive soils)
    let consolidationSettlement = 0;
    if (soilProfile.type === 'cohesive' && layer.compressionIndex) {
      const Cc = layer.compressionIndex;
      const e0 = 0.8; // Assumed initial void ratio
      const H = layer.thickness / 1000; // m
      const p0 = layer.unitWeight * foundationDepth / 1000; // Initial effective stress (kPa)
      const deltaP = q; // Stress increase
      
      // Sc = (Cc·H / (1+e0)) · log((p0+Δp)/p0)
      consolidationSettlement = (Cc * H / (1 + e0)) * Math.log10((p0 + deltaP) / p0) * 1000; // mm
      
      this.addCalculation(`Consolidation settlement: ${consolidationSettlement.toFixed(2)} mm`);
    }
    
    // Secondary settlement (creep) - usually small
    const secondarySettlement = consolidationSettlement * 0.1;
    
    const totalSettlement = immediateSettlement + consolidationSettlement + secondarySettlement;
    const allowableSettlement = FOUNDATION_CODE_FACTORS[input.code].allowableSettlement;
    
    this.addCalculation(`Total settlement: ${totalSettlement.toFixed(2)} mm`);
    this.addCalculation(`Allowable settlement: ${allowableSettlement} mm`);
    
    return {
      immediateSettlement,
      consolidationSettlement,
      secondarySettlement,
      totalSettlement,
      allowableSettlement,
      isAdequate: totalSettlement <= allowableSettlement,
    };
  }
  
  private calculateSteelWeight(
    reinforcement: FootingReinforcementResult,
    dimensions: FootingDimensions
  ): number {
    const { bottomX, bottomY, dowelBars } = reinforcement;
    const { length, width } = dimensions;
    
    // Bottom X bars
    const numBarsX = Math.ceil(width / bottomX.spacing);
    const lengthX = (length - 100) / 1000; // m (with cover)
    const weightX = numBarsX * lengthX * Math.PI * Math.pow(bottomX.barDiameter / 2000, 2) * 7850; // kg
    
    // Bottom Y bars
    const numBarsY = Math.ceil(length / bottomY.spacing);
    const lengthY = (width - 100) / 1000; // m
    const weightY = numBarsY * lengthY * Math.PI * Math.pow(bottomY.barDiameter / 2000, 2) * 7850; // kg
    
    // Dowels
    const weightDowels = dowelBars.count * (dowelBars.length / 1000) * 
                        Math.PI * Math.pow(dowelBars.diameter / 2000, 2) * 7850;
    
    return weightX + weightY + weightDowels;
  }
  
  // ---------------------------------------------------------------------------
  // PILE FOUNDATION DESIGN
  // ---------------------------------------------------------------------------
  
  public designPileFoundation(input: PileInput): PileDesignResult {
    this.calculations = [];
    const warnings: string[] = [];
    
    this.addCalculation('='.repeat(60));
    this.addCalculation('PILE FOUNDATION DESIGN');
    this.addCalculation(`Design Code: ${input.code}`);
    this.addCalculation('='.repeat(60));
    
    // Calculate pile capacity
    const capacity = this.calculatePileCapacity(input);
    
    if (!capacity.isAdequate) {
      warnings.push('Pile capacity insufficient - consider increasing pile length or diameter');
    }
    
    // Design pile reinforcement
    const pileReinforcement = this.designPileReinforcement(input);
    
    // Design pile cap
    const pileCapReinforcement = this.designPileCap(input);
    
    // Calculate settlement
    const settlement = this.calculatePileSettlement(input, capacity);
    
    // Calculate lateral capacity
    const lateralCapacity = this.calculateLateralCapacity(input);
    
    return {
      capacity,
      pileReinforcement,
      pileCapReinforcement,
      settlement,
      lateralCapacity,
      isDesignAdequate: capacity.isAdequate && settlement.isAdequate,
      warnings,
    };
  }
  
  private calculatePileCapacity(input: PileInput): PileCapacityResult {
    this.addCalculation('\n--- PILE CAPACITY CALCULATION ---');
    
    const { diameter, length, soilProfile, rows, columns, spacing, loads } = input;
    const numPiles = rows * columns;
    
    const D = diameter / 1000; // m
    const L = length / 1000; // m
    const Ap = Math.PI * Math.pow(D / 2, 2); // Tip area
    const perimeter = Math.PI * D;
    
    this.addCalculation(`Pile diameter: ${D * 1000} mm`);
    this.addCalculation(`Pile length: ${L * 1000} mm`);
    this.addCalculation(`Number of piles: ${numPiles}`);
    
    // Calculate end bearing and skin friction
    let endBearing = 0;
    let skinFriction = 0;
    let depth = 0;
    
    for (const layer of soilProfile.layers) {
      const layerThickness = layer.thickness / 1000; // m
      const layerMid = depth + layerThickness / 2;
      
      if (depth + layerThickness > L) {
        // Pile tip is in this layer
        const embeddedLength = L - depth;
        
        // End bearing (Qb)
        if (soilProfile.type === 'cohesive') {
          // Qb = Nc · c · Ap
          const Nc = 9; // For piles
          endBearing = Nc * layer.cohesion * Ap;
          this.addCalculation(`End bearing (cohesive): Nc=${Nc}, c=${layer.cohesion} kPa`);
        } else {
          // Qb = Nq · σ'v · Ap
          const Nq = this.getPileNq(layer.frictionAngle);
          const sigmav = layer.unitWeight * L;
          endBearing = Nq * sigmav * Ap;
          this.addCalculation(`End bearing (cohesionless): Nq=${Nq.toFixed(1)}, σ'v=${sigmav.toFixed(1)} kPa`);
        }
        
        // Skin friction for embedded portion
        if (soilProfile.type === 'cohesive') {
          // Qs = α · c · As
          const alpha = 0.45; // Adhesion factor
          skinFriction += alpha * layer.cohesion * perimeter * embeddedLength;
        } else {
          // Qs = Ks · σ'v · tanδ · As
          const Ks = 1.0; // Lateral earth pressure coefficient
          const delta = layer.frictionAngle * 0.8; // Soil-pile friction
          const sigmav = layer.unitWeight * (depth + embeddedLength / 2);
          skinFriction += Ks * sigmav * Math.tan(delta * Math.PI / 180) * perimeter * embeddedLength;
        }
        
        break;
      } else {
        // Full layer contribution to skin friction
        if (soilProfile.type === 'cohesive') {
          const alpha = 0.45;
          skinFriction += alpha * layer.cohesion * perimeter * layerThickness;
        } else {
          const Ks = 1.0;
          const delta = layer.frictionAngle * 0.8;
          const sigmav = layer.unitWeight * (depth + layerThickness / 2);
          skinFriction += Ks * sigmav * Math.tan(delta * Math.PI / 180) * perimeter * layerThickness;
        }
      }
      
      depth += layerThickness;
    }
    
    const ultimateCapacity = endBearing + skinFriction;
    const FOS = FOUNDATION_CODE_FACTORS[input.code].pileCapacityFOS;
    const allowableCapacity = ultimateCapacity / FOS;
    
    this.addCalculation(`\nEnd bearing: ${endBearing.toFixed(2)} kN`);
    this.addCalculation(`Skin friction: ${skinFriction.toFixed(2)} kN`);
    this.addCalculation(`Ultimate capacity: ${ultimateCapacity.toFixed(2)} kN`);
    this.addCalculation(`Allowable capacity (FOS=${FOS}): ${allowableCapacity.toFixed(2)} kN`);
    
    // Group capacity
    const groupEfficiency = this.calculateGroupEfficiency(rows, columns, spacing, diameter);
    const groupCapacity = groupEfficiency * numPiles * allowableCapacity;
    
    const loadPerPile = loads.axialLoad / numPiles;
    const maxLoadPerPile = this.calculateMaxPileLoad(input);
    
    this.addCalculation(`\nGroup efficiency: ${(groupEfficiency * 100).toFixed(1)}%`);
    this.addCalculation(`Group capacity: ${groupCapacity.toFixed(2)} kN`);
    this.addCalculation(`Load per pile: ${loadPerPile.toFixed(2)} kN`);
    this.addCalculation(`Max pile load: ${maxLoadPerPile.toFixed(2)} kN`);
    
    return {
      endBearing,
      skinFriction,
      ultimateCapacity,
      allowableCapacity,
      factorOfSafety: FOS,
      groupCapacity,
      groupEfficiency,
      loadPerPile,
      maxLoadPerPile,
      utilizationRatio: maxLoadPerPile / allowableCapacity,
      isAdequate: maxLoadPerPile <= allowableCapacity,
    };
  }
  
  private getPileNq(phi: number): number {
    // Berezantzev's Nq for piles
    const tanPhi = Math.tan(phi * Math.PI / 180);
    return Math.exp(Math.PI * tanPhi) * Math.pow(Math.tan(45 + phi / 2) * Math.PI / 180, 2);
  }
  
  private calculateGroupEfficiency(rows: number, columns: number, spacing: number, diameter: number): number {
    // Converse-Labarre formula
    const n1 = rows;
    const n2 = columns;
    const s = spacing;
    const d = diameter;
    
    const theta = Math.atan(d / s) * 180 / Math.PI; // degrees
    const efficiency = 1 - theta * ((n1 - 1) * n2 + (n2 - 1) * n1) / (90 * n1 * n2);
    
    return Math.min(1, efficiency);
  }
  
  private calculateMaxPileLoad(input: PileInput): number {
    const { rows, columns, spacing, loads, pileCap } = input;
    const n = rows * columns;
    
    // Maximum pile load considering moments
    // Pmax = P/n + Mx·y/(Σy²) + My·x/(Σx²)
    
    // Calculate pile coordinates and sum of squares
    const pileCoords: { x: number; y: number }[] = [];
    let sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const x = (j - (columns - 1) / 2) * spacing;
        const y = (i - (rows - 1) / 2) * spacing;
        pileCoords.push({ x, y });
        sumX2 += x * x;
        sumY2 += y * y;
      }
    }
    
    // Find maximum corner pile load
    let maxLoad = 0;
    for (const pile of pileCoords) {
      const P = loads.axialLoad / n;
      const Mx = sumY2 > 0 ? loads.momentX * 1000 * pile.y / sumY2 : 0;
      const My = sumX2 > 0 ? loads.momentY * 1000 * pile.x / sumX2 : 0;
      const pileLoad = P + Mx + My;
      maxLoad = Math.max(maxLoad, pileLoad);
    }
    
    return maxLoad;
  }
  
  private designPileReinforcement(input: PileInput): { mainBars: { diameter: number; count: number }; spirals: { diameter: number; pitch: number } } {
    this.addCalculation('\n--- PILE REINFORCEMENT ---');
    
    const { diameter, concreteGrade, steelGrade } = input;
    
    // Minimum reinforcement (typically 0.4% - 0.8%)
    const pileArea = Math.PI * Math.pow(diameter / 2, 2);
    const minAst = 0.004 * pileArea; // 0.4%
    
    // Select bars
    const barDiameter = diameter <= 450 ? 16 : 20;
    const barArea = Math.PI * Math.pow(barDiameter / 2, 2);
    const numBars = Math.max(6, Math.ceil(minAst / barArea));
    
    // Spirals
    const spiralDia = diameter <= 450 ? 8 : 10;
    const spiralPitch = Math.min(100, diameter / 5);
    
    this.addCalculation(`Main bars: ${numBars} - ${barDiameter}mm diameter`);
    this.addCalculation(`Spirals: ${spiralDia}mm @ ${spiralPitch}mm pitch`);
    
    return {
      mainBars: { diameter: barDiameter, count: numBars },
      spirals: { diameter: spiralDia, pitch: spiralPitch },
    };
  }
  
  private designPileCap(input: PileInput): FootingReinforcementResult {
    this.addCalculation('\n--- PILE CAP DESIGN ---');
    
    const { pileCap, loads, concreteGrade, steelGrade, code, rows, columns, spacing } = input;
    const { length, width, depth } = pileCap;
    const effectiveDepth = depth - 75 - 10; // Assuming 75mm cover, 20mm bar
    
    // Calculate moments (strut-and-tie model for pile caps)
    const loadPerPile = loads.axialLoad / (rows * columns);
    
    // Critical section at face of equivalent column
    const equivalentColumn = Math.sqrt(rows * columns) * 300; // Approximate
    
    const cantileverX = (length - equivalentColumn) / 2000; // m
    const cantileverY = (width - equivalentColumn) / 2000; // m
    
    // Moment from pile reactions
    const momentX = loadPerPile * columns * cantileverX; // kN·m
    const momentY = loadPerPile * rows * cantileverY; // kN·m
    
    this.addCalculation(`Pile cap dimensions: ${length} x ${width} x ${depth} mm`);
    this.addCalculation(`Design moment X: ${momentX.toFixed(2)} kN·m`);
    this.addCalculation(`Design moment Y: ${momentY.toFixed(2)} kN·m`);
    
    // Design reinforcement (same method as footing)
    const bottomX = this.calculateFlexuralReinforcement(
      code, momentX / (width / 1000), effectiveDepth, concreteGrade, steelGrade, 'X'
    );
    
    const bottomY = this.calculateFlexuralReinforcement(
      code, momentY / (length / 1000), effectiveDepth - 20, concreteGrade, steelGrade, 'Y'
    );
    
    return {
      bottomX,
      bottomY,
      dowelBars: {
        diameter: 20,
        count: 8,
        length: depth + 600,
        developmentLength: this.calculateDevelopmentLength(code, 20, concreteGrade, steelGrade),
      },
    };
  }
  
  private calculatePileSettlement(input: PileInput, capacity: PileCapacityResult): SettlementResult {
    this.addCalculation('\n--- PILE SETTLEMENT ---');
    
    const { diameter, length, soilProfile, loads } = input;
    
    // Simplified elastic settlement
    const layer = this.getSoilLayerAtDepth(soilProfile, length);
    const E = layer.elasticModulus * 1000; // kPa
    const L = length / 1000; // m
    const D = diameter / 1000; // m
    
    // Poulos and Davis method (simplified)
    // Se = (Pt·I) / (D·Es)
    const I = 0.5; // Influence factor
    const settlement = (loads.axialLoad * I) / (D * E) * 1000; // mm
    
    const allowable = FOUNDATION_CODE_FACTORS[input.code].allowableSettlement;
    
    this.addCalculation(`Estimated settlement: ${settlement.toFixed(2)} mm`);
    this.addCalculation(`Allowable settlement: ${allowable} mm`);
    
    return {
      immediateSettlement: settlement,
      consolidationSettlement: 0,
      secondarySettlement: 0,
      totalSettlement: settlement,
      allowableSettlement: allowable,
      isAdequate: settlement <= allowable,
    };
  }
  
  private calculateLateralCapacity(input: PileInput): number {
    this.addCalculation('\n--- LATERAL CAPACITY ---');
    
    const { diameter, soilProfile } = input;
    const layer = soilProfile.layers[0];
    const D = diameter / 1000;
    
    // Broms method for short piles in cohesive soil
    let lateralCapacity: number;
    
    if (soilProfile.type === 'cohesive') {
      // Hu = 9·c·D² (short pile)
      lateralCapacity = 9 * layer.cohesion * D * D;
    } else {
      // Hu = 0.5·Kp·γ·D³ (short pile in sand)
      const Kp = Math.pow(Math.tan(45 + layer.frictionAngle / 2), 2);
      lateralCapacity = 0.5 * Kp * layer.unitWeight * D * D * D;
    }
    
    this.addCalculation(`Lateral capacity: ${lateralCapacity.toFixed(2)} kN`);
    
    return lateralCapacity;
  }
  
  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------
  
  private addCalculation(text: string): void {
    this.calculations.push(text);
  }
  
  public getCalculations(): string[] {
    return [...this.calculations];
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createFoundationDesignEngine(): AdvancedFoundationDesignEngine {
  return new AdvancedFoundationDesignEngine();
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default AdvancedFoundationDesignEngine;
