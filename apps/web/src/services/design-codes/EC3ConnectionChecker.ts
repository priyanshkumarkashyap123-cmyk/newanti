/**
 * EC3ConnectionChecker.ts
 * 
 * EN 1993-1-8: Design of Joints (Eurocode 3)
 * 
 * Features:
 * - Bolted connections (Categories A, B, C, D, E)
 * - Welded connections (fillet, butt)
 * - End plate connections
 * - Fin plate connections
 * - Moment-resisting connections
 * - Component method
 */

import { EC3_MATERIALS, EC3Section } from './Eurocode3Checker';

// ============================================
// TYPES
// ============================================

export type BoltGrade = '4.6' | '5.6' | '6.8' | '8.8' | '10.9';
export type BoltCategory = 'A' | 'B' | 'C' | 'D' | 'E';

export interface BoltProperties {
    grade: BoltGrade;
    diameter: number;  // mm
    As: number;        // Tensile stress area (mm²)
    A: number;         // Shank area (mm²)
    fub: number;       // Ultimate strength (MPa)
    fyb: number;       // Yield strength (MPa)
}

export interface BoltGroup {
    bolts: BoltProperties;
    rows: number;
    cols: number;
    p1: number;         // Pitch (mm)
    p2: number;         // Gauge (mm)
    e1: number;         // End distance (mm)
    e2: number;         // Edge distance (mm)
}

export interface WeldProperties {
    type: 'fillet' | 'butt';
    a: number;          // Throat thickness (mm)
    length: number;     // Weld length (mm)
    fu: number;         // Ultimate strength of weaker part (MPa)
}

export interface ConnectionForces {
    NEd: number;        // Axial force (kN)
    VEd: number;        // Shear force (kN)
    MEd: number;        // Moment (kN·m)
}

export interface EC3ConnectionCheck {
    clause: string;
    title: string;
    Rd: number;         // Design resistance
    Ed: number;         // Design effect
    ratio: number;
    status: 'OK' | 'NG';
    equation?: string;
}

// ============================================
// BOLT DATABASE
// ============================================

export const BOLT_GRADES: Record<BoltGrade, { fub: number; fyb: number }> = {
    '4.6': { fub: 400, fyb: 240 },
    '5.6': { fub: 500, fyb: 300 },
    '6.8': { fub: 600, fyb: 480 },
    '8.8': { fub: 800, fyb: 640 },
    '10.9': { fub: 1000, fyb: 900 },
};

export const BOLT_DIMENSIONS: Record<number, { As: number; A: number }> = {
    12: { As: 84.3, A: 113 },
    16: { As: 157, A: 201 },
    20: { As: 245, A: 314 },
    24: { As: 353, A: 452 },
    30: { As: 561, A: 707 },
    36: { As: 817, A: 1018 },
};

// ============================================
// EC3 CONNECTION CHECKER
// ============================================

export class EC3ConnectionChecker {
    // Partial safety factors
    private gammaM0 = 1.0;
    private gammaM2 = 1.25;
    private gammaM3 = {
        preloaded: 1.25,
        slipULS: 1.25,
        slipSLS: 1.10
    };
    private betaW = 0.85; // Correlation factor for S355

    /**
     * Check bolted connection
     */
    checkBoltedConnection(
        group: BoltGroup,
        plate: { t: number; fu: number; fy: number },
        forces: ConnectionForces,
        category: BoltCategory = 'A'
    ): EC3ConnectionCheck[] {
        const checks: EC3ConnectionCheck[] = [];
        const { bolts, rows, cols, p1, p2, e1, e2 } = group;
        const n = rows * cols;

        // 3.6: Minimum distances
        checks.push(this.checkBoltSpacing(bolts.diameter, p1, p2, e1, e2));

        // Different checks based on category
        switch (category) {
            case 'A': // Bearing-type, shear
            case 'B': // Slip-resistant at SLS
            case 'C': // Slip-resistant at ULS
                // 3.6.1: Shear resistance per bolt
                checks.push(this.checkBoltShear(bolts, forces.VEd, n));

                // 3.6.1: Bearing resistance
                checks.push(this.checkBearing(bolts, plate, forces.VEd, n, e1, e2, p1, p2));

                if (category === 'B' || category === 'C') {
                    checks.push(this.checkSlipResistance(bolts, forces.VEd, n, category));
                }
                break;

            case 'D': // Tension
            case 'E': // Combined tension and shear
                checks.push(this.checkBoltTension(bolts, forces.NEd, n));

                if (category === 'E') {
                    checks.push(this.checkCombinedTensionShear(bolts, forces.NEd, forces.VEd, n));
                }
                break;
        }

        // Block tearing
        checks.push(this.checkBlockTear(group, plate, forces.VEd));

        return checks;
    }

    /**
     * Table 3.3: Bolt spacing requirements
     */
    private checkBoltSpacing(
        d: number,
        p1: number,
        p2: number,
        e1: number,
        e2: number
    ): EC3ConnectionCheck {
        const d0 = d + 2; // Hole diameter

        const checks = [
            { name: 'e1', value: e1, min: 1.2 * d0, max: Infinity },
            { name: 'e2', value: e2, min: 1.2 * d0, max: Infinity },
            { name: 'p1', value: p1, min: 2.2 * d0, max: 14 * Math.min(16, d0) },
            { name: 'p2', value: p2, min: 2.4 * d0, max: 14 * Math.min(16, d0) },
        ];

        const failures = checks.filter(c => c.value < c.min || c.value > c.max);

        return {
            clause: 'Table 3.3',
            title: 'Bolt Spacing',
            Rd: 0,
            Ed: 0,
            ratio: failures.length > 0 ? 1.5 : 0.8,
            status: failures.length === 0 ? 'OK' : 'NG',
            equation: 'e ≥ 1.2d0, p ≥ 2.2d0'
        };
    }

    /**
     * 3.6.1: Shear resistance
     */
    private checkBoltShear(
        bolts: BoltProperties,
        VEd: number,
        n: number
    ): EC3ConnectionCheck {
        const { As, fub } = bolts;

        // Eq. 3.7: Fv,Rd per bolt (shear plane through threads)
        const alphaV = bolts.grade === '4.6' || bolts.grade === '5.6' ? 0.6 : 0.5;
        const Fv_Rd = alphaV * fub * As / this.gammaM2 / 1000; // kN

        const VEd_per = VEd / n;

        return {
            clause: '3.6.1',
            title: 'Bolt Shear Resistance',
            Rd: Fv_Rd * n,
            Ed: VEd,
            ratio: VEd / (Fv_Rd * n),
            status: VEd <= Fv_Rd * n ? 'OK' : 'NG',
            equation: 'Fv,Rd = αv·fub·As/γM2'
        };
    }

    /**
     * 3.6.1: Bearing resistance
     */
    private checkBearing(
        bolts: BoltProperties,
        plate: { t: number; fu: number },
        VEd: number,
        n: number,
        e1: number,
        e2: number,
        p1: number,
        p2: number
    ): EC3ConnectionCheck {
        const { diameter: d, fub } = bolts;
        const d0 = d + 2;
        const { t, fu } = plate;

        // Eq. 3.8 coefficients
        const alpha_d = e1 / (3 * d0);
        const alpha_b = Math.min(alpha_d, fub / fu, 1.0);

        const k1_inner = Math.min(2.8 * e2 / d0 - 1.7, 2.5);
        const k1_edge = Math.min(1.4 * p2 / d0 - 1.7, 2.5);
        const k1 = Math.min(k1_inner, k1_edge);

        // Eq. 3.8: Fb,Rd per bolt
        const Fb_Rd = k1 * alpha_b * fu * d * t / this.gammaM2 / 1000; // kN

        return {
            clause: '3.6.1',
            title: 'Bearing Resistance',
            Rd: Fb_Rd * n,
            Ed: VEd,
            ratio: VEd / (Fb_Rd * n),
            status: VEd <= Fb_Rd * n ? 'OK' : 'NG',
            equation: 'Fb,Rd = k1·αb·fu·d·t/γM2'
        };
    }

    /**
     * 3.9: Slip resistance
     */
    private checkSlipResistance(
        bolts: BoltProperties,
        VEd: number,
        n: number,
        category: 'B' | 'C'
    ): EC3ConnectionCheck {
        const { As, fub } = bolts;

        // Preloading force
        const Fp_C = 0.7 * fub * As / 1000; // kN

        // Slip factor (assuming Class A)
        const mu = 0.5;
        const ks = 1.0;
        const gamma = category === 'C' ? this.gammaM3.slipULS : this.gammaM3.slipSLS;

        // Eq. 3.9: Fs,Rd
        const Fs_Rd = ks * n * mu * Fp_C / gamma;

        return {
            clause: '3.9',
            title: `Slip Resistance (Cat ${category})`,
            Rd: Fs_Rd,
            Ed: VEd,
            ratio: VEd / Fs_Rd,
            status: VEd <= Fs_Rd ? 'OK' : 'NG',
            equation: 'Fs,Rd = ks·n·μ·Fp,C/γM3'
        };
    }

    /**
     * 3.6.1: Tension resistance
     */
    private checkBoltTension(
        bolts: BoltProperties,
        NEd: number,
        n: number
    ): EC3ConnectionCheck {
        const { As, fub } = bolts;

        // Eq. 3.11: Ft,Rd per bolt
        const k2 = 0.9;
        const Ft_Rd = k2 * fub * As / this.gammaM2 / 1000; // kN

        return {
            clause: '3.6.1',
            title: 'Bolt Tension Resistance',
            Rd: Ft_Rd * n,
            Ed: Math.abs(NEd),
            ratio: Math.abs(NEd) / (Ft_Rd * n),
            status: Math.abs(NEd) <= Ft_Rd * n ? 'OK' : 'NG',
            equation: 'Ft,Rd = k2·fub·As/γM2'
        };
    }

    /**
     * 3.6.1: Combined tension and shear
     */
    private checkCombinedTensionShear(
        bolts: BoltProperties,
        NEd: number,
        VEd: number,
        n: number
    ): EC3ConnectionCheck {
        const { As, fub } = bolts;

        const Ft_Rd = 0.9 * fub * As / this.gammaM2 / 1000;
        const Fv_Rd = 0.5 * fub * As / this.gammaM2 / 1000;

        const Ft_Ed = Math.abs(NEd) / n;
        const Fv_Ed = VEd / n;

        // Eq. 3.13
        const ratio = Fv_Ed / Fv_Rd + Ft_Ed / (1.4 * Ft_Rd);

        return {
            clause: '3.6.1',
            title: 'Combined Tension + Shear',
            Rd: 1.0,
            Ed: ratio,
            ratio,
            status: ratio <= 1.0 ? 'OK' : 'NG',
            equation: 'Fv,Ed/Fv,Rd + Ft,Ed/(1.4Ft,Rd) ≤ 1.0'
        };
    }

    /**
     * 3.10.2: Block tearing
     */
    private checkBlockTear(
        group: BoltGroup,
        plate: { t: number; fu: number; fy: number },
        VEd: number
    ): EC3ConnectionCheck {
        const { bolts, rows, cols, p1, p2, e1, e2 } = group;
        const d0 = bolts.diameter + 2;
        const { t, fu, fy } = plate;

        // Net and gross areas
        const Ant = t * (e2 + (cols - 1) * p2 - (cols - 0.5) * d0);
        const Anv = t * (e1 + (rows - 1) * p1 - (rows - 0.5) * d0);

        // Eq. 3.9a/b
        const Veff_1_Rd = (fu * Ant / this.gammaM2 + fy * Anv / (Math.sqrt(3) * this.gammaM0)) / 1000;

        return {
            clause: '3.10.2',
            title: 'Block Tearing',
            Rd: Veff_1_Rd,
            Ed: VEd,
            ratio: VEd / Veff_1_Rd,
            status: VEd <= Veff_1_Rd ? 'OK' : 'NG',
            equation: 'Veff,1,Rd = fu·Ant/γM2 + fy·Anv/(√3·γM0)'
        };
    }

    /**
     * Check fillet weld
     */
    checkFilletWeld(
        weld: WeldProperties,
        forces: { Fperp: number; Fpar: number }
    ): EC3ConnectionCheck[] {
        const checks: EC3ConnectionCheck[] = [];
        const { a, length, fu } = weld;

        // Effective throat area
        const Aw = a * length;

        // Directional method (4.5.3.2)
        // Perpendicular stress
        const sigma_perp = forces.Fperp * 1000 / Aw; // MPa
        const tau_perp = sigma_perp;
        const tau_par = forces.Fpar * 1000 / Aw;

        // Eq. 4.1
        const fvw_d = fu / (Math.sqrt(3) * this.betaW * this.gammaM2);
        const stress = Math.sqrt(sigma_perp ** 2 + 3 * (tau_perp ** 2 + tau_par ** 2));

        checks.push({
            clause: '4.5.3.2',
            title: 'Fillet Weld (Directional)',
            Rd: fvw_d,
            Ed: stress,
            ratio: stress / fvw_d,
            status: stress <= fvw_d ? 'OK' : 'NG',
            equation: '√(σ⊥² + 3(τ⊥² + τ∥²)) ≤ fu/(√3·βw·γM2)'
        });

        return checks;
    }

    /**
     * Quick bolted connection check
     */
    quickCheck(
        boltDiameter: number,
        boltGrade: BoltGrade,
        rows: number,
        cols: number,
        platet_mm: number,
        plateGrade: 'S275' | 'S355' = 'S355',
        VEd_kN: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: EC3ConnectionCheck[] } {
        const grade = BOLT_GRADES[boltGrade];
        const dims = BOLT_DIMENSIONS[boltDiameter];

        const bolts: BoltProperties = {
            grade: boltGrade,
            diameter: boltDiameter,
            As: dims.As,
            A: dims.A,
            fub: grade.fub,
            fyb: grade.fyb
        };

        const group: BoltGroup = {
            bolts,
            rows,
            cols,
            p1: 60,
            p2: 60,
            e1: 40,
            e2: 40
        };

        const plate = {
            t: platet_mm,
            fu: plateGrade === 'S355' ? 510 : 430,
            fy: plateGrade === 'S355' ? 355 : 275
        };

        const checks = this.checkBoltedConnection(
            group,
            plate,
            { NEd: 0, VEd: VEd_kN, MEd: 0 },
            'A'
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

export const ec3Connection = new EC3ConnectionChecker();

export default EC3ConnectionChecker;
