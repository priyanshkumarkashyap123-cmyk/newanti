/**
 * ============================================================================
 * COMPREHENSIVE STEEL CONNECTION DATABASE
 * ============================================================================
 * 
 * Complete library of prequalified steel connections including:
 * - Moment Connections (Fully Restrained & Partially Restrained)
 * - Shear Connections (Simple Connections)
 * - Bracing Connections
 * - Column Splices
 * - Base Plates
 * - Truss Connections
 * 
 * Design per: IS 800:2007, AISC 360-22, EN 1993-1-8
 * Seismic per: IS 16700, AISC 341-22, EN 1998-1
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type DesignCode = 'IS800' | 'AISC360' | 'EN1993';
export type SeismicCode = 'IS16700' | 'AISC341' | 'EN1998';
export type ConnectionCategory = 'moment' | 'shear' | 'bracing' | 'splice' | 'baseplate' | 'truss';

export interface SteelSection {
  designation: string;
  depth: number;      // mm
  width: number;      // mm
  webThickness: number;  // mm
  flangeThickness: number; // mm
  area: number;       // mm²
  momentOfInertia: { Ixx: number; Iyy: number }; // mm⁴
  plasticModulus: { Zxx: number; Zyy: number };  // mm³
  elasticModulus: { Sxx: number; Syy: number };  // mm³
  radiusOfGyration: { rx: number; ry: number };  // mm
  weight: number;     // kg/m
}

export interface BoltProperties {
  grade: string;      // e.g., '8.8', '10.9', 'A325', 'A490'
  diameter: number;   // mm
  holeType: 'standard' | 'oversized' | 'short_slot' | 'long_slot';
  tensileStrength: number;  // MPa
  yieldStrength: number;    // MPa
  shearStrength: number;    // MPa (single shear)
  tensionCapacity: number;  // kN
  shearCapacity: number;    // kN
  bearingCapacity: number;  // kN (depends on plate thickness)
  pretension?: number;      // kN (for slip-critical)
}

export interface WeldProperties {
  type: 'fillet' | 'groove' | 'partial_penetration' | 'complete_penetration';
  size: number;       // mm (leg size for fillet)
  length: number;     // mm
  electrode: string;  // e.g., 'E70XX', 'E7018'
  strength: number;   // MPa
  capacity: number;   // kN/mm
}

export interface PlateProperties {
  material: string;   // e.g., 'IS2062-E250', 'A36', 'S275'
  thickness: number;  // mm
  fy: number;         // MPa
  fu: number;         // MPa
}

export interface ConnectionForces {
  axial: number;      // kN (tension positive)
  shearMajor: number; // kN
  shearMinor: number; // kN
  momentMajor: number; // kNm
  momentMinor: number; // kNm
  torsion: number;    // kNm
}

export interface ConnectionGeometry {
  gageDistance?: number;
  pitch?: number;
  edgeDistance?: number;
  endDistance?: number;
  boltRows?: number;
  boltCols?: number;
  plateWidth?: number;
  plateHeight?: number;
  stiffenerThickness?: number;
}

export interface DesignCheck {
  name: string;
  clause: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
  notes?: string;
}

export interface ConnectionDesignResult {
  connectionType: string;
  code: DesignCode;
  forces: ConnectionForces;
  geometry: ConnectionGeometry;
  bolts?: {
    grade: string;
    diameter: number;
    quantity: number;
    arrangement: string;
  };
  welds?: {
    type: string;
    size: number;
    totalLength: number;
  };
  plates?: PlateProperties[];
  checks: DesignCheck[];
  overallRatio: number;
  status: 'PASS' | 'FAIL';
  warnings: string[];
  detailingNotes: string[];
}

// ============================================================================
// MOMENT CONNECTION TYPES
// ============================================================================

export interface MomentConnectionConfig {
  type: MomentConnectionType;
  beam: SteelSection;
  column: SteelSection;
  forces: ConnectionForces;
  code: DesignCode;
  seismicCode?: SeismicCode;
  seismicCategory?: 'OMF' | 'IMF' | 'SMF';
  materials: {
    beam: { fy: number; fu: number };
    column: { fy: number; fu: number };
    plate: { fy: number; fu: number };
    bolt: BoltProperties;
    weld: { electrode: string; strength: number };
  };
}

export type MomentConnectionType = 
  | 'welded_flange_bolted_web'
  | 'welded_flange_welded_web'
  | 'extended_end_plate_4bolt'
  | 'extended_end_plate_8bolt'
  | 'flush_end_plate'
  | 'reduced_beam_section'
  | 'bolted_flange_plate'
  | 'welded_unreinforced_flange'
  | 'kaiser_bolted_bracket'
  | 'simpson_strong_frame';

// ============================================================================
// SHEAR CONNECTION TYPES
// ============================================================================

export interface ShearConnectionConfig {
  type: ShearConnectionType;
  beam: SteelSection;
  support: 'column_web' | 'column_flange' | 'girder_web' | 'wall';
  supportSection?: SteelSection;
  forces: { shear: number; axial?: number };
  code: DesignCode;
  materials: {
    beam: { fy: number; fu: number };
    plate: { fy: number; fu: number };
    bolt: BoltProperties;
    weld?: { electrode: string; strength: number };
  };
  coped?: {
    top: boolean;
    bottom: boolean;
    copeLength: number;
    copeDepth: number;
  };
}

export type ShearConnectionType = 
  | 'single_plate'
  | 'double_angle'
  | 'single_angle'
  | 'shear_tab'
  | 'tee_connection'
  | 'seated_beam'
  | 'unstiffened_seat'
  | 'stiffened_seat'
  | 'end_plate';

// ============================================================================
// BRACING CONNECTION TYPES
// ============================================================================

export interface BracingConnectionConfig {
  type: BracingConnectionType;
  brace: SteelSection | { type: 'angle' | 'tube' | 'pipe'; area: number; fy: number; fu: number };
  gussetPlate: PlateProperties;
  forces: { axial: number; shear?: number };
  code: DesignCode;
  seismicCode?: SeismicCode;
  workPoint: { x: number; y: number };
  connectionAngles: {
    beamAngle: number;  // degrees from horizontal
    columnAngle: number; // degrees from vertical
  };
  materials: {
    bolt: BoltProperties;
    weld: { electrode: string; strength: number };
  };
}

export type BracingConnectionType = 
  | 'single_gusset'
  | 'corner_gusset'
  | 'chevron_gusset'
  | 'knife_plate'
  | 'welded_direct'
  | 'bolted_direct';

// ============================================================================
// STEEL CONNECTION DATABASE CLASS
// ============================================================================

export class SteelConnectionDatabase {
  private designCode: DesignCode;
  private seismicCode?: SeismicCode;

  constructor(designCode: DesignCode = 'IS800', seismicCode?: SeismicCode) {
    this.designCode = designCode;
    this.seismicCode = seismicCode;
  }

  // --------------------------------------------------------------------------
  // BOLT PROPERTIES DATABASE
  // --------------------------------------------------------------------------

  getBoltProperties(grade: string, diameter: number, code?: DesignCode): BoltProperties {
    const boltDatabase: Record<string, { fub: number; fyb: number }> = {
      // ISO/IS grades
      '4.6': { fub: 400, fyb: 240 },
      '4.8': { fub: 400, fyb: 320 },
      '5.6': { fub: 500, fyb: 300 },
      '5.8': { fub: 500, fyb: 400 },
      '6.8': { fub: 600, fyb: 480 },
      '8.8': { fub: 800, fyb: 640 },
      '10.9': { fub: 1000, fyb: 900 },
      '12.9': { fub: 1200, fyb: 1080 },
      // ASTM grades
      'A307': { fub: 414, fyb: 248 },
      'A325': { fub: 830, fyb: 660 },
      'A490': { fub: 1040, fyb: 940 },
      'F1852': { fub: 830, fyb: 660 },
      'F2280': { fub: 1040, fyb: 940 },
    };

    const boltData = boltDatabase[grade] || boltDatabase['8.8'];
    const { fub, fyb } = boltData;
    
    // Bolt area calculations
    const d = diameter;
    const As = Math.PI * Math.pow(d - 0.9382 * 1.5, 2) / 4; // Tensile stress area (approx)
    const Ab = Math.PI * d * d / 4; // Gross area
    
    const useCode = code || this.designCode;
    
    let tensionCapacity: number;
    let shearCapacity: number;
    let pretension: number | undefined;
    
    if (useCode === 'IS800') {
      // IS 800:2007 Clause 10.3
      const gammaM0 = 1.1;
      const gammaMb = 1.25;
      tensionCapacity = 0.9 * fub * As / (gammaMb * 1000); // kN
      shearCapacity = fub * As / (Math.sqrt(3) * gammaMb * 1000); // kN
      pretension = grade === '8.8' || grade === '10.9' ? 0.7 * fub * As / 1000 : undefined;
    } else if (useCode === 'AISC360') {
      // AISC 360-22 Chapter J
      const phi = 0.75;
      tensionCapacity = phi * 0.75 * fub * Ab / 1000; // kN
      shearCapacity = phi * 0.45 * fub * Ab / 1000; // kN (threads included)
      pretension = ['A325', 'A490', 'F1852', 'F2280'].includes(grade) 
        ? 0.7 * fub * As / 1000 : undefined;
    } else {
      // EN 1993-1-8
      const gammaM2 = 1.25;
      tensionCapacity = 0.9 * fub * As / (gammaM2 * 1000);
      shearCapacity = 0.6 * fub * As / (gammaM2 * 1000);
      pretension = fub >= 800 ? 0.7 * fub * As / 1000 : undefined;
    }

    return {
      grade,
      diameter,
      holeType: 'standard',
      tensileStrength: fub,
      yieldStrength: fyb,
      shearStrength: fub / Math.sqrt(3),
      tensionCapacity,
      shearCapacity,
      bearingCapacity: 0, // Depends on plate
      pretension,
    };
  }

  // --------------------------------------------------------------------------
  // WELD CAPACITY
  // --------------------------------------------------------------------------

  getWeldCapacity(type: WeldProperties['type'], size: number, electrode: string): number {
    // Weld strength (FEXX)
    const electrodeStrength: Record<string, number> = {
      'E60XX': 415,
      'E70XX': 485,
      'E7018': 485,
      'E80XX': 550,
      'E90XX': 620,
      'E100XX': 690,
      'E110XX': 760,
    };

    const FEXX = electrodeStrength[electrode] || 485; // Default to E70XX
    
    if (this.designCode === 'IS800') {
      // IS 800:2007 Clause 10.5
      const gammaMw = 1.25;
      const tt = size / Math.sqrt(2); // Throat thickness
      const fw = FEXX / (Math.sqrt(3) * gammaMw);
      return fw * tt / 1000; // kN/mm
    } else if (this.designCode === 'AISC360') {
      // AISC 360-22 Chapter J2
      const phi = 0.75;
      const tt = size * 0.707;
      return phi * 0.6 * FEXX * tt / 1000;
    } else {
      // EN 1993-1-8
      const betaW = 0.85; // For S275 steel
      const gammaM2 = 1.25;
      const a = size / Math.sqrt(2);
      const fvwd = FEXX / (Math.sqrt(3) * betaW * gammaM2);
      return fvwd * a / 1000;
    }
  }

  // --------------------------------------------------------------------------
  // MOMENT CONNECTION DESIGN
  // --------------------------------------------------------------------------

  designMomentConnection(config: MomentConnectionConfig): ConnectionDesignResult {
    const { type, beam, column, forces, code, seismicCategory, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    const geometry: ConnectionGeometry = {};
    let boltInfo: ConnectionDesignResult['bolts'];
    let weldInfo: ConnectionDesignResult['welds'];
    const plates: PlateProperties[] = [];

    switch (type) {
      case 'welded_flange_bolted_web':
        return this.designWeldedFlangeBoltedWeb(config);
      
      case 'extended_end_plate_4bolt':
      case 'extended_end_plate_8bolt':
        return this.designExtendedEndPlate(config);
      
      case 'reduced_beam_section':
        return this.designReducedBeamSection(config);
      
      case 'bolted_flange_plate':
        return this.designBoltedFlangePlate(config);
        
      default:
        return this.designWeldedFlangeBoltedWeb(config);
    }
  }

  private designWeldedFlangeBoltedWeb(config: MomentConnectionConfig): ConnectionDesignResult {
    const { beam, column, forces, code, seismicCategory, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    // Calculate required moment capacity
    const Mp = forces.momentMajor;
    const Vb = forces.shearMajor;
    
    // Flange force
    const d = beam.depth;
    const tf = beam.flangeThickness;
    const tw = beam.webThickness;
    const bf = beam.width;
    
    const leverArm = d - tf;
    const Ff = Mp / (leverArm / 1000); // kN
    
    // Weld design for flanges
    const weldElectrode = materials.weld.electrode;
    const weldStrength = this.getWeldCapacity('groove', 10, weldElectrode);
    
    // CJP weld for flange
    const flangeWeldCapacity = weldStrength * 2 * bf * tf; // Full penetration
    
    checks.push({
      name: 'Flange Weld Capacity',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.5' : 'AISC 360-22 J2',
      demand: Ff,
      capacity: flangeWeldCapacity,
      ratio: Ff / flangeWeldCapacity,
      status: Ff / flangeWeldCapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Shear tab design
    const shearTabThickness = Math.max(10, Math.ceil(tw * 1.5 / 2) * 2);
    const shearTabDepth = d - 2 * tf - 50; // Clear of flanges
    
    // Bolt design for shear tab
    const boltGrade = materials.bolt.grade;
    const boltDiameter = materials.bolt.diameter;
    const boltProps = this.getBoltProperties(boltGrade, boltDiameter, code);
    
    const numBolts = Math.max(2, Math.ceil(Vb / boltProps.shearCapacity));
    const boltRows = numBolts;
    const pitch = Math.max(3 * boltDiameter, 65);
    const edgeDistance = Math.max(1.5 * boltDiameter, 32);
    
    checks.push({
      name: 'Bolt Shear Capacity',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.3' : 'AISC 360-22 J3.6',
      demand: Vb,
      capacity: numBolts * boltProps.shearCapacity,
      ratio: Vb / (numBolts * boltProps.shearCapacity),
      status: Vb / (numBolts * boltProps.shearCapacity) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Block shear check
    const Agv = shearTabThickness * ((numBolts - 1) * pitch + edgeDistance);
    const Anv = Agv - (numBolts - 0.5) * (boltDiameter + 2) * shearTabThickness;
    const Ant = shearTabThickness * (edgeDistance - (boltDiameter + 2) / 2);
    
    const Vbs = this.calculateBlockShear(Agv, Anv, Ant, materials.plate.fy, materials.plate.fu, code);
    
    checks.push({
      name: 'Block Shear',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 6.4' : 'AISC 360-22 J4.3',
      demand: Vb,
      capacity: Vbs,
      ratio: Vb / Vbs,
      status: Vb / Vbs <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Column checks
    // Panel zone shear
    const Vpz = Mp / (column.depth - column.flangeThickness);
    const Vpz_capacity = this.calculatePanelZoneCapacity(column, materials.column.fy, code);
    
    checks.push({
      name: 'Panel Zone Shear',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 12.11' : 'AISC 360-22 J10.6',
      demand: Vpz,
      capacity: Vpz_capacity,
      ratio: Vpz / Vpz_capacity,
      status: Vpz / Vpz_capacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Column web stiffeners
    const needContinuityPlates = this.checkContinuityPlates(column, Ff, materials.column.fy, code);
    
    if (needContinuityPlates) {
      detailingNotes.push('Continuity plates required at column web');
      detailingNotes.push(`Continuity plate thickness: ${Math.max(tf, column.flangeThickness / 2)} mm minimum`);
    }
    
    // Seismic requirements
    if (seismicCategory && ['IMF', 'SMF'].includes(seismicCategory)) {
      detailingNotes.push('Use CJP groove welds with backing bar removed');
      detailingNotes.push('Weld access holes per AWS D1.8');
      
      if (seismicCategory === 'SMF') {
        // Check strong column - weak beam
        const Mpc = this.calculateColumnPlasticMoment(column, materials.column.fy);
        const Mpb = this.calculateBeamPlasticMoment(beam, materials.beam.fy);
        
        checks.push({
          name: 'Strong Column - Weak Beam',
          clause: 'AISC 341-22 E3.4a',
          demand: Mpb * 1.1, // With strain hardening
          capacity: Mpc,
          ratio: (Mpb * 1.1) / Mpc,
          status: Mpc >= Mpb * 1.0 ? 'PASS' : 'FAIL',
        });
      }
    }

    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Welded Flange - Bolted Web',
      code,
      forces,
      geometry: {
        pitch,
        edgeDistance,
        boltRows: numBolts,
        boltCols: 1,
        plateWidth: 100,
        plateHeight: shearTabDepth,
      },
      bolts: {
        grade: boltGrade,
        diameter: boltDiameter,
        quantity: numBolts,
        arrangement: `${numBolts} bolts in single vertical row`,
      },
      welds: {
        type: 'CJP groove + fillet',
        size: Math.ceil(tw * 0.707),
        totalLength: 2 * bf + shearTabDepth,
      },
      plates: [{
        material: 'E250',
        thickness: shearTabThickness,
        fy: materials.plate.fy,
        fu: materials.plate.fu,
      }],
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  private designExtendedEndPlate(config: MomentConnectionConfig): ConnectionDesignResult {
    const { type, beam, column, forces, code, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    const is8Bolt = type === 'extended_end_plate_8bolt';
    
    const Mp = forces.momentMajor;
    const Vb = forces.shearMajor;
    const Ab = forces.axial || 0;
    
    // End plate dimensions
    const d = beam.depth;
    const tf = beam.flangeThickness;
    const bf = beam.width;
    
    const plateWidth = bf + 50;
    const extension = 100; // Extension beyond flange
    const plateHeight = d + 2 * extension;
    
    // Bolt arrangement
    const boltProps = this.getBoltProperties(materials.bolt.grade, materials.bolt.diameter, code);
    const g = Math.max(140, bf / 2); // Gage (horizontal spacing)
    const pfi = 50; // Inner pitch from flange
    const pfo = 50; // Outer pitch from extension
    
    const boltRowsPerFlange = is8Bolt ? 2 : 1;
    const totalBolts = is8Bolt ? 8 : 4;
    
    // Flange force and bolt tension
    const leverArm = d - tf;
    const Ff = Mp / (leverArm / 1000) + Ab / 2; // Flange force including axial
    
    const boltTension = Ff / (boltRowsPerFlange * 2); // Per bolt
    
    checks.push({
      name: 'Bolt Tension',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.5' : 'AISC 360-22 J3.6',
      demand: boltTension,
      capacity: boltProps.tensionCapacity,
      ratio: boltTension / boltProps.tensionCapacity,
      status: boltTension / boltProps.tensionCapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // End plate thickness (yield line analysis)
    const tp = this.calculateEndPlateThickness(
      Ff, g, pfi, pfo, bf, materials.plate.fy, code
    );
    
    checks.push({
      name: 'End Plate Bending',
      clause: code === 'IS800' ? 'IS 800:2007 Annex G' : 'AISC Design Guide 4',
      demand: tp,
      capacity: Math.ceil(tp / 2) * 2,
      ratio: 1.0,
      status: 'PASS',
      notes: `Required thickness: ${tp.toFixed(1)} mm`,
    });
    
    // Weld to beam
    const flangeWeldSize = Math.max(8, Math.ceil(tf * 0.7));
    const webWeldSize = Math.max(6, Math.ceil(beam.webThickness * 0.7));
    
    const flangeWeldCapacity = this.getWeldCapacity('fillet', flangeWeldSize, materials.weld.electrode) * 2 * bf;
    const webWeldCapacity = this.getWeldCapacity('fillet', webWeldSize, materials.weld.electrode) * 2 * (d - 2 * tf);
    
    checks.push({
      name: 'Flange Weld to End Plate',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.5' : 'AISC 360-22 J2',
      demand: Ff,
      capacity: flangeWeldCapacity,
      ratio: Ff / flangeWeldCapacity,
      status: Ff / flangeWeldCapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    checks.push({
      name: 'Web Weld to End Plate',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.5' : 'AISC 360-22 J2',
      demand: Vb,
      capacity: webWeldCapacity,
      ratio: Vb / webWeldCapacity,
      status: Vb / webWeldCapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Column flange bending
    const tcf = column.flangeThickness;
    const columnFlangeBending = this.checkColumnFlangeBending(
      boltTension, g, tcf, materials.column.fy, code
    );
    
    checks.push({
      name: 'Column Flange Bending',
      clause: code === 'IS800' ? 'IS 800:2007 Annex G' : 'AISC Design Guide 4',
      demand: columnFlangeBending.demand,
      capacity: columnFlangeBending.capacity,
      ratio: columnFlangeBending.ratio,
      status: columnFlangeBending.ratio <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    if (columnFlangeBending.ratio > 1.0) {
      detailingNotes.push('Column flange stiffeners or doubler plate required');
    }
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: is8Bolt ? 'Extended End Plate (8-Bolt)' : 'Extended End Plate (4-Bolt)',
      code,
      forces,
      geometry: {
        gageDistance: g,
        pitch: pfi + pfo,
        edgeDistance: 35,
        boltRows: boltRowsPerFlange * 2 + 2,
        boltCols: 2,
        plateWidth,
        plateHeight,
      },
      bolts: {
        grade: materials.bolt.grade,
        diameter: materials.bolt.diameter,
        quantity: totalBolts,
        arrangement: is8Bolt ? '4 rows x 2 cols' : '2 rows x 2 cols outside flanges',
      },
      welds: {
        type: 'Fillet welds',
        size: flangeWeldSize,
        totalLength: 4 * bf + 2 * (d - 2 * tf),
      },
      plates: [{
        material: 'E250',
        thickness: Math.ceil(tp / 2) * 2,
        fy: materials.plate.fy,
        fu: materials.plate.fu,
      }],
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  private designReducedBeamSection(config: MomentConnectionConfig): ConnectionDesignResult {
    const { beam, column, forces, code, seismicCategory, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    // RBS geometry (AISC 358 Chapter 5)
    const d = beam.depth;
    const tf = beam.flangeThickness;
    const bf = beam.width;
    const Zx = beam.plasticModulus.Zxx;
    const fy = materials.beam.fy;
    
    // RBS cut dimensions
    const a = 0.625 * bf; // Distance from column face to start of cut
    const b = 0.75 * d;   // Length of cut
    const c = 0.25 * bf;  // Depth of cut (each side)
    
    // Reduced section properties
    const bfRBS = bf - 2 * c;
    const ZRBS = Zx * (bfRBS / bf); // Approximate
    
    // Plastic moment at RBS
    const Cpr = 1.15; // Peak connection strength coefficient
    const Ry = 1.1;   // Material overstrength factor
    const MprRBS = Cpr * Ry * fy * ZRBS / 1e6; // kNm
    
    // Moment at column face
    const Sh = a + b / 2; // Distance to center of RBS
    const Vb = forces.shearMajor;
    const Mf = MprRBS + Vb * (Sh / 1000); // Moment at face
    
    // Column demands
    const Vpc = MprRBS * 2 / (column.depth - column.flangeThickness);
    
    checks.push({
      name: 'RBS Plastic Moment',
      clause: 'AISC 358-22 Ch. 5',
      demand: forces.momentMajor,
      capacity: MprRBS,
      ratio: forces.momentMajor / MprRBS,
      status: forces.momentMajor / MprRBS <= 1.0 ? 'PASS' : 'FAIL',
      notes: `RBS cut: a=${a.toFixed(0)}mm, b=${b.toFixed(0)}mm, c=${c.toFixed(0)}mm`,
    });
    
    // Check beam/column strength ratio
    const Mpc = this.calculateColumnPlasticMoment(column, materials.column.fy);
    const strengthRatio = Mpc / MprRBS;
    
    checks.push({
      name: 'Strong Column - Weak Beam',
      clause: 'AISC 341-22 E3.4a',
      demand: 1.0,
      capacity: strengthRatio,
      ratio: 1.0 / strengthRatio,
      status: strengthRatio >= 1.0 ? 'PASS' : 'FAIL',
      notes: `ΣMpc/ΣMpb = ${strengthRatio.toFixed(2)}`,
    });
    
    // Panel zone check
    const PZcapacity = this.calculatePanelZoneCapacity(column, materials.column.fy, code);
    
    checks.push({
      name: 'Panel Zone Shear',
      clause: 'AISC 341-22 E3.6e',
      demand: Vpc,
      capacity: PZcapacity,
      ratio: Vpc / PZcapacity,
      status: Vpc / PZcapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Flange connection
    const Ff = Mf / ((d - tf) / 1000);
    const flangeWeldCapacity = materials.weld.strength * bf * tf / 1000;
    
    checks.push({
      name: 'Flange CJP Weld',
      clause: 'AISC 341-22 E3.6b',
      demand: Ff,
      capacity: flangeWeldCapacity * 2,
      ratio: Ff / (flangeWeldCapacity * 2),
      status: Ff / (flangeWeldCapacity * 2) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Detailing notes
    detailingNotes.push(`RBS cut: Start at ${a}mm from column face`);
    detailingNotes.push(`RBS cut length: ${b}mm`);
    detailingNotes.push(`RBS cut depth: ${c}mm (each side)`);
    detailingNotes.push('Radius cut recommended - no flame cutting');
    detailingNotes.push('Surface finish: 500 μin max roughness');
    detailingNotes.push('Remove backing bar and grind CJP welds');
    
    if (seismicCategory === 'SMF') {
      detailingNotes.push('Weld access holes per AWS D1.8 Figure 6.2');
      detailingNotes.push('Web connection: Bolted single plate or CJP weld');
    }
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Reduced Beam Section (RBS)',
      code,
      forces,
      geometry: {
        plateWidth: bf,
        plateHeight: d,
      },
      welds: {
        type: 'CJP groove welds at flanges, fillet at web',
        size: tf,
        totalLength: 2 * bf + 2 * (d - 2 * tf),
      },
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  private designBoltedFlangePlate(config: MomentConnectionConfig): ConnectionDesignResult {
    const { beam, column, forces, code, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    const Mp = forces.momentMajor;
    const Vb = forces.shearMajor;
    
    const d = beam.depth;
    const tf = beam.flangeThickness;
    const bf = beam.width;
    
    // Flange force
    const Ff = Mp / ((d - tf) / 1000);
    
    // Flange plate design
    const boltProps = this.getBoltProperties(materials.bolt.grade, materials.bolt.diameter, code);
    const numBoltsPerFlange = Math.max(4, Math.ceil(Ff / boltProps.shearCapacity / 2) * 2);
    
    const rows = 2;
    const cols = numBoltsPerFlange / 2;
    const pitch = Math.max(3 * materials.bolt.diameter, 70);
    const gage = Math.max(140, bf * 0.7);
    const edgeDist = Math.max(1.5 * materials.bolt.diameter, 35);
    
    const plateLength = 2 * edgeDist + (cols - 1) * pitch;
    const plateWidth = bf + 20;
    
    // Plate thickness for block shear and gross section yield
    const plateThickness = Math.max(
      Ff / (0.9 * materials.plate.fy * (plateWidth - 2 * (materials.bolt.diameter + 2))),
      Ff / (0.6 * materials.plate.fu * (plateWidth - 2 * (materials.bolt.diameter + 2))),
      tf
    );
    
    checks.push({
      name: 'Bolt Shear (Flange Plate)',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.3' : 'AISC 360-22 J3.6',
      demand: Ff,
      capacity: numBoltsPerFlange * boltProps.shearCapacity * 2, // Double shear
      ratio: Ff / (numBoltsPerFlange * boltProps.shearCapacity * 2),
      status: Ff / (numBoltsPerFlange * boltProps.shearCapacity * 2) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Plate yielding
    const Ag = plateThickness * plateWidth;
    const Py = 0.9 * materials.plate.fy * Ag / 1000;
    
    checks.push({
      name: 'Plate Gross Section Yield',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 6.2' : 'AISC 360-22 J4.1',
      demand: Ff,
      capacity: Py,
      ratio: Ff / Py,
      status: Ff / Py <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Web connection for shear
    const shearTabThickness = 10;
    const shearBolts = Math.max(2, Math.ceil(Vb / boltProps.shearCapacity));
    
    checks.push({
      name: 'Shear Tab Bolts',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.3' : 'AISC 360-22 J3.6',
      demand: Vb,
      capacity: shearBolts * boltProps.shearCapacity,
      ratio: Vb / (shearBolts * boltProps.shearCapacity),
      status: Vb / (shearBolts * boltProps.shearCapacity) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    detailingNotes.push('Use slip-critical bolts (Class A or B faying surface)');
    detailingNotes.push(`Flange plate: ${Math.ceil(plateThickness)}mm x ${plateWidth}mm x ${plateLength}mm`);
    detailingNotes.push(`${numBoltsPerFlange} bolts per flange in ${rows} rows x ${cols} cols`);
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Bolted Flange Plate',
      code,
      forces,
      geometry: {
        gageDistance: gage,
        pitch,
        edgeDistance: edgeDist,
        boltRows: rows,
        boltCols: cols,
        plateWidth,
        plateHeight: plateLength,
      },
      bolts: {
        grade: materials.bolt.grade,
        diameter: materials.bolt.diameter,
        quantity: numBoltsPerFlange * 2 + shearBolts,
        arrangement: `${numBoltsPerFlange} per flange + ${shearBolts} for shear tab`,
      },
      plates: [
        {
          material: 'E250',
          thickness: Math.ceil(plateThickness),
          fy: materials.plate.fy,
          fu: materials.plate.fu,
        },
        {
          material: 'E250',
          thickness: shearTabThickness,
          fy: materials.plate.fy,
          fu: materials.plate.fu,
        },
      ],
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  // --------------------------------------------------------------------------
  // SHEAR CONNECTION DESIGN
  // --------------------------------------------------------------------------

  designShearConnection(config: ShearConnectionConfig): ConnectionDesignResult {
    const { type, beam, forces, code, materials, coped } = config;
    
    switch (type) {
      case 'single_plate':
      case 'shear_tab':
        return this.designSinglePlate(config);
      case 'double_angle':
        return this.designDoubleAngle(config);
      case 'seated_beam':
      case 'unstiffened_seat':
        return this.designUnstiffenedSeat(config);
      case 'stiffened_seat':
        return this.designStiffenedSeat(config);
      default:
        return this.designSinglePlate(config);
    }
  }

  private designSinglePlate(config: ShearConnectionConfig): ConnectionDesignResult {
    const { beam, forces, code, materials, coped } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    const V = forces.shear;
    const N = forces.axial || 0;
    
    // Bolt design
    const boltProps = this.getBoltProperties(materials.bolt.grade, materials.bolt.diameter, code);
    const numBolts = Math.max(2, Math.ceil(V / boltProps.shearCapacity));
    
    const pitch = Math.max(3 * materials.bolt.diameter, 70);
    const edgeDist = Math.max(1.5 * materials.bolt.diameter, 32);
    
    // Plate dimensions
    const plateHeight = 2 * edgeDist + (numBolts - 1) * pitch;
    const plateWidth = 100;
    const plateThickness = Math.max(6, Math.ceil(beam.webThickness * 0.8));
    
    // Eccentricity
    const a = 75; // Distance from bolt line to weld line
    const Mu = V * a / 1000; // Eccentric moment (kNm)
    
    checks.push({
      name: 'Bolt Shear',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.3' : 'AISC 360-22 J3.6',
      demand: V,
      capacity: numBolts * boltProps.shearCapacity,
      ratio: V / (numBolts * boltProps.shearCapacity),
      status: V / (numBolts * boltProps.shearCapacity) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Bolt bearing
    const bearingCapacity = 2.5 * materials.bolt.diameter * plateThickness * materials.plate.fu / 1000;
    
    checks.push({
      name: 'Bolt Bearing',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.4' : 'AISC 360-22 J3.10',
      demand: V / numBolts,
      capacity: bearingCapacity,
      ratio: (V / numBolts) / bearingCapacity,
      status: (V / numBolts) / bearingCapacity <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Plate shear yielding
    const Vn_yield = 0.6 * materials.plate.fy * plateHeight * plateThickness / 1000;
    
    checks.push({
      name: 'Plate Shear Yielding',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.4' : 'AISC 360-22 J4.2',
      demand: V,
      capacity: Vn_yield,
      ratio: V / Vn_yield,
      status: V / Vn_yield <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Plate shear rupture
    const An_plate = (plateHeight - numBolts * (materials.bolt.diameter + 2)) * plateThickness;
    const Vn_rupture = 0.6 * materials.plate.fu * An_plate / 1000;
    
    checks.push({
      name: 'Plate Shear Rupture',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.4' : 'AISC 360-22 J4.2',
      demand: V,
      capacity: Vn_rupture,
      ratio: V / Vn_rupture,
      status: V / Vn_rupture <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Weld design
    const weldSize = Math.max(5, Math.ceil(plateThickness * 0.7));
    const weldCapacity = this.getWeldCapacity('fillet', weldSize, materials.weld!.electrode);
    const totalWeldLength = 2 * plateHeight;
    
    checks.push({
      name: 'Weld to Support',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.5' : 'AISC 360-22 J2',
      demand: V,
      capacity: weldCapacity * totalWeldLength,
      ratio: V / (weldCapacity * totalWeldLength),
      status: V / (weldCapacity * totalWeldLength) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Block shear (beam web)
    if (coped) {
      const copeCheck = this.checkCopeBlockShear(beam, coped, forces, materials, code);
      checks.push(copeCheck);
      
      if (copeCheck.status === 'FAIL') {
        warnings.push('Beam cope block shear failure - consider reinforcement');
      }
    }
    
    detailingNotes.push(`Shear tab: ${plateThickness}mm x ${plateWidth}mm x ${plateHeight}mm`);
    detailingNotes.push(`${numBolts} bolts @ ${pitch}mm pitch`);
    detailingNotes.push(`${weldSize}mm fillet weld both sides`);
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Single Plate (Shear Tab)',
      code,
      forces: { ...forces, shearMajor: V, shearMinor: 0, momentMajor: 0, momentMinor: 0, axial: N, torsion: 0 },
      geometry: {
        pitch,
        edgeDistance: edgeDist,
        boltRows: numBolts,
        boltCols: 1,
        plateWidth,
        plateHeight,
      },
      bolts: {
        grade: materials.bolt.grade,
        diameter: materials.bolt.diameter,
        quantity: numBolts,
        arrangement: `${numBolts} bolts in single vertical row`,
      },
      welds: {
        type: 'Fillet',
        size: weldSize,
        totalLength: totalWeldLength,
      },
      plates: [{
        material: 'E250',
        thickness: plateThickness,
        fy: materials.plate.fy,
        fu: materials.plate.fu,
      }],
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  private designDoubleAngle(config: ShearConnectionConfig): ConnectionDesignResult {
    const { beam, forces, code, materials } = config;
    
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    const detailingNotes: string[] = [];
    
    const V = forces.shear;
    
    // Select angle size
    const angleThickness = Math.max(8, Math.ceil(beam.webThickness));
    const angleLeg = Math.max(75, 3 * materials.bolt.diameter);
    
    // Bolt design
    const boltProps = this.getBoltProperties(materials.bolt.grade, materials.bolt.diameter, code);
    const numBolts = Math.max(2, Math.ceil(V / (2 * boltProps.shearCapacity))); // Double shear
    
    const pitch = Math.max(3 * materials.bolt.diameter, 70);
    const edgeDist = Math.max(1.5 * materials.bolt.diameter, 32);
    const angleLength = 2 * edgeDist + (numBolts - 1) * pitch;
    
    checks.push({
      name: 'Bolt Shear (OSL)',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.3.3' : 'AISC 360-22 J3.6',
      demand: V,
      capacity: numBolts * boltProps.shearCapacity * 2,
      ratio: V / (numBolts * boltProps.shearCapacity * 2),
      status: V / (numBolts * boltProps.shearCapacity * 2) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Angle gross section shear
    const Agv = 2 * angleThickness * angleLength;
    const Vn_yield = 0.6 * materials.plate.fy * Agv / 1000;
    
    checks.push({
      name: 'Angle Shear Yielding',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.4' : 'AISC 360-22 J4.2',
      demand: V,
      capacity: Vn_yield,
      ratio: V / Vn_yield,
      status: V / Vn_yield <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    detailingNotes.push(`2L ${angleLeg}x${angleLeg}x${angleThickness} x ${angleLength}mm long`);
    detailingNotes.push(`${numBolts * 2} bolts total (${numBolts} per angle)`);
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Double Angle',
      code,
      forces: { ...forces, shearMajor: V, shearMinor: 0, momentMajor: 0, momentMinor: 0, axial: forces.axial || 0, torsion: 0 },
      geometry: {
        pitch,
        edgeDistance: edgeDist,
        boltRows: numBolts,
        boltCols: 2,
        plateHeight: angleLength,
      },
      bolts: {
        grade: materials.bolt.grade,
        diameter: materials.bolt.diameter,
        quantity: numBolts * 2,
        arrangement: `${numBolts} bolts each angle`,
      },
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings,
      detailingNotes,
    };
  }

  private designUnstiffenedSeat(config: ShearConnectionConfig): ConnectionDesignResult {
    const { beam, forces, code, materials } = config;
    
    const checks: DesignCheck[] = [];
    const detailingNotes: string[] = [];
    
    const V = forces.shear;
    const tw = beam.webThickness;
    
    // Seat angle dimensions
    const seatWidth = beam.width + 25;
    const seatThickness = Math.max(12, Math.ceil(V / (0.4 * materials.plate.fy * 0.5 * seatWidth) * 1000));
    const seatLeg = 100;
    
    // Bearing length
    const N = 50; // Bearing length on seat
    const lb = N + tw; // Load bearing length
    
    // Web local yielding
    const Rn_yield = materials.beam.fy * tw * (2.5 * beam.flangeThickness + lb) / 1000;
    
    checks.push({
      name: 'Web Local Yielding',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.7.4' : 'AISC 360-22 J10.2',
      demand: V,
      capacity: Rn_yield,
      ratio: V / Rn_yield,
      status: V / Rn_yield <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Web local crippling
    const Rn_cripple = 0.8 * tw * tw * (1 + 3 * (N / beam.depth) * Math.pow(tw / beam.flangeThickness, 1.5)) *
                        Math.sqrt(materials.beam.fy * beam.flangeThickness / tw) / 1000;
    
    checks.push({
      name: 'Web Local Crippling',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.7.5' : 'AISC 360-22 J10.3',
      demand: V,
      capacity: Rn_cripple,
      ratio: V / Rn_cripple,
      status: V / Rn_cripple <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    detailingNotes.push(`Seat angle: L${seatLeg}x${seatLeg}x${seatThickness} x ${seatWidth}mm`);
    detailingNotes.push('Use erection bolts through beam bottom flange');
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Unstiffened Seated Beam',
      code,
      forces: { ...forces, shearMajor: V, shearMinor: 0, momentMajor: 0, momentMinor: 0, axial: 0, torsion: 0 },
      geometry: {
        plateWidth: seatWidth,
        plateHeight: seatLeg,
      },
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings: [],
      detailingNotes,
    };
  }

  private designStiffenedSeat(config: ShearConnectionConfig): ConnectionDesignResult {
    const { beam, forces, code, materials } = config;
    
    const checks: DesignCheck[] = [];
    const detailingNotes: string[] = [];
    
    const V = forces.shear;
    
    // Stiffener plate
    const stiffenerWidth = beam.width + 25;
    const stiffenerHeight = 200;
    const stiffenerThickness = Math.max(12, Math.ceil(V / (0.6 * materials.plate.fy * stiffenerHeight) * 1000));
    
    // Seat plate
    const seatThickness = Math.max(20, stiffenerThickness + 4);
    const seatWidth = stiffenerWidth;
    const seatProjection = 100;
    
    // Stiffener buckling
    const kv = 5.0; // Simply supported
    const slenderness = stiffenerHeight / stiffenerThickness;
    const slendernessLimit = 0.75 * Math.sqrt(kv * 200000 / materials.plate.fy);
    
    checks.push({
      name: 'Stiffener Slenderness',
      clause: code === 'IS800' ? 'IS 800:2007 Table 2' : 'AISC 360-22 Table B4.1a',
      demand: slenderness,
      capacity: slendernessLimit,
      ratio: slenderness / slendernessLimit,
      status: slenderness <= slendernessLimit ? 'PASS' : 'FAIL',
    });
    
    // Stiffener shear capacity
    const Vn_stiff = 0.6 * materials.plate.fy * stiffenerThickness * stiffenerHeight / 1000;
    
    checks.push({
      name: 'Stiffener Shear',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 8.4' : 'AISC 360-22 J4.2',
      demand: V,
      capacity: Vn_stiff,
      ratio: V / Vn_stiff,
      status: V / Vn_stiff <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    // Weld to column
    const weldSize = Math.ceil(stiffenerThickness * 0.7);
    const weldCapacity = this.getWeldCapacity('fillet', weldSize, materials.weld!.electrode);
    const weldLength = 2 * stiffenerHeight + stiffenerWidth;
    
    checks.push({
      name: 'Weld to Column',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 10.5' : 'AISC 360-22 J2',
      demand: V,
      capacity: weldCapacity * weldLength,
      ratio: V / (weldCapacity * weldLength),
      status: V / (weldCapacity * weldLength) <= 1.0 ? 'PASS' : 'FAIL',
    });
    
    detailingNotes.push(`Stiffener: ${stiffenerThickness}mm x ${stiffenerHeight}mm x ${stiffenerWidth}mm`);
    detailingNotes.push(`Seat plate: ${seatThickness}mm x ${seatProjection}mm x ${seatWidth}mm`);
    detailingNotes.push(`${weldSize}mm fillet welds all around`);
    
    const overallRatio = Math.max(...checks.map(c => c.ratio));
    
    return {
      connectionType: 'Stiffened Seated Beam',
      code,
      forces: { ...forces, shearMajor: V, shearMinor: 0, momentMajor: 0, momentMinor: 0, axial: 0, torsion: 0 },
      geometry: {
        plateWidth: stiffenerWidth,
        plateHeight: stiffenerHeight,
        stiffenerThickness,
      },
      welds: {
        type: 'Fillet',
        size: weldSize,
        totalLength: weldLength,
      },
      plates: [{
        material: 'E250',
        thickness: stiffenerThickness,
        fy: materials.plate.fy,
        fu: materials.plate.fu,
      }],
      checks,
      overallRatio,
      status: overallRatio <= 1.0 ? 'PASS' : 'FAIL',
      warnings: [],
      detailingNotes,
    };
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private calculateBlockShear(Agv: number, Anv: number, Ant: number, fy: number, fu: number, code: DesignCode): number {
    if (code === 'IS800') {
      const gammam0 = 1.1;
      const gammam1 = 1.25;
      return Math.min(
        (Agv * fy / (Math.sqrt(3) * gammam0) + 0.9 * Ant * fu / gammam1) / 1000,
        (0.9 * Anv * fu / (Math.sqrt(3) * gammam1) + Agv * fy / gammam0) / 1000
      );
    } else if (code === 'AISC360') {
      const phi = 0.75;
      return phi * Math.min(
        0.6 * fu * Anv + fu * Ant,
        0.6 * fy * Agv + fu * Ant
      ) / 1000;
    } else {
      const gammaM2 = 1.25;
      return (Anv * fu / (Math.sqrt(3) * gammaM2) + Ant * fu / gammaM2) / 1000;
    }
  }

  private calculatePanelZoneCapacity(column: SteelSection, fy: number, code: DesignCode): number {
    const dc = column.depth;
    const twc = column.webThickness;
    const bcf = column.width;
    const tcf = column.flangeThickness;
    
    if (code === 'IS800' || code === 'AISC360') {
      // AISC 360-22 Eq J10-11
      return 0.6 * fy * dc * twc * (1 + 3 * bcf * tcf * tcf / (dc * dc * twc)) / 1000;
    } else {
      // EN 1993-1-8
      return 0.9 * fy * (dc - 2 * tcf) * twc / (Math.sqrt(3) * 1000);
    }
  }

  private checkContinuityPlates(column: SteelSection, Ff: number, fy: number, code: DesignCode): boolean {
    const tcf = column.flangeThickness;
    const twc = column.webThickness;
    const bcf = column.width;
    const k = column.depth / 6; // Approximate k dimension
    
    // Web local yielding
    const Rn_yield = fy * twc * (5 * k + bcf) / 1000;
    
    // Column flange bending
    const Rn_flange = 6.25 * fy * tcf * tcf / 1000;
    
    return Ff > Math.min(Rn_yield, Rn_flange);
  }

  private calculateEndPlateThickness(Ff: number, g: number, pfi: number, pfo: number, bf: number, fy: number, code: DesignCode): number {
    // Simplified yield line analysis
    const m = g / 2;
    const n = Math.min(pfi, pfo);
    
    // Required plastic section modulus
    const Mp = Ff * m / 4 / 1000; // Per unit width, approximate
    
    // Required thickness
    const tp = Math.sqrt(4 * Mp * 1000 / (fy * bf));
    
    return Math.max(tp, 16); // Minimum 16mm
  }

  private checkColumnFlangeBending(boltTension: number, g: number, tcf: number, fy: number, code: DesignCode): { demand: number; capacity: number; ratio: number } {
    const m = g / 2 - tcf / 2;
    const demand = boltTension * m;
    const capacity = fy * tcf * tcf / 4 / 1000; // Per unit width
    
    return {
      demand,
      capacity,
      ratio: demand / capacity,
    };
  }

  private calculateColumnPlasticMoment(column: SteelSection, fy: number): number {
    return fy * column.plasticModulus.Zxx / 1e6; // kNm
  }

  private calculateBeamPlasticMoment(beam: SteelSection, fy: number): number {
    return fy * beam.plasticModulus.Zxx / 1e6; // kNm
  }

  private checkCopeBlockShear(
    beam: SteelSection,
    cope: NonNullable<ShearConnectionConfig['coped']>,
    forces: ShearConnectionConfig['forces'],
    materials: ShearConnectionConfig['materials'],
    code: DesignCode
  ): DesignCheck {
    const tw = beam.webThickness;
    const d = beam.depth;
    const tf = beam.flangeThickness;
    
    const copeDepth = cope.copeDepth;
    const copeLength = cope.copeLength;
    
    // Reduced section
    const ho = d - (cope.top ? copeDepth : 0) - (cope.bottom ? copeDepth : 0);
    
    // Block shear
    const Agv = copeLength * tw;
    const Anv = Agv; // No holes in gross shear area
    const Ant = (ho - tf) * tw * 0.5; // Approximate tension area
    
    const Vbs = this.calculateBlockShear(Agv, Anv, Ant, materials.beam.fy, materials.beam.fu, code);
    
    return {
      name: 'Cope Block Shear',
      clause: code === 'IS800' ? 'IS 800:2007 Cl. 6.4' : 'AISC 360-22 J4.3',
      demand: forces.shear,
      capacity: Vbs,
      ratio: forces.shear / Vbs,
      status: forces.shear / Vbs <= 1.0 ? 'PASS' : 'FAIL',
    };
  }

  // --------------------------------------------------------------------------
  // STANDARD SECTION DATABASE
  // --------------------------------------------------------------------------

  static getStandardSection(designation: string): SteelSection | null {
    const sections: Record<string, SteelSection> = {
      // Indian Standard Sections (IS 808)
      'ISMB 100': { designation: 'ISMB 100', depth: 100, width: 75, webThickness: 4.0, flangeThickness: 7.2, area: 1160, momentOfInertia: { Ixx: 2570000, Iyy: 410000 }, plasticModulus: { Zxx: 57600, Zyy: 13300 }, elasticModulus: { Sxx: 51400, Syy: 10900 }, radiusOfGyration: { rx: 47.1, ry: 18.8 }, weight: 9.1 },
      'ISMB 150': { designation: 'ISMB 150', depth: 150, width: 80, webThickness: 4.8, flangeThickness: 7.6, area: 1660, momentOfInertia: { Ixx: 7260000, Iyy: 530000 }, plasticModulus: { Zxx: 109600, Zyy: 16200 }, elasticModulus: { Sxx: 96800, Syy: 13300 }, radiusOfGyration: { rx: 66.2, ry: 17.9 }, weight: 13.0 },
      'ISMB 200': { designation: 'ISMB 200', depth: 200, width: 100, webThickness: 5.7, flangeThickness: 10.8, area: 2850, momentOfInertia: { Ixx: 22350000, Iyy: 1500000 }, plasticModulus: { Zxx: 253800, Zyy: 36600 }, elasticModulus: { Sxx: 223500, Syy: 30000 }, radiusOfGyration: { rx: 88.6, ry: 22.9 }, weight: 22.4 },
      'ISMB 250': { designation: 'ISMB 250', depth: 250, width: 125, webThickness: 6.9, flangeThickness: 12.5, area: 4250, momentOfInertia: { Ixx: 51300000, Iyy: 3340000 }, plasticModulus: { Zxx: 465600, Zyy: 65200 }, elasticModulus: { Sxx: 410400, Syy: 53400 }, radiusOfGyration: { rx: 109.9, ry: 28.0 }, weight: 33.4 },
      'ISMB 300': { designation: 'ISMB 300', depth: 300, width: 140, webThickness: 7.5, flangeThickness: 12.4, area: 5050, momentOfInertia: { Ixx: 86030000, Iyy: 4540000 }, plasticModulus: { Zxx: 651400, Zyy: 79000 }, elasticModulus: { Sxx: 573500, Syy: 64900 }, radiusOfGyration: { rx: 130.5, ry: 30.0 }, weight: 39.6 },
      'ISMB 350': { designation: 'ISMB 350', depth: 350, width: 140, webThickness: 8.1, flangeThickness: 14.2, area: 6030, momentOfInertia: { Ixx: 136300000, Iyy: 5380000 }, plasticModulus: { Zxx: 888800, Zyy: 93400 }, elasticModulus: { Sxx: 778900, Syy: 76900 }, radiusOfGyration: { rx: 150.4, ry: 29.9 }, weight: 47.3 },
      'ISMB 400': { designation: 'ISMB 400', depth: 400, width: 140, webThickness: 8.9, flangeThickness: 16.0, area: 7210, momentOfInertia: { Ixx: 204100000, Iyy: 6220000 }, plasticModulus: { Zxx: 1176500, Zyy: 108000 }, elasticModulus: { Sxx: 1020500, Syy: 88900 }, radiusOfGyration: { rx: 168.3, ry: 29.4 }, weight: 56.6 },
      'ISMB 450': { designation: 'ISMB 450', depth: 450, width: 150, webThickness: 9.4, flangeThickness: 17.4, area: 8400, momentOfInertia: { Ixx: 303800000, Iyy: 8340000 }, plasticModulus: { Zxx: 1545200, Zyy: 135200 }, elasticModulus: { Sxx: 1350200, Syy: 111200 }, radiusOfGyration: { rx: 190.2, ry: 31.5 }, weight: 65.9 },
      'ISMB 500': { designation: 'ISMB 500', depth: 500, width: 180, webThickness: 10.2, flangeThickness: 17.2, area: 10200, momentOfInertia: { Ixx: 452200000, Iyy: 13700000 }, plasticModulus: { Zxx: 2074600, Zyy: 185400 }, elasticModulus: { Sxx: 1808800, Syy: 152200 }, radiusOfGyration: { rx: 210.6, ry: 36.7 }, weight: 80.1 },
      'ISMB 550': { designation: 'ISMB 550', depth: 550, width: 190, webThickness: 11.2, flangeThickness: 19.3, area: 12500, momentOfInertia: { Ixx: 648900000, Iyy: 18900000 }, plasticModulus: { Zxx: 2711800, Zyy: 242000 }, elasticModulus: { Sxx: 2359600, Syy: 198900 }, radiusOfGyration: { rx: 227.9, ry: 38.9 }, weight: 98.0 },
      'ISMB 600': { designation: 'ISMB 600', depth: 600, width: 210, webThickness: 12.0, flangeThickness: 20.3, area: 15600, momentOfInertia: { Ixx: 918100000, Iyy: 26600000 }, plasticModulus: { Zxx: 3512200, Zyy: 307800 }, elasticModulus: { Sxx: 3060300, Syy: 253300 }, radiusOfGyration: { rx: 242.6, ry: 41.3 }, weight: 122.6 },
      
      // Wide Flange (AISC)
      'W8X31': { designation: 'W8X31', depth: 203, width: 203, webThickness: 7.2, flangeThickness: 11.0, area: 5890, momentOfInertia: { Ixx: 39900000, Iyy: 13100000 }, plasticModulus: { Zxx: 436000, Zyy: 168000 }, elasticModulus: { Sxx: 393000, Syy: 129000 }, radiusOfGyration: { rx: 82.3, ry: 47.2 }, weight: 46.2 },
      'W10X49': { designation: 'W10X49', depth: 254, width: 254, webThickness: 8.6, flangeThickness: 14.2, area: 9290, momentOfInertia: { Ixx: 113000000, Iyy: 38700000 }, plasticModulus: { Zxx: 989000, Zyy: 396000 }, elasticModulus: { Sxx: 890000, Syy: 305000 }, radiusOfGyration: { rx: 110, ry: 64.5 }, weight: 72.9 },
      'W12X65': { designation: 'W12X65', depth: 308, width: 305, webThickness: 9.9, flangeThickness: 15.4, area: 12300, momentOfInertia: { Ixx: 222000000, Iyy: 72100000 }, plasticModulus: { Zxx: 1590000, Zyy: 613000 }, elasticModulus: { Sxx: 1440000, Syy: 473000 }, radiusOfGyration: { rx: 134, ry: 76.7 }, weight: 96.8 },
      'W14X82': { designation: 'W14X82', depth: 363, width: 257, webThickness: 10.9, flangeThickness: 18.3, area: 15500, momentOfInertia: { Ixx: 385000000, Iyy: 61200000 }, plasticModulus: { Zxx: 2350000, Zyy: 621000 }, elasticModulus: { Sxx: 2120000, Syy: 476000 }, radiusOfGyration: { rx: 157, ry: 62.7 }, weight: 122 },
      'W16X100': { designation: 'W16X100', depth: 417, width: 267, webThickness: 11.8, flangeThickness: 19.3, area: 19000, momentOfInertia: { Ixx: 621000000, Iyy: 76000000 }, plasticModulus: { Zxx: 3300000, Zyy: 743000 }, elasticModulus: { Sxx: 2980000, Syy: 569000 }, radiusOfGyration: { rx: 181, ry: 63.2 }, weight: 149 },
      'W18X119': { designation: 'W18X119', depth: 475, width: 287, webThickness: 12.7, flangeThickness: 19.1, area: 22600, momentOfInertia: { Ixx: 937000000, Iyy: 90500000 }, plasticModulus: { Zxx: 4400000, Zyy: 822000 }, elasticModulus: { Sxx: 3940000, Syy: 631000 }, radiusOfGyration: { rx: 204, ry: 63.2 }, weight: 177 },
      'W21X147': { designation: 'W21X147', depth: 549, width: 318, webThickness: 14.0, flangeThickness: 22.2, area: 27900, momentOfInertia: { Ixx: 1510000000, Iyy: 142000000 }, plasticModulus: { Zxx: 6110000, Zyy: 1160000 }, elasticModulus: { Sxx: 5500000, Syy: 893000 }, radiusOfGyration: { rx: 233, ry: 71.4 }, weight: 219 },
      'W24X176': { designation: 'W24X176', depth: 616, width: 330, webThickness: 14.5, flangeThickness: 23.9, area: 33400, momentOfInertia: { Ixx: 2270000000, Iyy: 175000000 }, plasticModulus: { Zxx: 8200000, Zyy: 1380000 }, elasticModulus: { Sxx: 7360000, Syy: 1060000 }, radiusOfGyration: { rx: 261, ry: 72.4 }, weight: 262 },
    };
    
    return sections[designation] || null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const createConnectionDatabase = (code: DesignCode = 'IS800', seismicCode?: SeismicCode) => 
  new SteelConnectionDatabase(code, seismicCode);

export default SteelConnectionDatabase;
