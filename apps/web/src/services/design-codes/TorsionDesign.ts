/**
 * TorsionDesign.ts - Torsion Design per ACI 318-19 and EC2
 * 
 * Features:
 * - Torsional threshold check
 * - Compatibility vs equilibrium torsion
 * - Transverse and longitudinal reinforcement
 * - Combined shear and torsion
 */

// ============================================
// TYPES
// ============================================

export interface TorsionSection {
    b: number;          // Width (mm)
    h: number;          // Height (mm)
    cover: number;      // Cover (mm)
    Acp: number;        // Area enclosed by perimeter (mm²)
    pcp: number;        // Outside perimeter (mm)
    Aoh: number;        // Area enclosed by centerline of stirrups (mm²)
    ph: number;         // Perimeter of Aoh (mm)
}

export interface TorsionForces {
    Tu: number;         // Factored torsion (kN·m)
    Vu: number;         // Factored shear (kN)
    Nu?: number;        // Axial force if any (kN)
}

export interface TorsionMaterial {
    fc: number;         // Concrete strength (MPa)
    fy: number;         // Stirrup yield (MPa)
    fyl: number;        // Longitudinal steel yield (MPa)
}

export interface TorsionResult {
    torsionSignificant: boolean;
    Tcr: number;        // Cracking torsion (kN·m)
    At_s: number;       // Transverse reinforcement (mm²/mm)
    Al: number;         // Longitudinal reinforcement (mm²)
    combinedCheck: number;
    status: 'PASS' | 'FAIL';
    stirrupSize: number;
    stirrupSpacing: number;
    longitudinalBars: { size: number; count: number };
}

// ============================================
// ACI 318 TORSION DESIGN
// ============================================

export class ACITorsionDesigner {
    private phi = 0.75;
    private lambda = 1.0; // Normal weight concrete

    /**
     * Design for torsion per ACI 318-19 Chapter 22
     */
    designTorsion(
        section: TorsionSection,
        forces: TorsionForces,
        material: TorsionMaterial
    ): TorsionResult {
        const { Tu, Vu } = forces;
        const { fc, fy, fyl } = material;

        // Calculate section properties
        const Acp = section.b * section.h;
        const pcp = 2 * (section.b + section.h);
        const x0 = section.b - 2 * section.cover;
        const y0 = section.h - 2 * section.cover;
        const Aoh = x0 * y0;
        const ph = 2 * (x0 + y0);
        const Ao = 0.85 * Aoh;

        // Threshold torsion (ACI 22.7.4)
        const Tcr = this.phi * 0.083 * this.lambda * Math.sqrt(fc) * (Acp ** 2 / pcp) / 1e6;

        // Check if torsion is significant
        const torsionSignificant = Tu > 0.25 * Tcr;

        if (!torsionSignificant) {
            return {
                torsionSignificant: false,
                Tcr,
                At_s: 0,
                Al: 0,
                combinedCheck: 0,
                status: 'PASS',
                stirrupSize: 0,
                stirrupSpacing: 0,
                longitudinalBars: { size: 0, count: 0 }
            };
        }

        // Check maximum torsion (ACI 22.7.6)
        const d = section.h - section.cover - 16; // Assume 16mm stirrup
        const bw = section.b;
        const Vc = 0.17 * this.lambda * Math.sqrt(fc) * bw * d / 1000;

        const term1 = (Vu / (bw * d)) ** 2;
        const term2 = ((Tu * 1e6 * ph) / (1.7 * Aoh ** 2)) ** 2;
        const combined = Math.sqrt(term1 + term2);
        const limit = this.phi * (Vc / (bw * d) + 0.66 * Math.sqrt(fc));

        if (combined > limit) {
            return {
                torsionSignificant: true,
                Tcr,
                At_s: 0,
                Al: 0,
                combinedCheck: combined / limit,
                status: 'FAIL',
                stirrupSize: 0,
                stirrupSpacing: 0,
                longitudinalBars: { size: 0, count: 0 }
            };
        }

        // Transverse reinforcement (ACI 22.7.6.1)
        const theta = 45; // degrees
        const cot_theta = 1 / Math.tan(theta * Math.PI / 180);
        const At_s = (Tu * 1e6) / (this.phi * 2 * Ao * fy * cot_theta); // mm²/mm

        // Longitudinal reinforcement (ACI 22.7.6.2)
        const Al = (At_s * ph * (fyl / fy) * cot_theta ** 2);

        // Minimum reinforcement
        const At_s_min = 0.062 * Math.sqrt(fc) * bw / fy;
        const Al_min = (0.42 * Math.sqrt(fc) * Acp / fyl) - (At_s * ph * fyl / fy);

        const At_s_design = Math.max(At_s, At_s_min);
        const Al_design = Math.max(Al, Al_min, 0);

        // Select stirrups
        const stirrupSize = At_s_design > 0.8 ? 12 : 10;
        const At = Math.PI * stirrupSize ** 2 / 4;
        const stirrupSpacing = Math.min(
            Math.floor(At / At_s_design),
            ph / 8,
            300
        );

        // Select longitudinal bars
        const barSize = 16;
        const barArea = Math.PI * barSize ** 2 / 4;
        const barCount = Math.ceil(Al_design / barArea);

        return {
            torsionSignificant: true,
            Tcr,
            At_s: At_s_design,
            Al: Al_design,
            combinedCheck: combined / limit,
            status: 'PASS',
            stirrupSize,
            stirrupSpacing,
            longitudinalBars: { size: barSize, count: Math.max(barCount, 4) }
        };
    }

    /**
     * Combined shear and torsion reinforcement
     */
    combineShearTorsion(
        Av_s_shear: number,   // mm²/mm from shear
        At_s_torsion: number   // mm²/mm from torsion (one leg)
    ): { Av_s_total: number; twoLegs: number } {
        // Total stirrup area per unit length
        const Av_s_total = Av_s_shear + 2 * At_s_torsion;
        const twoLegs = Av_s_total;
        return { Av_s_total, twoLegs };
    }
}

// ============================================
// EC2 TORSION DESIGN
// ============================================

export class EC2TorsionDesigner {
    private nu = 0.6; // Efficiency factor

    /**
     * Design for torsion per EN 1992-1-1 6.3
     */
    designTorsionEC2(
        section: TorsionSection,
        forces: TorsionForces,
        material: TorsionMaterial
    ): TorsionResult {
        const { Tu } = forces;
        const { fc, fy } = material;

        // Effective wall thickness
        const A = section.b * section.h;
        const u = 2 * (section.b + section.h);
        const tef = Math.max(A / u, 2 * section.cover);

        // Area enclosed by centre-lines
        const Ak = (section.b - tef) * (section.h - tef);
        const uk = 2 * ((section.b - tef) + (section.h - tef));

        // Maximum torsion (EC2 6.3.2)
        const fcd = fc / 1.5;
        const TRd_max = 2 * this.nu * fcd * Ak * tef / 1e6;

        if (Tu > TRd_max) {
            return {
                torsionSignificant: true,
                Tcr: TRd_max,
                At_s: 0,
                Al: 0,
                combinedCheck: Tu / TRd_max,
                status: 'FAIL',
                stirrupSize: 0,
                stirrupSpacing: 0,
                longitudinalBars: { size: 0, count: 0 }
            };
        }

        // Required reinforcement
        const theta = 45;
        const cot_theta = 1 / Math.tan(theta * Math.PI / 180);
        const fywd = fy / 1.15;

        const Asw_s = (Tu * 1e6) / (2 * Ak * fywd * cot_theta);
        const Asl = (Tu * 1e6 * uk * cot_theta) / (2 * Ak * fywd);

        // Select reinforcement
        const stirrupSize = Asw_s > 0.8 ? 12 : 10;
        const stirrupSpacing = Math.floor((Math.PI * stirrupSize ** 2 / 4) / Asw_s);

        return {
            torsionSignificant: Tu > 0,
            Tcr: TRd_max,
            At_s: Asw_s,
            Al: Asl,
            combinedCheck: Tu / TRd_max,
            status: 'PASS',
            stirrupSize,
            stirrupSpacing: Math.min(stirrupSpacing, 300),
            longitudinalBars: { size: 16, count: Math.ceil(Asl / 201) }
        };
    }
}

// Export instances
export const aciTorsion = new ACITorsionDesigner();
export const ec2Torsion = new EC2TorsionDesigner();
