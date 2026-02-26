/**
 * BeamLab Ultimate - Connection Design Module
 * Comprehensive steel and concrete connection design per international codes
 * 
 * Supported Connections:
 * - Bolted connections (bearing, slip-critical, moment)
 * - Welded connections (fillet, groove, CJP, PJP)
 * - Beam-column moment connections
 * - Brace connections (gusset plates)
 * - Base plates and anchor bolts
 * - Concrete corbels and brackets
 * - Shear walls connections
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type ConnectionCode = 'IS800' | 'AISC360' | 'EC3' | 'AS4100' | 'CSA_S16';
export type ConnectionType = 
  | 'bolted_shear' | 'bolted_moment' | 'bolted_tension'
  | 'welded_fillet' | 'welded_groove' | 'welded_moment'
  | 'base_plate' | 'gusset_plate' | 'splice'
  | 'corbel' | 'bracket' | 'beam_seat';

export interface ConnectionDesignInput {
  code: ConnectionCode;
  type: ConnectionType;
  forces: ConnectionForces;
  geometry: ConnectionGeometry;
  materials: ConnectionMaterials;
  bolts?: BoltConfiguration;
  welds?: WeldConfiguration;
}

export interface ConnectionForces {
  axial: number;      // kN (tension positive)
  shearMajor: number; // kN
  shearMinor: number; // kN
  momentMajor: number; // kN·m
  momentMinor: number; // kN·m
  torsion?: number;   // kN·m
}

export interface ConnectionGeometry {
  beamSection?: string;
  beamDepth?: number;
  beamWidth?: number;
  beamFlange?: number;
  beamWeb?: number;
  columnSection?: string;
  columnDepth?: number;
  columnWidth?: number;
  columnFlange?: number;
  columnWeb?: number;
  plateThickness?: number;
  plateWidth?: number;
  plateHeight?: number;
  gussetThickness?: number;
}

export interface ConnectionMaterials {
  beamGrade: string;
  columnGrade: string;
  plateGrade: string;
  beamFy: number;  // MPa
  beamFu: number;  // MPa
  columnFy: number;
  columnFu: number;
  plateFy: number;
  plateFu: number;
}

export interface BoltConfiguration {
  grade: BoltGrade;
  diameter: number; // mm
  rows: number;
  columnsPerRow: number;
  pitch: number; // mm
  gauge: number; // mm
  edgeDistance: number; // mm
  endDistance: number; // mm
  holeType: 'standard' | 'oversized' | 'slotted_short' | 'slotted_long';
  connectionClass: 'bearing' | 'slip_critical';
  slipFactor?: number;
}

export type BoltGrade = '4.6' | '4.8' | '5.6' | '5.8' | '8.8' | '10.9' | '12.9' | 'A325' | 'A490' | 'A307';

export interface WeldConfiguration {
  type: 'fillet' | 'groove' | 'CJP' | 'PJP';
  size: number; // mm (leg size for fillet, throat for groove)
  length: number; // mm
  electrode: WeldElectrode;
  position?: 'flat' | 'horizontal' | 'vertical' | 'overhead';
  pattern?: 'continuous' | 'intermittent';
  intermittentSpacing?: number;
}

export type WeldElectrode = 'E60' | 'E70' | 'E80' | 'E90' | 'E100' | 'E110';

export interface ConnectionDesignResult {
  status: 'PASS' | 'FAIL' | 'WARNING';
  utilizationRatio: number;
  capacities: ConnectionCapacities;
  checks: DesignCheck[];
  recommendations: string[];
  detailingRequirements: string[];
}

export interface ConnectionCapacities {
  tensionCapacity: number;
  shearCapacity: number;
  momentCapacity: number;
  bearingCapacity: number;
  blockShearCapacity?: number;
  pryingCapacity?: number;
}

export interface DesignCheck {
  name: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  reference: string;
}

// ============================================================================
// BOLT PROPERTIES DATABASE
// ============================================================================

interface BoltProperties {
  fyb: number;  // Yield strength MPa
  fub: number;  // Ultimate strength MPa
  tensileStressArea: (d: number) => number; // mm²
}

const BOLT_PROPERTIES: Record<BoltGrade, BoltProperties> = {
  '4.6': {
    fyb: 240,
    fub: 400,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '4.8': {
    fyb: 320,
    fub: 400,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '5.6': {
    fyb: 300,
    fub: 500,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '5.8': {
    fyb: 400,
    fub: 500,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '8.8': {
    fyb: 640,
    fub: 800,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '10.9': {
    fyb: 900,
    fub: 1000,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  '12.9': {
    fyb: 1080,
    fub: 1200,
    tensileStressArea: (d) => 0.7854 * Math.pow(d - 0.9382 * getPitch(d), 2),
  },
  'A325': {
    fyb: 660,
    fub: 830,
    tensileStressArea: (d) => getTensileArea(d),
  },
  'A490': {
    fyb: 940,
    fub: 1035,
    tensileStressArea: (d) => getTensileArea(d),
  },
  'A307': {
    fyb: 250,
    fub: 415,
    tensileStressArea: (d) => getTensileArea(d),
  },
};

function getPitch(d: number): number {
  const pitches: Record<number, number> = {
    12: 1.75, 16: 2.0, 20: 2.5, 22: 2.5, 24: 3.0, 27: 3.0, 30: 3.5, 36: 4.0,
  };
  return pitches[d] || d / 8;
}

function getTensileArea(d: number): number {
  const areas: Record<number, number> = {
    12: 84.3, 16: 157, 20: 245, 22: 303, 24: 353, 27: 459, 30: 561, 36: 817,
  };
  return areas[d] || 0.7854 * Math.pow(d * 0.85, 2);
}

// ============================================================================
// WELD PROPERTIES
// ============================================================================

interface WeldStrength {
  fexx: number; // Electrode tensile strength ksi/MPa
  fnw: number;  // Nominal weld strength
}

const WELD_ELECTRODES: Record<WeldElectrode, WeldStrength> = {
  'E60': { fexx: 415, fnw: 0.6 * 415 },
  'E70': { fexx: 485, fnw: 0.6 * 485 },
  'E80': { fexx: 550, fnw: 0.6 * 550 },
  'E90': { fexx: 620, fnw: 0.6 * 620 },
  'E100': { fexx: 690, fnw: 0.6 * 690 },
  'E110': { fexx: 760, fnw: 0.6 * 760 },
};

// ============================================================================
// CONNECTION DESIGN ENGINE
// ============================================================================

export class ConnectionDesignEngine {
  private code: ConnectionCode;
  private phiB: number = 0.75;  // Bolt resistance factor
  private phiW: number = 0.75;  // Weld resistance factor
  private phiY: number = 0.90;  // Yielding factor
  private phiR: number = 0.75;  // Rupture factor
  
  constructor(code: ConnectionCode = 'IS800') {
    this.code = code;
    this.setCodeFactors();
  }
  
  private setCodeFactors(): void {
    switch (this.code) {
      case 'IS800':
        this.phiB = 0.80;
        this.phiW = 0.80;
        this.phiY = 0.90;
        this.phiR = 0.90;
        break;
      case 'AISC360':
        this.phiB = 0.75;
        this.phiW = 0.75;
        this.phiY = 0.90;
        this.phiR = 0.75;
        break;
      case 'EC3':
        this.phiB = 1 / 1.25; // γM2
        this.phiW = 1 / 1.25;
        this.phiY = 1 / 1.0;  // γM0
        this.phiR = 1 / 1.25;
        break;
      case 'AS4100':
        this.phiB = 0.80;
        this.phiW = 0.80;
        this.phiY = 0.90;
        this.phiR = 0.90;
        break;
      case 'CSA_S16':
        this.phiB = 0.80;
        this.phiW = 0.67;
        this.phiY = 0.90;
        this.phiR = 0.75;
        break;
    }
  }
  
  /**
   * Design bolted shear connection
   */
  designBoltedShearConnection(input: ConnectionDesignInput): ConnectionDesignResult {
    const checks: DesignCheck[] = [];
    const recommendations: string[] = [];
    const detailing: string[] = [];
    
    if (!input.bolts) {
      return this.createFailResult('Bolt configuration required');
    }
    
    const bolts = input.bolts;
    const numBolts = bolts.rows * bolts.columnsPerRow;
    const boltProps = BOLT_PROPERTIES[bolts.grade];
    const Ab = Math.PI * Math.pow(bolts.diameter, 2) / 4;
    const As = boltProps.tensileStressArea(bolts.diameter);
    
    // 1. Bolt Shear Capacity
    const shearPlanes = 1; // Single shear assumed
    let Vn: number;
    
    if (bolts.connectionClass === 'slip_critical') {
      // Slip-critical connection
      const mu = bolts.slipFactor || 0.35;
      const Tb = this.getMinBoltTension(bolts.grade, bolts.diameter);
      const Du = 1.13; // Hole factor
      const hf = 1.0;  // Filler factor
      const ns = shearPlanes;
      Vn = mu * Du * hf * Tb * ns;
    } else {
      // Bearing-type connection
      const Fnv = 0.5 * boltProps.fub; // Shear strength
      Vn = Fnv * Ab * shearPlanes;
    }
    
    const phiVn = this.phiB * Vn * numBolts / 1000; // Convert to kN
    const shearDemand = Math.sqrt(Math.pow(input.forces.shearMajor, 2) + Math.pow(input.forces.shearMinor, 2));
    const shearRatio = shearDemand / phiVn;
    
    checks.push({
      name: 'Bolt Shear',
      demand: shearDemand,
      capacity: phiVn,
      ratio: shearRatio,
      status: shearRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bolt_shear'),
    });
    
    // 2. Bearing Capacity
    const t = input.geometry.plateThickness || 10;
    const Le = Math.min(bolts.endDistance, bolts.pitch - bolts.diameter / 2);
    const Lc = Le - bolts.diameter / 2;
    const Rn_bearing = Math.min(
      1.2 * Lc * t * input.materials.plateFu,
      2.4 * bolts.diameter * t * input.materials.plateFu
    ) / 1000;
    
    const bearingCapacity = this.phiR * Rn_bearing * numBolts;
    const bearingRatio = shearDemand / bearingCapacity;
    
    checks.push({
      name: 'Bearing',
      demand: shearDemand,
      capacity: bearingCapacity,
      ratio: bearingRatio,
      status: bearingRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bearing'),
    });
    
    // 3. Block Shear
    const Agv = 2 * (bolts.endDistance + (bolts.rows - 1) * bolts.pitch) * t;
    const Anv = Agv - (bolts.rows - 0.5) * (bolts.diameter + 2) * t * 2;
    const Ant = ((bolts.columnsPerRow - 1) * bolts.gauge - (bolts.columnsPerRow - 1) * (bolts.diameter + 2)) * t;
    const Ubs = 1.0;
    
    const Rn_block = Math.min(
      0.6 * input.materials.plateFu * Anv + Ubs * input.materials.plateFu * Ant,
      0.6 * input.materials.plateFy * Agv + Ubs * input.materials.plateFu * Ant
    ) / 1000;
    
    const blockShearCapacity = this.phiR * Rn_block;
    const blockRatio = shearDemand / blockShearCapacity;
    
    checks.push({
      name: 'Block Shear',
      demand: shearDemand,
      capacity: blockShearCapacity,
      ratio: blockRatio,
      status: blockRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('block_shear'),
    });
    
    // 4. Edge and End Distance Checks
    const minEdge = this.getMinEdgeDistance(bolts.diameter, bolts.holeType);
    const minEnd = this.getMinEndDistance(bolts.diameter, bolts.holeType);
    const minPitch = 2.5 * bolts.diameter;
    const maxPitch = Math.min(14 * t, 200);
    
    if (bolts.edgeDistance < minEdge) {
      checks.push({
        name: 'Edge Distance',
        demand: minEdge,
        capacity: bolts.edgeDistance,
        ratio: minEdge / bolts.edgeDistance,
        status: 'FAIL',
        reference: this.getCodeReference('edge_distance'),
      });
    }
    
    if (bolts.pitch < minPitch || bolts.pitch > maxPitch) {
      recommendations.push(`Adjust pitch: ${minPitch.toFixed(0)} ≤ pitch ≤ ${maxPitch.toFixed(0)} mm`);
    }
    
    // Detailing requirements
    detailing.push(`Bolt: ${bolts.grade} M${bolts.diameter}`);
    detailing.push(`Hole: ${bolts.holeType} (${bolts.diameter + 2}mm for standard)`);
    detailing.push(`Min edge distance: ${minEdge.toFixed(0)}mm`);
    detailing.push(`Min end distance: ${minEnd.toFixed(0)}mm`);
    detailing.push(`Pitch range: ${minPitch.toFixed(0)} - ${maxPitch.toFixed(0)}mm`);
    
    // Overall result
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      utilizationRatio: maxRatio,
      capacities: {
        tensionCapacity: 0,
        shearCapacity: phiVn,
        momentCapacity: 0,
        bearingCapacity,
        blockShearCapacity: blockShearCapacity,
      },
      checks,
      recommendations,
      detailingRequirements: detailing,
    };
  }
  
  /**
   * Design bolted moment connection
   */
  designBoltedMomentConnection(input: ConnectionDesignInput): ConnectionDesignResult {
    const checks: DesignCheck[] = [];
    const recommendations: string[] = [];
    const detailing: string[] = [];
    
    if (!input.bolts || !input.geometry.beamDepth) {
      return this.createFailResult('Bolt configuration and beam geometry required');
    }
    
    const bolts = input.bolts;
    const boltProps = BOLT_PROPERTIES[bolts.grade];
    const As = boltProps.tensileStressArea(bolts.diameter);
    const db = input.geometry.beamDepth;
    const bf = input.geometry.beamWidth || db / 2;
    const tf = input.geometry.beamFlange || 15;
    
    // Flange bolt group
    const nf = bolts.columnsPerRow; // Bolts per flange
    const d0 = db - tf; // Lever arm
    
    // 1. Moment Capacity from Flange Bolts
    const Fnt = 0.75 * boltProps.fub; // Nominal tensile strength
    const phiTn = this.phiB * Fnt * As * nf / 1000; // Tension capacity per flange
    const Mn = phiTn * d0 / 1000; // Moment capacity kN·m
    
    const momentRatio = Math.abs(input.forces.momentMajor) / Mn;
    
    checks.push({
      name: 'Flange Bolt Tension (Moment)',
      demand: Math.abs(input.forces.momentMajor),
      capacity: Mn,
      ratio: momentRatio,
      status: momentRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bolt_tension'),
    });
    
    // 2. Web Bolt Shear
    const nw = bolts.rows; // Web bolts
    const Fnv = 0.5 * boltProps.fub;
    const Ab = Math.PI * Math.pow(bolts.diameter, 2) / 4;
    const phiVn = this.phiB * Fnv * Ab * nw / 1000;
    
    const shearRatio = Math.abs(input.forces.shearMajor) / phiVn;
    
    checks.push({
      name: 'Web Bolt Shear',
      demand: Math.abs(input.forces.shearMajor),
      capacity: phiVn,
      ratio: shearRatio,
      status: shearRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bolt_shear'),
    });
    
    // 3. Combined Tension and Shear
    const fv = Math.abs(input.forces.shearMajor) * 1000 / (nw * Ab);
    const ft = Math.abs(input.forces.momentMajor) * 1000 / (nf * As * d0 / 1000);
    
    const Fnt_mod = 1.3 * Fnt - (Fnt / (this.phiB * Fnv)) * fv;
    const combinedRatio = ft / (this.phiB * Math.min(Fnt, Fnt_mod));
    
    checks.push({
      name: 'Combined Tension-Shear',
      demand: combinedRatio,
      capacity: 1.0,
      ratio: combinedRatio,
      status: combinedRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('combined'),
    });
    
    // 4. Prying Action Check
    const p = bolts.gauge;
    const g = bolts.gauge / 2;
    const b = g - bolts.diameter / 2 - tf / 2;
    const a_pry = Math.min(1.25 * b, bolts.edgeDistance);
    const d_prime = bolts.diameter + 2;
    const p_prime = p - d_prime;
    
    const delta = 1 - d_prime / p;
    const rho = b / a_pry;
    const beta = (1 / rho) * (As * boltProps.fub / (p * tf * input.materials.plateFy) - 1);
    
    let alpha_pry: number;
    if (beta >= 1) {
      alpha_pry = 1.0;
    } else {
      alpha_pry = Math.min(1 / delta * (beta / (1 - beta)), 1.0);
    }
    
    const tc = Math.sqrt(4 * As * boltProps.fub * b / (p * input.materials.plateFy));
    const pryingForce = phiTn * (1 + alpha_pry * delta);
    
    if (tf < tc) {
      recommendations.push(`Consider thicker end plate. Minimum tc = ${tc.toFixed(0)}mm for no prying`);
    }
    
    // Detailing
    detailing.push(`Flange bolts: ${nf} × ${bolts.grade} M${bolts.diameter}`);
    detailing.push(`Web bolts: ${nw} × ${bolts.grade} M${bolts.diameter}`);
    detailing.push(`End plate thickness: ${tf}mm minimum`);
    detailing.push(`Stiffeners required if column flange < ${(1.1 * tf).toFixed(0)}mm`);
    
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      utilizationRatio: maxRatio,
      capacities: {
        tensionCapacity: phiTn,
        shearCapacity: phiVn,
        momentCapacity: Mn,
        bearingCapacity: 0,
        pryingCapacity: pryingForce,
      },
      checks,
      recommendations,
      detailingRequirements: detailing,
    };
  }
  
  /**
   * Design welded connection
   */
  designWeldedConnection(input: ConnectionDesignInput): ConnectionDesignResult {
    const checks: DesignCheck[] = [];
    const recommendations: string[] = [];
    const detailing: string[] = [];
    
    if (!input.welds) {
      return this.createFailResult('Weld configuration required');
    }
    
    const weld = input.welds;
    const electrode = WELD_ELECTRODES[weld.electrode];
    
    // Effective throat for fillet weld
    const te = weld.type === 'fillet' ? weld.size * 0.707 : weld.size;
    const Lw = weld.length;
    const Aw = te * Lw; // Effective weld area
    
    // 1. Weld Shear Capacity
    const Fnw = 0.6 * electrode.fexx;
    const phiRn = this.phiW * Fnw * Aw / 1000; // kN
    
    // Base metal check
    const Abm = input.geometry.plateThickness! * Lw;
    const Fbm = 0.6 * input.materials.plateFy;
    const phiRn_bm = this.phiY * Fbm * Abm / 1000;
    
    const weldCapacity = Math.min(phiRn, phiRn_bm);
    const shearDemand = Math.sqrt(Math.pow(input.forces.shearMajor, 2) + Math.pow(input.forces.shearMinor, 2));
    const weldRatio = shearDemand / weldCapacity;
    
    checks.push({
      name: 'Weld Shear',
      demand: shearDemand,
      capacity: weldCapacity,
      ratio: weldRatio,
      status: weldRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('weld_shear'),
    });
    
    // 2. Weld Length Check
    const minLength = Math.max(4 * weld.size, 40);
    if (Lw < minLength) {
      checks.push({
        name: 'Minimum Weld Length',
        demand: minLength,
        capacity: Lw,
        ratio: minLength / Lw,
        status: 'FAIL',
        reference: this.getCodeReference('weld_length'),
      });
    }
    
    // 3. Maximum Weld Size Check
    const maxSize = input.geometry.plateThickness! - 2;
    if (weld.size > maxSize) {
      recommendations.push(`Reduce weld size to ≤ ${maxSize}mm (plate thickness - 2mm)`);
    }
    
    // 4. Directional Strength Enhancement
    if (weld.type === 'fillet') {
      // Transverse welds are 50% stronger than longitudinal
      // For conservative design, not applied here
      detailing.push('Note: Transverse fillet welds have 1.5× strength per AISC');
    }
    
    // 5. Intermittent weld check
    if (weld.pattern === 'intermittent' && weld.intermittentSpacing) {
      const maxSpacing = Math.min(16 * input.geometry.plateThickness!, 200);
      if (weld.intermittentSpacing > maxSpacing) {
        recommendations.push(`Reduce intermittent spacing to ≤ ${maxSpacing}mm`);
      }
    }
    
    // Detailing
    detailing.push(`Weld: ${weld.type} ${weld.size}mm × ${Lw}mm`);
    detailing.push(`Electrode: ${weld.electrode} (FEXX = ${electrode.fexx} MPa)`);
    detailing.push(`Effective throat: ${te.toFixed(1)}mm`);
    detailing.push(`Min weld length: ${minLength}mm`);
    detailing.push(`Max weld size: ${maxSize}mm`);
    
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      utilizationRatio: maxRatio,
      capacities: {
        tensionCapacity: phiRn,
        shearCapacity: weldCapacity,
        momentCapacity: 0,
        bearingCapacity: 0,
      },
      checks,
      recommendations,
      detailingRequirements: detailing,
    };
  }
  
  /**
   * Design base plate connection
   */
  designBasePlate(input: ConnectionDesignInput & {
    concrete: { fc: number; depth: number };
    anchorBolts: { diameter: number; embedment: number; grade: BoltGrade; rows: number; columns: number; edgeX: number; edgeY: number };
  }): ConnectionDesignResult {
    const checks: DesignCheck[] = [];
    const recommendations: string[] = [];
    const detailing: string[] = [];
    
    const { concrete, anchorBolts } = input;
    const N = input.geometry.plateHeight!;  // Plate length
    const B = input.geometry.plateWidth!;   // Plate width
    const tp = input.geometry.plateThickness!;
    const P = input.forces.axial;
    const M = input.forces.momentMajor;
    const V = input.forces.shearMajor;
    
    // 1. Bearing Pressure Check
    const A1 = N * B; // Plate area
    const A2 = Math.min(4 * A1, Math.pow(2 * concrete.depth, 2)); // Supported area
    const fp_max = 0.85 * concrete.fc * Math.sqrt(A2 / A1);
    
    // For axial + moment
    const e = Math.abs(M / P) * 1000; // Eccentricity mm
    const fp = P * 1000 / A1 + 6 * M * 1e6 / (B * N * N);
    
    const bearingRatio = fp / fp_max;
    
    checks.push({
      name: 'Concrete Bearing',
      demand: fp,
      capacity: fp_max,
      ratio: bearingRatio,
      status: bearingRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('bearing'),
    });
    
    // 2. Base Plate Thickness Check (Yield Line)
    const m = (N - 0.95 * input.geometry.columnDepth!) / 2;
    const n = (B - 0.8 * input.geometry.columnWidth!) / 2;
    const lambda_n = Math.min(m, n);
    
    const tp_req = lambda_n * Math.sqrt(2 * fp / (0.9 * input.materials.plateFy));
    const thicknessRatio = tp_req / tp;
    
    checks.push({
      name: 'Plate Thickness',
      demand: tp_req,
      capacity: tp,
      ratio: thicknessRatio,
      status: thicknessRatio <= 1.0 ? 'PASS' : 'FAIL',
      reference: this.getCodeReference('plate_bending'),
    });
    
    // 3. Anchor Bolt Tension (if moment causes uplift)
    if (e > N / 6) {
      const nBolts = anchorBolts.rows * anchorBolts.columns / 2; // Tension side
      const boltProps = BOLT_PROPERTIES[anchorBolts.grade];
      const As = boltProps.tensileStressArea(anchorBolts.diameter);
      
      // Simplified tension calculation
      const Tu = (M * 1000 / (0.85 * N) - P) / nBolts; // kN per bolt
      const phiTn = this.phiB * 0.75 * boltProps.fub * As / 1000;
      
      const anchorRatio = Tu / phiTn;
      
      checks.push({
        name: 'Anchor Bolt Tension',
        demand: Tu,
        capacity: phiTn,
        ratio: anchorRatio,
        status: anchorRatio <= 1.0 ? 'PASS' : 'FAIL',
        reference: this.getCodeReference('bolt_tension'),
      });
      
      // 4. Anchor Bolt Pullout
      const Np = 8 * concrete.fc * Math.PI * anchorBolts.diameter * anchorBolts.embedment / 1000;
      const pulloutRatio = Tu / Np;
      
      checks.push({
        name: 'Anchor Pullout',
        demand: Tu,
        capacity: Np,
        ratio: pulloutRatio,
        status: pulloutRatio <= 1.0 ? 'PASS' : 'FAIL',
        reference: this.getCodeReference('anchor_pullout'),
      });
    }
    
    // 5. Shear Transfer
    const mu = 0.4; // Steel on grout
    const Nuc = Math.abs(P); // Compression
    const Vr_friction = mu * Nuc;
    
    if (V > Vr_friction) {
      // Need shear lugs or anchor bolt shear
      const nBolts = anchorBolts.rows * anchorBolts.columns;
      const boltProps = BOLT_PROPERTIES[anchorBolts.grade];
      const Ab = Math.PI * Math.pow(anchorBolts.diameter, 2) / 4;
      const Vr_bolt = this.phiB * 0.5 * boltProps.fub * Ab * nBolts / 1000;
      
      const shearRatio = V / (Vr_friction + Vr_bolt);
      
      checks.push({
        name: 'Shear Transfer',
        demand: V,
        capacity: Vr_friction + Vr_bolt,
        ratio: shearRatio,
        status: shearRatio <= 1.0 ? 'PASS' : 'FAIL',
        reference: this.getCodeReference('shear_transfer'),
      });
    }
    
    // Detailing
    detailing.push(`Base plate: ${N} × ${B} × ${tp}mm`);
    detailing.push(`Anchor bolts: ${anchorBolts.rows}×${anchorBolts.columns} ${anchorBolts.grade} M${anchorBolts.diameter}`);
    detailing.push(`Embedment: ${anchorBolts.embedment}mm`);
    detailing.push(`Grout thickness: 25-50mm recommended`);
    detailing.push(`Concrete strength: fc' = ${concrete.fc} MPa`);
    
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      utilizationRatio: maxRatio,
      capacities: {
        tensionCapacity: 0,
        shearCapacity: 0,
        momentCapacity: 0,
        bearingCapacity: fp_max * A1 / 1000,
      },
      checks,
      recommendations,
      detailingRequirements: detailing,
    };
  }
  
  /**
   * Design gusset plate connection
   */
  designGussetPlate(input: ConnectionDesignInput & {
    braceForce: number;
    braceAngle: number;
    whitmoreWidth?: number;
  }): ConnectionDesignResult {
    const checks: DesignCheck[] = [];
    const recommendations: string[] = [];
    const detailing: string[] = [];
    
    const { braceForce, braceAngle } = input;
    const tg = input.geometry.gussetThickness || 12;
    const Fy = input.materials.plateFy;
    const Fu = input.materials.plateFu;
    
    // Whitmore section width
    const Lw = input.whitmoreWidth || 
      (input.welds ? 2 * input.welds.length * Math.tan(30 * Math.PI / 180) + input.geometry.beamWidth! : 200);
    
    // 1. Whitmore Section Yielding (Tension)
    const Ag = Lw * tg;
    const phiPn_yield = this.phiY * Fy * Ag / 1000;
    
    if (braceForce > 0) {
      const tensionRatio = braceForce / phiPn_yield;
      checks.push({
        name: 'Whitmore Yielding',
        demand: braceForce,
        capacity: phiPn_yield,
        ratio: tensionRatio,
        status: tensionRatio <= 1.0 ? 'PASS' : 'FAIL',
        reference: this.getCodeReference('gusset_yield'),
      });
    }
    
    // 2. Gusset Buckling (Compression)
    if (braceForce < 0) {
      // Average of Thornton lengths
      const L1 = 100; // Assumed - would need actual geometry
      const L2 = 150;
      const L3 = 200;
      const Lavg = (L1 + L2 + L3) / 3;
      
      const r = tg / Math.sqrt(12); // Radius of gyration
      const KL_r = 0.65 * Lavg / r; // K=0.65 for fixed-fixed
      
      const Fe = Math.PI * Math.PI * 200000 / (KL_r * KL_r);
      let Fcr: number;
      
      if (KL_r <= 4.71 * Math.sqrt(200000 / Fy)) {
        Fcr = Fy * Math.pow(0.658, Fy / Fe);
      } else {
        Fcr = 0.877 * Fe;
      }
      
      const phiPn_buckle = this.phiY * Fcr * Ag / 1000;
      const bucklRatio = Math.abs(braceForce) / phiPn_buckle;
      
      checks.push({
        name: 'Gusset Buckling',
        demand: Math.abs(braceForce),
        capacity: phiPn_buckle,
        ratio: bucklRatio,
        status: bucklRatio <= 1.0 ? 'PASS' : 'FAIL',
        reference: this.getCodeReference('gusset_buckle'),
      });
    }
    
    // 3. Edge Buckling Check
    const c = 50; // Free edge length assumed
    const beta = c / tg;
    const maxBeta = 0.75 * Math.sqrt(200000 / Fy);
    
    if (beta > maxBeta) {
      recommendations.push(`Add stiffener or increase gusset thickness (β = ${beta.toFixed(1)} > ${maxBeta.toFixed(1)})`);
    }
    
    // 4. Interface Forces (UFM)
    const alpha = braceAngle * Math.PI / 180;
    const Huc = braceForce * Math.cos(alpha);
    const Vuc = braceForce * Math.sin(alpha);
    
    detailing.push(`Gusset plate: ${tg}mm thick`);
    detailing.push(`Whitmore width: ${Lw.toFixed(0)}mm`);
    detailing.push(`Horizontal force: ${Huc.toFixed(1)} kN`);
    detailing.push(`Vertical force: ${Vuc.toFixed(1)} kN`);
    detailing.push(`2t offset from work point recommended`);
    
    const maxRatio = Math.max(...checks.map(c => c.ratio));
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      utilizationRatio: maxRatio,
      capacities: {
        tensionCapacity: phiPn_yield,
        shearCapacity: 0,
        momentCapacity: 0,
        bearingCapacity: 0,
      },
      checks,
      recommendations,
      detailingRequirements: detailing,
    };
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private createFailResult(message: string): ConnectionDesignResult {
    return {
      status: 'FAIL',
      utilizationRatio: 999,
      capacities: { tensionCapacity: 0, shearCapacity: 0, momentCapacity: 0, bearingCapacity: 0 },
      checks: [],
      recommendations: [message],
      detailingRequirements: [],
    };
  }
  
  private getMinBoltTension(grade: BoltGrade, diameter: number): number {
    const As = BOLT_PROPERTIES[grade].tensileStressArea(diameter);
    const fub = BOLT_PROPERTIES[grade].fub;
    return 0.7 * fub * As / 1000; // kN
  }
  
  private getMinEdgeDistance(diameter: number, holeType: string): number {
    const d0 = diameter + 2; // Standard hole
    switch (this.code) {
      case 'AISC360':
        return holeType === 'standard' ? 1.25 * d0 : 1.5 * d0;
      case 'IS800':
        return 1.5 * d0;
      case 'EC3':
        return 1.2 * d0;
      default:
        return 1.5 * d0;
    }
  }
  
  private getMinEndDistance(diameter: number, holeType: string): number {
    const d0 = diameter + 2;
    switch (this.code) {
      case 'AISC360':
        return holeType === 'standard' ? 1.25 * d0 : 1.5 * d0;
      case 'IS800':
        return 1.5 * d0;
      case 'EC3':
        return 1.2 * d0;
      default:
        return 1.5 * d0;
    }
  }
  
  private getCodeReference(checkType: string): string {
    const refs: Record<ConnectionCode, Record<string, string>> = {
      IS800: {
        bolt_shear: 'IS 800:2007 Cl. 10.3.3',
        bolt_tension: 'IS 800:2007 Cl. 10.3.5',
        bearing: 'IS 800:2007 Cl. 10.3.4',
        block_shear: 'IS 800:2007 Cl. 6.4',
        combined: 'IS 800:2007 Cl. 10.3.6',
        weld_shear: 'IS 800:2007 Cl. 10.5.7',
        weld_length: 'IS 800:2007 Cl. 10.5.4',
        edge_distance: 'IS 800:2007 Cl. 10.2.4',
        gusset_yield: 'IS 800:2007 Cl. 6.2',
        gusset_buckle: 'IS 800:2007 Cl. 7.1',
        plate_bending: 'IS 800:2007 Cl. 8.2',
        anchor_pullout: 'IS 800:2007 Annex G',
        shear_transfer: 'IS 800:2007 Cl. 10.4',
      },
      AISC360: {
        bolt_shear: 'AISC 360-22 Section J3.6',
        bolt_tension: 'AISC 360-22 Section J3.6',
        bearing: 'AISC 360-22 Section J3.10',
        block_shear: 'AISC 360-22 Section J4.3',
        combined: 'AISC 360-22 Section J3.7',
        weld_shear: 'AISC 360-22 Section J2.4',
        weld_length: 'AISC 360-22 Section J2.2b',
        edge_distance: 'AISC 360-22 Section J3.4',
        gusset_yield: 'AISC 360-22 Section J4.1',
        gusset_buckle: 'AISC 360-22 Section J4.4',
        plate_bending: 'AISC Design Guide 1',
        anchor_pullout: 'ACI 318-19 Chapter 17',
        shear_transfer: 'AISC Design Guide 1',
      },
      EC3: {
        bolt_shear: 'EN 1993-1-8 Table 3.4',
        bolt_tension: 'EN 1993-1-8 Table 3.4',
        bearing: 'EN 1993-1-8 Table 3.4',
        block_shear: 'EN 1993-1-8 Cl. 3.10.2',
        combined: 'EN 1993-1-8 Table 3.4',
        weld_shear: 'EN 1993-1-8 Cl. 4.5.3',
        weld_length: 'EN 1993-1-8 Cl. 4.5.1',
        edge_distance: 'EN 1993-1-8 Table 3.3',
        gusset_yield: 'EN 1993-1-1 Cl. 6.2.3',
        gusset_buckle: 'EN 1993-1-1 Cl. 6.3.1',
        plate_bending: 'EN 1993-1-8 Cl. 6.2.6',
        anchor_pullout: 'EN 1992-4',
        shear_transfer: 'EN 1993-1-8 Cl. 6.2.2',
      },
      AS4100: {
        bolt_shear: 'AS 4100 Cl. 9.3.2',
        bolt_tension: 'AS 4100 Cl. 9.3.2',
        bearing: 'AS 4100 Cl. 9.3.2.4',
        block_shear: 'AS 4100 Cl. 9.1.9',
        combined: 'AS 4100 Cl. 9.3.2.3',
        weld_shear: 'AS 4100 Cl. 9.7.3',
        weld_length: 'AS 4100 Cl. 9.7.1',
        edge_distance: 'AS 4100 Cl. 9.6.2',
        gusset_yield: 'AS 4100 Cl. 7.2',
        gusset_buckle: 'AS 4100 Cl. 6.3',
        plate_bending: 'AS 4100 Cl. 5.2',
        anchor_pullout: 'AS 4100 Cl. 15',
        shear_transfer: 'AS 4100 Cl. 9.4',
      },
      CSA_S16: {
        bolt_shear: 'CSA S16 Cl. 13.12',
        bolt_tension: 'CSA S16 Cl. 13.12',
        bearing: 'CSA S16 Cl. 13.12.1',
        block_shear: 'CSA S16 Cl. 13.11',
        combined: 'CSA S16 Cl. 13.12.1.3',
        weld_shear: 'CSA S16 Cl. 13.13.2',
        weld_length: 'CSA S16 Cl. 13.13.1',
        edge_distance: 'CSA S16 Cl. 22.3',
        gusset_yield: 'CSA S16 Cl. 13.2',
        gusset_buckle: 'CSA S16 Cl. 13.3',
        plate_bending: 'CSA S16 Annex M',
        anchor_pullout: 'CSA A23.3',
        shear_transfer: 'CSA S16 Cl. 25.3',
      },
    };
    
    return refs[this.code]?.[checkType] || `${this.code} - ${checkType}`;
  }
}

// ============================================================================
// FACTORY AND UTILITY FUNCTIONS
// ============================================================================

export function createConnectionEngine(code: ConnectionCode = 'IS800'): ConnectionDesignEngine {
  return new ConnectionDesignEngine(code);
}

export function getStandardBoltSizes(): number[] {
  return [12, 16, 20, 22, 24, 27, 30, 36];
}

export function getStandardWeldSizes(): number[] {
  return [3, 4, 5, 6, 8, 10, 12, 16];
}

export function recommendBoltPattern(
  shear: number,
  moment: number,
  boltGrade: BoltGrade,
  boltDiameter: number
): { rows: number; columns: number; pitch: number; gauge: number } {
  const boltProps = BOLT_PROPERTIES[boltGrade];
  const As = boltProps.tensileStressArea(boltDiameter);
  const Vn = 0.5 * boltProps.fub * Math.PI * boltDiameter * boltDiameter / 4 / 1000;
  
  // Estimate required bolts for shear
  const nShear = Math.ceil(shear / (0.75 * Vn));
  
  // Estimate for moment (simplified)
  const nMoment = moment > 0 ? Math.ceil(moment / (0.75 * boltProps.fub * As * 0.3 / 1000)) : 0;
  
  const nTotal = Math.max(nShear, nMoment, 2);
  
  // Arrange in pattern
  const columns = Math.min(Math.ceil(Math.sqrt(nTotal)), 4);
  const rows = Math.ceil(nTotal / columns);
  
  return {
    rows,
    columns,
    pitch: Math.max(2.5 * boltDiameter, 65),
    gauge: Math.max(2.5 * boltDiameter, 65),
  };
}

// Default export
export default ConnectionDesignEngine;
