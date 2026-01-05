/**
 * SectionLookup.ts - Map section IDs to 3D rendering dimensions
 * 
 * Bridges SectionDatabase (sectionId like 'ISMB400') to StructuralMesh dimensions for 3D rendering
 */

import { STEEL_SECTIONS, SectionProperties } from '../data/SectionDatabase';
import type { SectionType, SectionDimensions } from '../components/viewer/StructuralMesh';

export interface RenderableSectionData {
    sectionType: SectionType;
    dimensions: SectionDimensions;
}

// Default dimensions for common section types when not found in database
const DEFAULT_I_BEAM: RenderableSectionData = {
    sectionType: 'I-BEAM',
    dimensions: { height: 300, width: 150, webThickness: 8, flangeThickness: 12 }
};

const DEFAULT_TUBE: RenderableSectionData = {
    sectionType: 'TUBE',
    dimensions: { outerWidth: 100, outerHeight: 100, thickness: 6 }
};

const DEFAULT_L_ANGLE: RenderableSectionData = {
    sectionType: 'L-ANGLE',
    dimensions: { legA: 75, legB: 75, thickness: 8 }
};

const DEFAULT_C_CHANNEL: RenderableSectionData = {
    sectionType: 'C-CHANNEL',
    dimensions: { height: 150, width: 75, webThickness: 6, flangeThickness: 10 }
};

const DEFAULT_RECTANGLE: RenderableSectionData = {
    sectionType: 'RECTANGLE',
    dimensions: { width: 300, height: 500 }
};

/**
 * Get renderable section data from section ID
 * Maps sectionId (e.g., 'ISMB400') to 3D dimensions
 */
export function getSectionDataForRendering(sectionId: string): RenderableSectionData {
    if (!sectionId || sectionId === 'default' || sectionId === '') {
        return DEFAULT_I_BEAM;
    }

    // First try direct lookup in database
    const normalizedId = sectionId.toUpperCase();

    // Search in all section categories
    for (const category of Object.values(SECTION_DATABASE)) {
        for (const section of category) {
            if (section.designation.toUpperCase() === normalizedId) {
                return mapSectionToRenderable(section);
            }
        }
    }

    // Pattern matching for standard section nomenclature
    // ISMB, ISMC, ISLB, ISHB sections (Indian Standard)
    if (/^ISM[BC]?\d+/.test(normalizedId) || /^IS[LH]B\d+/.test(normalizedId)) {
        const heightMatch = normalizedId.match(/\d+/);
        const height = heightMatch ? parseInt(heightMatch[0]) : 300;

        return {
            sectionType: 'I-BEAM',
            dimensions: {
                height: height,
                width: height * 0.5,  // Approximate flange width
                webThickness: Math.max(6, height * 0.03),
                flangeThickness: Math.max(8, height * 0.04)
            }
        };
    }

    // ISMC (C-channels)
    if (/^ISMC\d+/.test(normalizedId)) {
        const heightMatch = normalizedId.match(/\d+/);
        const height = heightMatch ? parseInt(heightMatch[0]) : 150;

        return {
            sectionType: 'C-CHANNEL',
            dimensions: {
                height: height,
                width: height * 0.4,
                webThickness: Math.max(5, height * 0.025),
                flangeThickness: Math.max(7, height * 0.035)
            }
        };
    }

    // ISA (L-angles)
    if (/^ISA\d+/.test(normalizedId)) {
        // Pattern: ISA100x100x10
        const parts = normalizedId.match(/ISA(\d+)x(\d+)x(\d+)/i);
        if (parts) {
            return {
                sectionType: 'L-ANGLE',
                dimensions: {
                    legA: parseInt(parts[1]),
                    legB: parseInt(parts[2]),
                    thickness: parseInt(parts[3])
                }
            };
        }
    }

    // W-shapes (American Standard)
    if (/^W\d+X\d+/.test(normalizedId)) {
        const parts = normalizedId.match(/W(\d+)X(\d+)/i);
        if (parts) {
            const depth = parseInt(parts[1]) * 25.4; // Convert inches to mm
            return {
                sectionType: 'I-BEAM',
                dimensions: {
                    height: depth,
                    width: depth * 0.5,
                    webThickness: 10,
                    flangeThickness: 15
                }
            };
        }
    }

    // Box/Tube sections
    if (/^(BOX|SHS|RHS|TUBE|HSS)/.test(normalizedId)) {
        return DEFAULT_TUBE;
    }

    // RCC sections (Beam/Column)
    if (/^RCC|^\d+x\d+/.test(normalizedId)) {
        const parts = normalizedId.match(/(\d+)x(\d+)/);
        if (parts) {
            return {
                sectionType: 'RECTANGLE',
                dimensions: {
                    width: parseInt(parts[1]),
                    height: parseInt(parts[2])
                }
            };
        }
    }

    // Default fallback
    console.warn(`Unknown section type: ${sectionId}, using default I-beam`);
    return DEFAULT_I_BEAM;
}

/**
 * Map a section from database to renderable data
 */
function mapSectionToRenderable(section: SteelSection | RCCSection): RenderableSectionData {
    // Check if it's a steel section with I-beam properties
    if ('d' in section && 'bf' in section && 'tw' in section && 'tf' in section) {
        const steel = section as SteelSection;
        return {
            sectionType: 'I-BEAM',
            dimensions: {
                height: steel.d,        // Depth in mm
                width: steel.bf,        // Flange width in mm
                webThickness: steel.tw, // Web thickness in mm
                flangeThickness: steel.tf // Flange thickness in mm
            }
        };
    }

    // Check if it's an RCC section
    if ('b' in section && 'h' in section) {
        const rcc = section as RCCSection;
        return {
            sectionType: 'RECTANGLE',
            dimensions: {
                width: rcc.b,  // Width in mm
                height: rcc.h  // Height in mm
            }
        };
    }

    // Fallback for unknown types
    return DEFAULT_I_BEAM;
}

/**
 * Parse section type from section ID prefix
 */
export function inferSectionType(sectionId: string): SectionType {
    const id = sectionId?.toUpperCase() || '';

    if (/^(ISMB|ISLB|ISHB|W\d+|HE|IPE|UB|UC)/.test(id)) {
        return 'I-BEAM';
    }
    if (/^ISMC/.test(id)) {
        return 'C-CHANNEL';
    }
    if (/^ISA/.test(id)) {
        return 'L-ANGLE';
    }
    if (/^(BOX|SHS|RHS|TUBE|HSS)/.test(id)) {
        return 'TUBE';
    }
    if (/^(RCC|RC|\d+x\d+)/.test(id)) {
        return 'RECTANGLE';
    }

    return 'I-BEAM'; // Default
}

export default getSectionDataForRendering;
