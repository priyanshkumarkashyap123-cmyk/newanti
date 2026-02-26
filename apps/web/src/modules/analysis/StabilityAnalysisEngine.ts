/**
 * ============================================================================
 * STRUCTURAL STABILITY ANALYSIS ENGINE
 * ============================================================================
 * 
 * Advanced stability and second-order analysis capabilities for structural
 * engineering applications.
 * 
 * Features:
 * - Global buckling analysis (elastic critical load factor)
 * - P-Delta effects (geometric nonlinearity)
 * - P-delta effects (member instability)
 * - Imperfection modeling (notional loads, bow imperfections)
 * - Sway vs non-sway classification
 * - Effective length factor (K-factor) calculation
 * - Frame stability indices (αcr)
 * 
 * Codes:
 * - IS 800:2007 - Section 4.4 (Stability requirements)
 * - AISC 360 - Chapter C (Stability Analysis and Design)
 * - EN 1993-1-1 - Section 5 (Structural analysis)
 * - AS 4100 - Section 4 (Methods of structural analysis)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FrameGeometry {
  nodes: {
    id: string;
    x: number;
    y: number;
    z?: number;
    support?: 'fixed' | 'pinned' | 'roller' | 'free';
  }[];
  members: {
    id: string;
    startNode: string;
    endNode: string;
    E: number; // MPa
    I: number; // mm^4
    A: number; // mm^2
    L?: number; // mm (calculated if not provided)
  }[];
}

export interface FrameLoads {
  gravity: {
    nodeId?: string;
    memberId?: string;
    type: 'point' | 'distributed';
    magnitude: number; // kN or kN/m
    direction: 'X' | 'Y' | 'Z';
  }[];
  lateral?: {
    nodeId: string;
    magnitude: number;
    direction: 'X' | 'Y';
  }[];
}

export interface StabilitySettings {
  includeGeometricNonlinearity: boolean;
  imperfectionMethod: 'notional-load' | 'initial-bow' | 'equivalent-force' | 'none';
  notionalLoadFactor?: number; // Typically 0.002-0.005
  bowImperfection?: number; // L/500 typical
  analysisMethod: 'elastic' | 'inelastic' | 'advanced';
  maxIterations?: number;
  convergenceTolerance?: number;
}

// ============================================================================
// EFFECTIVE LENGTH FACTOR CALCULATOR
// ============================================================================

export class EffectiveLengthCalculator {
  /**
   * Calculate K-factor using alignment charts method
   */
  static alignmentChart(
    GA: number, // G value at end A (sum of (I/L)column / sum of (I/L)beam)
    GB: number, // G value at end B
    braced: boolean // true for braced (sidesway prevented), false for unbraced
  ): {
    K: number;
    method: string;
    formula: string;
  } {
    // For pinned end, G = infinity (use large value)
    // For fixed end, G = 0 (use small value but not zero for calculation)
    const GA_calc = Math.max(0.01, Math.min(GA, 100));
    const GB_calc = Math.max(0.01, Math.min(GB, 100));

    let K: number;
    let formula: string;

    if (braced) {
      // Braced frame (sidesway inhibited) - use lower bound
      // Approximate formula: K = sqrt((GA * GB + GA + GB + 4) / (GA + GB + 4))
      // But constrained between 0.5 and 1.0
      K = Math.sqrt((GA_calc * GB_calc / 4 + (GA_calc + GB_calc) / 2 + 1) / 
                    ((GA_calc + GB_calc) / 2 + 2));
      K = Math.max(0.5, Math.min(K, 1.0));
      formula = 'K = √[(GA·GB/4 + (GA+GB)/2 + 1) / ((GA+GB)/2 + 2)]';
    } else {
      // Unbraced frame (sidesway uninhibited)
      // Approximate formula
      if (GA_calc === 0 && GB_calc === 0) {
        K = 1.0; // Both ends fixed
      } else if (GA_calc === 0 || GB_calc === 0) {
        K = 2.0; // One end fixed, one pinned/free
      } else {
        // General case
        const product = GA_calc * GB_calc;
        const sum = GA_calc + GB_calc;
        K = Math.sqrt((1.6 * product + 4 * sum + 7.5) / (sum + 7.5));
        K = Math.max(1.0, K);
      }
      formula = 'K = √[(1.6·GA·GB + 4(GA+GB) + 7.5) / (GA+GB + 7.5)]';
    }

    return {
      K,
      method: braced ? 'Alignment Chart - Braced' : 'Alignment Chart - Unbraced',
      formula
    };
  }

  /**
   * Calculate K-factor for standard cases
   */
  static standardCases(
    endConditionA: 'fixed' | 'pinned' | 'free',
    endConditionB: 'fixed' | 'pinned' | 'free'
  ): {
    K_theoretical: number;
    K_recommended: number;
    description: string;
  } {
    const conditions = `${endConditionA}-${endConditionB}`;

    const cases: Record<string, { Kt: number; Kr: number; desc: string }> = {
      'fixed-fixed': { Kt: 0.5, Kr: 0.65, desc: 'Both ends rotation and translation fixed' },
      'fixed-pinned': { Kt: 0.7, Kr: 0.80, desc: 'One end fixed, one end pinned (no translation)' },
      'pinned-fixed': { Kt: 0.7, Kr: 0.80, desc: 'One end pinned, one end fixed (no translation)' },
      'pinned-pinned': { Kt: 1.0, Kr: 1.00, desc: 'Both ends pinned (no translation)' },
      'fixed-free': { Kt: 2.0, Kr: 2.10, desc: 'One end fixed, one end free (cantilever)' },
      'free-fixed': { Kt: 2.0, Kr: 2.10, desc: 'Cantilever (fixed at base, free at top)' },
      'pinned-free': { Kt: Infinity, Kr: Infinity, desc: 'Unstable - mechanism' },
      'free-pinned': { Kt: Infinity, Kr: Infinity, desc: 'Unstable - mechanism' },
      'free-free': { Kt: Infinity, Kr: Infinity, desc: 'Unstable - mechanism' }
    };

    const result = cases[conditions] || cases['pinned-pinned'];

    return {
      K_theoretical: result.Kt,
      K_recommended: result.Kr,
      description: result.desc
    };
  }

  /**
   * Calculate effective length for columns in moment frames
   * per AISC Commentary on Chapter C
   */
  static momentFrame(
    columnI: number,
    columnL: number,
    beamI_above: number[],
    beamL_above: number[],
    beamI_below: number[],
    beamL_below: number[],
    farEndCondition: ('fixed' | 'pinned' | 'continuous')[],
    braced: boolean
  ): {
    G_top: number;
    G_bottom: number;
    K: number;
  } {
    // Calculate stiffness contribution from column
    const columnStiffness = columnI / columnL;

    // Calculate beam stiffness at top
    let beamStiffnessTop = 0;
    for (let i = 0; i < beamI_above.length; i++) {
      let factor = 1.0;
      if (farEndCondition[i] === 'pinned') factor = 1.5;
      else if (farEndCondition[i] === 'fixed') factor = 2.0;
      beamStiffnessTop += factor * beamI_above[i] / beamL_above[i];
    }

    // Calculate beam stiffness at bottom
    let beamStiffnessBottom = 0;
    for (let i = 0; i < beamI_below.length; i++) {
      let factor = 1.0;
      const condIndex = beamI_above.length + i;
      if (farEndCondition[condIndex] === 'pinned') factor = 1.5;
      else if (farEndCondition[condIndex] === 'fixed') factor = 2.0;
      beamStiffnessBottom += factor * beamI_below[i] / beamL_below[i];
    }

    // G values
    const G_top = beamStiffnessTop > 0 ? columnStiffness / beamStiffnessTop : 10;
    const G_bottom = beamStiffnessBottom > 0 ? columnStiffness / beamStiffnessBottom : 10;

    // K factor
    const result = this.alignmentChart(G_top, G_bottom, braced);

    return {
      G_top,
      G_bottom,
      K: result.K
    };
  }
}

// ============================================================================
// FRAME STABILITY ANALYZER
// ============================================================================

export class FrameStabilityAnalyzer {
  /**
   * Calculate elastic critical load factor (αcr)
   * per EN 1993-1-1 Section 5.2.1
   */
  static calculateAlphaCr(
    H_Ed: number, // Total horizontal reaction at bottom story (kN)
    V_Ed: number, // Total vertical load (kN)
    delta_H_Ed: number, // Horizontal displacement at top due to H_Ed (mm)
    h: number // Story height (mm)
  ): {
    alphaCr: number;
    classification: 'non-sway' | 'sway-sensitive' | 'highly-sway';
    analysisRequired: string;
  } {
    // αcr = (H_Ed * h) / (V_Ed * δH_Ed)
    const alphaCr = (H_Ed * h) / (V_Ed * delta_H_Ed);

    let classification: 'non-sway' | 'sway-sensitive' | 'highly-sway';
    let analysisRequired: string;

    if (alphaCr >= 10) {
      classification = 'non-sway';
      analysisRequired = 'First-order elastic analysis sufficient (ignore sway effects)';
    } else if (alphaCr >= 3) {
      classification = 'sway-sensitive';
      analysisRequired = 'Second-order analysis OR first-order with amplification factor 1/(1-1/αcr)';
    } else {
      classification = 'highly-sway';
      analysisRequired = 'Full second-order analysis required. Consider global imperfections.';
    }

    return { alphaCr, classification, analysisRequired };
  }

  /**
   * Calculate stability index per IS 800:2007
   */
  static is800StabilityIndex(
    P_total: number, // Total vertical load on story (kN)
    H_story: number, // Story height (mm)
    delta_story: number, // Story drift (mm)
    V_story: number // Story shear (kN)
  ): {
    Q: number;
    classification: 'non-sway' | 'sway';
    note: string;
  } {
    // Q = P * Δ / (V * H)
    const Q = (P_total * delta_story) / (V_story * H_story);

    const classification = Q <= 0.04 ? 'non-sway' : 'sway';
    const note = Q <= 0.04 
      ? 'Frame is classified as non-sway (Q ≤ 0.04)' 
      : 'Frame is classified as sway (Q > 0.04). P-Delta effects must be considered.';

    return { Q, classification, note };
  }

  /**
   * Calculate B1 amplification factor (member P-δ effect) per AISC
   */
  static calculateB1(
    Cm: number, // Equivalent moment factor
    Pr: number, // Required axial strength (kN)
    Pe1: number // Elastic critical buckling strength (kN)
  ): {
    B1: number;
    Pe1_used: number;
    formula: string;
  } {
    // B1 = Cm / (1 - Pr/Pe1) ≥ 1.0
    const B1_calc = Cm / (1 - Pr / Pe1);
    const B1 = Math.max(1.0, B1_calc);

    return {
      B1,
      Pe1_used: Pe1,
      formula: 'B1 = Cm / (1 - Pr/Pe1) ≥ 1.0'
    };
  }

  /**
   * Calculate B2 amplification factor (story P-Δ effect) per AISC
   */
  static calculateB2_RM(
    RM: number, // 0.85 for moment frames, 1.0 for braced frames
    P_story: number, // Total vertical load on story
    Pe_story: number // Elastic critical buckling strength of story
  ): {
    B2: number;
    formula: string;
  } {
    // B2 = 1 / (1 - RM * P_story / Pe_story) ≥ 1.0
    const B2_calc = 1 / (1 - RM * P_story / Pe_story);
    const B2 = Math.max(1.0, B2_calc);

    return {
      B2,
      formula: 'B2 = 1 / (1 - RM·ΣP/ΣPe) ≥ 1.0'
    };
  }

  /**
   * Calculate B2 using drift-based method
   */
  static calculateB2_Drift(
    delta_H: number, // First-order drift due to lateral loads (mm)
    L: number, // Story height (mm)
    P_story: number, // Total vertical load (kN)
    H: number // Total lateral load (kN)
  ): {
    B2: number;
    theta: number; // Stability coefficient
    formula: string;
  } {
    // Stability coefficient θ = P * Δ / (H * L)
    const theta = (P_story * delta_H) / (H * L);

    // B2 = 1 / (1 - θ)
    const B2 = 1 / (1 - theta);

    return {
      B2: Math.max(1.0, B2),
      theta,
      formula: 'B2 = 1/(1-θ) where θ = PΔ/(HL)'
    };
  }

  /**
   * Calculate Cm factor (equivalent uniform moment factor)
   */
  static calculateCm(
    M1: number, // Smaller end moment
    M2: number, // Larger end moment
    hasTransverseLoad: boolean,
    memberUnbraced: boolean
  ): {
    Cm: number;
    formula: string;
    notes: string;
  } {
    if (hasTransverseLoad) {
      // Member subject to transverse loading
      if (memberUnbraced) {
        return {
          Cm: 1.0,
          formula: 'Cm = 1.0',
          notes: 'Transverse loading with unbraced ends'
        };
      }
      return {
        Cm: 0.85,
        formula: 'Cm = 0.85',
        notes: 'Transverse loading with braced ends (conservative)'
      };
    }

    // No transverse loading - use end moments
    const ratio = M1 / M2;
    const Cm = Math.max(0.4, 0.6 - 0.4 * ratio);

    return {
      Cm,
      formula: 'Cm = 0.6 - 0.4(M1/M2) ≥ 0.4',
      notes: `M1/M2 = ${ratio.toFixed(2)}, single curvature if positive, double if negative`
    };
  }
}

// ============================================================================
// IMPERFECTION MODELING
// ============================================================================

export class ImperfectionModeler {
  /**
   * Calculate notional loads per AISC
   */
  static notionalLoads(
    storyLoads: { level: number; gravity: number }[], // kN per story
    notionalFactor: number = 0.002 // Ni = 0.002 * Yi
  ): {
    level: number;
    notionalLoad: number; // kN
  }[] {
    return storyLoads.map(story => ({
      level: story.level,
      notionalLoad: notionalFactor * story.gravity
    }));
  }

  /**
   * Calculate equivalent horizontal force for member initial bow
   * per EN 1993-1-1
   */
  static memberBowImperfection(
    memberLength: number, // mm
    bowRatio: number = 1/500, // e0 = L/500 for steel
    N_Ed: number // Axial force in member (kN)
  ): {
    maxInitialBow: number; // mm
    equivalentLoad: number; // kN/m (UDL to simulate bow effect)
  } {
    const e0 = memberLength * bowRatio;
    
    // Equivalent UDL = 8 * N * e0 / L²
    const equivalentLoad = 8 * N_Ed * e0 / Math.pow(memberLength, 2) * 1000; // kN/m

    return {
      maxInitialBow: e0,
      equivalentLoad
    };
  }

  /**
   * Calculate global frame imperfection per EN 1993-1-1
   */
  static globalImperfection(
    frameHeight: number, // Total height (m)
    numColumns: number, // Number of columns in the plane
    baseAngle: number = 1/200 // φ0 = 1/200
  ): {
    phi: number; // Sway imperfection angle
    phi_h: number; // Height reduction factor
    phi_m: number; // Column number reduction factor
    horizontalDisplacement: number; // mm at top
  } {
    // Height reduction factor
    const alpha_h = Math.min(1.0, 2 / Math.sqrt(frameHeight));

    // Number of columns reduction factor
    const m = numColumns;
    const alpha_m = Math.sqrt(0.5 * (1 + 1/m));

    // Final sway angle
    const phi = baseAngle * alpha_h * alpha_m;

    // Horizontal displacement at top
    const displacement = phi * frameHeight * 1000;

    return {
      phi,
      phi_h: alpha_h,
      phi_m: alpha_m,
      horizontalDisplacement: displacement
    };
  }

  /**
   * IS 800 imperfection requirements
   */
  static is800Imperfection(
    frameType: 'braced' | 'unbraced',
    memberType: 'column' | 'beam-column',
    memberLength: number, // mm
    sectionClass: 1 | 2 | 3 | 4
  ): {
    globalImperfection: number; // Notional lateral force as fraction of vertical load
    localImperfection: number; // Initial bow as fraction of length
    notes: string[];
  } {
    const notes: string[] = [];

    // Notional horizontal force
    let globalImperfection: number;
    if (frameType === 'braced') {
      globalImperfection = 0; // Braced frames - no notional load
      notes.push('Braced frame: No notional loads required');
    } else {
      globalImperfection = 0.002; // 0.2% of vertical load
      notes.push('Sway frame: Apply 0.2% of total vertical load as lateral force');
    }

    // Local bow imperfection
    let localImperfection: number;
    if (sectionClass <= 2) {
      localImperfection = 1/500;
      notes.push('Section Class 1 or 2: e0 = L/500');
    } else if (sectionClass === 3) {
      localImperfection = 1/500;
      notes.push('Section Class 3: e0 = L/500');
    } else {
      localImperfection = 1/300;
      notes.push('Section Class 4: e0 = L/300 (increased for local buckling)');
    }

    if (memberType === 'beam-column') {
      notes.push('For beam-columns, combine axial and bending imperfection effects');
    }

    return {
      globalImperfection,
      localImperfection,
      notes
    };
  }
}

// ============================================================================
// SECOND-ORDER ANALYSIS (SIMPLIFIED)
// ============================================================================

export class SecondOrderAnalysis {
  /**
   * Amplified first-order analysis method
   */
  static amplifiedFirstOrder(
    firstOrderMoments: {
      memberId: string;
      Mnt: number; // No-translation moment
      Mlt: number; // Translation moment
    }[],
    B1_values: Map<string, number>,
    B2: number
  ): {
    memberId: string;
    Mr: number; // Required second-order moment
    amplification: number;
  }[] {
    return firstOrderMoments.map(m => {
      const B1 = B1_values.get(m.memberId) || 1.0;
      const Mr = B1 * m.Mnt + B2 * m.Mlt;
      const originalTotal = Math.abs(m.Mnt) + Math.abs(m.Mlt);
      const amplification = originalTotal > 0 ? Mr / originalTotal : 1.0;

      return {
        memberId: m.memberId,
        Mr,
        amplification
      };
    });
  }

  /**
   * Iterative P-Delta analysis (geometric stiffness method)
   */
  static iterativePDelta(
    storyData: {
      level: number;
      height: number;
      verticalLoad: number;
      lateralLoad: number;
      stiffness: number; // Story lateral stiffness (kN/mm)
    }[],
    maxIterations: number = 20,
    tolerance: number = 0.001
  ): {
    converged: boolean;
    iterations: number;
    finalDisplacements: { level: number; displacement: number }[];
    amplificationFactors: { level: number; factor: number }[];
  } {
    const n = storyData.length;
    let displacements = new Array(n).fill(0);
    let converged = false;
    let iterations = 0;

    while (iterations < maxIterations && !converged) {
      const newDisplacements = new Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        const story = storyData[i];
        
        // P-Delta contribution from above stories
        let pDeltaForce = 0;
        for (let j = i; j < n; j++) {
          const relativeDisp = i === 0 ? displacements[j] : displacements[j] - displacements[i-1];
          pDeltaForce += storyData[j].verticalLoad * relativeDisp / story.height;
        }

        // Total effective lateral force
        const effectiveForce = story.lateralLoad + pDeltaForce / 1000; // Convert to kN

        // New displacement
        newDisplacements[i] = (i === 0 ? 0 : newDisplacements[i-1]) + effectiveForce / story.stiffness;
      }

      // Check convergence
      let maxChange = 0;
      for (let i = 0; i < n; i++) {
        const change = Math.abs(newDisplacements[i] - displacements[i]) / 
                       (Math.abs(newDisplacements[i]) + 0.001);
        maxChange = Math.max(maxChange, change);
      }

      converged = maxChange < tolerance;
      displacements = newDisplacements;
      iterations++;
    }

    // Calculate amplification factors
    const firstOrderDisp: number[] = [];
    for (let i = 0; i < n; i++) {
      let totalForce = 0;
      for (let j = i; j < n; j++) {
        totalForce += storyData[j].lateralLoad;
      }
      const prevDisp = i === 0 ? 0 : firstOrderDisp[i - 1];
      firstOrderDisp.push(prevDisp + totalForce / storyData[i].stiffness);
    }

    const amplificationFactors = displacements.map((d, i) => ({
      level: storyData[i].level,
      factor: firstOrderDisp[i] > 0 ? d / firstOrderDisp[i] : 1.0
    }));

    return {
      converged,
      iterations,
      finalDisplacements: displacements.map((d, i) => ({ 
        level: storyData[i].level, 
        displacement: d 
      })),
      amplificationFactors
    };
  }
}

// ============================================================================
// BUCKLING ANALYSIS
// ============================================================================

export class BucklingAnalyzer {
  /**
   * Calculate elastic critical buckling load for column
   */
  static eulerBucklingLoad(
    E: number, // MPa
    I: number, // mm^4
    L: number, // mm
    K: number // Effective length factor
  ): {
    Pe: number; // kN
    formula: string;
  } {
    const Le = K * L;
    const Pe = Math.PI * Math.PI * E * I / (Le * Le) / 1000; // Convert to kN

    return {
      Pe,
      formula: 'Pe = π²EI/(KL)²'
    };
  }

  /**
   * Calculate inelastic buckling load (tangent modulus theory)
   */
  static inelasticBucklingLoad(
    E: number,
    I: number,
    A: number,
    L: number,
    K: number,
    fy: number // Yield strength (MPa)
  ): {
    Pcr: number;
    lambda: number; // Slenderness parameter
    reductionFactor: number;
    bucklingMode: 'elastic' | 'inelastic' | 'yield';
  } {
    const Le = K * L;
    const r = Math.sqrt(I / A);
    const lambda = (Le / r) / (Math.PI * Math.sqrt(E / fy)); // Non-dimensional slenderness

    let Pcr: number;
    let reductionFactor: number;
    let bucklingMode: 'elastic' | 'inelastic' | 'yield';

    if (lambda <= 0.2) {
      // Yield (stocky)
      Pcr = fy * A / 1000;
      reductionFactor = 1.0;
      bucklingMode = 'yield';
    } else if (lambda <= 1.5) {
      // Inelastic
      reductionFactor = Math.pow(0.658, lambda * lambda);
      Pcr = reductionFactor * fy * A / 1000;
      bucklingMode = 'inelastic';
    } else {
      // Elastic
      reductionFactor = 0.877 / (lambda * lambda);
      Pcr = reductionFactor * fy * A / 1000;
      bucklingMode = 'elastic';
    }

    return {
      Pcr,
      lambda,
      reductionFactor,
      bucklingMode
    };
  }

  /**
   * Estimate frame critical load factor using story buckling
   */
  static frameElasticCriticalLoadFactor(
    stories: {
      P: number; // Total gravity load on story (kN)
      H: number; // Story shear (kN)
      delta: number; // Story drift from H (mm)
      h: number; // Story height (mm)
    }[]
  ): {
    alphaCr: number;
    criticalStory: number;
    storyFactors: { story: number; alpha: number }[];
  } {
    const storyFactors = stories.map((story, i) => {
      // αcr,i = (H_i * h_i) / (P_i * δ_i)
      const alpha = (story.H * story.h) / (story.P * story.delta);
      return { story: i + 1, alpha };
    });

    // Overall αcr is minimum of all stories
    const minFactor = storyFactors.reduce((min, sf) => 
      sf.alpha < min.alpha ? sf : min, storyFactors[0]);

    return {
      alphaCr: minFactor.alpha,
      criticalStory: minFactor.story,
      storyFactors
    };
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  EffectiveLengthCalculator,
  FrameStabilityAnalyzer,
  ImperfectionModeler,
  SecondOrderAnalysis,
  BucklingAnalyzer
};
