/**
 * ============================================================================
 * CONSTRUCTION LOAD AND SEQUENCE ENGINE
 * ============================================================================
 * 
 * Analysis of construction loads and staged construction:
 * - Construction load calculation
 * - Shoring/reshoring loads
 * - Stage-by-stage analysis
 * - Creep redistribution during construction
 * - Formwork striking criteria
 * - Concrete maturity
 * - Load path during erection
 * - Temporary support design
 * 
 * Reference Standards:
 * - ACI 347 (Formwork for Concrete)
 * - BS 5975 (Falsework)
 * - AS 3610 (Formwork for Concrete)
 * - ASCE 37 (Design Loads During Construction)
 * - EN 12812 (Falsework)
 * - ACI 209 (Time-dependent effects)
 * - fib Model Code (Staged construction)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConstructionStage {
  id: number;
  name: string;
  duration: number; // days
  description: string;
  elements: {
    added: string[]; // Elements cast or erected
    activated: string[]; // Elements becoming active (shores removed)
    connections: string[]; // Connections made
  };
  loads: {
    selfWeight: boolean;
    construction: number; // kPa
    equipment: number; // kN (point loads)
    stacked: number; // kPa (stacked materials)
  };
  support: {
    shores: ShoreConfiguration[];
    reshores: ReshoreConfiguration[];
  };
}

export interface ShoreConfiguration {
  id: string;
  location: { x: number; y: number };
  levels: number; // Number of floors supported
  capacity: number; // kN per shore
  spacing: number; // mm
  stiffness: number; // kN/mm
}

export interface ReshoreConfiguration {
  id: string;
  level: number;
  preload: number; // kN per reshore
  spacing: number; // mm
}

export interface ConstructionLoadResult {
  stage: number;
  shoreLoads: { id: string; load: number; utilization: number }[];
  slabMoments: { level: number; moment: number; capacity: number }[];
  deflections: { level: number; deflection: number }[];
  concreteStresses: { level: number; stress: number; allowable: number }[];
  recommendations: string[];
}

export interface ConcreteMaturity {
  age: number; // hours
  temperature: number; // °C (average curing temp)
  maturity: number; // °C·hours
  strengthRatio: number; // f(t)/f28
  estimatedStrength: number; // MPa
}

export interface FormworkStripResult {
  canStrip: boolean;
  minimumAge: number; // days
  requiredStrength: number; // MPa
  achievedStrength: number; // MPa
  reshoreRequired: boolean;
  recommendations: string[];
}

// ============================================================================
// CONSTRUCTION LOADS (ASCE 37)
// ============================================================================

export class ConstructionLoads {
  /**
   * Minimum construction live loads per ASCE 37
   */
  static minimumLiveLoads(
    workType: 'light' | 'heavy' | 'concentrated',
    accessType: 'workers-only' | 'workers-materials' | 'motorized'
  ): { distributed: number; concentrated: number } {
    // ASCE 37 Table 2-1
    const loads: Record<string, Record<string, { d: number; c: number }>> = {
      'light': {
        'workers-only': { d: 1.0, c: 1.1 },
        'workers-materials': { d: 2.4, c: 2.2 },
        'motorized': { d: 3.6, c: 4.4 }
      },
      'heavy': {
        'workers-only': { d: 1.5, c: 2.2 },
        'workers-materials': { d: 3.6, c: 4.4 },
        'motorized': { d: 4.8, c: 6.6 }
      },
      'concentrated': {
        'workers-only': { d: 1.0, c: 1.1 },
        'workers-materials': { d: 2.4, c: 2.2 },
        'motorized': { d: 3.6, c: 4.4 }
      }
    };
    
    const result = loads[workType][accessType];
    return {
      distributed: result.d, // kPa
      concentrated: result.c // kN
    };
  }

  /**
   * Impact factors for construction equipment
   */
  static impactFactor(
    equipmentType: 'crane-hook' | 'motorized-equipment' | 'hoisting' | 'static'
  ): number {
    // ASCE 37 Section 2.3
    switch (equipmentType) {
      case 'crane-hook':
        return 1.25;
      case 'motorized-equipment':
        return 1.10;
      case 'hoisting':
        return 1.20;
      case 'static':
      default:
        return 1.00;
    }
  }

  /**
   * Wind loads during construction (reduced)
   */
  static constructionWindLoad(
    v_design: number, // m/s - design wind speed for permanent
    exposurePeriod: 'less-6-weeks' | '6-weeks-to-1-year' | 'over-1-year',
    recurrence: 10 | 25 | 50 = 25
  ): number {
    // ASCE 37 Section 2.4 - Reduction factors
    let factor: number;
    switch (exposurePeriod) {
      case 'less-6-weeks':
        factor = 0.75;
        break;
      case '6-weeks-to-1-year':
        factor = 0.80;
        break;
      case 'over-1-year':
        factor = 1.00;
        break;
    }
    
    // Recurrence adjustment
    const recurrenceFactor = Math.sqrt(recurrence / 50);
    
    return v_design * factor * recurrenceFactor;
  }

  /**
   * Stacked materials load
   */
  static stackedMaterialsLoad(
    material: 'lumber' | 'plywood' | 'steel-deck' | 'rebar' | 'concrete-blocks' | 'drywall',
    stackHeight: number // mm
  ): number {
    // Unit weights and typical stacking
    const materials: Record<string, { density: number; maxStack: number }> = {
      'lumber': { density: 5.0, maxStack: 2000 },
      'plywood': { density: 6.5, maxStack: 1500 },
      'steel-deck': { density: 0.15, maxStack: 3000 }, // kN/m² per layer
      'rebar': { density: 78.5, maxStack: 300 },
      'concrete-blocks': { density: 12.0, maxStack: 1500 },
      'drywall': { density: 0.10, maxStack: 1000 }
    };
    
    const mat = materials[material];
    const effectiveHeight = Math.min(stackHeight, mat.maxStack);
    
    return mat.density * effectiveHeight / 1000; // kPa
  }

  /**
   * Concrete placing load (horizontal component from pump)
   */
  static concretePlacingLoad(
    pumpType: 'boom-pump' | 'line-pump' | 'crane-bucket',
    deliveryRate: number // m³/hr
  ): { verticalImpact: number; horizontalReaction: number } {
    // Impact from discharge
    let verticalImpact: number;
    let horizontalReaction: number;
    
    switch (pumpType) {
      case 'boom-pump':
        // High velocity discharge
        verticalImpact = 2.0 + 0.02 * deliveryRate; // kN/m²
        horizontalReaction = 0.5 * deliveryRate; // kN
        break;
      case 'line-pump':
        verticalImpact = 1.5 + 0.015 * deliveryRate;
        horizontalReaction = 0.3 * deliveryRate;
        break;
      case 'crane-bucket':
        verticalImpact = 3.0; // Impact from dumping
        horizontalReaction = 0;
        break;
      default:
        verticalImpact = 2.0;
        horizontalReaction = 0.5 * deliveryRate;
    }

    return { verticalImpact, horizontalReaction };
  }
}

// ============================================================================
// SHORING AND RESHORING ANALYSIS
// ============================================================================

export class ShoringAnalysis {
  /**
   * Shore load distribution during multi-story construction
   * Grundy-Kabaila method
   */
  static shoreLoadDistribution(
    nLevelsShored: number, // Number of floors with shores
    nLevelsReshored: number, // Number of floors with reshores
    slabWeight: number, // kN/m² per slab
    constructionLoad: number, // kN/m² (workers, equipment)
    shoreStiffness: number, // Relative stiffness (1 = same as slab)
    slabAgeAtShoreRemoval: number[] // days for each level
  ): {
    shoreLoads: { level: number; load: number; maxLoad: number }[];
    slabLoads: { level: number; load: number; ratio: number }[];
    criticalLevel: number;
  } {
    const totalLevels = nLevelsShored + nLevelsReshored;
    const loads: { level: number; load: number; maxLoad: number }[] = [];
    const slabLoads: { level: number; load: number; ratio: number }[] = [];
    
    // Simplified Grundy-Kabaila coefficients
    // Maximum shore load occurs when pouring new slab
    const D = slabWeight;
    const L = constructionLoad;
    
    // Distribution depends on relative stiffness and number of shores
    for (let i = 1; i <= totalLevels; i++) {
      let shoreLoad: number;
      let maxShoreLoad: number;
      
      if (i <= nLevelsShored) {
        // Active shoring - carries portion of load
        const distribution = (nLevelsShored - i + 1) / nLevelsShored;
        shoreLoad = (D + L) * distribution / nLevelsShored;
        maxShoreLoad = (D + L) * (1 + 1 / (nLevelsShored + 1));
      } else {
        // Reshoring - provides stiffness only
        shoreLoad = 0.25 * D * (1 - (i - nLevelsShored) / nLevelsReshored);
        maxShoreLoad = 0.5 * D;
      }
      
      loads.push({
        level: i,
        load: shoreLoad,
        maxLoad: maxShoreLoad
      });
      
      // Slab load (what each slab must carry)
      const age = slabAgeAtShoreRemoval[i - 1] || 28;
      const strengthRatio = this.strengthDevelopment(age, 28);
      const slabLoad = D * (1 - 1 / (nLevelsShored + 1)) + L / (nLevelsShored + 1);
      
      slabLoads.push({
        level: i,
        load: slabLoad,
        ratio: slabLoad / (strengthRatio * D * 2) // vs. design capacity
      });
    }
    
    // Critical level (highest slab load ratio)
    let criticalLevel = 1;
    let maxRatio = 0;
    for (const s of slabLoads) {
      if (s.ratio > maxRatio) {
        maxRatio = s.ratio;
        criticalLevel = s.level;
      }
    }

    return { shoreLoads: loads, slabLoads, criticalLevel };
  }

  /**
   * Concrete strength development with age
   */
  static strengthDevelopment(
    age: number, // days
    designAge: number = 28, // days
    cementType: 'N' | 'R' | 'S' = 'N' // Normal, Rapid, Slow
  ): number {
    // ACI 209 / EC2 strength development
    const s: Record<string, number> = { 'R': 0.20, 'N': 0.25, 'S': 0.38 };
    const beta = Math.exp(s[cementType] * (1 - Math.sqrt(28 / age)));
    
    return beta; // f(t) / f28
  }

  /**
   * Single shore capacity check
   */
  static shoreCapacity(
    shoreType: 'steel-post' | 'aluminum' | 'timber' | 'frame',
    height: number, // mm
    extensionLength: number, // mm
    bracing: 'none' | 'single' | 'cross'
  ): { capacity: number; buckling: number; allowable: number } {
    // Typical capacities (simplified)
    const baseCapacities: Record<string, { P: number; EI: number }> = {
      'steel-post': { P: 40, EI: 2.5e9 },
      'aluminum': { P: 30, EI: 1.5e9 },
      'timber': { P: 15, EI: 0.5e9 },
      'frame': { P: 60, EI: 5.0e9 }
    };
    
    const props = baseCapacities[shoreType];
    const effectiveLength = height + extensionLength;
    
    // Effective length factor
    const K: Record<string, number> = { 'none': 1.0, 'single': 0.8, 'cross': 0.65 };
    const Le = K[bracing] * effectiveLength;
    
    // Euler buckling
    const Pcr = Math.PI * Math.PI * props.EI / (Le * Le) / 1000; // kN
    
    // Capacity reduction for slenderness
    const lambda = effectiveLength / 40; // Slenderness
    const phi = lambda < 1 ? 0.9 : 0.9 / (1 + 0.1 * (lambda - 1));
    
    return {
      capacity: props.P,
      buckling: Pcr,
      allowable: Math.min(phi * props.P, 0.5 * Pcr)
    };
  }

  /**
   * Reshoring preload calculation
   */
  static reshorePreload(
    slabDeflection: number, // mm - at time of reshoring
    reshoreStiffness: number, // kN/mm
    targetLoad: number // kN - desired support
  ): { preloadGap: number; jackForce: number; springBack: number } {
    // Gap to close for target preload
    const preloadGap = targetLoad / reshoreStiffness;
    
    // Jack force (account for springback)
    const springbackFactor = 0.1; // 10% loss
    const jackForce = targetLoad * (1 + springbackFactor);
    
    return {
      preloadGap,
      jackForce,
      springBack: targetLoad * springbackFactor
    };
  }
}

// ============================================================================
// STAGED CONSTRUCTION ANALYSIS
// ============================================================================

export class StagedConstructionAnalysis {
  private stages: ConstructionStage[];
  private memberForces: Map<string, { stage: number; forces: number[] }[]>;
  
  constructor() {
    this.stages = [];
    this.memberForces = new Map();
  }

  /**
   * Add construction stage
   */
  addStage(stage: ConstructionStage): void {
    this.stages.push(stage);
  }

  /**
   * Time-dependent analysis with creep redistribution
   */
  timeDepenentAnalysis(
    fc28: number, // MPa
    humidity: number, // %
    notionalSize: number // mm
  ): {
    stageResults: {
      stage: number;
      age: number;
      strengthRatio: number;
      creepCoefficient: number;
      shrinkageStrain: number;
      redistributionFactor: number;
    }[];
  } {
    let cumulativeAge = 0;
    const results: {
      stage: number;
      age: number;
      strengthRatio: number;
      creepCoefficient: number;
      shrinkageStrain: number;
      redistributionFactor: number;
    }[] = [];
    
    for (const stage of this.stages) {
      cumulativeAge += stage.duration;
      
      // Strength development
      const strengthRatio = ShoringAnalysis.strengthDevelopment(cumulativeAge);
      
      // Creep (simplified)
      const phi_RH = 1.5 * (1 - humidity / 100);
      const phi = 2.5 * phi_RH * (1 - Math.exp(-0.1 * cumulativeAge));
      
      // Shrinkage
      const eps_sh = 500e-6 * (1 - humidity / 100) * 
                     cumulativeAge / (cumulativeAge + 0.035 * notionalSize * notionalSize);
      
      // Redistribution factor (for continuous structures)
      const redistributionFactor = phi / (1 + 0.8 * phi);
      
      results.push({
        stage: stage.id,
        age: cumulativeAge,
        strengthRatio,
        creepCoefficient: phi,
        shrinkageStrain: eps_sh,
        redistributionFactor
      });
    }

    return { stageResults: results };
  }

  /**
   * Cable-stayed bridge construction sequence
   */
  static cableStayedSequence(
    nSegments: number,
    segmentLength: number, // m
    segmentWeight: number, // kN
    stayAngle: number, // degrees
    deckStiffness: number, // kN·m² (EI)
    pylonStiffness: number // kN/m (lateral)
  ): {
    segment: number;
    cableForce: number; // kN
    deckMoment: number; // kN·m
    pylonForce: number; // kN (horizontal)
    deflection: number; // mm
    camber: number; // mm (required precamber)
  }[] {
    const results: {
      segment: number;
      cableForce: number;
      deckMoment: number;
      pylonForce: number;
      deflection: number;
      camber: number;
    }[] = [];
    
    const stayAngleRad = stayAngle * Math.PI / 180;
    
    for (let i = 1; i <= nSegments; i++) {
      const cantileverLength = i * segmentLength;
      const totalWeight = i * segmentWeight;
      
      // Cable force to balance cantilever moment
      const moment = totalWeight * cantileverLength / 2;
      const leverArm = cantileverLength * Math.sin(stayAngleRad);
      const cableForce = moment / leverArm;
      
      // Horizontal component on pylon
      const pylonForce = cableForce * Math.cos(stayAngleRad);
      
      // Deck moment (maximum during erection)
      const deckMoment = totalWeight * segmentLength / 2; // Approximate
      
      // Deflection (cantilever)
      const deflection = totalWeight * 1000 * Math.pow(cantileverLength * 1000, 3) / 
                        (3 * deckStiffness * 1e9);
      
      // Camber (opposite of dead load deflection)
      const camber = -deflection * 1.1; // 10% extra for creep
      
      results.push({
        segment: i,
        cableForce,
        deckMoment,
        pylonForce,
        deflection,
        camber
      });
    }

    return results;
  }

  /**
   * Segmental bridge erection analysis
   */
  static segmentalErection(
    erectionMethod: 'balanced-cantilever' | 'span-by-span' | 'incremental-launch',
    segmentWeights: number[], // kN
    segmentLengths: number[], // m
    tendonForces: { segment: number; force: number }[],
    temporarySupports: { location: number; capacity: number }[]
  ): {
    segment: number;
    maxMoment: number;
    maxShear: number;
    stabilityRatio: number;
    tendonRequired: number;
    tempSupportReaction: number;
  }[] {
    const results: {
      segment: number;
      maxMoment: number;
      maxShear: number;
      stabilityRatio: number;
      tendonRequired: number;
      tempSupportReaction: number;
    }[] = [];
    
    if (erectionMethod === 'balanced-cantilever') {
      const cantileverMoment = 0;
      const cantileverShear = 0;
      
      for (let i = 0; i < segmentWeights.length; i++) {
        const W = segmentWeights[i];
        const L = segmentLengths[i];
        
        // Moment from all previous segments
        let M = 0;
        let V = 0;
        for (let j = 0; j <= i; j++) {
          const arm = segmentLengths.slice(j, i + 1).reduce((a, b) => a + b, 0) - L / 2;
          M += segmentWeights[j] * arm;
          V += segmentWeights[j];
        }
        
        // Tendon to balance
        const tendon = tendonForces.find(t => t.segment === i);
        const P = tendon ? tendon.force : 0;
        const e = 0.4 * L; // Eccentricity estimate
        const M_net = M - P * e;
        
        // Stability (overturning vs. restoring)
        const overturning = M;
        const restoring = temporarySupports[0]?.capacity * L || W * L / 2;
        
        results.push({
          segment: i + 1,
          maxMoment: M,
          maxShear: V,
          stabilityRatio: restoring / Math.max(overturning, 1),
          tendonRequired: M / e,
          tempSupportReaction: V / 2
        });
      }
    }

    return results;
  }
}

// ============================================================================
// CONCRETE MATURITY
// ============================================================================

export class ConcreteMaturity {
  /**
   * Nurse-Saul maturity function
   */
  static nurseSaul(
    temperatures: number[], // °C at each time step
    timeStep: number, // hours
    datumTemperature: number = -10 // °C
  ): { maturity: number; equivalentAge: number } {
    let maturity = 0;
    
    for (const T of temperatures) {
      if (T > datumTemperature) {
        maturity += (T - datumTemperature) * timeStep;
      }
    }
    
    // Equivalent age at 20°C
    const equivalentAge = maturity / (20 - datumTemperature);

    return { maturity, equivalentAge };
  }

  /**
   * Arrhenius maturity function (more accurate)
   */
  static arrhenius(
    temperatures: number[], // °C at each time step
    timeStep: number, // hours
    activationEnergy: number = 33500 // J/mol (typical for cement)
  ): { equivalentAge: number; maturity: number } {
    const R = 8.314; // J/(mol·K)
    const Tref = 293; // 20°C in Kelvin
    
    let equivalentAge = 0;
    
    for (const T of temperatures) {
      const Tk = T + 273;
      const factor = Math.exp(activationEnergy / R * (1 / Tref - 1 / Tk));
      equivalentAge += factor * timeStep;
    }
    
    const maturity = equivalentAge * (20 + 10); // Approximate Nurse-Saul equivalent

    return { equivalentAge, maturity };
  }

  /**
   * Strength from maturity
   */
  static strengthFromMaturity(
    maturity: number, // °C·hours
    fc28: number, // MPa - 28-day strength
    a: number = 0.5, // Rate constant
    b: number = 0.9 // Ultimate strength ratio
  ): { strength: number; ratio: number } {
    // Plowman's function
    const M28 = 28 * 24 * 30; // Approximate 28-day maturity at 20°C
    
    const strength = fc28 * b * (1 - Math.exp(-a * Math.sqrt(maturity / M28)));
    const ratio = strength / fc28;

    return { strength, ratio };
  }

  /**
   * Required curing time for target strength
   */
  static requiredCuringTime(
    targetStrength: number, // MPa
    fc28: number, // MPa
    averageTemperature: number // °C
  ): { hours: number; days: number } {
    const ratio = targetStrength / fc28;
    
    if (ratio >= 1) {
      return { hours: 28 * 24, days: 28 };
    }
    
    // Solve maturity equation
    const beta = Math.exp(0.25 * (1 - Math.sqrt(28 * 24 * averageTemperature / 
                 (averageTemperature + 10))));
    
    // Approximate time
    const hours = Math.pow(Math.log(1 - ratio) / (-0.5), 2) * 28 * 24 * 
                  30 / ((averageTemperature + 10) * 24);

    return {
      hours: Math.ceil(hours),
      days: Math.ceil(hours / 24)
    };
  }
}

// ============================================================================
// FORMWORK STRIPPING
// ============================================================================

export class FormworkStripping {
  /**
   * Minimum stripping times per ACI 347
   */
  static minimumTimeACI(
    memberType: 'slab' | 'beam-bottom' | 'beam-sides' | 'column' | 'wall',
    supportCondition: 'shores-remain' | 'shores-removed'
  ): { days: number; notes: string } {
    // ACI 347 Table 4.1 (ASTM C150 Type I cement, normal conditions)
    const times: Record<string, Record<string, { d: number; n: string }>> = {
      'wall': {
        'shores-remain': { d: 0.5, n: '12 hours' },
        'shores-removed': { d: 0.5, n: '12 hours' }
      },
      'column': {
        'shores-remain': { d: 0.5, n: '12 hours' },
        'shores-removed': { d: 0.5, n: '12 hours' }
      },
      'beam-sides': {
        'shores-remain': { d: 0.5, n: '12 hours' },
        'shores-removed': { d: 0.5, n: '12 hours' }
      },
      'slab': {
        'shores-remain': { d: 3, n: '3 days with shores' },
        'shores-removed': { d: 14, n: '14 days without shores' }
      },
      'beam-bottom': {
        'shores-remain': { d: 7, n: '7 days with shores' },
        'shores-removed': { d: 21, n: '21 days without shores' }
      }
    };

    const result = times[memberType][supportCondition];
    return { days: result.d, notes: result.n };
  }

  /**
   * Stripping criteria based on strength
   */
  static strengthBasedStripping(
    memberType: 'slab' | 'beam' | 'cantilever',
    fc28: number, // MPa
    currentStrength: number, // MPa
    span: number, // mm
    selfWeight: number, // kN/m²
    constructionLoad: number // kN/m²
  ): FormworkStripResult {
    // Required strength for safe stripping
    let requiredRatio: number;
    
    switch (memberType) {
      case 'cantilever':
        requiredRatio = 0.85; // 85% of design strength
        break;
      case 'beam':
        requiredRatio = 0.75;
        break;
      case 'slab':
      default:
        requiredRatio = 0.70;
    }
    
    const requiredStrength = fc28 * requiredRatio;
    const strengthOK = currentStrength >= requiredStrength;
    
    // Also check stress at stripping
    const moment = (selfWeight + constructionLoad) * span * span / 8 / 1e6; // kN·m/m
    const f_b = moment * 1e6 / (1000 * 100 * 100 / 6); // Rough stress check
    const stressOK = f_b < 0.6 * currentStrength;
    
    const canStrip = strengthOK && stressOK;
    
    // Minimum age estimate
    const age = 28 * Math.pow(currentStrength / fc28, 2);
    
    return {
      canStrip,
      minimumAge: canStrip ? Math.ceil(age) : Math.ceil(age * requiredRatio / (currentStrength / fc28)),
      requiredStrength,
      achievedStrength: currentStrength,
      reshoreRequired: !strengthOK && memberType !== 'slab',
      recommendations: [
        canStrip ? 'Formwork can be stripped' : 'Continue curing',
        strengthOK ? `Strength ${(currentStrength/fc28*100).toFixed(0)}% OK` : 
                     `Need ${(requiredRatio*100).toFixed(0)}% strength`,
        stressOK ? 'Stress check OK' : 'Install reshores before stripping'
      ]
    };
  }

  /**
   * Hot/cold weather adjustments
   */
  static weatherAdjustment(
    baseTime: number, // days
    averageTemperature: number // °C
  ): { adjustedTime: number; factor: number } {
    // Temperature factor
    let factor: number;
    
    if (averageTemperature < 5) {
      // Cold weather - significant delay
      factor = 2.0 + (5 - averageTemperature) * 0.2;
    } else if (averageTemperature < 10) {
      factor = 1.5;
    } else if (averageTemperature < 15) {
      factor = 1.2;
    } else if (averageTemperature < 25) {
      factor = 1.0;
    } else if (averageTemperature < 30) {
      factor = 0.9;
    } else {
      factor = 0.8; // Hot weather accelerates
    }

    return {
      adjustedTime: baseTime * factor,
      factor
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ConstructionLoads,
  ShoringAnalysis,
  StagedConstructionAnalysis,
  ConcreteMaturity,
  FormworkStripping
};
