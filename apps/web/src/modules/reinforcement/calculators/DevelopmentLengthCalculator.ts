/**
 * Development Length Calculator
 * Comprehensive bar development length calculations per ACI 318-19, Eurocode 2, IS 456:2000
 * 
 * Features:
 * - Tension development length (straight bars)
 * - Compression development length
 * - Standard hooks (90° and 180°)
 * - Headed bar development
 * - Top bar factors
 * - Coating factors
 * - Lightweight concrete factors
 * - Excess reinforcement factors
 */

import {
  ConcreteDesignCode,
  RebarGrade,
  USBarSize,
  MetricBarSize,
  HookType,
  BarCoating,
  ExposureCondition,
  MemberType,
  ConcreteProperties,
  RebarProperties,
  DevelopmentLengthInput,
  DevelopmentLengthResult,
  getBarData,
  US_BAR_DATA,
  METRIC_BAR_DATA,
} from '../types/ReinforcementTypes';

// ============================================================================
// ACI 318-19 Development Length Calculator
// ============================================================================

class ACI318DevelopmentCalculator {
  /**
   * Calculate tension development length per ACI 318-19 Section 25.4.2
   */
  calculateTensionDevelopment(
    fc: number,           // f'c in psi
    fy: number,           // fy in psi
    db: number,           // bar diameter in inches
    cover: number,        // clear cover in inches
    spacing: number,      // center-to-center spacing in inches
    isTopBar: boolean,    // casting position factor
    isEpoxyCoated: boolean,
    isLightweight: boolean,
    transverseIndex: number = 0, // Ktr
    hasConfinement: boolean = false
  ): { ld: number; factors: Record<string, number>; equation: string } {
    const sqrtFc = Math.min(Math.sqrt(fc), 100); // Cap at 100 psi per ACI
    
    // Modification factors per ACI 318-19 Table 25.4.2.5
    
    // ψ_t - Casting position factor
    const psi_t = isTopBar && db <= 0.75 ? 1.3 : (isTopBar ? 1.3 : 1.0);
    
    // ψ_e - Coating factor
    let psi_e = 1.0;
    if (isEpoxyCoated) {
      if (cover < 3 * db || spacing < 6 * db) {
        psi_e = 1.5;
      } else {
        psi_e = 1.2;
      }
    }
    
    // Product limit
    const psi_te = Math.min(psi_t * psi_e, 1.7);
    
    // ψ_s - Bar size factor
    const psi_s = db <= 0.875 ? 0.8 : 1.0;
    
    // ψ_g - Grade factor (ACI 318-19)
    let psi_g = 1.0;
    if (fy > 60000) {
      psi_g = 1.0 + 0.15 * (fy - 60000) / 60000;
    }
    
    // λ - Lightweight concrete factor
    const lambda = isLightweight ? 0.75 : 1.0;
    
    // Confinement term (cb + Ktr)/db
    const cb = Math.min(cover + db / 2, spacing / 2);
    const Ktr = transverseIndex;
    const confinementTerm = Math.min((cb + Ktr) / db, 2.5);
    
    // Development length per ACI 318-19 Eq. 25.4.2.4a
    const ld = (3 / 40) * (fy * psi_te * psi_s * psi_g / (lambda * sqrtFc)) * (db / confinementTerm);
    
    // Minimum development length
    const ldMin = Math.max(12, ld);
    
    return {
      ld: ldMin,
      factors: {
        psi_t,
        psi_e,
        psi_te,
        psi_s,
        psi_g,
        lambda,
        confinementTerm
      },
      equation: `ld = (3/40) × (fy × ψt × ψe × ψs × ψg) / (λ × √f'c) × (db / ((cb + Ktr)/db))`
    };
  }

  /**
   * Calculate compression development length per ACI 318-19 Section 25.4.9
   */
  calculateCompressionDevelopment(
    fc: number,    // f'c in psi
    fy: number,    // fy in psi
    db: number     // bar diameter in inches
  ): { ldc: number; equation: string } {
    const sqrtFc = Math.min(Math.sqrt(fc), 100);
    
    // Development length per ACI 318-19 Eq. 25.4.9.1
    const ldc1 = (0.02 * fy / (sqrtFc)) * db;
    const ldc2 = 0.0003 * fy * db;
    
    let ldc = Math.max(ldc1, ldc2, 8);
    
    return {
      ldc,
      equation: `ldc = max(0.02×fy×db/√f'c, 0.0003×fy×db, 8")`
    };
  }

  /**
   * Calculate standard hook development length per ACI 318-19 Section 25.4.3
   */
  calculateHookDevelopment(
    fc: number,           // f'c in psi
    fy: number,           // fy in psi
    db: number,           // bar diameter in inches
    hookType: HookType,
    cover: number,        // side cover in inches
    isEpoxyCoated: boolean,
    isLightweight: boolean,
    hasConfinement: boolean = false
  ): { ldh: number; factors: Record<string, number>; hookGeometry: { extension: number; bendRadius: number } } {
    const sqrtFc = Math.min(Math.sqrt(fc), 100);
    
    // Modification factors
    
    // ψ_r - Confining reinforcement factor
    const psi_r = hasConfinement ? 0.8 : 1.0;
    
    // ψ_e - Coating factor
    const psi_e = isEpoxyCoated ? 1.2 : 1.0;
    
    // ψ_c - Cover factor
    const psi_c = (cover >= 2.5 && hookType === HookType.HOOK_90) ? 0.7 : 1.0;
    
    // ψ_o - Location factor for 180° hooks
    const psi_o = (hookType === HookType.HOOK_180 && cover >= 2.5) ? 0.7 : 1.0;
    
    // λ - Lightweight concrete factor
    const lambda = isLightweight ? 0.75 : 1.0;
    
    // Basic hook development length per ACI 318-19 Eq. 25.4.3.1
    const ldh_basic = (0.24 * fy * psi_e) / (lambda * sqrtFc) * db;
    
    // Apply modification factors
    let ldh = ldh_basic * psi_r * psi_c * psi_o;
    
    // Minimum development length
    ldh = Math.max(ldh, 8 * db, 6);
    
    // Hook geometry
    const bendRadius = db <= 1 ? 3 * db : (db <= 1.375 ? 4 * db : 5 * db);
    let extension: number;
    
    switch (hookType) {
      case HookType.HOOK_90:
        extension = 12 * db;
        break;
      case HookType.HOOK_180:
        extension = 4 * db;
        break;
      case HookType.HOOK_135_SEISMIC:
        extension = 6 * db;
        break;
      default:
        extension = 12 * db;
    }
    
    return {
      ldh,
      factors: { psi_r, psi_e, psi_c, psi_o, lambda },
      hookGeometry: { extension, bendRadius }
    };
  }

  /**
   * Calculate headed bar development length per ACI 318-19 Section 25.4.4
   */
  calculateHeadedBarDevelopment(
    fc: number,    // f'c in psi
    fy: number,    // fy in psi
    db: number,    // bar diameter in inches
    cover: number, // clear cover in inches
    isEpoxyCoated: boolean,
    isLightweight: boolean
  ): { ldt: number; minHeadArea: number; equation: string } {
    const sqrtFc = Math.min(Math.sqrt(fc), 100);
    
    // Modification factors
    const psi_e = isEpoxyCoated ? 1.2 : 1.0;
    const lambda = isLightweight ? 0.75 : 1.0;
    
    // Development length per ACI 318-19 Eq. 25.4.4.1
    const ldt = (0.016 * fy * psi_e) / (lambda * sqrtFc) * db;
    
    // Minimum development length
    const ldtMin = Math.max(ldt, 8 * db, 6);
    
    // Minimum head area per ACI 318-19 Section 25.4.4.1
    const Ab = Math.PI * db * db / 4;
    const minHeadArea = 4 * Ab;
    
    return {
      ldt: ldtMin,
      minHeadArea,
      equation: `ldt = 0.016 × fy × ψe × db / (λ × √f'c)`
    };
  }
}

// ============================================================================
// Eurocode 2 Development Length Calculator
// ============================================================================

class EC2DevelopmentCalculator {
  private readonly gamma_c = 1.5;

  /**
   * Calculate basic anchorage length per EC2 Section 8.4.3
   */
  calculateBasicAnchorageLength(
    fck: number,    // characteristic strength in MPa
    fyk: number,    // characteristic yield strength in MPa
    db: number,     // bar diameter in mm
    bondCondition: 'good' | 'poor' = 'good'
  ): { lbRqd: number; fbd: number; eta1: number; eta2: number } {
    // Design bond stress per EC2 Eq. 8.2
    const fctd = 0.21 * Math.pow(fck, 2/3) / this.gamma_c; // Design tensile strength
    
    // η1 - Bond condition coefficient
    const eta1 = bondCondition === 'good' ? 1.0 : 0.7;
    
    // η2 - Bar diameter coefficient
    const eta2 = db <= 32 ? 1.0 : (132 - db) / 100;
    
    // Design bond strength
    const fbd = 2.25 * eta1 * eta2 * fctd;
    
    // Design yield stress
    const fyd = fyk / 1.15;
    
    // Basic required anchorage length per EC2 Eq. 8.3
    const lbRqd = (db / 4) * (fyd / fbd);
    
    return { lbRqd, fbd, eta1, eta2 };
  }

  /**
   * Calculate design anchorage length per EC2 Section 8.4.4
   */
  calculateDesignAnchorageLength(
    fck: number,           // characteristic strength in MPa
    fyk: number,           // characteristic yield strength in MPa
    db: number,            // bar diameter in mm
    cover: number,         // concrete cover in mm
    spacing: number,       // bar spacing in mm
    bondCondition: 'good' | 'poor' = 'good',
    barType: 'straight' | 'hook' | 'loop' | 'welded' = 'straight',
    hasTransverseReinf: boolean = false,
    AsRequired: number = 1,
    AsProvided: number = 1
  ): { lbd: number; factors: Record<string, number>; lbMin: number } {
    const { lbRqd, fbd, eta1, eta2 } = this.calculateBasicAnchorageLength(fck, fyk, db, bondCondition);
    
    // Alpha coefficients per EC2 Table 8.2
    
    // α1 - Effect of form of bars
    let alpha1 = 1.0;
    if (barType === 'hook' || barType === 'loop') {
      alpha1 = cover >= 3 * db ? 0.7 : 1.0;
    }
    
    // α2 - Effect of concrete cover
    const cd = Math.min(cover, spacing / 2, db);
    alpha1 = Math.max(0.7, 1 - 0.15 * (cd - db) / db);
    const alpha2 = Math.max(0.7, Math.min(1.0, 1 - 0.15 * (cd - db) / db));
    
    // α3 - Effect of transverse reinforcement (not welded)
    const alpha3 = hasTransverseReinf ? 0.9 : 1.0;
    
    // α4 - Effect of welded transverse reinforcement
    const alpha4 = 1.0;
    
    // α5 - Effect of pressure
    const alpha5 = 1.0;
    
    // Combined alpha (minimum 0.7)
    const alphaProduct = Math.max(0.7, alpha1 * alpha2 * alpha3 * alpha4 * alpha5);
    
    // Design anchorage length
    let lbd = alphaProduct * lbRqd * (AsRequired / AsProvided);
    
    // Minimum anchorage length per EC2 Section 8.4.4
    let lbMin: number;
    if (barType === 'straight') {
      lbMin = Math.max(0.3 * lbRqd, 10 * db, 100);
    } else {
      lbMin = Math.max(0.6 * lbRqd, 10 * db, 100);
    }
    
    lbd = Math.max(lbd, lbMin);
    
    return {
      lbd,
      factors: { alpha1, alpha2, alpha3, alpha4, alpha5, eta1, eta2 },
      lbMin
    };
  }

  /**
   * Calculate hook dimensions per EC2
   */
  calculateHookGeometry(
    db: number,
    hookType: HookType
  ): { bendRadius: number; extension: number } {
    // Minimum mandrel diameter per EC2 Table 8.1N
    const mandrelDiameter = db <= 16 ? 4 * db : 7 * db;
    const bendRadius = mandrelDiameter / 2;
    
    let extension: number;
    switch (hookType) {
      case HookType.HOOK_90:
        extension = Math.max(5 * db, 70);
        break;
      case HookType.HOOK_180:
        extension = Math.max(3.5 * db, 50);
        break;
      case HookType.HOOK_135_SEISMIC:
        extension = Math.max(6 * db, 75);
        break;
      default:
        extension = 5 * db;
    }
    
    return { bendRadius, extension };
  }
}

// ============================================================================
// IS 456:2000 Development Length Calculator
// ============================================================================

class IS456DevelopmentCalculator {
  /**
   * Calculate development length per IS 456 Clause 26.2.1
   */
  calculateDevelopmentLength(
    fck: number,           // characteristic strength in MPa
    fy: number,            // yield strength in MPa
    db: number,            // bar diameter in mm
    barType: 'deformed' | 'plain' = 'deformed',
    stressType: 'tension' | 'compression' = 'tension'
  ): { Ld: number; tau_bd: number; equation: string } {
    // Design bond stress per IS 456 Clause 26.2.1.1
    let tau_bd: number;
    
    // Table 22 of IS 456 (for M20 grade and above)
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
    
    // Increase by 60% for deformed bars in compression
    if (stressType === 'compression' && barType === 'deformed') {
      tau_bd *= 1.6;
    } else if (stressType === 'compression') {
      tau_bd *= 1.25;
    }
    
    // Development length per IS 456 Eq. 26.2.1
    // Ld = φ × σs / (4 × τbd)
    // For full development: σs = 0.87 × fy
    const sigma_s = 0.87 * fy;
    const Ld = (db * sigma_s) / (4 * tau_bd);
    
    return {
      Ld,
      tau_bd,
      equation: `Ld = φ × 0.87fy / (4 × τbd) = ${db} × ${sigma_s.toFixed(1)} / (4 × ${tau_bd}) = ${Ld.toFixed(0)} mm`
    };
  }

  /**
   * Calculate standard hook development per IS 456 Clause 26.2.2
   */
  calculateHookDevelopment(
    fck: number,
    fy: number,
    db: number,
    hookType: HookType
  ): { Lhook: number; anchorageValue: number; hookGeometry: { bendRadius: number; extension: number } } {
    // Anchorage value of hooks per IS 456 Clause 26.2.2.1
    let anchorageValue: number;
    switch (hookType) {
      case HookType.HOOK_90:
        anchorageValue = 8 * db;
        break;
      case HookType.HOOK_180:
        anchorageValue = 16 * db;
        break;
      default:
        anchorageValue = 8 * db;
    }
    
    // Full development length
    const { Ld, tau_bd } = this.calculateDevelopmentLength(fck, fy, db);
    
    // Hook development = Ld - anchorage value
    const Lhook = Math.max(Ld - anchorageValue, 0);
    
    // Hook geometry per IS 456 Clause 26.2.2.1
    const bendRadius = db < 25 ? 2 * db : 3 * db;
    let extension: number;
    if (hookType === HookType.HOOK_90) {
      extension = 12 * db;
    } else if (hookType === HookType.HOOK_180) {
      extension = 4 * db;
    } else {
      extension = 8 * db;
    }
    
    return {
      Lhook,
      anchorageValue,
      hookGeometry: { bendRadius, extension }
    };
  }
}

// ============================================================================
// Main Development Length Calculator
// ============================================================================

export class DevelopmentLengthCalculator {
  private aciCalc = new ACI318DevelopmentCalculator();
  private ec2Calc = new EC2DevelopmentCalculator();
  private is456Calc = new IS456DevelopmentCalculator();

  /**
   * Calculate development length for given input parameters
   */
  calculate(input: DevelopmentLengthInput): DevelopmentLengthResult {
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
   * Calculate development length per ACI 318-19
   */
  private calculateACI(input: DevelopmentLengthInput): DevelopmentLengthResult {
    const isMetric = input.barDiameter > 2; // > 2 means metric mm
    
    // Convert to US units if needed
    let fc: number, fy: number, db: number, cover: number, spacing: number;
    
    if (isMetric) {
      fc = input.concrete.fc * 145.038; // MPa to psi
      fy = input.rebar.fy * 145.038;
      db = input.barDiameter / 25.4; // mm to inches
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
    const isLightweight = input.concrete.fc < 4000 && false; // Assume normal weight
    
    let result: DevelopmentLengthResult;
    
    if (input.developmentType === 'tension') {
      const tensionResult = this.aciCalc.calculateTensionDevelopment(
        fc, fy, db, cover, spacing,
        input.isTopBar || false,
        isEpoxyCoated,
        isLightweight
      );
      
      const ld = isMetric ? tensionResult.ld * 25.4 : tensionResult.ld;
      
      result = {
        designCode: input.designCode,
        developmentType: 'tension',
        barSize: input.barSize,
        barDiameter: input.barDiameter,
        straightDevelopment: ld,
        modificationFactors: tensionResult.factors,
        equation: tensionResult.equation
      };
      
      // Calculate hook development if requested
      if (input.hookType) {
        const hookResult = this.aciCalc.calculateHookDevelopment(
          fc, fy, db, input.hookType,
          cover, isEpoxyCoated, isLightweight
        );
        
        result.hookDevelopment = isMetric ? hookResult.ldh * 25.4 : hookResult.ldh;
        result.hookGeometry = {
          bendRadius: isMetric ? hookResult.hookGeometry.bendRadius * 25.4 : hookResult.hookGeometry.bendRadius,
          extension: isMetric ? hookResult.hookGeometry.extension * 25.4 : hookResult.hookGeometry.extension,
          hookType: input.hookType
        };
      }
      
      // Calculate headed bar development if applicable
      if (input.hookType === HookType.HEADED) {
        const headedResult = this.aciCalc.calculateHeadedBarDevelopment(
          fc, fy, db, cover, isEpoxyCoated, isLightweight
        );
        
        result.headedDevelopment = isMetric ? headedResult.ldt * 25.4 : headedResult.ldt;
        result.headedBarRequirements = {
          minHeadArea: isMetric ? headedResult.minHeadArea * 645.16 : headedResult.minHeadArea
        };
      }
      
    } else {
      // Compression development
      const compResult = this.aciCalc.calculateCompressionDevelopment(fc, fy, db);
      const ldc = isMetric ? compResult.ldc * 25.4 : compResult.ldc;
      
      result = {
        designCode: input.designCode,
        developmentType: 'compression',
        barSize: input.barSize,
        barDiameter: input.barDiameter,
        straightDevelopment: ldc,
        equation: compResult.equation
      };
    }
    
    // Add minimum requirements and recommendations
    result.minimumLength = Math.max(
      result.straightDevelopment,
      isMetric ? 300 : 12
    );
    
    result.recommendations = this.generateRecommendations(input, result);
    
    return result;
  }

  /**
   * Calculate development length per Eurocode 2
   */
  private calculateEC2(input: DevelopmentLengthInput): DevelopmentLengthResult {
    const fck = input.concrete.fc; // MPa
    const fyk = input.rebar.fy; // MPa
    const db = input.barDiameter; // mm
    const cover = input.clearCover; // mm
    const spacing = input.barSpacing; // mm
    
    const bondCondition = input.isTopBar ? 'poor' : 'good';
    
    // Calculate design anchorage length
    const anchorageResult = this.ec2Calc.calculateDesignAnchorageLength(
      fck, fyk, db, cover, spacing,
      bondCondition,
      input.hookType ? 'hook' : 'straight',
      false,
      input.AsRequired || 1,
      input.AsProvided || 1
    );
    
    const result: DevelopmentLengthResult = {
      designCode: input.designCode,
      developmentType: input.developmentType,
      barSize: input.barSize,
      barDiameter: db,
      straightDevelopment: anchorageResult.lbd,
      modificationFactors: anchorageResult.factors,
      minimumLength: anchorageResult.lbMin
    };
    
    // Add hook geometry if applicable
    if (input.hookType && input.hookType !== HookType.HEADED) {
      const hookGeom = this.ec2Calc.calculateHookGeometry(db, input.hookType);
      result.hookGeometry = {
        bendRadius: hookGeom.bendRadius,
        extension: hookGeom.extension,
        hookType: input.hookType
      };
      
      // Hook reduces required length
      result.hookDevelopment = anchorageResult.lbd * 0.7;
    }
    
    result.recommendations = this.generateRecommendations(input, result);
    
    return result;
  }

  /**
   * Calculate development length per IS 456
   */
  private calculateIS456(input: DevelopmentLengthInput): DevelopmentLengthResult {
    const fck = input.concrete.fc; // MPa
    const fy = input.rebar.fy; // MPa
    const db = input.barDiameter; // mm
    
    const devResult = this.is456Calc.calculateDevelopmentLength(
      fck, fy, db, 'deformed', input.developmentType
    );
    
    const result: DevelopmentLengthResult = {
      designCode: input.designCode,
      developmentType: input.developmentType,
      barSize: input.barSize,
      barDiameter: db,
      straightDevelopment: devResult.Ld,
      equation: devResult.equation,
      modificationFactors: { tau_bd: devResult.tau_bd }
    };
    
    // Add hook development if applicable
    if (input.hookType && input.hookType !== HookType.HEADED) {
      const hookResult = this.is456Calc.calculateHookDevelopment(
        fck, fy, db, input.hookType
      );
      
      result.hookDevelopment = hookResult.Lhook;
      result.hookGeometry = {
        bendRadius: hookResult.hookGeometry.bendRadius,
        extension: hookResult.hookGeometry.extension,
        hookType: input.hookType
      };
    }
    
    result.minimumLength = Math.max(devResult.Ld, 12 * db);
    result.recommendations = this.generateRecommendations(input, result);
    
    return result;
  }

  /**
   * Generate recommendations based on calculation results
   */
  private generateRecommendations(
    input: DevelopmentLengthInput,
    result: DevelopmentLengthResult
  ): string[] {
    const recommendations: string[] = [];
    
    // Check if hook would reduce length significantly
    if (!input.hookType && result.straightDevelopment > 40 * input.barDiameter) {
      recommendations.push('Consider using standard hooks to reduce development length.');
    }
    
    // Check for large bars
    if (input.barDiameter >= 32 || (input.barDiameter >= 1.27 && input.barDiameter <= 2)) {
      recommendations.push('Large bar size may require increased concrete cover and spacing.');
    }
    
    // Top bar factor
    if (input.isTopBar) {
      recommendations.push('Top bar factor applied - ensure proper concrete consolidation.');
    }
    
    // Epoxy coating
    if (input.coating === BarCoating.EPOXY_COATED) {
      recommendations.push('Epoxy-coated bars require increased development length.');
    }
    
    // Headed bars for congested areas
    if (result.straightDevelopment > 600 && !input.hookType) {
      recommendations.push('Consider headed bars for congested reinforcement areas.');
    }
    
    // Seismic requirements
    if (input.seismicCategory && input.seismicCategory >= SeismicCategory.SDC_D) {
      recommendations.push('Seismic detailing requirements apply - verify hook geometry.');
    }
    
    return recommendations;
  }

  /**
   * Get all bar development lengths for a design code (quick reference table)
   */
  getBarSchedule(
    designCode: ConcreteDesignCode,
    fc: number,
    fy: number,
    cover: number
  ): Array<{
    barSize: string;
    diameter: number;
    tensionLd: number;
    compressionLd: number;
    hookLd: number;
  }> {
    const schedule: Array<{
      barSize: string;
      diameter: number;
      tensionLd: number;
      compressionLd: number;
      hookLd: number;
    }> = [];
    
    // Determine bar sizes based on design code
    const isMetric = designCode !== ConcreteDesignCode.ACI_318_19 && 
                     designCode !== ConcreteDesignCode.ACI_318_14;
    
    const barSizes = isMetric 
      ? Object.values(MetricBarSize).filter(v => typeof v === 'string')
      : Object.values(USBarSize).filter(v => typeof v === 'string');
    
    const barData = isMetric ? METRIC_BAR_DATA : US_BAR_DATA;
    
    for (const size of barSizes) {
      const data = barData[size as keyof typeof barData];
      if (!data) continue;
      
      const input: DevelopmentLengthInput = {
        designCode,
        developmentType: 'tension',
        barSize: size as string,
        barDiameter: data.diameter,
        concrete: { fc, lambda: 1.0 } as ConcreteProperties,
        rebar: { fy, fu: fy * 1.25 } as RebarProperties,
        clearCover: cover,
        barSpacing: 3 * data.diameter,
        isTopBar: false,
        coating: BarCoating.UNCOATED
      };
      
      // Calculate tension development
      const tensionResult = this.calculate(input);
      
      // Calculate compression development
      input.developmentType = 'compression';
      const compResult = this.calculate(input);
      
      // Calculate hook development
      input.developmentType = 'tension';
      input.hookType = HookType.HOOK_90;
      const hookResult = this.calculate(input);
      
      schedule.push({
        barSize: size as string,
        diameter: data.diameter,
        tensionLd: Math.ceil(tensionResult.straightDevelopment),
        compressionLd: Math.ceil(compResult.straightDevelopment),
        hookLd: Math.ceil(hookResult.hookDevelopment || tensionResult.straightDevelopment * 0.7)
      });
    }
    
    return schedule;
  }
}

// Need to import SeismicCategory for recommendations
import { SeismicCategory } from '../types/ReinforcementTypes';

// Export singleton instance
export const developmentLengthCalculator = new DevelopmentLengthCalculator();
