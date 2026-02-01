/**
 * ============================================================================
 * FATIGUE ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive fatigue analysis for steel structures including:
 * - Stress range calculation
 * - Fatigue category classification
 * - Cumulative damage assessment (Miner's Rule)
 * - Remaining life estimation
 * - Connection detail evaluation
 * 
 * Design Codes:
 * - IS 800:2007 Section 13 - Fatigue
 * - AISC 360-22 Appendix 3 - Design for Fatigue
 * - EN 1993-1-9 (Eurocode 3) - Fatigue
 * - BS 7608 - Fatigue Design
 * - AASHTO LRFD Bridge Design - Fatigue
 * - AWS D1.1 - Structural Welding Code
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FatigueLoadSpectrum {
  stressRange: number; // MPa
  numCycles: number;
  meanStress?: number; // MPa (for mean stress correction)
}

export interface FatigueDetail {
  category: string; // e.g., 'A', 'B', 'C', 'D', 'E', 'E\'' or EC categories
  description: string;
  Cf?: number; // Fatigue constant (varies by code)
  deltaC?: number; // Detail category stress range MPa (EC3)
  cutoff?: number; // Fatigue limit/cutoff stress MPa
}

export interface FatigueResult {
  stressRange: number; // Applied stress range MPa
  category: FatigueDetail;
  allowableRange: number; // Allowable stress range MPa
  utilizationRatio: number;
  cumulativeDamage: number; // D (Miner's sum)
  remainingLife: number; // Cycles or years
  status: 'PASS' | 'FAIL' | 'INFINITE_LIFE';
  recommendations: string[];
}

export interface ConnectionDetail {
  type: 'base-metal' | 'bolted' | 'welded';
  description: string;
  // For base metal
  surfaceCondition?: 'rolled' | 'flame-cut' | 'machined';
  // For bolted connections
  boltType?: 'pretensioned' | 'snug-tight';
  holeType?: 'standard' | 'oversized' | 'slotted';
  // For welded connections
  weldType?: 'butt' | 'fillet' | 'partial-penetration' | 'plug';
  weldQuality?: 'full-inspection' | 'partial-inspection' | 'visual';
  weldPosition?: 'flat' | 'horizontal' | 'vertical' | 'overhead';
  stressDirection?: 'parallel' | 'transverse';
  attachmentLength?: number; // mm
  transitionRadius?: number; // mm (for weld terminations)
}

export interface BridgeFatigueParams {
  adtt: number; // Average daily truck traffic
  designLife: number; // years
  spanLength: number; // m
  numLanes: number;
  memberLocation: 'positive-moment' | 'negative-moment' | 'shear' | 'web-gap';
  loadFactor?: number;
}

// ============================================================================
// FATIGUE CATEGORY DATABASES
// ============================================================================

const IS800_CATEGORIES: Record<string, FatigueDetail> = {
  '1': {
    category: '1',
    description: 'Parent metal - no weld or attachment',
    Cf: 4.1e18,
    cutoff: 67
  },
  '2': {
    category: '2', 
    description: 'Built-up sections - continuous fillet welds',
    Cf: 1.3e18,
    cutoff: 53
  },
  '3': {
    category: '3',
    description: 'Transverse butt welds - ground flush',
    Cf: 5.6e17,
    cutoff: 47
  },
  '4': {
    category: '4',
    description: 'Transverse butt welds - as-welded',
    Cf: 2.0e17,
    cutoff: 40
  },
  '5': {
    category: '5',
    description: 'Cruciform joints - load-carrying fillet welds',
    Cf: 7.2e16,
    cutoff: 33
  },
  '6': {
    category: '6',
    description: 'Transverse fillet welds on plate edge',
    Cf: 2.5e16,
    cutoff: 27
  },
  '7': {
    category: '7',
    description: 'Cover plates - weld ends',
    Cf: 8.5e15,
    cutoff: 22
  },
  '8': {
    category: '8',
    description: 'Stud connectors',
    Cf: 2.9e15,
    cutoff: 18
  }
};

const AISC_CATEGORIES: Record<string, FatigueDetail> = {
  'A': {
    category: 'A',
    description: 'Base metal with rolled or cleaned surfaces',
    Cf: 250e8,
    cutoff: 165 / 6.895 // Convert ksi to MPa
  },
  'B': {
    category: 'B',
    description: 'Base metal at butt welds - full penetration, ground',
    Cf: 120e8,
    cutoff: 110 / 6.895
  },
  'B\'': {
    category: 'B\'',
    description: 'Base metal at butt welds - as-welded',
    Cf: 61e8,
    cutoff: 82.7 / 6.895
  },
  'C': {
    category: 'C',
    description: 'Base metal at toe of fillet welds',
    Cf: 44e8,
    cutoff: 69 / 6.895
  },
  'C\'': {
    category: 'C\'',
    description: 'Base metal at short attachments',
    Cf: 44e8,
    cutoff: 82.7 / 6.895
  },
  'D': {
    category: 'D',
    description: 'Base metal at cruciform or T-joint',
    Cf: 22e8,
    cutoff: 48.3 / 6.895
  },
  'E': {
    category: 'E',
    description: 'Base metal at long attachments',
    Cf: 11e8,
    cutoff: 31 / 6.895
  },
  'E\'': {
    category: 'E\'',
    description: 'Base metal at cover plate ends or groove welds',
    Cf: 3.9e8,
    cutoff: 17.9 / 6.895
  },
  'F': {
    category: 'F',
    description: 'Shear stress in fillet weld throat',
    Cf: 150e8,
    cutoff: 55.2 / 6.895
  }
};

const EC3_CATEGORIES: Record<string, FatigueDetail> = {
  '160': { category: '160', description: 'Base metal - no defects', deltaC: 160, cutoff: 117 },
  '140': { category: '140', description: 'Base metal - flame cut', deltaC: 140, cutoff: 103 },
  '125': { category: '125', description: 'Transverse butt weld - full pen, ground', deltaC: 125, cutoff: 92 },
  '112': { category: '112', description: 'Transverse butt weld - full pen', deltaC: 112, cutoff: 82 },
  '100': { category: '100', description: 'Longitudinal weld, attached plate', deltaC: 100, cutoff: 74 },
  '90': { category: '90', description: 'Cruciform joint', deltaC: 90, cutoff: 66 },
  '80': { category: '80', description: 'Transverse fillet weld', deltaC: 80, cutoff: 59 },
  '71': { category: '71', description: 'Non-load carrying fillet weld', deltaC: 71, cutoff: 52 },
  '63': { category: '63', description: 'Partial penetration butt weld', deltaC: 63, cutoff: 46 },
  '56': { category: '56', description: 'Fillet weld on plate edge', deltaC: 56, cutoff: 41 },
  '50': { category: '50', description: 'Stud connector', deltaC: 50, cutoff: 37 },
  '45': { category: '45', description: 'Transverse butt weld backing bar', deltaC: 45, cutoff: 33 },
  '40': { category: '40', description: 'Cover plate end', deltaC: 40, cutoff: 29 },
  '36': { category: '36', description: 'Poor quality weld', deltaC: 36, cutoff: 26 }
};

// ============================================================================
// FATIGUE CATEGORY CLASSIFIER
// ============================================================================

export class FatigueCategoryClassifier {
  /**
   * Classify fatigue detail based on connection description
   */
  static classifyDetail(
    detail: ConnectionDetail,
    code: 'IS800' | 'AISC' | 'EC3' = 'IS800'
  ): FatigueDetail {
    if (detail.type === 'base-metal') {
      return this.classifyBaseMetal(detail, code);
    } else if (detail.type === 'bolted') {
      return this.classifyBolted(detail, code);
    } else {
      return this.classifyWelded(detail, code);
    }
  }

  private static classifyBaseMetal(detail: ConnectionDetail, code: string): FatigueDetail {
    if (code === 'IS800') {
      return IS800_CATEGORIES['1'];
    } else if (code === 'AISC') {
      return AISC_CATEGORIES['A'];
    } else {
      if (detail.surfaceCondition === 'flame-cut') {
        return EC3_CATEGORIES['140'];
      }
      return EC3_CATEGORIES['160'];
    }
  }

  private static classifyBolted(detail: ConnectionDetail, code: string): FatigueDetail {
    // Bolted connections generally have good fatigue performance
    if (code === 'IS800') {
      return detail.boltType === 'pretensioned' ? IS800_CATEGORIES['2'] : IS800_CATEGORIES['3'];
    } else if (code === 'AISC') {
      return detail.boltType === 'pretensioned' ? AISC_CATEGORIES['B'] : AISC_CATEGORIES['C'];
    } else {
      return detail.boltType === 'pretensioned' ? EC3_CATEGORIES['112'] : EC3_CATEGORIES['90'];
    }
  }

  private static classifyWelded(detail: ConnectionDetail, code: string): FatigueDetail {
    const { weldType, stressDirection, attachmentLength, weldQuality } = detail;

    if (code === 'IS800') {
      if (weldType === 'butt' && weldQuality === 'full-inspection') {
        return IS800_CATEGORIES['3'];
      } else if (weldType === 'butt') {
        return IS800_CATEGORIES['4'];
      } else if (weldType === 'fillet' && stressDirection === 'transverse') {
        return attachmentLength && attachmentLength > 100 ? 
               IS800_CATEGORIES['6'] : IS800_CATEGORIES['5'];
      } else {
        return IS800_CATEGORIES['5'];
      }
    } else if (code === 'AISC') {
      if (weldType === 'butt' && weldQuality === 'full-inspection') {
        return AISC_CATEGORIES['B'];
      } else if (weldType === 'butt') {
        return AISC_CATEGORIES['B\''];
      } else if (weldType === 'fillet') {
        if (stressDirection === 'transverse') {
          if (attachmentLength && attachmentLength > 50.8) {
            return attachmentLength > 101.6 ? AISC_CATEGORIES['E'] : AISC_CATEGORIES['D'];
          }
          return AISC_CATEGORIES['C'];
        }
        return AISC_CATEGORIES['C\''];
      } else {
        return AISC_CATEGORIES['D'];
      }
    } else {
      // EC3
      if (weldType === 'butt' && weldQuality === 'full-inspection') {
        return EC3_CATEGORIES['125'];
      } else if (weldType === 'butt') {
        return EC3_CATEGORIES['112'];
      } else if (weldType === 'fillet') {
        if (stressDirection === 'transverse') {
          return attachmentLength && attachmentLength > 100 ? 
                 EC3_CATEGORIES['56'] : EC3_CATEGORIES['80'];
        }
        return EC3_CATEGORIES['71'];
      } else {
        return EC3_CATEGORIES['63'];
      }
    }
  }
}

// ============================================================================
// FATIGUE STRESS CALCULATOR
// ============================================================================

export class FatigueStressCalculator {
  /**
   * Calculate stress range from load spectrum
   */
  static calculateStressRange(params: {
    maxStress: number; // MPa
    minStress: number; // MPa
    stressConcentrationFactor?: number;
    sizeEffect?: number;
    meanStressCorrection?: boolean;
  }): {
    stressRange: number;
    meanStress: number;
    stressRatio: number;
    effectiveRange: number;
  } {
    const { maxStress, minStress, 
            stressConcentrationFactor = 1.0,
            sizeEffect = 1.0,
            meanStressCorrection = false } = params;

    const stressRange = Math.abs(maxStress - minStress);
    const meanStress = (maxStress + minStress) / 2;
    const stressRatio = minStress / maxStress;

    // Apply stress concentration factor
    let effectiveRange = stressRange * stressConcentrationFactor;

    // Apply size effect
    effectiveRange *= sizeEffect;

    // Mean stress correction (Goodman)
    if (meanStressCorrection && meanStress > 0) {
      // Assuming fu = 400 MPa for mild steel
      const fu = 400;
      effectiveRange = stressRange / (1 - meanStress / fu);
    }

    return {
      stressRange,
      meanStress,
      stressRatio,
      effectiveRange
    };
  }

  /**
   * Calculate equivalent constant amplitude stress range
   */
  static calculateEquivalentRange(
    spectrum: FatigueLoadSpectrum[],
    m: number = 3 // S-N curve slope
  ): number {
    const totalCycles = spectrum.reduce((sum, s) => sum + s.numCycles, 0);
    
    const weightedSum = spectrum.reduce((sum, s) => 
      sum + Math.pow(s.stressRange, m) * s.numCycles, 0);

    return Math.pow(weightedSum / totalCycles, 1 / m);
  }

  /**
   * Get stress concentration factor for common details
   */
  static getStressConcentrationFactor(
    detailType: string
  ): number {
    const factors: Record<string, number> = {
      'plain-member': 1.0,
      'hole-in-plate': 2.5,
      'fillet-weld-toe': 1.5,
      'butt-weld-reinforcement': 1.3,
      'cover-plate-end': 2.0,
      'stiffener-end': 1.8,
      'gusset-plate': 1.6,
      'cope-hole': 2.2,
      're-entrant-corner': 3.0
    };

    return factors[detailType] || 1.0;
  }
}

// ============================================================================
// FATIGUE LIFE CALCULATOR
// ============================================================================

export class FatigueLifeCalculator {
  /**
   * Calculate allowable stress range per IS 800:2007
   */
  static allowableRangeIS800(
    category: number,
    numCycles: number,
    gammaM: number = 1.35
  ): number {
    const catData = IS800_CATEGORIES[category.toString()];
    if (!catData) throw new Error(`Invalid IS 800 category: ${category}`);

    const Cf = catData.Cf!;
    const cutoff = catData.cutoff!;

    // Calculate allowable range
    // N = Cf / (γM × Δσ)³
    // Δσ = (Cf / (γM × N))^(1/3)
    const allowable = Math.pow(Cf / (gammaM * numCycles), 1/3);

    // Check against cut-off
    if (numCycles > 5e6) {
      return Math.min(allowable, cutoff / gammaM);
    }

    return allowable;
  }

  /**
   * Calculate allowable stress range per AISC 360
   */
  static allowableRangeAISC(
    category: string,
    numCycles: number
  ): number {
    const catData = AISC_CATEGORIES[category];
    if (!catData) throw new Error(`Invalid AISC category: ${category}`);

    const Cf = catData.Cf!;
    const threshold = catData.cutoff!;

    // FSR = (Cf / N)^(1/3)
    const fsr = Math.pow(Cf / numCycles, 1/3);

    // Check threshold
    if (numCycles > 1e7) {
      return Math.max(fsr, threshold);
    }

    return fsr;
  }

  /**
   * Calculate fatigue resistance per EN 1993-1-9
   */
  static allowableRangeEC3(
    deltaC: number,
    numCycles: number,
    gammaM: number = 1.35
  ): number {
    // Reference: 2 million cycles
    const NRef = 2e6;
    
    // Slope: m = 3 up to 5 million, m = 5 beyond
    let deltaR: number;
    
    if (numCycles <= 5e6) {
      // N / NRef = (ΔσC / ΔσR)^3
      deltaR = deltaC * Math.pow(NRef / numCycles, 1/3);
    } else {
      // Constant amplitude fatigue limit at 5 million
      const deltaD = deltaC * Math.pow(NRef / 5e6, 1/3);
      
      if (numCycles <= 1e8) {
        // m = 5 slope
        deltaR = deltaD * Math.pow(5e6 / numCycles, 1/5);
      } else {
        // Cut-off limit at 100 million
        const deltaCutoff = deltaD * Math.pow(5e6 / 1e8, 1/5);
        deltaR = deltaCutoff;
      }
    }

    return deltaR / gammaM;
  }

  /**
   * Calculate remaining fatigue life
   */
  static calculateRemainingLife(
    currentDamage: number,
    annualDamage: number
  ): {
    remainingYears: number;
    percentUsed: number;
    status: string;
  } {
    const remainingDamage = 1.0 - currentDamage;
    const remainingYears = annualDamage > 0 ? remainingDamage / annualDamage : Infinity;
    const percentUsed = currentDamage * 100;

    let status: string;
    if (remainingYears <= 0) {
      status = 'FAILED - Fatigue life exhausted';
    } else if (remainingYears < 5) {
      status = 'CRITICAL - Less than 5 years remaining';
    } else if (remainingYears < 20) {
      status = 'WARNING - Less than 20 years remaining';
    } else {
      status = 'ADEQUATE - Sufficient fatigue life';
    }

    return { remainingYears, percentUsed, status };
  }
}

// ============================================================================
// CUMULATIVE DAMAGE CALCULATOR (MINER'S RULE)
// ============================================================================

export class CumulativeDamageCalculator {
  /**
   * Calculate cumulative damage using Palmgren-Miner rule
   */
  static calculateMinersDamage(
    spectrum: FatigueLoadSpectrum[],
    category: FatigueDetail,
    code: 'IS800' | 'AISC' | 'EC3' = 'IS800'
  ): {
    totalDamage: number;
    damageByRange: { stressRange: number; damage: number; Ni: number; ni: number }[];
    status: 'PASS' | 'FAIL';
    safetyFactor: number;
  } {
    const damageByRange: { stressRange: number; damage: number; Ni: number; ni: number }[] = [];
    let totalDamage = 0;

    for (const loading of spectrum) {
      const { stressRange, numCycles } = loading;
      
      // Get allowable cycles for this stress range
      let Ni: number;
      
      if (code === 'IS800') {
        const Cf = category.Cf!;
        Ni = Cf / Math.pow(stressRange, 3);
      } else if (code === 'AISC') {
        const Cf = category.Cf!;
        Ni = Cf / Math.pow(stressRange / 6.895, 3); // Convert to ksi internally
      } else {
        const deltaC = category.deltaC!;
        if (stressRange >= deltaC * Math.pow(2e6 / 5e6, 1/3)) {
          Ni = 2e6 * Math.pow(deltaC / stressRange, 3);
        } else {
          const deltaD = deltaC * Math.pow(2e6 / 5e6, 1/3);
          Ni = 5e6 * Math.pow(deltaD / stressRange, 5);
        }
      }

      const damage = numCycles / Ni;
      totalDamage += damage;

      damageByRange.push({
        stressRange,
        damage,
        Ni,
        ni: numCycles
      });
    }

    return {
      totalDamage,
      damageByRange,
      status: totalDamage <= 1.0 ? 'PASS' : 'FAIL',
      safetyFactor: 1.0 / totalDamage
    };
  }

  /**
   * Calculate with modified Miner's rule (more conservative)
   */
  static calculateModifiedMiner(
    spectrum: FatigueLoadSpectrum[],
    category: FatigueDetail,
    code: 'IS800' | 'AISC' | 'EC3' = 'IS800',
    damageLimit: number = 0.5 // More conservative than 1.0
  ): {
    totalDamage: number;
    status: 'PASS' | 'FAIL';
    utilizationRatio: number;
  } {
    const result = this.calculateMinersDamage(spectrum, category, code);
    
    return {
      totalDamage: result.totalDamage,
      status: result.totalDamage <= damageLimit ? 'PASS' : 'FAIL',
      utilizationRatio: result.totalDamage / damageLimit
    };
  }
}

// ============================================================================
// BRIDGE FATIGUE EVALUATOR (AASHTO)
// ============================================================================

export class BridgeFatigueEvaluator {
  /**
   * Evaluate bridge fatigue per AASHTO LRFD
   */
  static evaluateFatigue(
    params: BridgeFatigueParams,
    category: string,
    appliedStressRange: number
  ): {
    designLife: number;
    Ntotal: number;
    Nallowable: number;
    fatigueThreshold: number;
    status: 'PASS' | 'FAIL' | 'INFINITE_LIFE';
    recommendation: string;
  } {
    const { adtt, designLife, spanLength, numLanes, memberLocation, loadFactor = 0.75 } = params;

    // Multiple presence factor
    const mpf = numLanes === 1 ? 1.2 : numLanes === 2 ? 1.0 : 0.85;

    // Cycles per truck passage
    const n = memberLocation === 'positive-moment' ? 
              (spanLength <= 12 ? 2.0 : spanLength <= 24 ? 1.5 : 1.0) :
              memberLocation === 'negative-moment' ?
              (spanLength <= 12 ? 2.0 : 1.5) :
              2.0;

    // Total number of cycles over design life
    const Ntotal = 365 * designLife * adtt * numLanes * n;

    // Get AASHTO detail category
    const catData = AISC_CATEGORIES[category]; // AASHTO uses similar categories
    if (!catData) throw new Error(`Invalid category: ${category}`);

    const A = catData.Cf!;
    const threshold = catData.cutoff!;

    // Fatigue resistance
    // (ΔF)n = (A/N)^(1/3) ≥ (ΔF)TH
    const deltaFn = Math.pow(A / Ntotal, 1/3);
    const fatigueThreshold = threshold;

    // Factored stress range
    const factoredRange = loadFactor * appliedStressRange;

    // Check infinite life
    if (factoredRange <= fatigueThreshold / 2) {
      return {
        designLife,
        Ntotal,
        Nallowable: Infinity,
        fatigueThreshold,
        status: 'INFINITE_LIFE',
        recommendation: 'Stress range below threshold - infinite fatigue life expected'
      };
    }

    // Calculate allowable cycles
    const Nallowable = A / Math.pow(factoredRange, 3);

    let status: 'PASS' | 'FAIL' | 'INFINITE_LIFE';
    let recommendation: string;

    if (Nallowable >= Ntotal) {
      status = 'PASS';
      recommendation = `Adequate fatigue life. Safety factor: ${(Nallowable / Ntotal).toFixed(2)}`;
    } else {
      status = 'FAIL';
      const requiredLife = Nallowable / (365 * adtt * numLanes * n);
      recommendation = `Insufficient fatigue life. Consider upgrading detail category or reducing stress range. ` +
                      `Current life estimate: ${requiredLife.toFixed(0)} years`;
    }

    return {
      designLife,
      Ntotal,
      Nallowable,
      fatigueThreshold,
      status,
      recommendation
    };
  }

  /**
   * Calculate required detail category for given conditions
   */
  static requiredCategory(
    params: BridgeFatigueParams,
    appliedStressRange: number
  ): {
    minimumCategory: string;
    availableCategories: string[];
  } {
    const categories = ['A', 'B', 'B\'', 'C', 'C\'', 'D', 'E', 'E\''];
    const availableCategories: string[] = [];

    for (const cat of categories) {
      const result = this.evaluateFatigue(params, cat, appliedStressRange);
      if (result.status === 'PASS' || result.status === 'INFINITE_LIFE') {
        availableCategories.push(cat);
      }
    }

    return {
      minimumCategory: availableCategories[availableCategories.length - 1] || 'None available',
      availableCategories
    };
  }
}

// ============================================================================
// MAIN FATIGUE ANALYZER
// ============================================================================

export class FatigueAnalyzer {
  private code: 'IS800' | 'AISC' | 'EC3';
  private detail: ConnectionDetail;
  private category: FatigueDetail;

  constructor(detail: ConnectionDetail, code: 'IS800' | 'AISC' | 'EC3' = 'IS800') {
    this.code = code;
    this.detail = detail;
    this.category = FatigueCategoryClassifier.classifyDetail(detail, code);
  }

  /**
   * Perform complete fatigue analysis
   */
  analyze(params: {
    stressRange: number; // MPa
    designCycles: number;
    spectrum?: FatigueLoadSpectrum[];
    annualCycles?: number;
    currentAge?: number; // years
  }): FatigueResult {
    const { stressRange, designCycles, spectrum, annualCycles, currentAge = 0 } = params;
    const recommendations: string[] = [];

    // Calculate allowable stress range
    let allowableRange: number;
    if (this.code === 'IS800') {
      const catNum = parseInt(this.category.category);
      allowableRange = FatigueLifeCalculator.allowableRangeIS800(catNum, designCycles);
    } else if (this.code === 'AISC') {
      allowableRange = FatigueLifeCalculator.allowableRangeAISC(this.category.category, designCycles);
    } else {
      allowableRange = FatigueLifeCalculator.allowableRangeEC3(
        this.category.deltaC!, designCycles
      );
    }

    // Calculate utilization
    const utilizationRatio = stressRange / allowableRange;

    // Cumulative damage if spectrum provided
    let cumulativeDamage = 0;
    if (spectrum && spectrum.length > 0) {
      const damageResult = CumulativeDamageCalculator.calculateMinersDamage(
        spectrum, this.category, this.code
      );
      cumulativeDamage = damageResult.totalDamage;
    } else {
      // Simple damage calculation
      let Nf: number;
      if (this.code === 'IS800') {
        Nf = this.category.Cf! / Math.pow(stressRange, 3);
      } else if (this.code === 'AISC') {
        Nf = this.category.Cf! / Math.pow(stressRange / 6.895, 3);
      } else {
        Nf = 2e6 * Math.pow(this.category.deltaC! / stressRange, 3);
      }
      cumulativeDamage = designCycles / Nf;
    }

    // Calculate remaining life
    let remainingLife: number;
    if (annualCycles) {
      const usedCycles = annualCycles * currentAge;
      const remainingCycles = (1 - cumulativeDamage) * designCycles - usedCycles;
      remainingLife = remainingCycles / annualCycles;
    } else {
      remainingLife = (1 - cumulativeDamage) * designCycles;
    }

    // Determine status
    let status: FatigueResult['status'];
    if (stressRange <= (this.category.cutoff || this.category.deltaC! * 0.4)) {
      status = 'INFINITE_LIFE';
      recommendations.push('Stress range below endurance limit - infinite life expected');
    } else if (utilizationRatio <= 1.0 && cumulativeDamage <= 1.0) {
      status = 'PASS';
    } else {
      status = 'FAIL';
      recommendations.push('Consider upgrading connection detail or reducing stress range');
    }

    // Add recommendations
    if (utilizationRatio > 0.8 && utilizationRatio <= 1.0) {
      recommendations.push('Utilization approaching limit - monitor for crack initiation');
    }
    
    if (this.detail.type === 'welded' && this.detail.weldQuality !== 'full-inspection') {
      recommendations.push('Consider post-weld treatment (grinding, peening) to improve fatigue life');
    }

    if (remainingLife < 20 && annualCycles) {
      recommendations.push('Schedule inspection and potential repair within 10 years');
    }

    return {
      stressRange,
      category: this.category,
      allowableRange,
      utilizationRatio,
      cumulativeDamage,
      remainingLife,
      status,
      recommendations
    };
  }

  /**
   * Get S-N curve data points
   */
  getSNCurve(numPoints: number = 20): { N: number; deltaS: number }[] {
    const curve: { N: number; deltaS: number }[] = [];
    
    for (let i = 0; i < numPoints; i++) {
      const N = Math.pow(10, 4 + i * 0.4); // From 10^4 to 10^12
      let deltaS: number;

      if (this.code === 'IS800') {
        const Cf = this.category.Cf!;
        deltaS = Math.pow(Cf / N, 1/3);
      } else if (this.code === 'AISC') {
        const Cf = this.category.Cf!;
        deltaS = Math.pow(Cf / N, 1/3) * 6.895; // Convert back to MPa
      } else {
        const deltaC = this.category.deltaC!;
        if (N <= 5e6) {
          deltaS = deltaC * Math.pow(2e6 / N, 1/3);
        } else {
          const deltaD = deltaC * Math.pow(2e6 / 5e6, 1/3);
          deltaS = deltaD * Math.pow(5e6 / N, 1/5);
        }
      }

      curve.push({ N, deltaS });
    }

    return curve;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  FatigueCategoryClassifier,
  FatigueStressCalculator,
  FatigueLifeCalculator,
  CumulativeDamageCalculator,
  BridgeFatigueEvaluator,
  FatigueAnalyzer
};
