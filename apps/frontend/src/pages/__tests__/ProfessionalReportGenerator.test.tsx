import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({
    userId: 'user-1',
    getToken: vi.fn().mockResolvedValue('token-1'),
  }),
}));

vi.mock('../../store/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/model')>();
  return {
    ...actual,
    useModelStore: vi.fn((selector: (s: any) => any) => {
      const state = {
        nodes: new Map([
          ['n1', { x: 0, y: 0, restraints: { ux: true } }],
          ['n2', { x: 4, y: 3, restraints: {} }],
        ]),
        members: new Map([
          ['m1', { startNodeId: 'n1', endNodeId: 'n2' }],
        ]),
        projectInfo: { name: 'Template Test Project' },
        analysisResults: null,
        modalResults: null,
        loadCases: [],
        loadCombinations: [],
        loads: [],
        memberLoads: [],
      };
      return selector(state);
    }),
  };
});

vi.mock('../../services/reports/ReportTemplateApiService', () => {
  const reportTemplateApiService = {
    listOrgTemplates: vi.fn(),
    createOrgTemplate: vi.fn(),
    getOrgTemplate: vi.fn(),
    updateOrgTemplate: vi.fn(),
    publishOrgTemplate: vi.fn(),
    deleteOrgTemplate: vi.fn(),
    applyTemplateToSections: vi.fn((_template, sections) => sections),
  };

  return {
    reportTemplateApiService,
  };
});

import ProfessionalReportGenerator from '../ProfessionalReportGenerator';
import { reportTemplateApiService } from '../../services/reports/ReportTemplateApiService';

const nowIso = new Date().toISOString();

const templateOwnedByOther = {
  template_id: 'tmpl-1',
  org_id: 'default-org',
  template_name: 'Team Draft',
  description: 'Draft by another user',
  section_toggles: { include_cover_page: true },
  diagram_toggles: { include_sfd: true },
  ordering: ['cover', 'analysis'],
  metadata_defaults: { designCodes: 'IS 456 + IS 800' },
  is_published: false,
  created_by: 'user-2',
  created_at: nowIso,
  updated_at: nowIso,
};

const templateOwnedByMe = {
  ...templateOwnedByOther,
  template_id: 'tmpl-2',
  template_name: 'My Draft',
  created_by: 'user-1',
};

describe('ProfessionalReportGenerator org template lifecycle UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('prompt', vi.fn(() => 'Updated Template Name'));

    vi.mocked(reportTemplateApiService.listOrgTemplates).mockResolvedValue([
      templateOwnedByOther,
      templateOwnedByMe,
    ] as any);
    vi.mocked(reportTemplateApiService.publishOrgTemplate).mockResolvedValue({
      ...templateOwnedByOther,
      is_published: true,
    } as any);
    vi.mocked(reportTemplateApiService.deleteOrgTemplate).mockResolvedValue({
      success: true,
      deleted_template_id: 'tmpl-1',
    });
    vi.mocked(reportTemplateApiService.updateOrgTemplate).mockResolvedValue({
      ...templateOwnedByOther,
      template_name: 'Updated Template Name',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps update/delete disabled for non-owner member and enables as admin', async () => {
    render(<ProfessionalReportGenerator />);

    await waitFor(() => {
      expect(reportTemplateApiService.listOrgTemplates).toHaveBeenCalled();
    });

    const updateButton = screen.getAllByRole('button', { name: 'Update' })[0] as HTMLButtonElement;
    const deleteButton = screen.getAllByRole('button', { name: 'Delete' })[0] as HTMLButtonElement;
    expect(updateButton.disabled).toBe(true);
    expect(deleteButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Actor role'), { target: { value: 'admin' } });

    await waitFor(() => {
      expect(updateButton.disabled).toBe(false);
      expect(deleteButton.disabled).toBe(false);
    });
  });

  it('publishes selected template as admin', async () => {
    render(<ProfessionalReportGenerator />);

    await waitFor(() => {
      expect(reportTemplateApiService.listOrgTemplates).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Actor role'), { target: { value: 'admin' } });

    const publishButton = screen.getAllByRole('button', { name: 'Publish' })[0];
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(reportTemplateApiService.publishOrgTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'default-org',
          templateId: 'tmpl-1',
          actorUserId: 'user-1',
          actorRole: 'admin',
        }),
        { token: 'token-1' },
      );
    });
  });

  it('deletes selected template with confirmation when actor can modify', async () => {
    render(<ProfessionalReportGenerator />);

    await waitFor(() => {
      expect(reportTemplateApiService.listOrgTemplates).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Actor role'), { target: { value: 'admin' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    await waitFor(() => {
      expect(reportTemplateApiService.deleteOrgTemplate).toHaveBeenCalledWith(
        {
          orgId: 'default-org',
          templateId: 'tmpl-1',
          actorUserId: 'user-1',
          actorRole: 'admin',
        },
        { token: 'token-1' },
      );
    });
  });

  it('updates selected template and pushes current composition', async () => {
    render(<ProfessionalReportGenerator />);

    await waitFor(() => {
      expect(reportTemplateApiService.listOrgTemplates).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Actor role'), { target: { value: 'admin' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Update' })[0]);

    await waitFor(() => {
      expect(reportTemplateApiService.updateOrgTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'default-org',
          templateId: 'tmpl-1',
          actorUserId: 'user-1',
          actorRole: 'admin',
          templateName: 'Updated Template Name',
        }),
        { token: 'token-1' },
      );
    });
  });
});
