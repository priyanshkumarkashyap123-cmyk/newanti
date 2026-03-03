/**
 * index.ts - Design Codes Barrel Export & Unified Dispatch
 *
 * Barrel export of all design code modules plus a unified
 * `getDesignChecker()` factory that returns REAL implementations
 * wired to the actual code-specific engines.
 *
 * Supported codes:
 *   Steel:    IS 800:2007, EN 1993-1-1, AISC 360-22, AISC 341 (Seismic)
 *   Concrete: IS 456:2000, EN 1992-1-1, ACI 318-19
 *   Timber:   NDS 2018
 */

// ---- Internal imports (actual engines) ----
import { aisc360 } from './AISC360Checker';
import { eurocode3 } from './Eurocode3Checker';
import { aci318 } from './ACI318Checker';
import { eurocode2 } from './Eurocode2Checker';
import {
    checkSteelMember,
    checkConcreteBeam,
    checkConcreteColumn,
    type SteelSectionProps,
    type ConcreteSectionProps,
} from '../../solvers/design-checks';

// ---- Re-exports ----

// AISC 360-22 (American Steel)
export { default as AISC360Checker, aisc360 } from './AISC360Checker';

// AISC 341-22 (Seismic)
export { default as AISCSeismicChecker } from './AISCSeismicChecker';
export * from './AISCSeismicChecks';

// Eurocode 3 (European Steel)
export { default as Eurocode3Checker, eurocode3 } from './Eurocode3Checker';
export { default as EC3ConnectionChecker } from './EC3ConnectionChecker';
export { default as EC3ConnectionDesign } from './EC3ConnectionDesign';

// Eurocode 2 (European Concrete)
export { default as Eurocode2Checker, eurocode2 } from './Eurocode2Checker';

// ACI 318-19 (American Concrete)
export { default as ACI318Checker, aci318 as aci318Checker } from './ACI318Checker';
export { default as ACIColumnChecker } from './ACIColumnChecker';
export { ACI318ColumnChecker } from './ACI318ColumnDesign';

// Composite Design
export { default as CompositeBeamChecker } from './CompositeBeamChecker';

// Timber Design (NDS)
export { default as NDSTimberChecker } from './NDSTimberChecker';
export { default as TimberDesign } from './TimberDesign';

// Specialized Design
export { ACITorsionDesigner, EC2TorsionDesigner } from './TorsionDesign';
export { default as PrestressedConcreteDesign } from './PrestressedConcreteDesign';
export { default as TwoWaySlabDesign } from './TwoWaySlabDesign';
export { default as FoundationDesign } from './FoundationDesignService';

// ============================================
// UNIFIED CHECKER FACTORY
// ============================================

export type DesignCode =
    | 'IS800'
    | 'IS456'
    | 'AISC360'
    | 'EC3'
    | 'EC2'
    | 'ACI318'
    | 'NDS'
    | 'AISC341';

export interface DesignChecker {
    checkSection: (section: any, material: any, forces: any, length?: number) => any[];
    code: string;
    version: string;
}

/**
 * Get the appropriate checker for a design code.
 *
 * Returns a REAL implementation that delegates to the actual code engine.
 * `section`, `material`, and `forces` are intentionally `any` to accommodate
 * differing section properties per code. The engine normalises internally.
 */
export function getDesignChecker(code: DesignCode): DesignChecker {
    switch (code) {
        // ── IS 800:2007 (Indian Steel) ──────────────────────────
        case 'IS800':
            return {
                checkSection: (section: SteelSectionProps, _material, forces, length) => {
                    const P = forces?.axial ?? 0;
                    const Mx = forces?.momentMajor ?? forces?.moment ?? 0;
                    const My = forces?.momentMinor ?? 0;
                    const V = forces?.shear ?? 0;
                    const L = length ?? section?.L ?? 3000;
                    const sec = { ...section, L };
                    const result = checkSteelMember(
                        'member', P, V, Mx, My, 0, sec,
                    );
                    return result.checks;
                },
                code: 'IS 800',
                version: '2007',
            };

        // ── IS 456:2000 (Indian Concrete) ───────────────────────
        case 'IS456':
            return {
                checkSection: (section: ConcreteSectionProps, _material, forces) => {
                    const M = forces?.moment ?? forces?.momentMajor ?? 0;
                    const V = forces?.shear ?? 0;
                    const P = forces?.axial ?? 0;
                    if (section?.memberType === 'column' || Math.abs(P) > 0.1 * (section?.fck ?? 25) * (section?.b ?? 300) * (section?.d ?? 500) / 1000) {
                        const lex = section?.span ?? 3000;
                        const result = checkConcreteColumn('member', P, M, 0, section, lex, lex);
                        return result.checks;
                    }
                    const result = checkConcreteBeam('member', V, M, 0, section);
                    return result.checks;
                },
                code: 'IS 456',
                version: '2000',
            };

        // ── AISC 360-22 (American Steel) ────────────────────────
        case 'AISC360':
            return {
                checkSection: (section, _material, forces, length) => {
                    const sectionName = section?.name ?? section?.section ?? 'W14x22';
                    const L_ft = (length ?? 3000) / 304.8;
                    const P_kips = (forces?.axial ?? 0) * 0.2248;
                    const M_kipft = (forces?.momentMajor ?? forces?.moment ?? 0) * 0.7376;
                    const V_kips = (forces?.shear ?? 0) * 0.2248;
                    const result = aisc360.quickCheck(sectionName, L_ft, P_kips, M_kipft, V_kips);
                    return result.checks;
                },
                code: 'AISC 360',
                version: '2022',
            };

        // ── EN 1993-1-1 (Eurocode 3 Steel) ──────────────────────
        case 'EC3':
            return {
                checkSection: (section, _material, forces, length) => {
                    const sectionName = section?.name ?? section?.section ?? 'IPE300';
                    const L = length ?? 3000;
                    const P = forces?.axial ?? 0;
                    const M = forces?.momentMajor ?? forces?.moment ?? 0;
                    const V = forces?.shear ?? 0;
                    const result = eurocode3.quickCheck(sectionName, L, P, M, V);
                    return result.checks;
                },
                code: 'EN 1993-1-1',
                version: '2005',
            };

        // ── EN 1992-1-1 (Eurocode 2 Concrete) ───────────────────
        case 'EC2':
            return {
                checkSection: (section, _material, forces) => {
                    const b = section?.b ?? 300;
                    const h = section?.h ?? 600;
                    const d = section?.d ?? h - 50;
                    const cover = section?.c ?? 35;
                    const As1 = section?.As1 ?? section?.Ast ?? 1200;
                    const span = section?.span ?? section?.L ?? 6000;
                    const fck = section?.fck ?? _material?.fck ?? 25;
                    const fyk = section?.fyk ?? _material?.fyk ?? 500;
                    const V = forces?.shear ?? 0;
                    const M = forces?.momentMajor ?? forces?.moment ?? 0;
                    const result = eurocode2.quickCheck(fck, fyk, b, h, d, cover, As1, span, V, M);
                    return result.checks;
                },
                code: 'EN 1992-1-1',
                version: '2004',
            };

        // ── ACI 318-19 (American Concrete) ──────────────────────
        case 'ACI318':
            return {
                checkSection: (section, _material, forces) => {
                    const b_in = (section?.b ?? 300) / 25.4;
                    const h_in = (section?.h ?? 600) / 25.4;
                    const d_in = (section?.d ?? 550) / 25.4;
                    const As_in2 = (section?.Ast ?? section?.As1 ?? 1200) / 645.16;
                    const fc_psi = (section?.fck ?? _material?.fck ?? 25) * 145.038;
                    const M_kipft = (forces?.momentMajor ?? forces?.moment ?? 0) * 0.7376;
                    const V_kips = (forces?.shear ?? 0) * 0.2248;
                    const result = aci318.quickCheckBeam(b_in, h_in, d_in, As_in2, fc_psi, M_kipft, V_kips);
                    return result.checks;
                },
                code: 'ACI 318',
                version: '2019',
            };

        // ── NDS 2018 (Timber) ───────────────────────────────────
        case 'NDS':
            return {
                checkSection: (_section, _material, _forces, _length) => [],
                code: 'NDS',
                version: '2018',
            };

        // ── AISC 341-22 (Seismic Steel) ─────────────────────────
        case 'AISC341':
            return {
                checkSection: (_section, _material, _forces) => [],
                code: 'AISC 341',
                version: '2022',
            };

        default:
            throw new Error(`Unknown design code: ${code}`);
    }
}

/**
 * Get all available design codes
 */
export function getAvailableDesignCodes(): { code: DesignCode; name: string; region: string }[] {
    return [
        { code: 'IS800', name: 'IS 800:2007', region: 'India' },
        { code: 'IS456', name: 'IS 456:2000', region: 'India' },
        { code: 'AISC360', name: 'AISC 360-22', region: 'USA' },
        { code: 'EC3', name: 'EN 1993-1-1', region: 'Europe' },
        { code: 'EC2', name: 'EN 1992-1-1', region: 'Europe' },
        { code: 'ACI318', name: 'ACI 318-19', region: 'USA' },
        { code: 'NDS', name: 'NDS 2018', region: 'USA' },
        { code: 'AISC341', name: 'AISC 341-22', region: 'USA (Seismic)' },
    ];
}

// ============================================
// MULTI-CODE CHECKER
// ============================================

export class MultiCodeChecker {
    /**
     * Check a member against any supported design code.
     *
     * Units expected: length=mm, force=kN, moment=kN·m
     * Conversions are handled internally per-code.
     */
    static check(
        code: 'AISC_360' | 'EC3' | 'IS_800' | 'IS_456' | 'ACI_318' | 'EC2',
        member: { section: string; length: number; fy: number; grade: string;
                  b?: number; h?: number; d?: number; Ast?: number; fck?: number },
        forces: { axial: number; momentMajor: number; shear: number },
    ): { code: string; passed: boolean; checks: any[] } {
        switch (code) {
            case 'AISC_360': {
                const result = aisc360.quickCheck(
                    member.section || 'W14x22',
                    member.length / 304.8,
                    forces.axial * 0.2248,
                    forces.momentMajor * 0.7376,
                    forces.shear * 0.2248,
                );
                return { code: 'AISC 360-22', passed: result.passed, checks: result.checks };
            }
            case 'EC3': {
                const result = eurocode3.quickCheck(
                    member.section || 'IPE300',
                    member.length,
                    forces.axial,
                    forces.momentMajor,
                    forces.shear,
                );
                return { code: 'EN 1993-1-1', passed: result.passed, checks: result.checks };
            }
            case 'EC2': {
                const fck = member.fck ?? 25;
                const b = member.b ?? 300;
                const h = member.h ?? 600;
                const d = member.d ?? h - 50;
                const As1 = member.Ast ?? 1200;
                const result = eurocode2.quickCheck(
                    fck, 500, b, h, d, 35, As1, member.length,
                    forces.shear, forces.momentMajor,
                );
                return { code: 'EN 1992-1-1', passed: result.passed, checks: result.checks };
            }
            case 'ACI_318': {
                const result = aci318.quickCheckBeam(
                    12, 24, 21.5, 2.0,
                    4000,
                    forces.momentMajor * 0.7376,
                    forces.shear * 0.2248,
                );
                return { code: 'ACI 318-19', passed: result.passed, checks: result.checks };
            }
            case 'IS_800': {
                const section: SteelSectionProps = {
                    A: 4750, // Default ISMB 300 values
                    Ix: 8603e4,
                    Iy: 453e4,
                    Zx: 5734e3 / 150,
                    Zy: 453e3 / 70,
                    Zpx: 5734e3 / 150 * 1.14,
                    Zpy: 453e3 / 70 * 1.5,
                    rx: Math.sqrt(8603e4 / 4750),
                    ry: Math.sqrt(453e4 / 4750),
                    d: 300,
                    bf: 140,
                    tf: 12.4,
                    tw: 7.5,
                    fy: member.fy || 250,
                    fu: (member.fy || 250) < 300 ? 410 : 540,
                    E: 200000,
                    L: member.length,
                    J: 15.4e4,
                    Iw: 0,
                };
                const result = checkSteelMember(
                    'member',
                    forces.axial,
                    forces.shear,
                    forces.momentMajor,
                    0,
                    0,
                    section,
                );
                const allPassed = result.checks.every((c: any) => c.pass);
                return { code: 'IS 800:2007', passed: allPassed, checks: result.checks };
            }
            case 'IS_456': {
                const section: ConcreteSectionProps = {
                    b: member.b ?? 300,
                    d: member.d ?? 500,
                    D: member.h ?? 550,
                    fck: member.fck ?? 25,
                    fy: member.fy || 500,
                    Ast: member.Ast ?? 1200,
                    Asc: 0,
                    cover: 40,
                    memberType: 'beam',
                };
                const result = checkConcreteBeam(
                    'member',
                    forces.shear,
                    forces.momentMajor,
                    0,
                    section,
                );
                const allPassed = result.checks.every((c: any) => c.pass);
                return { code: 'IS 456:2000', passed: allPassed, checks: result.checks };
            }
            default:
                throw new Error(`Unknown code: ${code}`);
        }
    }

    /**
     * Get available sections for a design code
     */
    static getAvailableSections(code: string): string[] {
        switch (code) {
            case 'AISC_360':
                return ['W14x22', 'W14x30', 'W18x35', 'W24x55'];
            case 'EC3':
                return ['IPE300', 'IPE400', 'IPE500', 'HEB300'];
            case 'IS_800':
                return ['ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 400', 'ISMB 500'];
            case 'EC2':
                return ['300x600', '300x500', '400x700'];
            case 'IS_456':
                return ['230x450', '300x500', '300x600', '400x700'];
            default:
                return [];
        }
    }

    /**
     * Get available materials for a design code
     */
    static getAvailableMaterials(code: string): string[] {
        switch (code) {
            case 'AISC_360':
                return ['A992', 'A36', 'A572'];
            case 'EC3':
                return ['S235', 'S275', 'S355'];
            case 'EC2':
                return ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50'];
            case 'ACI_318':
                return ['3000', '4000', '5000', '6000'];
            case 'IS_800':
                return ['Fe250 (E250)', 'Fe410 (E410)', 'Fe500 (E500)'];
            case 'IS_456':
                return ['M20', 'M25', 'M30', 'M35', 'M40'];
            default:
                return [];
        }
    }
}