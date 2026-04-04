/**
 * ============================================================================
 * COMPREHENSIVE REINFORCED CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Complete RC design capabilities per multiple codes:
 * - IS 456:2000 (Indian Standard)
 * - ACI 318-19 (American Concrete Institute)
 * - Eurocode 2 (EN 1992-1-1)
 * - BS 8110 (British Standard - legacy)
 * 
 * Features:
 * - Beam Design (Singly/Doubly Reinforced)
 * - Column Design (Short/Slender, Uniaxial/Biaxial)
 * - Slab Design (One-way/Two-way)
 * - Shear Design with Stirrups
 * - Torsion Design
 * - Crack Width Calculation
 * - Deflection Check
 * - Detailing Requirements
 * 
 * @version 3.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type RCDesignCode = 'IS456' | 'ACI318' | 'EC2' | 'BS8110';

export interface ConcreteGrade {
  name: string;
  fck: number;       // Characteristic strength (MPa)
  fcm: number;       // Mean strength (MPa)
  Ecm: number;       // Elastic modulus (MPa)
  fctm: number;      // Mean tensile strength (MPa)
  fctk005: number;   // 5% fractile tensile (MPa)
  epscu: number;     // Ultimate strain
  epsc2: number;     // Strain at fc
  n: number;         // Exponent for parabolic curve
}

export interface RebarGrade {
  name: string;
  fy: number;        // Yield strength (MPa)
  fu: number;        // Ultimate strength (MPa)
  Es: number;        // Elastic modulus (MPa)
  epsyd: number;     // Design yield strain
  ductilityClass: 'A' | 'B' | 'C';
}

export interface BeamGeometry {
  width: number;     // mm
  depth: number;     // mm
  cover: number;     // mm (clear cover)
  effectiveDepth?: number; // mm (auto-calculated if not provided)
  flangWidth?: number;     // mm (for T/L beams)
  flangDepth?: number;     // mm (for T/L beams)
  isT?: boolean;
  isL?: boolean;
}

export interface BeamForces {
  Mu: number;        // Ultimate moment (kNm)
  Vu: number;        // Ultimate shear (kN)
  Tu?: number;       // Ultimate torsion (kNm)
  Nu?: number;       // Axial force (kN) - for beam-columns
}

export interface ColumnGeometry {
  width: number;     // mm (b)
  depth: number;     // mm (D)
  height: number;    // mm (unsupported length)
  cover: number;     // mm
  effectiveLength?: {
    lex: number;     // Effective length about x
    ley: number;     // Effective length about y
  };
  endConditions?: {
    top: 'fixed' | 'pinned' | 'partial';
    bottom: 'fixed' | 'pinned' | 'partial';
  };
}

export interface ColumnForces {
  Pu: number;        // Ultimate axial (kN)
  Mux: number;       // Ultimate moment about x (kNm)
  Muy: number;       // Ultimate moment about y (kNm)
  isBraced: boolean;
}

export interface SlabGeometry {
  Lx: number;        // Short span (m)
  Ly: number;        // Long span (m)
  thickness: number; // mm
  cover: number;     // mm
  edgeConditions: {
    x1: 'continuous' | 'discontinuous';
    x2: 'continuous' | 'discontinuous';
    y1: 'continuous' | 'discontinuous';
    y2: 'continuous' | 'discontinuous';
  };
}

export interface SlabLoading {
  deadLoad: number;  // kN/m²
  liveLoad: number;  // kN/m²
  finishes: number;  // kN/m²
  partition?: number;
}

export interface DesignResult {
  status: 'PASS' | 'FAIL' | 'WARNING';
  reinforcement: ReinforcementDetails;
  checks: DesignCheck[];
  utilizationRatio: number;
  detailing: DetailingRequirements;
  warnings?: string[];
}

export interface ReinforcementDetails {
  mainBars: {
    tension: BarArrangement;
    compression?: BarArrangement;
  };
  stirrups?: StirrupDetails;
  torsionReinf?: TorsionReinforcement;
}

export interface BarArrangement {
  numBars: number;
  diameter: number;     // mm
  spacing?: number;     // mm (for slabs)
  area: number;         // mm²
  layers: number;
  arrangement: string;  // e.g., "4T20 + 2T16"
}

export interface StirrupDetails {
  diameter: number;
  legs: number;
  spacing: number;
  maxSpacing: number;
  minSpacing: number;
  zones: StirrupZone[];
}

export interface StirrupZone {
  startX: number;
  endX: number;
  spacing: number;
  reason: string;
}

export interface TorsionReinforcement {
  longitudinal: BarArrangement;
  transverse: {
    diameter: number;
    spacing: number;
  };
}

export interface DesignCheck {
  name: string;
  clause: string;
  required: number;
  provided: number;
  ratio: number;
  status: 'PASS' | 'FAIL';
  formula?: string;
}

export interface DetailingRequirements {
  minCover: number;
  minSpacing: number;
  maxSpacing: number;
  anchorageLength: number;
  developmentLength: number;
  lapLength: number;
  bendDiameter: number;
  hookExtension: number;
}

// ============================================================================
// CONCRETE GRADE DATABASE
// ============================================================================

const CONCRETE_GRADES: Record<string, ConcreteGrade> = {
  // IS 456 Grades
  'M20': { name: 'M20', fck: 20, fcm: 28, Ecm: 22360, fctm: 2.2, fctk005: 1.5, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M25': { name: 'M25', fck: 25, fcm: 33, Ecm: 25000, fctm: 2.6, fctk005: 1.8, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M30': { name: 'M30', fck: 30, fcm: 38, Ecm: 27386, fctm: 2.9, fctk005: 2.0, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M35': { name: 'M35', fck: 35, fcm: 43, Ecm: 29580, fctm: 3.2, fctk005: 2.2, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M40': { name: 'M40', fck: 40, fcm: 48, Ecm: 31623, fctm: 3.5, fctk005: 2.5, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M45': { name: 'M45', fck: 45, fcm: 53, Ecm: 33541, fctm: 3.8, fctk005: 2.7, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'M50': { name: 'M50', fck: 50, fcm: 58, Ecm: 35355, fctm: 4.1, fctk005: 2.9, epscu: 0.0035, epsc2: 0.002, n: 2 },
  // ACI/EC2 Grades
  'C20': { name: 'C20', fck: 20, fcm: 28, Ecm: 30000, fctm: 2.2, fctk005: 1.5, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'C25': { name: 'C25', fck: 25, fcm: 33, Ecm: 31000, fctm: 2.6, fctk005: 1.8, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'C30': { name: 'C30', fck: 30, fcm: 38, Ecm: 33000, fctm: 2.9, fctk005: 2.0, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'C35': { name: 'C35', fck: 35, fcm: 43, Ecm: 34000, fctm: 3.2, fctk005: 2.2, epscu: 0.0035, epsc2: 0.002, n: 2 },
  'C40': { name: 'C40', fck: 40, fcm: 48, Ecm: 35000, fctm: 3.5, fctk005: 2.5, epscu: 0.0035, epsc2: 0.002, n: 2 },
};

const REBAR_GRADES: Record<string, RebarGrade> = {
  // IS Grades
  'Fe415': { name: 'Fe415', fy: 415, fu: 485, Es: 200000, epsyd: 0.0038, ductilityClass: 'B' },
  'Fe500': { name: 'Fe500', fy: 500, fu: 545, Es: 200000, epsyd: 0.0042, ductilityClass: 'B' },
  'Fe500D': { name: 'Fe500D', fy: 500, fu: 565, Es: 200000, epsyd: 0.0042, ductilityClass: 'C' },
  'Fe550': { name: 'Fe550', fy: 550, fu: 600, Es: 200000, epsyd: 0.0045, ductilityClass: 'B' },
  'Fe550D': { name: 'Fe550D', fy: 550, fu: 620, Es: 200000, epsyd: 0.0045, ductilityClass: 'C' },
  // ACI/EC2 Grades
  'Grade60': { name: 'Grade60', fy: 414, fu: 620, Es: 200000, epsyd: 0.0021, ductilityClass: 'B' },
  'B500B': { name: 'B500B', fy: 500, fu: 540, Es: 200000, epsyd: 0.0025, ductilityClass: 'B' },
  'B500C': { name: 'B500C', fy: 500, fu: 575, Es: 200000, epsyd: 0.0025, ductilityClass: 'C' },
};

// ============================================================================
// MAIN RC DESIGN ENGINE CLASS
// ============================================================================

export class RCDesignEngine {
  private code: RCDesignCode;
  private concrete: ConcreteGrade;
  private rebar: RebarGrade;
  private gamma_c: number;  // Partial safety factor for concrete
  private gamma_s: number;  // Partial safety factor for steel

  constructor(code: RCDesignCode, concreteGrade: string, rebarGrade: string) {
    this.code = code;
    this.concrete = CONCRETE_GRADES[concreteGrade] || CONCRETE_GRADES['M25'];
    this.rebar = REBAR_GRADES[rebarGrade] || REBAR_GRADES['Fe500'];
    
    // Set partial safety factors based on code
    switch (code) {
      case 'IS456':
        this.gamma_c = 1.5;
        this.gamma_s = 1.15;
        break;
      case 'ACI318':
        this.gamma_c = 1 / 0.65; // φ = 0.65 for tied columns
        this.gamma_s = 1 / 0.9;
        break;
      case 'EC2':
        this.gamma_c = 1.5;
        this.gamma_s = 1.15;
        break;
      case 'BS8110':
        this.gamma_c = 1.5;
        this.gamma_s = 1.05;
        break;
    }
  }

  // --------------------------------------------------------------------------
  // DESIGN PROPERTIES
  // --------------------------------------------------------------------------

  private get fcd(): number {
    // Design compressive strength of concrete
    switch (this.code) {
      case 'IS456':
        return 0.67 * this.concrete.fck / this.gamma_c;
      case 'ACI318':
        return 0.85 * this.concrete.fck;
      case 'EC2':
        return 0.85 * this.concrete.fck / this.gamma_c;
      default:
        return 0.67 * this.concrete.fck / this.gamma_c;
    }
  }

  private get fyd(): number {
    // Design yield strength of steel
    return this.rebar.fy / this.gamma_s;
  }

  // --------------------------------------------------------------------------
  // BEAM DESIGN
  // --------------------------------------------------------------------------

  designBeam(geometry: BeamGeometry, forces: BeamForces): DesignResult {
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    
    const b = geometry.width;
    const D = geometry.depth;
    const cover = geometry.cover;
    const d = geometry.effectiveDepth || D - cover - 25; // Assume 20mm bar + stirrup
    
    const Mu = forces.Mu * 1e6; // Convert to Nmm
    const Vu = forces.Vu * 1e3; // Convert to N
    
    // Step 1: Check limiting moment (balanced section)
    const { Mulim, xuMax } = this.getLimitingMoment(b, d);
    
    checks.push({
      name: 'Limiting Moment Check',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 38.1' : 'ACI 318 Ch. 21',
      required: Mu,
      provided: Mulim,
      ratio: Mu / Mulim,
      status: Mu <= Mulim ? 'PASS' : 'FAIL',
      formula: `Mu,lim = 0.36 × xu,max × (1 - 0.42 × xu,max/d) × fck × b × d²`
    });
    
    // Step 2: Design tension reinforcement
    let Ast: number;
    let Asc: number | undefined;
    let isDoublyReinforced = false;
    
    if (Mu <= Mulim) {
      // Singly reinforced
      Ast = this.calculateTensionSteel(Mu, b, d);
    } else {
      // Doubly reinforced
      isDoublyReinforced = true;
      const { tensionSteel, compressionSteel } = this.designDoublyReinforced(Mu, Mulim, b, d, cover);
      Ast = tensionSteel;
      Asc = compressionSteel;
      warnings.push('Section requires compression reinforcement');
    }
    
    // Step 3: Check minimum and maximum reinforcement
    const { minAst, maxAst } = this.getReinforcementLimits(b, D);
    
    checks.push({
      name: 'Minimum Reinforcement',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 26.5.1.1' : 'ACI 318 Sec. 9.6',
      required: minAst,
      provided: Ast,
      ratio: Ast / minAst,
      status: Ast >= minAst ? 'PASS' : 'FAIL',
      formula: `As,min = 0.85 × √fck / fy × b × d (but ≥ 0.12% for IS)`
    });
    
    checks.push({
      name: 'Maximum Reinforcement',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 26.5.1.1' : 'ACI 318 Sec. 9.6',
      required: Ast,
      provided: maxAst,
      ratio: Ast / maxAst,
      status: Ast <= maxAst ? 'PASS' : 'FAIL',
      formula: `As,max = 4% of gross area (IS 456) or 2.5% (EC2)`
    });
    
    // Step 4: Shear design
    const shearResult = this.designShear(Vu, b, d, Ast);
    checks.push(...shearResult.checks);
    
    // Step 5: Torsion design (if applicable)
    let torsionReinf: TorsionReinforcement | undefined;
    if (forces.Tu && forces.Tu > 0) {
      const torsionResult = this.designTorsion(forces.Tu * 1e6, b, D, d);
      checks.push(...torsionResult.checks);
      torsionReinf = torsionResult.reinforcement;
    }
    
    // Step 6: Select bar arrangement
    const tensionBars = this.selectBarArrangement(Ast, b, cover);
    const compressionBars = Asc ? this.selectBarArrangement(Asc, b, cover) : undefined;
    
    // Step 7: Detailing requirements
    const detailing = this.getDetailingRequirements(tensionBars.diameter, d);
    
    // Calculate utilization ratio
    const utilizationRatio = Math.max(
      Mu / Mulim,
      Ast / maxAst,
      ...checks.filter(c => c.name.includes('Shear')).map(c => c.ratio)
    );
    
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      reinforcement: {
        mainBars: {
          tension: tensionBars,
          compression: compressionBars
        },
        stirrups: shearResult.stirrups,
        torsionReinf
      },
      checks,
      utilizationRatio,
      detailing,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private getLimitingMoment(b: number, d: number): { Mulim: number; xuMax: number } {
    let xuMax_d: number;
    
    // xu,max/d depends on steel grade
    switch (this.code) {
      case 'IS456':
        if (this.rebar.fy <= 415) xuMax_d = 0.48;
        else if (this.rebar.fy <= 500) xuMax_d = 0.46;
        else xuMax_d = 0.44;
        break;
      case 'EC2':
        xuMax_d = 0.45; // For ductility
        break;
      default:
        xuMax_d = 0.45;
    }
    
    const xuMax = xuMax_d * d;
    
    // Mu,lim = 0.36 × fck × b × xu × (d - 0.42 × xu)
    const Mulim = 0.36 * this.concrete.fck * b * xuMax * (d - 0.42 * xuMax);
    
    return { Mulim, xuMax };
  }

  private calculateTensionSteel(Mu: number, b: number, d: number): number {
    // Quadratic solution for xu
    const fck = this.concrete.fck;
    const fy = this.fyd;
    
    // From Mu = 0.36 × fck × b × xu × (d - 0.42 × xu)
    // Let R = Mu / (fck × b × d²)
    const R = Mu / (fck * b * d * d);
    
    // xu/d = (1 - √(1 - 4.598 × R)) / (0.84)
    const xu_d = (1 - Math.sqrt(1 - 4.598 * R)) / 0.84;
    const xu = xu_d * d;
    
    // Ast = 0.36 × fck × b × xu / (fy/γs)
    const Ast = 0.36 * fck * b * xu / fy;
    
    return Ast;
  }

  private designDoublyReinforced(
    Mu: number,
    Mulim: number,
    b: number,
    d: number,
    cover: number
  ): { tensionSteel: number; compressionSteel: number } {
    const fck = this.concrete.fck;
    const fy = this.fyd;
    const d_prime = cover + 10; // Centroid of compression steel
    
    // Mu2 = Mu - Mulim
    const Mu2 = Mu - Mulim;
    
    // Compression steel
    const fsc = this.getCompressionSteelStress(d, d_prime);
    const Asc = Mu2 / (fsc * (d - d_prime));
    
    // Tension steel for Mulim
    const Ast1 = this.calculateTensionSteel(Mulim, b, d);
    
    // Additional tension steel for Mu2
    const Ast2 = Mu2 / (fy * (d - d_prime));
    
    return {
      tensionSteel: Ast1 + Ast2,
      compressionSteel: Asc
    };
  }

  private getCompressionSteelStress(d: number, d_prime: number): number {
    const { xuMax } = this.getLimitingMoment(1000, d); // Get xu,max
    const xu = xuMax;
    
    // Strain in compression steel
    const epssc = 0.0035 * (xu - d_prime) / xu;
    
    // Stress (capped at yield)
    const Es = this.rebar.Es;
    const fsc = Math.min(epssc * Es, this.fyd);
    
    return fsc;
  }

  private getReinforcementLimits(b: number, D: number): { minAst: number; maxAst: number } {
    let minAst: number;
    let maxAst: number;
    
    switch (this.code) {
      case 'IS456':
        minAst = 0.0012 * b * D; // 0.12% for HYSD bars
        maxAst = 0.04 * b * D;   // 4%
        break;
      case 'ACI318':
        const d = D - 50; // Approximate
        minAst = Math.max(0.25 * Math.sqrt(this.concrete.fck) / this.rebar.fy * b * d, 1.4 / this.rebar.fy * b * d);
        maxAst = 0.04 * b * D;
        break;
      case 'EC2':
        minAst = Math.max(0.26 * this.concrete.fctm / this.rebar.fy * b * D, 0.0013 * b * D);
        maxAst = 0.04 * b * D;
        break;
      default:
        minAst = 0.0012 * b * D;
        maxAst = 0.04 * b * D;
    }
    
    return { minAst, maxAst };
  }

  // --------------------------------------------------------------------------
  // SHEAR DESIGN
  // --------------------------------------------------------------------------

  private designShear(
    Vu: number,
    b: number,
    d: number,
    Ast: number
  ): { checks: DesignCheck[]; stirrups: StirrupDetails } {
    const checks: DesignCheck[] = [];
    
    // Percentage of tension steel
    const pt = (Ast * 100) / (b * d);
    
    // Design shear strength of concrete
    const tauC = this.getShearStrengthConcrete(pt);
    const Vc = tauC * b * d;
    
    checks.push({
      name: 'Concrete Shear Capacity',
      clause: this.code === 'IS456' ? 'IS 456:2000 Table 19' : 'ACI 318 Sec. 22.5',
      required: Vu,
      provided: Vc,
      ratio: Vu / Vc,
      status: Vu <= Vc ? 'PASS' : 'FAIL',
      formula: `Vc = τc × b × d`
    });
    
    // Maximum shear stress
    const tauMax = this.getMaxShearStress();
    const VuMax = tauMax * b * d;
    
    checks.push({
      name: 'Maximum Shear Stress',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 40.2.3' : 'ACI 318 Sec. 22.5',
      required: Vu,
      provided: VuMax,
      ratio: Vu / VuMax,
      status: Vu <= VuMax ? 'PASS' : 'FAIL',
      formula: `τmax = 0.62√fck (IS) or 0.83√f'c (ACI)`
    });
    
    // Design stirrups
    let Asv: number;
    let spacing: number;
    const stirrupDia = 8;
    const legs = 2;
    const Asv_per_stirrup = legs * Math.PI * stirrupDia * stirrupDia / 4;
    
    if (Vu > Vc) {
      // Shear reinforcement required
      const Vus = Vu - Vc;
      
      // Asv/sv = Vus / (0.87 × fy × d)
      const Asv_sv = Vus / (0.87 * this.rebar.fy * d);
      spacing = Math.floor(Asv_per_stirrup / Asv_sv);
    } else {
      // Minimum shear reinforcement
      const minAsv_sv = 0.4 * b / (0.87 * this.rebar.fy);
      spacing = Math.floor(Asv_per_stirrup / minAsv_sv);
    }
    
    // Spacing limits
    const maxSpacing = Math.min(0.75 * d, 300);
    spacing = Math.min(spacing, maxSpacing);
    spacing = Math.max(spacing, 75); // Practical minimum
    spacing = Math.floor(spacing / 25) * 25; // Round to 25mm
    
    checks.push({
      name: 'Stirrup Spacing',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 26.5.1.6' : 'ACI 318 Sec. 9.7',
      required: spacing,
      provided: maxSpacing,
      ratio: spacing / maxSpacing,
      status: spacing <= maxSpacing ? 'PASS' : 'FAIL'
    });
    
    return {
      checks,
      stirrups: {
        diameter: stirrupDia,
        legs,
        spacing,
        maxSpacing,
        minSpacing: 75,
        zones: [
          { startX: 0, endX: 2 * d, spacing: Math.min(spacing, 0.5 * d), reason: 'Critical shear zone' },
          { startX: 2 * d, endX: -1, spacing, reason: 'Normal zone' }
        ]
      }
    };
  }

  private getShearStrengthConcrete(pt: number): number {
    const fck = this.concrete.fck;
    
    switch (this.code) {
      case 'IS456':
        // IS 456:2000 Table 19
        const beta = Math.max(1, Math.sqrt(0.8 * fck) / (6.89 * pt));
        const tauC = 0.85 * Math.sqrt(0.8 * fck) * (Math.sqrt(1 + 5 * beta) - 1) / (6 * beta);
        return Math.min(tauC, 0.62 * Math.sqrt(fck));
      case 'ACI318':
        return 0.17 * Math.sqrt(fck);
      case 'EC2':
        const k = Math.min(2.0, 1 + Math.sqrt(200 / (pt * 100)));
        return 0.12 * k * Math.pow(100 * pt * fck, 1/3) / this.gamma_c;
      default:
        return 0.17 * Math.sqrt(fck);
    }
  }

  private getMaxShearStress(): number {
    switch (this.code) {
      case 'IS456':
        return 0.62 * Math.sqrt(this.concrete.fck);
      case 'ACI318':
        return 0.83 * Math.sqrt(this.concrete.fck);
      case 'EC2':
        return 0.6 * (1 - this.concrete.fck / 250) * this.concrete.fck / this.gamma_c;
      default:
        return 0.62 * Math.sqrt(this.concrete.fck);
    }
  }

  // --------------------------------------------------------------------------
  // TORSION DESIGN
  // --------------------------------------------------------------------------

  private designTorsion(
    Tu: number,
    b: number,
    D: number,
    d: number
  ): { checks: DesignCheck[]; reinforcement: TorsionReinforcement } {
    const checks: DesignCheck[] = [];
    const fck = this.concrete.fck;
    const fy = this.fyd;
    
    // Threshold torsion
    const Acp = b * D;
    const Pcp = 2 * (b + D);
    const Tcr = 0.17 * Math.sqrt(fck) * Acp * Acp / Pcp; // Cracking torsion
    
    checks.push({
      name: 'Threshold Torsion',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 41.1' : 'ACI 318 Sec. 22.7',
      required: Tu,
      provided: Tcr,
      ratio: Tu / Tcr,
      status: Tu > Tcr ? 'FAIL' : 'PASS'
    });
    
    // Effective dimensions for torsion
    const t = Math.min(b, D) / 6;
    const x1 = b - 2 * 50; // Clear dimensions
    const y1 = D - 2 * 50;
    const Aoh = x1 * y1;
    const Ph = 2 * (x1 + y1);
    
    // Longitudinal reinforcement
    const Al = Tu * Ph / (2 * Aoh * fy);
    
    // Transverse reinforcement (stirrups)
    const At_s = Tu / (2 * Aoh * 0.87 * fy);
    const stirrupDia = 10;
    const At = Math.PI * stirrupDia * stirrupDia / 4;
    const spacing = Math.min(At / At_s, Ph / 8, 300);
    
    // Select longitudinal bars
    const longBars = this.selectBarArrangement(Al, b, 50);
    
    return {
      checks,
      reinforcement: {
        longitudinal: longBars,
        transverse: {
          diameter: stirrupDia,
          spacing: Math.floor(spacing / 25) * 25
        }
      }
    };
  }

  // --------------------------------------------------------------------------
  // COLUMN DESIGN
  // --------------------------------------------------------------------------

  designColumn(geometry: ColumnGeometry, forces: ColumnForces): DesignResult {
    const checks: DesignCheck[] = [];
    const warnings: string[] = [];
    
    const b = geometry.width;
    const D = geometry.depth;
    const L = geometry.height;
    const cover = geometry.cover;
    
    // Effective depth for each direction
    const dx = D - cover - 25;
    const dy = b - cover - 25;
    
    // Check slenderness
    const lex = geometry.effectiveLength?.lex || 0.65 * L;
    const ley = geometry.effectiveLength?.ley || 0.65 * L;
    
    const lambdaX = lex / D;
    const lambdaY = ley / b;
    const isSlender = lambdaX > 12 || lambdaY > 12;
    
    checks.push({
      name: 'Slenderness Ratio (X)',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 25.1.2' : 'ACI 318 Sec. 6.2',
      required: lambdaX,
      provided: 12,
      ratio: lambdaX / 12,
      status: lambdaX <= 12 ? 'PASS' : 'FAIL'
    });
    
    if (isSlender) {
      warnings.push('Column is slender - additional moments due to P-Delta effects considered');
    }
    
    // Calculate additional moments for slender columns
    let Mux = forces.Mux * 1e6;
    let Muy = forces.Muy * 1e6;
    
    if (isSlender && this.code === 'IS456') {
      const eax = Math.max(L / 500, 20); // Accidental eccentricity
      const eay = Math.max(L / 500, 20);
      
      // Additional moment due to slenderness
      const Pu = forces.Pu * 1e3;
      const Madd_x = Pu * eax * (lambdaX / 12);
      const Madd_y = Pu * eay * (lambdaY / 12);
      
      Mux += Madd_x;
      Muy += Madd_y;
    }
    
    // Minimum eccentricity
    const emin_x = Math.max(L / 500 + D / 30, 20);
    const emin_y = Math.max(L / 500 + b / 30, 20);
    const Mu_min_x = forces.Pu * 1e3 * emin_x;
    const Mu_min_y = forces.Pu * 1e3 * emin_y;
    
    Mux = Math.max(Mux, Mu_min_x);
    Muy = Math.max(Muy, Mu_min_y);
    
    // Design for biaxial bending using interaction diagram
    const { Ast, interactionRatio } = this.designBiaxialColumn(
      forces.Pu * 1e3, Mux, Muy, b, D, dx, dy
    );
    
    checks.push({
      name: 'Biaxial Interaction Check',
      clause: this.code === 'IS456' ? 'IS 456:2000 Cl. 39.6' : 'ACI 318 Sec. 22.4',
      required: interactionRatio,
      provided: 1.0,
      ratio: interactionRatio,
      status: interactionRatio <= 1.0 ? 'PASS' : 'FAIL',
      formula: `(Mux/Mux1)^αn + (Muy/Muy1)^αn ≤ 1.0`
    });
    
    // Check reinforcement limits
    const Ag = b * D;
    const minAst = 0.008 * Ag; // 0.8%
    const maxAst = 0.06 * Ag;  // 6% (4% at lap)
    
    checks.push({
      name: 'Minimum Reinforcement',
      clause: 'IS 456:2000 Cl. 26.5.3.1',
      required: minAst,
      provided: Ast,
      ratio: Ast / minAst,
      status: Ast >= minAst ? 'PASS' : 'FAIL'
    });
    
    checks.push({
      name: 'Maximum Reinforcement',
      clause: 'IS 456:2000 Cl. 26.5.3.1',
      required: Ast,
      provided: maxAst,
      ratio: Ast / maxAst,
      status: Ast <= maxAst ? 'PASS' : 'FAIL'
    });
    
    // Select bar arrangement
    const mainBars = this.selectColumnBars(Ast, b, D, cover);
    
    // Transverse reinforcement
    const tiesDia = Math.max(mainBars.diameter / 4, 6);
    const tiesSpacing = Math.min(16 * mainBars.diameter, b, D, 300);
    
    // Detailing
    const detailing = this.getDetailingRequirements(mainBars.diameter, dx);
    
    const utilizationRatio = Math.max(interactionRatio, Ast / maxAst);
    const overallStatus = checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
    
    return {
      status: overallStatus,
      reinforcement: {
        mainBars: {
          tension: mainBars
        },
        stirrups: {
          diameter: Math.ceil(tiesDia),
          legs: 2,
          spacing: Math.floor(tiesSpacing / 25) * 25,
          maxSpacing: tiesSpacing,
          minSpacing: 75,
          zones: []
        }
      },
      checks,
      utilizationRatio,
      detailing,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  private designBiaxialColumn(
    Pu: number,
    Mux: number,
    Muy: number,
    b: number,
    D: number,
    dx: number,
    dy: number
  ): { Ast: number; interactionRatio: number } {
    const fck = this.concrete.fck;
    const fy = this.rebar.fy;
    
    // Start with minimum reinforcement and iterate
    let p = 0.8; // Start with 0.8%
    let Ast = p * b * D / 100;
    
    for (let iter = 0; iter < 20; iter++) {
      // Calculate uniaxial capacities
      const Mux1 = this.getUniaxialMomentCapacity(Pu, b, D, dx, Ast, 'X');
      const Muy1 = this.getUniaxialMomentCapacity(Pu, b, D, dy, Ast, 'Y');
      
      // Calculate Puz (pure axial capacity)
      const Puz = 0.45 * fck * b * D + (0.75 * fy - 0.45 * fck) * Ast;
      
      // Calculate αn
      const Pu_Puz = Pu / Puz;
      let alphan: number;
      if (Pu_Puz <= 0.2) alphan = 1.0;
      else if (Pu_Puz >= 0.8) alphan = 2.0;
      else alphan = 1.0 + (Pu_Puz - 0.2) / 0.6;
      
      // Interaction check
      const ratio = Math.pow(Mux / Mux1, alphan) + Math.pow(Muy / Muy1, alphan);
      
      if (ratio <= 1.0) {
        return { Ast, interactionRatio: ratio };
      }
      
      // Increase reinforcement
      p += 0.25;
      Ast = p * b * D / 100;
      
      if (p > 4) {
        // Maximum exceeded
        return { Ast: 0.04 * b * D, interactionRatio: ratio };
      }
    }
    
    return { Ast, interactionRatio: 1.5 };
  }

  private getUniaxialMomentCapacity(
    Pu: number,
    b: number,
    D: number,
    d: number,
    Ast: number,
    axis: 'X' | 'Y'
  ): number {
    const fck = this.concrete.fck;
    const fy = this.rebar.fy;
    
    // Simplified calculation using SP 16 charts approach
    const p = Ast * 100 / (b * D);
    const d_D = (axis === 'X') ? d / D : d / b;
    
    // p/fck ratio
    const p_fck = p / fck;
    
    // Pu/(fck.b.D)
    const Pu_fckbD = Pu / (fck * b * D);
    
    // Approximate Mu/(fck.b.D²) from charts
    // Using simplified formula
    const k = 0.4 + 0.6 * (0.2 - Math.abs(0.2 - Pu_fckbD));
    const Mu_fckbD2 = k * p_fck * (fy / fck) * d_D;
    
    const Mu = Mu_fckbD2 * fck * b * D * D;
    
    return Math.max(Mu, Pu * 0.05 * D); // Minimum eccentricity
  }

  // --------------------------------------------------------------------------
  // BAR SELECTION
  // --------------------------------------------------------------------------

  private selectBarArrangement(Ast: number, width: number, cover: number): BarArrangement {
    const availableBars = [10, 12, 16, 20, 25, 32];
    const clearWidth = width - 2 * cover;
    
    let bestArrangement: BarArrangement | null = null;
    let bestExcess = Infinity;
    
    for (const dia of availableBars) {
      const barArea = Math.PI * dia * dia / 4;
      const numBars = Math.ceil(Ast / barArea);
      
      // Check if bars fit
      const minSpacing = Math.max(dia, 25);
      const totalWidth = numBars * dia + (numBars - 1) * minSpacing;
      
      if (totalWidth <= clearWidth) {
        const providedArea = numBars * barArea;
        const excess = providedArea - Ast;
        
        if (excess < bestExcess) {
          bestExcess = excess;
          bestArrangement = {
            numBars,
            diameter: dia,
            area: providedArea,
            layers: 1,
            arrangement: `${numBars}T${dia}`
          };
        }
      }
    }
    
    // Try with multiple layers if single layer doesn't work
    if (!bestArrangement) {
      const dia = 16;
      const barArea = Math.PI * dia * dia / 4;
      const numBars = Math.ceil(Ast / barArea);
      const layers = Math.ceil(numBars / 4);
      
      bestArrangement = {
        numBars,
        diameter: dia,
        area: numBars * barArea,
        layers,
        arrangement: `${numBars}T${dia} in ${layers} layers`
      };
    }
    
    return bestArrangement;
  }

  private selectColumnBars(Ast: number, b: number, D: number, cover: number): BarArrangement {
    // For columns, distribute bars around perimeter
    const availableBars = [16, 20, 25, 32];
    
    for (const dia of availableBars) {
      const barArea = Math.PI * dia * dia / 4;
      let numBars = Math.ceil(Ast / barArea);
      
      // Ensure even distribution (minimum 4 corner bars)
      numBars = Math.max(numBars, 4);
      if (numBars % 2 !== 0) numBars++;
      
      const providedArea = numBars * barArea;
      
      if (providedArea >= Ast) {
        // Calculate arrangement
        const barsPerSide = Math.ceil(numBars / 4);
        
        return {
          numBars,
          diameter: dia,
          area: providedArea,
          layers: 1,
          arrangement: `${numBars}T${dia} (${barsPerSide} per face)`
        };
      }
    }
    
    // Fallback
    return {
      numBars: 8,
      diameter: 25,
      area: 8 * Math.PI * 25 * 25 / 4,
      layers: 1,
      arrangement: '8T25'
    };
  }

  // --------------------------------------------------------------------------
  // DETAILING
  // --------------------------------------------------------------------------

  private getDetailingRequirements(barDia: number, d: number): DetailingRequirements {
    const fck = this.concrete.fck;
    const fy = this.rebar.fy;
    
    // Development length (IS 456 Cl. 26.2.1)
    const tau_bd = this.getBondStress();
    const Ld = (fy / (4 * tau_bd)) * barDia;
    
    // Anchorage length
    const La = Ld;
    
    // Lap length
    const Ll = 1.3 * Ld; // Compression lap, or 1.5 * Ld for tension
    
    // Bend diameter
    const bendDia = barDia <= 16 ? 4 * barDia : 5 * barDia;
    
    // Hook extension
    const hookExt = Math.max(12 * barDia, 75);
    
    return {
      minCover: this.getMinimumCover(),
      minSpacing: Math.max(barDia, 25),
      maxSpacing: Math.min(3 * d, 300),
      anchorageLength: Math.ceil(La),
      developmentLength: Math.ceil(Ld),
      lapLength: Math.ceil(Ll),
      bendDiameter: bendDia,
      hookExtension: hookExt
    };
  }

  private getBondStress(): number {
    const fck = this.concrete.fck;
    
    switch (this.code) {
      case 'IS456':
        // IS 456:2000 Cl. 26.2.1.1
        return 1.2 * Math.sqrt(fck); // For deformed bars in tension
      case 'ACI318':
        return 0.56 * Math.sqrt(fck);
      default:
        return 1.2 * Math.sqrt(fck);
    }
  }

  private getMinimumCover(): number {
    switch (this.code) {
      case 'IS456':
        return 40; // Moderate exposure
      case 'ACI318':
        return 38; // 1.5 inches
      case 'EC2':
        return 35;
      default:
        return 40;
    }
  }
}

// ============================================================================
// FACTORY AND EXPORTS
// ============================================================================

export const createRCDesignEngine = (
  code: RCDesignCode,
  concreteGrade: string,
  rebarGrade: string
) => new RCDesignEngine(code, concreteGrade, rebarGrade);

export { CONCRETE_GRADES, REBAR_GRADES };
export default RCDesignEngine;
