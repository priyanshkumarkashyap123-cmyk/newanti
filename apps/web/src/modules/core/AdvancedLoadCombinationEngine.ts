/**
 * ============================================================================
 * ADVANCED LOAD COMBINATION ENGINE V3.0
 * ============================================================================
 * 
 * Multi-code load combination generator and analyzer:
 * - IS 875 / IS 456 (India)
 * - ASCE 7-22 (USA)
 * - EN 1990 (Europe)
 * - AS/NZS 1170 (Australia/NZ)
 * 
 * Features:
 * - Automatic combination generation
 * - Pattern loading
 * - Live load reduction
 * - Wind/Seismic combinations
 * - Temperature effects
 * - Settlement loads
 * 
 * @version 3.0.0
 */

import { PrecisionMath } from './PrecisionMath';
import { EngineeringErrorHandler } from './EngineeringErrorHandler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type LoadCombinationCode = 'IS' | 'ASCE' | 'EN' | 'AS';

export type LoadCategory = 
  | 'dead'
  | 'live' 
  | 'live_roof'
  | 'snow'
  | 'rain'
  | 'wind'
  | 'seismic'
  | 'earth_pressure'
  | 'fluid_pressure'
  | 'temperature'
  | 'settlement'
  | 'crane'
  | 'impact'
  | 'special';

export type LimitState = 'ultimate' | 'serviceability' | 'accidental';

export type OccupancyCategory = 'I' | 'II' | 'III' | 'IV';

export interface LoadCase {
  id: string;
  name: string;
  category: LoadCategory;
  values: {
    [memberOrNodeId: string]: {
      Fx?: number;
      Fy?: number;
      Fz?: number;
      Mx?: number;
      My?: number;
      Mz?: number;
      w?: number;  // Distributed load intensity
    };
  };
  metadata?: {
    direction?: string;
    duration?: 'short' | 'normal' | 'permanent';
    returnPeriod?: number;
  };
}

export interface LoadFactor {
  category: LoadCategory;
  factor: number;
  companion?: number;  // For companion load combinations
  maxFactor?: number;  // For variable loads with range
  minFactor?: number;
}

export interface LoadCombination {
  id: string;
  name: string;
  code: LoadCombinationCode;
  limitState: LimitState;
  factors: LoadFactor[];
  description?: string;
  notes?: string[];
}

export interface CombinedLoads {
  combinationId: string;
  combinationName: string;
  limitState: LimitState;
  memberLoads: Map<string, {
    Fx: number;
    Fy: number;
    Fz: number;
    Mx: number;
    My: number;
    Mz: number;
  }>;
  nodeLoads: Map<string, {
    Fx: number;
    Fy: number;
    Fz: number;
    Mx: number;
    My: number;
    Mz: number;
  }>;
  governing?: boolean;
  utilizationRatio?: number;
}

export interface LiveLoadReductionParams {
  tributaryArea: number;        // m²
  influenceArea: number;        // m²
  floors: number;
  occupancy: string;
  isRoof: boolean;
}

export interface LoadCombinationConfig {
  code: LoadCombinationCode;
  includePatternLoading?: boolean;
  includeSeismic?: boolean;
  includeWind?: boolean;
  seismicDirection?: 'X' | 'Y' | 'both';
  windDirections?: number[];
  occupancyCategory?: OccupancyCategory;
  importanceFactor?: number;
}

// ============================================================================
// LOAD FACTORS DATABASE
// ============================================================================

const LOAD_FACTORS: Record<LoadCombinationCode, Record<LimitState, LoadCombination[]>> = {
  IS: {
    ultimate: [
      {
        id: 'IS-ULS-1',
        name: '1.5(DL+LL)',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.5 },
          { category: 'live', factor: 1.5 }
        ],
        description: 'Basic combination for gravity loads',
        notes: ['IS 456:2000 Cl. 36.4.1']
      },
      {
        id: 'IS-ULS-2',
        name: '1.5(DL+WL)',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.5 },
          { category: 'wind', factor: 1.5 }
        ],
        description: 'Dead load with wind',
        notes: ['IS 456:2000 Cl. 36.4.1']
      },
      {
        id: 'IS-ULS-3',
        name: '1.2(DL+LL+WL)',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live', factor: 1.2 },
          { category: 'wind', factor: 1.2 }
        ],
        description: 'Combined gravity and wind',
        notes: ['IS 456:2000 Cl. 36.4.1']
      },
      {
        id: 'IS-ULS-4',
        name: '1.5(DL+EL)',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.5 },
          { category: 'seismic', factor: 1.5 }
        ],
        description: 'Dead load with seismic',
        notes: ['IS 1893:2016']
      },
      {
        id: 'IS-ULS-5',
        name: '1.2(DL+LL+EL)',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live', factor: 1.2 },
          { category: 'seismic', factor: 1.2 }
        ],
        description: 'Combined gravity and seismic',
        notes: ['IS 1893:2016']
      },
      {
        id: 'IS-ULS-6',
        name: '0.9DL+1.5EL',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 0.9 },
          { category: 'seismic', factor: 1.5 }
        ],
        description: 'Minimum dead with seismic (overturning)',
        notes: ['IS 1893:2016']
      },
      {
        id: 'IS-ULS-7',
        name: '0.9DL+1.5WL',
        code: 'IS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 0.9 },
          { category: 'wind', factor: 1.5 }
        ],
        description: 'Minimum dead with wind (overturning)',
        notes: ['IS 875 Part 3']
      }
    ],
    serviceability: [
      {
        id: 'IS-SLS-1',
        name: 'DL+LL',
        code: 'IS',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 1.0 }
        ],
        description: 'Service loads for deflection check'
      },
      {
        id: 'IS-SLS-2',
        name: 'DL+0.8LL',
        code: 'IS',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.8 }
        ],
        description: 'Long-term deflection'
      }
    ],
    accidental: []
  },
  
  ASCE: {
    ultimate: [
      {
        id: 'ASCE-U1',
        name: '1.4D',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.4 }
        ],
        description: 'Dead load only',
        notes: ['ASCE 7-22 Section 2.3.1']
      },
      {
        id: 'ASCE-U2',
        name: '1.2D+1.6L+0.5(Lr or S or R)',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live', factor: 1.6 },
          { category: 'live_roof', factor: 0.5 }
        ],
        description: 'Primary live load combination',
        notes: ['ASCE 7-22 Section 2.3.1']
      },
      {
        id: 'ASCE-U3',
        name: '1.2D+1.6(Lr or S or R)+L',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live_roof', factor: 1.6 },
          { category: 'live', factor: 1.0 }
        ],
        description: 'Primary roof load combination',
        notes: ['ASCE 7-22 Section 2.3.1']
      },
      {
        id: 'ASCE-U4',
        name: '1.2D+1.0W+L+0.5(Lr or S or R)',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'wind', factor: 1.0 },
          { category: 'live', factor: 1.0 },
          { category: 'live_roof', factor: 0.5 }
        ],
        description: 'Wind combination',
        notes: ['ASCE 7-22 Section 2.3.1']
      },
      {
        id: 'ASCE-U5',
        name: '1.2D+1.0E+L+0.2S',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'seismic', factor: 1.0 },
          { category: 'live', factor: 1.0 },
          { category: 'snow', factor: 0.2 }
        ],
        description: 'Seismic combination with dead',
        notes: ['ASCE 7-22 Section 2.3.6']
      },
      {
        id: 'ASCE-U6',
        name: '0.9D+1.0W',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 0.9 },
          { category: 'wind', factor: 1.0 }
        ],
        description: 'Minimum dead with wind (overturning)',
        notes: ['ASCE 7-22 Section 2.3.1']
      },
      {
        id: 'ASCE-U7',
        name: '0.9D+1.0E',
        code: 'ASCE',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 0.9 },
          { category: 'seismic', factor: 1.0 }
        ],
        description: 'Minimum dead with seismic (overturning)',
        notes: ['ASCE 7-22 Section 2.3.6']
      }
    ],
    serviceability: [
      {
        id: 'ASCE-S1',
        name: 'D+L',
        code: 'ASCE',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 1.0 }
        ],
        description: 'Deflection under service loads'
      },
      {
        id: 'ASCE-S2',
        name: 'D+0.5L',
        code: 'ASCE',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.5 }
        ],
        description: 'Long-term deflection'
      }
    ],
    accidental: []
  },
  
  EN: {
    ultimate: [
      {
        id: 'EN-EQU-1',
        name: '1.1Gk,sup+1.5Qk',
        code: 'EN',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.1 },
          { category: 'live', factor: 1.5 }
        ],
        description: 'Equilibrium verification (EQU)',
        notes: ['EN 1990 Table A1.2(A)']
      },
      {
        id: 'EN-STR-1',
        name: '1.35Gk+1.5Qk',
        code: 'EN',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.35 },
          { category: 'live', factor: 1.5 }
        ],
        description: 'Structural design (STR)',
        notes: ['EN 1990 Table A1.2(B)']
      },
      {
        id: 'EN-STR-2',
        name: '1.35Gk+1.5Qk+0.6×1.5Wk',
        code: 'EN',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.35 },
          { category: 'live', factor: 1.5 },
          { category: 'wind', factor: 0.9 }
        ],
        description: 'With wind as accompanying action',
        notes: ['EN 1990 Table A1.2(B)']
      },
      {
        id: 'EN-STR-3',
        name: '1.35Gk+1.5Wk+0.7×1.5Qk',
        code: 'EN',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.35 },
          { category: 'wind', factor: 1.5 },
          { category: 'live', factor: 1.05 }
        ],
        description: 'Wind as leading action',
        notes: ['EN 1990 Table A1.2(B)']
      },
      {
        id: 'EN-STR-4',
        name: '1.0Gk+1.0AEd+0.3Qk',
        code: 'EN',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'seismic', factor: 1.0 },
          { category: 'live', factor: 0.3 }
        ],
        description: 'Seismic design situation',
        notes: ['EN 1990 / EN 1998']
      }
    ],
    serviceability: [
      {
        id: 'EN-SLS-CHAR',
        name: 'Gk+Qk',
        code: 'EN',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 1.0 }
        ],
        description: 'Characteristic combination'
      },
      {
        id: 'EN-SLS-FREQ',
        name: 'Gk+ψ1×Qk',
        code: 'EN',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.7 }
        ],
        description: 'Frequent combination'
      },
      {
        id: 'EN-SLS-QP',
        name: 'Gk+ψ2×Qk',
        code: 'EN',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.3 }
        ],
        description: 'Quasi-permanent combination'
      }
    ],
    accidental: [
      {
        id: 'EN-ACC-1',
        name: 'Gk+Ad+ψ1×Qk',
        code: 'EN',
        limitState: 'accidental',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'special', factor: 1.0 },
          { category: 'live', factor: 0.5 }
        ],
        description: 'Accidental design situation'
      }
    ]
  },
  
  AS: {
    ultimate: [
      {
        id: 'AS-U1',
        name: '1.35G',
        code: 'AS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.35 }
        ],
        description: 'Permanent actions only',
        notes: ['AS/NZS 1170.0 Cl. 4.2.2']
      },
      {
        id: 'AS-U2',
        name: '1.2G+1.5Q',
        code: 'AS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live', factor: 1.5 }
        ],
        description: 'Gravity loads',
        notes: ['AS/NZS 1170.0 Cl. 4.2.2']
      },
      {
        id: 'AS-U3',
        name: '1.2G+ψc×Q+Wu',
        code: 'AS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.2 },
          { category: 'live', factor: 0.4 },
          { category: 'wind', factor: 1.0 }
        ],
        description: 'Wind combination',
        notes: ['AS/NZS 1170.0 Cl. 4.2.2']
      },
      {
        id: 'AS-U4',
        name: '0.9G+Wu',
        code: 'AS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 0.9 },
          { category: 'wind', factor: 1.0 }
        ],
        description: 'Wind reversal',
        notes: ['AS/NZS 1170.0 Cl. 4.2.2']
      },
      {
        id: 'AS-U5',
        name: 'G+ψE×Q+Eu',
        code: 'AS',
        limitState: 'ultimate',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.3 },
          { category: 'seismic', factor: 1.0 }
        ],
        description: 'Seismic combination',
        notes: ['AS/NZS 1170.0 Cl. 4.2.2']
      }
    ],
    serviceability: [
      {
        id: 'AS-S1',
        name: 'G+ψs×Q',
        code: 'AS',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.7 }
        ],
        description: 'Short-term serviceability'
      },
      {
        id: 'AS-S2',
        name: 'G+ψl×Q',
        code: 'AS',
        limitState: 'serviceability',
        factors: [
          { category: 'dead', factor: 1.0 },
          { category: 'live', factor: 0.4 }
        ],
        description: 'Long-term serviceability'
      }
    ],
    accidental: []
  }
};

// ============================================================================
// LIVE LOAD REDUCTION FACTORS
// ============================================================================

const LIVE_LOAD_REDUCTION = {
  IS: {
    // IS 875 Part 2
    getReduction: (floors: number, tributaryArea: number) => {
      const reductionByFloors = Math.max(0.5, 1 - 0.05 * (floors - 1));
      const reductionByArea = tributaryArea > 40 ? 
        Math.max(0.5, 1 - 0.01 * (tributaryArea - 40)) : 1.0;
      return Math.max(0.5, reductionByFloors * reductionByArea);
    }
  },
  ASCE: {
    // ASCE 7-22 Section 4.7
    getReduction: (influenceArea: number, isRoof: boolean) => {
      if (isRoof || influenceArea < 37.16) return 1.0; // 400 sq ft
      const reduction = 0.25 + 15 / Math.sqrt(influenceArea * 10.764); // Convert to sq ft
      return Math.max(0.5, Math.min(1.0, reduction));
    }
  },
  EN: {
    // EN 1991-1-1 Section 6.3.1.2
    getReduction: (tributaryArea: number, occupancy: string) => {
      const alphaA = Math.max(0.6, 0.5 + 10 / tributaryArea);
      return Math.min(1.0, alphaA);
    }
  },
  AS: {
    // AS/NZS 1170.1 Section 3.4.2
    getReduction: (tributaryArea: number) => {
      if (tributaryArea <= 25) return 1.0;
      const reduction = Math.max(0.5, 1.0 - 0.012 * (tributaryArea - 25));
      return reduction;
    }
  }
};

// ============================================================================
// MAIN LOAD COMBINATION ENGINE
// ============================================================================

export class AdvancedLoadCombinationEngine {
  private code: LoadCombinationCode;
  private config: LoadCombinationConfig;
  private loadCases: Map<string, LoadCase>;
  private errorHandler: EngineeringErrorHandler;

  constructor(config: LoadCombinationConfig) {
    this.code = config.code;
    this.config = config;
    this.loadCases = new Map();
    this.errorHandler = new EngineeringErrorHandler({
      context: { module: 'LoadCombination', function: 'constructor', inputs: { code: config.code } }
    });
  }

  // --------------------------------------------------------------------------
  // LOAD CASE MANAGEMENT
  // --------------------------------------------------------------------------

  public addLoadCase(loadCase: LoadCase): void {
    this.loadCases.set(loadCase.id, loadCase);
  }

  public removeLoadCase(id: string): boolean {
    return this.loadCases.delete(id);
  }

  public getLoadCase(id: string): LoadCase | undefined {
    return this.loadCases.get(id);
  }

  public getAllLoadCases(): LoadCase[] {
    return Array.from(this.loadCases.values());
  }

  // --------------------------------------------------------------------------
  // STANDARD COMBINATIONS
  // --------------------------------------------------------------------------

  public getStandardCombinations(limitState: LimitState = 'ultimate'): LoadCombination[] {
    return LOAD_FACTORS[this.code][limitState] || [];
  }

  public getAllStandardCombinations(): LoadCombination[] {
    const combinations: LoadCombination[] = [];
    
    for (const limitState of ['ultimate', 'serviceability', 'accidental'] as LimitState[]) {
      combinations.push(...(LOAD_FACTORS[this.code][limitState] || []));
    }
    
    return combinations;
  }

  // --------------------------------------------------------------------------
  // COMBINATION GENERATION
  // --------------------------------------------------------------------------

  public generateCombinations(options?: {
    limitStates?: LimitState[];
    excludeCategories?: LoadCategory[];
    includeOnly?: LoadCategory[];
    customCombinations?: LoadCombination[];
  }): LoadCombination[] {
    const limitStates = options?.limitStates || ['ultimate', 'serviceability'];
    const combinations: LoadCombination[] = [];
    
    for (const limitState of limitStates) {
      const standardCombos = this.getStandardCombinations(limitState);
      
      for (const combo of standardCombos) {
        // Filter by categories if specified
        if (options?.excludeCategories) {
          const hasExcluded = combo.factors.some(f => 
            options.excludeCategories?.includes(f.category)
          );
          if (hasExcluded) continue;
        }
        
        if (options?.includeOnly) {
          const allIncluded = combo.factors.every(f =>
            options.includeOnly?.includes(f.category)
          );
          if (!allIncluded) continue;
        }
        
        combinations.push(combo);
      }
    }
    
    // Add custom combinations
    if (options?.customCombinations) {
      combinations.push(...options.customCombinations);
    }
    
    // Add seismic variations if configured
    if (this.config.includeSeismic && this.config.seismicDirection === 'both') {
      combinations.push(...this.generateSeismicCombinations());
    }
    
    // Add wind direction variations if configured
    if (this.config.includeWind && this.config.windDirections) {
      combinations.push(...this.generateWindCombinations());
    }
    
    return combinations;
  }

  private generateSeismicCombinations(): LoadCombination[] {
    const baseCombos = this.getStandardCombinations('ultimate')
      .filter(c => c.factors.some(f => f.category === 'seismic'));
    
    const variations: LoadCombination[] = [];
    
    for (const combo of baseCombos) {
      // +X, -X, +Y, -Y directions
      for (const dir of ['+X', '-X', '+Y', '-Y']) {
        variations.push({
          ...combo,
          id: `${combo.id}-${dir}`,
          name: `${combo.name} (${dir})`,
          description: `${combo.description || ''} in ${dir} direction`
        });
      }
      
      // 100% + 30% orthogonal combinations
      for (const combo100_30 of ['100X+30Y', '100X-30Y', '100Y+30X', '100Y-30X']) {
        variations.push({
          ...combo,
          id: `${combo.id}-${combo100_30}`,
          name: `${combo.name} (${combo100_30})`,
          description: `${combo.description || ''} - 100%+30% rule`
        });
      }
    }
    
    return variations;
  }

  private generateWindCombinations(): LoadCombination[] {
    const baseCombos = this.getStandardCombinations('ultimate')
      .filter(c => c.factors.some(f => f.category === 'wind'));
    
    const variations: LoadCombination[] = [];
    const directions = this.config.windDirections || [0, 90, 180, 270];
    
    for (const combo of baseCombos) {
      for (const dir of directions) {
        variations.push({
          ...combo,
          id: `${combo.id}-W${dir}`,
          name: `${combo.name} (Wind ${dir}°)`,
          description: `${combo.description || ''} - Wind from ${dir}°`
        });
      }
    }
    
    return variations;
  }

  // --------------------------------------------------------------------------
  // LOAD COMBINATION CALCULATION
  // --------------------------------------------------------------------------

  public calculateCombinedLoads(combination: LoadCombination): CombinedLoads {
    const memberLoads = new Map<string, {
      Fx: number; Fy: number; Fz: number;
      Mx: number; My: number; Mz: number;
    }>();
    
    const nodeLoads = new Map<string, {
      Fx: number; Fy: number; Fz: number;
      Mx: number; My: number; Mz: number;
    }>();

    // Process each load factor
    for (const factor of combination.factors) {
      const loadCasesOfCategory = Array.from(this.loadCases.values())
        .filter(lc => lc.category === factor.category);
      
      for (const loadCase of loadCasesOfCategory) {
        for (const [id, values] of Object.entries(loadCase.values)) {
          // Determine if it's a member or node load
          const isNode = id.startsWith('N') || id.includes('node');
          const targetMap = isNode ? nodeLoads : memberLoads;
          
          if (!targetMap.has(id)) {
            targetMap.set(id, { Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 });
          }
          
          const existing = targetMap.get(id)!;
          existing.Fx += (values.Fx || 0) * factor.factor;
          existing.Fy += (values.Fy || 0) * factor.factor;
          existing.Fz += (values.Fz || 0) * factor.factor;
          existing.Mx += (values.Mx || 0) * factor.factor;
          existing.My += (values.My || 0) * factor.factor;
          existing.Mz += (values.Mz || 0) * factor.factor;
        }
      }
    }

    return {
      combinationId: combination.id,
      combinationName: combination.name,
      limitState: combination.limitState,
      memberLoads,
      nodeLoads
    };
  }

  public calculateAllCombinations(combinations?: LoadCombination[]): CombinedLoads[] {
    const combos = combinations || this.generateCombinations();
    return combos.map(combo => this.calculateCombinedLoads(combo));
  }

  // --------------------------------------------------------------------------
  // ENVELOPE CALCULATIONS
  // --------------------------------------------------------------------------

  public calculateEnvelope(combinations?: LoadCombination[]): {
    memberEnvelopes: Map<string, {
      Fx: { min: number; max: number; comboMin: string; comboMax: string };
      Fy: { min: number; max: number; comboMin: string; comboMax: string };
      Fz: { min: number; max: number; comboMin: string; comboMax: string };
      Mx: { min: number; max: number; comboMin: string; comboMax: string };
      My: { min: number; max: number; comboMin: string; comboMax: string };
      Mz: { min: number; max: number; comboMin: string; comboMax: string };
    }>;
    nodeEnvelopes: Map<string, {
      Fx: { min: number; max: number; comboMin: string; comboMax: string };
      Fy: { min: number; max: number; comboMin: string; comboMax: string };
      Fz: { min: number; max: number; comboMin: string; comboMax: string };
    }>;
  } {
    const allCombined = this.calculateAllCombinations(combinations);
    
    const memberEnvelopes = new Map<string, {
      Fx: { min: number; max: number; comboMin: string; comboMax: string };
      Fy: { min: number; max: number; comboMin: string; comboMax: string };
      Fz: { min: number; max: number; comboMin: string; comboMax: string };
      Mx: { min: number; max: number; comboMin: string; comboMax: string };
      My: { min: number; max: number; comboMin: string; comboMax: string };
      Mz: { min: number; max: number; comboMin: string; comboMax: string };
    }>();
    
    const nodeEnvelopes = new Map<string, {
      Fx: { min: number; max: number; comboMin: string; comboMax: string };
      Fy: { min: number; max: number; comboMin: string; comboMax: string };
      Fz: { min: number; max: number; comboMin: string; comboMax: string };
    }>();

    for (const combined of allCombined) {
      // Process member loads
      for (const [id, loads] of combined.memberLoads) {
        if (!memberEnvelopes.has(id)) {
          memberEnvelopes.set(id, {
            Fx: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Fy: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Fz: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Mx: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            My: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Mz: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' }
          });
        }
        
        const env = memberEnvelopes.get(id)!;
        for (const key of ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'] as const) {
          if (loads[key] < env[key].min) {
            env[key].min = loads[key];
            env[key].comboMin = combined.combinationName;
          }
          if (loads[key] > env[key].max) {
            env[key].max = loads[key];
            env[key].comboMax = combined.combinationName;
          }
        }
      }

      // Process node loads
      for (const [id, loads] of combined.nodeLoads) {
        if (!nodeEnvelopes.has(id)) {
          nodeEnvelopes.set(id, {
            Fx: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Fy: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' },
            Fz: { min: Infinity, max: -Infinity, comboMin: '', comboMax: '' }
          });
        }
        
        const env = nodeEnvelopes.get(id)!;
        for (const key of ['Fx', 'Fy', 'Fz'] as const) {
          if (loads[key] < env[key].min) {
            env[key].min = loads[key];
            env[key].comboMin = combined.combinationName;
          }
          if (loads[key] > env[key].max) {
            env[key].max = loads[key];
            env[key].comboMax = combined.combinationName;
          }
        }
      }
    }

    return { memberEnvelopes, nodeEnvelopes };
  }

  // --------------------------------------------------------------------------
  // LIVE LOAD REDUCTION
  // --------------------------------------------------------------------------

  public applyLiveLoadReduction(params: LiveLoadReductionParams): number {
    switch (this.code) {
      case 'IS':
        return LIVE_LOAD_REDUCTION.IS.getReduction(params.floors || 1, params.tributaryArea || 0);
      case 'ASCE':
        return LIVE_LOAD_REDUCTION.ASCE.getReduction(params.influenceArea || 0, params.isRoof || false);
      case 'EN':
        return LIVE_LOAD_REDUCTION.EN.getReduction(params.tributaryArea || 0, params.occupancy || 'residential');
      case 'AS':
        return LIVE_LOAD_REDUCTION.AS.getReduction(params.tributaryArea || 0);
      default:
        return 1.0;
    }
  }

  public getReducedLiveLoad(
    baseLoad: number,
    params: LiveLoadReductionParams
  ): { reducedLoad: number; reductionFactor: number; method: string } {
    const reductionFactor = this.applyLiveLoadReduction(params);
    
    return {
      reducedLoad: PrecisionMath.round(baseLoad * reductionFactor, 3),
      reductionFactor: PrecisionMath.round(reductionFactor, 4),
      method: `${this.code} Live Load Reduction`
    };
  }

  // --------------------------------------------------------------------------
  // PATTERN LOADING
  // --------------------------------------------------------------------------

  public generatePatternLoadCases(
    baseLoadCase: LoadCase,
    spans: number
  ): LoadCase[] {
    if (!this.config.includePatternLoading) {
      return [baseLoadCase];
    }

    const patterns: LoadCase[] = [];
    const patternCount = Math.pow(2, spans);

    for (let pattern = 0; pattern < patternCount; pattern++) {
      const patternCase: LoadCase = {
        ...baseLoadCase,
        id: `${baseLoadCase.id}-P${pattern}`,
        name: `${baseLoadCase.name} (Pattern ${pattern})`,
        values: {}
      };

      // Apply pattern (binary representation)
      for (let span = 0; span < spans; span++) {
        const applyLoad = (pattern >> span) & 1;
        const spanKey = `span_${span + 1}`;
        
        if (applyLoad && baseLoadCase.values[spanKey]) {
          patternCase.values[spanKey] = baseLoadCase.values[spanKey];
        } else {
          patternCase.values[spanKey] = { w: 0 };
        }
      }

      patterns.push(patternCase);
    }

    return patterns;
  }

  // --------------------------------------------------------------------------
  // IMPORT/EXPORT
  // --------------------------------------------------------------------------

  public exportCombinations(): string {
    const combinations = this.generateCombinations();
    return JSON.stringify({
      code: this.code,
      config: this.config,
      loadCases: Array.from(this.loadCases.entries()),
      combinations
    }, null, 2);
  }

  public exportToTable(): string[][] {
    const combinations = this.generateCombinations();
    const header = ['Combination', 'Limit State', 'DL', 'LL', 'WL', 'EL', 'Notes'];
    
    const rows = combinations.map(combo => {
      const getFactorValue = (category: LoadCategory) => {
        const factor = combo.factors.find(f => f.category === category);
        return factor ? factor.factor.toFixed(2) : '-';
      };
      
      return [
        combo.name,
        combo.limitState,
        getFactorValue('dead'),
        getFactorValue('live'),
        getFactorValue('wind'),
        getFactorValue('seismic'),
        combo.notes?.join('; ') || ''
      ];
    });
    
    return [header, ...rows];
  }

  // --------------------------------------------------------------------------
  // STATIC UTILITIES
  // --------------------------------------------------------------------------

  public static getLoadFactorDescription(code: LoadCombinationCode): string {
    const descriptions: Record<LoadCombinationCode, string> = {
      IS: 'Indian Standard IS 456:2000 / IS 1893:2016 Load Factors',
      ASCE: 'ASCE 7-22 Load Combinations',
      EN: 'Eurocode EN 1990 Load Combinations',
      AS: 'Australian Standard AS/NZS 1170.0 Load Combinations'
    };
    return descriptions[code];
  }

  public static getSupportedCodes(): LoadCombinationCode[] {
    return ['IS', 'ASCE', 'EN', 'AS'];
  }

  public static getLoadCategories(): LoadCategory[] {
    return [
      'dead', 'live', 'live_roof', 'snow', 'rain',
      'wind', 'seismic', 'earth_pressure', 'fluid_pressure',
      'temperature', 'settlement', 'crane', 'impact', 'special'
    ];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export const createLoadCombinationEngine = (config: LoadCombinationConfig) => {
  return new AdvancedLoadCombinationEngine(config);
};

export default AdvancedLoadCombinationEngine;
