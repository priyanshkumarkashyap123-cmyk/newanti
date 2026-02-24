/**
 * Composite Beam Design Calculator
 * Per AISC 360-22 Chapter I
 * 
 * Features:
 * - Effective slab width calculation
 * - Plastic stress distribution method
 * - Partial composite action
 * - Shear stud design
 */

import {
  CompositeLevel,
  DeckOrientation,
  DeckProfile,
  CompositeBeamInput,
  CompositeBeamResult,
  EffectiveWidthResult,
  StudStrengthResult,
  CompositeFlexuralResult,
  ShearConnectorResult,
  CompositeDeflectionResult,
  CompositeSectionProperties,
  CalculationStep,
  COMPOSITE_RESISTANCE_FACTORS,
  STUD_REDUCTION_FACTORS,
  MINIMUM_COMPOSITE_RATIO,
  calculateModularRatio,
} from './CompositeBeamTypes';

export class CompositeBeamCalculator {
  private input: CompositeBeamInput;
  private calculations: CalculationStep[] = [];
  private stepCounter = 1;
  
  constructor(input: CompositeBeamInput) {
    this.input = input;
  }
  
  /**
   * Main design method
   */
  public design(): CompositeBeamResult {
    this.calculations = [];
    this.stepCounter = 1;
    
    // Step 1: Calculate effective slab width
    const effectiveWidth = this.calculateEffectiveWidth();
    
    // Step 2: Calculate stud strength
    const studStrength = this.calculateStudStrength();
    
    // Step 3: Calculate composite flexural strength
    const flexure = this.calculateFlexuralStrength(effectiveWidth, studStrength);
    
    // Step 4: Design shear connectors
    const shearConnectors = this.designShearConnectors(flexure, studStrength);
    
    // Step 5: Check deflection if required
    let deflection: CompositeDeflectionResult | undefined;
    if (this.input.checkDeflection) {
      deflection = this.checkDeflection(effectiveWidth, flexure);
    }
    
    // Capacity ratios
    const capacityRatios = {
      flexure: flexure.ratio,
      studs: shearConnectors.nStudsRequired / shearConnectors.nStudsProvided,
      governing: Math.max(flexure.ratio, shearConnectors.nStudsRequired / shearConnectors.nStudsProvided),
    };
    
    const isAdequate = 
      flexure.isAdequate && 
      shearConnectors.isAdequate &&
      (!deflection || deflection.isAdequate);
    
    return {
      isAdequate,
      section: this.input.section.designation,
      effectiveWidth,
      flexure,
      shearConnectors,
      deflection,
      capacityRatios,
      calculations: this.calculations,
      codeReference: 'AISC 360-22 Chapter I',
    };
  }
  
  /**
   * Calculate effective slab width
   */
  private calculateEffectiveWidth(): EffectiveWidthResult {
    const { geometry } = this.input;
    const L = geometry.L * 12; // inches
    
    // Per AISC 360-22 I3.1a
    // Effective width each side = min(L/8, beam spacing/2, edge distance)
    const limit_span = L / 8;
    const limit_spacing = geometry.beamSpacing * 12 / 2;
    
    const limit_left = geometry.leftEdgeDist * 12;
    const limit_right = geometry.rightEdgeDist * 12;
    
    const beff_left = Math.min(limit_span, limit_spacing, limit_left);
    const beff_right = Math.min(limit_span, limit_spacing, limit_right);
    const beff = beff_left + beff_right;
    
    // Determine governing limit
    let governingLimit: 'span' | 'spacing' | 'edge';
    const minLimit = Math.min(limit_span, limit_spacing, Math.min(limit_left, limit_right));
    if (minLimit === limit_span) governingLimit = 'span';
    else if (minLimit === limit_spacing) governingLimit = 'spacing';
    else governingLimit = 'edge';
    
    this.addStep(
      'Calculate effective slab width',
      'beff = min(L/8, spacing/2, edge distance) each side',
      {
        'L/8': (limit_span / 12).toFixed(2) + ' ft',
        'spacing/2': (limit_spacing / 12).toFixed(2) + ' ft',
        leftEdge: (limit_left / 12).toFixed(2) + ' ft',
        rightEdge: (limit_right / 12).toFixed(2) + ' ft',
      },
      (beff / 12).toFixed(2),
      'ft',
      'AISC 360-22 I3.1a'
    );
    
    return {
      beff,
      beff_left,
      beff_right,
      governingLimit,
    };
  }
  
  /**
   * Calculate individual stud strength
   */
  private calculateStudStrength(): StudStrengthResult {
    const { stud, slab, concrete, steelMaterial } = this.input;
    const Es = steelMaterial.E || 29000;
    
    // Concrete modulus
    const wc = concrete.wc || (concrete.isLightweight ? 115 : 145);
    const Ec = Math.pow(wc, 1.5) * Math.sqrt(concrete.fc) / 1000; // ksi
    
    // Stud shear strength per I8.2a
    // Qn = 0.5 Asc √(fc'Ec) ≤ Rg Rp Asc Fu
    
    // Get reduction factors
    const factors = STUD_REDUCTION_FACTORS[slab.deckProfile];
    let Rg = 1.0;
    let Rp = 1.0;
    
    if (slab.deckProfile !== DeckProfile.FLAT_SLAB) {
      const deckFactors = factors[slab.deckOrientation] as { Rg: number; Rp: number };
      Rg = deckFactors.Rg;
      Rp = deckFactors.Rp;
    }
    
    // Concrete breakout strength
    const qn_concrete = 0.5 * stud.Asc * Math.sqrt(concrete.fc * Ec);
    
    // Stud shear strength
    const qn_stud = Rg * Rp * stud.Asc * stud.Fu;
    
    // Governing strength
    const Qn = Math.min(qn_concrete, qn_stud);
    
    this.addStep(
      'Calculate nominal stud strength',
      'Qn = min(0.5Asc√(fc\'Ec), RgRpAscFu)',
      {
        Asc: stud.Asc.toFixed(4) + ' in²',
        fc: concrete.fc + ' ksi',
        Ec: Ec.toFixed(0) + ' ksi',
        Rg: Rg.toFixed(2),
        Rp: Rp.toFixed(2),
        Fu: stud.Fu + ' ksi',
      },
      Qn.toFixed(2),
      'kips',
      'AISC 360-22 Eq. I8-1'
    );
    
    return {
      Qn,
      Rg,
      Rp,
      qn_concrete,
      qn_stud,
    };
  }
  
  /**
   * Calculate composite flexural strength
   */
  private calculateFlexuralStrength(
    effectiveWidth: EffectiveWidthResult,
    studStrength: StudStrengthResult
  ): CompositeFlexuralResult {
    const { section, steelMaterial, concrete, slab, loads, designMethod } = this.input;
    const Fy = steelMaterial.Fy;
    const fc = concrete.fc;
    
    const phi_b = COMPOSITE_RESISTANCE_FACTORS.phi_b;
    const omega_b = COMPOSITE_RESISTANCE_FACTORS.omega_b;
    
    const beff = effectiveWidth.beff;
    const tc = slab.tc - slab.hr; // Concrete above deck ribs
    
    // Maximum forces
    // Concrete compression (full composite)
    const C_max = 0.85 * fc * beff * tc;
    
    // Steel tension (full composite)
    const As = section.A;
    const T_max = As * Fy;
    
    this.addStep(
      'Calculate maximum compression and tension forces',
      'C_max = 0.85fc\'beff tc, T_max = AsFy',
      {
        'fc\'': fc + ' ksi',
        beff: beff.toFixed(1) + ' in',
        tc: tc.toFixed(2) + ' in',
        As: As.toFixed(2) + ' in²',
        Fy: Fy + ' ksi',
      },
      `C_max = ${C_max.toFixed(0)} kips, T_max = ${T_max.toFixed(0)} kips`,
      undefined,
      'AISC 360-22 I3.2a'
    );
    
    // Determine composite level
    let compositeRatio = 1.0;
    if (this.input.compositeLevel) {
      switch (this.input.compositeLevel) {
        case CompositeLevel.FULL: compositeRatio = 1.0; break;
        case CompositeLevel.PARTIAL_75: compositeRatio = 0.75; break;
        case CompositeLevel.PARTIAL_50: compositeRatio = 0.50; break;
        case CompositeLevel.PARTIAL_25: compositeRatio = 0.25; break;
        case CompositeLevel.MINIMUM: compositeRatio = MINIMUM_COMPOSITE_RATIO; break;
      }
    }
    
    // Effective compressive force
    let C: number;
    let T: number;
    
    if (C_max <= T_max) {
      // PNA in steel - full concrete compression
      C = compositeRatio * C_max;
      T = C;
    } else {
      // PNA in concrete (rare for typical sections)
      C = compositeRatio * Math.min(C_max, T_max);
      T = C;
    }
    
    // Compression block depth
    const a = C / (0.85 * fc * beff);
    
    // PNA location (Y2 from top of steel)
    const d_steel = section.d;
    const Y2 = tc + slab.hr + d_steel / 2; // Distance from concrete top to steel centroid
    
    // Moment arm
    const e = Y2 - a / 2;
    
    // Calculate Mn using plastic stress distribution
    // For full composite: Mn = C × e + Mp_steel × (1 - C/As×Fy)
    const Mp_steel = section.Zx * Fy / 12; // kip-ft
    
    let Mn: number;
    if (C >= T_max) {
      // Full steel yielding in tension
      Mn = C * e / 12 + Mp_steel;
    } else {
      // Partial composite - linear interpolation
      const Mn_full = Math.min(C_max, T_max) * (Y2 - a / 2) / 12;
      const Mn_steel = Mp_steel;
      Mn = Mn_steel + compositeRatio * (Mn_full - Mn_steel);
    }
    
    this.addStep(
      'Calculate nominal moment capacity',
      'Mn = C × e (plastic stress distribution)',
      {
        C: C.toFixed(0) + ' kips',
        a: a.toFixed(2) + ' in',
        e: e.toFixed(2) + ' in',
        compositeRatio: (compositeRatio * 100).toFixed(0) + '%',
      },
      Mn.toFixed(1),
      'kip-ft',
      'AISC 360-22 I3.2a'
    );
    
    // Design/allowable strength
    const phi_Mn = phi_b * Mn;
    const Mn_omega = Mn / omega_b;
    
    const Mu = loads.Mu;
    const capacity = designMethod === 'LRFD' ? phi_Mn : Mn_omega;
    const ratio = Mu / capacity;
    
    this.addStep(
      'Calculate design flexural strength',
      designMethod === 'LRFD' ? 'φbMn = 0.90 × Mn' : 'Mn/Ωb = Mn/1.67',
      { Mn: Mn.toFixed(1), Mu: Mu.toFixed(1) },
      `${designMethod === 'LRFD' ? 'φMn' : 'Mn/Ω'} = ${capacity.toFixed(1)} kip-ft, Ratio = ${ratio.toFixed(3)}`,
      undefined,
      'AISC 360-22 I3.2'
    );
    
    // Section properties for deflection
    const n = calculateModularRatio(fc, steelMaterial.E || 29000);
    const Ac = beff * tc / n;
    const Ycon = d_steel + slab.hr + tc / 2;
    const Itr = section.Ix + As * Math.pow(d_steel / 2, 2) + 
      Ac * Math.pow(Ycon - d_steel / 2, 2);
    
    return {
      Mn,
      phi_Mn,
      Mn_omega,
      Mu,
      ratio,
      isAdequate: ratio <= 1.0,
      compositeRatio,
      C,
      T,
      sectionProps: {
        Ac,
        Ycon,
        Y1: 0, // Simplified
        Y2,
        a,
        Itr,
        Sbot: Itr / (d_steel / 2 + slab.hr + tc),
        Stop: Itr / (d_steel / 2),
      },
    };
  }
  
  /**
   * Design shear connectors
   */
  private designShearConnectors(
    flexure: CompositeFlexuralResult,
    studStrength: StudStrengthResult
  ): ShearConnectorResult {
    const { geometry, designMethod } = this.input;
    const L = geometry.L * 12; // inches
    
    // Horizontal shear between max moment and zero moment
    const V_prime = flexure.C;
    
    // Required stud strength per half span
    const Qn = studStrength.Qn;
    const nStudsRequired_half = Math.ceil(V_prime / Qn);
    
    // Total studs for full span
    const nStudsRequired = nStudsRequired_half * 2;
    
    // Spacing limits
    // Maximum: 8 × total slab thickness or 36"
    const maxSpacing = Math.min(8 * this.input.slab.tc, 36);
    
    // Minimum: 6 × stud diameter (longitudinal), 4 × stud diameter (transverse)
    const minSpacing = 6 * this.input.stud.d;
    
    // Calculate provided studs based on spacing
    const nStudsProvided_half = Math.ceil((L / 2) / maxSpacing);
    const nStudsProvided = nStudsProvided_half * 2;
    
    // Check if adequate
    const sum_Qn = nStudsProvided_half * Qn;
    const isAdequate = sum_Qn >= V_prime;
    
    this.addStep(
      'Design shear connectors',
      'n = V\'/Qn (per half span)',
      {
        'V\'': V_prime.toFixed(0) + ' kips',
        Qn: Qn.toFixed(2) + ' kips',
        nRequired: nStudsRequired_half + ' per half span',
      },
      `${nStudsRequired} studs total required, ${nStudsProvided} provided`,
      undefined,
      'AISC 360-22 I8.2c'
    );
    
    return {
      Qn,
      nStudsRequired,
      nStudsProvided: Math.max(nStudsProvided, nStudsRequired),
      maxSpacing,
      minSpacing,
      isAdequate,
      V_prime,
      sum_Qn: sum_Qn * 2,
    };
  }
  
  /**
   * Check deflection
   */
  private checkDeflection(
    effectiveWidth: EffectiveWidthResult,
    flexure: CompositeFlexuralResult
  ): CompositeDeflectionResult {
    const { section, steelMaterial, loads, geometry } = this.input;
    const E = steelMaterial.E || 29000;
    const L = geometry.L * 12; // inches
    
    // Non-composite moment of inertia (construction)
    const I_nc = section.Ix;
    
    // Composite moment of inertia (service)
    const I_comp = flexure.sectionProps.Itr;
    
    // Lower bound moment of inertia for partial composite
    const I_LB = I_nc + flexure.compositeRatio * (I_comp - I_nc);
    
    // Convert loads to kip/in
    const wD = loads.wD / 12;
    const wL = loads.wL / 12;
    const wConst = (loads.wConst || loads.wD) / 12;
    
    // Deflection formula: Δ = 5wL⁴ / (384EI)
    const delta_const = (5 * wConst * Math.pow(L, 4)) / (384 * E * I_nc);
    const delta_DL = (5 * wD * Math.pow(L, 4)) / (384 * E * I_LB);
    const delta_LL = (5 * wL * Math.pow(L, 4)) / (384 * E * I_LB);
    const delta_total = delta_DL + delta_LL;
    
    const L_delta_LL = L / delta_LL;
    const L_delta_total = L / delta_total;
    
    // Typical limits: L/360 for live load, L/240 for total
    const isAdequate = L_delta_LL >= 360 && L_delta_total >= 240;
    
    this.addStep(
      'Check deflection',
      'Δ = 5wL⁴/(384EI)',
      {
        I_comp: I_comp.toFixed(0) + ' in⁴',
        I_LB: I_LB.toFixed(0) + ' in⁴',
        delta_LL: delta_LL.toFixed(3) + ' in',
        'L/Δ_LL': L_delta_LL.toFixed(0),
      },
      isAdequate ? 'OK' : 'NG',
      undefined,
      'AISC Design Guide 3'
    );
    
    return {
      delta_const,
      delta_DL,
      delta_LL,
      delta_total,
      L_delta_LL,
      L_delta_total,
      isAdequate,
    };
  }
  
  /**
   * Add calculation step
   */
  private addStep(
    description: string,
    formula?: string,
    values?: Record<string, number | string>,
    result?: number | string,
    unit?: string,
    reference?: string
  ): void {
    this.calculations.push({
      step: this.stepCounter++,
      description,
      formula,
      values,
      result: result ?? '',
      unit,
      reference,
    });
  }
}

// Export convenience function
export function designCompositeBeam(input: CompositeBeamInput): CompositeBeamResult {
  const calculator = new CompositeBeamCalculator(input);
  return calculator.design();
}
