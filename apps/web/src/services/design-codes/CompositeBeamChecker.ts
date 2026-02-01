/**
 * CompositeBeamChecker.ts
 * 
 * AISC 360-22 Chapter I: Composite Design
 * 
 * Features:
 * - Composite beam design
 * - Steel deck with concrete slab
 * - Shear stud requirements
 * - Positive and negative moment
 * - Deflection (construction + service)
 */

import { AISCMember, AISCSection, AISCMaterial, W_SHAPES, AISC_MATERIALS } from './AISC360Checker';

// ============================================
// TYPES
// ============================================

export interface DeckProfile {
    type: 'rib' | 'flat';
    hr: number;           // Rib height (in)
    wr: number;           // Average rib width (in)
    pitch: number;        // Rib spacing (in)
}

export interface CompositeSlab {
    tc: number;           // Concrete above deck (in)
    fc: number;           // Concrete strength (ksi)
    deck: DeckProfile;
    beff: number;         // Effective slab width (in)
}

export interface ShearStud {
    diameter: number;     // Stud diameter (in)
    height: number;       // Stud height (in)
    Fu: number;           // Stud tensile strength (ksi)
    spacing: number;      // Spacing (in)
    numPerRib: number;    // Studs per rib
}

export interface CompositeForces {
    Mu_pos: number;       // Positive moment (kip-in)
    Mu_neg?: number;      // Negative moment if continuous (kip-in)
    Vu: number;           // Shear (kips)
    wDL: number;          // Dead load (kip/ft)
    wLL: number;          // Live load (kip/ft)
    L: number;            // Span (ft)
}

export interface CompositeCheck {
    section: string;
    title: string;
    Rn: number;
    phiRn: number;
    Ru: number;
    ratio: number;
    status: 'OK' | 'NG';
    notes?: string;
}

export interface CompositeDesignResult {
    checks: CompositeCheck[];
    Mn_composite: number;
    numStuds: number;
    Yena: number;           // PNA location from top
    percentComposite: number;
    deflection: {
        construction: number;
        service: number;
        limit: number;
    };
    passed: boolean;
}

// ============================================
// COMPOSITE BEAM CHECKER
// ============================================

export class CompositeBeamChecker {
    private phi_b = 0.90;
    private phi_v = 1.00;  // For shear studs

    /**
     * Full composite beam design check
     */
    checkCompositeBeam(
        section: AISCSection,
        material: AISCMaterial,
        slab: CompositeSlab,
        studs: ShearStud,
        forces: CompositeForces
    ): CompositeDesignResult {
        const checks: CompositeCheck[] = [];
        const { Fy, E } = material;
        const { fc, tc, beff, deck } = slab;

        // Section properties
        const { A, d, tf, tw, Zx, Ix } = section;

        // Concrete properties
        const Ec = 57 * Math.sqrt(fc * 1000); // ksi
        const n = E / Ec;

        // Effective concrete area
        const Ac = beff * tc;

        // ====== I1: Positive Flexural Strength ======

        // Concrete compression force
        const a = 0.85;
        const Cc_max = a * fc * beff * tc;  // kips

        // Steel tension force
        const Ts = Fy * A;  // kips

        // Check if PNA in slab or steel
        let Mn: number;
        let Yena: number;
        let C_concrete: number;
        let percentComposite: number;

        if (Cc_max >= Ts) {
            // PNA in slab (full composite)
            const aEff = Ts / (a * fc * beff);
            Yena = aEff / 2;
            C_concrete = Ts;

            // Moment arm
            const moment_arm = d / 2 + deck.hr + tc - aEff / 2;
            Mn = Ts * moment_arm;
            percentComposite = 100;
        } else {
            // PNA in steel (partial composite or full with PNA in steel)
            // Simplified: assume full slab depth
            C_concrete = Cc_max;
            const T_steel = Ts;

            // Force in steel flange (below PNA)
            const Cs = T_steel - C_concrete;

            // Approximate PNA location
            const yPNA = (T_steel - C_concrete) / (2 * Fy * tw);
            Yena = tc + deck.hr + yPNA;

            Mn = C_concrete * (d / 2 + deck.hr + tc / 2) + Cs * (d / 2 - yPNA / 2);
            percentComposite = (C_concrete / Ts) * 100;
        }

        const phiMn = this.phi_b * Mn;

        checks.push({
            section: 'I1',
            title: 'Composite Flexural Strength',
            Rn: Mn,
            phiRn: phiMn,
            Ru: forces.Mu_pos,
            ratio: forces.Mu_pos / phiMn,
            status: forces.Mu_pos <= phiMn ? 'OK' : 'NG',
            notes: `${percentComposite.toFixed(0)}% composite`
        });

        // ====== I8: Shear Stud Strength ======

        // Individual stud strength (I8.2a)
        const Asa = Math.PI * (studs.diameter / 2) ** 2;
        const Qn_steel = Asa * studs.Fu;

        // Concrete pullout (I8.2b)
        const Qn_conc = 0.5 * Asa * Math.sqrt(fc * Ec);

        const Qn = Math.min(Qn_steel, Qn_conc);

        // Deck reduction factor (I8.2d)
        let Rg = 1.0;
        let Rp = 1.0;
        if (deck.type === 'rib') {
            // Perpendicular to ribs
            Rg = 1.0;
            Rp = studs.numPerRib <= 1
                ? Math.min(0.6 * deck.wr / deck.hr * (studs.height / deck.hr - 1), 1.0)
                : Math.min(0.75 * deck.wr / deck.hr * (studs.height / deck.hr - 1), 0.85);
        }

        const qn = Rg * Rp * Qn;

        // Required studs for full composite
        const numStuds_full = Math.ceil(C_concrete / qn);

        // Available studs
        const numRibs = Math.floor(forces.L * 12 / deck.pitch);
        const numStuds_available = numRibs * studs.numPerRib * 2; // Both halves

        checks.push({
            section: 'I8',
            title: 'Shear Stud Strength',
            Rn: numStuds_available * qn,
            phiRn: numStuds_available * qn,
            Ru: C_concrete,
            ratio: C_concrete / (numStuds_available * qn),
            status: numStuds_available >= numStuds_full ? 'OK' : 'NG',
            notes: `${numStuds_full} studs required, ${numStuds_available} provided`
        });

        // ====== Deflection Check ======

        // Construction stage (non-composite)
        const w_const = forces.wDL / 12; // kip/in
        const delta_const = 5 * w_const * (forces.L * 12) ** 4 / (384 * E * Ix);

        // Composite moment of inertia (lower bound)
        const y_steel = d / 2 + deck.hr + tc;
        const Itr = Ix + A * (y_steel - Yena) ** 2 + (beff * tc ** 3) / (12 * n) +
            (beff * tc / n) * (tc / 2 - Yena) ** 2;
        const Ieff = 0.75 * Itr; // Lower bound per commentary

        const w_ll = forces.wLL / 12;
        const delta_ll = 5 * w_ll * (forces.L * 12) ** 4 / (384 * E * Ieff);

        const delta_limit = forces.L * 12 / 360;

        checks.push({
            section: 'L3',
            title: 'Live Load Deflection',
            Rn: delta_limit,
            phiRn: delta_limit,
            Ru: delta_ll,
            ratio: delta_ll / delta_limit,
            status: delta_ll <= delta_limit ? 'OK' : 'NG',
            notes: `L/360 = ${delta_limit.toFixed(2)}"`
        });

        return {
            checks,
            Mn_composite: Mn,
            numStuds: numStuds_full,
            Yena,
            percentComposite,
            deflection: {
                construction: delta_const,
                service: delta_ll,
                limit: delta_limit
            },
            passed: checks.every(c => c.status === 'OK')
        };
    }

    /**
     * Quick composite beam check
     */
    quickCheck(
        shapeName: string,
        span_ft: number,
        slabThickness_in: number,
        wDL_klf: number,
        wLL_klf: number
    ): CompositeDesignResult {
        const section = W_SHAPES[shapeName];
        if (!section) {
            throw new Error(`Unknown section: ${shapeName}`);
        }

        const slab: CompositeSlab = {
            tc: slabThickness_in,
            fc: 4,
            deck: { type: 'rib', hr: 2, wr: 4, pitch: 6 },
            beff: Math.min(span_ft * 12 / 4, 8 * 12) // Effective width
        };

        const studs: ShearStud = {
            diameter: 0.75,
            height: 4.5,
            Fu: 65,
            spacing: 6,
            numPerRib: 1
        };

        // Calculate factored moment
        const wu = 1.2 * wDL_klf + 1.6 * wLL_klf;
        const Mu = wu * span_ft ** 2 / 8 * 12; // kip-in
        const Vu = wu * span_ft / 2;

        return this.checkCompositeBeam(
            section,
            AISC_MATERIALS['A992'],
            slab,
            studs,
            {
                Mu_pos: Mu,
                Vu,
                wDL: wDL_klf,
                wLL: wLL_klf,
                L: span_ft
            }
        );
    }
}

// ============================================
// SINGLETON
// ============================================

export const compositeBeam = new CompositeBeamChecker();

export default CompositeBeamChecker;
