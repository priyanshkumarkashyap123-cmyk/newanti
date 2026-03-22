import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { ReportBuilder, type ReportConfig } from '@/modules/reports/EngineeringReportGenerator';
import { FileText, Download, Eye, Settings, Plus, Trash2, GripVertical, Zap } from 'lucide-react';
import { Input, TextArea, Switch } from '@/components/ui/FormInputs';
import { useModelStore } from '@/store/model';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastSystem';
import { generateBasicPDFReport } from '@/services/PDFReportService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/providers/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { ANALYTICS_EVENTS, useAnalytics } from '@/providers/AnalyticsProvider';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  level: 1 | 2 | 3;
}

export default function ReportBuilderPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { user, isSignedIn } = useAuth();
  const { subscription } = useSubscription();
  const { track } = useAnalytics();
  const nodes = useModelStore(s => s.nodes);
  const members = useModelStore(s => s.members);
  const analysisResults = useModelStore(s => s.analysisResults);
  const [config, setConfig] = useState<Partial<ReportConfig>>({
    title: 'Structural Design Report',
    projectName: 'Tower A',
    projectNumber: 'PRJ-2026-001',
    client: 'Acme Infrastructure',
    engineer: 'Lead Structural Engineer',
    date: new Date().toISOString().slice(0, 10),
    revision: 'A1',
    companyName: 'BeamLab',
    format: 'markdown',
    includeTableOfContents: true,
    includePageNumbers: true,
    includeCoverPage: true,
    includeAppendix: false,
    approver: 'Chief Structural Engineer'
  });

  const [sections, setSections] = useState<ReportSection[]>([
    { id: '1', title: 'Introduction', level: 1, content: 'This report presents the structural design calculations for Tower A, including analysis results, member designs, and code compliance checks.' },
    { id: '2', title: 'Design Basis', level: 1, content: 'Design codes: IS 456:2000, IS 800:2007, IS 1893:2016. Materials: M30 concrete, Fe500 reinforcement, Grade 350 steel.' },
    { id: '3', title: 'Load Analysis', level: 1, content: 'Dead loads, live loads, seismic loads, and wind loads as per IS 875 Parts 1-3 and IS 1893.' },
    { id: '4', title: 'Member Design', level: 1, content: 'All beams, columns, slabs, and footings designed with adequate safety factors.' },
    { id: '5', title: 'Conclusions', level: 1, content: 'The structure is safe and serviceable under all design load combinations.' },
  ]);

  useEffect(() => { document.title = 'Report Builder | BeamLab'; }, []);

  const [showPreview, setShowPreview] = useState(false);
  const [newSection, setNewSection] = useState({ title: '', content: '' });

  const completedSections = useMemo(
    () => sections.filter((s) => s.title.trim().length > 0 && s.content.trim().length > 0).length,
    [sections],
  );
  const completionPercent = sections.length > 0 ? Math.round((completedSections / sections.length) * 100) : 0;

  const exportReadinessIssues = useMemo(() => {
    const issues: string[] = [];
    if (!(config.projectName || '').trim()) issues.push('Project name is required');
    if (!(config.engineer || '').trim()) issues.push('Engineer name is required');
    if (sections.length === 0) issues.push('Add at least one report section');
    if (completedSections === 0) issues.push('Complete at least one section with title and content');
    return issues;
  }, [config.projectName, config.engineer, sections.length, completedSections]);

  const ensureExportReady = useCallback((): boolean => {
    if (exportReadinessIssues.length === 0) return true;
    toast.warning(`Export not ready: ${exportReadinessIssues.join(' · ')}`);
    track(ANALYTICS_EVENTS.REPORT_EXPORT_BLOCKED, {
      issues: exportReadinessIssues,
      issueCount: exportReadinessIssues.length,
      completionPercent,
      sectionCount: sections.length,
    });
    return false;
  }, [exportReadinessIssues, toast, track, completionPercent, sections.length]);

  const generatedReport = useMemo(() => {
    const builder = new ReportBuilder(config);
    
    sections.forEach(section => {
      builder.addSection(section.title, section.level);
      builder.addParagraph(section.content);
    });

    return builder.generate();
  }, [config, sections]);

  const addSection = useCallback(() => {
    if (!newSection.title) return;
    setSections(prev => [...prev, {
      id: String(Date.now()),
      title: newSection.title,
      content: newSection.content,
      level: 1
    }]);
    setNewSection({ title: '', content: '' });
  }, [newSection]);

  const removeSection = useCallback(async (id: string) => {
    const section = sections.find(s => s.id === id);
    const confirmed = await confirm({
      title: 'Remove Section?',
      message: `Are you sure you want to remove "${section?.title || 'this section'}"? This cannot be undone.`,
      confirmText: 'Remove',
      variant: 'danger'
    });
    if (confirmed) {
      setSections(prev => prev.filter(s => s.id !== id));
    }
  }, [confirm, sections]);

  const updateSection = useCallback((id: string, updates: Partial<ReportSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const autoFillFromModel = useCallback(() => {
    const autoSections: ReportSection[] = [];
    let idx = 1;

    autoSections.push({
      id: String(idx++), title: 'Introduction', level: 1,
      content: `This report presents the structural design calculations for ${config.projectName || 'the project'}. ` +
        `The model consists of ${nodes.size} nodes and ${members.size} members.`
    });

    autoSections.push({
      id: String(idx++), title: 'Design Basis', level: 1,
      content: 'Design codes: IS 456:2000, IS 800:2007, IS 1893:2016. Materials: M25 concrete, Fe500 reinforcement, Grade 250/350 steel. ' +
        'Load combinations as per IS 456 Table 18 and IS 1893:2016 Cl. 6.3.1.'
    });

    // Geometry summary
    if (members.size > 0) {
      const lengths: number[] = [];
      const sections = new Map<string, number>();
      members.forEach(m => {
        const n1 = nodes.get(m.startNodeId);
        const n2 = nodes.get(m.endNodeId);
        if (n1 && n2) {
          lengths.push(Math.sqrt((n2.x - n1.x) ** 2 + ((n2.y ?? 0) - (n1.y ?? 0)) ** 2 + ((n2.z ?? 0) - (n1.z ?? 0)) ** 2));
        }
        const sec = m.sectionId || 'Unassigned';
        sections.set(sec, (sections.get(sec) || 0) + 1);
      });
      const sectionLines = Array.from(sections.entries()).map(([name, count]) => `${name}: ${count} members`).join('; ');
      autoSections.push({
        id: String(idx++), title: 'Structural Model', level: 1,
        content: `Nodes: ${nodes.size}. Members: ${members.size}. ` +
          `Member lengths range from ${Math.min(...lengths).toFixed(2)}m to ${Math.max(...lengths).toFixed(2)}m. ` +
          `Total length: ${lengths.reduce((a, b) => a + b, 0).toFixed(1)}m. ` +
          `Sections: ${sectionLines}.`
      });
    }

    // Analysis results
    if (analysisResults) {
      const disps = analysisResults.displacements;
      let maxDisp = 0;
      disps.forEach(d => {
        maxDisp = Math.max(maxDisp, Math.abs(d.dx), Math.abs(d.dy), Math.abs(d.dz));
      });

      const forces = analysisResults.memberForces;
      let maxMoment = 0, maxShear = 0, maxAxial = 0;
      forces.forEach(f => {
        maxMoment = Math.max(maxMoment, Math.abs(f.momentY));
        maxShear = Math.max(maxShear, Math.abs(f.shearY));
        maxAxial = Math.max(maxAxial, Math.abs(f.axial));
      });

      autoSections.push({
        id: String(idx++), title: 'Analysis Results', level: 1,
        content: `Analysis completed for ${forces.size} members. ` +
          `Max displacement: ${(maxDisp * 1000).toFixed(2)}mm. ` +
          `Max bending moment: ${maxMoment.toFixed(1)} kNm. ` +
          `Max shear force: ${maxShear.toFixed(1)} kN. ` +
          `Max axial force: ${maxAxial.toFixed(1)} kN.`
      });

      // Reactions
      const reactions = analysisResults.reactions;
      if (reactions.size > 0) {
        let totalVertical = 0;
        reactions.forEach(r => { totalVertical += Math.abs(r.fy); });
        autoSections.push({
          id: String(idx++), title: 'Support Reactions', level: 2,
          content: `${reactions.size} support reactions computed. ` +
            `Total vertical reaction: ${totalVertical.toFixed(1)} kN.`
        });
      }
    } else {
      autoSections.push({
        id: String(idx++), title: 'Analysis Results', level: 1,
        content: 'Analysis has not been run yet. Run structural analysis to populate this section with actual results.'
      });
    }

    autoSections.push({
      id: String(idx++), title: 'Conclusions', level: 1,
      content: analysisResults
        ? 'The structural analysis has been completed. Member forces and displacements are within acceptable limits. Detailed design checks should be performed for critical members.'
        : 'The structural model has been defined. Analysis and design checking are pending.'
    });

    setSections(autoSections);
  }, [nodes, members, analysisResults, config.projectName]);

  const downloadReportAsPDF = useCallback(async () => {
    if (!ensureExportReady()) {
      return;
    }

    try {
      const memberList = Array.from(members.values());
      const nodeList = Array.from(nodes.values());
      await generateBasicPDFReport(
        {
          name: config.projectName ?? 'Untitled Project',
          engineer: config.engineer ?? 'Engineer',
          date: config.date ?? new Date().toLocaleDateString(),
          description: config.title ?? 'Structural Design Report',
        },
        memberList,
        nodeList,
        analysisResults ?? null,
        new Map()
      );
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to generate PDF report');
    }
  }, [config, members, nodes, analysisResults, toast, ensureExportReady]);

  const downloadReport = useCallback((format: 'markdown' | 'html') => {
    if (!ensureExportReady()) {
      return;
    }

    const updatedConfig: ReportConfig = { 
      ...config, 
      format,
      title: config.title || 'Report',
      projectName: config.projectName || '',
      projectNumber: config.projectNumber || '',
      client: config.client || '',
      engineer: config.engineer || '',
      date: config.date || new Date().toISOString().slice(0, 10),
      revision: config.revision || 'A1',
      companyName: config.companyName || '',
      includeTableOfContents: config.includeTableOfContents ?? false,
      includePageNumbers: config.includePageNumbers ?? false,
      includeCoverPage: config.includeCoverPage ?? false,
      includeAppendix: config.includeAppendix ?? false,
    };
    const builder = new ReportBuilder(updatedConfig);
    sections.forEach(section => {
      builder.addSection(section.title, section.level);
      builder.addParagraph(section.content);
    });
    
    const content = builder.generate();
    const ext = format === 'markdown' ? 'md' : 'html';
    const mimeType = format === 'markdown' ? 'text/markdown' : 'text/html';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.projectNumber || 'report'}_structural_report.${ext}`;
    a.click();
    toast.success(`Report downloaded as ${ext.toUpperCase()}`);
  }, [config, sections, ensureExportReady, toast]);

  return (
    <div className="min-h-screen bg-canvas text-token p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-dim hover:text-token transition-colors"
              aria-label="Back to Dashboard"
            >
              ← Back
            </button>
            <div className="w-px h-5 bg-border" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-dim">Reports</p>
              <h1 className="text-2xl font-bold">Engineering Report Builder</h1>
              <p className="text-dim">Create professional structural design reports.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn && user && (
              <div className="flex items-center gap-2 mr-2 pr-2 border-r border-border">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
                </div>
                <span className="text-sm text-dim hidden sm:block">{user.firstName ?? user.email}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  subscription.tier === 'free'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : subscription.tier === 'pro'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                }`}>
                  {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
                </span>
              </div>
            )}
            {members.size > 0 && (
              <button type="button" onClick={autoFillFromModel} className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors">
                <Zap className="w-4 h-4" />
                Auto-fill ({members.size} members)
              </button>
            )}
            <button type="button" onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
              <Eye className="w-4 h-4" />
              {showPreview ? 'Edit' : 'Preview'}
            </button>
            <button type="button" onClick={() => downloadReport('markdown')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Markdown
            </button>
            <button type="button" onClick={() => downloadReport('html')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              HTML
            </button>
            <button type="button" onClick={downloadReportAsPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Config Panel */}
          <div className="rounded-xl border border-border bg-canvas p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">Report Settings</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Project Name"
                value={config.projectName || ''}
                onChange={e => setConfig(prev => ({ ...prev, projectName: e.target.value }))}
              />
              <Input
                label="Project Number"
                value={config.projectNumber || ''}
                onChange={e => setConfig(prev => ({ ...prev, projectNumber: e.target.value }))}
              />
              <Input
                label="Client"
                value={config.client || ''}
                onChange={e => setConfig(prev => ({ ...prev, client: e.target.value }))}
              />
              <Input
                label="Engineer"
                value={config.engineer || ''}
                onChange={e => setConfig(prev => ({ ...prev, engineer: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Revision"
                  value={config.revision || ''}
                  onChange={e => setConfig(prev => ({ ...prev, revision: e.target.value }))}
                />
                <Input
                  label="Date"
                  type="date"
                  value={config.date || ''}
                  onChange={e => setConfig(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <Switch
                label="Cover Page"
                checked={!!config.includeCoverPage}
                onChange={v => setConfig(prev => ({ ...prev, includeCoverPage: v }))}
              />
              <Switch
                label="Table of Contents"
                checked={!!config.includeTableOfContents}
                onChange={v => setConfig(prev => ({ ...prev, includeTableOfContents: v }))}
              />
            </div>
          </div>

          {/* Sections Panel */}
          <div className="md:col-span-2 rounded-xl border border-border bg-canvas p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold">Report Sections</h2>
              </div>
              <span className="text-xs text-dim">{sections.length} sections</span>
            </div>

            <div className="rounded-lg border border-border bg-surface/40 p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-dim">Report completion</span>
                <span className="font-semibold text-token">{completionPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              {exportReadinessIssues.length > 0 ? (
                <p className="text-xs text-amber-500 mt-2">
                  Before export: {exportReadinessIssues[0]}
                </p>
              ) : (
                <p className="text-xs text-emerald-500 mt-2">Export readiness check passed</p>
              )}
            </div>

            {showPreview ? (
              <div className="bg-white text-slate-900 rounded-lg p-6 max-h-96 overflow-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono">{generatedReport}</pre>
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {sections.map(section => (
                    <div key={section.id} className="flex items-start gap-2 p-3 bg-surface rounded-lg">
                      <GripVertical className="w-4 h-4 text-dim mt-1 cursor-move" aria-hidden="true" />
                      <div className="flex-1 space-y-1">
                        <label htmlFor={`section-title-${section.id}`} className="sr-only">Section title</label>
                        <input
                          id={`section-title-${section.id}`}
                          value={section.title}
                          onChange={e => updateSection(section.id, { title: e.target.value })}
                          className="w-full px-2 py-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded text-sm font-medium tracking-wide tracking-wide"
                        />
                        <label htmlFor={`section-content-${section.id}`} className="sr-only">Section content</label>
                        <textarea
                          id={`section-content-${section.id}`}
                          value={section.content}
                          onChange={e => updateSection(section.id, { content: e.target.value })}
                          rows={2}
                          className="w-full px-2 py-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded text-xs resize-none"
                        />
                      </div>
                      <button type="button" aria-label="Remove section" onClick={() => removeSection(section.id)} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <h3 className="text-sm font-medium tracking-wide tracking-wide flex items-center gap-2"><Plus className="w-4 h-4" /> Add Section</h3>
                  <Input
                    label="Section Title"
                    placeholder="Section Title"
                    value={newSection.title}
                    onChange={e => setNewSection(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <TextArea
                    label="Section Content"
                    placeholder="Section Content"
                    value={newSection.content}
                    onChange={e => setNewSection(prev => ({ ...prev, content: e.target.value }))}
                    rows={2}
                  />
                  <button type="button" onClick={addSection} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm transition-colors">
                    Add Section
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
