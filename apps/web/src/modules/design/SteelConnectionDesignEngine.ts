/**
 * ============================================================================
 * STEEL CONNECTION DESIGN ENGINE
 * ============================================================================
 * 
 * Comprehensive steel connection design and analysis capabilities.
 * 
 * Connection Types:
 * - Bolted connections (bearing, slip-critical, tension)
 * - Welded connections (fillet, groove, CJP, PJP)
 * - Moment connections (fully restrained, partially restrained)
 * - Shear connections (simple, extended)
 * - Bracing connections
 * - Column splices
 * - Base plates and anchor bolts
 * 
 * Design Codes:
 * - IS 800:2007 - General construction in steel
 * - AISC 360-22 - Specification for Structural Steel Buildings
 * - AISC 358 - Prequalified Connections for Special and Intermediate Moment Frames
 * - EN 1993-1-8 (Eurocode 3) - Design of joints
 * - BS 5950 - Structural use of steelwork in building
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BoltProperties {
  grade: '4.6' | '8.8' | '10.9' | 'A325' | 'A490' | 'A307';
  diameter: number; // mm
  holeType: 'standard' | 'oversized' | 'short-slotted' | 'long-slotted';
  threads: 'included' | 'excluded'; // In shear plane
  pretensioned: boolean;
}

export interface WeldProperties {
  type: 'fillet' | 'groove' | 'CJP' | 'PJP' | 'plug' | 'slot';
  electrode: 'E70' | 'E80' | 'E90' | 'E110' | 'E410' | 'E480';
  size: number; // mm (leg size for fillet, throat for groove)
  length: number; // mm
  position: 'flat' | 'horizontal' | 'vertical' | 'overhead';
}

export interface PlateProperties {
  thickness: number; // mm
  width: number; // mm
  height?: number; // mm
  grade: 'E250' | 'E350' | 'E410' | 'A36' | 'A572-50' | 'S275' | 'S355';
  fy: number; // MPa
  fu: number; // MPa
}

export interface ConnectionGeometry {
  type: 'single-shear' | 'double-shear' | 'tension' | 'combined';
  boltPattern: {
    rows: number;
    columns: number;
    gaugeDistance: number; // mm (transverse)
    pitch: number; // mm (longitudinal)
    edgeDistanceX: number; // mm
    edgeDistanceY: number; // mm
  };
  weldPattern?: {
    configuration: 'all-around' | 'longitudinal' | 'transverse' | 'combined';
    segments: { length: number; location: string }[];
  };
}

export interface ConnectionForces {
  axial: number; // kN (+ tension, - compression)
  shearX: number; // kN
  shearY: number; // kN
  moment: number; // kNm
  torsion?: number; // kNm
}

export type DesignCode = 'IS800' | 'AISC360' | 'EC3' | 'BS5950';

// ============================================================================
// BOLT STRENGTH DATABASE
// ============================================================================

const BOLT_PROPERTIES: Record<string, { fyb: number; fub: number }> = {
  '4.6': { fyb: 240, fub: 400 },
  '8.8': { fyb: 640, fub: 800 },
  '10.9': { fyb: 900, fub: 1000 },
  'A325': { fyb: 660, fub: 830 },
  'A490': { fyb: 940, fub: 1040 },
  'A307': { fyb: 250, fub: 415 }
};

const BOLT_AREAS: Record<number, { gross: number; tensile: number }> = {
  12: { gross: 113, tensile: 84.3 },
  16: { gross: 201, tensile: 157 },
  20: { gross: 314, tensile: 245 },
  22: { gross: 380, tensile: 303 },
  24: { gross: 452, tensile: 353 },
  27: { gross: 573, tensile: 459 },
  30: { gross: 707, tensile: 561 },
  36: { gross: 1018, tensile: 817 }
};

const WELD_STRENGTH: Record<string, number> = {
  'E70': 480, // MPa (70 ksi)
  'E80': 550,
  'E90': 620,
  'E110': 760,
  'E410': 410, // IS electrode
  'E480': 480
};

// ============================================================================
// BOLTED CONNECTION DESIGNER
// ============================================================================

export class BoltedConnectionDesigner {
  private code: DesignCode;

  constructor(code: DesignCode = 'IS800') {
    this.code = code;
  }

  /**
   * Calculate single bolt capacity
   */
  singleBoltCapacity(
    bolt: BoltProperties,
    plates: { t1: number; t2: number; fu1: number; fu2: number },
    connectionType: 'bearing' | 'slip-critical'
  ): {
    shearCapacity: number;
    bearingCapacity: number;
    tensionCapacity: number;
    combinedCapacity: { shear: number; tension: number };
    governingCapacity: number;
  } {
    const d = bolt.diameter;
    const boltProps = BOLT_PROPERTIES[bolt.grade];
    const areas = BOLT_AREAS[d] || { gross: Math.PI * d * d / 4, tensile: 0.78 * Math.PI * d * d / 4 };

    let shearCapacity: number;
    let bearingCapacity: number;
    let tensionCapacity: number;

    switch (this.code) {
      case 'IS800':
        shearCapacity = this.is800ShearCapacity(bolt, boltProps, areas);
        bearingCapacity = this.is800BearingCapacity(bolt, plates);
        tensionCapacity = this.is800TensionCapacity(bolt, boltProps, areas);
        break;

      case 'AISC360':
        shearCapacity = this.aiscShearCapacity(bolt, boltProps, areas, connectionType);
        bearingCapacity = this.aiscBearingCapacity(bolt, plates);
        tensionCapacity = this.aiscTensionCapacity(bolt, boltProps, areas);
        break;

      case 'EC3':
        shearCapacity = this.ec3ShearCapacity(bolt, boltProps, areas);
        bearingCapacity = this.ec3BearingCapacity(bolt, plates);
        tensionCapacity = this.ec3TensionCapacity(bolt, boltProps, areas);
        break;

      default:
        throw new Error(`Unsupported code: ${this.code}`);
    }

    // Combined shear-tension interaction
    const combinedCapacity = {
      shear: shearCapacity * 0.7, // Reduced for interaction
      tension: tensionCapacity * 0.7
    };

    return {
      shearCapacity,
      bearingCapacity,
      tensionCapacity,
      combinedCapacity,
      governingCapacity: Math.min(shearCapacity, bearingCapacity)
    };
  }

  private is800ShearCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number }
  ): number {
    const nn = bolt.threads === 'included' ? 1 : 0;
    const ns = bolt.threads === 'excluded' ? 1 : 0;
    const Anb = areas.tensile;
    const Asb = areas.gross;
    const gammaMb = 1.25;

    // Vnsb = fub * (nn * Anb + ns * Asb) / (√3 * γmb)
    const Vnsb = props.fub * (nn * Anb + ns * Asb) / (Math.sqrt(3) * gammaMb) / 1000;
    return Vnsb;
  }

  private is800BearingCapacity(
    bolt: BoltProperties,
    plates: { t1: number; t2: number; fu1: number; fu2: number }
  ): number {
    const d = bolt.diameter;
    const t = Math.min(plates.t1, plates.t2);
    const fu = Math.min(plates.fu1, plates.fu2);
    const gammaMb = 1.25;

    // Kb factors (simplified)
    const kb = 0.5; // Conservative

    // Vnpb = 2.5 * kb * d * t * fu / γmb
    const Vnpb = 2.5 * kb * d * t * fu / gammaMb / 1000;
    return Vnpb;
  }

  private is800TensionCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number }
  ): number {
    const Asb = areas.tensile;
    const gammaMb = 1.25;
    const gammaMo = 1.1;

    // Tnb = 0.9 * fub * Asb / γmb  (tension rupture)
    // Tnd = fyb * Asb * (γmb/γmo) / γmb  (yielding)
    const Tnb = 0.9 * props.fub * Asb / gammaMb / 1000;
    const Tnd = props.fyb * Asb * (gammaMb / gammaMo) / gammaMb / 1000;

    return Math.min(Tnb, Tnd);
  }

  private aiscShearCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number },
    connectionType: 'bearing' | 'slip-critical'
  ): number {
    const Ab = areas.gross;
    const phi = 0.75;

    if (connectionType === 'slip-critical') {
      // Slip-critical
      const mu = 0.30; // Class A surface
      const Du = 1.13;
      const hf = 1.0;
      const Tb = bolt.grade === 'A325' ? 0.7 * props.fub * areas.tensile / 1000 :
                 bolt.grade === 'A490' ? 0.7 * props.fub * areas.tensile / 1000 : 0;
      const ns = 1;

      return phi * mu * Du * hf * Tb * ns;
    }

    // Bearing-type
    const Fnv = bolt.threads === 'included' ? 0.45 * props.fub : 0.563 * props.fub;
    return phi * Fnv * Ab / 1000;
  }

  private aiscBearingCapacity(
    bolt: BoltProperties,
    plates: { t1: number; t2: number; fu1: number; fu2: number }
  ): number {
    const d = bolt.diameter;
    const t = Math.min(plates.t1, plates.t2);
    const Fu = Math.min(plates.fu1, plates.fu2);
    const phi = 0.75;

    // Rn = 2.4 * d * t * Fu (without deformation consideration)
    return phi * 2.4 * d * t * Fu / 1000;
  }

  private aiscTensionCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number }
  ): number {
    const Ab = areas.gross;
    const phi = 0.75;
    const Fnt = 0.75 * props.fub;

    return phi * Fnt * Ab / 1000;
  }

  private ec3ShearCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number }
  ): number {
    const As = bolt.threads === 'included' ? areas.tensile : areas.gross;
    const alphav = bolt.threads === 'included' ? 0.6 : 0.6;
    const gammaM2 = 1.25;

    return alphav * props.fub * As / gammaM2 / 1000;
  }

  private ec3BearingCapacity(
    bolt: BoltProperties,
    plates: { t1: number; t2: number; fu1: number; fu2: number }
  ): number {
    const d = bolt.diameter;
    const t = Math.min(plates.t1, plates.t2);
    const fu = Math.min(plates.fu1, plates.fu2);
    const gammaM2 = 1.25;
    const k1 = 2.5;
    const alphab = 0.6; // Simplified

    return k1 * alphab * fu * d * t / gammaM2 / 1000;
  }

  private ec3TensionCapacity(
    bolt: BoltProperties,
    props: { fyb: number; fub: number },
    areas: { gross: number; tensile: number }
  ): number {
    const As = areas.tensile;
    const gammaM2 = 1.25;
    const k2 = 0.9;

    return k2 * props.fub * As / gammaM2 / 1000;
  }

  /**
   * Design bolt group for applied forces
   */
  designBoltGroup(
    forces: ConnectionForces,
    bolt: BoltProperties,
    geometry: ConnectionGeometry,
    plates: { t1: number; t2: number; fu1: number; fu2: number }
  ): {
    totalBolts: number;
    maxBoltForce: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL';
    boltForces: { row: number; col: number; shear: number; tension: number }[];
    recommendations: string[];
  } {
    const n = geometry.boltPattern.rows;
    const m = geometry.boltPattern.columns;
    const totalBolts = n * m;
    const pitch = geometry.boltPattern.pitch;
    const gauge = geometry.boltPattern.gaugeDistance;

    const recommendations: string[] = [];

    // Check edge distances
    const minEdge = bolt.diameter * 1.5;
    if (geometry.boltPattern.edgeDistanceX < minEdge) {
      recommendations.push(`Increase edge distance to minimum ${minEdge}mm`);
    }

    // Check pitch
    const minPitch = bolt.diameter * 2.5;
    if (pitch < minPitch) {
      recommendations.push(`Increase pitch to minimum ${minPitch}mm`);
    }

    // Calculate polar moment of inertia
    let Ip = 0;
    const boltPositions: { x: number; y: number }[] = [];
    
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i - (m - 1) / 2) * gauge;
        const y = (j - (n - 1) / 2) * pitch;
        boltPositions.push({ x, y });
        Ip += x * x + y * y;
      }
    }

    // Direct shear per bolt
    const directShearX = forces.shearX / totalBolts;
    const directShearY = forces.shearY / totalBolts;

    // Calculate bolt forces including moment
    const boltForces: { row: number; col: number; shear: number; tension: number }[] = [];
    let maxShear = 0;
    let maxTension = 0;

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        const pos = boltPositions[i * n + j];
        
        // Moment-induced shear
        const momentShearX = -forces.moment * pos.y / Ip * 1000;
        const momentShearY = forces.moment * pos.x / Ip * 1000;

        const totalShearX = directShearX + momentShearX;
        const totalShearY = directShearY + momentShearY;
        const totalShear = Math.sqrt(totalShearX * totalShearX + totalShearY * totalShearY);

        // Tension from moment (simplified - top bolts take more)
        const tensionFromMoment = forces.moment * pos.y / (Ip / Math.max(...boltPositions.map(p => Math.abs(p.y)))) * 1000;
        const tension = forces.axial / totalBolts + Math.max(0, tensionFromMoment);

        boltForces.push({
          row: j + 1,
          col: i + 1,
          shear: totalShear,
          tension
        });

        maxShear = Math.max(maxShear, totalShear);
        maxTension = Math.max(maxTension, tension);
      }
    }

    // Get bolt capacity
    const capacity = this.singleBoltCapacity(bolt, plates, 'bearing');

    // Check combined interaction
    const shearRatio = maxShear / capacity.shearCapacity;
    const tensionRatio = maxTension / capacity.tensionCapacity;
    
    // Interaction equation
    const combinedRatio = Math.pow(shearRatio, 2) + Math.pow(tensionRatio, 2);
    const utilizationRatio = Math.sqrt(combinedRatio);

    if (utilizationRatio > 1.0) {
      recommendations.push('Increase number of bolts or use higher grade');
    }
    if (shearRatio > 0.8) {
      recommendations.push('Consider using larger bolt diameter for shear');
    }

    return {
      totalBolts,
      maxBoltForce: Math.max(maxShear, maxTension),
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'PASS' : 'FAIL',
      boltForces,
      recommendations
    };
  }
}

// ============================================================================
// WELDED CONNECTION DESIGNER
// ============================================================================

export class WeldedConnectionDesigner {
  private code: DesignCode;

  constructor(code: DesignCode = 'IS800') {
    this.code = code;
  }

  /**
   * Calculate fillet weld capacity
   */
  filletWeldCapacity(
    weld: WeldProperties,
    baseMetal: { fu: number; fy: number }
  ): {
    strengthPerMM: number; // kN/mm
    totalCapacity: number; // kN
    throat: number; // mm
    effectiveArea: number; // mm²
  } {
    const s = weld.size;
    const L = weld.length;
    const fu_weld = WELD_STRENGTH[weld.electrode] || 410;
    const fu_base = baseMetal.fu;

    let strengthPerMM: number;
    let throat: number;

    switch (this.code) {
      case 'IS800':
        throat = 0.7 * s;
        const gammaMw = 1.25;
        // fw = fu / (√3 * γmw)
        const fw = Math.min(fu_weld, fu_base) / (Math.sqrt(3) * gammaMw);
        strengthPerMM = throat * fw / 1000;
        break;

      case 'AISC360':
        throat = 0.707 * s;
        const phi = 0.75;
        const Fnw = 0.6 * fu_weld;
        strengthPerMM = phi * Fnw * throat / 1000;
        break;

      case 'EC3':
        throat = 0.7 * s;
        const betaW = 0.9; // Correlation factor
        const gammaM2 = 1.25;
        const fvwd = fu_weld / (Math.sqrt(3) * betaW * gammaM2);
        strengthPerMM = throat * fvwd / 1000;
        break;

      default:
        throat = 0.7 * s;
        strengthPerMM = throat * 0.3 * fu_weld / 1000;
    }

    return {
      strengthPerMM,
      totalCapacity: strengthPerMM * L,
      throat,
      effectiveArea: throat * L
    };
  }

  /**
   * Design fillet weld for forces
   */
  designFilletWeld(
    forces: { shear: number; axial: number; moment?: number },
    weldLength: number,
    electrode: WeldProperties['electrode'],
    baseMetal: { fu: number; fy: number }
  ): {
    requiredSize: number;
    providedSize: number;
    utilizationRatio: number;
    status: 'PASS' | 'FAIL';
    notes: string[];
  } {
    const notes: string[] = [];
    
    // Resultant force
    const resultant = Math.sqrt(forces.shear * forces.shear + forces.axial * forces.axial);
    
    // Required strength per mm
    const requiredStrengthPerMM = resultant / weldLength;

    // Find minimum weld size
    let requiredSize = 3;
    for (let size = 3; size <= 20; size++) {
      const testWeld: WeldProperties = {
        type: 'fillet',
        electrode,
        size,
        length: weldLength,
        position: 'flat'
      };
      const capacity = this.filletWeldCapacity(testWeld, baseMetal);
      if (capacity.strengthPerMM >= requiredStrengthPerMM) {
        requiredSize = size;
        break;
      }
    }

    // Provide next standard size
    const standardSizes = [3, 4, 5, 6, 8, 10, 12, 16, 20];
    const providedSize = standardSizes.find(s => s >= requiredSize) || requiredSize;

    // Check capacity with provided size
    const finalWeld: WeldProperties = {
      type: 'fillet',
      electrode,
      size: providedSize,
      length: weldLength,
      position: 'flat'
    };
    const capacity = this.filletWeldCapacity(finalWeld, baseMetal);
    const utilizationRatio = resultant / capacity.totalCapacity;

    // Minimum size requirements
    if (providedSize < 3) {
      notes.push('Minimum fillet weld size is 3mm');
    }

    // Maximum size
    const maxSize = Math.min(baseMetal.fu > 400 ? 12 : 16);
    if (providedSize > maxSize) {
      notes.push(`Consider using multiple passes for size > ${maxSize}mm`);
    }

    return {
      requiredSize,
      providedSize,
      utilizationRatio,
      status: utilizationRatio <= 1.0 ? 'PASS' : 'FAIL',
      notes
    };
  }

  /**
   * Check weld group for eccentric loading
   */
  eccentricWeldGroup(
    weldPattern: {
      segments: { x1: number; y1: number; x2: number; y2: number; size: number }[];
    },
    forces: { Px: number; Py: number; M: number },
    electrode: WeldProperties['electrode'],
    baseMetal: { fu: number }
  ): {
    maxStress: number;
    allowableStress: number;
    utilizationRatio: number;
    criticalLocation: { x: number; y: number };
  } {
    // Calculate centroid
    let totalLength = 0;
    let sumXL = 0;
    let sumYL = 0;

    for (const seg of weldPattern.segments) {
      const L = Math.sqrt(Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2));
      const xc = (seg.x1 + seg.x2) / 2;
      const yc = (seg.y1 + seg.y2) / 2;
      totalLength += L;
      sumXL += xc * L;
      sumYL += yc * L;
    }

    const xBar = sumXL / totalLength;
    const yBar = sumYL / totalLength;

    // Calculate polar moment of inertia
    let Ip = 0;
    for (const seg of weldPattern.segments) {
      const L = Math.sqrt(Math.pow(seg.x2 - seg.x1, 2) + Math.pow(seg.y2 - seg.y1, 2));
      const xc = (seg.x1 + seg.x2) / 2 - xBar;
      const yc = (seg.y1 + seg.y2) / 2 - yBar;
      Ip += L * (xc * xc + yc * yc);
    }

    // Find critical point (farthest from centroid)
    let maxR = 0;
    let criticalX = 0;
    let criticalY = 0;

    for (const seg of weldPattern.segments) {
      for (const point of [[seg.x1, seg.y1], [seg.x2, seg.y2]]) {
        const r = Math.sqrt(Math.pow(point[0] - xBar, 2) + Math.pow(point[1] - yBar, 2));
        if (r > maxR) {
          maxR = r;
          criticalX = point[0];
          criticalY = point[1];
        }
      }
    }

    // Calculate stresses
    const directX = forces.Px / totalLength;
    const directY = forces.Py / totalLength;
    const momentX = -forces.M * (criticalY - yBar) / Ip * 1000;
    const momentY = forces.M * (criticalX - xBar) / Ip * 1000;

    const totalStressX = directX + momentX;
    const totalStressY = directY + momentY;
    const maxStress = Math.sqrt(totalStressX * totalStressX + totalStressY * totalStressY);

    // Allowable stress
    const fu_weld = WELD_STRENGTH[electrode];
    const allowableStress = 0.3 * fu_weld;

    return {
      maxStress,
      allowableStress,
      utilizationRatio: maxStress / allowableStress,
      criticalLocation: { x: criticalX, y: criticalY }
    };
  }
}

// ============================================================================
// MOMENT CONNECTION DESIGNER
// ============================================================================

export class MomentConnectionDesigner {
  private code: DesignCode;

  constructor(code: DesignCode = 'IS800') {
    this.code = code;
  }

  /**
   * Design extended end plate moment connection
   */
  designExtendedEndPlate(
    beamSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      fy: number;
      fu: number;
    },
    columnSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      webThickness: number;
      fy: number;
    },
    designMoment: number, // kNm
    shear: number, // kN
    boltGrade: BoltProperties['grade'] = '8.8'
  ): {
    plateThickness: number;
    plateWidth: number;
    plateHeight: number;
    boltDiameter: number;
    boltRows: number;
    boltGauge: number;
    stiffenerRequired: boolean;
    weldSizes: { flangeWeld: number; webWeld: number };
    capacity: { moment: number; shear: number };
    status: 'PASS' | 'FAIL';
  } {
    const db = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const tf = beamSection.flangeThickness;
    const tw = beamSection.webThickness;

    // Flange force from moment
    const leverArm = db - tf;
    const flangeForce = designMoment * 1000 / leverArm; // kN

    // Select bolt diameter
    const boltDia = 20;
    const boltProps = BOLT_PROPERTIES[boltGrade];
    const boltArea = BOLT_AREAS[boltDia].tensile;
    const boltTensionCapacity = 0.9 * boltProps.fub * boltArea / 1.25 / 1000;

    // Number of bolts required in tension zone
    const boltsInTension = Math.ceil(flangeForce / boltTensionCapacity);
    const boltRows = Math.ceil(boltsInTension / 2) + 2; // +2 for compression zone

    // Bolt gauge
    const boltGauge = Math.max(80, bf - 2 * 30);

    // End plate sizing
    const plateWidth = bf + 20;
    const plateHeight = db + 2 * 50 + 2 * 40; // Extension above and below

    // Plate thickness (bending about bolt line)
    const m = (boltGauge - tw) / 2 - 0.8 * 6; // Weld leg assumed 6mm
    const Mpl = flangeForce * m / 2; // Per bolt row
    const requiredTp = Math.sqrt(4 * Mpl * 1000 * 1.1 / (beamSection.fy * plateWidth));
    const plateThickness = Math.ceil(requiredTp / 2) * 2;

    // Check column flange
    const stiffenerRequired = columnSection.flangeThickness < plateThickness * 0.8;

    // Weld sizes
    const flangeWeld = Math.ceil(tf * 0.7 / 2) * 2;
    const webWeld = Math.max(6, Math.ceil(tw * 0.5));

    // Capacity check
    const momentCapacity = boltTensionCapacity * (boltsInTension + 2) * leverArm / 1000;
    const shearCapacity = (boltRows * 2) * boltTensionCapacity * 0.6;

    return {
      plateThickness: Math.max(plateThickness, 16),
      plateWidth,
      plateHeight,
      boltDiameter: boltDia,
      boltRows,
      boltGauge,
      stiffenerRequired,
      weldSizes: { flangeWeld, webWeld },
      capacity: {
        moment: momentCapacity,
        shear: shearCapacity
      },
      status: momentCapacity >= designMoment && shearCapacity >= shear ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Design flange plate moment connection
   */
  designFlangePlateConnection(
    beamSection: {
      depth: number;
      flangeWidth: number;
      flangeThickness: number;
      fy: number;
      fu: number;
    },
    designMoment: number,
    shear: number,
    boltGrade: BoltProperties['grade'] = '8.8'
  ): {
    topPlate: { width: number; thickness: number; length: number };
    bottomPlate: { width: number; thickness: number; length: number };
    boltsPerFlange: number;
    boltDiameter: number;
    boltPitch: number;
    flangeWeld: number;
    shearTab?: { width: number; height: number; thickness: number; bolts: number };
  } {
    const db = beamSection.depth;
    const bf = beamSection.flangeWidth;
    const tf = beamSection.flangeThickness;

    // Flange force
    const leverArm = db - tf;
    const flangeForce = designMoment * 1000 / leverArm;

    // Flange plate design (gross and net section)
    const plateWidth = bf;
    const gamma_m0 = 1.1;
    const gamma_m1 = 1.25;

    // Gross section yielding
    const Ag_required = flangeForce * 1000 * gamma_m0 / beamSection.fy;
    
    // Net section rupture (assume 2 bolt holes)
    const boltDia = 22;
    const holeArea = 2 * (boltDia + 2); // per mm thickness
    const An_required = flangeForce * 1000 * gamma_m1 / (0.9 * beamSection.fu);

    // Required thickness
    const tp_gross = Ag_required / plateWidth;
    const tp_net = (An_required + holeArea * 1) / plateWidth; // Iterate
    const plateThickness = Math.ceil(Math.max(tp_gross, tp_net, tf) / 2) * 2;

    // Bolts
    const boltProps = BOLT_PROPERTIES[boltGrade];
    const boltArea = BOLT_AREAS[boltDia].gross;
    const boltShearCapacity = 0.5 * boltProps.fub * boltArea / 1.25 / 1000; // Double shear
    const boltsPerFlange = Math.ceil(flangeForce / boltShearCapacity / 2) * 2;

    // Plate length
    const boltPitch = 3 * boltDia;
    const edgeDistance = 1.5 * boltDia;
    const plateLength = edgeDistance * 2 + (boltsPerFlange / 2 - 1) * boltPitch;

    // Weld to column
    const flangeWeld = Math.ceil(plateThickness * 0.5);

    // Shear tab for vertical shear
    const shearTabThickness = Math.max(8, beamSection.flangeThickness * 0.5);
    const shearTabBolts = Math.ceil(shear / (boltShearCapacity * 0.5));

    return {
      topPlate: { width: plateWidth, thickness: plateThickness, length: plateLength },
      bottomPlate: { width: plateWidth, thickness: plateThickness, length: plateLength },
      boltsPerFlange,
      boltDiameter: boltDia,
      boltPitch,
      flangeWeld,
      shearTab: {
        width: 100,
        height: db - 2 * tf - 20,
        thickness: shearTabThickness,
        bolts: shearTabBolts
      }
    };
  }
}

// ============================================================================
// BASE PLATE DESIGNER
// ============================================================================

export class BasePlateDesigner {
  /**
   * Design column base plate for axial load and moment
   */
  designBasePlate(
    column: {
      shape: 'I' | 'H' | 'box' | 'circular';
      depth: number;
      width: number;
      flangeThickness: number;
      webThickness: number;
    },
    loads: {
      axial: number; // kN (compression positive)
      momentX: number; // kNm
      momentY: number; // kNm
      shear: number; // kN
    },
    concrete: {
      fck: number; // MPa
      pedestalSize?: { width: number; depth: number };
    },
    plateGrade: { fy: number; fu: number } = { fy: 250, fu: 410 }
  ): {
    plateWidth: number;
    plateDepth: number;
    plateThickness: number;
    anchorBolts: {
      diameter: number;
      grade: string;
      embedmentLength: number;
      pattern: string;
    };
    bearingPressure: { max: number; min: number; allowable: number };
    groutThickness: number;
    status: 'PASS' | 'FAIL';
  } {
    const P = loads.axial;
    const Mx = loads.momentX;
    const My = loads.momentY;
    const V = loads.shear;

    // Bearing strength of concrete
    const fcd = 0.45 * concrete.fck; // Design bearing strength

    // Initial plate size (ensure eccentricity within plate)
    const ex = Math.abs(Mx) / P;
    const ey = Math.abs(My) / P;

    const minB = column.width + 2 * 50;
    const minN = column.depth + 2 * 50;

    // Increase size if needed for eccentricity
    let B = Math.max(minB, 6 * ey + column.width);
    let N = Math.max(minN, 6 * ex + column.depth);

    // Round to nearest 10mm
    B = Math.ceil(B / 10) * 10;
    N = Math.ceil(N / 10) * 10;

    // Area ratio for pedestal
    let A2_A1 = 1;
    if (concrete.pedestalSize) {
      A2_A1 = Math.min(
        Math.sqrt(concrete.pedestalSize.width * concrete.pedestalSize.depth / (B * N)),
        2
      );
    }

    // Adjusted bearing strength
    const fp = 0.85 * concrete.fck * A2_A1;

    // Check bearing pressure
    const A1 = B * N;
    const Sx = N * N / 6;
    const Sy = B * B / 6;

    const sigmaMax = P / A1 + Mx * 1000 / Sx + My * 1000 / Sy;
    const sigmaMin = P / A1 - Mx * 1000 / Sx - My * 1000 / Sy;

    // Iterate if bearing exceeded
    while (sigmaMax > fp && B < 1000 && N < 1000) {
      B += 50;
      N += 50;
      const newA1 = B * N;
      const newSx = N * N / 6;
      const newSy = B * B / 6;
      
      // Recalculate
      const newSigmaMax = P / newA1 + Mx * 1000 / newSx + My * 1000 / newSy;
      if (newSigmaMax <= fp) break;
    }

    // Plate thickness
    // Critical section at edge of column
    const m = (B - 0.8 * column.width) / 2;
    const n = (N - 0.95 * column.depth) / 2;
    const lambda = Math.sqrt(column.depth * column.width) / 4;
    const cantilever = Math.max(m, n, lambda);

    // Bending moment in plate
    const Mpl = sigmaMax * cantilever * cantilever / 2;
    const gammam0 = 1.1;
    const tp = Math.sqrt(6 * Mpl * gammam0 / plateGrade.fy);

    // Round up to standard thickness
    const standardThicknesses = [12, 16, 20, 25, 32, 36, 40, 50];
    const plateThickness = standardThicknesses.find(t => t >= tp) || Math.ceil(tp / 2) * 2;

    // Anchor bolts
    let boltDia = 20;
    let embedment = 300;
    let boltPattern = '4 bolts';

    if (sigmaMin < 0) {
      // Tension in anchor bolts
      const tension = Math.abs(sigmaMin) * B * N / 1000;
      const boltCapacity = 0.75 * 500 * BOLT_AREAS[boltDia].tensile / 1.25 / 1000;
      const numBolts = Math.ceil(tension / boltCapacity);
      boltPattern = `${numBolts} bolts`;
      
      if (numBolts > 4) {
        boltDia = 24;
        embedment = 400;
      }
    }

    // Development length for anchor
    embedment = Math.max(embedment, 15 * boltDia);

    return {
      plateWidth: B,
      plateDepth: N,
      plateThickness,
      anchorBolts: {
        diameter: boltDia,
        grade: '8.8',
        embedmentLength: embedment,
        pattern: boltPattern
      },
      bearingPressure: {
        max: sigmaMax,
        min: Math.max(0, sigmaMin),
        allowable: fp
      },
      groutThickness: Math.max(25, plateThickness * 0.5),
      status: sigmaMax <= fp ? 'PASS' : 'FAIL'
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  BoltedConnectionDesigner,
  WeldedConnectionDesigner,
  MomentConnectionDesigner,
  BasePlateDesigner
};
