/**
 * SteelDesignEngine - AISC 360-16 Steel Design Checks
 * Comprehensive member design verification
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface SteelSection {
    name: string;
    type: 'W' | 'HSS' | 'Pipe' | 'C' | 'L' | 'WT' | 'Plate';
    A: number;      // Area (in² or mm²)
    Ix: number;     // Moment of inertia about x-axis
    Iy: number;     // Moment of inertia about y-axis
    Sx: number;     // Elastic section modulus about x
    Sy: number;     // Elastic section modulus about y
    Zx: number;     // Plastic section modulus about x
    Zy: number;     // Plastic section modulus about y
    rx: number;     // Radius of gyration about x
    ry: number;     // Radius of gyration about y
    J: number;      // Torsional constant
    Cw: number;     // Warping constant
    d: number;      // Depth
    bf: number;     // Flange width
    tf: number;     // Flange thickness
    tw: number;     // Web thickness
    rts?: number;   // Effective radius of gyration for LTB
    ho?: number;    // Distance between flange centroids
}

export interface SteelMaterial {
    name: string;
    Fy: number;     // Yield strength (ksi or MPa)
    Fu: number;     // Ultimate tensile strength
    E: number;      // Modulus of elasticity (29000 ksi or 200000 MPa)
    G?: number;     // Shear modulus
}

export interface MemberForces {
    Pu: number;     // Axial force (+ tension, - compression)
    Mux: number;    // Moment about x-axis (major)
    Muy: number;    // Moment about y-axis (minor)
    Vux: number;    // Shear in x-direction
    Vuy: number;    // Shear in y-direction
}

export interface MemberProperties {
    L: number;      // Length
    Kx: number;     // Effective length factor about x
    Ky: number;     // Effective length factor about y
    Lb: number;     // Unbraced length for lateral-torsional buckling
    Cb: number;     // Moment gradient factor (default 1.0)
}

export interface DesignResult {
    passed: boolean;
    utilizationRatio: number;
    governingEquation: string;
    checks: {
        tension?: TensionCheck;
        compression?: CompressionCheck;
        flexure?: FlexureCheck;
        shear?: ShearCheck;
        interaction?: InteractionCheck;
    };
}

interface TensionCheck {
    Pn: number;         // Nominal tensile strength
    phiPn: number;      // Design tensile strength
    ratio: number;      // Pu / (phi * Pn)
    governing: 'yielding' | 'rupture';
}

interface CompressionCheck {
    Pn: number;         // Nominal compressive strength
    phiPn: number;      // Design compressive strength
    ratio: number;      // Pu / (phi * Pn)
    Fe: number;         // Euler buckling stress
    Fcr: number;        // Critical stress
    KLr_x: number;      // Slenderness about x
    KLr_y: number;      // Slenderness about y
    governing: 'x-axis' | 'y-axis';
}

interface FlexureCheck {
    Mn_x: number;       // Nominal moment capacity about x
    phiMn_x: number;    // Design moment capacity about x
    Mn_y: number;       // Nominal moment capacity about y
    phiMn_y: number;    // Design moment capacity about y
    ratio_x: number;    // Mux / (phi * Mnx)
    ratio_y: number;    // Muy / (phi * Mny)
    Lp: number;         // Plastic limit for LTB
    Lr: number;         // Inelastic limit for LTB
    zone: 'plastic' | 'inelastic' | 'elastic';
}

interface ShearCheck {
    Vn_x: number;       // Nominal shear capacity in x
    Vn_y: number;       // Nominal shear capacity in y
    phiVn_x: number;
    phiVn_y: number;
    ratio_x: number;
    ratio_y: number;
}

interface InteractionCheck {
    Pr_Pc: number;      // Pr/Pc ratio
    Mr_Mc_x: number;    // Mrx/Mcx ratio
    Mr_Mc_y: number;    // Mry/Mcy ratio
    ratio: number;      // Combined interaction ratio
    equation: 'H1-1a' | 'H1-1b';
}

// ============================================
// STEEL DESIGN ENGINE
// ============================================

export class SteelDesignEngine {
    // AISC resistance factors
    static readonly phi_t = 0.90;   // Tension (yielding)
    static readonly phi_c = 0.90;   // Compression
    static readonly phi_b = 0.90;   // Flexure
    static readonly phi_v = 0.90;   // Shear (yielding)
    static readonly phi_v_buckle = 0.90;  // Shear (buckling)

    /**
     * Main function: Check member design
     */
    static checkMember(
        forces: MemberForces,
        section: SteelSection,
        material: SteelMaterial,
        props: MemberProperties
    ): DesignResult {
        const checks: DesignResult['checks'] = {};
        let maxRatio = 0;
        let governingEq = '';

        // Determine load type
        const isTension = forces.Pu > 0;
        const isCompression = forces.Pu < 0;
        const hasMoment = Math.abs(forces.Mux) > 0.001 || Math.abs(forces.Muy) > 0.001;
        const hasShear = Math.abs(forces.Vux) > 0.001 || Math.abs(forces.Vuy) > 0.001;

        // Chapter D: Tension
        if (isTension) {
            checks.tension = this.checkTension(forces.Pu, section, material);
            if (checks.tension.ratio > maxRatio) {
                maxRatio = checks.tension.ratio;
                governingEq = `Tension (D2): Pu/(φPn) = ${checks.tension.ratio.toFixed(3)}`;
            }
        }

        // Chapter E: Compression
        if (isCompression) {
            checks.compression = this.checkCompression(
                Math.abs(forces.Pu), section, material, props
            );
            if (checks.compression.ratio > maxRatio) {
                maxRatio = checks.compression.ratio;
                governingEq = `Compression (E3): Pu/(φPn) = ${checks.compression.ratio.toFixed(3)}`;
            }
        }

        // Chapter F: Flexure (always check for combined interaction)
        {
            checks.flexure = this.checkFlexure(forces.Mux, forces.Muy, section, material, props);
            const flexureMax = Math.max(checks.flexure.ratio_x, checks.flexure.ratio_y);
            if (!hasMoment && flexureMax > maxRatio) {
                maxRatio = flexureMax;
                governingEq = `Flexure (F2): Mu/(φMn) = ${flexureMax.toFixed(3)}`;
            }
        }

        // Chapter G: Shear
        if (hasShear) {
            checks.shear = this.checkShear(forces.Vux, forces.Vuy, section, material);
            const shearMax = Math.max(checks.shear.ratio_x, checks.shear.ratio_y);
            if (shearMax > maxRatio) {
                maxRatio = shearMax;
                governingEq = `Shear (G2): Vu/(φVn) = ${shearMax.toFixed(3)}`;
            }
        }

        // Chapter H: Combined Forces (Interaction)
        if ((isTension || isCompression) && hasMoment) {
            checks.interaction = this.checkInteraction(
                forces,
                checks.tension,
                checks.compression,
                checks.flexure!
            );
            if (checks.interaction.ratio > maxRatio) {
                maxRatio = checks.interaction.ratio;
                governingEq = `Interaction (${checks.interaction.equation}): ${checks.interaction.ratio.toFixed(3)} ≤ 1.0`;
            }
        }

        return {
            passed: maxRatio <= 1.0,
            utilizationRatio: maxRatio,
            governingEquation: governingEq,
            checks
        };
    }

    // ============================================
    // CHAPTER D: TENSION
    // ============================================

    /**
     * Tension capacity check per AISC 360 Chapter D
     * D2: Pn = Fy * Ag (yielding) or Pn = Fu * Ae (rupture)
     */
    static checkTension(Pu: number, section: SteelSection, material: SteelMaterial): TensionCheck {
        // D2-1: Tensile yielding in gross section
        const Pn_yield = material.Fy * section.A;
        const phiPn_yield = this.phi_t * Pn_yield;

        // D2-2: Tensile rupture in net section (assume Ae = 0.85 * Ag for connected flanges)
        const U = 0.85;  // Shear lag factor (conservative)
        const Ae = U * section.A;
        const Pn_rupture = material.Fu * Ae;
        const phiPn_rupture = 0.75 * Pn_rupture;  // phi = 0.75 for rupture

        // Governing case
        const isYieldingGoverning = phiPn_yield <= phiPn_rupture;
        const phiPn = Math.min(phiPn_yield, phiPn_rupture);
        const Pn = isYieldingGoverning ? Pn_yield : Pn_rupture;

        return {
            Pn,
            phiPn,
            ratio: Pu / phiPn,
            governing: isYieldingGoverning ? 'yielding' : 'rupture'
        };
    }

    // ============================================
    // CHAPTER E: COMPRESSION
    // ============================================

    /**
     * Compression capacity check per AISC 360 Chapter E
     * Includes elastic/inelastic buckling
     */
    static checkCompression(
        Pu: number,
        section: SteelSection,
        material: SteelMaterial,
        props: MemberProperties
    ): CompressionCheck {
        // Slenderness ratios
        const KLr_x = (props.Kx * props.L) / section.rx;
        const KLr_y = (props.Ky * props.L) / section.ry;
        const KLr_max = Math.max(KLr_x, KLr_y);
        const governing = KLr_x >= KLr_y ? 'x-axis' : 'y-axis';

        // E3-4: Euler buckling stress
        const Fe = (Math.PI * Math.PI * material.E) / (KLr_max * KLr_max);

        // E3-2 & E3-3: Critical stress Fcr
        let Fcr: number;
        const lambda = material.Fy / Fe;

        if (KLr_max <= 4.71 * Math.sqrt(material.E / material.Fy)) {
            // Inelastic buckling (E3-2)
            Fcr = Math.pow(0.658, lambda) * material.Fy;
        } else {
            // Elastic buckling (E3-3)
            Fcr = 0.877 * Fe;
        }

        // E3-1: Nominal compressive strength
        const Pn = Fcr * section.A;
        const phiPn = this.phi_c * Pn;

        return {
            Pn,
            phiPn,
            ratio: Pu / phiPn,
            Fe,
            Fcr,
            KLr_x,
            KLr_y,
            governing
        };
    }

    // ============================================
    // CHAPTER F: FLEXURE
    // ============================================

    /**
     * Flexure capacity check per AISC 360 Chapter F
     * F2: Doubly symmetric I-shaped members
     */
    static checkFlexure(
        Mux: number,
        Muy: number,
        section: SteelSection,
        material: SteelMaterial,
        props: MemberProperties
    ): FlexureCheck {
        const Lb = props.Lb;
        const Cb = props.Cb || 1.0;
        const E = material.E;
        const Fy = material.Fy;

        // F2-5: Lp (plastic zone limit)
        const Lp = 1.76 * section.ry * Math.sqrt(E / Fy);

        // F2-6: Lr (inelastic zone limit)
        const c = 1.0;  // For doubly symmetric I-shapes
        const rts = section.rts ?? section.ry * Math.sqrt(Math.sqrt(section.Ix / section.Iy));
        const ho = section.ho ?? section.d - section.tf;

        const term1 = (E / (0.7 * Fy));
        const term2 = section.J * c / (section.Sx * ho);
        const term3 = Math.sqrt(1 + 6.76 * Math.pow(0.7 * Fy * section.Sx * ho / (E * section.J * c), 2));
        const Lr = 1.95 * rts * Math.sqrt(term1) * Math.sqrt(term2 + Math.sqrt(term2 * term2 + term3));

        // F2-1: Plastic moment
        const Mp = Fy * section.Zx;

        // Determine zone and Mn
        let Mn_x: number;
        let zone: 'plastic' | 'inelastic' | 'elastic';

        if (Lb <= Lp) {
            // F2-1: Plastic zone
            Mn_x = Mp;
            zone = 'plastic';
        } else if (Lb <= Lr) {
            // F2-2: Inelastic LTB
            Mn_x = Cb * (Mp - (Mp - 0.7 * Fy * section.Sx) * ((Lb - Lp) / (Lr - Lp)));
            Mn_x = Math.min(Mn_x, Mp);
            zone = 'inelastic';
        } else {
            // F2-3: Elastic LTB
            const Fcr = (Cb * Math.PI * Math.PI * E / Math.pow(Lb / rts, 2)) *
                Math.sqrt(1 + 0.078 * (section.J * c) / (section.Sx * ho) * Math.pow(Lb / rts, 2));
            Mn_x = Fcr * section.Sx;
            Mn_x = Math.min(Mn_x, Mp);
            zone = 'elastic';
        }

        // Minor axis bending (F6)
        const Mp_y = Math.min(Fy * section.Zy, 1.6 * Fy * section.Sy);
        const Mn_y = Mp_y;

        const phiMn_x = this.phi_b * Mn_x;
        const phiMn_y = this.phi_b * Mn_y;

        return {
            Mn_x,
            phiMn_x,
            Mn_y,
            phiMn_y,
            ratio_x: Math.abs(Mux) / phiMn_x,
            ratio_y: Math.abs(Muy) / phiMn_y,
            Lp,
            Lr: Lr || Lp * 3,  // Fallback if Lr calculation fails
            zone
        };
    }

    // ============================================
    // CHAPTER G: SHEAR
    // ============================================

    /**
     * Shear capacity check per AISC 360 Chapter G
     */
    static checkShear(
        Vux: number,
        Vuy: number,
        section: SteelSection,
        material: SteelMaterial
    ): ShearCheck {
        // G2-1: Shear in web (major axis)
        const Aw = section.d * section.tw;  // Web area
        const h_tw = (section.d - 2 * section.tf) / section.tw;

        // G2-3 & G2-4: Web shear coefficient Cv1
        const kv = 5.34;  // Unstiffened web
        let Cv1: number;

        if (h_tw <= 2.24 * Math.sqrt(material.E / material.Fy)) {
            Cv1 = 1.0;
        } else {
            Cv1 = 2.24 * Math.sqrt(material.E / material.Fy) / h_tw;
        }

        const Vn_y = 0.6 * material.Fy * Aw * Cv1;
        const phiVn_y = this.phi_v * Vn_y;

        // Shear in flange (minor axis) - simplified
        const Af = 2 * section.bf * section.tf;
        const Vn_x = 0.6 * material.Fy * Af * 0.6;  // Conservative
        const phiVn_x = this.phi_v * Vn_x;

        return {
            Vn_x,
            Vn_y,
            phiVn_x,
            phiVn_y,
            ratio_x: Math.abs(Vux) / phiVn_x,
            ratio_y: Math.abs(Vuy) / phiVn_y
        };
    }

    // ============================================
    // CHAPTER H: COMBINED FORCES (INTERACTION)
    // ============================================

    /**
     * Combined axial and bending interaction check per AISC 360 Chapter H
     * H1-1a: Pr/Pc >= 0.2 → Pr/Pc + 8/9(Mrx/Mcx + Mry/Mcy) <= 1.0
     * H1-1b: Pr/Pc < 0.2 → Pr/(2Pc) + (Mrx/Mcx + Mry/Mcy) <= 1.0
     */
    static checkInteraction(
        forces: MemberForces,
        tension?: TensionCheck,
        compression?: CompressionCheck,
        flexure?: FlexureCheck
    ): InteractionCheck {
        // Get axial capacity
        const Pr = Math.abs(forces.Pu);
        const Pc = tension?.phiPn ?? compression?.phiPn ?? 1;
        const Pr_Pc = Pr / Pc;

        // Get moment capacities
        const Mrx = Math.abs(forces.Mux);
        const Mry = Math.abs(forces.Muy);
        const Mcx = flexure?.phiMn_x ?? 1;
        const Mcy = flexure?.phiMn_y ?? 1;
        const Mr_Mc_x = Mrx / Mcx;
        const Mr_Mc_y = Mry / Mcy;

        let ratio: number;
        let equation: 'H1-1a' | 'H1-1b';

        if (Pr_Pc >= 0.2) {
            // H1-1a
            ratio = Pr_Pc + (8 / 9) * (Mr_Mc_x + Mr_Mc_y);
            equation = 'H1-1a';
        } else {
            // H1-1b
            ratio = Pr_Pc / 2 + (Mr_Mc_x + Mr_Mc_y);
            equation = 'H1-1b';
        }

        return {
            Pr_Pc,
            Mr_Mc_x,
            Mr_Mc_y,
            ratio,
            equation
        };
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Get a summary string of design results
     */
    static getSummary(result: DesignResult): string {
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        const lines = [
            `=== Steel Design Check ===`,
            `Status: ${status}`,
            `Utilization: ${(result.utilizationRatio * 100).toFixed(1)}%`,
            `Governing: ${result.governingEquation}`,
            ''
        ];

        if (result.checks.tension) {
            lines.push(`Tension: ${(result.checks.tension.ratio * 100).toFixed(1)}% (${result.checks.tension.governing})`);
        }
        if (result.checks.compression) {
            lines.push(`Compression: ${(result.checks.compression.ratio * 100).toFixed(1)}% (KL/r = ${result.checks.compression.KLr_x.toFixed(1)})`);
        }
        if (result.checks.flexure) {
            lines.push(`Flexure X: ${(result.checks.flexure.ratio_x * 100).toFixed(1)}% (${result.checks.flexure.zone})`);
            lines.push(`Flexure Y: ${(result.checks.flexure.ratio_y * 100).toFixed(1)}%`);
        }
        if (result.checks.interaction) {
            lines.push(`Interaction (${result.checks.interaction.equation}): ${(result.checks.interaction.ratio * 100).toFixed(1)}%`);
        }

        return lines.join('\n');
    }

    /**
     * Standard steel materials
     */
    static readonly MATERIALS = {
        A36: { name: 'ASTM A36', Fy: 36, Fu: 58, E: 29000 },
        A572_50: { name: 'ASTM A572 Gr. 50', Fy: 50, Fu: 65, E: 29000 },
        A992: { name: 'ASTM A992', Fy: 50, Fu: 65, E: 29000 },
        A500B: { name: 'ASTM A500 Gr. B', Fy: 46, Fu: 58, E: 29000 },
        A500C: { name: 'ASTM A500 Gr. C', Fy: 50, Fu: 62, E: 29000 },
    };

    /**
     * Common W-shape sections (abbreviated)
     */
    static readonly W_SECTIONS: Record<string, SteelSection> = {
        'W14x22': {
            name: 'W14x22', type: 'W',
            A: 6.49, d: 13.7, bf: 5.0, tf: 0.335, tw: 0.23,
            Ix: 199, Iy: 7.0, Sx: 29.0, Sy: 2.8, Zx: 33.2, Zy: 4.39,
            rx: 5.54, ry: 1.04, J: 0.208, Cw: 314
        },
        'W14x30': {
            name: 'W14x30', type: 'W',
            A: 8.85, d: 13.8, bf: 6.73, tf: 0.385, tw: 0.27,
            Ix: 291, Iy: 19.6, Sx: 42.0, Sy: 5.82, Zx: 47.3, Zy: 8.99,
            rx: 5.73, ry: 1.49, J: 0.38, Cw: 887
        },
        'W14x48': {
            name: 'W14x48', type: 'W',
            A: 14.1, d: 13.8, bf: 8.03, tf: 0.595, tw: 0.34,
            Ix: 485, Iy: 51.4, Sx: 70.3, Sy: 12.8, Zx: 78.4, Zy: 19.6,
            rx: 5.85, ry: 1.91, J: 1.45, Cw: 2240
        },
        'W21x44': {
            name: 'W21x44', type: 'W',
            A: 13.0, d: 20.7, bf: 6.5, tf: 0.45, tw: 0.35,
            Ix: 843, Iy: 20.7, Sx: 81.6, Sy: 6.37, Zx: 95.4, Zy: 10.2,
            rx: 8.06, ry: 1.26, J: 0.77, Cw: 2110
        },
    };
}

export default SteelDesignEngine;
