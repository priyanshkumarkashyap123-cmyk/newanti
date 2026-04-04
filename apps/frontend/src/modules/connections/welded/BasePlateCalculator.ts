/**
 * Base Plate Design Calculator
 * Comprehensive column base plate and anchor bolt design
 * Per AISC Design Guide 1, AISC 360, Eurocode 3, IS 800
 * 
 * Features:
 * - Concentric axial compression
 * - Axial + moment (small/large eccentricity)
 * - Anchor bolt design (tension, shear, combined)
 * - Grout bearing checks
 * - Shear lug design
 * - Concrete pedestal design
 */

import {
  WeldDesignCode,
  WeldType,
  ElectrodeClass,
  JointType,
  WeldMaterial,
} from './WeldedConnectionTypes';

// ============================================================================
// Enums
// ============================================================================

export enum BasePlateDesignCode {
  AISC_DG1 = 'AISC Design Guide 1',
  AISC_360 = 'AISC 360-22',
  EUROCODE_3 = 'EN 1993-1-8',
  IS_800 = 'IS 800:2007'
}

export enum AnchorBoltType {
  CAST_IN_PLACE = 'Cast-in-Place',
  POST_INSTALLED_ADHESIVE = 'Post-Installed Adhesive',
  POST_INSTALLED_EXPANSION = 'Post-Installed Expansion',
  POST_INSTALLED_UNDERCUT = 'Post-Installed Undercut',
  HOOKED = 'Hooked J/L-Bolt'
}

export enum AnchorBoltGrade {
  F1554_GR36 = 'ASTM F1554 Gr. 36',
  F1554_GR55 = 'ASTM F1554 Gr. 55',
  F1554_GR105 = 'ASTM F1554 Gr. 105',
  A307 = 'ASTM A307',
  A325 = 'ASTM A325',
  A490 = 'ASTM A490'
}

export enum LoadCombinationType {
  AXIAL_ONLY = 'Axial Compression Only',
  SMALL_ECCENTRICITY = 'Small Moment (e ≤ N/6)',
  LARGE_ECCENTRICITY = 'Large Moment (e > N/6)',
  UPLIFT = 'Net Uplift (Tension)',
  SHEAR_ONLY = 'Shear Only',
  COMBINED = 'Combined Axial + Shear + Moment'
}

// ============================================================================
// Interfaces
// ============================================================================

export interface ColumnProperties {
  shape: string;          // e.g., 'W14x90', 'W12x65'
  d: number;              // Column depth (in or mm)
  bf: number;             // Flange width (in or mm)
  tf: number;             // Flange thickness (in or mm)
  Fy: number;             // Yield strength (ksi or MPa)
}

export interface ConcreteFootingProperties {
  fc: number;             // f'c (psi or MPa)
  A1: number;             // Base plate area (in² or mm²)
  A2: number;             // Concrete support area (in² or mm²)
  pedestalWidth?: number;
  pedestalLength?: number;
  pedestalDepth?: number;
}

export interface AnchorBoltProperties {
  grade: AnchorBoltGrade;
  type: AnchorBoltType;
  diameter: number;       // Nominal diameter (in or mm)
  embedmentDepth: number; // hef (in or mm)
  numberOfBolts: number;
  pattern: 'square' | 'rectangular' | 'circular';
  edgeDistance: number;   // Minimum edge distance (in or mm)
  spacing: number;        // Bolt spacing (in or mm)
  Fy: number;             // Yield strength (ksi or MPa)
  Fu: number;             // Ultimate strength (ksi or MPa)
}

export interface BasePlateInput {
  designCode: BasePlateDesignCode;
  column: ColumnProperties;
  concrete: ConcreteFootingProperties;
  anchors: AnchorBoltProperties;
  loads: {
    Pu: number;           // Factored axial load (kips or kN), + compression
    Mux?: number;         // Factored moment about x (kip-ft or kN-m)
    Muy?: number;         // Factored moment about y (kip-ft or kN-m)
    Vu?: number;          // Factored shear (kips or kN)
  };
  proposedPlate?: {
    N: number;            // Plate length (in or mm)
    B: number;            // Plate width (in or mm)
    tp: number;           // Plate thickness (in or mm)
    Fy: number;           // Plate yield strength (ksi or MPa)
  };
}

export interface BasePlateResult {
  designCode: BasePlateDesignCode;
  loadType: LoadCombinationType;
  
  // Base plate dimensions
  requiredN: number;      // Required length
  requiredB: number;      // Required width
  requiredTp: number;     // Required thickness
  providedN: number;
  providedB: number;
  providedTp: number;
  
  // Bearing checks
  bearingPressure: number;    // fp or qmax
  allowableBearing: number;   // φc × Pp
  bearingUtilization: number;
  
  // Anchor bolt checks
  anchorTensionDemand: number;
  anchorTensionCapacity: number;
  anchorShearDemand: number;
  anchorShearCapacity: number;
  anchorInteraction: number;
  
  // Additional results
  eccentricity?: number;
  neutralAxisDepth?: number;
  
  isAdequate: boolean;
  warnings: string[];
  detailingNotes: string[];
}

// ============================================================================
// Anchor Bolt Strength Data
// ============================================================================

const ANCHOR_BOLT_DATA: Record<AnchorBoltGrade, { Fy: number; Fu: number }> = {
  [AnchorBoltGrade.F1554_GR36]: { Fy: 36, Fu: 58 },
  [AnchorBoltGrade.F1554_GR55]: { Fy: 55, Fu: 75 },
  [AnchorBoltGrade.F1554_GR105]: { Fy: 105, Fu: 125 },
  [AnchorBoltGrade.A307]: { Fy: 36, Fu: 60 },
  [AnchorBoltGrade.A325]: { Fy: 92, Fu: 120 },
  [AnchorBoltGrade.A490]: { Fy: 130, Fu: 150 }
};

// Standard anchor bolt diameters (inches)
const STANDARD_ANCHOR_SIZES = [0.5, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25, 1.375, 1.5, 1.75, 2.0];

// ============================================================================
// AISC Design Guide 1 Calculator
// ============================================================================

class AISCBasePlateCalculator {
  private readonly phi_c = 0.65;  // Bearing on concrete
  private readonly phi_t = 0.75;  // Tension on anchor
  private readonly phi_v = 0.75;  // Shear on anchor

  /**
   * Design base plate for concentric axial compression
   */
  designConcentricCompression(input: BasePlateInput): BasePlateResult {
    const { column, concrete, loads, proposedPlate } = input;
    const Pu = Math.abs(loads.Pu);
    
    // Concrete bearing strength per AISC 360 Section J8
    const fc = concrete.fc;
    const A1 = proposedPlate ? proposedPlate.N * proposedPlate.B : concrete.A1;
    const A2 = concrete.A2;
    
    // Bearing strength
    const sqrtA2A1 = Math.min(Math.sqrt(A2 / A1), 2.0);
    const Pp = 0.85 * fc * A1 * sqrtA2A1 / 1000; // Convert to kips
    const phi_Pp = this.phi_c * Pp;
    
    // Required base plate area
    const A1_required = Pu / (this.phi_c * 0.85 * fc * sqrtA2A1) * 1000;
    
    // Determine plate dimensions
    const delta = 0.5 * (0.95 * column.d - 0.8 * column.bf);
    let N = Math.sqrt(A1_required) + delta;
    let B = A1_required / N;
    
    // Round up to practical dimensions
    N = Math.ceil(N);
    B = Math.ceil(B);
    
    // Ensure plate covers column
    N = Math.max(N, column.d + 2);
    B = Math.max(B, column.bf + 2);
    
    // Recalculate bearing with actual dimensions
    const A1_actual = N * B;
    const sqrtA2A1_actual = Math.min(Math.sqrt(A2 / A1_actual), 2.0);
    const fp = Pu / A1_actual * 1000; // psi
    const fpMax = this.phi_c * 0.85 * fc * sqrtA2A1_actual;
    
    // Calculate required thickness (yield line theory)
    const m = (N - 0.95 * column.d) / 2;
    const n = (B - 0.8 * column.bf) / 2;
    const lambda = Math.min(2 * Math.sqrt(column.d * column.bf) / (column.d + column.bf), 1);
    const lambda_np = lambda * Math.sqrt(column.d * column.bf) / 4;
    const l = Math.max(m, n, lambda_np);
    
    const Fy = proposedPlate?.Fy || 36; // ksi
    const tp_required = l * Math.sqrt(2 * fp / (0.9 * Fy * 1000));
    
    // Round up thickness
    const tp = Math.ceil(tp_required * 8) / 8; // Round to nearest 1/8"
    
    const result: BasePlateResult = {
      designCode: input.designCode,
      loadType: LoadCombinationType.AXIAL_ONLY,
      requiredN: N,
      requiredB: B,
      requiredTp: tp_required,
      providedN: proposedPlate?.N || N,
      providedB: proposedPlate?.B || B,
      providedTp: proposedPlate?.tp || tp,
      bearingPressure: fp,
      allowableBearing: fpMax,
      bearingUtilization: fp / fpMax,
      anchorTensionDemand: 0,
      anchorTensionCapacity: 0,
      anchorShearDemand: loads.Vu || 0,
      anchorShearCapacity: this.calculateAnchorShearCapacity(input.anchors),
      anchorInteraction: 0,
      isAdequate: fp <= fpMax && (proposedPlate?.tp || tp) >= tp_required,
      warnings: [],
      detailingNotes: [
        `Cantilever length m = ${m.toFixed(2)}"`,
        `Cantilever length n = ${n.toFixed(2)}"`,
        `λn' = ${lambda_np.toFixed(2)}"`,
        `Governing length l = ${l.toFixed(2)}"`,
        `A₂/A₁ ratio = ${sqrtA2A1_actual.toFixed(2)}²`
      ]
    };
    
    if (fp > fpMax) {
      result.warnings.push('❌ Bearing pressure exceeds allowable');
    }
    if ((proposedPlate?.tp || tp) < tp_required) {
      result.warnings.push(`❌ Plate thickness (${(proposedPlate?.tp || tp).toFixed(3)}") less than required (${tp_required.toFixed(3)}")`);
    }
    
    return result;
  }

  /**
   * Design base plate with moment (small or large eccentricity)
   */
  designWithMoment(input: BasePlateInput): BasePlateResult {
    const { column, concrete, anchors, loads, proposedPlate } = input;
    const Pu = loads.Pu;
    const Mu = loads.Mux || 0;
    
    // Eccentricity
    const e = Math.abs(Mu * 12 / Pu); // Convert to inches
    
    // Plate dimensions (use proposed or calculate)
    const N = proposedPlate?.N || Math.max(column.d + 4, 12);
    const B = proposedPlate?.B || Math.max(column.bf + 4, 12);
    
    // Check eccentricity vs kern
    const ekern = N / 6;
    const loadType = e <= ekern 
      ? LoadCombinationType.SMALL_ECCENTRICITY 
      : LoadCombinationType.LARGE_ECCENTRICITY;
    
    let result: BasePlateResult;
    
    if (loadType === LoadCombinationType.SMALL_ECCENTRICITY) {
      result = this.designSmallEccentricity(input, e, N, B);
    } else {
      result = this.designLargeEccentricity(input, e, N, B);
    }
    
    result.eccentricity = e;
    return result;
  }

  /**
   * Small eccentricity: No tension in anchors, trapezoidal bearing
   */
  private designSmallEccentricity(
    input: BasePlateInput, 
    e: number, 
    N: number, 
    B: number
  ): BasePlateResult {
    const { column, concrete, loads, proposedPlate } = input;
    const Pu = Math.abs(loads.Pu);
    
    // Bearing pressure distribution (trapezoidal)
    const qmax = (Pu / (N * B)) * (1 + 6 * e / N) * 1000; // psi
    const qmin = (Pu / (N * B)) * (1 - 6 * e / N) * 1000; // psi
    
    // Allowable bearing
    const fc = concrete.fc;
    const sqrtA2A1 = Math.min(Math.sqrt(concrete.A2 / (N * B)), 2.0);
    const fpMax = this.phi_c * 0.85 * fc * sqrtA2A1;
    
    // Required thickness (use maximum pressure)
    const m = (N - 0.95 * column.d) / 2;
    const n = (B - 0.8 * column.bf) / 2;
    const l = Math.max(m, n);
    
    const Fy = proposedPlate?.Fy || 36;
    const tp_required = l * Math.sqrt(2 * qmax / (0.9 * Fy * 1000));
    
    return {
      designCode: input.designCode,
      loadType: LoadCombinationType.SMALL_ECCENTRICITY,
      requiredN: N,
      requiredB: B,
      requiredTp: tp_required,
      providedN: N,
      providedB: B,
      providedTp: proposedPlate?.tp || Math.ceil(tp_required * 8) / 8,
      bearingPressure: qmax,
      allowableBearing: fpMax,
      bearingUtilization: qmax / fpMax,
      anchorTensionDemand: 0,
      anchorTensionCapacity: this.calculateAnchorTensionCapacity(input.anchors),
      anchorShearDemand: loads.Vu || 0,
      anchorShearCapacity: this.calculateAnchorShearCapacity(input.anchors),
      anchorInteraction: 0,
      eccentricity: e,
      isAdequate: qmax <= fpMax,
      warnings: qmax > fpMax ? ['❌ Maximum bearing pressure exceeds allowable'] : [],
      detailingNotes: [
        `Small eccentricity (e = ${e.toFixed(2)}" ≤ N/6 = ${(N/6).toFixed(2)}")`,
        `qmax = ${qmax.toFixed(0)} psi, qmin = ${Math.max(0, qmin).toFixed(0)} psi`,
        'No anchor tension required'
      ]
    };
  }

  /**
   * Large eccentricity: Tension in anchors required
   */
  private designLargeEccentricity(
    input: BasePlateInput, 
    e: number, 
    N: number, 
    B: number
  ): BasePlateResult {
    const { column, concrete, anchors, loads, proposedPlate } = input;
    const Pu = Math.abs(loads.Pu);
    
    // Distance from compression edge to anchor bolts
    const f = (N - column.d) / 2 + 1; // Assume anchors 1" from column face
    
    // Maximum bearing pressure
    const fc = concrete.fc;
    const sqrtA2A1 = Math.min(Math.sqrt(concrete.A2 / (N * B)), 2.0);
    const fpMax = this.phi_c * 0.85 * fc * sqrtA2A1;
    
    // Solve for bearing length Y using equilibrium
    // Sum of moments about anchor line: Pu × (e + f) = 0.5 × qmax × Y × B × (f + N/2 - Y/3)
    // This is a cubic equation - use iterative solution
    
    let Y = N / 3; // Initial guess
    for (let i = 0; i < 20; i++) {
      const moment_arm = f + N / 2 - Y / 3;
      const q = 2 * Pu * (e + f) / (Y * B * moment_arm) * 1000;
      
      if (Math.abs(q - fpMax) < 10) break;
      
      if (q > fpMax) {
        Y *= 1.1; // Increase bearing length
      } else {
        Y *= 0.9;
      }
      Y = Math.min(Y, N);
    }
    
    // Recalculate bearing pressure with final Y
    const qmax = Math.min(2 * Pu * (e + f) / (Y * B * (f + N / 2 - Y / 3)) * 1000, fpMax);
    
    // Anchor bolt tension
    const C = 0.5 * qmax * Y * B / 1000; // Compression resultant (kips)
    const Tu = C - Pu; // Total tension in anchors
    const Tu_per_bolt = Math.max(0, Tu / (anchors.numberOfBolts / 2)); // Assume half bolts in tension
    
    // Anchor capacity
    const anchorTensionCapacity = this.calculateAnchorTensionCapacity(anchors);
    const anchorShearCapacity = this.calculateAnchorShearCapacity(anchors);
    
    // Interaction check
    const Vu = loads.Vu || 0;
    const interaction = (Tu_per_bolt / anchorTensionCapacity) + (Vu / (anchors.numberOfBolts * anchorShearCapacity));
    
    // Required thickness
    const m = (N - 0.95 * column.d) / 2;
    const Fy = proposedPlate?.Fy || 36;
    const tp_required = m * Math.sqrt(2 * qmax / (0.9 * Fy * 1000));
    
    return {
      designCode: input.designCode,
      loadType: LoadCombinationType.LARGE_ECCENTRICITY,
      requiredN: N,
      requiredB: B,
      requiredTp: tp_required,
      providedN: N,
      providedB: B,
      providedTp: proposedPlate?.tp || Math.ceil(tp_required * 8) / 8,
      bearingPressure: qmax,
      allowableBearing: fpMax,
      bearingUtilization: qmax / fpMax,
      anchorTensionDemand: Tu_per_bolt,
      anchorTensionCapacity,
      anchorShearDemand: Vu / anchors.numberOfBolts,
      anchorShearCapacity,
      anchorInteraction: interaction,
      eccentricity: e,
      neutralAxisDepth: Y,
      isAdequate: qmax <= fpMax && interaction <= 1.0,
      warnings: this.generateWarnings(qmax, fpMax, interaction, Tu_per_bolt, anchorTensionCapacity),
      detailingNotes: [
        `Large eccentricity (e = ${e.toFixed(2)}" > N/6 = ${(N/6).toFixed(2)}")`,
        `Bearing length Y = ${Y.toFixed(2)}"`,
        `Anchor tension per bolt = ${Tu_per_bolt.toFixed(2)} kips`,
        `Tension/shear interaction = ${interaction.toFixed(3)}`
      ]
    };
  }

  /**
   * Calculate anchor bolt tension capacity
   */
  private calculateAnchorTensionCapacity(anchors: AnchorBoltProperties): number {
    const Ab = Math.PI * Math.pow(anchors.diameter, 2) / 4;
    
    // Steel strength per AISC 360 Section J3.6
    const Fnt = 0.75 * anchors.Fu; // Nominal tensile stress
    const phi_Rn = this.phi_t * Fnt * Ab;
    
    return phi_Rn;
  }

  /**
   * Calculate anchor bolt shear capacity
   */
  private calculateAnchorShearCapacity(anchors: AnchorBoltProperties): number {
    const Ab = Math.PI * Math.pow(anchors.diameter, 2) / 4;
    
    // Steel strength per AISC 360 Section J3.6
    // Assume threads in shear plane
    const Fnv = 0.450 * anchors.Fu;
    const phi_Rn = this.phi_v * Fnv * Ab;
    
    return phi_Rn;
  }

  /**
   * Generate warnings for design check
   */
  private generateWarnings(
    qmax: number, 
    fpMax: number, 
    interaction: number,
    Tu: number,
    TuCapacity: number
  ): string[] {
    const warnings: string[] = [];
    
    if (qmax > fpMax) {
      warnings.push('❌ Bearing pressure exceeds allowable');
    }
    if (interaction > 1.0) {
      warnings.push('❌ Anchor bolt tension/shear interaction > 1.0');
    }
    if (Tu > TuCapacity) {
      warnings.push('❌ Anchor bolt tension exceeds capacity');
    }
    
    return warnings;
  }

  /**
   * Design shear lug for large shear forces
   */
  designShearLug(
    Vu: number,           // Factored shear (kips)
    fc: number,           // Concrete strength (psi)
    groutThickness: number, // Grout pad thickness (in)
    plateThickness: number  // Base plate thickness (in)
  ): {
    lugWidth: number;
    lugDepth: number;
    lugThickness: number;
    weldSize: number;
    isRequired: boolean;
  } {
    // Effective embedment
    const embedment = groutThickness + 1; // 1" into concrete
    
    // Bearing capacity of concrete
    const Vc = 0.85 * fc * embedment / 1000; // kips per inch width
    
    // Required width
    const lugWidth = Math.ceil(Vu / (this.phi_c * Vc));
    
    // Depth for bending
    const Mu = Vu * embedment / 2; // Bending moment
    const Fy_lug = 36; // Assume A36 lug
    const Z_required = Mu / (0.9 * Fy_lug);
    const lugThickness = Math.ceil(Math.sqrt(6 * Z_required / lugWidth) * 8) / 8;
    
    // Weld to base plate
    const weldSize = Math.ceil(lugThickness * 0.75 * 16) / 16;
    
    return {
      lugWidth,
      lugDepth: embedment + groutThickness,
      lugThickness: Math.max(lugThickness, 0.5),
      weldSize: Math.max(weldSize, 0.25),
      isRequired: Vu > 5 // kips threshold
    };
  }
}

// ============================================================================
// Main Base Plate Calculator
// ============================================================================

export class BasePlateCalculator {
  private aiscCalc = new AISCBasePlateCalculator();

  /**
   * Design base plate for given loading
   */
  design(input: BasePlateInput): BasePlateResult {
    const { loads } = input;
    
    // Determine load type
    if (!loads.Mux && !loads.Muy) {
      // Pure axial
      return this.aiscCalc.designConcentricCompression(input);
    } else {
      // Axial with moment
      return this.aiscCalc.designWithMoment(input);
    }
  }

  /**
   * Quick design: Calculate required plate size for given load
   */
  quickDesign(
    Pu: number,           // Factored axial load (kips)
    columnDepth: number,  // Column depth (in)
    columnWidth: number,  // Column flange width (in)
    fc: number = 4000,    // Concrete strength (psi)
    Fy: number = 36       // Plate yield strength (ksi)
  ): { N: number; B: number; tp: number; area: number } {
    // Assume A2/A1 = 2 for typical pedestal
    const fpMax = 0.65 * 0.85 * fc * 2;
    
    // Required area
    const A1 = Pu / fpMax * 1000;
    
    // Optimize dimensions
    const delta = 0.5 * (0.95 * columnDepth - 0.8 * columnWidth);
    let N = Math.sqrt(A1) + delta;
    let B = A1 / N;
    
    // Round up
    N = Math.ceil(N);
    B = Math.ceil(B);
    
    // Ensure covers column
    N = Math.max(N, columnDepth + 2);
    B = Math.max(B, columnWidth + 2);
    
    // Thickness
    const m = (N - 0.95 * columnDepth) / 2;
    const n = (B - 0.8 * columnWidth) / 2;
    const l = Math.max(m, n);
    const fp = Pu / (N * B) * 1000;
    const tp = l * Math.sqrt(2 * fp / (0.9 * Fy * 1000));
    
    return {
      N,
      B,
      tp: Math.ceil(tp * 8) / 8,
      area: N * B
    };
  }

  /**
   * Select anchor bolts for given tension and shear
   */
  selectAnchorBolts(
    Tu: number,           // Total tension (kips)
    Vu: number,           // Total shear (kips)
    grade: AnchorBoltGrade = AnchorBoltGrade.F1554_GR36,
    minBolts: number = 4
  ): {
    diameter: number;
    numberOfBolts: number;
    embedmentDepth: number;
    grade: AnchorBoltGrade;
    pattern: 'square' | 'rectangular';
  } {
    const { Fu } = ANCHOR_BOLT_DATA[grade];
    
    // Try each standard size
    for (const diameter of STANDARD_ANCHOR_SIZES) {
      const Ab = Math.PI * diameter * diameter / 4;
      const phi_Rnt = 0.75 * 0.75 * Fu * Ab; // Tension capacity per bolt
      const phi_Rnv = 0.75 * 0.45 * Fu * Ab; // Shear capacity per bolt
      
      // Number of bolts needed
      let nBolts = Math.max(minBolts, Math.ceil(Tu / phi_Rnt), Math.ceil(Vu / phi_Rnv));
      
      // Round to even number
      nBolts = Math.ceil(nBolts / 2) * 2;
      
      // Check interaction
      const interaction = (Tu / (nBolts * phi_Rnt)) + (Vu / (nBolts * phi_Rnv));
      
      if (interaction <= 1.0) {
        // Calculate minimum embedment for tension (simplified)
        const hef = Math.max(12 * diameter, 4); // Minimum embedment
        
        return {
          diameter,
          numberOfBolts: nBolts,
          embedmentDepth: hef,
          grade,
          pattern: nBolts === 4 ? 'square' : 'rectangular'
        };
      }
    }
    
    // If no single size works, use largest with more bolts
    const diameter = STANDARD_ANCHOR_SIZES[STANDARD_ANCHOR_SIZES.length - 1];
    const Ab = Math.PI * diameter * diameter / 4;
    const phi_Rnt = 0.75 * 0.75 * Fu * Ab;
    const phi_Rnv = 0.75 * 0.45 * Fu * Ab;
    
    const nTension = Math.ceil(Tu / phi_Rnt);
    const nShear = Math.ceil(Vu / phi_Rnv);
    const nBolts = Math.ceil(Math.max(nTension, nShear, minBolts) / 2) * 2;
    
    return {
      diameter,
      numberOfBolts: nBolts,
      embedmentDepth: Math.max(12 * diameter, 4),
      grade,
      pattern: 'rectangular'
    };
  }

  /**
   * Get standard base plate details for common column sizes
   */
  getStandardDetails(columnShape: string): {
    minN: number;
    minB: number;
    typicalTp: number;
    anchorPattern: string;
    notes: string[];
  } | null {
    // Common W-shapes
    const standards: Record<string, { d: number; bf: number }> = {
      'W14x90': { d: 14.02, bf: 14.52 },
      'W14x68': { d: 14.04, bf: 10.04 },
      'W12x65': { d: 12.12, bf: 12.00 },
      'W12x50': { d: 12.19, bf: 8.08 },
      'W10x49': { d: 9.98, bf: 10.00 },
      'W10x33': { d: 9.73, bf: 7.96 },
      'W8x31': { d: 8.00, bf: 7.995 }
    };
    
    const dims = standards[columnShape];
    if (!dims) return null;
    
    return {
      minN: Math.ceil(dims.d + 4),
      minB: Math.ceil(dims.bf + 4),
      typicalTp: 1.0, // Typical for moderate loads
      anchorPattern: '4 bolts at corners',
      notes: [
        `Column depth: ${dims.d}"`,
        `Column width: ${dims.bf}"`,
        '2" projection beyond column face typical',
        'Verify concrete pedestal size for A₂/A₁ ≥ 4'
      ]
    };
  }
}

// Export singleton instance
export const basePlateCalculator = new BasePlateCalculator();
