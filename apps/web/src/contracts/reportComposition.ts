import type { ReportSection, ReportSectionType } from '../types/ReportTypes';

export interface ReportCompositionMetadata {
  projectName: string;
  projectNumber?: string;
  revision?: string;
  preparedBy: string;
  checkedBy?: string;
  approvedBy?: string;
  client?: string;
  location?: string;
  date: string;
  reportType: string;
  designCodes?: string;
}

export interface ReportDiagramSelection {
  include_sfd: boolean;
  include_bmd: boolean;
  include_deflection: boolean;
  include_afd: boolean;
  include_bmd_my: boolean;
  include_shear_z: boolean;
}

export interface ReportCompositionPayload {
  metadata: ReportCompositionMetadata;
  sections: ReportSection[];
  diagrams: ReportDiagramSelection;
}

export interface ReportAvailabilityContext {
  nodeCount: number;
  memberCount: number;
}

export interface ReportReadinessResult {
  ready: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  manifest: {
    enabledSections: ReportSectionType[];
    enabledCount: number;
  };
}

const DIAGRAM_OPTION_KEYS = {
  include_sfd: ['showShear', 'showSfd'] as const,
  include_bmd: ['showMoment', 'showBmd'] as const,
  include_deflection: ['showDeformedShape', 'showDeflection'] as const,
  include_afd: ['showAxial', 'showAfd'] as const,
  include_bmd_my: ['showWeakAxisMoment', 'showBmdMy'] as const,
  include_shear_z: ['showWeakAxisShear', 'showShearZ'] as const,
} as const;

function readBooleanOption(section: ReportSection, keys: readonly string[]): boolean {
  return keys.some((key) => section.options[key] === true);
}

export function buildDiagramSelectionFromSections(sections: ReportSection[]): ReportDiagramSelection {
  const enabledSections = sections.filter((section) => section.enabled);
  const memberForces = enabledSections.find((section) => section.type === 'memberForces');
  const displacements = enabledSections.find((section) => section.type === 'displacements');

  return {
    include_sfd: memberForces ? readBooleanOption(memberForces, DIAGRAM_OPTION_KEYS.include_sfd) : false,
    include_bmd: memberForces ? readBooleanOption(memberForces, DIAGRAM_OPTION_KEYS.include_bmd) : false,
    include_deflection: displacements
      ? readBooleanOption(displacements, DIAGRAM_OPTION_KEYS.include_deflection)
      : false,
    include_afd: memberForces ? readBooleanOption(memberForces, DIAGRAM_OPTION_KEYS.include_afd) : false,
    include_bmd_my: memberForces ? readBooleanOption(memberForces, DIAGRAM_OPTION_KEYS.include_bmd_my) : false,
    include_shear_z: memberForces ? readBooleanOption(memberForces, DIAGRAM_OPTION_KEYS.include_shear_z) : false,
  };
}

export function validateReportComposition(
  payload: ReportCompositionPayload,
  availability: ReportAvailabilityContext,
): ReportReadinessResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const enabledSections = payload.sections.filter((section) => section.enabled);
  const enabledTypes = enabledSections.map((section) => section.type);

  if (!payload.metadata.projectName.trim()) errors.push('Project name is required.');
  if (!payload.metadata.preparedBy.trim()) errors.push('Prepared by is required.');
  if (!payload.metadata.date.trim()) errors.push('Issue date is required.');
  if (enabledSections.length === 0) errors.push('Enable at least one report section.');

  if (availability.nodeCount === 0 && enabledTypes.some((type) => ['geometry', 'analysis'].includes(type))) {
    errors.push('Model geometry/analysis sections require nodes in the model.');
  }

  if (availability.memberCount === 0 && enabledTypes.some((type) => ['memberForces', 'steelDesign', 'concreteDesign'].includes(type))) {
    errors.push('Member force/design sections require at least one member.');
  }

  const selectedDiagramCount = Object.values(payload.diagrams).filter(Boolean).length;
  if (enabledTypes.includes('memberForces') && selectedDiagramCount === 0) {
    warnings.push('Member forces section is enabled but no force diagrams are selected.');
  }

  if (enabledTypes.includes('codeCheck') && !payload.metadata.designCodes?.trim()) {
    warnings.push('Design codes are not specified for the code compliance section.');
  }

  const score = Math.max(0, Math.min(100, 100 - errors.length * 20 - warnings.length * 8));

  return {
    ready: errors.length === 0,
    score,
    errors,
    warnings,
    manifest: {
      enabledSections: enabledTypes,
      enabledCount: enabledSections.length,
    },
  };
}
