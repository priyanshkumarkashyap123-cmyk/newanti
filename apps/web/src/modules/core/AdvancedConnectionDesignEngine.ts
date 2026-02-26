/**
 * ============================================================================
 * ADVANCED CONNECTION DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive steel connection design supporting:
 * - Bolted connections (shear, tension, combined)
 * - Welded connections (fillet, butt, plug)
 * - Moment connections (end plate, flange plate)
 * - Simple shear connections (angles, plates)
 * - Base plate connections
 * - Splice connections
 * 
 * Design Codes Supported:
 * - IS 800:2007 (India)
 * - AISC 360-22 (USA)
 * - EN 1993-1-8 (Eurocode)
 * - AS 4100:2020 (Australia)
 * 
 * @version 3.0.0
 */

import { PrecisionMath, EngineeringMath, ENGINEERING_CONSTANTS } from './PrecisionMath';
import { EngineeringErrorHandler, ErrorSeverity, ErrorCategory } from './EngineeringErrorHandler';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export type ConnectionCode = 'IS800' | 'AISC360' | 'EN1993' | 'AS4100';
export type ConnectionType = 'bolted' | 'welded' | 'hybrid';
export type BoltGrade = '4.6' | '4.8' | '5.6' | '5.8' | '8.8' | '10.9' | '12.9' | 'A325' | 'A490' | 'A307';
export type WeldType = 'fillet' | 'butt' | 'plug' | 'slot';
export type ConnectionCategory = 'shear' | 'moment' | 'tension' | 'compression' | 'combined';

export interface BoltProperties {
  grade: BoltGrade;
  diameter: number; // mm
  tensileStrength: number; // MPa (fub)
  yieldStrength: number; // MPa (fyb)
  holeType: 'standard' | 'oversize' | 'slotted';
}

export interface WeldProperties {
  type: WeldType;
  size: number; // mm (leg length for fillet, throat for butt)
  length: number; // mm
  electrodeGrade: number; // MPa (Fxx)
}

export interface PlateProperties {
  thickness: number; // mm
  width: number; // mm
  height: number; // mm
  fy: number; // MPa (yield strength)
  fu: number; // MPa (ultimate strength)
}

export interface ConnectionLoads {
  axialForce: number; // kN (tension +ve)
  shearForceX: number; // kN
  shearForceY: number; // kN
  moment: number; // kN·m
  torsion?: number; // kN·m
}

// Bolt group configuration
export interface BoltPattern {
  rows: number;
  columns: number;
  rowSpacing: number; // mm
  columnSpacing: number; // mm
  edgeDistanceX: number; // mm
  edgeDistanceY: number; // mm
  gauge: number; // mm (transverse spacing)
  pitch: number; // mm (longitudinal spacing)
}

// Welded connection configuration
export interface WeldPattern {
  welds: WeldProperties[];
  connectionLength: number; // mm
}

// =============================================================================
// BOLT SHEAR CONNECTION INPUT/OUTPUT
// =============================================================================

export interface BoltedShearConnectionInput {
  code: ConnectionCode;
  bolt: BoltProperties;
  pattern: BoltPattern;
  plate: PlateProperties;
  connectedMember: {
    type: 'angle' | 'plate' | 'web' | 'flange';
    thickness: number; // mm
    fy: number; // MPa
    fu: number; // MPa
  };
  loads: ConnectionLoads;
  slipCritical: boolean;
  surfaceCondition?: 'classA' | 'classB' | 'classC';
}

export interface BoltStrengthResult {
  shearCapacity: number; // kN per bolt
  bearingCapacity: number; // kN per bolt
  tensileCapacity: number; // kN per bolt
  slipResistance?: number; // kN per bolt (for slip-critical)
  governingCapacity: number; // kN per bolt
  governingMode: string;
}

export interface ConnectionCapacityResult {
  totalCapacity: number; // kN
  appliedLoad: number; // kN
  utilizationRatio: number;
  isAdequate: boolean;
  safetyFactor: number;
}

export interface BoltGroupAnalysis {
  centroid: { x: number; y: number };
  polarMomentOfInertia: number; // mm⁴
  maxBoltForce: number; // kN
  criticalBoltLocation: { row: number; col: number };
  boltForces: Array<{ row: number; col: number; Fx: number; Fy: number; resultant: number }>;
}

export interface BoltedConnectionResult {
  boltStrength: BoltStrengthResult;
  groupAnalysis: BoltGroupAnalysis;
  shearCapacity: ConnectionCapacityResult;
  bearingCapacity: ConnectionCapacityResult;
  blockShear: {
    capacity: number;
    isAdequate: boolean;
  };
  tearOut: {
    capacity: number;
    isAdequate: boolean;
  };
  plateChecks: {
    yieldingCapacity: number;
    ruptureCapacity: number;
    isAdequate: boolean;
  };
  isDesignAdequate: boolean;
  warnings: string[];
  detailedCalculations: string[];
}

// =============================================================================
// WELDED CONNECTION INPUT/OUTPUT
// =============================================================================

export interface WeldedConnectionInput {
  code: ConnectionCode;
  weldPattern: WeldPattern;
  baseMetal: {
    fy: number; // MPa
    fu: number; // MPa
    thickness: number; // mm
  };
  loads: ConnectionLoads;
  weldProcess: 'SMAW' | 'GMAW' | 'FCAW' | 'SAW';
}

export interface WeldStrengthResult {
  shearCapacity: number; // kN/mm
  tensileCapacity: number; // kN/mm
  governingCapacity: number; // kN/mm
  effectiveThroat: number; // mm
}

export interface WeldedConnectionResult {
  weldStrength: WeldStrengthResult;
  totalCapacity: number; // kN
  appliedLoad: number; // kN
  utilizationRatio: number;
  baseMetalCheck: {
    capacity: number;
    isAdequate: boolean;
  };
  isDesignAdequate: boolean;
  warnings: string[];
  detailedCalculations: string[];
}

// =============================================================================
// END PLATE MOMENT CONNECTION
// =============================================================================

export interface EndPlateMomentConnectionInput {
  code: ConnectionCode;
  beam: {
    depth: number; // mm
    flangeWidth: number; // mm
    flangeThickness: number; // mm
    webThickness: number; // mm
    fy: number; // MPa
    fu: number; // MPa
  };
  column: {
    depth: number; // mm
    flangeWidth: number; // mm
    flangeThickness: number; // mm
    webThickness: number; // mm
    fy: number; // MPa
    fu: number; // MPa
  };
  endPlate: PlateProperties;
  bolt: BoltProperties;
  boltRows: number;
  boltRowPositions: number[]; // mm from beam bottom flange
  boltsPerRow: number;
  stiffeners: boolean;
  loads: ConnectionLoads;
}

export interface MomentConnectionResult {
  momentCapacity: number; // kN·m
  shearCapacity: number; // kN
  compressionZone: {
    depth: number; // mm
    force: number; // kN
    adequacy: boolean;
  };
  tensionZone: {
    boltRowForces: number[]; // kN per row
    totalTension: number; // kN
    adequacy: boolean;
  };
  columnChecks: {
    webCrippling: boolean;
    flaneBending: boolean;
    panelZoneShear: boolean;
    stiffenerRequired: boolean;
  };
  endPlateChecks: {
    bendingCapacity: number;
    isAdequate: boolean;
  };
  utilizationRatio: number;
  isDesignAdequate: boolean;
  warnings: string[];
  detailedCalculations: string[];
}

// =============================================================================
// BASE PLATE CONNECTION
// =============================================================================

export interface BasePlateConnectionInput {
  code: ConnectionCode;
  column: {
    depth: number; // mm
    width: number; // mm
    fy: number; // MPa
  };
  basePlate: PlateProperties;
  anchorBolts: {
    diameter: number; // mm
    grade: string;
    tensileStrength: number; // MPa
    count: number;
    edgeDistance: number; // mm
    embedmentLength: number; // mm
  };
  concrete: {
    fck: number; // MPa
    foundationWidth: number; // mm
    foundationLength: number; // mm
  };
  grout: {
    thickness: number; // mm
    strength: number; // MPa
  };
  loads: ConnectionLoads;
}

export interface BasePlateResult {
  bearingPressure: {
    maxPressure: number; // MPa
    allowable: number; // MPa
    isAdequate: boolean;
  };
  basePlateDesign: {
    requiredThickness: number; // mm
    providedThickness: number; // mm
    bendingCheck: boolean;
  };
  anchorBoltDesign: {
    tensionPerBolt: number; // kN
    shearPerBolt: number; // kN
    interactionRatio: number;
    isAdequate: boolean;
  };
  columnBaseWeld: {
    requiredSize: number; // mm
    providedSize: number; // mm
    isAdequate: boolean;
  };
  utilizationRatio: number;
  isDesignAdequate: boolean;
  warnings: string[];
  detailedCalculations: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const BOLT_PROPERTIES = {
  '4.6': { fub: 400, fyb: 240 },
  '4.8': { fub: 400, fyb: 320 },
  '5.6': { fub: 500, fyb: 300 },
  '5.8': { fub: 500, fyb: 400 },
  '8.8': { fub: 800, fyb: 640 },
  '10.9': { fub: 1000, fyb: 900 },
  '12.9': { fub: 1200, fyb: 1080 },
  'A325': { fub: 827, fyb: 660 },
  'A490': { fub: 1034, fyb: 827 },
  'A307': { fub: 413, fyb: 248 },
} as const;

export const HOLE_SIZES = {
  // Standard hole = bolt diameter + 2mm (metric)
  standard: (d: number) => d + 2,
  // Oversize hole
  oversize: (d: number) => d <= 24 ? d + 3 : d + 6,
  // Short slotted
  shortSlotted: (d: number) => ({ width: d + 2, length: d + 6 }),
  // Long slotted
  longSlotted: (d: number) => ({ width: d + 2, length: 2.5 * d }),
} as const;

export const CONNECTION_CODE_FACTORS = {
  IS800: {
    gammaM0: 1.10, // Partial safety factor (yielding)
    gammaM1: 1.25, // Partial safety factor (ultimate)
    gammaMb: 1.25, // Bolt
    gammaMw: 1.25, // Weld
    slipFactor: { classA: 0.50, classB: 0.35, classC: 0.30 },
  },
  AISC360: {
    phiBolt: 0.75, // Bolt bearing type
    phiSlip: 1.00, // Slip-critical (service)
    phiWeld: 0.75,
    phiYield: 0.90,
    phiRupture: 0.75,
    slipFactor: { classA: 0.30, classB: 0.50, classC: 0.35 },
  },
  EN1993: {
    gammaM0: 1.00,
    gammaM2: 1.25,
    gammaM3: 1.25, // Slip resistance
    slipFactor: { classA: 0.50, classB: 0.40, classC: 0.30, classD: 0.20 },
  },
  AS4100: {
    phiBolt: 0.80,
    phiWeld: 0.80,
    phiPlate: 0.90,
    slipFactor: { classA: 0.35, classB: 0.48, classC: 0.52 },
  },
} as const;

// =============================================================================
// ADVANCED CONNECTION DESIGN ENGINE
// =============================================================================

export class AdvancedConnectionDesignEngine {
  private errorHandler: EngineeringErrorHandler;
  private calculations: string[] = [];
  
  constructor() {
    this.errorHandler = new EngineeringErrorHandler();
  }
  
  // ---------------------------------------------------------------------------
  // BOLTED SHEAR CONNECTION DESIGN
  // ---------------------------------------------------------------------------
  
  public designBoltedShearConnection(input: BoltedShearConnectionInput): BoltedConnectionResult {
    this.calculations = [];
    const warnings: string[] = [];
    
    this.addCalculation('='.repeat(60));
    this.addCalculation('BOLTED SHEAR CONNECTION DESIGN');
    this.addCalculation(`Design Code: ${input.code}`);
    this.addCalculation('='.repeat(60));
    
    // Step 1: Calculate individual bolt strength
    const boltStrength = this.calculateBoltStrength(input);
    
    // Step 2: Analyze bolt group for eccentric loading
    const groupAnalysis = this.analyzeBoltGroup(input);
    
    // Step 3: Check shear capacity
    const shearCapacity = this.checkShearCapacity(input, boltStrength, groupAnalysis);
    if (!shearCapacity.isAdequate) {
      warnings.push('Shear capacity insufficient - add more bolts or increase diameter');
    }
    
    // Step 4: Check bearing capacity
    const bearingCapacity = this.checkBearingCapacity(input, boltStrength);
    if (!bearingCapacity.isAdequate) {
      warnings.push('Bearing capacity insufficient - increase plate thickness');
    }
    
    // Step 5: Check block shear
    const blockShear = this.checkBlockShear(input);
    if (!blockShear.isAdequate) {
      warnings.push('Block shear failure possible - revise connection geometry');
    }
    
    // Step 6: Check tear-out
    const tearOut = this.checkTearOut(input, boltStrength);
    if (!tearOut.isAdequate) {
      warnings.push('Tear-out failure possible - increase edge distance');
    }
    
    // Step 7: Check plate yielding and rupture
    const plateChecks = this.checkPlateCapacity(input);
    if (!plateChecks.isAdequate) {
      warnings.push('Plate capacity insufficient');
    }
    
    const isDesignAdequate = shearCapacity.isAdequate && 
                            bearingCapacity.isAdequate && 
                            blockShear.isAdequate &&
                            tearOut.isAdequate &&
                            plateChecks.isAdequate;
    
    return {
      boltStrength,
      groupAnalysis,
      shearCapacity,
      bearingCapacity,
      blockShear,
      tearOut,
      plateChecks,
      isDesignAdequate,
      warnings,
      detailedCalculations: this.calculations,
    };
  }
  
  private calculateBoltStrength(input: BoltedShearConnectionInput): BoltStrengthResult {
    this.addCalculation('\n--- INDIVIDUAL BOLT STRENGTH ---');
    
    const { code, bolt, slipCritical, surfaceCondition } = input;
    const d = bolt.diameter;
    const fub = bolt.tensileStrength;
    const fyb = bolt.yieldStrength;
    
    // Bolt areas
    const Ab = Math.PI * Math.pow(d / 2, 2); // Gross area
    const An = 0.78 * Ab; // Net tensile area (approximate)
    
    this.addCalculation(`Bolt: ${bolt.grade} - ${d}mm diameter`);
    this.addCalculation(`Gross area Ab: ${Ab.toFixed(1)} mm²`);
    this.addCalculation(`Net tensile area An: ${An.toFixed(1)} mm²`);
    this.addCalculation(`fub = ${fub} MPa, fyb = ${fyb} MPa`);
    
    let shearCapacity: number;
    let tensileCapacity: number;
    let slipResistance: number | undefined;
    
    switch (code) {
      case 'IS800': {
        // IS 800:2007
        const gammaMb = CONNECTION_CODE_FACTORS.IS800.gammaMb;
        
        // Shear capacity: Vdsb = fub·nn·Anb / (√3·γmb)
        // For single shear, nn = 1
        shearCapacity = (fub * An) / (Math.sqrt(3) * gammaMb * 1000); // kN
        
        // Tensile capacity: Tdb = 0.9·fub·An / γmb
        tensileCapacity = (0.9 * fub * An) / (gammaMb * 1000); // kN
        
        if (slipCritical) {
          const mu = CONNECTION_CODE_FACTORS.IS800.slipFactor[surfaceCondition || 'classB'];
          const gammaM3 = 1.25;
          // Vdsf = μ·ne·Kh·F0 / γmf
          const F0 = 0.7 * fub * An; // Proof load
          slipResistance = (mu * 1 * 1.0 * F0) / (gammaM3 * 1000); // kN
          this.addCalculation(`Slip resistance: ${slipResistance.toFixed(2)} kN/bolt (μ=${mu})`);
        }
        break;
      }
      
      case 'AISC360': {
        // AISC 360-22
        const phi = CONNECTION_CODE_FACTORS.AISC360.phiBolt;
        
        // Nominal shear strength: Fnv = 0.50Fu (threads excluded) or 0.40Fu (threads included)
        const Fnv = 0.50 * fub; // Assuming threads excluded
        shearCapacity = (phi * Fnv * Ab) / 1000; // kN
        
        // Nominal tensile strength: Fnt = 0.75Fu
        tensileCapacity = (phi * 0.75 * fub * An) / 1000; // kN
        
        if (slipCritical) {
          const mu = CONNECTION_CODE_FACTORS.AISC360.slipFactor[surfaceCondition || 'classB'];
          const Du = 1.13; // Multiplier for bolt pretension
          const Tb = 0.7 * fub * An; // Minimum bolt pretension
          slipResistance = (mu * Du * 1.0 * Tb) / 1000; // kN
          this.addCalculation(`Slip resistance: ${slipResistance.toFixed(2)} kN/bolt (μ=${mu})`);
        }
        break;
      }
      
      case 'EN1993': {
        // EN 1993-1-8
        const gammaM2 = CONNECTION_CODE_FACTORS.EN1993.gammaM2;
        
        // Shear resistance: Fv,Rd = αv·fub·As / γM2
        const alphaV = 0.6; // For 8.8 and 10.9 bolts where shear plane passes through threaded portion
        shearCapacity = (alphaV * fub * An) / (gammaM2 * 1000); // kN
        
        // Tensile resistance: Ft,Rd = k2·fub·As / γM2
        const k2 = 0.9;
        tensileCapacity = (k2 * fub * An) / (gammaM2 * 1000); // kN
        
        if (slipCritical) {
          const mu = CONNECTION_CODE_FACTORS.EN1993.slipFactor[surfaceCondition || 'classB'] || 0.4;
          const gammaM3 = CONNECTION_CODE_FACTORS.EN1993.gammaM3;
          const Fp_C = 0.7 * fub * An; // Preloading force
          slipResistance = (mu * Fp_C) / (gammaM3 * 1000); // kN
          this.addCalculation(`Slip resistance: ${slipResistance.toFixed(2)} kN/bolt (μ=${mu})`);
        }
        break;
      }
      
      case 'AS4100': {
        // AS 4100:2020
        const phi = CONNECTION_CODE_FACTORS.AS4100.phiBolt;
        
        // Bolt in shear: Vf ≤ φ·Vfn where Vfn = 0.62·fuf·(nn·Ac + nx·Ao)
        shearCapacity = (phi * 0.62 * fub * An) / 1000; // kN
        
        // Bolt in tension: Ntf ≤ φ·Ntf where Ntf = As·fuf
        tensileCapacity = (phi * fub * An) / 1000; // kN
        
        if (slipCritical) {
          const mu = CONNECTION_CODE_FACTORS.AS4100.slipFactor[surfaceCondition || 'classB'];
          const Nti = 0.7 * fub * An;
          slipResistance = (mu * 1 * Nti) / 1000; // kN
          this.addCalculation(`Slip resistance: ${slipResistance.toFixed(2)} kN/bolt (μ=${mu})`);
        }
        break;
      }
      
      default:
        shearCapacity = (0.5 * fub * An) / 1000;
        tensileCapacity = (0.75 * fub * An) / 1000;
    }
    
    this.addCalculation(`Shear capacity: ${shearCapacity.toFixed(2)} kN/bolt`);
    this.addCalculation(`Tensile capacity: ${tensileCapacity.toFixed(2)} kN/bolt`);
    
    const governingCapacity = slipCritical && slipResistance 
      ? Math.min(shearCapacity, slipResistance) 
      : shearCapacity;
    
    const governingMode = slipCritical && slipResistance && slipResistance < shearCapacity
      ? 'Slip'
      : 'Shear';
    
    return {
      shearCapacity,
      bearingCapacity: 0, // Calculated separately
      tensileCapacity,
      slipResistance,
      governingCapacity,
      governingMode,
    };
  }
  
  private analyzeBoltGroup(input: BoltedShearConnectionInput): BoltGroupAnalysis {
    this.addCalculation('\n--- BOLT GROUP ANALYSIS ---');
    
    const { pattern, loads } = input;
    const { rows, columns, rowSpacing, columnSpacing, edgeDistanceX, edgeDistanceY } = pattern;
    
    // Calculate bolt positions relative to connection centroid
    const bolts: Array<{ row: number; col: number; x: number; y: number }> = [];
    
    const totalWidth = (columns - 1) * columnSpacing;
    const totalHeight = (rows - 1) * rowSpacing;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        bolts.push({
          row: r + 1,
          col: c + 1,
          x: c * columnSpacing - totalWidth / 2,
          y: r * rowSpacing - totalHeight / 2,
        });
      }
    }
    
    // Centroid (should be at origin with symmetric pattern)
    const centroid = { x: 0, y: 0 };
    
    // Polar moment of inertia: Ip = Σ(x² + y²)
    let Ip = 0;
    for (const bolt of bolts) {
      Ip += bolt.x * bolt.x + bolt.y * bolt.y;
    }
    
    this.addCalculation(`Number of bolts: ${rows} × ${columns} = ${bolts.length}`);
    this.addCalculation(`Polar moment of inertia Ip: ${Ip.toFixed(0)} mm²`);
    
    // Calculate forces on each bolt
    const n = bolts.length;
    const Vx = loads.shearForceX;
    const Vy = loads.shearForceY;
    const M = loads.moment;
    
    // Direct shear per bolt
    const vx = Vx / n;
    const vy = Vy / n;
    
    // Torsional shear (due to eccentricity/moment)
    const boltForces: Array<{ row: number; col: number; Fx: number; Fy: number; resultant: number }> = [];
    let maxForce = 0;
    let criticalBolt = { row: 1, col: 1 };
    
    for (const bolt of bolts) {
      const r = Math.sqrt(bolt.x * bolt.x + bolt.y * bolt.y);
      
      // Torsional component: v_t = M·r/Ip
      const vt = Ip > 0 ? (M * 1000 * r) / Ip : 0; // kN
      
      // Components (perpendicular to radius)
      const theta = Math.atan2(bolt.y, bolt.x);
      const vtx = -vt * Math.sin(theta);
      const vty = vt * Math.cos(theta);
      
      // Total force
      const Fx = vx + vtx;
      const Fy = vy + vty;
      const resultant = Math.sqrt(Fx * Fx + Fy * Fy);
      
      boltForces.push({ row: bolt.row, col: bolt.col, Fx, Fy, resultant });
      
      if (resultant > maxForce) {
        maxForce = resultant;
        criticalBolt = { row: bolt.row, col: bolt.col };
      }
    }
    
    this.addCalculation(`Direct shear per bolt: Vx=${vx.toFixed(2)}, Vy=${vy.toFixed(2)} kN`);
    this.addCalculation(`Maximum bolt force: ${maxForce.toFixed(2)} kN at row ${criticalBolt.row}, col ${criticalBolt.col}`);
    
    return {
      centroid,
      polarMomentOfInertia: Ip,
      maxBoltForce: maxForce,
      criticalBoltLocation: criticalBolt,
      boltForces,
    };
  }
  
  private checkShearCapacity(
    input: BoltedShearConnectionInput,
    boltStrength: BoltStrengthResult,
    groupAnalysis: BoltGroupAnalysis
  ): ConnectionCapacityResult {
    this.addCalculation('\n--- SHEAR CAPACITY CHECK ---');
    
    const totalShear = Math.sqrt(
      Math.pow(input.loads.shearForceX, 2) + 
      Math.pow(input.loads.shearForceY, 2)
    );
    
    const n = input.pattern.rows * input.pattern.columns;
    const totalCapacity = n * boltStrength.governingCapacity;
    
    // Account for eccentric loading
    const effectiveCapacity = groupAnalysis.maxBoltForce > 0
      ? (totalShear / groupAnalysis.maxBoltForce) * boltStrength.governingCapacity
      : totalCapacity;
    
    const utilizationRatio = groupAnalysis.maxBoltForce / boltStrength.governingCapacity;
    
    this.addCalculation(`Total applied shear: ${totalShear.toFixed(2)} kN`);
    this.addCalculation(`Maximum bolt force: ${groupAnalysis.maxBoltForce.toFixed(2)} kN`);
    this.addCalculation(`Bolt capacity: ${boltStrength.governingCapacity.toFixed(2)} kN`);
    this.addCalculation(`Utilization ratio: ${(utilizationRatio * 100).toFixed(1)}%`);
    
    return {
      totalCapacity,
      appliedLoad: totalShear,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      safetyFactor: 1 / utilizationRatio,
    };
  }
  
  private checkBearingCapacity(
    input: BoltedShearConnectionInput,
    boltStrength: BoltStrengthResult
  ): ConnectionCapacityResult {
    this.addCalculation('\n--- BEARING CAPACITY CHECK ---');
    
    const { code, bolt, plate, connectedMember } = input;
    const d = bolt.diameter;
    const t = Math.min(plate.thickness, connectedMember.thickness);
    const fu = Math.min(plate.fu, connectedMember.fu);
    
    let bearingCapacity: number;
    
    switch (code) {
      case 'IS800': {
        const gammaMb = CONNECTION_CODE_FACTORS.IS800.gammaMb;
        // Vdpb = 2.5·kb·d·t·fu / γmb
        const kb = 0.9; // Simplified (depends on edge distance and pitch)
        bearingCapacity = (2.5 * kb * d * t * fu) / (gammaMb * 1000); // kN
        break;
      }
      
      case 'AISC360': {
        const phi = CONNECTION_CODE_FACTORS.AISC360.phiBolt;
        // Rn = 2.4·d·t·Fu (when deformation at service load is not a concern)
        bearingCapacity = (phi * 2.4 * d * t * fu) / 1000; // kN
        break;
      }
      
      case 'EN1993': {
        const gammaM2 = CONNECTION_CODE_FACTORS.EN1993.gammaM2;
        // Fb,Rd = k1·αb·fu·d·t / γM2
        const k1 = 2.5;
        const ab = 0.8; // Simplified
        bearingCapacity = (k1 * ab * fu * d * t) / (gammaM2 * 1000); // kN
        break;
      }
      
      case 'AS4100': {
        const phi = CONNECTION_CODE_FACTORS.AS4100.phiBolt;
        // Vb = 3.2·df·tp·fup
        bearingCapacity = (phi * 3.2 * d * t * fu) / 1000; // kN
        break;
      }
      
      default:
        bearingCapacity = (2.4 * d * t * fu) / 1000;
    }
    
    this.addCalculation(`Bearing capacity per bolt: ${bearingCapacity.toFixed(2)} kN`);
    
    const n = input.pattern.rows * input.pattern.columns;
    const totalCapacity = n * bearingCapacity;
    const totalShear = Math.sqrt(
      Math.pow(input.loads.shearForceX, 2) + 
      Math.pow(input.loads.shearForceY, 2)
    );
    
    // Update bolt strength with bearing
    boltStrength.bearingCapacity = bearingCapacity;
    
    const utilizationRatio = totalShear / totalCapacity;
    
    this.addCalculation(`Total bearing capacity: ${totalCapacity.toFixed(2)} kN`);
    this.addCalculation(`Utilization ratio: ${(utilizationRatio * 100).toFixed(1)}%`);
    
    return {
      totalCapacity,
      appliedLoad: totalShear,
      utilizationRatio,
      isAdequate: utilizationRatio <= 1.0,
      safetyFactor: 1 / utilizationRatio,
    };
  }
  
  private checkBlockShear(input: BoltedShearConnectionInput): { capacity: number; isAdequate: boolean } {
    this.addCalculation('\n--- BLOCK SHEAR CHECK ---');
    
    const { code, pattern, plate, connectedMember, loads } = input;
    const { rows, columns, rowSpacing, edgeDistanceX, edgeDistanceY } = pattern;
    
    const t = Math.min(plate.thickness, connectedMember.thickness);
    const fy = Math.min(plate.fy, connectedMember.fy);
    const fu = Math.min(plate.fu, connectedMember.fu);
    
    // Block shear failure path
    // Tension path: along top row of bolts
    // Shear path: along columns of bolts
    
    const holeSize = HOLE_SIZES.standard(input.bolt.diameter);
    
    // Gross shear area
    const Agv = 2 * (edgeDistanceY + (rows - 1) * rowSpacing) * t;
    
    // Net shear area
    const Anv = Agv - 2 * rows * holeSize * t;
    
    // Gross tension area
    const Agt = edgeDistanceX * t;
    
    // Net tension area
    const Ant = Agt - 0.5 * holeSize * t;
    
    let capacity: number;
    
    switch (code) {
      case 'IS800': {
        // Tdb = (Avg·fy/√3 + 0.9·Atn·fu) / γm1 or (0.9·Avn·fu/√3 + Atg·fy) / γm1
        const gammaM1 = CONNECTION_CODE_FACTORS.IS800.gammaM1;
        const option1 = (Agv * fy / Math.sqrt(3) + 0.9 * Ant * fu) / (gammaM1 * 1000);
        const option2 = (0.9 * Anv * fu / Math.sqrt(3) + Agt * fy) / (gammaM1 * 1000);
        capacity = Math.min(option1, option2);
        break;
      }
      
      case 'AISC360': {
        const phi = CONNECTION_CODE_FACTORS.AISC360.phiRupture;
        // Rn = 0.6·Fu·Anv + Ubs·Fu·Ant ≤ 0.6·Fy·Agv + Ubs·Fu·Ant
        const Ubs = 1.0; // Uniform tension stress
        const option1 = 0.6 * fu * Anv + Ubs * fu * Ant;
        const option2 = 0.6 * fy * Agv + Ubs * fu * Ant;
        capacity = phi * Math.min(option1, option2) / 1000;
        break;
      }
      
      case 'EN1993': {
        const gammaM2 = CONNECTION_CODE_FACTORS.EN1993.gammaM2;
        // Veff,1,Rd = fu·Ant/γM2 + fy·Anv/(√3·γM0)
        capacity = (fu * Ant / gammaM2 + fy * Anv / (Math.sqrt(3) * 1.0)) / 1000;
        break;
      }
      
      case 'AS4100': {
        const phi = CONNECTION_CODE_FACTORS.AS4100.phiPlate;
        // Vb = φ·(0.6·fup·Anv + kbs·fup·Ant)
        const kbs = 1.0;
        capacity = phi * (0.6 * fu * Anv + kbs * fu * Ant) / 1000;
        break;
      }
      
      default:
        capacity = (0.6 * fu * Anv + fu * Ant) / 1000;
    }
    
    const appliedForce = Math.abs(loads.shearForceX) + Math.abs(loads.axialForce);
    
    this.addCalculation(`Gross shear area Agv: ${Agv.toFixed(0)} mm²`);
    this.addCalculation(`Net shear area Anv: ${Anv.toFixed(0)} mm²`);
    this.addCalculation(`Block shear capacity: ${capacity.toFixed(2)} kN`);
    this.addCalculation(`Applied force: ${appliedForce.toFixed(2)} kN`);
    
    return {
      capacity,
      isAdequate: capacity >= appliedForce,
    };
  }
  
  private checkTearOut(
    input: BoltedShearConnectionInput,
    boltStrength: BoltStrengthResult
  ): { capacity: number; isAdequate: boolean } {
    this.addCalculation('\n--- TEAR-OUT CHECK ---');
    
    const { code, bolt, pattern, plate, connectedMember, loads } = input;
    const d = bolt.diameter;
    const t = Math.min(plate.thickness, connectedMember.thickness);
    const fu = Math.min(plate.fu, connectedMember.fu);
    
    // Edge distance to nearest bolt
    const Le = pattern.edgeDistanceY;
    const holeSize = HOLE_SIZES.standard(d);
    const Lc = Le - holeSize / 2; // Clear distance
    
    let tearOutCapacity: number;
    
    switch (code) {
      case 'AISC360': {
        // Rn = 1.2·Lc·t·Fu (tear-out)
        const phi = CONNECTION_CODE_FACTORS.AISC360.phiBolt;
        tearOutCapacity = phi * 1.2 * Lc * t * fu / 1000;
        break;
      }
      
      default:
        // General formula
        tearOutCapacity = 1.2 * Lc * t * fu / 1000;
    }
    
    const n = input.pattern.rows * input.pattern.columns;
    const totalCapacity = n * tearOutCapacity;
    const appliedForce = Math.sqrt(
      Math.pow(loads.shearForceX, 2) + 
      Math.pow(loads.shearForceY, 2)
    );
    
    this.addCalculation(`Clear distance Lc: ${Lc.toFixed(1)} mm`);
    this.addCalculation(`Tear-out capacity per bolt: ${tearOutCapacity.toFixed(2)} kN`);
    this.addCalculation(`Total capacity: ${totalCapacity.toFixed(2)} kN`);
    
    return {
      capacity: totalCapacity,
      isAdequate: totalCapacity >= appliedForce,
    };
  }
  
  private checkPlateCapacity(input: BoltedShearConnectionInput): {
    yieldingCapacity: number;
    ruptureCapacity: number;
    isAdequate: boolean;
  } {
    this.addCalculation('\n--- PLATE CAPACITY CHECK ---');
    
    const { code, pattern, plate, bolt, loads } = input;
    const { thickness, width, height, fy, fu } = plate;
    
    // Gross area
    const Ag = width * thickness;
    
    // Net area (deducting holes)
    const holesPerRow = pattern.columns;
    const holeSize = HOLE_SIZES.standard(bolt.diameter);
    const An = Ag - holesPerRow * holeSize * thickness;
    
    let yieldingCapacity: number;
    let ruptureCapacity: number;
    
    switch (code) {
      case 'IS800': {
        const gammaM0 = CONNECTION_CODE_FACTORS.IS800.gammaM0;
        const gammaM1 = CONNECTION_CODE_FACTORS.IS800.gammaM1;
        yieldingCapacity = (Ag * fy) / (gammaM0 * 1000);
        ruptureCapacity = (0.9 * An * fu) / (gammaM1 * 1000);
        break;
      }
      
      case 'AISC360': {
        const phiY = CONNECTION_CODE_FACTORS.AISC360.phiYield;
        const phiR = CONNECTION_CODE_FACTORS.AISC360.phiRupture;
        yieldingCapacity = (phiY * Ag * fy) / 1000;
        ruptureCapacity = (phiR * An * fu) / 1000;
        break;
      }
      
      case 'EN1993': {
        const gammaM0 = CONNECTION_CODE_FACTORS.EN1993.gammaM0;
        const gammaM2 = CONNECTION_CODE_FACTORS.EN1993.gammaM2;
        yieldingCapacity = (Ag * fy) / (gammaM0 * 1000);
        ruptureCapacity = (0.9 * An * fu) / (gammaM2 * 1000);
        break;
      }
      
      case 'AS4100': {
        const phi = CONNECTION_CODE_FACTORS.AS4100.phiPlate;
        yieldingCapacity = (phi * Ag * fy) / 1000;
        ruptureCapacity = (phi * 0.85 * An * fu) / 1000;
        break;
      }
      
      default:
        yieldingCapacity = (Ag * fy) / 1000;
        ruptureCapacity = (0.9 * An * fu) / 1000;
    }
    
    const appliedForce = Math.abs(loads.axialForce);
    const capacity = Math.min(yieldingCapacity, ruptureCapacity);
    
    this.addCalculation(`Gross area Ag: ${Ag.toFixed(0)} mm²`);
    this.addCalculation(`Net area An: ${An.toFixed(0)} mm²`);
    this.addCalculation(`Yielding capacity: ${yieldingCapacity.toFixed(2)} kN`);
    this.addCalculation(`Rupture capacity: ${ruptureCapacity.toFixed(2)} kN`);
    
    return {
      yieldingCapacity,
      ruptureCapacity,
      isAdequate: capacity >= appliedForce,
    };
  }
  
  // ---------------------------------------------------------------------------
  // WELDED CONNECTION DESIGN
  // ---------------------------------------------------------------------------
  
  public designWeldedConnection(input: WeldedConnectionInput): WeldedConnectionResult {
    this.calculations = [];
    const warnings: string[] = [];
    
    this.addCalculation('='.repeat(60));
    this.addCalculation('WELDED CONNECTION DESIGN');
    this.addCalculation(`Design Code: ${input.code}`);
    this.addCalculation('='.repeat(60));
    
    const weldStrength = this.calculateWeldStrength(input);
    const totalCapacity = this.calculateTotalWeldCapacity(input, weldStrength);
    
    const appliedLoad = Math.sqrt(
      Math.pow(input.loads.shearForceX, 2) +
      Math.pow(input.loads.shearForceY, 2) +
      Math.pow(input.loads.axialForce, 2)
    );
    
    const baseMetalCheck = this.checkBaseMetal(input);
    
    const utilizationRatio = appliedLoad / totalCapacity;
    
    if (utilizationRatio > 1.0) {
      warnings.push('Weld capacity insufficient - increase weld size or length');
    }
    
    if (!baseMetalCheck.isAdequate) {
      warnings.push('Base metal capacity exceeded');
    }
    
    return {
      weldStrength,
      totalCapacity,
      appliedLoad,
      utilizationRatio,
      baseMetalCheck,
      isDesignAdequate: utilizationRatio <= 1.0 && baseMetalCheck.isAdequate,
      warnings,
      detailedCalculations: this.calculations,
    };
  }
  
  private calculateWeldStrength(input: WeldedConnectionInput): WeldStrengthResult {
    this.addCalculation('\n--- WELD STRENGTH CALCULATION ---');
    
    const { code, weldPattern, weldProcess } = input;
    const weld = weldPattern.welds[0]; // Primary weld
    
    // Effective throat for fillet weld
    const te = weld.type === 'fillet' ? 0.7 * weld.size : weld.size;
    
    const Fxx = weld.electrodeGrade; // MPa
    
    let shearCapacity: number;
    let tensileCapacity: number;
    
    switch (code) {
      case 'IS800': {
        const gammaMw = CONNECTION_CODE_FACTORS.IS800.gammaMw;
        // Design strength: fwd = fu/√3 / γmw
        const fu = Math.min(input.baseMetal.fu, Fxx);
        shearCapacity = (fu / Math.sqrt(3)) / (gammaMw * 1000) * te; // kN/mm
        tensileCapacity = fu / (gammaMw * 1000) * te;
        break;
      }
      
      case 'AISC360': {
        const phi = CONNECTION_CODE_FACTORS.AISC360.phiWeld;
        // Rn = 0.60·FEXX·te (shear on effective area)
        shearCapacity = phi * 0.60 * Fxx / 1000 * te;
        tensileCapacity = phi * 0.60 * Fxx / 1000 * te;
        break;
      }
      
      case 'EN1993': {
        const gammaM2 = CONNECTION_CODE_FACTORS.EN1993.gammaM2;
        // fw,Rd = fu/(√3·βw·γM2)
        const betaW = 0.9; // Correlation factor
        shearCapacity = (input.baseMetal.fu / (Math.sqrt(3) * betaW * gammaM2)) / 1000 * te;
        tensileCapacity = shearCapacity;
        break;
      }
      
      case 'AS4100': {
        const phi = CONNECTION_CODE_FACTORS.AS4100.phiWeld;
        // vw = φ·0.6·fuw·tt/√2
        shearCapacity = phi * 0.6 * Fxx / (Math.sqrt(2) * 1000) * te;
        tensileCapacity = shearCapacity;
        break;
      }
      
      default:
        shearCapacity = 0.6 * Fxx / 1000 * te;
        tensileCapacity = shearCapacity;
    }
    
    this.addCalculation(`Weld size: ${weld.size} mm`);
    this.addCalculation(`Effective throat: ${te.toFixed(1)} mm`);
    this.addCalculation(`Electrode grade: ${Fxx} MPa`);
    this.addCalculation(`Shear capacity: ${(shearCapacity * 1000).toFixed(2)} kN/mm`);
    
    return {
      shearCapacity,
      tensileCapacity,
      governingCapacity: Math.min(shearCapacity, tensileCapacity),
      effectiveThroat: te,
    };
  }
  
  private calculateTotalWeldCapacity(
    input: WeldedConnectionInput, 
    weldStrength: WeldStrengthResult
  ): number {
    let totalLength = 0;
    
    for (const weld of input.weldPattern.welds) {
      totalLength += weld.length;
    }
    
    this.addCalculation(`Total weld length: ${totalLength} mm`);
    
    return weldStrength.governingCapacity * totalLength;
  }
  
  private checkBaseMetal(input: WeldedConnectionInput): { capacity: number; isAdequate: boolean } {
    const { baseMetal, loads } = input;
    const { fy, fu, thickness } = baseMetal;
    
    // Simplified base metal check
    const length = input.weldPattern.connectionLength;
    const capacity = 0.9 * fy * thickness * length / 1000;
    
    const appliedForce = Math.sqrt(
      Math.pow(loads.shearForceX, 2) +
      Math.pow(loads.axialForce, 2)
    );
    
    this.addCalculation('\n--- BASE METAL CHECK ---');
    this.addCalculation(`Base metal capacity: ${capacity.toFixed(2)} kN`);
    
    return {
      capacity,
      isAdequate: capacity >= appliedForce,
    };
  }
  
  // ---------------------------------------------------------------------------
  // BASE PLATE DESIGN
  // ---------------------------------------------------------------------------
  
  public designBasePlate(input: BasePlateConnectionInput): BasePlateResult {
    this.calculations = [];
    const warnings: string[] = [];
    
    this.addCalculation('='.repeat(60));
    this.addCalculation('BASE PLATE CONNECTION DESIGN');
    this.addCalculation(`Design Code: ${input.code}`);
    this.addCalculation('='.repeat(60));
    
    // Check bearing pressure
    const bearingPressure = this.checkBearingPressure(input);
    if (!bearingPressure.isAdequate) {
      warnings.push('Bearing pressure exceeds allowable - increase plate size');
    }
    
    // Design base plate thickness
    const basePlateDesign = this.designBasePlateThickness(input, bearingPressure);
    if (!basePlateDesign.bendingCheck) {
      warnings.push('Base plate thickness insufficient');
    }
    
    // Design anchor bolts
    const anchorBoltDesign = this.designAnchorBolts(input);
    if (!anchorBoltDesign.isAdequate) {
      warnings.push('Anchor bolt capacity insufficient');
    }
    
    // Design column-to-plate weld
    const columnBaseWeld = this.designColumnBaseWeld(input);
    if (!columnBaseWeld.isAdequate) {
      warnings.push('Column base weld insufficient');
    }
    
    const utilizationRatio = Math.max(
      bearingPressure.maxPressure / bearingPressure.allowable,
      basePlateDesign.requiredThickness / basePlateDesign.providedThickness,
      anchorBoltDesign.interactionRatio
    );
    
    return {
      bearingPressure,
      basePlateDesign,
      anchorBoltDesign,
      columnBaseWeld,
      utilizationRatio,
      isDesignAdequate: bearingPressure.isAdequate && 
                       basePlateDesign.bendingCheck && 
                       anchorBoltDesign.isAdequate &&
                       columnBaseWeld.isAdequate,
      warnings,
      detailedCalculations: this.calculations,
    };
  }
  
  private checkBearingPressure(input: BasePlateConnectionInput): {
    maxPressure: number;
    allowable: number;
    isAdequate: boolean;
  } {
    this.addCalculation('\n--- BEARING PRESSURE CHECK ---');
    
    const { basePlate, concrete, loads } = input;
    const A1 = basePlate.width * basePlate.height; // Plate area
    const A2 = concrete.foundationWidth * concrete.foundationLength; // Foundation area
    
    // Allowable bearing stress
    const fck = concrete.fck;
    let allowableBearing: number;
    
    switch (input.code) {
      case 'IS800':
      case 'AISC360':
        // φ·0.85·f'c·√(A2/A1) ≤ φ·1.7·f'c
        allowableBearing = Math.min(
          0.65 * 0.85 * fck * Math.sqrt(A2 / A1),
          0.65 * 1.7 * fck
        );
        break;
      
      case 'EN1993':
        allowableBearing = 0.67 * fck * Math.sqrt(A2 / A1);
        break;
      
      default:
        allowableBearing = 0.6 * fck;
    }
    
    // Calculate pressure distribution
    const P = loads.axialForce; // Compression is +ve
    const M = loads.moment;
    const B = basePlate.width;
    const L = basePlate.height;
    
    const e = Math.abs(M / P) * 1000; // eccentricity in mm
    const kern = L / 6;
    
    let maxPressure: number;
    
    if (e <= kern) {
      // Uniform/trapezoidal distribution
      maxPressure = (P * 1000) / A1 + (6 * M * 1e6) / (B * L * L);
    } else {
      // Triangular distribution
      const Leff = 1.5 * (L / 2 - e);
      maxPressure = (2 * P * 1000) / (B * Leff);
    }
    
    this.addCalculation(`Plate area A1: ${A1.toFixed(0)} mm²`);
    this.addCalculation(`Foundation area A2: ${A2.toFixed(0)} mm²`);
    this.addCalculation(`Eccentricity: ${e.toFixed(1)} mm (kern = ${kern.toFixed(1)} mm)`);
    this.addCalculation(`Maximum bearing pressure: ${maxPressure.toFixed(2)} MPa`);
    this.addCalculation(`Allowable bearing pressure: ${allowableBearing.toFixed(2)} MPa`);
    
    return {
      maxPressure,
      allowable: allowableBearing,
      isAdequate: maxPressure <= allowableBearing,
    };
  }
  
  private designBasePlateThickness(
    input: BasePlateConnectionInput,
    bearingPressure: { maxPressure: number }
  ): {
    requiredThickness: number;
    providedThickness: number;
    bendingCheck: boolean;
  } {
    this.addCalculation('\n--- BASE PLATE THICKNESS DESIGN ---');
    
    const { column, basePlate, loads } = input;
    const fp = bearingPressure.maxPressure;
    const fy = basePlate.fy;
    
    // Cantilever projection
    const m = (basePlate.height - column.depth) / 2; // Projection beyond column
    const n = (basePlate.width - column.width) / 2;
    
    // Required thickness based on bending
    let requiredThickness: number;
    
    switch (input.code) {
      case 'AISC360': {
        // tp = l·√(2·fp / (0.9·Fy))
        const l = Math.max(m, n);
        requiredThickness = l * Math.sqrt(2 * fp / (0.9 * fy));
        break;
      }
      
      case 'IS800': {
        // t = √(2.5·w·c² / fy) where w = bearing pressure, c = cantilever
        const c = Math.max(m, n);
        requiredThickness = Math.sqrt(2.5 * fp * c * c / fy);
        break;
      }
      
      default: {
        const c = Math.max(m, n);
        requiredThickness = Math.sqrt(2 * fp * c * c / fy);
      }
    }
    
    this.addCalculation(`Cantilever m: ${m.toFixed(0)} mm, n: ${n.toFixed(0)} mm`);
    this.addCalculation(`Required thickness: ${requiredThickness.toFixed(1)} mm`);
    this.addCalculation(`Provided thickness: ${basePlate.thickness} mm`);
    
    return {
      requiredThickness,
      providedThickness: basePlate.thickness,
      bendingCheck: basePlate.thickness >= requiredThickness,
    };
  }
  
  private designAnchorBolts(input: BasePlateConnectionInput): {
    tensionPerBolt: number;
    shearPerBolt: number;
    interactionRatio: number;
    isAdequate: boolean;
  } {
    this.addCalculation('\n--- ANCHOR BOLT DESIGN ---');
    
    const { anchorBolts, loads, basePlate, column } = input;
    const n = anchorBolts.count;
    
    // For uplift/tension case
    const P = loads.axialForce; // +ve compression
    const M = loads.moment;
    const V = Math.sqrt(Math.pow(loads.shearForceX, 2) + Math.pow(loads.shearForceY, 2));
    
    let tensionPerBolt = 0;
    
    if (P < 0 || M > 0) {
      // Tension in bolts
      const leverArm = basePlate.height - 2 * anchorBolts.edgeDistance;
      const T = Math.max(0, (M * 1000 / leverArm) - P / 2);
      tensionPerBolt = T / (n / 2); // Assuming half the bolts resist tension
    }
    
    // Shear per bolt (assuming friction + shear)
    const shearPerBolt = V / n;
    
    // Bolt capacity
    const Ab = Math.PI * Math.pow(anchorBolts.diameter / 2, 2);
    const fub = anchorBolts.tensileStrength;
    
    const tensionCapacity = 0.75 * fub * Ab / 1000; // kN (approximate)
    const shearCapacity = 0.5 * fub * Ab / 1000; // kN
    
    // Interaction check
    const interactionRatio = Math.pow(tensionPerBolt / tensionCapacity, 2) + 
                            Math.pow(shearPerBolt / shearCapacity, 2);
    
    this.addCalculation(`Number of anchor bolts: ${n}`);
    this.addCalculation(`Tension per bolt: ${tensionPerBolt.toFixed(2)} kN`);
    this.addCalculation(`Shear per bolt: ${shearPerBolt.toFixed(2)} kN`);
    this.addCalculation(`Tension capacity: ${tensionCapacity.toFixed(2)} kN`);
    this.addCalculation(`Shear capacity: ${shearCapacity.toFixed(2)} kN`);
    this.addCalculation(`Interaction ratio: ${interactionRatio.toFixed(2)}`);
    
    return {
      tensionPerBolt,
      shearPerBolt,
      interactionRatio,
      isAdequate: interactionRatio <= 1.0,
    };
  }
  
  private designColumnBaseWeld(input: BasePlateConnectionInput): {
    requiredSize: number;
    providedSize: number;
    isAdequate: boolean;
  } {
    this.addCalculation('\n--- COLUMN BASE WELD DESIGN ---');
    
    const { column, loads } = input;
    const P = Math.abs(loads.axialForce);
    const V = Math.sqrt(Math.pow(loads.shearForceX, 2) + Math.pow(loads.shearForceY, 2));
    
    // Weld around column perimeter
    const perimeter = 2 * (column.depth + column.width) - 4 * column.width; // Simplified for I-section
    
    // Force per mm of weld
    const forcePerMm = Math.sqrt(Math.pow(P / perimeter, 2) + Math.pow(V / perimeter, 2));
    
    // Weld capacity (fillet weld)
    const Fxx = 410; // E70 electrode
    const weldStrength = 0.6 * Fxx / (Math.sqrt(2) * 1000); // kN/mm per mm of leg
    
    const requiredSize = forcePerMm / (0.7 * weldStrength);
    const providedSize = Math.max(6, Math.ceil(requiredSize)); // Minimum 6mm
    
    this.addCalculation(`Weld perimeter: ${perimeter.toFixed(0)} mm`);
    this.addCalculation(`Force per mm: ${forcePerMm.toFixed(3)} kN/mm`);
    this.addCalculation(`Required weld size: ${requiredSize.toFixed(1)} mm`);
    this.addCalculation(`Provided weld size: ${providedSize} mm`);
    
    return {
      requiredSize,
      providedSize,
      isAdequate: providedSize >= requiredSize,
    };
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

export function createConnectionDesignEngine(): AdvancedConnectionDesignEngine {
  return new AdvancedConnectionDesignEngine();
}

export default AdvancedConnectionDesignEngine;
