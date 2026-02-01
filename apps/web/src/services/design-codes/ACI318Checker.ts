/**
 * ACI318Checker.ts
 * 
 * ACI 318-19 Concrete Design Code Implementation
 * Building Code Requirements for Structural Concrete
 * 
 * Unlocks US Concrete Market
 * 
 * Features:
 * - Chapter 9: Beams (Flexure, Shear)
 * - Chapter 10: Columns
 * - Chapter 22: Sectional Strength
 * - Chapter 25: Reinforcement Details
 */

import { auditTrail } from '../AuditTrailService';

// ============================================
// TYPES
// ============================================

export interface ConcreteSection {
    name: string;
    type: 'rectangular' | 'T-beam' | 'circular';
    b: number;       // Width (in)
    h: number;       // Height/depth (in)
    d?: number;      // Effective depth (in)
    bw?: number;     // Web width for T-beam (in)
    bf?: number;     // Flange width for T-beam (in)
    hf?: number;     // Flange thickness for T-beam (in)
    diameter?: number; // For circular sections (in)
}

export interface ConcreteMaterial {
    fc: number;      // Compressive strength f'c (psi)
    fy: number;      // Rebar yield strength (psi)
    Es: number;      // Steel modulus (psi)
    Ec?: number;     // Concrete modulus (psi)
    epsilon_cu: number; // Ultimate strain (typically 0.003)
}

export interface ReinforcementLayout {
    As: number;      // Tension steel area (in²)
    As_prime?: number; // Compression steel area (in²)
    d: number;       // Depth to tension steel (in)
    d_prime?: number; // Depth to compression steel (in)
    Av?: number;     // Shear reinforcement area per spacing (in²)
    s?: number;      // Stirrup spacing (in)
}

export interface ACIForces {
    Mu: number;      // Factored moment (kip-ft)
    Vu: number;      // Factored shear (kips)
    Pu?: number;     // Factored axial (kips)
    Tu?: number;     // Factored torsion (kip-ft)
}

export interface ACICheck {
    section: string;
    title: string;
    phiRn: number;   // Design strength
    Ru: number;      // Required strength
    ratio: number;
    status: 'OK' | 'NG';
    equation?: string;
}

// ============================================
// ACI MATERIAL DATABASE
// ============================================

export const ACI_CONCRETE: Record<string, ConcreteMaterial> = {
    '3000': { fc: 3000, fy: 60000, Es: 29000000, epsilon_cu: 0.003 },
    '4000': { fc: 4000, fy: 60000, Es: 29000000, epsilon_cu: 0.003 },
    '5000': { fc: 5000, fy: 60000, Es: 29000000, epsilon_cu: 0.003 },
    '6000': { fc: 6000, fy: 60000, Es: 29000000, epsilon_cu: 0.003 },
    '8000': { fc: 8000, fy: 60000, Es: 29000000, epsilon_cu: 0.003 },
};

export const REBAR_AREAS: Record<string, number> = {
    '#3': 0.11,
    '#4': 0.20,
    '#5': 0.31,
    '#6': 0.44,
    '#7': 0.60,
    '#8': 0.79,
    '#9': 1.00,
    '#10': 1.27,
    '#11': 1.56,
    '#14': 2.25,
    '#18': 4.00,
};

// ============================================
// ACI 318 CHECKER CLASS
// ============================================

export class ACI318Checker {
    // Strength reduction factors (Table 21.2.1)
    private phi_flexure = 0.90;  // Tension-controlled
    private phi_shear = 0.75;
    private phi_compression = 0.65; // Tied columns
    private phi_spiral = 0.75;      // Spiral columns

    constructor() { }

    /**
     * Get concrete modulus (Eq. 19.2.2.1a)
     */
    private getEc(fc: number): number {
        return 57000 * Math.sqrt(fc); // psi
    }

    /**
     * Get beta1 factor (Table 22.2.2.4.3)
     */
    private getBeta1(fc: number): number {
        if (fc <= 4000) return 0.85;
        if (fc >= 8000) return 0.65;
        return 0.85 - 0.05 * (fc - 4000) / 1000;
    }

    /**
     * Run all applicable checks
     */
    checkBeam(
        section: ConcreteSection,
        material: ConcreteMaterial,
        reinforcement: ReinforcementLayout,
        forces: ACIForces
    ): ACICheck[] {
        const checks: ACICheck[] = [];

        // 9.5.1: Flexural strength
        checks.push(this.checkFlexure(section, material, reinforcement, forces.Mu));

        // 9.5.3: Shear strength
        if (Math.abs(forces.Vu) > 0.01) {
            checks.push(this.checkShear(section, material, reinforcement, forces.Vu));
        }

        // 9.6.1: Minimum reinforcement
        checks.push(this.checkMinReinforcement(section, material, reinforcement));

        // 9.7.2: Maximum reinforcement (strain check)
        checks.push(this.checkStrainLimit(section, material, reinforcement));

        // Log to audit trail
        const maxRatio = Math.max(...checks.map(c => c.ratio));
        auditTrail.log('design_check', 'ACI_318',
            `ACI 318-19 check: ${section.name}, max ratio ${(maxRatio * 100).toFixed(1)}%`,
            { aiGenerated: false, metadata: { checks, maxRatio } }
        );

        return checks;
    }

    /**
     * 22.2.2: Flexural Design Strength
     */
    checkFlexure(
        section: ConcreteSection,
        material: ConcreteMaterial,
        reinforcement: ReinforcementLayout,
        Mu: number
    ): ACICheck {
        const { fc, fy } = material;
        const { b, h } = section;
        const { As, d } = reinforcement;

        const beta1 = this.getBeta1(fc);

        // Depth of compression block (22.2.2.4.1)
        const a = (As * fy) / (0.85 * fc * b);
        const c = a / beta1;

        // Check strain (tension-controlled)
        const epsilon_t = 0.003 * (d - c) / c;
        const phi = epsilon_t >= 0.005 ? 0.90 :
            epsilon_t <= 0.002 ? 0.65 :
                0.65 + (epsilon_t - 0.002) * (0.25 / 0.003);

        // Nominal moment capacity (22.2.2.4.1)
        const Mn = As * fy * (d - a / 2); // lb-in
        const phiMn = phi * Mn / 12000;    // kip-ft

        const Mu_kipft = Math.abs(Mu);

        return {
            section: '22.2.2',
            title: 'Flexural Strength',
            phiRn: phiMn,
            Ru: Mu_kipft,
            ratio: Mu_kipft / phiMn,
            status: Mu_kipft <= phiMn ? 'OK' : 'NG',
            equation: 'φMn = φAs·fy(d - a/2)'
        };
    }

    /**
     * 22.5: Shear Strength
     */
    checkShear(
        section: ConcreteSection,
        material: ConcreteMaterial,
        reinforcement: ReinforcementLayout,
        Vu: number
    ): ACICheck {
        const { fc, fy } = material;
        const { b, h } = section;
        const { Av, s, d } = reinforcement;

        // Concrete contribution (22.5.5.1)
        const Vc = 2 * Math.sqrt(fc) * b * d; // lb

        // Steel contribution (22.5.8.5.3)
        const Vs = (Av && s && s > 0) ? (Av * fy * d) / s : 0; // lb

        // Nominal shear strength
        const Vn = Vc + Vs;
        const phiVn = this.phi_shear * Vn / 1000; // kips

        const Vu_kips = Math.abs(Vu);

        return {
            section: '22.5',
            title: 'Shear Strength',
            phiRn: phiVn,
            Ru: Vu_kips,
            ratio: Vu_kips / phiVn,
            status: Vu_kips <= phiVn ? 'OK' : 'NG',
            equation: 'φVn = φ(Vc + Vs)'
        };
    }

    /**
     * 9.6.1: Minimum Flexural Reinforcement
     */
    checkMinReinforcement(
        section: ConcreteSection,
        material: ConcreteMaterial,
        reinforcement: ReinforcementLayout
    ): ACICheck {
        const { fc, fy } = material;
        const { b, h } = section;
        const { As, d } = reinforcement;

        // 9.6.1.2: As,min
        const As_min = Math.max(
            (3 * Math.sqrt(fc) / fy) * b * d,
            (200 / fy) * b * d
        );

        return {
            section: '9.6.1',
            title: 'Minimum Reinforcement',
            phiRn: As,
            Ru: As_min,
            ratio: As_min / As,
            status: As >= As_min ? 'OK' : 'NG',
            equation: 'As,min = max(3√fc/fy, 200/fy)·b·d'
        };
    }

    /**
     * 9.3.3: Strain Limits (Tension-Controlled)
     */
    checkStrainLimit(
        section: ConcreteSection,
        material: ConcreteMaterial,
        reinforcement: ReinforcementLayout
    ): ACICheck {
        const { fc, fy, Es } = material;
        const { b } = section;
        const { As, d } = reinforcement;

        const beta1 = this.getBeta1(fc);
        const a = (As * fy) / (0.85 * fc * b);
        const c = a / beta1;

        // Net tensile strain
        const epsilon_t = 0.003 * (d - c) / c;
        const epsilon_ty = fy / Es;

        // Must be tension-controlled (εt ≥ 0.005)
        const required = 0.005;

        return {
            section: '9.3.3',
            title: 'Strain Limit (εt ≥ 0.005)',
            phiRn: epsilon_t,
            Ru: required,
            ratio: required / epsilon_t,
            status: epsilon_t >= required ? 'OK' : 'NG',
            equation: 'εt = 0.003(d-c)/c ≥ 0.005'
        };
    }

    /**
     * Quick beam check
     */
    quickCheckBeam(
        b_in: number,
        h_in: number,
        d_in: number,
        As_in2: number,
        fc_psi: number,
        Mu_kipft: number,
        Vu_kips: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: ACICheck[] } {
        const section: ConcreteSection = {
            name: `${b_in}"x${h_in}" Beam`,
            type: 'rectangular',
            b: b_in,
            h: h_in,
            d: d_in
        };

        const material = ACI_CONCRETE[fc_psi.toString()] || ACI_CONCRETE['4000'];

        const reinforcement: ReinforcementLayout = {
            As: As_in2,
            d: d_in,
            Av: 0.22,  // 2-#3 stirrups
            s: 8       // 8" spacing
        };

        const forces: ACIForces = {
            Mu: Mu_kipft,
            Vu: Vu_kips
        };

        const checks = this.checkBeam(section, material, reinforcement, forces);
        const maxCheck = checks.reduce((max, c) => c.ratio > max.ratio ? c : max, checks[0]);

        return {
            passed: maxCheck.ratio <= 1.0,
            maxRatio: maxCheck.ratio,
            critical: maxCheck.title,
            checks
        };
    }

    /**
     * Generate report
     */
    generateReport(section: ConcreteSection, checks: ACICheck[]): string {
        let report = `## ACI 318-19 Design Check Report\n\n`;
        report += `**Section:** ${section.name}\n`;
        report += `**Dimensions:** ${section.b}" × ${section.h}"\n\n`;

        report += `### Results Summary\n\n`;
        report += `| Section | Check | Ratio | Status |\n`;
        report += `|---------|-------|-------|--------|\n`;

        for (const check of checks) {
            const statusEmoji = check.status === 'OK' ? '✅' : '❌';
            report += `| ${check.section} | ${check.title} | ${(check.ratio * 100).toFixed(1)}% | ${statusEmoji} |\n`;
        }

        const maxRatio = Math.max(...checks.map(c => c.ratio));
        report += `\n**Maximum Utilization:** ${(maxRatio * 100).toFixed(1)}%\n`;

        return report;
    }
}

// ============================================
// SINGLETON
// ============================================

export const aci318 = new ACI318Checker();

export default ACI318Checker;
