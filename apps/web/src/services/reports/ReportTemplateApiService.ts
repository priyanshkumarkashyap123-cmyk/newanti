import { API_CONFIG } from '../../config/env';
import type { ReportSection } from '../../types/ReportTypes';
import type { ReportCompositionPayload } from '../../contracts/reportComposition';

export type ReportTemplateActorRole = 'admin' | 'member';

export interface OrgReportTemplate {
  template_id: string;
  org_id: string;
  template_name: string;
  description: string;
  section_toggles: Record<string, boolean>;
  diagram_toggles: Record<string, boolean>;
  ordering: string[];
  metadata_defaults: Record<string, unknown>;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface AuthContext {
  token?: string | null;
}

interface CreateTemplateInput {
  orgId: string;
  actorUserId: string;
  actorRole: ReportTemplateActorRole;
  payload: ReportCompositionPayload;
  templateName: string;
  description?: string;
  isPublished?: boolean;
}

interface UpdateTemplateInput {
  orgId: string;
  templateId: string;
  actorUserId: string;
  actorRole: ReportTemplateActorRole;
  payload?: ReportCompositionPayload;
  templateName?: string;
  description?: string;
  isPublished?: boolean;
}

interface DeleteTemplateInput {
  orgId: string;
  templateId: string;
  actorUserId: string;
  actorRole: ReportTemplateActorRole;
}

const SECTION_TO_TOGGLE: Record<string, string> = {
  cover: 'include_cover_page',
  toc: 'include_toc',
  summary: 'include_input_summary',
  loads: 'include_load_cases',
  combinations: 'include_load_combinations',
  displacements: 'include_node_displacements',
  memberForces: 'include_member_forces',
  reactions: 'include_reaction_summary',
  analysis: 'include_analysis_results',
  codeCheck: 'include_design_checks',
  concreteDesign: 'include_concrete_design',
  foundationDesign: 'include_foundation_design',
  connectionDesign: 'include_connection_design',
};

function buildHeaders(auth?: AuthContext): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  return headers;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (data as { detail?: string })?.detail ?? `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return data as T;
}

function buildSectionToggles(sections: ReportSection[]): Record<string, boolean> {
  const toggles: Record<string, boolean> = {
    include_diagrams: false,
  };

  const enabled = sections.filter((section) => section.enabled);
  for (const section of enabled) {
    const mapped = SECTION_TO_TOGGLE[section.type];
    if (mapped) toggles[mapped] = true;

    if (section.type === 'memberForces' || section.type === 'displacements') {
      toggles.include_diagrams = true;
    }
  }

  return toggles;
}

function buildTemplatePayload(payload: ReportCompositionPayload) {
  return {
    section_toggles: buildSectionToggles(payload.sections),
    diagram_toggles: payload.diagrams,
    ordering: payload.sections.map((section) => section.type),
    metadata_defaults: {
      designCodes: payload.metadata.designCodes ?? '',
      reportType: payload.metadata.reportType,
    },
  };
}

function buildSectionsFromTemplate(template: OrgReportTemplate, currentSections: ReportSection[]): ReportSection[] {
  const ordering = template.ordering.length > 0 ? template.ordering : currentSections.map((s) => s.type);

  const sectionByType = new Map(currentSections.map((section) => [section.type, section]));
  const ordered = ordering
    .map((type) => sectionByType.get(type as ReportSection['type']))
    .filter((section): section is ReportSection => Boolean(section))
    .map((section) => {
      const toggleKey = SECTION_TO_TOGGLE[section.type];
      const enabled = toggleKey ? Boolean(template.section_toggles[toggleKey]) : section.enabled;
      return { ...section, enabled };
    });

  const missing = currentSections
    .filter((section) => !ordering.includes(section.type))
    .map((section) => {
      const toggleKey = SECTION_TO_TOGGLE[section.type];
      const enabled = toggleKey ? Boolean(template.section_toggles[toggleKey]) : section.enabled;
      return { ...section, enabled };
    });

  return [...ordered, ...missing];
}

const BASE_URL = `${API_CONFIG.baseUrl}/api/reports`;

export const reportTemplateApiService = {
  async listOrgTemplates(orgId: string, actorUserId: string, auth?: AuthContext): Promise<OrgReportTemplate[]> {
    const url = `${BASE_URL}/org/${encodeURIComponent(orgId)}/templates?actor_user_id=${encodeURIComponent(actorUserId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(auth),
    });
    return parseJsonOrThrow<OrgReportTemplate[]>(response);
  },

  async createOrgTemplate(input: CreateTemplateInput, auth?: AuthContext): Promise<OrgReportTemplate> {
    const { orgId, actorUserId, actorRole, payload, templateName, description = '', isPublished = false } = input;

    const response = await fetch(`${BASE_URL}/org/${encodeURIComponent(orgId)}/templates`, {
      method: 'POST',
      headers: buildHeaders(auth),
      body: JSON.stringify({
        template_name: templateName,
        description,
        ...buildTemplatePayload(payload),
        is_published: isPublished,
        actor_user_id: actorUserId,
        actor_role: actorRole,
      }),
    });

    return parseJsonOrThrow<OrgReportTemplate>(response);
  },

  async getOrgTemplate(
    orgId: string,
    templateId: string,
    actorUserId: string,
    auth?: AuthContext,
  ): Promise<OrgReportTemplate> {
    const url = `${BASE_URL}/org/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}?actor_user_id=${encodeURIComponent(actorUserId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(auth),
    });

    return parseJsonOrThrow<OrgReportTemplate>(response);
  },

  async updateOrgTemplate(input: UpdateTemplateInput, auth?: AuthContext): Promise<OrgReportTemplate> {
    const { orgId, templateId, actorUserId, actorRole, payload, templateName, description, isPublished } = input;
    const body: Record<string, unknown> = {
      actor_user_id: actorUserId,
      actor_role: actorRole,
    };

    if (typeof templateName === 'string') body.template_name = templateName;
    if (typeof description === 'string') body.description = description;
    if (typeof isPublished === 'boolean') body.is_published = isPublished;
    if (payload) {
      Object.assign(body, buildTemplatePayload(payload));
    }

    const response = await fetch(
      `${BASE_URL}/org/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}`,
      {
        method: 'PUT',
        headers: buildHeaders(auth),
        body: JSON.stringify(body),
      },
    );

    return parseJsonOrThrow<OrgReportTemplate>(response);
  },

  async publishOrgTemplate(input: Omit<UpdateTemplateInput, 'isPublished'>, auth?: AuthContext): Promise<OrgReportTemplate> {
    return reportTemplateApiService.updateOrgTemplate(
      {
        ...input,
        isPublished: true,
      },
      auth,
    );
  },

  async deleteOrgTemplate(input: DeleteTemplateInput, auth?: AuthContext): Promise<{ success: boolean; deleted_template_id: string }> {
    const { orgId, templateId, actorUserId, actorRole } = input;
    const params = new URLSearchParams({
      actor_user_id: actorUserId,
      actor_role: actorRole,
    });
    const response = await fetch(
      `${BASE_URL}/org/${encodeURIComponent(orgId)}/templates/${encodeURIComponent(templateId)}?${params.toString()}`,
      {
        method: 'DELETE',
        headers: buildHeaders(auth),
      },
    );

    return parseJsonOrThrow<{ success: boolean; deleted_template_id: string }>(response);
  },

  applyTemplateToSections(template: OrgReportTemplate, currentSections: ReportSection[]): ReportSection[] {
    return buildSectionsFromTemplate(template, currentSections);
  },
};
