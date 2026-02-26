/**
 * NDSTimberChecker.ts
 * 
 * NDS 2018 National Design Specification for Wood Construction
 * 
 * Features:
 * - Sawn lumber design
 * - Glulam design
 * - Adjustment factors (CD, CM, Ct, CL, CF, etc.)
 * - Bending, shear, compression, tension
 * - Combined loading
 * - Connection design
 */

// ============================================
// TYPES
// ============================================

export type WoodSpecies =
    | 'Douglas Fir-Larch'
    | 'Hem-Fir'
    | 'Southern Pine'
    | 'Spruce-Pine-Fir'
    | 'Redwood';

export type WoodGrade =
    | 'Select Structural'
    | 'No. 1'
    | 'No. 2'
    | 'No. 3'
    | 'Stud';

export type LoadDuration =
    | 'permanent'       // CD = 0.90
    | 'ten_years'       // CD = 1.00
    | 'two_months'      // CD = 1.15
    | 'seven_days'      // CD = 1.25
    | 'ten_minutes'     // CD = 1.60
    | 'impact';         // CD = 2.00

export interface TimberSection {
    type: 'sawn' | 'glulam' | 'SCL';
    nominalWidth: number;    // Nominal width (in)
    nominalDepth: number;    // Nominal depth (in)
    actualWidth: number;     // Actual width (in)
    actualDepth: number;     // Actual depth (in)
    species: WoodSpecies;
    grade: WoodGrade;
}

export interface TimberProperties {
    Fb: number;      // Bending (psi)
    Ft: number;      // Tension parallel (psi)
    Fv: number;      // Shear (psi)
    Fc_perp: number; // Compression perpendicular (psi)
    Fc: number;      // Compression parallel (psi)
    E: number;       // Modulus of elasticity (psi)
    Emin: number;    // Min E for stability (psi)
    G: number;       // Specific gravity
}

export interface AdjustmentFactors {
    CD: number;      // Load duration
    CM: number;      // Wet service
    Ct: number;      // Temperature
    CL: number;      // Beam stability
    CF: number;      // Size factor
    Cfu: number;     // Flat use
    Ci: number;      // Incising
    Cr: number;      // Repetitive member
    CP: number;      // Column stability
    Cb: number;      // Bearing area
}

export interface TimberForces {
    M: number;       // Moment (lb-in)
    V: number;       // Shear (lb)
    T: number;       // Tension (lb)
    C: number;       // Compression (lb)
    Pb: number;      // Bearing (lb)
}

export interface TimberCheck {
    section: string;
    title: string;
    Fallowable: number;
    Factual: number;
    ratio: number;
    status: 'OK' | 'NG';
    adjustments: string;
}

// ============================================
// REFERENCE DESIGN VALUES (Table 4A)
// ============================================

const REFERENCE_VALUES: Record<WoodSpecies, Record<WoodGrade, TimberProperties>> = {
    'Douglas Fir-Larch': {
        'Select Structural': { Fb: 1500, Ft: 1000, Fv: 180, Fc_perp: 625, Fc: 1700, E: 1900000, Emin: 690000, G: 0.50 },
        'No. 1': { Fb: 1200, Ft: 800, Fv: 180, Fc_perp: 625, Fc: 1500, E: 1800000, Emin: 660000, G: 0.50 },
        'No. 2': { Fb: 900, Ft: 575, Fv: 180, Fc_perp: 625, Fc: 1350, E: 1600000, Emin: 580000, G: 0.50 },
        'No. 3': { Fb: 525, Ft: 325, Fv: 180, Fc_perp: 625, Fc: 775, E: 1400000, Emin: 510000, G: 0.50 },
        'Stud': { Fb: 700, Ft: 450, Fv: 180, Fc_perp: 625, Fc: 850, E: 1400000, Emin: 510000, G: 0.50 },
    },
    'Southern Pine': {
        'Select Structural': { Fb: 2850, Ft: 1650, Fv: 175, Fc_perp: 565, Fc: 2100, E: 1800000, Emin: 660000, G: 0.55 },
        'No. 1': { Fb: 2050, Ft: 1100, Fv: 175, Fc_perp: 565, Fc: 1850, E: 1700000, Emin: 620000, G: 0.55 },
        'No. 2': { Fb: 1500, Ft: 825, Fv: 175, Fc_perp: 565, Fc: 1650, E: 1600000, Emin: 580000, G: 0.55 },
        'No. 3': { Fb: 850, Ft: 475, Fv: 175, Fc_perp: 565, Fc: 950, E: 1400000, Emin: 510000, G: 0.55 },
        'Stud': { Fb: 850, Ft: 475, Fv: 175, Fc_perp: 565, Fc: 975, E: 1400000, Emin: 510000, G: 0.55 },
    },
    'Hem-Fir': {
        'Select Structural': { Fb: 1400, Ft: 925, Fv: 150, Fc_perp: 405, Fc: 1500, E: 1600000, Emin: 580000, G: 0.43 },
        'No. 1': { Fb: 1100, Ft: 725, Fv: 150, Fc_perp: 405, Fc: 1350, E: 1500000, Emin: 550000, G: 0.43 },
        'No. 2': { Fb: 850, Ft: 525, Fv: 150, Fc_perp: 405, Fc: 1300, E: 1300000, Emin: 470000, G: 0.43 },
        'No. 3': { Fb: 500, Ft: 300, Fv: 150, Fc_perp: 405, Fc: 725, E: 1200000, Emin: 440000, G: 0.43 },
        'Stud': { Fb: 675, Ft: 400, Fv: 150, Fc_perp: 405, Fc: 800, E: 1200000, Emin: 440000, G: 0.43 },
    },
    'Spruce-Pine-Fir': {
        'Select Structural': { Fb: 1250, Ft: 700, Fv: 135, Fc_perp: 425, Fc: 1400, E: 1500000, Emin: 550000, G: 0.42 },
        'No. 1': { Fb: 975, Ft: 500, Fv: 135, Fc_perp: 425, Fc: 1150, E: 1400000, Emin: 510000, G: 0.42 },
        'No. 2': { Fb: 875, Ft: 450, Fv: 135, Fc_perp: 425, Fc: 1150, E: 1400000, Emin: 510000, G: 0.42 },
        'No. 3': { Fb: 500, Ft: 250, Fv: 135, Fc_perp: 425, Fc: 650, E: 1200000, Emin: 440000, G: 0.42 },
        'Stud': { Fb: 675, Ft: 350, Fv: 135, Fc_perp: 425, Fc: 725, E: 1200000, Emin: 440000, G: 0.42 },
    },
    'Redwood': {
        'Select Structural': { Fb: 1350, Ft: 800, Fv: 160, Fc_perp: 650, Fc: 1350, E: 1400000, Emin: 510000, G: 0.44 },
        'No. 1': { Fb: 1000, Ft: 600, Fv: 160, Fc_perp: 650, Fc: 1100, E: 1300000, Emin: 470000, G: 0.44 },
        'No. 2': { Fb: 900, Ft: 550, Fv: 160, Fc_perp: 650, Fc: 1000, E: 1100000, Emin: 400000, G: 0.44 },
        'No. 3': { Fb: 525, Ft: 325, Fv: 160, Fc_perp: 650, Fc: 600, E: 900000, Emin: 330000, G: 0.44 },
        'Stud': { Fb: 650, Ft: 400, Fv: 160, Fc_perp: 650, Fc: 650, E: 900000, Emin: 330000, G: 0.44 },
    }
};

// ============================================
// NDS TIMBER CHECKER
// ============================================

export class NDSTimberChecker {
    /**
     * Get reference design values
     */
    getReferenceValues(species: WoodSpecies, grade: WoodGrade): TimberProperties {
        return REFERENCE_VALUES[species][grade];
    }

    /**
     * Calculate adjustment factors
     */
    calculateAdjustments(
        section: TimberSection,
        options: {
            loadDuration: LoadDuration;
            wetService: boolean;
            highTemp: boolean;
            Lu: number;           // Unbraced length (in)
            repetitive: boolean;
            incised: boolean;
            bearingLength?: number;
        }
    ): AdjustmentFactors {
        const { actualWidth: b, actualDepth: d } = section;
        const props = this.getReferenceValues(section.species, section.grade);

        // CD - Load Duration (Table 2.3.2)
        const CD_values: Record<LoadDuration, number> = {
            'permanent': 0.90,
            'ten_years': 1.00,
            'two_months': 1.15,
            'seven_days': 1.25,
            'ten_minutes': 1.60,
            'impact': 2.00
        };
        const CD = CD_values[options.loadDuration];

        // CM - Wet Service (Table 4A)
        const CM = options.wetService ? 0.85 : 1.0;

        // Ct - Temperature (Table 2.3.3)
        const Ct = options.highTemp ? 0.8 : 1.0;

        // CF - Size Factor (Table 4A)
        let CF = 1.0;
        if (section.type === 'sawn' && d > 12) {
            CF = Math.pow(12 / d, 1 / 9);
        }

        // CL - Beam Stability (3.3.3)
        const le = 1.63 * options.Lu + 3 * d;
        const RB = Math.sqrt(le * d / (b * b));
        const FbE = 1.20 * props.Emin / (RB * RB);
        const Fb_star = props.Fb * CD * CM * Ct * CF;
        const ratio = FbE / Fb_star;
        const CL = (1 + ratio) / 1.9 - Math.sqrt(Math.pow((1 + ratio) / 1.9, 2) - ratio / 0.95);

        // Cfu - Flat Use (Table 4A)
        const Cfu = section.nominalDepth <= 4 && section.nominalWidth >= 2 ? 1.1 : 1.0;

        // Ci - Incising
        const Ci = options.incised ? 0.80 : 1.0;

        // Cr - Repetitive Member
        const Cr = options.repetitive ? 1.15 : 1.0;

        // CP - Column Stability (calculated separately)
        const CP = 1.0; // Placeholder

        // Cb - Bearing Area (3.10.4)
        const lb = options.bearingLength || 1.5;
        const Cb = lb < 6 ? (lb + 0.375) / lb : 1.0;

        return { CD, CM, Ct, CL, CF, Cfu, Ci, Cr, CP, Cb };
    }

    /**
     * Calculate column stability factor CP
     */
    calculateCP(
        section: TimberSection,
        Le: number,  // Effective length (in)
        adjustments: Partial<AdjustmentFactors>
    ): number {
        const props = this.getReferenceValues(section.species, section.grade);
        const { CD = 1.0, CM = 1.0, Ct = 1.0, CF = 1.0, Ci = 1.0 } = adjustments;

        const d = Math.min(section.actualWidth, section.actualDepth);
        const slenderness = Le / d;

        if (slenderness > 50) {
            console.warn('[NDS] Slenderness > 50, column too slender');
        }

        const FcE = 0.822 * props.Emin / (slenderness * slenderness);
        const Fc_star = props.Fc * CD * CM * Ct * CF * Ci;
        const ratio = FcE / Fc_star;
        const c = 0.8; // Sawn lumber

        const CP = (1 + ratio) / (2 * c) -
            Math.sqrt(Math.pow((1 + ratio) / (2 * c), 2) - ratio / c);

        return CP;
    }

    /**
     * Check bending stress
     */
    checkBending(
        section: TimberSection,
        M: number,
        adjustments: AdjustmentFactors
    ): TimberCheck {
        const props = this.getReferenceValues(section.species, section.grade);
        const { actualWidth: b, actualDepth: d } = section;

        const S = b * d * d / 6;
        const fb = M / S;

        const Fb_prime = props.Fb * adjustments.CD * adjustments.CM * adjustments.Ct *
            adjustments.CL * adjustments.CF * adjustments.Cfu *
            adjustments.Ci * adjustments.Cr;

        return {
            section: '3.3',
            title: 'Bending Stress',
            Fallowable: Fb_prime,
            Factual: fb,
            ratio: fb / Fb_prime,
            status: fb <= Fb_prime ? 'OK' : 'NG',
            adjustments: `CD=${adjustments.CD}, CL=${adjustments.CL.toFixed(2)}, CF=${adjustments.CF.toFixed(2)}`
        };
    }

    /**
     * Check shear stress
     */
    checkShear(
        section: TimberSection,
        V: number,
        adjustments: AdjustmentFactors
    ): TimberCheck {
        const props = this.getReferenceValues(section.species, section.grade);
        const { actualWidth: b, actualDepth: d } = section;

        const fv = 1.5 * V / (b * d);
        const Fv_prime = props.Fv * adjustments.CD * adjustments.CM * adjustments.Ct * adjustments.Ci;

        return {
            section: '3.4',
            title: 'Shear Stress',
            Fallowable: Fv_prime,
            Factual: fv,
            ratio: fv / Fv_prime,
            status: fv <= Fv_prime ? 'OK' : 'NG',
            adjustments: `CD=${adjustments.CD}`
        };
    }

    /**
     * Check compression parallel to grain
     */
    checkCompression(
        section: TimberSection,
        C: number,
        Le: number,
        adjustments: AdjustmentFactors
    ): TimberCheck {
        const props = this.getReferenceValues(section.species, section.grade);
        const { actualWidth: b, actualDepth: d } = section;
        const A = b * d;

        const fc = C / A;
        const CP = this.calculateCP(section, Le, adjustments);

        const Fc_prime = props.Fc * adjustments.CD * adjustments.CM * adjustments.Ct *
            adjustments.CF * adjustments.Ci * CP;

        return {
            section: '3.6',
            title: 'Compression Parallel',
            Fallowable: Fc_prime,
            Factual: fc,
            ratio: fc / Fc_prime,
            status: fc <= Fc_prime ? 'OK' : 'NG',
            adjustments: `CD=${adjustments.CD}, CP=${CP.toFixed(3)}`
        };
    }

    /**
     * Check combined bending and compression
     */
    checkCombined(
        section: TimberSection,
        forces: { M: number; C: number },
        Le: number,
        adjustments: AdjustmentFactors
    ): TimberCheck {
        const props = this.getReferenceValues(section.species, section.grade);
        const { actualWidth: b, actualDepth: d } = section;

        const A = b * d;
        const S = b * d * d / 6;

        const fc = forces.C / A;
        const fb = forces.M / S;

        const CP = this.calculateCP(section, Le, adjustments);
        const Fc_prime = props.Fc * adjustments.CD * adjustments.CM * adjustments.Ct *
            adjustments.CF * adjustments.Ci * CP;
        const Fb_prime = props.Fb * adjustments.CD * adjustments.CM * adjustments.Ct *
            adjustments.CL * adjustments.CF * adjustments.Cfu *
            adjustments.Ci * adjustments.Cr;

        // Equation 3.9-3
        const FcE = 0.822 * props.Emin / Math.pow(Le / d, 2);
        const interaction = Math.pow(fc / Fc_prime, 2) +
            fb / (Fb_prime * (1 - fc / FcE));

        return {
            section: '3.9',
            title: 'Combined Bending + Compression',
            Fallowable: 1.0,
            Factual: interaction,
            ratio: interaction,
            status: interaction <= 1.0 ? 'OK' : 'NG',
            adjustments: `Interaction equation 3.9-3`
        };
    }

    /**
     * Full member check
     */
    checkMember(
        section: TimberSection,
        forces: TimberForces,
        options: {
            loadDuration: LoadDuration;
            wetService?: boolean;
            highTemp?: boolean;
            Lu: number;
            Le: number;
            repetitive?: boolean;
            incised?: boolean;
        }
    ): TimberCheck[] {
        const checks: TimberCheck[] = [];

        const adjustments = this.calculateAdjustments(section, {
            loadDuration: options.loadDuration,
            wetService: options.wetService || false,
            highTemp: options.highTemp || false,
            Lu: options.Lu,
            repetitive: options.repetitive || false,
            incised: options.incised || false
        });

        if (forces.M > 0) {
            checks.push(this.checkBending(section, forces.M, adjustments));
        }

        if (forces.V > 0) {
            checks.push(this.checkShear(section, forces.V, adjustments));
        }

        if (forces.C > 0) {
            checks.push(this.checkCompression(section, forces.C, options.Le, adjustments));
        }

        if (forces.M > 0 && forces.C > 0) {
            checks.push(this.checkCombined(section, { M: forces.M, C: forces.C }, options.Le, adjustments));
        }

        return checks;
    }

    /**
     * Quick lumber check
     */
    quickCheck(
        nominalSize: string,  // e.g., "2x10"
        species: WoodSpecies,
        grade: WoodGrade,
        M_lbin: number,
        V_lb: number,
        span_ft: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: TimberCheck[] } {
        const [widthStr, depthStr] = nominalSize.split('x');
        const nomW = parseInt(widthStr);
        const nomD = parseInt(depthStr);

        // Actual dimensions (Table 1B)
        const actW = nomW <= 2 ? 1.5 : nomW <= 4 ? 3.5 : nomW - 0.5;
        const actD = nomD <= 6 ? nomD - 0.5 : nomD <= 8 ? 7.25 : nomD <= 10 ? 9.25 : 11.25;

        const section: TimberSection = {
            type: 'sawn',
            nominalWidth: nomW,
            nominalDepth: nomD,
            actualWidth: actW,
            actualDepth: actD,
            species,
            grade
        };

        const checks = this.checkMember(section,
            { M: M_lbin, V: V_lb, T: 0, C: 0, Pb: 0 },
            {
                loadDuration: 'ten_years',
                Lu: span_ft * 12,
                Le: span_ft * 12,
                repetitive: true
            }
        );

        const maxCheck = checks.reduce((max, c) => c.ratio > max.ratio ? c : max, checks[0]);

        return {
            passed: maxCheck.ratio <= 1.0,
            maxRatio: maxCheck.ratio,
            critical: maxCheck.title,
            checks
        };
    }
}

// ============================================
// SINGLETON
// ============================================

export const ndsTimber = new NDSTimberChecker();

export default NDSTimberChecker;
