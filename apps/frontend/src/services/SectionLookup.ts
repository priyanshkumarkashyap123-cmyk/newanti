/**
 * SectionLookup.ts - Map section IDs to 3D rendering dimensions
 * 
 * Bridges SectionDatabase (sectionId like 'ISMB400') to StructuralMesh dimensions for 3D rendering
 */

import SectionDatabase from '../data/SectionDatabase';
const { STEEL_SECTIONS } = SectionDatabase;
type SectionProperties = import('../data/SectionDatabase').SectionProperties;
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
    // Case-insensitive check for 'default' and empty values
    if (!sectionId || sectionId.toLowerCase() === 'default' || sectionId === '') {
        return DEFAULT_I_BEAM;
    }

    // First try direct lookup in STEEL_SECTIONS database
    const normalizedId = sectionId.toUpperCase();

    // Search in steel sections
    const matchedSection = STEEL_SECTIONS.find((s: SectionProperties) => 
        s.id?.toUpperCase() === normalizedId || 
        s.name?.toUpperCase() === normalizedId
    );

    if (matchedSection) {
        return mapSectionToRenderable(matchedSection);
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

    // Cable sections (for bridges, tension structures)
    if (/^(CABLE|HANGER|SUSPENDER|STAY|MAIN_CABLE)/.test(normalizedId)) {
        // Extract diameter from pattern like "CABLE_100" or "HANGER_CABLE_100DIA"
        const diameterMatch = normalizedId.match(/(\d+)(?:mm|DIA|MMD)?/i);
        const diameter = diameterMatch ? parseInt(diameterMatch[1]) : 100;
        
        return {
            sectionType: 'CIRCLE',
            dimensions: {
                diameter: diameter
            }
        };
    }

    // Circular sections
    if (/^CIRCLE|^CIR|^PIPE/.test(normalizedId)) {
        const diameterMatch = normalizedId.match(/(\d+)/);
        const diameter = diameterMatch ? parseInt(diameterMatch[1]) : 100;
        
        return {
            sectionType: 'CIRCLE',
            dimensions: {
                diameter: diameter
            }
        };
    }

    // Default fallback
    console.warn(`Unknown section type: ${sectionId}, using default I-beam`);
    return DEFAULT_I_BEAM;
}

/**
 * Map a section from database to renderable data
 */
function mapSectionToRenderable(section: SectionProperties): RenderableSectionData {
    // Check if it's an I-beam/W-shape with depth/flange properties
    if (section.d && section.bf && section.tw && section.tf) {
        return {
            sectionType: 'I-BEAM',
            dimensions: {
                height: section.d,        // Depth in mm
                width: section.bf,        // Flange width in mm
                webThickness: section.tw, // Web thickness in mm
                flangeThickness: section.tf // Flange thickness in mm
            }
        };
    }

    // Check if it's an RCC/rectangular section
    if (section.b && section.h) {
        return {
            sectionType: 'RECTANGLE',
            dimensions: {
                width: section.b,  // Width in mm
                height: section.h  // Height in mm
            }
        };
    }

    // Check if it's a tube/HSS section
    if (section.t && section.D) {
        return {
            sectionType: 'TUBE',
            dimensions: {
                outerWidth: section.D,
                outerHeight: section.D,
                thickness: section.t
            }
        };
    }

    // Fallback for unknown types - use area to estimate size
    const estimatedSize = section.A ? Math.sqrt(section.A) * 2 : 300;
    return {
        sectionType: 'I-BEAM',
        dimensions: {
            height: estimatedSize,
            width: estimatedSize * 0.5,
            webThickness: estimatedSize * 0.03,
            flangeThickness: estimatedSize * 0.04
        }
    };
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
    if (/^(CABLE|HANGER|SUSPENDER|STAY|CIRCLE|CIR|PIPE)/.test(id)) {
        return 'CIRCLE';
    }

    return 'I-BEAM'; // Default
}

export default getSectionDataForRendering;
