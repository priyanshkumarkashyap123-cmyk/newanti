/**
 * Load Combination Calculator
 * Per ASCE 7-22 Chapter 2
 * 
 * Features:
 * - LRFD combinations
 * - ASD combinations
 * - Seismic load effects (E, Em, Ev)
 * - Live load reduction
 * - Governing combination identification
 */

import {
  LoadType,
  DesignMethod,
  LoadCombinationInput,
  LoadCombinationResult,
  LoadCombination,
  LRFD_COMBINATIONS,
  ASD_COMBINATIONS,
  LIVE_LOAD_REDUCTION,
} from './LoadCombinationTypes';

export class LoadCombinationCalculator {
  private input: LoadCombinationInput;
  
  constructor(input: LoadCombinationInput) {
    this.input = input;
  }
  
  /**
   * Calculate all applicable load combinations
   */
  public calculate(): LoadCombinationResult {
    const { designMethod, loads, includeSeismic, includeWind } = this.input;
    
    // Get applicable combinations
    const baseCombinations = designMethod === DesignMethod.LRFD 
      ? LRFD_COMBINATIONS 
      : ASD_COMBINATIONS;
    
    // Filter based on load types present
    const applicableCombinations = baseCombinations.filter(combo => {
      // Check if all required load types are present
      const hasRequiredLoads = combo.factors.every(f => 
        loads.some(l => l.type === f.type) || 
        this.isOptionalLoad(f.type, combo)
      );
      
      // Filter seismic/wind if not included
      if (!includeSeismic && combo.factors.some(f => f.type === LoadType.E)) {
        return false;
      }
      if (!includeWind && combo.factors.some(f => f.type === LoadType.W)) {
        return false;
      }
      
      return hasRequiredLoads;
    });
    
    // Calculate factored loads for each combination
    const results = applicableCombinations.map(combo => {
      const factoredLoads = combo.factors.map(f => {
        const load = loads.find(l => l.type === f.type);
        const value = load?.value || 0;
        return {
          type: f.type,
          factored: value * f.factor,
        };
      });
      
      const total = factoredLoads.reduce((sum, l) => sum + l.factored, 0);
      
      return {
        combination: combo,
        factored_loads: factoredLoads,
        total,
      };
    });
    
    // Find governing combination (maximum positive)
    const maxResult = results.reduce((max, r) => 
      r.total > max.total ? r : max, 
      results[0]
    );
    
    // Mark governing
    results.forEach(r => {
      r.governs = r.combination.id === maxResult.combination.id;
    });
    
    // Summary
    const totals = results.map(r => r.total);
    
    return {
      combinations: results,
      governing: {
        combination: maxResult.combination,
        total: maxResult.total,
      },
      summary: {
        method: designMethod,
        totalCombinations: results.length,
        maxLoad: Math.max(...totals),
        minLoad: Math.min(...totals),
      },
    };
  }
  
  /**
   * Calculate live load reduction factor
   */
  public calculateLiveLoadReduction(
    AT: number,           // Tributary area (sq ft)
    KLL: number,          // Live load element factor
    Lo: number,           // Unreduced live load (psf)
    isParking?: boolean
  ): { factor: number; L: number } {
    // ASCE 7-22 4.7.2
    // L = Lo × (0.25 + 15/√(KLL × AT))
    
    const sqrtTerm = Math.sqrt(KLL * AT);
    let factor = 0.25 + 15 / sqrtTerm;
    
    // Apply limits
    const minFactor = isParking 
      ? LIVE_LOAD_REDUCTION.minFactor_parking 
      : LIVE_LOAD_REDUCTION.minFactor;
    
    factor = Math.max(factor, minFactor);
    factor = Math.min(factor, 1.0);
    
    return {
      factor,
      L: Lo * factor,
    };
  }
  
  /**
   * Calculate seismic load effect E (ASCE 7-22 12.4.2)
   */
  public calculateSeismicE(
    QE: number,           // Horizontal seismic force
    SDS: number,          // Design spectral acceleration
    D: number,            // Dead load
    rho: number = 1.0     // Redundancy factor
  ): { Eh: number; Ev: number; E: number; E_uplift: number } {
    // Eh = ρ × QE
    const Eh = rho * QE;
    
    // Ev = 0.2 × SDS × D
    const Ev = 0.2 * SDS * D;
    
    // E = Eh + Ev (for strength)
    // E = Eh - Ev (for uplift)
    
    return {
      Eh,
      Ev,
      E: Eh + Ev,
      E_uplift: Eh - Ev,
    };
  }
  
  /**
   * Calculate seismic load effect with overstrength Em (ASCE 7-22 12.4.3)
   */
  public calculateSeismicEm(
    QE: number,           // Horizontal seismic force
    SDS: number,          // Design spectral acceleration
    D: number,            // Dead load
    omega_0: number       // Overstrength factor
  ): { Emh: number; Ev: number; Em: number; Em_uplift: number } {
    // Emh = Ω0 × QE
    const Emh = omega_0 * QE;
    
    // Ev = 0.2 × SDS × D
    const Ev = 0.2 * SDS * D;
    
    return {
      Emh,
      Ev,
      Em: Emh + Ev,
      Em_uplift: Emh - Ev,
    };
  }
  
  /**
   * Get combinations for specific analysis type
   */
  public getCombinationsForType(
    type: 'gravity' | 'wind' | 'seismic' | 'all'
  ): LoadCombination[] {
    const combinations = this.input.designMethod === DesignMethod.LRFD 
      ? LRFD_COMBINATIONS 
      : ASD_COMBINATIONS;
    
    switch (type) {
      case 'gravity':
        return combinations.filter(c => 
          !c.factors.some(f => f.type === LoadType.W || f.type === LoadType.E)
        );
      case 'wind':
        return combinations.filter(c => 
          c.factors.some(f => f.type === LoadType.W)
        );
      case 'seismic':
        return combinations.filter(c => 
          c.factors.some(f => f.type === LoadType.E)
        );
      default:
        return combinations;
    }
  }
  
  /**
   * Check if load type is optional in combination
   */
  private isOptionalLoad(type: LoadType, combo: LoadCombination): boolean {
    // Roof loads (Lr, S, R) are typically alternatives
    const optionalTypes = [LoadType.Lr, LoadType.S, LoadType.R];
    return optionalTypes.includes(type);
  }
}

// Export convenience function
export function calculateLoadCombinations(input: LoadCombinationInput): LoadCombinationResult {
  const calculator = new LoadCombinationCalculator(input);
  return calculator.calculate();
}
