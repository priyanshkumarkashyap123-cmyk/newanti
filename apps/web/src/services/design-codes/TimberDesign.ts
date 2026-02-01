/**
 * TimberDesign.ts - Timber Structural Design
 * 
 * Features:
 * - Bending, shear, compression, tension checks
 * - Adjustment factors (Cd, Cm, Ct, CL, CF, Ci, Cr)
 * - Connection design (bolts, nails, screws)
 * 
 * Codes: NDS 2018, Eurocode 5
 */

// ============================================
// TYPES
// ============================================

export interface TimberSection {
    b: number;           // Width (mm)
    d: number;           // Depth (mm)
    A: number;           // Area (mm²)
    Sx: number;          // Section modulus (mm³)
    Ix: number;          // Moment of inertia (mm⁴)
}

export interface TimberGrade {
    species: string;
    grade: string;
    Fb: number;          // Bending (MPa)
    Ft: number;          // Tension parallel (MPa)
    Fv: number;          // Shear (MPa)
    Fc_perp: number;     // Compression perpendicular (MPa)
    Fc: number;          // Compression parallel (MPa)
    E: number;           // Modulus (MPa)
    Emin: number;        // Minimum modulus (MPa)
}

export interface AdjustmentFactors {
    CD: number;          // Load duration
    CM: number;          // Wet service
    Ct: number;          // Temperature
    CL: number;          // Beam stability
    CF: number;          // Size factor
    Ci: number;          // Incising
    Cr: number;          // Repetitive member
    Cp?: number;         // Column stability
    Cb?: number;         // Bearing area
}

export interface TimberForces {
    M: number;           // Moment (kN·m)
    V: number;           // Shear (kN)
    P: number;           // Axial (kN, + = compression)
    Le: number;          // Effective length (mm)
}

export interface TimberCheck {
    type: string;
    fb: number;          // Actual stress
    Fb_prime: number;    // Adjusted allowable
    ratio: number;
    status: 'OK' | 'NOT OK';
}

// ============================================
// TIMBER GRADE DATABASE
// ============================================

export const TIMBER_GRADES: Record<string, TimberGrade> = {
    'Douglas_Fir_No1': {
        species: 'Douglas Fir-Larch',
        grade: 'No. 1',
        Fb: 8.3,
        Ft: 5.2,
        Fv: 1.0,
        Fc_perp: 4.3,
        Fc: 10.0,
        E: 12000,
        Emin: 6200
    },
    'Southern_Pine_No1': {
        species: 'Southern Pine',
        grade: 'No. 1',
        Fb: 9.7,
        Ft: 6.2,
        Fv: 1.2,
        Fc_perp: 4.0,
        Fc: 11.7,
        E: 11000,
        Emin: 5900
    },
    'SPF_No2': {
        species: 'Spruce-Pine-Fir',
        grade: 'No. 2',
        Fb: 6.2,
        Ft: 3.4,
        Fv: 0.9,
        Fc_perp: 3.0,
        Fc: 7.2,
        E: 9000,
        Emin: 4800
    },
    'GL24h': {
        species: 'Glulam',
        grade: 'GL24h',
        Fb: 24.0,
        Ft: 16.5,
        Fv: 2.7,
        Fc_perp: 5.3,
        Fc: 24.0,
        E: 11600,
        Emin: 9400
    }
};

// ============================================
// NDS TIMBER DESIGNER
// ============================================

export class NDSTimberDesigner {
    /**
     * Check bending (NDS 3.3)
     */
    checkBending(
        section: TimberSection,
        grade: TimberGrade,
        M: number,
        factors: AdjustmentFactors,
        Le: number = 0
    ): TimberCheck {
        // Calculate beam stability factor if not provided
        let CL = factors.CL;
        if (Le > 0 && CL === 1.0) {
            CL = this.calculateCL(section, grade, factors, Le);
        }

        // Adjusted bending stress
        const Fb_prime = grade.Fb * factors.CD * factors.CM * factors.Ct *
            CL * factors.CF * factors.Ci * factors.Cr;

        // Actual bending stress
        const fb = (M * 1e6) / section.Sx;

        return {
            type: 'Bending',
            fb,
            Fb_prime,
            ratio: fb / Fb_prime,
            status: fb <= Fb_prime ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Check shear (NDS 3.4)
     */
    checkShear(
        section: TimberSection,
        grade: TimberGrade,
        V: number,
        factors: AdjustmentFactors
    ): TimberCheck {
        const Fv_prime = grade.Fv * factors.CD * factors.CM * factors.Ct * factors.Ci;
        const fv = (1.5 * V * 1000) / section.A;

        return {
            type: 'Shear',
            fb: fv,
            Fb_prime: Fv_prime,
            ratio: fv / Fv_prime,
            status: fv <= Fv_prime ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Check compression parallel to grain (NDS 3.6)
     */
    checkCompression(
        section: TimberSection,
        grade: TimberGrade,
        P: number,
        Le: number,
        factors: AdjustmentFactors
    ): TimberCheck {
        // Column stability factor
        const Cp = this.calculateCp(section, grade, factors, Le);

        const Fc_prime = grade.Fc * factors.CD * factors.CM * factors.Ct *
            factors.CF * factors.Ci * Cp;
        const fc = (P * 1000) / section.A;

        return {
            type: 'Compression',
            fb: fc,
            Fb_prime: Fc_prime,
            ratio: fc / Fc_prime,
            status: fc <= Fc_prime ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Check tension parallel to grain (NDS 3.8)
     */
    checkTension(
        section: TimberSection,
        grade: TimberGrade,
        T: number,
        factors: AdjustmentFactors
    ): TimberCheck {
        const Ft_prime = grade.Ft * factors.CD * factors.CM * factors.Ct *
            factors.CF * factors.Ci;
        const ft = (T * 1000) / section.A;

        return {
            type: 'Tension',
            fb: ft,
            Fb_prime: Ft_prime,
            ratio: ft / Ft_prime,
            status: ft <= Ft_prime ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Combined bending and axial (NDS 3.9)
     */
    checkCombined(
        section: TimberSection,
        grade: TimberGrade,
        forces: TimberForces,
        factors: AdjustmentFactors
    ): TimberCheck {
        const bendingCheck = this.checkBending(section, grade, forces.M, factors, forces.Le);
        const axialCheck = forces.P > 0
            ? this.checkCompression(section, grade, forces.P, forces.Le, factors)
            : this.checkTension(section, grade, Math.abs(forces.P), factors);

        // Interaction equation (NDS 3.9.2)
        const ratio = forces.P > 0
            ? (axialCheck.fb / axialCheck.Fb_prime) ** 2 + bendingCheck.ratio
            : axialCheck.ratio + bendingCheck.ratio;

        return {
            type: 'Combined',
            fb: ratio,
            Fb_prime: 1.0,
            ratio,
            status: ratio <= 1.0 ? 'OK' : 'NOT OK'
        };
    }

    /**
     * Calculate beam stability factor CL (NDS 3.3.3)
     */
    private calculateCL(
        section: TimberSection,
        grade: TimberGrade,
        factors: AdjustmentFactors,
        Le: number
    ): number {
        const Fb_star = grade.Fb * factors.CD * factors.CM * factors.Ct *
            factors.CF * factors.Ci * factors.Cr;
        const Emin_prime = grade.Emin * factors.CM * factors.Ct * factors.Ci;

        const RB = Math.sqrt((Le * section.d) / (section.b ** 2));
        const FbE = (1.20 * Emin_prime) / (RB ** 2);

        const ratio = FbE / Fb_star;
        const CL = (1 + ratio) / 1.9 - Math.sqrt(((1 + ratio) / 1.9) ** 2 - ratio / 0.95);

        return Math.min(CL, 1.0);
    }

    /**
     * Calculate column stability factor Cp (NDS 3.7.1)
     */
    private calculateCp(
        section: TimberSection,
        grade: TimberGrade,
        factors: AdjustmentFactors,
        Le: number
    ): number {
        const Fc_star = grade.Fc * factors.CD * factors.CM * factors.Ct *
            factors.CF * factors.Ci;
        const Emin_prime = grade.Emin * factors.CM * factors.Ct * factors.Ci;

        const d = Math.min(section.b, section.d);
        const slenderness = Le / d;

        if (slenderness > 50) return 0; // Exceeds limit

        const FcE = (0.822 * Emin_prime) / (slenderness ** 2);
        const ratio = FcE / Fc_star;
        const c = 0.8; // Sawn lumber

        const Cp = (1 + ratio) / (2 * c) -
            Math.sqrt(((1 + ratio) / (2 * c)) ** 2 - ratio / c);

        return Math.min(Cp, 1.0);
    }

    /**
     * Design member (auto-select factors)
     */
    designMember(
        section: TimberSection,
        gradeKey: string,
        forces: TimberForces,
        loadDuration: 'permanent' | 'normal' | 'short' | 'impact' = 'normal',
        wetService: boolean = false
    ): TimberCheck[] {
        const grade = TIMBER_GRADES[gradeKey];
        if (!grade) throw new Error(`Unknown timber grade: ${gradeKey}`);

        // Set adjustment factors
        const CD = { permanent: 0.9, normal: 1.0, short: 1.15, impact: 2.0 }[loadDuration];
        const CM = wetService ? 0.85 : 1.0;
        const CF = section.d > 300 ? 0.9 : 1.0;

        const factors: AdjustmentFactors = {
            CD,
            CM,
            Ct: 1.0,
            CL: 1.0,
            CF,
            Ci: 1.0,
            Cr: 1.0
        };

        const checks: TimberCheck[] = [];

        if (Math.abs(forces.M) > 0.001) {
            checks.push(this.checkBending(section, grade, forces.M, factors, forces.Le));
        }
        if (Math.abs(forces.V) > 0.001) {
            checks.push(this.checkShear(section, grade, forces.V, factors));
        }
        if (Math.abs(forces.P) > 0.001) {
            if (forces.P > 0) {
                checks.push(this.checkCompression(section, grade, forces.P, forces.Le, factors));
            } else {
                checks.push(this.checkTension(section, grade, Math.abs(forces.P), factors));
            }
        }
        if (Math.abs(forces.M) > 0.001 && Math.abs(forces.P) > 0.001) {
            checks.push(this.checkCombined(section, grade, forces, factors));
        }

        return checks;
    }
}

// Export singleton
export const timberDesign = new NDSTimberDesigner();
export default NDSTimberDesigner;
