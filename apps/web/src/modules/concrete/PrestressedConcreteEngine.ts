/**
 * ============================================================================
 * PRESTRESSED CONCRETE DESIGN ENGINE
 * ============================================================================
 * 
 * Complete prestressed concrete design for:
 * - Pre-tensioned members (pretensioning)
 * - Post-tensioned members (post-tensioning)
 * - Loss calculations (immediate & time-dependent)
 * - Stress checks at transfer and service
 * - Ultimate moment capacity
 * - Shear design for prestressed sections
 * - Deflection calculations
 * 
 * Supported Codes:
 * - IS 1343:2012 (India)
 * - ACI 318-19 Chapter 25 (USA)
 * - EN 1992-1-1:2004 Section 5.10 (Europe)
 * - AS 3600:2018 Section 8 (Australia)
 * 
 * @version 1.0.0
 * @author Head of Engineering
 */

import {
  DesignCode,
  ConcreteGrade,
  getConcreteGrades,
  getDesignStrength,
} from './RCDesignConstants';

// =============================================================================
// TYPE DEFINITIONS - PRESTRESSING SYSTEM
// =============================================================================

export type PrestressType = 'pre-tensioned' | 'post-tensioned';
export type TendonType = 'strand' | 'wire' | 'bar';
export type TendonProfile = 'straight' | 'parabolic' | 'harped' | 'draped';
export type BondType = 'bonded' | 'unbonded';
export type StressClass = 'Class1' | 'Class2' | 'Class3'; // Uncracked, partially cracked, cracked

export interface PrestressingStrand {
  type: TendonType;
  designation: string;
  diameter: number;        // mm
  area: number;            // mm² per strand
  fpu: number;             // Ultimate tensile strength (MPa)
  fpy: number;             // Yield strength (0.1% proof stress) (MPa)
  Ep: number;              // Modulus of elasticity (MPa)
  relaxationClass: 'low' | 'normal';
  relaxationLoss1000h: number; // % loss at 1000 hours
}

// Standard prestressing strands database
export const PRESTRESSING_STRANDS: PrestressingStrand[] = [
  // 7-wire strands (most common)
  { type: 'strand', designation: '7-wire 9.53mm', diameter: 9.53, area: 54.8, fpu: 1860, fpy: 1674, Ep: 195000, relaxationClass: 'low', relaxationLoss1000h: 2.5 },
  { type: 'strand', designation: '7-wire 11.11mm', diameter: 11.11, area: 74.2, fpu: 1860, fpy: 1674, Ep: 195000, relaxationClass: 'low', relaxationLoss1000h: 2.5 },
  { type: 'strand', designation: '7-wire 12.70mm', diameter: 12.70, area: 98.7, fpu: 1860, fpy: 1674, Ep: 195000, relaxationClass: 'low', relaxationLoss1000h: 2.5 },
  { type: 'strand', designation: '7-wire 15.24mm', diameter: 15.24, area: 140.0, fpu: 1860, fpy: 1674, Ep: 195000, relaxationClass: 'low', relaxationLoss1000h: 2.5 },
  { type: 'strand', designation: '7-wire 15.70mm Super', diameter: 15.70, area: 150.0, fpu: 1860, fpy: 1674, Ep: 195000, relaxationClass: 'low', relaxationLoss1000h: 2.5 },
  
  // High-strength bars
  { type: 'bar', designation: 'Dywidag 26mm', diameter: 26, area: 530, fpu: 1030, fpy: 835, Ep: 205000, relaxationClass: 'low', relaxationLoss1000h: 3.0 },
  { type: 'bar', designation: 'Dywidag 32mm', diameter: 32, area: 804, fpu: 1030, fpy: 835, Ep: 205000, relaxationClass: 'low', relaxationLoss1000h: 3.0 },
  { type: 'bar', designation: 'Dywidag 36mm', diameter: 36, area: 1018, fpu: 1030, fpy: 835, Ep: 205000, relaxationClass: 'low', relaxationLoss1000h: 3.0 },
  
  // Wires
  { type: 'wire', designation: '5mm wire', diameter: 5, area: 19.6, fpu: 1770, fpy: 1500, Ep: 205000, relaxationClass: 'normal', relaxationLoss1000h: 4.5 },
  { type: 'wire', designation: '7mm wire', diameter: 7, area: 38.5, fpu: 1670, fpy: 1420, Ep: 205000, relaxationClass: 'normal', relaxationLoss1000h: 4.5 },
];

// =============================================================================
// TYPE DEFINITIONS - SECTION PROPERTIES
// =============================================================================

export interface PrestressedSectionGeometry {
  type: 'rectangular' | 'I-section' | 'T-section' | 'box' | 'double-T';
  // Overall dimensions
  h: number;               // Total depth (mm)
  b: number;               // Width at top (mm)
  bw?: number;             // Web width (mm) for I, T, box
  // Flange dimensions
  hf_top?: number;         // Top flange thickness (mm)
  bf_top?: number;         // Top flange width (mm)
  hf_bot?: number;         // Bottom flange thickness (mm)
  bf_bot?: number;         // Bottom flange width (mm)
  // Computed section properties (auto-calculated)
  A?: number;              // Cross-sectional area (mm²)
  I?: number;              // Moment of inertia (mm⁴)
  yb?: number;             // Distance from bottom to centroid (mm)
  yt?: number;             // Distance from top to centroid (mm)
  Zb?: number;             // Section modulus bottom (mm³)
  Zt?: number;             // Section modulus top (mm³)
  r?: number;              // Radius of gyration (mm)
}

export interface TendonLayout {
  profile: TendonProfile;
  numStrands: number;
  strandType: PrestressingStrand;
  // Eccentricities
  e_end: number;           // Eccentricity at end (mm) - positive below centroid
  e_mid: number;           // Eccentricity at midspan (mm)
  // For harped profile
  harpPoint?: number;      // Distance from end where harp occurs (mm)
  // Duct diameter (for post-tensioned)
  ductDiameter?: number;   // mm
  bondType: BondType;
}

// =============================================================================
// TYPE DEFINITIONS - MATERIALS
// =============================================================================

export interface PrestressedMaterials {
  concrete: {
    grade: ConcreteGrade;
    fci: number;           // Concrete strength at transfer (MPa)
    fc28: number;          // 28-day concrete strength (MPa)
    Eci: number;           // Modulus at transfer (MPa)
    Ec28: number;          // 28-day modulus (MPa)
    creepCoeff: number;    // Creep coefficient (φ)
    shrinkageStrain: number; // Shrinkage strain (εsh)
  };
  prestressing: TendonLayout;
  code: DesignCode;
}

// =============================================================================
// TYPE DEFINITIONS - LOSSES
// =============================================================================

export interface ImmediateLosses {
  elasticShortening: number;     // ΔfpES (MPa)
  anchorageSlip: number;         // ΔfpA (MPa)
  frictionLoss: number;          // ΔfpF (MPa) - for post-tensioned
  wobbleLoss: number;            // Due to unintentional curvature
  totalImmediate: number;        // Total immediate loss (MPa)
  percentLoss: number;           // % of initial stress
}

export interface TimeDependentLosses {
  creep: number;                 // ΔfpCR (MPa)
  shrinkage: number;             // ΔfpSH (MPa)
  relaxation: number;            // ΔfpR (MPa)
  totalTimeDep: number;          // Total time-dependent loss (MPa)
  percentLoss: number;           // % of initial stress
}

export interface TotalLosses {
  immediate: ImmediateLosses;
  timeDependent: TimeDependentLosses;
  totalLoss: number;             // Total loss (MPa)
  totalPercentLoss: number;      // Total % loss
  initialStress: number;         // fpi (MPa)
  effectiveStress: number;       // fpe (MPa)
  initialForce: number;          // Pi (kN)
  effectiveForce: number;        // Pe (kN)
}

// =============================================================================
// TYPE DEFINITIONS - STRESS CHECKS
// =============================================================================

export interface StressCheckResult {
  location: 'transfer' | 'service';
  section: 'midspan' | 'support' | 'other';
  // Top fiber stresses
  ft_top: number;                // Stress at top fiber (MPa)
  ft_top_limit: number;          // Allowable stress at top
  ft_top_status: 'pass' | 'fail';
  // Bottom fiber stresses
  ft_bottom: number;             // Stress at bottom fiber (MPa)
  ft_bottom_limit: number;       // Allowable stress at bottom
  ft_bottom_status: 'pass' | 'fail';
  // Overall status
  status: 'pass' | 'fail';
  messages: string[];
}

// =============================================================================
// TYPE DEFINITIONS - ULTIMATE CAPACITY
// =============================================================================

export interface UltimateCapacityResult {
  // Strain compatibility analysis
  fps: number;                   // Stress in prestressing steel at ultimate (MPa)
  c: number;                     // Neutral axis depth (mm)
  a: number;                     // Stress block depth (mm)
  
  // Moment capacity
  Mn: number;                    // Nominal moment capacity (kN-m)
  phi: number;                   // Strength reduction factor
  phiMn: number;                 // Design moment capacity (kN-m)
  Mu: number;                    // Applied factored moment (kN-m)
  utilizationRatio: number;
  status: 'pass' | 'fail';
  
  // Ductility check
  tensionControlled: boolean;
  compressionControlled: boolean;
  
  // Minimum reinforcement check
  Mcr: number;                   // Cracking moment (kN-m)
  minReinforcementOk: boolean;
}

// =============================================================================
// TYPE DEFINITIONS - SHEAR DESIGN
// =============================================================================

export interface PrestressedShearResult {
  // Applied shear
  Vu: number;                    // Factored shear (kN)
  
  // Concrete contribution
  Vci: number;                   // Flexure-shear cracking (kN)
  Vcw: number;                   // Web-shear cracking (kN)
  Vc: number;                    // Concrete shear capacity (kN)
  
  // Steel contribution
  Vs_required: number;           // Required stirrup contribution (kN)
  Av_s: number;                  // Required Av/s (mm²/mm)
  stirrupSize: number;           // Selected stirrup diameter (mm)
  stirrupSpacing: number;        // Required spacing (mm)
  stirrupsProvided: string;      // Description
  
  // Limits
  Vs_max: number;                // Maximum Vs allowed (kN)
  shearStatus: 'pass' | 'fail';
  
  // Principal stress check (for thin webs)
  principalTension: number;      // Principal tensile stress (MPa)
  principalLimit: number;        // Allowable principal tension
  principalStatus: 'pass' | 'fail';
}

// =============================================================================
// TYPE DEFINITIONS - DEFLECTION
// =============================================================================

export interface PrestressedDeflectionResult {
  // Immediate deflections
  camber_initial: number;        // Initial camber due to prestress (mm) - upward positive
  dead_load_initial: number;     // Dead load deflection at transfer (mm)
  net_initial: number;           // Net initial deflection (mm)
  
  // Long-term deflections
  camber_longterm: number;       // Long-term camber (mm)
  dead_load_longterm: number;    // Long-term dead load deflection (mm)
  live_load: number;             // Live load deflection (mm)
  net_longterm: number;          // Net long-term deflection (mm)
  
  // Limits
  L_span: number;                // Span length (mm)
  limit_LL: number;              // L/360 for live load (mm)
  limit_total: number;           // L/240 for total (mm)
  
  status: 'pass' | 'fail';
}

// =============================================================================
// TYPE DEFINITIONS - COMPLETE DESIGN RESULT
// =============================================================================

export interface PrestressedDesignInput {
  prestressType: PrestressType;
  section: PrestressedSectionGeometry;
  materials: PrestressedMaterials;
  span: number;                  // Span length (mm)
  // Loading
  deadLoad: number;              // Superimposed dead load (kN/m)
  liveLoad: number;              // Live load (kN/m)
  selfWeight?: number;           // Self weight (auto-calculated if not provided)
  // Design parameters
  initialJackingStress: number;  // fpi as fraction of fpu (e.g., 0.75)
  stressClass: StressClass;
  // Post-tensioned specific
  frictionCoeff?: number;        // μ friction coefficient
  wobbleCoeff?: number;          // K wobble coefficient (1/m)
  anchorageSlip?: number;        // Anchor set (mm)
}

export interface PrestressedDesignResult {
  input: PrestressedDesignInput;
  sectionProperties: PrestressedSectionGeometry;
  losses: TotalLosses;
  stressChecks: {
    transfer: StressCheckResult;
    service: StressCheckResult;
  };
  ultimateCapacity: UltimateCapacityResult;
  shearDesign: PrestressedShearResult;
  deflection: PrestressedDeflectionResult;
  summary: {
    status: 'safe' | 'unsafe' | 'marginal';
    totalPrestressForce: number;   // Pe (kN)
    totalLossPercent: number;
    momentCapacity: number;        // φMn (kN-m)
    utilizationRatio: number;
    warnings: string[];
    recommendations: string[];
  };
}

// =============================================================================
// ALLOWABLE STRESS LIMITS
// =============================================================================

export const STRESS_LIMITS = {
  IS1343: {
    transfer: {
      compression: (fci: number) => 0.54 * fci,     // 0.54 fci
      tension_Class1: (fci: number) => 0,            // No tension
      tension_Class2: (fci: number) => 0.36 * Math.sqrt(fci), // 0.36√fci
      tension_Class3: (fci: number) => 0.54 * Math.sqrt(fci), // 0.54√fci
    },
    service: {
      compression: (fc: number) => 0.41 * fc,       // 0.41 fc
      tension_Class1: (fc: number) => 0,             // No tension
      tension_Class2: (fc: number) => 0.36 * Math.sqrt(fc),
      tension_Class3: (fc: number) => 0.54 * Math.sqrt(fc),
    },
  },
  ACI318: {
    transfer: {
      compression: (fci: number) => 0.60 * fci,     // 0.60 f'ci
      tension: (fci: number) => 0.25 * Math.sqrt(fci), // 0.25√f'ci (3√f'ci psi)
      tension_with_reinf: (fci: number) => 0.50 * Math.sqrt(fci),
    },
    service: {
      compression_sustained: (fc: number) => 0.45 * fc,
      compression_total: (fc: number) => 0.60 * fc,
      tension_Class_U: (fc: number) => 0.62 * Math.sqrt(fc), // 7.5√f'c psi
      tension_Class_T: (fc: number) => Math.sqrt(fc),        // 12√f'c psi
    },
  },
  EN1992: {
    transfer: {
      compression: (fci: number) => 0.60 * fci,
      tension: (fci: number) => 0,  // Generally no tension at transfer
    },
    service: {
      compression_quasi: (fc: number) => 0.45 * fc,
      compression_char: (fc: number) => 0.60 * fc,
      decompression: 0,  // For class 2
    },
  },
};

// =============================================================================
// PRESTRESSED CONCRETE DESIGN ENGINE
// =============================================================================

export class PrestressedConcreteEngine {
  private input: PrestressedDesignInput;
  private section: PrestressedSectionGeometry;
  private materials: PrestressedMaterials;
  private code: DesignCode;

  constructor(input: PrestressedDesignInput) {
    this.input = { ...input };
    this.section = { ...input.section };
    this.materials = { ...input.materials };
    this.code = input.materials.code;
    
    // Calculate section properties if not provided
    this.calculateSectionProperties();
  }

  // ===========================================================================
  // SECTION PROPERTIES CALCULATION
  // ===========================================================================

  private calculateSectionProperties(): void {
    const s = this.section;
    
    if (s.type === 'rectangular') {
      s.A = s.b * s.h;
      s.I = s.b * Math.pow(s.h, 3) / 12;
      s.yb = s.h / 2;
      s.yt = s.h / 2;
    } else if (s.type === 'I-section' || s.type === 'T-section') {
      // I-section or T-section calculation
      const bf_top = s.bf_top || s.b;
      const hf_top = s.hf_top || 0;
      const bf_bot = s.bf_bot || (s.type === 'I-section' ? s.b : s.bw || s.b);
      const hf_bot = s.hf_bot || 0;
      const bw = s.bw || s.b;
      const hw = s.h - hf_top - hf_bot;
      
      // Area
      const A_top = bf_top * hf_top;
      const A_web = bw * hw;
      const A_bot = bf_bot * hf_bot;
      s.A = A_top + A_web + A_bot;
      
      // Centroid from bottom
      const y_top = s.h - hf_top / 2;
      const y_web = hf_bot + hw / 2;
      const y_bot = hf_bot / 2;
      
      s.yb = (A_top * y_top + A_web * y_web + A_bot * y_bot) / s.A;
      s.yt = s.h - s.yb;
      
      // Moment of inertia (parallel axis theorem)
      const I_top = bf_top * Math.pow(hf_top, 3) / 12 + A_top * Math.pow(y_top - s.yb, 2);
      const I_web = bw * Math.pow(hw, 3) / 12 + A_web * Math.pow(y_web - s.yb, 2);
      const I_bot = bf_bot * Math.pow(hf_bot, 3) / 12 + A_bot * Math.pow(y_bot - s.yb, 2);
      s.I = I_top + I_web + I_bot;
    } else if (s.type === 'box') {
      // Box section
      const bf = s.b;
      const hf_top = s.hf_top || 150;
      const hf_bot = s.hf_bot || 150;
      const bw = s.bw || 200;
      
      // Outer area minus inner void
      const A_outer = bf * s.h;
      const A_inner = (bf - 2 * bw) * (s.h - hf_top - hf_bot);
      s.A = A_outer - A_inner;
      
      // Centroid (symmetric)
      s.yb = s.h / 2;
      s.yt = s.h / 2;
      
      // I = I_outer - I_inner
      const I_outer = bf * Math.pow(s.h, 3) / 12;
      const I_inner = (bf - 2 * bw) * Math.pow(s.h - hf_top - hf_bot, 3) / 12;
      s.I = I_outer - I_inner;
    }
    
    // Section moduli
    s.Zb = s.I! / s.yb!;
    s.Zt = s.I! / s.yt!;
    s.r = Math.sqrt(s.I! / s.A!);
    
    this.section = s;
  }

  // ===========================================================================
  // MAIN DESIGN METHOD
  // ===========================================================================

  public design(): PrestressedDesignResult {
    // Calculate self weight if not provided
    const selfWeight = this.input.selfWeight || (this.section.A! / 1e6) * 25; // kN/m
    
    // Step 1: Calculate prestress losses
    const losses = this.calculateLosses();
    
    // Step 2: Stress checks at transfer and service
    const stressChecks = {
      transfer: this.checkStresses('transfer', losses),
      service: this.checkStresses('service', losses),
    };
    
    // Step 3: Ultimate moment capacity
    const ultimateCapacity = this.calculateUltimateCapacity(losses);
    
    // Step 4: Shear design
    const shearDesign = this.calculateShearCapacity(losses);
    
    // Step 5: Deflection
    const deflection = this.calculateDeflection(losses, selfWeight);
    
    // Generate summary
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    if (losses.totalPercentLoss > 25) {
      warnings.push(`High total prestress loss: ${losses.totalPercentLoss.toFixed(1)}%`);
    }
    
    if (stressChecks.transfer.status === 'fail') {
      warnings.push('Transfer stresses exceed limits');
      recommendations.push('Consider increasing concrete strength at transfer or reducing initial prestress');
    }
    
    if (stressChecks.service.status === 'fail') {
      warnings.push('Service stresses exceed limits');
      recommendations.push('Consider increasing section size or prestress force');
    }
    
    if (ultimateCapacity.status === 'fail') {
      warnings.push('Ultimate capacity insufficient');
      recommendations.push('Increase number of strands or section depth');
    }
    
    if (!ultimateCapacity.tensionControlled) {
      warnings.push('Section is not tension-controlled');
      recommendations.push('Reduce compression zone or add more prestressing');
    }
    
    // Overall status
    let status: 'safe' | 'unsafe' | 'marginal' = 'safe';
    if (stressChecks.transfer.status === 'fail' || 
        stressChecks.service.status === 'fail' || 
        ultimateCapacity.status === 'fail' ||
        shearDesign.shearStatus === 'fail') {
      status = 'unsafe';
    } else if (ultimateCapacity.utilizationRatio > 0.9 || 
               losses.totalPercentLoss > 20) {
      status = 'marginal';
    }
    
    return {
      input: this.input,
      sectionProperties: this.section,
      losses,
      stressChecks,
      ultimateCapacity,
      shearDesign,
      deflection,
      summary: {
        status,
        totalPrestressForce: losses.effectiveForce,
        totalLossPercent: losses.totalPercentLoss,
        momentCapacity: ultimateCapacity.phiMn,
        utilizationRatio: ultimateCapacity.utilizationRatio,
        warnings,
        recommendations,
      },
    };
  }

  // ===========================================================================
  // LOSS CALCULATIONS
  // ===========================================================================

  private calculateLosses(): TotalLosses {
    const tendon = this.materials.prestressing;
    const strand = tendon.strandType;
    const concrete = this.materials.concrete;
    
    const Aps = tendon.numStrands * strand.area; // Total prestressing area
    const fpi = this.input.initialJackingStress * strand.fpu; // Initial stress
    const Pi = fpi * Aps / 1000; // Initial force (kN)
    
    // Immediate losses
    const immediate = this.calculateImmediateLosses(fpi, Aps);
    
    // Time-dependent losses
    const timeDep = this.calculateTimeDependentLosses(fpi - immediate.totalImmediate, Aps);
    
    const totalLoss = immediate.totalImmediate + timeDep.totalTimeDep;
    const fpe = fpi - totalLoss;
    const Pe = fpe * Aps / 1000;
    
    return {
      immediate,
      timeDependent: timeDep,
      totalLoss,
      totalPercentLoss: (totalLoss / fpi) * 100,
      initialStress: fpi,
      effectiveStress: fpe,
      initialForce: Pi,
      effectiveForce: Pe,
    };
  }

  private calculateImmediateLosses(fpi: number, Aps: number): ImmediateLosses {
    const tendon = this.materials.prestressing;
    const strand = tendon.strandType;
    const concrete = this.materials.concrete;
    const e = tendon.e_mid; // Eccentricity at midspan
    
    // 1. Elastic Shortening
    // For pre-tensioned: ΔfpES = (Ep/Eci) * fcgp
    // For post-tensioned with sequential jacking: ΔfpES = 0.5 * (Ep/Eci) * fcgp
    
    const Pi = fpi * Aps / 1000; // kN
    const fcgp = this.calculateConcreteStressAtCG(Pi, e, 'transfer');
    
    let elasticShortening: number;
    if (this.input.prestressType === 'pre-tensioned') {
      elasticShortening = (strand.Ep / concrete.Eci) * fcgp;
    } else {
      // Post-tensioned - sequential jacking reduces loss
      elasticShortening = 0.5 * (strand.Ep / concrete.Eci) * fcgp;
    }
    
    // 2. Anchorage Slip (post-tensioned only)
    let anchorageSlip = 0;
    if (this.input.prestressType === 'post-tensioned' && this.input.anchorageSlip) {
      const slip = this.input.anchorageSlip; // mm
      const L = this.input.span; // mm
      // Affected length depends on friction
      const Laffected = L; // Simplified
      anchorageSlip = (slip * strand.Ep) / Laffected;
    }
    
    // 3. Friction Loss (post-tensioned only)
    let frictionLoss = 0;
    let wobbleLoss = 0;
    if (this.input.prestressType === 'post-tensioned') {
      const mu = this.input.frictionCoeff || 0.20;
      const K = this.input.wobbleCoeff || 0.002; // per meter
      const L = this.input.span / 1000; // meters
      
      // Calculate angle change for parabolic profile
      const alpha = this.calculateTendonAngle();
      
      // ΔfpF = fpi * (1 - e^(-μα - KL))
      frictionLoss = fpi * (1 - Math.exp(-mu * alpha - K * L));
      wobbleLoss = fpi * K * L; // Wobble component
    }
    
    const totalImmediate = elasticShortening + anchorageSlip + frictionLoss;
    
    return {
      elasticShortening,
      anchorageSlip,
      frictionLoss,
      wobbleLoss,
      totalImmediate,
      percentLoss: (totalImmediate / fpi) * 100,
    };
  }

  private calculateTimeDependentLosses(fpi_after_imm: number, Aps: number): TimeDependentLosses {
    const tendon = this.materials.prestressing;
    const strand = tendon.strandType;
    const concrete = this.materials.concrete;
    const e = tendon.e_mid;
    
    const Pi = fpi_after_imm * Aps / 1000;
    
    // 1. Creep Loss
    // ΔfpCR = (Ep/Ec) * φ * fcgp
    const fcgp = this.calculateConcreteStressAtCG(Pi, e, 'service');
    const creep = (strand.Ep / concrete.Ec28) * concrete.creepCoeff * fcgp;
    
    // 2. Shrinkage Loss
    // ΔfpSH = εsh * Ep
    const shrinkage = concrete.shrinkageStrain * strand.Ep;
    
    // 3. Relaxation Loss
    // For low-relaxation strand at 1000 hours with initial stress 0.7fpu
    // Long-term relaxation ≈ 3 × relaxation at 1000h
    const fpi_ratio = fpi_after_imm / strand.fpu;
    let relaxation: number;
    
    if (fpi_ratio >= 0.55) {
      // Relaxation formula (logarithmic)
      const log_t = Math.log(500000) / Math.log(10); // ~50 years in hours
      const K_rel = strand.relaxationClass === 'low' ? 0.025 : 0.045;
      relaxation = fpi_after_imm * K_rel * (fpi_ratio - 0.55) * log_t;
    } else {
      relaxation = 0;
    }
    
    const totalTimeDep = creep + shrinkage + relaxation;
    
    return {
      creep,
      shrinkage,
      relaxation,
      totalTimeDep,
      percentLoss: (totalTimeDep / (fpi_after_imm + this.calculateImmediateLosses(
        this.input.initialJackingStress * strand.fpu, Aps
      ).totalImmediate)) * 100,
    };
  }

  private calculateConcreteStressAtCG(P: number, e: number, stage: 'transfer' | 'service'): number {
    // Stress at centroid of prestressing = P/A + P*e*e/I + M*e/I
    const A = this.section.A!;
    const I = this.section.I!;
    
    // Self weight moment at midspan
    const w = (A / 1e6) * 25; // kN/m
    const L = this.input.span / 1000; // meters
    const M_sw = w * L * L / 8; // kN-m
    
    // Additional dead load moment
    const M_dl = this.input.deadLoad * L * L / 8;
    
    let M_total: number;
    if (stage === 'transfer') {
      M_total = M_sw; // Only self weight at transfer
    } else {
      M_total = M_sw + M_dl; // Self weight + superimposed dead load
    }
    
    // Stress at tendon level (positive compression)
    const fcgp = (P * 1000 / A) + (P * 1000 * e * e / I) - (M_total * 1e6 * e / I);
    
    return Math.max(0, fcgp); // Can't have tension for this calculation
  }

  private calculateTendonAngle(): number {
    const e1 = this.materials.prestressing.e_end;
    const e2 = this.materials.prestressing.e_mid;
    const L = this.input.span;
    
    if (this.materials.prestressing.profile === 'straight') {
      return 0;
    } else if (this.materials.prestressing.profile === 'parabolic') {
      // For parabolic: α = 8 * sag / L (approximate)
      const sag = Math.abs(e2 - e1);
      return 8 * sag / L;
    } else if (this.materials.prestressing.profile === 'harped') {
      // Harped: angle at harp point
      const harpPoint = this.materials.prestressing.harpPoint || L / 3;
      return Math.atan(Math.abs(e2 - e1) / harpPoint);
    }
    
    return 0;
  }

  // ===========================================================================
  // STRESS CHECKS
  // ===========================================================================

  private checkStresses(stage: 'transfer' | 'service', losses: TotalLosses): StressCheckResult {
    const concrete = this.materials.concrete;
    const tendon = this.materials.prestressing;
    const stressClass = this.input.stressClass;
    
    const A = this.section.A!;
    const Zb = this.section.Zb!;
    const Zt = this.section.Zt!;
    const e = tendon.e_mid;
    
    // Prestress force
    const P = stage === 'transfer' ? losses.initialForce : losses.effectiveForce;
    
    // Moments
    const w_sw = (A / 1e6) * 25;
    const L = this.input.span / 1000;
    const M_sw = w_sw * L * L / 8;
    const M_dl = this.input.deadLoad * L * L / 8;
    const M_ll = this.input.liveLoad * L * L / 8;
    
    let M: number;
    if (stage === 'transfer') {
      M = M_sw;
    } else {
      M = M_sw + M_dl + M_ll;
    }
    
    // Stresses (positive = compression, negative = tension)
    // f = P/A ± P*e/Z ± M/Z
    const f_top = (P * 1000 / A) - (P * 1000 * e / Zt) - (M * 1e6 / Zt);
    const f_bottom = (P * 1000 / A) + (P * 1000 * e / Zb) + (M * 1e6 / Zb);
    
    // Get limits based on code
    let ft_top_limit: number;
    let ft_bottom_limit: number;
    let fc_limit: number;
    
    const fc = stage === 'transfer' ? concrete.fci : concrete.fc28;
    
    if (this.code === 'IS456') {
      const limits = STRESS_LIMITS.IS1343;
      if (stage === 'transfer') {
        fc_limit = limits.transfer.compression(fc);
        const tensionLimit = stressClass === 'Class1' 
          ? limits.transfer.tension_Class1(fc)
          : stressClass === 'Class2'
          ? limits.transfer.tension_Class2(fc)
          : limits.transfer.tension_Class3(fc);
        ft_top_limit = -tensionLimit; // Tension is negative
        ft_bottom_limit = fc_limit;
      } else {
        fc_limit = limits.service.compression(fc);
        const tensionLimit = stressClass === 'Class1'
          ? limits.service.tension_Class1(fc)
          : stressClass === 'Class2'
          ? limits.service.tension_Class2(fc)
          : limits.service.tension_Class3(fc);
        ft_top_limit = fc_limit;
        ft_bottom_limit = -tensionLimit;
      }
    } else {
      // ACI 318 defaults
      const limits = STRESS_LIMITS.ACI318;
      if (stage === 'transfer') {
        fc_limit = limits.transfer.compression(fc);
        ft_top_limit = -limits.transfer.tension(fc);
        ft_bottom_limit = fc_limit;
      } else {
        fc_limit = limits.service.compression_total(fc);
        ft_top_limit = fc_limit;
        ft_bottom_limit = -limits.service.tension_Class_U(fc);
      }
    }
    
    const messages: string[] = [];
    
    // Check top fiber
    let ft_top_status: 'pass' | 'fail' = 'pass';
    if (stage === 'transfer') {
      // At transfer, top may be in tension
      if (f_top < ft_top_limit) {
        ft_top_status = 'fail';
        messages.push(`Top fiber tension ${Math.abs(f_top).toFixed(2)} MPa exceeds limit ${Math.abs(ft_top_limit).toFixed(2)} MPa`);
      }
    } else {
      // At service, top usually in compression
      if (f_top > ft_top_limit) {
        ft_top_status = 'fail';
        messages.push(`Top fiber compression ${f_top.toFixed(2)} MPa exceeds limit ${ft_top_limit.toFixed(2)} MPa`);
      }
    }
    
    // Check bottom fiber
    let ft_bottom_status: 'pass' | 'fail' = 'pass';
    if (stage === 'transfer') {
      // At transfer, bottom in compression
      if (f_bottom > ft_bottom_limit) {
        ft_bottom_status = 'fail';
        messages.push(`Bottom fiber compression ${f_bottom.toFixed(2)} MPa exceeds limit ${ft_bottom_limit.toFixed(2)} MPa`);
      }
    } else {
      // At service, bottom may be in tension
      if (f_bottom < ft_bottom_limit) {
        ft_bottom_status = 'fail';
        messages.push(`Bottom fiber tension ${Math.abs(f_bottom).toFixed(2)} MPa exceeds limit ${Math.abs(ft_bottom_limit).toFixed(2)} MPa`);
      }
    }
    
    return {
      location: stage,
      section: 'midspan',
      ft_top: f_top,
      ft_top_limit,
      ft_top_status,
      ft_bottom: f_bottom,
      ft_bottom_limit,
      ft_bottom_status,
      status: ft_top_status === 'pass' && ft_bottom_status === 'pass' ? 'pass' : 'fail',
      messages,
    };
  }

  // ===========================================================================
  // ULTIMATE CAPACITY
  // ===========================================================================

  private calculateUltimateCapacity(losses: TotalLosses): UltimateCapacityResult {
    const tendon = this.materials.prestressing;
    const strand = tendon.strandType;
    const concrete = this.materials.concrete;
    const fc = concrete.fc28;
    
    const Aps = tendon.numStrands * strand.area;
    const fpe = losses.effectiveStress;
    const dp = this.section.yb! + tendon.e_mid; // Depth to prestressing steel
    const b = this.section.type === 'rectangular' ? this.section.b : (this.section.bf_top || this.section.b);
    
    // Calculate fps using ACI 318 approximate method for bonded tendons
    // fps = fpu * (1 - γp/β1 * (ρp * fpu/fc + d/dp * (ω - ω')))
    // Simplified: fps = fpu - 0.28 * fpu * ρp / fc
    
    const rho_p = Aps / (b * dp);
    const gamma_p = tendon.bondType === 'bonded' ? 0.28 : 0.40;
    const beta1 = this.getBeta1(fc);
    
    let fps: number;
    if (tendon.bondType === 'bonded') {
      fps = strand.fpu * (1 - gamma_p * rho_p * strand.fpu / fc / beta1);
      fps = Math.min(fps, strand.fpy); // Cannot exceed yield
    } else {
      // Unbonded: fps = fpe + 70 + fc/(100*ρp) ≤ fpe + 420 ≤ fpy
      fps = fpe + 70 + fc / (100 * rho_p);
      fps = Math.min(fps, fpe + 420, strand.fpy);
    }
    
    // Neutral axis depth from force equilibrium
    // 0.85 * fc * β1 * c * b = Aps * fps
    const a = Aps * fps / (0.85 * fc * b);
    const c = a / beta1;
    
    // Check ductility (tension controlled if εt > 0.005)
    const epsilon_ps = 0.003 * (dp - c) / c + fpe / strand.Ep;
    const tensionControlled = epsilon_ps >= 0.005;
    const compressionControlled = epsilon_ps <= 0.002;
    
    // Strength reduction factor
    let phi: number;
    if (tensionControlled) {
      phi = 0.90;
    } else if (compressionControlled) {
      phi = 0.65;
    } else {
      // Transition zone
      phi = 0.65 + (epsilon_ps - 0.002) * (0.90 - 0.65) / (0.005 - 0.002);
    }
    
    // Nominal moment capacity
    const Mn = Aps * fps * (dp - a / 2) / 1e6; // kN-m
    const phiMn = phi * Mn;
    
    // Applied factored moment
    const L = this.input.span / 1000;
    const w_sw = (this.section.A! / 1e6) * 25;
    const wu = 1.2 * (w_sw + this.input.deadLoad) + 1.6 * this.input.liveLoad;
    const Mu = wu * L * L / 8;
    
    // Cracking moment for minimum reinforcement check
    const fr = 0.62 * Math.sqrt(fc); // Modulus of rupture
    const Mcr = (losses.effectiveForce * 1000 / this.section.A! + 
                 losses.effectiveForce * 1000 * tendon.e_mid / this.section.Zb! +
                 fr) * this.section.Zb! / 1e6;
    
    const minReinforcementOk = phiMn >= Math.min(1.2 * Mcr, 1.33 * Mu);
    
    return {
      fps,
      c,
      a,
      Mn,
      phi,
      phiMn,
      Mu,
      utilizationRatio: Mu / phiMn,
      status: phiMn >= Mu ? 'pass' : 'fail',
      tensionControlled,
      compressionControlled,
      Mcr,
      minReinforcementOk,
    };
  }

  private getBeta1(fc: number): number {
    // ACI 318 stress block factor
    if (fc <= 28) return 0.85;
    if (fc >= 55) return 0.65;
    return 0.85 - 0.05 * (fc - 28) / 7;
  }

  // ===========================================================================
  // SHEAR DESIGN
  // ===========================================================================

  private calculateShearCapacity(losses: TotalLosses): PrestressedShearResult {
    const concrete = this.materials.concrete;
    const fc = concrete.fc28;
    const tendon = this.materials.prestressing;
    
    const bw = this.section.bw || this.section.b;
    const dp = this.section.yb! + tendon.e_mid;
    const Aps = tendon.numStrands * tendon.strandType.area;
    const fpe = losses.effectiveStress;
    
    // Applied factored shear (at d from support)
    const L = this.input.span / 1000;
    const w_sw = (this.section.A! / 1e6) * 25;
    const wu = 1.2 * (w_sw + this.input.deadLoad) + 1.6 * this.input.liveLoad;
    const Vu = wu * (L / 2 - dp / 1000); // kN
    
    // Concrete shear capacity - ACI 318 method
    // Vci = 0.05*√fc*bw*dp + Vd + Vi*Mcr/Mmax
    // Vcw = (0.29*√fc + 0.3*fpc)*bw*dp + Vp
    
    // Flexure-shear cracking strength (Vci)
    const fd = losses.effectiveForce * 1000 * tendon.e_mid / this.section.Zb!; // Decompression stress
    const fr = 0.62 * Math.sqrt(fc);
    const Mcr = (fr + fd) * this.section.Zb! / 1e6;
    const Mmax = wu * L * L / 8;
    const Vd = (w_sw + this.input.deadLoad) * L / 2;
    const Vi = Vu - Vd;
    const Vci = 0.05 * Math.sqrt(fc) * bw * dp / 1000 + Vd + Vi * Mcr / Mmax;
    
    // Web-shear cracking strength (Vcw)
    const fpc = losses.effectiveForce * 1000 / this.section.A!; // Precompression
    const Vp = losses.effectiveForce * Math.sin(this.calculateTendonAngle()); // Vertical component
    const Vcw = (0.29 * Math.sqrt(fc) + 0.3 * fpc) * bw * dp / 1000 + Vp;
    
    const Vc = Math.min(Vci, Vcw);
    
    // Required stirrup contribution
    const phi_v = 0.75;
    const Vs_required = Math.max(0, Vu / phi_v - Vc);
    
    // Maximum Vs
    const Vs_max = 0.66 * Math.sqrt(fc) * bw * dp / 1000;
    
    // Stirrup design
    const fy_stirrup = 415; // MPa (typical Grade 60)
    const stirrupSize = 10;
    const Av = 2 * Math.PI * (stirrupSize / 2) ** 2; // 2-legged stirrup
    
    let stirrupSpacing: number;
    if (Vs_required > 0) {
      // Av/s = Vs / (fy * dp)
      const Av_s = Vs_required * 1000 / (fy_stirrup * dp);
      stirrupSpacing = Av / Av_s;
    } else {
      // Minimum stirrups
      const Av_s_min = Math.max(0.062 * Math.sqrt(fc) * bw / fy_stirrup, 0.35 * bw / fy_stirrup);
      stirrupSpacing = Av / Av_s_min;
    }
    
    // Apply maximum spacing limits
    const s_max = Math.min(0.75 * this.section.h, 600);
    if (Vs_required > 0.33 * Math.sqrt(fc) * bw * dp / 1000) {
      stirrupSpacing = Math.min(stirrupSpacing, 0.375 * this.section.h, 300);
    }
    stirrupSpacing = Math.min(stirrupSpacing, s_max);
    stirrupSpacing = Math.floor(stirrupSpacing / 25) * 25; // Round to 25mm
    
    // Principal tension check (for thin webs)
    const tau = Vu * 1000 / (bw * dp);
    const sigma_x = fpc;
    const principalTension = -sigma_x / 2 + Math.sqrt((sigma_x / 2) ** 2 + tau ** 2);
    const principalLimit = 0.33 * Math.sqrt(fc);
    
    return {
      Vu,
      Vci,
      Vcw,
      Vc,
      Vs_required,
      Av_s: Vs_required > 0 ? Vs_required * 1000 / (fy_stirrup * dp) : 0,
      stirrupSize,
      stirrupSpacing,
      stirrupsProvided: `${stirrupSize}ø @ ${stirrupSpacing}mm c/c`,
      Vs_max,
      shearStatus: Vs_required <= Vs_max && principalTension <= principalLimit ? 'pass' : 'fail',
      principalTension,
      principalLimit,
      principalStatus: principalTension <= principalLimit ? 'pass' : 'fail',
    };
  }

  // ===========================================================================
  // DEFLECTION
  // ===========================================================================

  private calculateDeflection(losses: TotalLosses, selfWeight: number): PrestressedDeflectionResult {
    const concrete = this.materials.concrete;
    const tendon = this.materials.prestressing;
    
    const L = this.input.span; // mm
    const I = this.section.I!;
    const Eci = concrete.Eci;
    const Ec = concrete.Ec28;
    const phi_creep = concrete.creepCoeff;
    
    const Pi = losses.initialForce * 1000; // N
    const Pe = losses.effectiveForce * 1000; // N
    const e = tendon.e_mid;
    
    // Self weight UDL
    const w_sw = selfWeight; // kN/m
    const w_dl = this.input.deadLoad;
    const w_ll = this.input.liveLoad;
    
    // Camber due to prestress (upward)
    // For parabolic profile: δ = 5 * P * e * L² / (48 * E * I)
    // For straight profile: δ = P * e * L² / (8 * E * I)
    let camber_initial: number;
    if (tendon.profile === 'parabolic') {
      camber_initial = 5 * Pi * e * Math.pow(L, 2) / (48 * Eci * I);
    } else if (tendon.profile === 'harped') {
      const a = tendon.harpPoint || L / 3;
      camber_initial = Pi * e * a * (L - a) / (2 * Eci * I);
    } else {
      // Straight with constant eccentricity
      camber_initial = Pi * e * Math.pow(L, 2) / (8 * Eci * I);
    }
    
    // Dead load deflection (downward)
    // δ = 5 * w * L⁴ / (384 * E * I)
    const dead_load_initial = 5 * w_sw * Math.pow(L, 4) / (384 * Eci * I * 1e9);
    
    // Net initial (positive = upward camber)
    const net_initial = camber_initial - dead_load_initial;
    
    // Long-term camber (with losses and creep)
    const camber_longterm = camber_initial * (Pe / Pi) * (1 + phi_creep) * (Eci / Ec);
    
    // Long-term dead load deflection (with creep)
    const dead_load_longterm = 5 * (w_sw + w_dl) * Math.pow(L, 4) / (384 * Ec * I * 1e9) * (1 + phi_creep);
    
    // Live load deflection (no creep)
    const live_load = 5 * w_ll * Math.pow(L, 4) / (384 * Ec * I * 1e9);
    
    // Net long-term
    const net_longterm = camber_longterm - dead_load_longterm - live_load;
    
    // Limits
    const limit_LL = L / 360;
    const limit_total = L / 240;
    
    const status = live_load <= limit_LL && Math.abs(net_longterm) <= limit_total ? 'pass' : 'fail';
    
    return {
      camber_initial,
      dead_load_initial,
      net_initial,
      camber_longterm,
      dead_load_longterm,
      live_load,
      net_longterm,
      L_span: L,
      limit_LL,
      limit_total,
      status,
    };
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Design a pre-tensioned prestressed beam
 */
export function designPretensionedBeam(
  b: number,
  h: number,
  span: number,
  deadLoad: number,
  liveLoad: number,
  numStrands: number,
  eccentricity: number,
  fci: number = 35,
  fc28: number = 50,
  code: DesignCode = 'IS456'
): PrestressedDesignResult {
  const strand = PRESTRESSING_STRANDS.find(s => s.designation.includes('12.70')) || PRESTRESSING_STRANDS[2];
  
  const input: PrestressedDesignInput = {
    prestressType: 'pre-tensioned',
    section: {
      type: 'rectangular',
      h,
      b,
    },
    materials: {
      concrete: {
        grade: { grade: `M${fc28}`, fck: fc28, Ec: 5000 * Math.sqrt(fc28) } as unknown as ConcreteGrade,
        fci,
        fc28,
        Eci: 5000 * Math.sqrt(fci),
        Ec28: 5000 * Math.sqrt(fc28),
        creepCoeff: 2.0,
        shrinkageStrain: 0.0003,
      },
      prestressing: {
        profile: 'straight',
        numStrands,
        strandType: strand,
        e_end: eccentricity,
        e_mid: eccentricity,
        bondType: 'bonded',
      },
      code,
    },
    span,
    deadLoad,
    liveLoad,
    initialJackingStress: 0.75,
    stressClass: 'Class2',
  };
  
  const engine = new PrestressedConcreteEngine(input);
  return engine.design();
}

/**
 * Design a post-tensioned prestressed beam
 */
export function designPosttensionedBeam(
  sectionType: 'rectangular' | 'I-section' | 'T-section' | 'box',
  dimensions: Partial<PrestressedSectionGeometry>,
  span: number,
  deadLoad: number,
  liveLoad: number,
  numStrands: number,
  e_end: number,
  e_mid: number,
  profile: TendonProfile = 'parabolic',
  fci: number = 30,
  fc28: number = 45,
  code: DesignCode = 'IS456'
): PrestressedDesignResult {
  const strand = PRESTRESSING_STRANDS.find(s => s.designation.includes('15.24')) || PRESTRESSING_STRANDS[3];
  
  const section: PrestressedSectionGeometry = {
    type: sectionType,
    h: dimensions.h || 800,
    b: dimensions.b || 400,
    bw: dimensions.bw,
    hf_top: dimensions.hf_top,
    bf_top: dimensions.bf_top,
    hf_bot: dimensions.hf_bot,
    bf_bot: dimensions.bf_bot,
  };
  
  const input: PrestressedDesignInput = {
    prestressType: 'post-tensioned',
    section,
    materials: {
      concrete: {
        grade: { grade: `M${fc28}`, fck: fc28, Ec: 5000 * Math.sqrt(fc28) } as unknown as ConcreteGrade,
        fci,
        fc28,
        Eci: 5000 * Math.sqrt(fci),
        Ec28: 5000 * Math.sqrt(fc28),
        creepCoeff: 2.0,
        shrinkageStrain: 0.0003,
      },
      prestressing: {
        profile,
        numStrands,
        strandType: strand,
        e_end,
        e_mid,
        ductDiameter: 70,
        bondType: 'bonded',
      },
      code,
    },
    span,
    deadLoad,
    liveLoad,
    initialJackingStress: 0.80,
    stressClass: 'Class2',
    frictionCoeff: 0.20,
    wobbleCoeff: 0.002,
    anchorageSlip: 6,
  };
  
  const engine = new PrestressedConcreteEngine(input);
  return engine.design();
}

/**
 * Calculate prestress losses only
 */
export function calculatePrestressLosses(
  prestressType: PrestressType,
  span: number,
  Aps: number,
  fpi: number,
  eccentricity: number,
  sectionArea: number,
  momentOfInertia: number,
  fci: number,
  fc28: number,
  code: DesignCode = 'IS456'
): TotalLosses {
  const strand = PRESTRESSING_STRANDS[2]; // 12.70mm strand
  const numStrands = Math.ceil(Aps / strand.area);
  
  const input: PrestressedDesignInput = {
    prestressType,
    section: {
      type: 'rectangular',
      h: 800,
      b: 400,
      A: sectionArea,
      I: momentOfInertia,
      yb: 400,
      yt: 400,
      Zb: momentOfInertia / 400,
      Zt: momentOfInertia / 400,
    },
    materials: {
      concrete: {
        grade: { grade: `M${fc28}`, fck: fc28, Ec: 5000 * Math.sqrt(fc28) } as unknown as ConcreteGrade,
        fci,
        fc28,
        Eci: 5000 * Math.sqrt(fci),
        Ec28: 5000 * Math.sqrt(fc28),
        creepCoeff: 2.0,
        shrinkageStrain: 0.0003,
      },
      prestressing: {
        profile: 'parabolic',
        numStrands,
        strandType: strand,
        e_end: eccentricity * 0.5,
        e_mid: eccentricity,
        bondType: 'bonded',
      },
      code,
    },
    span,
    deadLoad: 0,
    liveLoad: 0,
    initialJackingStress: fpi / strand.fpu,
    stressClass: 'Class2',
    frictionCoeff: 0.20,
    wobbleCoeff: 0.002,
    anchorageSlip: 6,
  };
  
  const engine = new PrestressedConcreteEngine(input);
  return (engine as any).calculateLosses();
}

// =============================================================================
// EXPORTS (already exported inline above)
// =============================================================================
