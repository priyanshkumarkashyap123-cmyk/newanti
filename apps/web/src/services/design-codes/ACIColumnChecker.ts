/**
 * ACIColumnChecker.ts
 * 
 * ACI 318-19 Column Design with Biaxial Bending
 * 
 * Features:
 * - Uniaxial and biaxial P-M interaction
 * - Slenderness effects (magnified moments)
 * - Tied and spiral columns
 * - Bresler reciprocal method
 * - Design optimization
 */

import { ACI_CONCRETE, REBAR_AREAS } from './ACI318Checker';

// ============================================
// TYPES
// ============================================

export interface ColumnSection {
    type: 'rectangular' | 'circular';
    b: number;        // Width (in)
    h: number;        // Height/depth (in)
    diameter?: number; // For circular (in)
    cover: number;    // Clear cover (in)
}

export interface ColumnReinforcement {
    barSize: string;  // e.g., '#8'
    numBars: number;
    arrangement: 'uniform' | 'two-face';
    tieSize: string;
    tieSpacing: number;
    isSpirallyReinforced: boolean;
    spiralPitch?: number;
}

export interface ColumnMaterial {
    fc: number;       // f'c (psi)
    fy: number;       // Steel fy (psi)
    Es: number;       // Steel modulus (psi)
}

export interface ColumnForces {
    Pu: number;       // Factored axial (kips)
    Mux: number;      // Factored moment about X (kip-ft)
    Muy: number;      // Factored moment about Y (kip-ft)
}

export interface SlendernessParams {
    lu_x: number;     // Unbraced length X (in)
    lu_y: number;     // Unbraced length Y (in)
    k_x: number;      // Effective length factor X
    k_y: number;      // Effective length factor Y
    isSway: boolean;  // Sway or non-sway frame
    Cm_x?: number;    // Moment correction factor X
    Cm_y?: number;    // Moment correction factor Y
}

export interface ColumnCheck {
    section: string;
    title: string;
    phiPn: number;
    Pu: number;
    ratio: number;
    status: 'OK' | 'NG';
    equation?: string;
    notes?: string;
}

export interface PMInteractionPoint {
    Pn: number;
    Mn: number;
    epsilon_t: number;
    failureMode: 'compression' | 'tension' | 'balanced';
}

// ============================================
// ACI COLUMN CHECKER
// ============================================

export class ACIColumnChecker {
    private phi_comp_tied = 0.65;
    private phi_comp_spiral = 0.75;
    private phi_flex = 0.90;
    private epsilon_cu = 0.003;

    /**
     * Check column under biaxial loading
     */
    checkColumn(
        section: ColumnSection,
        reinforcement: ColumnReinforcement,
        material: ColumnMaterial,
        forces: ColumnForces,
        slenderness?: SlendernessParams
    ): ColumnCheck[] {
        const checks: ColumnCheck[] = [];

        // Get phi based on reinforcement type
        const phi = reinforcement.isSpirallyReinforced
            ? this.phi_comp_spiral
            : this.phi_comp_tied;

        // Calculate reinforcement properties
        const Ast = REBAR_AREAS[reinforcement.barSize] * reinforcement.numBars;
        const rho = Ast / (section.b * section.h);

        // Check reinforcement limits
        checks.push(this.checkReinforcementLimits(rho));

        // Apply slenderness if needed
        let Mu_x = forces.Mux;
        let Mu_y = forces.Muy;

        if (slenderness) {
            const magnified = this.applySlenderness(
                section, material, forces, slenderness
            );
            Mu_x = magnified.Mc_x;
            Mu_y = magnified.Mc_y;
            checks.push(...magnified.checks);
        }

        // Check axial capacity
        checks.push(this.checkAxialCapacity(
            section, reinforcement, material, forces.Pu, phi
        ));

        // For biaxial bending, use Bresler reciprocal method
        if (Math.abs(Mu_x) > 0.01 && Math.abs(Mu_y) > 0.01) {
            checks.push(this.checkBiaxial(
                section, reinforcement, material,
                forces.Pu, Mu_x, Mu_y, phi
            ));
        } else {
            // Uniaxial check
            const Mu = Math.abs(Mu_x) > Math.abs(Mu_y) ? Mu_x : Mu_y;
            checks.push(this.checkUniaxial(
                section, reinforcement, material,
                forces.Pu, Mu, phi
            ));
        }

        return checks;
    }

    /**
     * 10.6: Reinforcement limits
     */
    private checkReinforcementLimits(rho: number): ColumnCheck {
        const rho_min = 0.01;
        const rho_max = 0.08;

        const withinLimits = rho >= rho_min && rho <= rho_max;

        return {
            section: '10.6',
            title: 'Reinforcement Limits',
            phiPn: rho_max,
            Pu: rho,
            ratio: rho < rho_min ? rho_min / rho : rho / rho_max,
            status: withinLimits ? 'OK' : 'NG',
            equation: '0.01 ≤ ρ ≤ 0.08',
            notes: `ρ = ${(rho * 100).toFixed(2)}%`
        };
    }

    /**
     * 22.4: Axial strength
     */
    private checkAxialCapacity(
        section: ColumnSection,
        reinforcement: ColumnReinforcement,
        material: ColumnMaterial,
        Pu: number,
        phi: number
    ): ColumnCheck {
        const Ag = section.b * section.h;
        const Ast = REBAR_AREAS[reinforcement.barSize] * reinforcement.numBars;
        const { fc, fy } = material;

        // 22.4.2.1: Maximum axial strength
        const alpha = reinforcement.isSpirallyReinforced ? 0.85 : 0.80;
        const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
        const Pn_max = alpha * Po;
        const phiPn = phi * Pn_max / 1000; // kips

        return {
            section: '22.4.2',
            title: 'Axial Compression Capacity',
            phiPn,
            Pu: Math.abs(Pu),
            ratio: Math.abs(Pu) / phiPn,
            status: Math.abs(Pu) <= phiPn ? 'OK' : 'NG',
            equation: 'φPn,max = φ × α × (0.85fc(Ag-Ast) + fyAst)',
            notes: `Po = ${(Po / 1000).toFixed(0)} kips`
        };
    }

    /**
     * 6.6: Slenderness effects
     */
    private applySlenderness(
        section: ColumnSection,
        material: ColumnMaterial,
        forces: ColumnForces,
        params: SlendernessParams
    ): { Mc_x: number; Mc_y: number; checks: ColumnCheck[] } {
        const checks: ColumnCheck[] = [];
        const { fc, Es } = material;

        // Radius of gyration
        const rx = section.b / Math.sqrt(12);
        const ry = section.h / Math.sqrt(12);

        // Slenderness ratio
        const kLr_x = (params.k_x * params.lu_x) / rx;
        const kLr_y = (params.k_y * params.lu_y) / ry;

        // Check if slenderness effects can be neglected (6.2.5)
        const limit = params.isSway ? 22 : 34 - 12 * (params.Cm_x || 1.0);

        checks.push({
            section: '6.2.5',
            title: 'Slenderness Classification',
            phiPn: limit,
            Pu: Math.max(kLr_x, kLr_y),
            ratio: Math.max(kLr_x, kLr_y) / limit,
            status: Math.max(kLr_x, kLr_y) <= limit ? 'OK' : 'NG',
            equation: 'klu/r ≤ limit',
            notes: `klu/r = ${Math.max(kLr_x, kLr_y).toFixed(1)}, limit = ${limit.toFixed(1)}`
        });

        // If slender, calculate moment magnification
        let Mc_x = forces.Mux;
        let Mc_y = forces.Muy;

        if (kLr_x > limit || kLr_y > limit) {
            // Critical buckling load (Eq. 6.6.4.4.2)
            const Ig_x = section.b * section.h ** 3 / 12;
            const Ig_y = section.h * section.b ** 3 / 12;
            const EI_x = 0.4 * 57000 * Math.sqrt(fc) * Ig_x;
            const EI_y = 0.4 * 57000 * Math.sqrt(fc) * Ig_y;

            const Pc_x = Math.PI ** 2 * EI_x / (params.k_x * params.lu_x) ** 2 / 1000;
            const Pc_y = Math.PI ** 2 * EI_y / (params.k_y * params.lu_y) ** 2 / 1000;

            // Moment magnifier (6.6.4.6.2)
            const Cm_x = params.Cm_x || 1.0;
            const Cm_y = params.Cm_y || 1.0;

            const delta_ns_x = Math.max(Cm_x / (1 - forces.Pu / (0.75 * Pc_x)), 1.0);
            const delta_ns_y = Math.max(Cm_y / (1 - forces.Pu / (0.75 * Pc_y)), 1.0);

            Mc_x = delta_ns_x * forces.Mux;
            Mc_y = delta_ns_y * forces.Muy;

            checks.push({
                section: '6.6.4',
                title: 'Moment Magnification',
                phiPn: 1.0,
                Pu: Math.max(delta_ns_x, delta_ns_y),
                ratio: Math.max(delta_ns_x, delta_ns_y),
                status: delta_ns_x < 2.5 && delta_ns_y < 2.5 ? 'OK' : 'NG',
                equation: 'δns = Cm / (1 - Pu/0.75Pc)',
                notes: `δns,x = ${delta_ns_x.toFixed(2)}, δns,y = ${delta_ns_y.toFixed(2)}`
            });
        }

        return { Mc_x, Mc_y, checks };
    }

    /**
     * P-M Interaction check (uniaxial)
     */
    private checkUniaxial(
        section: ColumnSection,
        reinforcement: ColumnReinforcement,
        material: ColumnMaterial,
        Pu: number,
        Mu: number,
        phi: number
    ): ColumnCheck {
        // Generate interaction diagram
        const diagram = this.generatePMDiagram(section, reinforcement, material);

        // Find capacity at given axial load
        const capacity = this.getCapacityAtAxial(diagram, Pu, phi);

        const Mu_abs = Math.abs(Mu);
        const phiMn = capacity * phi;

        return {
            section: '22.4',
            title: 'P-M Interaction (Uniaxial)',
            phiPn: phiMn,
            Pu: Mu_abs,
            ratio: Mu_abs / phiMn,
            status: Mu_abs <= phiMn ? 'OK' : 'NG',
            equation: '(Pu, Mu) inside φ·P-M diagram'
        };
    }

    /**
     * Biaxial check using Bresler reciprocal method
     */
    private checkBiaxial(
        section: ColumnSection,
        reinforcement: ColumnReinforcement,
        material: ColumnMaterial,
        Pu: number,
        Mux: number,
        Muy: number,
        phi: number
    ): ColumnCheck {
        // Get capacities
        const diagramX = this.generatePMDiagram(section, reinforcement, material);
        const diagramY = this.generatePMDiagram(
            { ...section, b: section.h, h: section.b },
            reinforcement,
            material
        );

        const Ag = section.b * section.h;
        const Ast = REBAR_AREAS[reinforcement.barSize] * reinforcement.numBars;
        const Po = 0.85 * material.fc * (Ag - Ast) + material.fy * Ast;

        // Capacity about each axis at given Pu
        const phiPnx = this.getCapacityAtMoment(diagramX, Math.abs(Mux) * 12) * phi;
        const phiPny = this.getCapacityAtMoment(diagramY, Math.abs(Muy) * 12) * phi;
        const phiPo = phi * 0.80 * Po / 1000;

        // Bresler reciprocal (22.4.3)
        // 1/Pn = 1/Pnx + 1/Pny - 1/Po
        const Pu_abs = Math.abs(Pu);
        const reciprocal = 1 / phiPnx + 1 / phiPny - 1 / phiPo;
        const phiPn = 1 / reciprocal;

        return {
            section: '22.4.3',
            title: 'P-M Interaction (Biaxial)',
            phiPn,
            Pu: Pu_abs,
            ratio: Pu_abs / phiPn,
            status: Pu_abs <= phiPn * 1.0 ? 'OK' : 'NG',
            equation: '1/Pn = 1/Pnx + 1/Pny - 1/Po (Bresler)',
            notes: `φPnx=${phiPnx.toFixed(0)}k, φPny=${phiPny.toFixed(0)}k`
        };
    }

    /**
     * Generate P-M interaction diagram
     */
    private generatePMDiagram(
        section: ColumnSection,
        reinforcement: ColumnReinforcement,
        material: ColumnMaterial
    ): PMInteractionPoint[] {
        const points: PMInteractionPoint[] = [];
        const { b, h, cover } = section;
        const { fc, fy, Es } = material;
        const Ast = REBAR_AREAS[reinforcement.barSize] * reinforcement.numBars;
        const d = h - cover - 1; // Approximate d

        // Pure compression
        const Po = 0.85 * fc * b * h + fy * Ast;
        points.push({ Pn: Po / 1000, Mn: 0, epsilon_t: 0, failureMode: 'compression' });

        // Vary neutral axis from pure compression to pure tension
        for (let c = h * 1.5; c > 0; c -= h / 20) {
            const a = 0.85 * c; // Assuming beta1 = 0.85
            const epsilon_t = this.epsilon_cu * (d - c) / c;

            // Concrete force
            const Cc = 0.85 * fc * a * b;

            // Steel force (assuming bars at d and d')
            const d_prime = cover + 1;
            const epsilon_s = this.epsilon_cu * (c - d_prime) / c;
            const epsilon_st = this.epsilon_cu * (d - c) / c;

            const fs = Math.min(Es * Math.abs(epsilon_s), fy) * Math.sign(epsilon_s);
            const fst = Math.min(Es * Math.abs(epsilon_st), fy) * Math.sign(epsilon_st);

            const Cs = (Ast / 2) * (fs - 0.85 * fc);
            const Ts = (Ast / 2) * fst;

            const Pn = (Cc + Cs - Ts) / 1000;
            const Mn = (Cc * (h / 2 - a / 2) + Cs * (h / 2 - d_prime) + Ts * (d - h / 2)) / 12000;

            const mode = epsilon_t > 0.002 ? 'tension' :
                epsilon_t < 0 ? 'compression' : 'balanced';

            if (Pn > -Ast * fy / 1000 && Mn >= 0) {
                points.push({ Pn, Mn, epsilon_t, failureMode: mode });
            }
        }

        // Pure tension
        const Pt = -fy * Ast / 1000;
        points.push({ Pn: Pt, Mn: 0, epsilon_t: 0.005, failureMode: 'tension' });

        return points;
    }

    /**
     * Get moment capacity at given axial load
     */
    private getCapacityAtAxial(diagram: PMInteractionPoint[], Pu: number, phi: number): number {
        const Pu_abs = Math.abs(Pu);

        for (let i = 0; i < diagram.length - 1; i++) {
            const p1 = diagram[i];
            const p2 = diagram[i + 1];

            if ((p1.Pn >= Pu_abs && p2.Pn <= Pu_abs) ||
                (p1.Pn <= Pu_abs && p2.Pn >= Pu_abs)) {
                // Interpolate
                const ratio = (Pu_abs - p1.Pn) / (p2.Pn - p1.Pn);
                return p1.Mn + ratio * (p2.Mn - p1.Mn);
            }
        }

        return diagram[0].Mn;
    }

    /**
     * Get axial capacity at given moment
     */
    private getCapacityAtMoment(diagram: PMInteractionPoint[], Mu: number): number {
        const Mu_abs = Math.abs(Mu);

        for (let i = 0; i < diagram.length - 1; i++) {
            const p1 = diagram[i];
            const p2 = diagram[i + 1];

            if ((p1.Mn <= Mu_abs && p2.Mn >= Mu_abs) ||
                (p1.Mn >= Mu_abs && p2.Mn <= Mu_abs)) {
                const ratio = (Mu_abs - p1.Mn) / (p2.Mn - p1.Mn);
                return p1.Pn + ratio * (p2.Pn - p1.Pn);
            }
        }

        return diagram[Math.floor(diagram.length / 2)].Pn;
    }

    /**
     * Quick column check
     */
    quickCheck(
        b_in: number,
        h_in: number,
        fc_psi: number,
        barSize: string,
        numBars: number,
        Pu_kips: number,
        Mux_kipft: number,
        Muy_kipft: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: ColumnCheck[] } {
        const section: ColumnSection = { type: 'rectangular', b: b_in, h: h_in, cover: 1.5 };
        const reinforcement: ColumnReinforcement = {
            barSize,
            numBars,
            arrangement: 'uniform',
            tieSize: '#4',
            tieSpacing: 12,
            isSpirallyReinforced: false
        };
        const material: ColumnMaterial = { fc: fc_psi, fy: 60000, Es: 29000000 };
        const forces: ColumnForces = { Pu: Pu_kips, Mux: Mux_kipft, Muy: Muy_kipft };

        const checks = this.checkColumn(section, reinforcement, material, forces);
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

export const aciColumn = new ACIColumnChecker();

export default ACIColumnChecker;
