/**
 * BeamLab Ultimate - Load Combinations Engine
 * Comprehensive load combination generator per international codes
 * 
 * Supported Codes:
 * - IS 456:2000 / IS 1893:2016 (India)
 * - ASCE 7-22 / ACI 318-19 (USA)  
 * - EN 1990:2002 Eurocode (Europe)
 * - AS/NZS 1170 (Australia/New Zealand)
 * - NBC 2020 (Canada)
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type LoadCombinationCode = 
  | 'IS456' | 'IS1893' 
  | 'ASCE7' | 'ACI318' 
  | 'EN1990' | 'EC0'
  | 'AS1170' | 'NZS1170'
  | 'NBC2020';

export type LoadType = 
  | 'dead' | 'live' | 'roof_live' | 'snow' | 'rain'
  | 'wind' | 'seismic' | 'earth_pressure' | 'fluid_pressure'
  | 'temperature' | 'creep' | 'shrinkage' | 'settlement'
  | 'impact' | 'crane' | 'vehicle' | 'special';

export type LimitState = 'ULS' | 'SLS' | 'fatigue' | 'accidental' | 'seismic';

export interface LoadCase {
  id: string;
  name: string;
  type: LoadType;
  category?: string;
  magnitude?: number;
  direction?: 'X' | 'Y' | 'Z' | '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';
  reversible?: boolean;
  duration?: 'permanent' | 'long-term' | 'medium-term' | 'short-term' | 'instantaneous';
}

export interface LoadCombination {
  id: string;
  name: string;
  code: LoadCombinationCode;
  limitState: LimitState;
  factors: LoadFactor[];
  description?: string;
  isEnvelope?: boolean;
  notes?: string;
}

export interface LoadFactor {
  loadCaseId: string;
  loadType: LoadType;
  factor: number;
  psiValue?: number; // Combination factor
  gammaValue?: number; // Partial safety factor
}

export interface CombinationResult {
  combinationId: string;
  forces: {
    nodeId: string;
    fx: number;
    fy: number;
    fz: number;
    mx: number;
    my: number;
    mz: number;
  }[];
  maxValues: {
    maxFx: number;
    maxFy: number;
    maxFz: number;
    maxMx: number;
    maxMy: number;
    maxMz: number;
  };
  governingCase: string;
}

// ============================================================================
// LOAD FACTOR TABLES BY CODE
// ============================================================================

interface CodeFactors {
  dead: { favorable: number; unfavorable: number };
  live: { favorable: number; unfavorable: number };
  wind: { favorable: number; unfavorable: number };
  seismic: { favorable: number; unfavorable: number };
  snow: { favorable: number; unfavorable: number };
  psiFactors: { live: number; wind: number; snow: number; seismic: number };
}

const LOAD_FACTORS: Record<LoadCombinationCode, { ULS: CodeFactors; SLS: CodeFactors }> = {
  // IS 456:2000 / IS 1893:2016
  IS456: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.5 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.5 },
      seismic: { favorable: 0.0, unfavorable: 1.5 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.5, wind: 0.6, snow: 0.5, seismic: 0.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.3, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  IS1893: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.5 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.5 },
      seismic: { favorable: 0.0, unfavorable: 1.5 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.25, wind: 0.0, snow: 0.0, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 0.8 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.3, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  
  // ASCE 7-22
  ASCE7: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.4 },
      live: { favorable: 0.0, unfavorable: 1.6 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.6 },
      psiFactors: { live: 0.5, wind: 1.0, snow: 0.5, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 0.7 },
      seismic: { favorable: 0.0, unfavorable: 0.7 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.5, wind: 0.0, snow: 0.2, seismic: 0.0 },
    },
  },
  ACI318: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.4 },
      live: { favorable: 0.0, unfavorable: 1.6 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.6 },
      psiFactors: { live: 0.5, wind: 1.0, snow: 0.5, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 0.6 },
      seismic: { favorable: 0.0, unfavorable: 0.7 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.3, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  
  // Eurocode EN 1990
  EN1990: {
    ULS: {
      dead: { favorable: 1.0, unfavorable: 1.35 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.5 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.7, wind: 0.6, snow: 0.5, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.5, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  EC0: {
    ULS: {
      dead: { favorable: 1.0, unfavorable: 1.35 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.5 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.7, wind: 0.6, snow: 0.5, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.0 },
      psiFactors: { live: 0.5, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  
  // AS/NZS 1170
  AS1170: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.35 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.4, wind: 1.0, snow: 0.6, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 0.7 },
      wind: { favorable: 0.0, unfavorable: 0.7 },
      seismic: { favorable: 0.0, unfavorable: 0.7 },
      snow: { favorable: 0.0, unfavorable: 0.7 },
      psiFactors: { live: 0.4, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  NZS1170: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.35 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.0 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.4, wind: 1.0, snow: 0.6, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 0.6 },
      wind: { favorable: 0.0, unfavorable: 0.6 },
      seismic: { favorable: 0.0, unfavorable: 0.6 },
      snow: { favorable: 0.0, unfavorable: 0.6 },
      psiFactors: { live: 0.3, wind: 0.0, snow: 0.0, seismic: 0.0 },
    },
  },
  
  // NBC 2020 Canada
  NBC2020: {
    ULS: {
      dead: { favorable: 0.9, unfavorable: 1.4 },
      live: { favorable: 0.0, unfavorable: 1.5 },
      wind: { favorable: 0.0, unfavorable: 1.4 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 1.5 },
      psiFactors: { live: 0.5, wind: 0.4, snow: 0.5, seismic: 1.0 },
    },
    SLS: {
      dead: { favorable: 1.0, unfavorable: 1.0 },
      live: { favorable: 0.0, unfavorable: 1.0 },
      wind: { favorable: 0.0, unfavorable: 0.75 },
      seismic: { favorable: 0.0, unfavorable: 1.0 },
      snow: { favorable: 0.0, unfavorable: 0.9 },
      psiFactors: { live: 0.3, wind: 0.0, snow: 0.25, seismic: 0.0 },
    },
  },
};

// ============================================================================
// LOAD COMBINATIONS ENGINE CLASS
// ============================================================================

export class LoadCombinationsEngine {
  private code: LoadCombinationCode;
  private loadCases: LoadCase[] = [];
  private combinations: LoadCombination[] = [];
  
  constructor(code: LoadCombinationCode = 'IS456') {
    this.code = code;
  }
  
  /**
   * Add a load case to the engine
   */
  addLoadCase(loadCase: LoadCase): void {
    this.loadCases.push(loadCase);
  }
  
  /**
   * Add multiple load cases
   */
  addLoadCases(loadCases: LoadCase[]): void {
    this.loadCases.push(...loadCases);
  }
  
  /**
   * Get all defined load cases
   */
  getLoadCases(): LoadCase[] {
    return [...this.loadCases];
  }
  
  /**
   * Generate all standard load combinations per code
   */
  generateCombinations(options?: {
    includeSLS?: boolean;
    includeSeismic?: boolean;
    includeWind?: boolean;
    customCombinations?: LoadCombination[];
  }): LoadCombination[] {
    this.combinations = [];
    
    const opts = {
      includeSLS: true,
      includeSeismic: true,
      includeWind: true,
      ...options,
    };
    
    // Generate ULS combinations
    this.generateULSCombinations(opts);
    
    // Generate SLS combinations
    if (opts.includeSLS) {
      this.generateSLSCombinations();
    }
    
    // Add seismic combinations
    if (opts.includeSeismic && this.hasLoadType('seismic')) {
      this.generateSeismicCombinations();
    }
    
    // Add wind combinations
    if (opts.includeWind && this.hasLoadType('wind')) {
      this.generateWindCombinations();
    }
    
    // Add custom combinations
    if (opts.customCombinations) {
      this.combinations.push(...opts.customCombinations);
    }
    
    return this.combinations;
  }
  
  /**
   * Generate ULS (Ultimate Limit State) combinations
   */
  private generateULSCombinations(options: { includeSeismic?: boolean; includeWind?: boolean }): void {
    const factors = LOAD_FACTORS[this.code].ULS;
    const deadCases = this.loadCases.filter(lc => lc.type === 'dead');
    const liveCases = this.loadCases.filter(lc => lc.type === 'live');
    const windCases = this.loadCases.filter(lc => lc.type === 'wind');
    const seismicCases = this.loadCases.filter(lc => lc.type === 'seismic');
    const snowCases = this.loadCases.filter(lc => lc.type === 'snow');
    
    let combId = 1;
    
    // Combination 1: Dead only (1.4D for ASCE, 1.5D for IS)
    this.combinations.push({
      id: `ULS${combId++}`,
      name: this.getCodeSpecificName('Dead', 'ULS'),
      code: this.code,
      limitState: 'ULS',
      factors: deadCases.map(dc => ({
        loadCaseId: dc.id,
        loadType: dc.type,
        factor: factors.dead.unfavorable,
        gammaValue: factors.dead.unfavorable,
      })),
      description: 'Dead load only - maximum gravity',
    });
    
    // Combination 2: Dead + Live (basic gravity)
    // ASCE 7-22 Combo 2: 1.2D + 1.6L (NOT 1.4D + 1.6L)
    // IS 456/IS 1893: 1.5(D+L)
    if (liveCases.length > 0) {
      const deadFactorForDL = (this.code.startsWith('ASCE') || this.code.startsWith('ACI'))
        ? 1.2  // ASCE 7-22 Combo 2
        : factors.dead.unfavorable;
      
      this.combinations.push({
        id: `ULS${combId++}`,
        name: this.getCodeSpecificName('Dead + Live', 'ULS'),
        code: this.code,
        limitState: 'ULS',
        factors: [
          ...deadCases.map(dc => ({
            loadCaseId: dc.id,
            loadType: dc.type,
            factor: deadFactorForDL,
            gammaValue: deadFactorForDL,
          })),
          ...liveCases.map(lc => ({
            loadCaseId: lc.id,
            loadType: lc.type,
            factor: factors.live.unfavorable,
            gammaValue: factors.live.unfavorable,
          })),
        ],
        description: 'Gravity loads - dead plus live',
      });
    }
    
    // Combination 3: Dead + Wind (uplift check)
    if (windCases.length > 0 && options.includeWind) {
      // Uplift: 0.9D + W
      this.combinations.push({
        id: `ULS${combId++}`,
        name: this.getCodeSpecificName('Dead + Wind (Uplift)', 'ULS'),
        code: this.code,
        limitState: 'ULS',
        factors: [
          ...deadCases.map(dc => ({
            loadCaseId: dc.id,
            loadType: dc.type,
            factor: factors.dead.favorable, // Minimum dead for uplift
            gammaValue: factors.dead.favorable,
          })),
          ...windCases.map(wc => ({
            loadCaseId: wc.id,
            loadType: wc.type,
            factor: factors.wind.unfavorable,
            gammaValue: factors.wind.unfavorable,
          })),
        ],
        description: 'Wind uplift with minimum dead load',
      });
      
      // Lateral: 1.2D + 1.0W + 0.5L (ASCE)
      if (liveCases.length > 0) {
        this.combinations.push({
          id: `ULS${combId++}`,
          name: this.getCodeSpecificName('Dead + Live + Wind', 'ULS'),
          code: this.code,
          limitState: 'ULS',
          factors: [
            ...deadCases.map(dc => ({
              loadCaseId: dc.id,
              loadType: dc.type,
              factor: this.code.startsWith('ASCE') || this.code.startsWith('ACI') ? 1.2 : factors.dead.unfavorable,
              gammaValue: factors.dead.unfavorable,
            })),
            ...liveCases.map(lc => ({
              loadCaseId: lc.id,
              loadType: lc.type,
              factor: factors.psiFactors.live,
              psiValue: factors.psiFactors.live,
            })),
            ...windCases.map(wc => ({
              loadCaseId: wc.id,
              loadType: wc.type,
              factor: factors.wind.unfavorable,
              gammaValue: factors.wind.unfavorable,
            })),
          ],
          description: 'Combined gravity and wind lateral',
        });
      }
    }
    
    // Combination 4: Dead + Seismic
    if (seismicCases.length > 0 && options.includeSeismic) {
      this.combinations.push({
        id: `ULS${combId++}`,
        name: this.getCodeSpecificName('Dead + Seismic', 'ULS'),
        code: this.code,
        limitState: 'ULS',
        factors: [
          ...deadCases.map(dc => ({
            loadCaseId: dc.id,
            loadType: dc.type,
            factor: this.code.startsWith('ASCE') ? 1.2 : factors.dead.unfavorable,
            gammaValue: factors.dead.unfavorable,
          })),
          ...seismicCases.map(sc => ({
            loadCaseId: sc.id,
            loadType: sc.type,
            factor: factors.seismic.unfavorable,
            gammaValue: factors.seismic.unfavorable,
          })),
        ],
        description: 'Seismic with full dead load',
      });
      
      // Full seismic combination
      if (liveCases.length > 0) {
        // IS 1893:2016 Table 6: 1.2(DL + LL ± EQ)
        // ASCE 7-22 Combo 5: 1.2D + 1.0E + 0.5L
        const dlFactorSeismic = this.code === 'IS1893' ? 1.2
          : this.code.startsWith('ASCE') ? 1.2
          : factors.dead.unfavorable;
        const eqFactorSeismic = this.code === 'IS1893' ? 1.2
          : factors.seismic.unfavorable;
        
        this.combinations.push({
          id: `ULS${combId++}`,
          name: this.getCodeSpecificName('Dead + Live + Seismic', 'ULS'),
          code: this.code,
          limitState: 'ULS',
          factors: [
            ...deadCases.map(dc => ({
              loadCaseId: dc.id,
              loadType: dc.type,
              factor: dlFactorSeismic,
              gammaValue: dlFactorSeismic,
            })),
            ...liveCases.map(lc => ({
              loadCaseId: lc.id,
              loadType: lc.type,
              factor: this.code === 'IS1893' ? 1.2 : this.getSeismicLiveFactor(),
              psiValue: this.getSeismicLiveFactor(),
            })),
            ...seismicCases.map(sc => ({
              loadCaseId: sc.id,
              loadType: sc.type,
              factor: eqFactorSeismic,
              gammaValue: eqFactorSeismic,
            })),
          ],
          description: this.code === 'IS1893'
            ? 'IS 1893 Table 6: 1.2(DL + LL ± EQ)'
            : 'Full seismic design combination',
        });
        
        // Minimum dead with seismic (overturning)
        this.combinations.push({
          id: `ULS${combId++}`,
          name: this.getCodeSpecificName('Dead (Min) + Seismic', 'ULS'),
          code: this.code,
          limitState: 'ULS',
          factors: [
            ...deadCases.map(dc => ({
              loadCaseId: dc.id,
              loadType: dc.type,
              factor: factors.dead.favorable,
              gammaValue: factors.dead.favorable,
            })),
            ...seismicCases.map(sc => ({
              loadCaseId: sc.id,
              loadType: sc.type,
              factor: factors.seismic.unfavorable,
              gammaValue: factors.seismic.unfavorable,
            })),
          ],
          description: 'Seismic overturning check',
        });
      }
    }
    
    // Combination 5: Snow loads if present
    if (snowCases.length > 0) {
      this.combinations.push({
        id: `ULS${combId++}`,
        name: this.getCodeSpecificName('Dead + Live + Snow', 'ULS'),
        code: this.code,
        limitState: 'ULS',
        factors: [
          ...deadCases.map(dc => ({
            loadCaseId: dc.id,
            loadType: dc.type,
            factor: factors.dead.unfavorable,
            gammaValue: factors.dead.unfavorable,
          })),
          ...liveCases.map(lc => ({
            loadCaseId: lc.id,
            loadType: lc.type,
            factor: factors.psiFactors.live,
            psiValue: factors.psiFactors.live,
          })),
          ...snowCases.map(sc => ({
            loadCaseId: sc.id,
            loadType: sc.type,
            factor: factors.snow.unfavorable,
            gammaValue: factors.snow.unfavorable,
          })),
        ],
        description: 'Gravity with snow load',
      });
    }
  }
  
  /**
   * Generate SLS (Serviceability Limit State) combinations
   */
  private generateSLSCombinations(): void {
    const factors = LOAD_FACTORS[this.code].SLS;
    const deadCases = this.loadCases.filter(lc => lc.type === 'dead');
    const liveCases = this.loadCases.filter(lc => lc.type === 'live');
    
    let combId = 1;
    
    // Characteristic combination: D + L
    this.combinations.push({
      id: `SLS${combId++}`,
      name: 'SLS - Characteristic',
      code: this.code,
      limitState: 'SLS',
      factors: [
        ...deadCases.map(dc => ({
          loadCaseId: dc.id,
          loadType: dc.type,
          factor: factors.dead.unfavorable,
        })),
        ...liveCases.map(lc => ({
          loadCaseId: lc.id,
          loadType: lc.type,
          factor: factors.live.unfavorable,
        })),
      ],
      description: 'Serviceability - deflection check',
    });
    
    // Quasi-permanent combination (for long-term effects)
    this.combinations.push({
      id: `SLS${combId++}`,
      name: 'SLS - Quasi-permanent',
      code: this.code,
      limitState: 'SLS',
      factors: [
        ...deadCases.map(dc => ({
          loadCaseId: dc.id,
          loadType: dc.type,
          factor: factors.dead.unfavorable,
        })),
        ...liveCases.map(lc => ({
          loadCaseId: lc.id,
          loadType: lc.type,
          factor: factors.psiFactors.live, // ψ2 factor
          psiValue: factors.psiFactors.live,
        })),
      ],
      description: 'Serviceability - cracking/long-term deflection',
    });
  }
  
  /**
   * Generate seismic-specific combinations
   */
  private generateSeismicCombinations(): void {
    const seismicCases = this.loadCases.filter(lc => lc.type === 'seismic');
    const deadCases = this.loadCases.filter(lc => lc.type === 'dead');
    const liveCases = this.loadCases.filter(lc => lc.type === 'live');
    
    let combId = 1;
    
    // Generate +X, -X, +Y, -Y directions if not already specified
    seismicCases.forEach(sc => {
      if (sc.reversible !== false) {
        // Positive direction
        this.combinations.push({
          id: `SEI${combId++}`,
          name: `Seismic ${sc.name} (+)`,
          code: this.code,
          limitState: 'seismic',
          factors: [
            ...deadCases.map(dc => ({
              loadCaseId: dc.id,
              loadType: dc.type,
              factor: 1.0,
            })),
            ...liveCases.map(lc => ({
              loadCaseId: lc.id,
              loadType: lc.type,
              factor: this.getSeismicLiveFactor(),
            })),
            {
              loadCaseId: sc.id,
              loadType: sc.type,
              factor: 1.0,
            },
          ],
        });
        
        // Negative direction
        this.combinations.push({
          id: `SEI${combId++}`,
          name: `Seismic ${sc.name} (-)`,
          code: this.code,
          limitState: 'seismic',
          factors: [
            ...deadCases.map(dc => ({
              loadCaseId: dc.id,
              loadType: dc.type,
              factor: 1.0,
            })),
            ...liveCases.map(lc => ({
              loadCaseId: lc.id,
              loadType: lc.type,
              factor: this.getSeismicLiveFactor(),
            })),
            {
              loadCaseId: sc.id,
              loadType: sc.type,
              factor: -1.0,
            },
          ],
        });
      }
    });
  }
  
  /**
   * Generate wind-specific combinations
   */
  private generateWindCombinations(): void {
    const windCases = this.loadCases.filter(lc => lc.type === 'wind');
    const deadCases = this.loadCases.filter(lc => lc.type === 'dead');
    const liveCases = this.loadCases.filter(lc => lc.type === 'live');
    const factors = LOAD_FACTORS[this.code].ULS;
    
    let combId = 1;
    
    windCases.forEach(wc => {
      if (wc.reversible !== false) {
        // Both directions for wind
        [1.0, -1.0].forEach(dir => {
          this.combinations.push({
            id: `WND${combId++}`,
            name: `Wind ${wc.name} (${dir > 0 ? '+' : '-'})`,
            code: this.code,
            limitState: 'ULS',
            factors: [
              ...deadCases.map(dc => ({
                loadCaseId: dc.id,
                loadType: dc.type,
                factor: dir > 0 ? factors.dead.unfavorable : factors.dead.favorable,
              })),
              ...liveCases.map(lc => ({
                loadCaseId: lc.id,
                loadType: lc.type,
                factor: factors.psiFactors.live,
              })),
              {
                loadCaseId: wc.id,
                loadType: wc.type,
                factor: factors.wind.unfavorable * dir,
              },
            ],
          });
        });
      }
    });
  }
  
  /**
   * Get seismic live load reduction factor
   */
  private getSeismicLiveFactor(): number {
    switch (this.code) {
      case 'IS1893':
      case 'IS456':
        return 0.25; // 25% live load for seismic
      case 'ASCE7':
      case 'ACI318':
        return 0.5; // 50% live load
      case 'EN1990':
      case 'EC0':
        return 0.3; // ψ2 factor
      case 'AS1170':
      case 'NZS1170':
        return 0.4;
      case 'NBC2020':
        return 0.5;
      default:
        return 0.5;
    }
  }
  
  /**
   * Get code-specific combination name
   */
  private getCodeSpecificName(baseName: string, limitState: string): string {
    const prefix = this.code.startsWith('IS') ? 'LC' :
                   this.code.startsWith('ASCE') || this.code.startsWith('ACI') ? 'LC' :
                   this.code.startsWith('EN') || this.code.startsWith('EC') ? 'CO' :
                   'LC';
    return `${prefix} - ${limitState} - ${baseName}`;
  }
  
  /**
   * Check if load type exists in load cases
   */
  private hasLoadType(type: LoadType): boolean {
    return this.loadCases.some(lc => lc.type === type);
  }
  
  /**
   * Get all generated combinations
   */
  getCombinations(): LoadCombination[] {
    return [...this.combinations];
  }
  
  /**
   * Get combinations by limit state
   */
  getCombinationsByLimitState(limitState: LimitState): LoadCombination[] {
    return this.combinations.filter(c => c.limitState === limitState);
  }
  
  /**
   * Create envelope combination
   */
  createEnvelope(name: string, combinationIds: string[]): LoadCombination {
    const envelope: LoadCombination = {
      id: `ENV_${Date.now()}`,
      name,
      code: this.code,
      limitState: 'ULS',
      factors: [],
      isEnvelope: true,
      notes: `Envelope of: ${combinationIds.join(', ')}`,
    };
    
    this.combinations.push(envelope);
    return envelope;
  }
  
  /**
   * Export combinations to text format
   */
  exportToText(): string {
    let output = `LOAD COMBINATIONS - ${this.code}\n`;
    output += '='.repeat(60) + '\n\n';
    
    const byLimitState = {
      ULS: this.combinations.filter(c => c.limitState === 'ULS'),
      SLS: this.combinations.filter(c => c.limitState === 'SLS'),
      seismic: this.combinations.filter(c => c.limitState === 'seismic'),
    };
    
    Object.entries(byLimitState).forEach(([ls, combos]) => {
      if (combos.length === 0) return;
      
      output += `\n${ls.toUpperCase()} COMBINATIONS\n`;
      output += '-'.repeat(40) + '\n';
      
      combos.forEach(combo => {
        output += `\n${combo.id}: ${combo.name}\n`;
        if (combo.description) output += `   ${combo.description}\n`;
        
        combo.factors.forEach(f => {
          const loadCase = this.loadCases.find(lc => lc.id === f.loadCaseId);
          output += `   ${f.factor >= 0 ? '+' : ''}${f.factor.toFixed(2)} × ${loadCase?.name || f.loadCaseId}`;
          if (f.psiValue) output += ` (ψ=${f.psiValue})`;
          output += '\n';
        });
      });
    });
    
    return output;
  }
  
  /**
   * Export combinations to JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      code: this.code,
      loadCases: this.loadCases,
      combinations: this.combinations,
      generated: new Date().toISOString(),
    }, null, 2);
  }
  
  /**
   * Calculate combined results for all combinations
   */
  calculateCombinedResults(
    loadCaseResults: Record<string, { nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[]>
  ): CombinationResult[] {
    const results: CombinationResult[] = [];
    
    this.combinations.forEach(combo => {
      const combinedForces: Map<string, { fx: number; fy: number; fz: number; mx: number; my: number; mz: number }> = new Map();
      
      combo.factors.forEach(factor => {
        const caseResults = loadCaseResults[factor.loadCaseId];
        if (!caseResults) return;
        
        caseResults.forEach(r => {
          const existing = combinedForces.get(r.nodeId) || { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
          combinedForces.set(r.nodeId, {
            fx: existing.fx + r.fx * factor.factor,
            fy: existing.fy + r.fy * factor.factor,
            fz: existing.fz + r.fz * factor.factor,
            mx: existing.mx + r.mx * factor.factor,
            my: existing.my + r.my * factor.factor,
            mz: existing.mz + r.mz * factor.factor,
          });
        });
      });
      
      const forces = Array.from(combinedForces.entries()).map(([nodeId, f]) => ({
        nodeId,
        ...f,
      }));
      
      const maxValues = {
        maxFx: Math.max(...forces.map(f => Math.abs(f.fx))),
        maxFy: Math.max(...forces.map(f => Math.abs(f.fy))),
        maxFz: Math.max(...forces.map(f => Math.abs(f.fz))),
        maxMx: Math.max(...forces.map(f => Math.abs(f.mx))),
        maxMy: Math.max(...forces.map(f => Math.abs(f.my))),
        maxMz: Math.max(...forces.map(f => Math.abs(f.mz))),
      };
      
      results.push({
        combinationId: combo.id,
        forces,
        maxValues,
        governingCase: combo.name,
      });
    });
    
    return results;
  }
  
  /**
   * Get governing combination for each force component
   */
  getGoverningCombinations(results: CombinationResult[]): Record<string, string> {
    const governing: Record<string, { combo: string; value: number }> = {
      maxFx: { combo: '', value: 0 },
      maxFy: { combo: '', value: 0 },
      maxFz: { combo: '', value: 0 },
      maxMx: { combo: '', value: 0 },
      maxMy: { combo: '', value: 0 },
      maxMz: { combo: '', value: 0 },
    };
    
    results.forEach(r => {
      Object.entries(r.maxValues).forEach(([key, value]) => {
        if (value > governing[key].value) {
          governing[key] = { combo: r.combinationId, value };
        }
      });
    });
    
    return Object.fromEntries(
      Object.entries(governing).map(([k, v]) => [k, v.combo])
    );
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create load combinations engine for specific code
 */
export function createLoadCombinationsEngine(code: LoadCombinationCode): LoadCombinationsEngine {
  return new LoadCombinationsEngine(code);
}

/**
 * Generate standard load cases for a typical building
 */
export function generateStandardLoadCases(): LoadCase[] {
  return [
    { id: 'DL', name: 'Dead Load', type: 'dead', duration: 'permanent' },
    { id: 'SDL', name: 'Superimposed Dead Load', type: 'dead', duration: 'permanent' },
    { id: 'LL', name: 'Live Load', type: 'live', duration: 'medium-term' },
    { id: 'RLL', name: 'Roof Live Load', type: 'roof_live', duration: 'short-term' },
    { id: 'WLX', name: 'Wind Load X', type: 'wind', direction: 'X', reversible: true },
    { id: 'WLY', name: 'Wind Load Y', type: 'wind', direction: 'Y', reversible: true },
    { id: 'EQX', name: 'Seismic X', type: 'seismic', direction: 'X', reversible: true },
    { id: 'EQY', name: 'Seismic Y', type: 'seismic', direction: 'Y', reversible: true },
  ];
}

/**
 * Get load factor summary for a code
 */
export function getLoadFactorSummary(code: LoadCombinationCode): string {
  const factors = LOAD_FACTORS[code];
  
  return `
Load Factors for ${code}
========================
ULS Factors:
  Dead (unfavorable): ${factors.ULS.dead.unfavorable}
  Dead (favorable):   ${factors.ULS.dead.favorable}
  Live:               ${factors.ULS.live.unfavorable}
  Wind:               ${factors.ULS.wind.unfavorable}
  Seismic:            ${factors.ULS.seismic.unfavorable}

SLS Factors:
  Dead:               ${factors.SLS.dead.unfavorable}
  Live:               ${factors.SLS.live.unfavorable}

Combination (ψ) Factors:
  Live (ψ):           ${factors.ULS.psiFactors.live}
  Wind (ψ):           ${factors.ULS.psiFactors.wind}
  Snow (ψ):           ${factors.ULS.psiFactors.snow}
  `.trim();
}

// Default export
export default LoadCombinationsEngine;
