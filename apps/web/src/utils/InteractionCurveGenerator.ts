/**
 * InteractionCurveGenerator - P-M Interaction Diagram for RC Columns
 * As per IS 456:2000 and SP 16:1980
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ColumnSection {
    b: number;          // Width (mm)
    D: number;          // Depth (mm)
    d_prime: number;    // Cover to steel centroid (mm)
    Ast: number;        // Total steel area (mm²)
    fck: number;        // Characteristic concrete strength (MPa)
    fy: number;         // Steel yield strength (MPa)
    steelLayout?: 'equal' | 'compression-face' | 'tension-face';
}

export interface InteractionPoint {
    P: number;          // Axial load (kN) - positive compression
    M: number;          // Moment (kN·m)
    curvature?: number;
    neutralAxis?: number;
    strainTop?: number;
    strainBot?: number;
}

export interface InteractionCurve {
    points: InteractionPoint[];
    Pu_max: number;     // Maximum axial compression (pure compression)
    Pu_min: number;     // Maximum axial tension (pure tension)
    Mu_balanced: number; // Moment at balanced failure
    Pu_balanced: number; // Axial load at balanced failure
}

// ============================================
// IS 456:2000 CONSTANTS
// ============================================

const IS456 = {
    // Ultimate strain in concrete (Clause 38.1)
    epsilon_cu: 0.0035,

    // Strain at which steel yields (for Fe 415)
    epsilon_sy_415: 0.00380,  // 0.87 * fy / Es + 0.002
    epsilon_sy_500: 0.00417,

    // Modulus of elasticity of steel
    Es: 200000,  // MPa

    // Stress block parameters (Clause 38.1)
    // Stress block depth = 0.42 * xu
    // Area factor = 0.36 * fck
    stressBlockDepthFactor: 0.42,
    stressBlockAreaFactor: 0.36,

    // Partial safety factor for concrete
    gamma_c: 1.5,

    // Partial safety factor for steel
    gamma_s: 1.15,
};

// ============================================
// INTERACTION CURVE GENERATOR
// ============================================

export class InteractionCurveGenerator {
    private section: ColumnSection;
    private d: number;          // Effective depth
    private fcd: number;        // Design concrete strength
    private fyd: number;        // Design steel strength
    private epsilon_sy: number; // Steel yield strain

    constructor(section: ColumnSection) {
        this.section = section;
        this.d = section.D - section.d_prime;

        // Design strengths as per IS 456 Clause 38.1
        this.fcd = 0.67 * section.fck / IS456.gamma_c;  // 0.447 * fck
        this.fyd = section.fy / IS456.gamma_s;          // 0.87 * fy

        // Steel yield strain
        this.epsilon_sy = this.fyd / IS456.Es + 0.002;
    }

    /**
     * Generate complete interaction curve
     * @param numPoints Number of points on the curve
     */
    generate(numPoints: number = 50): InteractionCurve {
        const points: InteractionPoint[] = [];
        const { b, D, d_prime, Ast, fck } = this.section;

        // Point 1: Pure compression (xu = infinity)
        const Pu_max = this.calculatePureCompression();
        points.push({ P: Pu_max, M: 0 });

        // Iterate neutral axis from very large (compression) to very small (tension)
        // xu ranges from D to 0

        // Part 1: Compression failure region (xu > xu_balanced)
        const xu_balanced = this.calculateBalancedNeutralAxis();
        const xu_min = 0.05 * D;

        // Generate points from pure compression to pure bending
        for (let i = 1; i < numPoints; i++) {
            const t = i / numPoints;

            // Vary xu from large (3*D) to small (xu_min)
            let xu: number;
            if (t < 0.5) {
                // Compression region: xu from 3D to xu_balanced
                xu = 3 * D - (3 * D - xu_balanced) * (t * 2);
            } else {
                // Tension region: xu from xu_balanced to xu_min
                xu = xu_balanced - (xu_balanced - xu_min) * ((t - 0.5) * 2);
            }

            const { P, M } = this.calculateForces(xu);
            points.push({ P, M, neutralAxis: xu });
        }

        // Point N: Pure tension
        const Pu_min = this.calculatePureTension();
        points.push({ P: Pu_min, M: 0 });

        // Calculate balanced point
        const balanced = this.calculateForces(xu_balanced);

        // Sort points by P (descending) for proper curve plotting
        points.sort((a, b) => b.P - a.P);

        return {
            points,
            Pu_max,
            Pu_min,
            Mu_balanced: balanced.M,
            Pu_balanced: balanced.P
        };
    }

    /**
     * Calculate forces for given neutral axis depth
     * As per IS 456:2000 Clause 38.1
     */
    private calculateForces(xu: number): InteractionPoint {
        const { b, D, d_prime, Ast, fck, fy } = this.section;
        const d = this.d;

        // Limit xu to valid range
        xu = Math.max(0.001, Math.min(xu, 3 * D));

        // Concrete contribution
        // Stress block: area = 0.36 * fck * b * xu (Clause 38.1)
        // Acts at 0.42 * xu from top
        const xu_effective = Math.min(xu, D);
        const Cc = 0.36 * fck * b * xu_effective / 1000;  // kN
        const yc = 0.42 * xu_effective;  // Distance from top

        // Steel strains (strain compatibility)
        // Top steel (compression): d' from top
        const epsilon_sc = IS456.epsilon_cu * (xu - d_prime) / xu;

        // Bottom steel (tension): d from top
        const epsilon_st = IS456.epsilon_cu * (xu - d) / xu;

        // Steel stresses
        const fsc = this.getStressFromStrain(epsilon_sc, fy);
        const fst = this.getStressFromStrain(epsilon_st, fy);

        // Assuming equal steel on both faces
        const Asc = Ast / 2;  // Compression steel
        const Ast_tension = Ast / 2;  // Tension steel

        // Steel forces
        // Compression steel: subtract concrete displaced
        const Cs = (fsc - this.fcd) * Asc / 1000;  // kN
        const Ts = fst * Ast_tension / 1000;       // kN (positive for tension)

        // Total axial force (positive = compression)
        const P = Cc + Cs - Ts;

        // Moment about centroid (D/2 from top)
        const centroid = D / 2;
        const Mc = Cc * (centroid - yc);                    // Concrete moment
        const Msc = Cs * (centroid - d_prime);              // Compression steel moment
        const Mst = Ts * (d - centroid);                    // Tension steel moment

        const M = (Mc + Msc + Mst) / 1000;  // kN·m

        return {
            P,
            M: Math.abs(M),
            neutralAxis: xu,
            strainTop: epsilon_sc,
            strainBot: epsilon_st
        };
    }

    /**
     * Get stress from strain for steel (IS 456 stress-strain curve)
     */
    private getStressFromStrain(epsilon: number, fy: number): number {
        const Es = IS456.Es;
        const fyd = this.fyd;

        if (epsilon >= 0) {
            // Compression
            if (epsilon <= fyd / Es) {
                return epsilon * Es;  // Linear elastic
            } else {
                return fyd;  // Yielded
            }
        } else {
            // Tension
            const eps_abs = Math.abs(epsilon);
            if (eps_abs <= fyd / Es) {
                return -epsilon * Es;  // Linear elastic (tension positive)
            } else {
                return fyd;  // Yielded in tension
            }
        }
    }

    /**
     * Pure compression capacity (IS 456 Clause 39.3)
     * Pu = 0.4 * fck * Ac + 0.67 * fy * Asc
     */
    private calculatePureCompression(): number {
        const { b, D, Ast, fck, fy } = this.section;
        const Ac = b * D - Ast;  // Net concrete area

        // IS 456 Clause 39.3 (Short column under axial load)
        const Pu = (0.4 * fck * Ac + 0.67 * fy * Ast) / 1000;  // kN
        return Pu;
    }

    /**
     * Pure tension capacity
     * Pt = 0.87 * fy * Ast
     */
    private calculatePureTension(): number {
        const { Ast, fy } = this.section;
        const Pt = -0.87 * fy * Ast / 1000;  // kN (negative for tension)
        return Pt;
    }

    /**
     * Balanced neutral axis depth (IS 456 Clause 38.1)
     * xu_balanced = 0.0035 / (0.0035 + 0.87*fy/Es + 0.002) * d
     */
    private calculateBalancedNeutralAxis(): number {
        const epsilon_cu = IS456.epsilon_cu;
        const xu_bal = (epsilon_cu / (epsilon_cu + this.epsilon_sy)) * this.d;
        return xu_bal;
    }

    /**
     * Check if a point (P, M) is within the interaction curve
     */
    static isWithinCurve(P: number, M: number, curve: InteractionCurve): boolean {
        // Find the two points on curve bracketing this P
        const points = curve.points;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i]!;
            const p2 = points[i + 1]!;

            if ((P <= p1.P && P >= p2.P) || (P >= p1.P && P <= p2.P)) {
                // Interpolate M capacity at this P
                const t = (P - p1.P) / (p2.P - p1.P);
                const M_capacity = p1.M + t * (p2.M - p1.M);

                return Math.abs(M) <= M_capacity;
            }
        }

        return false;
    }

    /**
     * Get utilization ratio for a point
     */
    static getUtilization(P: number, M: number, curve: InteractionCurve): number {
        const points = curve.points;

        // Find capacity at this P level
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i]!;
            const p2 = points[i + 1]!;

            if ((P <= p1.P && P >= p2.P) || (P >= p1.P && P <= p2.P)) {
                const t = (P - p1.P) / (p2.P - p1.P);
                const M_capacity = p1.M + t * (p2.M - p1.M);

                if (M_capacity === 0) return P === 0 ? 0 : 999;
                return Math.abs(M) / M_capacity;
            }
        }

        return 999;  // Outside curve
    }

    /**
     * Format for recharts plotting
     */
    static toRechartsData(curve: InteractionCurve): Array<{ P: number; M: number }> {
        return curve.points.map(p => ({
            P: Math.round(p.P * 10) / 10,
            M: Math.round(p.M * 10) / 10
        }));
    }

    /**
     * Get summary string
     */
    static getSummary(curve: InteractionCurve): string {
        return [
            `=== P-M Interaction Curve (IS 456:2000) ===`,
            ``,
            `Pure Compression Pu,max: ${curve.Pu_max.toFixed(1)} kN`,
            `Pure Tension Pt,max: ${curve.Pu_min.toFixed(1)} kN`,
            ``,
            `Balanced Failure:`,
            `  Pu,bal: ${curve.Pu_balanced.toFixed(1)} kN`,
            `  Mu,bal: ${curve.Mu_balanced.toFixed(1)} kN·m`,
            ``,
            `Points on curve: ${curve.points.length}`
        ].join('\n');
    }
}

export default InteractionCurveGenerator;
