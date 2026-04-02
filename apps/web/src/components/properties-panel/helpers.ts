import { MATERIALS_DATABASE, type SectionProperties } from '../../data/SectionDatabase';
import { STEEL_SECTIONS } from '../../data/sectionDatabaseSteelSections';

export type SectionCategory = 'ISMB' | 'ISMC' | 'ISLB' | 'ISHB' | 'W' | 'RCC-BEAM' | 'RCC-COLUMN';

export const SECTION_CATEGORIES: { id: SectionCategory; label: string }[] = [
    { id: 'ISMB', label: 'Steel - ISMB' },
    { id: 'ISMC', label: 'Steel - ISMC' },
    { id: 'ISLB', label: 'Steel - ISLB' },
    { id: 'ISHB', label: 'Steel - ISHB' },
    { id: 'W', label: 'Steel - W Shapes (AISC)' },
    { id: 'RCC-BEAM', label: 'RCC - Beams' },
    { id: 'RCC-COLUMN', label: 'RCC - Columns' },
];

export function getSectionsByCategory(category: SectionCategory): SectionProperties[] {
    switch (category) {
        case 'ISMB': return STEEL_SECTIONS.filter((s: SectionProperties) => s.type === 'ISMB');
        case 'ISMC': return STEEL_SECTIONS.filter((s: SectionProperties) => s.type === 'ISMC');
        case 'ISLB': return STEEL_SECTIONS.filter((s: SectionProperties) => s.type === 'ISLB');
        case 'ISHB': return STEEL_SECTIONS.filter((s: SectionProperties) => s.type === 'ISHB');
        case 'W': return STEEL_SECTIONS.filter((s: SectionProperties) => s.type === 'W');
        case 'RCC-BEAM': return STEEL_SECTIONS.filter((s: SectionProperties) => s.id.startsWith('RCC-') && !s.id.includes('COL'));
        case 'RCC-COLUMN': return STEEL_SECTIONS.filter((s: SectionProperties) => s.id.includes('RCC-COL'));
        default: return [];
    }
}

export function convertSectionToMeters(section: SectionProperties): { A: number; I: number } {
    return {
        A: section.A / 1e6,
        I: section.Ix / 1e12,
    };
}

export const MATERIAL_OPTIONS = MATERIALS_DATABASE.map((m) => ({
    id: m.id,
    label: m.name,
    E: m.E * 1e3,
    fy: m.fy || m.fck || 0,
}));

export const LOAD_DIRECTIONS = [
    { value: 'global_y', label: 'Global Y (Vertical)' },
    { value: 'global_x', label: 'Global X (Horizontal)' },
    { value: 'global_z', label: 'Global Z (Out-of-plane)' },
    { value: 'local_y', label: 'Local Y (Perpendicular)' },
    { value: 'axial', label: 'Local X (Axial)' },
] as const;

export type LoadDirection = typeof LOAD_DIRECTIONS[number]['value'];
