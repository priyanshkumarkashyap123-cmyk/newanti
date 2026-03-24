import { describe, it, expect } from 'vitest';
import {
  validateReportComposition,
  buildDiagramSelectionFromSections,
  type ReportCompositionPayload,
} from '../reportComposition';
import type { ReportSection } from '../../types/ReportTypes';

describe('reportComposition: Report Readiness Validation', () => {
  const mockMetadata = {
    projectName: 'Test Tower',
    projectNumber: 'PRJ-2026-001',
    revision: 'A1',
    preparedBy: 'Eng. John Doe',
    date: '2026-03-23',
    reportType: 'Structural Design Report',
    designCodes: 'IS 456:2000, IS 800:2007',
  };

  const mockSections: ReportSection[] = [
    {
      id: 'cover-1',
      type: 'cover',
      title: 'Cover Page',
      enabled: true,
      expanded: false,
      options: {},
    },
    {
      id: 'toc-1',
      type: 'toc',
      title: 'Table of Contents',
      enabled: true,
      expanded: false,
      options: {},
    },
    {
      id: 'analysis-1',
      type: 'analysis',
      title: 'Analysis Summary',
      enabled: true,
      expanded: false,
      options: {},
    },
    {
      id: 'memberForces-1',
      type: 'memberForces',
      title: 'Member Forces',
      enabled: true,
      expanded: false,
      options: { include_sfd: true, include_bmd: true, include_afd: false },
    },
  ];

  const mockAvailability = {
    nodeCount: 10,
    memberCount: 15,
  };

  it('should validate a well-formed composition payload', () => {
    const payload: ReportCompositionPayload = {
      metadata: mockMetadata,
      sections: mockSections,
      diagrams: {
        include_sfd: true,
        include_bmd: true,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest.enabledCount).toBe(4);
    expect(result.manifest.enabledSections).toEqual(['cover', 'toc', 'analysis', 'memberForces']);
  });

  it('should error when project name is missing', () => {
    const payload: ReportCompositionPayload = {
      metadata: { ...mockMetadata, projectName: '' },
      sections: mockSections,
      diagrams: {
        include_sfd: true,
        include_bmd: true,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.ready).toBe(false);
    expect(result.errors).toContain('Project name is required.');
  });

  it('should error when prepared by is missing', () => {
    const payload: ReportCompositionPayload = {
      metadata: { ...mockMetadata, preparedBy: '  ' },
      sections: mockSections,
      diagrams: {
        include_sfd: true,
        include_bmd: true,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.ready).toBe(false);
    expect(result.errors).toContain('Prepared by is required.');
  });

  it('should error when no sections are enabled', () => {
    const noSections: ReportSection[] = [
      {
        id: 'cover-1',
        type: 'cover',
        title: 'Cover Page',
        enabled: false,
        expanded: false,
        options: {},
      },
    ];

    const payload: ReportCompositionPayload = {
      metadata: mockMetadata,
      sections: noSections,
      diagrams: {
        include_sfd: false,
        include_bmd: false,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.ready).toBe(false);
    expect(result.errors).toContain('Enable at least one report section.');
  });

  it('should error when geometry sections are enabled but no nodes exist', () => {
    const payload: ReportCompositionPayload = {
      metadata: mockMetadata,
      sections: [
        {
          id: 'geometry-1',
          type: 'geometry',
          title: 'Model Geometry',
          enabled: true,
          expanded: false,
          options: {},
        },
      ],
      diagrams: {
        include_sfd: false,
        include_bmd: false,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const emptyModel = { nodeCount: 0, memberCount: 0 };
    const result = validateReportComposition(payload, emptyModel);

    expect(result.ready).toBe(false);
    expect(result.errors).toContain('Model geometry/analysis sections require nodes in the model.');
  });

  it('should warn when member forces enabled but no diagrams selected', () => {
    const payload: ReportCompositionPayload = {
      metadata: mockMetadata,
      sections: [
        {
          id: 'memberForces-1',
          type: 'memberForces',
          title: 'Member Forces',
          enabled: true,
          expanded: false,
          options: {
            include_sfd: false,
            include_bmd: false,
            include_afd: false,
            include_bmd_my: false,
            include_shear_z: false,
          },
        },
      ],
      diagrams: {
        include_sfd: false,
        include_bmd: false,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('Member forces section is enabled but no force diagrams are selected.');
  });

  it('should warn when code check enabled but design codes not specified', () => {
    const payload: ReportCompositionPayload = {
      metadata: { ...mockMetadata, designCodes: '' },
      sections: [
        {
          id: 'codeCheck-1',
          type: 'codeCheck',
          title: 'Code Compliance',
          enabled: true,
          expanded: false,
          options: {},
        },
      ],
      diagrams: {
        include_sfd: false,
        include_bmd: false,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payload, mockAvailability);

    expect(result.warnings).toContain('Design codes are not specified for the code compliance section.');
  });

  it('should calculate readiness score based on errors and warnings', () => {
    const payloadWithWarnings: ReportCompositionPayload = {
      metadata: { ...mockMetadata, designCodes: '' },
      sections: [
        {
          id: 'codeCheck-1',
          type: 'codeCheck',
          title: 'Code Compliance',
          enabled: true,
          expanded: false,
          options: {},
        },
        {
          id: 'memberForces-1',
          type: 'memberForces',
          title: 'Member Forces',
          enabled: true,
          expanded: false,
          options: { include_sfd: false, include_bmd: false },
        },
      ],
      diagrams: {
        include_sfd: false,
        include_bmd: false,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    const result = validateReportComposition(payloadWithWarnings, mockAvailability);

    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('reportComposition: Diagram Selection', () => {
  it('should extract diagram selections from sections', () => {
    const sections: ReportSection[] = [
      {
        id: 'memberForces-1',
        type: 'memberForces',
        title: 'Member Forces',
        enabled: true,
        expanded: false,
        options: { showShear: true, showMoment: true, showAxial: false },
      },
    ];

    const diagrams = buildDiagramSelectionFromSections(sections);

    expect(diagrams.include_sfd).toBe(true);
    expect(diagrams.include_bmd).toBe(true);
    expect(diagrams.include_afd).toBe(false);
  });

  it('should return all false when no sections enabled', () => {
    const sections: ReportSection[] = [
      {
        id: 'cover-1',
        type: 'cover',
        title: 'Cover Page',
        enabled: true,
        expanded: false,
        options: {},
      },
    ];

    const diagrams = buildDiagramSelectionFromSections(sections);

    expect(diagrams.include_sfd).toBe(false);
    expect(diagrams.include_bmd).toBe(false);
    expect(diagrams.include_deflection).toBe(false);
    expect(diagrams.include_afd).toBe(false);
  });

  it('should extract deflection option from displacements section', () => {
    const sections: ReportSection[] = [
      {
        id: 'displacements-1',
        type: 'displacements',
        title: 'Displacements',
        enabled: true,
        expanded: false,
        options: { showDeformedShape: true },
      },
    ];

    const diagrams = buildDiagramSelectionFromSections(sections);

    expect(diagrams.include_deflection).toBe(true);
    expect(diagrams.include_bmd).toBe(false);
  });
});
