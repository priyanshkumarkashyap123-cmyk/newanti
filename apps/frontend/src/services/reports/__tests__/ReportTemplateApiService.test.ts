import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportTemplateApiService, type OrgReportTemplate } from '../ReportTemplateApiService';
import type { ReportSection } from '../../../types/ReportTypes';
import type { ReportCompositionPayload } from '../../../contracts/reportComposition';

function createTemplate(overrides: Partial<OrgReportTemplate> = {}): OrgReportTemplate {
  return {
    template_id: 'tmpl-1',
    org_id: 'org-1',
    template_name: 'Template A',
    description: 'test',
    section_toggles: {
      include_cover_page: true,
      include_toc: false,
      include_input_summary: true,
      include_analysis_results: true,
      include_member_forces: false,
    },
    diagram_toggles: {
      include_sfd: true,
      include_bmd: true,
    },
    ordering: ['cover', 'summary', 'analysis', 'memberForces', 'toc'],
    metadata_defaults: {},
    is_published: false,
    created_by: 'u-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ReportTemplateApiService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applyTemplateToSections applies ordering and section toggles', () => {
    const sections: ReportSection[] = [
      { id: 's1', type: 'toc', title: 'TOC', enabled: true, expanded: false, options: {} },
      { id: 's2', type: 'memberForces', title: 'Forces', enabled: true, expanded: false, options: {} },
      { id: 's3', type: 'cover', title: 'Cover', enabled: true, expanded: false, options: {} },
      { id: 's4', type: 'analysis', title: 'Analysis', enabled: false, expanded: false, options: {} },
      { id: 's5', type: 'summary', title: 'Summary', enabled: false, expanded: false, options: {} },
    ];

    const result = reportTemplateApiService.applyTemplateToSections(createTemplate(), sections);

    expect(result.map((section) => section.type).slice(0, 5)).toEqual([
      'cover',
      'summary',
      'analysis',
      'memberForces',
      'toc',
    ]);

    const byType = Object.fromEntries(result.map((section) => [section.type, section.enabled]));
    expect(byType.cover).toBe(true);
    expect(byType.summary).toBe(true);
    expect(byType.analysis).toBe(true);
    expect(byType.memberForces).toBe(false);
    expect(byType.toc).toBe(false);
  });

  it('applyTemplateToSections keeps unknown section types untouched', () => {
    const sections: ReportSection[] = [
      { id: 's1', type: 'custom', title: 'Custom', enabled: true, expanded: false, options: {} },
      { id: 's2', type: 'cover', title: 'Cover', enabled: false, expanded: false, options: {} },
    ];

    const result = reportTemplateApiService.applyTemplateToSections(
      createTemplate({ ordering: ['cover', 'custom'] }),
      sections,
    );

    const custom = result.find((section) => section.type === 'custom');
    const cover = result.find((section) => section.type === 'cover');

    expect(custom?.enabled).toBe(true);
    expect(cover?.enabled).toBe(true);
  });

  it('createOrgTemplate sends mapped payload structure', async () => {
    const createdTemplate = createTemplate();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdTemplate), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload: ReportCompositionPayload = {
      metadata: {
        projectName: 'Project A',
        preparedBy: 'Engineer A',
        date: '2026-03-24',
        reportType: 'Structural Report',
        designCodes: 'IS 456',
      },
      sections: [
        { id: 's1', type: 'cover', title: 'Cover', enabled: true, expanded: false, options: {} },
        { id: 's2', type: 'analysis', title: 'Analysis', enabled: true, expanded: false, options: {} },
      ],
      diagrams: {
        include_sfd: true,
        include_bmd: true,
        include_deflection: false,
        include_afd: false,
        include_bmd_my: false,
        include_shear_z: false,
      },
    };

    await reportTemplateApiService.createOrgTemplate({
      orgId: 'org-1',
      actorUserId: 'user-a',
      actorRole: 'member',
      payload,
      templateName: 'My Template',
      description: 'desc',
      isPublished: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/reports/org/org-1/templates');
    expect(options.method).toBe('POST');

    const body = JSON.parse(String(options.body));
    expect(body.template_name).toBe('My Template');
    expect(body.section_toggles.include_cover_page).toBe(true);
    expect(body.section_toggles.include_analysis_results).toBe(true);
    expect(body.ordering).toEqual(['cover', 'analysis']);
    expect(body.metadata_defaults.designCodes).toBe('IS 456');
  });

  it('publishOrgTemplate delegates to update endpoint with is_published true', async () => {
    const updatedTemplate = createTemplate({ is_published: true });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updatedTemplate), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await reportTemplateApiService.publishOrgTemplate({
      orgId: 'org-1',
      templateId: 'tmpl-1',
      actorUserId: 'admin-a',
      actorRole: 'admin',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/reports/org/org-1/templates/tmpl-1');
    expect(options.method).toBe('PUT');
    const body = JSON.parse(String(options.body));
    expect(body.is_published).toBe(true);
    expect(body.actor_role).toBe('admin');
  });

  it('deleteOrgTemplate sends actor query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, deleted_template_id: 'tmpl-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await reportTemplateApiService.deleteOrgTemplate({
      orgId: 'org-1',
      templateId: 'tmpl-1',
      actorUserId: 'user-a',
      actorRole: 'member',
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('actor_user_id=user-a');
    expect(String(url)).toContain('actor_role=member');
    expect(options.method).toBe('DELETE');
  });
});
