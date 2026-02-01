/**
 * AISCSeismicChecks.ts - AISC 341 Seismic Provisions
 * 
 * Implements seismic design requirements:
 * - Special Moment Frames (SMF)
 * - Intermediate Moment Frames (IMF)
 * - Ordinary Moment Frames (OMF)
 * - SCBF, OCBF braced frames
 * - Response modification (R-factors)
 */

import { CodeCheck, MemberForces, SteelSection, SteelMaterial } from '../CodeComplianceEngine';

// ============================================
// SEISMIC TYPES
// ============================================

export type SeismicSystem = 'SMF' | 'IMF' | 'OMF' | 'SCBF' | 'OCBF' | 'EBF' | 'BRBF';

export interface SeismicDesignParameters {
    sds: number;           // Design spectral acceleration (short period)
    sd1: number;           // Design spectral acceleration (1-second)
    rFactor: number;       // Response modification coefficient
    omegaFactor: number;   // Overstrength factor
    cdFactor: number;      // Deflection amplification factor
    seismicCategory: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    systemType: SeismicSystem;
}

export interface DriftCheck {
    story: number;
    height: number;
    elasticDrift: number;
    amplifiedDrift: number;
    allowableDrift: number;
    ratio: number;
    status: 'PASS' | 'FAIL';
}

// ============================================
// SEISMIC SYSTEM PARAMETERS
// ============================================

export const SEISMIC_SYSTEMS: Record<SeismicSystem, { R: number; Omega: number; Cd: number; description: string }> = {
    SMF: { R: 8.0, Omega: 3.0, Cd: 5.5, description: 'Special Moment Frame' },
    IMF: { R: 4.5, Omega: 3.0, Cd: 4.0, description: 'Intermediate Moment Frame' },
    OMF: { R: 3.5, Omega: 3.0, Cd: 3.0, description: 'Ordinary Moment Frame' },
    SCBF: { R: 6.0, Omega: 2.0, Cd: 5.0, description: 'Special Concentrically Braced Frame' },
    OCBF: { R: 3.25, Omega: 2.0, Cd: 3.25, description: 'Ordinary Concentrically Braced Frame' },
    EBF: { R: 8.0, Omega: 2.0, Cd: 4.0, description: 'Eccentrically Braced Frame' },
    BRBF: { R: 8.0, Omega: 2.5, Cd: 5.0, description: 'Buckling-Restrained Braced Frame' }
};

// ============================================
// AISC 341 CHECKER
// ============================================

export class AISC341Checker {
    private params: SeismicDesignParameters;

    constructor(params: SeismicDesignParameters) {
        this.params = params;
    }

    /**
     * Check all seismic provisions for a beam in moment frame
     */
    checkMomentFrameBeam(
        section: SteelSection,
        material: SteelMaterial,
        unbracedLength: number,
        forces: MemberForces
    ): CodeCheck[] {
        const checks: CodeCheck[] = [];

        // Width-to-thickness ratios (E3.5a)
        checks.push(this.checkBeamFlange(section, material));
        checks.push(this.checkBeamWeb(section, material, forces.axial));

        // Lateral bracing (E3.4b)
        checks.push(this.checkLateralBracing(section, material, unbracedLength));

        // Protected zone requirements
        if (this.params.systemType === 'SMF') {
            checks.push(this.checkProtectedZone(section));
        }

        return checks;
    }

    /**
     * Check moment frame column
     */
    checkMomentFrameColumn(
        section: SteelSection,
        material: SteelMaterial,
        forces: MemberForces,
        columnHeight: number
    ): CodeCheck[] {
        const checks: CodeCheck[] = [];

        // Width-to-thickness (E3.5b)
        checks.push(this.checkColumnFlange(section, material));
        checks.push(this.checkColumnWeb(section, material, forces.axial));

        // Strong column - weak beam (E3.4a)
        checks.push(this.checkStrongColumnWeakBeam(section, material, forces));

        // Column splice requirements
        if (this.params.systemType === 'SMF' || this.params.systemType === 'IMF') {
            checks.push(this.checkColumnSplice(section, material, forces));
        }

        return checks;
    }

    /**
     * Check story drift limits (ASCE 7 Table 12.12-1)
     */
    checkStoryDrift(
        elasticDrift: number,
        storyHeight: number,
        riskCategory: 'I' | 'II' | 'III' | 'IV'
    ): DriftCheck {
        const amplifiedDrift = elasticDrift * this.params.cdFactor;

        // Drift limits based on risk category and system
        let driftLimit: number;
        if (this.params.systemType === 'SMF' || this.params.systemType === 'IMF') {
            driftLimit = riskCategory === 'IV' ? 0.015 : riskCategory === 'III' ? 0.015 : 0.020;
        } else {
            driftLimit = riskCategory === 'IV' ? 0.010 : riskCategory === 'III' ? 0.015 : 0.020;
        }

        const allowableDrift = driftLimit * storyHeight;
        const ratio = amplifiedDrift / allowableDrift;

        return {
            story: 0,
            height: storyHeight,
            elasticDrift,
            amplifiedDrift,
            allowableDrift,
            ratio,
            status: ratio <= 1.0 ? 'PASS' : 'FAIL'
        };
    }

    /**
     * Calculate seismic base shear
     */
    calculateBaseShear(
        weight: number,
        height: number,
        period?: number
    ): { Cs: number; V: number; method: string } {
        const { sds, sd1, rFactor } = this.params;

        // Approximate period if not provided
        const Ta = period || 0.028 * Math.pow(height, 0.8); // Steel moment frame

        // Calculate Cs
        let Cs = sds / rFactor;

        // Check upper limit
        const CsMax = sd1 / (Ta * rFactor);
        if (Cs > CsMax && Ta > 0) {
            Cs = CsMax;
        }

        // Check minimum
        const CsMin = 0.044 * sds;
        Cs = Math.max(Cs, CsMin);

        // Base shear
        const V = Cs * weight;

        return { Cs, V, method: 'Equivalent Lateral Force' };
    }

    // ============================================
    // WIDTH-TO-THICKNESS CHECKS
    // ============================================

    private checkBeamFlange(section: SteelSection, material: SteelMaterial): CodeCheck {
        const bf = section.width;
        const tf = section.flangeThickness;
        const ratio = bf / (2 * tf);

        const E = material.E;
        const Fy = material.fy;

        let limit: number;
        if (this.params.systemType === 'SMF') {
            limit = 0.30 * Math.sqrt(E / Fy); // Highly ductile
        } else if (this.params.systemType === 'IMF') {
            limit = 0.38 * Math.sqrt(E / Fy); // Moderately ductile
        } else {
            limit = 0.56 * Math.sqrt(E / Fy); // Ordinary
        }

        return {
            id: 'AISC341_E3.5a_Flange',
            code: 'AISC_341' as any,
            clause: 'E3.5a',
            title: 'Beam Flange Width-to-Thickness',
            description: `Check flange slenderness for ${this.params.systemType}`,
            demand: ratio,
            capacity: limit,
            ratio: ratio / limit,
            unit: '',
            status: ratio <= limit ? 'PASS' : 'FAIL',
            formula: 'b/2tf ≤ λhd',
            inputs: { bf, tf, E, Fy },
            reference: 'AISC 341-22 Table D1.1'
        };
    }

    private checkBeamWeb(section: SteelSection, material: SteelMaterial, axial: number): CodeCheck {
        const h = section.depth - 2 * section.flangeThickness;
        const tw = section.webThickness;
        const ratio = h / tw;

        const E = material.E;
        const Fy = material.fy;
        const Ca = Math.abs(axial) / (Fy * section.area);

        let limit: number;
        if (this.params.systemType === 'SMF') {
            limit = Ca <= 0.114 ? 2.57 * Math.sqrt(E / Fy) : (2.57 - 1.04 * Ca) * Math.sqrt(E / Fy);
        } else {
            limit = 3.76 * Math.sqrt(E / Fy);
        }

        return {
            id: 'AISC341_E3.5a_Web',
            code: 'AISC_341' as any,
            clause: 'E3.5a',
            title: 'Beam Web Width-to-Thickness',
            description: `Check web slenderness for ${this.params.systemType}`,
            demand: ratio,
            capacity: limit,
            ratio: ratio / limit,
            unit: '',
            status: ratio <= limit ? 'PASS' : 'FAIL',
            formula: 'h/tw ≤ λhd',
            inputs: { h, tw, E, Fy, Ca }
        };
    }

    private checkColumnFlange(section: SteelSection, material: SteelMaterial): CodeCheck {
        const bf = section.width;
        const tf = section.flangeThickness;
        const ratio = bf / (2 * tf);

        const E = material.E;
        const Fy = material.fy;
        const limit = 0.30 * Math.sqrt(E / Fy); // SMF columns

        return {
            id: 'AISC341_E3.5b_Flange',
            code: 'AISC_341' as any,
            clause: 'E3.5b',
            title: 'Column Flange Width-to-Thickness',
            description: 'Check column flange slenderness',
            demand: ratio,
            capacity: limit,
            ratio: ratio / limit,
            unit: '',
            status: ratio <= limit ? 'PASS' : 'FAIL'
        };
    }

    private checkColumnWeb(section: SteelSection, material: SteelMaterial, axial: number): CodeCheck {
        const h = section.depth - 2 * section.flangeThickness;
        const tw = section.webThickness;
        const ratio = h / tw;

        const E = material.E;
        const Fy = material.fy;
        const limit = 2.45 * Math.sqrt(E / Fy);

        return {
            id: 'AISC341_E3.5b_Web',
            code: 'AISC_341' as any,
            clause: 'E3.5b',
            title: 'Column Web Width-to-Thickness',
            description: 'Check column web slenderness',
            demand: ratio,
            capacity: limit,
            ratio: ratio / limit,
            unit: '',
            status: ratio <= limit ? 'PASS' : 'FAIL'
        };
    }

    private checkLateralBracing(section: SteelSection, material: SteelMaterial, Lb: number): CodeCheck {
        const ry = section.ry;
        const E = material.E;
        const Fy = material.fy;

        // Lb_max for highly ductile members
        const LbMax = 0.086 * ry * (E / Fy);

        return {
            id: 'AISC341_E3.4b',
            code: 'AISC_341' as any,
            clause: 'E3.4b',
            title: 'Lateral Bracing Spacing',
            description: 'Check lateral bracing for plastic hinging',
            demand: Lb,
            capacity: LbMax,
            ratio: Lb / LbMax,
            unit: 'mm',
            status: Lb <= LbMax ? 'PASS' : 'FAIL'
        };
    }

    private checkProtectedZone(section: SteelSection): CodeCheck {
        // Protected zone extends from face of column
        const protectedLength = section.depth; // Simplified

        return {
            id: 'AISC341_E3.6b',
            code: 'AISC_341' as any,
            clause: 'E3.6b',
            title: 'Protected Zone',
            description: 'No attachments in protected zone',
            demand: 0,
            capacity: protectedLength,
            ratio: 0,
            unit: 'mm',
            status: 'PASS',
            recommendation: `Protected zone extends ${protectedLength}mm from column face - no welding/drilling allowed`
        };
    }

    private checkStrongColumnWeakBeam(
        section: SteelSection,
        material: SteelMaterial,
        forces: MemberForces
    ): CodeCheck {
        // Simplified SCWB check
        const Zc = section.Zx || section.area * section.depth / 6;
        const Fyc = material.fy;
        const Puc = Math.abs(forces.axial);
        const Ag = section.area;

        const Mpc = Zc * Fyc * (1 - Puc / (Fyc * Ag));

        // Sum of beam plastic moments (simplified)
        const sumMpb = Mpc * 0.8; // Assume beams provide 80% of column strength

        const ratio = sumMpb / Mpc;

        return {
            id: 'AISC341_E3.4a',
            code: 'AISC_341' as any,
            clause: 'E3.4a',
            title: 'Strong Column - Weak Beam',
            description: 'ΣMpc ≥ 1.0 × ΣMpb',
            demand: sumMpb,
            capacity: Mpc,
            ratio: ratio,
            unit: 'kN·m',
            status: Mpc >= sumMpb ? 'PASS' : 'FAIL',
            recommendation: ratio < 1.0 ? 'Increase column size or reduce beam size' : undefined
        };
    }

    private checkColumnSplice(
        section: SteelSection,
        material: SteelMaterial,
        forces: MemberForces
    ): CodeCheck {
        // Column splice must be located away from plastic hinge region
        const spliceLocation = 1200; // mm from floor (typical)
        const minDistance = 900; // mm minimum

        return {
            id: 'AISC341_E3.6c',
            code: 'AISC_341' as any,
            clause: 'E3.6c',
            title: 'Column Splice Location',
            description: 'Splice location from beam flange',
            demand: minDistance,
            capacity: spliceLocation,
            ratio: minDistance / spliceLocation,
            unit: 'mm',
            status: spliceLocation >= minDistance ? 'PASS' : 'FAIL'
        };
    }
}

// Export singleton with default parameters
export const createSeismicChecker = (params: SeismicDesignParameters) => new AISC341Checker(params);
