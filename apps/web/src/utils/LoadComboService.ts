/**
 * Load Combination Service
 * Generates load combinations according to design codes (ASCE 7, IS 875, etc.)
 */

// ============================================
// INTERFACES
// ============================================

export type LoadCaseType = 'D' | 'L' | 'Lr' | 'S' | 'R' | 'W' | 'E' | 'H' | 'F' | 'T';

export interface LoadCase {
    id: string;
    name: string;
    type: LoadCaseType;
    description?: string;
}

export interface LoadCombination {
    id: string;
    name: string;
    factors: Record<string, number>; // CaseId -> factor
    code: string; // e.g., "ASCE 7-22 LRFD"
    equation?: string; // e.g., "1.2D + 1.6L"
}

// ============================================
// ASCE 7 LOAD COMBINATIONS
// ============================================

/**
 * ASCE 7-22 LRFD Load Combinations (Section 2.3.1)
 * 1. 1.4D
 * 2. 1.2D + 1.6L + 0.5(Lr or S or R)
 * 3. 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
 * 4. 1.2D + 1.0W + L + 0.5(Lr or S or R)
 * 5. 1.2D + 1.0E + L + 0.2S
 * 6. 0.9D + 1.0W
 * 7. 0.9D + 1.0E
 */

export class LoadComboService {

    /**
     * Generate ASCE 7-22 LRFD load combinations
     */
    static generateASCE7_LRFD(cases: LoadCase[]): LoadCombination[] {
        const combos: LoadCombination[] = [];

        // Find cases by type
        const D = cases.filter(c => c.type === 'D');
        const L = cases.filter(c => c.type === 'L');
        const Lr = cases.filter(c => c.type === 'Lr');
        const S = cases.filter(c => c.type === 'S');
        const R = cases.filter(c => c.type === 'R');
        const W = cases.filter(c => c.type === 'W');
        const E = cases.filter(c => c.type === 'E');

        // Roof loads group (Lr, S, R)
        const roofLoads = [...Lr, ...S, ...R];

        let comboNum = 1;

        // Combo 1: 1.4D
        if (D.length > 0) {
            const factors: Record<string, number> = {};
            D.forEach(d => factors[d.id] = 1.4);
            combos.push({
                id: `combo_${comboNum}`,
                name: `LRFD ${comboNum}`,
                factors,
                code: 'ASCE 7-22 LRFD',
                equation: '1.4D'
            });
            comboNum++;
        }

        // Combo 2: 1.2D + 1.6L + 0.5(Lr or S or R)
        if (D.length > 0 && L.length > 0) {
            const baseFact: Record<string, number> = {};
            D.forEach(d => baseFact[d.id] = 1.2);
            L.forEach(l => baseFact[l.id] = 1.6);

            if (roofLoads.length > 0) {
                // Generate for each roof load type
                roofLoads.forEach(roof => {
                    const factors = { ...baseFact };
                    factors[roof.id] = 0.5;
                    combos.push({
                        id: `combo_${comboNum}`,
                        name: `LRFD ${comboNum}`,
                        factors,
                        code: 'ASCE 7-22 LRFD',
                        equation: `1.2D + 1.6L + 0.5${roof.type}`
                    });
                    comboNum++;
                });
            } else {
                // Just 1.2D + 1.6L
                combos.push({
                    id: `combo_${comboNum}`,
                    name: `LRFD ${comboNum}`,
                    factors: baseFact,
                    code: 'ASCE 7-22 LRFD',
                    equation: '1.2D + 1.6L'
                });
                comboNum++;
            }
        }

        // Combo 3: 1.2D + 1.6(Lr or S or R) + (L or 0.5W)
        if (D.length > 0 && roofLoads.length > 0) {
            roofLoads.forEach(roof => {
                const baseFact: Record<string, number> = {};
                D.forEach(d => baseFact[d.id] = 1.2);
                baseFact[roof.id] = 1.6;

                // With L
                if (L.length > 0) {
                    const factors = { ...baseFact };
                    L.forEach(l => factors[l.id] = 1.0);
                    combos.push({
                        id: `combo_${comboNum}`,
                        name: `LRFD ${comboNum}`,
                        factors,
                        code: 'ASCE 7-22 LRFD',
                        equation: `1.2D + 1.6${roof.type} + L`
                    });
                    comboNum++;
                }

                // With 0.5W
                if (W.length > 0) {
                    W.forEach(w => {
                        const factors = { ...baseFact };
                        factors[w.id] = 0.5;
                        combos.push({
                            id: `combo_${comboNum}`,
                            name: `LRFD ${comboNum}`,
                            factors,
                            code: 'ASCE 7-22 LRFD',
                            equation: `1.2D + 1.6${roof.type} + 0.5W`
                        });
                        comboNum++;
                    });
                }
            });
        }

        // Combo 4: 1.2D + 1.0W + L + 0.5(Lr or S or R)
        if (D.length > 0 && W.length > 0) {
            W.forEach(w => {
                const baseFact: Record<string, number> = {};
                D.forEach(d => baseFact[d.id] = 1.2);
                baseFact[w.id] = 1.0;
                L.forEach(l => baseFact[l.id] = 1.0);

                if (roofLoads.length > 0) {
                    roofLoads.forEach(roof => {
                        const factors = { ...baseFact };
                        factors[roof.id] = 0.5;
                        combos.push({
                            id: `combo_${comboNum}`,
                            name: `LRFD ${comboNum}`,
                            factors,
                            code: 'ASCE 7-22 LRFD',
                            equation: `1.2D + 1.0W + L + 0.5${roof.type}`
                        });
                        comboNum++;
                    });
                } else {
                    combos.push({
                        id: `combo_${comboNum}`,
                        name: `LRFD ${comboNum}`,
                        factors: baseFact,
                        code: 'ASCE 7-22 LRFD',
                        equation: '1.2D + 1.0W + L'
                    });
                    comboNum++;
                }
            });
        }

        // Combo 5: 1.2D + 1.0E + L + 0.2S
        if (D.length > 0 && E.length > 0) {
            E.forEach(e => {
                const factors: Record<string, number> = {};
                D.forEach(d => factors[d.id] = 1.2);
                factors[e.id] = 1.0;
                L.forEach(l => factors[l.id] = 1.0);
                S.forEach(s => factors[s.id] = 0.2);

                combos.push({
                    id: `combo_${comboNum}`,
                    name: `LRFD ${comboNum}`,
                    factors,
                    code: 'ASCE 7-22 LRFD',
                    equation: '1.2D + 1.0E + L + 0.2S'
                });
                comboNum++;
            });
        }

        // Combo 6: 0.9D + 1.0W
        if (D.length > 0 && W.length > 0) {
            W.forEach(w => {
                const factors: Record<string, number> = {};
                D.forEach(d => factors[d.id] = 0.9);
                factors[w.id] = 1.0;

                combos.push({
                    id: `combo_${comboNum}`,
                    name: `LRFD ${comboNum}`,
                    factors,
                    code: 'ASCE 7-22 LRFD',
                    equation: '0.9D + 1.0W'
                });
                comboNum++;
            });
        }

        // Combo 7: 0.9D + 1.0E
        if (D.length > 0 && E.length > 0) {
            E.forEach(e => {
                const factors: Record<string, number> = {};
                D.forEach(d => factors[d.id] = 0.9);
                factors[e.id] = 1.0;

                combos.push({
                    id: `combo_${comboNum}`,
                    name: `LRFD ${comboNum}`,
                    factors,
                    code: 'ASCE 7-22 LRFD',
                    equation: '0.9D + 1.0E'
                });
                comboNum++;
            });
        }

        return combos;
    }

    /**
     * Generate ASCE 7-22 ASD Load Combinations
     * 1. D
     * 2. D + L
     * 3. D + (Lr or S or R)
     * 4. D + 0.75L + 0.75(Lr or S or R)
     * 5. D + (0.6W or 0.7E)
     * 6. D + 0.75L + 0.75(0.6W) + 0.75(Lr or S or R)
     * 7. 0.6D + 0.6W
     * 8. 0.6D + 0.7E
     */
    static generateASCE7_ASD(cases: LoadCase[]): LoadCombination[] {
        const combos: LoadCombination[] = [];

        const D = cases.filter(c => c.type === 'D');
        const L = cases.filter(c => c.type === 'L');
        const Lr = cases.filter(c => c.type === 'Lr');
        const S = cases.filter(c => c.type === 'S');
        const R = cases.filter(c => c.type === 'R');
        const W = cases.filter(c => c.type === 'W');
        const E = cases.filter(c => c.type === 'E');
        const roofLoads = [...Lr, ...S, ...R];

        let comboNum = 1;

        // Combo 1: D
        if (D.length > 0) {
            const factors: Record<string, number> = {};
            D.forEach(d => factors[d.id] = 1.0);
            combos.push({
                id: `combo_asd_${comboNum}`,
                name: `ASD ${comboNum}`,
                factors,
                code: 'ASCE 7-22 ASD',
                equation: 'D'
            });
            comboNum++;
        }

        // Combo 2: D + L
        if (D.length > 0 && L.length > 0) {
            const factors: Record<string, number> = {};
            D.forEach(d => factors[d.id] = 1.0);
            L.forEach(l => factors[l.id] = 1.0);
            combos.push({
                id: `combo_asd_${comboNum}`,
                name: `ASD ${comboNum}`,
                factors,
                code: 'ASCE 7-22 ASD',
                equation: 'D + L'
            });
            comboNum++;
        }

        // Combo 5: D + 0.6W
        if (D.length > 0 && W.length > 0) {
            W.forEach(w => {
                const factors: Record<string, number> = {};
                D.forEach(d => factors[d.id] = 1.0);
                factors[w.id] = 0.6;
                combos.push({
                    id: `combo_asd_${comboNum}`,
                    name: `ASD ${comboNum}`,
                    factors,
                    code: 'ASCE 7-22 ASD',
                    equation: 'D + 0.6W'
                });
                comboNum++;
            });
        }

        // Combo 7: 0.6D + 0.6W
        if (D.length > 0 && W.length > 0) {
            W.forEach(w => {
                const factors: Record<string, number> = {};
                D.forEach(d => factors[d.id] = 0.6);
                factors[w.id] = 0.6;
                combos.push({
                    id: `combo_asd_${comboNum}`,
                    name: `ASD ${comboNum}`,
                    factors,
                    code: 'ASCE 7-22 ASD',
                    equation: '0.6D + 0.6W'
                });
                comboNum++;
            });
        }

        return combos;
    }

    /**
     * Save combinations to store
     */
    static saveCombinations(combos: LoadCombination[]): void {
        // Note: You'll need to add loadCombinations to the store
        // For now, we'll log them
        console.log('Generated Load Combinations:', combos);

        // If store has setLoadCombinations action:
        // state.setLoadCombinations(combos);
    }

    // ============================================
    // IS 875 (Part 5) LOAD COMBINATIONS - INDIAN STANDARDS
    // ============================================

    /**
     * IS 875 Part 5 - Limit State Design (LSD) Load Combinations
     * As per IS 875:2015 Part 5, Table 1
     * 
     * DL = Dead Load, IL = Imposed Load (Live), WL = Wind Load, EL = Earthquake Load
     * 
     * Basic Combinations:
     * 1. 1.5 (DL + IL)
     * 2. 1.2 (DL + IL ± WL)
     * 3. 1.5 (DL ± WL)
     * 4. 0.9 DL ± 1.5 WL
     * 5. 1.2 (DL + IL ± EL)
     * 6. 1.5 (DL ± EL)
     * 7. 0.9 DL ± 1.5 EL
     */
    static generateIS875_LSD(cases: LoadCase[]): LoadCombination[] {
        const combos: LoadCombination[] = [];

        // IS uses different terminology: D=DL, L=IL, W=WL, E=EL
        const DL = cases.filter(c => c.type === 'D');
        const IL = cases.filter(c => c.type === 'L');
        const WL = cases.filter(c => c.type === 'W');
        const EL = cases.filter(c => c.type === 'E');

        let comboNum = 1;

        // Combo 1: 1.5 (DL + IL)
        if (DL.length > 0 && IL.length > 0) {
            const factors: Record<string, number> = {};
            DL.forEach(d => factors[d.id] = 1.5);
            IL.forEach(l => factors[l.id] = 1.5);
            combos.push({
                id: `combo_is_lsd_${comboNum}`,
                name: `IS-LSD ${comboNum}`,
                factors,
                code: 'IS 875:2015 Part 5 LSD',
                equation: '1.5(DL + IL)'
            });
            comboNum++;
        }

        // Combo 2: 1.2 (DL + IL + WL) and 1.2 (DL + IL - WL)
        if (DL.length > 0 && IL.length > 0 && WL.length > 0) {
            WL.forEach(w => {
                // +WL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.2);
                IL.forEach(l => factorsPos[l.id] = 1.2);
                factorsPos[w.id] = 1.2;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.2(DL + IL + WL)'
                });
                comboNum++;

                // -WL (reversal)
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.2);
                IL.forEach(l => factorsNeg[l.id] = 1.2);
                factorsNeg[w.id] = -1.2;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.2(DL + IL - WL)'
                });
                comboNum++;
            });
        }

        // Combo 3: 1.5 (DL + WL) and 1.5 (DL - WL)
        if (DL.length > 0 && WL.length > 0) {
            WL.forEach(w => {
                // +WL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.5);
                factorsPos[w.id] = 1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.5(DL + WL)'
                });
                comboNum++;

                // -WL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.5);
                factorsNeg[w.id] = -1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.5(DL - WL)'
                });
                comboNum++;
            });
        }

        // Combo 4: 0.9 DL ± 1.5 WL (for uplift/overturning)
        if (DL.length > 0 && WL.length > 0) {
            WL.forEach(w => {
                // +WL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 0.9);
                factorsPos[w.id] = 1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '0.9DL + 1.5WL'
                });
                comboNum++;

                // -WL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 0.9);
                factorsNeg[w.id] = -1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '0.9DL - 1.5WL'
                });
                comboNum++;
            });
        }

        // Combo 5: 1.2 (DL + IL ± EL)
        if (DL.length > 0 && IL.length > 0 && EL.length > 0) {
            EL.forEach(e => {
                // +EL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.2);
                IL.forEach(l => factorsPos[l.id] = 1.2);
                factorsPos[e.id] = 1.2;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.2(DL + IL + EL)'
                });
                comboNum++;

                // -EL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.2);
                IL.forEach(l => factorsNeg[l.id] = 1.2);
                factorsNeg[e.id] = -1.2;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.2(DL + IL - EL)'
                });
                comboNum++;
            });
        }

        // Combo 6: 1.5 (DL ± EL)
        if (DL.length > 0 && EL.length > 0) {
            EL.forEach(e => {
                // +EL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.5);
                factorsPos[e.id] = 1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.5(DL + EL)'
                });
                comboNum++;

                // -EL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.5);
                factorsNeg[e.id] = -1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '1.5(DL - EL)'
                });
                comboNum++;
            });
        }

        // Combo 7: 0.9 DL ± 1.5 EL
        if (DL.length > 0 && EL.length > 0) {
            EL.forEach(e => {
                // +EL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 0.9);
                factorsPos[e.id] = 1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '0.9DL + 1.5EL'
                });
                comboNum++;

                // -EL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 0.9);
                factorsNeg[e.id] = -1.5;
                combos.push({
                    id: `combo_is_lsd_${comboNum}`,
                    name: `IS-LSD ${comboNum}`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 LSD',
                    equation: '0.9DL - 1.5EL'
                });
                comboNum++;
            });
        }

        return combos;
    }

    /**
     * IS 875 Part 5 - Working Stress Design (WSD) Load Combinations
     * As per IS 875:2015 Part 5, Table 2
     * 
     * 1. DL + IL
      * 2. DL + IL ± WL (with 33.33% increase in permissible stresses)
      * 3. DL ± WL (with 33.33% increase)
      * 4. DL + IL ± EL (with 33.33% increase)
      * 5. DL ± EL (with 33.33% increase)
     */
    static generateIS875_WSD(cases: LoadCase[]): LoadCombination[] {
        const combos: LoadCombination[] = [];

        const DL = cases.filter(c => c.type === 'D');
        const IL = cases.filter(c => c.type === 'L');
        const WL = cases.filter(c => c.type === 'W');
        const EL = cases.filter(c => c.type === 'E');

        let comboNum = 1;

        // Combo 1: DL + IL
        if (DL.length > 0 && IL.length > 0) {
            const factors: Record<string, number> = {};
            DL.forEach(d => factors[d.id] = 1.0);
            IL.forEach(l => factors[l.id] = 1.0);
            combos.push({
                id: `combo_is_wsd_${comboNum}`,
                name: `IS-WSD ${comboNum}`,
                factors,
                code: 'IS 875:2015 Part 5 WSD',
                equation: 'DL + IL'
            });
            comboNum++;
        }

        // Combo 2: DL + IL ± WL
        if (DL.length > 0 && IL.length > 0 && WL.length > 0) {
            WL.forEach(w => {
                // +WL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.0);
                IL.forEach(l => factorsPos[l.id] = 1.0);
                factorsPos[w.id] = 1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + IL + WL (33.33% stress increase)'
                });
                comboNum++;

                // -WL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.0);
                IL.forEach(l => factorsNeg[l.id] = 1.0);
                factorsNeg[w.id] = -1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + IL - WL (33.33% stress increase)'
                });
                comboNum++;
            });
        }

        // Combo 3: DL ± WL
        if (DL.length > 0 && WL.length > 0) {
            WL.forEach(w => {
                // +WL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.0);
                factorsPos[w.id] = 1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + WL (33.33% stress increase)'
                });
                comboNum++;

                // -WL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.0);
                factorsNeg[w.id] = -1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL - WL (33.33% stress increase)'
                });
                comboNum++;
            });
        }

        // Combo 4: DL + IL ± EL
        if (DL.length > 0 && IL.length > 0 && EL.length > 0) {
            EL.forEach(e => {
                // +EL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.0);
                IL.forEach(l => factorsPos[l.id] = 1.0);
                factorsPos[e.id] = 1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + IL + EL (33.33% stress increase)'
                });
                comboNum++;

                // -EL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.0);
                IL.forEach(l => factorsNeg[l.id] = 1.0);
                factorsNeg[e.id] = -1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + IL - EL (33.33% stress increase)'
                });
                comboNum++;
            });
        }

        // Combo 5: DL ± EL
        if (DL.length > 0 && EL.length > 0) {
            EL.forEach(e => {
                // +EL
                const factorsPos: Record<string, number> = {};
                DL.forEach(d => factorsPos[d.id] = 1.0);
                factorsPos[e.id] = 1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsPos,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL + EL (33.33% stress increase)'
                });
                comboNum++;

                // -EL
                const factorsNeg: Record<string, number> = {};
                DL.forEach(d => factorsNeg[d.id] = 1.0);
                factorsNeg[e.id] = -1.0;
                combos.push({
                    id: `combo_is_wsd_${comboNum}`,
                    name: `IS-WSD ${comboNum}*`,
                    factors: factorsNeg,
                    code: 'IS 875:2015 Part 5 WSD',
                    equation: 'DL - EL (33.33% stress increase)'
                });
                comboNum++;
            });
        }

        return combos;
    }

    /**
     * Generate and save combinations with code selection
     */
    static generateAndSave(cases: LoadCase[], code: 'LRFD' | 'ASD' | 'IS-LSD' | 'IS-WSD' = 'LRFD'): LoadCombination[] {
        let combos: LoadCombination[];

        switch (code) {
            case 'LRFD':
                combos = this.generateASCE7_LRFD(cases);
                break;
            case 'ASD':
                combos = this.generateASCE7_ASD(cases);
                break;
            case 'IS-LSD':
                combos = this.generateIS875_LSD(cases);
                break;
            case 'IS-WSD':
                combos = this.generateIS875_WSD(cases);
                break;
            default:
                combos = this.generateASCE7_LRFD(cases);
        }

        this.saveCombinations(combos);
        return combos;
    }

    /**
     * Get a summary string of all combinations
     */
    static getSummary(combos: LoadCombination[]): string {
        return combos
            .map(c => `${c.name}: ${c.equation}`)
            .join('\n');
    }
}

export default LoadComboService;
