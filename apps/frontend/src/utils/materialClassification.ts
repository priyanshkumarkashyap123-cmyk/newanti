import type { Member, SectionType } from '../store/modelTypes';

const STEEL_SECTION_TYPES = new Set<SectionType>([
  'I-BEAM',
  'TUBE',
  'L-ANGLE',
  'C-CHANNEL',
  'T-SECTION',
  'DOUBLE-ANGLE',
  'PIPE',
  'TAPERED',
  'BUILT-UP',
]);

export type StructuralMaterialType = 'steel' | 'concrete';

export function isSteelSectionType(sectionType?: SectionType | string | null): boolean {
  if (!sectionType) return false;
  return STEEL_SECTION_TYPES.has(sectionType as SectionType);
}

export function inferMemberMaterialType(
  member: Pick<Member, 'sectionType' | 'materialType'>,
): StructuralMaterialType {
  if (member.materialType === 'steel' || member.materialType === 'concrete') {
    return member.materialType;
  }
  return isSteelSectionType(member.sectionType) ? 'steel' : 'concrete';
}
