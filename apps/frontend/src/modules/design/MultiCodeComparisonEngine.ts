/**
 * ============================================================================
 * MULTI-CODE COMPARISON ENGINE
 * ============================================================================
 * 
 * Comparative analysis across international design codes:
 * - Load factor comparison
 * - Material strength reduction
 * - Seismic design provisions
 * - Wind load comparison
 * - Reinforcement detailing
 * - Most conservative selection
 * - Code compliance matrix
 * - Regional adaptations
 * 
 * Codes Compared:
 * - American: ACI 318, AISC 360, ASCE 7, IBC
 * - European: EN 1990-1999 (Eurocodes)
 * - British: BS 8110, BS 5950 (legacy)
 * - Indian: IS 456, IS 800, IS 875, IS 1893
 * - Australian: AS 3600, AS 4100
 * - Canadian: CSA A23.3, CSA S16
 * - Chinese: GB 50010, GB 50017
 * - Japanese: AIJ, JSCE
 * 
 * @version 1.0.0
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CodeComparisonResult {
  parameter: string;
  description: string;
  codes: {
    code: string;
    country: string;
    value: number | string;
    formula?: string;
    notes?: string;
  }[];
  mostConservative: string;
  leastConservative: string;
  recommendations: string[];
}

export interface LoadFactorComparison {
  limitState: 'ultimate' | 'serviceability';
  loadCombination: string;
  factors: {
    code: string;
    deadLoad: number;
    liveLoad: number;
    wind: number;
    seismic: number;
    snow?: number;
    temperature?: number;
  }[];
}

export interface MaterialFactorComparison {
  material: 'concrete' | 'steel' | 'timber' | 'masonry';
  property: 'compression' | 'tension' | 'shear' | 'bond';
  factors: {
    code: string;
    partialFactor: number;
    resistanceFactor: number;
    effectiveValue: number;
  }[];
}

export interface SeismicComparison {
  siteClass: string;
  importance: 'essential' | 'special' | 'normal' | 'low';
  ductility: 'high' | 'moderate' | 'low';
  results: {
    code: string;
    baseShearCoeff: number;
    responseModification: number;
    importanceFactor: number;
    verticalDistribution: string;
  }[];
}

// ============================================================================
// LOAD FACTOR COMPARISON
// ============================================================================

export class LoadFactorComparison {
  /**
   * Ultimate limit state load combinations
   */
  static ultimateLoadCombinations(): LoadFactorComparison[] {
    return [
      {
        limitState: 'ultimate',
        loadCombination: 'Dead + Live',
        factors: [
          { code: 'ACI 318', deadLoad: 1.4, liveLoad: 1.7, wind: 0, seismic: 0 },
          { code: 'ASCE 7/IBC', deadLoad: 1.2, liveLoad: 1.6, wind: 0, seismic: 0 },
          { code: 'Eurocode', deadLoad: 1.35, liveLoad: 1.5, wind: 0, seismic: 0 },
          { code: 'IS 456', deadLoad: 1.5, liveLoad: 1.5, wind: 0, seismic: 0 },
          { code: 'AS 3600', deadLoad: 1.2, liveLoad: 1.5, wind: 0, seismic: 0 },
          { code: 'CSA A23.3', deadLoad: 1.25, liveLoad: 1.5, wind: 0, seismic: 0 },
          { code: 'GB 50010', deadLoad: 1.2, liveLoad: 1.4, wind: 0, seismic: 0 }
        ]
      },
      {
        limitState: 'ultimate',
        loadCombination: 'Dead + Live + Wind',
        factors: [
          { code: 'ACI 318', deadLoad: 1.2, liveLoad: 1.0, wind: 1.6, seismic: 0 },
          { code: 'ASCE 7/IBC', deadLoad: 1.2, liveLoad: 0.5, wind: 1.0, seismic: 0 },
          { code: 'Eurocode', deadLoad: 1.35, liveLoad: 0.7 * 1.5, wind: 1.5, seismic: 0 },
          { code: 'IS 456', deadLoad: 1.2, liveLoad: 1.2, wind: 1.2, seismic: 0 },
          { code: 'AS 3600', deadLoad: 1.2, liveLoad: 0.4, wind: 1.0, seismic: 0 },
          { code: 'CSA A23.3', deadLoad: 1.25, liveLoad: 0.5, wind: 1.4, seismic: 0 },
          { code: 'GB 50010', deadLoad: 1.2, liveLoad: 0.7 * 1.4, wind: 1.4, seismic: 0 }
        ]
      },
      {
        limitState: 'ultimate',
        loadCombination: 'Dead + Live + Seismic',
        factors: [
          { code: 'ACI 318', deadLoad: 1.2, liveLoad: 1.0, wind: 0, seismic: 1.0 },
          { code: 'ASCE 7/IBC', deadLoad: 1.2, liveLoad: 0.5, wind: 0, seismic: 1.0 },
          { code: 'Eurocode', deadLoad: 1.0, liveLoad: 0.3 * 1.0, wind: 0, seismic: 1.0 },
          { code: 'IS 1893', deadLoad: 1.2, liveLoad: 1.2, wind: 0, seismic: 1.2 },
          { code: 'AS 1170.4', deadLoad: 1.0, liveLoad: 0.3, wind: 0, seismic: 1.0 },
          { code: 'CSA A23.3', deadLoad: 1.0, liveLoad: 0.5, wind: 0, seismic: 1.0 },
          { code: 'GB 50011', deadLoad: 1.2, liveLoad: 0.5 * 1.4, wind: 0, seismic: 1.3 }
        ]
      }
    ];
  }

  /**
   * Find most conservative combination
   */
  static mostConservative(
    deadLoad: number,
    liveLoad: number,
    windLoad: number,
    seismicLoad: number
  ): { code: string; factoredLoad: number }[] {
    const combinations = this.ultimateLoadCombinations();
    const results: { code: string; factoredLoad: number }[] = [];
    
    for (const combo of combinations) {
      for (const factors of combo.factors) {
        const factored = factors.deadLoad * deadLoad + 
                        factors.liveLoad * liveLoad +
                        factors.wind * windLoad +
                        factors.seismic * seismicLoad;
        
        const existing = results.find(r => r.code === factors.code);
        if (existing) {
          existing.factoredLoad = Math.max(existing.factoredLoad, factored);
        } else {
          results.push({ code: factors.code, factoredLoad: factored });
        }
      }
    }
    
    return results.sort((a, b) => b.factoredLoad - a.factoredLoad);
  }
}

// ============================================================================
// MATERIAL FACTOR COMPARISON
// ============================================================================

export class MaterialFactorComparison {
  /**
   * Concrete material factors
   */
  static concreteFactors(): MaterialFactorComparison[] {
    return [
      {
        material: 'concrete',
        property: 'compression',
        factors: [
          { code: 'ACI 318', partialFactor: 1.0, resistanceFactor: 0.65, effectiveValue: 0.65 },
          { code: 'Eurocode 2', partialFactor: 1.5, resistanceFactor: 1.0, effectiveValue: 0.667 },
          { code: 'IS 456', partialFactor: 1.5, resistanceFactor: 1.0, effectiveValue: 0.667 },
          { code: 'BS 8110', partialFactor: 1.5, resistanceFactor: 1.0, effectiveValue: 0.667 },
          { code: 'AS 3600', partialFactor: 1.0, resistanceFactor: 0.65, effectiveValue: 0.65 },
          { code: 'CSA A23.3', partialFactor: 1.0, resistanceFactor: 0.65, effectiveValue: 0.65 },
          { code: 'GB 50010', partialFactor: 1.4, resistanceFactor: 1.0, effectiveValue: 0.714 }
        ]
      },
      {
        material: 'concrete',
        property: 'shear',
        factors: [
          { code: 'ACI 318', partialFactor: 1.0, resistanceFactor: 0.75, effectiveValue: 0.75 },
          { code: 'Eurocode 2', partialFactor: 1.5, resistanceFactor: 1.0, effectiveValue: 0.667 },
          { code: 'IS 456', partialFactor: 1.5, resistanceFactor: 1.0, effectiveValue: 0.667 },
          { code: 'AS 3600', partialFactor: 1.0, resistanceFactor: 0.70, effectiveValue: 0.70 },
          { code: 'CSA A23.3', partialFactor: 1.0, resistanceFactor: 0.65, effectiveValue: 0.65 }
        ]
      }
    ];
  }

  /**
   * Steel material factors
   */
  static steelFactors(): MaterialFactorComparison[] {
    return [
      {
        material: 'steel',
        property: 'tension',
        factors: [
          { code: 'AISC 360', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 },
          { code: 'Eurocode 3', partialFactor: 1.0, resistanceFactor: 1.0, effectiveValue: 1.0 },
          { code: 'IS 800', partialFactor: 1.10, resistanceFactor: 1.0, effectiveValue: 0.909 },
          { code: 'AS 4100', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 },
          { code: 'CSA S16', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 },
          { code: 'GB 50017', partialFactor: 1.087, resistanceFactor: 1.0, effectiveValue: 0.92 }
        ]
      },
      {
        material: 'steel',
        property: 'compression',
        factors: [
          { code: 'AISC 360', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 },
          { code: 'Eurocode 3', partialFactor: 1.0, resistanceFactor: 1.0, effectiveValue: 1.0 },
          { code: 'IS 800', partialFactor: 1.10, resistanceFactor: 1.0, effectiveValue: 0.909 },
          { code: 'AS 4100', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 }
        ]
      },
      {
        material: 'steel',
        property: 'shear',
        factors: [
          { code: 'AISC 360', partialFactor: 1.0, resistanceFactor: 0.90, effectiveValue: 0.90 },
          { code: 'Eurocode 3', partialFactor: 1.0, resistanceFactor: 1.0, effectiveValue: 1.0 },
          { code: 'IS 800', partialFactor: 1.10, resistanceFactor: 1.0, effectiveValue: 0.909 }
        ]
      }
    ];
  }

  /**
   * Calculate design strength
   */
  static designStrength(
    characteristicStrength: number,
    code: string,
    material: 'concrete' | 'steel',
    property: 'compression' | 'tension' | 'shear'
  ): number {
    let factors: MaterialFactorComparison[];
    if (material === 'concrete') {
      factors = this.concreteFactors();
    } else {
      factors = this.steelFactors();
    }
    
    const comparison = factors.find(f => f.property === property);
    if (!comparison) return characteristicStrength;
    
    const factor = comparison.factors.find(f => f.code === code);
    if (!factor) return characteristicStrength;
    
    return characteristicStrength * factor.effectiveValue;
  }
}

// ============================================================================
// SEISMIC DESIGN COMPARISON
// ============================================================================

export class SeismicDesignComparison {
  /**
   * Response modification factors
   */
  static responseModificationFactors(
    structuralSystem: 'moment-frame' | 'braced-frame' | 'shear-wall' | 'dual-system',
    ductility: 'high' | 'moderate' | 'low'
  ): { code: string; R: number; name: string }[] {
    const factors: Record<string, Record<string, Record<string, { R: number; name: string }>>> = {
      'moment-frame': {
        'high': {
          'ASCE 7': { R: 8.0, name: 'Special Moment Frame' },
          'Eurocode 8': { R: 6.5, name: 'DCH' },
          'IS 1893': { R: 5.0, name: 'SMRF' },
          'NZS 1170.5': { R: 6.0, name: 'Ductile MRF' },
          'GB 50011': { R: 5.5, name: 'Special MRF' }
        },
        'moderate': {
          'ASCE 7': { R: 4.5, name: 'Intermediate Moment Frame' },
          'Eurocode 8': { R: 4.0, name: 'DCM' },
          'IS 1893': { R: 3.0, name: 'OMRF' },
          'NZS 1170.5': { R: 4.0, name: 'Limited Ductile MRF' }
        },
        'low': {
          'ASCE 7': { R: 3.0, name: 'Ordinary Moment Frame' },
          'Eurocode 8': { R: 1.5, name: 'DCL' },
          'IS 1893': { R: 3.0, name: 'OMRF' }
        }
      },
      'shear-wall': {
        'high': {
          'ASCE 7': { R: 5.0, name: 'Special Shear Wall' },
          'Eurocode 8': { R: 4.4, name: 'DCH Wall' },
          'IS 1893': { R: 4.0, name: 'Ductile Shear Wall' },
          'NZS 1170.5': { R: 5.0, name: 'Ductile Wall' }
        },
        'moderate': {
          'ASCE 7': { R: 4.0, name: 'Ordinary Shear Wall' },
          'Eurocode 8': { R: 3.0, name: 'DCM Wall' },
          'IS 1893': { R: 3.0, name: 'Ordinary Shear Wall' }
        },
        'low': {
          'ASCE 7': { R: 1.5, name: 'Plain Concrete Wall' },
          'Eurocode 8': { R: 1.5, name: 'DCL Wall' }
        }
      },
      'braced-frame': {
        'high': {
          'ASCE 7': { R: 6.0, name: 'Special CBF' },
          'Eurocode 8': { R: 4.0, name: 'DCH CBF' },
          'IS 1893': { R: 4.0, name: 'SCBF' },
          'AISC 341': { R: 6.0, name: 'SCBF' }
        },
        'moderate': {
          'ASCE 7': { R: 3.25, name: 'Ordinary CBF' },
          'Eurocode 8': { R: 2.5, name: 'DCM CBF' },
          'IS 1893': { R: 2.5, name: 'OCBF' }
        },
        'low': {
          'ASCE 7': { R: 3.25, name: 'Ordinary CBF' },
          'Eurocode 8': { R: 1.5, name: 'DCL CBF' }
        }
      },
      'dual-system': {
        'high': {
          'ASCE 7': { R: 7.0, name: 'Dual System SMF + Wall' },
          'Eurocode 8': { R: 5.4, name: 'DCH Dual' },
          'IS 1893': { R: 5.0, name: 'Dual System' }
        },
        'moderate': {
          'ASCE 7': { R: 5.5, name: 'Dual System IMF + Wall' },
          'Eurocode 8': { R: 3.6, name: 'DCM Dual' },
          'IS 1893': { R: 4.0, name: 'Dual System' }
        },
        'low': {
          'ASCE 7': { R: 4.5, name: 'Dual System OMF + Wall' },
          'Eurocode 8': { R: 2.0, name: 'DCL Dual' }
        }
      }
    };
    
    const systemFactors = factors[structuralSystem]?.[ductility];
    if (!systemFactors) return [];
    
    return Object.entries(systemFactors).map(([code, data]) => ({
      code,
      R: data.R,
      name: data.name
    }));
  }

  /**
   * Importance factors
   */
  static importanceFactors(
    occupancy: 'essential' | 'special' | 'normal' | 'low'
  ): { code: string; factor: number; category: string }[] {
    const factors: Record<string, Record<string, { I: number; cat: string }>> = {
      'essential': {
        'ASCE 7': { I: 1.50, cat: 'Risk Category IV' },
        'Eurocode 8': { I: 1.40, cat: 'Importance Class IV' },
        'IS 1893': { I: 1.50, cat: 'Important' },
        'NZS 1170.5': { I: 1.80, cat: 'IL4' },
        'AS 1170.4': { I: 1.50, cat: 'Type IV' }
      },
      'special': {
        'ASCE 7': { I: 1.25, cat: 'Risk Category III' },
        'Eurocode 8': { I: 1.20, cat: 'Importance Class III' },
        'IS 1893': { I: 1.20, cat: 'Special' },
        'NZS 1170.5': { I: 1.30, cat: 'IL3' },
        'AS 1170.4': { I: 1.30, cat: 'Type III' }
      },
      'normal': {
        'ASCE 7': { I: 1.00, cat: 'Risk Category II' },
        'Eurocode 8': { I: 1.00, cat: 'Importance Class II' },
        'IS 1893': { I: 1.00, cat: 'Normal' },
        'NZS 1170.5': { I: 1.00, cat: 'IL2' },
        'AS 1170.4': { I: 1.00, cat: 'Type II' }
      },
      'low': {
        'ASCE 7': { I: 1.00, cat: 'Risk Category I' },
        'Eurocode 8': { I: 0.80, cat: 'Importance Class I' },
        'IS 1893': { I: 1.00, cat: 'Low' },
        'NZS 1170.5': { I: 0.80, cat: 'IL1' },
        'AS 1170.4': { I: 0.80, cat: 'Type I' }
      }
    };
    
    const occupancyFactors = factors[occupancy];
    return Object.entries(occupancyFactors).map(([code, data]) => ({
      code,
      factor: data.I,
      category: data.cat
    }));
  }

  /**
   * Compare seismic base shear
   */
  static compareBaseShear(
    seismicWeight: number, // kN
    fundamentalPeriod: number, // sec
    siteParams: {
      Ss: number; // Short period Sa (g)
      S1: number; // 1-second Sa (g)
      siteClass: 'A' | 'B' | 'C' | 'D' | 'E';
      zone?: number; // For IS 1893
      ag?: number; // For Eurocode (g)
    },
    structuralSystem: 'moment-frame' | 'shear-wall' | 'braced-frame',
    ductility: 'high' | 'moderate' | 'low'
  ): { code: string; Cs: number; V: number; method: string }[] {
    const results: { code: string; Cs: number; V: number; method: string }[] = [];
    const T = fundamentalPeriod;
    const W = seismicWeight;
    const { Ss, S1, siteClass } = siteParams;
    
    // ASCE 7 / IBC
    const Fa = siteClass === 'D' ? 1.6 : siteClass === 'C' ? 1.2 : 1.0;
    const Fv = siteClass === 'D' ? 2.4 : siteClass === 'C' ? 1.7 : 1.0;
    const SDS = 2/3 * Fa * Ss;
    const SD1 = 2/3 * Fv * S1;
    const R_asce = this.responseModificationFactors(structuralSystem, ductility)
                     .find(f => f.code === 'ASCE 7')?.R || 5.0;
    const Ie_asce = 1.0;
    const Cs_asce = Math.min(
      SDS / (R_asce / Ie_asce),
      T <= SD1/SDS ? SDS / (R_asce / Ie_asce) : SD1 / (T * R_asce / Ie_asce)
    );
    const Cs_min = Math.max(0.044 * SDS * Ie_asce, 0.01);
    results.push({
      code: 'ASCE 7-22',
      Cs: Math.max(Cs_asce, Cs_min),
      V: Math.max(Cs_asce, Cs_min) * W,
      method: 'Equivalent Lateral Force'
    });
    
    // Eurocode 8
    const ag = siteParams.ag || Ss / 2.5;
    const S_ec = siteClass === 'D' ? 1.35 : siteClass === 'C' ? 1.15 : 1.0;
    const q_ec = this.responseModificationFactors(structuralSystem, ductility)
                   .find(f => f.code === 'Eurocode 8')?.R || 3.0;
    const TB = 0.15, TC = 0.5, TD = 2.0;
    let Sd_ec: number;
    if (T < TB) {
      Sd_ec = ag * S_ec * (2/3 + T/TB * (2.5/q_ec - 2/3));
    } else if (T < TC) {
      Sd_ec = ag * S_ec * 2.5 / q_ec;
    } else if (T < TD) {
      Sd_ec = ag * S_ec * 2.5 / q_ec * TC / T;
    } else {
      Sd_ec = ag * S_ec * 2.5 / q_ec * TC * TD / (T * T);
    }
    results.push({
      code: 'Eurocode 8',
      Cs: Sd_ec,
      V: Sd_ec * W,
      method: 'Lateral Force Method'
    });
    
    // IS 1893
    const Z = siteParams.zone ? siteParams.zone * 0.1 : 0.16;
    const I_is = 1.0;
    const R_is = this.responseModificationFactors(structuralSystem, ductility)
                   .find(f => f.code === 'IS 1893')?.R || 3.0;
    const Sa_g_is = T <= 0.1 ? 1 + 15 * T :
                    T <= 0.55 ? 2.5 :
                    T <= 4.0 ? 1.36 / T : 0.34;
    const Ah_is = Z * I_is * Sa_g_is / (2 * R_is);
    results.push({
      code: 'IS 1893:2016',
      Cs: Ah_is,
      V: Ah_is * W,
      method: 'Seismic Coefficient Method'
    });

    return results.sort((a, b) => b.V - a.V);
  }
}

// ============================================================================
// WIND LOAD COMPARISON
// ============================================================================

export class WindLoadComparison {
  /**
   * Basic wind pressure comparison
   */
  static basicWindPressure(
    basicWindSpeed: number, // m/s (3-sec gust for ASCE, mean for EC)
    height: number, // m
    terrainCategory: 'open' | 'suburban' | 'urban'
  ): { code: string; qz: number; method: string }[] {
    const results: { code: string; qz: number; method: string }[] = [];
    
    // ASCE 7 (3-second gust)
    const V_asce = basicWindSpeed;
    const Kz_asce = Math.pow(height / 10, 2 * 0.15); // Simplified
    const Kd = 0.85;
    const qz_asce = 0.613 * Kz_asce * Kd * V_asce * V_asce / 1000; // kPa
    results.push({
      code: 'ASCE 7-22',
      qz: qz_asce,
      method: '3-second gust, directional'
    });
    
    // Eurocode 1
    const V_b = basicWindSpeed * 0.84; // Convert 3-sec to 10-min mean
    const ce = 2.5; // Exposure factor for suburban
    const qp_ec = 0.5 * 1.25 * V_b * V_b * ce / 1000; // kPa
    results.push({
      code: 'EN 1991-1-4',
      qz: qp_ec,
      method: '10-minute mean, peak velocity pressure'
    });
    
    // IS 875 Part 3
    const V_is = basicWindSpeed;
    const k1 = 1.0; // Risk coefficient
    const k2 = Math.pow(height / 10, 0.14); // Terrain
    const k3 = 1.0; // Topography
    const Vz_is = V_is * k1 * k2 * k3;
    const pz_is = 0.6 * Vz_is * Vz_is / 1000; // kPa
    results.push({
      code: 'IS 875-3:2015',
      qz: pz_is,
      method: 'Design wind speed method'
    });
    
    // AS/NZS 1170.2
    const V_R = basicWindSpeed;
    const Mz = Math.pow(height / 10, 0.12);
    const qz_as = 0.5 * 1.2 * V_R * V_R * Mz * Mz / 1000; // kPa
    results.push({
      code: 'AS/NZS 1170.2',
      qz: qz_as,
      method: 'Regional wind speed'
    });

    return results.sort((a, b) => b.qz - a.qz);
  }

  /**
   * Wind force coefficients
   */
  static forceCoefficients(
    buildingShape: 'rectangular' | 'square' | 'circular',
    aspectRatio: number, // height/width
    openings: 'enclosed' | 'partially-enclosed' | 'open'
  ): { code: string; Cp_windward: number; Cp_leeward: number; GCpi: number }[] {
    const results: { code: string; Cp_windward: number; Cp_leeward: number; GCpi: number }[] = [];
    
    // ASCE 7
    let GCpi_asce: number;
    switch (openings) {
      case 'enclosed': GCpi_asce = 0.18; break;
      case 'partially-enclosed': GCpi_asce = 0.55; break;
      case 'open': GCpi_asce = 0.00; break;
    }
    results.push({
      code: 'ASCE 7',
      Cp_windward: 0.8,
      Cp_leeward: buildingShape === 'rectangular' ? -0.5 : -0.3,
      GCpi: GCpi_asce
    });
    
    // Eurocode 1
    const Cpe_10_wind = 0.8;
    const Cpe_10_lee = buildingShape === 'rectangular' ? -0.5 : -0.3;
    const Cpi_ec = openings === 'partially-enclosed' ? 0.7 : 0.2;
    results.push({
      code: 'Eurocode 1',
      Cp_windward: Cpe_10_wind,
      Cp_leeward: Cpe_10_lee,
      GCpi: Cpi_ec
    });
    
    // IS 875
    results.push({
      code: 'IS 875-3',
      Cp_windward: 0.8,
      Cp_leeward: buildingShape === 'rectangular' ? -0.4 : -0.25,
      GCpi: openings === 'partially-enclosed' ? 0.5 : 0.2
    });

    return results;
  }
}

// ============================================================================
// REINFORCEMENT DETAILING COMPARISON
// ============================================================================

export class DetailingComparison {
  /**
   * Minimum reinforcement ratios
   */
  static minimumReinforcement(
    element: 'beam-flexure' | 'column' | 'slab' | 'wall',
    fy: number // MPa
  ): { code: string; rho_min: number; formula: string }[] {
    const results: { code: string; rho_min: number; formula: string }[] = [];
    
    if (element === 'beam-flexure') {
      results.push({ code: 'ACI 318', rho_min: Math.max(0.25 * Math.sqrt(28) / fy, 1.4 / fy), formula: 'max(0.25√fc/fy, 1.4/fy)' });
      results.push({ code: 'Eurocode 2', rho_min: 0.26 * 2.2 / fy, formula: '0.26fctm/fyk' });
      results.push({ code: 'IS 456', rho_min: 0.85 / fy, formula: '0.85/fy' });
      results.push({ code: 'AS 3600', rho_min: 0.22 * Math.pow(30, 2/3) / fy, formula: '0.22(fc)^0.67/fy' });
    } else if (element === 'column') {
      results.push({ code: 'ACI 318', rho_min: 0.01, formula: '1%' });
      results.push({ code: 'Eurocode 2', rho_min: 0.002, formula: '0.2% or 0.10Ned/(fyd·Ac)' });
      results.push({ code: 'IS 456', rho_min: 0.008, formula: '0.8%' });
      results.push({ code: 'AS 3600', rho_min: 0.01, formula: '1%' });
    } else if (element === 'slab') {
      results.push({ code: 'ACI 318', rho_min: 0.0018, formula: '0.18% for fy=420' });
      results.push({ code: 'Eurocode 2', rho_min: 0.0013, formula: 'As,min = 0.26fctm/fyk × bd' });
      results.push({ code: 'IS 456', rho_min: 0.0012, formula: '0.12% HYSD' });
      results.push({ code: 'AS 3600', rho_min: 0.0025, formula: '0.25%' });
    } else if (element === 'wall') {
      results.push({ code: 'ACI 318', rho_min: 0.0012, formula: '0.12% each way' });
      results.push({ code: 'Eurocode 2', rho_min: 0.002, formula: '0.2% each direction' });
      results.push({ code: 'IS 456', rho_min: 0.0012, formula: '0.12% HYSD' });
    }

    return results.sort((a, b) => b.rho_min - a.rho_min);
  }

  /**
   * Maximum reinforcement ratios
   */
  static maximumReinforcement(
    element: 'beam' | 'column'
  ): { code: string; rho_max: number; notes: string }[] {
    const results: { code: string; rho_max: number; notes: string }[] = [];
    
    if (element === 'beam') {
      results.push({ code: 'ACI 318', rho_max: 0.025, notes: 'Effectively from strain compatibility' });
      results.push({ code: 'Eurocode 2', rho_max: 0.04, notes: '4% of gross section' });
      results.push({ code: 'IS 456', rho_max: 0.04, notes: '4% of gross section' });
      results.push({ code: 'AS 3600', rho_max: 0.04, notes: '4% of gross section' });
    } else {
      results.push({ code: 'ACI 318', rho_max: 0.08, notes: '8% (6% at lap)' });
      results.push({ code: 'Eurocode 2', rho_max: 0.04, notes: '4% (8% at lap)' });
      results.push({ code: 'IS 456', rho_max: 0.06, notes: '6%' });
      results.push({ code: 'AS 3600', rho_max: 0.04, notes: '4%' });
    }

    return results.sort((a, b) => b.rho_max - a.rho_max);
  }

  /**
   * Lap length comparison
   */
  static lapLengthComparison(
    barDiameter: number, // mm
    fy: number, // MPa
    fc: number, // MPa
    position: 'top' | 'bottom'
  ): { code: string; lapLength: number; ratio: number }[] {
    const results: { code: string; lapLength: number; ratio: number }[] = [];
    
    // ACI 318
    const psi_t = position === 'top' ? 1.3 : 1.0;
    const Ld_aci = barDiameter * fy * psi_t / (2.1 * Math.sqrt(fc));
    const lap_aci = 1.3 * Ld_aci; // Class B
    results.push({ code: 'ACI 318', lapLength: lap_aci, ratio: lap_aci / barDiameter });
    
    // Eurocode 2
    const eta1 = position === 'top' ? 0.7 : 1.0;
    const fbd = 2.25 * eta1 * 0.3 * Math.pow(fc, 2/3) / 1.5;
    const lb_rqd = barDiameter * fy / (4 * fbd * 1.15);
    const l0_ec = 1.5 * lb_rqd;
    results.push({ code: 'Eurocode 2', lapLength: l0_ec, ratio: l0_ec / barDiameter });
    
    // IS 456
    const tau_bd = 1.6; // For M30
    const Ld_is = barDiameter * 0.87 * fy / (4 * tau_bd);
    const lap_is = 1.0 * Ld_is;
    results.push({ code: 'IS 456', lapLength: lap_is, ratio: lap_is / barDiameter });

    return results.sort((a, b) => b.lapLength - a.lapLength);
  }
}

// ============================================================================
// CODE COMPLIANCE MATRIX
// ============================================================================

export class CodeComplianceMatrix {
  /**
   * Generate compliance check matrix
   */
  static generateMatrix(
    checks: string[],
    codes: string[]
  ): {
    checkMatrix: { check: string; results: { code: string; status: 'pass' | 'fail' | 'na' }[] }[];
    summary: { code: string; passCount: number; failCount: number }[];
  } {
    const checkMatrix: { check: string; results: { code: string; status: 'pass' | 'fail' | 'na' }[] }[] = [];
    const summary = codes.map(code => ({ code, passCount: 0, failCount: 0 }));
    
    for (const check of checks) {
      const results = codes.map(code => ({
        code,
        status: 'pass' as 'pass' | 'fail' | 'na' // Placeholder - actual check logic would go here
      }));
      checkMatrix.push({ check, results });
    }

    return { checkMatrix, summary };
  }

  /**
   * Get most conservative design
   */
  static getMostConservative(
    parameter: string,
    values: { code: string; value: number; isHigherBetter: boolean }[]
  ): { code: string; value: number; conservatism: string } {
    const sorted = values.sort((a, b) => 
      a.isHigherBetter ? b.value - a.value : a.value - b.value
    );
    
    return {
      code: sorted[0].code,
      value: sorted[0].value,
      conservatism: 'Most conservative'
    };
  }

  /**
   * Generate recommendation based on project location
   */
  static regionRecommendation(
    projectLocation: string,
    projectType: 'residential' | 'commercial' | 'industrial' | 'infrastructure'
  ): {
    primaryCode: string;
    alternativeCodes: string[];
    considerations: string[];
  } {
    const regions: Record<string, { primary: string; alt: string[]; notes: string[] }> = {
      'USA': {
        primary: 'ASCE 7 / ACI 318 / AISC 360',
        alt: ['IBC', 'State-specific amendments'],
        notes: ['Check local jurisdiction requirements', 'Seismic design category matters']
      },
      'Europe': {
        primary: 'Eurocodes (EN 1990-1999)',
        alt: ['National Annexes vary by country', 'BS 8110 (legacy UK)'],
        notes: ['National Annexes are mandatory', 'Check NADs for specific values']
      },
      'India': {
        primary: 'IS Codes (456, 800, 875, 1893)',
        alt: ['NBC', 'State PWD codes'],
        notes: ['Zone-specific seismic requirements', 'Climate considerations for durability']
      },
      'Australia': {
        primary: 'AS/NZS Standards',
        alt: ['BCA requirements'],
        notes: ['Cyclonic regions have special requirements', 'Fire regulations important']
      },
      'Middle East': {
        primary: 'ACI 318 / ASCE 7 (most common)',
        alt: ['BS codes', 'Local municipality codes'],
        notes: ['High temperatures affect durability', 'Consider sulfate exposure']
      },
      'Southeast Asia': {
        primary: 'Local codes based on BS/ACI',
        alt: ['Singapore: SS codes', 'Malaysia: MS codes'],
        notes: ['High humidity considerations', 'Seismic zones vary significantly']
      }
    };
    
    const region = Object.keys(regions).find(r => projectLocation.includes(r)) || 'USA';
    const data = regions[region];

    return {
      primaryCode: data.primary,
      alternativeCodes: data.alt,
      considerations: data.notes
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LoadFactorComparison,
  MaterialFactorComparison,
  SeismicDesignComparison,
  WindLoadComparison,
  DetailingComparison,
  CodeComplianceMatrix
};
