import {
    MATERIALS_DATABASE,
    calculateCircularSection,
    calculateISection,
    calculateRectangularSection,
    getSectionsByType,
    type Material,
    type SectionProperties,
    type SectionType,
} from '../../data/SectionDatabase';
import { STEEL_SECTIONS } from '../../data/sectionDatabaseSteelSections';

export type InputMode = 'database' | 'custom' | 'calculate';
export type MaterialType = 'steel' | 'concrete' | 'custom';
export type SectionShape = 'rectangular' | 'circular' | 'I';

export interface SectionDimensions {
    b: number;
    h: number;
    D: number;
    d: number;
    bf: number;
    tf: number;
    tw: number;
}

export const DEFAULT_CUSTOM_SECTION: Partial<SectionProperties> = {
    name: 'Custom Section',
    A: 5000,
    Ix: 100e6,
    Iy: 20e6,
    J: 50e3,
    Sx: 500e3,
    Sy: 100e3,
    Zx: 600e3,
    Zy: 120e3,
    rx: 100,
    ry: 50,
    weight: 40,
};

export const DEFAULT_CUSTOM_MATERIAL: Partial<Material> = {
    name: 'Custom Material',
    E: 200000,
    fy: 250,
    fu: 400,
    density: 7850,
    poissonsRatio: 0.3,
};

export const DEFAULT_DIMENSIONS: SectionDimensions = {
    b: 300,
    h: 500,
    D: 400,
    d: 300,
    bf: 150,
    tf: 12,
    tw: 8,
};

export const SECTION_TYPES: { type: SectionType; label: string; category: 'steel' | 'concrete' }[] = [
    { type: 'W', label: 'W Shapes (AISC)', category: 'steel' },
    { type: 'ISMB', label: 'ISMB (Indian)', category: 'steel' },
    { type: 'ISMC', label: 'ISMC Channel (Indian)', category: 'steel' },
    { type: 'IPE', label: 'IPE (European)', category: 'steel' },
    { type: 'HEA', label: 'HEA (European)', category: 'steel' },
    { type: 'HSS-RECT', label: 'HSS Rectangular', category: 'steel' },
    { type: 'HSS-ROUND', label: 'HSS Round/Pipe', category: 'steel' },
    { type: 'RECT-CONCRETE', label: 'RCC Rectangular Beam', category: 'concrete' },
    { type: 'CIRC-CONCRETE', label: 'RCC Circular Column', category: 'concrete' },
    { type: 'T-CONCRETE', label: 'RCC T-Beam', category: 'concrete' },
];

export function buildCommonConcreteSections(): SectionProperties[] {
    return [
        calculateRectangularSection(230, 300),
        calculateRectangularSection(230, 450),
        calculateRectangularSection(230, 600),
        calculateRectangularSection(300, 300),
        calculateRectangularSection(300, 450),
        calculateRectangularSection(300, 600),
        calculateRectangularSection(400, 400),
        calculateRectangularSection(450, 450),
        calculateRectangularSection(500, 500),
        calculateRectangularSection(600, 600),
        calculateCircularSection(300),
        calculateCircularSection(400),
        calculateCircularSection(450),
        calculateCircularSection(500),
        calculateCircularSection(600),
    ];
}

export function getFilteredSections(
    selectedSectionType: SectionType,
    concreteSections: SectionProperties[]
): SectionProperties[] {
    if (selectedSectionType === 'RECT-CONCRETE') {
        return concreteSections.filter((section) => section.type === 'RECT-CONCRETE');
    }
    if (selectedSectionType === 'CIRC-CONCRETE') {
        return concreteSections.filter((section) => section.type === 'CIRC-CONCRETE');
    }
    return getSectionsByType(selectedSectionType);
}

export function resolveSelectedSection(params: {
    activeTab: InputMode;
    selectedSectionId: string;
    sectionShape: SectionShape;
    dimensions: SectionDimensions;
    customSection: Partial<SectionProperties>;
    concreteSections: SectionProperties[];
    filteredSections: SectionProperties[];
}): SectionProperties {
    const {
        activeTab,
        selectedSectionId,
        sectionShape,
        dimensions,
        customSection,
        concreteSections,
        filteredSections,
    } = params;

    if (activeTab === 'database') {
        const steelSection = STEEL_SECTIONS.find((section: SectionProperties) => section.id === selectedSectionId);
        if (steelSection) {
            return steelSection;
        }
        const concreteSection = concreteSections.find((section) => section.id === selectedSectionId);
        if (concreteSection) {
            return concreteSection;
        }
        return filteredSections[0];
    }

    if (activeTab === 'calculate') {
        switch (sectionShape) {
            case 'rectangular':
                return calculateRectangularSection(dimensions.b, dimensions.h);
            case 'circular':
                return calculateCircularSection(dimensions.D);
            case 'I':
                return calculateISection(dimensions.d, dimensions.bf, dimensions.tf, dimensions.tw);
            default:
                return calculateISection(dimensions.d, dimensions.bf, dimensions.tf, dimensions.tw);
        }
    }

    return {
        id: 'custom',
        type: 'CUSTOM' as SectionType,
        ...customSection,
    } as SectionProperties;
}

export function resolveSelectedMaterial(
    materialType: MaterialType,
    selectedMaterialId: string,
    customMaterial: Partial<Material>
): Material {
    if (materialType === 'custom') {
        return {
            id: 'custom',
            type: 'custom' as const,
            ...customMaterial,
        } as Material;
    }

    return MATERIALS_DATABASE.find((material) => material.id === selectedMaterialId) || MATERIALS_DATABASE[0];
}
