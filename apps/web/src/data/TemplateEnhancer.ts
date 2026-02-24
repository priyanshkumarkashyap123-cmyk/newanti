/**
 * TemplateEnhancer.ts - Enhances Templates with Full Specifications
 * 
 * Converts simple template definitions (with just sectionId) into
 * fully specified structures with:
 * - Material properties (E, fy, density)
 * - Section dimensions (height, width, thickness)
 * - Calculated properties (A, I, Zx, Zy)
 * - Section type for 3D rendering
 */

import type { Node, Member, Restraints, SectionType, SectionDimensions } from '../store/model';
import type { TemplateNode, TemplateMember, StructureTemplate } from './templates';
import { STEEL_SECTIONS, MATERIALS_DATABASE, getSectionById } from './SectionDatabase';
import { getMaterialForSection, getDefaultSteel } from './MaterialProperties';

// ============================================
// ENHANCED MEMBER WITH FULL PROPERTIES
// ============================================

export interface EnhancedMember extends Member {
    // Material properties
    material: {
        id: string;
        name: string;
        E: number;          // kN/m² (200e6 for steel)
        fy: number;         // kN/m² (250e3 for mild steel)
        density: number;    // kg/m³
    };

    // Section properties
    section: {
        id: string;
        name: string;
        type: SectionType;
        A: number;          // m²
        Ix: number;         // m⁴
        Iy: number;         // m⁴
        Zx: number;         // m³
        Zy: number;         // m³
        weight: number;     // kg/m
    };

    // Connection info (Phase 3)
    startConnection?: ConnectionInfo;
    endConnection?: ConnectionInfo;
}

export interface ConnectionInfo {
    type: 'bolted' | 'welded' | 'pinned' | 'rigid' | 'moment-resistant';
    details?: {
        boltGrade?: string;     // e.g., '8.8', '10.9'
        boltDiameter?: number;  // mm
        boltCount?: number;
        weldType?: 'fillet' | 'butt' | 'plug';
        weldSize?: number;      // mm
    };
}

// ============================================
// UNIT CONVERSION HELPERS
// ============================================

/**
 * Convert mm² to m² 
 */
function mm2ToM2(mm2: number): number {
    return mm2 * 1e-6;
}

/**
 * Convert mm⁴ to m⁴
 */
function mm4ToM4(mm4: number): number {
    return mm4 * 1e-12;
}

/**
 * Convert mm³ to m³
 */
function mm3ToM3(mm3: number): number {
    return mm3 * 1e-9;
}

/**
 * Convert mm to m
 */
function mmToM(mm: number): number {
    return mm * 0.001;
}

/**
 * Convert MPa to kN/m² (1 MPa = 1000 kN/m²)
 */
function mpaToKNm2(mpa: number): number {
    return mpa * 1000;
}

// ============================================
// SECTION ENHANCEMENT FUNCTIONS
// ============================================

/**
 * Get enhanced section properties from section ID
 */
export function getEnhancedSectionData(sectionId: string): {
    section: EnhancedMember['section'];
    dimensions: SectionDimensions;
    sectionType: SectionType;
} {
    const sectionData = getSectionById(sectionId.toUpperCase());

    if (sectionData) {
        // Map SectionDatabase type to our SectionType
        let sectionType: SectionType = 'I-BEAM';
        let dimensions: SectionDimensions = {};

        if (sectionData.type === 'W' || sectionData.type === 'ISMB' ||
            sectionData.type === 'ISLB' || sectionData.type === 'ISJB' ||
            sectionData.type === 'ISHB' || sectionData.type === 'IPE' ||
            sectionData.type === 'HEA' || sectionData.type === 'HEB') {
            sectionType = 'I-BEAM';
            dimensions = {
                height: mmToM(sectionData.d || 200),
                width: mmToM(sectionData.bf || 100),
                webThickness: mmToM(sectionData.tw || 6),
                flangeThickness: mmToM(sectionData.tf || 10)
            };
        } else if (sectionData.type === 'C' || sectionData.type === 'MC' ||
            sectionData.type === 'ISMC' || sectionData.type === 'UPN') {
            sectionType = 'C-CHANNEL';
            dimensions = {
                channelHeight: mmToM(sectionData.d || 150),
                channelWidth: mmToM(sectionData.bf || 75),
                channelThickness: mmToM(sectionData.tf || 7)
            };
        } else if (sectionData.type === 'L') {
            sectionType = 'L-ANGLE';
            // For angles, d represents leg size
            dimensions = {
                legWidth: mmToM(sectionData.d || 75),
                legHeight: mmToM(sectionData.bf || 75),
                thickness: mmToM(sectionData.t || 6)
            };
        } else if (sectionData.type === 'HSS-RECT') {
            sectionType = 'TUBE';
            dimensions = {
                outerWidth: mmToM(sectionData.b || 100),
                outerHeight: mmToM(sectionData.h || 100),
                thickness: mmToM(sectionData.t || 6)
            };
        } else if (sectionData.type === 'HSS-ROUND' || sectionData.type === 'PIPE') {
            sectionType = 'CIRCLE';
            dimensions = {
                diameter: mmToM(sectionData.D || 100),
                thickness: mmToM(sectionData.t || 6)
            };
        }

        return {
            section: {
                id: sectionData.id,
                name: sectionData.name,
                type: sectionType,
                A: mm2ToM2(sectionData.A),
                Ix: mm4ToM4(sectionData.Ix),
                Iy: mm4ToM4(sectionData.Iy),
                Zx: mm3ToM3(sectionData.Zx),
                Zy: mm3ToM3(sectionData.Zy),
                weight: sectionData.weight
            },
            dimensions,
            sectionType
        };
    }

    // Parse section ID to determine type and size
    return parseAndGenerateSectionData(sectionId);
}

/**
 * Parse section ID string and generate approximate data
 */
function parseAndGenerateSectionData(sectionId: string): {
    section: EnhancedMember['section'];
    dimensions: SectionDimensions;
    sectionType: SectionType;
} {
    const upper = sectionId.toUpperCase();

    // Match ISMB/ISLB/ISMC patterns
    const ismbMatch = upper.match(/^(ISMB|ISLB|ISWB|ISHB)(\d+)/);
    if (ismbMatch) {
        const depth = parseInt(ismbMatch[2]); // mm
        const depthM = depth * 0.001; // convert to meters

        // Approximate properties based on typical I-beam ratios
        const width = depthM * 0.5;
        const tf = depthM * 0.03;
        const tw = depthM * 0.02;
        const A = (width * tf * 2) + ((depthM - 2 * tf) * tw); // Approximate I-beam area
        const I = (width * Math.pow(depthM, 3)) / 12 -
            ((width - tw) * Math.pow(depthM - 2 * tf, 3)) / 12;

        return {
            section: {
                id: sectionId,
                name: sectionId,
                type: 'I-BEAM',
                A: A,
                Ix: I,
                Iy: I / 10,
                Zx: I / (depthM / 2),
                Zy: I / (10 * width / 2),
                weight: A * 7850 // kg/m
            },
            dimensions: {
                height: depthM,
                width: width,
                webThickness: tw,
                flangeThickness: tf
            },
            sectionType: 'I-BEAM'
        };
    }

    // Match ISMC patterns
    const ismcMatch = upper.match(/^ISMC(\d+)/);
    if (ismcMatch) {
        const depth = parseInt(ismcMatch[1]) * 0.001;
        const width = depth * 0.4;
        const t = depth * 0.04;
        const A = depth * t + width * t;

        return {
            section: {
                id: sectionId,
                name: sectionId,
                type: 'C-CHANNEL',
                A: A,
                Ix: width * Math.pow(depth, 3) / 12,
                Iy: depth * Math.pow(width, 3) / 12,
                Zx: width * Math.pow(depth, 2) / 6,
                Zy: depth * Math.pow(width, 2) / 6,
                weight: A * 7850
            },
            dimensions: {
                channelHeight: depth,
                channelWidth: width,
                channelThickness: t
            },
            sectionType: 'C-CHANNEL'
        };
    }

    // Match ISA patterns (e.g., ISA100x100x10)
    const isaMatch = upper.match(/^ISA(\d+)[Xx](\d+)[Xx](\d+)/);
    if (isaMatch) {
        const leg1 = parseInt(isaMatch[1]) * 0.001;
        const leg2 = parseInt(isaMatch[2]) * 0.001;
        const t = parseInt(isaMatch[3]) * 0.001;
        const A = (leg1 + leg2 - t) * t;

        return {
            section: {
                id: sectionId,
                name: sectionId,
                type: 'L-ANGLE',
                A: A,
                Ix: (leg1 * Math.pow(t, 3) + t * Math.pow(leg2, 3)) / 12,
                Iy: (leg2 * Math.pow(t, 3) + t * Math.pow(leg1, 3)) / 12,
                Zx: A * leg1 / 6,
                Zy: A * leg2 / 6,
                weight: A * 7850
            },
            dimensions: {
                legWidth: leg1,
                legHeight: leg2,
                thickness: t
            },
            sectionType: 'L-ANGLE'
        };
    }

    // Match W shapes (e.g., W14x30)
    const wMatch = upper.match(/^W(\d+)[Xx](\d+)/);
    if (wMatch) {
        const nominalDepth = parseInt(wMatch[1]) * 25.4 * 0.001; // inches to meters
        const width = nominalDepth * 0.6;
        const tf = nominalDepth * 0.03;
        const tw = nominalDepth * 0.02;
        const A = (width * tf * 2) + ((nominalDepth - 2 * tf) * tw);
        const I = (width * Math.pow(nominalDepth, 3)) / 12 -
            ((width - tw) * Math.pow(nominalDepth - 2 * tf, 3)) / 12;

        return {
            section: {
                id: sectionId,
                name: sectionId,
                type: 'I-BEAM',
                A: A,
                Ix: I,
                Iy: I / 12,
                Zx: I / (nominalDepth / 2),
                Zy: I / (12 * width / 2),
                weight: A * 7850
            },
            dimensions: {
                height: nominalDepth,
                width: width,
                webThickness: tw,
                flangeThickness: tf
            },
            sectionType: 'I-BEAM'
        };
    }

    // Default fallback - generic I-beam 250mm
    return {
        section: {
            id: sectionId || 'DEFAULT',
            name: sectionId || 'Default Section',
            type: 'I-BEAM',
            A: 0.005,    // 50 cm²
            Ix: 1e-4,    // 10000 cm⁴
            Iy: 1e-5,
            Zx: 8e-4,
            Zy: 1e-4,
            weight: 40
        },
        dimensions: {
            height: 0.250,
            width: 0.125,
            webThickness: 0.007,
            flangeThickness: 0.012
        },
        sectionType: 'I-BEAM'
    };
}

// ============================================
// TEMPLATE ENHANCEMENT FUNCTIONS
// ============================================

/**
 * Convert a TemplateNode to a full Node with restraints
 */
export function enhanceTemplateNode(templateNode: TemplateNode): Node {
    let restraints: Restraints | undefined;

    if (templateNode.support) {
        switch (templateNode.support) {
            case 'FIXED':
                restraints = { fx: true, fy: true, fz: true, mx: true, my: true, mz: true };
                break;
            case 'PINNED':
                restraints = { fx: true, fy: true, fz: true, mx: false, my: false, mz: false };
                break;
            case 'ROLLER':
                restraints = { fx: false, fy: true, fz: true, mx: false, my: false, mz: false };
                break;
            default:
                restraints = undefined;
        }
    }

    return {
        id: templateNode.id.toUpperCase().replace('N', 'N'),  // Ensure format like N1, N2
        x: templateNode.x,
        y: templateNode.y,
        z: templateNode.z,
        restraints
    };
}

/**
 * Convert a TemplateMember to a full Member with all properties
 */
export function enhanceTemplateMember(
    templateMember: TemplateMember,
    materialId: string = 'steel-fe410'
): EnhancedMember {
    const sectionData = getEnhancedSectionData(templateMember.section);
    const materialData = MATERIALS_DATABASE.find(m => m.id === materialId) || MATERIALS_DATABASE[0];

    // Convert MPa to kN/m² for consistency with analysis
    const E_kNm2 = mpaToKNm2(materialData.E);
    const fy_kNm2 = mpaToKNm2(materialData.fy || 250);

    const member: EnhancedMember = {
        id: templateMember.id.toUpperCase().replace('M', 'M'),
        startNodeId: templateMember.startNode.toUpperCase().replace('N', 'N'),
        endNodeId: templateMember.endNode.toUpperCase().replace('N', 'N'),
        sectionId: templateMember.section,

        // Section geometry for 3D rendering
        sectionType: sectionData.sectionType,
        dimensions: sectionData.dimensions,

        // Analysis properties (converted to proper units)
        E: E_kNm2,               // kN/m²
        A: sectionData.section.A, // m²
        I: sectionData.section.Ix, // m⁴

        // Material details
        material: {
            id: materialData.id,
            name: materialData.name,
            E: E_kNm2,
            fy: fy_kNm2,
            density: materialData.density
        },

        // Section details
        section: sectionData.section
    };

    return member;
}

/**
 * Enhance a full template to analysis-ready structure
 */
export function enhanceTemplate(
    template: StructureTemplate,
    materialId: string = 'steel-fe410'
): {
    nodes: Node[];
    members: EnhancedMember[];
    name: string;
    description: string;
} {
    const nodes = template.nodes.map(enhanceTemplateNode);
    const members = template.members.map(m => enhanceTemplateMember(m, materialId));

    return {
        nodes,
        members,
        name: template.name,
        description: template.description
    };
}

/**
 * Get standard member for quick generation
 */
export function createStandardMember(
    id: string,
    startNodeId: string,
    endNodeId: string,
    sectionId: string = 'ISMB250',
    materialId: string = 'steel-fe410'
): EnhancedMember {
    return enhanceTemplateMember({
        id,
        startNode: startNodeId,
        endNode: endNodeId,
        section: sectionId
    }, materialId);
}

// ============================================
// CONNECTION TYPE DEFINITIONS (for Phase 3)
// ============================================

export const CONNECTION_TYPES = {
    'BOLTED_SIMPLE': {
        type: 'bolted' as const,
        name: 'Simple Bolted Connection',
        momentResistant: false,
        details: { boltGrade: '4.6', boltDiameter: 16, boltCount: 4 }
    },
    'BOLTED_MOMENT': {
        type: 'bolted' as const,
        name: 'Moment Resistant Bolted',
        momentResistant: true,
        details: { boltGrade: '8.8', boltDiameter: 20, boltCount: 8 }
    },
    'WELDED_FILLET': {
        type: 'welded' as const,
        name: 'Fillet Welded Connection',
        momentResistant: false,
        details: { weldType: 'fillet' as const, weldSize: 6 }
    },
    'WELDED_FULL_PEN': {
        type: 'welded' as const,
        name: 'Full Penetration Weld',
        momentResistant: true,
        details: { weldType: 'butt' as const }
    },
    'PINNED': {
        type: 'pinned' as const,
        name: 'Pinned Connection',
        momentResistant: false
    },
    'RIGID': {
        type: 'rigid' as const,
        name: 'Rigid Connection',
        momentResistant: true
    }
};

export default {
    enhanceTemplate,
    enhanceTemplateNode,
    enhanceTemplateMember,
    createStandardMember,
    getEnhancedSectionData,
    CONNECTION_TYPES
};
