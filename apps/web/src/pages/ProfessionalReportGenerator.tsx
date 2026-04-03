import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import {
  reportTemplateApiService,
  type OrgReportTemplate,
  type ReportTemplateActorRole,
} from '../services/reports/ReportTemplateApiService';

const DEFAULT_ORG_ID = 'default-org';

function buildCurrentComposition() {
  return {
    sections: [],
    diagrams: {
      include_sfd: false,
      include_bmd: false,
      include_deflection: false,
      include_afd: false,
      include_bmd_my: false,
      include_shear_z: false,
    },
    metadata: {
      projectName: 'Untitled Project',
      preparedBy: 'Unknown',
      date: new Date().toISOString().slice(0, 10),
      reportType: 'professional',
      designCodes: '',
    },
  };
}

export default function ProfessionalReportGenerator() {
  const { userId, getToken } = useAuth();
  const [actorRole, setActorRole] = useState<ReportTemplateActorRole>('member');
  const [templates, setTemplates] = useState<OrgReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const loadTemplates = async () => {
      if (!userId) return;
      const token = await getToken?.();
      const list = await reportTemplateApiService.listOrgTemplates(DEFAULT_ORG_ID, userId, { token });
      if (!mounted) return;
      setTemplates(list);
      if (list.length > 0) {
        setSelectedTemplateId(list[0].template_id);
      }
    };

    void loadTemplates();

    return () => {
      mounted = false;
    };
  }, [userId, getToken]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.template_id === selectedTemplateId) ?? templates[0],
    [templates, selectedTemplateId],
  );

  const canModify = Boolean(
    selectedTemplate && (actorRole === 'admin' || selectedTemplate.created_by === userId),
  );

  const callAuth = async () => ({ token: await getToken?.() });

  const handlePublish = async () => {
    if (!selectedTemplate || !userId) return;
    await reportTemplateApiService.publishOrgTemplate(
      {
        orgId: DEFAULT_ORG_ID,
        templateId: selectedTemplate.template_id,
        actorUserId: userId,
        actorRole,
      },
      await callAuth(),
    );
  };

  const handleDelete = async () => {
    if (!selectedTemplate || !userId || !canModify) return;
    if (!confirm('Delete selected template?')) return;

    await reportTemplateApiService.deleteOrgTemplate(
      {
        orgId: DEFAULT_ORG_ID,
        templateId: selectedTemplate.template_id,
        actorUserId: userId,
        actorRole,
      },
      await callAuth(),
    );
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !userId || !canModify) return;
    const templateName = prompt('Template name', selectedTemplate.template_name);
    if (!templateName) return;

    await reportTemplateApiService.updateOrgTemplate(
      {
        orgId: DEFAULT_ORG_ID,
        templateId: selectedTemplate.template_id,
        actorUserId: userId,
        actorRole,
        templateName,
        payload: buildCurrentComposition(),
      },
      await callAuth(),
    );
  };

  return (
    <div>
      <label htmlFor="actor-role">Actor role</label>
      <select
        id="actor-role"
        value={actorRole}
        onChange={(e) => setActorRole(e.target.value as ReportTemplateActorRole)}
      >
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>

      <label htmlFor="template-select">Template</label>
      <select
        id="template-select"
        value={selectedTemplate?.template_id ?? ''}
        onChange={(e) => setSelectedTemplateId(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.template_id} value={t.template_id}>
            {t.template_name}
          </option>
        ))}
      </select>

      <button type="button" onClick={handleUpdate} disabled={!canModify}>
        Update
      </button>
      <button type="button" onClick={handleDelete} disabled={!canModify}>
        Delete
      </button>
      <button type="button" onClick={handlePublish}>
        Publish
      </button>
    </div>
  );
}
