/**
 * ============================================================================
 * COMPREHENSIVE LOAD COMBINATION ENGINE
 * ============================================================================
 * 
 * Multi-code load combination generation and analysis:
 * - IS 456:2000 / IS 875:2015 / IS 1893:2016
 * - ACI 318-19 / ASCE 7-22
 * - Eurocode 0 (EN 1990)
 * - AS/NZS 1170
 * 
 * Features:
 * - Automatic combination generation
 * - Partial safety factors
 * - Load pattern generation
 * - Critical combination identification
 * - Envelope analysis
 * 
 * @version 2.0.0
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type LoadType = 
  | 'dead'
  | 'live'
  | 'live_roof'
  | 'wind'
  | 'seismic'
  | 'snow'
  | 'rain'
  | 'earth'
  | 'fluid'
  | 'temperature'
  | 'settlement'
  | 'crane'
  | 'impact';

export type DesignCodeComb = 'IS456' | 'IS1893' | 'ACI318' | 'ASCE7' | 'EN1990' | 'AS1170';

export type LimitState = 'ultimate' | 'serviceability' | 'fatigue';

export interface LoadCase {
  id: string;
  name: string;
  type: LoadType;
  description?: string;
  values: LoadValues;
  isReversible?: boolean;
  direction?: '+' | '-' | '±';
}

export interface LoadValues {
  Fx?: number;   // Force X (kN)
  Fy?: number;   // Force Y (kN)
  Fz?: number;   // Force Z (kN)
  Mx?: number;   // Moment X (kNm)
  My?: number;   // Moment Y (kNm)
  Mz?: number;   // Moment Z (kNm)
  // For distributed loads
  w?: number;    // Uniform load (kN/m or kN/m²)
  P?: number;    // Point load (kN)
}

export interface LoadCombination {
  id: string;
  name: string;
  limitState: LimitState;
  code: DesignCodeComb;
  factors: LoadFactor[];
  totalValues?: LoadValues;
  isCritical?: boolean;
}

export interface LoadFactor {
  loadCaseId: string;
  factor: number;
  pattern?: string;
}

export interface CombinationConfig {
  code: DesignCodeComb;
  limitState: LimitState;
  includeSeismic: boolean;
  includeWind: boolean;
  seismicZone?: string;
  windZone?: string;
  buildingImportance?: 'normal' | 'important' | 'critical';
  allowUserFactors?: boolean;
}

export interface EnvelopeResult {
  memberOrNode: string;
  maxValues: {
    Fx: { value: number; combination: string };
    Fy: { value: number; combination: string };
    Fz: { value: number; combination: string };
    Mx: { value: number; combination: string };
    My: { value: number; combination: string };
    Mz: { value: number; combination: string };
  };
  minValues: {
    Fx: { value: number; combination: string };
    Fy: { value: number; combination: string };
    Fz: { value: number; combination: string };
    Mx: { value: number; combination: string };
    My: { value: number; combination: string };
    Mz: { value: number; combination: string };
  };
}

// ============================================================================
// MAIN LOAD COMBINATION ENGINE CLASS
// ============================================================================

export class LoadCombinationEngine {
  private loadCases: Map<string, LoadCase> = new Map();
  private combinations: LoadCombination[] = [];
  private config: CombinationConfig;

  constructor(config: CombinationConfig) {
    this.config = config;
  }

  // --------------------------------------------------------------------------
  // LOAD CASE MANAGEMENT
  // --------------------------------------------------------------------------

  addLoadCase(loadCase: LoadCase): void {
    this.loadCases.set(loadCase.id, loadCase);
  }

  addLoadCases(loadCases: LoadCase[]): void {
    loadCases.forEach(lc => this.addLoadCase(lc));
  }

  getLoadCase(id: string): LoadCase | undefined {
    return this.loadCases.get(id);
  }

  getAllLoadCases(): LoadCase[] {
    return Array.from(this.loadCases.values());
  }

  // --------------------------------------------------------------------------
  // COMBINATION GENERATION
  // --------------------------------------------------------------------------

  generateCombinations(): LoadCombination[] {
    switch (this.config.code) {
      case 'IS456':
      case 'IS1893':
        return this.generateISCombinations();
      case 'ACI318':
      case 'ASCE7':
        return this.generateASCE7Combinations();
      case 'EN1990':
        return this.generateEurocodeCombinations();
      case 'AS1170':
        return this.generateAustralianCombinations();
      default:
        return this.generateISCombinations();
    }
  }

  // --------------------------------------------------------------------------
  // IS CODE COMBINATIONS (IS 456:2000 / IS 875:2015 / IS 1893:2016)
  // --------------------------------------------------------------------------

  private generateISCombinations(): LoadCombination[] {
    const combinations: LoadCombination[] = [];
    let combId = 1;

    const deadCases = this.getLoadCasesByType('dead');
    const liveCases = this.getLoadCasesByType('live');
    const windCases = this.getLoadCasesByType('wind');
    const seismicCases = this.getLoadCasesByType('seismic');

    // ---------- ULTIMATE LIMIT STATE ----------
    if (this.config.limitState === 'ultimate') {
      // 1. 1.5(DL + IL)
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.5(DL + LL)',
        limitState: 'ultimate',
        code: 'IS456',
        factors: [
          ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
          ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.5 })),
        ],
      });

      // 2. 1.5(DL + WL) - Wind from different directions
      if (this.config.includeWind) {
        windCases.forEach(wc => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.5(DL + ${wc.name})`,
            limitState: 'ultimate',
            code: 'IS456',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
              { loadCaseId: wc.id, factor: 1.5 },
            ],
          });

          // Wind reversal
          if (wc.isReversible) {
            combinations.push({
              id: `ULS_${combId++}`,
              name: `1.5(DL - ${wc.name})`,
              limitState: 'ultimate',
              code: 'IS456',
              factors: [
                ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
                { loadCaseId: wc.id, factor: -1.5 },
              ],
            });
          }
        });
      }

      // 3. 1.2(DL + IL + WL)
      if (this.config.includeWind) {
        windCases.forEach(wc => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.2(DL + LL + ${wc.name})`,
            limitState: 'ultimate',
            code: 'IS456',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.2 })),
              ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.2 })),
              { loadCaseId: wc.id, factor: 1.2 },
            ],
          });
        });
      }

      // 4. Seismic combinations (IS 1893:2016)
      if (this.config.includeSeismic) {
        seismicCases.forEach(eq => {
          // 1.5(DL + EQ)
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.5(DL + ${eq.name})`,
            limitState: 'ultimate',
            code: 'IS1893',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
              { loadCaseId: eq.id, factor: 1.5 },
            ],
          });

          // 1.2(DL + IL + EQ)
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.2(DL + LL + ${eq.name})`,
            limitState: 'ultimate',
            code: 'IS1893',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.2 })),
              ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.2 })),
              { loadCaseId: eq.id, factor: 1.2 },
            ],
          });

          // 0.9DL + 1.5EQ (for stability/overturning)
          combinations.push({
            id: `ULS_${combId++}`,
            name: `0.9DL + 1.5${eq.name}`,
            limitState: 'ultimate',
            code: 'IS1893',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 0.9 })),
              { loadCaseId: eq.id, factor: 1.5 },
            ],
          });
        });
      }

      // 5. Pattern loading for live load
      const patternCombinations = this.generatePatternLoadingIS(deadCases, liveCases, combId);
      combinations.push(...patternCombinations);
    }

    // ---------- SERVICEABILITY LIMIT STATE ----------
    if (this.config.limitState === 'serviceability') {
      // 1. DL + LL (rare combination)
      combinations.push({
        id: `SLS_${combId++}`,
        name: 'DL + LL (Rare)',
        limitState: 'serviceability',
        code: 'IS456',
        factors: [
          ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.0 })),
          ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.0 })),
        ],
      });

      // 2. DL + 0.5LL (frequent combination)
      combinations.push({
        id: `SLS_${combId++}`,
        name: 'DL + 0.5LL (Frequent)',
        limitState: 'serviceability',
        code: 'IS456',
        factors: [
          ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.0 })),
          ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 0.5 })),
        ],
      });

      // 3. DL + 0.3LL (quasi-permanent)
      combinations.push({
        id: `SLS_${combId++}`,
        name: 'DL + 0.3LL (Quasi-permanent)',
        limitState: 'serviceability',
        code: 'IS456',
        factors: [
          ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.0 })),
          ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 0.3 })),
        ],
      });

      // 4. Wind combinations
      if (this.config.includeWind) {
        windCases.forEach(wc => {
          combinations.push({
            id: `SLS_${combId++}`,
            name: `DL + 0.8LL + 0.8${wc.name}`,
            limitState: 'serviceability',
            code: 'IS456',
            factors: [
              ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.0 })),
              ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 0.8 })),
              { loadCaseId: wc.id, factor: 0.8 },
            ],
          });
        });
      }
    }

    this.combinations = combinations;
    return combinations;
  }

  private generatePatternLoadingIS(deadCases: LoadCase[], liveCases: LoadCase[], startId: number): LoadCombination[] {
    const patterns: LoadCombination[] = [];
    let combId = startId;

    // Pattern 1: Full live load on all spans
    patterns.push({
      id: `ULS_${combId++}`,
      name: '1.5(DL + LL) Full',
      limitState: 'ultimate',
      code: 'IS456',
      factors: [
        ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
        ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.5, pattern: 'full' })),
      ],
    });

    // Pattern 2: Checkerboard pattern (odd spans loaded)
    patterns.push({
      id: `ULS_${combId++}`,
      name: '1.5(DL + LL) Checker-Odd',
      limitState: 'ultimate',
      code: 'IS456',
      factors: [
        ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
        ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.5, pattern: 'odd_spans' })),
      ],
    });

    // Pattern 3: Checkerboard pattern (even spans loaded)
    patterns.push({
      id: `ULS_${combId++}`,
      name: '1.5(DL + LL) Checker-Even',
      limitState: 'ultimate',
      code: 'IS456',
      factors: [
        ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
        ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.5, pattern: 'even_spans' })),
      ],
    });

    // Pattern 4: Adjacent spans loaded
    patterns.push({
      id: `ULS_${combId++}`,
      name: '1.5(DL + LL) Adjacent',
      limitState: 'ultimate',
      code: 'IS456',
      factors: [
        ...deadCases.map(dc => ({ loadCaseId: dc.id, factor: 1.5 })),
        ...liveCases.map(lc => ({ loadCaseId: lc.id, factor: 1.5, pattern: 'adjacent' })),
      ],
    });

    return patterns;
  }

  // --------------------------------------------------------------------------
  // ASCE 7-22 / ACI 318-19 COMBINATIONS
  // --------------------------------------------------------------------------

  private generateASCE7Combinations(): LoadCombination[] {
    const combinations: LoadCombination[] = [];
    let combId = 1;

    const D = this.getLoadCasesByType('dead');
    const L = this.getLoadCasesByType('live');
    const Lr = this.getLoadCasesByType('live_roof');
    const W = this.getLoadCasesByType('wind');
    const E = this.getLoadCasesByType('seismic');
    const S = this.getLoadCasesByType('snow');
    const R = this.getLoadCasesByType('rain');

    if (this.config.limitState === 'ultimate') {
      // ASCE 7-22 Section 2.3.1 - Strength Design

      // 1. 1.4D
      combinations.push({
        id: `U${combId++}`,
        name: '1.4D',
        limitState: 'ultimate',
        code: 'ASCE7',
        factors: D.map(d => ({ loadCaseId: d.id, factor: 1.4 })),
      });

      // 2. 1.2D + 1.6L + 0.5(Lr or S or R)
      combinations.push({
        id: `U${combId++}`,
        name: '1.2D + 1.6L + 0.5Lr',
        limitState: 'ultimate',
        code: 'ASCE7',
        factors: [
          ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
          ...L.map(l => ({ loadCaseId: l.id, factor: 1.6 })),
          ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 0.5 })),
        ],
      });

      if (S.length > 0) {
        combinations.push({
          id: `U${combId++}`,
          name: '1.2D + 1.6L + 0.5S',
          limitState: 'ultimate',
          code: 'ASCE7',
          factors: [
            ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
            ...L.map(l => ({ loadCaseId: l.id, factor: 1.6 })),
            ...S.map(s => ({ loadCaseId: s.id, factor: 0.5 })),
          ],
        });
      }

      // 3. 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
      combinations.push({
        id: `U${combId++}`,
        name: '1.2D + 1.6Lr + L',
        limitState: 'ultimate',
        code: 'ASCE7',
        factors: [
          ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
          ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 1.6 })),
          ...L.map(l => ({ loadCaseId: l.id, factor: 1.0 })),
        ],
      });

      if (this.config.includeWind) {
        combinations.push({
          id: `U${combId++}`,
          name: '1.2D + 1.6Lr + 0.5W',
          limitState: 'ultimate',
          code: 'ASCE7',
          factors: [
            ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
            ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 1.6 })),
            ...W.map(w => ({ loadCaseId: w.id, factor: 0.5 })),
          ],
        });
      }

      // 4. 1.2D + 1.0W + L + 0.5(Lr or S or R)
      if (this.config.includeWind) {
        W.forEach(w => {
          combinations.push({
            id: `U${combId++}`,
            name: `1.2D + 1.0${w.name} + L + 0.5Lr`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
              { loadCaseId: w.id, factor: 1.0 },
              ...L.map(l => ({ loadCaseId: l.id, factor: 1.0 })),
              ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 0.5 })),
            ],
          });

          // Wind reversal
          combinations.push({
            id: `U${combId++}`,
            name: `1.2D - 1.0${w.name} + L + 0.5Lr`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
              { loadCaseId: w.id, factor: -1.0 },
              ...L.map(l => ({ loadCaseId: l.id, factor: 1.0 })),
              ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 0.5 })),
            ],
          });
        });
      }

      // 5. 1.2D + 1.0E + L + 0.2S (Seismic)
      if (this.config.includeSeismic) {
        E.forEach(e => {
          combinations.push({
            id: `U${combId++}`,
            name: `1.2D + ${e.name} + L`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 1.2 })),
              { loadCaseId: e.id, factor: 1.0 },
              ...L.map(l => ({ loadCaseId: l.id, factor: 1.0 })),
            ],
          });
        });
      }

      // 6. 0.9D + 1.0W (Overturning check)
      if (this.config.includeWind) {
        W.forEach(w => {
          combinations.push({
            id: `U${combId++}`,
            name: `0.9D + 1.0${w.name}`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 0.9 })),
              { loadCaseId: w.id, factor: 1.0 },
            ],
          });

          combinations.push({
            id: `U${combId++}`,
            name: `0.9D - 1.0${w.name}`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 0.9 })),
              { loadCaseId: w.id, factor: -1.0 },
            ],
          });
        });
      }

      // 7. 0.9D + 1.0E (Seismic overturning)
      if (this.config.includeSeismic) {
        E.forEach(e => {
          combinations.push({
            id: `U${combId++}`,
            name: `0.9D + ${e.name}`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 0.9 })),
              { loadCaseId: e.id, factor: 1.0 },
            ],
          });

          combinations.push({
            id: `U${combId++}`,
            name: `0.9D - ${e.name}`,
            limitState: 'ultimate',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 0.9 })),
              { loadCaseId: e.id, factor: -1.0 },
            ],
          });
        });
      }
    }

    // ASCE 7-22 Section 2.3.2 - Allowable Stress Design
    if (this.config.limitState === 'serviceability') {
      combinations.push({
        id: `S${combId++}`,
        name: 'D',
        limitState: 'serviceability',
        code: 'ASCE7',
        factors: D.map(d => ({ loadCaseId: d.id, factor: 1.0 })),
      });

      combinations.push({
        id: `S${combId++}`,
        name: 'D + L',
        limitState: 'serviceability',
        code: 'ASCE7',
        factors: [
          ...D.map(d => ({ loadCaseId: d.id, factor: 1.0 })),
          ...L.map(l => ({ loadCaseId: l.id, factor: 1.0 })),
        ],
      });

      combinations.push({
        id: `S${combId++}`,
        name: 'D + 0.75L + 0.75Lr',
        limitState: 'serviceability',
        code: 'ASCE7',
        factors: [
          ...D.map(d => ({ loadCaseId: d.id, factor: 1.0 })),
          ...L.map(l => ({ loadCaseId: l.id, factor: 0.75 })),
          ...Lr.map(lr => ({ loadCaseId: lr.id, factor: 0.75 })),
        ],
      });

      if (this.config.includeWind) {
        W.forEach(w => {
          combinations.push({
            id: `S${combId++}`,
            name: `D + 0.6${w.name}`,
            limitState: 'serviceability',
            code: 'ASCE7',
            factors: [
              ...D.map(d => ({ loadCaseId: d.id, factor: 1.0 })),
              { loadCaseId: w.id, factor: 0.6 },
            ],
          });
        });
      }
    }

    this.combinations = combinations;
    return combinations;
  }

  // --------------------------------------------------------------------------
  // EUROCODE 0 (EN 1990) COMBINATIONS
  // --------------------------------------------------------------------------

  private generateEurocodeCombinations(): LoadCombination[] {
    const combinations: LoadCombination[] = [];
    let combId = 1;

    const G = this.getLoadCasesByType('dead');
    const Q = this.getLoadCasesByType('live');
    const W = this.getLoadCasesByType('wind');
    const S = this.getLoadCasesByType('snow');
    const A = this.getLoadCasesByType('seismic');

    // Combination factors (ψ values) - EN 1990 Annex A
    const psi0 = { live: 0.7, wind: 0.6, snow: 0.5 };
    const psi1 = { live: 0.5, wind: 0.2, snow: 0.2 };
    const psi2 = { live: 0.3, wind: 0.0, snow: 0.0 };

    if (this.config.limitState === 'ultimate') {
      // EN 1990 Eq. 6.10 - Basic combination
      // γG·G + γQ·Q1 + Σ(γQ·ψ0·Qi)

      // Combination 6.10 with live as leading action
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.35G + 1.5Q (6.10)',
        limitState: 'ultimate',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.35 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.5 })),
        ],
      });

      // 6.10 with wind as leading action
      if (this.config.includeWind) {
        W.forEach(w => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.35G + 1.5${w.name} + 1.5·${psi0.live}Q`,
            limitState: 'ultimate',
            code: 'EN1990',
            factors: [
              ...G.map(g => ({ loadCaseId: g.id, factor: 1.35 })),
              { loadCaseId: w.id, factor: 1.5 },
              ...Q.map(q => ({ loadCaseId: q.id, factor: 1.5 * psi0.live })),
            ],
          });
        });
      }

      // 6.10a and 6.10b (alternative expressions)
      // 6.10a: 1.35G + 1.5·ψ0·Q
      combinations.push({
        id: `ULS_${combId++}`,
        name: `1.35G + ${1.5 * psi0.live}Q (6.10a)`,
        limitState: 'ultimate',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.35 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.5 * psi0.live })),
        ],
      });

      // 6.10b: 1.15G + 1.5Q (for ξ = 0.85)
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.15G + 1.5Q (6.10b)',
        limitState: 'ultimate',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 0.85 * 1.35 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.5 })),
        ],
      });

      // Seismic combination (EN 1998-1 Eq. 6.12a)
      if (this.config.includeSeismic) {
        A.forEach(a => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `G + ${a.name} + ${psi2.live}Q (Seismic)`,
            limitState: 'ultimate',
            code: 'EN1990',
            factors: [
              ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
              { loadCaseId: a.id, factor: 1.0 },
              ...Q.map(q => ({ loadCaseId: q.id, factor: psi2.live })),
            ],
          });
        });
      }

      // Minimum dead load for stability
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.0G + 1.5W (Stability)',
        limitState: 'ultimate',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...W.map(w => ({ loadCaseId: w.id, factor: 1.5 })),
        ],
      });
    }

    // Serviceability Limit State
    if (this.config.limitState === 'serviceability') {
      // Characteristic combination
      combinations.push({
        id: `SLS_${combId++}`,
        name: 'G + Q (Characteristic)',
        limitState: 'serviceability',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.0 })),
        ],
      });

      // Frequent combination
      combinations.push({
        id: `SLS_${combId++}`,
        name: `G + ${psi1.live}Q (Frequent)`,
        limitState: 'serviceability',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: psi1.live })),
        ],
      });

      // Quasi-permanent combination
      combinations.push({
        id: `SLS_${combId++}`,
        name: `G + ${psi2.live}Q (Quasi-permanent)`,
        limitState: 'serviceability',
        code: 'EN1990',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: psi2.live })),
        ],
      });
    }

    this.combinations = combinations;
    return combinations;
  }

  // --------------------------------------------------------------------------
  // AUSTRALIAN CODE (AS/NZS 1170) COMBINATIONS
  // --------------------------------------------------------------------------

  private generateAustralianCombinations(): LoadCombination[] {
    const combinations: LoadCombination[] = [];
    let combId = 1;

    const G = this.getLoadCasesByType('dead');
    const Q = this.getLoadCasesByType('live');
    const W = this.getLoadCasesByType('wind');
    const E = this.getLoadCasesByType('seismic');

    if (this.config.limitState === 'ultimate') {
      // AS/NZS 1170.0 Cl. 4.2.2

      // 1.35G
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.35G',
        limitState: 'ultimate',
        code: 'AS1170',
        factors: G.map(g => ({ loadCaseId: g.id, factor: 1.35 })),
      });

      // 1.2G + 1.5Q
      combinations.push({
        id: `ULS_${combId++}`,
        name: '1.2G + 1.5Q',
        limitState: 'ultimate',
        code: 'AS1170',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.2 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.5 })),
        ],
      });

      // 1.2G + ψcQ + Wu
      if (this.config.includeWind) {
        const psiC = 0.4; // Long-term factor
        W.forEach(w => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `1.2G + ${psiC}Q + ${w.name}`,
            limitState: 'ultimate',
            code: 'AS1170',
            factors: [
              ...G.map(g => ({ loadCaseId: g.id, factor: 1.2 })),
              ...Q.map(q => ({ loadCaseId: q.id, factor: psiC })),
              { loadCaseId: w.id, factor: 1.0 },
            ],
          });
        });
      }

      // 0.9G + Wu (for stability)
      if (this.config.includeWind) {
        W.forEach(w => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `0.9G + ${w.name}`,
            limitState: 'ultimate',
            code: 'AS1170',
            factors: [
              ...G.map(g => ({ loadCaseId: g.id, factor: 0.9 })),
              { loadCaseId: w.id, factor: 1.0 },
            ],
          });
        });
      }

      // Seismic combinations
      if (this.config.includeSeismic) {
        E.forEach(e => {
          combinations.push({
            id: `ULS_${combId++}`,
            name: `G + ψEQ + ${e.name}`,
            limitState: 'ultimate',
            code: 'AS1170',
            factors: [
              ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
              ...Q.map(q => ({ loadCaseId: q.id, factor: 0.3 })),
              { loadCaseId: e.id, factor: 1.0 },
            ],
          });
        });
      }
    }

    if (this.config.limitState === 'serviceability') {
      combinations.push({
        id: `SLS_${combId++}`,
        name: 'G + Q',
        limitState: 'serviceability',
        code: 'AS1170',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 1.0 })),
        ],
      });

      combinations.push({
        id: `SLS_${combId++}`,
        name: 'G + ψsQ',
        limitState: 'serviceability',
        code: 'AS1170',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 0.7 })),
        ],
      });

      combinations.push({
        id: `SLS_${combId++}`,
        name: 'G + ψlQ',
        limitState: 'serviceability',
        code: 'AS1170',
        factors: [
          ...G.map(g => ({ loadCaseId: g.id, factor: 1.0 })),
          ...Q.map(q => ({ loadCaseId: q.id, factor: 0.4 })),
        ],
      });
    }

    this.combinations = combinations;
    return combinations;
  }

  // --------------------------------------------------------------------------
  // COMBINATION ANALYSIS
  // --------------------------------------------------------------------------

  calculateCombinationValues(): LoadCombination[] {
    return this.combinations.map(comb => {
      const totalValues: LoadValues = {
        Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0, w: 0, P: 0,
      };

      comb.factors.forEach(factor => {
        const loadCase = this.loadCases.get(factor.loadCaseId);
        if (loadCase) {
          const f = factor.factor;
          const v = loadCase.values;
          
          totalValues.Fx! += (v.Fx || 0) * f;
          totalValues.Fy! += (v.Fy || 0) * f;
          totalValues.Fz! += (v.Fz || 0) * f;
          totalValues.Mx! += (v.Mx || 0) * f;
          totalValues.My! += (v.My || 0) * f;
          totalValues.Mz! += (v.Mz || 0) * f;
          totalValues.w! += (v.w || 0) * f;
          totalValues.P! += (v.P || 0) * f;
        }
      });

      return {
        ...comb,
        totalValues,
      };
    });
  }

  identifyCriticalCombinations(): LoadCombination[] {
    const combsWithValues = this.calculateCombinationValues();
    
    // Find critical combinations for each response
    const criticalIds = new Set<string>();

    // Maximum axial
    const maxFz = combsWithValues.reduce((max, c) => 
      Math.abs(c.totalValues?.Fz || 0) > Math.abs(max.totalValues?.Fz || 0) ? c : max
    );
    criticalIds.add(maxFz.id);

    // Maximum moment
    const maxMx = combsWithValues.reduce((max, c) => 
      Math.abs(c.totalValues?.Mx || 0) > Math.abs(max.totalValues?.Mx || 0) ? c : max
    );
    criticalIds.add(maxMx.id);

    const maxMy = combsWithValues.reduce((max, c) => 
      Math.abs(c.totalValues?.My || 0) > Math.abs(max.totalValues?.My || 0) ? c : max
    );
    criticalIds.add(maxMy.id);

    // Maximum shear
    const maxFx = combsWithValues.reduce((max, c) => 
      Math.abs(c.totalValues?.Fx || 0) > Math.abs(max.totalValues?.Fx || 0) ? c : max
    );
    criticalIds.add(maxFx.id);

    return combsWithValues.map(comb => ({
      ...comb,
      isCritical: criticalIds.has(comb.id),
    }));
  }

  calculateEnvelope(memberResults: Map<string, Map<string, LoadValues>>): EnvelopeResult[] {
    const envelopes: EnvelopeResult[] = [];

    memberResults.forEach((combResults, memberId) => {
      const envelope: EnvelopeResult = {
        memberOrNode: memberId,
        maxValues: {
          Fx: { value: -Infinity, combination: '' },
          Fy: { value: -Infinity, combination: '' },
          Fz: { value: -Infinity, combination: '' },
          Mx: { value: -Infinity, combination: '' },
          My: { value: -Infinity, combination: '' },
          Mz: { value: -Infinity, combination: '' },
        },
        minValues: {
          Fx: { value: Infinity, combination: '' },
          Fy: { value: Infinity, combination: '' },
          Fz: { value: Infinity, combination: '' },
          Mx: { value: Infinity, combination: '' },
          My: { value: Infinity, combination: '' },
          Mz: { value: Infinity, combination: '' },
        },
      };

      combResults.forEach((values, combId) => {
        const components: (keyof LoadValues)[] = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'];
        
        components.forEach(comp => {
          const val = values[comp] || 0;
          
          if (val > envelope.maxValues[comp as keyof typeof envelope.maxValues].value) {
            envelope.maxValues[comp as keyof typeof envelope.maxValues] = { value: val, combination: combId };
          }
          
          if (val < envelope.minValues[comp as keyof typeof envelope.minValues].value) {
            envelope.minValues[comp as keyof typeof envelope.minValues] = { value: val, combination: combId };
          }
        });
      });

      envelopes.push(envelope);
    });

    return envelopes;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private getLoadCasesByType(type: LoadType): LoadCase[] {
    return Array.from(this.loadCases.values()).filter(lc => lc.type === type);
  }

  getCombinations(): LoadCombination[] {
    return this.combinations;
  }

  getCombinationById(id: string): LoadCombination | undefined {
    return this.combinations.find(c => c.id === id);
  }

  exportToJSON(): string {
    return JSON.stringify({
      loadCases: Array.from(this.loadCases.entries()),
      combinations: this.combinations,
      config: this.config,
    }, null, 2);
  }

  importFromJSON(json: string): void {
    const data = JSON.parse(json);
    
    this.loadCases = new Map(data.loadCases);
    this.combinations = data.combinations;
    this.config = data.config;
  }

  generateReport(): string {
    let report = '# LOAD COMBINATION REPORT\n\n';
    report += `Code: ${this.config.code}\n`;
    report += `Limit State: ${this.config.limitState}\n\n`;

    report += '## Load Cases\n\n';
    report += '| ID | Name | Type | Description |\n';
    report += '|----|------|------|-------------|\n';
    
    this.loadCases.forEach((lc, id) => {
      report += `| ${id} | ${lc.name} | ${lc.type} | ${lc.description || '-'} |\n`;
    });

    report += '\n## Load Combinations\n\n';
    
    this.combinations.forEach(comb => {
      report += `### ${comb.name}\n`;
      report += `ID: ${comb.id} | Limit State: ${comb.limitState}\n\n`;
      report += '| Load Case | Factor |\n';
      report += '|-----------|--------|\n';
      
      comb.factors.forEach(f => {
        const lc = this.loadCases.get(f.loadCaseId);
        report += `| ${lc?.name || f.loadCaseId} | ${f.factor.toFixed(2)} |\n`;
      });
      
      report += '\n';
    });

    return report;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export const createLoadCombinationEngine = (config: CombinationConfig): LoadCombinationEngine => {
  return new LoadCombinationEngine(config);
};

export default LoadCombinationEngine;
