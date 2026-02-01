/**
 * ============================================================================
 * PROGRESSIVE COLLAPSE ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive progressive collapse resistance design:
 * - Alternate Load Path (ALP) analysis
 * - Tie force method
 * - Key element design
 * - Enhanced local resistance
 * - Nonlinear dynamic analysis
 * - Catenary action
 * 
 * Design Codes Supported:
 * - GSA 2013/2016 (General Services Administration)
 * - UFC 4-023-03 (Unified Facilities Criteria)
 * - EN 1991-1-7 (Eurocode - Accidental actions)
 * - BS 8110 / BS EN 1992 (Tie requirements)
 * - DOD (Department of Defense)
 * - ASCE 7 (Extraordinary events)
 * - ACI 318 Appendix A.10 (Structural integrity)
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BuildingData {
  occupancy: 'residential' | 'commercial' | 'government' | 'critical' | 'assembly';
  height: number; // m
  stories: number;
  plan: {
    length: number; // m
    width: number; // m
    bays: { x: number; y: number }; // Number of bays
    baySpacing: { x: number; y: number }; // m
  };
  structuralSystem: 'moment-frame' | 'braced-frame' | 'shear-wall' | 
                    'flat-plate' | 'flat-slab' | 'precast' | 'bearing-wall';
  materials: {
    concrete?: { fc: number; fy: number }; // MPa
    steel?: { Fy: number; Fu: number }; // MPa
  };
}

export interface ColumnRemovalScenario {
  location: 'corner' | 'edge' | 'interior' | 'parking';
  floor: number;
  position: { x: number; y: number }; // Grid position
  removalMethod: 'instantaneous' | 'gradual';
  tributaryArea: number; // m²
  loads: {
    dead: number; // kN/m²
    live: number; // kN/m²
  };
}

export interface TieForceRequirements {
  code: string;
  
  // Peripheral ties
  peripheralTie: {
    location: 'perimeter-beams' | 'perimeter-slab';
    force: number; // kN
    continuity: string;
  };
  
  // Internal ties
  internalTie: {
    direction: string;
    force: number; // kN/m
    spacing: number; // m
    totalForce: number; // kN per bay
  };
  
  // Column/wall ties
  columnTie?: {
    force: number; // kN per floor
    anchorage: string;
  };
  
  // Vertical ties
  verticalTie?: {
    force: number; // kN
    continuity: number; // stories
  };
}

export interface ALPResult {
  scenario: ColumnRemovalScenario;
  method: 'linear-static' | 'nonlinear-static' | 'nonlinear-dynamic';
  
  // Demand-capacity ratios
  DCRatios: {
    member: string;
    type: 'beam' | 'column' | 'slab' | 'connection';
    flexure: number;
    shear: number;
    axial: number;
    combined: number;
    acceptable: boolean;
  }[];
  
  // Deflections
  deflections: {
    location: string;
    vertical: number; // mm
    allowable: number; // mm
    acceptable: boolean;
  }[];
  
  // Connection forces
  connectionForces: {
    connection: string;
    moment: number; // kN·m
    shear: number; // kN
    axial: number; // kN (tension positive)
    rotation: number; // rad
    adequate: boolean;
  }[];
  
  // Overall result
  bridgesGap: boolean;
  collapseArea: number; // m² (area of additional collapse beyond removed element)
  recommendations: string[];
}

export interface KeyElementDesign {
  element: 'column' | 'wall' | 'transfer-beam';
  location: string;
  
  // Enhanced design requirements
  designLoad: number; // kN (accidental load)
  designMoment?: number; // kN·m
  
  // Capacity requirements
  requiredStrength: number; // kN
  existingStrength: number; // kN
  adequacy: number; // ratio
  
  // Protection measures
  protectionMeasures: string[];
}

export interface CatenaryAnalysis {
  beam: {
    span: number; // m
    area: number; // mm²
    yieldStrength: number; // MPa
  };
  
  // Catenary behavior
  sag: number; // m
  tension: number; // kN
  elongation: number; // mm
  
  // Connection demands
  connectionTension: number; // kN
  connectionRotation: number; // rad
  
  // Adequacy
  catenaryAdequate: boolean;
  connectionAdequate: boolean;
  recommendations: string[];
}

// ============================================================================
// GSA/UFC ANALYSIS PARAMETERS
// ============================================================================

export class ProgressiveCollapseParameters {
  /**
   * Load combinations for progressive collapse per UFC 4-023-03
   */
  static loadCombination(
    code: 'GSA-2013' | 'UFC-4-023-03' | 'EN-1991-1-7',
    analysisMethod: 'linear-static' | 'nonlinear-static' | 'nonlinear-dynamic'
  ): {
    deadFactor: number;
    liveFactor: number;
    dynamicIncreaseFactor: number;
    loadCombination: string;
  } {
    switch (code) {
      case 'GSA-2013':
        // GSA 2013 load combination
        if (analysisMethod === 'linear-static') {
          return {
            deadFactor: 2.0,
            liveFactor: 1.0, // 25% of design live load
            dynamicIncreaseFactor: 2.0,
            loadCombination: 'G_LD = 2(D + 0.25L)'
          };
        } else if (analysisMethod === 'nonlinear-static') {
          return {
            deadFactor: 2.0,
            liveFactor: 0.5,
            dynamicIncreaseFactor: 2.0,
            loadCombination: 'G_N = Ω_LD(D + 0.5L)'
          };
        } else {
          return {
            deadFactor: 1.0,
            liveFactor: 0.25,
            dynamicIncreaseFactor: 1.0,
            loadCombination: 'G_ND = (D + 0.25L)'
          };
        }
        
      case 'UFC-4-023-03':
        // UFC load combination
        if (analysisMethod === 'linear-static') {
          return {
            deadFactor: 2.0,
            liveFactor: 1.0,
            dynamicIncreaseFactor: 2.0,
            loadCombination: 'G_LD = Ω_LD[1.2D + (0.5L or 0.2S)]'
          };
        } else if (analysisMethod === 'nonlinear-static') {
          return {
            deadFactor: 1.2,
            liveFactor: 0.5,
            dynamicIncreaseFactor: 2.0, // Applied separately
            loadCombination: 'G_N = Ω_N[1.2D + (0.5L or 0.2S)]'
          };
        } else {
          return {
            deadFactor: 1.2,
            liveFactor: 0.5,
            dynamicIncreaseFactor: 1.0,
            loadCombination: 'G_ND = 1.2D + (0.5L or 0.2S)'
          };
        }
        
      case 'EN-1991-1-7':
        return {
          deadFactor: 1.0,
          liveFactor: 0.5, // ψ₂ factor
          dynamicIncreaseFactor: 1.0,
          loadCombination: 'Ad = Gk + ψ₂Qk'
        };
        
      default:
        return {
          deadFactor: 1.2,
          liveFactor: 0.5,
          dynamicIncreaseFactor: 2.0,
          loadCombination: '1.2D + 0.5L'
        };
    }
  }

  /**
   * Dynamic increase factor for nonlinear static analysis
   */
  static dynamicIncreaseFactor(
    memberType: 'steel-beam' | 'steel-column' | 'rc-beam' | 'rc-column' | 'rc-slab',
    DCR: number, // Demand-capacity ratio without DIF
    ductility: number = 2.0
  ): number {
    // UFC 4-023-03 Table 3-2
    const Ω_N_table: Record<string, { low: number; high: number }> = {
      'steel-beam': { low: 1.04, high: 1.08 },
      'steel-column': { low: 1.04, high: 1.08 },
      'rc-beam': { low: 1.04, high: 1.10 },
      'rc-column': { low: 1.08, high: 1.16 },
      'rc-slab': { low: 1.04, high: 1.10 }
    };
    
    const factors = Ω_N_table[memberType] || { low: 1.05, high: 1.10 };
    
    // Interpolate based on ductility demand
    if (DCR <= 1.0) {
      return factors.low;
    } else if (DCR >= 2.0) {
      return factors.high;
    } else {
      return factors.low + (factors.high - factors.low) * (DCR - 1.0);
    }
  }

  /**
   * Acceptance criteria for DCR per UFC
   */
  static acceptanceCriteria(
    memberType: 'steel-beam' | 'steel-column' | 'rc-beam' | 'rc-column' | 'rc-slab',
    actionType: 'flexure' | 'shear' | 'combined',
    analysisMethod: 'linear-static' | 'nonlinear-static' | 'nonlinear-dynamic',
    detailing: 'ordinary' | 'intermediate' | 'special' = 'intermediate'
  ): {
    DCRLimit: number;
    description: string;
  } {
    if (analysisMethod === 'linear-static') {
      // DCR limits per UFC Table 3-1
      const limits: Record<string, Record<string, number>> = {
        'steel-beam': { flexure: 3.0, shear: 1.5, combined: 2.0 },
        'steel-column': { flexure: 2.0, shear: 1.5, combined: 1.5 },
        'rc-beam': { flexure: 4.0, shear: 2.0, combined: 3.0 },
        'rc-column': { flexure: 3.0, shear: 2.0, combined: 2.0 },
        'rc-slab': { flexure: 4.0, shear: 2.0, combined: 3.0 }
      };
      
      const detailFactor = detailing === 'special' ? 1.2 : detailing === 'ordinary' ? 0.8 : 1.0;
      
      return {
        DCRLimit: (limits[memberType]?.[actionType] || 2.0) * detailFactor,
        description: 'Linear static DCR limit'
      };
    } else if (analysisMethod === 'nonlinear-static') {
      // Ductility/rotation limits
      return {
        DCRLimit: detailing === 'special' ? 1.5 : 1.0,
        description: 'Deformation within plastic rotation limits'
      };
    } else {
      return {
        DCRLimit: 1.0,
        description: 'Dynamic analysis with acceptance per component criteria'
      };
    }
  }
}

// ============================================================================
// TIE FORCE ANALYSIS
// ============================================================================

export class TieForceAnalysis {
  /**
   * Calculate tie forces per UFC 4-023-03
   */
  static ufcTieForces(
    building: BuildingData,
    loads: { dead: number; live: number } // kN/m²
  ): TieForceRequirements {
    const wF = loads.dead + 0.5 * loads.live; // Floor load
    const L1 = building.plan.baySpacing.x; // m
    const L2 = building.plan.baySpacing.y; // m
    
    // Peripheral tie force
    const F_p = Math.max(wF * L1 * L2 / 4, 20); // kN, minimum 20 kN
    
    // Internal tie force
    const F_i = wF * Math.max(L1, L2); // kN/m
    
    // Column tie force (each direction)
    const F_col = 2 * wF * Math.max(L1, L2) * (building.height / building.stories); // kN
    
    // Vertical tie force
    const F_v = wF * L1 * L2; // kN per column

    return {
      code: 'UFC 4-023-03',
      peripheralTie: {
        location: 'perimeter-beams',
        force: F_p,
        continuity: 'Continuous around perimeter'
      },
      internalTie: {
        direction: 'Both orthogonal directions',
        force: F_i,
        spacing: Math.min(L1, L2),
        totalForce: F_i * Math.max(L1, L2)
      },
      columnTie: {
        force: F_col,
        anchorage: 'Develop into floor system above and below'
      },
      verticalTie: {
        force: F_v,
        continuity: building.stories
      }
    };
  }

  /**
   * Calculate tie forces per Eurocode EN 1991-1-7
   */
  static eurocodeTieForces(
    building: BuildingData,
    loads: { dead: number; live: number }, // kN/m²
    consequenceClass: 'CC1' | 'CC2a' | 'CC2b' | 'CC3'
  ): TieForceRequirements {
    // Risk category determines requirements
    const riskCategory = consequenceClass === 'CC3' ? 'high' : 
                        consequenceClass === 'CC2b' ? 'upper-medium' :
                        consequenceClass === 'CC2a' ? 'lower-medium' : 'low';
    
    const wF = loads.dead + 0.5 * loads.live;
    const L = Math.max(building.plan.baySpacing.x, building.plan.baySpacing.y);
    const h = building.height / building.stories;
    
    // Peripheral tie
    const F_t = Math.max(20, wF * L);
    
    // Internal tie (Table A.1 EN 1991-1-7)
    const F_i = 0.8 * (loads.dead + loads.live) * L * 0.5 * (L + 5);

    return {
      code: 'EN 1991-1-7',
      peripheralTie: {
        location: 'perimeter-beams',
        force: F_t,
        continuity: 'Anchored at corners and changes of direction'
      },
      internalTie: {
        direction: 'Both directions at each floor',
        force: F_i / L,
        spacing: Math.min(building.plan.baySpacing.x, building.plan.baySpacing.y),
        totalForce: F_i
      },
      columnTie: {
        force: F_i,
        anchorage: 'Connect to floor or roof diaphragm'
      }
    };
  }

  /**
   * Design reinforcement for tie forces
   */
  static designTieReinforcement(
    tieForce: number, // kN
    fy: number = 500, // MPa
    phi: number = 0.9
  ): {
    requiredArea: number; // mm²
    suggestedBars: string;
    development: number; // mm (development length)
  } {
    const As = tieForce * 1000 / (phi * fy);
    
    // Suggest bars
    let suggestedBars: string;
    if (As < 400) {
      suggestedBars = '2 - 16φ (402 mm²)';
    } else if (As < 600) {
      suggestedBars = '2 - 20φ (628 mm²)';
    } else if (As < 1000) {
      suggestedBars = '2 - 25φ (982 mm²)';
    } else if (As < 1500) {
      suggestedBars = '3 - 25φ (1473 mm²)';
    } else {
      suggestedBars = `${Math.ceil(As / 500)} - 25φ (${Math.ceil(As / 500) * 491} mm²)`;
    }
    
    // Development length (simplified)
    const ld = 40 * 25; // 40 bar diameters for 25mm bar

    return {
      requiredArea: Math.ceil(As),
      suggestedBars,
      development: ld
    };
  }
}

// ============================================================================
// ALTERNATE LOAD PATH ANALYSIS
// ============================================================================

export class AlternateLoadPath {
  /**
   * Setup column removal scenarios per UFC
   */
  static columnRemovalScenarios(
    building: BuildingData
  ): ColumnRemovalScenario[] {
    const scenarios: ColumnRemovalScenario[] = [];
    const bayX = building.plan.baySpacing.x;
    const bayY = building.plan.baySpacing.y;
    
    // Corner columns - always critical
    scenarios.push({
      location: 'corner',
      floor: 1,
      position: { x: 0, y: 0 },
      removalMethod: 'instantaneous',
      tributaryArea: bayX * bayY / 4,
      loads: { dead: 5, live: 2 }
    });
    
    // Edge columns - most critical edge
    scenarios.push({
      location: 'edge',
      floor: 1,
      position: { x: 1, y: 0 },
      removalMethod: 'instantaneous',
      tributaryArea: bayX * bayY / 2,
      loads: { dead: 5, live: 2 }
    });
    
    // Interior columns - if larger area
    if (building.plan.bays.x > 2 && building.plan.bays.y > 2) {
      scenarios.push({
        location: 'interior',
        floor: 1,
        position: { x: 1, y: 1 },
        removalMethod: 'instantaneous',
        tributaryArea: bayX * bayY,
        loads: { dead: 5, live: 2 }
      });
    }
    
    // Parking level if present
    if (building.occupancy === 'commercial' || building.occupancy === 'residential') {
      scenarios.push({
        location: 'parking',
        floor: 0,
        position: { x: 1, y: 1 },
        removalMethod: 'instantaneous',
        tributaryArea: bayX * bayY,
        loads: { dead: 5, live: 2.5 }
      });
    }

    return scenarios;
  }

  /**
   * Linear static analysis (simplified)
   */
  static linearStaticAnalysis(
    scenario: ColumnRemovalScenario,
    building: BuildingData,
    memberCapacities: {
      beamMoment: number; // kN·m
      beamShear: number; // kN
      columnAxial: number; // kN
    }
  ): ALPResult {
    const DIF = 2.0; // Dynamic increase factor
    const loadCombo = ProgressiveCollapseParameters.loadCombination('UFC-4-023-03', 'linear-static');
    
    // Calculate demands
    const load = DIF * (loadCombo.deadFactor * scenario.loads.dead + 
                        loadCombo.liveFactor * scenario.loads.live);
    
    const bayX = building.plan.baySpacing.x;
    const bayY = building.plan.baySpacing.y;
    
    // Double-span beam analysis after column removal
    const doubleSpan = scenario.location === 'interior' ? 2 * bayX : bayX;
    
    // Approximate demands
    const momentDemand = load * scenario.tributaryArea * doubleSpan / 8 * 
                        (building.stories - scenario.floor);
    const shearDemand = load * scenario.tributaryArea * (building.stories - scenario.floor) / 2;
    
    // DCR calculations
    const DCRatios: ALPResult['DCRatios'] = [
      {
        member: `Beam at removed column`,
        type: 'beam',
        flexure: momentDemand / memberCapacities.beamMoment,
        shear: shearDemand / memberCapacities.beamShear,
        axial: 0.1,
        combined: momentDemand / memberCapacities.beamMoment,
        acceptable: momentDemand / memberCapacities.beamMoment <= 3.0
      },
      {
        member: `Adjacent column`,
        type: 'column',
        flexure: 0.5,
        shear: 0.3,
        axial: shearDemand * 2 / memberCapacities.columnAxial,
        combined: shearDemand * 2 / memberCapacities.columnAxial + 0.5,
        acceptable: shearDemand * 2 / memberCapacities.columnAxial <= 1.0
      }
    ];
    
    // Deflection check
    const expectedDeflection = load * Math.pow(doubleSpan * 1000, 3) / 
                               (185 * 200000 * 1e9) * 1e6;
    const allowableDeflection = doubleSpan * 1000 / 20;
    
    const deflections: ALPResult['deflections'] = [{
      location: 'At removed column',
      vertical: expectedDeflection,
      allowable: allowableDeflection,
      acceptable: expectedDeflection <= allowableDeflection
    }];
    
    // Connection forces
    const connectionForces: ALPResult['connectionForces'] = [{
      connection: 'Beam-to-column at removed location',
      moment: momentDemand * 0.7,
      shear: shearDemand,
      axial: momentDemand / (building.height / building.stories) * 0.1,
      rotation: expectedDeflection / (doubleSpan * 1000) * 2,
      adequate: true
    }];
    
    // Overall assessment
    const bridgesGap = DCRatios.every(d => d.acceptable) && 
                       deflections.every(d => d.acceptable);
    
    const recommendations: string[] = [];
    if (!bridgesGap) {
      recommendations.push('Consider enhancing beam capacity at removed column location');
      recommendations.push('Verify connection can develop catenary action');
      if (DCRatios[0].flexure > 2.0) {
        recommendations.push('Increase negative moment reinforcement');
      }
    }

    return {
      scenario,
      method: 'linear-static',
      DCRatios,
      deflections,
      connectionForces,
      bridgesGap,
      collapseArea: bridgesGap ? 0 : scenario.tributaryArea * (building.stories - scenario.floor),
      recommendations
    };
  }

  /**
   * Nonlinear dynamic analysis parameters
   */
  static nonlinearDynamicParameters(
    scenario: ColumnRemovalScenario
  ): {
    removalTime: number; // ms
    analysisTime: number; // ms
    timestep: number; // ms
    dampingRatio: number;
    massParticipation: number;
  } {
    return {
      removalTime: scenario.removalMethod === 'instantaneous' ? 10 : 100,
      analysisTime: 2000, // 2 seconds
      timestep: 0.5, // 0.5 ms
      dampingRatio: 0.05, // 5% damping
      massParticipation: 0.9 // 90% mass participation
    };
  }
}

// ============================================================================
// CATENARY ACTION
// ============================================================================

export class CatenaryAction {
  /**
   * Calculate catenary capacity of beam
   */
  static beamCatenaryCapacity(
    span: number, // m
    reinforcement: {
      area: number; // mm² (total)
      fy: number; // MPa (yield)
      fu: number; // MPa (ultimate)
    },
    supportedLoad: number, // kN/m
    connectionCapacity?: {
      tension: number; // kN
      rotation: number; // rad
    }
  ): CatenaryAnalysis {
    const L = span;
    const w = supportedLoad;
    const As = reinforcement.area;
    const fy = reinforcement.fy;
    const fu = reinforcement.fu;
    
    // Maximum catenary tension (at ultimate)
    const T_max = As * fu / 1000; // kN
    
    // Sag for catenary equilibrium: T = wL²/(8δ)
    // δ = wL²/(8T)
    const sag = w * L * L / (8 * T_max);
    
    // Check if sag is reasonable (typically < L/5)
    const maxSag = L / 5;
    const effectiveSag = Math.min(sag, maxSag);
    
    // Actual tension at effective sag
    const T_actual = w * L * L / (8 * effectiveSag);
    
    // Elongation (strain)
    const Es = 200000; // MPa
    const strain_y = fy / Es;
    const strain_u = 0.05; // 5% ultimate strain
    
    // Length of catenary curve ≈ L + 8δ²/(3L)
    const catenaryLength = L + 8 * effectiveSag * effectiveSag / (3 * L);
    const elongation = (catenaryLength - L) * 1000; // mm
    const requiredStrain = (catenaryLength - L) / L;
    
    // Connection rotation
    const connectionRotation = Math.atan(2 * effectiveSag / L);
    
    // Connection tension (horizontal component)
    const connectionTension = T_actual;
    
    // Adequacy checks
    const catenaryAdequate = T_actual <= T_max && requiredStrain <= strain_u;
    
    let connectionAdequate = true;
    const recommendations: string[] = [];
    
    if (connectionCapacity) {
      connectionAdequate = connectionCapacity.tension >= connectionTension &&
                          connectionCapacity.rotation >= connectionRotation;
      
      if (!connectionAdequate) {
        recommendations.push('Increase connection tension capacity');
        recommendations.push('Ensure sufficient rotation capacity at connections');
      }
    } else {
      recommendations.push('Verify connection can develop ' + 
                          Math.ceil(connectionTension) + ' kN tension');
      recommendations.push('Required rotation capacity: ' + 
                          (connectionRotation * 180 / Math.PI).toFixed(1) + '°');
    }
    
    if (!catenaryAdequate) {
      recommendations.push('Increase longitudinal reinforcement continuity');
      recommendations.push('Consider mechanical splices for bar continuity');
    }

    return {
      beam: {
        span,
        area: As,
        yieldStrength: fy
      },
      sag: effectiveSag,
      tension: T_actual,
      elongation,
      connectionTension,
      connectionRotation,
      catenaryAdequate,
      connectionAdequate,
      recommendations
    };
  }

  /**
   * Design for catenary action
   */
  static designForCatenary(
    span: number, // m
    load: number, // kN/m (factored)
    fy: number = 500, // MPa
    phi: number = 0.75
  ): {
    requiredArea: number; // mm²
    minimumElongation: number; // %
    requiredRotation: number; // rad
    connectionDesignTension: number; // kN
  } {
    const L = span;
    const w = load;
    
    // Assume maximum sag of L/10
    const sag = L / 10;
    
    // Required tension
    const T = w * L * L / (8 * sag);
    
    // Required area
    const requiredArea = T * 1000 / (phi * fy);
    
    // Minimum elongation
    const catenaryLength = L + 8 * sag * sag / (3 * L);
    const minimumElongation = (catenaryLength - L) / L * 100;
    
    // Rotation
    const requiredRotation = Math.atan(2 * sag / L);

    return {
      requiredArea: Math.ceil(requiredArea),
      minimumElongation,
      requiredRotation,
      connectionDesignTension: Math.ceil(T / phi)
    };
  }
}

// ============================================================================
// KEY ELEMENT DESIGN
// ============================================================================

export class KeyElementDesign {
  /**
   * Identify key elements per EN 1991-1-7
   */
  static identifyKeyElements(
    building: BuildingData
  ): {
    element: string;
    reason: string;
    consequenceArea: number; // m²
  }[] {
    const keyElements: { element: string; reason: string; consequenceArea: number }[] = [];
    
    const bayArea = building.plan.baySpacing.x * building.plan.baySpacing.y;
    const floorArea = building.plan.length * building.plan.width;
    
    // Corner columns
    keyElements.push({
      element: 'Corner columns (ground floor)',
      reason: 'Removal causes progressive failure of corner bays',
      consequenceArea: bayArea * building.stories
    });
    
    // Transfer elements
    if (building.structuralSystem === 'flat-plate' || 
        building.structuralSystem === 'flat-slab') {
      keyElements.push({
        element: 'Interior columns with large tributary area',
        reason: 'Flat slab punching shear propagation risk',
        consequenceArea: 4 * bayArea * building.stories
      });
    }
    
    // Perimeter columns in shear wall buildings
    if (building.structuralSystem === 'shear-wall') {
      keyElements.push({
        element: 'Perimeter columns between shear walls',
        reason: 'Limited alternate load path between walls',
        consequenceArea: 2 * bayArea * building.stories
      });
    }
    
    // Long span elements
    const maxSpan = Math.max(building.plan.baySpacing.x, building.plan.baySpacing.y);
    if (maxSpan > 9) {
      keyElements.push({
        element: 'Columns supporting long-span beams/girders',
        reason: 'Long span limits redistribution capacity',
        consequenceArea: maxSpan * 6 * building.stories
      });
    }

    return keyElements;
  }

  /**
   * Design key element for notional accidental load
   */
  static designKeyElement(
    columnArea: number, // mm²
    fc: number, // MPa (concrete)
    fy: number, // MPa (steel)
    rho: number, // reinforcement ratio
    accidentalLoad: number = 34 // kN/m² (EN 1991-1-7 default)
  ): KeyElementDesign {
    // Notional accidental load
    const Ad = accidentalLoad; // kN/m² applied to column face
    
    // Column dimensions (assume square)
    const b = Math.sqrt(columnArea);
    
    // Applied horizontal force
    const H = Ad * b * b / 1e6; // kN
    
    // Column axial capacity
    const Ac = columnArea;
    const As = rho * Ac;
    const N_Rd = 0.85 * fc * Ac / 1000 + fy * As / 1000; // kN
    
    // Existing strength
    const existingStrength = N_Rd;
    
    // Required strength with accidental
    const requiredStrength = N_Rd * 1.1; // 10% additional
    
    const protectionMeasures: string[] = [];
    if (existingStrength < requiredStrength) {
      protectionMeasures.push('Increase column reinforcement');
      protectionMeasures.push('Consider steel jacket');
    } else {
      protectionMeasures.push('Provide vehicle barrier if at risk');
      protectionMeasures.push('Consider concrete protection');
    }

    return {
      element: 'column',
      location: 'To be specified',
      designLoad: H,
      requiredStrength,
      existingStrength,
      adequacy: existingStrength / requiredStrength,
      protectionMeasures
    };
  }
}

// ============================================================================
// DISPROPORTIONATE COLLAPSE RISK ASSESSMENT
// ============================================================================

export class CollapseRiskAssessment {
  /**
   * Risk category per UFC 4-023-03
   */
  static ufcRiskCategory(
    occupancy: BuildingData['occupancy'],
    stories: number,
    floorArea: number // m²
  ): {
    category: 'I' | 'II' | 'III' | 'IV';
    requirements: string[];
  } {
    // Based on UFC Table 2-1
    let category: 'I' | 'II' | 'III' | 'IV';
    const requirements: string[] = [];
    
    if (occupancy === 'critical') {
      category = 'IV';
      requirements.push('Enhanced Local Resistance (ELR) required');
      requirements.push('Alternate Load Path (ALP) for all perimeter and interior locations');
    } else if (occupancy === 'government' || occupancy === 'assembly') {
      if (stories > 3 || floorArea > 1000) {
        category = 'III';
        requirements.push('Tie Forces required');
        requirements.push('Alternate Load Path for all ground floor columns');
      } else {
        category = 'II';
        requirements.push('Tie Forces required');
      }
    } else if (occupancy === 'commercial') {
      if (stories > 3) {
        category = 'III';
        requirements.push('Tie Forces and Alternate Load Path required');
      } else {
        category = 'II';
        requirements.push('Tie Forces required');
      }
    } else {
      if (stories > 4) {
        category = 'II';
        requirements.push('Tie Forces required');
      } else {
        category = 'I';
        requirements.push('No specific requirements');
      }
    }

    return { category, requirements };
  }

  /**
   * Eurocode consequence class
   */
  static eurocodeConsequenceClass(
    occupancy: BuildingData['occupancy'],
    stories: number,
    floorArea: number // m²
  ): {
    class: 'CC1' | 'CC2a' | 'CC2b' | 'CC3';
    strategy: string;
  } {
    let consequenceClass: 'CC1' | 'CC2a' | 'CC2b' | 'CC3';
    let strategy: string;
    
    if (occupancy === 'critical' || stories > 15) {
      consequenceClass = 'CC3';
      strategy = 'Systematic risk assessment required';
    } else if (stories > 4 || floorArea > 2000) {
      consequenceClass = 'CC2b';
      strategy = 'Horizontal ties + vertical ties + ALP or key element design';
    } else if (stories > 2 || floorArea > 500) {
      consequenceClass = 'CC2a';
      strategy = 'Horizontal ties required';
    } else {
      consequenceClass = 'CC1';
      strategy = 'No specific recommendations';
    }

    return { class: consequenceClass, strategy };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ProgressiveCollapseParameters,
  TieForceAnalysis,
  AlternateLoadPath,
  CatenaryAction,
  KeyElementDesign,
  CollapseRiskAssessment
};
