/**
 * ACI318ColumnDesign.ts - RC Column Design per ACI 318-19
 * 
 * Features:
 * - Uniaxial and biaxial bending
 * - Slenderness effects (moment magnification)
 * - Interaction diagrams
 * - Detailing requirements
 */

// ============================================
// TYPES
// ============================================

export interface ColumnSection {
    b: number;      // Width (mm)
    h: number;      // Depth (mm)
    cover: number;  // Clear cover (mm)
    Astx: number;   // Steel area in x-direction (mm²)
    Asty: number;   // Steel area in y-direction (mm²)
    barSize: number; // Bar diameter (mm)
    numBarsX: number;
    numBarsY: number;
}

export interface ColumnForces {
    Pu: number;     // Factored axial (kN)
    Mux: number;    // Factored moment about x (kN·m)
    Muy: number;    // Factored moment about y (kN·m)
}

export interface ColumnMaterial {
    fc: number;     // Concrete strength (MPa)
    fy: number;     // Steel yield (MPa)
    Es: number;     // Steel modulus (MPa)
}

export interface SlendernessParams {
    lu: number;     // Unsupported length (mm)
    kx: number;     // Effective length factor x
    ky: number;     // Effective length factor y
    M1: number;     // Smaller end moment
    M2: number;     // Larger end moment
    braced: boolean;
}

export interface ColumnCheck {
    clause: string;
    description: string;
    demand: number;
    capacity: number;
    ratio: number;
    status: 'PASS' | 'FAIL' | 'WARNING';
}

export interface InteractionPoint {
    Pn: number;     // Nominal axial (kN)
    Mn: number;     // Nominal moment (kN·m)
}

// ============================================
// ACI 318 COLUMN CHECKER
// ============================================

export class ACI318ColumnChecker {
    private phi_c = 0.65;  // Tied columns
    private phi_s = 0.75;  // Spiral columns
    private beta1: number;

    constructor(private material: ColumnMaterial) {
        // Calculate beta1 (ACI 22.2.2.4.3)
        if (material.fc <= 28) {
            this.beta1 = 0.85;
        } else if (material.fc >= 55) {
            this.beta1 = 0.65;
        } else {
            this.beta1 = 0.85 - 0.05 * (material.fc - 28) / 7;
        }
    }

    /**
     * Check column for all ACI requirements
     */
    checkColumn(
        section: ColumnSection,
        forces: ColumnForces,
        slenderness?: SlendernessParams
    ): ColumnCheck[] {
        const checks: ColumnCheck[] = [];

        // Check minimum dimensions
        checks.push(this.checkMinDimensions(section));

        // Check reinforcement limits
        checks.push(this.checkReinforcementLimits(section));

        // Check slenderness
        if (slenderness) {
            const slenderChecks = this.checkSlenderness(section, forces, slenderness);
            checks.push(...slenderChecks);
        }

        // Check strength (interaction)
        checks.push(this.checkUniaxialStrength(section, forces));

        if (Math.abs(forces.Mux) > 0.1 && Math.abs(forces.Muy) > 0.1) {
            checks.push(this.checkBiaxialStrength(section, forces));
        }

        return checks;
    }

    /**
     * Minimum dimension check (ACI 10.3.1)
     */
    private checkMinDimensions(section: ColumnSection): ColumnCheck {
        const minDim = Math.min(section.b, section.h);
        const ratio = section.h / section.b;

        return {
            clause: 'ACI 10.3.1',
            description: 'Minimum column dimensions',
            demand: minDim,
            capacity: 300,
            ratio: 300 / minDim,
            status: minDim >= 300 && ratio <= 3 ? 'PASS' : 'WARNING'
        };
    }

    /**
     * Reinforcement limits (ACI 10.6.1)
     */
    private checkReinforcementLimits(section: ColumnSection): ColumnCheck {
        const Ag = section.b * section.h;
        const Ast = section.Astx + section.Asty;
        const rho = Ast / Ag;

        const minRho = 0.01;
        const maxRho = 0.08;

        let status: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
        if (rho < minRho) status = 'FAIL';
        else if (rho > maxRho) status = 'FAIL';
        else if (rho > 0.06) status = 'WARNING';

        return {
            clause: 'ACI 10.6.1',
            description: `Reinforcement ratio (1% ≤ ρ ≤ 8%)`,
            demand: rho * 100,
            capacity: maxRho * 100,
            ratio: rho / maxRho,
            status
        };
    }

    /**
     * Slenderness check with moment magnification
     */
    private checkSlenderness(
        section: ColumnSection,
        forces: ColumnForces,
        params: SlendernessParams
    ): ColumnCheck[] {
        const checks: ColumnCheck[] = [];

        // Calculate slenderness ratios
        const rx = section.h / Math.sqrt(12);
        const ry = section.b / Math.sqrt(12);
        const lambdaX = (params.kx * params.lu) / rx;
        const lambdaY = (params.ky * params.lu) / ry;

        // Slenderness limit (ACI 6.2.5)
        const limit = params.braced ? 34 : 22;

        checks.push({
            clause: 'ACI 6.2.5',
            description: 'Slenderness ratio check',
            demand: Math.max(lambdaX, lambdaY),
            capacity: limit,
            ratio: Math.max(lambdaX, lambdaY) / limit,
            status: Math.max(lambdaX, lambdaY) <= limit ? 'PASS' : 'WARNING'
        });

        // If slender, calculate magnified moments
        if (Math.max(lambdaX, lambdaY) > limit) {
            const { Mc, delta } = this.calculateMagnifiedMoment(
                section, forces, params
            );

            checks.push({
                clause: 'ACI 6.6.4',
                description: 'Moment magnification factor',
                demand: delta,
                capacity: 1.4,
                ratio: delta / 1.4,
                status: delta <= 1.4 ? 'PASS' : 'WARNING'
            });
        }

        return checks;
    }

    /**
     * Calculate magnified moment for slender columns
     */
    private calculateMagnifiedMoment(
        section: ColumnSection,
        forces: ColumnForces,
        params: SlendernessParams
    ): { Mc: number; delta: number } {
        const Ag = section.b * section.h;
        const Ig = (section.b * Math.pow(section.h, 3)) / 12;
        const Ec = 4700 * Math.sqrt(this.material.fc);

        // Effective stiffness (ACI 6.6.4.4.4)
        const EI = (0.4 * Ec * Ig) / (1 + 0.6); // Simplified

        // Critical buckling load
        const Pc = (Math.PI ** 2 * EI) / Math.pow(params.kx * params.lu, 2);

        // Cm factor
        const Cm = 0.6 + 0.4 * (params.M1 / params.M2);

        // Magnification factor
        const delta = Math.max(1, Cm / (1 - forces.Pu * 1000 / (0.75 * Pc)));

        // Magnified moment
        const Mc = delta * forces.Mux;

        return { Mc, delta };
    }

    /**
     * Uniaxial strength check
     */
    private checkUniaxialStrength(
        section: ColumnSection,
        forces: ColumnForces
    ): ColumnCheck {
        const { Pn, Mn } = this.getInteractionCapacity(section, forces.Pu);

        const phiPn = this.phi_c * Pn;
        const phiMn = this.phi_c * Mn;

        const M = Math.sqrt(forces.Mux ** 2 + forces.Muy ** 2);
        const ratio = forces.Pu / phiPn + M / phiMn;

        return {
            clause: 'ACI 22.4',
            description: 'Axial + Moment interaction',
            demand: ratio,
            capacity: 1.0,
            ratio: ratio,
            status: ratio <= 1.0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Biaxial strength check (Bresler reciprocal)
     */
    private checkBiaxialStrength(
        section: ColumnSection,
        forces: ColumnForces
    ): ColumnCheck {
        // Get capacities for each axis
        const Pnx = this.getAxialCapacity(section, forces.Mux, 'x');
        const Pny = this.getAxialCapacity(section, forces.Muy, 'y');
        const Pn0 = this.getPureAxialCapacity(section);

        // Bresler reciprocal load method
        const Pu = forces.Pu;
        const reciprocal = 1 / (this.phi_c * Pnx) + 1 / (this.phi_c * Pny) - 1 / (this.phi_c * Pn0);
        const Pn_biaxial = 1 / reciprocal;

        const ratio = Pu / Pn_biaxial;

        return {
            clause: 'ACI R22.4.4',
            description: 'Biaxial bending (Bresler)',
            demand: Pu,
            capacity: Pn_biaxial,
            ratio: ratio,
            status: ratio <= 1.0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Get interaction diagram capacity
     */
    private getInteractionCapacity(
        section: ColumnSection,
        Pu: number
    ): { Pn: number; Mn: number } {
        const diagram = this.generateInteractionDiagram(section);

        // Find capacity at given Pu
        for (let i = 0; i < diagram.length - 1; i++) {
            if (Pu >= diagram[i + 1].Pn && Pu <= diagram[i].Pn) {
                const t = (Pu - diagram[i + 1].Pn) / (diagram[i].Pn - diagram[i + 1].Pn);
                const Mn = diagram[i + 1].Mn + t * (diagram[i].Mn - diagram[i + 1].Mn);
                return { Pn: Pu, Mn };
            }
        }

        return diagram[0];
    }

    /**
     * Generate interaction diagram
     */
    generateInteractionDiagram(section: ColumnSection, points: number = 20): InteractionPoint[] {
        const diagram: InteractionPoint[] = [];
        const { fc, fy } = this.material;
        const Ag = section.b * section.h;
        const Ast = section.Astx + section.Asty;
        const d = section.h - section.cover - section.barSize / 2;

        // Pure compression
        const Pn0 = 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
        diagram.push({ Pn: Pn0, Mn: 0 });

        // Points along diagram
        for (let i = 1; i <= points; i++) {
            const c = (i / points) * section.h;
            const a = this.beta1 * c;
            const epsilon_s = 0.003 * (d - c) / c;
            const fs = Math.min(Math.abs(epsilon_s) * this.material.Es, fy);

            const Cc = 0.85 * fc * a * section.b / 1000;
            const Cs = Ast * fs / 1000 / 2;
            const Ts = Ast * fs / 1000 / 2;

            const Pn = Cc + Cs - Ts;
            const Mn = Cc * (section.h / 2 - a / 2) + (Cs + Ts) * (d - section.h / 2);

            diagram.push({ Pn: Math.max(0, Pn), Mn: Math.abs(Mn) / 1000 });
        }

        // Pure tension
        const Pnt = -Ast * fy / 1000;
        diagram.push({ Pn: Pnt, Mn: 0 });

        return diagram;
    }

    private getAxialCapacity(section: ColumnSection, M: number, axis: 'x' | 'y'): number {
        const diagram = this.generateInteractionDiagram(section);
        // Simplified - find P for given M
        for (const point of diagram) {
            if (point.Mn >= Math.abs(M)) {
                return point.Pn;
            }
        }
        return diagram[diagram.length - 1].Pn;
    }

    private getPureAxialCapacity(section: ColumnSection): number {
        const { fc, fy } = this.material;
        const Ag = section.b * section.h;
        const Ast = section.Astx + section.Asty;
        return 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast) / 1000;
    }
}

// Export factory
export const createColumnChecker = (material: ColumnMaterial) => new ACI318ColumnChecker(material);
