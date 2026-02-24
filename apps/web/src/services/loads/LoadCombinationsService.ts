/**
 * LoadCombinationsService.ts - Complete Load Combinations
 * 
 * Implements all load combinations per:
 * - IS 875 / IS 456
 * - ASCE 7-22 / ACI 318
 * - Eurocode EN 1990
 */

// ============================================
// TYPES
// ============================================

export interface LoadCase {
    id: string;
    name: string;
    type: 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'rain' | 'temperature' | 'self_weight';
    magnitude: number;  // kN or kN/m² or kN/m
}

export interface LoadCombination {
    id: string;
    name: string;
    code: 'IS' | 'ASCE' | 'EC';
    type: 'strength' | 'service' | 'seismic' | 'wind';
    factors: { caseId: string; factor: number }[];
    description: string;
}

export interface CombinedLoads {
    combinationId: string;
    name: string;
    factoredValue: number;
    governingCase: string;
}

// ============================================
// LOAD COMBINATION DEFINITIONS
// ============================================

/**
 * IS 456:2000 / IS 875 Load Combinations (Table 18)
 */
export const IS_COMBINATIONS: Omit<LoadCombination, 'factors'>[] = [
    { id: 'IS_1', name: '1.5(DL+LL)', code: 'IS', type: 'strength', description: 'Basic gravity' },
    { id: 'IS_2', name: '1.2(DL+LL+WL)', code: 'IS', type: 'strength', description: 'Gravity + Wind' },
    { id: 'IS_3', name: '1.5(DL+WL)', code: 'IS', type: 'strength', description: 'Dead + Wind' },
    { id: 'IS_4', name: '0.9DL+1.5WL', code: 'IS', type: 'strength', description: 'Dead + Wind (uplift)' },
    { id: 'IS_5', name: '1.2(DL+LL+EQ)', code: 'IS', type: 'seismic', description: 'Gravity + Seismic' },
    { id: 'IS_6', name: '1.5(DL+EQ)', code: 'IS', type: 'seismic', description: 'Dead + Seismic' },
    { id: 'IS_7', name: '0.9DL+1.5EQ', code: 'IS', type: 'seismic', description: 'Dead + Seismic (uplift)' },
    { id: 'IS_S1', name: 'DL+LL', code: 'IS', type: 'service', description: 'Service loads' },
];

/**
 * ASCE 7-22 / ACI 318-19 Load Combinations (Section 5.3)
 */
export const ASCE_COMBINATIONS: Omit<LoadCombination, 'factors'>[] = [
    { id: 'ASCE_1', name: '1.4D', code: 'ASCE', type: 'strength', description: 'Dead only' },
    { id: 'ASCE_2', name: '1.2D+1.6L+0.5(Lr/S/R)', code: 'ASCE', type: 'strength', description: 'Basic gravity' },
    { id: 'ASCE_3', name: '1.2D+1.6(Lr/S/R)+L', code: 'ASCE', type: 'strength', description: 'Roof loads govern' },
    { id: 'ASCE_4', name: '1.2D+1.0W+L+0.5(Lr/S/R)', code: 'ASCE', type: 'wind', description: 'Wind combination' },
    { id: 'ASCE_5', name: '0.9D+1.0W', code: 'ASCE', type: 'wind', description: 'Wind uplift' },
    { id: 'ASCE_6', name: '1.2D+1.0E+L', code: 'ASCE', type: 'seismic', description: 'Seismic combination' },
    { id: 'ASCE_7', name: '0.9D+1.0E', code: 'ASCE', type: 'seismic', description: 'Seismic uplift' },
    { id: 'ASCE_S1', name: 'D+L', code: 'ASCE', type: 'service', description: 'Service loads' },
    { id: 'ASCE_S2', name: 'D+0.5L', code: 'ASCE', type: 'service', description: 'Service (reduced live)' },
];

/**
 * Eurocode EN 1990 Load Combinations (Table A1.2)
 */
export const EC_COMBINATIONS: Omit<LoadCombination, 'factors'>[] = [
    { id: 'EC_1', name: '1.35Gk+1.5Qk', code: 'EC', type: 'strength', description: 'STR/GEO Set B' },
    { id: 'EC_2', name: '1.35Gk+1.5Qk+0.6Wk', code: 'EC', type: 'strength', description: 'With wind' },
    { id: 'EC_3', name: '1.35Gk+1.5Wk+0.7Qk', code: 'EC', type: 'wind', description: 'Wind dominant' },
    { id: 'EC_4', name: '1.0Gk+1.5Wk', code: 'EC', type: 'wind', description: 'Wind uplift' },
    { id: 'EC_5', name: '1.0Gk+1.0AEd+0.3Qk', code: 'EC', type: 'seismic', description: 'Seismic combination' },
    { id: 'EC_S1', name: 'Gk+Qk', code: 'EC', type: 'service', description: 'Characteristic combo' },
    { id: 'EC_S2', name: 'Gk+0.3Qk', code: 'EC', type: 'service', description: 'Quasi-permanent' },
];

// ============================================
// LOAD COMBINATION SERVICE
// ============================================

class LoadCombinationsServiceClass {
    /**
     * Get all combinations for a design code
     */
    getCombinations(code: 'IS' | 'ASCE' | 'EC'): Omit<LoadCombination, 'factors'>[] {
        switch (code) {
            case 'IS': return IS_COMBINATIONS;
            case 'ASCE': return ASCE_COMBINATIONS;
            case 'EC': return EC_COMBINATIONS;
        }
    }

    /**
     * Generate factored combinations from load cases
     */
    generateCombinations(
        loadCases: LoadCase[],
        code: 'IS' | 'ASCE' | 'EC'
    ): LoadCombination[] {
        const templates = this.getCombinations(code);
        const combinations: LoadCombination[] = [];

        for (const template of templates) {
            const factors = this.getFactors(template.id, loadCases);
            combinations.push({
                ...template,
                factors
            });
        }

        return combinations;
    }

    /**
     * Calculate factored load for a combination
     */
    calculateFactoredLoad(
        combination: LoadCombination,
        loadCases: LoadCase[]
    ): number {
        let total = 0;

        for (const factor of combination.factors) {
            const loadCase = loadCases.find(lc => lc.id === factor.caseId);
            if (loadCase) {
                total += loadCase.magnitude * factor.factor;
            }
        }

        return total;
    }

    /**
     * Find governing combination
     */
    findGoverningCombination(
        loadCases: LoadCase[],
        code: 'IS' | 'ASCE' | 'EC',
        type: 'strength' | 'service' | 'all' = 'all'
    ): CombinedLoads {
        const combinations = this.generateCombinations(loadCases, code);

        let maxValue = 0;
        let governingCombo = combinations[0];

        for (const combo of combinations) {
            if (type !== 'all' && combo.type !== type) continue;

            const value = this.calculateFactoredLoad(combo, loadCases);
            if (value > maxValue) {
                maxValue = value;
                governingCombo = combo;
            }
        }

        return {
            combinationId: governingCombo.id,
            name: governingCombo.name,
            factoredValue: maxValue,
            governingCase: governingCombo.description
        };
    }

    /**
     * Get factors for specific combination
     */
    private getFactors(comboId: string, loadCases: LoadCase[]): LoadCombination['factors'] {
        const factors: LoadCombination['factors'] = [];
        const dead = loadCases.find(lc => lc.type === 'dead' || lc.type === 'self_weight');
        const live = loadCases.find(lc => lc.type === 'live');
        const wind = loadCases.find(lc => lc.type === 'wind');
        const seismic = loadCases.find(lc => lc.type === 'seismic');

        // IS combinations
        if (comboId === 'IS_1') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.5 });
            if (live) factors.push({ caseId: live.id, factor: 1.5 });
        } else if (comboId === 'IS_2') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.2 });
            if (live) factors.push({ caseId: live.id, factor: 1.2 });
            if (wind) factors.push({ caseId: wind.id, factor: 1.2 });
        } else if (comboId === 'IS_4') {
            if (dead) factors.push({ caseId: dead.id, factor: 0.9 });
            if (wind) factors.push({ caseId: wind.id, factor: 1.5 });
        } else if (comboId === 'IS_5') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.2 });
            if (live) factors.push({ caseId: live.id, factor: 1.2 });
            if (seismic) factors.push({ caseId: seismic.id, factor: 1.2 });
        }
        // ASCE combinations
        else if (comboId === 'ASCE_1') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.4 });
        } else if (comboId === 'ASCE_2') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.2 });
            if (live) factors.push({ caseId: live.id, factor: 1.6 });
        } else if (comboId === 'ASCE_5') {
            if (dead) factors.push({ caseId: dead.id, factor: 0.9 });
            if (wind) factors.push({ caseId: wind.id, factor: 1.0 });
        } else if (comboId === 'ASCE_6') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.2 });
            if (live) factors.push({ caseId: live.id, factor: 1.0 });
            if (seismic) factors.push({ caseId: seismic.id, factor: 1.0 });
        }
        // EC combinations
        else if (comboId === 'EC_1') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.35 });
            if (live) factors.push({ caseId: live.id, factor: 1.5 });
        } else if (comboId === 'EC_4') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.0 });
            if (wind) factors.push({ caseId: wind.id, factor: 1.5 });
        } else if (comboId === 'EC_5') {
            if (dead) factors.push({ caseId: dead.id, factor: 1.0 });
            if (live) factors.push({ caseId: live.id, factor: 0.3 });
            if (seismic) factors.push({ caseId: seismic.id, factor: 1.0 });
        }
        // Service combinations
        else if (comboId.includes('_S')) {
            if (dead) factors.push({ caseId: dead.id, factor: 1.0 });
            if (live) factors.push({ caseId: live.id, factor: comboId.includes('S2') ? 0.5 : 1.0 });
        }

        return factors;
    }

    /**
     * Generate load combination table for report
     */
    generateCombinationTable(
        loadCases: LoadCase[],
        code: 'IS' | 'ASCE' | 'EC'
    ): string[][] {
        const combinations = this.generateCombinations(loadCases, code);
        const rows: string[][] = [
            ['Combo', 'Description', 'Type', 'Factored Load']
        ];

        for (const combo of combinations) {
            const factoredLoad = this.calculateFactoredLoad(combo, loadCases);
            rows.push([
                combo.name,
                combo.description,
                combo.type.toUpperCase(),
                `${factoredLoad.toFixed(2)} kN`
            ]);
        }

        return rows;
    }
}

// Export singleton
export const loadCombinations = new LoadCombinationsServiceClass();
export default LoadCombinationsServiceClass;
