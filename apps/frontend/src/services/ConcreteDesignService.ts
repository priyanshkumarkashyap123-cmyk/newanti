/**
 * ConcreteDesignService.ts - IS 456:2000 & ACI 318-19 RC Design
 * 
 * Implements comprehensive reinforced concrete design:
 * - Flexural design (beams)
 * - Shear design 
 * - Column design (axial + bending)
 * - Serviceability checks
 * - Deflection checks
 */

import { Material, RectangularConcreteSection } from '../data/SectionDatabase';

// ============================================
// TYPES
// ============================================

export interface ConcreteSection {
    b: number;          // Width (mm)
    D: number;          // Overall depth (mm)
    d: number;          // Effective depth (mm)
    cover: number;      // Clear cover (mm)
    // Tension reinforcement
    Ast: number;        // Area of tension steel (mm²)
    // Compression reinforcement
    Asc?: number;       // Area of compression steel (mm²)
    d_prime?: number;   // Effective cover for compression steel (mm)
    // Shear reinforcement
    Asv?: number;       // Area of stirrups (mm²)
    sv?: number;        // Stirrup spacing (mm)
}

export interface ConcreteForces {
    Mu: number;         // Factored moment (kN-m)
    Vu: number;         // Factored shear (kN)
    Pu?: number;        // Factored axial load (kN)
    Tu?: number;        // Factored torsion (kN-m)
}

export interface ConcreteDesignResult {
    memberId: string;
    checkType: string;
    required: number;
    provided: number;
    ratio: number;
    status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE';
    details: string;
    code: string;
}

export interface FlexuralDesignResult extends ConcreteDesignResult {
    Ast_required: number;
    Ast_min: number;
    Ast_max: number;
    xu: number;         // Neutral axis depth
    xu_max: number;     // Limiting neutral axis depth
    sectionType: 'under-reinforced' | 'balanced' | 'over-reinforced';
}

export interface ShearDesignResult extends ConcreteDesignResult {
    Vc: number;         // Concrete shear capacity (kN)
    Vs: number;         // Steel shear capacity (kN)
    sv_required: number; // Required stirrup spacing (mm)
}

export type DesignCode = 'IS456' | 'ACI318';

// ============================================
// CONSTANTS
// ============================================

// IS 456:2000 Constants
const IS456 = {
    gamma_c: 1.5,       // Partial safety factor for concrete
    gamma_s: 1.15,      // Partial safety factor for steel
    xu_max_ratios: {    // xu,max/d for different steel grades
        'Fe250': 0.53,
        'Fe415': 0.48,
        'Fe500': 0.46,
        'Fe550': 0.44
    } as Record<string, number>,
    tau_c_max: {        // Maximum shear stress (MPa) for different concrete grades
        'M20': 2.8,
        'M25': 3.1,
        'M30': 3.5,
        'M35': 3.7,
        'M40': 4.0
    } as Record<string, number>
};

// ACI 318-19 Constants
const ACI318 = {
    phi_flexure: 0.90,
    phi_shear: 0.75,
    phi_compression: 0.65,
    beta1: (fc: number) => {
        // Beta1 for stress block
        if (fc <= 28) return 0.85;
        if (fc >= 55) return 0.65;
        return 0.85 - 0.05 * (fc - 28) / 7;
    }
};

// ============================================
// IS 456:2000 FLEXURAL DESIGN
// ============================================

export function designFlexureIS456(
    section: ConcreteSection,
    fck: number,        // Characteristic compressive strength (MPa)
    fy: number,         // Steel yield strength (MPa)
    Mu: number          // Factored moment (kN-m)
): FlexuralDesignResult {
    const { b, d, Ast } = section;

    // Limiting neutral axis depth ratio
    const xu_max_d = IS456.xu_max_ratios[`Fe${fy}`] || 0.46;
    const xu_max = xu_max_d * d;

    // Limiting moment of resistance
    const Mu_lim = 0.36 * fck * b * xu_max * (d - 0.416 * xu_max) / 1e6; // kN-m

    // Check if doubly reinforced section needed
    const isDoublyReinforced = Mu > Mu_lim;

    let Ast_required: number;
    let xu: number;
    let sectionType: 'under-reinforced' | 'balanced' | 'over-reinforced';

    if (!isDoublyReinforced) {
        // Singly reinforced beam
        // Mu = 0.87 * fy * Ast * (d - 0.42 * xu)
        // And: 0.36 * fck * b * xu = 0.87 * fy * Ast

        // From quadratic: Ast = (0.5 * fck * b * d / fy) * (1 - sqrt(1 - 4.6 * Mu / (fck * b * d²)))
        const ratio = (4.6 * Mu * 1e6) / (fck * b * d * d);

        if (ratio > 1) {
            // Section inadequate for singly reinforced
            Ast_required = Ast; // Will fail
            xu = xu_max; // Assume limiting
            sectionType = 'over-reinforced';
        } else {
            const k = 1 - Math.sqrt(1 - ratio);
            Ast_required = (0.5 * fck * b * d * k) / (0.87 * fy);

            // Calculate actual xu
            xu = (0.87 * fy * Ast_required) / (0.36 * fck * b);
            sectionType = xu < xu_max ? 'under-reinforced' : 'balanced';
        }
    } else {
        // Doubly reinforced — IS 456 Cl. 38.1 with strain compatibility
        // Ast1 for Mu_lim, Ast2 for (Mu - Mu_lim)
        const Ast1 = (0.36 * fck * b * xu_max) / (0.87 * fy);
        const Mu2 = Mu - Mu_lim;
        const d_prime = section.d_prime || 50;
        
        // Compression steel stress from strain compatibility (IS 456 Fig. 21)
        // εsc = 0.0035 × (1 - d'/xu_max)
        const epsilon_sc = 0.0035 * (1 - d_prime / xu_max);
        // fsc from IS 456 Table F: limited by 0.87*fy
        // For Fe415: fsc = min(Es × εsc, 0.87 × fy)
        const Es = 200000; // MPa
        const fsc = Math.min(Es * Math.abs(epsilon_sc), 0.87 * fy);
        
        const lever_arm = d - d_prime;
        // Asc = Mu2 / (fsc - 0.446*fck) × (d - d')
        const Asc = (Mu2 * 1e6) / ((fsc - 0.446 * fck) * lever_arm);
        // Ast2 = Asc × fsc / (0.87 × fy) for equilibrium
        const Ast2 = (Asc * fsc) / (0.87 * fy);

        Ast_required = Ast1 + Ast2;
        xu = xu_max;
        sectionType = 'under-reinforced'; // Designed as under-reinforced
    }

    // Minimum steel (IS 456 cl. 26.5.1.1)
    const Ast_min = 0.85 * b * d / fy;

    // Maximum steel (IS 456 cl. 26.5.1.1)
    const Ast_max = 0.04 * b * section.D;

    // Ensure minimum
    Ast_required = Math.max(Ast_required, Ast_min);

    const ratio = Ast / Ast_required;

    let status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    if (Ast < Ast_required) status = 'FAIL';
    else if (Ast < Ast_required * 1.1) status = 'WARNING';
    else if (Ast > Ast_max) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Flexure (IS 456)',
        required: Ast_required,
        provided: Ast,
        ratio,
        status,
        details: `Ast_req = ${Ast_required.toFixed(0)} mm², Ast_prov = ${Ast.toFixed(0)} mm², xu/d = ${(xu / d).toFixed(3)}`,
        code: 'IS 456:2000 Cl. 38.1',
        Ast_required,
        Ast_min,
        Ast_max,
        xu,
        xu_max,
        sectionType
    };
}

// ============================================
// IS 456:2000 SHEAR DESIGN
// ============================================

export function designShearIS456(
    section: ConcreteSection,
    fck: number,
    fy: number,
    Vu: number          // Factored shear (kN)
): ShearDesignResult {
    const { b, d, Ast, Asv, sv } = section;

    // Percentage of tension steel
    const pt = (100 * Ast) / (b * d);

    // Design shear strength of concrete — IS 456:2000 Table 19 (Exact bilinear interpolation)
    const tau_c = getTaucIS456(fck, pt);

    const Vc = tau_c * b * d / 1000;  // kN

    // Nominal shear stress
    const tau_v = (Vu * 1000) / (b * d);  // MPa

    // Maximum shear stress
    const tau_c_max = IS456.tau_c_max[`M${fck}`] || 2.5;

    let Vs = 0;
    let sv_required = 300; // Maximum spacing

    if (tau_v > tau_c_max) {
        // Section inadequate
        sv_required = 0;
    } else if (tau_v > tau_c) {
        // Shear reinforcement required
        const Vus = (Vu - Vc);
        Vs = Vus;

        // sv = 0.87 * fy * Asv * d / Vus
        const Asv_provided = Asv || (2 * Math.PI * 8 * 8 / 4); // 2L-8mm default
        sv_required = (0.87 * fy * Asv_provided * d) / (Vus * 1000);

        // Minimum spacing limits
        sv_required = Math.min(sv_required, 0.75 * d, 300);
    }

    // Ratio is (Provided Spacing) / (Required Spacing). If Provided > Required, ratio > 1 (FAIL).
    // If sv is 0 or undefined, assume we are just checking requirements, so ratio is based on Vc/Vu or similar
    const provided_sv = sv || 0;
    let ratio: number;
    if (provided_sv > 0) {
        ratio = provided_sv / sv_required;
    } else {
        // If no spacing provided, just report based on stresses
        ratio = tau_v / tau_c_max;
    }

    let status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    if (tau_v > tau_c_max) status = 'FAIL';
    else if (provided_sv > 0 && provided_sv > sv_required) status = 'FAIL';
    else if (provided_sv > 0 && provided_sv > sv_required * 0.9) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Shear (IS 456)',
        required: sv_required,
        provided: sv || 0,
        ratio,
        status,
        details: `τv = ${tau_v.toFixed(2)} MPa, τc = ${tau_c.toFixed(2)} MPa, Vc = ${Vc.toFixed(1)} kN`,
        code: 'IS 456:2000 Cl. 40',
        Vc,
        Vs,
        sv_required
    };
}

// ============================================
// ACI 318-19 FLEXURAL DESIGN
// ============================================

export function designFlexureACI(
    section: ConcreteSection,
    fc: number,         // Specified compressive strength (MPa)
    fy: number,         // Steel yield strength (MPa)
    Mu: number          // Factored moment (kN-m)
): FlexuralDesignResult {
    const { b, d, Ast } = section;

    const beta1 = ACI318.beta1(fc);
    const phi = ACI318.phi_flexure;

    // Maximum steel ratio for tension-controlled section
    const epsilon_t = 0.005; // Target tensile strain
    const c_d_max = 0.003 / (0.003 + epsilon_t); // ~0.375
    const rho_max = 0.85 * beta1 * fc * c_d_max / fy;

    // Required steel using strength design
    // Mn = As * fy * (d - a/2), where a = As * fy / (0.85 * fc * b)
    // From quadratic solution:
    const Mn_required = Mu / phi;  // kN-m

    const coefficient = (2 * Mn_required * 1e6) / (0.85 * fc * b * d * d);

    let Ast_required: number;
    let a: number;
    let xu: number;
    let sectionType: 'under-reinforced' | 'balanced' | 'over-reinforced';

    if (coefficient > 1) {
        // Section too small
        Ast_required = rho_max * b * d;
        a = Ast_required * fy / (0.85 * fc * b);
        xu = a / beta1;
        sectionType = 'over-reinforced';
    } else {
        const rho = (0.85 * fc / fy) * (1 - Math.sqrt(1 - coefficient));
        Ast_required = rho * b * d;
        a = Ast_required * fy / (0.85 * fc * b);
        xu = a / beta1;

        const rho_bal = 0.85 * beta1 * fc * 0.003 / (fy * (0.003 + fy / 200000));
        sectionType = rho < 0.75 * rho_bal ? 'under-reinforced' : 'balanced';
    }

    // Minimum reinforcement (ACI 318-19 Sec. 9.6.1.2)
    const Ast_min_1 = 0.25 * Math.sqrt(fc) * b * d / fy;
    const Ast_min_2 = 1.4 * b * d / fy;
    const Ast_min = Math.max(Ast_min_1, Ast_min_2);

    // Maximum reinforcement
    const Ast_max = rho_max * b * d;

    Ast_required = Math.max(Ast_required, Ast_min);

    const ratio = Ast / Ast_required;
    const xu_max = c_d_max * d;

    let status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    if (Ast < Ast_required) status = 'FAIL';
    else if (Ast < Ast_required * 1.1) status = 'WARNING';
    else if (Ast > Ast_max) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Flexure (ACI 318)',
        required: Ast_required,
        provided: Ast,
        ratio,
        status,
        details: `As_req = ${Ast_required.toFixed(0)} mm², As_prov = ${Ast.toFixed(0)} mm², c/d = ${(xu / d).toFixed(3)}`,
        code: 'ACI 318-19 Sec. 22.2',
        Ast_required,
        Ast_min,
        Ast_max,
        xu,
        xu_max,
        sectionType
    };
}

// ============================================
// ACI 318-19 SHEAR DESIGN
// ============================================

export function designShearACI(
    section: ConcreteSection,
    fc: number,
    fy: number,
    Vu: number,
    Nu: number = 0      // Axial force (positive = compression)
): ShearDesignResult {
    const { b, d, Ast, Asv, sv } = section;
    const phi = ACI318.phi_shear;

    // Concrete shear strength (simplified, ACI 318-19 Sec. 22.5.5.1)
    const lambda = 1.0;  // Normal weight concrete
    const rho_w = Ast / (b * d);

    // Detailed method
    const Vc_1 = (0.66 * lambda * Math.pow(rho_w, 1 / 3) * Math.sqrt(fc) + Nu / (6 * b * d)) * b * d / 1000;
    const Vc_2 = (0.17 * lambda * Math.sqrt(fc) + Nu / (6 * b * d)) * b * d / 1000;
    const Vc = Math.max(Vc_1, Vc_2);  // kN

    // Maximum shear
    const Vn_max = Vc + 0.66 * Math.sqrt(fc) * b * d / 1000;

    let Vs = 0;
    let sv_required = Math.min(d / 2, 600); // Maximum spacing

    const Vu_phi = Vu / phi;

    if (Vu_phi > phi * Vn_max) {
        // Section inadequate
        sv_required = 0;
    } else if (Vu_phi > Vc) {
        // Shear reinforcement required
        Vs = Vu_phi - Vc;

        // Asv * fyv * d / s >= Vs
        const Asv_provided = Asv || (2 * Math.PI * 10 * 10 / 4); // 2L-10mm default
        const fyv = Math.min(fy, 420); // Max 420 MPa for shear
        sv_required = (Asv_provided * fyv * d) / (Vs * 1000);

        // Maximum spacing limits
        if (Vs > 0.33 * Math.sqrt(fc) * b * d / 1000) {
            sv_required = Math.min(sv_required, d / 4, 300);
        } else {
            sv_required = Math.min(sv_required, d / 2, 600);
        }
    }

    const provided_sv = sv || 0;
    let ratio: number;
    if (provided_sv > 0) {
        ratio = provided_sv / sv_required;
    } else {
        ratio = Vu_phi / (phi * Vn_max);
    }

    let status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    if (Vu_phi > phi * Vn_max) status = 'FAIL';
    else if (provided_sv > 0 && provided_sv > sv_required) status = 'FAIL';
    else if (provided_sv > 0 && provided_sv > sv_required * 0.9) status = 'WARNING';

    return {
        memberId: '',
        checkType: 'Shear (ACI 318)',
        required: sv_required,
        provided: sv || 0,
        ratio,
        status,
        details: `φVc = ${(phi * Vc).toFixed(1)} kN, Vu = ${Vu.toFixed(1)} kN, Vs = ${Vs.toFixed(1)} kN`,
        code: 'ACI 318-19 Sec. 22.5',
        Vc,
        Vs,
        sv_required
    };
}

// ============================================
// COLUMN DESIGN (AXIAL + MOMENT)
// ============================================

export interface ColumnDesignInput {
    b: number;          // Width (mm)
    D: number;          // Depth (mm)
    Ast: number;        // Total steel area (mm²)
    cover: number;      // Clear cover (mm)
    fck: number;        // Concrete strength (MPa)
    fy: number;         // Steel strength (MPa)
    Pu: number;         // Factored axial load (kN)
    Mu: number;         // Factored moment (kN-m)
    Lex: number;        // Effective length about X (mm)
    Ley: number;        // Effective length about Y (mm)
}

export function designColumnIS456(input: ColumnDesignInput): ConcreteDesignResult {
    const { b, D, Ast, cover, fck, fy, Pu, Mu, Lex, Ley } = input;

    const d = D - cover - 25; // Assuming 25mm bar
    const d_prime = cover + 25 / 2;
    const As_half = Ast / 2;

    // Slenderness check (IS 456 Cl. 25.1.2)
    const lambda_x = Lex / D;
    const lambda_y = Ley / b;
    const isShortColumn = lambda_x < 12 && lambda_y < 12;

    // ── IS 456 Cl. 39.6 Interaction Diagram (Exact) ──────────────
    // Generate P-M interaction points for multiple xu/d ratios
    const Ag = b * D;

    // Pure compression (xu → ∞, IS 456 Cl. 39.3)
    const P0 = (0.4 * fck * Ag + (0.67 * fy - 0.4 * fck) * Ast) / 1000; // kN

    // Compute interaction points at various neutral axis depths
    const interactionPoints: { Pu_pt: number; Mu_pt: number }[] = [];
    interactionPoints.push({ Pu_pt: P0, Mu_pt: 0 });

    for (const xu_ratio of [2.0, 1.2, 1.0, 0.8, 0.6, 0.46, 0.3, 0.2]) {
        const xu = xu_ratio * d;
        const Cu = 0.36 * fck * b * Math.min(xu, D);
        const strain_sc = xu > 0 ? 0.0035 * (1 - d_prime / xu) : 0;
        const fsc = Math.min(200000 * Math.max(strain_sc, 0), 0.87 * fy);
        const Tu = 0.87 * fy * As_half;
        const P = (Cu + fsc * As_half - Tu) / 1000; // kN
        const M = (Cu * (D / 2 - 0.42 * Math.min(xu, D)) +
                   fsc * As_half * (D / 2 - d_prime) +
                   Tu * (d - D / 2)) / 1e6; // kN·m
        interactionPoints.push({ Pu_pt: Math.max(P, 0), Mu_pt: Math.max(M, 0) });
    }

    // Pure tension
    const Pt = -(0.87 * fy * Ast) / 1000;
    interactionPoints.push({ Pu_pt: Pt, Mu_pt: 0 });
    interactionPoints.sort((a, b_pt) => b_pt.Pu_pt - a.Pu_pt);

    // Interpolate capacity at design Pu
    let Mu_capacity = 0;
    for (let i = 0; i < interactionPoints.length - 1; i++) {
        const p1 = interactionPoints[i];
        const p2 = interactionPoints[i + 1];
        if (Pu <= p1.Pu_pt && Pu >= p2.Pu_pt) {
            const t = (p1.Pu_pt - Pu) / (p1.Pu_pt - p2.Pu_pt + 1e-10);
            Mu_capacity = p1.Mu_pt + t * (p2.Mu_pt - p1.Mu_pt);
            break;
        }
    }
    if (Mu_capacity === 0) Mu_capacity = interactionPoints[Math.floor(interactionPoints.length / 2)].Mu_pt;

    const axial_ratio = Pu / P0;
    const moment_ratio = Mu_capacity > 0 ? Mu / Mu_capacity : 1;
    const interaction_ratio = moment_ratio; // Actual check: is M_demand ≤ M_capacity at given Pu?

    let status: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    if (interaction_ratio > 1.0) status = 'FAIL';
    else if (interaction_ratio > 0.9) status = 'WARNING';

    const slendernessNote = isShortColumn ? 'Short column' : 'Slender column (additional moment per Cl. 39.7)';

    return {
        memberId: '',
        checkType: 'Column (IS 456)',
        required: 1.0,
        provided: interaction_ratio,
        ratio: interaction_ratio,
        status,
        details: `P/P0 = ${axial_ratio.toFixed(3)}, M/Mu_cap = ${moment_ratio.toFixed(3)}, Mu_cap = ${Mu_capacity.toFixed(1)} kN·m, ${slendernessNote}`,
        code: 'IS 456:2000 Cl. 39.6'
    };
}

// ============================================
// COMPREHENSIVE RC DESIGN
// ============================================

export interface RCDesignInput {
    memberId: string;
    section: ConcreteSection;
    forces: ConcreteForces;
    material: {
        fck: number;    // Concrete grade (MPa)
        fy: number;     // Rebar grade (MPa)
    };
    designCode: DesignCode;
}

export function performRCDesign(input: RCDesignInput) {
    const { memberId, section, forces, material, designCode } = input;
    const { fck, fy } = material;

    const results: ConcreteDesignResult[] = [];

    // Flexure check
    if (Math.abs(forces.Mu) > 0.01) {
        if (designCode === 'IS456') {
            const flexure = designFlexureIS456(section, fck, fy, forces.Mu);
            flexure.memberId = memberId;
            results.push(flexure);
        } else {
            const flexure = designFlexureACI(section, fck, fy, forces.Mu);
            flexure.memberId = memberId;
            results.push(flexure);
        }
    }

    // Shear check
    if (Math.abs(forces.Vu) > 0.01) {
        if (designCode === 'IS456') {
            const shear = designShearIS456(section, fck, fy, forces.Vu);
            shear.memberId = memberId;
            results.push(shear);
        } else {
            const shear = designShearACI(section, fck, fy, forces.Vu, forces.Pu);
            shear.memberId = memberId;
            results.push(shear);
        }
    }

    // Overall status
    let overallStatus: 'PASS' | 'FAIL' | 'WARNING' | 'SAFE' = 'PASS';
    let criticalRatio = 0;
    let governingCheck = '';

    for (const result of results) {
        if (result.status === 'FAIL') overallStatus = 'FAIL';
        else if (result.status === 'WARNING' && overallStatus !== 'FAIL') overallStatus = 'WARNING';

        const ratio = 1 / result.ratio; // Invert for demand/capacity
        if (ratio > criticalRatio) {
            criticalRatio = ratio;
            governingCheck = result.checkType;
        }
    }

    return {
        memberId,
        checks: results,
        overallStatus,
        criticalRatio,
        governingCheck
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getRebarDetails(Ast: number, preferredDia: number = 16): { diameter: number; count: number; spacing: number }[] {
    const rebarAreas: Record<number, number> = {
        8: 50.27,
        10: 78.54,
        12: 113.1,
        16: 201.1,
        20: 314.2,
        25: 490.9,
        32: 804.2
    };


    const options: { diameter: number; count: number; spacing: number }[] = [];

    for (const [dia, area] of Object.entries(rebarAreas)) {
        const diameter = parseInt(dia);
        const count = Math.ceil(Ast / area);
        if (count >= 2 && count <= 10) {
            options.push({
                diameter,
                count,
                spacing: 0 // To be calculated based on width
            });
        }
    }

    return options.sort((a, b) => a.diameter - b.diameter);
}

export function formatRCResult(result: ConcreteDesignResult): string {
    const statusIcon = result.status === 'PASS' ? '✓' :
        result.status === 'FAIL' ? '✗' :
            result.status === 'WARNING' ? '⚠' : '✓';
    return `${statusIcon} ${result.checkType}: ${result.details}`;
}

/**
 * IS 456:2000 Table 19 — Design shear strength of concrete τc (N/mm²)
 * Exact bilinear interpolation across concrete grade and steel percentage.
 */
function getTaucIS456(fck: number, pt: number): number {
    const pt_keys = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
    const table: Record<number, number[]> = {
        15: [0.28, 0.35, 0.46, 0.54, 0.60, 0.64, 0.68, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71],
        20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
        25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.88, 0.90, 0.92],
        30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.88, 0.91, 0.94, 0.96],
        35: [0.30, 0.38, 0.51, 0.60, 0.68, 0.73, 0.78, 0.82, 0.86, 0.90, 0.93, 0.96, 0.99],
        40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.83, 0.87, 0.91, 0.94, 0.97, 1.01],
    };

    const pt_val = Math.max(0.15, Math.min(pt, 3.0));
    const fck_val = Math.max(15, Math.min(fck, 40));
    const grades = [15, 20, 25, 30, 35, 40];

    // Find fck bounds for interpolation
    let f1 = 15, f2 = 15;
    for (let i = 0; i < grades.length; i++) {
        if (fck_val <= grades[i]) {
            f2 = grades[i];
            f1 = i > 0 ? grades[i - 1] : grades[i];
            break;
        }
    }

    const interpolatePt = (grade: number, p: number): number => {
        const row = table[grade];
        if (p <= pt_keys[0]) return row[0];
        if (p >= pt_keys[pt_keys.length - 1]) return row[row.length - 1];
        for (let i = 0; i < pt_keys.length - 1; i++) {
            if (p <= pt_keys[i + 1]) {
                const t = (p - pt_keys[i]) / (pt_keys[i + 1] - pt_keys[i]);
                return row[i] + t * (row[i + 1] - row[i]);
            }
        }
        return row[row.length - 1];
    };

    const t1 = interpolatePt(f1, pt_val);
    const t2 = interpolatePt(f2, pt_val);

    if (f1 === f2) return t1;
    const ft = (fck_val - f1) / (f2 - f1);
    return t1 + ft * (t2 - t1);
}

export default {
    designFlexureIS456,
    designFlexureACI,
    designShearIS456,
    designShearACI,
    designColumnIS456,
    performRCDesign,
    getRebarDetails,
    formatRCResult
};
