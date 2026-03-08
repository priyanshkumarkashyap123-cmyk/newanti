import { colors } from '@/styles/theme';
/**
 * IS800_SteelDesignEngine - IS 800:2007 Steel Design Checks
 * Comprehensive member design verification as per Indian Standards
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface IS_SteelSection {
    name: string;
    type: 'ISMB' | 'ISHB' | 'ISLB' | 'ISJB' | 'ISMC' | 'ISLC' | 'ISA' | 'Pipe' | 'Box';
    A: number;      // Area (mm²)
    Ix: number;     // Moment of inertia about x-axis (mm⁴)
    Iy: number;     // Moment of inertia about y-axis (mm⁴)
    Zex: number;    // Elastic section modulus about x (mm³)
    Zey: number;    // Elastic section modulus about y (mm³)
    Zpx: number;    // Plastic section modulus about x (mm³)
    Zpy: number;    // Plastic section modulus about y (mm³)
    rx: number;     // Radius of gyration about x (mm)
    ry: number;     // Radius of gyration about y (mm)
    D: number;      // Depth (mm)
    B: number;      // Width (mm)
    tf: number;     // Flange thickness (mm)
    tw: number;     // Web thickness (mm)
}

export interface IS_SteelMaterial {
    name: string;
    fy: number;     // Yield strength (MPa)
    fu: number;     // Ultimate tensile strength (MPa)
    E: number;      // Modulus of elasticity (MPa) - typically 200000
}

export interface IS_MemberForces {
    N: number;      // Axial force (kN) - + tension, - compression
    Mx: number;     // Moment about x-axis (kN·m)
    My: number;     // Moment about y-axis (kN·m)
    Vx: number;     // Shear in x-direction (kN)
    Vy: number;     // Shear in y-direction (kN)
}

export interface IS_MemberProperties {
    L: number;      // Length (mm)
    Kx: number;     // Effective length factor about x
    Ky: number;     // Effective length factor about y
    Lb: number;     // Laterally unsupported length (mm)
}

export interface IS_DesignResult {
    passed: boolean;
    utilizationRatio: number;
    governingCheck: string;
    clause: string;
    checks: {
        tension?: IS_TensionCheck;
        compression?: IS_CompressionCheck;
        flexure?: IS_FlexureCheck;
        shear?: IS_ShearCheck;
        interaction?: IS_InteractionCheck;
    };
}

interface IS_TensionCheck {
    Td: number;         // Design tensile strength (kN)
    Tdg: number;        // Yielding capacity
    Tdn: number;        // Rupture capacity
    ratio: number;
    governing: 'yielding' | 'rupture' | 'block_shear';
}

interface IS_CompressionCheck {
    Pd: number;         // Design compressive strength (kN)
    fcd: number;        // Design compressive stress (MPa)
    lambda: number;     // Non-dimensional slenderness
    chi: number;        // Stress reduction factor
    KLr_x: number;
    KLr_y: number;
    ratio: number;
    bucklingClass: string;
}

interface IS_FlexureCheck {
    Md_x: number;       // Design moment capacity about x (kN·m)
    Md_y: number;       // Design moment capacity about y (kN·m)
    ratio_x: number;
    ratio_y: number;
    zone: 'plastic' | 'inelastic' | 'elastic';
}

interface IS_ShearCheck {
    Vd_x: number;
    Vd_y: number;
    ratio_x: number;
    ratio_y: number;
}

interface IS_InteractionCheck {
    ratio: number;
    equation: string;
    N_Nd: number;
    Mx_Mdx: number;
    My_Mdy: number;
}

// ============================================
// IS 800:2007 STEEL DESIGN ENGINE
// ============================================

export class IS800_SteelDesignEngine {
    // Partial safety factors as per IS 800:2007
    static readonly γm0 = 1.10;     // For yielding (Clause 5.4.1)
    static readonly γm1 = 1.25;     // For ultimate stress
    static readonly γmw = 1.25;     // For welds
    static readonly γmb = 1.25;     // For bolts

    /**
     * Main function: Check member design as per IS 800:2007
     */
    static checkMember(
        forces: IS_MemberForces,
        section: IS_SteelSection,
        material: IS_SteelMaterial,
        props: IS_MemberProperties
    ): IS_DesignResult {
        const checks: IS_DesignResult['checks'] = {};
        let maxRatio = 0;
        let governingCheck = '';
        let clause = '';

        const isTension = forces.N > 0;
        const isCompression = forces.N < 0;
        const hasMoment = Math.abs(forces.Mx) > 0.001 || Math.abs(forces.My) > 0.001;
        const hasShear = Math.abs(forces.Vx) > 0.001 || Math.abs(forces.Vy) > 0.001;

        // Clause 6: Tension Members
        if (isTension) {
            checks.tension = this.checkTension(forces.N, section, material);
            if (checks.tension.ratio > maxRatio) {
                maxRatio = checks.tension.ratio;
                governingCheck = `Tension: N/(Td) = ${checks.tension.ratio.toFixed(3)}`;
                clause = 'IS 800 Clause 6.2';
            }
        }

        // Clause 7: Compression Members
        if (isCompression) {
            checks.compression = this.checkCompression(
                Math.abs(forces.N), section, material, props
            );
            if (checks.compression.ratio > maxRatio) {
                maxRatio = checks.compression.ratio;
                governingCheck = `Compression: N/(Pd) = ${checks.compression.ratio.toFixed(3)}`;
                clause = 'IS 800 Clause 7.1.2';
            }
        }

        // Clause 8: Flexure (always check for combined interaction)
        {
            checks.flexure = this.checkFlexure(forces.Mx, forces.My, section, material, props);
            const flexureMax = Math.max(checks.flexure.ratio_x, checks.flexure.ratio_y);
            if (hasMoment && flexureMax > maxRatio) {
                maxRatio = flexureMax;
                governingCheck = `Flexure: M/(Md) = ${flexureMax.toFixed(3)}`;
                clause = 'IS 800 Clause 8.2.1';
            }
        }

        // Clause 8.4: Shear
        if (hasShear) {
            checks.shear = this.checkShear(forces.Vx, forces.Vy, section, material);
            const shearMax = Math.max(checks.shear.ratio_x, checks.shear.ratio_y);
            if (shearMax > maxRatio) {
                maxRatio = shearMax;
                governingCheck = `Shear: V/(Vd) = ${shearMax.toFixed(3)}`;
                clause = 'IS 800 Clause 8.4';
            }
        }

        // Clause 9: Combined Forces
        if ((isTension || isCompression) && hasMoment) {
            checks.interaction = this.checkInteraction(
                forces,
                checks.tension,
                checks.compression,
                checks.flexure!
            );
            if (checks.interaction.ratio > maxRatio) {
                maxRatio = checks.interaction.ratio;
                governingCheck = `Combined: ${checks.interaction.equation} = ${checks.interaction.ratio.toFixed(3)}`;
                clause = 'IS 800 Clause 9.3.1';
            }
        }

        return {
            passed: maxRatio <= 1.0,
            utilizationRatio: maxRatio,
            governingCheck,
            clause,
            checks
        };
    }

    // ============================================
    // CLAUSE 6: TENSION MEMBERS
    // ============================================

    /**
     * Tension capacity per IS 800 Clause 6
     * Td = min(Tdg, Tdn, Tdb) / γm0
     */
    static checkTension(N: number, section: IS_SteelSection, material: IS_SteelMaterial): IS_TensionCheck {
        // 6.2: Design strength governed by yielding of gross section
        const Ag = section.A;
        const Tdg = (section.A * material.fy) / (this.γm0 * 1000);  // kN

        // 6.3: Design strength governed by rupture of critical section
        const An = 0.85 * Ag;  // Assume 85% net area
        const Tdn = (0.9 * An * material.fu) / (this.γm1 * 1000);  // kN

        const Td = Math.min(Tdg, Tdn);
        const ratio = N / Td;

        return {
            Td,
            Tdg,
            Tdn,
            ratio,
            governing: Tdg <= Tdn ? 'yielding' : 'rupture'
        };
    }

    // ============================================
    // CLAUSE 7: COMPRESSION MEMBERS
    // ============================================

    /**
     * Compression capacity per IS 800 Clause 7.1.2
     * Pd = Ae * fcd
     */
    static checkCompression(
        N: number,
        section: IS_SteelSection,
        material: IS_SteelMaterial,
        props: IS_MemberProperties
    ): IS_CompressionCheck {
        // Slenderness ratios
        const KLr_x = (props.Kx * props.L) / section.rx;
        const KLr_y = (props.Ky * props.L) / section.ry;
        const KLr_max = Math.max(KLr_x, KLr_y);

        // Euler buckling stress
        const fcc = (Math.PI * Math.PI * material.E) / (KLr_max * KLr_max);

        // Non-dimensional slenderness ratio (Clause 7.1.2.1)
        const lambda = Math.sqrt(material.fy / fcc);

        // Buckling class and imperfection factor (Table 10)
        const bucklingClass = this.getBucklingClass(section, KLr_x >= KLr_y ? 'x' : 'y');
        const alpha = this.getImperfectionFactor(bucklingClass);

        // Stress reduction factor χ (Clause 7.1.2.1)
        const phi = 0.5 * (1 + alpha * (lambda - 0.2) + lambda * lambda);
        const chi = 1 / (phi + Math.sqrt(phi * phi - lambda * lambda));

        // Design compressive stress (Clause 7.1.2.1)
        const fcd = (chi * material.fy) / this.γm0;

        // Design compressive strength
        const Pd = (section.A * fcd) / 1000;  // kN

        const ratio = N / Pd;

        return {
            Pd,
            fcd,
            lambda,
            chi,
            KLr_x,
            KLr_y,
            ratio,
            bucklingClass
        };
    }

    /**
     * Get buckling class per IS 800 Table 10
     */
    static getBucklingClass(section: IS_SteelSection, axis: 'x' | 'y'): string {
        const hb = section.D / section.B;

        if (section.type === 'ISMB' || section.type === 'ISHB') {
            if (axis === 'x') {
                return hb <= 1.2 ? 'a' : 'b';
            } else {
                return hb <= 1.2 ? 'b' : 'c';
            }
        }

        // Default for other sections
        return 'c';
    }

    /**
     * Imperfection factor α per IS 800 Table 7
     */
    static getImperfectionFactor(bucklingClass: string): number {
        const factors: Record<string, number> = {
            'a': 0.21,
            'b': 0.34,
            'c': 0.49,
            'd': 0.76
        };
        return factors[bucklingClass] ?? 0.49;
    }

    // ============================================
    // CLAUSE 8: FLEXURE (BENDING)
    // ============================================

    /**
     * Flexural capacity per IS 800 Clause 8.2.1
     * Md = βb * Zp * fy / γm0
     */
    static checkFlexure(
        Mx: number,
        My: number,
        section: IS_SteelSection,
        material: IS_SteelMaterial,
        props: IS_MemberProperties
    ): IS_FlexureCheck {
        const fy = material.fy;
        const E = material.E;

        // Plastic moment capacity (8.2.1.2)
        const βb = 1.0;  // For Class 1 and 2 sections
        const Md_plastic_x = (βb * section.Zpx * fy) / (this.γm0 * 1e6);  // kN·m
        const Md_plastic_y = (βb * section.Zpy * fy) / (this.γm0 * 1e6);  // kN·m

        // Check for Lateral-Torsional Buckling (8.2.2)
        const Lb = props.Lb;

        // Critical moment for LTB (simplified)
        const ry_eff = section.ry;
        const hf = section.D - section.tf;

        // Limiting lengths (approximate)
        const Lp = 1.76 * ry_eff * Math.sqrt(E / fy);
        const Lr = Lp * 3;  // Simplified

        let Md_x: number;
        let zone: 'plastic' | 'inelastic' | 'elastic';

        if (Lb <= Lp) {
            // Plastic zone - no LTB
            Md_x = Md_plastic_x;
            zone = 'plastic';
        } else if (Lb <= Lr) {
            // Inelastic LTB
            Md_x = Md_plastic_x * (1 - 0.3 * (Lb - Lp) / (Lr - Lp));
            zone = 'inelastic';
        } else {
            // Elastic LTB
            const Mcr = (Math.PI * Math.PI * E * section.Iy * hf) / (Lb * Lb * 1e6);
            const lambdaLT = Math.sqrt(Md_plastic_x / Mcr);
            const chiLT = 1 / (0.5 + Math.sqrt(0.25 + lambdaLT * lambdaLT));
            Md_x = chiLT * Md_plastic_x;
            zone = 'elastic';
        }

        const Md_y = Md_plastic_y;  // No LTB for minor axis

        return {
            Md_x,
            Md_y,
            ratio_x: Math.abs(Mx) / Md_x,
            ratio_y: Math.abs(My) / Md_y,
            zone
        };
    }

    // ============================================
    // CLAUSE 8.4: SHEAR
    // ============================================

    /**
     * Shear capacity per IS 800 Clause 8.4
     * Vd = Av * fy / (√3 * γm0)
     */
    static checkShear(
        Vx: number,
        Vy: number,
        section: IS_SteelSection,
        material: IS_SteelMaterial
    ): IS_ShearCheck {
        // Shear area for I-sections
        const Av_y = section.D * section.tw;  // Web area for major axis shear
        const Av_x = 2 * section.B * section.tf;  // Flange area for minor axis

        // Design shear strength (8.4.1)
        const Vd_y = (Av_y * material.fy) / (Math.sqrt(3) * this.γm0 * 1000);  // kN
        const Vd_x = (Av_x * material.fy) / (Math.sqrt(3) * this.γm0 * 1000);  // kN

        return {
            Vd_x,
            Vd_y,
            ratio_x: Math.abs(Vx) / Vd_x,
            ratio_y: Math.abs(Vy) / Vd_y
        };
    }

    // ============================================
    // CLAUSE 9: COMBINED FORCES
    // ============================================

    /**
     * Combined forces check per IS 800 Clause 9.3.1
     * (N/Nd) + (Mx/Mdx) + (My/Mdy) ≤ 1.0
     */
    static checkInteraction(
        forces: IS_MemberForces,
        tension?: IS_TensionCheck,
        compression?: IS_CompressionCheck,
        flexure?: IS_FlexureCheck
    ): IS_InteractionCheck {
        const N = Math.abs(forces.N);
        const Nd = tension?.Td ?? compression?.Pd ?? 1;
        const N_Nd = N / Nd;

        const Mx = Math.abs(forces.Mx);
        const My = Math.abs(forces.My);
        const Mdx = flexure?.Md_x ?? 1;
        const Mdy = flexure?.Md_y ?? 1;
        const Mx_Mdx = Mx / Mdx;
        const My_Mdy = My / Mdy;

        // Combined ratio (simplified linear interaction)
        const ratio = N_Nd + Mx_Mdx + My_Mdy;

        return {
            ratio,
            equation: 'N/Nd + Mx/Mdx + My/Mdy',
            N_Nd,
            Mx_Mdx,
            My_Mdy
        };
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Get utilization color based on ratio
     */
    static getUtilizationColor(ratio: number): string {
        if (ratio < 0.5) return colors.success[500];      // Green - Safe
        if (ratio < 0.9) return colors.warning[400];      // Yellow - Warning
        if (ratio <= 1.0) return colors.warning[500];     // Orange - Critical
        return colors.error[500];                         // Red - Failed
    }

    /**
     * Get summary string
     */
    static getSummary(result: IS_DesignResult): string {
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        return [
            `=== IS 800:2007 Design Check ===`,
            `Status: ${status}`,
            `Utilization: ${(result.utilizationRatio * 100).toFixed(1)}%`,
            `Governing: ${result.governingCheck}`,
            `Reference: ${result.clause}`
        ].join('\n');
    }

    /**
     * Standard IS steel materials
     */
    static readonly MATERIALS = {
        E250: { name: 'E250 (Fe 410W)', fy: 250, fu: 410, E: 200000 },
        E300: { name: 'E300 (Fe 440)', fy: 300, fu: 440, E: 200000 },
        E350: { name: 'E350 (Fe 490)', fy: 350, fu: 490, E: 200000 },
        E410: { name: 'E410 (Fe 540)', fy: 410, fu: 540, E: 200000 },
        E450: { name: 'E450 (Fe 570)', fy: 450, fu: 570, E: 200000 },
    };

    /**
     * Common ISMB sections
     */
    static readonly ISMB_SECTIONS: Record<string, IS_SteelSection> = {
        'ISMB 100': {
            name: 'ISMB 100', type: 'ISMB',
            A: 1141, D: 100, B: 75, tf: 7.2, tw: 4.0,
            Ix: 257.5e4, Iy: 40.66e4, rx: 40.1, ry: 18.9,
            Zex: 51.5e3, Zey: 10.8e3, Zpx: 59.8e3, Zpy: 16.4e3
        },
        'ISMB 150': {
            name: 'ISMB 150', type: 'ISMB',
            A: 1841, D: 150, B: 80, tf: 7.6, tw: 4.8,
            Ix: 726.4e4, Iy: 52.64e4, rx: 60.3, ry: 16.9,
            Zex: 96.9e3, Zey: 13.2e3, Zpx: 111.5e3, Zpy: 20.0e3
        },
        'ISMB 200': {
            name: 'ISMB 200', type: 'ISMB',
            A: 2541, D: 200, B: 100, tf: 10.8, tw: 5.7,
            Ix: 2235.4e4, Iy: 150e4, rx: 81.6, ry: 24.3,
            Zex: 223.5e3, Zey: 30.0e3, Zpx: 254.4e3, Zpy: 45.5e3
        },
        'ISMB 250': {
            name: 'ISMB 250', type: 'ISMB',
            A: 3728, D: 250, B: 125, tf: 12.5, tw: 6.9,
            Ix: 5131.6e4, Iy: 334.5e4, rx: 103.7, ry: 29.9,
            Zex: 410.5e3, Zey: 53.5e3, Zpx: 466.5e3, Zpy: 81.0e3
        },
        'ISMB 300': {
            name: 'ISMB 300', type: 'ISMB',
            A: 4657, D: 300, B: 140, tf: 12.4, tw: 7.5,
            Ix: 8603.6e4, Iy: 453.9e4, rx: 124.1, ry: 31.2,
            Zex: 573.6e3, Zey: 64.8e3, Zpx: 653.4e3, Zpy: 98.3e3
        },
    };
}

export default IS800_SteelDesignEngine;
