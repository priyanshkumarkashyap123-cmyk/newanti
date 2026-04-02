import type { SectionProperties } from '../../data/SectionDatabase';

export function findSectionByIdOrName(sections: SectionProperties[], sectionId?: string | null): SectionProperties | undefined {
  if (!sectionId) return undefined;
  return sections.find((section) => section.id === sectionId || section.name === sectionId);
}
