/**
 * ============================================================================
 * SEISMIC PERFORMANCE ASSESSMENT ENGINE
 * ============================================================================
 * 
 * Advanced seismic performance evaluation including:
 * - Nonlinear static (pushover) analysis
 * - Performance point determination
 * - Fragility curve generation
 * - Damage state assessment
 * - Capacity spectrum method
 * - Displacement coefficient method
 * 
 * Design Codes:
 * - FEMA 356/ASCE 41 - Seismic Rehabilitation
 * - ATC-40 - Seismic Evaluation and Retrofit
 * - IS 1893:2016 - Earthquake Resistant Design
 * - EN 1998-3 - Assessment and Retrofitting
 * - FEMA P-58 - Performance Assessment
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface StructuralModel {
  nodes: SeismicNode[];
  elements: SeismicElement[];
  masses: { nodeId: string; mass: number; direction: 'X' | 'Y' | 'Z' }[];
  constraints: { nodeId: string; dof: number[] }[];
}

export interface SeismicNode {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface SeismicElement {
  id: string;
  type: 'beam' | 'column' | 'brace' | 'wall' | 'link';
  nodeI: string;
  nodeJ: string;
  section: {
    type: string;
    properties: Record<string, number>;
  };
  material: {
    type: 'steel' | 'concrete' | 'masonry';
    fy?: number;
    fc?: number;
  };
  plasticHinges?: PlasticHingeDefinition[];
}

export interface PlasticHingeDefinition {
  location: 'start' | 'end' | 'middle';
  type: 'M3' | 'PM' | 'V2' | 'V3';
  backbone: {
    A: number; // Yield point
    B: number; // Ultimate capacity
    C: number; // Residual strength
    D: number; // Rupture
    E: number; // Complete failure
  };
  acceptanceCriteria: {
    IO: number; // Immediate Occupancy
    LS: number; // Life Safety
    CP: number; // Collapse Prevention
  };
}

export interface PushoverResult {
  curve: { displacement: number; baseShear: number }[];
  yieldPoint: { displacement: number; baseShear: number };
  ultimatePoint: { displacement: number; baseShear: number };
  ductility: number;
  overstrength: number;
  hingeSequence: {
    step: number;
    displacement: number;
    hinges: { elementId: string; location: string; state: string }[];
  }[];
}

export interface CapacitySpectrum {
  Sa: number; // Spectral acceleration (g)
  Sd: number; // Spectral displacement (m)
}

export interface PerformancePoint {
  Sa: number;
  Sd: number;
  displacement: number;
  baseShear: number;
  effectivePeriod: number;
  effectiveDamping: number;
  ductilityDemand: number;
}

export interface DamageState {
  level: 'None' | 'Slight' | 'Moderate' | 'Extensive' | 'Complete';
  driftLimit: number;
  description: string;
  repairCost: number; // Percentage of replacement
}

export interface FragilityCurve {
  damageState: string;
  medianDemand: number;
  dispersion: number;
  probabilities: { demand: number; probability: number }[];
}

export interface PerformanceAssessmentResult {
  performancePoint: PerformancePoint;
  damageStates: { level: string; probability: number }[];
  maxDrift: number;
  roofDisplacement: number;
  hingeStatus: { IO: number; LS: number; CP: number; beyond: number };
  performanceLevel: 'IO' | 'LS' | 'CP' | 'Collapse';
  expectedLoss: number; // Percentage
  recommendations: string[];
}

// ============================================================================
// PUSHOVER ANALYSIS
// ============================================================================

export class PushoverAnalyzer {
  private model: StructuralModel;
  private loadPattern: 'uniform' | 'triangular' | 'modal' | 'adaptive';
  private controlNode: string;
  private targetDisplacement: number;

  constructor(
    model: StructuralModel,
    loadPattern: 'uniform' | 'triangular' | 'modal' | 'adaptive' = 'modal',
    controlNode: string,
    targetDisplacement: number
  ) {
    this.model = model;
    this.loadPattern = loadPattern;
    this.controlNode = controlNode;
    this.targetDisplacement = targetDisplacement;
  }

  /**
   * Generate lateral load distribution
   */
  private getLoadPattern(): Map<string, number> {
    const loads = new Map<string, number>();
    const heights: { nodeId: string; height: number; mass: number }[] = [];

    // Get heights and masses
    for (const node of this.model.nodes) {
      const mass = this.model.masses.find(m => m.nodeId === node.id && m.direction === 'X');
      if (mass) {
        heights.push({ nodeId: node.id, height: node.z, mass: mass.mass });
      }
    }

    const totalHeight = Math.max(...heights.map(h => h.height));
    const totalMass = heights.reduce((sum, h) => sum + h.mass, 0);

    switch (this.loadPattern) {
      case 'uniform':
        for (const h of heights) {
          loads.set(h.nodeId, h.mass / totalMass);
        }
        break;

      case 'triangular':
        const sumWH = heights.reduce((sum, h) => sum + h.mass * h.height, 0);
        for (const h of heights) {
          loads.set(h.nodeId, (h.mass * h.height) / sumWH);
        }
        break;

      case 'modal':
        // Simplified first mode shape (linear approximation)
        for (const h of heights) {
          const phi = h.height / totalHeight;
          const Wi_phi = h.mass * phi;
          loads.set(h.nodeId, Wi_phi);
        }
        // Normalize
        const sumWPhi = Array.from(loads.values()).reduce((a, b) => a + b, 0);
        for (const [nodeId, load] of loads) {
          loads.set(nodeId, load / sumWPhi);
        }
        break;

      default:
        // Adaptive - would update based on instantaneous mode shape
        for (const h of heights) {
          loads.set(h.nodeId, h.mass / totalMass);
        }
    }

    return loads;
  }

  /**
   * Perform pushover analysis
   */
  analyze(numSteps: number = 100): PushoverResult {
    const curve: { displacement: number; baseShear: number }[] = [];
    const hingeSequence: PushoverResult['hingeSequence'] = [];
    const loadPattern = this.getLoadPattern();

    // Simplified pushover analysis
    // In practice, this would use incremental-iterative nonlinear analysis
    
    const K0 = this.estimateInitialStiffness();
    const Vy = this.estimateYieldStrength();
    const Dy = Vy / K0;
    const Kp = K0 * 0.05; // Post-yield stiffness (5% hardening)

    let currentDisp = 0;
    let currentShear = 0;
    let yieldPoint = { displacement: 0, baseShear: 0 };
    let ultimatePoint = { displacement: 0, baseShear: 0 };
    let maxShear = 0;

    const deltaD = this.targetDisplacement / numSteps;

    for (let step = 0; step < numSteps; step++) {
      currentDisp += deltaD;

      // Bilinear force-displacement relationship
      if (currentDisp <= Dy) {
        currentShear = K0 * currentDisp;
        if (step === Math.floor(Dy / deltaD)) {
          yieldPoint = { displacement: Dy, baseShear: Vy };
        }
      } else {
        currentShear = Vy + Kp * (currentDisp - Dy);
      }

      // Apply strength degradation after ductility of 4
      const ductility = currentDisp / Dy;
      if (ductility > 4) {
        const degradation = 1 - 0.1 * (ductility - 4);
        currentShear *= Math.max(0.3, degradation);
      }

      curve.push({ displacement: currentDisp, baseShear: currentShear });

      if (currentShear > maxShear) {
        maxShear = currentShear;
        ultimatePoint = { displacement: currentDisp, baseShear: currentShear };
      }

      // Track hinge formation
      if (currentDisp > Dy) {
        const numHinges = Math.min(10, Math.floor((currentDisp - Dy) / Dy * 5));
        const hinges = this.simulateHingeFormation(numHinges, ductility);
        if (hinges.length > 0) {
          hingeSequence.push({
            step,
            displacement: currentDisp,
            hinges
          });
        }
      }
    }

    return {
      curve,
      yieldPoint,
      ultimatePoint,
      ductility: ultimatePoint.displacement / yieldPoint.displacement,
      overstrength: ultimatePoint.baseShear / this.estimateDesignStrength(),
      hingeSequence
    };
  }

  private estimateInitialStiffness(): number {
    // Simplified stiffness estimation based on member properties
    let totalStiffness = 0;
    
    for (const element of this.model.elements) {
      if (element.type === 'column') {
        const E = element.material.type === 'steel' ? 200000 : 25000;
        const I = element.section.properties.I || 1e8;
        const L = this.getElementLength(element);
        totalStiffness += 3 * E * I / Math.pow(L, 3);
      }
    }
    
    return totalStiffness;
  }

  private estimateYieldStrength(): number {
    // Simplified yield strength estimation
    let totalStrength = 0;
    
    for (const element of this.model.elements) {
      if (element.type === 'column') {
        const fy = element.material.fy || 415;
        const Z = element.section.properties.Z || 1e6;
        const L = this.getElementLength(element);
        totalStrength += fy * Z / L;
      }
    }
    
    return totalStrength * 0.8; // Reduction for system effects
  }

  private estimateDesignStrength(): number {
    return this.estimateYieldStrength() / 1.5; // R factor approximation
  }

  private getElementLength(element: SeismicElement): number {
    const nodeI = this.model.nodes.find(n => n.id === element.nodeI);
    const nodeJ = this.model.nodes.find(n => n.id === element.nodeJ);
    if (!nodeI || !nodeJ) return 3000;

    return Math.sqrt(
      Math.pow(nodeJ.x - nodeI.x, 2) +
      Math.pow(nodeJ.y - nodeI.y, 2) +
      Math.pow(nodeJ.z - nodeI.z, 2)
    );
  }

  private simulateHingeFormation(
    numHinges: number, 
    ductility: number
  ): { elementId: string; location: string; state: string }[] {
    const hinges: { elementId: string; location: string; state: string }[] = [];
    const beamElements = this.model.elements.filter(e => e.type === 'beam');
    
    for (let i = 0; i < Math.min(numHinges, beamElements.length); i++) {
      let state: string;
      if (ductility < 2) state = 'B-IO';
      else if (ductility < 3) state = 'IO-LS';
      else if (ductility < 4) state = 'LS-CP';
      else state = 'CP-C';

      hinges.push({
        elementId: beamElements[i].id,
        location: i % 2 === 0 ? 'end-I' : 'end-J',
        state
      });
    }

    return hinges;
  }
}

// ============================================================================
// CAPACITY SPECTRUM METHOD (ATC-40 / FEMA 440)
// ============================================================================

export class CapacitySpectrumMethod {
  /**
   * Convert pushover curve to capacity spectrum (ADRS format)
   */
  static toCapacitySpectrum(
    pushoverCurve: { displacement: number; baseShear: number }[],
    modalParams: {
      effectiveMass: number; // kg
      modalParticipation: number;
      effectiveHeight: number; // m
    }
  ): CapacitySpectrum[] {
    const { effectiveMass, modalParticipation, effectiveHeight } = modalParams;
    const g = 9.81;

    return pushoverCurve.map(point => ({
      Sa: point.baseShear / (effectiveMass * g * modalParticipation),
      Sd: point.displacement / modalParticipation / 1000 // Convert to m
    }));
  }

  /**
   * Get reduced demand spectrum per ATC-40 Procedure A
   */
  static getReducedDemandSpectrum(
    demandSpectrum: { T: number; Sa: number }[],
    effectiveDamping: number
  ): CapacitySpectrum[] {
    // Spectral reduction factors
    const betaEff = effectiveDamping;
    const kappa = betaEff <= 0.165 ? 1.0 : 0.77; // Type B structure

    const SRA = Math.max(0.33, (3.21 - 0.68 * Math.log(betaEff * 100)) / 2.12);
    const SRV = Math.max(0.5, (2.31 - 0.41 * Math.log(betaEff * 100)) / 1.65);

    return demandSpectrum.map(point => {
      // Period-dependent reduction
      let reduction: number;
      if (point.T < 0.3) {
        reduction = SRA;
      } else if (point.T > 1.0) {
        reduction = SRV;
      } else {
        reduction = SRA + (SRV - SRA) * (point.T - 0.3) / 0.7;
      }

      // Convert to ADRS
      const omega = 2 * Math.PI / point.T;
      const Sd = point.Sa * 9.81 / (omega * omega);

      return {
        Sa: point.Sa * reduction * kappa,
        Sd
      };
    });
  }

  /**
   * Find performance point using iterative procedure
   */
  static findPerformancePoint(
    capacitySpectrum: CapacitySpectrum[],
    demandSpectrum: { T: number; Sa: number }[],
    initialDamping: number = 0.05
  ): PerformancePoint {
    let effectiveDamping = initialDamping;
    let convergence = false;
    let iterations = 0;
    const maxIterations = 20;

    let performancePoint: PerformancePoint = {
      Sa: 0,
      Sd: 0,
      displacement: 0,
      baseShear: 0,
      effectivePeriod: 0,
      effectiveDamping: initialDamping,
      ductilityDemand: 1
    };

    // Yield point from capacity curve
    const yieldIndex = this.findYieldPoint(capacitySpectrum);
    const SaY = capacitySpectrum[yieldIndex].Sa;
    const SdY = capacitySpectrum[yieldIndex].Sd;

    while (!convergence && iterations < maxIterations) {
      // Get reduced demand spectrum
      const reducedDemand = this.getReducedDemandSpectrum(demandSpectrum, effectiveDamping);

      // Find intersection point
      const intersection = this.findIntersection(capacitySpectrum, reducedDemand);
      
      if (!intersection) {
        // Capacity < Demand - structure fails
        break;
      }

      // Calculate effective period
      const Teff = 2 * Math.PI * Math.sqrt(intersection.Sd / (intersection.Sa * 9.81));

      // Calculate ductility demand
      const ductility = intersection.Sd / SdY;

      // Calculate equivalent damping (ATC-40 Eq. 8-12)
      const ED = 4 * (intersection.Sa * SdY - SaY * intersection.Sd);
      const ES = intersection.Sa * intersection.Sd;
      const hystereticDamping = (kappa: number) => kappa * ED / (4 * Math.PI * ES);

      const kappa = intersection.Sa / SaY <= 0.83 ? 1.0 : 0.77;
      const newDamping = initialDamping + hystereticDamping(kappa);

      // Check convergence
      if (Math.abs(newDamping - effectiveDamping) < 0.005) {
        convergence = true;
      }

      effectiveDamping = newDamping;

      performancePoint = {
        Sa: intersection.Sa,
        Sd: intersection.Sd,
        displacement: intersection.Sd * 1000, // Back to mm
        baseShear: intersection.Sa * 9.81, // Normalized
        effectivePeriod: Teff,
        effectiveDamping,
        ductilityDemand: ductility
      };

      iterations++;
    }

    return performancePoint;

    function kappa(saRatio: number): number {
      return saRatio <= 0.83 ? 1.0 : 0.77;
    }
  }

  private static findYieldPoint(spectrum: CapacitySpectrum[]): number {
    // Find point where stiffness starts to decrease significantly
    let maxStiffness = 0;
    let yieldIndex = 0;

    for (let i = 1; i < spectrum.length; i++) {
      const stiffness = (spectrum[i].Sa - spectrum[i-1].Sa) / 
                       (spectrum[i].Sd - spectrum[i-1].Sd);
      
      if (i < 5) {
        maxStiffness = Math.max(maxStiffness, stiffness);
      } else if (stiffness < 0.3 * maxStiffness && yieldIndex === 0) {
        yieldIndex = i - 1;
      }
    }

    return yieldIndex || Math.floor(spectrum.length / 4);
  }

  private static findIntersection(
    capacity: CapacitySpectrum[],
    demand: CapacitySpectrum[]
  ): CapacitySpectrum | null {
    // Interpolate and find intersection
    for (let i = 1; i < capacity.length && i < demand.length; i++) {
      const cSd = capacity[i].Sd;
      const cSa = capacity[i].Sa;
      
      // Interpolate demand at this Sd
      const dSa = this.interpolateDemand(demand, cSd);
      
      if (dSa !== null && cSa >= dSa) {
        return { Sa: dSa, Sd: cSd };
      }
    }

    return null;
  }

  private static interpolateDemand(demand: CapacitySpectrum[], Sd: number): number | null {
    for (let i = 1; i < demand.length; i++) {
      if (demand[i].Sd >= Sd) {
        const ratio = (Sd - demand[i-1].Sd) / (demand[i].Sd - demand[i-1].Sd);
        return demand[i-1].Sa + ratio * (demand[i].Sa - demand[i-1].Sa);
      }
    }
    return null;
  }
}

// ============================================================================
// DISPLACEMENT COEFFICIENT METHOD (FEMA 356)
// ============================================================================

export class DisplacementCoefficientMethod {
  /**
   * Calculate target displacement per FEMA 356
   */
  static calculateTargetDisplacement(params: {
    Sa: number; // Spectral acceleration at T (g)
    Te: number; // Effective fundamental period (s)
    Ti: number; // Elastic fundamental period (s)
    C0: number; // Modification factor for MDOF
    C1: number; // Modification factor for inelastic displacement
    C2: number; // Modification factor for pinched hysteresis
    C3: number; // Modification factor for P-Delta
    Vy: number; // Yield strength kN
    W: number; // Seismic weight kN
    alpha: number; // Post-yield stiffness ratio
  }): {
    targetDisplacement: number;
    effectivePeriod: number;
    coefficients: Record<string, number>;
  } {
    const { Sa, Te, Ti, C0, C1, C2, C3, Vy, W, alpha } = params;
    const g = 9.81;

    // Calculate target displacement
    const Cm = 1.0; // For fundamental mode
    const deltaT = C0 * C1 * C2 * C3 * Sa * g * Te * Te / (4 * Math.PI * Math.PI);

    return {
      targetDisplacement: deltaT * 1000, // Convert to mm
      effectivePeriod: Te,
      coefficients: { C0, C1, C2, C3 }
    };
  }

  /**
   * Calculate C0 - Modification factor for MDOF effects
   */
  static calculateC0(
    numStories: number,
    loadPattern: 'uniform' | 'triangular' | 'first-mode'
  ): number {
    // FEMA 356 Table 3-2
    if (loadPattern === 'triangular' || loadPattern === 'first-mode') {
      if (numStories === 1) return 1.0;
      if (numStories === 2) return 1.2;
      if (numStories === 3) return 1.2;
      if (numStories <= 5) return 1.3;
      if (numStories <= 10) return 1.4;
      return 1.5;
    } else {
      // Uniform pattern
      if (numStories === 1) return 1.0;
      if (numStories === 2) return 1.15;
      if (numStories === 3) return 1.2;
      return 1.2;
    }
  }

  /**
   * Calculate C1 - Modification factor for inelastic displacements
   */
  static calculateC1(
    Te: number,
    T0: number, // Characteristic period of response spectrum
    R: number // Strength ratio (elastic demand / yield strength)
  ): number {
    if (Te < T0) {
      return Math.max(1.0, (1 + (R - 1) * T0 / Te) / R);
    }
    return 1.0;
  }

  /**
   * Calculate C2 - Modification factor for hysteresis shape
   */
  static calculateC2(
    Te: number,
    T0: number,
    performanceLevel: 'IO' | 'LS' | 'CP',
    framingType: 'Type1' | 'Type2'
  ): number {
    // FEMA 356 Table 3-3
    if (framingType === 'Type1') {
      // Framing type with significant stiffness/strength degradation
      if (Te < 0.1) {
        if (performanceLevel === 'IO') return 1.0;
        if (performanceLevel === 'LS') return 1.0;
        return 1.0;
      } else if (Te <= T0) {
        if (performanceLevel === 'IO') return 1.0;
        if (performanceLevel === 'LS') return 1.1;
        return 1.2;
      } else {
        return 1.0;
      }
    } else {
      // Type 2 - no significant degradation
      return 1.0;
    }
  }

  /**
   * Calculate C3 - P-Delta effect factor
   */
  static calculateC3(
    alpha: number, // Post-yield stiffness ratio (negative for degradation)
    R: number // Strength ratio
  ): number {
    if (alpha >= 0) {
      return 1.0;
    }
    // Simplified P-Delta effect factor
    return 1 + Math.abs(alpha) * (R - 1) * Math.pow(R, 1.5);
  }
}

// ============================================================================
// FRAGILITY ANALYSIS
// ============================================================================

export class FragilityAnalysis {
  private damageStates: DamageState[];

  constructor(buildingType: 'steel-frame' | 'rc-frame' | 'masonry' | 'wood') {
    this.damageStates = this.getDefaultDamageStates(buildingType);
  }

  private getDefaultDamageStates(buildingType: string): DamageState[] {
    // HAZUS-based damage states
    switch (buildingType) {
      case 'steel-frame':
        return [
          { level: 'None', driftLimit: 0, description: 'No damage', repairCost: 0 },
          { level: 'Slight', driftLimit: 0.004, description: 'Minor yielding', repairCost: 2 },
          { level: 'Moderate', driftLimit: 0.008, description: 'Structural damage', repairCost: 10 },
          { level: 'Extensive', driftLimit: 0.020, description: 'Major damage', repairCost: 50 },
          { level: 'Complete', driftLimit: 0.050, description: 'Collapse/demolition', repairCost: 100 }
        ];
      
      case 'rc-frame':
        return [
          { level: 'None', driftLimit: 0, description: 'No damage', repairCost: 0 },
          { level: 'Slight', driftLimit: 0.003, description: 'Hairline cracks', repairCost: 3 },
          { level: 'Moderate', driftLimit: 0.006, description: 'Spalling, cracks', repairCost: 15 },
          { level: 'Extensive', driftLimit: 0.015, description: 'Major cracking', repairCost: 45 },
          { level: 'Complete', driftLimit: 0.040, description: 'Collapse', repairCost: 100 }
        ];

      case 'masonry':
        return [
          { level: 'None', driftLimit: 0, description: 'No damage', repairCost: 0 },
          { level: 'Slight', driftLimit: 0.002, description: 'Minor cracks', repairCost: 5 },
          { level: 'Moderate', driftLimit: 0.004, description: 'Moderate cracks', repairCost: 20 },
          { level: 'Extensive', driftLimit: 0.010, description: 'Large cracks', repairCost: 55 },
          { level: 'Complete', driftLimit: 0.025, description: 'Collapse', repairCost: 100 }
        ];

      default:
        return [
          { level: 'None', driftLimit: 0, description: 'No damage', repairCost: 0 },
          { level: 'Slight', driftLimit: 0.003, description: 'Minor damage', repairCost: 3 },
          { level: 'Moderate', driftLimit: 0.007, description: 'Moderate damage', repairCost: 15 },
          { level: 'Extensive', driftLimit: 0.015, description: 'Major damage', repairCost: 50 },
          { level: 'Complete', driftLimit: 0.035, description: 'Collapse', repairCost: 100 }
        ];
    }
  }

  /**
   * Generate fragility curve for a damage state
   */
  generateFragilityCurve(
    damageState: DamageState,
    dispersion: number = 0.6
  ): FragilityCurve {
    const medianDemand = damageState.driftLimit;
    const probabilities: { demand: number; probability: number }[] = [];

    // Generate lognormal fragility curve
    for (let demand = 0; demand <= 0.10; demand += 0.001) {
      if (demand === 0) {
        probabilities.push({ demand: 0, probability: 0 });
        continue;
      }

      // Lognormal CDF
      const z = Math.log(demand / medianDemand) / dispersion;
      const probability = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
      probabilities.push({ demand, probability });
    }

    return {
      damageState: damageState.level,
      medianDemand,
      dispersion,
      probabilities
    };
  }

  /**
   * Calculate probability of each damage state given demand
   */
  getDamageStateProbabilities(
    driftDemand: number
  ): { level: string; probability: number }[] {
    const probabilities: { level: string; probability: number }[] = [];
    const fragilityCurves = this.damageStates.map(ds => 
      this.generateFragilityCurve(ds)
    );

    for (let i = 0; i < this.damageStates.length; i++) {
      const ds = this.damageStates[i];
      const curve = fragilityCurves[i];
      
      // Find probability of exceeding this damage state
      const pExceed = this.getProbabilityFromCurve(curve, driftDemand);
      
      // Probability of being in this damage state
      let pState: number;
      if (i === this.damageStates.length - 1) {
        pState = pExceed;
      } else {
        const pExceedNext = this.getProbabilityFromCurve(
          fragilityCurves[i + 1], driftDemand
        );
        pState = pExceed - pExceedNext;
      }

      probabilities.push({
        level: ds.level,
        probability: Math.max(0, pState)
      });
    }

    return probabilities;
  }

  /**
   * Calculate expected loss
   */
  calculateExpectedLoss(driftDemand: number): number {
    const probs = this.getDamageStateProbabilities(driftDemand);
    let expectedLoss = 0;

    for (const prob of probs) {
      const ds = this.damageStates.find(d => d.level === prob.level);
      if (ds) {
        expectedLoss += prob.probability * ds.repairCost;
      }
    }

    return expectedLoss;
  }

  private getProbabilityFromCurve(curve: FragilityCurve, demand: number): number {
    for (const point of curve.probabilities) {
      if (point.demand >= demand) {
        return point.probability;
      }
    }
    return 1.0;
  }

  // Error function approximation
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

// ============================================================================
// PERFORMANCE ASSESSMENT
// ============================================================================

export class SeismicPerformanceAssessor {
  private model: StructuralModel;
  private buildingType: 'steel-frame' | 'rc-frame' | 'masonry' | 'wood';

  constructor(
    model: StructuralModel,
    buildingType: 'steel-frame' | 'rc-frame' | 'masonry' | 'wood'
  ) {
    this.model = model;
    this.buildingType = buildingType;
  }

  /**
   * Perform complete seismic assessment
   */
  assess(params: {
    demandSpectrum: { T: number; Sa: number }[];
    targetRating: number; // Return period years
    performanceObjective: 'IO' | 'LS' | 'CP';
  }): PerformanceAssessmentResult {
    const { demandSpectrum, targetRating, performanceObjective } = params;
    const recommendations: string[] = [];

    // Get structural height
    const maxZ = Math.max(...this.model.nodes.map(n => n.z));
    const numStories = Math.round(maxZ / 3000); // Assume 3m story height
    const controlNode = this.model.nodes.find(n => n.z === maxZ)?.id || 'roof';

    // Perform pushover analysis
    const pushover = new PushoverAnalyzer(
      this.model,
      'modal',
      controlNode,
      maxZ * 0.04 // 4% target drift
    );
    const pushoverResult = pushover.analyze();

    // Calculate modal parameters
    const totalMass = this.model.masses.reduce((sum, m) => sum + m.mass, 0);
    const modalParams = {
      effectiveMass: totalMass * 0.8,
      modalParticipation: 1.3,
      effectiveHeight: maxZ * 0.7
    };

    // Convert to capacity spectrum
    const capacitySpectrum = CapacitySpectrumMethod.toCapacitySpectrum(
      pushoverResult.curve,
      modalParams
    );

    // Find performance point
    const performancePoint = CapacitySpectrumMethod.findPerformancePoint(
      capacitySpectrum,
      demandSpectrum,
      0.05
    );

    // Calculate max drift
    const maxDrift = performancePoint.displacement / maxZ;

    // Get damage state probabilities
    const fragility = new FragilityAnalysis(this.buildingType);
    const damageStates = fragility.getDamageStateProbabilities(maxDrift);
    const expectedLoss = fragility.calculateExpectedLoss(maxDrift);

    // Analyze hinge status
    const lastHingeStep = pushoverResult.hingeSequence
      .find(h => h.displacement >= performancePoint.displacement);
    
    const hingeStatus = {
      IO: 0,
      LS: 0,
      CP: 0,
      beyond: 0
    };

    if (lastHingeStep) {
      for (const hinge of lastHingeStep.hinges) {
        if (hinge.state === 'B-IO') hingeStatus.IO++;
        else if (hinge.state === 'IO-LS') hingeStatus.LS++;
        else if (hinge.state === 'LS-CP') hingeStatus.CP++;
        else hingeStatus.beyond++;
      }
    }

    // Determine performance level
    let performanceLevel: 'IO' | 'LS' | 'CP' | 'Collapse';
    if (hingeStatus.beyond > 0) {
      performanceLevel = 'Collapse';
    } else if (hingeStatus.CP > 0) {
      performanceLevel = 'CP';
    } else if (hingeStatus.LS > 0) {
      performanceLevel = 'LS';
    } else {
      performanceLevel = 'IO';
    }

    // Generate recommendations
    if (performanceLevel === 'Collapse') {
      recommendations.push('CRITICAL: Structure does not meet basic safety requirements');
      recommendations.push('Major structural retrofitting or replacement required');
    } else if (performanceLevel === 'CP' && performanceObjective === 'LS') {
      recommendations.push('Structure does not meet Life Safety objective');
      recommendations.push('Consider strengthening columns and connections');
    } else if (performanceLevel === 'LS' && performanceObjective === 'IO') {
      recommendations.push('Structure does not meet Immediate Occupancy objective');
      recommendations.push('Consider adding lateral bracing or shear walls');
    }

    if (maxDrift > 0.02) {
      recommendations.push(`Drift ratio ${(maxDrift * 100).toFixed(1)}% exceeds 2.0% limit`);
    }

    if (pushoverResult.ductility < 3) {
      recommendations.push('Low ductility - consider improving connection details');
    }

    if (expectedLoss > 30) {
      recommendations.push(`High expected loss (${expectedLoss.toFixed(0)}%) - consider seismic retrofit`);
    }

    return {
      performancePoint,
      damageStates,
      maxDrift,
      roofDisplacement: performancePoint.displacement,
      hingeStatus,
      performanceLevel,
      expectedLoss,
      recommendations
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  PushoverAnalyzer,
  CapacitySpectrumMethod,
  DisplacementCoefficientMethod,
  FragilityAnalysis,
  SeismicPerformanceAssessor
};
