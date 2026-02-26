/**
 * ============================================================================
 * BOLTED CONNECTION ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive analysis engine for bolted steel connections
 * Implements AISC 360, Eurocode 3, IS 800, and AS 4100
 * 
 * @author BeamLab Engineering Team
 * @version 1.0.0
 */

import {
  BoltedConnection,
  BoltSpecification,
  BoltPattern,
  BoltPosition,
  BoltCapacity,
  BoltForces,
  BearingCapacity,
  BlockShearCapacity,
  PryingActionResults,
  ConnectionLoads,
  ConnectionPlate,
  DesignCheck,
  FailureMode,
  DesignCode,
  BoltGrade,
  BoltBehavior,
  BoltHoleType,
  ConnectionAnalysisOptions,
  CalculationStep,
  DesignCodeParameters,
  Vector3D,
} from '../types/BoltedConnectionTypes';

// ============================================================================
// CONSTANTS AND CODE PARAMETERS
// ============================================================================

/**
 * AISC 360-22 Design Parameters
 */
const AISC_360_22_PARAMS: DesignCodeParameters = {
  code: DesignCode.AISC_360_22,
  phiBoltShear: 0.75,
  phiBoltTension: 0.75,
  phiBearing: 0.75,
  phiBlockShear: 0.75,
  phiSlip: 1.0,  // Service level, 0.85 for strength level
  omegaBoltShear: 2.00,
  omegaBoltTension: 2.00,
  omegaBearing: 2.00,
  omegaBlockShear: 2.00,
  omegaSlip: 1.50,
  edgeDistanceRequirements: new Map(),
  spacingRequirements: new Map(),
  standardHoleAddition: 1.5875,  // 1/16" in mm
  oversizedHoleAddition: 4.7625, // 3/16" in mm
  classASurface: 0.30,
  classBSurface: 0.50,
  classCsurface: 0.35,
  combinedStressCoefficients: {
    shearExponent: 2,
    tensionExponent: 2,
  },
};

/**
 * Eurocode 3 Design Parameters
 */
const EC3_PARAMS: DesignCodeParameters = {
  code: DesignCode.EUROCODE_3,
  phiBoltShear: 0.80,      // γM2 = 1.25 → 1/1.25 = 0.80
  phiBoltTension: 0.80,
  phiBearing: 0.80,
  phiBlockShear: 0.80,
  phiSlip: 0.909,          // γM3 = 1.1 at serviceability
  omegaBoltShear: 1.25,    // Using γM as equivalent
  omegaBoltTension: 1.25,
  omegaBearing: 1.25,
  omegaBlockShear: 1.25,
  omegaSlip: 1.25,
  edgeDistanceRequirements: new Map(),
  spacingRequirements: new Map(),
  standardHoleAddition: 2,   // 2mm for d ≤ 24mm
  oversizedHoleAddition: 6,
  classASurface: 0.20,
  classBSurface: 0.40,
  classCsurface: 0.50,
  combinedStressCoefficients: {
    shearExponent: 1,        // Linear interaction in EC3
    tensionExponent: 1.4,
  },
};

/**
 * IS 800:2007 Design Parameters
 */
const IS_800_PARAMS: DesignCodeParameters = {
  code: DesignCode.IS_800_2007,
  phiBoltShear: 0.80,      // γmb = 1.25
  phiBoltTension: 0.80,
  phiBearing: 0.80,
  phiBlockShear: 0.80,
  phiSlip: 0.909,
  omegaBoltShear: 1.25,
  omegaBoltTension: 1.25,
  omegaBearing: 1.25,
  omegaBlockShear: 1.25,
  omegaSlip: 1.1,
  edgeDistanceRequirements: new Map(),
  spacingRequirements: new Map(),
  standardHoleAddition: 2,
  oversizedHoleAddition: 6,
  classASurface: 0.20,
  classBSurface: 0.52,
  classCsurface: 0.33,
  combinedStressCoefficients: {
    shearExponent: 2,
    tensionExponent: 2,
  },
};

/**
 * Standard bolt material properties
 */
const BOLT_MATERIAL_DATA: Record<BoltGrade, { Fnt: number; Fnv: number; Fy: number }> = {
  [BoltGrade.ASTM_A307]: { Fnt: 310, Fnv: 188, Fy: 248 },
  [BoltGrade.ASTM_A325]: { Fnt: 620, Fnv: 372, Fy: 558 },
  [BoltGrade.ASTM_A325_TYPE3]: { Fnt: 620, Fnv: 372, Fy: 558 },
  [BoltGrade.ASTM_A490]: { Fnt: 780, Fnv: 457, Fy: 702 },
  [BoltGrade.ASTM_A490_TYPE3]: { Fnt: 780, Fnv: 457, Fy: 702 },
  [BoltGrade.ASTM_F3125_A325]: { Fnt: 620, Fnv: 372, Fy: 558 },
  [BoltGrade.ASTM_F3125_A490]: { Fnt: 780, Fnv: 457, Fy: 702 },
  [BoltGrade.ISO_4_6]: { Fnt: 400, Fnv: 240, Fy: 240 },
  [BoltGrade.ISO_5_6]: { Fnt: 500, Fnv: 300, Fy: 300 },
  [BoltGrade.ISO_8_8]: { Fnt: 800, Fnv: 480, Fy: 640 },
  [BoltGrade.ISO_10_9]: { Fnt: 1000, Fnv: 600, Fy: 900 },
  [BoltGrade.ISO_12_9]: { Fnt: 1200, Fnv: 720, Fy: 1080 },
  [BoltGrade.IS_4_6]: { Fnt: 400, Fnv: 240, Fy: 240 },
  [BoltGrade.IS_8_8]: { Fnt: 800, Fnv: 480, Fy: 640 },
  [BoltGrade.IS_10_9]: { Fnt: 1000, Fnv: 600, Fy: 900 },
  [BoltGrade.AS_4_6]: { Fnt: 400, Fnv: 240, Fy: 240 },
  [BoltGrade.AS_8_8]: { Fnt: 830, Fnv: 498, Fy: 660 },
  [BoltGrade.AS_8_8_TB]: { Fnt: 830, Fnv: 498, Fy: 660 },
};

/**
 * Standard bolt dimensions (metric - mm)
 */
const METRIC_BOLT_DIMENSIONS: Record<string, { d: number; Ab: number; At: number }> = {
  'M12': { d: 12, Ab: 113.1, At: 84.3 },
  'M14': { d: 14, Ab: 153.9, At: 115.0 },
  'M16': { d: 16, Ab: 201.1, At: 157.0 },
  'M18': { d: 18, Ab: 254.5, At: 192.0 },
  'M20': { d: 20, Ab: 314.2, At: 245.0 },
  'M22': { d: 22, Ab: 380.1, At: 303.0 },
  'M24': { d: 24, Ab: 452.4, At: 353.0 },
  'M27': { d: 27, Ab: 572.6, At: 459.0 },
  'M30': { d: 30, Ab: 706.9, At: 561.0 },
  'M33': { d: 33, Ab: 855.3, At: 694.0 },
  'M36': { d: 36, Ab: 1017.9, At: 817.0 },
};

/**
 * Imperial bolt dimensions (inches converted to mm for internal calculations)
 */
const IMPERIAL_BOLT_DIMENSIONS: Record<string, { d: number; Ab: number; At: number }> = {
  '1/2': { d: 12.7, Ab: 126.7, At: 91.6 },
  '5/8': { d: 15.875, Ab: 197.9, At: 145.2 },
  '3/4': { d: 19.05, Ab: 285.0, At: 214.5 },
  '7/8': { d: 22.225, Ab: 387.9, At: 296.8 },
  '1': { d: 25.4, Ab: 506.7, At: 391.6 },
  '1-1/8': { d: 28.575, Ab: 641.3, At: 506.5 },
  '1-1/4': { d: 31.75, Ab: 791.7, At: 625.8 },
  '1-3/8': { d: 34.925, Ab: 958.0, At: 763.4 },
  '1-1/2': { d: 38.1, Ab: 1140.1, At: 919.4 },
};

// ============================================================================
// MAIN ANALYSIS ENGINE CLASS
// ============================================================================

export class BoltedConnectionAnalyzer {
  private connection: BoltedConnection;
  private options: ConnectionAnalysisOptions;
  private codeParams: DesignCodeParameters;
  private calculationSteps: CalculationStep[] = [];
  private stepCounter = 0;

  constructor(connection: BoltedConnection, options: ConnectionAnalysisOptions) {
    this.connection = connection;
    this.options = options;
    this.codeParams = this.getCodeParameters(connection.designCode);
  }

  /**
   * Get code-specific parameters
   */
  private getCodeParameters(code: DesignCode): DesignCodeParameters {
    switch (code) {
      case DesignCode.AISC_360_22:
      case DesignCode.AISC_360_16:
      case DesignCode.AISC_360_10:
        return AISC_360_22_PARAMS;
      case DesignCode.EUROCODE_3:
        return EC3_PARAMS;
      case DesignCode.IS_800_2007:
        return IS_800_PARAMS;
      default:
        return AISC_360_22_PARAMS;
    }
  }

  /**
   * Add a calculation step for documentation
   */
  private addCalculationStep(
    description: string,
    formula: string,
    variables: Record<string, { value: number; unit: string; description: string }>,
    result: number,
    unit: string
  ): void {
    this.stepCounter++;
    this.calculationSteps.push({
      stepNumber: this.stepCounter,
      description,
      formula,
      variables,
      result,
      unit,
    });
  }

  // ============================================================================
  // BOLT GROUP ANALYSIS
  // ============================================================================

  /**
   * Calculate bolt pattern geometric properties
   */
  public calculateBoltGroupProperties(pattern: BoltPattern): {
    centroid: Vector3D;
    Ix: number;
    Iy: number;
    Ip: number;
    coefficientC: number;
  } {
    const positions = pattern.positions.filter(p => p.isActive);
    const n = positions.length;

    // Calculate centroid
    let sumX = 0, sumY = 0;
    positions.forEach(p => {
      sumX += p.x;
      sumY += p.y;
    });
    const centroid: Vector3D = {
      x: sumX / n,
      y: sumY / n,
      z: 0,
    };

    // Calculate moments of inertia about centroid
    let Ix = 0, Iy = 0, Ip = 0;
    positions.forEach(p => {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      Ix += dy * dy;
      Iy += dx * dx;
      Ip += dx * dx + dy * dy;
    });

    // Eccentricity coefficient C (for use with ICR method)
    const coefficientC = n * Ip > 0 ? Math.sqrt(n / Ip) : 1;

    this.addCalculationStep(
      'Bolt Group Centroid',
      'x̄ = Σxᵢ/n, ȳ = Σyᵢ/n',
      {
        'n': { value: n, unit: '', description: 'Number of bolts' },
        'Σx': { value: sumX, unit: 'mm', description: 'Sum of x-coordinates' },
        'Σy': { value: sumY, unit: 'mm', description: 'Sum of y-coordinates' },
      },
      0,
      ''
    );

    this.addCalculationStep(
      'Polar Moment of Inertia',
      'Ip = Σ(dxᵢ² + dyᵢ²)',
      {
        'Ix': { value: Ix, unit: 'mm²', description: 'About x-axis' },
        'Iy': { value: Iy, unit: 'mm²', description: 'About y-axis' },
      },
      Ip,
      'mm²'
    );

    return { centroid, Ix, Iy, Ip, coefficientC };
  }

  /**
   * Calculate forces on individual bolts using elastic method
   */
  public calculateBoltForcesElastic(
    pattern: BoltPattern,
    loads: ConnectionLoads
  ): Map<string, BoltForces> {
    const boltForces = new Map<string, BoltForces>();
    const positions = pattern.positions.filter(p => p.isActive);
    const n = positions.length;
    
    const { centroid, Ip } = this.calculateBoltGroupProperties(pattern);

    // Direct shear per bolt
    const Vx = loads.shearForce?.Vx || 0;
    const Vy = loads.shearForce?.Vy || 0;
    const directShearX = Vx / n;
    const directShearY = Vy / n;

    // Eccentricity
    const ex = loads.eccentricity?.ex || 0;
    const ey = loads.eccentricity?.ey || 0;
    
    // Moment from eccentricity
    const M = Vx * ey - Vy * ex + (loads.moment?.Mz || 0);

    // Direct tension per bolt
    const P = loads.axialForce || 0;
    const directTension = P > 0 ? P / n : 0;

    positions.forEach(pos => {
      const dx = pos.x - centroid.x;
      const dy = pos.y - centroid.y;
      const r = Math.sqrt(dx * dx + dy * dy);

      // Torsional shear components (perpendicular to radius)
      let torsionalShearX = 0;
      let torsionalShearY = 0;
      if (Ip > 0 && r > 0) {
        const torsionalMagnitude = Math.abs(M) * r / Ip;
        // Components are perpendicular to radius vector
        torsionalShearX = -torsionalMagnitude * (dy / r) * Math.sign(M);
        torsionalShearY = torsionalMagnitude * (dx / r) * Math.sign(M);
      }

      // Resultant shear
      const totalShearX = directShearX + torsionalShearX;
      const totalShearY = directShearY + torsionalShearY;
      const resultantShear = Math.sqrt(totalShearX * totalShearX + totalShearY * totalShearY);
      const shearAngle = Math.atan2(totalShearY, totalShearX) * 180 / Math.PI;

      // Torsional shear magnitude
      const torsionalShear = Math.sqrt(torsionalShearX * torsionalShearX + torsionalShearY * torsionalShearY);

      boltForces.set(pos.id, {
        boltId: pos.id,
        directShear: Math.sqrt(directShearX * directShearX + directShearY * directShearY),
        torsionalShear,
        resultantShear,
        shearAngle,
        directTension,
        pryingTension: 0, // Calculated separately
        totalTension: directTension,
        combinedRatio: 0, // Calculated after capacity
      });
    });

    return boltForces;
  }

  /**
   * Calculate forces using Instantaneous Center of Rotation (ICR) method
   * More accurate for connections with significant eccentricity
   */
  public calculateBoltForcesICR(
    pattern: BoltPattern,
    loads: ConnectionLoads,
    boltCapacity: number
  ): { forces: Map<string, BoltForces>; icrLocation: Vector3D; iterations: number } {
    const positions = pattern.positions.filter(p => p.isActive);
    const { centroid } = this.calculateBoltGroupProperties(pattern);
    
    const Vx = loads.shearForce?.Vx || 0;
    const Vy = loads.shearForce?.Vy || 0;
    const V = Math.sqrt(Vx * Vx + Vy * Vy);
    const ex = loads.eccentricity?.ex || 0;
    const ey = loads.eccentricity?.ey || 0;
    const M = loads.moment?.Mz || (V * Math.sqrt(ex * ex + ey * ey));

    // Initial ICR guess (on opposite side of load from centroid)
    let icrX = centroid.x - (M > 0 ? ey : -ey);
    let icrY = centroid.y + (M > 0 ? ex : -ex);

    const maxIterations = 100;
    const tolerance = 0.001;
    let converged = false;
    let iterations = 0;

    // ICR iteration
    for (let i = 0; i < maxIterations && !converged; i++) {
      iterations++;
      
      let sumRx = 0, sumRy = 0, sumM = 0;
      let sumRxR = 0, sumRyR = 0;

      positions.forEach(pos => {
        const dx = pos.x - icrX;
        const dy = pos.y - icrY;
        const r = Math.sqrt(dx * dx + dy * dy);
        
        if (r > 0.001) {
          // Force proportional to distance from ICR (elastic assumption)
          const Ri = boltCapacity * r / Math.max(...positions.map(p => 
            Math.sqrt((p.x - icrX) ** 2 + (p.y - icrY) ** 2)
          ));
          
          sumRx += Ri * (-dy / r);
          sumRy += Ri * (dx / r);
          sumM += Ri * r;
          sumRxR += Ri * (-dy / r) * r;
          sumRyR += Ri * (dx / r) * r;
        }
      });

      // Check equilibrium
      const errorX = Math.abs(sumRx - Vx) / Math.max(V, 1);
      const errorY = Math.abs(sumRy - Vy) / Math.max(V, 1);
      const errorM = Math.abs(sumM - Math.abs(M)) / Math.max(Math.abs(M), 1);

      if (errorX < tolerance && errorY < tolerance && errorM < tolerance) {
        converged = true;
      } else {
        // Adjust ICR location
        const factor = 0.5;
        if (sumM > Math.abs(M)) {
          // ICR too far, move closer to centroid
          icrX = icrX + factor * (centroid.x - icrX);
          icrY = icrY + factor * (centroid.y - icrY);
        } else {
          // ICR too close, move farther
          icrX = icrX - factor * (centroid.x - icrX);
          icrY = icrY - factor * (centroid.y - icrY);
        }
      }
    }

    // Calculate final forces based on ICR location
    const boltForces = new Map<string, BoltForces>();
    const maxR = Math.max(...positions.map(p => 
      Math.sqrt((p.x - icrX) ** 2 + (p.y - icrY) ** 2)
    ));

    positions.forEach(pos => {
      const dx = pos.x - icrX;
      const dy = pos.y - icrY;
      const r = Math.sqrt(dx * dx + dy * dy);
      
      const resultantShear = r > 0.001 ? boltCapacity * r / maxR : 0;
      const shearAngle = Math.atan2(dx, -dy) * 180 / Math.PI;

      boltForces.set(pos.id, {
        boltId: pos.id,
        directShear: 0,
        torsionalShear: 0,
        resultantShear,
        shearAngle,
        directTension: 0,
        pryingTension: 0,
        totalTension: 0,
        combinedRatio: 0,
      });
    });

    return {
      forces: boltForces,
      icrLocation: { x: icrX, y: icrY, z: 0 },
      iterations,
    };
  }

  // ============================================================================
  // BOLT CAPACITY CALCULATIONS
  // ============================================================================

  /**
   * Calculate bolt shear capacity per AISC 360
   */
  public calculateBoltShearCapacityAISC(
    bolt: BoltSpecification,
    numShearPlanes: number = 1
  ): BoltCapacity {
    const materialData = BOLT_MATERIAL_DATA[bolt.material.grade];
    const Fnv = materialData.Fnv; // MPa
    const Ab = bolt.geometry.nominalArea; // mm²
    
    // Threads in shear plane?
    const threadsExcluded = bolt.behavior === BoltBehavior.BEARING_TYPE_X;
    const effectiveArea = threadsExcluded ? Ab : bolt.geometry.tensileArea;
    
    // Nominal shear strength per shear plane
    const Rn_shear = Fnv * effectiveArea / 1000; // kN per plane
    const totalShear = Rn_shear * numShearPlanes;

    // Nominal tensile strength
    const Fnt = materialData.Fnt; // MPa
    const Rn_tension = Fnt * bolt.geometry.tensileArea / 1000; // kN

    // Apply resistance factor (LRFD) or safety factor (ASD)
    const phi = this.codeParams.phiBoltShear;
    const omega = this.codeParams.omegaBoltShear;

    const designShear = this.options.designMethod === 'LRFD' 
      ? phi * totalShear 
      : totalShear / omega;

    const designTension = this.options.designMethod === 'LRFD'
      ? this.codeParams.phiBoltTension * Rn_tension
      : Rn_tension / this.codeParams.omegaBoltTension;

    this.addCalculationStep(
      'Bolt Shear Capacity (AISC J3.6)',
      'Rn = Fnv × Ab × ns',
      {
        'Fnv': { value: Fnv, unit: 'MPa', description: 'Nominal shear stress' },
        'Ab': { value: effectiveArea, unit: 'mm²', description: 'Effective bolt area' },
        'ns': { value: numShearPlanes, unit: '', description: 'Number of shear planes' },
        'φ': { value: phi, unit: '', description: 'Resistance factor' },
      },
      designShear,
      'kN'
    );

    return {
      nominalShearStrength: totalShear,
      designShearStrength: designShear,
      nominalTensileStrength: Rn_tension,
      designTensileStrength: designTension,
      numShearPlanes,
      threadsInShearPlane: !threadsExcluded,
      reductionFactors: {
        phi: this.options.designMethod === 'LRFD' ? phi : undefined,
        omega: this.options.designMethod === 'ASD' ? omega : undefined,
      },
    };
  }

  /**
   * Calculate bolt capacity per Eurocode 3
   */
  public calculateBoltCapacityEC3(
    bolt: BoltSpecification,
    numShearPlanes: number = 1
  ): BoltCapacity {
    const materialData = BOLT_MATERIAL_DATA[bolt.material.grade];
    const fub = materialData.Fnt; // Ultimate tensile strength (MPa)
    const As = bolt.geometry.tensileArea; // mm²
    const A = bolt.geometry.nominalArea; // mm²

    // Shear resistance per shear plane (EC3 Table 3.4)
    // αv = 0.6 for classes 4.6, 5.6, 8.8; αv = 0.5 for 10.9
    const alphaV = bolt.material.grade === BoltGrade.ISO_10_9 ? 0.5 : 0.6;
    
    // Use As if threads in shear plane, A otherwise
    const threadsExcluded = bolt.behavior === BoltBehavior.BEARING_TYPE_X;
    const effectiveArea = threadsExcluded ? A : As;
    
    const Fv_Rd = alphaV * fub * effectiveArea / (this.codeParams.omegaBoltShear * 1000); // kN per plane
    const totalShear = Fv_Rd * numShearPlanes;

    // Tension resistance
    const k2 = 0.9; // For non-countersunk bolts
    const Ft_Rd = k2 * fub * As / (this.codeParams.omegaBoltTension * 1000); // kN

    this.addCalculationStep(
      'Bolt Shear Resistance (EC3 Table 3.4)',
      'Fv,Rd = αv × fub × A / γM2',
      {
        'αv': { value: alphaV, unit: '', description: 'Shear factor' },
        'fub': { value: fub, unit: 'MPa', description: 'Ultimate tensile strength' },
        'A': { value: effectiveArea, unit: 'mm²', description: 'Effective area' },
        'γM2': { value: this.codeParams.omegaBoltShear, unit: '', description: 'Partial factor' },
      },
      totalShear,
      'kN'
    );

    return {
      nominalShearStrength: totalShear * this.codeParams.omegaBoltShear,
      designShearStrength: totalShear,
      nominalTensileStrength: Ft_Rd * this.codeParams.omegaBoltTension,
      designTensileStrength: Ft_Rd,
      numShearPlanes,
      threadsInShearPlane: !threadsExcluded,
      reductionFactors: {
        omega: this.codeParams.omegaBoltShear,
      },
    };
  }

  /**
   * Calculate slip resistance for slip-critical connections
   */
  public calculateSlipResistance(
    bolt: BoltSpecification,
    numSlipPlanes: number = 1
  ): number {
    const materialData = BOLT_MATERIAL_DATA[bolt.material.grade];
    const fub = materialData.Fnt;
    const As = bolt.geometry.tensileArea;
    
    // Minimum pretension (70% of tensile capacity for high-strength bolts)
    const Tb = bolt.pretension || (0.7 * fub * As / 1000); // kN

    // Slip coefficient based on faying surface class
    let mu: number;
    switch (bolt.behavior) {
      case BoltBehavior.SLIP_CRITICAL_A:
        mu = this.codeParams.classASurface;
        break;
      case BoltBehavior.SLIP_CRITICAL_B:
        mu = this.codeParams.classBSurface;
        break;
      case BoltBehavior.SLIP_CRITICAL_C:
        mu = this.codeParams.classCsurface;
        break;
      default:
        mu = this.codeParams.classASurface;
    }

    // Hole factor
    let hf: number;
    switch (bolt.holeType) {
      case BoltHoleType.STANDARD:
        hf = 1.0;
        break;
      case BoltHoleType.OVERSIZED:
        hf = 0.85;
        break;
      case BoltHoleType.SHORT_SLOTTED:
      case BoltHoleType.SHORT_SLOTTED_TRANSVERSE:
        hf = 0.85;
        break;
      case BoltHoleType.LONG_SLOTTED:
      case BoltHoleType.LONG_SLOTTED_TRANSVERSE:
        hf = 0.70;
        break;
      default:
        hf = 1.0;
    }

    // Slip resistance per bolt
    const phi = this.options.slipCheckLevel === 'SERVICE' ? 1.0 : 0.85;
    const Rn_slip = mu * hf * Tb * numSlipPlanes;
    const designSlip = this.options.designMethod === 'LRFD' 
      ? phi * Rn_slip 
      : Rn_slip / 1.5;

    this.addCalculationStep(
      'Slip Resistance (AISC J3.8)',
      'Rn = μ × hf × Tb × ns',
      {
        'μ': { value: mu, unit: '', description: 'Slip coefficient' },
        'hf': { value: hf, unit: '', description: 'Hole factor' },
        'Tb': { value: Tb, unit: 'kN', description: 'Bolt pretension' },
        'ns': { value: numSlipPlanes, unit: '', description: 'Slip planes' },
      },
      designSlip,
      'kN'
    );

    return designSlip;
  }

  // ============================================================================
  // BEARING CAPACITY
  // ============================================================================

  /**
   * Calculate bearing capacity at bolt holes (AISC J3.10)
   */
  public calculateBearingCapacityAISC(
    bolt: BoltSpecification,
    plate: ConnectionPlate,
    clearDistanceToEdge: number,
    clearDistanceToBolt: number,
    deformationAcceptable: boolean = true
  ): BearingCapacity {
    const d = bolt.geometry.diameter;
    const t = plate.thickness;
    const Fu = plate.material.ultimateStrength;
    
    // Hole diameter
    const holeAddition = bolt.holeType === BoltHoleType.STANDARD 
      ? this.codeParams.standardHoleAddition 
      : this.codeParams.oversizedHoleAddition;
    const dh = d + holeAddition;

    // Clear distance
    const Lc = Math.min(clearDistanceToEdge - dh/2, clearDistanceToBolt - dh);

    // Bearing strength
    let Rn_bearing: number;
    let Rn_tearout: number;

    if (deformationAcceptable) {
      // When deformation at service load is a consideration
      Rn_bearing = 2.4 * d * t * Fu / 1000; // kN
      Rn_tearout = 1.2 * Lc * t * Fu / 1000; // kN
    } else {
      // When deformation is not a consideration
      Rn_bearing = 3.0 * d * t * Fu / 1000; // kN
      Rn_tearout = 1.5 * Lc * t * Fu / 1000; // kN
    }

    const Rn = Math.min(Rn_bearing, Rn_tearout);
    const governingMode = Rn_bearing <= Rn_tearout ? 'BEARING' : 'TEAROUT';

    const phi = this.codeParams.phiBearing;
    const omega = this.codeParams.omegaBearing;
    const designStrength = this.options.designMethod === 'LRFD' 
      ? phi * Rn 
      : Rn / omega;

    this.addCalculationStep(
      'Bearing Capacity (AISC J3.10)',
      deformationAcceptable 
        ? 'Rn = min(2.4dtFu, 1.2LctFu)' 
        : 'Rn = min(3.0dtFu, 1.5LctFu)',
      {
        'd': { value: d, unit: 'mm', description: 'Bolt diameter' },
        't': { value: t, unit: 'mm', description: 'Plate thickness' },
        'Fu': { value: Fu, unit: 'MPa', description: 'Ultimate strength' },
        'Lc': { value: Lc, unit: 'mm', description: 'Clear distance' },
      },
      designStrength,
      'kN'
    );

    return {
      nominalStrength: Rn,
      designStrength,
      deformationConsidered: deformationAcceptable,
      clearDistance: Lc,
      tearoutStrength: Rn_tearout,
      governingMode,
    };
  }

  // ============================================================================
  // BLOCK SHEAR
  // ============================================================================

  /**
   * Calculate block shear capacity (AISC J4.3)
   */
  public calculateBlockShearAISC(
    plate: ConnectionPlate,
    pattern: BoltPattern,
    failurePath: 'L_SHAPED' | 'U_SHAPED' | 'CUSTOM',
    customPath?: { shearLength: number; tensionLength: number; numHolesShear: number; numHolesTension: number }
  ): BlockShearCapacity {
    const t = plate.thickness;
    const Fy = plate.material.yieldStrength;
    const Fu = plate.material.ultimateStrength;
    const bolt = pattern.defaultBoltSpec;
    const d = bolt.geometry.diameter;
    const dh = d + this.codeParams.standardHoleAddition;

    let Agv: number, Anv: number, Agt: number, Ant: number;
    let numHolesShear: number, numHolesTension: number;
    let pathDescription: string;

    if (customPath) {
      // Custom failure path
      numHolesShear = customPath.numHolesShear;
      numHolesTension = customPath.numHolesTension;
      Agv = customPath.shearLength * t;
      Anv = (customPath.shearLength - numHolesShear * dh) * t;
      Agt = customPath.tensionLength * t;
      Ant = (customPath.tensionLength - numHolesTension * dh) * t;
      pathDescription = 'Custom failure path';
    } else {
      // Standard patterns
      const positions = pattern.positions.filter(p => p.isActive);
      const rows = pattern.numRows;
      const cols = pattern.numColumns;

      if (failurePath === 'L_SHAPED') {
        // L-shaped block shear (typical for angles, single line connections)
        numHolesShear = rows - 0.5;
        numHolesTension = 0.5;
        const shearLength = pattern.edgeDistanceTop + (rows - 1) * pattern.pitchVertical;
        const tensionLength = pattern.edgeDistanceLeft;
        Agv = shearLength * t;
        Anv = (shearLength - numHolesShear * dh) * t;
        Agt = tensionLength * t;
        Ant = (tensionLength - numHolesTension * dh) * t;
        pathDescription = 'L-shaped (shear + tension perpendicular)';
      } else {
        // U-shaped block shear (typical for coped beams, gussets)
        numHolesShear = (rows - 0.5) * 2; // Two shear planes
        numHolesTension = cols - 1;
        const shearLength = 2 * (pattern.edgeDistanceTop + (rows - 1) * pattern.pitchVertical);
        const tensionLength = (cols - 1) * pattern.pitchHorizontal;
        Agv = shearLength * t;
        Anv = (shearLength - numHolesShear * dh) * t;
        Agt = tensionLength * t;
        Ant = (tensionLength - numHolesTension * dh) * t;
        pathDescription = 'U-shaped (two shear planes + tension)';
      }
    }

    // Tension stress distribution factor
    // Ubs = 1.0 for uniform tension stress
    // Ubs = 0.5 for non-uniform tension stress (coped beams with 2+ rows)
    const Ubs = pattern.numRows >= 2 && failurePath === 'U_SHAPED' ? 0.5 : 1.0;

    // Block shear strength (AISC Eq. J4-5)
    // Rn = 0.6*Fu*Anv + Ubs*Fu*Ant ≤ 0.6*Fy*Agv + Ubs*Fu*Ant
    const Rn1 = (0.6 * Fu * Anv + Ubs * Fu * Ant) / 1000; // kN (rupture)
    const Rn2 = (0.6 * Fy * Agv + Ubs * Fu * Ant) / 1000; // kN (yield + rupture)
    const Rn = Math.min(Rn1, Rn2);

    const phi = this.codeParams.phiBlockShear;
    const omega = this.codeParams.omegaBlockShear;
    const designStrength = this.options.designMethod === 'LRFD' 
      ? phi * Rn 
      : Rn / omega;

    this.addCalculationStep(
      'Block Shear Capacity (AISC J4.3)',
      'Rn = min(0.6FuAnv + UbsFuAnt, 0.6FyAgv + UbsFuAnt)',
      {
        'Agv': { value: Agv, unit: 'mm²', description: 'Gross shear area' },
        'Anv': { value: Anv, unit: 'mm²', description: 'Net shear area' },
        'Ant': { value: Ant, unit: 'mm²', description: 'Net tension area' },
        'Ubs': { value: Ubs, unit: '', description: 'Tension stress factor' },
        'Fy': { value: Fy, unit: 'MPa', description: 'Yield strength' },
        'Fu': { value: Fu, unit: 'MPa', description: 'Ultimate strength' },
      },
      designStrength,
      'kN'
    );

    return {
      grossShearArea: Agv,
      netShearArea: Anv,
      grossTensionArea: Agt,
      netTensionArea: Ant,
      nominalStrength: Rn,
      designStrength,
      tensionStressFactor: Ubs,
      failurePath: pathDescription,
    };
  }

  // ============================================================================
  // PRYING ACTION
  // ============================================================================

  /**
   * Analyze prying action for bolted tension connections
   */
  public analyzePryingAction(
    bolt: BoltSpecification,
    flangeThickness: number,
    distanceToEdge: number, // 'a' dimension
    distanceToWeb: number,  // 'b' dimension
    tributaryWidth: number, // perpendicular to bolt line
    appliedTension: number, // kN per bolt
    Fy: number // Flange yield strength (MPa)
  ): PryingActionResults {
    const d = bolt.geometry.diameter;
    const dh = d + this.codeParams.standardHoleAddition;
    const tf = flangeThickness;

    // Effective dimensions (AISC Part 9)
    const a_eff = Math.min(distanceToEdge, 1.25 * distanceToWeb);
    const b_prime = distanceToWeb - d / 2;
    const a_prime = a_eff + d / 2;

    // Ratio of net to gross area
    const delta = 1 - dh / tributaryWidth;

    // Flexibility parameter
    const rho = b_prime / a_prime;

    // Required thickness for no prying (AISC Eq. 9-20a)
    const T = appliedTension; // kN
    const B = bolt.geometry.tensileArea * BOLT_MATERIAL_DATA[bolt.material.grade].Fnt / 1000; // kN (bolt tensile capacity)
    
    const phi = this.codeParams.phiBoltTension;
    const phiB = this.options.designMethod === 'LRFD' ? phi * B : B / 2.0;

    // Minimum thickness for prying to be zero
    const tc = Math.sqrt(
      (4 * T * b_prime * 1000) / (tributaryWidth * Fy)
    );

    // Prying ratio and force
    let Q = 0;
    let alpha_prime = 0;
    let isPryingSignificant = false;

    if (tf < tc) {
      // Prying is significant
      isPryingSignificant = true;
      
      // Alpha' parameter
      const term1 = 1 / (delta * (1 + rho));
      const term2 = (phiB / T) - 1;
      alpha_prime = Math.min(1.0, Math.max(0, term1 * term2));

      // Calculate prying force
      if (alpha_prime < 1.0) {
        const tfRatio = (tf / tc) ** 2;
        Q = T * (1 / tfRatio - 1) * (b_prime / a_prime);
        Q = Math.max(0, Math.min(Q, T)); // Bound prying force
      }
    }

    const pryingRatio = T > 0 ? Q / T : 0;

    this.addCalculationStep(
      'Prying Action Analysis (AISC Part 9)',
      "tc = √(4Tb'/pFy), Q = T(1/(tf/tc)² - 1)(b'/a')",
      {
        'tf': { value: tf, unit: 'mm', description: 'Flange thickness' },
        'tc': { value: tc, unit: 'mm', description: 'Critical thickness' },
        "b'": { value: b_prime, unit: 'mm', description: 'Effective distance to web' },
        "a'": { value: a_prime, unit: 'mm', description: 'Effective distance to edge' },
        'T': { value: T, unit: 'kN', description: 'Applied tension per bolt' },
      },
      Q,
      'kN'
    );

    return {
      isPryingSignificant,
      pryingForce: Q,
      pryingRatio,
      requiredThicknessNoPrying: tc,
      actualThickness: tf,
      tributaryLength: tributaryWidth,
      distanceToEdge: a_eff,
      distanceToWeb: distanceToWeb,
      flexibilityParameter: alpha_prime,
      effectiveTeeLength: tributaryWidth,
    };
  }

  // ============================================================================
  // COMBINED STRESS CHECK
  // ============================================================================

  /**
   * Check combined shear and tension (AISC J3.7)
   */
  public checkCombinedStress(
    bolt: BoltSpecification,
    shearDemand: number,
    tensionDemand: number,
    boltCapacity: BoltCapacity
  ): DesignCheck {
    const phi = this.codeParams.phiBoltTension;
    const Fnt = BOLT_MATERIAL_DATA[bolt.material.grade].Fnt;
    const Fnv = BOLT_MATERIAL_DATA[bolt.material.grade].Fnv;
    const Ab = bolt.geometry.tensileArea;

    // Required shear stress
    const frv = shearDemand * 1000 / Ab; // MPa

    // Modified tensile stress (AISC Eq. J3-3a)
    const Fnt_prime = Math.min(
      1.3 * Fnt - (Fnt / (phi * Fnv)) * frv,
      Fnt
    );

    // Available tensile strength with interaction
    const Rn_combined = Fnt_prime * Ab / 1000; // kN
    const designCapacity = this.options.designMethod === 'LRFD'
      ? phi * Rn_combined
      : Rn_combined / this.codeParams.omegaBoltTension;

    const dcr = tensionDemand / Math.max(designCapacity, 0.001);
    const passed = dcr <= 1.0;

    this.addCalculationStep(
      'Combined Shear-Tension (AISC J3.7)',
      "F'nt = min(1.3Fnt - (Fnt/φFnv)frv, Fnt)",
      {
        'Fnt': { value: Fnt, unit: 'MPa', description: 'Nominal tensile stress' },
        'Fnv': { value: Fnv, unit: 'MPa', description: 'Nominal shear stress' },
        'frv': { value: frv, unit: 'MPa', description: 'Required shear stress' },
        "F'nt": { value: Fnt_prime, unit: 'MPa', description: 'Modified tensile stress' },
      },
      dcr,
      ''
    );

    return {
      id: 'combined-stress',
      name: 'Combined Shear-Tension Interaction',
      limitState: FailureMode.BOLT_COMBINED,
      demand: tensionDemand,
      capacity: designCapacity,
      dcr,
      passed,
      utilization: dcr * 100,
      codeReference: 'AISC 360-22 J3.7',
    };
  }

  // ============================================================================
  // COMPLETE ANALYSIS
  // ============================================================================

  /**
   * Run complete connection analysis
   */
  public analyze(): {
    connection: BoltedConnection;
    checks: DesignCheck[];
    calculations: CalculationStep[];
    summary: {
      isAdequate: boolean;
      maxDCR: number;
      governingCheck: string;
      criticalBolt: string;
    };
  } {
    const checks: DesignCheck[] = [];
    const pattern = this.connection.boltPattern;
    const loads = this.connection.loads[0]; // Use first load case for now

    // 1. Calculate bolt group properties
    const groupProps = this.calculateBoltGroupProperties(pattern);
    
    // 2. Calculate forces on each bolt
    const boltForces = this.calculateBoltForcesElastic(pattern, loads);
    
    // 3. Calculate bolt capacities
    const boltCapacity = this.connection.designCode.startsWith('AISC')
      ? this.calculateBoltShearCapacityAISC(pattern.defaultBoltSpec, 1)
      : this.calculateBoltCapacityEC3(pattern.defaultBoltSpec, 1);

    // 4. Check each bolt for shear
    let maxShearDCR = 0;
    let criticalBolt = '';
    
    boltForces.forEach((forces, boltId) => {
      const dcr = forces.resultantShear / boltCapacity.designShearStrength;
      if (dcr > maxShearDCR) {
        maxShearDCR = dcr;
        criticalBolt = boltId;
      }
    });

    checks.push({
      id: 'bolt-shear',
      name: 'Bolt Shear Capacity',
      limitState: FailureMode.BOLT_SHEAR,
      demand: boltForces.get(criticalBolt)?.resultantShear || 0,
      capacity: boltCapacity.designShearStrength,
      dcr: maxShearDCR,
      passed: maxShearDCR <= 1.0,
      utilization: maxShearDCR * 100,
      codeReference: 'AISC 360-22 J3.6',
    });

    // 5. Check slip resistance if slip-critical
    if (pattern.defaultBoltSpec.behavior.startsWith('SLIP')) {
      const slipResistance = this.calculateSlipResistance(pattern.defaultBoltSpec, 1);
      const maxForce = Math.max(...Array.from(boltForces.values()).map(f => f.resultantShear));
      const slipDCR = maxForce / slipResistance;
      
      checks.push({
        id: 'slip-resistance',
        name: 'Slip Resistance',
        limitState: FailureMode.BOLT_SLIP,
        demand: maxForce,
        capacity: slipResistance,
        dcr: slipDCR,
        passed: slipDCR <= 1.0,
        utilization: slipDCR * 100,
        codeReference: 'AISC 360-22 J3.8',
      });
    }

    // 6. Check bearing at each bolt hole
    if (this.connection.plates.length > 0) {
      const plate = this.connection.plates[0];
      const positions = pattern.positions.filter(p => p.isActive);
      
      let maxBearingDCR = 0;
      positions.forEach(pos => {
        const clearDistance = Math.min(pos.edgeDistanceHorizontal, pos.edgeDistanceVertical);
        const bearingCap = this.calculateBearingCapacityAISC(
          pattern.defaultBoltSpec,
          plate,
          clearDistance,
          pattern.pitchVertical
        );
        const force = boltForces.get(pos.id)?.resultantShear || 0;
        const dcr = force / bearingCap.designStrength;
        if (dcr > maxBearingDCR) maxBearingDCR = dcr;
      });

      checks.push({
        id: 'bearing',
        name: 'Bearing at Bolt Holes',
        limitState: FailureMode.BEARING_YIELDING,
        demand: boltForces.get(criticalBolt)?.resultantShear || 0,
        capacity: this.calculateBearingCapacityAISC(
          pattern.defaultBoltSpec,
          plate,
          pattern.edgeDistanceTop,
          pattern.pitchVertical
        ).designStrength,
        dcr: maxBearingDCR,
        passed: maxBearingDCR <= 1.0,
        utilization: maxBearingDCR * 100,
        codeReference: 'AISC 360-22 J3.10',
      });

      // 7. Check block shear
      const blockShear = this.calculateBlockShearAISC(plate, pattern, 'U_SHAPED');
      const totalShear = Math.abs(loads.shearForce?.Vy || 0);
      const blockShearDCR = totalShear / blockShear.designStrength;

      checks.push({
        id: 'block-shear',
        name: 'Block Shear Rupture',
        limitState: FailureMode.BLOCK_SHEAR,
        demand: totalShear,
        capacity: blockShear.designStrength,
        dcr: blockShearDCR,
        passed: blockShearDCR <= 1.0,
        utilization: blockShearDCR * 100,
        codeReference: 'AISC 360-22 J4.3',
      });
    }

    // Find governing check
    const maxDCR = Math.max(...checks.map(c => c.dcr));
    const governingCheck = checks.find(c => c.dcr === maxDCR);

    return {
      connection: this.connection,
      checks,
      calculations: this.calculationSteps,
      summary: {
        isAdequate: maxDCR <= 1.0,
        maxDCR,
        governingCheck: governingCheck?.name || 'Unknown',
        criticalBolt,
      },
    };
  }

  /**
   * Get calculation steps for reporting
   */
  public getCalculationSteps(): CalculationStep[] {
    return this.calculationSteps;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get standard bolt dimensions
 */
export function getBoltDimensions(
  designation: string,
  system: 'METRIC' | 'IMPERIAL' = 'METRIC'
): { d: number; Ab: number; At: number } | undefined {
  if (system === 'METRIC') {
    return METRIC_BOLT_DIMENSIONS[designation];
  } else {
    return IMPERIAL_BOLT_DIMENSIONS[designation];
  }
}

/**
 * Calculate minimum edge distance per AISC Table J3.4
 */
export function getMinimumEdgeDistance(
  boltDiameter: number,
  edgeType: 'SHEARED' | 'ROLLED' | 'GAS_CUT' | 'SAWN'
): number {
  // AISC Table J3.4 (minimum edge distances in mm)
  const factor = edgeType === 'SHEARED' ? 1.75 : 1.25;
  return boltDiameter * factor;
}

/**
 * Calculate minimum bolt spacing per AISC J3.3
 */
export function getMinimumSpacing(boltDiameter: number): number {
  // Minimum spacing = 2.67d, preferred = 3d
  return 2.67 * boltDiameter;
}

/**
 * Calculate maximum edge distance per AISC J3.5
 */
export function getMaximumEdgeDistance(
  plateThickness: number,
  isCorrosive: boolean = false
): number {
  // Maximum = 12t ≤ 6" (152mm), or 4+4t for corrosive
  if (isCorrosive) {
    return Math.min(4 + 4 * plateThickness, 152);
  }
  return Math.min(12 * plateThickness, 152);
}

/**
 * Generate rectangular bolt pattern
 */
export function createRectangularPattern(
  rows: number,
  cols: number,
  pitchV: number,
  pitchH: number,
  edgeTop: number,
  edgeLeft: number,
  boltSpec: BoltSpecification
): BoltPattern {
  const positions: BoltPosition[] = [];
  let id = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        id: `B${id++}`,
        row: r + 1,
        column: c + 1,
        x: edgeLeft + c * pitchH,
        y: edgeTop + r * pitchV,
        edgeDistanceHorizontal: c === 0 ? edgeLeft : (c === cols - 1 ? edgeLeft : pitchH / 2),
        edgeDistanceVertical: r === 0 ? edgeTop : (r === rows - 1 ? edgeTop : pitchV / 2),
        isActive: true,
      });
    }
  }

  // Calculate centroid
  const sumX = positions.reduce((sum, p) => sum + p.x, 0);
  const sumY = positions.reduce((sum, p) => sum + p.y, 0);
  const n = positions.length;
  const centroid: Vector3D = { x: sumX / n, y: sumY / n, z: 0 };

  // Calculate polar moment of inertia
  let Ip = 0;
  positions.forEach(p => {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    Ip += dx * dx + dy * dy;
  });

  return {
    id: `pattern-${Date.now()}`,
    name: `${rows}x${cols} Rectangular Pattern`,
    numRows: rows,
    numColumns: cols,
    totalBolts: n,
    pitchVertical: pitchV,
    pitchHorizontal: pitchH,
    edgeDistanceTop: edgeTop,
    edgeDistanceBottom: edgeTop,
    edgeDistanceLeft: edgeLeft,
    edgeDistanceRight: edgeLeft,
    defaultBoltSpec: boltSpec,
    positions,
    geometryType: 'RECTANGULAR',
    centroid,
    polarMomentOfInertia: Ip,
  };
}

export default BoltedConnectionAnalyzer;
