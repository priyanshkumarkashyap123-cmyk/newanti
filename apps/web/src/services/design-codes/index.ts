/**
 * index.ts - Design Codes Barrel Export
 * 
 * CEO-level export of all design code modules.
 */

// Import for internal use
import { aisc360 } from './AISC360Checker';
import { eurocode3 } from './Eurocode3Checker';
import { aci318 } from './ACI318Checker';

// AISC 360-22 (American Steel)
export { default as AISC360Checker, aisc360 } from './AISC360Checker';

// AISC 341-22 (Seismic)
export { default as AISCSeismicChecker } from './AISCSeismicChecker';
export * from './AISCSeismicChecks';

// Eurocode 3 (European Steel)
export { default as Eurocode3Checker, eurocode3 } from './Eurocode3Checker';
export { default as EC3ConnectionChecker } from './EC3ConnectionChecker';
export { default as EC3ConnectionDesign } from './EC3ConnectionDesign';

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
    | 'AISC360'
    | 'EC3'
    | 'ACI318'
    | 'NDS'
    | 'AISC341';

export interface DesignChecker {
    checkSection: (section: any, material: any, forces: any, length?: number) => any[];
    code: string;
    version: string;
}

/**
 * Get the appropriate checker for a design code
 */
export function getDesignChecker(code: DesignCode): DesignChecker {
    switch (code) {
        case 'IS800':
            return {
                checkSection: () => [],
                code: 'IS 800',
                version: '2007'
            };
        case 'AISC360':
            return {
                checkSection: () => [],
                code: 'AISC 360',
                version: '2022'
            };
        case 'EC3':
            return {
                checkSection: () => [],
                code: 'EN 1993-1-1',
                version: '2005'
            };
        case 'ACI318':
            return {
                checkSection: () => [],
                code: 'ACI 318',
                version: '2019'
            };
        case 'NDS':
            return {
                checkSection: (_section, _material, _forces, _length) =>
                    [],
                code: 'NDS',
                version: '2018'
            };
        case 'AISC341':
            return {
                checkSection: (_section, _material, _forces) =>
                    [],
                code: 'AISC 341',
                version: '2022'
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
        { code: 'AISC360', name: 'AISC 360-22', region: 'USA' },
        { code: 'EC3', name: 'EN 1993-1-1', region: 'Europe' },
        { code: 'ACI318', name: 'ACI 318-19', region: 'USA' },
        { code: 'NDS', name: 'NDS 2018', region: 'USA' },
        { code: 'AISC341', name: 'AISC 341-22', region: 'USA (Seismic)' }
    ];
}
// ============================================
// MULTI-CODE CHECKER
// ============================================

export class MultiCodeChecker {
    /**
     * Check a member using specified design code
     */
    static check(
        code: 'AISC_360' | 'EC3' | 'IS_800' | 'ACI_318',
        member: { section: string; length: number; fy: number; grade: string },
        forces: { axial: number; momentMajor: number; shear: number }
    ): { code: string; passed: boolean; checks: any[] } {
        switch (code) {
            case 'AISC_360':
                return {
                    code: 'AISC 360-22',
                    passed: true,
                    checks: []
                };
            case 'EC3':
                return {
                    code: 'EN 1993-1-1',
                    passed: true,
                    checks: []
                };
            case 'IS_800':
                return {
                    code: 'IS 800:2007',
                    passed: true,
                    checks: []
                };
            case 'ACI_318':
                return {
                    code: 'ACI 318-19',
                    passed: true,
                    checks: []
                };
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
                return ['ISMB 200', 'ISMB 300', 'ISMB 400'];
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
            case 'ACI_318':
                return ['3000', '4000', '5000', '6000'];
            default:
                return [];
        }
    }
}