/**
 * AISCSeismicChecker.ts
 * 
 * AISC 341-22 Seismic Provisions for Structural Steel Buildings
 * 
 * Features:
 * - Seismic Design Categories
 * - R, Cd, Ω0 factors
 * - SMF/IMF/OMF requirements
 * - SCBF/OCBF/EBF requirements
 * - Special seismic detailing
 */

import { AISCMember, AISCForces, AISCCheck, W_SHAPES, AISC_MATERIALS } from './AISC360Checker';

// ============================================
// SEISMIC TYPES
// ============================================

export type SeismicDesignCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type SeismicSystemType =
    | 'SMF'    // Special Moment Frame
    | 'IMF'    // Intermediate Moment Frame
    | 'OMF'    // Ordinary Moment Frame
    | 'SCBF'   // Special Concentrically Braced Frame
    | 'OCBF'   // Ordinary Concentrically Braced Frame
    | 'EBF'    // Eccentrically Braced Frame
    | 'BRBF'   // Buckling-Restrained Braced Frame
    | 'SPSW';  // Special Plate Shear Wall

export interface SeismicSystemFactors {
    R: number;      // Response modification coefficient
    Cd: number;     // Deflection amplification factor
    Omega0: number; // Overstrength factor
    heightLimit: number | null; // Height limit in feet (null = unlimited)
}

export interface SeismicMember extends AISCMember {
    system: SeismicSystemType;
    isBeam: boolean;
    isColumn: boolean;
    isBrace?: boolean;
    storyDrift?: number; // Story drift ratio (Δ/h)
}

export interface SeismicCheck extends AISCCheck {
    clause341: string;
    requirement: string;
}

// ============================================
// SEISMIC SYSTEM FACTORS (ASCE 7)
// ============================================

export const SEISMIC_FACTORS: Record<SeismicSystemType, SeismicSystemFactors> = {
    'SMF': { R: 8, Cd: 5.5, Omega0: 3, heightLimit: null },
    'IMF': { R: 4.5, Cd: 4, Omega0: 3, heightLimit: 35 }, // SDC D,E,F
    'OMF': { R: 3.5, Cd: 3, Omega0: 3, heightLimit: null }, // Only SDC A,B,C
    'SCBF': { R: 6, Cd: 5, Omega0: 2, heightLimit: 160 },
    'OCBF': { R: 3.25, Cd: 3.25, Omega0: 2, heightLimit: 35 }, // SDC D,E,F
    'EBF': { R: 8, Cd: 4, Omega0: 2.5, heightLimit: 160 },
    'BRBF': { R: 8, Cd: 5, Omega0: 2.5, heightLimit: 160 },
    'SPSW': { R: 7, Cd: 6, Omega0: 2, heightLimit: 160 },
};

// ============================================
// LOCAL BUCKLING LIMITS (Table D1.1)
// ============================================

const HIGHLY_DUCTILE_LIMITS = {
    flangeRatio: 0.30,  // 0.30 * sqrt(E/Fy)
    webRatio: 2.45,     // 2.45 * sqrt(E/Fy) for Ca ≤ 0.114
};

const MODERATELY_DUCTILE_LIMITS = {
    flangeRatio: 0.38,
    webRatio: 3.76,
};

// ============================================
// AISC 341 SEISMIC CHECKER
// ============================================

export class AISCSeismicChecker {
    /**
     * Get seismic design factors
     */
    getFactors(system: SeismicSystemType): SeismicSystemFactors {
        return SEISMIC_FACTORS[system];
    }

    /**
     * Check if system is permitted for SDC
     */
    isSystemPermitted(system: SeismicSystemType, sdc: SeismicDesignCategory): boolean {
        // OMF only in SDC A, B, C
        if (system === 'OMF' && ['D', 'E', 'F'].includes(sdc)) {
            return false;
        }
        // IMF/OCBF limited in SDC D, E, F
        if ((system === 'IMF' || system === 'OCBF') && ['D', 'E', 'F'].includes(sdc)) {
            // Permitted with height limits
            return true;
        }
        return true;
    }

    /**
     * Check height limit
     */
    checkHeightLimit(
        system: SeismicSystemType,
        height_ft: number
    ): SeismicCheck {
        const factors = SEISMIC_FACTORS[system];
        const limit = factors.heightLimit;

        if (limit === null) {
            return {
                chapter: 'ASCE 7',
                section: 'Table 12.2-1',
                clause341: 'N/A',
                title: 'Height Limit',
                requirement: 'No height limit',
                Rn: Infinity,
                phiRn: Infinity,
                Ru: height_ft,
                ratio: 0,
                status: 'OK'
            };
        }

        return {
            chapter: 'ASCE 7',
            section: 'Table 12.2-1',
            clause341: 'N/A',
            title: 'Height Limit',
            requirement: `Height ≤ ${limit} ft`,
            Rn: limit,
            phiRn: limit,
            Ru: height_ft,
            ratio: height_ft / limit,
            status: height_ft <= limit ? 'OK' : 'NG'
        };
    }

    /**
     * D1.1: Width-to-Thickness Limitations
     */
    checkLocalBuckling(
        member: SeismicMember,
        ductility: 'high' | 'moderate'
    ): SeismicCheck[] {
        const checks: SeismicCheck[] = [];
        const { section, material } = member;
        const { Fy, E } = material;

        const limits = ductility === 'high' ? HIGHLY_DUCTILE_LIMITS : MODERATELY_DUCTILE_LIMITS;
        const sqrtEFy = Math.sqrt(E / Fy);

        // Flange check (b/2t)
        const flangeRatio = section.bf / (2 * section.tf);
        const flangeLimit = limits.flangeRatio * sqrtEFy;

        checks.push({
            chapter: 'D',
            section: 'D1.1',
            clause341: 'D1.1b',
            title: `Flange (${ductility}ly ductile)`,
            requirement: `b/2tf ≤ ${limits.flangeRatio}√(E/Fy)`,
            Rn: flangeLimit,
            phiRn: flangeLimit,
            Ru: flangeRatio,
            ratio: flangeRatio / flangeLimit,
            status: flangeRatio <= flangeLimit ? 'OK' : 'NG'
        });

        // Web check (h/tw)
        const webRatio = (section.d - 2 * section.tf) / section.tw;
        const webLimit = limits.webRatio * sqrtEFy;

        checks.push({
            chapter: 'D',
            section: 'D1.1',
            clause341: 'D1.1b',
            title: `Web (${ductility}ly ductile)`,
            requirement: `h/tw ≤ ${limits.webRatio}√(E/Fy)`,
            Rn: webLimit,
            phiRn: webLimit,
            Ru: webRatio,
            ratio: webRatio / webLimit,
            status: webRatio <= webLimit ? 'OK' : 'NG'
        });

        return checks;
    }

    /**
     * E2: Story Drift Limit
     */
    checkStoryDrift(
        driftRatio: number,
        riskCategory: 'I' | 'II' | 'III' | 'IV' = 'II'
    ): SeismicCheck {
        // ASCE 7 Table 12.12-1
        let limit: number;
        switch (riskCategory) {
            case 'I':
            case 'II':
                limit = 0.020; // 2% for Risk Cat I/II moment frames
                break;
            case 'III':
                limit = 0.015;
                break;
            case 'IV':
                limit = 0.010;
                break;
        }

        return {
            chapter: 'ASCE 7',
            section: '12.12',
            clause341: 'E2',
            title: 'Story Drift',
            requirement: `Δ/h ≤ ${(limit * 100).toFixed(1)}%`,
            Rn: limit,
            phiRn: limit,
            Ru: driftRatio,
            ratio: driftRatio / limit,
            status: driftRatio <= limit ? 'OK' : 'NG'
        };
    }

    /**
     * E3: SMF Beam Requirements
     */
    checkSMFBeam(member: SeismicMember): SeismicCheck[] {
        const checks: SeismicCheck[] = [];
        const { section, material, Lb } = member;
        const { Fy, E } = material;

        // E3.4a: Beam bracing (Lb ≤ 0.095ryE/Fy)
        const Lb_limit = 0.095 * section.ry * E / Fy;

        checks.push({
            chapter: 'E',
            section: 'E3.4a',
            clause341: 'E3.4a',
            title: 'Beam Bracing',
            requirement: `Lb ≤ 0.095ryE/Fy`,
            Rn: Lb_limit,
            phiRn: Lb_limit,
            Ru: Lb,
            ratio: Lb / Lb_limit,
            status: Lb <= Lb_limit ? 'OK' : 'NG',
            notes: `Limit = ${Lb_limit.toFixed(1)} in`
        });

        // Add local buckling checks
        checks.push(...this.checkLocalBuckling(member, 'high'));

        return checks;
    }

    /**
     * E3: Strong-Column-Weak-Beam
     */
    checkSCWB(
        sumMpColumns: number,  // Σ(M*pc) of columns at joint
        sumMpBeams: number     // Σ(Mpb) of beams at joint
    ): SeismicCheck {
        // E3.4c: Σ M*pc ≥ Σ M*pb
        const ratio = sumMpBeams / sumMpColumns;

        return {
            chapter: 'E',
            section: 'E3.4c',
            clause341: 'E3.4c',
            title: 'Strong-Column-Weak-Beam',
            requirement: 'Σ M*pc ≥ Σ M*pb',
            Rn: sumMpColumns,
            phiRn: sumMpColumns,
            Ru: sumMpBeams,
            ratio: ratio,
            status: ratio <= 1.0 ? 'OK' : 'NG',
            notes: `Column/Beam ratio = ${(1 / ratio).toFixed(2)}`
        };
    }

    /**
     * F2: SCBF Brace Requirements
     */
    checkSCBFBrace(member: SeismicMember): SeismicCheck[] {
        const checks: SeismicCheck[] = [];
        const { section, material, Lc } = member;
        const { Fy, E } = material;
        const { rx, ry, A } = section;

        const r = Math.min(rx, ry);
        const KLr = Lc / r;

        // F2.5a: Slenderness limit
        const slenderLimit = 200;

        checks.push({
            chapter: 'F',
            section: 'F2.5a',
            clause341: 'F2.5a',
            title: 'Brace Slenderness',
            requirement: 'KL/r ≤ 200',
            Rn: slenderLimit,
            phiRn: slenderLimit,
            Ru: KLr,
            ratio: KLr / slenderLimit,
            status: KLr <= slenderLimit ? 'OK' : 'NG'
        });

        // Local buckling
        checks.push(...this.checkLocalBuckling({ ...member, isBeam: false, isColumn: false }, 'high'));

        return checks;
    }

    /**
     * Run all seismic checks for a member
     */
    checkMember(
        member: SeismicMember,
        forces: AISCForces,
        options?: {
            sdc?: SeismicDesignCategory;
            driftRatio?: number;
            riskCategory?: 'I' | 'II' | 'III' | 'IV';
        }
    ): SeismicCheck[] {
        const checks: SeismicCheck[] = [];
        const { system, isBeam, isColumn, isBrace } = member;

        // Height limit (if provided)
        // checks.push(this.checkHeightLimit(system, options?.height_ft || 50));

        // Story drift
        if (options?.driftRatio !== undefined) {
            checks.push(this.checkStoryDrift(options.driftRatio, options.riskCategory));
        }

        // System-specific checks
        switch (system) {
            case 'SMF':
                if (isBeam) {
                    checks.push(...this.checkSMFBeam(member));
                }
                if (isColumn) {
                    checks.push(...this.checkLocalBuckling(member, 'high'));
                }
                break;

            case 'IMF':
                checks.push(...this.checkLocalBuckling(member, 'moderate'));
                break;

            case 'SCBF':
                if (isBrace) {
                    checks.push(...this.checkSCBFBrace(member));
                } else {
                    checks.push(...this.checkLocalBuckling(member, 'high'));
                }
                break;

            case 'OCBF':
                checks.push(...this.checkLocalBuckling(member, 'moderate'));
                break;

            default:
                // Default moderate ductility checks
                checks.push(...this.checkLocalBuckling(member, 'moderate'));
        }

        return checks;
    }

    /**
     * Quick check for seismic member
     */
    quickCheck(
        shapeName: string,
        system: SeismicSystemType,
        memberType: 'beam' | 'column' | 'brace',
        Lb_ft: number
    ): { passed: boolean; maxRatio: number; critical: string; checks: SeismicCheck[] } {
        const section = W_SHAPES[shapeName];
        if (!section) {
            throw new Error(`Unknown section: ${shapeName}`);
        }

        const member: SeismicMember = {
            section,
            material: AISC_MATERIALS['A992'],
            Lb: Lb_ft * 12,
            Lc: Lb_ft * 12,
            system,
            isBeam: memberType === 'beam',
            isColumn: memberType === 'column',
            isBrace: memberType === 'brace'
        };

        const checks = this.checkMember(member, { Pr: 0, Mrx: 0, Mry: 0, Vr: 0 });

        if (checks.length === 0) {
            return { passed: true, maxRatio: 0, critical: 'No checks required', checks: [] };
        }

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

export const aiscSeismic = new AISCSeismicChecker();

export default AISCSeismicChecker;
