/**
 * ============================================================================
 * GEOTECHNICAL ANALYSIS ENGINE
 * ============================================================================
 * 
 * Comprehensive soil mechanics and geotechnical analysis capabilities.
 * 
 * Features:
 * - Soil classification (USCS, AASHTO)
 * - Bearing capacity calculations (Terzaghi, Meyerhof, Hansen, Vesic)
 * - Settlement analysis (immediate, consolidation, secondary)
 * - Lateral earth pressure (Rankine, Coulomb)
 * - Slope stability (Bishop, Fellenius)
 * - Soil liquefaction assessment
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SoilProperties {
  type: 'sand' | 'silt' | 'clay' | 'gravel' | 'organic' | 'rock';
  classification?: {
    uscs?: string;
    aashto?: string;
  };
  unitWeight: number; // kN/m³
  saturatedUnitWeight?: number; // kN/m³
  cohesion: number; // kPa
  frictionAngle: number; // degrees
  elasticModulus?: number; // MPa
  poissonsRatio?: number;
  compressionIndex?: number; // Cc
  swellingIndex?: number; // Cs
  voidRatio?: number; // e0
  preconsolidationPressure?: number; // kPa
  permeability?: number; // m/s
  SPT_N?: number;
  CPT_qc?: number; // MPa
}

export interface SoilLayer {
  depth: number; // m (depth to bottom of layer)
  thickness: number; // m
  properties: SoilProperties;
  waterContent?: number; // %
  description?: string;
}

export interface FoundationGeometry {
  type: 'strip' | 'square' | 'rectangular' | 'circular';
  width: number; // m (B)
  length?: number; // m (L) for rectangular
  depth: number; // m (Df)
  embedment?: number; // m
}

export interface LoadCondition {
  vertical: number; // kN
  horizontal?: number; // kN
  moment?: number; // kNm
  eccentricity?: { ex: number; ey: number }; // m
  inclination?: number; // degrees from vertical
}

export interface WaterTable {
  depth: number; // m below ground surface
  isArtesian?: boolean;
  artesianHead?: number; // m above ground
}

// ============================================================================
// SOIL CLASSIFICATION
// ============================================================================

export class SoilClassifier {
  /**
   * USCS Classification (Unified Soil Classification System)
   */
  classifyUSCS(
    percentFines: number, // % passing #200 sieve
    percentSand: number, // % retained on #200, passing #4
    percentGravel: number, // % retained on #4
    liquidLimit?: number,
    plasticityIndex?: number,
    isOrganic: boolean = false
  ): {
    symbol: string;
    name: string;
    description: string;
  } {
    // Organic soils
    if (isOrganic) {
      if (percentFines > 50) {
        return { symbol: 'OH', name: 'Organic clay', description: 'Organic clay of medium to high plasticity' };
      }
      return { symbol: 'OL', name: 'Organic silt', description: 'Organic silt of low plasticity' };
    }

    // Coarse-grained soils (< 50% fines)
    if (percentFines < 50) {
      const coarseType = percentGravel > percentSand ? 'G' : 'S';
      const typeName = coarseType === 'G' ? 'Gravel' : 'Sand';

      if (percentFines < 5) {
        // Clean coarse-grained
        return {
          symbol: `${coarseType}W`,
          name: `Well-graded ${typeName.toLowerCase()}`,
          description: `Clean ${typeName.toLowerCase()} with little or no fines`
        };
      } else if (percentFines < 12) {
        // Dual symbol may be needed
        return {
          symbol: `${coarseType}W-${coarseType}M`,
          name: `${typeName} with some fines`,
          description: `${typeName} with 5-12% fines`
        };
      } else {
        // Coarse with fines
        if (liquidLimit && plasticityIndex !== undefined) {
          if (plasticityIndex < 4 || plasticityIndex < 0.73 * (liquidLimit - 20)) {
            return {
              symbol: `${coarseType}M`,
              name: `Silty ${typeName.toLowerCase()}`,
              description: `${typeName} with non-plastic fines`
            };
          } else {
            return {
              symbol: `${coarseType}C`,
              name: `Clayey ${typeName.toLowerCase()}`,
              description: `${typeName} with plastic fines`
            };
          }
        }
        return {
          symbol: `${coarseType}M`,
          name: `${typeName} with fines`,
          description: `${typeName} with more than 12% fines`
        };
      }
    }

    // Fine-grained soils (≥ 50% fines)
    if (liquidLimit !== undefined && plasticityIndex !== undefined) {
      const aboveALine = plasticityIndex > 0.73 * (liquidLimit - 20);
      
      if (liquidLimit < 50) {
        // Low plasticity
        if (aboveALine && plasticityIndex >= 7) {
          return { symbol: 'CL', name: 'Lean clay', description: 'Inorganic clay of low plasticity' };
        } else if (plasticityIndex < 4) {
          return { symbol: 'ML', name: 'Silt', description: 'Inorganic silt of low plasticity' };
        } else {
          return { symbol: 'CL-ML', name: 'Silty clay', description: 'Low plasticity silty clay' };
        }
      } else {
        // High plasticity
        if (aboveALine) {
          return { symbol: 'CH', name: 'Fat clay', description: 'Inorganic clay of high plasticity' };
        } else {
          return { symbol: 'MH', name: 'Elastic silt', description: 'Inorganic silt of high plasticity' };
        }
      }
    }

    return { symbol: 'ML', name: 'Silt', description: 'Fine-grained soil (insufficient data for full classification)' };
  }

  /**
   * AASHTO Classification
   */
  classifyAASHTO(
    percentPassing200: number,
    percentPassing40: number,
    liquidLimit: number,
    plasticityIndex: number
  ): {
    classification: string;
    groupIndex: number;
    description: string;
  } {
    // Calculate Group Index
    const F200 = percentPassing200;
    const GI = Math.round(
      (F200 - 35) * (0.2 + 0.005 * (liquidLimit - 40)) +
      0.01 * (F200 - 15) * (plasticityIndex - 10)
    );
    const groupIndex = Math.max(0, GI);

    // Classification logic
    if (percentPassing200 <= 35) {
      // Granular materials (A-1 to A-3)
      if (percentPassing40 <= 50 && plasticityIndex <= 6) {
        if (percentPassing200 <= 15) {
          return {
            classification: 'A-1-a',
            groupIndex: 0,
            description: 'Stone fragments, gravel, and sand'
          };
        }
        return {
          classification: 'A-1-b',
          groupIndex: 0,
          description: 'Stone fragments, gravel, and sand'
        };
      }
      if (plasticityIndex === 0) {
        return {
          classification: 'A-3',
          groupIndex: 0,
          description: 'Fine sand'
        };
      }
      if (liquidLimit <= 40 && plasticityIndex <= 10) {
        return {
          classification: 'A-2-4',
          groupIndex,
          description: 'Silty or clayey gravel and sand'
        };
      }
      return {
        classification: 'A-2-6',
        groupIndex,
        description: 'Silty or clayey gravel and sand'
      };
    }

    // Silt-clay materials (A-4 to A-7)
    if (liquidLimit <= 40) {
      if (plasticityIndex <= 10) {
        return {
          classification: 'A-4',
          groupIndex,
          description: 'Silty soils'
        };
      }
      return {
        classification: 'A-6',
        groupIndex,
        description: 'Clayey soils'
      };
    }
    if (plasticityIndex <= 10) {
      return {
        classification: 'A-5',
        groupIndex,
        description: 'Silty soils'
      };
    }
    if (plasticityIndex > liquidLimit - 30) {
      return {
        classification: 'A-7-6',
        groupIndex,
        description: 'Clayey soils'
      };
    }
    return {
      classification: 'A-7-5',
      groupIndex,
      description: 'Clayey soils'
    };
  }
}

// ============================================================================
// BEARING CAPACITY CALCULATOR
// ============================================================================

export class BearingCapacityCalculator {
  /**
   * Terzaghi's bearing capacity theory
   */
  terzaghi(
    foundation: FoundationGeometry,
    soil: SoilProperties,
    waterTable?: WaterTable
  ): {
    Nc: number;
    Nq: number;
    Ngamma: number;
    ultimateBearing: number; // kPa
    allowableBearing: number; // kPa (FS = 3)
    formula: string;
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const B = foundation.width;
    const Df = foundation.depth;

    // Bearing capacity factors
    const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi || 0.001);
    const Ngamma = 2 * (Nq - 1) * Math.tan(phi);

    // Shape factors
    let sc = 1, sgamma = 1;
    const sq = 1;
    if (foundation.type === 'square' || foundation.type === 'circular') {
      sc = 1.3;
      sgamma = 0.8;
    } else if (foundation.type === 'rectangular' && foundation.length) {
      sc = 1 + 0.3 * B / foundation.length;
      sgamma = 1 - 0.2 * B / foundation.length;
    }

    // Water table correction
    let gammaEff = gamma;
    let qEff = gamma * Df;
    
    if (waterTable) {
      const gammaW = 9.81;
      const gammaSub = (soil.saturatedUnitWeight || gamma + 2) - gammaW;
      
      if (waterTable.depth <= Df) {
        // Water table above foundation base
        qEff = gamma * waterTable.depth + gammaSub * (Df - waterTable.depth);
        gammaEff = gammaSub;
      } else if (waterTable.depth < Df + B) {
        // Water table within influence zone
        gammaEff = gammaSub + (gamma - gammaSub) * (waterTable.depth - Df) / B;
      }
    }

    // Ultimate bearing capacity
    const qu = c * Nc * sc + qEff * Nq * sq + 0.5 * gammaEff * B * Ngamma * sgamma;

    return {
      Nc,
      Nq,
      Ngamma,
      ultimateBearing: qu,
      allowableBearing: qu / 3,
      formula: 'qu = c·Nc·sc + q·Nq·sq + 0.5·γ·B·Nγ·sγ'
    };
  }

  /**
   * Meyerhof's bearing capacity theory
   */
  meyerhof(
    foundation: FoundationGeometry,
    soil: SoilProperties,
    load: LoadCondition,
    waterTable?: WaterTable
  ): {
    Nc: number;
    Nq: number;
    Ngamma: number;
    shapeFactors: { sc: number; sq: number; sgamma: number };
    depthFactors: { dc: number; dq: number; dgamma: number };
    inclinationFactors: { ic: number; iq: number; igamma: number };
    ultimateBearing: number;
    allowableBearing: number;
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const B = foundation.width;
    const L = foundation.length || foundation.width;
    const Df = foundation.depth;

    // Bearing capacity factors
    const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi || 0.001);
    const Ngamma = (Nq - 1) * Math.tan(1.4 * phi);

    // Shape factors
    const sc = 1 + 0.2 * B / L * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const sq = 1 + 0.1 * B / L * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const sgamma = sq;

    // Depth factors
    const dc = 1 + 0.2 * Df / B * Math.tan(Math.PI / 4 + phi / 2);
    const dq = 1 + 0.1 * Df / B * Math.tan(Math.PI / 4 + phi / 2);
    const dgamma = dq;

    // Inclination factors
    const alpha = (load.inclination || 0) * Math.PI / 180;
    const ic = iq_calc(alpha, phi);
    const iq = ic;
    const igamma = Math.pow(1 - alpha / (Math.PI / 2), 2);

    function iq_calc(a: number, p: number): number {
      return Math.pow(1 - a / (Math.PI / 2), 2);
    }

    // Water table correction
    let gammaEff = gamma;
    let q = gamma * Df;
    
    if (waterTable) {
      const gammaW = 9.81;
      const gammaSub = (soil.saturatedUnitWeight || gamma + 2) - gammaW;
      
      if (waterTable.depth <= Df) {
        q = gamma * waterTable.depth + gammaSub * (Df - waterTable.depth);
        gammaEff = gammaSub;
      } else if (waterTable.depth < Df + B) {
        gammaEff = gammaSub + (gamma - gammaSub) * (waterTable.depth - Df) / B;
      }
    }

    // Ultimate bearing capacity
    const qu = c * Nc * sc * dc * ic + q * Nq * sq * dq * iq + 
               0.5 * gammaEff * B * Ngamma * sgamma * dgamma * igamma;

    return {
      Nc,
      Nq,
      Ngamma,
      shapeFactors: { sc, sq, sgamma },
      depthFactors: { dc, dq, dgamma },
      inclinationFactors: { ic, iq, igamma },
      ultimateBearing: qu,
      allowableBearing: qu / 3
    };
  }

  /**
   * Hansen's bearing capacity theory
   */
  hansen(
    foundation: FoundationGeometry,
    soil: SoilProperties,
    load: LoadCondition,
    groundSlope: number = 0, // degrees
    baseInclination: number = 0 // degrees
  ): {
    Nc: number;
    Nq: number;
    Ngamma: number;
    ultimateBearing: number;
    allowableBearing: number;
    factors: {
      shape: { sc: number; sq: number; sgamma: number };
      depth: { dc: number; dq: number; dgamma: number };
      inclination: { ic: number; iq: number; igamma: number };
      ground: { gc: number; gq: number; ggamma: number };
      base: { bc: number; bq: number; bgamma: number };
    };
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const B = foundation.width;
    const L = foundation.length || foundation.width;
    const Df = foundation.depth;
    const beta = groundSlope * Math.PI / 180;
    const eta = baseInclination * Math.PI / 180;

    // Bearing capacity factors
    const Nq = Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
    const Nc = (Nq - 1) / Math.tan(phi || 0.001);
    const Ngamma = 1.5 * (Nq - 1) * Math.tan(phi);

    // Shape factors
    const sc = 1 + B / L * Nq / Nc;
    const sq = 1 + B / L * Math.tan(phi);
    const sgamma = 1 - 0.4 * B / L;

    // Depth factors
    const k = Df / B <= 1 ? Df / B : Math.atan(Df / B);
    const dc = 1 + 0.4 * k;
    const dq = 1 + 2 * Math.tan(phi) * Math.pow(1 - Math.sin(phi), 2) * k;
    const dgamma = 1;

    // Inclination factors
    const H = load.horizontal || 0;
    const V = load.vertical;
    const ic = 0.5 - 0.5 * Math.sqrt(1 - H / (V * Math.tan(phi || 0.001) + c * B * L));
    const iq = Math.pow(1 - 0.5 * H / (V + c * B * L / Math.tan(phi || 0.001)), 2);
    const igamma = Math.pow(1 - 0.7 * H / (V + c * B * L / Math.tan(phi || 0.001)), 2);

    // Ground slope factors
    const gc = beta / (5.14 * Math.PI / 180);
    const gq = Math.pow(1 - Math.tan(beta), 2);
    const ggamma = gq;

    // Base inclination factors
    const bc = 1 - 2 * eta / (Math.PI + 2);
    const bq = Math.pow(1 - eta * Math.tan(phi), 2);
    const bgamma = bq;

    // Ultimate bearing capacity
    const q = gamma * Df;
    const qu = c * Nc * sc * dc * ic * gc * bc +
               q * Nq * sq * dq * iq * gq * bq +
               0.5 * gamma * B * Ngamma * sgamma * dgamma * igamma * ggamma * bgamma;

    return {
      Nc,
      Nq,
      Ngamma,
      ultimateBearing: qu,
      allowableBearing: qu / 3,
      factors: {
        shape: { sc, sq, sgamma },
        depth: { dc, dq, dgamma },
        inclination: { ic, iq, igamma },
        ground: { gc, gq, ggamma },
        base: { bc, bq, bgamma }
      }
    };
  }

  /**
   * IS 6403 bearing capacity (Indian Standard)
   */
  is6403(
    foundation: FoundationGeometry,
    soil: SoilProperties,
    waterTable?: WaterTable
  ): {
    netUltimateBearing: number;
    netSafeBearing: number;
    grossSafeBearing: number;
    formula: string;
  } {
    const result = this.terzaghi(foundation, soil, waterTable);
    
    const gamma = soil.unitWeight;
    const Df = foundation.depth;
    const q = gamma * Df;

    const netUltimate = result.ultimateBearing - q;
    const netSafe = netUltimate / 2.5; // Factor of safety as per IS 6403
    const grossSafe = netSafe + gamma * Df;

    return {
      netUltimateBearing: netUltimate,
      netSafeBearing: netSafe,
      grossSafeBearing: grossSafe,
      formula: 'qnu = qu - γ·Df; qns = qnu/F.S.; qas = qns + γ·Df'
    };
  }

  /**
   * SPT-based bearing capacity (empirical)
   */
  fromSPT(
    foundation: FoundationGeometry,
    N_avg: number, // Average SPT N value
    soilType: 'sand' | 'clay',
    waterTableCorrection: boolean = false
  ): {
    allowableBearing: number;
    method: string;
    notes: string;
  } {
    const B = foundation.width;
    const Df = foundation.depth;

    if (soilType === 'sand') {
      // Meyerhof's correlation for sand
      const N = waterTableCorrection ? N_avg * 0.5 : N_avg;
      
      let qa: number;
      if (B <= 1.2) {
        qa = 12 * N * (1 + Df / B);
      } else {
        qa = 8 * N * Math.pow((B + 0.3) / B, 2) * (1 + Df / B);
      }

      return {
        allowableBearing: Math.min(qa, 400), // Cap at 400 kPa
        method: 'Meyerhof SPT correlation for sand',
        notes: waterTableCorrection ? 'With water table correction' : 'Without water table correction'
      };
    } else {
      // Terzaghi & Peck for clay
      const qu = N_avg / 8 * 1000; // kPa (approximate unconfined compressive strength)
      const qa = qu / 6; // Factor of safety = 6 for settlement consideration

      return {
        allowableBearing: Math.min(qa, 300),
        method: 'Terzaghi & Peck SPT correlation for clay',
        notes: 'Based on unconfined compressive strength correlation'
      };
    }
  }
}

// ============================================================================
// SETTLEMENT CALCULATOR
// ============================================================================

export class SettlementCalculator {
  /**
   * Immediate (elastic) settlement
   */
  calculateImmediateSettlement(
    foundation: FoundationGeometry,
    soil: SoilProperties,
    appliedPressure: number, // kPa
    rigidity: 'flexible' | 'rigid' = 'flexible'
  ): {
    settlement: number; // mm
    formula: string;
    influenceFactor: number;
  } {
    const B = foundation.width * 1000; // Convert to mm
    const L = (foundation.length || foundation.width) * 1000;
    const E = (soil.elasticModulus || 30) * 1000; // Convert MPa to kPa
    const nu = soil.poissonsRatio || 0.3;

    // Influence factor based on shape and rigidity
    let Ip: number;
    const aspectRatio = L / B;

    if (rigidity === 'flexible') {
      // Flexible foundation - corner settlement
      if (aspectRatio <= 1.5) {
        Ip = 0.56 * Math.sqrt(aspectRatio);
      } else {
        Ip = 0.82 * Math.log10(aspectRatio) + 0.35;
      }
    } else {
      // Rigid foundation
      Ip = 0.88 * Math.sqrt(aspectRatio) - 0.12;
    }

    // Immediate settlement
    const Si = appliedPressure * B * (1 - nu * nu) * Ip / E;

    return {
      settlement: Si,
      formula: 'Si = q·B·(1-ν²)·Ip/E',
      influenceFactor: Ip
    };
  }

  /**
   * Primary consolidation settlement
   */
  calculateConsolidationSettlement(
    layers: SoilLayer[],
    stressIncrease: number[], // kPa at mid-height of each layer
    initialEffectiveStress: number[] // kPa at mid-height
  ): {
    totalSettlement: number; // mm
    layerSettlements: { depth: number; settlement: number }[];
    timeForConsolidation?: number; // years (for 90% consolidation)
  } {
    const settlements: { depth: number; settlement: number }[] = [];
    let totalSettlement = 0;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const Cc = layer.properties.compressionIndex;
      const Cs = layer.properties.swellingIndex;
      const e0 = layer.properties.voidRatio;
      const pc = layer.properties.preconsolidationPressure;
      const H = layer.thickness * 1000; // mm
      const p0 = initialEffectiveStress[i];
      const deltaP = stressIncrease[i];

      if (!Cc || !e0) continue;

      let S: number;
      
      if (pc && p0 < pc) {
        // Overconsolidated soil
        if (p0 + deltaP <= pc) {
          // Recompression only
          S = (Cs || Cc / 5) * H / (1 + e0) * Math.log10((p0 + deltaP) / p0);
        } else {
          // Recompression + virgin compression
          const S1 = (Cs || Cc / 5) * H / (1 + e0) * Math.log10(pc / p0);
          const S2 = Cc * H / (1 + e0) * Math.log10((p0 + deltaP) / pc);
          S = S1 + S2;
        }
      } else {
        // Normally consolidated
        S = Cc * H / (1 + e0) * Math.log10((p0 + deltaP) / p0);
      }

      settlements.push({ depth: layer.depth, settlement: S });
      totalSettlement += S;
    }

    return {
      totalSettlement,
      layerSettlements: settlements
    };
  }

  /**
   * Secondary compression (creep) settlement
   */
  calculateSecondarySettlement(
    layer: SoilLayer,
    primarySettlement: number, // mm
    timePrimary: number, // years (time for primary consolidation)
    timeTotal: number, // years (total time)
    Calpha?: number // secondary compression index
  ): {
    settlement: number;
    formula: string;
  } {
    const Ca = Calpha || (layer.properties.compressionIndex || 0.2) * 0.03;
    const H = layer.thickness * 1000;
    const e0 = layer.properties.voidRatio || 0.8;

    const Ss = Ca * H / (1 + e0) * Math.log10(timeTotal / timePrimary);

    return {
      settlement: Ss,
      formula: 'Ss = Cα·H/(1+e0)·log(t/tp)'
    };
  }
}

// ============================================================================
// LATERAL EARTH PRESSURE CALCULATOR
// ============================================================================

export class LateralEarthPressureCalculator {
  /**
   * Rankine's earth pressure theory
   */
  rankine(
    soil: SoilProperties,
    wallHeight: number, // m
    surchage: number = 0, // kPa
    backfillSlope: number = 0, // degrees
    waterTable?: WaterTable
  ): {
    Ka: number;
    Kp: number;
    activePressure: { top: number; bottom: number }; // kPa
    passivePressure: { top: number; bottom: number };
    activeForce: number; // kN/m
    passiveForce: number;
    pointOfApplication: number; // m from base
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    const beta = backfillSlope * Math.PI / 180;
    const gamma = soil.unitWeight;
    const c = soil.cohesion;
    const H = wallHeight;

    // Active and passive coefficients
    const Ka = Math.cos(beta) * (Math.cos(beta) - Math.sqrt(Math.pow(Math.cos(beta), 2) - Math.pow(Math.cos(phi), 2))) /
               (Math.cos(beta) + Math.sqrt(Math.pow(Math.cos(beta), 2) - Math.pow(Math.cos(phi), 2)));
    
    const Kp = Math.cos(beta) * (Math.cos(beta) + Math.sqrt(Math.pow(Math.cos(beta), 2) - Math.pow(Math.cos(phi), 2))) /
               (Math.cos(beta) - Math.sqrt(Math.pow(Math.cos(beta), 2) - Math.pow(Math.cos(phi), 2)));

    // Active pressure
    const paTop = Ka * surchage - 2 * c * Math.sqrt(Ka);
    const paBottom = Ka * (surchage + gamma * H) - 2 * c * Math.sqrt(Ka);

    // Passive pressure
    const ppTop = Kp * surchage + 2 * c * Math.sqrt(Kp);
    const ppBottom = Kp * gamma * H + 2 * c * Math.sqrt(Kp);

    // Forces per meter run
    const Pa = 0.5 * Ka * gamma * H * H + Ka * surchage * H - 2 * c * Math.sqrt(Ka) * H;
    const Pp = 0.5 * Kp * gamma * H * H + 2 * c * Math.sqrt(Kp) * H;

    // Point of application (from base)
    const ya = H / 3; // For triangular distribution

    return {
      Ka,
      Kp,
      activePressure: { top: Math.max(0, paTop), bottom: Math.max(0, paBottom) },
      passivePressure: { top: ppTop, bottom: ppBottom },
      activeForce: Math.max(0, Pa),
      passiveForce: Pp,
      pointOfApplication: ya
    };
  }

  /**
   * Coulomb's earth pressure theory
   */
  coulomb(
    soil: SoilProperties,
    wallHeight: number,
    wallFrictionAngle: number, // degrees
    wallBackAngle: number = 90, // degrees from horizontal (90 = vertical)
    backfillSlope: number = 0
  ): {
    Ka: number;
    Kp: number;
    activeForce: number;
    passiveForce: number;
    direction: number; // degrees from horizontal
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    const delta = wallFrictionAngle * Math.PI / 180;
    const alpha = wallBackAngle * Math.PI / 180;
    const beta = backfillSlope * Math.PI / 180;
    const gamma = soil.unitWeight;
    const H = wallHeight;

    // Active coefficient
    const num = Math.pow(Math.sin(alpha + phi), 2);
    const den1 = Math.pow(Math.sin(alpha), 2) * Math.sin(alpha - delta);
    const den2 = Math.pow(1 + Math.sqrt(Math.sin(phi + delta) * Math.sin(phi - beta) / 
                                        (Math.sin(alpha - delta) * Math.sin(alpha + beta))), 2);
    const Ka = num / (den1 * den2);

    // Passive coefficient
    const numP = Math.pow(Math.sin(alpha - phi), 2);
    const den1P = Math.pow(Math.sin(alpha), 2) * Math.sin(alpha + delta);
    const den2P = Math.pow(1 - Math.sqrt(Math.sin(phi + delta) * Math.sin(phi + beta) / 
                                          (Math.sin(alpha + delta) * Math.sin(alpha + beta))), 2);
    const Kp = numP / (den1P * den2P);

    // Forces
    const Pa = 0.5 * Ka * gamma * H * H;
    const Pp = 0.5 * Kp * gamma * H * H;

    // Direction of resultant
    const direction = 90 - wallBackAngle + wallFrictionAngle;

    return {
      Ka,
      Kp,
      activeForce: Pa,
      passiveForce: Pp,
      direction
    };
  }

  /**
   * At-rest earth pressure
   */
  atRest(
    soil: SoilProperties,
    wallHeight: number,
    OCR: number = 1 // Over-consolidation ratio
  ): {
    K0: number;
    pressure: number; // at base, kPa
    force: number; // kN/m
  } {
    const phi = soil.frictionAngle * Math.PI / 180;
    
    // Jaky's formula for normally consolidated soil
    let K0 = 1 - Math.sin(phi);
    
    // Correction for overconsolidation
    if (OCR > 1) {
      K0 = K0 * Math.pow(OCR, 0.5);
    }

    const pressure = K0 * soil.unitWeight * wallHeight;
    const force = 0.5 * K0 * soil.unitWeight * wallHeight * wallHeight;

    return { K0, pressure, force };
  }
}

// ============================================================================
// SLOPE STABILITY ANALYZER
// ============================================================================

export class SlopeStabilityAnalyzer {
  /**
   * Ordinary Method of Slices (Fellenius)
   */
  fellenius(
    slices: {
      width: number; // m
      height: number; // m
      baseAngle: number; // degrees
      cohesion: number; // kPa
      frictionAngle: number; // degrees
      unitWeight: number; // kN/m³
      porePressure?: number; // kPa
    }[]
  ): {
    factorOfSafety: number;
    drivingMoment: number;
    resistingMoment: number;
  } {
    let drivingMoment = 0;
    let resistingMoment = 0;

    for (const slice of slices) {
      const b = slice.width;
      const h = slice.height;
      const alpha = slice.baseAngle * Math.PI / 180;
      const c = slice.cohesion;
      const phi = slice.frictionAngle * Math.PI / 180;
      const gamma = slice.unitWeight;
      const u = slice.porePressure || 0;

      // Weight of slice
      const W = gamma * b * h;

      // Base length
      const l = b / Math.cos(alpha);

      // Normal force on base
      const N = W * Math.cos(alpha);

      // Effective normal stress
      const Nprime = N - u * l;

      // Driving force
      drivingMoment += W * Math.sin(alpha);

      // Resisting force
      resistingMoment += c * l + Nprime * Math.tan(phi);
    }

    return {
      factorOfSafety: resistingMoment / drivingMoment,
      drivingMoment,
      resistingMoment
    };
  }

  /**
   * Bishop's Simplified Method
   */
  bishopSimplified(
    slices: {
      width: number;
      height: number;
      baseAngle: number;
      cohesion: number;
      frictionAngle: number;
      unitWeight: number;
      porePressure?: number;
    }[],
    maxIterations: number = 100,
    tolerance: number = 0.001
  ): {
    factorOfSafety: number;
    iterations: number;
    converged: boolean;
  } {
    let F = 1.5; // Initial guess
    let iterations = 0;

    while (iterations < maxIterations) {
      let numerator = 0;
      let denominator = 0;

      for (const slice of slices) {
        const b = slice.width;
        const h = slice.height;
        const alpha = slice.baseAngle * Math.PI / 180;
        const c = slice.cohesion;
        const phi = slice.frictionAngle * Math.PI / 180;
        const gamma = slice.unitWeight;
        const u = slice.porePressure || 0;

        const W = gamma * b * h;
        const l = b / Math.cos(alpha);

        // Bishop's m-alpha factor
        const mAlpha = Math.cos(alpha) + Math.sin(alpha) * Math.tan(phi) / F;

        // Numerator contribution
        numerator += (c * l + (W - u * b) * Math.tan(phi)) / mAlpha;

        // Denominator contribution
        denominator += W * Math.sin(alpha);
      }

      const Fnew = numerator / denominator;

      if (Math.abs(Fnew - F) < tolerance) {
        return {
          factorOfSafety: Fnew,
          iterations: iterations + 1,
          converged: true
        };
      }

      F = Fnew;
      iterations++;
    }

    return {
      factorOfSafety: F,
      iterations,
      converged: false
    };
  }

  /**
   * Infinite slope analysis
   */
  infiniteSlope(
    slopeAngle: number, // degrees
    soil: SoilProperties,
    depth: number, // m (depth of potential failure plane)
    waterTableDepth?: number // m below surface
  ): {
    factorOfSafety: number;
    criticalDepth: number;
    isSafe: boolean;
  } {
    const beta = slopeAngle * Math.PI / 180;
    const phi = soil.frictionAngle * Math.PI / 180;
    const c = soil.cohesion;
    const gamma = soil.unitWeight;
    const z = depth;

    let F: number;

    if (waterTableDepth !== undefined && waterTableDepth < z) {
      // With seepage parallel to slope
      const gammaSat = soil.saturatedUnitWeight || (gamma + 2);
      const gammaSub = gammaSat - 9.81;
      
      F = (c / (gammaSat * z * Math.cos(beta) * Math.sin(beta))) +
          (gammaSub / gammaSat) * (Math.tan(phi) / Math.tan(beta));
    } else {
      // Dry slope
      F = (c / (gamma * z * Math.cos(beta) * Math.sin(beta))) +
          (Math.tan(phi) / Math.tan(beta));
    }

    // Critical depth for cohesionless soil
    const criticalDepth = c > 0 ? Infinity : 0;

    return {
      factorOfSafety: F,
      criticalDepth,
      isSafe: F >= 1.5
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  SoilClassifier,
  BearingCapacityCalculator,
  SettlementCalculator,
  LateralEarthPressureCalculator,
  SlopeStabilityAnalyzer
};
