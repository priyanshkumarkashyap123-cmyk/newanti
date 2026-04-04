/**
 * PrestressedConcreteDesign.ts - Prestressed Concrete Design
 * 
 * Features:
 * - Stress calculations at transfer and service
 * - Loss calculations (elastic, creep, shrinkage, relaxation)
 * - Ultimate moment capacity
 * - Shear design for prestressed sections
 * 
 * Codes: ACI 318-19, IS 1343
 */

// ============================================
// TYPES
// ============================================

export interface PrestressSection {
    b: number;           // Width (mm)
    bw: number;          // Web width (mm)
    h: number;           // Total height (mm)
    hf: number;          // Flange thickness (mm)
    Ac: number;          // Concrete area (mm²)
    Ic: number;          // Moment of inertia (mm⁴)
    yt: number;          // Distance to top fiber (mm)
    yb: number;          // Distance to bottom fiber (mm)
    Zt: number;          // Section modulus top (mm³)
    Zb: number;          // Section modulus bottom (mm³)
    e: number;           // Eccentricity of prestress (mm)
}

export interface PrestressTendon {
    Aps: number;         // Area of prestressing steel (mm²)
    fpu: number;         // Ultimate strength (MPa)
    fpy: number;         // Yield strength (MPa)
    fpi: number;         // Initial prestress (MPa)
    Eps: number;         // Modulus (MPa)
    dp: number;          // Depth to centroid (mm)
}

export interface PrestressMaterial {
    fci: number;         // Concrete at transfer (MPa)
    fc: number;          // Concrete at service (MPa)
    Eci: number;         // Initial modulus (MPa)
    Ec: number;          // Service modulus (MPa)
}

export interface Loads {
    Md: number;          // Dead load moment (kN·m)
    Ml: number;          // Live load moment (kN·m)
    Msw: number;         // Self-weight moment (kN·m)
}

export interface StressCheck {
    location: 'top' | 'bottom';
    stage: 'transfer' | 'service';
    stress: number;
    limit: number;
    ratio: number;
    status: 'OK' | 'NOT OK';
}

export interface LossBreakdown {
    elastic: number;
    anchorage: number;
    friction: number;
    creep: number;
    shrinkage: number;
    relaxation: number;
    total: number;
    effectivePrestress: number;
}

// ============================================
// PRESTRESSED CONCRETE DESIGNER
// ============================================

export class PrestressedConcreteDesigner {
    /**
     * Calculate all prestress losses
     */
    calculateLosses(
        section: PrestressSection,
        tendon: PrestressTendon,
        material: PrestressMaterial,
        spanLength: number,
        humidity: number = 70
    ): LossBreakdown {
        const { fpi, Aps, Eps } = tendon;
        const { Eci, Ec, fci, fc } = material;
        const { Ac, Ic, e } = section;
        const n = Eps / Eci;

        // Initial prestress force
        const Pi = fpi * Aps / 1000; // kN

        // 1. Elastic shortening (ACI 318 R20.3.2.6)
        const fcgp = (Pi * 1000 / Ac) + (Pi * 1000 * e ** 2 / Ic);
        const deltaES = n * fcgp / 2; // For post-tensioned

        // 2. Anchorage slip (typical 6mm)
        const anchorSlip = 6;
        const deltaANC = (anchorSlip * Eps) / (spanLength * 1000);

        // 3. Friction (for parabolic tendon)
        const mu = 0.20;   // Friction coefficient
        const K = 0.0066;  // Wobble coefficient
        const alpha = 8 * section.e / (spanLength * 1000); // Approximate
        const deltaFR = fpi * (1 - Math.exp(-(mu * alpha + K * spanLength)));

        // 4. Creep (ACI method simplified)
        const Ct = 2.0; // Ultimate creep coefficient
        const fcir = fcgp;
        const deltaCR = (Ct * fcir * Eps) / Ec;

        // 5. Shrinkage
        const epsilonSH = 0.0005 * (1 - humidity / 100);
        const deltaSH = epsilonSH * Eps;

        // 6. Relaxation (low-relaxation strand)
        const fpi_fpy = fpi / tendon.fpy;
        const deltaRE = fpi * (fpi_fpy - 0.55) * 0.045;

        // Total losses
        const total = deltaES + deltaANC + deltaFR + deltaCR + deltaSH + deltaRE;
        const effectivePrestress = fpi - total;

        return {
            elastic: deltaES,
            anchorage: deltaANC,
            friction: deltaFR,
            creep: deltaCR,
            shrinkage: deltaSH,
            relaxation: deltaRE,
            total,
            effectivePrestress
        };
    }

    /**
     * Check stresses at transfer and service
     */
    checkStresses(
        section: PrestressSection,
        tendon: PrestressTendon,
        material: PrestressMaterial,
        loads: Loads,
        losses: LossBreakdown
    ): StressCheck[] {
        const checks: StressCheck[] = [];
        const { Ac, Zt, Zb, e } = section;
        const { Aps, fpi } = tendon;
        const { fci, fc } = material;

        // Initial prestress force
        const Pi = fpi * Aps / 1000; // kN

        // Effective prestress force
        const Pe = losses.effectivePrestress * Aps / 1000;

        // Stress limits (ACI 318)
        const fti_limit = -0.25 * Math.sqrt(fci);  // Tension at transfer
        const fci_limit = 0.60 * fci;               // Compression at transfer
        const ft_limit = -0.50 * Math.sqrt(fc);    // Tension at service
        const fc_limit = 0.45 * fc;                 // Compression at service

        // At Transfer (with self-weight only)
        const ft_transfer = (-Pi * 1000 / Ac) - (Pi * 1000 * e / Zt) + (loads.Msw * 1e6 / Zt);
        const fb_transfer = (-Pi * 1000 / Ac) + (Pi * 1000 * e / Zb) - (loads.Msw * 1e6 / Zb);

        checks.push({
            location: 'top',
            stage: 'transfer',
            stress: ft_transfer,
            limit: fti_limit,
            ratio: Math.abs(ft_transfer / fti_limit),
            status: ft_transfer >= fti_limit ? 'OK' : 'NOT OK'
        });

        checks.push({
            location: 'bottom',
            stage: 'transfer',
            stress: fb_transfer,
            limit: fci_limit,
            ratio: Math.abs(fb_transfer / fci_limit),
            status: Math.abs(fb_transfer) <= fci_limit ? 'OK' : 'NOT OK'
        });

        // At Service (with all loads)
        const Mservice = loads.Msw + loads.Md + loads.Ml;
        const ft_service = (-Pe * 1000 / Ac) - (Pe * 1000 * e / Zt) + (Mservice * 1e6 / Zt);
        const fb_service = (-Pe * 1000 / Ac) + (Pe * 1000 * e / Zb) - (Mservice * 1e6 / Zb);

        checks.push({
            location: 'top',
            stage: 'service',
            stress: ft_service,
            limit: fc_limit,
            ratio: Math.abs(ft_service / fc_limit),
            status: Math.abs(ft_service) <= fc_limit ? 'OK' : 'NOT OK'
        });

        checks.push({
            location: 'bottom',
            stage: 'service',
            stress: fb_service,
            limit: ft_limit,
            ratio: fb_service < 0 ? Math.abs(fb_service / ft_limit) : 0,
            status: fb_service >= ft_limit ? 'OK' : 'NOT OK'
        });

        return checks;
    }

    /**
     * Calculate ultimate moment capacity (ACI 318 22.3)
     */
    calculateUltimateMoment(
        section: PrestressSection,
        tendon: PrestressTendon,
        material: PrestressMaterial
    ): { Mn: number; fps: number; c: number; phi_Mn: number } {
        const { Aps, fpu, fpy, Eps, dp } = tendon;
        const { fc } = material;
        const { b } = section;

        // Stress in prestressing steel at nominal (ACI 20.3.2.3.1)
        const rho_p = Aps / (b * dp);
        const gamma_p = 0.28; // Low-relaxation
        const beta1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 28) / 7);

        const fps = fpu * (1 - (gamma_p / beta1) * (rho_p * fpu / fc));

        // Neutral axis depth
        const a = (Aps * fps) / (0.85 * fc * b);
        const c = a / beta1;

        // Nominal moment
        const Mn = Aps * fps * (dp - a / 2) / 1e6; // kN·m

        // Apply strength reduction
        const epsilon_t = 0.003 * (dp - c) / c;
        const phi = epsilon_t >= 0.005 ? 0.90 : 0.65 + (epsilon_t - 0.002) * 250 / 3;

        return { Mn, fps, c, phi_Mn: phi * Mn };
    }

    /**
     * Shear design for prestressed section
     */
    calculateShearCapacity(
        section: PrestressSection,
        tendon: PrestressTendon,
        material: PrestressMaterial,
        Vu: number,
        Mu: number,
        losses: LossBreakdown
    ): { Vc: number; Vs_required: number; status: 'OK' | 'NEEDS_STIRRUPS' } {
        const { bw } = section;
        const d = tendon.dp;
        const { fc } = material;
        const Pe = losses.effectivePrestress * tendon.Aps / 1000;

        // Concrete shear capacity (ACI 22.5.8.3.1)
        const fpc = Pe * 1000 / section.Ac;
        const Vp = 0; // Simplified - no parabolic component

        const Vc1 = (0.05 * Math.sqrt(fc) + 4.8 * Vu * d / (Mu * 1000)) * bw * d / 1000;
        const Vc2 = (0.14 * Math.sqrt(fc) * bw * d / 1000) + Vp;
        const Vc = Math.min(Vc1, Vc2);

        const phi = 0.75;
        const Vs_required = Math.max(0, (Vu / phi) - Vc);

        return {
            Vc,
            Vs_required,
            status: Vs_required > 0 ? 'NEEDS_STIRRUPS' : 'OK'
        };
    }
}

// Export singleton
export const prestressDesign = new PrestressedConcreteDesigner();
export default PrestressedConcreteDesigner;
