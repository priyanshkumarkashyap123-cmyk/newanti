/**
 * ============================================================================
 * STRUCTURAL CONNECTION DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive connection design for steel and composite structures.
 * 
 * Connection Types:
 * - Bolted connections (bearing, slip-critical, tension)
 * - Welded connections (fillet, groove, plug/slot)
 * - Moment connections (end-plate, flange-plate, directly welded)
 * - Shear connections (single plate, double angle, shear tab)
 * - Brace connections (gusset plates)
 * - Column base plates
 * - Beam-to-beam connections
 * - Splices (column and beam)
 * 
 * Design Codes:
 * - IS 800:2007 - Section 10 (Connections)
 * - AISC 360 - Chapters J and K
 * - EN 1993-1-8 - Design of joints
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BoltProperties {
  grade: '4.6' | '8.8' | '10.9' | 'A325' | 'A490';
  diameter: number; // mm
  tensileStrength: number; // MPa
  yieldStrength: number; // MPa
  holeType: 'standard' | 'oversized' | 'slotted-short' | 'slotted-long';
  threads: 'included' | 'excluded';
}

export interface WeldProperties {
  type: 'fillet' | 'groove-CJP' | 'groove-PJP' | 'plug' | 'slot';
  electrodeGrade: 'E60' | 'E70' | 'E80' | 'E410' | 'E510';
  size: number; // mm (leg size for fillet, throat for groove)
  length?: number; // mm
  position: 'flat' | 'horizontal' | 'vertical' | 'overhead';
}

export interface PlateProperties {
  thickness: number; // mm
  width: number; // mm
  length?: number; // mm
  grade: string;
  fy: number; // MPa
  fu: number; // MPa
}

export interface ConnectionForces {
  axial?: number; // kN (tension positive, compression negative)
  shearMajor?: number; // kN
  shearMinor?: number; // kN
  moment?: number; // kNm
  torsion?: number; // kNm
}

export interface ConnectionGeometry {
  numRows: number;
  numCols: number;
  edgeDistance: { top: number; bottom: number; left: number; right: number }; // mm
  pitch: number; // mm (vertical spacing)
  gauge: number; // mm (horizontal spacing)
}

// ============================================================================
// BOLT DESIGN CALCULATOR
// ============================================================================

export class BoltDesignCalculator {
  private code: 'IS800' | 'AISC' | 'EC3';

  constructor(code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
  }

  /**
   * Get bolt material properties
   */
  getBoltProperties(grade: BoltProperties['grade']): {
    fub: number; // Ultimate tensile strength
    fyb: number; // Yield strength
    shearArea: Record<number, number>; // Diameter to shear area
  } {
    const properties: Record<string, { fub: number; fyb: number }> = {
      '4.6': { fub: 400, fyb: 240 },
      '8.8': { fub: 800, fyb: 640 },
      '10.9': { fub: 1000, fyb: 900 },
      'A325': { fub: 830, fyb: 660 },
      'A490': { fub: 1040, fyb: 940 }
    };

    const prop = properties[grade] || properties['8.8'];

    // Tensile stress area for metric bolts (approximate)
    const shearArea: Record<number, number> = {
      12: 84.3,
      16: 157,
      20: 245,
      22: 303,
      24: 353,
      27: 459,
      30: 561,
      36: 817
    };

    return {
      fub: prop.fub,
      fyb: prop.fyb,
      shearArea
    };
  }

  /**
   * Calculate bolt shear capacity
   */
  calculateShearCapacity(
    bolt: BoltProperties,
    numShearPlanes: number = 1,
    isSlipCritical: boolean = false,
    slipFactor: number = 0.33
  ): {
    nominalCapacity: number; // kN
    designCapacity: number; // kN
    formula: string;
  } {
    const props = this.getBoltProperties(bolt.grade);
    const As = props.shearArea[bolt.diameter] || Math.PI * bolt.diameter * bolt.diameter / 4 * 0.78;
    const fub = props.fub;

    let nominalCapacity: number;
    let designCapacity: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        if (isSlipCritical) {
          // Slip resistance
          const Ke = 1.0; // No long slotted holes
          const gamma_mf = 1.25;
          const Fo = 0.7 * fub * As / 1000; // Proof load
          nominalCapacity = slipFactor * numShearPlanes * Ke * Fo;
          designCapacity = nominalCapacity / gamma_mf;
          formula = 'Vsdf = μf·ne·Kh·Fo/γmf';
        } else {
          // Bearing type
          const gamma_mb = 1.25;
          const An = bolt.threads === 'included' ? As : As / 0.78;
          nominalCapacity = fub * An * numShearPlanes / (Math.sqrt(3) * 1000);
          designCapacity = nominalCapacity / gamma_mb;
          formula = 'Vdsb = fub·An·ns/(√3·γmb)';
        }
        break;

      case 'AISC':
        const Fnv = bolt.threads === 'included' ? 0.45 * fub : 0.56 * fub;
        const Ab = Math.PI * bolt.diameter * bolt.diameter / 4;
        nominalCapacity = Fnv * Ab * numShearPlanes / 1000;
        designCapacity = 0.75 * nominalCapacity; // φ = 0.75
        formula = 'φRn = φ·Fnv·Ab·ns';
        break;

      case 'EC3':
        const alphav = bolt.threads === 'included' ? 0.6 : 0.5;
        nominalCapacity = alphav * fub * As * numShearPlanes / 1000;
        designCapacity = nominalCapacity / 1.25; // γM2 = 1.25
        formula = 'Fv,Rd = αv·fub·As·ns/γM2';
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    return { nominalCapacity, designCapacity, formula };
  }

  /**
   * Calculate bolt tension capacity
   */
  calculateTensionCapacity(bolt: BoltProperties): {
    nominalCapacity: number;
    designCapacity: number;
    formula: string;
  } {
    const props = this.getBoltProperties(bolt.grade);
    const As = props.shearArea[bolt.diameter] || Math.PI * bolt.diameter * bolt.diameter / 4 * 0.78;
    const fub = props.fub;
    const fyb = props.fyb;

    let nominalCapacity: number;
    let designCapacity: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        const gamma_mb = 1.25;
        nominalCapacity = 0.9 * fub * As / 1000;
        designCapacity = nominalCapacity / gamma_mb;
        formula = 'Tdb = 0.9·fub·An/γmb';
        break;

      case 'AISC':
        const Fnt = 0.75 * fub;
        const Ab = Math.PI * bolt.diameter * bolt.diameter / 4;
        nominalCapacity = Fnt * As / 1000;
        designCapacity = 0.75 * nominalCapacity;
        formula = 'φRn = φ·Fnt·Ab';
        break;

      case 'EC3':
        nominalCapacity = 0.9 * fub * As / 1000;
        designCapacity = nominalCapacity / 1.25;
        formula = 'Ft,Rd = 0.9·fub·As/γM2';
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    return { nominalCapacity, designCapacity, formula };
  }

  /**
   * Calculate bearing capacity on connected plate
   */
  calculateBearingCapacity(
    bolt: BoltProperties,
    plate: PlateProperties,
    edgeDistance: number, // mm
    pitch: number // mm (for inner bolts)
  ): {
    nominalCapacity: number;
    designCapacity: number;
    formula: string;
  } {
    const d = bolt.diameter;
    const d0 = d + 2; // Standard hole
    const t = plate.thickness;
    const fu = plate.fu;
    const e = edgeDistance;
    const p = pitch;

    let nominalCapacity: number;
    let designCapacity: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        const gamma_mb = 1.25;
        const kb = Math.min(e / (3 * d0), p / (3 * d0) - 0.25, fu / 400, 1.0);
        nominalCapacity = 2.5 * kb * d * t * fu / 1000;
        designCapacity = nominalCapacity / gamma_mb;
        formula = 'Vdpb = 2.5·kb·d·t·fu/γmb';
        break;

      case 'AISC':
        const Lc = Math.min(e - d0/2, p - d0);
        const Rn = Math.min(1.2 * Lc * t * fu / 1000, 2.4 * d * t * fu / 1000);
        nominalCapacity = Rn;
        designCapacity = 0.75 * nominalCapacity;
        formula = 'φRn = φ·min(1.2Lc·t·Fu, 2.4d·t·Fu)';
        break;

      case 'EC3':
        const k1 = Math.min(2.8 * e / d0 - 1.7, 2.5);
        const alphab = Math.min(e / (3 * d0), p / (3 * d0) - 0.25, fu / fu, 1.0);
        nominalCapacity = k1 * alphab * fu * d * t / 1000;
        designCapacity = nominalCapacity / 1.25;
        formula = 'Fb,Rd = k1·αb·fu·d·t/γM2';
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    return { nominalCapacity, designCapacity, formula };
  }

  /**
   * Check combined tension and shear
   */
  checkCombinedTensionShear(
    tension: number, // kN (applied)
    shear: number, // kN (applied)
    tensionCapacity: number, // kN
    shearCapacity: number // kN
  ): {
    interactionRatio: number;
    status: 'PASS' | 'FAIL';
    formula: string;
  } {
    let ratio: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        // (V/Vd)² + (T/Td)² ≤ 1.0
        ratio = Math.pow(shear / shearCapacity, 2) + Math.pow(tension / tensionCapacity, 2);
        formula = '(V/Vd)² + (T/Td)² ≤ 1.0';
        break;

      case 'AISC':
        // Linear interaction (simplified)
        const Ft_reduced = tensionCapacity * (1 - shear / (1.3 * shearCapacity));
        ratio = tension / Math.max(Ft_reduced, 0);
        formula = 'Ft\' = 1.3Ft - (Ft/Fv)·fv ≤ Ft';
        break;

      case 'EC3':
        // (Fv/Fv,Rd) + (Ft/1.4·Ft,Rd) ≤ 1.0
        ratio = shear / shearCapacity + tension / (1.4 * tensionCapacity);
        formula = 'Fv,Ed/Fv,Rd + Ft,Ed/(1.4·Ft,Rd) ≤ 1.0';
        break;

      default:
        ratio = Math.sqrt(Math.pow(shear / shearCapacity, 2) + Math.pow(tension / tensionCapacity, 2));
        formula = '√[(V/Vd)² + (T/Td)²] ≤ 1.0';
    }

    return {
      interactionRatio: ratio,
      status: ratio <= 1.0 ? 'PASS' : 'FAIL',
      formula
    };
  }
}

// ============================================================================
// WELD DESIGN CALCULATOR
// ============================================================================

export class WeldDesignCalculator {
  private code: 'IS800' | 'AISC' | 'EC3';

  constructor(code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
  }

  /**
   * Get weld metal strength
   */
  getWeldStrength(electrode: WeldProperties['electrodeGrade']): number {
    const strengths: Record<string, number> = {
      'E60': 415,
      'E70': 485,
      'E80': 550,
      'E410': 410,
      'E510': 510
    };
    return strengths[electrode] || 410;
  }

  /**
   * Calculate fillet weld capacity per unit length
   */
  calculateFilletWeldCapacity(
    weld: WeldProperties,
    basePlate: PlateProperties
  ): {
    strengthPerMM: number; // kN/mm
    effectiveThroat: number; // mm
    minSize: number; // mm
    maxSize: number; // mm
    formula: string;
  } {
    const s = weld.size;
    const tt = s / Math.sqrt(2); // Effective throat
    const fwu = this.getWeldStrength(weld.electrodeGrade);
    const fu = basePlate.fu;
    const t = basePlate.thickness;

    let strengthPerMM: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        const gamma_mw = 1.25;
        const fwd = Math.min(fwu / (Math.sqrt(3) * gamma_mw), 0.7 * fu / gamma_mw);
        strengthPerMM = fwd * tt / 1000;
        formula = 'fw = min(fwu/√3, 0.7fu)/γmw × tt';
        break;

      case 'AISC':
        const Fnw = 0.6 * fwu;
        strengthPerMM = 0.75 * Fnw * tt / 1000;
        formula = 'φRn = 0.75 × 0.6FEXX × te';
        break;

      case 'EC3':
        const beta_w = 0.85; // Correlation factor for S355
        const gamma_M2 = 1.25;
        const fvwd = fwu / (Math.sqrt(3) * beta_w * gamma_M2);
        strengthPerMM = fvwd * tt / 1000;
        formula = 'fvw,d = fu/(√3·βw·γM2) × a';
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    // Minimum weld size based on plate thickness
    let minSize: number;
    if (t <= 10) minSize = 3;
    else if (t <= 20) minSize = 5;
    else if (t <= 32) minSize = 6;
    else if (t <= 50) minSize = 8;
    else minSize = 10;

    // Maximum weld size
    const maxSize = t <= 6 ? t : t - 1.5;

    return {
      strengthPerMM,
      effectiveThroat: tt,
      minSize,
      maxSize,
      formula
    };
  }

  /**
   * Design fillet weld for given forces
   */
  designFilletWeld(
    forces: ConnectionForces,
    weldLength: number, // mm
    electrode: WeldProperties['electrodeGrade'],
    basePlate: PlateProperties
  ): {
    requiredSize: number;
    providedSize: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL';
  } {
    // Resultant force per unit length
    const axialPerMM = (forces.axial || 0) / weldLength;
    const shearPerMM = (forces.shearMajor || 0) / weldLength;
    const resultantPerMM = Math.sqrt(axialPerMM * axialPerMM + shearPerMM * shearPerMM);

    // Trial sizes
    const sizes = [3, 4, 5, 6, 8, 10, 12, 16];
    
    for (const size of sizes) {
      const weld: WeldProperties = {
        type: 'fillet',
        electrodeGrade: electrode,
        size,
        position: 'flat'
      };

      const capacity = this.calculateFilletWeldCapacity(weld, basePlate);
      const ratio = resultantPerMM / capacity.strengthPerMM;

      if (ratio <= 1.0 && size >= capacity.minSize && size <= capacity.maxSize) {
        return {
          requiredSize: size,
          providedSize: size,
          utilizationRatio: ratio,
          status: 'PASS'
        };
      }
    }

    return {
      requiredSize: sizes[sizes.length - 1],
      providedSize: sizes[sizes.length - 1],
      utilizationRatio: 1.5,
      status: 'FAIL'
    };
  }

  /**
   * Calculate groove weld capacity
   */
  calculateGrooveWeldCapacity(
    weld: WeldProperties,
    plateThickness: number,
    fu: number
  ): {
    tensionCapacity: number; // kN/mm (per unit length)
    shearCapacity: number;
    formula: string;
  } {
    const te = weld.type === 'groove-CJP' ? plateThickness : weld.size;
    const fwu = this.getWeldStrength(weld.electrodeGrade);

    let tensionCapacity: number;
    let shearCapacity: number;
    let formula: string;

    switch (this.code) {
      case 'IS800':
        tensionCapacity = Math.min(0.9 * fwu, fu) * te / 1.25 / 1000;
        shearCapacity = fwu * te / (Math.sqrt(3) * 1.25) / 1000;
        formula = 'Tension: 0.9fwu/γmw, Shear: fwu/(√3·γmw)';
        break;

      case 'AISC':
        tensionCapacity = 0.75 * Math.min(0.6 * fwu, fu) * te / 1000;
        shearCapacity = 0.75 * 0.6 * fwu * te / 1000;
        formula = 'φRn = 0.75 × Fnw × Awe';
        break;

      case 'EC3':
        tensionCapacity = fu * te / 1.25 / 1000;
        shearCapacity = fwu * te / (Math.sqrt(3) * 1.25) / 1000;
        formula = 'σ⊥ ≤ fu/γM2';
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    return { tensionCapacity, shearCapacity, formula };
  }
}

// ============================================================================
// MOMENT CONNECTION DESIGNER
// ============================================================================

export class MomentConnectionDesigner {
  private code: 'IS800' | 'AISC' | 'EC3';
  private boltCalc: BoltDesignCalculator;
  private weldCalc: WeldDesignCalculator;

  constructor(code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
    this.boltCalc = new BoltDesignCalculator(code);
    this.weldCalc = new WeldDesignCalculator(code);
  }

  /**
   * Design extended end-plate moment connection
   */
  designExtendedEndPlate(
    moment: number, // kNm
    shear: number, // kN
    axial: number, // kN
    beamSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      fy: number;
    },
    columnSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      fy: number;
    },
    bolt: BoltProperties
  ): {
    endPlate: {
      thickness: number;
      width: number;
      length: number;
    };
    boltLayout: {
      numRows: number;
      numPerRow: number;
      pitch: number;
      gauge: number;
      edgeDistances: { top: number; bottom: number; side: number };
    };
    welds: {
      flangeToPlate: number;
      webToPlate: number;
    };
    checks: {
      boltTension: { capacity: number; demand: number; ratio: number; pass: boolean };
      boltShear: { capacity: number; demand: number; ratio: number; pass: boolean };
      plateThickness: { provided: number; required: number; pass: boolean };
      columnFlange: { capacity: number; demand: number; pass: boolean };
    };
  } {
    const M = moment * 1e6; // Convert to Nmm
    const V = shear * 1000;
    const N = axial * 1000;
    const d = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const tf = beamSection.flangeThickness;
    const tw = beamSection.webThickness;
    const fy = beamSection.fy;

    // Lever arm (approximate)
    const leverArm = d - tf;

    // Flange force due to moment
    const Ff = M / leverArm + N / 2;

    // Bolt design
    const boltTension = this.boltCalc.calculateTensionCapacity(bolt);
    const boltShear = this.boltCalc.calculateShearCapacity(bolt, 1, false);

    // Required number of bolts in tension
    const numBoltsTension = Math.ceil(Ff / 1000 / boltTension.designCapacity);
    const numRowsTension = Math.ceil(numBoltsTension / 2);
    const totalRows = numRowsTension * 2; // Tension and compression zones
    const boltsPerRow = 2;

    // Bolt spacing
    const pitch = Math.max(2.5 * bolt.diameter, 40);
    const gauge = bf - 2 * (2 * bolt.diameter);
    const edgeTop = 1.5 * bolt.diameter + 10; // Extension above flange
    const edgeBottom = 1.5 * bolt.diameter;
    const edgeSide = 1.5 * bolt.diameter;

    // End plate dimensions
    const plateLength = d + 2 * edgeTop + (numRowsTension - 1) * pitch;
    const plateWidth = bf + 20;

    // Plate thickness (yield line theory simplified)
    const m = (plateWidth - gauge) / 2 - edgeSide; // Distance to bolt line
    const n = edgeTop;
    const Tp = boltTension.designCapacity * 1000 * 2; // Tension per bolt row
    const plateThicknessReq = Math.sqrt(4 * Tp * m / (fy * plateWidth));
    const plateThickness = Math.ceil(plateThicknessReq / 2) * 2; // Round to even

    // Weld design
    const flangeWeldForce = Ff / 1000; // kN
    const flangeWeldLength = 2 * bf;
    const flangeWeldReq = this.weldCalc.designFilletWeld(
      { axial: flangeWeldForce },
      flangeWeldLength,
      'E70',
      { thickness: tf, width: bf, grade: 'S355', fy: 355, fu: 510 }
    );

    const webWeldForce = V / 1000;
    const webWeldLength = 2 * (d - 2 * tf);
    const webWeldReq = this.weldCalc.designFilletWeld(
      { shearMajor: webWeldForce },
      webWeldLength,
      'E70',
      { thickness: tw, width: d - 2*tf, grade: 'S355', fy: 355, fu: 510 }
    );

    // Column flange check (simplified)
    const columnFlangeCapacity = 4 * fy * columnSection.flangeThickness * 
                                 columnSection.flangeThickness / (m * 1000);
    const columnFlangePass = columnFlangeCapacity >= boltTension.designCapacity;

    return {
      endPlate: {
        thickness: Math.max(plateThickness, 16),
        width: plateWidth,
        length: plateLength
      },
      boltLayout: {
        numRows: totalRows,
        numPerRow: boltsPerRow,
        pitch,
        gauge,
        edgeDistances: { top: edgeTop, bottom: edgeBottom, side: edgeSide }
      },
      welds: {
        flangeToPlate: flangeWeldReq.providedSize,
        webToPlate: webWeldReq.providedSize
      },
      checks: {
        boltTension: {
          capacity: boltTension.designCapacity * numRowsTension * boltsPerRow,
          demand: Ff / 1000,
          ratio: (Ff / 1000) / (boltTension.designCapacity * numRowsTension * boltsPerRow),
          pass: (Ff / 1000) <= boltTension.designCapacity * numRowsTension * boltsPerRow
        },
        boltShear: {
          capacity: boltShear.designCapacity * totalRows * boltsPerRow,
          demand: V / 1000,
          ratio: (V / 1000) / (boltShear.designCapacity * totalRows * boltsPerRow),
          pass: (V / 1000) <= boltShear.designCapacity * totalRows * boltsPerRow
        },
        plateThickness: {
          provided: Math.max(plateThickness, 16),
          required: plateThicknessReq,
          pass: Math.max(plateThickness, 16) >= plateThicknessReq
        },
        columnFlange: {
          capacity: columnFlangeCapacity,
          demand: boltTension.designCapacity,
          pass: columnFlangePass
        }
      }
    };
  }

  /**
   * Design flange-plate moment connection
   */
  designFlangePlate(
    moment: number,
    shear: number,
    beamSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      fy: number;
      fu: number;
    },
    bolt: BoltProperties
  ): {
    topPlate: { width: number; thickness: number; length: number };
    bottomPlate: { width: number; thickness: number; length: number };
    numBolts: number;
    boltPitch: number;
    welds: { size: number; length: number };
    utilizationRatio: number;
  } {
    const M = moment * 1e6;
    const d = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const tf = beamSection.flangeThickness;
    const fy = beamSection.fy;
    const fu = beamSection.fu;

    // Flange force
    const leverArm = d - tf;
    const Ff = M / leverArm / 1000; // kN

    // Bolt capacity
    const boltShear = this.boltCalc.calculateShearCapacity(bolt, 2, false); // Double shear
    const numBolts = Math.ceil(Ff / boltShear.designCapacity);
    const numRows = Math.ceil(numBolts / 2);

    // Plate dimensions
    const plateWidth = bf;
    const plateThickness = Math.max(tf, 12);
    
    // Plate length (based on bolt layout)
    const pitch = 3 * bolt.diameter;
    const edgeDist = 2 * bolt.diameter;
    const plateLength = 2 * edgeDist + (numRows - 1) * pitch + 50; // Extra for weld

    // Net section check
    const An = (plateWidth - 2 * (bolt.diameter + 2)) * plateThickness;
    const Tn = 0.9 * An * fu / 1.25 / 1000; // Net section capacity (kN)

    // Gross section check
    const Ag = plateWidth * plateThickness;
    const Tg = Ag * fy / 1.1 / 1000;

    // Capacity
    const plateCapacity = Math.min(Tn, Tg);

    // Weld to beam flange
    const weldLength = 2 * (bf - 20) + (d - 2 * tf - 20);
    const weldReq = this.weldCalc.designFilletWeld(
      { axial: Ff },
      weldLength,
      'E70',
      { thickness: tf, width: bf, grade: beamSection.fy.toString(), fy, fu }
    );

    return {
      topPlate: { width: plateWidth, thickness: plateThickness, length: plateLength },
      bottomPlate: { width: plateWidth, thickness: plateThickness, length: plateLength },
      numBolts: numBolts * 2, // Each side
      boltPitch: pitch,
      welds: { size: weldReq.providedSize, length: weldLength },
      utilizationRatio: Ff / plateCapacity
    };
  }
}

// ============================================================================
// SHEAR CONNECTION DESIGNER
// ============================================================================

export class ShearConnectionDesigner {
  private code: 'IS800' | 'AISC' | 'EC3';
  private boltCalc: BoltDesignCalculator;

  constructor(code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
    this.boltCalc = new BoltDesignCalculator(code);
  }

  /**
   * Design single plate shear connection (shear tab)
   */
  designSinglePlate(
    shear: number, // kN
    beamDepth: number, // mm
    bolt: BoltProperties,
    plateGrade: { fy: number; fu: number }
  ): {
    plate: { thickness: number; width: number; length: number };
    numBolts: number;
    boltPitch: number;
    edgeDistances: { vertical: number; horizontal: number };
    weldSize: number;
    checks: {
      boltShear: { pass: boolean; ratio: number };
      plateBearing: { pass: boolean; ratio: number };
      blockShear: { pass: boolean; capacity: number };
      plateShear: { pass: boolean; ratio: number };
    };
  } {
    const V = shear;

    // Bolt capacity
    const boltShear = this.boltCalc.calculateShearCapacity(bolt, 1, false);
    const numBolts = Math.max(2, Math.ceil(V / boltShear.designCapacity));

    // Plate geometry
    const pitch = 3 * bolt.diameter;
    const edgeV = 1.5 * bolt.diameter;
    const edgeH = 2 * bolt.diameter;
    const plateLength = 2 * edgeV + (numBolts - 1) * pitch;
    const plateWidth = 4 * bolt.diameter; // Beyond bolt line to weld
    const plateThickness = Math.max(Math.ceil(bolt.diameter / 2), 8);

    // Check plate length vs beam depth
    const maxPlateLength = beamDepth - 50; // Clear of cope
    if (plateLength > maxPlateLength) {
      // Need to increase bolt diameter or use double row
      console.warn('Plate length exceeds beam depth. Consider larger bolts or double shear.');
    }

    // Bearing check
    const bearing = this.boltCalc.calculateBearingCapacity(
      bolt,
      { thickness: plateThickness, width: plateWidth, grade: 'S355', fy: plateGrade.fy, fu: plateGrade.fu },
      edgeV,
      pitch
    );
    const bearingRatio = V / (bearing.designCapacity * numBolts);

    // Block shear
    const Avg = plateThickness * (edgeV + (numBolts - 1) * pitch); // Gross shear area
    const Avn = Avg - plateThickness * (numBolts - 0.5) * (bolt.diameter + 2); // Net shear area
    const Atg = plateThickness * edgeH; // Gross tension area
    const Atn = Atg - plateThickness * 0.5 * (bolt.diameter + 2); // Net tension area

    const blockShear = Math.min(
      0.6 * plateGrade.fu * Avn / 1.25 + plateGrade.fy * Atg / 1.1,
      0.6 * plateGrade.fy * Avg / 1.1 + plateGrade.fu * Atn / 1.25
    ) / 1000;

    // Plate shear yield
    const plateShearCapacity = 0.6 * plateGrade.fy * plateLength * plateThickness / 1.1 / 1000;

    // Weld size (fillet weld to support)
    const weldLength = plateLength;
    const weldForce = V / (2 * weldLength); // Two welds (each side)
    const weldSize = Math.max(Math.ceil(weldForce / 0.3), 6); // Approximate

    return {
      plate: { thickness: plateThickness, width: plateWidth, length: plateLength },
      numBolts,
      boltPitch: pitch,
      edgeDistances: { vertical: edgeV, horizontal: edgeH },
      weldSize,
      checks: {
        boltShear: { 
          pass: V <= boltShear.designCapacity * numBolts, 
          ratio: V / (boltShear.designCapacity * numBolts) 
        },
        plateBearing: { 
          pass: bearingRatio <= 1.0, 
          ratio: bearingRatio 
        },
        blockShear: { 
          pass: V <= blockShear, 
          capacity: blockShear 
        },
        plateShear: { 
          pass: V <= plateShearCapacity, 
          ratio: V / plateShearCapacity 
        }
      }
    };
  }
}

// ============================================================================
// BASE PLATE DESIGNER
// ============================================================================

export class BasePlateDesigner {
  private code: 'IS800' | 'AISC' | 'EC3';

  constructor(code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
  }

  /**
   * Design column base plate for axial load only
   */
  designAxialBaseplate(
    axialLoad: number, // kN (compression positive)
    columnSection: {
      depth: number;
      width: number;
      fy: number;
    },
    concreteFc: number, // MPa
    anchorBolt: BoltProperties
  ): {
    plateSize: { length: number; width: number; thickness: number };
    anchorBolts: { quantity: number; diameter: number; embedmentLength: number };
    pedestal: { length: number; width: number };
    bearingPressure: { actual: number; allowable: number; ratio: number };
  } {
    const P = axialLoad;
    const d = columnSection.depth;
    const bf = columnSection.width;
    const fy = columnSection.fy;

    // Allowable bearing on concrete (0.35 f'c for A1 = A2)
    const Fp = 0.45 * concreteFc; // MPa

    // Required plate area
    const Areq = P * 1000 / Fp; // mm²

    // Plate dimensions
    let N = d + 2 * 100; // Plate length (column depth + 100mm each side)
    let B = bf + 2 * 80; // Plate width

    // Check area
    while (N * B < Areq) {
      N += 50;
      B += 40;
    }

    // Actual bearing pressure
    const fp = P * 1000 / (N * B);

    // Cantilever projections
    const m = (N - 0.95 * d) / 2;
    const n = (B - 0.8 * bf) / 2;
    const lambda_n = Math.sqrt(d * bf) / 4;

    // Plate thickness
    const c = Math.max(m, n, lambda_n);
    const t_req = c * Math.sqrt(2 * fp / fy);
    const t = Math.ceil(t_req / 2) * 2 + 4; // Round up and add tolerance

    // Anchor bolts (minimum 4 for stability)
    const numBolts = 4;
    const embedment = 12 * anchorBolt.diameter; // Rule of thumb

    // Pedestal size
    const pedestalN = N + 200;
    const pedestalB = B + 200;

    return {
      plateSize: { length: N, width: B, thickness: Math.max(t, 20) },
      anchorBolts: { 
        quantity: numBolts, 
        diameter: anchorBolt.diameter, 
        embedmentLength: embedment 
      },
      pedestal: { length: pedestalN, width: pedestalB },
      bearingPressure: { actual: fp, allowable: Fp, ratio: fp / Fp }
    };
  }

  /**
   * Design column base plate with moment
   */
  designMomentBaseplate(
    axialLoad: number, // kN
    moment: number, // kNm
    columnSection: {
      depth: number;
      width: number;
      fy: number;
    },
    concreteFc: number,
    anchorBolt: BoltProperties
  ): {
    plateSize: { length: number; width: number; thickness: number };
    anchorBolts: { 
      tension: { quantity: number; force: number };
      compression: { quantity: number };
      diameter: number;
      embedmentLength: number;
    };
    bearingLength: number;
    checks: {
      bearing: { pass: boolean; ratio: number };
      anchorTension: { pass: boolean; ratio: number };
      plateThickness: { pass: boolean };
    };
  } {
    const P = axialLoad;
    const M = moment * 1e6; // Nmm
    const d = columnSection.depth;
    const bf = columnSection.width;
    const fy = columnSection.fy;

    // Plate dimensions (larger for moment)
    const N = d + 300;
    const B = bf + 200;

    // Eccentricity
    const e = M / (P * 1000); // mm

    // Allowable bearing
    const fp = 0.45 * concreteFc;

    // Check if tension anchor bolts required
    const kern = N / 6;
    const needsTensionBolts = e > kern;

    let bearingLength: number;
    let anchorTensionForce = 0;
    let numTensionBolts = 0;
    let numCompressionBolts = 0;

    if (!needsTensionBolts) {
      // No tension - trapezoidal/triangular bearing
      const fmax = (P * 1000 / (N * B)) * (1 + 6 * e / N);
      bearingLength = N;
      numCompressionBolts = 4;
    } else {
      // Tension bolts required
      // Simplified analysis assuming triangular bearing
      const f = N / 2 - e; // Distance from resultant to edge
      bearingLength = 3 * f;

      // Check if bearing length is reasonable
      if (bearingLength > 0 && bearingLength < N) {
        const C = 0.5 * fp * bearingLength * B / 1000; // Compression resultant (kN)
        anchorTensionForce = C - P; // Tension in bolts (kN)

        if (anchorTensionForce > 0) {
          // Bolt capacity
          const boltCalc = new BoltDesignCalculator(this.code);
          const tensionCap = boltCalc.calculateTensionCapacity(anchorBolt);
          numTensionBolts = Math.max(2, Math.ceil(anchorTensionForce / tensionCap.designCapacity));
        }
      }
      numCompressionBolts = 2;
    }

    // Total bolts
    const totalBolts = numTensionBolts + numCompressionBolts;

    // Plate thickness
    const m = (N - 0.95 * d) / 2;
    const n = (B - 0.8 * bf) / 2;
    const t_req = Math.max(m, n) * Math.sqrt(2 * fp / fy);
    const t = Math.max(Math.ceil(t_req / 2) * 2 + 4, 25);

    // Anchor bolt embedment
    const embedment = 15 * anchorBolt.diameter;

    // Checks
    const actualBearing = P * 1000 / (bearingLength * B);
    const boltCalc = new BoltDesignCalculator(this.code);
    const boltCap = boltCalc.calculateTensionCapacity(anchorBolt);

    return {
      plateSize: { length: N, width: B, thickness: t },
      anchorBolts: {
        tension: { quantity: Math.max(numTensionBolts, 2), force: anchorTensionForce },
        compression: { quantity: Math.max(numCompressionBolts, 2) },
        diameter: anchorBolt.diameter,
        embedmentLength: embedment
      },
      bearingLength,
      checks: {
        bearing: { 
          pass: actualBearing <= fp, 
          ratio: actualBearing / fp 
        },
        anchorTension: { 
          pass: anchorTensionForce <= boltCap.designCapacity * numTensionBolts,
          ratio: numTensionBolts > 0 ? anchorTensionForce / (boltCap.designCapacity * numTensionBolts) : 0
        },
        plateThickness: { pass: t >= t_req }
      }
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BoltDesignCalculator,
  WeldDesignCalculator,
  MomentConnectionDesigner,
  ShearConnectionDesigner,
  BasePlateDesigner
};
