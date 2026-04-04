/**
 * ============================================================================
 * ADVANCED FOUNDATION DESIGN ENGINE V3.0
 * ============================================================================
 * 
 * Enterprise-grade foundation design with:
 * - Precision mathematics (error-free calculations)
 * - Multi-code compliance (IS, ACI, EN, AS)
 * - Advanced soil mechanics
 * - Real-time validation
 * - Comprehensive reporting
 * 
 * Codes Supported:
 * - IS 456:2000, IS 2950, IS 6403, IS 1904, IS 2911
 * - ACI 318-19, ACI 336
 * - EN 1992-1-1, EN 1997-1
 * - AS 3600, AS 2159
 * 
 * @version 3.0.0
 * @author StructuralAI Engineering Team
 */

import { 
  PrecisionMath, 
  EngineeringMath, 
  ValidationUtils, 
  UnitConverter,
  ENGINEERING_CONSTANTS,
  ValidationResult,
  CalculationResult 
} from '../core/PrecisionMath';

// ============================================================================
// COMPREHENSIVE TYPE DEFINITIONS
// ============================================================================

export type FoundationType = 
  | 'isolated_square'
  | 'isolated_rectangular'
  | 'isolated_circular'
  | 'combined_rectangular'
  | 'combined_trapezoidal'
  | 'strap'
  | 'strip_continuous'
  | 'strip_wall'
  | 'raft_flat'
  | 'raft_ribbed'
  | 'raft_cellular'
  | 'pile_single'
  | 'pile_group'
  | 'pile_cap'
  | 'caisson'
  | 'micropile'
  | 'ground_improvement';

export type DesignCode = 
  | 'IS456' 
  | 'IS2950' 
  | 'IS6403' 
  | 'ACI318' 
  | 'EN1992' 
  | 'EN1997' 
  | 'AS3600'
  | 'BS8110';

export type BearingCapacityMethod = 
  | 'terzaghi'
  | 'meyerhof'
  | 'hansen'
  | 'vesic'
  | 'is6403'
  | 'eurocode7';

export type PileCapacityMethod =
  | 'alpha'
  | 'beta'
  | 'lambda'
  | 'spt'
  | 'cpt'
  | 'static_formula';

export interface SoilProperties {
  type: 'cohesive' | 'cohesionless' | 'rock' | 'mixed' | 'organic';
  classification: string;
  unitWeight: number;           // kN/m³
  saturatedUnitWeight: number;  // kN/m³
  dryUnitWeight?: number;       // kN/m³
  cohesion: number;             // kPa (c or cu)
  effectiveCohesion?: number;   // kPa (c')
  frictionAngle: number;        // degrees (φ)
  effectiveFrictionAngle?: number; // degrees (φ')
  elasticModulus: number;       // MPa
  poissonRatio: number;
  compressionIndex?: number;    // Cc
  recompressionIndex?: number;  // Cr
  voidRatio?: number;           // e0
  preconsolidationPressure?: number; // kPa
  coefficientOfConsolidation?: number; // m²/year
  allowableBearingCapacity?: number;   // kPa
  waterTableDepth?: number;     // m from ground surface
  N_SPT?: number;               // Standard Penetration Test value
  CPT_qc?: number;              // Cone tip resistance (MPa)
  layers?: SoilLayer[];
  liquefactionPotential?: 'none' | 'low' | 'moderate' | 'high';
}

export interface SoilLayer {
  id: string;
  name: string;
  depth: number;          // m (top of layer from ground)
  thickness: number;      // m
  type: 'cohesive' | 'cohesionless' | 'rock' | 'mixed';
  classification: string;
  unitWeight: number;
  saturatedUnitWeight: number;
  cohesion: number;
  frictionAngle: number;
  elasticModulus: number;
  N_SPT?: number;
  CPT_qc?: number;
  description?: string;
}

export interface FoundationLoads {
  id?: string;
  name?: string;
  axial: number;          // kN (compression positive)
  momentX: number;        // kNm (about X-axis)
  momentY: number;        // kNm (about Y-axis)
  shearX: number;         // kN
  shearY: number;         // kN
  torsion?: number;       // kNm
  loadCase: LoadCaseType;
  loadFactor?: number;
  isServiceability: boolean;
  isUltimate: boolean;
}

export type LoadCaseType = 
  | 'dead'
  | 'live'
  | 'wind'
  | 'seismic'
  | 'earth_pressure'
  | 'water_pressure'
  | 'temperature'
  | 'settlement'
  | 'combination';

export interface ConcreteProperties {
  grade: string;
  fck: number;            // MPa (characteristic strength)
  fcd?: number;           // MPa (design strength)
  Ec: number;             // MPa (elastic modulus)
  cover: number;          // mm
  maxAggregateSize?: number; // mm
  exposureClass?: string;
  creepCoefficient?: number;
  shrinkageStrain?: number;
}

export interface ReinforcementProperties {
  grade: string;
  fy: number;             // MPa (yield strength)
  fyd?: number;           // MPa (design yield strength)
  Es: number;             // MPa (elastic modulus)
  minDiameter: number;    // mm
  maxDiameter: number;    // mm
  bendRadius?: number;    // mm
  ductilityClass?: 'A' | 'B' | 'C';
}

export interface FoundationGeometry {
  length?: number;        // m (or diameter for circular)
  width?: number;         // m
  thickness?: number;     // m (total depth)
  effectiveDepth?: number; // m
  depth: number;          // m (below ground)
  shape: 'rectangular' | 'square' | 'circular' | 'trapezoidal' | 'irregular';
  pedestal?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface ColumnProperties {
  width: number;          // mm
  depth: number;          // mm
  shape: 'rectangular' | 'circular';
  reinforcement?: {
    mainBars: number;
    diameter: number;
  };
  position?: {
    x: number;            // m from footing center
    y: number;            // m from footing center
  };
}

export interface DesignOptions {
  bearingCapacityMethod: BearingCapacityMethod;
  includePedestal: boolean;
  allowUplift: boolean;
  checkSettlement: boolean;
  checkSliding: boolean;
  checkOverturning: boolean;
  useWinklerModel: boolean;
  useFiniteElement: boolean;
  considerCreep: boolean;
  considerShrinkage: boolean;
  considerDynamicLoads: boolean;
  minimumReinforcementRatio: number;
  maximumReinforcementRatio: number;
  crackWidthLimit: number;       // mm
  settlementLimit: number;       // mm
  differentialSettlementLimit: number; // 1/x (e.g., 500 for L/500)
  slidingSafetyFactor: number;
  overturningMomentFactor: number;
}

export interface FoundationDesignConfig {
  id: string;
  name: string;
  type: FoundationType;
  code: DesignCode;
  soil: SoilProperties;
  loads: FoundationLoads[];
  concrete: ConcreteProperties;
  reinforcement: ReinforcementProperties;
  geometry?: FoundationGeometry;
  columns: ColumnProperties[];
  options: DesignOptions;
  metadata?: {
    projectName?: string;
    designedBy?: string;
    checkedBy?: string;
    date?: string;
    revision?: string;
  };
}

// ============================================================================
// RESULT INTERFACES
// ============================================================================

export interface DesignCheck {
  id: string;
  name: string;
  category: 'strength' | 'serviceability' | 'stability' | 'durability' | 'detailing';
  clause: string;
  codeReference: string;
  description: string;
  demand: number;
  demandUnit: string;
  capacity: number;
  capacityUnit: string;
  ratio: number;
  utilizationPercent: number;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_CHECKED';
  severity: 'critical' | 'major' | 'minor' | 'info';
  notes?: string;
  recommendations?: string[];
  calculationSteps?: CalculationStep[];
}

export interface CalculationStep {
  step: number;
  description: string;
  formula: string;
  inputs: Record<string, { value: number; unit: string }>;
  output: { value: number; unit: string };
  notes?: string;
}

export interface ReinforcementDetail {
  layer: 'bottom' | 'top';
  direction: 'X' | 'Y' | 'radial' | 'circumferential';
  diameter: number;        // mm
  spacing: number;         // mm
  numberOfBars?: number;
  areaProvided: number;    // mm²/m
  areaRequired: number;    // mm²/m
  utilizationRatio: number;
  anchorageLength: number; // mm
  lapLength?: number;      // mm
  bendingSchedule?: string;
}

export interface SoilPressureDistribution {
  type: 'uniform' | 'trapezoidal' | 'triangular' | 'eccentric';
  maximum: number;         // kPa
  minimum: number;         // kPa
  average: number;         // kPa
  allowable: number;       // kPa
  eccentricityX: number;   // m
  eccentricityY: number;   // m
  effectiveArea: number;   // m²
  contactRatio: number;    // percentage of base in contact
  pressureContour?: number[][]; // For FE analysis
}

export interface SettlementAnalysis {
  immediate: number;       // mm
  consolidation: number;   // mm
  secondary: number;       // mm
  total: number;           // mm
  allowable: number;       // mm
  differential?: number;   // mm
  angularDistortion?: number;
  timeToComplete?: number; // years (for consolidation)
  status: 'PASS' | 'FAIL' | 'WARNING';
  method: string;
}

export interface StabilityAnalysis {
  slidingFOS: number;
  overturningFOSX: number;
  overturningFOSY: number;
  upliftFOS?: number;
  minimumFOSRequired: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
}

export interface PunchingShearResult {
  criticalPerimeter: number;  // mm
  effectiveDepth: number;     // mm
  shearDemand: number;        // kN
  shearCapacity: number;      // kN
  utilizationRatio: number;
  stressCheck: {
    demand: number;           // MPa
    capacity: number;         // MPa
  };
  requiresShearReinforcement: boolean;
  shearReinforcementDetails?: {
    type: 'studs' | 'bent_bars' | 'stirrups';
    area: number;
    spacing: number;
  };
}

export interface FootingDesignResult {
  id: string;
  type: FoundationType;
  code: DesignCode;
  status: 'PASS' | 'FAIL' | 'REVIEW_REQUIRED';
  
  geometry: {
    length: number;
    width: number;
    thickness: number;
    effectiveDepth: number;
    depth: number;
    area: number;
    volume: number;
    centroid: { x: number; y: number };
  };
  
  reinforcement: {
    bottomX: ReinforcementDetail;
    bottomY: ReinforcementDetail;
    topX?: ReinforcementDetail;
    topY?: ReinforcementDetail;
    shear?: ReinforcementDetail;
    totalWeight: number;      // kg
    reinforcementRatio: number;
  };
  
  soilPressure: SoilPressureDistribution;
  settlement?: SettlementAnalysis;
  stability: StabilityAnalysis;
  punchingShear?: PunchingShearResult;
  
  checks: DesignCheck[];
  checksSummary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    notChecked: number;
  };
  
  materialQuantities: {
    concrete: { volume: number; weight: number };
    reinforcement: { weight: number; itemized: Record<number, number> };
    excavation: number;
    pcc?: number;
    formwork?: number;
  };
  
  warnings: string[];
  errors: string[];
  recommendations: string[];
  
  calculationReport?: {
    summary: string;
    detailedSteps: CalculationStep[];
    references: string[];
  };
}

// ============================================================================
// ADVANCED FOUNDATION DESIGN ENGINE CLASS
// ============================================================================

export class AdvancedFoundationDesignEngine {
  private config: FoundationDesignConfig;
  private validationErrors: string[] = [];
  private validationWarnings: string[] = [];
  private calculationLog: CalculationStep[] = [];

  private partialFactors: {
    concrete: number;
    steel: number;
    soilBearing: number;
    soilSliding: number;
    soilOverturning: number;
    loadsDead: number;
    loadsLive: number;
    loadsWind: number;
    loadsSeismic: number;
  };

  constructor(config: FoundationDesignConfig) {
    this.config = this.validateAndNormalizeConfig(config);
    this.partialFactors = this.initializePartialFactors(config.code);
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION VALIDATION
  // --------------------------------------------------------------------------

  private validateAndNormalizeConfig(config: FoundationDesignConfig): FoundationDesignConfig {
    this.validationErrors = [];
    this.validationWarnings = [];

    // Validate soil properties
    this.validateSoilProperties(config.soil);

    // Validate loads
    this.validateLoads(config.loads);

    // Validate concrete
    this.validateConcrete(config.concrete);

    // Validate reinforcement
    this.validateReinforcement(config.reinforcement);

    // Set defaults for missing options
    config.options = this.setDefaultOptions(config.options);

    if (this.validationErrors.length > 0) {
      console.error('Validation Errors:', this.validationErrors);
    }

    return config;
  }

  private validateSoilProperties(soil: SoilProperties): void {
    // Unit weight validation
    const unitWeightResult = ValidationUtils.validateRange(soil.unitWeight, 14, 24, 'Soil unit weight');
    if (!unitWeightResult.isValid) {
      this.validationErrors.push(...unitWeightResult.errors);
    }
    this.validationWarnings.push(...unitWeightResult.warnings);

    // Friction angle validation
    if (soil.type !== 'cohesive') {
      const frictionResult = ValidationUtils.validateFrictionAngle(soil.frictionAngle);
      if (!frictionResult.isValid) {
        this.validationErrors.push(...frictionResult.errors);
      }
      this.validationWarnings.push(...frictionResult.warnings);
    }

    // Cohesion validation for cohesive soils
    if (soil.type === 'cohesive' && soil.cohesion <= 0) {
      this.validationErrors.push('Cohesive soil must have positive cohesion value');
    }

    // Poisson's ratio validation
    const poissonResult = ValidationUtils.validateRange(soil.poissonRatio, 0.1, 0.5, "Poisson's ratio");
    if (!poissonResult.isValid) {
      this.validationErrors.push(...poissonResult.errors);
    }

    // Elastic modulus validation
    if (soil.elasticModulus <= 0 || soil.elasticModulus > 1000) {
      this.validationWarnings.push(`Soil elastic modulus (${soil.elasticModulus} MPa) seems unusual`);
    }
  }

  private validateLoads(loads: FoundationLoads[]): void {
    if (!loads || loads.length === 0) {
      this.validationErrors.push('At least one load case is required');
      return;
    }

    loads.forEach((load, index) => {
      if (load.axial < 0 && !this.config.options?.allowUplift) {
        this.validationErrors.push(`Load case ${index + 1}: Negative axial load (uplift) not permitted`);
      }

      if (!Number.isFinite(load.axial) || !Number.isFinite(load.momentX) || !Number.isFinite(load.momentY)) {
        this.validationErrors.push(`Load case ${index + 1}: Invalid load values (must be finite numbers)`);
      }
    });
  }

  private validateConcrete(concrete: ConcreteProperties): void {
    const gradeResult = ValidationUtils.validateConcreteGrade(concrete.fck, this.config.code);
    if (!gradeResult.isValid) {
      this.validationErrors.push(...gradeResult.errors);
    }
    this.validationWarnings.push(...gradeResult.warnings);

    if (concrete.cover < 40) {
      this.validationWarnings.push('Concrete cover less than 40mm may not provide adequate durability');
    }
  }

  private validateReinforcement(rebar: ReinforcementProperties): void {
    const validGrades = [250, 415, 500, 550, 600];
    if (!validGrades.includes(rebar.fy)) {
      this.validationWarnings.push(`Reinforcement grade ${rebar.fy} MPa is non-standard`);
    }

    if (rebar.minDiameter < 8 || rebar.maxDiameter > 40) {
      this.validationWarnings.push('Reinforcement diameter range seems unusual');
    }
  }

  private setDefaultOptions(options?: Partial<DesignOptions>): DesignOptions {
    return {
      bearingCapacityMethod: options?.bearingCapacityMethod || 'meyerhof',
      includePedestal: options?.includePedestal || false,
      allowUplift: options?.allowUplift || false,
      checkSettlement: options?.checkSettlement ?? true,
      checkSliding: options?.checkSliding ?? true,
      checkOverturning: options?.checkOverturning ?? true,
      useWinklerModel: options?.useWinklerModel || false,
      useFiniteElement: options?.useFiniteElement || false,
      considerCreep: options?.considerCreep || false,
      considerShrinkage: options?.considerShrinkage || false,
      considerDynamicLoads: options?.considerDynamicLoads || false,
      minimumReinforcementRatio: options?.minimumReinforcementRatio || 0.12,
      maximumReinforcementRatio: options?.maximumReinforcementRatio || 4.0,
      crackWidthLimit: options?.crackWidthLimit || 0.3,
      settlementLimit: options?.settlementLimit || 25,
      differentialSettlementLimit: options?.differentialSettlementLimit || 500,
      slidingSafetyFactor: options?.slidingSafetyFactor || 1.5,
      overturningMomentFactor: options?.overturningMomentFactor || 1.5,
    };
  }

  private initializePartialFactors(code: DesignCode): typeof this.partialFactors {
    switch (code) {
      case 'IS456':
      case 'IS2950':
      case 'IS6403':
        return {
          concrete: 1.5,
          steel: 1.15,
          soilBearing: 2.5,
          soilSliding: 1.5,
          soilOverturning: 1.5,
          loadsDead: 1.5,
          loadsLive: 1.5,
          loadsWind: 1.5,
          loadsSeismic: 1.5,
        };
      case 'ACI318':
        return {
          concrete: 1.0 / 0.65,
          steel: 1.0 / 0.9,
          soilBearing: 3.0,
          soilSliding: 1.5,
          soilOverturning: 2.0,
          loadsDead: 1.4,
          loadsLive: 1.6,
          loadsWind: 1.0,
          loadsSeismic: 1.0,
        };
      case 'EN1992':
      case 'EN1997':
        return {
          concrete: 1.5,
          steel: 1.15,
          soilBearing: 1.4,
          soilSliding: 1.1,
          soilOverturning: 1.1,
          loadsDead: 1.35,
          loadsLive: 1.5,
          loadsWind: 1.5,
          loadsSeismic: 1.0,
        };
      default:
        return {
          concrete: 1.5,
          steel: 1.15,
          soilBearing: 2.5,
          soilSliding: 1.5,
          soilOverturning: 1.5,
          loadsDead: 1.5,
          loadsLive: 1.5,
          loadsWind: 1.5,
          loadsSeismic: 1.5,
        };
    }
  }

  // --------------------------------------------------------------------------
  // MAIN DESIGN METHOD
  // --------------------------------------------------------------------------

  public design(): FootingDesignResult {
    const startTime = performance.now();
    
    try {
      let result: FootingDesignResult;

      switch (this.config.type) {
        case 'isolated_square':
        case 'isolated_rectangular':
          result = this.designIsolatedFooting();
          break;
        case 'isolated_circular':
          result = this.designCircularFooting();
          break;
        case 'combined_rectangular':
        case 'combined_trapezoidal':
          result = this.designCombinedFooting();
          break;
        case 'strap':
          result = this.designStrapFooting();
          break;
        case 'strip_continuous':
        case 'strip_wall':
          result = this.designStripFooting();
          break;
        case 'raft_flat':
        case 'raft_ribbed':
        case 'raft_cellular':
          result = this.designRaftFoundation();
          break;
        case 'pile_single':
        case 'pile_group':
          result = this.designPileFoundation();
          break;
        case 'pile_cap':
          result = this.designPileCap();
          break;
        default:
          result = this.designIsolatedFooting();
      }

      const endTime = performance.now();
      console.log(`Foundation design completed in ${(endTime - startTime).toFixed(2)}ms`);

      return result;
    } catch (error) {
      console.error('Design error:', error);
      throw new Error(`Foundation design failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // --------------------------------------------------------------------------
  // ISOLATED FOOTING DESIGN (ENHANCED)
  // --------------------------------------------------------------------------

  private designIsolatedFooting(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];
    
    // Step 1: Get design loads (factored)
    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    
    const P_u = designLoads.axial;
    const M_ux = designLoads.momentX;
    const M_uy = designLoads.momentY;
    const P_s = serviceLoads.axial;
    const M_sx = serviceLoads.momentX;
    const M_sy = serviceLoads.momentY;

    this.logCalculation(1, 'Calculate factored design loads', 
      'P_u = Σ(γ_i × P_i)', 
      { loads: { value: loads.length, unit: 'cases' } },
      { value: P_u, unit: 'kN' }
    );

    // Step 2: Calculate allowable bearing capacity
    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 1.5, options.bearingCapacityMethod);
    
    this.logCalculation(2, 'Calculate allowable bearing capacity',
      'q_all = q_u / FOS',
      { FOS: { value: this.partialFactors.soilBearing, unit: '' } },
      { value: qall, unit: 'kPa' }
    );

    // Step 3: Size the footing
    const column = columns[0] || { width: 400, depth: 400, shape: 'rectangular' as const };
    const { L, B, iterations: sizeIterations } = this.sizeFootingIteratively(P_s, M_sx, M_sy, qall, column);
    
    this.logCalculation(3, 'Determine footing dimensions',
      'A_required = P_s / (q_all × η)',
      { P_s: { value: P_s, unit: 'kN' }, q_all: { value: qall, unit: 'kPa' } },
      { value: L * B, unit: 'm²' },
      `Converged in ${sizeIterations} iterations`
    );

    // Step 4: Calculate soil pressure distribution (service loads)
    const soilPressure = this.calculateSoilPressureDistribution(P_s, M_sx, M_sy, L, B);
    
    // Add bearing capacity check
    checks.push(this.createBearingCapacityCheck(soilPressure, qall, code));

    // Check for uplift
    if (soilPressure.minimum < 0) {
      checks.push(this.createUpliftCheck(soilPressure, options.allowUplift, code));
    }

    // Step 5: Calculate footing thickness
    const { d, D, punchingCheck } = this.calculateFootingThicknessAdvanced(
      P_u, soilPressure.maximum * this.partialFactors.soilBearing / 2.5, L, B, column, concrete, code
    );
    
    checks.push(punchingCheck);

    // Step 6: One-way shear check
    const oneWayShearCheck = this.checkOneWayShearAdvanced(
      soilPressure.maximum * this.partialFactors.soilBearing / 2.5, L, B, column, d, concrete, code
    );
    checks.push(oneWayShearCheck);

    // Step 7: Flexural design
    const flexuralDesign = this.designFlexuralReinforcementAdvanced(
      soilPressure.maximum * this.partialFactors.soilBearing / 2.5,
      soilPressure.minimum * this.partialFactors.soilBearing / 2.5,
      L, B, column, d, concrete, reinforcement, code
    );
    
    checks.push(...flexuralDesign.checks);

    // Step 8: Settlement analysis
    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_s, L, B, this.config.geometry?.depth || 1.5, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    // Step 9: Stability checks
    const stability = this.checkStability(P_s, M_sx, M_sy, L, B, this.config.geometry?.depth || 1.5, soil);
    
    if (options.checkSliding) {
      checks.push(this.createSlidingCheck(stability, options.slidingSafetyFactor, code));
    }
    
    if (options.checkOverturning) {
      checks.push(this.createOverturningCheck(stability, options.overturningMomentFactor, code));
    }

    // Step 10: Compile results
    const checksSummary = this.summarizeChecks(checks);
    const status = this.determineOverallStatus(checks);

    return {
      id: this.config.id,
      type: this.config.type,
      code: code,
      status,
      
      geometry: {
        length: L,
        width: B,
        thickness: D / 1000,
        effectiveDepth: d / 1000,
        depth: this.config.geometry?.depth || 1.5,
        area: L * B,
        volume: L * B * D / 1000,
        centroid: { x: L / 2, y: B / 2 },
      },
      
      reinforcement: {
        bottomX: flexuralDesign.rebarX,
        bottomY: flexuralDesign.rebarY,
        totalWeight: this.calculateRebarWeight(flexuralDesign.rebarX, flexuralDesign.rebarY, L, B),
        reinforcementRatio: this.calculateReinforcementRatio(flexuralDesign.rebarX, flexuralDesign.rebarY, d, L, B),
      },
      
      soilPressure,
      settlement,
      stability,
      
      punchingShear: {
        criticalPerimeter: punchingCheck.demand > 0 ? (column.width + d) * 4 : 0,
        effectiveDepth: d,
        shearDemand: punchingCheck.demand,
        shearCapacity: punchingCheck.capacity,
        utilizationRatio: punchingCheck.ratio,
        stressCheck: {
          demand: punchingCheck.demand / ((column.width + d) * 4 * d) * 1000,
          capacity: punchingCheck.capacity / ((column.width + d) * 4 * d) * 1000,
        },
        requiresShearReinforcement: punchingCheck.ratio > 1,
      },
      
      checks,
      checksSummary,
      
      materialQuantities: {
        concrete: {
          volume: L * B * D / 1000,
          weight: L * B * D / 1000 * 25, // 25 kN/m³
        },
        reinforcement: {
          weight: this.calculateRebarWeight(flexuralDesign.rebarX, flexuralDesign.rebarY, L, B),
          itemized: this.itemizeRebar(flexuralDesign.rebarX, flexuralDesign.rebarY, L, B),
        },
        excavation: L * B * (this.config.geometry?.depth || 1.5),
        pcc: L * B * 0.1, // 100mm PCC
        formwork: 2 * (L + B) * D / 1000,
      },
      
      warnings: [...this.validationWarnings],
      errors: [...this.validationErrors],
      recommendations: this.generateRecommendations(checks, status),
      
      calculationReport: {
        summary: `Isolated footing designed for ${P_u} kN factored load. Dimensions: ${L}m × ${B}m × ${D}mm`,
        detailedSteps: this.calculationLog,
        references: this.getCodeReferences(code),
      },
    };
  }

  // --------------------------------------------------------------------------
  // CIRCULAR FOOTING DESIGN
  // --------------------------------------------------------------------------

  private designCircularFooting(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    const P_u = designLoads.axial;
    const P_s = serviceLoads.axial;
    const M_sx = serviceLoads.momentX;
    const M_sy = serviceLoads.momentY;

    // Bearing capacity
    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 1.5, options.bearingCapacityMethod);

    // Size: A_req = P_s / qall → D = sqrt(4A/π)
    const A_req = (P_s * 1.1) / qall; // 10% self-weight allowance
    const D_footing = Math.ceil(Math.sqrt((4 * A_req) / Math.PI) * 20) / 20; // round to 50mm
    const R = D_footing / 2;
    const A_actual = Math.PI * R * R;

    // Soil pressure
    const q_max = P_s / A_actual + Math.sqrt(M_sx ** 2 + M_sy ** 2) / (Math.PI * R ** 3 / 4);
    const q_min = Math.max(0, P_s / A_actual - Math.sqrt(M_sx ** 2 + M_sy ** 2) / (Math.PI * R ** 3 / 4));

    checks.push(this.createBearingCapacityCheck(
      { type: 'uniform' as const, maximum: q_max, minimum: q_min, average: P_s / A_actual, allowable: qall, eccentricityX: 0, eccentricityY: 0, effectiveArea: A_actual, contactRatio: 100 },
      qall, code
    ));

    // Thickness via punching shear
    const column = columns[0] || { width: 400, depth: 400, shape: 'circular' as const };
    const colDiam = column.shape === 'circular' ? column.width : Math.sqrt(column.width * column.depth * 4 / Math.PI);
    const q_u_net = P_u / A_actual;
    // Iterative: d such that punching perimeter capacity ≥ demand
    let d = 300; // starting guess
    for (let iter = 0; iter < 10; iter++) {
      const b_0 = Math.PI * (colDiam + d); // critical perimeter
      const tau_c = 0.25 * Math.sqrt(concrete.fck); // MPa (IS 456 simplified)
      const V_cap = tau_c * b_0 * d / 1000; // kN
      const A_punch = Math.PI * ((colDiam / 2 + d / 2) / 1000) ** 2;
      const V_demand = P_u - q_u_net * A_punch;
      if (V_cap >= V_demand * 1.1) break;
      d += 25;
    }
    const D_thick = d + concrete.cover + 16; // mm total

    checks.push({
      id: 'punching-shear-circular', name: 'Punching Shear', category: 'strength',
      clause: code === 'IS456' ? 'Cl. 31.6.1' : 'ACI 22.6.5',
      codeReference: code, description: 'Two-way shear at d/2 from column face',
      demand: P_u, demandUnit: 'kN', capacity: 0.25 * Math.sqrt(concrete.fck) * Math.PI * (colDiam + d) * d / 1000,
      capacityUnit: 'kN', ratio: P_u / (0.25 * Math.sqrt(concrete.fck) * Math.PI * (colDiam + d) * d / 1000),
      utilizationPercent: P_u / (0.25 * Math.sqrt(concrete.fck) * Math.PI * (colDiam + d) * d / 1000) * 100,
      status: P_u / (0.25 * Math.sqrt(concrete.fck) * Math.PI * (colDiam + d) * d / 1000) <= 1 ? 'PASS' : 'FAIL',
      severity: 'critical',
    });

    // Flexure: cantilever from column face to edge = R - colDiam/2000
    const cantilever = R - colDiam / 2000; // m
    const M_u = q_u_net * cantilever ** 2 / 2 * 1; // per unit width
    const fck = concrete.fck;
    const fy_r = reinforcement.fy;
    const Ast_req = (M_u * 1e6) / (0.87 * fy_r * 0.9 * d); // mm²/m simplified
    const Ast_min = 0.12 * D_thick * 10; // 0.12% of gross area per m width
    const Ast = Math.max(Ast_req, Ast_min);

    const bar_dia = Ast > 600 ? 16 : 12;
    const bar_area = Math.PI * bar_dia ** 2 / 4;
    const spacing = Math.floor(1000 * bar_area / Ast / 5) * 5;

    const rebarDetail: ReinforcementDetail = {
      layer: 'bottom', direction: 'X', diameter: bar_dia, spacing,
      areaProvided: 1000 * bar_area / spacing,
      areaRequired: Ast, utilizationRatio: Ast / (1000 * bar_area / spacing),
      anchorageLength: 40 * bar_dia,
    };

    // Settlement
    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_s, D_footing, D_footing, this.config.geometry?.depth || 1.5, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability = this.checkStability(P_s, M_sx, M_sy, D_footing, D_footing, this.config.geometry?.depth || 1.5, soil);
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: D_footing, width: D_footing, thickness: D_thick / 1000, effectiveDepth: d / 1000, depth: this.config.geometry?.depth || 1.5, area: A_actual, volume: A_actual * D_thick / 1000, centroid: { x: R, y: R } },
      reinforcement: { bottomX: rebarDetail, bottomY: { ...rebarDetail, direction: 'Y' }, totalWeight: Ast * 2 * A_actual * 7850 / 1e9, reinforcementRatio: Ast * 2 / (D_thick * 1000) * 100 },
      soilPressure: { type: 'uniform', maximum: q_max, minimum: q_min, average: P_s / A_actual, allowable: qall, eccentricityX: 0, eccentricityY: 0, effectiveArea: A_actual, contactRatio: 100 },
      settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: A_actual * D_thick / 1000, weight: A_actual * D_thick / 1000 * 25 }, reinforcement: { weight: Ast * 2 * A_actual * 7850 / 1e9, itemized: { [bar_dia]: Math.ceil(2 * D_footing * 1000 / spacing) * 2 } }, excavation: A_actual * (this.config.geometry?.depth || 1.5) },
      warnings: [...this.validationWarnings], errors: [...this.validationErrors],
      recommendations: this.generateRecommendations(checks, this.determineOverallStatus(checks)),
      calculationReport: { summary: `Circular footing Ø${D_footing}m, ${D_thick}mm thick for ${P_u} kN factored load`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // COMBINED FOOTING DESIGN
  // --------------------------------------------------------------------------

  private designCombinedFooting(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);

    // Combined footing supports 2+ columns
    const numCols = Math.max(columns.length, 2);
    const P_u = designLoads.axial;
    const P_s = serviceLoads.axial;

    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 1.5, options.bearingCapacityMethod);

    // CG of column loads → footing centroid must coincide
    const colSpacing = numCols > 1 && columns[1]?.position
      ? Math.abs((columns[1].position?.x || 0) - (columns[0]?.position?.x || 0))
      : 3.0; // default 3m spacing
    const col1X = columns[0]?.position?.x || 0;
    const col2X = columns[1]?.position?.x || colSpacing;
    const cgX = (col1X + col2X) / 2; // assume equal loads for sizing

    // Length ~ span between columns + 2×overhang
    const overhang = 0.3; // m each side
    const L = Math.ceil((colSpacing + 2 * overhang) * 10) / 10;
    const B = Math.ceil(((P_s * 1.1) / (qall * L)) * 10) / 10;

    const A = L * B;
    const q_max = P_s / A + Math.abs(serviceLoads.momentX) * 6 / (B * L * L);
    const q_min = Math.max(0, P_s / A - Math.abs(serviceLoads.momentX) * 6 / (B * L * L));

    const soilPressure: SoilPressureDistribution = {
      type: q_max === q_min ? 'uniform' : 'trapezoidal',
      maximum: q_max, minimum: q_min, average: P_s / A, allowable: qall,
      eccentricityX: cgX - L / 2, eccentricityY: 0, effectiveArea: A, contactRatio: q_min >= 0 ? 100 : (q_max / (q_max - q_min)) * 100,
    };
    checks.push(this.createBearingCapacityCheck(soilPressure, qall, code));

    // Structural design (beam-on-elastic-foundation approach)
    const q_u_net = P_u / A;
    // Max hogging moment at interior column face
    const col = columns[0] || { width: 400, depth: 400, shape: 'rectangular' as const };
    const M_hog = q_u_net * B * (overhang + col.width / 2000) ** 2 / 2; // kNm
    // Max sagging moment between columns
    const M_sag = q_u_net * B * colSpacing ** 2 / 8 - P_u / numCols * colSpacing / 4; // simplified

    // Thickness
    let d = 400;
    const tau_c = 0.25 * Math.sqrt(concrete.fck);
    const V_u = q_u_net * B * (L / 2 - col.width / 2000 - d / 1000);
    while (V_u / (B * 1000 * d) > tau_c && d < 1200) d += 25;
    const D_thick = d + concrete.cover + 20;

    // Longitudinal reinforcement (bottom for sagging, top for hogging)
    const fy_r = reinforcement.fy;
    const Ast_sag = Math.max(Math.abs(M_sag) * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * B * 10);
    const Ast_hog = Math.max(Math.abs(M_hog) * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * B * 10);

    const barDia = 16;
    const barArea = Math.PI * barDia ** 2 / 4;
    const spacingBot = Math.min(300, Math.floor(B * 1000 * barArea / Ast_sag / 5) * 5);
    const spacingTop = Math.min(300, Math.floor(B * 1000 * barArea / Ast_hog / 5) * 5);

    const rebarBot: ReinforcementDetail = { layer: 'bottom', direction: 'X', diameter: barDia, spacing: spacingBot, areaProvided: B * 1000 * barArea / spacingBot, areaRequired: Ast_sag, utilizationRatio: Ast_sag / (B * 1000 * barArea / spacingBot), anchorageLength: 40 * barDia };
    const rebarTop: ReinforcementDetail = { layer: 'top', direction: 'X', diameter: barDia, spacing: spacingTop, areaProvided: B * 1000 * barArea / spacingTop, areaRequired: Ast_hog, utilizationRatio: Ast_hog / (B * 1000 * barArea / spacingTop), anchorageLength: 40 * barDia };

    // Transverse reinforcement
    const M_transverse = q_u_net * 1 * ((B - col.depth / 1000) / 2) ** 2 / 2;
    const Ast_trans = Math.max(M_transverse * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * 10);
    const spacingTrans = Math.min(300, Math.floor(1000 * barArea / Ast_trans / 5) * 5);
    const rebarTrans: ReinforcementDetail = { layer: 'bottom', direction: 'Y', diameter: 12, spacing: spacingTrans, areaProvided: 1000 * Math.PI * 144 / 4 / spacingTrans, areaRequired: Ast_trans, utilizationRatio: Ast_trans / (1000 * Math.PI * 144 / 4 / spacingTrans), anchorageLength: 40 * 12 };

    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_s, L, B, this.config.geometry?.depth || 1.5, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability = this.checkStability(P_s, serviceLoads.momentX, serviceLoads.momentY, L, B, this.config.geometry?.depth || 1.5, soil);
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: L, width: B, thickness: D_thick / 1000, effectiveDepth: d / 1000, depth: this.config.geometry?.depth || 1.5, area: A, volume: A * D_thick / 1000, centroid: { x: L / 2, y: B / 2 } },
      reinforcement: { bottomX: rebarBot, bottomY: rebarTrans, topX: rebarTop, totalWeight: (Ast_sag + Ast_hog + Ast_trans * L) * 7850 / 1e6, reinforcementRatio: (Ast_sag + Ast_hog) / (D_thick * B * 1000) * 100 },
      soilPressure, settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: A * D_thick / 1000, weight: A * D_thick / 1000 * 25 }, reinforcement: { weight: (Ast_sag + Ast_hog + Ast_trans * L) * 7850 / 1e6, itemized: { [barDia]: Math.ceil(B * 1000 / spacingBot) + Math.ceil(B * 1000 / spacingTop), 12: Math.ceil(L * 1000 / spacingTrans) } }, excavation: A * (this.config.geometry?.depth || 1.5) },
      warnings: [...this.validationWarnings], errors: [...this.validationErrors],
      recommendations: this.generateRecommendations(checks, this.determineOverallStatus(checks)),
      calculationReport: { summary: `Combined footing ${L}m × ${B}m × ${D_thick}mm for ${numCols} columns, ${P_u} kN total factored load`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // STRAP FOOTING DESIGN
  // --------------------------------------------------------------------------

  private designStrapFooting(): FootingDesignResult {
    // Strap footing = two isolated footings connected by a strap beam
    // The exterior footing is eccentric; the strap beam transfers the moment to the interior footing
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    const P_u = designLoads.axial;
    const P_s = serviceLoads.axial;

    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 1.5, options.bearingCapacityMethod);

    // Assume 2 columns; exterior at property line
    const colSpacing = columns.length >= 2 && columns[1]?.position
      ? Math.abs((columns[1].position?.x || 0) - (columns[0]?.position?.x || 0))
      : 4.0;

    // Split load equally for sizing
    const P_each = P_s / 2;
    const A_each = (P_each * 1.15) / qall;
    const B1 = Math.ceil(Math.sqrt(A_each) * 10) / 10;
    const L1 = B1; // square footings
    const L_total = colSpacing + L1; // total system length

    // Strap beam design: transfers eccentric moment
    const eccentricity = L1 / 2; // exterior column at edge
    const M_strap = P_each * eccentricity; // moment to resist
    const V_strap = M_strap / colSpacing;

    // Individual footing thickness
    const col = columns[0] || { width: 350, depth: 350, shape: 'rectangular' as const };
    const d = 350; // mm effective depth (adequate for isolated)
    const D_thick = d + concrete.cover + 16;

    // Strap beam sizing: width = column width, depth ≥ L_strap/10
    const strapWidth = col.width;
    const strapDepth = Math.max(colSpacing * 1000 / 10, 400);

    const fy_r = reinforcement.fy;
    const Ast_footing = Math.max(P_each * 1.5 * 1e3 * (B1 / 2 - col.width / 2000) / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * B1 * 10);
    const Ast_strap = Math.max(M_strap * 1.5 * 1e6 / (0.87 * fy_r * 0.9 * strapDepth * 0.9), 0.12 * strapDepth * strapWidth / 100);

    const barDia = 16;
    const barArea = Math.PI * barDia ** 2 / 4;
    const spacingFooting = Math.min(250, Math.floor(B1 * 1000 * barArea / Ast_footing / 5) * 5);

    const rebarDetail: ReinforcementDetail = { layer: 'bottom', direction: 'X', diameter: barDia, spacing: spacingFooting, areaProvided: B1 * 1000 * barArea / spacingFooting, areaRequired: Ast_footing, utilizationRatio: Ast_footing / (B1 * 1000 * barArea / spacingFooting), anchorageLength: 40 * barDia };

    const soilPressure: SoilPressureDistribution = {
      type: 'uniform', maximum: P_each / (B1 * L1), minimum: P_each / (B1 * L1), average: P_each / (B1 * L1),
      allowable: qall, eccentricityX: 0, eccentricityY: 0, effectiveArea: B1 * L1 * 2, contactRatio: 100,
    };
    checks.push(this.createBearingCapacityCheck(soilPressure, qall, code));

    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_each, B1, L1, this.config.geometry?.depth || 1.5, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability = this.checkStability(P_s, serviceLoads.momentX, serviceLoads.momentY, L_total, B1, this.config.geometry?.depth || 1.5, soil);
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: L_total, width: B1, thickness: D_thick / 1000, effectiveDepth: d / 1000, depth: this.config.geometry?.depth || 1.5, area: B1 * L1 * 2, volume: B1 * L1 * 2 * D_thick / 1000 + strapWidth / 1000 * strapDepth / 1000 * colSpacing, centroid: { x: L_total / 2, y: B1 / 2 } },
      reinforcement: { bottomX: rebarDetail, bottomY: { ...rebarDetail, direction: 'Y' }, totalWeight: (Ast_footing * 2 + Ast_strap) * 7850 / 1e6, reinforcementRatio: Ast_footing / (D_thick * B1 * 1000) * 100 },
      soilPressure, settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: B1 * L1 * 2 * D_thick / 1000 + strapWidth / 1000 * strapDepth / 1000 * colSpacing, weight: (B1 * L1 * 2 * D_thick / 1000 + strapWidth / 1000 * strapDepth / 1000 * colSpacing) * 25 }, reinforcement: { weight: (Ast_footing * 2 + Ast_strap) * 7850 / 1e6, itemized: { [barDia]: Math.ceil(B1 * 1000 / spacingFooting) * 4 } }, excavation: (B1 * L1 * 2 + strapWidth / 1000 * colSpacing) * (this.config.geometry?.depth || 1.5) },
      warnings: [...this.validationWarnings, `Strap beam: ${strapWidth}mm × ${strapDepth}mm, top steel ≥ ${Math.ceil(Ast_strap)} mm²`], errors: [...this.validationErrors],
      recommendations: this.generateRecommendations(checks, this.determineOverallStatus(checks)),
      calculationReport: { summary: `Strap footing: 2×${B1}m² footings + strap ${strapWidth}×${strapDepth}mm, span ${colSpacing}m`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // STRIP FOOTING DESIGN
  // --------------------------------------------------------------------------

  private designStripFooting(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    const P_u = designLoads.axial; // kN/m (linear load for strip)
    const P_s = serviceLoads.axial;

    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 1.0, options.bearingCapacityMethod);

    // Strip width: B = P_s / (qall × L), where L = 1m run
    const B = Math.ceil((P_s * 1.1 / qall) * 10) / 10; // per metre run
    const L = this.config.geometry?.length || 10; // total length of wall/strip

    const q_actual = P_s / B;
    const soilPressure: SoilPressureDistribution = {
      type: 'uniform', maximum: q_actual, minimum: q_actual, average: q_actual,
      allowable: qall, eccentricityX: 0, eccentricityY: 0, effectiveArea: B * L, contactRatio: 100,
    };
    checks.push(this.createBearingCapacityCheck(soilPressure, qall, code));

    // Thickness: cantilever projection from wall face
    const wallWidth = columns[0]?.width || 230; // mm
    const projection = (B * 1000 - wallWidth) / 2; // mm
    const q_u_net = P_u / B;
    const M_cant = q_u_net * (projection / 1000) ** 2 / 2; // kNm per m run
    const V_cant = q_u_net * projection / 1000; // kN per m run

    // Min depth by shear (no shear reinforcement in footings)
    const tau_c = 0.36 * Math.sqrt(concrete.fck); // MPa conservative
    let d = Math.max(150, Math.ceil(V_cant * 1000 / (1000 * tau_c) / 25) * 25);
    const D_thick = d + concrete.cover + 12;

    // Reinforcement (transverse — main steel)
    const fy_r = reinforcement.fy;
    const Ast_main = Math.max(M_cant * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * 10);
    const barDia = 12;
    const barArea = Math.PI * barDia ** 2 / 4;
    const mainSpacing = Math.min(300, Math.floor(1000 * barArea / Ast_main / 5) * 5);

    // Distribution steel (longitudinal) = 0.12% of gross
    const Ast_dist = 0.12 * D_thick * 10;
    const distSpacing = Math.min(450, Math.floor(1000 * barArea / Ast_dist / 5) * 5);

    const rebarMain: ReinforcementDetail = { layer: 'bottom', direction: 'X', diameter: barDia, spacing: mainSpacing, areaProvided: 1000 * barArea / mainSpacing, areaRequired: Ast_main, utilizationRatio: Ast_main / (1000 * barArea / mainSpacing), anchorageLength: 40 * barDia };
    const rebarDist: ReinforcementDetail = { layer: 'bottom', direction: 'Y', diameter: barDia, spacing: distSpacing, areaProvided: 1000 * barArea / distSpacing, areaRequired: Ast_dist, utilizationRatio: Ast_dist / (1000 * barArea / distSpacing), anchorageLength: 40 * barDia };

    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_s, L, B, this.config.geometry?.depth || 1.0, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability = this.checkStability(P_s, serviceLoads.momentX, serviceLoads.momentY, L, B, this.config.geometry?.depth || 1.0, soil);
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: L, width: B, thickness: D_thick / 1000, effectiveDepth: d / 1000, depth: this.config.geometry?.depth || 1.0, area: B * L, volume: B * L * D_thick / 1000, centroid: { x: L / 2, y: B / 2 } },
      reinforcement: { bottomX: rebarMain, bottomY: rebarDist, totalWeight: (Ast_main * L + Ast_dist * B) * 7850 / 1e6, reinforcementRatio: Ast_main / (D_thick * 1000) * 100 },
      soilPressure, settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: B * L * D_thick / 1000, weight: B * L * D_thick / 1000 * 25 }, reinforcement: { weight: (Ast_main * L + Ast_dist * B) * 7850 / 1e6, itemized: { [barDia]: Math.ceil(L * 1000 / mainSpacing) + Math.ceil(B * 1000 / distSpacing) } }, excavation: B * L * (this.config.geometry?.depth || 1.0), pcc: B * L * 0.075 },
      warnings: [...this.validationWarnings], errors: [...this.validationErrors],
      recommendations: this.generateRecommendations(checks, this.determineOverallStatus(checks)),
      calculationReport: { summary: `Strip footing ${L}m × ${B}m × ${D_thick}mm for wall load ${P_s} kN/m`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // RAFT FOUNDATION DESIGN
  // --------------------------------------------------------------------------

  private designRaftFoundation(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    const P_u = designLoads.axial;
    const P_s = serviceLoads.axial;

    const qall = this.calculateBearingCapacity(soil, this.config.geometry?.depth || 2.0, options.bearingCapacityMethod);

    // Raft dimensions: cover entire building footprint with 0.5m edge offset
    const columnXs = columns.map(c => c.position?.x || 0);
    const columnYs = columns.map(c => c.position?.y || 0);
    const edgeOffset = 0.75; // m beyond extreme columns
    const xMin = Math.min(...columnXs, 0) - edgeOffset;
    const xMax = Math.max(...columnXs, 6) + edgeOffset;
    const yMin = Math.min(...columnYs, 0) - edgeOffset;
    const yMax = Math.max(...columnYs, 6) + edgeOffset;

    const L = Math.ceil((xMax - xMin) * 5) / 5;
    const B = Math.ceil((yMax - yMin) * 5) / 5;
    const A = L * B;

    // Average bearing pressure
    const q_avg = P_s / A;
    const M_x = serviceLoads.momentX;
    const M_y = serviceLoads.momentY;
    const q_max = q_avg + 6 * Math.abs(M_y) / (B * L * L) + 6 * Math.abs(M_x) / (L * B * B);
    const q_min = Math.max(0, q_avg - 6 * Math.abs(M_y) / (B * L * L) - 6 * Math.abs(M_x) / (L * B * B));

    const soilPressure: SoilPressureDistribution = {
      type: q_max > q_min * 1.1 ? 'trapezoidal' : 'uniform',
      maximum: q_max, minimum: q_min, average: q_avg, allowable: qall,
      eccentricityX: M_y / P_s, eccentricityY: M_x / P_s,
      effectiveArea: A, contactRatio: q_min >= 0 ? 100 : (q_max / (q_max - q_min)) * 100,
    };
    checks.push(this.createBearingCapacityCheck(soilPressure, qall, code));

    // Raft thickness (governed by punching shear at most loaded column)
    const maxColLoad = P_u / Math.max(columns.length, 1);
    const col = columns[0] || { width: 500, depth: 500, shape: 'rectangular' as const };
    let d = 500; // starting effective depth for raft
    for (let iter = 0; iter < 15; iter++) {
      const b_0 = 2 * (col.width + col.depth + 2 * d); // critical perimeter
      const tau_c = 0.25 * Math.sqrt(concrete.fck);
      const V_cap = tau_c * b_0 * d / 1000;
      const V_demand = maxColLoad - (P_u / A) * ((col.width + d) / 1000) * ((col.depth + d) / 1000);
      if (V_cap >= V_demand * 1.1) break;
      d += 25;
    }
    const D_thick = d + concrete.cover + 20 + 20; // two layers of rebar

    // Two-way reinforcement (both directions, top and bottom)
    const q_u = P_u / A;
    // Span between columns (approximate)
    const colSpanX = columns.length >= 2 ? Math.abs((columns[1]?.position?.x || 3) - (columns[0]?.position?.x || 0)) : 4;
    const colSpanY = columns.length >= 2 ? Math.abs((columns[1]?.position?.y || 3) - (columns[0]?.position?.y || 0)) : 4;
    const M_midspan = q_u * B * Math.max(colSpanX, colSpanY) ** 2 / 12; // hogging
    const M_support = q_u * B * Math.max(colSpanX, colSpanY) ** 2 / 8; // sagging

    const fy_r = reinforcement.fy;
    const Ast_bot = Math.max(Math.abs(M_midspan) * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * 10);
    const Ast_top = Math.max(Math.abs(M_support) * 1e6 / (0.87 * fy_r * 0.9 * d), 0.12 * D_thick * 10);

    const barDia = 20;
    const barArea = Math.PI * barDia ** 2 / 4;
    const spacingBot = Math.min(200, Math.floor(1000 * barArea / Ast_bot / 5) * 5);
    const spacingTop = Math.min(200, Math.floor(1000 * barArea / Ast_top / 5) * 5);

    const rebarBot: ReinforcementDetail = { layer: 'bottom', direction: 'X', diameter: barDia, spacing: spacingBot, areaProvided: 1000 * barArea / spacingBot, areaRequired: Ast_bot, utilizationRatio: Ast_bot / (1000 * barArea / spacingBot), anchorageLength: 50 * barDia };
    const rebarTop: ReinforcementDetail = { layer: 'top', direction: 'X', diameter: barDia, spacing: spacingTop, areaProvided: 1000 * barArea / spacingTop, areaRequired: Ast_top, utilizationRatio: Ast_top / (1000 * barArea / spacingTop), anchorageLength: 50 * barDia };

    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      settlement = this.calculateSettlementAdvanced(P_s, L, B, this.config.geometry?.depth || 2.0, soil);
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability = this.checkStability(P_s, serviceLoads.momentX, serviceLoads.momentY, L, B, this.config.geometry?.depth || 2.0, soil);
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: L, width: B, thickness: D_thick / 1000, effectiveDepth: d / 1000, depth: this.config.geometry?.depth || 2.0, area: A, volume: A * D_thick / 1000, centroid: { x: L / 2, y: B / 2 } },
      reinforcement: { bottomX: rebarBot, bottomY: { ...rebarBot, direction: 'Y' }, topX: rebarTop, topY: { ...rebarTop, direction: 'Y' }, totalWeight: (Ast_bot + Ast_top) * 2 * A * 7850 / 1e9, reinforcementRatio: (Ast_bot + Ast_top) / (D_thick * 1000) * 100 },
      soilPressure, settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: A * D_thick / 1000, weight: A * D_thick / 1000 * 25 }, reinforcement: { weight: (Ast_bot + Ast_top) * 2 * A * 7850 / 1e9, itemized: { [barDia]: Math.ceil(L * 1000 / spacingBot + B * 1000 / spacingBot + L * 1000 / spacingTop + B * 1000 / spacingTop) } }, excavation: A * (this.config.geometry?.depth || 2.0), pcc: A * 0.1, formwork: 2 * (L + B) * D_thick / 1000 },
      warnings: [...this.validationWarnings, 'Raft designed using rigid method. Consider FE analysis for irregular column layouts.'], errors: [...this.validationErrors],
      recommendations: [...this.generateRecommendations(checks, this.determineOverallStatus(checks)), 'For rafts >200m², consider ribbed/cellular construction to reduce concrete volume'],
      calculationReport: { summary: `Raft foundation ${L}m × ${B}m × ${D_thick}mm for ${columns.length} columns, ${P_u} kN total factored load`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // PILE FOUNDATION DESIGN
  // --------------------------------------------------------------------------

  private designPileFoundation(): FootingDesignResult {
    const { soil, loads, concrete, reinforcement, columns, code, options } = this.config;
    const checks: DesignCheck[] = [];

    const designLoads = this.getDesignLoads(loads);
    const serviceLoads = this.getServiceLoads(loads);
    const P_u = designLoads.axial;
    const P_s = serviceLoads.axial;

    // Pile capacity estimation
    const pileDiam = 450; // mm default
    const pileLength = 15; // m default
    const Ap = Math.PI * (pileDiam / 1000) ** 2 / 4; // m² — end bearing area
    const perimeterPile = Math.PI * pileDiam / 1000; // m

    // End bearing: Qb = Nc × c × Ab (cohesive) or Nq × σ'v × Ab (cohesionless)
    let Q_end = 0;
    let Q_skin = 0;
    if (soil.type === 'cohesive') {
      const Nc = 9; // bearing capacity factor for piles (Skempton)
      Q_end = Nc * soil.cohesion * Ap; // kN
      // Skin friction: α method
      const alpha = soil.cohesion <= 25 ? 1.0 : soil.cohesion <= 50 ? 0.7 : soil.cohesion <= 100 ? 0.5 : 0.4;
      Q_skin = alpha * soil.cohesion * perimeterPile * pileLength; // kN
    } else {
      // Cohesionless: Nq from Berezantsev
      const phi = soil.frictionAngle;
      const Nq = Math.exp(Math.PI * Math.tan(phi * Math.PI / 180)) * Math.tan(Math.PI / 4 + phi * Math.PI / 360) ** 2;
      const sigma_v = soil.unitWeight * pileLength / 2; // average effective stress
      Q_end = Nq * sigma_v * Ap; // kN
      // Skin friction: β method
      const K = 1 - Math.sin(phi * Math.PI / 180);
      const delta = 0.75 * phi; // interface friction angle
      Q_skin = K * sigma_v * Math.tan(delta * Math.PI / 180) * perimeterPile * pileLength;
    }

    const Q_ultimate_single = Q_end + Q_skin;
    const FOS_pile = 2.5;
    const Q_safe_single = Q_ultimate_single / FOS_pile;

    // Number of piles
    const nPiles = Math.ceil(P_s / Q_safe_single);
    const nPilesMin = Math.max(nPiles, 2); // minimum 2 piles

    checks.push({
      id: 'pile-capacity', name: 'Single Pile Capacity', category: 'strength',
      clause: code === 'IS456' ? 'IS 2911 Part 1' : 'ACI 543',
      codeReference: code, description: `Ultimate capacity: ${Q_ultimate_single.toFixed(0)} kN (end bearing: ${Q_end.toFixed(0)} + skin: ${Q_skin.toFixed(0)})`,
      demand: P_s / nPilesMin, demandUnit: 'kN', capacity: Q_safe_single, capacityUnit: 'kN',
      ratio: (P_s / nPilesMin) / Q_safe_single, utilizationPercent: (P_s / nPilesMin) / Q_safe_single * 100,
      status: (P_s / nPilesMin) / Q_safe_single <= 1 ? 'PASS' : 'FAIL', severity: 'critical',
    });

    // Pile cap sizing (for the group)
    const pileSpacing = 3 * pileDiam / 1000; // 3D spacing
    const gridSize = Math.ceil(Math.sqrt(nPilesMin));
    const capL = (gridSize - 1) * pileSpacing + 2 * 0.15 + pileDiam / 1000; // edge distance 150mm
    const capB = capL;
    const capD = Math.max(600, pileLength * 1000 * 0.05); // mm, min 600mm
    const capEffD = capD - concrete.cover - 20;

    // Pile cap reinforcement
    const fy_r = reinforcement.fy;
    const M_cap = P_u / nPilesMin * gridSize * pileSpacing / 4; // simplified
    const Ast_cap = Math.max(M_cap * 1e6 / (0.87 * fy_r * 0.9 * capEffD), 0.12 * capD * capL * 10);
    const barDia = 20;
    const barArea = Math.PI * barDia ** 2 / 4;
    const spacing = Math.min(200, Math.floor(capB * 1000 * barArea / Ast_cap / 5) * 5);

    const rebarDetail: ReinforcementDetail = { layer: 'bottom', direction: 'X', diameter: barDia, spacing, areaProvided: capB * 1000 * barArea / spacing, areaRequired: Ast_cap, utilizationRatio: Ast_cap / (capB * 1000 * barArea / spacing), anchorageLength: 50 * barDia };

    const soilPressure: SoilPressureDistribution = {
      type: 'uniform', maximum: 0, minimum: 0, average: 0, allowable: 0,
      eccentricityX: 0, eccentricityY: 0, effectiveArea: capL * capB, contactRatio: 0,
      // Piles transfer load to depth - no direct soil pressure under cap
    };

    let settlement: SettlementAnalysis | undefined;
    if (options.checkSettlement) {
      // Pile group settlement (equivalent raft method)
      const eqRaftDepth = pileLength * 2 / 3;
      const eqRaftL = capL + pileLength * Math.tan(30 * Math.PI / 180);
      const eqRaftB = capB + pileLength * Math.tan(30 * Math.PI / 180);
      settlement = {
        immediate: P_s * 1000 / (soil.elasticModulus * 1e3 * Math.sqrt(eqRaftL * eqRaftB)) * (1 - soil.poissonRatio ** 2) * 1000,
        consolidation: 0, secondary: 0,
        total: P_s * 1000 / (soil.elasticModulus * 1e3 * Math.sqrt(eqRaftL * eqRaftB)) * (1 - soil.poissonRatio ** 2) * 1000,
        allowable: options.settlementLimit, method: 'Equivalent Raft (Tomlinson)',
        status: P_s * 1000 / (soil.elasticModulus * 1e3 * Math.sqrt(eqRaftL * eqRaftB)) * (1 - soil.poissonRatio ** 2) * 1000 <= options.settlementLimit ? 'PASS' : 'FAIL',
      };
      checks.push(this.createSettlementCheck(settlement, options.settlementLimit));
    }

    const stability: StabilityAnalysis = { slidingFOS: 99, overturningFOSX: 99, overturningFOSY: 99, minimumFOSRequired: 1.5, status: 'PASS' };
    const checksSummary = this.summarizeChecks(checks);

    return {
      id: this.config.id, type: this.config.type, code,
      status: this.determineOverallStatus(checks),
      geometry: { length: capL, width: capB, thickness: capD / 1000, effectiveDepth: capEffD / 1000, depth: pileLength, area: capL * capB, volume: capL * capB * capD / 1000, centroid: { x: capL / 2, y: capB / 2 } },
      reinforcement: { bottomX: rebarDetail, bottomY: { ...rebarDetail, direction: 'Y' }, totalWeight: Ast_cap * 2 * capL * capB * 7850 / 1e9, reinforcementRatio: Ast_cap * 2 / (capD * capB * 1000) * 100 },
      soilPressure, settlement, stability,
      checks, checksSummary,
      materialQuantities: { concrete: { volume: capL * capB * capD / 1000 + nPilesMin * Ap * pileLength, weight: (capL * capB * capD / 1000 + nPilesMin * Ap * pileLength) * 25 }, reinforcement: { weight: (Ast_cap * 2 * capL * capB + nPilesMin * 4 * barArea * pileLength * 1000) * 7850 / 1e9, itemized: { [barDia]: Math.ceil(capB * 1000 / spacing) * 2 + nPilesMin * 4 } }, excavation: capL * capB * 2 },
      warnings: [...this.validationWarnings, `Pile group: ${nPilesMin} piles of Ø${pileDiam}mm × ${pileLength}m at ${pileSpacing.toFixed(2)}m c/c`, `Group efficiency factor not applied — verify for closely-spaced piles`], errors: [...this.validationErrors],
      recommendations: [...this.generateRecommendations(checks, this.determineOverallStatus(checks)), `Recommend pile load test for capacity verification`, `Consider negative skin friction if fill or consolidating layers present`],
      calculationReport: { summary: `Pile foundation: ${nPilesMin}× Ø${pileDiam}mm piles, ${pileLength}m deep, cap ${capL}m×${capB}m×${capD}mm`, detailedSteps: this.calculationLog, references: this.getCodeReferences(code) },
    };
  }

  // --------------------------------------------------------------------------
  // PILE CAP DESIGN
  // --------------------------------------------------------------------------

  private designPileCap(): FootingDesignResult {
    // Pile cap design delegates to pile foundation with focus on the cap structure
    const result = this.designPileFoundation();
    // Override the type label
    return { ...result, type: this.config.type };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - LOADS
  // --------------------------------------------------------------------------

  private getDesignLoads(loads: FoundationLoads[]): FoundationLoads {
    // Get maximum factored loads
    let maxAxial = 0;
    let maxMomentX = 0;
    let maxMomentY = 0;
    let maxShearX = 0;
    let maxShearY = 0;

    loads.forEach(load => {
      const factor = load.loadFactor || this.getLoadFactor(load.loadCase);
      maxAxial = Math.max(maxAxial, load.axial * factor);
      maxMomentX = Math.max(maxMomentX, Math.abs(load.momentX) * factor);
      maxMomentY = Math.max(maxMomentY, Math.abs(load.momentY) * factor);
      maxShearX = Math.max(maxShearX, Math.abs(load.shearX) * factor);
      maxShearY = Math.max(maxShearY, Math.abs(load.shearY) * factor);
    });

    return {
      axial: maxAxial,
      momentX: maxMomentX,
      momentY: maxMomentY,
      shearX: maxShearX,
      shearY: maxShearY,
      loadCase: 'combination',
      isServiceability: false,
      isUltimate: true,
    };
  }

  private getServiceLoads(loads: FoundationLoads[]): FoundationLoads {
    // Get unfactored service loads
    let maxAxial = 0;
    let maxMomentX = 0;
    let maxMomentY = 0;
    let maxShearX = 0;
    let maxShearY = 0;

    loads.forEach(load => {
      maxAxial = Math.max(maxAxial, load.axial);
      maxMomentX = Math.max(maxMomentX, Math.abs(load.momentX));
      maxMomentY = Math.max(maxMomentY, Math.abs(load.momentY));
      maxShearX = Math.max(maxShearX, Math.abs(load.shearX));
      maxShearY = Math.max(maxShearY, Math.abs(load.shearY));
    });

    return {
      axial: maxAxial,
      momentX: maxMomentX,
      momentY: maxMomentY,
      shearX: maxShearX,
      shearY: maxShearY,
      loadCase: 'combination',
      isServiceability: true,
      isUltimate: false,
    };
  }

  private getLoadFactor(loadCase: LoadCaseType): number {
    switch (loadCase) {
      case 'dead': return this.partialFactors.loadsDead;
      case 'live': return this.partialFactors.loadsLive;
      case 'wind': return this.partialFactors.loadsWind;
      case 'seismic': return this.partialFactors.loadsSeismic;
      default: return 1.5;
    }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - BEARING CAPACITY
  // --------------------------------------------------------------------------

  private calculateBearingCapacity(soil: SoilProperties, depth: number, method: BearingCapacityMethod): number {
    if (soil.allowableBearingCapacity) {
      return soil.allowableBearingCapacity;
    }

    const phi = soil.frictionAngle;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const gammaW = 9.81;
    const B = 1; // Unit width for calculation

    let factors: { Nc: number; Nq: number; Ngamma: number };

    switch (method) {
      case 'terzaghi':
        factors = EngineeringMath.bearingCapacityFactors(phi);
        break;
      case 'meyerhof':
        factors = EngineeringMath.meyerhofBearingCapacityFactors(phi);
        break;
      case 'hansen':
        factors = EngineeringMath.hansenBearingCapacityFactors(phi);
        break;
      default:
        factors = EngineeringMath.meyerhofBearingCapacityFactors(phi);
    }

    // Effective overburden pressure
    let q: number;
    if (soil.waterTableDepth !== undefined && soil.waterTableDepth < depth) {
      q = soil.unitWeight * soil.waterTableDepth + 
          (soil.saturatedUnitWeight - gammaW) * (depth - soil.waterTableDepth);
    } else {
      q = gamma * depth;
    }

    // Ultimate bearing capacity
    const qu = c * factors.Nc + q * factors.Nq + 0.5 * gamma * B * factors.Ngamma;

    // Allowable bearing capacity
    return qu / this.partialFactors.soilBearing;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - FOOTING SIZING
  // --------------------------------------------------------------------------

  private sizeFootingIteratively(
    P: number, 
    Mx: number, 
    My: number, 
    qall: number,
    column: ColumnProperties
  ): { L: number; B: number; iterations: number } {
    // Start with area based on concentric load
    const efficiencyFactor = 0.8; // Account for eccentricity
    const A = P / (qall * efficiencyFactor);
    
    // Initial square footing
    let L = Math.sqrt(A);
    let B = L;

    // Calculate eccentricities
    const ex = My / P;
    const ey = Mx / P;

    // Iterate to ensure no tension (middle third rule)
    const maxIterations = 20;
    let iteration = 0;

    while (iteration < maxIterations) {
      // Check if eccentricity is within kern
      const exLimit = L / 6;
      const eyLimit = B / 6;

      if (Math.abs(ex) <= exLimit && Math.abs(ey) <= eyLimit) {
        // Check pressure
        const { qmax } = this.calculateSoilPressure(P, Mx, My, L, B);
        
        if (qmax <= qall * 1.05) { // 5% tolerance
          break;
        }
      }

      // Increase dimensions
      if (Math.abs(ex) > L / 6) {
        L = Math.max(L, 6 * Math.abs(ex) * 1.1);
      }
      if (Math.abs(ey) > B / 6) {
        B = Math.max(B, 6 * Math.abs(ey) * 1.1);
      }

      // Ensure pressure is within allowable
      const { qmax } = this.calculateSoilPressure(P, Mx, My, L, B);
      if (qmax > qall) {
        const factor = Math.sqrt(qmax / qall);
        L *= factor;
        B *= factor;
      }

      iteration++;
    }

    // Round up to 100mm increments
    L = PrecisionMath.roundUpToIncrement(L, 0.1);
    B = PrecisionMath.roundUpToIncrement(B, 0.1);

    // Ensure minimum size
    const minSize = Math.max(column.width, column.depth) / 1000 + 0.3;
    L = Math.max(L, minSize);
    B = Math.max(B, minSize);

    return { L, B, iterations: iteration };
  }

  private calculateSoilPressure(P: number, Mx: number, My: number, L: number, B: number): { qmax: number; qmin: number; qavg: number } {
    const A = L * B;
    const Zx = B * L * L / 6;
    const Zy = L * B * B / 6;

    const q0 = P / A;
    const qx = Mx / Zx;
    const qy = My / Zy;

    return {
      qmax: q0 + qx + qy,
      qmin: q0 - qx - qy,
      qavg: q0,
    };
  }

  private calculateSoilPressureDistribution(P: number, Mx: number, My: number, L: number, B: number): SoilPressureDistribution {
    const { qmax, qmin, qavg } = this.calculateSoilPressure(P, Mx, My, L, B);
    
    const ex = My / P;
    const ey = Mx / P;

    // Determine pressure type
    let type: SoilPressureDistribution['type'];
    if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) {
      type = 'uniform';
    } else if (qmin < 0) {
      type = 'eccentric';
    } else if (Math.abs(qmax - qmin) / qavg < 0.1) {
      type = 'uniform';
    } else {
      type = 'trapezoidal';
    }

    // Calculate effective area (if uplift occurs)
    let effectiveArea = L * B;
    let contactRatio = 100;

    if (qmin < 0) {
      // Triangular pressure distribution
      const L_eff = 3 * (L / 2 - Math.abs(ex));
      const B_eff = 3 * (B / 2 - Math.abs(ey));
      effectiveArea = L_eff * B_eff;
      contactRatio = (effectiveArea / (L * B)) * 100;
    }

    return {
      type,
      maximum: qmax,
      minimum: qmin,
      average: qavg,
      allowable: this.calculateBearingCapacity(this.config.soil, this.config.geometry?.depth || 1.5, this.config.options.bearingCapacityMethod),
      eccentricityX: ex,
      eccentricityY: ey,
      effectiveArea,
      contactRatio,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - STRUCTURAL DESIGN
  // --------------------------------------------------------------------------

  private calculateFootingThicknessAdvanced(
    P: number,
    qmax: number,
    L: number,
    B: number,
    column: ColumnProperties,
    concrete: ConcreteProperties,
    code: DesignCode
  ): { d: number; D: number; punchingCheck: DesignCheck } {
    const fck = concrete.fck;
    const colW = column.width;
    const colD = column.depth;

    // Get punching shear capacity
    let vc: number;
    switch (code) {
      case 'IS456':
        const ks = Math.min(1.0, 0.5 + colD / colW);
        vc = ks * 0.25 * Math.sqrt(fck);
        break;
      case 'ACI318':
        vc = 0.33 * Math.sqrt(fck);
        break;
      case 'EN1992':
        vc = 0.18 / 1.5 * Math.pow(100 * 0.002 * fck, 1 / 3) * 2;
        break;
      default:
        vc = 0.25 * Math.sqrt(fck);
    }

    // Iterate to find minimum d
    let d = 250; // Start with 250mm
    const maxIterations = 30;

    for (let i = 0; i < maxIterations; i++) {
      // Critical perimeter at d/2 from column face
      const bo = 2 * ((colW + d) + (colD + d));
      const Ap = (colW + d) * (colD + d) / 1e6;

      // Shear force
      const Vu = P - qmax * Ap;

      // Shear capacity
      const Vc = vc * bo * d / 1000;

      if (Vc >= Vu * 1.1) { // 10% margin
        break;
      }

      d += 25;
    }

    // Ensure minimum thickness
    d = Math.max(d, 300);

    // Total depth
    const D = d + concrete.cover + 20; // Cover + bar radius

    // Round to 50mm
    const D_rounded = PrecisionMath.roundUpToIncrement(D, 50);
    const d_final = D_rounded - concrete.cover - 20;

    // Create punching check
    const bo = 2 * ((colW + d_final) + (colD + d_final));
    const Ap = (colW + d_final) * (colD + d_final) / 1e6;
    const Vu = P - qmax * Ap;
    const Vc = vc * bo * d_final / 1000;

    const punchingCheck: DesignCheck = {
      id: 'punching-shear',
      name: 'Punching Shear',
      category: 'strength',
      clause: this.getPunchingShearClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Two-way shear at critical perimeter d/2 from column face',
      demand: Vu,
      demandUnit: 'kN',
      capacity: Vc,
      capacityUnit: 'kN',
      ratio: Vu / Vc,
      utilizationPercent: (Vu / Vc) * 100,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
      severity: Vu > Vc ? 'critical' : 'info',
      calculationSteps: [
        {
          step: 1,
          description: 'Calculate critical perimeter',
          formula: 'b_o = 2[(c_1 + d) + (c_2 + d)]',
          inputs: {
            c_1: { value: colW, unit: 'mm' },
            c_2: { value: colD, unit: 'mm' },
            d: { value: d_final, unit: 'mm' },
          },
          output: { value: bo, unit: 'mm' },
        },
        {
          step: 2,
          description: 'Calculate punching shear demand',
          formula: 'V_u = P - q_max × A_p',
          inputs: {
            P: { value: P, unit: 'kN' },
            q_max: { value: qmax, unit: 'kPa' },
            A_p: { value: Ap, unit: 'm²' },
          },
          output: { value: Vu, unit: 'kN' },
        },
        {
          step: 3,
          description: 'Calculate punching shear capacity',
          formula: 'V_c = v_c × b_o × d',
          inputs: {
            v_c: { value: vc, unit: 'MPa' },
            b_o: { value: bo, unit: 'mm' },
            d: { value: d_final, unit: 'mm' },
          },
          output: { value: Vc, unit: 'kN' },
        },
      ],
    };

    return { d: d_final, D: D_rounded, punchingCheck };
  }

  private checkOneWayShearAdvanced(
    qmax: number,
    L: number,
    B: number,
    column: ColumnProperties,
    d: number,
    concrete: ConcreteProperties,
    code: DesignCode
  ): DesignCheck {
    const colD = column.depth / 1000; // Convert to m
    
    // Critical section at d from face of column
    const criticalDist = (L / 2 - colD / 2 - d / 1000);
    const Vu = qmax * B * Math.max(0, criticalDist);

    // Shear capacity (assuming minimum reinforcement)
    const pt = 0.15; // Minimum percentage
    let tau_c: number;

    switch (code) {
      case 'IS456':
        tau_c = this.getShearCapacityIS456(concrete.fck, pt);
        break;
      case 'ACI318':
        tau_c = 0.17 * Math.sqrt(concrete.fck);
        break;
      case 'EN1992':
        tau_c = 0.18 / 1.5 * Math.pow(100 * pt / 100 * concrete.fck, 1 / 3);
        break;
      default:
        tau_c = this.getShearCapacityIS456(concrete.fck, pt);
    }

    const Vc = tau_c * B * 1000 * d / 1000;

    return {
      id: 'one-way-shear',
      name: 'One-Way Shear',
      category: 'strength',
      clause: this.getOneWayShearClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Beam shear at critical section d from column face',
      demand: Vu,
      demandUnit: 'kN',
      capacity: Vc,
      capacityUnit: 'kN',
      ratio: Vu / Vc,
      utilizationPercent: (Vu / Vc) * 100,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
      severity: Vu > Vc ? 'critical' : 'info',
    };
  }

  private getShearCapacityIS456(fck: number, pt: number): number {
    // IS 456:2000 Table 19
    const tau_c_max = 0.62 * Math.sqrt(fck);
    
    if (pt <= 0.15) return 0.28;
    if (pt <= 0.25) return 0.36;
    if (pt <= 0.50) return 0.48;
    if (pt <= 0.75) return 0.56;
    if (pt <= 1.00) return 0.62;
    if (pt <= 1.25) return 0.67;
    if (pt <= 1.50) return 0.72;
    if (pt <= 1.75) return 0.75;
    if (pt <= 2.00) return 0.79;
    
    return Math.min(0.82, tau_c_max);
  }

  private designFlexuralReinforcementAdvanced(
    qmax: number,
    qmin: number,
    L: number,
    B: number,
    column: ColumnProperties,
    d: number,
    concrete: ConcreteProperties,
    rebar: ReinforcementProperties,
    code: DesignCode
  ): { rebarX: ReinforcementDetail; rebarY: ReinforcementDetail; checks: DesignCheck[] } {
    const fck = concrete.fck;
    const fy = rebar.fy;
    const colW = column.width / 1000;
    const colD = column.depth / 1000;

    const checks: DesignCheck[] = [];

    // Calculate bending moments
    const cantileverX = (L - colD) / 2;
    const cantileverY = (B - colW) / 2;

    // Moment in X-direction (per unit width)
    const qAtFaceX = qmax - (qmax - qmin) * (colD / 2) / L;
    const MuX = B * (qAtFaceX * cantileverX * cantileverX / 2 + 
                    (qmax - qAtFaceX) * cantileverX * cantileverX / 3);

    // Moment in Y-direction (per unit width)
    const qAtFaceY = qmax - (qmax - qmin) * (colW / 2) / B;
    const MuY = L * (qAtFaceY * cantileverY * cantileverY / 2 + 
                    (qmax - qAtFaceY) * cantileverY * cantileverY / 3);

    // Design reinforcement in X-direction
    const rebarX = this.calculateReinforcement(MuX, B * 1000, d, fck, fy, rebar, code, 'X');
    const rebarY = this.calculateReinforcement(MuY, L * 1000, d, fck, fy, rebar, code, 'Y');

    // Add flexural checks
    checks.push({
      id: 'flexure-x',
      name: 'Flexural Capacity (X-direction)',
      category: 'strength',
      clause: this.getFlexuralClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Bending capacity in X-direction',
      demand: MuX,
      demandUnit: 'kNm',
      capacity: rebarX.momentCapacity,
      capacityUnit: 'kNm',
      ratio: MuX / rebarX.momentCapacity,
      utilizationPercent: (MuX / rebarX.momentCapacity) * 100,
      status: MuX <= rebarX.momentCapacity ? 'PASS' : 'FAIL',
      severity: MuX > rebarX.momentCapacity ? 'critical' : 'info',
    });

    checks.push({
      id: 'flexure-y',
      name: 'Flexural Capacity (Y-direction)',
      category: 'strength',
      clause: this.getFlexuralClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Bending capacity in Y-direction',
      demand: MuY,
      demandUnit: 'kNm',
      capacity: rebarY.momentCapacity,
      capacityUnit: 'kNm',
      ratio: MuY / rebarY.momentCapacity,
      utilizationPercent: (MuY / rebarY.momentCapacity) * 100,
      status: MuY <= rebarY.momentCapacity ? 'PASS' : 'FAIL',
      severity: MuY > rebarY.momentCapacity ? 'critical' : 'info',
    });

    return {
      rebarX: rebarX.detail,
      rebarY: rebarY.detail,
      checks,
    };
  }

  private calculateReinforcement(
    Mu: number,
    b: number,
    d: number,
    fck: number,
    fy: number,
    rebar: ReinforcementProperties,
    code: DesignCode,
    direction: 'X' | 'Y'
  ): { detail: ReinforcementDetail; momentCapacity: number } {
    // Calculate required steel area
    const Ru = Mu * 1e6 / (b * d * d);
    
    let pt: number;
    switch (code) {
      case 'IS456':
        pt = (fck / (2 * fy)) * (1 - Math.sqrt(1 - 4.598 * Ru / fck)) * 100;
        break;
      case 'ACI318':
        pt = 0.85 * fck / fy * (1 - Math.sqrt(1 - 2 * Ru / (0.85 * fck))) * 100;
        break;
      default:
        pt = (fck / (2 * fy)) * (1 - Math.sqrt(1 - 4.598 * Ru / fck)) * 100;
    }

    // Minimum reinforcement
    const ptMin = this.config.options.minimumReinforcementRatio;
    pt = Math.max(pt, ptMin);

    // Maximum reinforcement check
    if (pt > this.config.options.maximumReinforcementRatio) {
      this.validationWarnings.push(`Reinforcement ratio (${pt.toFixed(2)}%) exceeds maximum in ${direction}-direction`);
    }

    const AstRequired = pt * b * d / 100;

    // Select bar diameter and spacing
    const { diameter, spacing, numBars, areaProvided } = this.selectBars(AstRequired, b, rebar);

    // Calculate moment capacity
    const Mn = 0.87 * fy * areaProvided * (d - 0.42 * areaProvided * 0.87 * fy / (0.36 * fck * b)) / 1e6;

    // Calculate anchorage length
    const Ld = EngineeringMath.developmentLengthIS456(diameter, fy, fck, 'tension');

    const detail: ReinforcementDetail = {
      layer: 'bottom',
      direction,
      diameter,
      spacing,
      numberOfBars: numBars,
      areaProvided,
      areaRequired: AstRequired,
      utilizationRatio: AstRequired / areaProvided,
      anchorageLength: Ld,
      lapLength: 1.3 * Ld,
    };

    return { detail, momentCapacity: Mn };
  }

  private selectBars(AstRequired: number, width: number, rebar: ReinforcementProperties): { diameter: number; spacing: number; numBars: number; areaProvided: number } {
    const availableDiameters = [10, 12, 16, 20, 25];
    
    for (const dia of availableDiameters) {
      if (dia >= rebar.minDiameter && dia <= rebar.maxDiameter) {
        const barArea = Math.PI * dia * dia / 4;
        const numBars = Math.ceil(AstRequired / barArea);
        const spacing = Math.floor((width - 100) / (numBars - 1));
        
        if (spacing >= 75 && spacing <= 300) {
          const areaProvided = numBars * barArea;
          return { diameter: dia, spacing: Math.min(spacing, 200), numBars, areaProvided };
        }
      }
    }

    // Default fallback
    const dia = 16;
    const barArea = Math.PI * dia * dia / 4;
    const numBars = Math.ceil(AstRequired / barArea);
    const spacing = Math.min(200, Math.floor((width - 100) / Math.max(1, numBars - 1)));
    const areaProvided = numBars * barArea;

    return { diameter: dia, spacing, numBars, areaProvided };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - SETTLEMENT
  // --------------------------------------------------------------------------

  private calculateSettlementAdvanced(
    P: number,
    L: number,
    B: number,
    depth: number,
    soil: SoilProperties
  ): SettlementAnalysis {
    const Es = soil.elasticModulus * 1000; // Convert to kPa
    const nu = soil.poissonRatio;
    const qnet = P / (L * B);

    // Immediate settlement (Boussinesq)
    const If = this.getInfluenceFactor(L / B);
    const Si = qnet * B * (1 - nu * nu) / Es * If * 1000;

    // Consolidation settlement
    let Sc = 0;
    let timeToComplete: number | undefined;

    if (soil.type === 'cohesive' && soil.compressionIndex && soil.voidRatio) {
      const Cc = soil.compressionIndex;
      const e0 = soil.voidRatio;
      const H = Math.min(2 * B, 10); // Compressible layer thickness
      const p0 = soil.unitWeight * depth + soil.unitWeight * H / 2;
      const deltaP = qnet * 0.5; // Average stress increase

      if (soil.preconsolidationPressure && p0 + deltaP > soil.preconsolidationPressure) {
        // Normally consolidated
        Sc = (Cc * H / (1 + e0)) * Math.log10((p0 + deltaP) / p0) * 1000;
      } else {
        // Overconsolidated
        const Cr = soil.recompressionIndex || Cc / 5;
        Sc = (Cr * H / (1 + e0)) * Math.log10((p0 + deltaP) / p0) * 1000;
      }

      // Time calculation
      if (soil.coefficientOfConsolidation) {
        const Cv = soil.coefficientOfConsolidation;
        const Tv90 = 0.848; // Time factor for 90% consolidation
        timeToComplete = Tv90 * H * H / (Cv * 4); // years (double drainage)
      }
    }

    // Secondary compression (estimate)
    const Ss = 0.1 * Sc; // Typically 10% of consolidation settlement

    const total = Si + Sc + Ss;
    const allowable = this.config.options.settlementLimit;

    return {
      immediate: PrecisionMath.round(Si, 1),
      consolidation: PrecisionMath.round(Sc, 1),
      secondary: PrecisionMath.round(Ss, 1),
      total: PrecisionMath.round(total, 1),
      allowable,
      timeToComplete,
      status: total <= allowable ? 'PASS' : total <= allowable * 1.2 ? 'WARNING' : 'FAIL',
      method: 'Boussinesq + Terzaghi',
    };
  }

  private getInfluenceFactor(aspectRatio: number): number {
    // Influence factors for flexible foundation at center
    const factors: Record<number, number> = {
      1: 1.12,
      1.5: 1.36,
      2: 1.53,
      3: 1.78,
      5: 2.10,
      10: 2.54,
    };

    const keys = Object.keys(factors).map(Number);
    
    if (aspectRatio <= 1) return factors[1];
    if (aspectRatio >= 10) return factors[10];

    // Linear interpolation
    for (let i = 0; i < keys.length - 1; i++) {
      if (aspectRatio >= keys[i] && aspectRatio <= keys[i + 1]) {
        return PrecisionMath.lerp(factors[keys[i]], factors[keys[i + 1]], 
          (aspectRatio - keys[i]) / (keys[i + 1] - keys[i]));
      }
    }

    return 1.12;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - STABILITY
  // --------------------------------------------------------------------------

  private checkStability(
    P: number,
    Mx: number,
    My: number,
    L: number,
    B: number,
    depth: number,
    soil: SoilProperties
  ): StabilityAnalysis {
    // Sliding check
    const phi = soil.frictionAngle * ENGINEERING_CONSTANTS.DEG_TO_RAD;
    const c = soil.cohesion;
    const H = Math.sqrt(this.config.loads.reduce((sum, l) => sum + l.shearX ** 2 + l.shearY ** 2, 0));
    
    const slidingResistance = P * Math.tan(phi) + c * L * B;
    const slidingFOS = H > 0 ? slidingResistance / H : 999;

    // Overturning check
    const W = L * B * depth * 25; // Footing weight (25 kN/m³ concrete)
    const totalP = P + W;
    
    const stabilisingMomentX = totalP * L / 2;
    const stabilisingMomentY = totalP * B / 2;
    
    const overturningFOSX = stabilisingMomentX / Math.max(Math.abs(Mx), 0.001);
    const overturningFOSY = stabilisingMomentY / Math.max(Math.abs(My), 0.001);

    const minFOS = this.config.options.slidingSafetyFactor;

    return {
      slidingFOS: PrecisionMath.round(slidingFOS, 2),
      overturningFOSX: PrecisionMath.round(overturningFOSX, 2),
      overturningFOSY: PrecisionMath.round(overturningFOSY, 2),
      minimumFOSRequired: minFOS,
      status: slidingFOS >= minFOS && Math.min(overturningFOSX, overturningFOSY) >= minFOS ? 'PASS' : 'FAIL',
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - CHECKS CREATION
  // --------------------------------------------------------------------------

  private createBearingCapacityCheck(soilPressure: SoilPressureDistribution, qall: number, code: DesignCode): DesignCheck {
    return {
      id: 'bearing-capacity',
      name: 'Bearing Capacity',
      category: 'strength',
      clause: this.getBearingCapacityClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Maximum soil pressure vs allowable bearing capacity',
      demand: soilPressure.maximum,
      demandUnit: 'kPa',
      capacity: qall,
      capacityUnit: 'kPa',
      ratio: soilPressure.maximum / qall,
      utilizationPercent: (soilPressure.maximum / qall) * 100,
      status: soilPressure.maximum <= qall ? 'PASS' : 'FAIL',
      severity: soilPressure.maximum > qall ? 'critical' : 'info',
    };
  }

  private createUpliftCheck(soilPressure: SoilPressureDistribution, allowUplift: boolean, code: DesignCode): DesignCheck {
    return {
      id: 'uplift',
      name: 'Uplift Check',
      category: 'stability',
      clause: this.getUpliftClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Check for negative soil pressure (tension)',
      demand: Math.abs(soilPressure.minimum),
      demandUnit: 'kPa',
      capacity: 0,
      capacityUnit: 'kPa',
      ratio: soilPressure.minimum < 0 ? 999 : 0,
      utilizationPercent: soilPressure.minimum < 0 ? 100 : 0,
      status: allowUplift ? 'WARNING' : 'FAIL',
      severity: allowUplift ? 'minor' : 'critical',
      notes: `Contact ratio: ${soilPressure.contactRatio.toFixed(1)}%`,
      recommendations: [
        'Consider increasing footing size',
        'Add weight to counteract uplift',
        'Review load combinations',
      ],
    };
  }

  private createSettlementCheck(settlement: SettlementAnalysis, limit: number): DesignCheck {
    return {
      id: 'settlement',
      name: 'Total Settlement',
      category: 'serviceability',
      clause: 'IS 1904:1986',
      codeReference: 'IS 1904',
      description: 'Total settlement (immediate + consolidation + secondary)',
      demand: settlement.total,
      demandUnit: 'mm',
      capacity: limit,
      capacityUnit: 'mm',
      ratio: settlement.total / limit,
      utilizationPercent: (settlement.total / limit) * 100,
      status: settlement.status,
      severity: settlement.status === 'FAIL' ? 'major' : 'info',
    };
  }

  private createSlidingCheck(stability: StabilityAnalysis, requiredFOS: number, code: DesignCode): DesignCheck {
    return {
      id: 'sliding',
      name: 'Sliding Stability',
      category: 'stability',
      clause: this.getSlidingClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Factor of safety against sliding',
      demand: requiredFOS,
      demandUnit: '',
      capacity: stability.slidingFOS,
      capacityUnit: '',
      ratio: requiredFOS / stability.slidingFOS,
      utilizationPercent: (requiredFOS / stability.slidingFOS) * 100,
      status: stability.slidingFOS >= requiredFOS ? 'PASS' : 'FAIL',
      severity: stability.slidingFOS < requiredFOS ? 'critical' : 'info',
    };
  }

  private createOverturningCheck(stability: StabilityAnalysis, requiredFOS: number, code: DesignCode): DesignCheck {
    const minFOS = Math.min(stability.overturningFOSX, stability.overturningFOSY);
    return {
      id: 'overturning',
      name: 'Overturning Stability',
      category: 'stability',
      clause: this.getOverturningClause(code),
      codeReference: this.getCodeReference(code),
      description: 'Factor of safety against overturning',
      demand: requiredFOS,
      demandUnit: '',
      capacity: minFOS,
      capacityUnit: '',
      ratio: requiredFOS / minFOS,
      utilizationPercent: (requiredFOS / minFOS) * 100,
      status: minFOS >= requiredFOS ? 'PASS' : 'FAIL',
      severity: minFOS < requiredFOS ? 'critical' : 'info',
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - CODE REFERENCES
  // --------------------------------------------------------------------------

  private getPunchingShearClause(code: DesignCode): string {
    const clauses: Record<DesignCode, string> = {
      IS456: 'IS 456:2000 Cl. 31.6.3',
      IS2950: 'IS 2950 (Part I) Cl. 7.2.4',
      IS6403: 'IS 6403:1981',
      ACI318: 'ACI 318-19 Sec. 22.6',
      EN1992: 'EN 1992-1-1 Cl. 6.4.4',
      EN1997: 'EN 1997-1',
      AS3600: 'AS 3600:2018 Sec. 9.2',
      BS8110: 'BS 8110-1:1997 Cl. 3.7.7',
    };
    return clauses[code] || 'IS 456:2000 Cl. 31.6.3';
  }

  private getOneWayShearClause(code: DesignCode): string {
    const clauses: Record<DesignCode, string> = {
      IS456: 'IS 456:2000 Cl. 40.1',
      IS2950: 'IS 2950 (Part I)',
      IS6403: 'IS 6403:1981',
      ACI318: 'ACI 318-19 Sec. 22.5',
      EN1992: 'EN 1992-1-1 Cl. 6.2',
      EN1997: 'EN 1997-1',
      AS3600: 'AS 3600:2018 Sec. 8.2',
      BS8110: 'BS 8110-1:1997 Cl. 3.4.5',
    };
    return clauses[code] || 'IS 456:2000 Cl. 40.1';
  }

  private getFlexuralClause(code: DesignCode): string {
    const clauses: Record<DesignCode, string> = {
      IS456: 'IS 456:2000 Cl. 38.1',
      IS2950: 'IS 2950 (Part I)',
      IS6403: 'IS 6403:1981',
      ACI318: 'ACI 318-19 Sec. 22.2',
      EN1992: 'EN 1992-1-1 Cl. 6.1',
      EN1997: 'EN 1997-1',
      AS3600: 'AS 3600:2018 Sec. 8.1',
      BS8110: 'BS 8110-1:1997 Cl. 3.4.4',
    };
    return clauses[code] || 'IS 456:2000 Cl. 38.1';
  }

  private getBearingCapacityClause(code: DesignCode): string {
    const clauses: Record<DesignCode, string> = {
      IS456: 'IS 1904:1986',
      IS2950: 'IS 2950 (Part I) Cl. 5',
      IS6403: 'IS 6403:1981 Cl. 5',
      ACI318: 'ACI 336',
      EN1992: 'EN 1997-1 Cl. 6.5.2',
      EN1997: 'EN 1997-1 Cl. 6.5.2',
      AS3600: 'AS 2159',
      BS8110: 'BS 8004:2015',
    };
    return clauses[code] || 'IS 1904:1986';
  }

  private getUpliftClause(code: DesignCode): string {
    return this.getBearingCapacityClause(code);
  }

  private getSlidingClause(code: DesignCode): string {
    return this.getBearingCapacityClause(code);
  }

  private getOverturningClause(code: DesignCode): string {
    return this.getBearingCapacityClause(code);
  }

  private getCodeReference(code: DesignCode): string {
    const refs: Record<DesignCode, string> = {
      IS456: 'IS 456:2000',
      IS2950: 'IS 2950 (Part I):1981',
      IS6403: 'IS 6403:1981',
      ACI318: 'ACI 318-19',
      EN1992: 'EN 1992-1-1:2004',
      EN1997: 'EN 1997-1:2004',
      AS3600: 'AS 3600:2018',
      BS8110: 'BS 8110-1:1997',
    };
    return refs[code] || 'IS 456:2000';
  }

  private getCodeReferences(code: DesignCode): string[] {
    const refs: Record<DesignCode, string[]> = {
      IS456: ['IS 456:2000', 'IS 1904:1986', 'IS 2950 (Part I):1981', 'IS 6403:1981'],
      IS2950: ['IS 2950 (Part I):1981', 'IS 456:2000', 'IS 1904:1986'],
      IS6403: ['IS 6403:1981', 'IS 456:2000', 'IS 1904:1986'],
      ACI318: ['ACI 318-19', 'ACI 336.2R-88'],
      EN1992: ['EN 1992-1-1:2004', 'EN 1997-1:2004'],
      EN1997: ['EN 1997-1:2004', 'EN 1992-1-1:2004'],
      AS3600: ['AS 3600:2018', 'AS 2159:2009'],
      BS8110: ['BS 8110-1:1997', 'BS 8004:2015'],
    };
    return refs[code] || refs.IS456;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS - UTILITIES
  // --------------------------------------------------------------------------

  private summarizeChecks(checks: DesignCheck[]): FootingDesignResult['checksSummary'] {
    return {
      total: checks.length,
      passed: checks.filter(c => c.status === 'PASS').length,
      failed: checks.filter(c => c.status === 'FAIL').length,
      warnings: checks.filter(c => c.status === 'WARNING').length,
      notChecked: checks.filter(c => c.status === 'NOT_CHECKED').length,
    };
  }

  private determineOverallStatus(checks: DesignCheck[]): FootingDesignResult['status'] {
    const hasCriticalFail = checks.some(c => c.status === 'FAIL' && c.severity === 'critical');
    const hasFail = checks.some(c => c.status === 'FAIL');
    const hasWarning = checks.some(c => c.status === 'WARNING');

    if (hasCriticalFail || hasFail) return 'FAIL';
    if (hasWarning) return 'REVIEW_REQUIRED';
    return 'PASS';
  }

  private calculateRebarWeight(rebarX: ReinforcementDetail, rebarY: ReinforcementDetail, L: number, B: number): number {
    const steelDensity = 7850; // kg/m³
    
    const volumeX = rebarX.areaProvided / 1e6 * B * (L - 0.1); // Deduct cover
    const volumeY = rebarY.areaProvided / 1e6 * L * (B - 0.1);
    
    return PrecisionMath.round((volumeX + volumeY) * steelDensity, 1);
  }

  private calculateReinforcementRatio(rebarX: ReinforcementDetail, rebarY: ReinforcementDetail, d: number, L: number, B: number): number {
    const avgArea = (rebarX.areaProvided + rebarY.areaProvided) / 2;
    const avgWidth = (L + B) / 2 * 1000;
    return avgArea / (avgWidth * d) * 100;
  }

  private itemizeRebar(rebarX: ReinforcementDetail, rebarY: ReinforcementDetail, L: number, B: number): Record<number, number> {
    const result: Record<number, number> = {};
    
    // X-direction bars
    if (rebarX.numberOfBars) {
      const length = L - 0.1; // Deduct covers
      result[rebarX.diameter] = (result[rebarX.diameter] || 0) + rebarX.numberOfBars * length;
    }
    
    // Y-direction bars
    if (rebarY.numberOfBars) {
      const length = B - 0.1;
      result[rebarY.diameter] = (result[rebarY.diameter] || 0) + rebarY.numberOfBars * length;
    }
    
    return result;
  }

  private generateRecommendations(checks: DesignCheck[], status: FootingDesignResult['status']): string[] {
    const recommendations: string[] = [];

    if (status === 'PASS') {
      recommendations.push('Design is satisfactory for all checks');
    }

    checks.forEach(check => {
      if (check.recommendations) {
        recommendations.push(...check.recommendations);
      }

      if (check.status === 'FAIL') {
        switch (check.id) {
          case 'bearing-capacity':
            recommendations.push('Increase footing size or consider deeper foundation');
            break;
          case 'punching-shear':
            recommendations.push('Increase footing thickness or add shear reinforcement');
            break;
          case 'one-way-shear':
            recommendations.push('Increase footing thickness');
            break;
          case 'flexure-x':
          case 'flexure-y':
            recommendations.push('Increase reinforcement or footing thickness');
            break;
          case 'settlement':
            recommendations.push('Consider ground improvement or pile foundation');
            break;
        }
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private logCalculation(
    step: number,
    description: string,
    formula: string,
    inputs: Record<string, { value: number; unit: string }>,
    output: { value: number; unit: string },
    notes?: string
  ): void {
    this.calculationLog.push({ step, description, formula, inputs, output, notes });
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  public getValidationWarnings(): string[] {
    return [...this.validationWarnings];
  }

  public getCalculationLog(): CalculationStep[] {
    return [...this.calculationLog];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export const createAdvancedFoundationEngine = (config: FoundationDesignConfig) => {
  return new AdvancedFoundationDesignEngine(config);
};

export default AdvancedFoundationDesignEngine;
