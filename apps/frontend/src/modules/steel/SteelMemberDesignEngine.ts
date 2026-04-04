/**
 * ============================================================================
 * STEEL MEMBER DESIGN ENGINE
 * ============================================================================
 * 
 * Complete structural steel member design for:
 * - Tension members
 * - Compression members (columns, struts)
 * - Beams (flexural members with LTB)
 * - Beam-columns (combined axial & bending)
 * - Connection design (bolts, welds)
 * 
 * Supported Codes:
 * - IS 800:2007 (India)
 * - AISC 360-22 (USA)
 * - EN 1993-1-1:2005 (Europe)
 * - AS 4100:2020 (Australia)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  SteelDesignCode,
  SteelGradeType,
  SteelGrade,
  SteelSection,
  SectionClassification,
  STEEL_GRADES,
  STEEL_SAFETY_FACTORS,
  BUCKLING_CURVES,
  findSection,
  getSteelGrade,
  classifySection,
  getEffectiveLengthFactor,
  BOLT_GRADES,
  BOLT_SIZES,
  type BoltGrade,
  type BoltSize,
} from './SteelDesignConstants';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type MemberType = 'tension' | 'compression' | 'beam' | 'beam-column';
export type BucklingCurve = 'a0' | 'a' | 'b' | 'c' | 'd';
export type ConnectionType = 'bolted' | 'welded' | 'bolted-welded';
export type BoltType = 'bearing' | 'friction' | 'HSFG';

export interface MemberGeometry {
  length: number;           // Member length (mm)
  Lx?: number;              // Effective length for x-x buckling (mm)
  Ly?: number;              // Effective length for y-y buckling (mm)
  Lb?: number;              // Unbraced length for LTB (mm)
  Cb?: number;              // Moment gradient factor for LTB
}

export interface MemberLoading {
  Pu?: number;              // Factored axial force (kN) - positive tension
  Mux?: number;             // Factored moment about x-x (kN-m)
  Muy?: number;             // Factored moment about y-y (kN-m)
  Vu?: number;              // Factored shear force (kN)
  Tu?: number;              // Factored torsional moment (kN-m)
}

export interface MemberMaterials {
  grade: SteelGradeType;
  section: SteelSection;
  code: SteelDesignCode;
}

// =============================================================================
// TENSION MEMBER RESULT
// =============================================================================

export interface TensionDesignResult {
  // Capacity
  Ag: number;               // Gross area (mm²)
  An: number;               // Net area (mm²) - after holes
  Ae: number;               // Effective net area (mm²)
  Tdg: number;              // Design strength - gross yielding (kN)
  Tdn: number;              // Design strength - net rupture (kN)
  Tdb: number;              // Design strength - block shear (kN)
  Td: number;               // Governing design strength (kN)
  
  // Demand
  Pu: number;               // Applied factored load (kN)
  
  // Results
  utilizationRatio: number;
  status: 'pass' | 'fail';
  governingMode: 'yielding' | 'rupture' | 'block-shear';
  
  slendernessRatio: number;
  slendernessLimit: number;
  slendernessOk: boolean;
}

// =============================================================================
// COMPRESSION MEMBER RESULT
// =============================================================================

export interface CompressionDesignResult {
  // Section properties
  A: number;                // Area (mm²)
  rx: number;               // Radius of gyration x-x (mm)
  ry: number;               // Radius of gyration y-y (mm)
  
  // Slenderness
  lambda_x: number;         // Slenderness ratio x-x
  lambda_y: number;         // Slenderness ratio y-y
  lambda_max: number;       // Maximum slenderness
  lambda_e: number;         // Euler slenderness
  lambda_bar: number;       // Non-dimensional slenderness
  
  // Buckling
  Ncr: number;              // Elastic critical buckling load (kN)
  chi: number;              // Buckling reduction factor
  bucklingCurve: BucklingCurve;
  
  // Capacity
  Nd: number;               // Design compression capacity (kN)
  Npl: number;              // Plastic capacity (kN)
  
  // Demand
  Pu: number;               // Applied compression (kN)
  
  // Results
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  slendernessLimit: number;
  slendernessOk: boolean;
}

// =============================================================================
// BEAM DESIGN RESULT
// =============================================================================

export interface BeamDesignResult {
  // Section classification
  sectionClass: SectionClassification;
  
  // Moment capacity
  Mcr: number;              // Elastic critical moment for LTB (kN-m)
  Mn: number;               // Nominal moment capacity (kN-m)
  Md: number;               // Design moment capacity (kN-m)
  Mp: number;               // Plastic moment capacity (kN-m)
  
  // LTB
  ltbReductionFactor: number;
  ltbApplicable: boolean;
  
  // Shear capacity
  Vd: number;               // Design shear capacity (kN)
  Vp: number;               // Plastic shear capacity (kN)
  
  // Web shear buckling
  webShearBuckling: boolean;
  
  // Demand
  Mu: number;               // Applied moment (kN-m)
  Vu: number;               // Applied shear (kN)
  
  // Combined effects
  momentShearInteraction: boolean;
  reducedMomentCapacity?: number;
  
  // Results
  momentUtilization: number;
  shearUtilization: number;
  status: 'pass' | 'fail';
  
  // Deflection
  deflection?: {
    actual: number;
    limit: number;
    ratio: number;
    ok: boolean;
  };
}

// =============================================================================
// BEAM-COLUMN DESIGN RESULT
// =============================================================================

export interface BeamColumnDesignResult {
  // Individual capacities
  compressionCapacity: CompressionDesignResult;
  bendingCapacity: BeamDesignResult;
  
  // Interaction check
  interactionRatio: number;
  interactionFormula: string;
  
  // Individual ratios
  axialRatio: number;
  momentRatioX: number;
  momentRatioY: number;
  
  // Results
  status: 'pass' | 'fail';
  governingCheck: 'compression' | 'bending' | 'interaction';
}

// =============================================================================
// CONNECTION DESIGN RESULTS
// =============================================================================

export interface BoltedConnectionResult {
  // Bolt properties
  boltGrade: BoltGrade;
  boltSize: BoltSize;
  numBolts: number;
  
  // Capacities per bolt
  shearCapacityPerBolt: number;     // kN
  bearingCapacityPerBolt: number;   // kN
  tensionCapacityPerBolt: number;   // kN
  
  // Total capacities
  totalShearCapacity: number;       // kN
  totalBearingCapacity: number;     // kN
  totalTensionCapacity: number;     // kN
  governingCapacity: number;        // kN
  
  // Demand
  appliedShear: number;             // kN
  appliedTension: number;           // kN
  
  // Results
  shearUtilization: number;
  tensionUtilization: number;
  combinedUtilization: number;
  status: 'pass' | 'fail';
  
  // Geometry checks
  minEdgeDistance: number;
  minPitch: number;
  maxPitch: number;
}

export interface WeldedConnectionResult {
  // Weld properties
  weldSize: number;                 // mm (throat or leg)
  weldLength: number;               // mm
  electrodeGrade: string;
  
  // Capacities
  weldStrengthPerMm: number;        // kN/mm
  totalWeldCapacity: number;        // kN
  
  // Demand
  appliedForce: number;             // kN
  
  // Results
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  // Checks
  minWeldSize: number;
  maxWeldSize: number;
  weldSizeOk: boolean;
}

// =============================================================================
// MAIN DESIGN INPUT/OUTPUT
// =============================================================================

export interface SteelMemberDesignInput {
  memberType: MemberType;
  geometry: MemberGeometry;
  loading: MemberLoading;
  materials: MemberMaterials;
  
  // For tension members
  numHoles?: number;
  holeDiameter?: number;
  staggeredHoles?: boolean;
  
  // For compression
  bucklingCurveX?: BucklingCurve;
  bucklingCurveY?: BucklingCurve;
  
  // For beams
  lateralRestraint?: 'full' | 'partial' | 'none';
  momentGradientFactor?: number;
}

export interface SteelMemberDesignResult {
  input: SteelMemberDesignInput;
  
  tension?: TensionDesignResult;
  compression?: CompressionDesignResult;
  beam?: BeamDesignResult;
  beamColumn?: BeamColumnDesignResult;
  
  summary: {
    status: 'pass' | 'fail';
    utilizationRatio: number;
    governingMode: string;
    weight: number;           // kg/m
    totalWeight: number;      // kg
    warnings: string[];
    recommendations: string[];
  };
}

// =============================================================================
// STEEL MEMBER DESIGN ENGINE CLASS
// =============================================================================

export class SteelMemberDesignEngine {
  private input: SteelMemberDesignInput;
  private section: SteelSection;
  private grade: SteelGrade;
  private code: SteelDesignCode;
  private factors: typeof STEEL_SAFETY_FACTORS.IS800;

  constructor(input: SteelMemberDesignInput) {
    this.input = { ...input };
    this.section = input.materials.section;
    this.grade = getSteelGrade(input.materials.grade);
    this.code = input.materials.code;
    this.factors = STEEL_SAFETY_FACTORS[this.code];
  }

  // ===========================================================================
  // MAIN DESIGN METHOD
  // ===========================================================================

  public design(): SteelMemberDesignResult {
    let tension: TensionDesignResult | undefined;
    let compression: CompressionDesignResult | undefined;
    let beam: BeamDesignResult | undefined;
    let beamColumn: BeamColumnDesignResult | undefined;

    const warnings: string[] = [];
    const recommendations: string[] = [];

    switch (this.input.memberType) {
      case 'tension':
        tension = this.designTensionMember();
        break;
      case 'compression':
        compression = this.designCompressionMember();
        break;
      case 'beam':
        beam = this.designBeam();
        break;
      case 'beam-column':
        beamColumn = this.designBeamColumn();
        compression = beamColumn.compressionCapacity;
        beam = beamColumn.bendingCapacity;
        break;
    }

    // Determine governing result
    let status: 'pass' | 'fail' = 'pass';
    let utilizationRatio = 0;
    let governingMode = '';

    if (tension) {
      utilizationRatio = tension.utilizationRatio;
      governingMode = `Tension - ${tension.governingMode}`;
      if (tension.status === 'fail') status = 'fail';
      if (!tension.slendernessOk) warnings.push('Slenderness ratio exceeds limit for tension members');
    }

    if (compression) {
      if (compression.utilizationRatio > utilizationRatio) {
        utilizationRatio = compression.utilizationRatio;
        governingMode = 'Compression buckling';
      }
      if (compression.status === 'fail') status = 'fail';
      if (!compression.slendernessOk) warnings.push('Slenderness ratio exceeds limit for compression members');
    }

    if (beam) {
      const maxBeamUtil = Math.max(beam.momentUtilization, beam.shearUtilization);
      if (maxBeamUtil > utilizationRatio) {
        utilizationRatio = maxBeamUtil;
        governingMode = beam.momentUtilization > beam.shearUtilization ? 'Bending' : 'Shear';
      }
      if (beam.status === 'fail') status = 'fail';
      if (beam.ltbApplicable) warnings.push('Lateral-torsional buckling governs moment capacity');
    }

    if (beamColumn) {
      if (beamColumn.interactionRatio > utilizationRatio) {
        utilizationRatio = beamColumn.interactionRatio;
        governingMode = 'Combined axial + bending interaction';
      }
      if (beamColumn.status === 'fail') status = 'fail';
    }

    // Recommendations
    if (utilizationRatio > 0.95 && utilizationRatio <= 1.0) {
      recommendations.push('Member is highly utilized. Consider increasing section size for safety margin.');
    } else if (utilizationRatio < 0.5) {
      recommendations.push('Member is under-utilized. Consider using a smaller section for economy.');
    }

    return {
      input: this.input,
      tension,
      compression,
      beam,
      beamColumn,
      summary: {
        status,
        utilizationRatio,
        governingMode,
        weight: this.section.mass,
        totalWeight: this.section.mass * this.input.geometry.length / 1000,
        warnings,
        recommendations,
      },
    };
  }

  // ===========================================================================
  // TENSION MEMBER DESIGN
  // ===========================================================================

  private designTensionMember(): TensionDesignResult {
    const { fy, fu } = this.grade;
    const section = this.section;
    const Pu = Math.abs(this.input.loading.Pu || 0);
    
    // Gross area
    const Ag = section.A;
    
    // Net area (holes deducted)
    const numHoles = this.input.numHoles || 0;
    const holeDia = this.input.holeDiameter || 22; // Standard hole = bolt + 2mm
    let An = Ag;
    
    if (numHoles > 0) {
      // Deduct hole areas from flanges (simplified)
      An = Ag - numHoles * (holeDia + 2) * (section.tf || section.tw);
    }
    
    // Effective net area
    const U = this.getShearLagFactor();
    const Ae = An * U;
    
    // Design strengths
    let Tdg: number, Tdn: number, Tdb: number;
    
    if (this.code === 'IS800') {
      // IS 800:2007 Clause 6
      Tdg = (Ag * fy / this.factors.gamma_m0) / 1000;  // Yielding of gross section
      Tdn = (0.9 * An * fu / this.factors.gamma_m1) / 1000;  // Rupture of net section
      Tdb = this.calculateBlockShear(An, numHoles, holeDia);
    } else if (this.code === 'AISC360') {
      // AISC 360 Chapter D
      Tdg = (this.factors.phi_t * Ag * fy) / 1000;
      Tdn = (this.factors.phi_t * Ae * fu) / 1000;
      Tdb = this.calculateBlockShear(An, numHoles, holeDia);
    } else {
      // EN 1993 / AS 4100
      Tdg = (Ag * fy / this.factors.gamma_m0) / 1000;
      Tdn = (0.9 * Ae * fu / this.factors.gamma_m1) / 1000;
      Tdb = this.calculateBlockShear(An, numHoles, holeDia);
    }
    
    const Td = Math.min(Tdg, Tdn, Tdb);
    
    let governingMode: 'yielding' | 'rupture' | 'block-shear';
    if (Td === Tdg) governingMode = 'yielding';
    else if (Td === Tdn) governingMode = 'rupture';
    else governingMode = 'block-shear';
    
    // Slenderness check
    const L = this.input.geometry.length;
    const r_min = Math.min(section.rx, section.ry);
    const slendernessRatio = L / r_min;
    const slendernessLimit = this.code === 'IS800' ? 400 : 300;
    
    return {
      Ag,
      An,
      Ae,
      Tdg,
      Tdn,
      Tdb,
      Td,
      Pu,
      utilizationRatio: Pu / Td,
      status: Pu <= Td ? 'pass' : 'fail',
      governingMode,
      slendernessRatio,
      slendernessLimit,
      slendernessOk: slendernessRatio <= slendernessLimit,
    };
  }

  private getShearLagFactor(): number {
    // Shear lag factor U based on connection type
    // Simplified - full connection assumed
    if (this.section.type === 'I-section' || this.section.type === 'H-section') {
      // Flange connected
      const bf = this.section.b;
      const d = this.section.h;
      if (bf >= 0.67 * d) return 0.90;
      return 0.85;
    }
    if (this.section.type === 'channel') return 0.85;
    if (this.section.type === 'angle') return 0.80;
    return 0.90;
  }

  private calculateBlockShear(An: number, numHoles: number, holeDia: number): number {
    // Simplified block shear calculation
    const { fy, fu } = this.grade;
    
    if (numHoles < 2) return Infinity; // Block shear not applicable
    
    // Assume standard gauge and pitch
    const pitch = 65;  // mm
    const gauge = 100; // mm
    const edgeDist = 40;
    
    // Gross and net areas
    const Avg = 2 * edgeDist * (this.section.tf || this.section.tw);
    const Avn = Avg - numHoles * (holeDia + 2) * (this.section.tf || this.section.tw);
    const Atg = (numHoles - 1) * pitch * (this.section.tf || this.section.tw);
    const Atn = Atg - (numHoles - 1) * (holeDia + 2) * (this.section.tf || this.section.tw);
    
    // Block shear capacity
    let Tdb: number;
    if (this.code === 'IS800') {
      Tdb = Math.min(
        (Avg * fy / (Math.sqrt(3) * this.factors.gamma_m0) + 0.9 * Atn * fu / this.factors.gamma_m1),
        (0.9 * Avn * fu / (Math.sqrt(3) * this.factors.gamma_m1) + Atg * fy / this.factors.gamma_m0)
      ) / 1000;
    } else {
      const phi = 0.75;
      Tdb = phi * (0.6 * fu * Avn + fy * Atg) / 1000;
    }
    
    return Tdb;
  }

  // ===========================================================================
  // COMPRESSION MEMBER DESIGN
  // ===========================================================================

  private designCompressionMember(): CompressionDesignResult {
    const { fy, E } = this.grade;
    const section = this.section;
    const Pu = Math.abs(this.input.loading.Pu || 0);
    
    const A = section.A;
    const rx = section.rx;
    const ry = section.ry;
    
    // Effective lengths
    const Lx = this.input.geometry.Lx || this.input.geometry.length;
    const Ly = this.input.geometry.Ly || this.input.geometry.length;
    
    // Slenderness ratios
    const lambda_x = Lx / rx;
    const lambda_y = Ly / ry;
    const lambda_max = Math.max(lambda_x, lambda_y);
    
    // Euler slenderness
    const lambda_e = Math.PI * Math.sqrt(E / fy);
    
    // Non-dimensional slenderness
    const lambda_bar = lambda_max / lambda_e;
    
    // Elastic critical buckling load
    const Ncr = (Math.PI * Math.PI * E * A) / (lambda_max * lambda_max * 1000);
    
    // Buckling reduction factor
    let chi: number;
    let bucklingCurve: BucklingCurve;
    
    if (this.code === 'IS800' || this.code === 'EN1993') {
      // EN 1993 / IS 800 buckling curves
      bucklingCurve = this.getBucklingCurve();
      const alpha = BUCKLING_CURVES[bucklingCurve];
      const phi_buck = 0.5 * (1 + alpha * (lambda_bar - 0.2) + lambda_bar * lambda_bar);
      chi = 1 / (phi_buck + Math.sqrt(phi_buck * phi_buck - lambda_bar * lambda_bar));
      chi = Math.min(chi, 1.0);
    } else if (this.code === 'AISC360') {
      // AISC 360 Chapter E
      if (lambda_max <= 4.71 * Math.sqrt(E / fy)) {
        const Fe = Ncr * 1000 / A;
        chi = Math.pow(0.658, fy / Fe);
      } else {
        chi = 0.877 / (lambda_bar * lambda_bar);
      }
      bucklingCurve = 'b';
    } else {
      // AS 4100
      const alpha_b = this.getAlphaB();
      const eta = 0.00326 * (lambda_max - 13.5);
      const xi = ((lambda_max / 90) * (lambda_max / 90) * (fy / 250) + 1 + eta) / 
                 (2 * (lambda_max / 90) * (lambda_max / 90) * (fy / 250));
      chi = xi - Math.sqrt(xi * xi - 1 / ((lambda_max / 90) * (lambda_max / 90) * (fy / 250)));
      chi = Math.min(chi, 1.0);
      bucklingCurve = 'b';
    }
    
    // Plastic capacity
    const Npl = A * fy / 1000;
    
    // Design capacity
    let Nd: number;
    if (this.code === 'IS800') {
      Nd = chi * A * fy / (this.factors.gamma_m0 * 1000);
    } else if (this.code === 'AISC360') {
      Nd = this.factors.phi_c * chi * A * fy / 1000;
    } else {
      Nd = chi * A * fy / (this.factors.gamma_m1 * 1000);
    }
    
    // Slenderness limits
    const slendernessLimit = this.code === 'IS800' ? 180 : 200;
    
    return {
      A,
      rx,
      ry,
      lambda_x,
      lambda_y,
      lambda_max,
      lambda_e,
      lambda_bar,
      Ncr,
      chi,
      bucklingCurve,
      Nd,
      Npl,
      Pu,
      utilizationRatio: Pu / Nd,
      status: Pu <= Nd ? 'pass' : 'fail',
      slendernessLimit,
      slendernessOk: lambda_max <= slendernessLimit,
    };
  }

  private getBucklingCurve(): BucklingCurve {
    const section = this.section;
    const tf = section.tf;
    const h = section.h;
    const b = section.b;
    
    // Buckling about major axis (y-y in EN notation)
    if (section.type === 'I-section' || section.type === 'H-section') {
      if (h / b > 1.2) {
        // Rolled I-sections
        if (tf <= 40) return 'a';
        return 'b';
      } else {
        // H-sections
        if (tf <= 100) return 'b';
        return 'c';
      }
    }
    
    if (section.type === 'RHS' || section.type === 'SHS') {
      return 'a';
    }
    
    if (section.type === 'CHS') {
      return 'a';
    }
    
    if (section.type === 'channel' || section.type === 'angle') {
      return 'c';
    }
    
    return 'b';
  }

  private getAlphaB(): number {
    // AS 4100 member section constant
    if (this.section.type === 'I-section') return 0.5;
    if (this.section.type === 'RHS' || this.section.type === 'SHS') return -1.0;
    if (this.section.type === 'CHS') return -0.5;
    return 0.0;
  }

  // ===========================================================================
  // BEAM DESIGN
  // ===========================================================================

  private designBeam(): BeamDesignResult {
    const { fy, E, G } = this.grade;
    const section = this.section;
    const Mu = Math.abs(this.input.loading.Mux || 0);
    const Vu = Math.abs(this.input.loading.Vu || 0);
    
    // Section classification
    const sectionClass = classifySection(section, fy);
    
    // Plastic moment capacity
    const Zpx = section.Zpx;
    const Zx = section.Zx;
    const Mp = Zpx * fy / 1e6; // kN-m
    
    // Unbraced length for LTB
    const Lb = this.input.geometry.Lb || this.input.geometry.length;
    const Cb = this.input.momentGradientFactor || 1.0;
    
    // Elastic critical moment for LTB
    const Mcr = this.calculateMcr(Lb, Cb);
    
    // LTB reduction
    let ltbReductionFactor = 1.0;
    let ltbApplicable = false;
    let Mn: number;
    
    if (this.input.lateralRestraint === 'full') {
      // Full lateral restraint - no LTB
      Mn = Mp;
    } else {
      // Check LTB
      const lambda_LT = Math.sqrt(Mp / Mcr);
      
      if (this.code === 'IS800' || this.code === 'EN1993') {
        // EN 1993 LTB curve
        const alpha_LT = 0.21; // Curve a for rolled sections
        const phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT * lambda_LT);
        const chi_LT = 1 / (phi_LT + Math.sqrt(phi_LT * phi_LT - lambda_LT * lambda_LT));
        ltbReductionFactor = Math.min(chi_LT, 1.0);
      } else if (this.code === 'AISC360') {
        // AISC 360 Chapter F
        const Lp = 1.76 * section.ry * Math.sqrt(E / fy);
        const Lr = 1.95 * section.ry * (E / (0.7 * fy)) * 
                   Math.sqrt(section.J / (section.Zx * section.h / 2));
        
        if (Lb <= Lp) {
          ltbReductionFactor = 1.0;
        } else if (Lb <= Lr) {
          ltbReductionFactor = Cb * (1 - 0.3 * (Lb - Lp) / (Lr - Lp));
          ltbReductionFactor = Math.min(ltbReductionFactor, 1.0);
        } else {
          ltbReductionFactor = Mcr / Mp;
        }
      } else {
        // AS 4100
        const alpha_m = Cb;
        const alpha_s = 0.6 * Math.sqrt(1 + (Mp / Mcr) * (Mp / Mcr)) - (Mp / Mcr);
        ltbReductionFactor = alpha_m * alpha_s;
        ltbReductionFactor = Math.min(ltbReductionFactor, 1.0);
      }
      
      ltbApplicable = ltbReductionFactor < 1.0;
      
      if (sectionClass === 'Class1' || sectionClass === 'Class2') {
        Mn = ltbReductionFactor * Mp;
      } else if (sectionClass === 'Class3') {
        const My = Zx * fy / 1e6;
        Mn = ltbReductionFactor * My;
      } else {
        // Class 4 - use effective section
        Mn = ltbReductionFactor * 0.9 * Zx * fy / 1e6;
      }
    }
    
    // Design moment capacity
    let Md: number;
    if (this.code === 'IS800') {
      Md = Mn / this.factors.gamma_m0;
    } else if (this.code === 'AISC360') {
      Md = this.factors.phi_b * Mn;
    } else {
      Md = Mn / this.factors.gamma_m0;
    }
    
    // Shear capacity
    const Aw = section.h * section.tw; // Web area
    const Vp = Aw * fy / (Math.sqrt(3) * 1000);
    
    // Check web shear buckling
    const hw = section.h - 2 * section.tf;
    const webShearBuckling = (hw / section.tw) > 67 * Math.sqrt(235 / fy);
    
    let Vd: number;
    if (webShearBuckling) {
      // Reduced shear due to buckling
      const tau_cr = 5.35 * Math.PI * Math.PI * E * Math.pow(section.tw, 2) / 
                     (12 * (1 - 0.3 * 0.3) * hw * hw);
      const lambda_w = Math.sqrt(fy / (Math.sqrt(3) * tau_cr));
      let chi_w: number;
      if (lambda_w < 0.83) chi_w = 1.0;
      else if (lambda_w < 1.08) chi_w = 0.83 / lambda_w;
      else chi_w = 1.37 / (0.7 + lambda_w * lambda_w);
      Vd = chi_w * Vp;
    } else {
      Vd = Vp;
    }
    
    if (this.code === 'IS800') {
      Vd = Vd / this.factors.gamma_m0;
    } else if (this.code === 'AISC360') {
      Vd = this.factors.phi_v * Vd;
    }
    
    // Moment-shear interaction
    const momentShearInteraction = Vu > 0.5 * Vd;
    let reducedMomentCapacity: number | undefined;
    
    if (momentShearInteraction) {
      const rho = (2 * Vu / Vd - 1);
      reducedMomentCapacity = Md * (1 - rho * rho);
    }
    
    return {
      sectionClass,
      Mcr,
      Mn,
      Md: reducedMomentCapacity || Md,
      Mp,
      ltbReductionFactor,
      ltbApplicable,
      Vd,
      Vp,
      webShearBuckling,
      Mu,
      Vu,
      momentShearInteraction,
      reducedMomentCapacity,
      momentUtilization: Mu / (reducedMomentCapacity || Md),
      shearUtilization: Vu / Vd,
      status: Mu <= (reducedMomentCapacity || Md) && Vu <= Vd ? 'pass' : 'fail',
    };
  }

  private calculateMcr(Lb: number, Cb: number): number {
    const { E, G } = this.grade;
    const section = this.section;
    
    const Iz = section.Iy; // Minor axis I
    const Iw = section.Cw || 0;
    const It = section.J;
    
    // Elastic critical moment
    const k = 1.0; // Effective length factor for LTB
    const kw = 1.0;
    
    const Mcr = Cb * (Math.PI * Math.PI * E * Iz / (k * Lb) / (k * Lb)) * 
                Math.sqrt(Iw / Iz + (k * Lb) * (k * Lb) * G * It / (Math.PI * Math.PI * E * Iz));
    
    return Mcr / 1e6; // kN-m
  }

  // ===========================================================================
  // BEAM-COLUMN DESIGN
  // ===========================================================================

  private designBeamColumn(): BeamColumnDesignResult {
    const compressionCapacity = this.designCompressionMember();
    const bendingCapacity = this.designBeam();
    
    const Pu = Math.abs(this.input.loading.Pu || 0);
    const Mux = Math.abs(this.input.loading.Mux || 0);
    const Muy = Math.abs(this.input.loading.Muy || 0);
    
    const Nd = compressionCapacity.Nd;
    const Mdx = bendingCapacity.Md;
    const Mdy = bendingCapacity.Md * (this.section.Zpy / this.section.Zpx);
    
    let interactionRatio: number;
    let interactionFormula: string;
    
    if (this.code === 'IS800' || this.code === 'EN1993') {
      // IS 800 / EN 1993 interaction
      const kx = Math.min(1 + (compressionCapacity.lambda_bar - 0.2) * Pu / Nd, 
                          1 + 0.8 * Pu / Nd);
      const ky = Math.min(1 + (compressionCapacity.lambda_bar - 0.2) * Pu / Nd, 
                          1 + 0.8 * Pu / Nd);
      
      interactionRatio = Pu / Nd + kx * Mux / Mdx + ky * Muy / Mdy;
      interactionFormula = 'N/Nd + kx*Mx/Mdx + ky*My/Mdy ≤ 1.0';
    } else if (this.code === 'AISC360') {
      // AISC 360 Chapter H
      const axialRatio = Pu / Nd;
      
      if (axialRatio >= 0.2) {
        interactionRatio = axialRatio + (8/9) * (Mux / Mdx + Muy / Mdy);
        interactionFormula = 'Pu/φPn + (8/9)(Mux/φMnx + Muy/φMny) ≤ 1.0';
      } else {
        interactionRatio = axialRatio / 2 + (Mux / Mdx + Muy / Mdy);
        interactionFormula = 'Pu/(2φPn) + (Mux/φMnx + Muy/φMny) ≤ 1.0';
      }
    } else {
      // AS 4100
      interactionRatio = Pu / Nd + Mux / Mdx + Muy / Mdy;
      interactionFormula = 'N/φNc + Mx/φMsx + My/φMsy ≤ 1.0';
    }
    
    const axialRatio = Pu / Nd;
    const momentRatioX = Mux / Mdx;
    const momentRatioY = Muy / Mdy;
    
    let governingCheck: 'compression' | 'bending' | 'interaction';
    if (axialRatio > Math.max(momentRatioX, momentRatioY, interactionRatio - axialRatio - momentRatioX - momentRatioY)) {
      governingCheck = 'compression';
    } else if (momentRatioX > axialRatio) {
      governingCheck = 'bending';
    } else {
      governingCheck = 'interaction';
    }
    
    return {
      compressionCapacity,
      bendingCapacity,
      interactionRatio,
      interactionFormula,
      axialRatio,
      momentRatioX,
      momentRatioY,
      status: interactionRatio <= 1.0 ? 'pass' : 'fail',
      governingCheck,
    };
  }
}

// =============================================================================
// CONNECTION DESIGN FUNCTIONS
// =============================================================================

export function designBoltedConnection(
  appliedShear: number,
  appliedTension: number,
  plateThickness: number,
  boltGradeName: string,
  boltDiameter: number,
  numBolts: number,
  connectionType: BoltType,
  code: SteelDesignCode = 'IS800'
): BoltedConnectionResult {
  const boltGrade = BOLT_GRADES.find(b => b.grade === boltGradeName) || BOLT_GRADES[5]; // Default 8.8
  const boltSize = BOLT_SIZES.find(b => b.diameter === boltDiameter) || BOLT_SIZES[1]; // Default M16
  
  const fyb = boltGrade.fyb;
  const fub = boltGrade.fub;
  const As = boltSize.area_tensile;
  const Ab = boltSize.area_gross;
  
  let shearCapacityPerBolt: number;
  let bearingCapacityPerBolt: number;
  let tensionCapacityPerBolt: number;
  
  const gamma_mb = code === 'IS800' ? 1.25 : 1.0;
  const phi = code === 'AISC360' ? 0.75 : 1.0;
  
  if (connectionType === 'bearing') {
    // Shear capacity (single shear)
    shearCapacityPerBolt = (fub * Ab / (Math.sqrt(3) * gamma_mb)) / 1000 * phi;
    
    // Bearing capacity
    const kb = Math.min(1.0, plateThickness / (3 * boltDiameter));
    const fu_plate = 410; // Assumed plate fu
    bearingCapacityPerBolt = (2.5 * kb * boltDiameter * plateThickness * fu_plate / gamma_mb) / 1000 * phi;
    
    // Tension capacity
    tensionCapacityPerBolt = (0.9 * fub * As / gamma_mb) / 1000 * phi;
  } else {
    // Friction type (HSFG)
    const mu = 0.35; // Slip coefficient
    const proof_load = 0.7 * fub * As; // Proof load
    shearCapacityPerBolt = (mu * proof_load / gamma_mb) / 1000;
    bearingCapacityPerBolt = shearCapacityPerBolt * 2; // Not governing for HSFG
    tensionCapacityPerBolt = (0.9 * fub * As / gamma_mb) / 1000 * phi;
  }
  
  const totalShearCapacity = numBolts * shearCapacityPerBolt;
  const totalBearingCapacity = numBolts * bearingCapacityPerBolt;
  const totalTensionCapacity = numBolts * tensionCapacityPerBolt;
  const governingCapacity = Math.min(totalShearCapacity, totalBearingCapacity);
  
  // Utilization ratios
  const shearUtilization = appliedShear / governingCapacity;
  const tensionUtilization = appliedTension / totalTensionCapacity;
  
  // Combined shear and tension
  let combinedUtilization: number;
  if (appliedTension > 0 && appliedShear > 0) {
    combinedUtilization = (shearUtilization * shearUtilization + tensionUtilization * tensionUtilization);
    combinedUtilization = Math.sqrt(combinedUtilization);
  } else {
    combinedUtilization = Math.max(shearUtilization, tensionUtilization);
  }
  
  // Geometry limits
  const minEdgeDistance = 1.5 * boltDiameter;
  const minPitch = 2.5 * boltDiameter;
  const maxPitch = Math.min(32 * plateThickness, 300);
  
  return {
    boltGrade,
    boltSize,
    numBolts,
    shearCapacityPerBolt,
    bearingCapacityPerBolt,
    tensionCapacityPerBolt,
    totalShearCapacity,
    totalBearingCapacity,
    totalTensionCapacity,
    governingCapacity,
    appliedShear,
    appliedTension,
    shearUtilization,
    tensionUtilization,
    combinedUtilization,
    status: combinedUtilization <= 1.0 ? 'pass' : 'fail',
    minEdgeDistance,
    minPitch,
    maxPitch,
  };
}

export function designFilletWeld(
  appliedForce: number,
  weldLength: number,
  plateThickness: number,
  electrodeGrade: string = 'E70',
  code: SteelDesignCode = 'IS800'
): WeldedConnectionResult {
  // Weld strength
  const fuw = electrodeGrade === 'E70' ? 485 : 
              electrodeGrade === 'E60' ? 415 : 510;
  
  // Minimum weld size based on plate thickness
  const minWeldSize = plateThickness <= 10 ? 3 :
                      plateThickness <= 20 ? 5 :
                      plateThickness <= 32 ? 6 : 8;
  
  // Maximum weld size
  const maxWeldSize = plateThickness - 2;
  
  // Select weld size
  const weldSize = Math.max(minWeldSize, Math.min(8, maxWeldSize));
  
  // Effective throat thickness
  const throat = 0.7 * weldSize;
  
  // Weld strength per mm
  const gamma_mw = code === 'IS800' ? 1.25 : 1.0;
  const phi = code === 'AISC360' ? 0.75 : 1.0;
  
  const weldStrengthPerMm = (fuw * throat / (Math.sqrt(3) * gamma_mw)) / 1000 * phi;
  
  // Total capacity
  const totalWeldCapacity = weldStrengthPerMm * weldLength;
  
  // Utilization
  const utilizationRatio = appliedForce / totalWeldCapacity;
  
  return {
    weldSize,
    weldLength,
    electrodeGrade,
    weldStrengthPerMm,
    totalWeldCapacity,
    appliedForce,
    utilizationRatio,
    status: utilizationRatio <= 1.0 ? 'pass' : 'fail',
    minWeldSize,
    maxWeldSize,
    weldSizeOk: weldSize >= minWeldSize && weldSize <= maxWeldSize,
  };
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Design a tension member
 */
export function designTensionMember(
  sectionDesignation: string,
  length: number,
  Pu: number,
  grade: SteelGradeType = 'E250',
  code: SteelDesignCode = 'IS800',
  numHoles: number = 0,
  holeDiameter: number = 22
): SteelMemberDesignResult {
  const section = findSection(sectionDesignation);
  if (!section) throw new Error(`Section ${sectionDesignation} not found`);
  
  const engine = new SteelMemberDesignEngine({
    memberType: 'tension',
    geometry: { length },
    loading: { Pu },
    materials: { grade, section, code },
    numHoles,
    holeDiameter,
  });
  
  return engine.design();
}

/**
 * Design a compression member (column)
 */
export function designColumn(
  sectionDesignation: string,
  length: number,
  Pu: number,
  Kx: number = 1.0,
  Ky: number = 1.0,
  grade: SteelGradeType = 'E250',
  code: SteelDesignCode = 'IS800'
): SteelMemberDesignResult {
  const section = findSection(sectionDesignation);
  if (!section) throw new Error(`Section ${sectionDesignation} not found`);
  
  const engine = new SteelMemberDesignEngine({
    memberType: 'compression',
    geometry: { length, Lx: Kx * length, Ly: Ky * length },
    loading: { Pu: -Math.abs(Pu) },  // Compression is negative
    materials: { grade, section, code },
  });
  
  return engine.design();
}

/**
 * Design a beam
 */
export function designSteelBeam(
  sectionDesignation: string,
  span: number,
  Mu: number,
  Vu: number,
  unbracedLength: number | null = null,
  grade: SteelGradeType = 'E250',
  code: SteelDesignCode = 'IS800'
): SteelMemberDesignResult {
  const section = findSection(sectionDesignation);
  if (!section) throw new Error(`Section ${sectionDesignation} not found`);
  
  const engine = new SteelMemberDesignEngine({
    memberType: 'beam',
    geometry: { 
      length: span, 
      Lb: unbracedLength || span 
    },
    loading: { Mux: Mu, Vu },
    materials: { grade, section, code },
    lateralRestraint: unbracedLength === null ? 'full' : 'none',
  });
  
  return engine.design();
}

/**
 * Design a beam-column
 */
export function designBeamColumn(
  sectionDesignation: string,
  length: number,
  Pu: number,
  Mux: number,
  Muy: number = 0,
  Kx: number = 1.0,
  Ky: number = 1.0,
  grade: SteelGradeType = 'E250',
  code: SteelDesignCode = 'IS800'
): SteelMemberDesignResult {
  const section = findSection(sectionDesignation);
  if (!section) throw new Error(`Section ${sectionDesignation} not found`);
  
  const engine = new SteelMemberDesignEngine({
    memberType: 'beam-column',
    geometry: { length, Lx: Kx * length, Ly: Ky * length, Lb: Ky * length },
    loading: { Pu: -Math.abs(Pu), Mux, Muy },
    materials: { grade, section, code },
  });
  
  return engine.design();
}

// =============================================================================
// EXPORTS - Note: SteelMemberDesignEngine is already exported above with 'export class'
// =============================================================================

export type TensionMemberResult = TensionDesignResult;
export type CompressionMemberResult = CompressionDesignResult;
export type BeamColumnResult = BeamColumnDesignResult;

export default SteelMemberDesignEngine;
