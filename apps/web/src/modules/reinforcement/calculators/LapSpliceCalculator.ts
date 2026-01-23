/**
 * Lap Splice Calculator
 * Comprehensive reinforcement lap splice design per ACI 318-19, Eurocode 2, IS 456:2000
 * 
 * Features:
 * - Tension lap splices (Class A and B)
 * - Compression lap splices
 * - Contact and non-contact splices
 * - Mechanical splices (Type 1 and Type 2)
 * - Welded splices
 * - Bundled bar splices
 * - Staggering requirements
 * - Seismic splice requirements
 */

import {
  ConcreteDesignCode,
  RebarGrade,
  USBarSize,
  MetricBarSize,
  BarCoating,
  LapSpliceClass,
  MemberType,
  SeismicCategory,
  ConcreteProperties,
  RebarProperties,
  LapSpliceInput,
  LapSpliceResult,
  getBarData,
  US_BAR_DATA,
  METRIC_BAR_DATA,
} from '../types/ReinforcementTypes';

import { DevelopmentLengthCalculator } from './DevelopmentLengthCalculator';

// ============================================================================
// Splice Class Determination
// ============================================================================

interface SpliceClassification {
  spliceClass: LapSpliceClass;
  reason: string;
  percentSpliced: number;
}

// ============================================================================
// ACI 318-19 Lap Splice Calculator
// ============================================================================

class ACI318SpliceCalculator {
  private devCalc = new DevelopmentLengthCalculator();

  /**
   * Determine splice class per ACI 318-19 Table 25.5.2.1
   */
  determineSpliceClass(
    AsProvided: number,
    AsRequired: number,
    percentSplicedAtSection: number
  ): SpliceClassification {
    const ratio = AsProvided / AsRequired;
    
    if (ratio >= 2 && percentSplicedAtSection <= 50) {
      return {
        spliceClass: LapSpliceClass.CLASS_A,
        reason: 'As,provided/As,required ≥ 2 and ≤50% bars spliced',
        percentSpliced: percentSplicedAtSection
      };
    }
    
    return {
      spliceClass: LapSpliceClass.CLASS_B,
      reason: 'Default Class B splice required',
      percentSpliced: percentSplicedAtSection
    };
  }

  /**
   * Calculate tension lap splice length per ACI 318-19 Section 25.5.2
   */
  calculateTensionSplice(
    fc: number,           // f'c in psi
    fy: number,           // fy in psi
    db: number,           // bar diameter in inches
    cover: number,        // clear cover in inches
    spacing: number,      // center-to-center spacing in inches
    spliceClass: LapSpliceClass,
    isTopBar: boolean = false,
    isEpoxyCoated: boolean = false,
    isLightweight: boolean = false,
    hasConfiningReinf: boolean = false
  ): { lst: number; ldRequired: number; multiplier: number; factors: Record<string, number> } {
    // First calculate development length
    const sqrtFc = Math.min(Math.sqrt(fc), 100);
    
    // Modification factors (same as development length)
    const psi_t = isTopBar ? 1.3 : 1.0;
    let psi_e = 1.0;
    if (isEpoxyCoated) {
      psi_e = (cover < 3 * db || spacing < 6 * db) ? 1.5 : 1.2;
    }
    const psi_te = Math.min(psi_t * psi_e, 1.7);
    const psi_s = db <= 0.875 ? 0.8 : 1.0;
    let psi_g = 1.0;
    if (fy > 60000) {
      psi_g = 1.0 + 0.15 * (fy - 60000) / 60000;
    }
    const lambda = isLightweight ? 0.75 : 1.0;
    
    // Confinement term
    const cb = Math.min(cover + db / 2, spacing / 2);
    const Ktr = hasConfiningReinf ? 0.4 : 0; // Simplified Ktr
    const confinementTerm = Math.min((cb + Ktr) / db, 2.5);
    
    // Development length
    const ld = (3 / 40) * (fy * psi_te * psi_s * psi_g / (lambda * sqrtFc)) * (db / confinementTerm);
    const ldMin = Math.max(12, ld);
    
    // Splice length multiplier per ACI 318-19 Table 25.5.2.1
    let multiplier: number;
    switch (spliceClass) {
      case LapSpliceClass.CLASS_A:
        multiplier = 1.0;
        break;
      case LapSpliceClass.CLASS_B:
      default:
        multiplier = 1.3;
    }
    
    // Lap splice length
    const lst = ldMin * multiplier;
    
    return {
      lst,
      ldRequired: ldMin,
      multiplier,
      factors: { psi_t, psi_e, psi_te, psi_s, psi_g, lambda, confinementTerm }
    };
  }

  /**
   * Calculate compression lap splice length per ACI 318-19 Section 25.5.5
   */
  calculateCompressionSplice(
    fc: number,    // f'c in psi
    fy: number,    // fy in psi
    db: number     // bar diameter in inches
  ): { lsc: number; ldcRequired: number; equation: string } {
    // Compression development length
    const sqrtFc = Math.sqrt(fc);
    const ldc1 = (0.02 * fy / sqrtFc) * db;
    const ldc2 = 0.0003 * fy * db;
    const ldc = Math.max(ldc1, ldc2, 8);
    
    // Compression lap splice per ACI 318-19 Section 25.5.5.1
    let lsc: number;
    
    if (fy <= 60000) {
      lsc = Math.max(0.0005 * fy * db, 12);
    } else {
      lsc = Math.max((0.0009 * fy - 24) * db, 12);
    }
    
    return {
      lsc,
      ldcRequired: ldc,
      equation: fy <= 60000 
        ? `lsc = max(0.0005 × fy × db, 12") = ${lsc.toFixed(1)}"`
        : `lsc = max((0.0009fy - 24) × db, 12") = ${lsc.toFixed(1)}"`
    };
  }

  /**
   * Calculate non-contact splice requirements per ACI 318-19 Section 25.5.1.4
   */
  calculateNonContactSplice(
    tensionSpliceLength: number,
    clearSpaceBetweenBars: number,
    transverseReinfSpacing: number
  ): { additionalLength: number; isPermitted: boolean; requirements: string[] } {
    const requirements: string[] = [];
    
    // Maximum clear spacing per ACI 318-19 Section 25.5.1.4
    const maxClearSpace = Math.min(tensionSpliceLength / 5, 6);
    
    if (clearSpaceBetweenBars > maxClearSpace) {
      return {
        additionalLength: 0,
        isPermitted: false,
        requirements: [
          `Clear space (${clearSpaceBetweenBars}") exceeds maximum (${maxClearSpace.toFixed(1)}")`,
          'Non-contact splice not permitted - reduce bar spacing'
        ]
      };
    }
    
    // Additional splice length = 2 × clear space
    const additionalLength = 2 * clearSpaceBetweenBars;
    
    requirements.push(`Non-contact splice permitted with clear space ≤ ${maxClearSpace.toFixed(1)}"`);
    requirements.push(`Additional length required: 2 × ${clearSpaceBetweenBars}" = ${additionalLength}"`);
    
    // Transverse reinforcement requirements
    requirements.push(`Transverse reinforcement spacing ≤ ${tensionSpliceLength / 5}"`);
    
    return {
      additionalLength,
      isPermitted: true,
      requirements
    };
  }

  /**
   * Calculate bundled bar splice requirements per ACI 318-19 Section 25.6.1
   */
  calculateBundledBarSplice(
    individualSpliceLength: number,
    bundleSize: number,
    db: number
  ): { bundleSpliceLength: number; staggerRequirement: number; notes: string[] } {
    const notes: string[] = [];
    
    // Increase splice length for bundled bars
    let lengthFactor: number;
    switch (bundleSize) {
      case 2:
        lengthFactor = 1.0; // No increase for 2-bar bundles
        break;
      case 3:
        lengthFactor = 1.2; // 20% increase for 3-bar bundles
        break;
      case 4:
        lengthFactor = 1.33; // 33% increase for 4-bar bundles
        break;
      default:
        lengthFactor = 1.0;
    }
    
    const bundleSpliceLength = individualSpliceLength * lengthFactor;
    
    // Stagger requirement per ACI 318-19 Section 25.6.1.5
    const staggerRequirement = 40 * db;
    
    notes.push(`Bundle splice length = ${individualSpliceLength.toFixed(1)}" × ${lengthFactor} = ${bundleSpliceLength.toFixed(1)}"`);
    notes.push(`Individual bar splices shall be staggered by at least ${staggerRequirement.toFixed(0)}"`);
    notes.push('Splices shall not occur within the bundle');
    
    return {
      bundleSpliceLength,
      staggerRequirement,
      notes
    };
  }
}

// ============================================================================
// Eurocode 2 Lap Splice Calculator
// ============================================================================

class EC2SpliceCalculator {
  private readonly gamma_c = 1.5;
  private readonly gamma_s = 1.15;

  /**
   * Calculate lap length per EC2 Section 8.7
   */
  calculateLapLength(
    fck: number,           // characteristic strength in MPa
    fyk: number,           // characteristic yield strength in MPa
    db: number,            // bar diameter in mm
    cover: number,         // concrete cover in mm
    spacing: number,       // bar spacing in mm
    percentSplicedAtSection: number,
    bondCondition: 'good' | 'poor' = 'good',
    hasTransverseReinf: boolean = false
  ): { l0: number; lbRqd: number; alpha6: number; factors: Record<string, number> } {
    // Design bond stress
    const fctd = 0.21 * Math.pow(fck, 2/3) / this.gamma_c;
    const eta1 = bondCondition === 'good' ? 1.0 : 0.7;
    const eta2 = db <= 32 ? 1.0 : (132 - db) / 100;
    const fbd = 2.25 * eta1 * eta2 * fctd;
    
    // Design yield stress
    const fyd = fyk / this.gamma_s;
    
    // Basic required anchorage length
    const lbRqd = (db / 4) * (fyd / fbd);
    
    // Alpha coefficients (simplified)
    const cd = Math.min(cover, spacing / 2, db);
    const alpha1 = 1.0; // Straight bars
    const alpha2 = Math.max(0.7, Math.min(1.0, 1 - 0.15 * (cd - db) / db));
    const alpha3 = hasTransverseReinf ? 0.9 : 1.0;
    const alpha5 = 1.0;
    
    // Alpha6 - Percentage of lapped bars per EC2 Table 8.3
    let alpha6: number;
    if (percentSplicedAtSection <= 25) {
      alpha6 = 1.0;
    } else if (percentSplicedAtSection <= 33) {
      alpha6 = 1.15;
    } else if (percentSplicedAtSection <= 50) {
      alpha6 = 1.4;
    } else {
      alpha6 = 1.5;
    }
    
    // Design lap length per EC2 Eq. 8.10
    const alphaProduct = Math.max(0.7, alpha1 * alpha2 * alpha3 * alpha5);
    let l0 = alphaProduct * alpha6 * lbRqd;
    
    // Minimum lap length per EC2 Section 8.7.3
    const l0min = Math.max(0.3 * alpha6 * lbRqd, 15 * db, 200);
    l0 = Math.max(l0, l0min);
    
    return {
      l0,
      lbRqd,
      alpha6,
      factors: { alpha1, alpha2, alpha3, alpha5, alpha6, eta1, eta2 }
    };
  }

  /**
   * Calculate transverse reinforcement requirements for laps per EC2 Section 8.7.4
   */
  calculateTransverseRequirements(
    db: number,
    l0: number,
    percentSplicedAtSection: number
  ): { Ast: number; spacing: number; requirements: string[] } {
    const requirements: string[] = [];
    
    // Area of one bar
    const As = Math.PI * db * db / 4;
    
    // Transverse reinforcement area per EC2 Section 8.7.4.1
    let Ast: number;
    if (percentSplicedAtSection <= 25 || db <= 16) {
      // Nominal reinforcement may be sufficient
      Ast = 0;
      requirements.push('Nominal transverse reinforcement as per general requirements');
    } else {
      // ΣAst ≥ As
      Ast = As;
      requirements.push(`Transverse reinforcement ΣAst ≥ ${As.toFixed(0)} mm² required`);
    }
    
    // Spacing requirements
    const spacing = Math.min(0.75 * l0, 150);
    requirements.push(`Transverse bars placed at spacing ≤ ${spacing.toFixed(0)} mm within lap zone`);
    requirements.push('Position transverse bars perpendicular to lapped bars');
    
    return { Ast, spacing, requirements };
  }
}

// ============================================================================
// IS 456:2000 Lap Splice Calculator
// ============================================================================

class IS456SpliceCalculator {
  /**
   * Calculate lap length per IS 456 Clause 26.2.5
   */
  calculateLapLength(
    fck: number,           // characteristic strength in MPa
    fy: number,            // yield strength in MPa
    db: number,            // bar diameter in mm
    spliceType: 'tension' | 'compression',
    barType: 'deformed' | 'plain' = 'deformed',
    percentSplicedAtSection: number = 100
  ): { Ls: number; Ld: number; multiplier: number; equation: string } {
    // Design bond stress per IS 456 Table 22
    let tau_bd: number;
    if (fck <= 20) {
      tau_bd = barType === 'deformed' ? 1.2 : 0.8;
    } else if (fck <= 25) {
      tau_bd = barType === 'deformed' ? 1.4 : 0.9;
    } else if (fck <= 30) {
      tau_bd = barType === 'deformed' ? 1.5 : 1.0;
    } else if (fck <= 35) {
      tau_bd = barType === 'deformed' ? 1.7 : 1.1;
    } else {
      tau_bd = barType === 'deformed' ? 1.9 : 1.2;
    }
    
    // Increase for compression
    if (spliceType === 'compression') {
      tau_bd *= barType === 'deformed' ? 1.6 : 1.25;
    }
    
    // Development length per IS 456 Eq. 26.2.1
    const sigma_s = 0.87 * fy;
    const Ld = (db * sigma_s) / (4 * tau_bd);
    
    // Lap length per IS 456 Clause 26.2.5.1
    let multiplier: number;
    
    if (spliceType === 'tension') {
      // For tension splices
      if (percentSplicedAtSection <= 50) {
        multiplier = 1.0; // Equivalent to IS 456 requirement
      } else {
        multiplier = 1.3; // When more than 50% bars spliced
      }
      
      // Minimum lap for flexural tension: Ld or 30db, whichever is greater
      const Ls = Math.max(Ld * multiplier, 30 * db);
      
      return {
        Ls,
        Ld,
        multiplier,
        equation: `Ls = max(${multiplier} × Ld, 30db) = max(${(Ld * multiplier).toFixed(0)}, ${30 * db}) = ${Ls.toFixed(0)} mm`
      };
    } else {
      // For compression splices
      multiplier = 1.0;
      const Ls = Math.max(Ld, 24 * db);
      
      return {
        Ls,
        Ld,
        multiplier,
        equation: `Ls = max(Ld, 24db) = max(${Ld.toFixed(0)}, ${24 * db}) = ${Ls.toFixed(0)} mm`
      };
    }
  }

  /**
   * Calculate staggering requirements per IS 456 Clause 26.2.5.2
   */
  calculateStaggeringRequirement(
    lapLength: number,
    barSpacing: number,
    memberWidth: number
  ): { staggerDistance: number; maxBarsAtSection: number; requirements: string[] } {
    const requirements: string[] = [];
    
    // Stagger distance = 1.3 × Lap length (IS 456 recommendation)
    const staggerDistance = 1.3 * lapLength;
    
    // Maximum bars that can be spliced at a section
    const maxBarsAtSection = Math.floor(memberWidth / (2 * barSpacing));
    
    requirements.push(`Stagger lap splices by at least ${staggerDistance.toFixed(0)} mm`);
    requirements.push(`Not more than 50% of bars should be spliced at any section`);
    requirements.push(`For flexure: splices should be near points of contraflexure`);
    
    return { staggerDistance, maxBarsAtSection, requirements };
  }
}

// ============================================================================
// Main Lap Splice Calculator
// ============================================================================

export class LapSpliceCalculator {
  private aciCalc = new ACI318SpliceCalculator();
  private ec2Calc = new EC2SpliceCalculator();
  private is456Calc = new IS456SpliceCalculator();

  /**
   * Calculate lap splice for given input parameters
   */
  calculate(input: LapSpliceInput): LapSpliceResult {
    switch (input.designCode) {
      case ConcreteDesignCode.ACI_318_19:
      case ConcreteDesignCode.ACI_318_14:
        return this.calculateACI(input);
      case ConcreteDesignCode.EUROCODE_2:
        return this.calculateEC2(input);
      case ConcreteDesignCode.IS_456:
        return this.calculateIS456(input);
      default:
        return this.calculateACI(input);
    }
  }

  /**
   * Calculate lap splice per ACI 318-19
   */
  private calculateACI(input: LapSpliceInput): LapSpliceResult {
    const isMetric = input.barDiameter > 2;
    
    // Convert to US units if needed
    let fc: number, fy: number, db: number, cover: number, spacing: number;
    
    if (isMetric) {
      fc = input.concrete.fc * 145.038;
      fy = input.rebar.fy * 145.038;
      db = input.barDiameter / 25.4;
      cover = input.clearCover / 25.4;
      spacing = input.barSpacing / 25.4;
    } else {
      fc = input.concrete.fc;
      fy = input.rebar.fy;
      db = input.barDiameter;
      cover = input.clearCover;
      spacing = input.barSpacing;
    }
    
    const isEpoxyCoated = input.coating === BarCoating.EPOXY_COATED;
    const percentSpliced = input.percentSplicedAtSection || 100;
    
    // Determine splice class
    const classification = this.aciCalc.determineSpliceClass(
      input.AsProvided || 1,
      input.AsRequired || 1,
      percentSpliced
    );
    
    let result: LapSpliceResult;
    
    if (input.spliceType === 'tension') {
      const tensionResult = this.aciCalc.calculateTensionSplice(
        fc, fy, db, cover, spacing,
        classification.spliceClass,
        input.isTopBar || false,
        isEpoxyCoated,
        false,
        input.hasConfiningReinf || false
      );
      
      const lapLength = isMetric ? tensionResult.lst * 25.4 : tensionResult.lst;
      const devLength = isMetric ? tensionResult.ldRequired * 25.4 : tensionResult.ldRequired;
      
      result = {
        designCode: input.designCode,
        spliceType: 'tension',
        spliceClass: classification.spliceClass,
        barSize: input.barSize,
        barDiameter: input.barDiameter,
        lapSpliceLength: lapLength,
        developmentLength: devLength,
        spliceMultiplier: tensionResult.multiplier,
        modificationFactors: tensionResult.factors,
        percentSplicedAtSection: percentSpliced,
        classificationReason: classification.reason
      };
      
      // Non-contact splice if applicable
      if (input.isNonContact && input.clearSpaceBetweenBars) {
        const clearSpace = isMetric ? input.clearSpaceBetweenBars / 25.4 : input.clearSpaceBetweenBars;
        const nonContactResult = this.aciCalc.calculateNonContactSplice(
          tensionResult.lst,
          clearSpace,
          0 // Simplified
        );
        
        if (nonContactResult.isPermitted) {
          const additionalLength = isMetric 
            ? nonContactResult.additionalLength * 25.4 
            : nonContactResult.additionalLength;
          result.lapSpliceLength += additionalLength;
          result.nonContactRequirements = nonContactResult.requirements;
        } else {
          result.warnings = nonContactResult.requirements;
        }
      }
      
    } else {
      // Compression splice
      const compResult = this.aciCalc.calculateCompressionSplice(fc, fy, db);
      
      result = {
        designCode: input.designCode,
        spliceType: 'compression',
        spliceClass: LapSpliceClass.COMPRESSION,
        barSize: input.barSize,
        barDiameter: input.barDiameter,
        lapSpliceLength: isMetric ? compResult.lsc * 25.4 : compResult.lsc,
        developmentLength: isMetric ? compResult.ldcRequired * 25.4 : compResult.ldcRequired,
        spliceMultiplier: 1.0,
        percentSplicedAtSection: percentSpliced,
        equation: compResult.equation
      };
    }
    
    // Bundled bar adjustments
    if (input.bundleSize && input.bundleSize > 1) {
      const bundleResult = this.aciCalc.calculateBundledBarSplice(
        result.lapSpliceLength,
        input.bundleSize,
        input.barDiameter
      );
      result.lapSpliceLength = bundleResult.bundleSpliceLength;
      result.bundledBarNotes = bundleResult.notes;
      result.staggerRequirement = bundleResult.staggerRequirement;
    }
    
    // Minimum length
    result.minimumLength = Math.max(result.lapSpliceLength, isMetric ? 300 : 12);
    
    // Generate recommendations
    result.recommendations = this.generateRecommendations(input, result);
    
    return result;
  }

  /**
   * Calculate lap splice per Eurocode 2
   */
  private calculateEC2(input: LapSpliceInput): LapSpliceResult {
    const fck = input.concrete.fc;
    const fyk = input.rebar.fy;
    const db = input.barDiameter;
    const cover = input.clearCover;
    const spacing = input.barSpacing;
    const percentSpliced = input.percentSplicedAtSection || 100;
    
    const bondCondition = input.isTopBar ? 'poor' : 'good';
    
    const lapResult = this.ec2Calc.calculateLapLength(
      fck, fyk, db, cover, spacing,
      percentSpliced,
      bondCondition,
      input.hasConfiningReinf || false
    );
    
    // Transverse reinforcement requirements
    const transverseReq = this.ec2Calc.calculateTransverseRequirements(
      db, lapResult.l0, percentSpliced
    );
    
    // Determine splice class based on percentage
    let spliceClass: LapSpliceClass;
    if (percentSpliced <= 25) {
      spliceClass = LapSpliceClass.CLASS_A;
    } else {
      spliceClass = LapSpliceClass.CLASS_B;
    }
    
    const result: LapSpliceResult = {
      designCode: input.designCode,
      spliceType: input.spliceType,
      spliceClass,
      barSize: input.barSize,
      barDiameter: db,
      lapSpliceLength: lapResult.l0,
      developmentLength: lapResult.lbRqd,
      spliceMultiplier: lapResult.alpha6,
      modificationFactors: lapResult.factors,
      percentSplicedAtSection: percentSpliced,
      transverseRequirements: transverseReq,
      minimumLength: Math.max(0.3 * lapResult.alpha6 * lapResult.lbRqd, 15 * db, 200)
    };
    
    result.recommendations = this.generateRecommendations(input, result);
    
    return result;
  }

  /**
   * Calculate lap splice per IS 456
   */
  private calculateIS456(input: LapSpliceInput): LapSpliceResult {
    const fck = input.concrete.fc;
    const fy = input.rebar.fy;
    const db = input.barDiameter;
    const percentSpliced = input.percentSplicedAtSection || 100;
    
    const lapResult = this.is456Calc.calculateLapLength(
      fck, fy, db,
      input.spliceType,
      'deformed',
      percentSpliced
    );
    
    // Staggering requirements
    const staggerReq = this.is456Calc.calculateStaggeringRequirement(
      lapResult.Ls,
      input.barSpacing,
      input.memberWidth || 300
    );
    
    const result: LapSpliceResult = {
      designCode: input.designCode,
      spliceType: input.spliceType,
      spliceClass: percentSpliced <= 50 ? LapSpliceClass.CLASS_A : LapSpliceClass.CLASS_B,
      barSize: input.barSize,
      barDiameter: db,
      lapSpliceLength: lapResult.Ls,
      developmentLength: lapResult.Ld,
      spliceMultiplier: lapResult.multiplier,
      percentSplicedAtSection: percentSpliced,
      equation: lapResult.equation,
      staggerRequirement: staggerReq.staggerDistance,
      minimumLength: input.spliceType === 'tension' ? 30 * db : 24 * db
    };
    
    result.recommendations = [
      ...staggerReq.requirements,
      ...this.generateRecommendations(input, result)
    ];
    
    return result;
  }

  /**
   * Generate recommendations based on calculation results
   */
  private generateRecommendations(
    input: LapSpliceInput,
    result: LapSpliceResult
  ): string[] {
    const recommendations: string[] = [];
    
    // Percentage spliced warning
    if ((input.percentSplicedAtSection || 100) > 50) {
      recommendations.push('⚠️ More than 50% bars spliced at section - consider staggering.');
    }
    
    // Large bar warning
    if (input.barDiameter >= 32 || (input.barDiameter >= 1.27 && input.barDiameter <= 2)) {
      recommendations.push('Large bars may require mechanical or welded splices.');
    }
    
    // Seismic requirements
    if (input.seismicCategory && input.seismicCategory >= SeismicCategory.SDC_D) {
      recommendations.push('🔴 Seismic requirements: Verify splice location per ACI 318 Chapter 18.');
      recommendations.push('Lap splices not permitted in plastic hinge regions.');
    }
    
    // Alternative splice suggestion for long laps
    if (result.lapSpliceLength > 60 * input.barDiameter) {
      recommendations.push('Consider mechanical splices (Type 1 or Type 2) to reduce congestion.');
    }
    
    // Contact splice preferred
    if (input.isNonContact) {
      recommendations.push('Contact splices preferred when feasible for better force transfer.');
    }
    
    // Flexure splice location
    if (input.spliceType === 'tension') {
      recommendations.push('Locate tension splices away from regions of maximum stress.');
    }
    
    return recommendations;
  }

  /**
   * Get mechanical splice requirements
   */
  getMechanicalSpliceRequirements(
    designCode: ConcreteDesignCode,
    spliceType: 'Type1' | 'Type2'
  ): {
    strengthRequirement: string;
    slipRequirement: string;
    qualificationTest: string;
  } {
    if (designCode === ConcreteDesignCode.ACI_318_19 || 
        designCode === ConcreteDesignCode.ACI_318_14) {
      if (spliceType === 'Type1') {
        return {
          strengthRequirement: 'Develop 125% of specified fy of spliced bar',
          slipRequirement: 'No specific slip limit',
          qualificationTest: 'Per ACI 318-19 Section 25.5.7.1'
        };
      } else {
        return {
          strengthRequirement: 'Develop specified tensile strength (fu) of spliced bar',
          slipRequirement: 'No specific slip limit',
          qualificationTest: 'Per ACI 318-19 Section 25.5.7.1'
        };
      }
    }
    
    // EC2 / IS 456 requirements
    return {
      strengthRequirement: 'Develop characteristic strength of bar',
      slipRequirement: 'Slip < 0.1mm at 60% of design strength',
      qualificationTest: 'Per local code requirements'
    };
  }

  /**
   * Get complete lap schedule for project
   */
  getLapSchedule(
    designCode: ConcreteDesignCode,
    fc: number,
    fy: number,
    cover: number
  ): Array<{
    barSize: string;
    diameter: number;
    tensionClassA: number;
    tensionClassB: number;
    compression: number;
  }> {
    const schedule: Array<{
      barSize: string;
      diameter: number;
      tensionClassA: number;
      tensionClassB: number;
      compression: number;
    }> = [];
    
    const isMetric = designCode !== ConcreteDesignCode.ACI_318_19 && 
                     designCode !== ConcreteDesignCode.ACI_318_14;
    
    const barData = isMetric ? METRIC_BAR_DATA : US_BAR_DATA;
    
    for (const [size, data] of Object.entries(barData)) {
      const input: LapSpliceInput = {
        designCode,
        spliceType: 'tension',
        barSize: size,
        barDiameter: data.diameter,
        concrete: { fc } as ConcreteProperties,
        rebar: { fy } as RebarProperties,
        clearCover: cover,
        barSpacing: 3 * data.diameter,
        percentSplicedAtSection: 25 // For Class A
      };
      
      // Class A tension splice
      input.percentSplicedAtSection = 25;
      const classAResult = this.calculate(input);
      
      // Class B tension splice
      input.percentSplicedAtSection = 100;
      const classBResult = this.calculate(input);
      
      // Compression splice
      input.spliceType = 'compression';
      const compResult = this.calculate(input);
      
      schedule.push({
        barSize: size,
        diameter: data.diameter,
        tensionClassA: Math.ceil(classAResult.lapSpliceLength),
        tensionClassB: Math.ceil(classBResult.lapSpliceLength),
        compression: Math.ceil(compResult.lapSpliceLength)
      });
    }
    
    return schedule;
  }
}

// Export singleton instance
export const lapSpliceCalculator = new LapSpliceCalculator();
