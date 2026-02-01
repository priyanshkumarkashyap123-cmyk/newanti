/**
 * ============================================================================
 * CONSTRUCTION SEQUENCE ANALYZER
 * ============================================================================
 * 
 * Analysis of structures during construction phases accounting for
 * staged loading, time-dependent effects, and temporary conditions.
 * 
 * Features:
 * - Multi-stage construction analysis
 * - Creep and shrinkage effects
 * - Temporary shoring analysis
 * - Load redistribution during construction
 * - Age-dependent material properties
 * - Jack loading/prestress transfer
 * 
 * Applications:
 * - High-rise buildings
 * - Post-tensioned structures
 * - Segmental bridges
 * - Precast construction
 * - Shored/reshored slabs
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConstructionStage {
  id: string;
  name: string;
  daysFromStart: number;
  duration: number; // days
  activities: StageActivity[];
  addedElements: string[];
  removedElements: string[]; // Temporary supports
  appliedLoads: StageLoad[];
  materialAge?: number; // days (for concrete)
}

export interface StageActivity {
  type: 'pour-concrete' | 'tension-pt' | 'remove-shores' | 'apply-load' | 'install-element' | 'cure';
  elementIds: string[];
  details?: Record<string, any>;
}

export interface StageLoad {
  type: 'self-weight' | 'construction-load' | 'permanent' | 'prestress' | 'temperature';
  magnitude: number;
  elementId?: string;
  location?: { x: number; y: number; z: number };
}

export interface ConcreteTimeProperties {
  fck_28: number; // 28-day characteristic strength
  Ec_28: number; // 28-day elastic modulus
  cement: 'N' | 'R' | 'SL'; // Normal, Rapid, Slow
  humidity: number; // Relative humidity (%)
  notionalSize: number; // h0 = 2*Ac/u (mm)
}

export interface CreepShrinkageResult {
  age: number;
  creepCoefficient: number;
  shrinkageStrain: number;
  effectiveModulus: number;
  ageAdjustedModulus: number;
}

export interface StageAnalysisResult {
  stageId: string;
  time: number;
  displacements: Map<string, number[]>;
  memberForces: Map<string, number[]>;
  stresses: Map<string, { top: number; bottom: number }>;
  creepEffects?: Map<string, number>;
  shrinkageEffects?: Map<string, number>;
}

// ============================================================================
// TIME-DEPENDENT MATERIAL PROPERTIES (EN 1992-1-1)
// ============================================================================

export class ConcreteAgeProperties {
  private props: ConcreteTimeProperties;

  constructor(properties: ConcreteTimeProperties) {
    this.props = properties;
  }

  /**
   * Compressive strength at age t days
   */
  strengthAtAge(t: number): number {
    const s = this.getCementCoefficient();
    const betaCC = Math.exp(s * (1 - Math.sqrt(28 / t)));
    return betaCC * this.props.fck_28;
  }

  /**
   * Elastic modulus at age t days
   */
  modulusAtAge(t: number): number {
    const fck_t = this.strengthAtAge(t);
    const betaE = Math.pow(fck_t / this.props.fck_28, 0.3);
    return betaE * this.props.Ec_28;
  }

  /**
   * Mean compressive strength
   */
  private getFcm(): number {
    return this.props.fck_28 + 8;
  }

  /**
   * Cement coefficient for strength development
   */
  private getCementCoefficient(): number {
    switch (this.props.cement) {
      case 'SL': return 0.38;
      case 'N': return 0.25;
      case 'R': return 0.20;
      default: return 0.25;
    }
  }

  /**
   * Calculate creep coefficient φ(t, t0) per EN 1992-1-1
   */
  creepCoefficient(t: number, t0: number): number {
    const fcm = this.getFcm();
    const h0 = this.props.notionalSize;
    const RH = this.props.humidity;

    // Notional creep coefficient φ0
    const alpha1 = Math.pow(35 / fcm, 0.7);
    const alpha2 = Math.pow(35 / fcm, 0.2);
    const alpha3 = Math.pow(35 / fcm, 0.5);

    // RH factor
    const phi_RH = fcm <= 35
      ? 1 + (1 - RH / 100) / (0.1 * Math.pow(h0, 1/3))
      : (1 + (1 - RH / 100) / (0.1 * Math.pow(h0, 1/3)) * alpha1) * alpha2;

    // Strength factor
    const beta_fcm = 16.8 / Math.sqrt(fcm);

    // Loading age factor
    const cementFactor = this.props.cement === 'SL' ? -1 :
                         this.props.cement === 'R' ? 1 : 0;
    const t0_adj = t0 * Math.pow(9 / (2 + Math.pow(t0, 1.2)) + 1, cementFactor);
    const beta_t0 = 1 / (0.1 + Math.pow(t0_adj, 0.2));

    // Notional creep coefficient
    const phi_0 = phi_RH * beta_fcm * beta_t0;

    // Development of creep with time
    const beta_H = Math.min(1500, 1.5 * (1 + Math.pow(0.012 * RH, 18)) * h0 + 250 * alpha3);
    const beta_c = Math.pow((t - t0) / (beta_H + t - t0), 0.3);

    return phi_0 * beta_c;
  }

  /**
   * Calculate shrinkage strain εcs(t) per EN 1992-1-1
   */
  shrinkageStrain(t: number, ts: number = 7): {
    total: number;
    drying: number;
    autogenous: number;
  } {
    const fcm = this.getFcm();
    const h0 = this.props.notionalSize;
    const RH = this.props.humidity;

    // Drying shrinkage
    const beta_RH = 1.55 * (1 - Math.pow(RH / 100, 3));
    const eps_cd0 = 0.85 * ((220 + 110 * this.getDryingShrinkageAlpha()) * 
                    Math.exp(-0.04 * Math.pow(fcm, 0.5))) * 1e-6 * beta_RH;
    
    const k_h = h0 <= 100 ? 1.0 :
                h0 <= 200 ? 0.85 :
                h0 <= 300 ? 0.75 :
                h0 <= 500 ? 0.70 : 0.70;
    
    const beta_ds = (t - ts) / ((t - ts) + 0.04 * Math.pow(h0, 3));
    const eps_cd = beta_ds * k_h * eps_cd0;

    // Autogenous shrinkage
    const eps_ca_inf = 2.5 * (this.props.fck_28 - 10) * 1e-6;
    const beta_as = 1 - Math.exp(-0.2 * Math.sqrt(t));
    const eps_ca = beta_as * eps_ca_inf;

    return {
      total: eps_cd + eps_ca,
      drying: eps_cd,
      autogenous: eps_ca
    };
  }

  private getDryingShrinkageAlpha(): number {
    switch (this.props.cement) {
      case 'SL': return 3;
      case 'N': return 4;
      case 'R': return 6;
      default: return 4;
    }
  }

  /**
   * Effective modulus method for creep
   */
  effectiveModulus(t: number, t0: number): number {
    const Ec_t0 = this.modulusAtAge(t0);
    const phi = this.creepCoefficient(t, t0);
    return Ec_t0 / (1 + phi);
  }

  /**
   * Age-adjusted effective modulus (AAEM)
   */
  ageAdjustedModulus(t: number, t0: number, chi: number = 0.8): number {
    const Ec_t0 = this.modulusAtAge(t0);
    const phi = this.creepCoefficient(t, t0);
    return Ec_t0 / (1 + chi * phi);
  }
}

// ============================================================================
// CONSTRUCTION STAGE ANALYZER
// ============================================================================

export class ConstructionStageAnalyzer {
  private stages: ConstructionStage[] = [];
  private concreteProps?: ConcreteAgeProperties;
  private results: Map<string, StageAnalysisResult> = new Map();

  constructor(concreteProperties?: ConcreteTimeProperties) {
    if (concreteProperties) {
      this.concreteProps = new ConcreteAgeProperties(concreteProperties);
    }
  }

  /**
   * Add construction stage
   */
  addStage(stage: ConstructionStage): void {
    this.stages.push(stage);
    this.stages.sort((a, b) => a.daysFromStart - b.daysFromStart);
  }

  /**
   * Get stage by ID
   */
  getStage(id: string): ConstructionStage | undefined {
    return this.stages.find(s => s.id === id);
  }

  /**
   * List all stages
   */
  listStages(): ConstructionStage[] {
    return [...this.stages];
  }

  /**
   * Calculate material properties at a specific stage
   */
  getMaterialPropertiesAtStage(stageId: string, elementAge: number): {
    fck: number;
    Ec: number;
    creepCoeff?: number;
    shrinkage?: number;
  } {
    if (!this.concreteProps) {
      return { fck: 25, Ec: 25000 }; // Default values
    }

    const stage = this.getStage(stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found`);
    }

    const t = stage.daysFromStart;
    const t0 = Math.max(1, elementAge);

    return {
      fck: this.concreteProps.strengthAtAge(t0),
      Ec: this.concreteProps.modulusAtAge(t0),
      creepCoeff: t > t0 ? this.concreteProps.creepCoefficient(t, t0) : 0,
      shrinkage: this.concreteProps.shrinkageStrain(t).total
    };
  }

  /**
   * Analyze single stage
   */
  analyzeStage(
    stageId: string,
    structureData: {
      nodes: { id: string; x: number; y: number; z: number }[];
      members: { id: string; nodeI: string; nodeJ: string; E: number; I: number; A: number }[];
      supports: { nodeId: string; type: 'fixed' | 'pinned' | 'roller' }[];
    }
  ): StageAnalysisResult {
    const stage = this.getStage(stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found`);
    }

    // Simplified analysis - in practice would use full structural analysis
    const displacements = new Map<string, number[]>();
    const memberForces = new Map<string, number[]>();
    const stresses = new Map<string, { top: number; bottom: number }>();

    // Initialize results
    for (const node of structureData.nodes) {
      displacements.set(node.id, [0, 0, 0, 0, 0, 0]);
    }

    // Apply stage loads
    let totalLoad = 0;
    for (const load of stage.appliedLoads) {
      totalLoad += load.magnitude;
    }

    // Simplified force distribution
    for (const member of structureData.members) {
      const L = this.getMemberLength(member, structureData.nodes);
      const w = totalLoad / L / 1000; // Distributed load (kN/m)
      
      // Simply supported beam approximation
      const M_max = w * L * L / 8;
      const V_max = w * L / 2;

      memberForces.set(member.id, [0, V_max, 0, M_max, 0, 0]);
      
      // Stress calculation
      const h = 500; // Assumed depth
      const sigma = M_max * 1e6 * h / 2 / member.I;
      stresses.set(member.id, { top: -sigma, bottom: sigma });
    }

    // Calculate creep and shrinkage effects if applicable
    const creepEffects = new Map<string, number>();
    const shrinkageEffects = new Map<string, number>();

    if (this.concreteProps) {
      const previousStage = this.getPreviousStage(stageId);
      if (previousStage) {
        const t = stage.daysFromStart;
        const t0 = previousStage.daysFromStart;

        if (t > t0) {
          const phi = this.concreteProps.creepCoefficient(t, t0);
          const eps_cs = this.concreteProps.shrinkageStrain(t).total;

          for (const member of structureData.members) {
            creepEffects.set(member.id, phi);
            shrinkageEffects.set(member.id, eps_cs);
          }
        }
      }
    }

    const result: StageAnalysisResult = {
      stageId,
      time: stage.daysFromStart,
      displacements,
      memberForces,
      stresses,
      creepEffects: creepEffects.size > 0 ? creepEffects : undefined,
      shrinkageEffects: shrinkageEffects.size > 0 ? shrinkageEffects : undefined
    };

    this.results.set(stageId, result);
    return result;
  }

  private getMemberLength(
    member: { nodeI: string; nodeJ: string },
    nodes: { id: string; x: number; y: number; z: number }[]
  ): number {
    const nodeI = nodes.find(n => n.id === member.nodeI);
    const nodeJ = nodes.find(n => n.id === member.nodeJ);
    if (!nodeI || !nodeJ) return 1000;

    return Math.sqrt(
      Math.pow(nodeJ.x - nodeI.x, 2) +
      Math.pow(nodeJ.y - nodeI.y, 2) +
      Math.pow(nodeJ.z - nodeI.z, 2)
    );
  }

  private getPreviousStage(stageId: string): ConstructionStage | undefined {
    const index = this.stages.findIndex(s => s.id === stageId);
    return index > 0 ? this.stages[index - 1] : undefined;
  }

  /**
   * Analyze all stages sequentially
   */
  analyzeAllStages(structureData: any): Map<string, StageAnalysisResult> {
    for (const stage of this.stages) {
      this.analyzeStage(stage.id, structureData);
    }
    return this.results;
  }

  /**
   * Get cumulative results at specific time
   */
  getCumulativeResults(time: number): {
    activeStages: string[];
    totalDisplacement: Map<string, number[]>;
    totalForces: Map<string, number[]>;
    creepContribution: number;
    shrinkageContribution: number;
  } {
    const activeStages = this.stages
      .filter(s => s.daysFromStart <= time)
      .map(s => s.id);

    const totalDisplacement = new Map<string, number[]>();
    const totalForces = new Map<string, number[]>();
    let creepContribution = 0;
    let shrinkageContribution = 0;

    for (const stageId of activeStages) {
      const result = this.results.get(stageId);
      if (!result) continue;

      // Sum displacements
      result.displacements.forEach((disp, nodeId) => {
        const existing = totalDisplacement.get(nodeId) || [0, 0, 0, 0, 0, 0];
        totalDisplacement.set(nodeId, existing.map((v, i) => v + disp[i]));
      });

      // Sum forces
      result.memberForces.forEach((forces, memberId) => {
        const existing = totalForces.get(memberId) || [0, 0, 0, 0, 0, 0];
        totalForces.set(memberId, existing.map((v, i) => v + forces[i]));
      });

      // Creep and shrinkage
      if (result.creepEffects) {
        result.creepEffects.forEach(phi => {
          creepContribution = Math.max(creepContribution, phi);
        });
      }
      if (result.shrinkageEffects) {
        result.shrinkageEffects.forEach(eps => {
          shrinkageContribution = Math.max(shrinkageContribution, eps);
        });
      }
    }

    return {
      activeStages,
      totalDisplacement,
      totalForces,
      creepContribution,
      shrinkageContribution
    };
  }

  /**
   * Calculate deflection development over time
   */
  getDeflectionHistory(
    nodeId: string,
    direction: 'x' | 'y' | 'z' = 'y',
    timePoints: number[] = [1, 7, 28, 90, 365, 1825]
  ): { time: number; deflection: number; creepDeflection: number; shrinkageDeflection: number }[] {
    const dirIndex = direction === 'x' ? 0 : direction === 'y' ? 1 : 2;
    const history: { time: number; deflection: number; creepDeflection: number; shrinkageDeflection: number }[] = [];

    for (const t of timePoints) {
      const cumulative = this.getCumulativeResults(t);
      const disp = cumulative.totalDisplacement.get(nodeId);
      
      // Simplified creep and shrinkage deflection estimation
      const instantDeflection = disp ? disp[dirIndex] : 0;
      const creepDeflection = instantDeflection * cumulative.creepContribution;
      const shrinkageDeflection = instantDeflection * cumulative.shrinkageContribution * 100; // Amplified

      history.push({
        time: t,
        deflection: instantDeflection + creepDeflection + shrinkageDeflection,
        creepDeflection,
        shrinkageDeflection
      });
    }

    return history;
  }
}

// ============================================================================
// SHORING/RESHORING ANALYZER
// ============================================================================

export class ShoringAnalyzer {
  /**
   * Analyze shored slab construction
   */
  static analyzeMultiLevelShoring(
    levels: {
      level: number;
      selfWeight: number; // kN/m²
      constructionLoad: number; // kN/m²
      stiffness: number; // kN/m per unit length
      shored: boolean;
      numShorelevels: number;
    }[]
  ): {
    levelLoads: { level: number; loadOnSlab: number; loadOnShores: number }[];
    maxShoreLoad: number;
    criticalLevel: number;
    recommendations: string[];
  } {
    const results: { level: number; loadOnSlab: number; loadOnShores: number }[] = [];
    const recommendations: string[] = [];
    let maxShoreLoad = 0;
    let criticalLevel = 0;

    // Simplified load distribution analysis
    for (const level of levels) {
      let loadOnSlab = level.selfWeight;
      let loadOnShores = 0;

      if (level.shored && level.numShorelevels > 0) {
        // Load shared between slab and shores
        const shoreStiffness = level.stiffness * level.numShorelevels;
        const slabStiffness = level.stiffness;
        const totalStiffness = shoreStiffness + slabStiffness;

        loadOnShores = (level.selfWeight + level.constructionLoad) * shoreStiffness / totalStiffness;
        loadOnSlab = (level.selfWeight + level.constructionLoad) - loadOnShores;
      } else {
        loadOnSlab += level.constructionLoad;
      }

      results.push({ level: level.level, loadOnSlab, loadOnShores });

      if (loadOnShores > maxShoreLoad) {
        maxShoreLoad = loadOnShores;
        criticalLevel = level.level;
      }
    }

    // Recommendations
    if (maxShoreLoad > 20) {
      recommendations.push(`High shore loads at Level ${criticalLevel}. Consider additional shores.`);
    }

    const unshoredLevels = levels.filter(l => !l.shored && l.level > 1);
    for (const level of unshoredLevels) {
      const load = level.selfWeight + level.constructionLoad;
      if (load > 15) {
        recommendations.push(`Level ${level.level} is unshored with high load (${load.toFixed(1)} kN/m²). Verify early strength.`);
      }
    }

    return {
      levelLoads: results,
      maxShoreLoad,
      criticalLevel,
      recommendations
    };
  }

  /**
   * Determine minimum concrete strength for shore removal
   */
  static minimumStrengthForShoreRemoval(
    spans: { span: number; loadRatio: number }[],
    fck28: number
  ): {
    minimumStrength: number;
    minimumAge: number;
    strengthRatio: number;
    notes: string[];
  } {
    const notes: string[] = [];

    // Find maximum span
    const maxSpan = Math.max(...spans.map(s => s.span));
    const maxLoadRatio = Math.max(...spans.map(s => s.loadRatio));

    // ACI 347 guidelines
    let strengthRatio: number;
    if (maxSpan <= 3000) {
      strengthRatio = 0.50;
    } else if (maxSpan <= 6000) {
      strengthRatio = 0.70;
    } else {
      strengthRatio = 0.85;
    }

    // Adjust for load ratio
    if (maxLoadRatio > 1.0) {
      strengthRatio = Math.min(1.0, strengthRatio * 1.1);
      notes.push('Load ratio exceeds 1.0 - increased strength requirement');
    }

    const minimumStrength = strengthRatio * fck28;

    // Estimate age for this strength (simplified)
    const s = 0.25; // Normal cement
    // betaCC = exp(s(1 - sqrt(28/t))) = strengthRatio
    // Solve for t
    const minAge = 28 / Math.pow(1 - Math.log(strengthRatio) / s, 2);

    if (maxSpan > 6000) {
      notes.push('Long spans - consider staged shore removal');
    }

    if (minimumStrength < 0.5 * fck28) {
      notes.push('Minimum strength less than 50% - verify with structural engineer');
    }

    return {
      minimumStrength,
      minimumAge: Math.ceil(minAge),
      strengthRatio,
      notes
    };
  }
}

// ============================================================================
// PRESTRESS LOSS CALCULATOR
// ============================================================================

export class PrestressLossCalculator {
  /**
   * Calculate total prestress losses per IS 1343 / EN 1992-1-1
   */
  static calculateLosses(
    params: {
      initialStress: number; // MPa (fpi)
      tendonArea: number; // mm²
      concreteArea: number; // mm²
      eccentricity: number; // mm
      span: number; // mm
      Ep: number; // MPa (tendon modulus)
      Ec: number; // MPa (concrete modulus at transfer)
      fck: number; // MPa
      humidity: number; // %
      cement: 'N' | 'R' | 'SL';
      h0: number; // Notional size (mm)
      duct: 'bonded' | 'unbonded';
      frictionCoeff?: number;
      wobble?: number;
      anchorSlip?: number; // mm
    }
  ): {
    immediate: {
      elastic: number;
      friction: number;
      anchorSlip: number;
      total: number;
    };
    timeDependent: {
      relaxation: number;
      creep: number;
      shrinkage: number;
      total: number;
    };
    totalLoss: number;
    effectiveStress: number;
    lossPercentage: number;
  } {
    const {
      initialStress, tendonArea, concreteArea, eccentricity, span,
      Ep, Ec, fck, humidity, cement, h0, duct,
      frictionCoeff = 0.2, wobble = 0.002, anchorSlip = 6
    } = params;

    // IMMEDIATE LOSSES
    
    // 1. Elastic shortening
    const n = Ep / Ec;
    const fci = 0.8 * fck; // Concrete stress at transfer
    const fcp = initialStress * tendonArea / concreteArea; // Initial concrete stress
    const elasticLoss = n * fcp;

    // 2. Friction loss (for parabolic profile)
    const alpha = 8 * eccentricity / span; // Profile angle
    const frictionLoss = initialStress * (1 - Math.exp(-(frictionCoeff * alpha + wobble * span / 1000)));

    // 3. Anchor slip loss
    const anchorSlipLoss = Ep * anchorSlip / span * 1000;

    const immediateTotal = elasticLoss + frictionLoss + anchorSlipLoss;

    // TIME-DEPENDENT LOSSES (at 100 years)
    const concreteProps = new ConcreteAgeProperties({
      fck_28: fck,
      Ec_28: Ec,
      cement,
      humidity,
      notionalSize: h0
    });

    const t = 36500; // 100 years
    const t0 = 7; // Transfer at 7 days

    // 4. Relaxation loss
    const rho1000 = 0.08; // Low relaxation strand
    const stressRatio = (initialStress - immediateTotal) / 1860; // Assuming fpk = 1860 MPa
    const relaxationLoss = 0.66 * rho1000 * stressRatio * (initialStress - immediateTotal);

    // 5. Creep loss
    const phi = concreteProps.creepCoefficient(t, t0);
    const creepLoss = n * phi * fcp * 0.8; // Reduced for stress reduction

    // 6. Shrinkage loss
    const eps_cs = concreteProps.shrinkageStrain(t).total;
    const shrinkageLoss = Ep * eps_cs / 1e6 * 1000;

    const timeDependentTotal = relaxationLoss + creepLoss + shrinkageLoss;

    const totalLoss = immediateTotal + timeDependentTotal;
    const effectiveStress = initialStress - totalLoss;
    const lossPercentage = (totalLoss / initialStress) * 100;

    return {
      immediate: {
        elastic: elasticLoss,
        friction: frictionLoss,
        anchorSlip: anchorSlipLoss,
        total: immediateTotal
      },
      timeDependent: {
        relaxation: relaxationLoss,
        creep: creepLoss,
        shrinkage: shrinkageLoss,
        total: timeDependentTotal
      },
      totalLoss,
      effectiveStress,
      lossPercentage
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConcreteAgeProperties,
  ConstructionStageAnalyzer,
  ShoringAnalyzer,
  PrestressLossCalculator
};
