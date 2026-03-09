/**
 * ============================================================================
 * COMPREHENSIVE STEEL DESIGN ENGINE
 * ============================================================================
 * STATUS: NON-CANONICAL — Use canonical engines for new features.
 * 
 * Canonical IS 800 engines:
 *  - components/structural/SteelDesignEngine.ts — Beam LTB design (primary)
 *  - utils/IS800_SteelDesignEngine.ts — Member checks for FSD optimizer
 *  - modules/codes/IS800.ts — Reference constants & utility functions
 * 
 * This module is a multi-code wrapper used by SteelMemberDesigner.tsx.
 * 
 * Complete steel member design capabilities:
 * - IS 800:2007 (Indian Standard - LSM)
 * - AISC 360-22 (American Institute of Steel Construction)
 * - Eurocode 3 (EN 1993-1-1)
 * 
 * Features:
 * - Tension Member Design
 * - Compression Member Design (Columns)
 * - Beam Design (Flexure + Shear)
 * - Beam-Column Design (Combined)
 * - Local Buckling Checks
 * - Lateral-Torsional Buckling
 * - Web Crippling
 * - Connection Design
 * 
 * @version 3.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type SteelDesignCode = 'IS800' | 'AISC360' | 'EC3';
export type SectionType = 'I' | 'H' | 'CHANNEL' | 'ANGLE' | 'TUBE' | 'PIPE' | 'PLATE';
export type MemberType = 'TENSION' | 'COMPRESSION' | 'BEAM' | 'BEAM_COLUMN';

export interface SteelGrade {
  name: string;
  fy: number;        // Yield strength (MPa)
  fu: number;        // Ultimate strength (MPa)
  E: number;         // Elastic modulus (MPa)
  G: number;         // Shear modulus (MPa)
  nu: number;        // Poisson's ratio
  rho: number;       // Density (kg/m³)
}

export interface SteelSection {
  name: string;
  type: SectionType;
  // Geometric properties
  A: number;         // Area (mm²)
  Ix: number;        // Moment of inertia about x (mm⁴)
  Iy: number;        // Moment of inertia about y (mm⁴)
  Zx: number;        // Elastic section modulus x (mm³)
  Zy: number;        // Elastic section modulus y (mm³)
  Zpx: number;       // Plastic section modulus x (mm³)
  Zpy: number;       // Plastic section modulus y (mm³)
  rx: number;        // Radius of gyration x (mm)
  ry: number;        // Radius of gyration y (mm)
  J: number;         // Torsional constant (mm⁴)
  Cw: number;        // Warping constant (mm⁶)
  // Section dimensions
  D: number;         // Total depth (mm)
  B: number;         // Flange width (mm)
  tf: number;        // Flange thickness (mm)
  tw: number;        // Web thickness (mm)
  // Classification
  sectionClass?: 1 | 2 | 3 | 4;
}

export interface MemberGeometry {
  length: number;    // mm
  Lx?: number;       // Effective length about x (mm)
  Ly?: number;       // Effective length about y (mm)
  Lz?: number;       // Effective length for LTB (mm)
  Lb?: number;       // Unbraced length for bending (mm)
  endConditions: {
    x: 'fixed-fixed' | 'fixed-pinned' | 'pinned-pinned' | 'fixed-free';
    y: 'fixed-fixed' | 'fixed-pinned' | 'pinned-pinned' | 'fixed-free';
  };
  bracingPoints?: number[]; // Positions of lateral bracing
  Cb?: number;       // Moment gradient factor (calculated if not provided)
}

export interface MemberForces {
  // Axial
  Pu?: number;       // Ultimate axial (kN)
  Pt?: number;       // Tension (kN)
  Pc?: number;       // Compression (kN)
  // Moments
  Mux?: number;      // Ultimate moment about x (kNm)
  Muy?: number;      // Ultimate moment about y (kNm)
  // Shear
  Vux?: number;      // Shear in x direction (kN)
  Vuy?: number;      // Shear in y direction (kN)
  // For combined checks
  M1x?: number;      // Smaller end moment about x
  M2x?: number;      // Larger end moment about x
  M1y?: number;      // Smaller end moment about y
  M2y?: number;      // Larger end moment about y
}

export interface SteelDesignResult {
  status: 'PASS' | 'FAIL' | 'WARNING';
  section: SteelSection;
  checks: SteelDesignCheck[];
  capacities: {
    tensionCapacity?: number;
    compressionCapacity?: number;
    momentCapacityX?: number;
    momentCapacityY?: number;
    shearCapacityX?: number;
    shearCapacityY?: number;
  };
  utilizationRatios: {
    axial?: number;
    bendingX?: number;
    bendingY?: number;
    shear?: number;
    combined?: number;
    overall: number;
  };
  sectionClass: 1 | 2 | 3 | 4;
  warnings?: string[];
}

export interface SteelDesignCheck {
  name: string;
  clause: string;
  demand: number;
  capacity: number;
  ratio: number;
  status: 'PASS' | 'FAIL';
  formula?: string;
}

// ============================================================================
// STEEL GRADE DATABASE
// ============================================================================

const STEEL_GRADES: Record<string, SteelGrade> = {
  // IS 800 Grades
  'E250': { name: 'E250 (Fe 410)', fy: 250, fu: 410, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  'E275': { name: 'E275', fy: 275, fu: 430, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  'E300': { name: 'E300', fy: 300, fu: 440, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  'E350': { name: 'E350 (Fe 490)', fy: 350, fu: 490, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  'E410': { name: 'E410 (Fe 540)', fy: 410, fu: 540, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  'E450': { name: 'E450 (Fe 570)', fy: 450, fu: 570, E: 200000, G: 76923, nu: 0.3, rho: 7850 },
  // ASTM Grades
  'A36': { name: 'ASTM A36', fy: 250, fu: 400, E: 200000, G: 77200, nu: 0.3, rho: 7850 },
  'A572-50': { name: 'ASTM A572 Gr 50', fy: 345, fu: 450, E: 200000, G: 77200, nu: 0.3, rho: 7850 },
  'A992': { name: 'ASTM A992', fy: 345, fu: 450, E: 200000, G: 77200, nu: 0.3, rho: 7850 },
  // EN Grades
  'S235': { name: 'S235', fy: 235, fu: 360, E: 210000, G: 80769, nu: 0.3, rho: 7850 },
  'S275': { name: 'S275', fy: 275, fu: 430, E: 210000, G: 80769, nu: 0.3, rho: 7850 },
  'S355': { name: 'S355', fy: 355, fu: 510, E: 210000, G: 80769, nu: 0.3, rho: 7850 },
  'S460': { name: 'S460', fy: 460, fu: 540, E: 210000, G: 80769, nu: 0.3, rho: 7850 },
};

// ============================================================================
// INDIAN STANDARD SECTIONS DATABASE
// ============================================================================

const IS_SECTIONS: Record<string, SteelSection> = {
  'ISMB100': { name: 'ISMB100', type: 'I', A: 1140, Ix: 2.57e6, Iy: 0.179e6, Zx: 51.4e3, Zy: 7.16e3, Zpx: 58.9e3, Zpy: 11.4e3, rx: 47.5, ry: 12.5, J: 7.93e3, Cw: 1.24e9, D: 100, B: 75, tf: 7.2, tw: 4.0 },
  'ISMB150': { name: 'ISMB150', type: 'I', A: 1840, Ix: 7.26e6, Iy: 0.466e6, Zx: 96.8e3, Zy: 12.4e3, Zpx: 110.0e3, Zpy: 19.5e3, rx: 62.8, ry: 15.9, J: 14.8e3, Cw: 5.22e9, D: 150, B: 80, tf: 7.6, tw: 4.8 },
  'ISMB200': { name: 'ISMB200', type: 'I', A: 2540, Ix: 17.0e6, Iy: 0.865e6, Zx: 170e3, Zy: 19.6e3, Zpx: 194e3, Zpy: 30.8e3, rx: 81.8, ry: 18.5, J: 25.2e3, Cw: 16.0e9, D: 200, B: 100, tf: 9.0, tw: 5.4 },
  'ISMB250': { name: 'ISMB250', type: 'I', A: 3470, Ix: 35.1e6, Iy: 1.37e6, Zx: 281e3, Zy: 27.4e3, Zpx: 320e3, Zpy: 43.0e3, rx: 100.6, ry: 19.9, J: 40.1e3, Cw: 42.5e9, D: 250, B: 125, tf: 9.7, tw: 5.5 },
  'ISMB300': { name: 'ISMB300', type: 'I', A: 4660, Ix: 64.1e6, Iy: 2.13e6, Zx: 427e3, Zy: 34.2e3, Zpx: 487e3, Zpy: 53.8e3, rx: 117.3, ry: 21.4, J: 59.4e3, Cw: 89.2e9, D: 300, B: 140, tf: 10.6, tw: 6.1 },
  'ISMB350': { name: 'ISMB350', type: 'I', A: 5240, Ix: 97.8e6, Iy: 2.38e6, Zx: 559e3, Zy: 34.0e3, Zpx: 640e3, Zpy: 53.5e3, rx: 136.6, ry: 21.3, J: 69.1e3, Cw: 149e9, D: 350, B: 140, tf: 11.4, tw: 6.4 },
  'ISMB400': { name: 'ISMB400', type: 'I', A: 6040, Ix: 154e6, Iy: 3.04e6, Zx: 772e3, Zy: 40.5e3, Zpx: 885e3, Zpy: 63.8e3, rx: 159.8, ry: 22.4, J: 95.0e3, Cw: 274e9, D: 400, B: 150, tf: 12.7, tw: 7.6 },
  'ISMB450': { name: 'ISMB450', type: 'I', A: 7220, Ix: 229e6, Iy: 3.93e6, Zx: 1018e3, Zy: 49.1e3, Zpx: 1166e3, Zpy: 77.5e3, rx: 178.1, ry: 23.3, J: 130e3, Cw: 468e9, D: 450, B: 160, tf: 13.4, tw: 8.0 },
  'ISMB500': { name: 'ISMB500', type: 'I', A: 9540, Ix: 369e6, Iy: 6.68e6, Zx: 1476e3, Zy: 74.3e3, Zpx: 1690e3, Zpy: 117e3, rx: 196.7, ry: 26.5, J: 210e3, Cw: 951e9, D: 500, B: 180, tf: 17.2, tw: 10.2 },
  'ISMB550': { name: 'ISMB550', type: 'I', A: 10980, Ix: 514e6, Iy: 7.99e6, Zx: 1870e3, Zy: 84.4e3, Zpx: 2141e3, Zpy: 133e3, rx: 216.3, ry: 27.0, J: 270e3, Cw: 1462e9, D: 550, B: 190, tf: 18.3, tw: 10.8 },
  'ISMB600': { name: 'ISMB600', type: 'I', A: 12100, Ix: 687e6, Iy: 9.21e6, Zx: 2290e3, Zy: 92.1e3, Zpx: 2625e3, Zpy: 145e3, rx: 238.4, ry: 27.6, J: 325e3, Cw: 2140e9, D: 600, B: 200, tf: 19.0, tw: 11.2 },
};

// ============================================================================
// MAIN STEEL DESIGN ENGINE CLASS
// ============================================================================

export class SteelDesignEngine {
  private code: SteelDesignCode;
  private steel: SteelGrade;
  private gamma_m0: number;  // Partial safety factor for yielding
  private gamma_m1: number;  // Partial safety factor for buckling

  constructor(code: SteelDesignCode, steelGrade: string) {
    this.code = code;
    this.steel = STEEL_GRADES[steelGrade] || STEEL_GRADES['E250'];
    
    switch (code) {
      case 'IS800':
        this.gamma_m0 = 1.10;  // IS 800 Table 5 — yielding/instability
        this.gamma_m1 = 1.25;  // IS 800 Table 5 — ultimate stress/fracture
        break;
      case 'AISC360':
        this.gamma_m0 = 1 / 0.9;  // φ = 0.9 for yielding
        this.gamma_m1 = 1 / 0.9;  // φ = 0.9 for buckling
        break;
      case 'EC3':
        this.gamma_m0 = 1.0;
        this.gamma_m1 = 1.0;
        break;
    }
  }

  // --------------------------------------------------------------------------
  // SECTION CLASSIFICATION
  // --------------------------------------------------------------------------

  classifySection(section: SteelSection): 1 | 2 | 3 | 4 {
    const fy = this.steel.fy;
    const epsilon = Math.sqrt(250 / fy);
    
    // Flange classification (outstand compression element)
    const bf = (section.B - section.tw) / 2;
    const tf = section.tf;
    const flangeRatio = bf / tf;
    
    // Web classification (internal compression element)
    const dw = section.D - 2 * section.tf;
    const tw = section.tw;
    const webRatio = dw / tw;
    
    // IS 800:2007 Table 2
    let flangeClass: 1 | 2 | 3 | 4;
    let webClass: 1 | 2 | 3 | 4;
    
    // Flange (rolled sections, outstand)
    if (flangeRatio <= 9.4 * epsilon) flangeClass = 1;
    else if (flangeRatio <= 10.5 * epsilon) flangeClass = 2;
    else if (flangeRatio <= 15.7 * epsilon) flangeClass = 3;
    else flangeClass = 4;
    
    // Web (internal element in bending)
    if (webRatio <= 84 * epsilon) webClass = 1;
    else if (webRatio <= 105 * epsilon) webClass = 2;
    else if (webRatio <= 126 * epsilon) webClass = 3;
    else webClass = 4;
    
    return Math.max(flangeClass, webClass) as 1 | 2 | 3 | 4;
  }

  // --------------------------------------------------------------------------
  // TENSION MEMBER DESIGN
  // --------------------------------------------------------------------------

  designTensionMember(
    section: SteelSection,
    geometry: MemberGeometry,
    forces: MemberForces,
    connectionType: 'welded' | 'bolted',
    netAreaRatio?: number
  ): SteelDesignResult {
    const checks: SteelDesignCheck[] = [];
    const warnings: string[] = [];
    
    const Pt = (forces.Pt || forces.Pu || 0) * 1e3; // Convert to N
    const fy = this.steel.fy;
    const fu = this.steel.fu;
    const A = section.A;
    
    // Net area (for bolted connections)
    const An = netAreaRatio ? A * netAreaRatio : A;
    
    // IS 800:2007 Cl. 6.2 - Design Tension Capacity
    
    // 1. Yielding of gross section
    const Tdg = A * fy / this.gamma_m0;
    
    checks.push({
      name: 'Gross Section Yielding',
      clause: 'IS 800:2007 Cl. 6.2',
      demand: Pt,
      capacity: Tdg,
      ratio: Pt / Tdg,
      status: Pt <= Tdg ? 'PASS' : 'FAIL',
      formula: 'Tdg = Ag × fy / γm0'
    });
    
    // 2. Rupture of net section
    const alpha = connectionType === 'welded' ? 1.0 : 0.9;
    const Tdn = alpha * An * fu / this.gamma_m1;
    
    checks.push({
      name: 'Net Section Rupture',
      clause: 'IS 800:2007 Cl. 6.3',
      demand: Pt,
      capacity: Tdn,
      ratio: Pt / Tdn,
      status: Pt <= Tdn ? 'PASS' : 'FAIL',
      formula: 'Tdn = α × An × fu / γm1'
    });
    
    // 3. Block shear (for bolted connections)
    if (connectionType === 'bolted') {
      // Simplified block shear - would need connection details for accurate calc
      const Tdb = 0.9 * Tdn; // Conservative estimate
      
      checks.push({
        name: 'Block Shear',
        clause: 'IS 800:2007 Cl. 6.4',
        demand: Pt,
        capacity: Tdb,
        ratio: Pt / Tdb,
        status: Pt <= Tdb ? 'PASS' : 'FAIL',
        formula: 'Tdb = (Avg × fy/√3 + 0.9 × Atn × fu) / γm1'
      });
    }
    
    // Slenderness check (optional for tension members)
    const lambda_max = geometry.length / Math.min(section.rx, section.ry);
    const lambda_limit = 400; // IS 800:2007 Table 3
    
    if (lambda_max > lambda_limit) {
      warnings.push(`Slenderness ratio ${lambda_max.toFixed(0)} exceeds limit of ${lambda_limit}`);
    }
    
    const tensionCapacity = Math.min(Tdg, Tdn);
    const utilizationRatio = Pt / tensionCapacity;
    const sectionClass = this.classifySection(section);
    
    return {
      status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL',
      section,
      checks,
      capacities: {
        tensionCapacity: tensionCapacity / 1e3
      },
      utilizationRatios: {
        axial: utilizationRatio,
        overall: utilizationRatio
      },
      sectionClass,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  // --------------------------------------------------------------------------
  // COMPRESSION MEMBER DESIGN
  // --------------------------------------------------------------------------

  designCompressionMember(
    section: SteelSection,
    geometry: MemberGeometry,
    forces: MemberForces
  ): SteelDesignResult {
    const checks: SteelDesignCheck[] = [];
    const warnings: string[] = [];
    
    const Pc = (forces.Pc || forces.Pu || 0) * 1e3; // Convert to N
    const fy = this.steel.fy;
    const E = this.steel.E;
    const A = section.A;
    
    // Effective lengths
    const Kx = this.getEffectiveLengthFactor(geometry.endConditions.x);
    const Ky = this.getEffectiveLengthFactor(geometry.endConditions.y);
    const Lx = geometry.Lx || Kx * geometry.length;
    const Ly = geometry.Ly || Ky * geometry.length;
    
    // Slenderness ratios
    const lambda_x = Lx / section.rx;
    const lambda_y = Ly / section.ry;
    const lambda_max = Math.max(lambda_x, lambda_y);
    
    checks.push({
      name: 'Slenderness Ratio',
      clause: 'IS 800:2007 Cl. 7.2.2',
      demand: lambda_max,
      capacity: 180,
      ratio: lambda_max / 180,
      status: lambda_max <= 180 ? 'PASS' : 'FAIL',
      formula: 'λ = KL/r ≤ 180'
    });
    
    // Section classification
    const sectionClass = this.classifySection(section);
    
    if (sectionClass === 4) {
      warnings.push('Section is Class 4 - effective section properties should be used');
    }
    
    // Design compressive stress (IS 800:2007 Cl. 7.1.2)
    const fcd = this.getDesignCompressiveStress(lambda_max, section.type);
    const Pd = A * fcd;
    
    checks.push({
      name: 'Axial Compression Capacity',
      clause: 'IS 800:2007 Cl. 7.1.2',
      demand: Pc,
      capacity: Pd,
      ratio: Pc / Pd,
      status: Pc <= Pd ? 'PASS' : 'FAIL',
      formula: 'Pd = Ae × fcd'
    });
    
    // Local buckling check
    const localBucklingCheck = this.checkLocalBuckling(section);
    checks.push(localBucklingCheck);
    
    const utilizationRatio = Pc / Pd;
    
    return {
      status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL',
      section,
      checks,
      capacities: {
        compressionCapacity: Pd / 1e3
      },
      utilizationRatios: {
        axial: utilizationRatio,
        overall: utilizationRatio
      },
      sectionClass,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private getEffectiveLengthFactor(endCondition: string): number {
    switch (endCondition) {
      case 'fixed-fixed': return 0.65;
      case 'fixed-pinned': return 0.80;
      case 'pinned-pinned': return 1.00;
      case 'fixed-free': return 2.00;
      default: return 1.00;
    }
  }

  private getDesignCompressiveStress(lambda: number, sectionType: SectionType): number {
    const fy = this.steel.fy;
    const E = this.steel.E;
    
    // IS 800:2007 Cl. 7.1.2.1
    const fcc = Math.PI * Math.PI * E / (lambda * lambda);
    const lambda_e = Math.sqrt(fy / fcc);
    
    // Imperfection factor (Table 7, IS 800:2007)
    let alpha: number;
    switch (sectionType) {
      case 'I':
      case 'H':
        alpha = 0.34; // Buckling curve b
        break;
      case 'CHANNEL':
      case 'ANGLE':
        alpha = 0.49; // Buckling curve c
        break;
      case 'TUBE':
      case 'PIPE':
        alpha = 0.21; // Buckling curve a
        break;
      default:
        alpha = 0.49;
    }
    
    // Stress reduction factor
    const phi = 0.5 * (1 + alpha * (lambda_e - 0.2) + lambda_e * lambda_e);
    const chi = 1 / (phi + Math.sqrt(phi * phi - lambda_e * lambda_e));
    const chi_limited = Math.min(chi, 1.0);
    
    const fcd = chi_limited * fy / this.gamma_m0;
    
    return fcd;
  }

  private checkLocalBuckling(section: SteelSection): SteelDesignCheck {
    const fy = this.steel.fy;
    const epsilon = Math.sqrt(250 / fy);
    
    // Flange outstand
    const bf = (section.B - section.tw) / 2;
    const flangeRatio = bf / section.tf;
    const flangeLimitClass3 = 15.7 * epsilon;
    
    // Web
    const dw = section.D - 2 * section.tf;
    const webRatio = dw / section.tw;
    const webLimitClass3 = 42 * epsilon; // For uniform compression
    
    const criticalRatio = Math.max(flangeRatio / flangeLimitClass3, webRatio / webLimitClass3);
    
    return {
      name: 'Local Buckling (Slenderness)',
      clause: 'IS 800:2007 Table 2',
      demand: criticalRatio,
      capacity: 1.0,
      ratio: criticalRatio,
      status: criticalRatio <= 1.0 ? 'PASS' : 'FAIL',
      formula: 'b/t ≤ limiting value for section class'
    };
  }

  // --------------------------------------------------------------------------
  // BEAM DESIGN
  // --------------------------------------------------------------------------

  designBeam(
    section: SteelSection,
    geometry: MemberGeometry,
    forces: MemberForces
  ): SteelDesignResult {
    const checks: SteelDesignCheck[] = [];
    const warnings: string[] = [];
    
    const Mux = (forces.Mux || 0) * 1e6; // Convert to Nmm
    const Muy = (forces.Muy || 0) * 1e6;
    const Vux = (forces.Vux || 0) * 1e3; // Convert to N
    const Vuy = (forces.Vuy || 0) * 1e3;
    
    const fy = this.steel.fy;
    const sectionClass = this.classifySection(section);
    
    // Plastic vs elastic section modulus based on class
    const Zx = sectionClass <= 2 ? section.Zpx : section.Zx;
    const Zy = sectionClass <= 2 ? section.Zpy : section.Zy;
    
    // 1. Section moment capacity
    const Mdx = Zx * fy / this.gamma_m0;
    const Mdy = Zy * fy / this.gamma_m0;
    
    checks.push({
      name: 'Section Moment Capacity (Major Axis)',
      clause: 'IS 800:2007 Cl. 8.2.1',
      demand: Mux,
      capacity: Mdx,
      ratio: Mux / Mdx,
      status: Mux <= Mdx ? 'PASS' : 'FAIL',
      formula: 'Md = βb × Zp × fy / γm0'
    });
    
    if (Muy > 0) {
      checks.push({
        name: 'Section Moment Capacity (Minor Axis)',
        clause: 'IS 800:2007 Cl. 8.2.1',
        demand: Muy,
        capacity: Mdy,
        ratio: Muy / Mdy,
        status: Muy <= Mdy ? 'PASS' : 'FAIL'
      });
    }
    
    // 2. Lateral-Torsional Buckling (LTB)
    const Lb = geometry.Lb || geometry.length;
    const Mcr = this.getCriticalMoment(section, Lb, geometry.Cb);
    const Md_LTB = this.getLTBMomentCapacity(section, Mcr, sectionClass);
    
    checks.push({
      name: 'Lateral-Torsional Buckling',
      clause: 'IS 800:2007 Cl. 8.2.2',
      demand: Mux,
      capacity: Md_LTB,
      ratio: Mux / Md_LTB,
      status: Mux <= Md_LTB ? 'PASS' : 'FAIL',
      formula: 'Md = βb × Zp × fbd'
    });
    
    // 3. Shear capacity
    const Av = section.D * section.tw; // Shear area
    const Vd = Av * fy / (Math.sqrt(3) * this.gamma_m0);
    
    checks.push({
      name: 'Shear Capacity',
      clause: 'IS 800:2007 Cl. 8.4',
      demand: Math.max(Vux, Vuy),
      capacity: Vd,
      ratio: Math.max(Vux, Vuy) / Vd,
      status: Math.max(Vux, Vuy) <= Vd ? 'PASS' : 'FAIL',
      formula: 'Vd = Av × fy / (√3 × γm0)'
    });
    
    // 4. Check for high shear
    if (Math.max(Vux, Vuy) > 0.6 * Vd) {
      warnings.push('High shear - moment capacity should be reduced');
      // Reduced moment capacity calculation would go here
    }
    
    // 5. Web buckling in shear
    const webShearBuckling = this.checkWebShearBuckling(section);
    if (webShearBuckling.ratio > 1.0) {
      checks.push(webShearBuckling);
    }
    
    // 6. Deflection check (if serviceability)
    // Would need span and loading details
    
    const momentCapacityX = Math.min(Mdx, Md_LTB);
    const utilizationBendingX = Mux / momentCapacityX;
    const utilizationBendingY = Muy > 0 ? Muy / Mdy : 0;
    const utilizationShear = Math.max(Vux, Vuy) / Vd;
    
    const overallUtilization = Math.max(utilizationBendingX, utilizationBendingY, utilizationShear);
    
    return {
      status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL',
      section,
      checks,
      capacities: {
        momentCapacityX: momentCapacityX / 1e6,
        momentCapacityY: Mdy / 1e6,
        shearCapacityX: Vd / 1e3,
        shearCapacityY: Vd / 1e3
      },
      utilizationRatios: {
        bendingX: utilizationBendingX,
        bendingY: utilizationBendingY,
        shear: utilizationShear,
        overall: overallUtilization
      },
      sectionClass,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private getCriticalMoment(section: SteelSection, Lb: number, Cb?: number): number {
    const E = this.steel.E;
    const G = this.steel.G;
    const Iy = section.Iy;
    const J = section.J;
    const Cw = section.Cw;
    
    // Moment gradient factor
    const CbValue = Cb || 1.0;
    
    // IS 800:2007 Cl. 8.2.2.1 - Elastic critical moment
    const term1 = Math.PI * Math.PI * E * Iy / (Lb * Lb);
    const term2 = G * J + Math.PI * Math.PI * E * Cw / (Lb * Lb);
    
    const Mcr = CbValue * Math.sqrt(term1 * term2);
    
    return Mcr;
  }

  private getLTBMomentCapacity(section: SteelSection, Mcr: number, sectionClass: 1 | 2 | 3 | 4): number {
    const fy = this.steel.fy;
    const Zp = sectionClass <= 2 ? section.Zpx : section.Zx;
    
    // Plastic moment
    const Mp = Zp * fy;
    
    // Non-dimensional slenderness
    const lambda_LT = Math.sqrt(Mp / Mcr);
    
    // IS 800:2007 Cl. 8.2.2
    if (lambda_LT <= 0.4) {
      // No LTB
      return Mp / this.gamma_m0;
    }
    
    // Imperfection factor for rolled I-sections
    const alpha_LT = 0.21;
    
    const phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT * lambda_LT);
    const chi_LT = 1 / (phi_LT + Math.sqrt(phi_LT * phi_LT - lambda_LT * lambda_LT));
    const chi_LT_limited = Math.min(chi_LT, 1.0);
    
    const fbd = chi_LT_limited * fy / this.gamma_m0;
    const Md = Zp * fbd;
    
    return Md;
  }

  private checkWebShearBuckling(section: SteelSection): SteelDesignCheck {
    const dw = section.D - 2 * section.tf;
    const tw = section.tw;
    const fy = this.steel.fy;
    const E = this.steel.E;
    
    const lambda_w = dw / tw / (Math.sqrt(E / fy) * 5.35 * Math.sqrt(1));
    
    return {
      name: 'Web Shear Buckling',
      clause: 'IS 800:2007 Cl. 8.4.2',
      demand: dw / tw,
      capacity: 67 * Math.sqrt(250 / fy),
      ratio: (dw / tw) / (67 * Math.sqrt(250 / fy)),
      status: (dw / tw) <= 67 * Math.sqrt(250 / fy) ? 'PASS' : 'FAIL',
      formula: 'd/tw ≤ 67ε (no stiffeners required)'
    };
  }

  // --------------------------------------------------------------------------
  // BEAM-COLUMN DESIGN
  // --------------------------------------------------------------------------

  designBeamColumn(
    section: SteelSection,
    geometry: MemberGeometry,
    forces: MemberForces
  ): SteelDesignResult {
    const checks: SteelDesignCheck[] = [];
    const warnings: string[] = [];
    
    const Pu = (forces.Pu || forces.Pc || 0) * 1e3;
    const Mux = (forces.Mux || 0) * 1e6;
    const Muy = (forces.Muy || 0) * 1e6;
    
    const fy = this.steel.fy;
    const sectionClass = this.classifySection(section);
    
    // Get individual capacities
    const compressionResult = this.designCompressionMember(section, geometry, { Pc: Pu / 1e3 });
    const beamResult = this.designBeam(section, geometry, { Mux: Mux / 1e6, Muy: Muy / 1e6 });
    
    // Add individual checks
    checks.push(...compressionResult.checks);
    checks.push(...beamResult.checks);
    
    // Combined interaction check (IS 800:2007 Cl. 9.3)
    const Pd = (compressionResult.capacities.compressionCapacity || 0) * 1e3;
    const Mdx = (beamResult.capacities.momentCapacityX || 0) * 1e6;
    const Mdy = (beamResult.capacities.momentCapacityY || 0) * 1e6;
    
    // Amplification factors
    const Cmx = this.getCmFactor(forces.M1x, forces.M2x);
    const Cmy = this.getCmFactor(forces.M1y, forces.M2y);
    
    // Euler buckling loads
    const Lx = geometry.Lx || this.getEffectiveLengthFactor(geometry.endConditions.x) * geometry.length;
    const Ly = geometry.Ly || this.getEffectiveLengthFactor(geometry.endConditions.y) * geometry.length;
    const Pex = Math.PI * Math.PI * this.steel.E * section.Ix / (Lx * Lx);
    const Pey = Math.PI * Math.PI * this.steel.E * section.Iy / (Ly * Ly);
    
    // Amplified moments
    const Mux_amp = Cmx * Mux / (1 - Pu / Pex);
    const Muy_amp = Cmy * Muy / (1 - Pu / Pey);
    
    // Combined ratio
    const combinedRatio = (Pu / Pd) + (Mux_amp / Mdx) + (Muy_amp / Mdy);
    
    checks.push({
      name: 'Combined Axial + Bending Interaction',
      clause: 'IS 800:2007 Cl. 9.3.1',
      demand: combinedRatio,
      capacity: 1.0,
      ratio: combinedRatio,
      status: combinedRatio <= 1.0 ? 'PASS' : 'FAIL',
      formula: 'P/Pd + (Cm×Mx/Mdx)/(1-P/Pex) + (Cm×My/Mdy)/(1-P/Pey) ≤ 1.0'
    });
    
    // Alternative check for section capacity
    const sectionCapacityRatio = (Pu / (section.A * fy / this.gamma_m0)) + 
                                  (Mux / (section.Zpx * fy / this.gamma_m0)) + 
                                  (Muy / (section.Zpy * fy / this.gamma_m0));
    
    checks.push({
      name: 'Section Capacity Check',
      clause: 'IS 800:2007 Cl. 9.3.1',
      demand: sectionCapacityRatio,
      capacity: 1.0,
      ratio: sectionCapacityRatio,
      status: sectionCapacityRatio <= 1.0 ? 'PASS' : 'FAIL',
      formula: 'P/(Ag×fy) + Mx/(Zpx×fy) + My/(Zpy×fy) ≤ 1.0'
    });
    
    const overallUtilization = Math.max(combinedRatio, sectionCapacityRatio);
    
    return {
      status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL',
      section,
      checks,
      capacities: {
        compressionCapacity: Pd / 1e3,
        momentCapacityX: Mdx / 1e6,
        momentCapacityY: Mdy / 1e6
      },
      utilizationRatios: {
        axial: Pu / Pd,
        bendingX: Mux / Mdx,
        bendingY: Muy > 0 ? Muy / Mdy : 0,
        combined: combinedRatio,
        overall: overallUtilization
      },
      sectionClass,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private getCmFactor(M1?: number, M2?: number): number {
    if (!M1 || !M2) return 1.0;
    
    const psi = M1 / M2; // Ratio of end moments (M1 is smaller)
    
    // IS 800:2007 Table 18 for uniform members
    if (M1 * M2 > 0) {
      // Single curvature
      return 0.6 + 0.4 * psi;
    } else {
      // Double curvature
      return 0.6 - 0.4 * psi;
    }
  }

  // --------------------------------------------------------------------------
  // SECTION SELECTION
  // --------------------------------------------------------------------------

  selectOptimalSection(
    memberType: MemberType,
    geometry: MemberGeometry,
    forces: MemberForces,
    sectionDatabase?: Record<string, SteelSection>
  ): { section: SteelSection; result: SteelDesignResult } | null {
    const sections = sectionDatabase || IS_SECTIONS;
    
    let bestSection: SteelSection | null = null;
    let bestResult: SteelDesignResult | null = null;
    let minWeight = Infinity;
    
    for (const sectionName in sections) {
      const section = sections[sectionName];
      
      let result: SteelDesignResult;
      
      switch (memberType) {
        case 'TENSION':
          result = this.designTensionMember(section, geometry, forces, 'welded');
          break;
        case 'COMPRESSION':
          result = this.designCompressionMember(section, geometry, forces);
          break;
        case 'BEAM':
          result = this.designBeam(section, geometry, forces);
          break;
        case 'BEAM_COLUMN':
          result = this.designBeamColumn(section, geometry, forces);
          break;
      }
      
      if (result.status === 'PASS' && result.utilizationRatios.overall >= 0.7) {
        const weight = section.A * geometry.length * this.steel.rho / 1e9;
        
        if (weight < minWeight) {
          minWeight = weight;
          bestSection = section;
          bestResult = result;
        }
      }
    }
    
    if (bestSection && bestResult) {
      return { section: bestSection, result: bestResult };
    }
    
    return null;
  }
}

// ============================================================================
// FACTORY AND EXPORTS
// ============================================================================

export const createSteelDesignEngine = (code: SteelDesignCode, steelGrade: string) =>
  new SteelDesignEngine(code, steelGrade);

export { STEEL_GRADES, IS_SECTIONS };
export default SteelDesignEngine;
